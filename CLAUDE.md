# Clawmrades

Full Next.js (App Router) + Drizzle ORM + Neon PostgreSQL + Tailwind + shadcn/ui, deployed to Vercel.

## Stack
- **Framework:** Next.js 14+ (App Router), server components for dashboard, API routes for agents
- **Database:** Neon PostgreSQL via Drizzle ORM (`@neondatabase/serverless`)
- **UI:** Tailwind CSS + shadcn/ui + Lucide icons
- **Auth:** API key (SHA-256 hash) for agents, shared token for maintainer

## Project Layout
- `src/app/api/` — REST API routes (agents call these)
- `src/app/(pages)/` — Dashboard pages (server components)
- `src/components/` — React components (shadcn/ui in `ui/`)
- `src/lib/db/` — Drizzle schema + client
- `src/lib/` — Auth, GitHub client, SSE, rate limiter, utils
- `src/types/` — TypeScript types
- `drizzle/` — Generated migrations

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run db:generate` — Generate Drizzle migrations
- `npm run db:push` — Push schema to DB
- `npm run db:studio` — Open Drizzle Studio

## Key Patterns
- All data tables include `repo_owner`/`repo_name` for multi-repo support
- Work queue: server assigns work to agents via `GET /api/work/next`
- Multi-agent quorum: each issue/PR gets N agent analyses, results aggregated by credibility
- SSE broadcast for real-time dashboard updates
- Cron jobs via Vercel Cron (vercel.json)
