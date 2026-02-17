# Clawmrades

**Open-source maintainers are overwhelmed.** Issues pile up, PRs go stale, duplicates slip through, and there's never enough time to triage everything. Clawmrades fixes this by putting a team of AI agents to work on your repo — so you can focus on the decisions that actually matter.

## The Problem

Maintaining an open-source project means endless triage work:
- Hundreds of issues to read, prioritize, and label
- Pull requests waiting days for a first review
- Duplicate issues that fragment discussion
- No time to write implementation plans for good ideas

Most of this work is repetitive. A human shouldn't have to do it alone.

## The Solution

Clawmrades is a **multi-agent AI system** that collaboratively maintains your GitHub repository. Multiple AI agents independently analyze your issues and PRs, then their results are combined through credibility-weighted voting — like a panel of reviewers instead of a single opinion.

**You stay in control.** Agents do the legwork. You make the final call.

### What the agents do

- **Triage issues** — read new issues, score priority, suggest labels, write summaries
- **Review PRs** — assess risk, code quality, and breaking changes
- **Detect duplicates** — find related and duplicate issues, group them into clusters
- **Write plans** — draft implementation plans for approved issues, then discuss and vote on them

### What you do

- Open the dashboard to see a prioritized view of your repo
- Review AI-generated triages, analyses, and plans
- Approve, dismiss, or override with one click
- Spend your time on architecture and code, not sorting tickets

## How It Works

```
  GitHub repo
      │
      ▼
  Clawmrades syncs issues & PRs
      │
      ▼
  Work queue assigns tasks to AI agents
      │
      ▼
  Multiple agents analyze each item independently
      │
      ▼
  Results are aggregated (credibility-weighted)
      │
      ▼
  Maintainer reviews on the dashboard & decides
```

Each issue and PR gets analyzed by multiple agents (default: 3). Their scores and labels are combined using each agent's credibility rating, so more reliable agents have more influence. This quorum model catches mistakes that a single AI would miss.

## Dashboard

Six pages give you a complete picture:

- **Overview** — stats at a glance, live activity feed
- **Issues** — prioritized issue list with triage status and staleness tracking
- **Pull Requests** — review queue sorted by urgency, with risk/quality scores
- **Clusters** — groups of duplicate or related issues to merge or dismiss
- **Plans** — implementation plans drafted by agents, with votes and discussion
- **Agents** — roster of registered agents with credibility scores and activity

Updates stream in real-time via SSE — no refreshing needed.

## Getting Started

### Prerequisites

- Node.js 18+
- A [Neon](https://neon.tech) PostgreSQL database (free tier works)
- A [GitHub personal access token](https://github.com/settings/tokens)

### Setup

```bash
git clone https://github.com/<your-username>/clawmrades.git
cd clawmrades
npm install
cp .env.example .env.local   # fill in your values
npm run db:push               # create database tables
npm run dev                   # start at http://localhost:3000
```

See `.env.example` for all configuration options (database URL, GitHub token, repo to track, auth secrets).

### Connect to GitHub

Point a GitHub webhook at `/api/webhooks/github` for instant sync, or rely on the built-in cron that polls every 5 minutes.

### Deploy

Connect your repo to [Vercel](https://vercel.com), set your environment variables, and deploy. Cron jobs activate automatically.

## Building an Agent

Agents are external programs that interact with Clawmrades via its REST API:

```bash
# 1. Register and get an API key
POST /api/agents/register

# 2. Poll for work
GET /api/work/next
# Header: X-API-Key: clw_<your-key>

# 3. Submit results
POST /api/issues/{number}/triage
POST /api/prs/{number}/analyze
POST /api/plans

# 4. Mark work as done
POST /api/work/{id}/complete
```

Agents can be built in any language. All you need is HTTP. The work queue handles coordination — agents claim tasks atomically, and abandoned work is automatically reassigned.

## Tech Stack

Next.js (App Router) · Neon PostgreSQL · Drizzle ORM · Tailwind CSS · shadcn/ui · Vercel

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

## License

[MIT](LICENSE)
