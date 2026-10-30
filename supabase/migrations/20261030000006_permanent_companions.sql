-- Apply after account repair 05. Additive permanent companions; all histories/UUIDs retained.
begin;
alter table public.app_agents drop constraint if exists app_agents_kind_check;
alter table public.app_agents add constraint app_agents_kind_check check(kind in ('custom','aelio','mila','naomi','angelo','oliver','simone','chloe','reggie'));
alter table public.app_agents add column if not exists avatar_file_id uuid references public.app_files(id) on delete set null;
alter table public.app_agents add column if not exists avatar_crop jsonb not null default '{"x":50,"y":35,"zoom":1}'::jsonb
 check(jsonb_typeof(avatar_crop)='object' and avatar_crop ?& array['x','y','zoom'] and avatar_crop-'x'-'y'-'zoom'='{}'::jsonb
 and jsonb_typeof(avatar_crop->'x')='number' and jsonb_typeof(avatar_crop->'y')='number' and jsonb_typeof(avatar_crop->'zoom')='number'
 and (avatar_crop->>'x')::numeric between 0 and 100 and (avatar_crop->>'y')::numeric between 0 and 100 and (avatar_crop->>'zoom')::numeric between 1 and 3);
alter table public.app_conversations add column if not exists permanent_key text check(permanent_key in ('aelio','mila','naomi','angelo','oliver','simone','chloe','reggie','dream-team'));
create unique index if not exists app_permanent_conversation on public.app_conversations(owner_id,permanent_key) where permanent_key is not null;
create or replace function core.ensure_companions(uid uuid) returns void
language plpgsql security definer set search_path='' as $$
declare spec record; aid uuid; cid uuid; members uuid[];
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,0));
 insert into public.app_agents(owner_id,kind,name,subtitle,personality) values
 (uid,'naomi','Naomi','Tech & Innovation','Tech Savvy'),
 (uid,'angelo','Angelo','The Homie','Young & Hip'),
 (uid,'oliver','Oliver','The Gentleman','Proper British'),
 (uid,'simone','Simone','Class & Confidence','Classy Gyal'),
 (uid,'chloe','Chloe','Good Energy','Good Energy'),
 (uid,'reggie','Reggie','Real Talk','Real Talk') on conflict do nothing;
 for spec in select * from (values
 ('aelio','AELIO · Main Pal','Your Original Main Pal','aelio'),
 ('mila','MILA · Your PATH','Career, life & accountability','pathd'),
 ('naomi','Naomi · Tech & Innovation','Tech & Innovation','aelio'),
 ('angelo','Angelo · The Homie','The Homie','aelio'),
 ('oliver','Oliver · The Gentleman','The Gentleman','aelio'),
 ('simone','Simone · Class & Confidence','Class & Confidence','aelio'),
 ('chloe','Chloe · Good Energy','Good Energy','aelio'),
 ('reggie','Reggie · Real Talk','Real Talk','aelio')) as definitions(key,title,subtitle,product)
 loop
  select id into aid from public.app_agents where owner_id=uid and kind=spec.key;
  if aid is null then continue; end if;
  if not exists(select 1 from public.app_conversations where owner_id=uid and permanent_key=spec.key) then
   -- Adopt one existing individual chat; keep its title, appearance and full history.
   select id into cid from public.app_conversations where owner_id=uid and product=spec.product and participants=array[aid] and permanent_key is null order by created_at,id limit 1;
   if cid is not null then update public.app_conversations set permanent_key=spec.key where id=cid;
   else insert into public.app_conversations(owner_id,product,title,subtitle,participants,permanent_key) values(uid,spec.product,spec.title,spec.subtitle,array[aid],spec.key); end if;
  end if;
 end loop;
 select array_agg(id order by array_position(array['naomi','angelo','oliver','simone','chloe','reggie'],kind)) into members from public.app_agents where owner_id=uid and kind in ('naomi','angelo','oliver','simone','chloe','reggie');
 if cardinality(members)=6 then insert into public.app_conversations(owner_id,product,title,subtitle,participants,permanent_key) values(uid,'aelio','Dream Team','Six minds. One conversation.',members,'dream-team') on conflict do nothing; end if;
end $$;
revoke all on function core.ensure_companions(uuid) from public,anon,authenticated;
create or replace function public.app_account_bootstrap() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); meta jsonb; result jsonb;
begin
 if uid is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' then raise insufficient_privilege; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,0));
 select raw_user_meta_data into meta from auth.users where id=uid;
 if not found then raise insufficient_privilege; end if;
 insert into core.profiles(user_id,display_name,signup_product)
 values(uid,left(coalesce(meta->>'display_name',meta->>'full_name',''),80),case when meta->>'signup_product'='pathd' then 'pathd' else 'aelio' end) on conflict do nothing;
 insert into core.memberships(user_id,product_id) values(uid,'aelio'),(uid,'pathd') on conflict do nothing;
 insert into public.app_entitlements(user_id,product) values(uid,'aelio'),(uid,'pathd') on conflict do nothing;
 insert into public.app_preferences(user_id) values(uid) on conflict do nothing;
 insert into public.app_agents(owner_id,kind,name,subtitle) values(uid,'aelio','AELIO','Your Original Main Pal'),(uid,'mila','MILA','Career & Life Companion') on conflict do nothing;
 -- PATHD's legacy profile is independent: fill only a missing row when its table exists.
 if to_regclass('public.profiles') is not null then
  execute 'insert into public.profiles(id) values($1) on conflict do nothing' using uid;
 end if;
 perform core.ensure_companions(uid);
 select jsonb_build_object('user',jsonb_build_object('id',uid,'display_name',p.display_name,'recovery_enrolled',p.recovery_enrolled_at is not null),
 'preferences',(select to_jsonb(pref) from public.app_preferences pref where pref.user_id=uid),
 'plans',coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object('unlimited',exists(select 1 from core.app_roles r where r.user_id=uid and r.product=e.product))) from public.app_entitlements e where e.user_id=uid),'[]'::jsonb),
 'role',coalesce((select role from core.app_roles where user_id=uid and product='aelio'),'member')) into result
 from core.profiles p where p.user_id=uid;
 return result;
end $$;
-- Guard identities even if an API handler is accidentally changed later. Account deletion cascades still work.
create or replace function core.protect_companions() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then
  if old.kind<>'custom' and exists(select 1 from auth.users where id=old.owner_id) then raise exception 'permanent companion' using errcode='42501'; end if;
  return old;
 end if;
 if old.kind<>'custom' and (new.owner_id,new.kind,new.name,new.subtitle,new.personality,new.specialty,new.instructions,new.avatar_file_id,new.avatar_crop) is distinct from (old.owner_id,old.kind,old.name,old.subtitle,old.personality,old.specialty,old.instructions,old.avatar_file_id,old.avatar_crop) then raise exception 'permanent companion' using errcode='42501'; end if;
 return new;
end $$;
drop trigger if exists app_permanent_agent_guard on public.app_agents;
create trigger app_permanent_agent_guard before update or delete on public.app_agents for each row execute function core.protect_companions();
create or replace function core.protect_permanent_chats() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then
  if old.permanent_key is not null and exists(select 1 from auth.users where id=old.owner_id) then raise exception 'permanent conversation' using errcode='42501'; end if;
  return old;
 end if;
 if old.permanent_key='dream-team' and (new.title,new.subtitle) is distinct from (old.title,old.subtitle) then raise exception 'permanent group identity' using errcode='42501'; end if;
 if old.permanent_key is not null and (new.owner_id,new.product,new.permanent_key,new.participants) is distinct from (old.owner_id,old.product,old.permanent_key,old.participants) then raise exception 'permanent conversation' using errcode='42501'; end if;
 return new;
end $$;
drop trigger if exists app_permanent_chat_guard on public.app_conversations;
create trigger app_permanent_chat_guard before update or delete on public.app_conversations for each row execute function core.protect_permanent_chats();
-- Owner-scoped message search; the caller's existing conversation/message RLS still applies.
create or replace function public.app_search_history(term text,product_scope text) returns jsonb
language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(found)),'[]'::jsonb) from (
 select c.*,coalesce((select left(m.content,160) from public.app_messages m where m.conversation_id=c.id and strpos(lower(m.content),lower(term))>0 order by m.created_at desc limit 1),'') as search_preview
 from public.app_conversations c
 where c.owner_id=auth.uid() and product_scope in ('aelio','pathd') and (product_scope='aelio' or c.product='pathd') and length(term) between 2 and 100
 and (strpos(lower(c.title||' '||c.subtitle),lower(term))>0 or exists(select 1 from public.app_messages m where m.conversation_id=c.id and strpos(lower(m.content),lower(term))>0)) order by c.updated_at desc limit 60
 ) found;
$$;
revoke all on function public.app_search_history(text,text) from public,anon;
grant execute on function public.app_search_history(text,text) to authenticated;
-- Lazy provisioning on verified account access; no mass rewrite of existing users.
commit;
