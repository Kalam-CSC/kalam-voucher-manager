# KALAM Voucher Manager

React + Vite + Supabase voucher dashboard. Existing database schema is provided in `supabase_schema.sql`; do not run it on a database with existing tables/data without reviewing first.

## 1. Configure Supabase

Copy `.env.example` to `.env.local`, then set:

```env
VITE_SUPABASE_URL=https://fsgwaouymszcnsxmkoqf.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_REAL_SUPABASE_PUBLISHABLE_KEY
```

Get the publishable key from Supabase Dashboard → Project Settings → API Keys. Do not use a service-role/secret key in browser code. `.env.local` is ignored by Git.

## 2. Run locally

```bash
npm install
npm run dev
```

## 3. Login and password reset

Create or verify your email/password user in Supabase Dashboard → Authentication → Users. Use **Forgot Password?** on the login page. In Supabase Authentication URL Configuration, add the local URL (e.g. `http://localhost:5173/**`) and your deployed site's reset URL to the Redirect URLs allow list. The reset link opens a new-password form.

## Important

Voucher code/PIN are stored in the existing database columns as plain text in this starter. Keep the project private and use strong account security; production-grade secret storage should encrypt voucher secrets server-side. Do not delete or recreate existing tables if you need to preserve data.

## Fix voucher insert RLS errors

If saving a voucher reports `new row violates row-level security policy "kalam require active auth session"`, open Supabase Dashboard → SQL Editor and run:

```sql
drop policy if exists "kalam require active auth session" on public.vouchers;
```

The app's `"authenticated can insert own vouchers"` policy still requires a signed-in user and restricts inserts to that user's own rows. This removes only the conflicting policy and does not delete voucher data. Sign out and back in to the app after running it.

## Save used-voucher remarks

Used vouchers can store a remark describing where they were used. If your Supabase database was created before this field was added, run this once in Supabase Dashboard → SQL Editor:

```sql
alter table public.vouchers add column if not exists used_remark text;
```

Once a voucher is marked Used, the dashboard does not allow changing it back to Available.

## Sync the security PIN across browsers

The security PIN is stored in the signed-in user's Supabase account. Run this SQL once in Supabase Dashboard → SQL Editor to enable shared PIN storage on an existing project:

```sql
create table if not exists public.security_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  security_pin text not null check (security_pin ~ '^[0-9]{4}$'),
  updated_at timestamptz not null default now()
);

alter table public.security_settings enable row level security;
grant select, insert, update on public.security_settings to authenticated;

drop policy if exists "users can read own security settings" on public.security_settings;
create policy "users can read own security settings" on public.security_settings
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "users can insert own security settings" on public.security_settings;
create policy "users can insert own security settings" on public.security_settings
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "users can update own security settings" on public.security_settings;
create policy "users can update own security settings" on public.security_settings
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
```

After running the SQL, sign in with the same account on the browser where you changed the PIN and click **Settings → Save Security PIN** once. On other browsers, sign in with that same account and refresh the page.

## One active browser and 1-minute inactivity logout

The app signs out after one minute without activity. Logging in on another browser/device replaces the active browser session; the previous browser detects this and signs out within a few seconds. To enable it on an existing Supabase project, run this SQL once in SQL Editor:

```sql
create table if not exists public.active_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id text not null,
  last_seen_at timestamptz not null default now()
);

alter table public.active_sessions enable row level security;
grant select, insert, update on public.active_sessions to authenticated;

drop policy if exists "users can read own active session" on public.active_sessions;
create policy "users can read own active session" on public.active_sessions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "users can insert own active session" on public.active_sessions;
create policy "users can insert own active session" on public.active_sessions
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "users can update own active session" on public.active_sessions;
create policy "users can update own active session" on public.active_sessions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
```

Deploy the updated app after running the SQL. “Activity” means pointer/touch, keyboard, or wheel input while the app is open. If you close the browser or device, the session itself remains available until another login or the next activity timeout check.

If `active_sessions` is missing, the app now stays usable and keeps the 1-minute inactivity logout active, but cannot enforce one-browser-at-a-time login until you run the SQL above and refresh.
