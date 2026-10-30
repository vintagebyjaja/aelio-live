-- OPTIONAL administrative bootstrap, NOT part of automatic migrations.
-- Replace NULL with the existing Supabase Auth UUID from the owner's dashboard.
-- Run only after staging verification and a backup. Never select a role by email alone.
do $$
declare founder_uuid uuid := null; personal_uuid uuid := null;
begin
 if founder_uuid is null or personal_uuid is null then raise exception 'Supply the existing verified Auth UUIDs first; no accounts were changed'; end if;
 if not exists(select 1 from auth.users where id=founder_uuid and lower(email)='jaja@vybr8.live') then raise exception 'Founder UUID/email mismatch'; end if;
 if not exists(select 1 from auth.users where id=personal_uuid and lower(email)='vintagebyjaja@gmail.com') then raise exception 'Personal UUID/email mismatch'; end if;
 insert into core.app_roles(user_id,product,role) values(founder_uuid,'aelio','founder'),(personal_uuid,'aelio','personal')
 on conflict(user_id,product) do update set role=excluded.role;
end $$;
-- Also configure the exact corresponding engine UID/email allow-lists. Studio still requires MFA/security enrollment.
