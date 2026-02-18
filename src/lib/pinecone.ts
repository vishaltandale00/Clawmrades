import { Pinecone } from "@pinecone-database/pinecone";

// ── Lazy singletons ─────────────────────────────────────────────────────────

let _pinecone: Pinecone | null = null;

function getPinecone() {
  if (!_pinecone) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) throw new Error("PINECONE_API_KEY is not set");
    _pinecone = new Pinecone({ apiKey });
  }
  return _pinecone;
}

function getIndex() {
  const indexName = process.env.PINECONE_INDEX_NAME;
  if (!indexName) throw new Error("PINECONE_INDEX_NAME is not set");
  return getPinecone().index(indexName);
}

// ── Embedding model config ──────────────────────────────────────────────────

const EMBEDDING_MODEL = "llama-text-embed-v2";
const EMBEDDING_DIMS = 1024;

export { EMBEDDING_MODEL, EMBEDDING_DIMS };

// ── Types ───────────────────────────────────────────────────────────────────

export type EmbeddingType = "issue" | "pr";

export interface EmbeddingMetadata {
  type: EmbeddingType;
  number: number;
  title: string;
  repoOwner: string;
  repoName: string;
  state: string;
  embeddingModel: string;
}

export interface SimilarResult {
  dbId: number;
  score: number;
  metadata: EmbeddingMetadata;
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Embed a text string using Pinecone Inference (llama-text-embed-v2), returning a 1024-dim float array. */
export async function getEmbedding(text: string): Promise<number[]> {
  const pc = getPinecone();
  const result = await pc.inference.embed({
    model: EMBEDDING_MODEL,
    inputs: [text],
    parameters: { inputType: "passage", truncate: "END" },
  });
  const embedding = result.data[0];
  if (!embedding || embedding.vectorType !== "dense") {
    throw new Error("Pinecone inference returned no dense embedding");
  }
  return Array.from(embedding.values);
}

/** Store an embedding in Pinecone with metadata. ID format: "{type}-{dbId}" */
export async function upsertEmbedding(
  type: EmbeddingType,
  dbId: number,
  embedding: number[],
  metadata: Omit<EmbeddingMetadata, "type">
): Promise<void> {
  const index = getIndex();
  await index.upsert({
    records: [
      {
        id: `${type}-${dbId}`,
        values: embedding,
        metadata: { ...metadata, type },
      },
    ],
  });
}

/** Query Pinecone for similar embeddings, optionally filtered by type. */
export async function querySimilar(
  embedding: number[],
  topK: number = 10,
  filter?: Record<string, unknown>
): Promise<SimilarResult[]> {
  const index = getIndex();
  const result = await index.query({
    vector: embedding,
    topK,
    includeMetadata: true,
    filter,
  });

  return (result.matches ?? [])
    .filter((m) => m.score !== undefined)
    .map((m) => {
      const id = m.id;
      // Parse "issue-123" or "pr-456"
      const dashIdx = id.indexOf("-");
      const dbId = parseInt(id.slice(dashIdx + 1), 10);
      return {
        dbId,
        score: m.score!,
        metadata: m.metadata as unknown as EmbeddingMetadata,
      };
    });
}

/** Delete an embedding from Pinecone. */
export async function deleteEmbedding(
  type: EmbeddingType,
  dbId: number
): Promise<void> {
  const index = getIndex();
  await index.deleteOne({ id: `${type}-${dbId}` });
}

// ── Convenience wrappers (issue-specific) ───────────────────────────────────

export async function upsertIssueEmbedding(
  issueId: number,
  embedding: number[],
  metadata: Omit<EmbeddingMetadata, "type">
): Promise<void> {
  return upsertEmbedding("issue", issueId, embedding, metadata);
}

export async function querySimilarIssues(
  embedding: number[],
  topK: number = 10
): Promise<SimilarResult[]> {
  return querySimilar(embedding, topK, { type: { $eq: "issue" } });
}

export async function deleteIssueEmbedding(issueId: number): Promise<void> {
  return deleteEmbedding("issue", issueId);
}

// ── Convenience wrappers (PR-specific) ──────────────────────────────────────

export async function upsertPrEmbedding(
  prId: number,
  embedding: number[],
  metadata: Omit<EmbeddingMetadata, "type">
): Promise<void> {
  return upsertEmbedding("pr", prId, embedding, metadata);
}

export async function querySimilarPrs(
  embedding: number[],
  topK: number = 10
): Promise<SimilarResult[]> {
  return querySimilar(embedding, topK, { type: { $eq: "pr" } });
}

export async function deletePrEmbedding(prId: number): Promise<void> {
  return deleteEmbedding("pr", prId);
}

// ── Cluster helpers ─────────────────────────────────────────────────────────

const CLUSTER_RELATED_THRESHOLD = 0.85;

/** Query for similar items of the same type above the related threshold, excluding a specific DB id. */
export async function findClusterMatches(
  embedding: number[],
  type: EmbeddingType,
  excludeDbId: number,
  topK: number = 20
): Promise<SimilarResult[]> {
  const queryer = type === "issue" ? querySimilarIssues : querySimilarPrs;
  const results = await queryer(embedding, topK);
  return results.filter(
    (m) => m.dbId !== excludeDbId && m.score >= CLUSTER_RELATED_THRESHOLD
  );
}
