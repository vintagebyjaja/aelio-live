\set ON_ERROR_STOP on
-- Signups from each site
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aelio-user@x.dev', '{"signup_product":"aelio"}'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'pathd-user@x.dev', '{"signup_product":"pathd","display_name":"Pat"}'),
  ('cccccccc-0000-4000-8000-000000000003', 'odd@x.dev',        '{"signup_product":"studio_brain"}');

do $$ begin
  -- T1 every signup gets an AELIO identity; PATHD signups get PATHD too; unknown product falls back to aelio
  assert (select array_agg(product_id order by product_id) from core.memberships where user_id='aaaaaaaa-0000-4000-8000-000000000001') = '{aelio}', 'T1a';
  assert (select array_agg(product_id order by product_id) from core.memberships where user_id='bbbbbbbb-0000-4000-8000-000000000002') = '{aelio,pathd}', 'T1b';
  assert (select array_agg(product_id order by product_id) from core.memberships where user_id='cccccccc-0000-4000-8000-000000000003') = '{aelio}', 'T1c';
  -- T2 the token claim mirrors memberships
  assert (select raw_app_meta_data->'products' from auth.users where email='pathd-user@x.dev') = '["aelio","pathd"]'::jsonb, 'T2';
  assert (select signup_product from core.profiles where user_id='bbbbbbbb-0000-4000-8000-000000000002') = 'pathd', 'T2b';
  raise notice 'T1-T2 provisioning: pass';
end $$;

-- As the PATHD user
set role authenticated; select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-000000000002', false);
insert into pathd.profiles (headline) values ('Hello from PATHD');
do $$ begin
  assert (select count(*) from core.profiles) = 1, 'T3 sees only own profile';
  assert (select count(*) from core.memberships) = 2, 'T3 sees only own memberships';
  assert (select count(*) from pathd.profiles) = 1, 'T3 pathd row';
  raise notice 'T3 own-rows isolation: pass';
end $$;
-- T4 browsers cannot read AELIO product data
do $$ begin
  begin perform 1 from aelio.accounts; raise exception 'T4 FAILED: aelio schema readable';
  exception when insufficient_privilege then raise notice 'T4 aelio data hidden from browsers: pass'; end;
  -- T5 cannot grant yourself products or edit app_metadata
  begin insert into core.memberships (user_id, product_id) values ('bbbbbbbb-0000-4000-8000-000000000002','founder_only');
        raise exception 'T5 FAILED';
  exception when insufficient_privilege then null; end;
  begin update auth.users set raw_app_meta_data='{"products":["x"]}'; raise exception 'T5b FAILED';
  exception when insufficient_privilege then null; end;
  begin perform core.sync_products_claim('bbbbbbbb-0000-4000-8000-000000000002'); raise exception 'T5c FAILED';
  exception when insufficient_privilege then null; end;
  raise notice 'T5 no self-granting: pass';
end $$;

-- As the AELIO-only user: no PATHD data until they join PATHD
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', false);
do $$ begin
  assert (select count(*) from pathd.profiles) = 0, 'T6 cannot see other users';
  begin insert into pathd.profiles (headline) values ('x'); raise exception 'T6 FAILED: wrote PATHD data without membership';
  exception when insufficient_privilege then null; end;
  begin perform core.join_product('nope'); raise exception 'T6b FAILED';
  exception when invalid_parameter_value then null; end;
  assert core.join_product('pathd') = '{aelio,pathd}', 'T6 join';
  insert into pathd.profiles (headline) values ('joined');
  assert (select count(*) from pathd.profiles) = 1, 'T6 own row only';
  raise notice 'T6 product isolation + join: pass';
end $$;

-- Anonymous visitors
reset role; set role anon; select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  assert (select count(*) from core.products) = 2, 'T7 products public';
  begin perform 1 from core.profiles; raise exception 'T7 FAILED'; exception when insufficient_privilege then null; end;
  begin perform 1 from pathd.profiles; raise exception 'T7b FAILED'; exception when insufficient_privilege then null; end;
  raise notice 'T7 anonymous: pass';
end $$;

reset role;
do $$ begin
  -- T8 suspended membership blocks access and drops from the claim
  update core.memberships set status='suspended' where user_id='aaaaaaaa-0000-4000-8000-000000000001' and product_id='pathd';
  perform core.sync_products_claim('aaaaaaaa-0000-4000-8000-000000000001');
  assert (select raw_app_meta_data->'products' from auth.users where id='aaaaaaaa-0000-4000-8000-000000000001') = '["aelio"]'::jsonb, 'T8';
end $$;
set role authenticated; select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', false);
do $$ begin
  assert (select count(*) from pathd.profiles) = 0, 'T8 suspended sees nothing';
  begin perform core.join_product('pathd'); raise exception 'T8 FAILED: rejoined while suspended';
  exception when insufficient_privilege then null; end;
  raise notice 'T8 suspension: pass';
end $$;
reset role;
-- T9 deleting an auth user removes their product rows
delete from auth.users where id='bbbbbbbb-0000-4000-8000-000000000002';
do $$ begin
  assert not exists (select 1 from core.memberships where user_id='bbbbbbbb-0000-4000-8000-000000000002'), 'T9';
  assert not exists (select 1 from pathd.profiles where user_id='bbbbbbbb-0000-4000-8000-000000000002'), 'T9b';
  raise notice 'T9 cascade on account deletion: pass';
end $$;
