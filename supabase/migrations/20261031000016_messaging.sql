-- Additive official Core 8 group and owner-only message reactions. Owner applies after 15.
begin;
alter table public.app_conversations add column if not exists last_read_at timestamptz;
alter table public.app_conversations drop constraint if exists app_conversations_permanent_key_check;
alter table public.app_conversations add constraint app_conversations_permanent_key_check check(permanent_key in('aelio','mila','naomi','angelo','oliver','simone','chloe','reggie','dream-team','core-eight'));
create or replace function public.app_core_eight() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();members uuid[];c public.app_conversations;
begin
 if actor is null or not public.app_product_access('aelio')then raise insufficient_privilege;end if;
 perform pg_catalog.pg_advisory_xact_lock(hashtextextended(actor::text,16));perform core.ensure_companions(actor);
 select array_agg(id order by array_position(array['aelio','mila','naomi','angelo','oliver','simone','chloe','reggie'],kind))into members from public.app_agents where owner_id=actor and kind in('aelio','mila','naomi','angelo','oliver','simone','chloe','reggie');
 if cardinality(members)<>8 then raise exception 'official companions unavailable';end if;
 insert into public.app_conversations(owner_id,product,title,subtitle,participants,permanent_key)values(actor,'aelio','Core 8','All eight. One conversation.',members,'core-eight')on conflict do nothing;
 select *into c from public.app_conversations where owner_id=actor and permanent_key='core-eight';return to_jsonb(c);
end $$;
create or replace function core.protect_core_eight()returns trigger language plpgsql set search_path='' as $$begin
 if old.permanent_key='core-eight' and(new.title,new.subtitle)is distinct from(old.title,old.subtitle)then raise insufficient_privilege;end if;return new;
end $$;
drop trigger if exists app_core_eight_identity on public.app_conversations;
create trigger app_core_eight_identity before update on public.app_conversations for each row execute function core.protect_core_eight();
create table if not exists public.app_message_reactions(owner_id uuid not null references auth.users on delete cascade,message_id uuid not null references public.app_messages on delete cascade,emoji text not null check(emoji in('👍','❤️','😂','✨','🤔')),created_at timestamptz not null default now(),primary key(owner_id,message_id,emoji));
alter table public.app_message_reactions enable row level security;
drop policy if exists own_reaction on public.app_message_reactions;
create policy own_reaction on public.app_message_reactions for select to authenticated using(owner_id=(select auth.uid())and exists(select 1 from public.app_messages m join public.app_conversations c on c.id=m.conversation_id where m.id=message_id and c.owner_id=(select auth.uid())));
revoke all on public.app_message_reactions from public,anon,authenticated;
grant select on public.app_message_reactions to authenticated;
create or replace function public.app_react_message(mid uuid,reaction text)returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();already boolean;
begin
 if actor is null or reaction is null or reaction not in('👍','❤️','😂','✨','🤔')then raise invalid_parameter_value;end if;
 perform 1 from public.app_messages m join public.app_conversations c on c.id=m.conversation_id where m.id=mid and c.owner_id=actor and public.app_product_access(c.product)for update of m;
 if not found then raise insufficient_privilege;end if;
 already:=exists(select 1 from public.app_message_reactions where owner_id=actor and message_id=mid and emoji=reaction);
 delete from public.app_message_reactions where owner_id=actor and message_id=mid;
 if not already then insert into public.app_message_reactions(owner_id,message_id,emoji)values(actor,mid,reaction);end if;
 return coalesce((select jsonb_agg(jsonb_build_object('emoji',emoji,'count',1,'mine',true))from public.app_message_reactions where owner_id=actor and message_id=mid),'[]'::jsonb);
end $$;
revoke all on function public.app_core_eight(),public.app_react_message(uuid,text),core.protect_core_eight()from public,anon;
grant execute on function public.app_core_eight(),public.app_react_message(uuid,text)to authenticated;
create or replace function public.app_messaging_unread()returns table(conversation_id uuid,unread_count bigint)language sql stable set search_path='' as $$
 select c.id,count(m.id)from public.app_conversations c left join public.app_messages m on m.conversation_id=c.id and m.role='assistant'and c.last_read_at is not null and m.created_at>c.last_read_at where c.owner_id=auth.uid()group by c.id
$$;
create or replace function public.app_mark_message_read(mid uuid)returns void language plpgsql security definer set search_path='' as $$declare msg public.app_messages;begin
 select m.*into msg from public.app_messages m join public.app_conversations c on c.id=m.conversation_id where m.id=mid and c.owner_id=auth.uid();if msg.id is null then raise insufficient_privilege;end if;
 update public.app_conversations set last_read_at=greatest(coalesce(last_read_at,msg.created_at),msg.created_at)where id=msg.conversation_id and owner_id=auth.uid();
end $$;
revoke all on function public.app_messaging_unread(),public.app_mark_message_read(uuid)from public,anon;
grant execute on function public.app_messaging_unread(),public.app_mark_message_read(uuid)to authenticated;

commit;
