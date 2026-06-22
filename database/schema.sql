-- =====================================================================
--  FLOWER SHOP ORDER MANAGEMENT SYSTEM  —  Supabase PostgreSQL Schema
--  ફૂલની દુકાન ઓર્ડર મેનેજમેન્ટ સિસ્ટમ
-- =====================================================================
--  Run this file in the Supabase SQL Editor (or `supabase db push`).
--  All Gujarati text is stored as native UTF-8 (Postgres default).
-- =====================================================================

-- ----- Extensions ----------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ----- Enums (stored as TEXT for flexibility / future values) --------
-- Order status   : ઓર્ડર બાકી | તૈયાર થઈ રહ્યું છે | તૈયાર | આપી દીધો
-- Payment status : બાકી | આંશિક ચૂકવણી | પૂર્ણ ચૂકવણી
-- We keep them as TEXT + CHECK so new statuses never need a migration.

-- =====================================================================
--  employees
-- =====================================================================
create table if not exists public.employees (
    id            uuid primary key default uuid_generate_v4(),
    name          text        not null,
    mobile        text        not null unique,
    password_hash text        not null,
    role          text        not null default 'staff'
                              check (role in ('admin', 'staff')),
    active        boolean     not null default true,
    created_at    timestamptz not null default now()
);

-- =====================================================================
--  customers
-- =====================================================================
create table if not exists public.customers (
    id             uuid primary key default uuid_generate_v4(),
    name_gujarati  text        not null,
    mobile         text        unique,   -- optional: customers can be name-only
    notes          text,
    created_at     timestamptz not null default now()
);
create index if not exists idx_customers_mobile on public.customers (mobile);

-- =====================================================================
--  items  (master flower product list — fully dynamic)
-- =====================================================================
create table if not exists public.items (
    id                 uuid primary key default uuid_generate_v4(),
    item_name_gujarati text        not null,
    price              numeric(10,2) not null default 0 check (price >= 0),
    active             boolean     not null default true,
    created_at         timestamptz not null default now()
);
create index if not exists idx_items_active on public.items (active);

-- =====================================================================
--  orders
-- =====================================================================
create table if not exists public.orders (
    id               uuid primary key default uuid_generate_v4(),
    customer_id      uuid not null references public.customers(id),
    pickup_date      date not null,
    pickup_time      time not null,
    total_amount     numeric(10,2) not null default 0 check (total_amount     >= 0),
    advance_amount   numeric(10,2) not null default 0 check (advance_amount   >= 0),
    remaining_amount numeric(10,2) not null default 0 check (remaining_amount >= 0),
    order_status     text not null default 'ઓર્ડર બાકી'
                     check (order_status in
                       ('ઓર્ડર બાકી','તૈયાર થઈ રહ્યું છે','તૈયાર','આપી દીધો')),
    payment_status   text not null default 'બાકી'
                     check (payment_status in
                       ('બાકી','આંશિક ચૂકવણી','પૂર્ણ ચૂકવણી')),
    notes            text,
    created_by       uuid not null references public.employees(id),
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    -- soft delete
    deleted          boolean     not null default false,
    deleted_by       uuid        references public.employees(id),
    deleted_at       timestamptz
);
create index if not exists idx_orders_pickup     on public.orders (pickup_date, pickup_time);
create index if not exists idx_orders_deleted    on public.orders (deleted);
create index if not exists idx_orders_status     on public.orders (order_status);
create index if not exists idx_orders_payment    on public.orders (payment_status);
create index if not exists idx_orders_customer   on public.orders (customer_id);

-- =====================================================================
--  order_items
-- =====================================================================
create table if not exists public.order_items (
    id        uuid primary key default uuid_generate_v4(),
    order_id  uuid not null references public.orders(id) on delete cascade,
    item_id   uuid references public.items(id),          -- null = one-time custom item
    item_name text not null,                              -- snapshot of name (Gujarati)
    quantity  integer not null default 1 check (quantity > 0),
    price     numeric(10,2) not null default 0 check (price >= 0)
);
create index if not exists idx_order_items_order on public.order_items (order_id);

-- =====================================================================
--  activity_log  (admin "View System Logs")
-- =====================================================================
create table if not exists public.activity_log (
    id          bigint generated always as identity primary key,
    employee_id uuid references public.employees(id),
    action      text not null,                 -- e.g. 'order.create'
    entity      text,                          -- e.g. 'order'
    entity_id   text,
    detail      jsonb,
    created_at  timestamptz not null default now()
);
create index if not exists idx_log_created on public.activity_log (created_at desc);

-- =====================================================================
--  updated_at trigger for orders
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
    before update on public.orders
    for each row execute function public.set_updated_at();

-- =====================================================================
--  Realtime: publish the orders & order_items tables
--  (Supabase frontend subscribes to these for the live queue)
-- =====================================================================
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;

-- =====================================================================
--  Row Level Security
--  The FastAPI backend uses the SERVICE ROLE key (bypasses RLS) for all
--  writes. The frontend uses the ANON key for realtime SELECTs only.
--  We enable RLS and allow read access to anon so realtime works, while
--  blocking direct anon writes (all writes go through the API).
-- =====================================================================
alter table public.orders        enable row level security;
alter table public.order_items   enable row level security;
alter table public.customers     enable row level security;
alter table public.items         enable row level security;

drop policy if exists "anon read orders"      on public.orders;
drop policy if exists "anon read order_items" on public.order_items;
drop policy if exists "anon read customers"   on public.customers;
drop policy if exists "anon read items"       on public.items;

create policy "anon read orders"      on public.orders      for select using (true);
create policy "anon read order_items" on public.order_items for select using (true);
create policy "anon read customers"   on public.customers   for select using (true);
create policy "anon read items"       on public.items       for select using (true);

-- =====================================================================
--  Seed data  (a starter set of common flower items)
--  The FIRST ADMIN is created by the Python seed script which generates
--  a real bcrypt hash:   python -m app.seed   (see backend/README)
-- =====================================================================
insert into public.items (item_name_gujarati, price) values
    ('ગુલાબનો બુકે',     250),
    ('લગ્નહાર',          1500),
    ('મોગરાનો હાર',      120),
    ('કાર ડેકોરેશન',     2500),
    ('ગજરો',             50)
on conflict do nothing;

-- =====================================================================
--  END OF SCHEMA
-- =====================================================================
