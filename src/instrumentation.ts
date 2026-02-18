export async function register() {
  const { generateWork } = await import("@/lib/generate-work");
  generateWork()
    .then(({ created }) =>
      console.log(`[startup] Seeded work queue: ${created} items`)
    )
    .catch((err) => console.error("[startup] Failed to seed work queue:", err));
}
