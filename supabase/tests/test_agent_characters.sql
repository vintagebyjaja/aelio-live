begin;
insert into auth.users(id,email)values('18181818-0000-4000-8000-000000000001','character-owner@local.test'),('18181818-0000-4000-8000-000000000002','character-other@local.test');
insert into public.app_agents(id,owner_id,kind,name,instructions,memories)values('18181818-0000-4000-8000-000000000003','18181818-0000-4000-8000-000000000001','custom','Saved custom','Preserve instructions','["Preserve knowledge"]'),('18181818-0000-4000-8000-000000000004','18181818-0000-4000-8000-000000000001','naomi','Naomi','','[]');
insert into public.app_conversations(id,owner_id,product,title,participants)values('18181818-0000-4000-8000-000000000005','18181818-0000-4000-8000-000000000001','aelio','Existing thread',array['18181818-0000-4000-8000-000000000003'::uuid]);
insert into public.app_messages(conversation_id,role,content)values('18181818-0000-4000-8000-000000000005','user','Preserve existing conversation');
update public.app_agents set character='{"version":1,"current":{"style":"cinematic"},"presets":[]}' where id='18181818-0000-4000-8000-000000000003';
do $$begin
 if(select instructions from public.app_agents where id='18181818-0000-4000-8000-000000000003')<>'Preserve instructions' or(select memories from public.app_agents where id='18181818-0000-4000-8000-000000000003')<>'["Preserve knowledge"]'::jsonb then raise exception 'appearance overwrote knowledge';end if;
 if not exists(select 1 from public.app_messages where conversation_id='18181818-0000-4000-8000-000000000005' and content='Preserve existing conversation')then raise exception 'history lost';end if;
 begin update public.app_agents set character='{"version":1,"current":{}}' where id='18181818-0000-4000-8000-000000000004';raise exception 'official identity changed';exception when check_violation then null;end;
 raise notice 'Character custom-only storage and history/knowledge preservation: pass';
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','18181818-0000-4000-8000-000000000002',true);
do $$begin
 if exists(select 1 from public.app_agents where id='18181818-0000-4000-8000-000000000003')then raise exception 'cross-account character leaked';end if;
 begin update public.app_agents set character='{"version":1,"current":{}}' where id='18181818-0000-4000-8000-000000000003';raise exception 'direct character write allowed';exception when insufficient_privilege then null;end;
 raise notice 'Character cross-account isolation and direct-write denial: pass';
end $$;
rollback;
