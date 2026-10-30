-- Run once after 05 and 06. Additive; no password, session, subscription or identity changes.
begin;
create or replace function public.app_save_recovery_questions(uid uuid,qs jsonb,hashes jsonb) returns void
language plpgsql security definer set search_path='' as $$ begin
 if jsonb_typeof(qs) <> 'array' or jsonb_array_length(qs) <> 2
 or jsonb_typeof(hashes) <> 'array' or jsonb_array_length(hashes) <> 2 then
 raise exception 'Two questions and hashes required'; end if;
 insert into core.recovery_credentials(user_id,questions,answer_hashes,code_hashes)
 values(uid,qs,hashes,array[]::text[])
 on conflict(user_id) do update set questions=excluded.questions,
 answer_hashes=excluded.answer_hashes,enrolled_at=now();
 -- Existing codes and stronger-factor enrollment are deliberately preserved.
 insert into public.app_audit(owner_id,action) values(uid,'recovery.questions_saved');
end $$;
revoke all on function public.app_save_recovery_questions(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.app_save_recovery_questions(uuid,jsonb,jsonb) to service_role;
commit;
