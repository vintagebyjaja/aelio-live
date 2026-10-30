-- Additive repair. Apply AFTER migrations 01–04. No identity/session/subscription replacement.
-- Public, owner-scoped RPCs avoid exposing the private core schema through PostgREST.
begin;
alter table public.app_preferences add column if not exists mila_style text not null default 'homegirl'
 check (mila_style in ('homegirl','ceo','auntie','advisor','teacher','mom'));

create or replace function public.app_account_bootstrap() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); meta jsonb; result jsonb;
begin
 if uid is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' then raise insufficient_privilege; end if;
 select raw_user_meta_data into meta from auth.users where id=uid;
 if not found then raise insufficient_privilege; end if;
 insert into core.profiles(user_id,display_name,signup_product)
 values(uid,left(coalesce(meta->>'display_name',meta->>'full_name',''),80),case when meta->>'signup_product'='pathd' then 'pathd' else 'aelio' end) on conflict do nothing;
 insert into core.memberships(user_id,product_id) values(uid,'aelio'),(uid,'pathd') on conflict do nothing;
 insert into public.app_entitlements(user_id,product) values(uid,'aelio'),(uid,'pathd') on conflict do nothing;
 insert into public.app_preferences(user_id) values(uid) on conflict do nothing;
 insert into public.app_agents(owner_id,kind,name,subtitle) values(uid,'aelio','AELIO','Your Original Main Pal'),(uid,'mila','MILA','Career & Life Companion') on conflict do nothing;
 -- PATHD's legacy profile is independent: fill only a missing row when its table exists.
 if to_regclass('public.profiles') is not null then
  execute 'insert into public.profiles(id) values($1) on conflict do nothing' using uid;
 end if;
 select jsonb_build_object('user',jsonb_build_object('id',uid,'display_name',p.display_name,'recovery_enrolled',p.recovery_enrolled_at is not null),
 'preferences',(select to_jsonb(pref) from public.app_preferences pref where pref.user_id=uid),
 'plans',coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object('unlimited',exists(select 1 from core.app_roles r where r.user_id=uid and r.product=e.product))) from public.app_entitlements e where e.user_id=uid),'[]'::jsonb),
 'role',coalesce((select role from core.app_roles where user_id=uid and product='aelio'),'member')) into result
 from core.profiles p where p.user_id=uid;
 return result;
end $$;
create or replace function public.app_product_access(product text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from core.memberships where user_id=auth.uid() and product_id=product and status='active');
$$;
create or replace function public.app_user_rate_limit() returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 return public.app_limit('authenticated-platform:'||auth.uid()::text,120,60);
end $$;
create or replace function public.app_update_display_name(value text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 if value is null or length(value)>80 then raise invalid_parameter_value; end if;
 update core.profiles set display_name=trim(value),updated_at=now() where user_id=auth.uid();
end $$;
revoke all on function public.app_account_bootstrap(),public.app_product_access(text),public.app_user_rate_limit(),public.app_update_display_name(text) from public,anon;
grant execute on function public.app_account_bootstrap(),public.app_product_access(text),public.app_user_rate_limit(),public.app_update_display_name(text) to authenticated;
-- Narrow server-only accessors: private core tables never need to be exposed through PostgREST.
create or replace function public.app_chat_request_lookup(rid uuid) returns jsonb
language sql stable security definer set search_path='' as $$ select to_jsonb(r) from core.chat_requests r where id=rid; $$;
create or replace function public.app_recovery_record(uid uuid) returns jsonb
language sql stable security definer set search_path='' as $$ select to_jsonb(r) from core.recovery_credentials r where user_id=uid; $$;
revoke all on function public.app_chat_request_lookup(uuid),public.app_recovery_record(uuid) from public,anon,authenticated;
grant execute on function public.app_chat_request_lookup(uuid),public.app_recovery_record(uuid) to service_role;
create or replace function public.app_export_profile() returns jsonb
language sql stable security definer set search_path='' as $$ select to_jsonb(p) from core.profiles p where user_id=auth.uid(); $$;
revoke all on function public.app_export_profile() from public,anon;
grant execute on function public.app_export_profile() to authenticated;
-- Refuse destructive partial deletion if legacy product rows would prevent Auth deletion.
create or replace function public.app_account_deletion_ready(uid uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare link record; present boolean;
begin
 for link in select ns.nspname,rel.relname,col.attname,c.conkey from pg_catalog.pg_constraint c
 join pg_catalog.pg_class rel on rel.oid=c.conrelid join pg_catalog.pg_namespace ns on ns.oid=rel.relnamespace
 left join pg_catalog.pg_attribute col on col.attrelid=c.conrelid and col.attnum=c.conkey[1]
 where c.contype='f' and c.confrelid='auth.users'::regclass and c.confdeltype in ('a','r')
 loop
  if cardinality(link.conkey)<>1 then return false; end if;
  execute format('select exists(select 1 from %I.%I where %I=$1)',link.nspname,link.relname,link.attname) into present using uid;
  if present then return false; end if;
 end loop;
 return true;
end $$;
revoke all on function public.app_account_deletion_ready(uuid) from public,anon,authenticated;
grant execute on function public.app_account_deletion_ready(uuid) to service_role;
commit;
