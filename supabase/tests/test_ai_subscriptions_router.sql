-- Synthetic local data only. Roll back everything.
begin;
insert into auth.users(id,email)values('a1111111-1111-4111-8111-111111111111','ai-owner@local.test'),('b2222222-2222-4222-8222-222222222222','ai-other@local.test');
insert into core.memberships(user_id,product_id)values('a1111111-1111-4111-8111-111111111111','aelio'),('a1111111-1111-4111-8111-111111111111','pathd')on conflict do nothing;
insert into public.app_entitlements(user_id,product)values('a1111111-1111-4111-8111-111111111111','aelio'),('a1111111-1111-4111-8111-111111111111','pathd')on conflict do nothing;
select core.bind_ai_subscription('sub-aelio','a1111111-1111-4111-8111-111111111111','aelio','adapt','price-aelio');
select core.bind_ai_subscription('sub-pathd','a1111111-1111-4111-8111-111111111111','pathd','plus','price-plus');
select public.app_ai_billing_event('evt-1','paid',1,'sub-aelio','invoice-1',20,now()-interval '1 day',now()+interval '29 days','price-aelio');
select public.app_ai_billing_event('evt-1','paid',1,'sub-aelio','invoice-1',20,now()-interval '1 day',now()+interval '29 days','price-aelio');
select public.app_ai_billing_event('evt-2','paid',2,'sub-pathd','invoice-2',5.99,now()-interval '1 day',now()+interval '29 days','price-plus');
do $$declare d jsonb;begin
 if(select budget_usd from core.ai_allocations where invoice_id='invoice-1')<>12 then raise exception '60 percent failed';end if;
 if(select count(*)from core.ai_allocations)<>2 then raise exception 'duplicate payment created allowance';end if;
 if(select budget_usd from core.ai_allocations where invoice_id='invoice-2')<>0 then raise exception 'PATHD+ incorrectly funded';end if;
 d:=public.app_ai_access('a1111111-1111-4111-8111-111111111111');
 if not(d->>'companion_access')::boolean or d->>'funding_source'<>'aelio' or not(d->>'pathd_plus')::boolean or(d->>'pathd_pro')::boolean then raise exception 'independent access failed';end if;
 if(public.app_ai_access('b2222222-2222-4222-8222-222222222222')->>'companion_access')::boolean then raise exception 'cross user entitlement';end if;
 raise notice 'B1 paid allocation, idempotent replenishment, PATHD+ exclusion, AELIO-funded PATHD, isolated permissions: pass';
end $$;
-- Pro upgrades use an owner-configured price mapping; no client metadata.
insert into core.ai_plan_prices values('price-pro','pathd','pro');
select public.app_ai_billing_event('evt-3','paid',3,'sub-pathd','invoice-3',16,now(),now()+interval '1 month','price-pro');
do $$begin
 if(select budget_usd from core.ai_allocations where invoice_id='invoice-3')<>10 then raise exception 'minimum failed';end if;
 if(select subsidy_usd from core.ai_allocations where invoice_id='invoice-3')<>.4 then raise exception 'subsidy attribution failed';end if;
 if not(public.app_ai_access('a1111111-1111-4111-8111-111111111111')->>'pathd_pro')::boolean then raise exception 'upgrade failed';end if;
 raise notice 'B2 upgrade mapping and $10 minimum/subsidy: pass';
end $$;
-- One paid chat does not also deduct the legacy message balance.
insert into public.app_conversations(id,owner_id,product,title)values('c3333333-3333-4333-8333-333333333333','a1111111-1111-4111-8111-111111111111','pathd','Budget test');
select public.app_reserve_chat('c3333333-3333-4333-8333-333333333333','a1111111-1111-4111-8111-111111111111',null,10,'d4444444-4444-4444-8444-444444444444');
select public.app_ai_reserve('e5555555-5555-4555-8555-555555555555','d4444444-4444-4444-8444-444444444444','a1111111-1111-4111-8111-111111111111','pathd','gemini','fixture',.01,5,20,2);
select public.app_ai_settle('e5555555-5555-4555-8555-555555555555',.005,'complete',100,10,5,false);
select public.app_ai_settle('e5555555-5555-4555-8555-555555555555',.005,'complete',100,10,5,false);
do $$begin
 if(select credits from public.app_entitlements where user_id='a1111111-1111-4111-8111-111111111111'and product='pathd')<>100 then raise exception 'double debit legacy';end if;
 if(select spent_usd from core.ai_allocations where invoice_id='invoice-1')<>.005 then raise exception 'settlement duplicate or wrong balance';end if;
 if(select spent_usd from core.ai_allocations where invoice_id='invoice-3')<>0 then raise exception 'PATHD balance incorrectly debited';end if;
 begin perform public.app_ai_reserve('f6666666-6666-4666-8666-666666666666','d4444444-4444-4444-8444-444444444444','a1111111-1111-4111-8111-111111111111','pathd','openai','fixture',1,5,20,0);raise exception 'emergency cap bypass';exception when raise_exception then if sqlerrm='emergency cap bypass'then raise;end if;end;
 begin perform public.app_ai_reserve('f6666666-6666-4666-8666-666666666666','d4444444-4444-4444-8444-444444444444','b2222222-2222-4222-8222-222222222222','pathd','groq','fixture',.01,5,20,2);raise exception 'forged owner accepted';exception when insufficient_privilege then null;end;
 raise notice 'B3 one balance, atomic reservation, idempotent settlement, emergency cap and forged owner rejection: pass';
end $$;
select public.app_ai_billing_event('evt-4','failed',4,'sub-pathd');
select public.app_ai_billing_event('evt-stale','paid',2,'sub-pathd','invoice-old',16,now()-interval '2 months',now()-interval '1 month','price-pro');
do $$begin
 if(public.app_ai_access('a1111111-1111-4111-8111-111111111111')->>'pathd_pro')::boolean then raise exception 'failed payment/stale event restored access';end if;
 raise notice 'B4 failed payment and out-of-order lifecycle protection: pass';
end $$;
select public.app_ai_billing_event('evt-refund','refund',5,'sub-aelio','invoice-1',20);
do $$begin
 if(public.app_ai_access('a1111111-1111-4111-8111-111111111111')->>'companion_access')::boolean then raise exception 'refunded access not revoked';end if;
 raise notice 'B5 full refund revokes entitlement without deleting data: pass';
end $$;
select core.bind_ai_subscription('sub-annual','b2222222-2222-4222-8222-222222222222','pathd','pro','price-pro');
select public.app_ai_billing_event('evt-annual','paid',10,'sub-annual','invoice-annual',99,now(),now()+interval '1 year','price-pro');
do $$begin
 if(select count(*)from core.ai_allocations where billing_invoice='invoice-annual')<>12 then raise exception 'annual monthly slicing failed';end if;
 if(select sum(paid_usd)from core.ai_allocations where billing_invoice='invoice-annual')<>99 then raise exception 'annual revenue duplication';end if;
 if(select min(budget_usd)from core.ai_allocations where billing_invoice='invoice-annual')<>10 then raise exception 'annual monthly minimum';end if;
 raise notice 'B7 annual payment produces 12 independent monthly allowances without duplicated revenue: pass';
end $$;
select public.app_ai_billing_event('evt-annual-refund','refund',11,'sub-annual','invoice-annual',49.50);
do $$begin
 if(select min(budget_usd)from core.ai_allocations where billing_invoice='invoice-annual')<>5 then raise exception 'partial annual refund allocation';end if;
 raise notice 'B8 cumulative annual refund proportionally reduces current and future allowances: pass';
end $$;
set local role authenticated;
do $$begin
 begin perform public.app_ai_access('a1111111-1111-4111-8111-111111111111');raise exception 'public service RPC';exception when insufficient_privilege then null;end;
 begin perform public.app_ai_router_config();raise exception 'public settings';exception when insufficient_privilege then null;end;
 raise notice 'B6 financial functions inaccessible to browser roles: pass';
end $$;
reset role;
insert into core.app_roles(user_id,product,role)values('a1111111-1111-4111-8111-111111111111','aelio','founder');
select public.app_ai_update_router_config('a1111111-1111-4111-8111-111111111111','{"GEMINI_MODEL":"verified-model","GEMINI_DAILY_BUDGET_USD":"2"}');
do $$begin
 if(public.app_ai_router_config()->>'GEMINI_MODEL')<>'verified-model'then raise exception 'settings not persisted';end if;
 begin perform public.app_ai_update_router_config('b2222222-2222-4222-8222-222222222222','{}');raise exception 'ordinary user controls';exception when insufficient_privilege then null;end;
 begin perform public.app_ai_update_router_config('a1111111-1111-4111-8111-111111111111','{"GEMINI_API_KEY":"do-not-save"}');raise exception 'secret config allowed';exception when invalid_parameter_value then null;end;
 raise notice 'B9 founder-only persisted controls reject secrets and ordinary users: pass';
end $$;
do $$declare e jsonb;f uuid:='f7070707-7070-4707-8707-707070707070';begin
 e:=public.app_create_echo('a1111111-1111-4111-8111-111111111111','{"mode":"original","name":"Photo reference fixture","disclosure_ack":true}');
 insert into public.app_files(id,owner_id,object_key,name,mime,size_bytes,category,status)values(f,'a1111111-1111-4111-8111-111111111111','fixture/photo.png','photo.png','image/png',10,'users','ready');
 insert into public.app_echo_memories(echo_id,owner_id,kind,file_id)values((e->>'agent_id')::uuid,'a1111111-1111-4111-8111-111111111111','photo',f);
 insert into public.app_echo_memories(echo_id,owner_id,kind,content)values((e->>'agent_id')::uuid,'a1111111-1111-4111-8111-111111111111','story','Retain this supplied story');
 begin perform public.app_prepare_file_deletion('b2222222-2222-4222-8222-222222222222',f);raise exception 'foreign file preparation';exception when insufficient_privilege then null;end;
 perform public.app_prepare_file_deletion('a1111111-1111-4111-8111-111111111111',f);
 if exists(select 1 from public.app_echo_memories where file_id=f)then raise exception 'photo reference retained invalid file';end if;
 if not exists(select 1 from public.app_echo_memories where echo_id=(e->>'agent_id')::uuid and kind='story')then raise exception 'unrelated memory deleted';end if;
 delete from public.app_files where id=f;
 raise notice 'B10 owner-scoped file preparation removes only obsolete photo references and preserves text memories: pass';
end $$;
rollback;
