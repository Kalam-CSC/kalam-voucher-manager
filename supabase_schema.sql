-- KALAM Voucher Manager
-- Run this once in a SEPARATE Supabase project/database for this private voucher site.

create extension if not exists pgcrypto;

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  brand text not null,
  code text,
  pin text,
  amount numeric(12,2) not null default 0,
  expiry date,
  note text,
  status text not null default 'Available' check(status in ('Available','Used','Expired')),
  created_at timestamptz not null default now(),
  used_at timestamptz
);

alter table public.brands enable row level security;
alter table public.vouchers enable row level security;

drop policy if exists "authenticated can read brands" on public.brands;
create policy "authenticated can read brands" on public.brands for select to authenticated using (true);

drop policy if exists "authenticated can insert brands" on public.brands;
create policy "authenticated can insert brands" on public.brands for insert to authenticated with check (true);

drop policy if exists "authenticated can update brands" on public.brands;
create policy "authenticated can update brands" on public.brands for update to authenticated using (true) with check (true);

drop policy if exists "authenticated can read own vouchers" on public.vouchers;
create policy "authenticated can read own vouchers" on public.vouchers for select to authenticated using (auth.uid()=user_id);

drop policy if exists "kalam require active auth session" on public.vouchers;

drop policy if exists "authenticated can insert own vouchers" on public.vouchers;
create policy "authenticated can insert own vouchers" on public.vouchers for insert to authenticated with check (auth.uid()=user_id);

drop policy if exists "authenticated can update own vouchers" on public.vouchers;
create policy "authenticated can update own vouchers" on public.vouchers for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);

drop policy if exists "authenticated can delete own vouchers" on public.vouchers;
create policy "authenticated can delete own vouchers" on public.vouchers for delete to authenticated using (auth.uid()=user_id);

insert into public.brands(name,sort_order)
select * from (values
 ('AMAZON',0),('FLIPKART',1),('PHONEPE',2),('BIGBASKET',3),
 ('PIZZA HUT',4),('PANTALOONS',5),('PAYTM',6),('OTHER',7)
) as x(name,sort_order)
where not exists (select 1 from public.brands b where b.name=x.name);