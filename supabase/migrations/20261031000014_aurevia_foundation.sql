-- AUREVIA Phase 1. Owner review/application only, after reported SQL13.
-- Existing identities, portraits, conversations, memories and inference are untouched.
begin;
create table if not exists public.app_aurevia_residences (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 name text not null default 'My coastal residence' check(length(btrim(name)) between 1 and 80),
 destination text not null default 'plaza' check(destination in ('plaza','residence','office','university','court','harbor','terraces')),
 quality text not null default 'balanced' check(quality in ('low','balanced','high')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.app_aurevia_meetings (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 conversation_id uuid not null references public.app_conversations(id) on delete cascade,
 purpose text not null check(length(btrim(purpose)) between 1 and 500),
 created_at timestamptz not null default now()
);
create index if not exists app_aurevia_meetings_owner on public.app_aurevia_meetings(owner_id,created_at desc);
alter table public.app_aurevia_residences enable row level security;
alter table public.app_aurevia_meetings enable row level security;
drop policy if exists aurevia_residence_read on public.app_aurevia_residences;
create policy aurevia_residence_read on public.app_aurevia_residences for select to authenticated using(owner_id=(select auth.uid()));
drop policy if exists aurevia_meeting_read on public.app_aurevia_meetings;
create policy aurevia_meeting_read on public.app_aurevia_meetings for select to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.app_conversations c where c.id=conversation_id and c.owner_id=(select auth.uid())));
revoke all on public.app_aurevia_residences,public.app_aurevia_meetings from public,anon,authenticated;
grant select on public.app_aurevia_residences,public.app_aurevia_meetings to authenticated;
-- All writes derive owner from verified JWT auth.uid(), never a supplied owner ID.
create or replace function public.app_aurevia_state() returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid(); r public.app_aurevia_residences;
begin
 if actor is null then raise exception 'authentication required' using errcode='42501'; end if;
 if not public.app_product_access('aelio') then raise exception 'membership unavailable' using errcode='42501'; end if;
 insert into public.app_aurevia_residences(owner_id) values(actor) on conflict(owner_id) do nothing;
 select * into r from public.app_aurevia_residences where owner_id=actor;
 return jsonb_build_object('residence',to_jsonb(r),'meetings',coalesce((select jsonb_agg(to_jsonb(m)) from (select a.* from public.app_aurevia_meetings a join public.app_conversations c on c.id=a.conversation_id and c.owner_id=actor where a.owner_id=actor order by a.created_at desc limit 50) m),'[]'::jsonb));
end $$;
create or replace function public.app_aurevia_preferences(p_name text,p_destination text,p_quality text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid(); r public.app_aurevia_residences;
begin
 if actor is null or not public.app_product_access('aelio') then raise exception 'membership unavailable' using errcode='42501'; end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 80 or p_destination is null or p_destination not in ('plaza','residence','office','university','court','harbor','terraces') or p_quality is null or p_quality not in ('low','balanced','high') then raise exception 'invalid residence preferences' using errcode='22023'; end if;
 insert into public.app_aurevia_residences(owner_id,name,destination,quality) values(actor,btrim(p_name),p_destination,p_quality) on conflict(owner_id) do update set name=excluded.name,destination=excluded.destination,quality=excluded.quality,updated_at=now() returning * into r;
 return to_jsonb(r);
end $$;
create or replace function public.app_aurevia_meeting(p_conversation uuid,p_purpose text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid(); r public.app_aurevia_meetings;
begin
 if actor is null or not public.app_product_access('aelio') then raise exception 'membership unavailable' using errcode='42501'; end if;
 if p_purpose is null or length(btrim(p_purpose)) not between 1 and 500 then raise exception 'invalid meeting purpose' using errcode='22023'; end if;
 -- Lock ownership while linking; never copy another thread's transcript into this one.
 perform 1 from public.app_conversations where id=p_conversation and owner_id=actor and archived=false for share;
 if not found then raise exception 'conversation unavailable' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,14));
 if(select count(*) from public.app_aurevia_meetings where owner_id=actor and created_at>now()-interval '1 minute')>=10 then raise exception 'wait before starting another meeting' using errcode='54000'; end if;
 insert into public.app_aurevia_meetings(owner_id,conversation_id,purpose) values(actor,p_conversation,btrim(p_purpose)) returning * into r;
 return to_jsonb(r);
end $$;
revoke all on function public.app_aurevia_state(),public.app_aurevia_preferences(text,text,text),public.app_aurevia_meeting(uuid,text) from public,anon;
grant execute on function public.app_aurevia_state(),public.app_aurevia_preferences(text,text,text),public.app_aurevia_meeting(uuid,text) to authenticated;
commit;
