-- AELIO platform identity: one Supabase project, shared sign-in, isolated product data.
--
--   auth.users            Supabase Auth (shared by aelio.live and mypathd.com; same email + password on both)
--   core.profiles         one row per person (display name only; no product data)
--   core.memberships      which products a person uses. Every signup gets 'aelio' (an AELIO identity),
--                         plus the product they signed up on (e.g. 'pathd').
--   aelio.*               AELIO product data. Not exposed to browsers at all: only the AELIO engine reads it.
--   pathd.*               PATHD product data. Browsers may read their own rows, and only with a PATHD membership.
--
-- The products list is also copied into auth.users.raw_app_meta_data.products, so it appears in every access
-- token as app_metadata.products (users cannot edit app_metadata). The AELIO engine reads it from there.
-- Founder / Studio Brain permissions are NOT stored here: they stay in the engine's allow-lists (UID + verified
-- email + MFA + security questions), so nothing in this database can grant Studio access.

create schema if not exists core;
create schema if not exists aelio;
create schema if not exists pathd;

-- ------------------------------------------------------------------ products
create table if not exists core.products (
  id          text primary key check (id ~ '^[a-z][a-z0-9_]{1,30}$'),
  name        text not null,
  domain      text not null unique,
  created_at  timestamptz not null default now()
);
insert into core.products (id, name, domain) values
  ('aelio', 'AELIO', 'aelio.live'),
  ('pathd', 'PATHD', 'mypathd.com')
on conflict (id) do nothing;

-- ------------------------------------------------------------------ people
create table if not exists core.profiles (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  display_name  text check (char_length(display_name) <= 80),
  signup_product text not null references core.products(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists core.memberships (
  user_id     uuid not null references auth.users(id) on delete cascade,
  product_id  text not null references core.products(id),
  status      text not null default 'active' check (status in ('active', 'suspended')),
  joined_at   timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index if not exists memberships_product_idx on core.memberships(product_id);

-- ------------------------------------------------------------------ helpers
-- Does the signed-in user have an active membership in this product? (used by RLS policies)
create or replace function core.has_product(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from core.memberships m
                 where m.user_id = auth.uid() and m.product_id = p and m.status = 'active');
$$;

-- Copy active memberships into app_metadata.products (appears in the next access token).
create or replace function core.sync_products_claim(uid uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update auth.users u
     set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('products',
         coalesce((select jsonb_agg(m.product_id order by m.product_id) from core.memberships m
                   where m.user_id = uid and m.status = 'active'), '[]'::jsonb))
   where u.id = uid;
end $$;

-- ------------------------------------------------------------------ signup provisioning
-- Runs for every new auth user, whichever site they signed up on. The site passes
-- options.data.signup_product ('aelio' or 'pathd'); anything unknown falls back to 'aelio'.
create or replace function core.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  product text := coalesce(new.raw_user_meta_data ->> 'signup_product', 'aelio');
begin
  if not exists (select 1 from core.products where id = product) then
    product := 'aelio';
  end if;
  insert into core.profiles (user_id, display_name, signup_product)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80), product)
  on conflict (user_id) do nothing;
  insert into core.memberships (user_id, product_id) values (new.id, 'aelio') on conflict do nothing;  -- always an AELIO identity
  if product <> 'aelio' then
    insert into core.memberships (user_id, product_id) values (new.id, product) on conflict do nothing;
  end if;
  perform core.sync_products_claim(new.id);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function core.handle_new_user();

-- A signed-in person joins another product (e.g. an AELIO user opens mypathd.com for the first time).
create or replace function core.join_product(p text) returns text[]
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if not exists (select 1 from core.products where id = p) then raise exception 'unknown product' using errcode = '22023'; end if;
  if exists (select 1 from core.memberships where user_id = uid and product_id = p and status = 'suspended') then
    raise exception 'membership suspended' using errcode = '42501';
  end if;
  insert into core.memberships (user_id, product_id) values (uid, p) on conflict do nothing;
  perform core.sync_products_claim(uid);
  return array(select product_id from core.memberships where user_id = uid and status = 'active' order by 1);
end $$;

-- ------------------------------------------------------------------ PATHD product data (example table)
-- PATHD's real tables go here, each with the same two-part policy: own rows AND an active PATHD membership.
create table if not exists pathd.profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  headline    text check (char_length(headline) <= 200),
  settings    jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------------ AELIO product data
-- Engine-owned. Example: the link between a Supabase user and the AELIO engine account (mirrors the engine's
-- identities table, written by the engine with its own database role during migration).
create table if not exists aelio.accounts (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  engine_user_id text not null unique,
  created_at     timestamptz not null default now()
);

-- ------------------------------------------------------------------ access control
alter table core.products     enable row level security;
alter table core.profiles     enable row level security;
alter table core.memberships  enable row level security;
alter table pathd.profiles    enable row level security;
alter table aelio.accounts    enable row level security;

revoke all on all tables in schema core, aelio, pathd from public, anon, authenticated;
revoke all on schema aelio from public, anon, authenticated;            -- browsers never touch AELIO data
revoke all on all functions in schema core from public, anon;
grant usage on schema core, pathd to authenticated;

grant select on core.products to anon, authenticated;
grant usage on schema core to anon;
drop policy if exists products_read on core.products;
create policy products_read on core.products for select using (true);

grant select on core.profiles to authenticated;
grant update (display_name, updated_at) on core.profiles to authenticated;
drop policy if exists profiles_own_read on core.profiles;
create policy profiles_own_read on core.profiles for select to authenticated using (user_id = auth.uid());
drop policy if exists profiles_own_update on core.profiles;
create policy profiles_own_update on core.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on core.memberships to authenticated;                     -- read only; changes go through join_product()
drop policy if exists memberships_own_read on core.memberships;
create policy memberships_own_read on core.memberships for select to authenticated using (user_id = auth.uid());

grant execute on function core.has_product(text), core.join_product(text) to authenticated;
revoke execute on function core.sync_products_claim(uuid), core.handle_new_user() from authenticated;

grant select, insert, update, delete on pathd.profiles to authenticated;
drop policy if exists pathd_profiles_own on pathd.profiles;
create policy pathd_profiles_own on pathd.profiles for all to authenticated
  using (user_id = auth.uid() and core.has_product('pathd'))
  with check (user_id = auth.uid() and core.has_product('pathd'));
