begin;
insert into auth.users(id,email)values('a1111111-1111-4111-8111-111111111111','image-owner@local.test'),('b2222222-2222-4222-8222-222222222222','image-other@local.test');
insert into core.memberships(user_id,product_id)values('a1111111-1111-4111-8111-111111111111','aelio'),('b2222222-2222-4222-8222-222222222222','aelio')on conflict do nothing;
insert into public.app_entitlements(user_id,product,credits)values('a1111111-1111-4111-8111-111111111111','aelio',20)on conflict(user_id,product)do update set credits=20;
insert into public.app_agents(id,owner_id,kind,name)values('c3333333-3333-4333-8333-333333333333','a1111111-1111-4111-8111-111111111111','custom','Image companion');
insert into public.app_conversations(id,owner_id,participants)values('d4444444-4444-4444-8444-444444444444','a1111111-1111-4111-8111-111111111111',array['c3333333-3333-4333-8333-333333333333']::uuid[]);
do $$begin
 if(public.app_image_quote('a1111111-1111-4111-8111-111111111111',false)->>'enabled')::boolean then raise exception 'I1 prices activated by default';end if;
 begin perform public.app_image_policy('b2222222-2222-4222-8222-222222222222','{"enabled":true}');raise exception 'I2 nonfounder changed pricing';exception when insufficient_privilege then null;end;
 raise notice 'I1-I2 default disabled; nonfounder pricing denial: pass';
end $$;
insert into core.app_roles(user_id,product,role)values('a1111111-1111-4111-8111-111111111111','aelio','founder')on conflict(user_id,product)do update set role='founder';
select public.app_image_policy('a1111111-1111-4111-8111-111111111111','{"enabled":true,"create_credits":3,"edit_credits":2}');
do $$declare q jsonb;begin
 q:=public.app_image_quote('a1111111-1111-4111-8111-111111111111',false);
 begin perform public.app_image_begin('b2222222-2222-4222-8222-222222222222','d4444444-4444-4444-8444-444444444444','e5555555-5555-4555-8555-555555555555','hash','A coastal city',null,'square','c3333333-3333-4333-8333-333333333333',2,3);raise exception 'I3 foreign conversation';exception when insufficient_privilege then null;end;
 begin perform public.app_image_begin('a1111111-1111-4111-8111-111111111111','d4444444-4444-4444-8444-444444444444','e5555555-5555-4555-8555-555555555555','hash','A coastal city',null,'square','c3333333-3333-4333-8333-333333333333',1,3);raise exception 'I4 stale quote';exception when invalid_parameter_value then null;end;
 perform public.app_image_begin('a1111111-1111-4111-8111-111111111111','d4444444-4444-4444-8444-444444444444','e5555555-5555-4555-8555-555555555555','hash','A coastal city',null,'square','c3333333-3333-4333-8333-333333333333',2,3);
 perform public.app_image_begin('a1111111-1111-4111-8111-111111111111','d4444444-4444-4444-8444-444444444444','e5555555-5555-4555-8555-555555555555','hash','A coastal city',null,'square','c3333333-3333-4333-8333-333333333333',2,3);
 if(select credits from public.app_entitlements where user_id='a1111111-1111-4111-8111-111111111111'and product='aelio')<>17 then raise exception 'I5 duplicate charge';end if;
 if public.app_image_status('b2222222-2222-4222-8222-222222222222','e5555555-5555-4555-8555-555555555555')is not null then raise exception 'I6 status leaked';end if;
 perform public.app_image_finish('e5555555-5555-4555-8555-555555555555',false);perform public.app_image_finish('e5555555-5555-4555-8555-555555555555',false);
 if(select credits from public.app_entitlements where user_id='a1111111-1111-4111-8111-111111111111'and product='aelio')<>20 then raise exception 'I7 refund not exact/idempotent';end if;
 raise notice 'I3-I7 ownership, quotes, idempotency, status privacy and refunds: pass';
end $$;
-- Successful generation links a private file; editing preserves its parent.
insert into public.app_files(id,owner_id,object_key,name,mime,size_bytes,category,conversation_id,status)values('f6666666-6666-4666-8666-666666666666','a1111111-1111-4111-8111-111111111111','fixture/image','Image.png','image/png',100,'generated-assets','d4444444-4444-4444-8444-444444444444','ready');
select public.app_image_begin('a1111111-1111-4111-8111-111111111111','d4444444-4444-4444-8444-444444444444','f7777777-7777-4777-8777-777777777777','success','A city',null,'square','c3333333-3333-4333-8333-333333333333',2,3);
select public.app_image_finish('f7777777-7777-4777-8777-777777777777',true,'f6666666-6666-4666-8666-666666666666');
do $$begin
 if(select count(*)from public.app_messages where image_file_id='f6666666-6666-4666-8666-666666666666')<>1 then raise exception 'I8 image not in transcript';end if;
 if(select credits from public.app_entitlements where user_id='a1111111-1111-4111-8111-111111111111'and product='aelio')<>17 then raise exception 'I9 success credit amount';end if;
 perform public.app_image_begin('a1111111-1111-4111-8111-111111111111','d4444444-4444-4444-8444-444444444444','f8888888-8888-4888-8888-888888888888','edit','Warmer light','f6666666-6666-4666-8666-666666666666','square','c3333333-3333-4333-8333-333333333333',2,2);
 perform public.app_image_finish('f8888888-8888-4888-8888-888888888888',false);
 if not exists(select 1 from public.app_files where id='f6666666-6666-4666-8666-666666666666'and status='ready')then raise exception 'I10 original lost';end if;
 raise notice 'I8-I10 persistent image transcript, exact success price and preserved edit source: pass';
end $$;
-- Eligible paid image actions use the same allowance ledger; failed output refunds only the member.
select core.bind_ai_subscription('image-sub','a1111111-1111-4111-8111-111111111111','aelio','adapt','image-price');
select public.app_ai_billing_event('image-payment','paid',1,'image-sub','image-invoice',20,now()-interval '1 day',now()+interval '29 days','image-price');
select public.app_image_policy('a1111111-1111-4111-8111-111111111111','{"included_plans":["adapt"]}');
do $$begin
 if(public.app_image_quote('a1111111-1111-4111-8111-111111111111',false)->>'credits')::integer<>0 then raise exception 'I13 eligible plan not included';end if;
 perform public.app_image_begin('a1111111-1111-4111-8111-111111111111','d4444444-4444-4444-8444-444444444444','f9999999-9999-4999-8999-999999999999','paid','A city',null,'square','c3333333-3333-4333-8333-333333333333',3,0);
 perform public.app_ai_reserve('fa111111-1111-4111-8111-111111111111','f9999999-9999-4999-8999-999999999999','a1111111-1111-4111-8111-111111111111','aelio','gemini','image-fixture',.1,10,100,10);
 perform public.app_ai_settle('fa111111-1111-4111-8111-111111111111',.07,'image_storage_failed',100,null,null,true);
 perform public.app_image_finish('f9999999-9999-4999-8999-999999999999',false);
 if(select spent_usd from core.ai_allocations where invoice_id='image-invoice')<>0 then raise exception 'I14 failed output spent member allowance';end if;
 if(select cost_usd from core.ai_attempts where id='fa111111-1111-4111-8111-111111111111')<>.07 then raise exception 'I15 provider cost lost';end if;
 raise notice 'I13-I15 included paid access; member refund preserves actual platform cost: pass';
end $$;
-- Paid users buying a non-included image use credits only, never a second allowance charge.
select public.app_image_policy('a1111111-1111-4111-8111-111111111111','{"included_plans":[]}');
do $$begin
 begin perform public.app_image_begin('a1111111-1111-4111-8111-111111111111','d4444444-4444-4444-8444-444444444444','fb111111-1111-4111-8111-111111111111','credit','A city',null,'square','c3333333-3333-4333-8333-333333333333',null,null);raise exception 'I16 missing quote confirmation accepted';exception when invalid_parameter_value then null;end;
 perform public.app_image_begin('a1111111-1111-4111-8111-111111111111','d4444444-4444-4444-8444-444444444444','fb111111-1111-4111-8111-111111111111','credit','A city',null,'square','c3333333-3333-4333-8333-333333333333',4,3);
 perform public.app_ai_reserve('fc111111-1111-4111-8111-111111111111','fb111111-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','aelio','gemini','image-fixture',.1,10,100,10);
 if(select invoice_id from core.ai_attempts where id='fc111111-1111-4111-8111-111111111111')is not null then raise exception 'I17 image used both credits and paid allowance';end if;
 -- Expiry also settles an unknown attempt as a platform estimate before refunding its member.
 update core.image_jobs set created_at=now()-interval '16 minutes'where id='fb111111-1111-4111-8111-111111111111';
 perform public.app_image_expire();
 if(public.app_image_status('a1111111-1111-4111-8111-111111111111','fb111111-1111-4111-8111-111111111111')->>'status')<>'failed'then raise exception 'I18 stale hold not expired';end if;
 if(select status from core.ai_attempts where id='fc111111-1111-4111-8111-111111111111')<>'settled'then raise exception 'I19 unresolved provider reservation';end if;
 raise notice 'I16-I19 quote confirmation, one funding source, expiry and unknown attempt settlement: pass';
end $$;
set local role authenticated;
do $$begin
 begin perform public.app_image_quote('a1111111-1111-4111-8111-111111111111',false);raise exception 'I11 direct billing RPC';exception when insufficient_privilege then null;end;
 begin perform *from core.image_jobs;raise exception 'I12 private jobs exposed';exception when insufficient_privilege then null;end;
 raise notice 'I11-I12 browser roles cannot access private jobs/billing RPCs: pass';
end $$;
reset role;
rollback;
