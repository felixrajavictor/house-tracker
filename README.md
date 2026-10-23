# House Tracker · வீடு கணக்கு

Mobile-first web app for a family building a house without a contractor: tracks every bill, daily-wage workers (attendance, wages, advances), shop credit, and budget — in Tamil and English, live for everyone in the family.

## Stack

- Vite + React 19 + TypeScript + Tailwind v4
- Supabase (Postgres + Auth + Storage + Realtime), project `house-tracker` (`zjpxbrsytjqedcefudum`, ap-south-1)
- No backend code: the browser talks to Supabase directly; Row Level Security enforces who can read/write

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173  (also reachable on the LAN for phone testing)
npm run build      # type-check + production build into dist/
```

`.env.local` holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` (the *publishable* key — safe to ship to browsers; RLS does the protecting).

## Access model (admin-managed, no signup, no emails)

- **Login is by name**: the login page lists the family (via the anon-callable `login_members()` RPC); you tap your name and type your password. Under the hood each member is a Supabase Auth user whose "email" is a hidden login id like `amala.4821@veedu.family` (Victor's is his real Gmail from the first setup; it never receives mail).
- There is no self-signup. An editor creates each member from **More → Family members → Add member** (name, password, role). This calls the `upsert_member()` RPC, which generates the hidden login id, writes the allow-list row and the `auth.users` + `auth.identities` rows directly with the email pre-confirmed — so no confirmation mail is ever sent. The same RPC resets a password (key icon next to a member). Names are unique (case-insensitive).
- `allowed_members` is the family allow-list (email → name, role); `profiles` mirrors it per login (triggers keep them in sync). Removing a member also deletes their login.
- Roles: `editor` can add/edit everything; `viewer` is read-only. Enforced by RLS via `is_member()` / `is_editor()`.
- Everyone can change their own password from **More → Change password**.
- Receipt photos live in the private `receipts` bucket; the app shows them through 1-hour signed URLs.
- Because logins are created server-side, the Supabase Auth email settings (Site URL, confirm email) don't matter for this app.

## Money model (see `src/lib/stats.ts`)

- **Spent** = every bill's full amount + every attendance day's wages (cost incurred, credit included)
- **Paid out** = bills' `paid_amount` + all worker payments (wages and advances)
- **Yet to pay** = shop credit still due + wages earned but not yet paid
- Worker balance = earned − paid: positive → we owe them, negative → advance outstanding

## Schema (public)

`settings` (single row: house name, budget) · `stages` · `categories` · `suppliers` · `expenses` · `workers` · `attendance` (one row per worker per day, rate snapshotted) · `worker_payments` (kind = wage | advance) · `profiles` · `allowed_members`

Migrations are applied through the Supabase MCP / dashboard; the initial one is `house_tracker_initial_schema`.

## Migrations

1. `house_tracker_initial_schema` — tables, triggers, RLS, storage bucket, seed categories/stages
2. `admin_managed_members` — `upsert_member()` RPC and login cleanup on member removal
