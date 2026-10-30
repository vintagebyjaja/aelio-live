-- OWNER ONLY: inspect Auth users, then paste the two verified UUIDs below.
-- No login-email allowlist exists in application code. Grants bind permanently to UUIDs.
select id,email,created_at,email_confirmed_at from auth.users where lower(email) in ('vintagebyjaja@gmail.com','jaja@vybr8.live');
-- Replace placeholders after verifying account ownership in Supabase Auth. Do not run unchanged.
-- select core.grant_unlimited_messages('PERSONAL-VERIFIED-UUID'::uuid,'vintagebyjaja@gmail.com');
-- select core.grant_unlimited_messages('FOUNDER-VERIFIED-UUID'::uuid,'jaja@vybr8.live');
-- No Studio Brain, admin role, paid plan or subscription is granted by this operation.
