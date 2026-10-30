-- Preview iteration only. Run manually after 07; no existing histories or memberships overwritten.
begin;
alter table public.app_conversations add column if not exists group_image_file_id uuid references public.app_files(id) on delete set null;
alter table public.app_conversations add column if not exists group_tone text not null default 'natural' check(group_tone in ('natural','professional','relaxed','debate'));
create or replace function public.app_validate_group_image() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 if tg_op='UPDATE' and old.permanent_key is not null and new.group_image_file_id is distinct from old.group_image_file_id then raise insufficient_privilege;end if;
 if new.group_image_file_id is not null and not exists(select 1 from public.app_files where id=new.group_image_file_id and owner_id=new.owner_id and mime like 'image/%' and status='ready') then raise insufficient_privilege;end if;
 return new;
end $$;
revoke all on function public.app_validate_group_image() from public,anon,authenticated;
drop trigger if exists app_validate_group_image on public.app_conversations;
create trigger app_validate_group_image before insert or update on public.app_conversations for each row execute function public.app_validate_group_image();
commit;
