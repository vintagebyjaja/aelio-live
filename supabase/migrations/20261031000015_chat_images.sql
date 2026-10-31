-- Owner-reviewed image capability. Default OFF: no new prices or charges are activated.
begin;
alter table public.app_messages add column if not exists image_file_id uuid references public.app_files(id) on delete set null;
alter table public.app_messages add column if not exists source_image_id uuid references public.app_files(id) on delete set null;
alter table public.app_files add column if not exists parent_file_id uuid references public.app_files(id) on delete set null;
create table if not exists core.image_policy(id boolean primary key default true check(id),enabled boolean not null default false,create_credits integer check(create_credits between 0 and 1000000),edit_credits integer check(edit_credits between 0 and 1000000),included_plans text[] not null default '{}',version integer not null default 1,updated_by uuid references auth.users,updated_at timestamptz not null default now());
insert into core.image_policy(id)values(true)on conflict do nothing;
create table if not exists core.image_jobs(id uuid primary key,owner_id uuid not null references auth.users on delete cascade,conversation_id uuid not null references public.app_conversations on delete cascade,agent_id uuid references public.app_agents on delete set null,fingerprint text not null,prompt text not null,source_image_id uuid references public.app_files on delete set null,aspect text not null,status text not null default 'running' check(status in('running','complete','failed')),credits_charged integer not null,included boolean not null default false,quota_period timestamptz,file_id uuid references public.app_files on delete set null,refunded boolean not null default false,created_at timestamptz not null default now(),finished_at timestamptz);
alter table core.image_policy enable row level security;alter table core.image_jobs enable row level security;
revoke all on core.image_policy,core.image_jobs from public,anon,authenticated,service_role;
create or replace function public.app_image_quote(uid uuid,editing boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare p core.image_policy; cost integer; included boolean; funding text;
begin
 if not exists(select 1 from core.memberships where user_id=uid and product_id='aelio' and status='active')then raise insufficient_privilege;end if;
 select *into p from core.image_policy where id=true;funding:=core.ai_funding(uid,'aelio');
 included:=funding is not null and exists(select 1 from core.ai_subscriptions where user_id=uid and product=funding and status='active' and plan=any(p.included_plans));
 cost:=case when included then 0 when editing then p.edit_credits else p.create_credits end;
 return jsonb_build_object('enabled',p.enabled and cost is not null,'credits',cost,'included',included,'version',p.version,'balance',coalesce((select credits from public.app_entitlements where user_id=uid and product='aelio'),0));
end $$;
create or replace function public.app_image_begin(uid uuid,cid uuid,rid uuid,fingerprint text,prompt text,source uuid,aspect text,agent uuid,quote_version integer,accepted_credits integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.app_conversations;j core.image_jobs;q jsonb;cost integer;n integer;period timestamptz;
begin
 select *into c from public.app_conversations where id=cid and owner_id=uid and product='aelio' for update;if c.id is null then raise insufficient_privilege;end if;
 select *into j from core.image_jobs where id=rid;
 if j.id is not null then if j.owner_id<>uid or j.conversation_id<>cid or j.fingerprint<>app_image_begin.fingerprint then raise insufficient_privilege;end if;return jsonb_build_object('status',j.status,'file_id',j.file_id,'replayed',true);end if;
 if c.busy_until>now()then raise exception 'reply in progress'using errcode='55P03';end if;
 if prompt is null or length(btrim(prompt)) not between 1 and 8000 or aspect is null or aspect not in('square','portrait','landscape') or agent is null or not(agent=any(c.participants)) or not exists(select 1 from public.app_agents where id=agent and owner_id=uid)then raise invalid_parameter_value;end if;
 if source is not null and not exists(select 1 from public.app_files where id=source and owner_id=uid and status='ready' and mime in('image/png','image/jpeg','image/webp') and(expires_at is null or expires_at>now()))then raise insufficient_privilege;end if;
 update public.app_entitlements e set credits=p.monthly_messages,period_start=date_trunc('month',now()) from core.credit_plan_allowances p where e.user_id=uid and e.product='aelio' and e.period_start<date_trunc('month',now()) and p.product='aelio' and e.plan=p.plan;
 q:=public.app_image_quote(uid,source is not null);cost:=(q->>'credits')::integer;
 if quote_version is null or accepted_credits is null or not(q->>'enabled')::boolean or cost is null or cost<>accepted_credits or(q->>'version')::integer<>quote_version then raise exception 'image quote unavailable or changed'using errcode='22023';end if;
 update public.app_entitlements set credits=credits-cost where user_id=uid and product='aelio' and credits>=cost returning credits,period_start into n,period;
 if n is null then raise exception 'insufficient image credits'using errcode='P0001';end if;
 insert into core.chat_requests(id,conversation_id,owner_id,charged,quota_period)values(rid,cid,uid,false,period);
 insert into core.image_jobs(id,owner_id,conversation_id,agent_id,fingerprint,prompt,source_image_id,aspect,credits_charged,included,quota_period)values(rid,uid,cid,agent,app_image_begin.fingerprint,app_image_begin.prompt,source,app_image_begin.aspect,cost,(q->>'included')::boolean,period);
 update public.app_conversations set busy_until=now()+interval '10 minutes'where id=cid;
 return jsonb_build_object('status','running','replayed',false,'credits',cost);
end $$;
create or replace function public.app_image_finish(rid uuid,ok boolean,fid uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare j core.image_jobs;a record;
begin
 select *into j from core.image_jobs where id=rid for update;if j.id is null or j.status<>'running'then return;end if;
 if ok then
  if not exists(select 1 from core.chat_requests where id=rid and status='running')or not exists(select 1 from public.app_files where id=fid and owner_id=j.owner_id and conversation_id=j.conversation_id and status='ready' and category='generated-assets')then raise insufficient_privilege;end if;
  -- A confirmed allowance quote is a member ceiling; excess actual provider cost remains a platform expense.
  for a in select invoice_id,sum(greatest(0,cost_usd-reserved_usd)) excess from core.ai_attempts where request_id=rid and status='settled' and invoice_id is not null group by invoice_id loop
   update core.ai_allocations set spent_usd=greatest(0,spent_usd-a.excess)where invoice_id=a.invoice_id;
  end loop;
  insert into public.app_messages(conversation_id,role,content,request_id)values(j.conversation_id,'user',j.prompt,rid);
  insert into public.app_messages(conversation_id,agent_id,speaker,role,content,request_id,image_file_id,source_image_id)select j.conversation_id,j.agent_id,name,'assistant','Your image is ready.',rid,fid,j.source_image_id from public.app_agents where id=j.agent_id;
  update core.image_jobs set status='complete',file_id=fid,finished_at=now()where id=rid;
 else
  update public.app_entitlements set credits=credits+j.credits_charged where user_id=j.owner_id and product='aelio' and period_start is not distinct from j.quota_period;
  -- Failed/uncertain calls remain platform costs in the existing ledger, but do not spend the member's allowance.
  perform pg_catalog.pg_advisory_xact_lock(713001);
  for a in select id,reserved_usd from core.ai_attempts where request_id=rid and status<>'settled' loop
   perform public.app_ai_settle(a.id,a.reserved_usd,'image_abandoned',null,null,null,true);
  end loop;
  for a in select invoice_id,sum(cost_usd) cost from core.ai_attempts where request_id=rid and status='settled' and invoice_id is not null group by invoice_id loop
   update core.ai_allocations set spent_usd=greatest(0,spent_usd-a.cost)where invoice_id=a.invoice_id;
  end loop;
  update core.image_jobs set status='failed',refunded=true,finished_at=now()where id=rid;
 end if;
 perform public.app_finish_chat(rid,ok);
end $$;
create or replace function public.app_image_status(uid uuid,rid uuid)returns jsonb language sql stable security definer set search_path='' as $$select jsonb_build_object('status',status,'file_id',file_id,'refunded',refunded)from core.image_jobs where id=rid and owner_id=uid$$;
create or replace function public.app_image_expire()returns void language plpgsql security definer set search_path='' as $$declare j record;begin for j in select id from core.image_jobs where status='running'and created_at<now()-interval '15 minutes' loop perform public.app_image_finish(j.id,false);end loop;end $$;
create or replace function public.app_image_policy(uid uuid,settings jsonb default null)returns jsonb language plpgsql security definer set search_path='' as $$declare p core.image_policy;begin
 if not exists(select 1 from core.app_roles where user_id=uid and product='aelio'and role='founder')then raise insufficient_privilege;end if;
 if settings is not null then
  if jsonb_typeof(settings)<>'object' or exists(select 1 from jsonb_object_keys(settings) k where k not in('enabled','create_credits','edit_credits','included_plans'))then raise invalid_parameter_value;end if;
  update core.image_policy set enabled=coalesce((settings->>'enabled')::boolean,enabled),create_credits=case when settings?'create_credits'then(settings->>'create_credits')::integer else create_credits end,edit_credits=case when settings?'edit_credits'then(settings->>'edit_credits')::integer else edit_credits end,included_plans=case when settings?'included_plans'then array(select jsonb_array_elements_text(settings->'included_plans'))else included_plans end,version=version+1,updated_by=uid,updated_at=now()where id=true;
  insert into public.app_audit(owner_id,action)values(uid,'images.policy_updated');
 end if;
 select *into p from core.image_policy where id=true;return to_jsonb(p);
end $$;
revoke all on function public.app_image_quote(uuid,boolean),public.app_image_begin(uuid,uuid,uuid,text,text,uuid,text,uuid,integer,integer),public.app_image_finish(uuid,boolean,uuid),public.app_image_status(uuid,uuid),public.app_image_expire(),public.app_image_policy(uuid,jsonb)from public,anon,authenticated;
grant execute on function public.app_image_quote(uuid,boolean),public.app_image_begin(uuid,uuid,uuid,text,text,uuid,text,uuid,integer,integer),public.app_image_finish(uuid,boolean,uuid),public.app_image_status(uuid,uuid),public.app_image_expire(),public.app_image_policy(uuid,jsonb)to service_role;
-- Extend the existing founder-only router settings, reusing its keys and audit trail.
create or replace function public.app_ai_update_router_config(uid uuid,settings jsonb)returns void language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from core.app_roles where user_id=uid and product='aelio'and role='founder')then raise insufficient_privilege;end if;
 if jsonb_typeof(settings)<>'object' or exists(select 1 from jsonb_object_keys(settings)k where k!~'^(AELIO_(IMAGE_PRIMARY_PROVIDER|PRIMARY_PROVIDER|SECONDARY_PROVIDER|EMERGENCY_PROVIDER|DAILY_AI_BUDGET_USD|MONTHLY_AI_BUDGET_USD|OPENAI_EMERGENCY_BUDGET_USD|(GEMINI|GROQ|OPENAI)_ENABLED)|(GEMINI|GROQ|OPENAI)_(MODEL|COMPLEX_MODEL|(COMPLEX_)?(INPUT|OUTPUT)_USD_PER_MILLION|TIMEOUT_MS|DAILY_BUDGET_USD|MONTHLY_BUDGET_USD)|(GEMINI|OPENAI)_IMAGE_(MODEL|MAX_COST_USD|INPUT_USD_PER_MILLION|OUTPUT_USD_PER_MILLION))$')then raise invalid_parameter_value;end if;
 update core.ai_router_settings set settings=app_ai_update_router_config.settings,updated_by=uid,updated_at=now()where id=true;
 insert into public.app_audit(owner_id,action)values(uid,'ai.router_settings_updated');
end $$;

-- Capability questions do not call a provider or charge credits.
create or replace function public.app_image_explain(uid uuid,cid uuid,rid uuid,input text,answer text)returns void language plpgsql security definer set search_path='' as $$declare c public.app_conversations;r core.chat_requests;begin
 select *into c from public.app_conversations where id=cid and owner_id=uid for update;
 if c.id is null or not exists(select 1 from core.memberships where user_id=uid and product_id=c.product and status='active')then raise insufficient_privilege;end if;
 select *into r from core.chat_requests where id=rid;if r.id is not null then if r.owner_id is distinct from uid or r.conversation_id<>cid then raise insufficient_privilege;end if;return;end if;
 if c.busy_until>now()then raise exception 'reply in progress'using errcode='55P03';end if;
 insert into core.chat_requests(id,conversation_id,owner_id,charged)values(rid,cid,uid,false);
 perform public.app_commit_chat(rid,input,jsonb_build_array(jsonb_build_object('agent_id',c.participants[1],'speaker',(select name from public.app_agents where id=c.participants[1]),'content',answer)));
end $$;
revoke all on function public.app_image_explain(uuid,uuid,uuid,text,text)from public,anon,authenticated;
grant execute on function public.app_image_explain(uuid,uuid,uuid,text,text)to service_role;

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
 -- Image actions use exactly one member funding path: included allowance OR approved credits.
 override:=override or exists(select 1 from core.image_jobs j where j.id=rid and j.owner_id=uid and not j.included);
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
 return jsonb_build_object('attempt_id',attempt,'funding_source',case when exists(select 1 from core.image_jobs j where j.id=rid and j.owner_id=uid and not j.included)then 'credits' when override then 'unlimited'else coalesce(funding,'free')end);
end $$;

commit;
