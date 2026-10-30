-- Review migration. Apply manually after 08. Does not assign administrator privileges or change subscriptions.
begin;
create table if not exists core.message_credit_overrides(user_id uuid not null references auth.users(id) on delete cascade,product text not null references core.products(id),unlimited boolean not null default true,created_at timestamptz not null default now(),primary key(user_id,product));
alter table core.message_credit_overrides enable row level security;
revoke all on core.message_credit_overrides from public,anon,authenticated;
create table if not exists core.credit_plan_allowances(product text not null references core.products(id),plan text not null,monthly_messages integer not null check(monthly_messages>=0),primary key(product,plan));
alter table core.credit_plan_allowances enable row level security;
revoke all on core.credit_plan_allowances from public,anon,authenticated;
-- The existing approved Free allowance is 100. Other plan balances remain untouched unless explicitly configured.
insert into core.credit_plan_allowances values('aelio','free',100),('pathd','free',100) on conflict do nothing;
create or replace function core.grant_unlimited_messages(verified_uid uuid,expected_email text) returns void
language plpgsql security definer set search_path='' as $$ begin
 if lower(expected_email) not in ('vintagebyjaja@gmail.com','jaja@vybr8.live') or not exists(select 1 from auth.users where id=verified_uid and lower(email)=lower(expected_email)) then raise exception 'Review the verified Auth user ID and approved account';end if;
 insert into core.message_credit_overrides(user_id,product) values(verified_uid,'aelio'),(verified_uid,'pathd') on conflict(user_id,product) do update set unlimited=true;
end $$;
-- SQL owner only. Never callable with browser or service-role credentials.
revoke all on function core.grant_unlimited_messages(uuid,text) from public,anon,authenticated,service_role;
create or replace function public.app_account_bootstrap() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); meta jsonb; result jsonb;
begin
 if uid is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' then raise insufficient_privilege; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,0));
 select raw_user_meta_data into meta from auth.users where id=uid;
 if not found then raise insufficient_privilege; end if;
 insert into core.profiles(user_id,display_name,signup_product)
 values(uid,left(coalesce(meta->>'display_name',meta->>'full_name',''),80),case when meta->>'signup_product'='pathd' then 'pathd' else 'aelio' end) on conflict do nothing;
 insert into core.memberships(user_id,product_id) values(uid,'aelio'),(uid,'pathd') on conflict do nothing;
 insert into public.app_entitlements(user_id,product) values(uid,'aelio'),(uid,'pathd') on conflict do nothing;
 insert into public.app_preferences(user_id) values(uid) on conflict do nothing;
 insert into public.app_agents(owner_id,kind,name,subtitle) values(uid,'aelio','AELIO','Your Original Main Pal'),(uid,'mila','MILA','Career & Life Companion') on conflict do nothing;
 -- PATHD's legacy profile is independent: fill only a missing row when its table exists.
 begin
  if to_regclass('public.profiles') is not null then
   execute 'insert into public.profiles(id) values($1) on conflict do nothing' using uid;
  end if;
 exception when others then
  -- A missing/incompatible optional PATHD profile never rolls back the shared identity.
  raise warning 'pathd_legacy_profile_initialization_failed SQLSTATE=%',SQLSTATE;
 end;
 perform core.ensure_companions(uid);
 select jsonb_build_object('user',jsonb_build_object('id',uid,'display_name',p.display_name,'recovery_enrolled',p.recovery_enrolled_at is not null),
 'preferences',(select to_jsonb(pref) from public.app_preferences pref where pref.user_id=uid),
 'plans',coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object('unlimited',exists(select 1 from core.message_credit_overrides r where r.user_id=uid and r.product=e.product and r.unlimited))) from public.app_entitlements e where e.user_id=uid),'[]'::jsonb),
 'role',coalesce((select role from core.app_roles where user_id=uid and product='aelio'),'member')) into result
 from core.profiles p where p.user_id=uid;
 return result;
end $$;
create or replace function public.app_reserve_chat(cid uuid,uid uuid,guest text,allowance integer,rid uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare c public.app_conversations; n integer; was_charged boolean:=true; qperiod timestamptz;
begin
 select * into c from public.app_conversations where id=cid for update;
 if c.id is null or (uid is not null and c.owner_id is distinct from uid) or (uid is null and (guest is null or c.guest_hash is distinct from guest)) then raise exception 'not found' using errcode='42501'; end if;
 if c.busy_until>now() then raise exception 'reply in progress' using errcode='55P03'; end if;
 if uid is null then
 update public.app_guests set messages_used=messages_used+1 where id_hash=guest and expires_at>now() and claimed_by is null and messages_used<least(greatest(allowance,1),100) returning allowance-messages_used into n;
 else
 if not exists(select 1 from core.memberships where user_id=uid and product_id=c.product and status='active') then raise exception 'membership suspended' using errcode='42501'; end if;
 update public.app_entitlements e set credits=p.monthly_messages,period_start=date_trunc('month',now()) from core.credit_plan_allowances p where e.user_id=uid and e.product=c.product and e.period_start<date_trunc('month',now()) and e.product=p.product and e.plan=p.plan;
 if exists(select 1 from core.message_credit_overrides where user_id=uid and product=c.product and unlimited) then n:=2147483647; was_charged:=false; else
 update public.app_entitlements set credits=credits-1 where user_id=uid and product=c.product and credits>0 returning credits into n;
 end if;
 end if;
 if uid is not null then select period_start into qperiod from public.app_entitlements where user_id=uid and product=c.product; end if;
 if n is null then raise exception 'message limit reached' using errcode='P0001'; end if;
 update public.app_conversations set busy_until=now()+interval '10 minutes',updated_at=now() where id=cid;
 insert into core.chat_requests(id,conversation_id,owner_id,charged,quota_period) values(rid,cid,uid,was_charged,qperiod);
 return n;
end $$;

create or replace function public.app_service_health() returns boolean language sql stable security definer set search_path='' as $$ select to_regclass('core.chat_requests') is not null and to_regclass('public.app_conversations') is not null $$;
revoke all on function public.app_service_health() from public,anon,authenticated;
grant execute on function public.app_service_health() to service_role;
commit;
