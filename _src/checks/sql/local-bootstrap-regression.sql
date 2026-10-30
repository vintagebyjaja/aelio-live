begin;
create or replace function public.fixture_profile_failure() returns trigger language plpgsql as $$ begin raise not_null_violation;end $$;
create trigger fixture_profile_failure before insert on public.profiles for each row execute function public.fixture_profile_failure();
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$ declare account jsonb;begin
 account:=public.app_account_bootstrap();
 if account->'user'->>'id'<>'11111111-1111-4111-8111-111111111111' then raise exception 'Shared account lost to legacy profile failure';end if;
end $$;
rollback;
