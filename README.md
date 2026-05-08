# Website Audit Tool

Monorepo for generating website audit reports (SEO, JS errors, and more).

## Tech

- `apps/web`: Next.js dashboard UI (Tailwind)
- `apps/api`: Fastify REST API + BullMQ worker
- `packages/analyzers`: Crawler + analyzers (Playwright + Cheerio)
- Redis: local install (`localhost:6379`) for BullMQ

## Local setup

1. Ensure Redis is running locally:
   - default: `localhost:6379`
2. Install dependencies:
   - `npm install`
3. Install Playwright browser binaries:
   - `npx playwright install --with-deps`
4. Configure environment:
   - copy `./.env.example` to `./.env`
5. Start:
   - `npm run dev`

## Phase 1 endpoints

- `POST /api/scan` with `{ "url": "https://example.com" }`
- `GET /api/scan/:id` to poll job status + results

