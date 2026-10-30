-- AELIO 1.0.8 SQL 11 + 12. Local synthetic data only; everything rolled back.
begin;
insert into auth.users(id,email) values
 ('a1a1a1a1-0000-4000-8000-000000000001','owner@local.test'),
 ('b2b2b2b2-0000-4000-8000-000000000002','other@local.test');
insert into core.memberships(user_id,product_id) values('a1a1a1a1-0000-4000-8000-000000000001','aelio'),('b2b2b2b2-0000-4000-8000-000000000002','aelio') on conflict do nothing;

-- W: Brain workspace entries
insert into public.app_workspace_entries(owner_id,section,kind,title,body) values
 ('a1a1a1a1-0000-4000-8000-000000000001','dream-beyond','goal','Launch the studio','private plan'),
 ('b2b2b2b2-0000-4000-8000-000000000002','create','project','Other person''s book','x');
do $$ begin
 begin insert into public.app_workspace_entries(owner_id,section,title) values('a1a1a1a1-0000-4000-8000-000000000001','studio','x'); raise exception 'W1 FAILED: unknown section';
 exception when check_violation then null; end;
 begin insert into public.app_workspace_entries(owner_id,section,title,url) values('a1a1a1a1-0000-4000-8000-000000000001','technology','x','javascript:alert(1)'); raise exception 'W2 FAILED: unsafe url';
 exception when check_violation then null; end;
 raise notice 'W1-W2 workspace validation: pass';
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','a1a1a1a1-0000-4000-8000-000000000001',true);
do $$ begin
 if (select count(*) from public.app_workspace_entries)<>1 then raise exception 'W3 FAILED: sees other workspace'; end if;
 begin insert into public.app_workspace_entries(owner_id,section,title) values(auth.uid(),'aelio','direct'); raise exception 'W4 FAILED: client write';
 exception when insufficient_privilege then null; end;
 begin perform public.app_create_echo(auth.uid(),'{}'::jsonb); raise exception 'W5 FAILED: service function exposed';
 exception when insufficient_privilege then null; end;
 raise notice 'W3-W5 workspace ownership + server-only functions: pass';
end $$;
reset role;

-- E: ECHO creation rules
do $$ declare r jsonb; begin
 begin perform public.app_create_echo('a1a1a1a1-0000-4000-8000-000000000001','{"mode":"original","name":"Nova"}'); raise exception 'E1 FAILED: no disclosure';
 exception when invalid_parameter_value then null; end;
 begin perform public.app_create_echo('a1a1a1a1-0000-4000-8000-000000000001','{"mode":"memory","name":"Grandma","subject":"living","disclosure_ack":true}'); raise exception 'E2 FAILED: living without consent';
 exception when invalid_parameter_value then null; end;
 begin perform public.app_create_echo('a1a1a1a1-0000-4000-8000-000000000001','{"mode":"original","name":"MILA","disclosure_ack":true}'); raise exception 'E3 FAILED: permanent name reused';
 exception when invalid_parameter_value then null; end;
 begin perform public.app_create_echo('a1a1a1a1-0000-4000-8000-000000000001','{"mode":"personality","name":"P","disclosure_ack":true}'); raise exception 'E4 FAILED: personality without style';
 exception when check_violation then null; end;
 begin perform public.app_create_echo('a1a1a1a1-0000-4000-8000-000000000001','{"mode":"personality","name":"P","base_style":"Villain","disclosure_ack":true}'); raise exception 'E5 FAILED: unknown style';
 exception when check_violation then null; end;
 r := public.app_create_echo('a1a1a1a1-0000-4000-8000-000000000001','{"mode":"memory","name":"Grandpa Joe","subject":"deceased","disclosure_ack":true,"memories_enabled":true}');
 if not exists(select 1 from public.app_conversations where id=(r->>'conversation_id')::uuid and participants=array[(r->>'agent_id')::uuid]) then raise exception 'E6 FAILED'; end if;
 perform public.app_create_echo('a1a1a1a1-0000-4000-8000-000000000001','{"mode":"personality","name":"Smooth","base_style":"ceo","disclosure_ack":true}');
 perform public.app_create_echo('a1a1a1a1-0000-4000-8000-000000000001','{"mode":"memory","name":"Mom","subject":"living","subject_consent":true,"disclosure_ack":true}');
 raise notice 'E1-E6 ECHO disclosure, consent, names, styles, private conversation: pass';
end $$;

-- M: memories need review and the ECHO's memory switch
do $$ declare e uuid; f uuid; m1 uuid; begin
 select agent_id into e from public.app_echo_profiles where owner_id='a1a1a1a1-0000-4000-8000-000000000001' and subject='deceased';
 insert into public.app_echo_memories(echo_id,owner_id,kind,content,source) values(e,'a1a1a1a1-0000-4000-8000-000000000001','nickname','Called me Sport','import-txt') returning id into m1;
 insert into public.app_echo_memories(echo_id,owner_id,kind,content) values(e,'a1a1a1a1-0000-4000-8000-000000000001','story','Fishing every summer');
 if exists(select 1 from public.app_echo_context('a1a1a1a1-0000-4000-8000-000000000001',e)) then raise exception 'M1 FAILED: unreviewed memory used'; end if;
 perform public.app_review_echo_memory('a1a1a1a1-0000-4000-8000-000000000001',m1,true);
 if (select count(*) from public.app_echo_context('a1a1a1a1-0000-4000-8000-000000000001',e))<>1 then raise exception 'M2 FAILED: approved memory missing'; end if;
 perform public.app_review_echo_memory('b2b2b2b2-0000-4000-8000-000000000002',m1,false);   -- someone else can't change it
 if (select status from public.app_echo_memories where id=m1)<>'approved' then raise exception 'M3 FAILED: cross-user review'; end if;
 update public.app_echo_profiles set memories_enabled=false where agent_id=e;
 if exists(select 1 from public.app_echo_context('a1a1a1a1-0000-4000-8000-000000000001',e)) then raise exception 'M4 FAILED: memory used while off'; end if;
 if exists(select 1 from public.app_echo_context('b2b2b2b2-0000-4000-8000-000000000002',e)) then raise exception 'M5 FAILED: other user reads context'; end if;
 insert into public.app_files(owner_id,object_key,name,mime,size_bytes,category,status) values('b2b2b2b2-0000-4000-8000-000000000002','k/other.png','o.png','image/png',10,'users','ready') returning id into f;
 begin insert into public.app_echo_memories(echo_id,owner_id,kind,file_id) values(e,'a1a1a1a1-0000-4000-8000-000000000001','photo',f); raise exception 'M6 FAILED: foreign photo';
 exception when insufficient_privilege then null; end;
 raise notice 'M1-M6 memory review, memory switch, isolation, photo ownership: pass';
end $$;

-- D: deleting an ECHO keeps files and never touches permanent companions
do $$ declare e uuid; c uuid; f uuid; r jsonb; perm integer; begin
 select agent_id into e from public.app_echo_profiles where owner_id='a1a1a1a1-0000-4000-8000-000000000001' and subject='deceased';
 select id into c from public.app_conversations where participants=array[e];
 insert into public.app_files(owner_id,object_key,name,mime,size_bytes,category,conversation_id,status) values('a1a1a1a1-0000-4000-8000-000000000001','k/gen.png','gen.png','image/png',10,'generated-assets',c,'ready') returning id into f;
 select count(*) into perm from public.app_agents where owner_id='a1a1a1a1-0000-4000-8000-000000000001' and kind<>'custom';
 begin perform public.app_delete_echo('b2b2b2b2-0000-4000-8000-000000000002',e); raise exception 'D1 FAILED: other user deleted ECHO';
 exception when insufficient_privilege then null; end;
 begin perform public.app_delete_echo('a1a1a1a1-0000-4000-8000-000000000001',(select id from public.app_agents where owner_id='a1a1a1a1-0000-4000-8000-000000000001' and kind<>'custom' limit 1)); raise exception 'D2 FAILED: permanent companion deleted';
 exception when insufficient_privilege then null; end;
 r := public.app_delete_echo('a1a1a1a1-0000-4000-8000-000000000001',e);
 if (r->>'deleted_conversations')::int<>1 or exists(select 1 from public.app_agents where id=e) or exists(select 1 from public.app_echo_memories where echo_id=e) then raise exception 'D3 FAILED'; end if;
 if not exists(select 1 from public.app_files where id=f and conversation_id is null) then raise exception 'D4 FAILED: Library image lost'; end if;
 if (select count(*) from public.app_agents where owner_id='a1a1a1a1-0000-4000-8000-000000000001' and kind<>'custom')<>perm then raise exception 'D5 FAILED'; end if;
 raise notice 'D1-D5 ECHO deletion: owner-only, permanent companions safe, Library image kept: pass';
end $$;

-- P: conversation projects
do $$ declare c uuid; begin
 insert into public.app_conversations(owner_id,title) values('a1a1a1a1-0000-4000-8000-000000000001','plain') returning id into c;
 update public.app_conversations set project='Studio launch' where id=c;
 begin update public.app_conversations set project='   ' where id=c; raise exception 'P1 FAILED: blank project';
 exception when check_violation then null; end;
 begin update public.app_conversations set project=repeat('x',81) where id=c; raise exception 'P2 FAILED: long project';
 exception when check_violation then null; end;
 if (select project from public.app_conversations where id=c)<>'Studio launch' then raise exception 'P3 FAILED'; end if;
 if exists(select 1 from public.app_conversations where id<>c and project is not null) then raise exception 'P4 FAILED: existing rows changed'; end if;
 raise notice 'P1-P4 projects persist, validated, existing conversations untouched: pass';
end $$;

-- L: Library isolation (existing app_files RLS)
set local role authenticated;
select set_config('request.jwt.claim.sub','b2b2b2b2-0000-4000-8000-000000000002',true);
do $$ begin
 if exists(select 1 from public.app_files where owner_id<>auth.uid()) then raise exception 'L1 FAILED: sees other library'; end if;
 if exists(select 1 from public.app_echo_profiles) or exists(select 1 from public.app_echo_memories) then raise exception 'L2 FAILED: sees other ECHO'; end if;
 raise notice 'L1-L2 Library and ECHO isolation: pass';
end $$;
reset role;
rollback;
