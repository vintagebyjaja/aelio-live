-- Native Brain foundation. Owner review/application only; no provider, payout or deployment activation.
begin;
create table if not exists public.app_native_projects(
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users on delete cascade,
 title text not null check(length(title) between 1 and 120),kind text not null default 'website' check(kind in('website','application','animation','design')),
 files jsonb not null default '{}',memory text not null default '' check(length(memory)<=20000),deployment jsonb not null default '{}',
 revision integer not null default 1 check(revision>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(jsonb_typeof(files)='object' and octet_length(files::text)<=524288),check(jsonb_typeof(deployment)='object' and octet_length(deployment::text)<=8000));
create table if not exists public.app_native_project_versions(
 project_id uuid not null references public.app_native_projects on delete cascade,revision integer not null,
 snapshot jsonb not null,created_at timestamptz not null default now(),primary key(project_id,revision));
alter table public.app_native_projects enable row level security;
alter table public.app_native_project_versions enable row level security;
drop policy if exists native_project_owner on public.app_native_projects;
create policy native_project_owner on public.app_native_projects for select to authenticated using(owner_id=auth.uid() and public.app_product_access('aelio'));
drop policy if exists native_version_owner on public.app_native_project_versions;
create policy native_version_owner on public.app_native_project_versions for select to authenticated using(exists(select 1 from public.app_native_projects p where p.id=project_id and p.owner_id=auth.uid()));
revoke all on public.app_native_projects,public.app_native_project_versions from public,anon,authenticated;
grant select on public.app_native_projects,public.app_native_project_versions to authenticated;
grant all on public.app_native_projects,public.app_native_project_versions to service_role;
create or replace function public.app_native_save(pid uuid,expected integer,document jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.app_native_projects; f record; cfg jsonb; eid text; uid uuid:=auth.uid();
begin
 if uid is null or not public.app_product_access('aelio') then raise exception 'native access denied' using errcode='42501';end if;
 if expected is null or (pid is null and expected<>0) or (pid is not null and expected<1) then raise exception 'expected revision required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||':native-projects',0));
 if jsonb_typeof(document)<>'object' or coalesce(document->>'title','')='' or length(document->>'title')>120 or document->>'kind' not in('website','application','animation','design') then raise exception 'invalid project' using errcode='22023';end if;
 if jsonb_typeof(document->'files') is distinct from 'object' or octet_length((document->'files')::text)>524288 or (select count(*) from jsonb_object_keys(document->'files'))>64 then raise exception 'project file limit' using errcode='22023';end if;
 for f in select key,value from jsonb_each(document->'files') loop
  if f.key !~ '^[A-Za-z0-9_@./-]{1,180}$' or f.key ~ '(^/|(^|/)\.\.(/|$)|//|/$)' or f.key ~* '(^|/)(\.git|node_modules|\.ssh|\.aws)(/|$)' or (f.key ~* '(^|/)\.env' and f.key !~* '(^|/)\.env\.example$') or f.key ~* '(\.pem$|(^|/)id_rsa$|(^|/)\.npmrc$)' or jsonb_typeof(f.value)<>'string' or octet_length(f.value#>>'{}')>65536 then raise exception 'invalid project file' using errcode='22023';end if;
 end loop;
 if length(coalesce(document->>'memory',''))>20000 then raise exception 'project memory limit' using errcode='22023';end if;
 cfg:=coalesce(document->'deployment','{}');
 if jsonb_typeof(cfg)<>'object' or octet_length(cfg::text)>8000 or exists(select 1 from jsonb_object_keys(cfg) k where k not in('repository','branch','build_command','output_directory','domain','env_names')) then raise exception 'invalid deployment settings' using errcode='22023';end if;
 if coalesce(cfg->>'repository','')<>'' and cfg->>'repository' !~ '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$' then raise exception 'invalid repository' using errcode='22023';end if;
 if exists(select 1 from jsonb_each(cfg) c where c.key<>'env_names' and (jsonb_typeof(c.value)<>'string' or length(c.value#>>'{}')>500)) then raise exception 'invalid deployment field' using errcode='22023';end if;
 if cfg ? 'env_names' then
  if jsonb_typeof(cfg->'env_names')<>'array' or jsonb_array_length(cfg->'env_names')>50 then raise exception 'invalid environment names' using errcode='22023';end if;
  for eid in select jsonb_array_elements_text(cfg->'env_names') loop if eid !~ '^[A-Z_][A-Z0-9_]{0,79}$' then raise exception 'invalid environment name' using errcode='22023';end if;end loop;
 end if;
 if pid is null then
  if expected<>0 or (select count(*) from public.app_native_projects where owner_id=uid)>=20 then raise exception 'project quota or revision conflict' using errcode='40001';end if;
  insert into public.app_native_projects(owner_id,title,kind,files,memory,deployment) values(uid,document->>'title',document->>'kind',document->'files',coalesce(document->>'memory',''),cfg) returning * into p;
 else
  select * into p from public.app_native_projects where id=pid and owner_id=uid for update;
  if not found then raise exception 'project unavailable' using errcode='42501';end if;
  if p.revision<>expected then raise exception 'project changed in another session' using errcode='40001';end if;
  update public.app_native_projects set title=document->>'title',kind=document->>'kind',files=document->'files',memory=coalesce(document->>'memory',''),deployment=cfg,revision=revision+1,updated_at=clock_timestamp() where id=pid returning * into p;
 end if;
 insert into public.app_native_project_versions(project_id,revision,snapshot) values(p.id,p.revision,jsonb_build_object('title',p.title,'kind',p.kind,'files',p.files,'memory',p.memory,'deployment',p.deployment));
 -- Retain the latest 50 versions per project; this is disclosed in the UI.
 delete from public.app_native_project_versions where project_id=p.id and revision<=p.revision-50;
 return to_jsonb(p);
end $$;
revoke all on function public.app_native_save(uuid,integer,jsonb) from public,anon;
grant execute on function public.app_native_save(uuid,integer,jsonb) to authenticated;

-- Real-money structures: no seeded funds, no client writes, no withdrawal RPC.
-- Only a future verified payment/payout integration may write provider-confirmed events.
create table if not exists core.creator_earnings(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,
 source text not null check(length(source) between 1 and 80),provider_event_id text not null unique,
 currency text not null default 'usd' check(currency='usd'),gross_cents bigint not null check(gross_cents>=0),fee_cents bigint not null check(fee_cents>=0 and fee_cents<=gross_cents),
 net_cents bigint generated always as (gross_cents-fee_cents) stored,
 status text not null check(status in('pending','available','paid','reversed')),payout_reference text,created_at timestamptz not null default now());
alter table core.creator_earnings enable row level security;
revoke all on core.creator_earnings from public,anon,authenticated;
grant all on core.creator_earnings to service_role;
create or replace function public.app_native_wallet() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); result jsonb;
begin
 if uid is null or not public.app_product_access('aelio') then raise exception 'wallet access denied' using errcode='42501';end if;
 select jsonb_build_object('credits',coalesce((select e.credits from public.app_entitlements e where e.user_id=uid and product='aelio'),0),
  'unlimited',exists(select 1 from core.message_credit_overrides where user_id=uid and product='aelio' and unlimited),
  'currency','usd','earnings',jsonb_build_object(
   'gross_cents',coalesce(sum(gross_cents) filter(where status<>'reversed'),0),'fee_cents',coalesce(sum(fee_cents) filter(where status<>'reversed'),0),
   'net_cents',coalesce(sum(net_cents) filter(where status<>'reversed'),0),'pending_cents',coalesce(sum(net_cents) filter(where status='pending'),0),
   'available_cents',coalesce(sum(net_cents) filter(where status='available'),0),'paid_cents',coalesce(sum(net_cents) filter(where status='paid'),0)),
  'transactions',coalesce((select jsonb_agg(x) from(select source,gross_cents,fee_cents,net_cents,status,currency,created_at from core.creator_earnings where user_id=uid order by created_at desc,id desc limit 100)x),'[]'::jsonb),
  'payouts_enabled',false,'payout_account_status','not_connected','payment_methods_status','provider_connection_required') into result from core.creator_earnings where user_id=uid;
 return result;
end $$;
revoke all on function public.app_native_wallet() from public,anon;
grant execute on function public.app_native_wallet() to authenticated;
commit;
