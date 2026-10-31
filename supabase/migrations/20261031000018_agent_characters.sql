-- Owner-reviewed custom-character storage. No official companion image or identity changes.
begin;
alter table public.app_agents add column if not exists character jsonb;
alter table public.app_agents drop constraint if exists app_character_custom_only;
alter table public.app_agents add constraint app_character_custom_only check(character is null or((kind='custom' and jsonb_typeof(character)='object' and character->>'version'='1' and jsonb_typeof(character->'current')='object' and octet_length(character::text)<=16384) is true));
comment on column public.app_agents.character is 'Owner-scoped custom appearance configuration and saved presets. v1 code-authored humanoid; not a production rig or animation guarantee. Existing instructions, memories and conversation IDs remain independent.';
commit;
