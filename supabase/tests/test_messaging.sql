-- Local synthetic data only. Transaction rolled back. Run after all AELIO migrations.
begin;
insert into auth.users(id,email) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','alpha@local.test'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','beta@local.test');
do $$ begin
 if (select count(*) from core.memberships where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>2 then raise exception 'both memberships missing'; end if;
 if (select count(*) from public.app_agents where owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>2 then raise exception 'permanent companions missing'; end if;
 if exists(select 1 from core.app_roles where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then raise exception 'signup granted role'; end if;
end $$;
insert into public.app_conversations(id,owner_id,title,participants) select 'cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','private',array[id] from public.app_agents where owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and kind='aelio';
insert into public.app_messages(conversation_id,role,content) values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','user','private text');
set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
do $$ begin
 if exists(select 1 from public.app_conversations) or exists(select 1 from public.app_messages) then raise exception 'cross-user leak'; end if;
 if (select count(*) from public.app_agents)<>2 then raise exception 'own-agent RLS failed'; end if;
 begin
 insert into public.app_messages(conversation_id,role,content) values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','assistant','forged');
 raise exception 'authenticated client wrote assistant message';
 exception when insufficient_privilege then null; end;
 begin
 update public.app_entitlements set credits=9999;
 raise exception 'credit escalation';
 exception when insufficient_privilege then null; end;
 begin
 perform public.app_limit('unauthorized',1,60);
 raise exception 'service RPC exposed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select public.app_reserve_chat('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,10,'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
select public.app_finish_chat('dddddddd-dddd-4ddd-8ddd-dddddddddddd',false);
select public.app_finish_chat('dddddddd-dddd-4ddd-8ddd-dddddddddddd',false);
do $$ begin
 if (select credits from public.app_entitlements where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and product='aelio')<>100 then raise exception 'refund not idempotent'; end if;
 if (select credits from public.app_entitlements where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and product='pathd')<>100 then raise exception 'subscription coupling'; end if;
end $$;
select public.app_enroll_recovery('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','["question1","question2"]','[{"hash":"test"},{"hash":"test2"}]',array['one-time']);
do $$ begin
 if not public.app_consume_recovery('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','one-time') then raise exception 'code not accepted'; end if;
 if public.app_consume_recovery('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','one-time') then raise exception 'code reused'; end if;
end $$;
insert into public.app_reminders(owner_id,title,due_at,recurrence,timezone) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','once',now()-interval '1 minute','once','America/New_York'),('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','weekly',now()-interval '1 minute','weekly','America/New_York');
select public.app_deliver_reminders();
select public.app_deliver_reminders();
do $$ begin
 if (select count(*) from public.app_notifications where owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>2 then raise exception 'scheduler duplicate or missing notifications'; end if;
 if exists(select 1 from public.app_reminders where not paused and due_at<=now()) then raise exception 'recurrence not advanced'; end if;
end $$;
select 'messaging ownership, role isolation, credits, recovery and scheduling checks passed' as result;
rollback;
-- Independent product suspension check is deliberately separate and rolled back.
begin;
update core.memberships set status='suspended' where user_id='11111111-1111-4111-8111-111111111111' and product_id='aelio';
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$ begin
 if core.has_product('aelio') then raise exception 'suspension ignored'; end if;
 if not core.has_product('pathd') then raise exception 'PATHD coupled to AELIO suspension'; end if;
 if (select count(*) from public.app_agents where kind in ('aelio','mila'))<>2 then raise exception 'PATHD lost its two system agents'; end if;
end $$;
rollback;
