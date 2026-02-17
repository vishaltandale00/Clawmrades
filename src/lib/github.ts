import { Octokit } from "@octokit/rest";

let octokit: Octokit | null = null;

function getOctokit(): Octokit {
  if (!octokit) {
    octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  }
  return octokit;
}

function getRepo() {
  return {
    owner: process.env.REPO_OWNER!,
    repo: process.env.REPO_NAME!,
  };
}

export async function listOpenIssues(page = 1, perPage = 30) {
  const ok = getOctokit();
  const { owner, repo } = getRepo();
  const { data } = await ok.issues.listForRepo({
    owner,
    repo,
    state: "open",
    per_page: perPage,
    page,
  });
  // Filter out pull requests (GitHub API returns PRs as issues)
  return data.filter((i) => !i.pull_request);
}

export async function getIssue(number: number) {
  const ok = getOctokit();
  const { owner, repo } = getRepo();
  const { data } = await ok.issues.get({ owner, repo, issue_number: number });
  return data;
}

export async function listOpenPRs(page = 1, perPage = 30) {
  const ok = getOctokit();
  const { owner, repo } = getRepo();
  const { data } = await ok.pulls.list({
    owner,
    repo,
    state: "open",
    per_page: perPage,
    page,
  });
  return data;
}

export async function getPR(number: number) {
  const ok = getOctokit();
  const { owner, repo } = getRepo();
  const { data } = await ok.pulls.get({ owner, repo, pull_number: number });
  return data;
}

export async function getPRFiles(number: number) {
  const ok = getOctokit();
  const { owner, repo } = getRepo();
  const { data } = await ok.pulls.listFiles({
    owner,
    repo,
    pull_number: number,
  });
  return data;
}

export async function getRepoLabels() {
  const ok = getOctokit();
  const { owner, repo } = getRepo();
  const { data } = await ok.issues.listLabelsForRepo({ owner, repo });
  return data;
}

export async function addLabelsToIssue(number: number, labels: string[]) {
  const ok = getOctokit();
  const { owner, repo } = getRepo();
  await ok.issues.addLabels({
    owner,
    repo,
    issue_number: number,
    labels,
  });
}

export async function getPRCheckStatus(number: number) {
  const ok = getOctokit();
  const { owner, repo } = getRepo();
  const pr = await ok.pulls.get({ owner, repo, pull_number: number });
  const { data } = await ok.repos.getCombinedStatusForRef({
    owner,
    repo,
    ref: pr.data.head.sha,
  });
  return data.state;
}
