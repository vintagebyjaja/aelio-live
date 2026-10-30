-- AELIO 1.0.8 — Brain workspace entries + Dream Box ECHO.
-- Additive. Run manually ONCE after 10. Existing agents, conversations, histories, files and permanent companions
-- are not modified. Writes go through the Worker (service role) with explicit owner checks, as in earlier migrations;
-- browsers can only read their own rows (RLS).
begin;

-- ------------------------------------------------------------------ Brain: private workspace entries
-- The seven Brain sections hold the person's own notes, goals, projects, plans, links and tasks.
-- No dashboards or telemetry are generated here: an empty section is honestly empty.
create table if not exists public.app_workspace_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  section text not null check (section in ('aelio','dream-beyond','technology','create','values','campus','live')),
  kind text not null default 'note' check (kind in ('note','goal','project','plan','link','task')),
  title text not null check (length(btrim(title)) between 1 and 160),
  body text not null default '' check (length(body) <= 20000),
  url text check (url is null or (length(url) <= 2000 and url ~ '^https://')),
  status text not null default 'active' check (status in ('active','done','archived')),
  pinned boolean not null default false,
  position integer not null default 0,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 16384),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists app_workspace_owner_section on public.app_workspace_entries(owner_id, section, status, position);
alter table public.app_workspace_entries enable row level security;
revoke all on public.app_workspace_entries from public, anon, authenticated;
grant select on public.app_workspace_entries to authenticated;
grant all on public.app_workspace_entries to service_role;
drop policy if exists own_read on public.app_workspace_entries;
create policy own_read on public.app_workspace_entries for select to authenticated
  using (owner_id = auth.uid() and core.has_product('aelio'));

-- ------------------------------------------------------------------ ECHO profiles
-- An ECHO is a private custom agent (app_agents.kind = 'custom') with this profile row. Permanent companions are
-- never ECHOs. Generated dialogue is a simulation and is never stored as a memory.
create table if not exists public.app_echo_profiles (
  agent_id uuid primary key references public.app_agents(id) on delete cascade,
  owner_id uuid not null references auth.users on delete cascade,
  mode text not null check (mode in ('memory','personality','original')),
  base_style text check (base_style is null or base_style in
    ('Tech Savvy','Young & Hip','Proper British','Classy Gyal','Good Energy','Real Talk',
     'homegirl','ceo','auntie','advisor','teacher','mom')),
  subject text not null default 'original' check (subject in ('original','self','living','deceased','fictional')),
  subject_consent_at timestamptz,              -- required for a realistic replica of a living person
  disclosure_ack_at timestamptz not null,      -- person acknowledged: AI simulation, not the real person
  memories_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  check (mode <> 'personality' or base_style is not null),
  check (subject <> 'living' or subject_consent_at is not null),
  check (mode <> 'original' or subject in ('original','fictional'))
);
create index if not exists app_echo_owner on public.app_echo_profiles(owner_id);

create table if not exists public.app_echo_memories (
  id uuid primary key default gen_random_uuid(),
  echo_id uuid not null references public.app_echo_profiles(agent_id) on delete cascade,
  owner_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('memory','story','nickname','photo','conversation')),
  content text not null default '' check (length(content) <= 4000),
  file_id uuid references public.app_files(id) on delete set null,   -- photographs are references only; no analysis
  source text not null default 'typed' check (source in ('typed','import-txt','import-json')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind <> 'photo' or file_id is not null),
  check (kind = 'photo' or length(btrim(content)) > 0)
);
create index if not exists app_echo_memory_echo on public.app_echo_memories(echo_id, status);

alter table public.app_echo_profiles enable row level security;
alter table public.app_echo_memories enable row level security;
revoke all on public.app_echo_profiles, public.app_echo_memories from public, anon, authenticated;
grant select on public.app_echo_profiles, public.app_echo_memories to authenticated;
grant all on public.app_echo_profiles, public.app_echo_memories to service_role;
drop policy if exists own_read on public.app_echo_profiles;
create policy own_read on public.app_echo_profiles for select to authenticated using (owner_id = auth.uid() and core.has_product('aelio'));
drop policy if exists own_read on public.app_echo_memories;
create policy own_read on public.app_echo_memories for select to authenticated using (owner_id = auth.uid() and core.has_product('aelio'));

-- Memory photos must be the owner's own ready image file.
create or replace function public.app_validate_echo_memory() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.app_echo_profiles where agent_id = new.echo_id and owner_id = new.owner_id) then
    raise insufficient_privilege;
  end if;
  if new.file_id is not null and not exists (select 1 from public.app_files where id = new.file_id and owner_id = new.owner_id
                                              and mime like 'image/%' and status = 'ready') then
    raise insufficient_privilege;
  end if;
  return new;
end $$;
revoke all on function public.app_validate_echo_memory() from public, anon, authenticated;
drop trigger if exists app_validate_echo_memory on public.app_echo_memories;
create trigger app_validate_echo_memory before insert or update on public.app_echo_memories
  for each row execute function public.app_validate_echo_memory();

-- ------------------------------------------------------------------ ECHO functions (service role only)
-- Creates the private agent, its profile and one private conversation in a single transaction.
create or replace function public.app_create_echo(uid uuid, spec jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare aid uuid; cid uuid; m text := spec->>'mode'; subj text := coalesce(spec->>'subject','original'); n text := btrim(coalesce(spec->>'name',''));
begin
  if uid is null or not exists (select 1 from core.memberships where user_id = uid and product_id = 'aelio' and status = 'active') then
    raise insufficient_privilege;
  end if;
  if coalesce((spec->>'disclosure_ack')::boolean, false) is not true then
    raise exception 'echo_disclosure_required' using errcode = '22023';
  end if;
  if subj = 'living' and coalesce((spec->>'subject_consent')::boolean, false) is not true then
    raise exception 'echo_consent_required' using errcode = '22023';
  end if;
  if length(n) not between 1 and 80 or lower(n) in ('aelio','mila','naomi','angelo','oliver','simone','chloe','reggie') then
    raise exception 'echo_name_invalid' using errcode = '22023';     -- permanent companion names stay unique
  end if;
  if (select count(*) from public.app_echo_profiles where owner_id = uid) >= 12 then
    raise exception 'echo_limit' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 11));
  insert into public.app_agents(owner_id, kind, name, subtitle, specialty, instructions, memory_enabled)
  values (uid, 'custom', n, left(coalesce(spec->>'subtitle', 'ECHO'), 160), left(coalesce(spec->>'specialty', ''), 1000),
          left(coalesce(spec->>'instructions', ''), 4000), false)
  returning id into aid;
  insert into public.app_echo_profiles(agent_id, owner_id, mode, base_style, subject, subject_consent_at, disclosure_ack_at, memories_enabled)
  values (aid, uid, m, nullif(spec->>'base_style', ''), subj,
          case when coalesce((spec->>'subject_consent')::boolean, false) then now() end, now(),
          coalesce((spec->>'memories_enabled')::boolean, false));
  insert into public.app_conversations(owner_id, product, title, subtitle, participants)
  values (uid, 'aelio', n, 'ECHO · private', array[aid]) returning id into cid;
  return jsonb_build_object('agent_id', aid, 'conversation_id', cid);
end $$;

-- Deletes one ECHO, its private conversations (only the ones whose sole participant is this ECHO) and its memories.
-- Files are kept: app_files rows lose their conversation link (existing ON DELETE SET NULL) and stay in the Library.
create or replace function public.app_delete_echo(uid uuid, echo uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare convs integer;
begin
  if not exists (select 1 from public.app_echo_profiles p join public.app_agents a on a.id = p.agent_id
                 where p.agent_id = echo and p.owner_id = uid and a.owner_id = uid and a.kind = 'custom') then
    raise insufficient_privilege;
  end if;
  delete from public.app_conversations where owner_id = uid and participants = array[echo] and permanent_key is null;
  get diagnostics convs = row_count;
  update public.app_conversations set participants = array_remove(participants, echo)
   where owner_id = uid and echo = any(participants) and cardinality(participants) > 1;
  delete from public.app_agents where id = echo and owner_id = uid and kind = 'custom';
  return jsonb_build_object('deleted_conversations', convs);
end $$;

-- Approve or reject a supplied memory. Only approved memories are ever used, and only when the ECHO has memory on.
create or replace function public.app_review_echo_memory(uid uuid, memory uuid, approve boolean) returns void
language sql security definer set search_path = '' as $$
  update public.app_echo_memories set status = case when approve then 'approved' else 'rejected' end, reviewed_at = now()
   where id = memory and owner_id = uid;
$$;

-- The only path inference uses to read ECHO memories.
create or replace function public.app_echo_context(uid uuid, echo uuid) returns table(kind text, content text)
language sql stable security definer set search_path = '' as $$
  select m.kind, m.content from public.app_echo_memories m join public.app_echo_profiles p on p.agent_id = m.echo_id
   where m.echo_id = echo and m.owner_id = uid and p.owner_id = uid and p.memories_enabled and m.status = 'approved'
     and m.kind <> 'photo'
   order by m.created_at limit 60;
$$;

revoke all on function public.app_create_echo(uuid, jsonb), public.app_delete_echo(uuid, uuid),
  public.app_review_echo_memory(uuid, uuid, boolean), public.app_echo_context(uuid, uuid) from public, anon, authenticated;
grant execute on function public.app_create_echo(uuid, jsonb), public.app_delete_echo(uuid, uuid),
  public.app_review_echo_memory(uuid, uuid, boolean), public.app_echo_context(uuid, uuid) to service_role;
commit;
