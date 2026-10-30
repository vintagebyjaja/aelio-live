-- AELIO v1.0.2. Additive; no existing preference or conversation is overwritten.
begin;
alter table public.app_preferences add column if not exists appearance jsonb not null default '{}';
alter table public.app_agents add column if not exists appearance jsonb not null default '{}';
alter table public.app_agents add column if not exists appearance_mode text not null default 'inherit' check(appearance_mode in ('inherit','custom'));
-- Existing owner-scoped SELECT policies continue to apply. Server APIs validate all writes.
-- Existing grants deliberately do not grant clients new UPDATE capabilities.
comment on column public.app_agents.appearance is 'Saved visual settings only; preserved when inheritance is enabled. No personality or memory fields.';
comment on column public.app_preferences.appearance is 'Global AELIO appearance; PATHD branding stays independent.';
commit;
