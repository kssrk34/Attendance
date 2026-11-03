# Attendance & Leave Management

A simple, white-label web app for daily attendance and leave. Employees check in and out (one tap on a phone), apply for leave, and see their balances. Managers see their team and approve leave. HR admins manage employees, leave types, holidays, settings and branding, and export reports.

No company name or logo is built in. Each company sets its own name, logo and colors under **Admin → Branding**.

## Features by role

**Employee**
- Check in / check out from the dashboard, with a live clock in IST
- Today's status, this month's summary (present, late, half days, absent, missed check-outs, leave days)
- Monthly attendance calendar (color-coded) and daily log with hours worked
- Apply for leave with a live working-day count and remaining balance; cancel pending or upcoming approved leave
- Leave balances, upcoming holidays, and pending requests

**Manager** (everything an employee can do, plus)
- "Team today" panel: who's checked in, late, on leave or not yet in
- Team page with each direct report's status and their monthly attendance and leave history
- Approve or reject direct reports' leave (rejection needs a note)

**HR Admin** (everything, for all employees)
- Company-wide stats for today and pending approvals across the company
- Manage employees (create, edit, deactivate/reactivate), departments, leave types and holidays
- Settings: workday start, late grace period, half-day and full-day hours, working days
- Branding: app name, company name, logo and primary color, with a live preview
- Monthly attendance report and leave report, both exportable to CSV
- Audit log of every important action, with filters

## Demo accounts

All demo passwords are `Demo@1234`. Log in with one of these emails:

| Role | Email |
|---|---|
| Employee | `employee@example.com` |
| Manager (Engineering) | `manager@example.com` |
| HR Admin | `admin@example.com` |

The seed also creates two more managers and about 18 employees across Engineering, QA, HR and Sales, with ~90 days of realistic attendance and leave in every status. All seeded dates are relative to today, so the demo always looks fresh.

## Rebranding for a company

1. Log in as an HR Admin and open **Admin → Branding**.
2. Set the **app name**, **company name** and **primary color**. Button text switches between white and dark automatically so it stays readable.
3. Upload a **logo** (PNG, SVG, JPG or WebP, up to 300 KB; square works best). Without a logo, the app shows the company's initials on the primary color.
4. Check the live preview, then **Save branding**. Changes apply right away for everyone, with no redeploy. The new name, logo and color show on the login page, sidebar, browser tab, favicon and CSV export file names.
5. **Reset to defaults** restores the generic look.

Also review **Admin → Manage holidays**. The seeded festival holidays (Holi, Eid, Ganesh Chaturthi, Dussehra, Diwali, …) move every year, so **verify their dates** for your region.

## Tech stack

- Next.js 16 (App Router) + TypeScript, Server Actions and Route Handlers
- Tailwind CSS v4 + shadcn/ui (Radix)
- PostgreSQL + Prisma 7 (Neon in production)
- Auth.js (NextAuth v5), email + password (bcrypt), JWT sessions
- Zod for all input validation
- date-fns + date-fns-tz. All "today" logic uses Asia/Kolkata.
- Vitest (business rules) and Playwright (end-to-end flows)
- Deploys to Vercel

Code layout:

```
src/lib/rules     pure business rules (unit tested)
src/lib/db        Prisma client
src/server        server actions & queries, with permission checks
src/components    UI components
src/app           pages and routes
prisma            schema, migrations, seed
e2e               Playwright tests
```

## Local setup

**Requirements:** Node.js **22.12 or newer**, and a PostgreSQL database.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env` from the example and fill it in:
   ```bash
   cp .env.example .env
   ```
   - `DATABASE_URL`: your Postgres connection string. Don't have Postgres? Run `npm run db:local` in a separate terminal. It starts a local PostgreSQL server (data kept in `.pgdata/`) at `postgresql://postgres:postgres@localhost:5433/attendance`.
   - `AUTH_SECRET`: any long random string (`npx auth secret` generates one).
3. Create the tables and load demo data:
   ```bash
   npx prisma migrate deploy
   npm run db:seed
   ```
4. Start the app:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 and log in with a demo account (see above).

Useful scripts:

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:migrate` | Create & apply a migration after schema changes (dev) |
| `npm run db:seed` | Wipe all data and re-create the demo data |
| `npm run db:reset` | Drop and re-create the database, then seed |
| `npm run db:local` | Run a local PostgreSQL server for development |

## Running tests

```bash
npm test            # unit tests for the business rules (no database needed)
npm run test:e2e    # end-to-end tests
```

The end-to-end tests need the database from your `.env` (for example `npm run db:local`). They **re-seed it** before running, build the app, and start it on port 3100. The first time, install the browser with `npx playwright install chromium`.

Covered flows: employee check-in/check-out; apply → manager approves → balance reduced; reject requires a note; employees blocked from manager/admin pages; admin creates an employee who can log in; rebranding and reset; phone-sized layout; navigation (every sidebar link opens on the first click, filters update the page without a reload).

## Deploying to Vercel + Neon

### 1. Create the database (Neon)
1. Sign up at [neon.tech](https://neon.tech) and create a project (pick a region close to your users, e.g. Singapore or Mumbai for India).
2. On the project dashboard, open **Connect** and copy two connection strings:
   - the **pooled** one (host contains `-pooler`): use as `DATABASE_URL`
   - the **direct** one (toggle "Connection pooling" off): use as `DATABASE_URL_UNPOOLED` (used only for migrations)

   If you use the Neon CLI (`neon init` + `neon deploy`), it writes both into `.env` for you with these names.

### 2. Push the code to GitHub
Create a GitHub repository and push this project (the `.env` file is git-ignored and must never be committed).

### 3. Create the Vercel project
1. In [Vercel](https://vercel.com), click **Add New → Project** and import the GitHub repository. The framework is detected as Next.js. The build command comes from `vercel.json` (`npm run vercel-build`).
2. Under **Environment Variables**, add these for Production (and Preview if you use it):
   - `DATABASE_URL`: Neon pooled connection string
   - `DATABASE_URL_UNPOOLED`: Neon direct connection string
   - `AUTH_SECRET`: a long random string (`npx auth secret`)
3. Click **Deploy**. Each build runs `prisma generate`, then `prisma migrate deploy` (creates/updates the tables), then `next build`.
4. **Region:** `vercel.json` runs the server code in Singapore (`"regions": ["sin1"]`), next to a Neon database in AWS Singapore. Keep these two in the same region. Every page makes several database queries, so a far-away database makes each click slow. If your Neon project is elsewhere, change `regions` to the nearest [Vercel region](https://vercel.com/docs/regions) (e.g. `bom1` for Mumbai).

### 4. Seed the production database (once, from your computer)
Run the seed against Neon from your machine. Put the Neon strings in your shell (or a temporary `.env`) and run:
```bash
DATABASE_URL="<neon pooled url>" DATABASE_URL_UNPOOLED="<neon direct url>" npm run db:seed
```
On Windows PowerShell:
```powershell
$env:DATABASE_URL="<neon pooled url>"; $env:DATABASE_URL_UNPOOLED="<neon direct url>"; npm run db:seed
```
⚠️ The seed **deletes all existing data**. Run it only to set up a fresh demo, never on a database with real data.

### 5. Go live
Open the Vercel URL, log in as `admin@example.com`, and:
- set your branding under **Admin → Branding**
- verify holiday dates under **Admin → Manage holidays**
- for real use, change the demo passwords (or deactivate the demo accounts) under **Admin → Employees**

## Known limitations / ideas for v2

Deliberately not in v1:

- GPS or office-IP restricted check-in, selfie check-in
- Email or push notifications
- Half-day leave requests
- Attendance regularization requests (fixing a missed check-out)
- Leave carry-forward and accrual
- Shifts and rotating schedules
- Payroll export
- Multi-company support, SSO
- Native mobile app

Other current limitations:
- Single timezone (Asia/Kolkata) for the whole company.
- A check-out after midnight isn't possible; the day shows as a missed check-out.
- Changing holidays doesn't recalculate leave already requested.
- If the only admin applies for leave, a second admin is needed to approve it.
