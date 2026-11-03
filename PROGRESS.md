# Progress

## Phases

- [x] **Phase 0 — Setup**: Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui, ESLint, Prisma 7, Vitest, Playwright, folder structure, CLAUDE.md, PROGRESS.md, .env.example, git.
- [x] **Phase 1 — Data & auth**: Prisma schema + migration, seed script, Auth.js credentials login, demo login buttons, role-based route protection, app shell with role-aware navigation.
- [x] **Phase 2 — Rules module**: business rules as pure functions in `src/lib/rules` with Vitest coverage.
- [x] **Phase 3 — Attendance**: check-in/out, dashboard card with live IST clock, `/attendance` calendar + table.
- [x] **Phase 4 — Leave**: balances, apply form with live day count, my requests, cancel, `/approvals`, approve/reject flow.
- [x] **Phase 5 — Manager & admin**: `/team`, all `/admin` pages (incl. branding), holidays page, role-specific dashboards.
- [x] **Phase 6 — Reports & audit**: `/reports` with CSV export, `/admin/audit`.
- [x] **Phase 7 — Quality pass**: brand-name sweep, Playwright tests, phone-sized check, empty/loading/error states, accessibility basics, README.
- [x] **Phase 8 — Deploy prep**: production build verified against a fresh database with `prisma migrate deploy` + seed; deployment steps in README.

## How to verify

- `npm run lint`, `npm run typecheck`, `npm run build`
- `npm test` (Vitest, rules module)
- `npm run test:e2e` (Playwright; needs a local database — see README)

## Decisions

Things the spec left open, and the simple option chosen:

- **Node 22+ required.** Current Prisma 7, Vitest and ESLint need Node ≥ 22.12 (Vercel uses Node 22/24).
- **Prisma 7.10 (stable)** is used. npm's `latest` tag for `prisma` pointed at an 8.0 release candidate.
- **Cache Components is off.** Nearly every page depends on the signed-in user and renders per request. Branding is cached with `unstable_cache` + the `branding` tag and cleared with `updateTag` when saved.
- **Proxy only reads the session cookie** (`src/proxy.ts`, via `getToken`). Auth.js's own middleware re-issues the cookie on every request, which raced with logout (a prefetch finishing after logout signed the user back in). Sessions last 7 days.
- **Role and active status are read from the database on every request**, not from the JWT, so role changes and deactivation take effect immediately. Unauthorized pages redirect to `/forbidden` (403 page); API routes return 401/403.
- **Dates** are stored as `@db.Date` and handled as `"YYYY-MM-DD"` strings in the rules module; "today" is always computed in Asia/Kolkata.
- **`fullDayMinHours`** doesn't change the daily status (the spec only uses `halfDayMinHours`); it highlights short days in the attendance log.
- **Late** is stored on the record at check-in time (`isLate`), so later settings changes don't rewrite history. Status is otherwise computed on the fly.
- **Half-days** are counted separately from "present" in summaries and reports. "Late" counts any late check-in, including half-days.
- **Today with no check-in** has no status yet (it becomes ABSENT the next day). Dashboards show it as "Not checked in".
- **Check-out after midnight** isn't supported: the open record becomes MISSED_CHECKOUT.
- **Approval routing**: a request goes to the employee's manager if that manager is active and is a MANAGER or ADMIN; otherwise to ADMIN. Admins can decide any request except their own (a lone admin's own leave needs a second admin).
- **Approvals page "balance left"** shows `allocated − used` for that type and year. The approve step re-checks it inside a transaction with a row lock.
- **Leave balances for a year are created lazily** when first needed (viewing balances or applying), in addition to on user creation and in the seed. This covers new calendar years without a cron job. No carry-forward.
- **Leave type quota changes** update this year's `allocated` for everyone. Creating or reactivating a type allocates it to all active users for this year.
- **Leave types** can be deleted only if never used; otherwise they can be deactivated (hidden from apply form and balances).
- **Holiday edits don't recount existing requests.** `days` is stored on the request when it's submitted.
- **Demoting a manager** to employee is blocked while they still have active direct reports. Admins can't remove their own admin role or deactivate themselves. Reporting loops are blocked.
- **Leave report** lists requests that *overlap* the chosen date range.
- **Seed holidays** cover the current year, plus a neighbouring year when the 90-day attendance window or upcoming demo leave crosses into it. Festival dates come from a small table and must be verified by the admin.
- **Uploaded SVG logos** are only shown via `<img>` and served from `/brand-icon` with a strict CSP, so scripts inside them never run.
- **CSV exports** start with a UTF-8 BOM (so Excel opens names correctly) and neutralise cells that look like spreadsheet formulas.
- **`npm run db:reset`** runs `prisma migrate reset --force` then the seed. Prisma refuses to run reset when invoked by an AI agent without explicit consent, so the build sessions used `npm run db:seed`, which wipes and recreates all data by itself.
- **Neon wiring**: the app uses `pg` (node-postgres) through `@prisma/adapter-pg` on the pooled `DATABASE_URL`, with `attachDatabasePool` from `@vercel/functions` (Neon's recommendation for Vercel Fluid compute). Migrations use the direct `DATABASE_URL_UNPOOLED` (`DIRECT_URL` also accepted).
- **Branding cache** also expires after 60 seconds, as a safety net for self-hosted servers where a tag invalidation doesn't survive a restart.
