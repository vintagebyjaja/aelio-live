-- Additive procedure repair. Run manually after09. Existing messages/histories stay untouched.
begin;
create or replace function public.app_commit_chat(rid uuid,input text,responses jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare r core.chat_requests; a jsonb; saved_at timestamptz:=clock_timestamp(); step integer:=0;
begin
 select * into r from core.chat_requests where id=rid for update;
 if r.id is null or r.status<>'running' then raise exception 'generation lease expired';end if;
 -- now() is transaction-stable: using it for every row allowed random UUIDs to reorder a turn.
 insert into public.app_messages(conversation_id,role,content,request_id,created_at) values(r.conversation_id,'user',input,rid,saved_at);
 for a in select * from jsonb_array_elements(responses) loop
 step:=step+1;
 insert into public.app_messages(conversation_id,agent_id,speaker,role,content,request_id,created_at)
 values(r.conversation_id,(a->>'agent_id')::uuid,a->>'speaker','assistant',a->>'content',rid,saved_at+step*interval '1 microsecond');
 end loop;
 perform public.app_finish_chat(rid,true);
end $$;
revoke all on function public.app_commit_chat(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.app_commit_chat(uuid,text,jsonb) to service_role;
commit;
