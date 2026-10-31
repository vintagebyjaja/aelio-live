begin;
insert into auth.users(id,email)values('a1111111-1111-4111-8111-111111111111','messages-one@local.test'),('b2222222-2222-4222-8222-222222222222','messages-two@local.test');
insert into core.memberships(user_id,product_id)values('a1111111-1111-4111-8111-111111111111','aelio'),('b2222222-2222-4222-8222-222222222222','aelio')on conflict do nothing;
set local role authenticated;
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
do $$declare c jsonb;begin
 c:=public.app_core_eight();perform public.app_core_eight();
 if jsonb_array_length(c->'participants')<>8 then raise exception 'M1 Core 8 missing companions';end if;
 if(select count(*)from public.app_conversations where permanent_key='core-eight')<>1 then raise exception 'M2 duplicate Core 8';end if;
 if(select count(*)from public.app_agents where owner_id=auth.uid()and kind<>'custom')<>8 then raise exception 'M3 duplicate identities';end if;
 raise notice 'M1-M3 stable Core 8 primary group, idempotency and shared companion identities: pass';
end $$;
reset role;
insert into public.app_messages(id,conversation_id,role,content,created_at)select 'c3333333-3333-4333-8333-333333333333',id,'assistant','Private message',now()-interval '1 minute'from public.app_conversations where owner_id='a1111111-1111-4111-8111-111111111111'and permanent_key='core-eight';
set local role authenticated;
do $$begin
 perform public.app_react_message('c3333333-3333-4333-8333-333333333333','👍');
 if jsonb_array_length(public.app_react_message('c3333333-3333-4333-8333-333333333333','👍'))<>0 then raise exception 'M4 reaction toggle failed';end if;
 perform public.app_react_message('c3333333-3333-4333-8333-333333333333','❤️');
 if(select count(*)from public.app_message_reactions)<>1 then raise exception 'M5 reaction missing';end if;
 perform public.app_mark_message_read('c3333333-3333-4333-8333-333333333333');
 raise notice 'M4-M5 real owner reactions and read markers: pass';
end $$;
reset role;
insert into public.app_messages(conversation_id,role,content,created_at)select id,'assistant','New unread message',now()from public.app_conversations where owner_id='a1111111-1111-4111-8111-111111111111'and permanent_key='core-eight';
set local role authenticated;
do $$begin
 if(select sum(unread_count)from public.app_messaging_unread())<>1 then raise exception 'M6 unread count incorrect';end if;
 raise notice 'M6 unread markers count actual new assistant messages: pass';
end $$;
select set_config('request.jwt.claim.sub','b2222222-2222-4222-8222-222222222222',true);
do $$begin
 if(select count(*)from public.app_message_reactions)<>0 then raise exception 'M7 foreign reactions visible';end if;
 begin perform public.app_react_message('c3333333-3333-4333-8333-333333333333','😂');raise exception 'M8 foreign reaction allowed';exception when insufficient_privilege then null;end;
 begin perform public.app_mark_message_read('c3333333-3333-4333-8333-333333333333');raise exception 'M9 foreign read marker';exception when insufficient_privilege then null;end;
 if(select count(*)from public.app_messaging_unread())<>0 then raise exception 'M10 foreign inbox';end if;
 raise notice 'M7-M10 reaction, read-marker and inbox isolation: pass';
end $$;
reset role;
do $$begin
 begin update public.app_conversations set title='Renamed'where permanent_key='core-eight';raise exception 'M11 official group renamed';exception when insufficient_privilege then null;end;
 raise notice 'M11 permanent Core 8 identity protected: pass';
end $$;
set local role anon;
do $$begin
 begin perform public.app_core_eight();raise exception 'M12 anonymous group creation';exception when insufficient_privilege then null;end;
 raise notice 'M12 anonymous denial: pass';
end $$;
reset role;
rollback;
