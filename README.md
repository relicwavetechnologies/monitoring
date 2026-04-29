This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Testing

Vitest is the unit test runner. Tests live under `tests/` and import source via the `@/*` alias.

```bash
pnpm test            # one-shot run
pnpm test:watch      # rerun on file change
pnpm test:coverage   # coverage report
pnpm typecheck       # tsc --noEmit
```

CI (`.github/workflows/ci.yml`) runs `typecheck` and `test` on every PR.

### Fixtures

Real (and synthetic) HTML responses for monitored sites live under `tests/fixtures/sites/<host>/<date>.html`. Capture a fresh fixture from a live URL with:

```bash
pnpm capture-fixture https://in.usembassy.gov/mumbai/ --label baseline
```

See `tests/fixtures/README.md` for conventions and when to capture.

## Logging

Structured JSON logs go through `pino` via `src/lib/logger.ts`. Use `getLogger("component.name", { siteId })` and log with `log.info({ ... }, "message")`. Never use `console.*` inside `src/lib/pipeline/*` — CI will keep that clean.

Log levels: `debug` in dev, `info` in production, `silent` in tests. Override with `LOG_LEVEL=…` at runtime.

## Database migrations

Production uses Prisma migrations. The deploy workflow runs `prisma migrate deploy` against the prod DB on every push to `main`.

```bash
pnpm db:migrate:dev    # create + apply a migration locally
pnpm db:migrate:deploy # apply pending migrations (used by CI)
pnpm db:push           # local-only fast-iteration; never in prod
```

### One-time prod cutover (Phase 1)

Before the very first migration-aware deploy, run **once** against the prod DB to mark the existing schema (originally created via `db push`) as equivalent to the baseline migration:

```bash
DATABASE_URL=... pnpm exec prisma migrate resolve --applied 0000_baseline
```

Subsequent migrations (e.g. `0001_phase1_correctness_floor`) layer on cleanly.

## Cron jobs (VM)

The host VM runs cron entries via `scripts/cron-call.sh <endpoint>`. Wire these in the host crontab:

```cron
0 9   * * *  /opt/visa-monitoring/scripts/cron-call.sh tick
0 8   * * *  /opt/visa-monitoring/scripts/cron-call.sh serper
*/15  * * *  /opt/visa-monitoring/scripts/cron-call.sh email-sweep
```

`vercel.json` mirrors the same schedule for parity, but the VM is the source of truth.
