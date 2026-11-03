# Progress

## Phases

- [x] **Phase 0 — Setup**: Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui, ESLint, Prisma 7, Vitest, Playwright, folder structure, CLAUDE.md, PROGRESS.md, .env.example, git.
- [x] **Phase 1 — Data & auth**: Prisma schema + migration, seed script, Auth.js credentials login, demo login buttons (removed 2026-11-03), role-based route protection, app shell with role-aware navigation.
- [x] **Phase 2 — Rules module**: business rules as pure functions in `src/lib/rules` with Vitest coverage.
- [x] **Phase 3 — Attendance**: check-in/out, dashboard card with live IST clock, `/attendance` calendar + table.
- [x] **Phase 4 — Leave**: balances, apply form with live day count, my requests, cancel, `/approvals`, approve/reject flow.
- [x] **Phase 5 — Manager & admin**: `/team`, all `/admin` pages (incl. branding), holidays page, role-specific dashboards.
- [x] **Phase 6 — Reports & audit**: `/reports` with CSV export, `/admin/audit`.
- [x] **Phase 7 — Quality pass**: brand-name sweep, Playwright tests, phone-sized check, empty/loading/error states, accessibility basics, README.
- [x] **Phase 8 — Deploy prep**: production build verified against a fresh database with `prisma migrate deploy` + seed; deployment steps in README.

## Current status (handoff — last updated 2026-11-03, end of session)

**v1 is built, deployed and live.** All phases above are done. Nothing is half-built. The user is now sharing the live site with other people for feedback. A likely next session collects that feedback and plans v2.

### Where things live
- **GitHub:** https://github.com/kssrk34/Attendance (public; branch `main`; owner account `kssrk34`). This is the **only** repo for the project. Pushing works with the stored git credential.
  - A private copy, `kssrk34/attendance_project`, existed because Vercel created it at the first deploy and built from it. The user **deleted it on 2026-11-03**. Ignore any mention of it.
- **Live site (Vercel):** https://attendanceproject-orpin.vercel.app (Vercel project `attendanceproject`)
  - **Connected to `kssrk34/Attendance`, branch `main`. Every push to `main` deploys to production in about 1 minute.** GitHub then shows a "Vercel" status on the commit: pending, then "Deployment has completed".
  - Functions run in **Singapore (`sin1`)**, pinned in `vercel.json`. Check: `curl -sI https://attendanceproject-orpin.vercel.app/login | grep -i x-vercel-id` should contain `::sin1::`.
  - Build command comes from `vercel.json` → `npm run vercel-build`: `prisma generate && prisma migrate deploy && next build`
  - Vercel env vars: `DATABASE_URL` (Neon pooled), `DATABASE_URL_UNPOOLED` (Neon direct), `AUTH_SECRET`. All three must be ticked for Production (and for Preview, if preview deployments are wanted). A missing database variable makes the build fail with "datasource.url property is required".
  - There's no Vercel CLI or `gh` CLI on the laptop, and no Vercel login. Deploys happen only by pushing to GitHub.
- **Database (Neon):** org `org-winter-wind-95364177`, project `autumn-morning-41078130`, branch `production`, region AWS ap-southeast-1 (Singapore). Created with `neon init` + `neon deploy` (`neon.ts` is in the repo; `.neon` is git-ignored).
  - Migrations applied. Demo data seeded on 2026-11-03. Extra accounts added the same day (below).
- **Local `.env`** (git-ignored) points at the **Neon production** database, not the local one. Never commit it or print its values.

### Accounts on the live site (all use the password `Demo@1234`)
There are no one-click demo buttons any more. They were removed from `/login` at the user's request on 2026-11-03, so people type the email and password. `Demo@1234` is also printed in the public README, so these accounts are not secret.

**Seeded demo accounts** (with ~90 days of sample history):

| Role | Name | Email |
|---|---|---|
| Employee | Arjun Mehta (Engineering) | employee@example.com |
| Manager | Rahul Sharma (Engineering manager) | manager@example.com |
| HR Admin | Kavita Iyer | admin@example.com |

**15 tester accounts**, shared by the user with other people (e.g. over WhatsApp). They have no history and joined 2026-11-03. Employee N reports to manager N. Managers report to `admin@example.com`.

| # | Employee | Manager | HR Admin |
|---|---|---|---|
| 1 | Aarav Kapoor (Engineering), employee1@example.com | Arnav Sethi (Engineering), manager1@example.com | Shalini Mehra, admin1@example.com |
| 2 | Ishita Banerjee (QA), employee2@example.com | Kavya Shetty (QA), manager2@example.com | Gaurav Saxena, admin2@example.com |
| 3 | Kabir Malhotra (Sales), employee3@example.com | Dev Arora (Sales), manager3@example.com | Pallavi Jain, admin3@example.com |
| 4 | Nandini Iyer (HR), employee4@example.com | Ritu Chawla (HR), manager4@example.com | Rajesh Kumar, admin4@example.com |
| 5 | Tanvi Deshpande (Engineering), employee5@example.com | Nikhil Bose (Engineering), manager5@example.com | Swati Agarwal, admin5@example.com |

**9 private test accounts for the user only** (not shared). Same setup: test employee N reports to test manager N.

| # | Employee | Manager | HR Admin |
|---|---|---|---|
| 1 | Riya Sen (Engineering), test.employee1@example.com | Manish Trivedi (Engineering), test.manager1@example.com | Asha Nambiar, test.admin1@example.com |
| 2 | Yash Thakur (QA), test.employee2@example.com | Leela Fernandes (QA), test.manager2@example.com | Kunal Ghosh, test.admin2@example.com |
| 3 | Zoya Qureshi (Sales), test.employee3@example.com | Omkar Patil (Sales), test.manager3@example.com | Preeti Sinha, test.admin3@example.com |

All HR admins are in the HR department. The 24 extra accounts were created directly in the Neon database by one-off scripts (deleted afterwards, not in the repo). Each script did what the app's "create employee" does: bcrypt hash (cost 10), leave balances for the current year, and an `EMPLOYEE_CREATED` audit entry with `admin@example.com` as the actor.

⚠️ **`npm run db:seed` deletes all 24 extra accounts and everything testers have done.** To re-create them, write a short `tsx` script using the tables above, or add them under Admin → Employees.

### Leave: "back in office" date and clearer day counts (2026-11-03, second session)
User feedback: a 5-day leave with Sat and Sun in the middle was confusing. It wasn't clear how many working days were used or when the person was back in office. Changes:
- **Apply form** (`src/components/leave/leave-preview.tsx`):
  - big "N working days of <type>" line with the balance before and after
  - a green **"You'll be back in office on <date>"** box. Past leave says "You were back in office on…"; today says "You're back in office today"
  - a **day-by-day strip**: each date marked Leave / Weekend / holiday name, then the days off after the leave and the "Back" day
  - a note: "You picked 5 days. Only the 3 working days are taken from your balance; the 2 weekend days aren't counted."
  - date fields renamed **"First day of leave" / "Last day of leave"**, with the weekday shown under each
- **"Back in office <date>"** (or "Returned to office" for past leave) under the dates in My requests, the team member page, Approvals and the dashboard's pending list. Dates there now include the weekday. My requests shows "N working days" under the dates instead of a separate Days column, so the table fits next to the form.
- Date error messages reworded to match the new labels.
- Rules: `leaveDayKind`, `leaveDayBreakdown`, `returnToOffice` in `src/lib/rules/leave.ts` (8 new unit tests). Server: `withReturnDates` in `src/server/leave.ts`.
- **Tests:** lint, typecheck, 69 unit tests and 12 E2E tests (local DB) pass. The leave E2E test also checks the back-in-office date.

### Done in the 2026-11-03 session
- **Navigation fix.** Users had to click pages several times and reload. Measured on the live site before the fix: 0.8–5 s per click with no visual feedback (once 35 s), and ~10 s to log in. Causes:
  - Vercel ran the server code in `iad1` (US East) while Neon is in Singapore (~230 ms per query).
  - There were no `loading.tsx` files, so a click showed nothing until the server finished.
  - Fixes (details under Decisions): region `sin1`, section-level loading skeletons, pending spinners, in-place filters, fewer DB round trips, `retry()` on error pages, and an error page inside the app shell.
  - **Verified live after the fix:** click feedback in 30–70 ms, pages loaded in 0.25–0.9 s (usually ~0.35 s), login ~2 s, no browser errors.
- **Removed the "Demo accounts" box** from `/login`. E2E logins now type the credentials (`e2e/helpers.ts`).
- **New E2E spec `e2e/8-navigation.spec.ts`:**
  - every sidebar link opens on the first click
  - filters update the page in place
  - month switching
  - the login page has no demo box
- **Fixed deploys:** pointed Vercel at `Attendance` (see "Where things live").
- **Created the 24 extra accounts** listed above.
- **Tests at the end of the session:** lint, typecheck, 61 unit tests and 12 E2E tests all pass. The full E2E suite also passed with ~240 ms of added database latency.

### Open items / next steps
1. **Collect feedback from testers** and turn it into a v2 plan. Keep v1 behaviour stable while they test.
2. **Pushing to `main` changes the live site that testers are using.** For risky changes, test locally first. Preview deployments from another branch would only work if the Vercel env vars are also ticked for Preview.
3. Run the manual checks on the live site: check in → apply leave → manager approves → admin exports CSV, and check on a phone.
4. Set real branding under Admin → Branding, and verify festival holiday dates under Admin → Manage holidays.
5. **Don't re-seed production while testers use it** (see the ⚠️ above). If a fresh demo is ever needed, re-seed on a stable connection and then re-create the 24 extra accounts.
6. Before real (non-demo) use, see README "Go live":
   - stop seeding
   - deactivate the demo, tester and test accounts, or change their passwords
7. Possible v2 ideas, mentioned in chat but not built: login rate-limiting (Upstash Redis), attendance regularization, notifications. The README has the full v2 list.

### Environment quirks (user's Windows laptop)
- **Node 26 is installed system-wide** (upgraded from 20.16 for Neon/Prisma). npm 11 holds back package install scripts until approved. If Prisma breaks after a fresh install, run `npm install-scripts approve prisma @prisma/engines esbuild`.
- **The VS Code terminal is Git Bash.** Use bash syntax with quoted paths, e.g. `"/c/Program Files/Cloudflare/Cloudflare WARP/warp-cli.exe" settings`. PowerShell's `&` syntax won't work there.
  - Git Bash rewrites arguments that start with `/` into Windows paths (`/holidays` became `E:/Git/holidays`). Prefix the command with `MSYS_NO_PATHCONV=1` when passing URL paths to scripts.
- **Network:** the user is often on an **iPhone hotspot**.
  - The hotspot's DNS refuses to resolve Neon hostnames, so **Cloudflare One Client (WARP)** must be on. It's a personal free account; settings are changeable.
  - Full WARP tunnel mode was flaky (TLS resets on Postgres and HTTPS). Recommended mode: **DNS only** (`warp-cli mode doh`). Fallback: full mode with the WireGuard tunnel protocol.
  - The connection drops now and then. A polling script that checks for something *missing* (e.g. "Demo accounts" not on the page) will report a false success when a request comes back empty. Check for something that must be present instead.
  - The user sometimes works remotely from a phone. If the laptop goes offline, Claude stops too.
- **From the laptop, Neon is slow:** about 260 ms per query and 3–7 s per new connection.
  - E2E tests against Neon need `E2E_SLOW=1`.
  - Prefer running E2E tests against the **local** DB (`npm run db:local`, URL `postgresql://postgres:postgres@localhost:5433/attendance`). Set both `DATABASE_URL` and `DATABASE_URL_UNPOOLED` to it in the shell before running. The embedded Postgres from `db:local` may already be running on port 5433.
  - To reproduce production-like slowness locally, run a small Node TCP proxy that delays each packet by ~120 ms in front of port 5433. Point the app's `DATABASE_URL` at the proxy, and keep `DATABASE_URL_UNPOOLED` direct so seeding stays fast.
- **An empty stray folder `C:\c`** was accidentally created earlier. The user was asked to delete it; Claude's safety check blocked the deletion.

### Guardrails for agents
- **Pushing to `main` deploys to production** (the live site testers use) within about a minute. Ask before pushing.
- `npm run db:seed` and `npm run test:e2e` **wipe the database** they point at. Check which `DATABASE_URL` is active first. The local `.env` points at **production**. Don't run them against Neon production unless the user explicitly asks; it would also delete the 24 extra accounts.
- Any script run with the default `.env` writes to the **live database**.
- Playwright **reuses any server already on port 3100** (`reuseExistingServer`). A leftover `next start -p 3100` from an earlier run serves old code (maybe pointed at another database). Stop it before `npm run test:e2e`.
- The seed runs in **one transaction**, so a dropped connection changes nothing and it's safe to retry.
- Prisma blocks `prisma migrate reset` from AI agents without explicit user consent. Don't bypass it.
- Claude Code's safety check blocks pushing to a GitHub repo other than `origin` unless the user approves it.
- Ask before pushing, deploying, or changing system or network settings.

## How to verify

- `npm run lint`, `npm run typecheck`, `npm run build`
- `npm test` (Vitest, rules module; 69 tests)
- `npm run test:e2e` (Playwright; needs a local database — see README). 12 tests, including `e2e/8-navigation.spec.ts`.
- Live site: `x-vercel-id` contains `sin1`. GitHub shows a "Vercel" success status on the latest `main` commit.

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
- **Vercel functions run in Singapore (`sin1`)**, pinned in `vercel.json`, next to the Neon database (AWS ap-southeast-1). They used to run in the default `iad1` (US East): every query crossed the Pacific (~230 ms), so each click took 1–5 s (once 35 s) and login ~10 s. If the database ever moves, change `regions` to match.
- **Navigation feedback**: `loading.tsx` skeletons sit at the section level only: `(app)/`, `(app)/admin/` and `(app)/team/`. Switching sections shows the skeleton instantly (Next.js prefetches it). Filters inside a page (search, department, month, report forms) change only the page's search params, so no skeleton appears there. The current page stays on screen, with a small spinner, until the new data arrives. A skeleton at page level would swap out the search box while someone is typing.
- **Pending hints**: sidebar icons turn into a spinner if a page isn't ready yet (`useLinkStatus`). Month and department pickers show the picked value immediately (`useOptimistic`).
- **Report and audit filters** use `FilterForm` (`src/components/form/filter-form.tsx`): a client-side GET form with a pending state. Plain `<form method="get">` reloaded the whole page. `next/form` can't report a pending state, because it calls `router.push` directly.
- **Error pages use `retry()`** (Next 16.3+), which re-fetches the page from the server. `reset()` only re-renders the same failed result, so "Try again" never worked for server errors. `(app)/error.tsx` keeps the sidebar visible when a page fails.
- **"Back in office"** is the first working day after the leave's last day (skipping weekends and holidays). If the person has another PENDING or APPROVED leave starting right after, those days are skipped too and the UI says so ("after the next leave"). Only PENDING and APPROVED requests show it. It's computed on the fly, not stored, so it follows holiday edits and cancellations.
- **Database pool** has a 15 s connection timeout, so a stuck connection shows the error page instead of hanging.
