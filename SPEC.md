# Attendance & Leave Management App (v1 Spec)

You are building a complete, working web app from this spec. I will not write any code myself — you write all of it. Read this whole file before starting.

## Guiding principle

**v1 is deliberately basic, but everything in it must work flawlessly.** No half-built features, no placeholder buttons, no "coming soon". If something isn't in this spec, don't build it. Polish and correctness beat feature count. This version will be demoed to a company, they'll give feedback, and we'll build v2 from that.

**The app must be fully generic and white-label.** No company name, product name or logo may be hardcoded anywhere: not in UI text, page titles, metadata, emails, favicon, README screenshots or code comments. Everything brand-related comes from the Branding settings (see below), so any company can set its own name, logo and colors without touching code.

## How to work

1. Build in the phases listed at the bottom, **one phase at a time**.
2. At the start, create a short `CLAUDE.md` that says: "Read SPEC.md for the full spec. Progress is tracked in PROGRESS.md." Create `PROGRESS.md` with the phase checklist and update it after every phase, so a fresh session can pick up where the last one stopped.
3. At the end of each phase: run `npm run lint`, `npm run build` and the tests that exist, fix every error, `git commit` with a clear message, then stop and give me a short summary of what to try in the browser.
4. Use current stable versions of all libraries. If you're unsure about an API (Next.js, Auth.js, Prisma), check the installed package's docs/types rather than guessing.
5. If something in this spec is ambiguous, pick the simplest reasonable option, note it in `PROGRESS.md` under "Decisions", and keep going.

## Tech stack

- **Next.js (App Router) + TypeScript** — frontend and backend (Server Actions / Route Handlers) in one repo
- **Tailwind CSS + shadcn/ui** — clean, professional, responsive UI (must work well on a phone, since employees will check in from mobile)
- **PostgreSQL + Prisma** — database and ORM (hosted on Neon in production)
- **Auth.js (NextAuth v5)** — Credentials provider (email + password, bcrypt hashed), JWT sessions
- **Zod** — validate every form and every server-side input
- **date-fns + date-fns-tz** — all date logic; company timezone is `Asia/Kolkata`
- **Vitest** — unit tests for business logic
- **Playwright** — end-to-end tests for the main flows
- Deploy target: **Vercel** + **Neon Postgres**

## Roles

| Role | Can do |
|---|---|
| **EMPLOYEE** | Check in/out, view own attendance, apply for/cancel leave, view own balances, view holidays |
| **MANAGER** | Everything an employee can, plus: see their direct reports' attendance, approve/reject their direct reports' leave |
| **ADMIN** (HR) | Everything, for all employees: manage employees, departments, leave types, holidays, settings; approve any leave; view reports; view audit log |

Permissions must be enforced **on the server** for every action and every data query — not just by hiding UI. An employee must never be able to read or change another employee's data by editing a URL or request.

## Data model (Prisma)

- **Department**: id, name (unique)
- **User**: id, name, email (unique), passwordHash, role (EMPLOYEE | MANAGER | ADMIN), departmentId, managerId (self-relation, nullable), joinDate, isActive, createdAt
- **AttendanceRecord**: id, userId, date (calendar date in company timezone, `@db.Date`), checkInAt (timestamp), checkOutAt (timestamp, nullable), isLate (boolean), createdAt. Unique on (userId, date).
- **LeaveType**: id, name, code (unique, e.g. CL), annualQuota (number of days), isActive
- **LeaveBalance**: id, userId, leaveTypeId, year, allocated, used. Unique on (userId, leaveTypeId, year).
- **LeaveRequest**: id, userId, leaveTypeId, startDate, endDate, days (working days counted), reason, status (PENDING | APPROVED | REJECTED | CANCELLED), decidedById (nullable), decisionNote (nullable), decidedAt (nullable), createdAt
- **Holiday**: id, date (unique), name
- **Settings** (single row): workdayStart (default "09:30"), lateGraceMinutes (default 15), halfDayMinHours (default 4), fullDayMinHours (default 8), workingDays (default Mon–Fri)
- **Branding** (single row): appName (default "Attendance Portal"), companyName (default "Your Company"), logo (nullable; stored in the DB as a data URL so no extra file storage service is needed; PNG/SVG/JPG/WebP, max 300 KB), primaryColor (hex, default a neutral blue), updatedAt
- **AuditLog**: id, actorId, action (string, e.g. LEAVE_APPROVED), entityType, entityId, details (JSON), createdAt

## Business rules (implement exactly; put them in a pure, unit-tested module like `src/lib/rules/`)

### Attendance
- One attendance record per user per day. Check-in creates it; check-out sets `checkOutAt`.
- Can't check in twice in a day. Can't check out without checking in, or twice.
- Check-in is only allowed on working days that are not holidays and not covered by the user's approved leave.
- **Late** = check-in after `workdayStart + lateGraceMinutes` (company timezone).
- **Daily status** is computed, not stored, for any past or current date:
  - Weekend / Holiday → `WEEKEND` / `HOLIDAY`
  - Approved leave covering the date → `ON_LEAVE`
  - Record with check-out: hours ≥ halfDayMinHours → `PRESENT` (flag late if late); hours < halfDayMinHours → `HALF_DAY`
  - Record without check-out: if today → `CHECKED_IN`; if a past day → `MISSED_CHECKOUT`
  - No record on a past working day → `ABSENT`
  - Future dates → no status
  - Dates before the user's joinDate → no status
- All "today" logic uses `Asia/Kolkata`, never the server's local time (Vercel runs in UTC).

### Leave
- Leave days = working days between startDate and endDate inclusive, **excluding weekends and holidays**. A request that counts 0 days is rejected with a clear message.
- startDate ≤ endDate. startDate can be at most 7 days in the past (to allow filing sick leave after returning). Both dates must be in the same calendar year.
- A request can't overlap any of the user's PENDING or APPROVED requests.
- A request can't exceed available balance (`allocated − used − days already in PENDING requests` for that type and year).
- `used` is increased only when a request is **approved**.
- Employee can cancel their own request if it's PENDING, or APPROVED and its startDate is in the future. Cancelling an approved request gives the days back.
- **Approval routing**: a request goes to the employee's manager. Requests from users with no manager (and managers' own requests if they have no manager) go to ADMIN. Nobody can approve their own request. Admin can approve/reject anything.
- Rejection requires a decision note. Approval note is optional.
- Approve/reject must be safe against double-clicks and race conditions (use a transaction and check the status is still PENDING).
- If approving would push `used` above `allocated` (because balance changed since applying), block it with a clear error.
- Balances for the year are created when a user is created (and by the seed), using each active leave type's annualQuota. No carry-forward in v1.

### Audit
Write an AuditLog entry for: check-in, check-out, leave applied, approved, rejected, cancelled, employee created/updated/deactivated, leave type/holiday/settings changes.

## Branding (white-label)

- Logo, appName and companyName appear in: the login page, the sidebar/top bar, the browser tab title (`{page} · {appName}`), CSV export file names (use a slug of companyName), and the favicon (use the uploaded logo if present).
- When no logo is uploaded, show a clean generic fallback: a rounded square in the primary color with the companyName's initials. Never ship a placeholder brand logo.
- primaryColor drives the theme accent (buttons, active nav item, links, focus rings) via a CSS variable, so the whole UI re-themes instantly. Status colors (present/late/absent/leave) stay fixed so they keep their meaning. Make sure button text stays readable on any chosen color (pick white or dark text automatically based on contrast).
- Branding is read on the server and cached, and the cache is cleared when it's saved, so changes show up immediately without a redeploy.
- Changing branding writes an AuditLog entry.

## Pages

All pages use a shared layout: sidebar (collapsible to a bottom/hamburger menu on mobile) showing only the links the current role can use, top bar with user name, role badge and logout. Every list has a sensible empty state. Every form shows field-level validation errors. Every mutation shows a success/error toast. Loading states on buttons.

### Public
- **/login** — email + password. Below the form, a "Demo accounts" box with three one-click buttons: **Log in as Employee**, **Log in as Manager**, **Log in as HR Admin** (these just submit the seeded credentials).

### Everyone
- **/dashboard** — role-aware:
  - Employee: big Check In / Check Out card showing today's status and times (live clock in IST), this month's summary (present, late, absent, leave days), leave balances, next 3 upcoming holidays, their pending requests.
  - Manager: the employee view plus a "Team today" panel (who's checked in, late, on leave, not yet in) and a count of pending approvals with a link.
  - Admin: company-wide today stats (present / late / on leave / not checked in out of total active), pending approvals count, quick links.
- **/attendance** — own attendance for a selected month: a month calendar (color-coded by status, with a legend) and a table (date, status, check-in, check-out, hours worked).
- **/leave** — balances per leave type, "Apply for leave" form (type, start, end, reason; shows the computed number of days and the remaining balance live before submitting), list of own requests with status badges and a Cancel button where allowed.
- **/holidays** — list of this year's holidays.

### Manager & Admin
- **/team** — table of direct reports (admin: all employees, filterable by department) with today's status; click an employee to see their month attendance (same view as /attendance) and leave history.
- **/approvals** — pending requests they can act on (employee, type, dates, days, reason, employee's remaining balance), Approve / Reject (reject opens a dialog requiring a note). A second tab shows requests they already decided.

### Admin only
- **/admin/employees** — list with search and department filter; create/edit employee (name, email, role, department, manager, join date, initial password); deactivate/reactivate (deactivated users can't log in and are excluded from stats). Can't deactivate yourself.
- **/admin/departments** — simple CRUD (can't delete a department that has employees).
- **/admin/leave-types** — CRUD for leave types (deactivate rather than delete if used).
- **/admin/holidays** — add/edit/delete holidays.
- **/admin/settings** — edit the Settings fields.
- **/admin/branding** — edit appName, companyName and primaryColor (color picker + hex input), upload/replace/remove the logo, with a live preview of the sidebar and login page before saving, and a "Reset to defaults" button.
- **/reports** — monthly attendance report: pick month (and optional department), table per employee: working days, present, late, half-days, absent, missed check-outs, leave days, total hours. **Export to CSV** button. Also a leave report: all requests in a date range with filters by status/type, exportable to CSV.
- **/admin/audit** — paginated audit log with filters by action and user.

## Seed data (`prisma/seed.ts`)

The seed uses **default branding only** ("Attendance Portal" / "Your Company", no logo). No company name anywhere in seed data. All seeded dates are generated **relative to the current date** so the demo always looks fresh.

- Departments: Engineering, QA, HR, Sales
- 1 ADMIN (HR): `admin@example.com`
- 3 MANAGERs (Engineering, QA, Sales), with `manager@example.com` being the Engineering manager
- ~18 EMPLOYEEs with realistic, varied Indian names, spread across departments, each with a manager and an `@example.com` email; `employee@example.com` is in Engineering under `manager@example.com`
- All demo passwords: `Demo@1234`
- Leave types: Casual Leave (CL, 12), Sick Leave (SL, 10), Earned Leave (EL, 15)
- Holidays for the current year: Republic Day (Jan 26), Independence Day (Aug 15), Gandhi Jayanti (Oct 2), Christmas (Dec 25), plus 4–5 other common Indian festival holidays (mark in README that the admin should verify festival dates, since they change each year)
- Attendance for the last ~90 days for everyone, realistic: mostly on time, ~10% late, occasional absences, a few half-days, a couple of missed check-outs. Today: some employees already checked in, some not (but **not** the demo employee, so the demo can show checking in).
- Leave requests in every status: some approved in the past (balances reflect them), a few PENDING for `manager@example.com` to approve (at least one from `employee@example.com`), one rejected with a note, one cancelled, and one approved upcoming leave.
- Seed must be re-runnable: it wipes and recreates the data.

Add `npm run db:reset` that resets the database and re-seeds.

## Testing

- **Vitest** unit tests for the rules module: leave day counting (weekends, holidays, year boundary), overlap detection, balance check, late calculation, daily status derivation (every status), cancellation rules, approval routing.
- **Playwright** E2E tests (run against a seeded local DB):
  1. Employee logs in via demo button → checks in → sees status update → checks out.
  2. Employee applies for leave → sees it as Pending → manager logs in → approves → employee sees Approved and reduced balance.
  3. Manager rejects without a note → blocked; with a note → rejected.
  4. Employee cannot open `/approvals` or `/admin/*` (redirected or 403).
  5. Admin creates an employee → new employee can log in.
  6. Admin changes company name, color and uploads a logo → login page and sidebar show the new branding; reset to defaults restores the generic look.
- `npm test` runs unit tests; `npm run test:e2e` runs Playwright.

## Non-functional

- Clean, consistent, professional UI. Neutral color palette with status colors (green present, amber late, red absent, blue leave, gray weekend/holiday). Dark mode is not required.
- Fully responsive; check-in must be one tap on mobile.
- No secrets in the repo. Provide `.env.example` (`DATABASE_URL`, `AUTH_SECRET`).
- Friendly error page and 404 page.
- Keep code organized: `src/lib/rules` (pure logic), `src/lib/db`, `src/server` (actions/queries with permission checks), `src/components`, `src/app`.

## README.md

Must include: what the app does, feature list per role, demo credentials, how to rebrand it for a company (Admin → Branding), tech stack, local setup (Node version, `.env`, migrate, seed, run), running tests, and **step-by-step Vercel + Neon deployment** (create Neon DB, set env vars in Vercel, run migrations with `prisma migrate deploy` during build, seed the production DB from local), and a short "Known limitations / ideas for v2" section.

## Out of scope for v1 (list these in README as v2 ideas — do NOT build)

GPS / office-IP restricted check-in, selfie check-in, email or push notifications, half-day leave requests, attendance regularization requests, leave carry-forward and accrual, shifts and rotating schedules, payroll export, multi-company support, SSO, native mobile app.

## Build phases

- **Phase 0 — Setup**: Next.js + TS + Tailwind + shadcn/ui, ESLint, Prisma, Vitest, Playwright, folder structure, `CLAUDE.md`, `PROGRESS.md`, `.env.example`, git init.
- **Phase 1 — Data & auth**: Prisma schema + migration, seed script, Auth.js credentials login, demo login buttons, role-based route protection, app shell layout with role-aware navigation.
- **Phase 2 — Rules module**: all business rules as pure functions + full Vitest coverage.
- **Phase 3 — Attendance**: check-in/out, dashboard card, /attendance calendar + table.
- **Phase 4 — Leave**: balances, apply form with live day count, my requests, cancel, /approvals, approval/rejection flow.
- **Phase 5 — Manager & admin**: /team, all /admin pages (including branding), holidays page, role-specific dashboards.
- **Phase 6 — Reports & audit**: /reports with CSV export, /admin/audit.
- **Phase 7 — Quality pass**: search the codebase for any hardcoded brand/company name and remove it, Playwright tests, responsive check on a phone-sized viewport, empty/loading/error states, accessibility basics (labels, focus, contrast), remove dead code, README.
- **Phase 8 — Deploy prep**: verify a production build works against a fresh database with only `prisma migrate deploy` + seed, and walk me through deploying to Vercel.
