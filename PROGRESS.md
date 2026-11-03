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

## Current status (handoff — last updated 2026-11-03)

**v1 is built, deployed and seeded.** All phases above are done. Nothing is half-built.

### Where things live
- **GitHub:** https://github.com/kssrk34/Attendance (branch `main`; owner account `kssrk34`; pushing works with the stored git credential)
- **Live site (Vercel):** https://attendanceproject-orpin.vercel.app
  - Build command comes from `vercel.json` → `npm run vercel-build`: `prisma generate && prisma migrate deploy && next build`
  - Vercel env vars: `DATABASE_URL` (Neon pooled), `DATABASE_URL_UNPOOLED` (Neon direct), `AUTH_SECRET`. All three must be ticked for Production. A missing database variable makes the build fail with "datasource.url property is required".
- **Database (Neon):** org `org-winter-wind-95364177`, project `autumn-morning-41078130`, branch `production`, region AWS ap-southeast-1 (Singapore). Created with `neon init` + `neon deploy` (`neon.ts` is in the repo; `.neon` is git-ignored).
  - Migrations applied. Demo data seeded on 2026-11-03.
- **Local `.env`** (git-ignored) points at the **Neon production** database, not the local one. Never commit it or print its values.

### Demo accounts
Password `Demo@1234` for all. The login page has one-click buttons.
- `employee@example.com`: Arjun Mehta, Engineering
- `manager@example.com`: Rahul Sharma, Engineering manager
- `admin@example.com`: Kavita Iyer, HR Admin

### Open items / next steps for the user
1. On Vercel, set **Settings → Functions → Region = Singapore (sin1)** (next to Neon), then redeploy. Not confirmed done.
2. Run the manual checks on the live site: check in → apply leave → manager approves → admin exports CSV, and check on a phone.
3. Set real branding under Admin → Branding, and verify festival holiday dates under Admin → Manage holidays.
4. Before a demo: re-run `npm run db:seed` on a stable connection, so "today" data is fresh and Arjun isn't checked in yet.
5. Before real (non-demo) use, see README "Go live":
   - stop seeding
   - deactivate the demo accounts or change their passwords
   - remove the "Demo accounts" buttons on `/login` (`src/app/login/login-form.tsx`)
6. Possible v2 ideas, mentioned in chat but not built: login rate-limiting (Upstash Redis), attendance regularization, notifications. The README has the full v2 list.

### Environment quirks (user's Windows laptop)
- **Node 26 is installed system-wide** (upgraded from 20.16 for Neon/Prisma). npm 11 holds back package install scripts until approved. If Prisma breaks after a fresh install, run `npm install-scripts approve prisma @prisma/engines esbuild`.
- **The VS Code terminal is Git Bash.** Use bash syntax with quoted paths, e.g. `"/c/Program Files/Cloudflare/Cloudflare WARP/warp-cli.exe" settings`. PowerShell's `&` syntax won't work there.
- **Network:** the user is often on an **iPhone hotspot**.
  - The hotspot's DNS refuses to resolve Neon hostnames, so **Cloudflare One Client (WARP)** must be on. It's a personal free account; settings are changeable.
  - Full WARP tunnel mode was flaky (TLS resets on Postgres and HTTPS). Recommended mode: **DNS only** (`warp-cli mode doh`). Fallback: full mode with the WireGuard tunnel protocol.
- **From the laptop, Neon is slow:** about 260 ms per query and 3–7 s per new connection.
  - E2E tests against Neon need `E2E_SLOW=1`.
  - Prefer running E2E tests against the **local** DB (`npm run db:local`, URL `postgresql://postgres:postgres@localhost:5433/attendance`). Set both `DATABASE_URL` and `DATABASE_URL_UNPOOLED` to it in the shell before running.
- **An empty stray folder `C:\c`** was accidentally created earlier. The user was asked to delete it; Claude's safety check blocked the deletion.

### Guardrails for agents
- `npm run db:seed` and `npm run test:e2e` **wipe the database** they point at. Check which `DATABASE_URL` is active first. Don't run them against Neon production unless the user explicitly asks.
- The seed now runs in **one transaction**, so a dropped connection changes nothing and it's safe to retry.
- Prisma blocks `prisma migrate reset` from AI agents without explicit user consent. Don't bypass it.
- Ask before pushing, deploying, or changing system or network settings.

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
