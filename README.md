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
