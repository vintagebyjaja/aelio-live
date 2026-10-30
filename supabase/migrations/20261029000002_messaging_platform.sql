-- AELIO v1.0.1. Additive. Review on a backup/staging copy before production.
-- Apply after 20261028000001. Public app_* tables use RLS; secrets stay in core.
alter table core.profiles add column if not exists recovery_enrolled_at timestamptz;
create table if not exists core.recovery_credentials (
 user_id uuid primary key references auth.users on delete cascade,
 questions jsonb not null, answer_hashes jsonb not null, code_hashes text[] not null,
 enrolled_at timestamptz not null default now()
);
create table if not exists core.app_roles (
 user_id uuid not null references auth.users on delete cascade,
 product text not null references core.products(id), role text not null check(role in ('founder','personal')),
 primary key(user_id,product)
);
alter table core.recovery_credentials enable row level security;
alter table core.app_roles enable row level security;
revoke all on core.recovery_credentials,core.app_roles from public,anon,authenticated;
grant usage on schema core,aelio,pathd to service_role;
grant all on all tables in schema core to service_role;

create table if not exists public.app_entitlements (
 user_id uuid not null references auth.users on delete cascade,
 product text not null references core.products(id), plan text not null default 'free',
 credits integer not null default 100 check(credits >= 0), period_start timestamptz not null default date_trunc('month',now()),
 primary key(user_id,product)
);
create table if not exists public.app_agents (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users on delete cascade default auth.uid(),
 kind text not null default 'custom' check(kind in ('aelio','mila','custom')),
 name text not null check(length(name) between 1 and 80), subtitle text not null default '' check(length(subtitle)<=160),
 specialty text not null default '' check(length(specialty)<=1000), personality text,
 instructions text not null default '' check(length(instructions)<=4000), memories jsonb not null default '[]',
 memory_enabled boolean not null default false, voice text,
 created_at timestamptz not null default now(),
 check(kind <> 'aelio' or (name='AELIO' and personality is null)),
 check(kind <> 'mila' or (name='MILA' and personality is null))
);
create unique index if not exists app_system_agents on public.app_agents(owner_id,kind) where kind <> 'custom';
create table if not exists public.app_guests (
 id_hash text primary key, messages_used integer not null default 0,
 expires_at timestamptz not null default now()+interval '1 day', claimed_by uuid references auth.users
);
create table if not exists public.app_conversations (
 id uuid primary key default gen_random_uuid(), owner_id uuid references auth.users on delete cascade,
 guest_hash text references public.app_guests(id_hash), product text not null default 'aelio' check(product in ('aelio','pathd')),
 title text not null default 'New conversation' check(length(title)<=160), subtitle text not null default '' check(length(subtitle)<=160),
 participants uuid[] not null default '{}', appearance jsonb not null default '{}',
 pinned boolean not null default false, archived boolean not null default false,
 memory_enabled boolean not null default false,
 busy_until timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check ((owner_id is not null)::int + (guest_hash is not null)::int = 1)
);
create index if not exists app_conversation_owner on public.app_conversations(owner_id,updated_at desc);
create table if not exists public.app_messages (
 id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.app_conversations on delete cascade,
 agent_id uuid references public.app_agents on delete set null, speaker text,
 role text not null check(role in ('user','assistant')), content text not null check(length(content)<=32000),
 status text not null default 'complete' check(status in ('complete','failed')), request_id uuid,
 created_at timestamptz not null default now()
);
create index if not exists app_message_history on public.app_messages(conversation_id,created_at);
create table if not exists public.app_files (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users on delete cascade,
 object_key text not null unique, name text not null, mime text not null, size_bytes bigint not null check(size_bytes between 1 and 26214400),
 category text not null check(category in ('users','agents','voice','documents','code-projects','generated-assets')),
 conversation_id uuid references public.app_conversations on delete set null,
 agent_id uuid references public.app_agents on delete set null,
 status text not null default 'pending' check(status in ('pending','ready','deleting')),
 expires_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists app_files_owner on public.app_files(owner_id);
create table if not exists public.app_preferences (
 user_id uuid primary key references auth.users on delete cascade default auth.uid(),
 external_ai_consent boolean not null default false, career_consent boolean not null default false,
 career_outside_mila boolean not null default false, mila_welcomed boolean not null default false,
 timezone text not null default 'UTC', updated_at timestamptz not null default now()
);
create table if not exists public.app_career_records (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users on delete cascade default auth.uid(),
 kind text not null check(kind in ('profile','job','application','event','goal','search')),
 title text not null check(length(title) between 1 and 200), data jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create table if not exists public.app_reminders (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users on delete cascade default auth.uid(),
 title text not null check(length(title) between 1 and 200), due_at timestamptz not null,
 timezone text not null default 'UTC', recurrence text not null default 'once' check(recurrence in ('once','daily','weekly')),
 paused boolean not null default false, source_id uuid references public.app_career_records on delete set null,
 created_at timestamptz not null default now()
);
create table if not exists public.app_notifications (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users on delete cascade,
 reminder_id uuid references public.app_reminders on delete set null, title text not null,
 scheduled_for timestamptz not null, read_at timestamptz, created_at timestamptz not null default now(),
 unique(reminder_id,scheduled_for)
);
create table if not exists public.app_agent_publications (
 id uuid primary key default gen_random_uuid(), creator_id uuid not null references auth.users on delete cascade,
 name text not null, subtitle text not null, specialty text not null, personality text,
 description text not null, capabilities text[] not null default '{}',
 status text not null default 'draft' check(status in ('draft','review')),
 created_at timestamptz not null default now()
 -- Deliberately no memories, messages, instructions, credentials, or file references.
);
create table if not exists public.app_audit (
 id bigint generated always as identity primary key, owner_id uuid references auth.users on delete set null,
 action text not null, target_id text, created_at timestamptz not null default now()
);
create table if not exists core.rate_limits (
 key text primary key, count integer not null, resets_at timestamptz not null
);
create table if not exists core.chat_requests (
 id uuid primary key, conversation_id uuid not null references public.app_conversations on delete cascade,
 owner_id uuid references auth.users on delete cascade, status text not null default 'running',
 created_at timestamptz not null default now(), finished_at timestamptz, charged boolean not null default true, quota_period timestamptz
);
alter table core.chat_requests add column if not exists charged boolean not null default true;
alter table core.chat_requests add column if not exists quota_period timestamptz;

-- Provision both memberships without upgrading subscriptions or resurrecting suspended memberships.
create or replace function core.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into core.profiles(user_id,display_name,signup_product)
 values(new.id,left(coalesce(new.raw_user_meta_data->>'display_name',''),80),case when new.raw_user_meta_data->>'signup_product'='pathd' then 'pathd' else 'aelio' end)
 on conflict do nothing;
 insert into core.memberships(user_id,product_id) values(new.id,'aelio'),(new.id,'pathd') on conflict do nothing;
 insert into public.app_entitlements(user_id,product) values(new.id,'aelio'),(new.id,'pathd') on conflict do nothing;
 insert into public.app_preferences(user_id) values(new.id) on conflict do nothing;
 insert into public.app_agents(owner_id,kind,name,subtitle) values(new.id,'aelio','AELIO','Your Original Main Pal'),(new.id,'mila','MILA','Career & Life Companion') on conflict do nothing;
 perform core.sync_products_claim(new.id);
 return new;
end $$;
-- Existing identities preserved. This only fills missing application rows.
insert into core.profiles(user_id,display_name,signup_product) select id,left(coalesce(raw_user_meta_data->>'display_name',''),80),'aelio' from auth.users on conflict do nothing;
insert into core.memberships(user_id,product_id) select u.id,p.id from auth.users u cross join core.products p on conflict do nothing;
insert into public.app_entitlements(user_id,product) select u.id,p.id from auth.users u cross join core.products p on conflict do nothing;
insert into public.app_preferences(user_id) select id from auth.users on conflict do nothing;
insert into public.app_agents(owner_id,kind,name,subtitle) select id,'aelio','AELIO','Your Original Main Pal' from auth.users on conflict do nothing;
insert into public.app_agents(owner_id,kind,name,subtitle) select id,'mila','MILA','Career & Life Companion' from auth.users on conflict do nothing;

-- Explicit ownership policies. Authenticated clients cannot bypass edge validation to write model replies,
-- change credits, enroll recovery credentials, or assign roles.
do $$ declare t text; begin
 foreach t in array array['app_entitlements','app_agents','app_conversations','app_messages','app_files','app_preferences','app_career_records','app_reminders','app_notifications','app_agent_publications','app_audit','app_guests'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant usage,select on all sequences in schema public to service_role;
do $$ declare t text; col text; prod text; begin
 foreach t in array array['app_entitlements','app_agents','app_conversations','app_files','app_preferences','app_career_records','app_reminders','app_notifications','app_agent_publications','app_audit'] loop
 col := case when t in ('app_entitlements','app_preferences') then 'user_id' when t='app_agent_publications' then 'creator_id' else 'owner_id' end;
 prod := case when t='app_career_records' then 'pathd' else 'aelio' end;
 execute format('grant select on public.%I to authenticated',t);
 execute format('drop policy if exists own_read on public.%I',t);
 execute format('create policy own_read on public.%I for select to authenticated using (%I=auth.uid() and core.has_product(%L))',t,col,prod);
 end loop;
end $$;
grant select on public.app_messages to authenticated;
drop policy if exists messages_own on public.app_messages;
create policy messages_own on public.app_messages for select to authenticated using(exists(select 1 from public.app_conversations c where c.id=conversation_id and c.owner_id=auth.uid() and core.has_product(c.product)));
alter table core.rate_limits enable row level security;
alter table core.chat_requests enable row level security;
revoke all on core.rate_limits,core.chat_requests from public,anon,authenticated;
grant all on core.rate_limits,core.chat_requests to service_role;

create or replace function public.app_limit(k text,maximum integer,seconds integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 insert into core.rate_limits(key,count,resets_at) values(k,1,now()+make_interval(secs=>seconds))
 on conflict(key) do update set count=case when core.rate_limits.resets_at<=now() then 1 else core.rate_limits.count+1 end,
 resets_at=case when core.rate_limits.resets_at<=now() then now()+make_interval(secs=>seconds) else core.rate_limits.resets_at end returning count into n;
 return n<=maximum;
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
 update public.app_entitlements set credits=100,period_start=date_trunc('month',now()) where user_id=uid and product=c.product and period_start<date_trunc('month',now()) and plan='free';
 if exists(select 1 from core.app_roles where user_id=uid and product=c.product and role in ('founder','personal')) then n:=2147483647; was_charged:=false; else
 update public.app_entitlements set credits=credits-1 where user_id=uid and product=c.product and credits>0 returning credits into n;
 end if;
 end if;
 if uid is not null then select period_start into qperiod from public.app_entitlements where user_id=uid and product=c.product; end if;
 if n is null then raise exception 'message limit reached' using errcode='P0001'; end if;
 update public.app_conversations set busy_until=now()+interval '10 minutes',updated_at=now() where id=cid;
 insert into core.chat_requests(id,conversation_id,owner_id,charged,quota_period) values(rid,cid,uid,was_charged,qperiod);
 return n;
end $$;
create or replace function public.app_finish_chat(rid uuid,ok boolean) returns void
language plpgsql security definer set search_path='' as $$
declare r core.chat_requests; c public.app_conversations;
begin
 select * into r from core.chat_requests where id=rid for update;
 if r.id is null or r.status<>'running' then return; end if;
 select * into c from public.app_conversations where id=r.conversation_id for update;
 update core.chat_requests set status=case when ok then 'complete' else 'failed' end,finished_at=now() where id=rid;
 update public.app_conversations set busy_until=null,updated_at=now() where id=c.id;
 if not ok and r.charged then
 if r.owner_id is null then update public.app_guests set messages_used=greatest(0,messages_used-1) where id_hash=c.guest_hash;
 else update public.app_entitlements set credits=credits+1 where user_id=r.owner_id and product=c.product and period_start is not distinct from r.quota_period; end if;
 end if;
end $$;
create or replace function public.app_claim_guest(g text,uid uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare n integer; aid uuid;
begin
 update public.app_guests set claimed_by=uid where id_hash=g and claimed_by is null and expires_at>now();
 if not found then return 0; end if;
 select id into aid from public.app_agents where owner_id=uid and kind='aelio';
 update public.app_conversations set owner_id=uid,guest_hash=null,participants=array[aid] where guest_hash=g;
 get diagnostics n=row_count; return n;
end $$;
create or replace function public.app_enroll_recovery(uid uuid,qs jsonb,hashes jsonb,codes text[]) returns void
language plpgsql security definer set search_path='' as $$ begin
 insert into core.recovery_credentials(user_id,questions,answer_hashes,code_hashes) values(uid,qs,hashes,codes)
 on conflict(user_id) do update set questions=excluded.questions,answer_hashes=excluded.answer_hashes,code_hashes=excluded.code_hashes,enrolled_at=now();
 update core.profiles set recovery_enrolled_at=now() where user_id=uid;
 insert into public.app_audit(owner_id,action) values(uid,'recovery.enrolled');
end $$;
create or replace function public.app_consume_recovery(uid uuid,code text) returns boolean
language plpgsql security definer set search_path='' as $$ begin
 update core.recovery_credentials set code_hashes=array_remove(code_hashes,code) where user_id=uid and code=any(code_hashes);
 return found;
end $$;
-- Scheduler locks due rows; notification uniqueness makes retries idempotent. Daily/weekly preserve local wall time.
create or replace function public.app_deliver_reminders() returns integer
language plpgsql security definer set search_path='' as $$
declare r public.app_reminders; n integer:=0; next_due timestamptz; jump integer; step integer;
begin
 for r in select * from public.app_reminders where not paused and due_at<=now() order by due_at for update skip locked limit 200 loop
 insert into public.app_notifications(owner_id,reminder_id,title,scheduled_for) values(r.owner_id,r.id,r.title,r.due_at) on conflict do nothing;
 if r.recurrence='once' then update public.app_reminders set paused=true where id=r.id;
 else
 step:=case when r.recurrence='daily' then 1 else 7 end;
 jump:=greatest(1,((now() at time zone r.timezone)::date-(r.due_at at time zone r.timezone)::date)/step);
 next_due:=((r.due_at at time zone r.timezone)+make_interval(days=>jump*step)) at time zone r.timezone;
 if next_due<=now() then next_due:=((next_due at time zone r.timezone)+make_interval(days=>step)) at time zone r.timezone; end if;
 update public.app_reminders set due_at=next_due where id=r.id;
 end if;
 n:=n+1;
 end loop;
 -- Refund abandoned generation leases after crashes; late finish is idempotent.
 perform public.app_finish_chat(id,false) from core.chat_requests where status='running' and created_at<now()-interval '15 minutes';
 delete from core.rate_limits where resets_at<now()-interval '1 day';
 return n;
end $$;
-- Lock down every new SECURITY DEFINER RPC explicitly (Postgres otherwise grants PUBLIC execute).
do $$ declare f record; begin
 for f in select p.oid::regprocedure as name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'app\_%' escape '\' loop
 execute format('revoke all on function %s from public,anon,authenticated',f.name);
 execute format('grant execute on function %s to service_role',f.name);
 end loop;
end $$;
create or replace function public.app_recovery_user(address text) returns uuid
language sql stable security definer set search_path='' as $$ select id from auth.users where lower(email)=lower(address) limit 1 $$;
revoke all on function public.app_recovery_user(text) from public,anon,authenticated;
grant execute on function public.app_recovery_user(text) to service_role;
create or replace function public.app_reserve_file(record jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=(record->>'owner_id')::uuid; used bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended(uid::text,1));
 select coalesce(sum(size_bytes),0) into used from public.app_files where owner_id=uid;
 if used+(record->>'size_bytes')::bigint>262144000 then raise exception 'storage quota reached'; end if;
 insert into public.app_files(id,owner_id,object_key,name,mime,size_bytes,category,conversation_id,agent_id,expires_at)
 values((record->>'id')::uuid,uid,record->>'object_key',record->>'name',record->>'mime',(record->>'size_bytes')::bigint,record->>'category',nullif(record->>'conversation_id','')::uuid,nullif(record->>'agent_id','')::uuid,(record->>'expires_at')::timestamptz);
end $$;
revoke all on function public.app_reserve_file(jsonb) from public,anon,authenticated;
grant execute on function public.app_reserve_file(jsonb) to service_role;
-- Preserve PATHD's existing profile bootstrap even if its older same-named trigger was replaced.
create or replace function core.pathd_profile_bootstrap() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 if to_regclass('public.profiles') is not null then
 execute 'insert into public.profiles(id,full_name) values($1,$2) on conflict do nothing' using new.id,left(new.raw_user_meta_data->>'display_name',80);
 execute 'insert into public.privacy_settings(profile_id) values($1) on conflict do nothing' using new.id;
 execute 'insert into public.career_preferences(profile_id) values($1) on conflict do nothing' using new.id;
 end if;
 return new;
end $$;
drop trigger if exists on_auth_pathd_profile_created on auth.users;
create trigger on_auth_pathd_profile_created after insert on auth.users for each row execute function core.pathd_profile_bootstrap();
revoke all on function core.pathd_profile_bootstrap() from public,anon,authenticated;
-- Existing PATHD profiles are kept intact; missing rows only are filled.
do $$ begin
 if to_regclass('public.profiles') is not null then
 execute 'insert into public.profiles(id) select id from auth.users on conflict do nothing';
 execute 'insert into public.privacy_settings(profile_id) select id from auth.users on conflict do nothing';
 execute 'insert into public.career_preferences(profile_id) select id from auth.users on conflict do nothing';
 end if;
end $$;
-- Shared display name stays in sync while PATHD-specific profile fields remain untouched.
create or replace function core.sync_display_name() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 if pg_trigger_depth()>1 or current_setting('aelio.migration_backfill',true)='1' then return new; end if;
 if tg_table_schema='core' then
 if to_regclass('public.profiles') is not null then execute 'update public.profiles set full_name=$1 where id=$2 and full_name is distinct from $1' using new.display_name,new.user_id; end if;
 else
 update core.profiles set display_name=left(new.full_name,80),updated_at=now() where user_id=new.id and display_name is distinct from left(new.full_name,80);
 end if;
 return new;
end $$;
drop trigger if exists shared_name_to_pathd on core.profiles;
create trigger shared_name_to_pathd after update of display_name on core.profiles for each row execute function core.sync_display_name();
do $$ begin
 if to_regclass('public.profiles') is not null then
 execute 'drop trigger if exists pathd_name_to_shared on public.profiles';
 execute 'create trigger pathd_name_to_shared after update of full_name on public.profiles for each row execute function core.sync_display_name()';
 perform set_config('aelio.migration_backfill','1',true);
 execute 'update core.profiles c set display_name=left(p.full_name,80) from public.profiles p where p.id=c.user_id and coalesce(c.display_name,'''')='''' and p.full_name is not null';
 end if;
end $$;
revoke all on function core.sync_display_name() from public,anon,authenticated;
-- Save a whole completed turn atomically. Late/stale generation cannot write after its lease was refunded.
create or replace function public.app_commit_chat(rid uuid,input text,responses jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare r core.chat_requests; a jsonb;
begin
 select * into r from core.chat_requests where id=rid for update;
 if r.id is null or r.status<>'running' then raise exception 'generation lease expired'; end if;
 insert into public.app_messages(conversation_id,role,content,request_id) values(r.conversation_id,'user',input,rid);
 for a in select * from jsonb_array_elements(responses) loop
 insert into public.app_messages(conversation_id,agent_id,speaker,role,content,request_id)
 values(r.conversation_id,(a->>'agent_id')::uuid,a->>'speaker','assistant',a->>'content',rid);
 end loop;
 perform public.app_finish_chat(rid,true);
end $$;
revoke all on function public.app_commit_chat(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.app_commit_chat(uuid,text,jsonb) to service_role;
-- Memberships and billing remain independent, including suspension boundaries.
drop policy if exists own_read on public.app_entitlements;
create policy own_read on public.app_entitlements for select to authenticated using(user_id=auth.uid() and core.has_product(product));
drop policy if exists own_read on public.app_conversations;
create policy own_read on public.app_conversations for select to authenticated using(owner_id=auth.uid() and core.has_product(product));
drop policy if exists own_read on public.app_agents;
create policy own_read on public.app_agents for select to authenticated using(owner_id=auth.uid() and (core.has_product('aelio') or (kind in ('aelio','mila') and core.has_product('pathd'))));
drop policy if exists own_read on public.app_preferences;
create policy own_read on public.app_preferences for select to authenticated using(user_id=auth.uid() and (core.has_product('aelio') or core.has_product('pathd')));
do $$ declare u record; begin for u in select id from auth.users loop perform core.sync_products_claim(u.id); end loop; end $$;
