-- AELIO 1.0.8 — conversation projects ("Move to Project"). Additive; run manually ONCE after 11.
-- Existing conversations keep project = null. RLS and history are unchanged.
begin;
alter table public.app_conversations add column if not exists project text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'app_conversations_project_check') then
    alter table public.app_conversations add constraint app_conversations_project_check
      check (project is null or length(btrim(project)) between 1 and 80);
  end if;
end $$;
create index if not exists app_conversation_owner_project on public.app_conversations(owner_id, project) where project is not null;
commit;
