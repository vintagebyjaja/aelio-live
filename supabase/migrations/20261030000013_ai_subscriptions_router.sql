-- Review only. Apply manually after 12. No subscription is created, charged, upgraded or backfilled.
begin;
create table if not exists core.ai_policy(id boolean primary key default true check(id),allocation_ratio numeric not null default .60 check(allocation_ratio between 0 and 1),minimum_usd numeric not null default 10 check(minimum_usd>=0),rollover_enabled boolean not null default false);
insert into core.ai_policy(id) values(true) on conflict do nothing;
create table if not exists core.ai_plan_prices(price_id text primary key,product text not null references core.products(id),plan text not null);
create table if not exists core.ai_subscriptions(
 id text primary key,user_id uuid not null references auth.users(id),product text not null references core.products(id),plan text not null,price_id text not null,
 status text not null default 'pending',paid_until timestamptz,updated_event_at bigint not null default 0,created_at timestamptz not null default now(),
 check(product<>'pathd' or plan in ('plus','pro','local','employer','recruiter')));
create table if not exists core.ai_billing_events(id text primary key,kind text not null,created_at bigint not null,result jsonb not null default '{}');
create table if not exists core.ai_allocations(
 invoice_id text primary key,billing_invoice text not null,subscription_id text not null references core.ai_subscriptions(id),user_id uuid not null references auth.users(id),product text not null,plan text not null,
 starts_at timestamptz not null,ends_at timestamptz not null,paid_usd numeric not null check(paid_usd>0),budget_usd numeric not null check(budget_usd>=0),
 subsidy_usd numeric not null default 0,rollover_usd numeric not null default 0,rollover_applied boolean not null default false,spent_usd numeric not null default 0 check(spent_usd>=0),held_usd numeric not null default 0 check(held_usd>=0),refunded_usd numeric not null default 0,revoked boolean not null default false,check(ends_at>starts_at));
create table if not exists core.ai_attempts(
 id uuid primary key,request_id uuid not null,user_id uuid references auth.users(id),product text not null,funding_product text,invoice_id text references core.ai_allocations(invoice_id),
 provider text not null check(provider in ('gemini','groq','openai')),model text not null,reserved_usd numeric not null check(reserved_usd>0),cost_usd numeric not null default 0,
 status text not null default 'reserved' check(status in ('reserved','settled','uncertain')),outcome text,latency_ms integer,input_tokens integer,output_tokens integer,estimated boolean not null default false,
 created_at timestamptz not null default now());
create index if not exists ai_attempts_period on core.ai_attempts(created_at,provider);
create index if not exists ai_allocation_owner on core.ai_allocations(user_id,product,ends_at);
-- SQL owner binds a verified existing subscription to its verified Auth UUID; no browser/metadata grants.
create or replace function core.bind_ai_subscription(sid text,uid uuid,product_scope text,plan_name text,verified_price_id text) returns void
language plpgsql security definer set search_path='' as $$ begin
 if uid is null or length(sid)<3 or length(verified_price_id)<3 or plan_name='free' then raise invalid_parameter_value;end if;
 insert into core.ai_plan_prices values(verified_price_id,product_scope,plan_name)on conflict do nothing;
 insert into core.ai_subscriptions(id,user_id,product,plan,price_id) values(sid,uid,product_scope,plan_name,verified_price_id) on conflict(id) do nothing;
 if not exists(select 1 from core.ai_subscriptions where id=sid and user_id=uid and product=product_scope and plan=plan_name and price_id=verified_price_id)then raise exception 'binding_conflict';end if;
end $$;
revoke all on function core.bind_ai_subscription(text,uuid,text,text,text) from public,anon,authenticated,service_role;

create or replace function public.app_ai_billing_event(eid text,kind text,event_time bigint,sid text,invoice text default null,amount_usd numeric default null,period_start timestamptz default null,period_end timestamptz default null,price text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s core.ai_subscriptions; b numeric:=0; ratio numeric; minimum numeric; months integer; part integer; start_at timestamptz; end_at timestamptz; portion numeric; paid_total numeric; refund_ratio numeric;
begin
 perform pg_catalog.pg_advisory_xact_lock(713001);
 if exists(select 1 from core.ai_billing_events where id=eid)then return jsonb_build_object('duplicate',true);end if;
 select * into s from core.ai_subscriptions where id=sid for update;
 if s.id is null then raise exception 'subscription_mapping_required' using errcode='22023';end if;
 if kind='paid' then
  if invoice is null or amount_usd is null or amount_usd<=0 or period_start is null or period_end is null or period_end<=period_start or not exists(select 1 from core.ai_plan_prices where price_id=price and product=s.product) then raise invalid_parameter_value;end if;
  select plan into s.plan from core.ai_plan_prices where price_id=price;
  update core.ai_subscriptions set plan=s.plan,price_id=price where id=sid and updated_event_at<=event_time;
  select allocation_ratio,minimum_usd into ratio,minimum from core.ai_policy where id=true;
  months:=greatest(1,least(60,round(extract(epoch from(period_end-period_start))/2629800)::integer));
  portion:=amount_usd/months;
  for part in 0..months-1 loop
   start_at:=period_start+part*interval '1 month';end_at:=case when part=months-1 then period_end else least(period_end,period_start+(part+1)*interval '1 month')end;
   if end_at<=start_at then raise invalid_parameter_value;end if;
   b:=0;if s.product='aelio' or s.plan in ('pro','local','employer','recruiter')then b:=greatest(minimum,portion*ratio);end if;
   insert into core.ai_allocations(invoice_id,billing_invoice,subscription_id,user_id,product,plan,starts_at,ends_at,paid_usd,budget_usd,subsidy_usd)
    values(case when months=1 then invoice else invoice||'#'||part end,invoice,sid,s.user_id,s.product,s.plan,start_at,end_at,portion,b,greatest(0,b-portion*ratio)) on conflict(invoice_id)do nothing;
  end loop;
  update core.ai_subscriptions set status='active',paid_until=greatest(coalesce(paid_until,period_end),period_end),updated_event_at=event_time where id=sid and updated_event_at<=event_time;
 elsif kind in ('failed','canceled','expired','suspended') then
  update core.ai_subscriptions set status=kind,updated_event_at=event_time where id=sid and updated_event_at<=event_time;
 elsif kind='cancel_scheduled' then
  update core.ai_subscriptions set status='active',updated_event_at=event_time where id=sid and updated_event_at<=event_time;
 elsif kind='refund' then
  if invoice is null or amount_usd is null or amount_usd<0 then raise invalid_parameter_value;end if;
  -- Cumulative Stripe refunds proportionally reduce every monthly slice, including future slices.
  select sum(paid_usd)into paid_total from core.ai_allocations where billing_invoice=invoice and subscription_id=sid;
  if paid_total is null then raise invalid_parameter_value;end if;
  refund_ratio:=least(1,amount_usd/paid_total);
  update core.ai_allocations set budget_usd=case when refund_ratio>=1 then 0 else greatest(0,budget_usd*(1-refund_ratio)/nullif(1-refunded_usd/paid_usd,0))end,
   refunded_usd=paid_usd*refund_ratio,revoked=refund_ratio>=1 where billing_invoice=invoice and subscription_id=sid and paid_usd*refund_ratio>refunded_usd;
  update core.ai_subscriptions set status='refunded' where id=sid and exists(select 1 from core.ai_allocations where billing_invoice=invoice and revoked and ends_at>=core.ai_subscriptions.paid_until);
 else raise invalid_parameter_value;end if;
 insert into core.ai_billing_events values(eid,kind,event_time,jsonb_build_object('subscription',sid));
 return jsonb_build_object('ok',true);
end $$;

create or replace function core.ai_funding(uid uuid,product_scope text) returns text
language sql stable security definer set search_path='' as $$
 select s.product from core.ai_subscriptions s where s.user_id=uid and s.status='active' and s.paid_until>now()
 and exists(select 1 from core.ai_allocations al where al.subscription_id=s.id and al.starts_at<=now()and al.ends_at>now()and not al.revoked and al.paid_usd>al.refunded_usd)
 and ((product_scope='aelio' and s.product='aelio')or(product_scope='pathd' and (s.product='aelio' or(s.product='pathd' and s.plan in ('pro','local','employer','recruiter')))))
 order by case when s.product='aelio' then 0 else 1 end,s.paid_until desc limit 1
$$;
create or replace function public.app_ai_access(uid uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'companion_access',core.ai_funding(uid,'pathd') is not null or exists(select 1 from core.message_credit_overrides where user_id=uid and product='pathd' and unlimited),
 'funding_source',case when exists(select 1 from core.message_credit_overrides where user_id=uid and product='pathd' and unlimited)then 'unlimited' else core.ai_funding(uid,'pathd')end,
 'pathd_plus',exists(select 1 from core.ai_subscriptions where user_id=uid and product='pathd' and status='active' and paid_until>now() and plan in ('plus','pro','local','employer','recruiter')and exists(select 1 from core.ai_allocations al where al.subscription_id=core.ai_subscriptions.id and al.starts_at<=now()and al.ends_at>now()and not al.revoked and al.paid_usd>al.refunded_usd)),
 'pathd_pro',exists(select 1 from core.ai_subscriptions where user_id=uid and product='pathd' and status='active' and paid_until>now() and plan in ('pro','local','employer','recruiter')and exists(select 1 from core.ai_allocations al where al.subscription_id=core.ai_subscriptions.id and al.starts_at<=now()and al.ends_at>now()and not al.revoked and al.paid_usd>al.refunded_usd)),
 'subscriptions',coalesce((select jsonb_agg(jsonb_build_object('product',product,'plan',plan,'status',case when paid_until<=now()then 'expired'else status end,'paid_until',paid_until))from core.ai_subscriptions where user_id=uid),'[]'),
 'allowances',coalesce((select jsonb_agg(jsonb_build_object('product',a.product,'plan',a.plan,'allocated_usd',a.budget_usd,'used_usd',a.spent_usd,'remaining_usd',greatest(0,a.budget_usd-a.spent_usd-a.held_usd),'period_start',a.starts_at,'period_end',a.ends_at,'next_replenishment','after successful payment'))from core.ai_allocations a join core.ai_subscriptions s on s.id=a.subscription_id where a.user_id=uid and a.starts_at<=now() and a.ends_at>now() and not a.revoked and s.status='active'),'[]'))
$$;

create or replace function public.app_ai_reserve(attempt uuid,rid uuid,uid uuid,product_scope text,provider_name text,model_name text,reserve_usd numeric,daily_limit numeric,monthly_limit numeric,emergency_limit numeric,provider_daily_limit numeric default null,provider_monthly_limit numeric default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare funding text; a core.ai_allocations; prior core.ai_allocations; carry numeric; spent numeric; emergency numeric; override boolean;
begin
 if reserve_usd is null or reserve_usd<=0 or daily_limit is null or monthly_limit is null or daily_limit<=0 or monthly_limit<=0 or emergency_limit is null or emergency_limit<0 then raise invalid_parameter_value;end if;
 perform pg_catalog.pg_advisory_xact_lock(713001);
 if exists(select 1 from core.ai_attempts where id=attempt)then raise exception 'attempt_reused' using errcode='23505';end if;
 -- The logical chat reservation must exist and match the trusted user/product before any provider call.
 if not exists(select 1 from core.chat_requests r join public.app_conversations c on c.id=r.conversation_id where r.id=rid and r.status='running' and r.owner_id is not distinct from uid and c.product=product_scope)then raise insufficient_privilege;end if;
 select coalesce(sum(case when status='settled'then cost_usd else reserved_usd end),0)into spent from core.ai_attempts where created_at>=date_trunc('day',now());
 if spent+reserve_usd>daily_limit then raise exception 'platform_daily_budget' using errcode='P0001';end if;
 select coalesce(sum(case when status='settled'then cost_usd else reserved_usd end),0)into spent from core.ai_attempts where created_at>=date_trunc('month',now());
 if spent+reserve_usd>monthly_limit then raise exception 'platform_monthly_budget' using errcode='P0001';end if;
 select coalesce(sum(case when status='settled'then cost_usd else reserved_usd end),0)into spent from core.ai_attempts where provider=provider_name and created_at>=date_trunc('day',now());
 if spent+reserve_usd>coalesce(provider_daily_limit,daily_limit)then raise exception 'provider_daily_budget'using errcode='P0001';end if;
 select coalesce(sum(case when status='settled'then cost_usd else reserved_usd end),0)into spent from core.ai_attempts where provider=provider_name and created_at>=date_trunc('month',now());
 if spent+reserve_usd>coalesce(provider_monthly_limit,monthly_limit)then raise exception 'provider_monthly_budget'using errcode='P0001';end if;
 if provider_name='openai'then
  select coalesce(sum(case when status='settled'then cost_usd else reserved_usd end),0)into emergency from core.ai_attempts where provider='openai' and created_at>=date_trunc('month',now());
  if emergency+reserve_usd>emergency_limit then raise exception 'emergency_budget' using errcode='P0001';end if;
 end if;
 override:=exists(select 1 from core.message_credit_overrides where user_id=uid and product=product_scope and unlimited);
 funding:=case when override then null else core.ai_funding(uid,product_scope)end;
 if product_scope='pathd' and uid is not null and funding is null and not override then raise insufficient_privilege;end if;
 if funding is not null then
  -- Exactly one current invoice/balance; visiting another app cannot mint an allowance.
  select al.* into a from core.ai_allocations al join core.ai_subscriptions s on s.id=al.subscription_id where al.user_id=uid and al.product=funding and al.starts_at<=now() and al.ends_at>now() and not al.revoked and s.status='active' order by al.starts_at desc,al.invoice_id limit 1 for update of al;
  if a.invoice_id is not null and not a.rollover_applied then
   if(select rollover_enabled from core.ai_policy where id=true)then
    select *into prior from core.ai_allocations where subscription_id=a.subscription_id and ends_at<=a.starts_at and not revoked order by ends_at desc limit 1 for update;
    carry:=greatest(0,coalesce(prior.budget_usd-prior.spent_usd-prior.held_usd,0));
    if carry>0 then update core.ai_allocations set budget_usd=budget_usd-carry where invoice_id=prior.invoice_id;update core.ai_allocations set budget_usd=budget_usd+carry,rollover_usd=carry where invoice_id=a.invoice_id;a.budget_usd:=a.budget_usd+carry;end if;
   end if;
   update core.ai_allocations set rollover_applied=true where invoice_id=a.invoice_id;
  end if;
  if a.invoice_id is null or a.spent_usd+a.held_usd+reserve_usd>a.budget_usd then raise exception 'subscriber_budget' using errcode='P0001';end if;
  -- Dynamic per-user daily protection; unused capacity remains in the monthly balance.
  select coalesce(sum(case when status='settled'then cost_usd else reserved_usd end),0)into spent from core.ai_attempts where user_id=uid and invoice_id=a.invoice_id and created_at>=date_trunc('day',now());
  if spent+reserve_usd>greatest(reserve_usd,(a.budget_usd-a.spent_usd-a.held_usd)/greatest(1,ceil(extract(epoch from(a.ends_at-now()))/86400))*2)then raise exception 'subscriber_daily_budget' using errcode='P0001';end if;
  update core.ai_allocations set held_usd=held_usd+reserve_usd where invoice_id=a.invoice_id;
 end if;
 insert into core.ai_attempts(id,request_id,user_id,product,funding_product,invoice_id,provider,model,reserved_usd)values(attempt,rid,uid,product_scope,funding,a.invoice_id,provider_name,model_name,reserve_usd);
 return jsonb_build_object('attempt_id',attempt,'funding_source',case when override then 'unlimited'else coalesce(funding,'free')end);
end $$;
create or replace function public.app_ai_settle(attempt uuid,actual_usd numeric,result text,latency integer default null,in_tokens integer default null,out_tokens integer default null,is_estimated boolean default false) returns void
language plpgsql security definer set search_path='' as $$ declare r core.ai_attempts;begin
 perform pg_catalog.pg_advisory_xact_lock(713001);select *into r from core.ai_attempts where id=attempt for update;
 if r.id is null or r.status='settled'then return;end if;
 if actual_usd is null or actual_usd<0 then raise invalid_parameter_value;end if;
 -- Unknown/ambiguous requests retain the full conservative reservation as a cost estimate.
 update core.ai_attempts set status='settled',cost_usd=actual_usd,outcome=left(result,80),latency_ms=latency,input_tokens=in_tokens,output_tokens=out_tokens,estimated=is_estimated where id=attempt;
 if r.invoice_id is not null then update core.ai_allocations set held_usd=greatest(0,held_usd-r.reserved_usd),spent_usd=spent_usd+actual_usd where invoice_id=r.invoice_id;end if;
end $$;
-- New financial tables are inaccessible to browsers; service access only through scoped functions.
alter table core.ai_plan_prices enable row level security;alter table core.ai_policy enable row level security;alter table core.ai_subscriptions enable row level security;alter table core.ai_billing_events enable row level security;alter table core.ai_allocations enable row level security;alter table core.ai_attempts enable row level security;
revoke all on core.ai_plan_prices,core.ai_policy,core.ai_subscriptions,core.ai_billing_events,core.ai_allocations,core.ai_attempts from public,anon,authenticated,service_role;
revoke all on function core.ai_funding(uuid,text)from public,anon,authenticated,service_role;
revoke all on function public.app_ai_billing_event(text,text,bigint,text,text,numeric,timestamptz,timestamptz,text),public.app_ai_access(uuid),public.app_ai_reserve(uuid,uuid,uuid,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric),public.app_ai_settle(uuid,numeric,text,integer,integer,integer,boolean)from public,anon,authenticated;
grant execute on function public.app_ai_billing_event(text,text,bigint,text,text,numeric,timestamptz,timestamptz,text),public.app_ai_access(uuid),public.app_ai_reserve(uuid,uuid,uuid,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric),public.app_ai_settle(uuid,numeric,text,integer,integer,integer,boolean)to service_role;
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
 if core.ai_funding(uid,c.product) is not null or exists(select 1 from core.message_credit_overrides where user_id=uid and product=c.product and unlimited) then n:=2147483647; was_charged:=false; else
 update public.app_entitlements set credits=credits-1 where user_id=uid and product=c.product and credits>0 returning credits into n;
 end if;
 end if;
 if uid is not null then select period_start into qperiod from public.app_entitlements where user_id=uid and product=c.product; end if;
 if n is null then raise exception 'message limit reached' using errcode='P0001'; end if;
 update public.app_conversations set busy_until=now()+interval '10 minutes',updated_at=now() where id=cid;
 insert into core.chat_requests(id,conversation_id,owner_id,charged,quota_period) values(rid,cid,uid,was_charged,qperiod);
 return n;
end $$;

create or replace function public.app_ai_invoice_subscription(invoice text)returns text language sql stable security definer set search_path='' as $$select subscription_id from core.ai_allocations where billing_invoice=invoice limit 1$$;
create or replace function public.app_ai_operations(uid uuid)returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not exists(select 1 from core.app_roles where user_id=uid and product='aelio'and role='founder')then raise insufficient_privilege;end if;
 return jsonb_build_object('providers',coalesce((select jsonb_agg(to_jsonb(t))from(select provider,count(*)requests,count(*)filter(where outcome<>'complete')failures,round(avg(latency_ms))average_latency_ms,sum(cost_usd)cost_usd,sum(reserved_usd)filter(where status<>'settled')pending_usd,count(*)filter(where estimated)estimated_attempts from core.ai_attempts where created_at>=date_trunc('month',now())group by provider)t),'[]'),
 'allocation',coalesce((select jsonb_agg(to_jsonb(t))from(select user_id,product,plan,paid_usd,budget_usd,spent_usd,held_usd,subsidy_usd,ends_at from core.ai_allocations where ends_at>now()order by ends_at desc limit 200)t),'[]'),
 'daily_usd',(select coalesce(sum(cost_usd),0)from core.ai_attempts where created_at>=date_trunc('day',now())),
 'monthly_usd',(select coalesce(sum(cost_usd),0)from core.ai_attempts where created_at>=date_trunc('month',now())),
 'fallbacks',(select count(*)from(select request_id from core.ai_attempts where created_at>=date_trunc('month',now())group by request_id having count(distinct provider)>1)t));
end $$;
revoke all on function public.app_ai_invoice_subscription(text),public.app_ai_operations(uuid)from public,anon,authenticated;
grant execute on function public.app_ai_invoice_subscription(text),public.app_ai_operations(uuid)to service_role;

create table if not exists core.ai_router_settings(id boolean primary key default true check(id),settings jsonb not null default '{}',updated_by uuid references auth.users(id),updated_at timestamptz not null default now());
insert into core.ai_router_settings(id)values(true)on conflict do nothing;
alter table core.ai_router_settings enable row level security;
revoke all on core.ai_router_settings from public,anon,authenticated,service_role;
create or replace function public.app_ai_router_config()returns jsonb language sql stable security definer set search_path='' as $$select settings from core.ai_router_settings where id=true$$;
create or replace function public.app_ai_update_router_config(uid uuid,settings jsonb)returns void language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from core.app_roles where user_id=uid and product='aelio'and role='founder')then raise insufficient_privilege;end if;
 if jsonb_typeof(settings)<>'object' or exists(select 1 from jsonb_object_keys(settings)k where k!~'^(AELIO_(PRIMARY_PROVIDER|SECONDARY_PROVIDER|EMERGENCY_PROVIDER|DAILY_AI_BUDGET_USD|MONTHLY_AI_BUDGET_USD|OPENAI_EMERGENCY_BUDGET_USD|(GEMINI|GROQ|OPENAI)_ENABLED)|(GEMINI|GROQ|OPENAI)_(MODEL|COMPLEX_MODEL|(COMPLEX_)?(INPUT|OUTPUT)_USD_PER_MILLION|TIMEOUT_MS|DAILY_BUDGET_USD|MONTHLY_BUDGET_USD))$')then raise invalid_parameter_value;end if;
 update core.ai_router_settings set settings=app_ai_update_router_config.settings,updated_by=uid,updated_at=now()where id=true;
 insert into public.app_audit(owner_id,action)values(uid,'ai.router_settings_updated');
end $$;
revoke all on function public.app_ai_router_config(),public.app_ai_update_router_config(uuid,jsonb)from public,anon,authenticated;
grant execute on function public.app_ai_router_config(),public.app_ai_update_router_config(uuid,jsonb)to service_role;
-- Recent approved ECHO text only; Worker selects relevant excerpts within this bounded set.
create or replace function public.app_echo_context(uid uuid,echo uuid)returns table(kind text,content text)
language sql stable security definer set search_path='' as $$select m.kind,m.content from public.app_echo_memories m join public.app_echo_profiles p on p.agent_id=m.echo_id where m.echo_id=echo and m.owner_id=uid and p.owner_id=uid and p.memories_enabled and m.status='approved'and m.kind<>'photo'order by m.created_at desc,m.id desc limit 60$$;
-- Prepare deletion before touching R2: photo references cannot become invalid orphan records.
create or replace function public.app_prepare_file_deletion(uid uuid,fid uuid)returns void language plpgsql security definer set search_path='' as $$begin
 perform 1 from public.app_files where id=fid and owner_id=uid for update;if not found then raise insufficient_privilege;end if;
 delete from public.app_echo_memories where file_id=fid and owner_id=uid and kind='photo';
 update public.app_files set status='deleting'where id=fid and owner_id=uid;
end $$;
create or replace function public.app_remove_echo_photo_reference()returns trigger language plpgsql security definer set search_path='' as $$begin delete from public.app_echo_memories where file_id=old.id and kind='photo';return old;end $$;
drop trigger if exists app_remove_echo_photo_reference on public.app_files;
create trigger app_remove_echo_photo_reference before delete on public.app_files for each row execute function public.app_remove_echo_photo_reference();
revoke all on function public.app_prepare_file_deletion(uuid,uuid),public.app_remove_echo_photo_reference()from public,anon,authenticated;
grant execute on function public.app_prepare_file_deletion(uuid,uuid)to service_role;
commit;
