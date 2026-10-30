begin;
-- Disposable fixtures only. No production users or balances are touched.
update auth.users set email='vintagebyjaja@gmail.com' where id='11111111-1111-4111-8111-111111111111';
select core.grant_unlimited_messages('11111111-1111-4111-8111-111111111111','vintagebyjaja@gmail.com');
update public.app_entitlements set credits=7,period_start=now() where user_id='11111111-1111-4111-8111-111111111111';
do $$ declare cid uuid; result integer; remaining integer;begin
 select id into cid from public.app_conversations where owner_id='11111111-1111-4111-8111-111111111111' and product='aelio' limit 1;
 update public.app_conversations set busy_until=null where id=cid;
 result:=public.app_reserve_chat(cid,'11111111-1111-4111-8111-111111111111',null,2,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 select credits into remaining from public.app_entitlements where user_id='11111111-1111-4111-8111-111111111111' and product='aelio';
 if result<>2147483647 or remaining<>7 then raise exception 'Unlimited balance charged';end if;
 if (select count(*) from core.message_credit_overrides where user_id='11111111-1111-4111-8111-111111111111')<>2 then raise exception 'Missing product grant';end if;
 if exists(select 1 from core.app_roles where user_id='11111111-1111-4111-8111-111111111111') then raise exception 'Credit grant added privilege';end if;
 if has_function_privilege('authenticated','core.grant_unlimited_messages(uuid,text)','execute') or has_function_privilege('service_role','core.grant_unlimited_messages(uuid,text)','execute') then raise exception 'Grant function exposed';end if;
end $$;
-- Changing a login email does not change a previously approved UUID entitlement.
update auth.users set email='changed-owner@example.test' where id='11111111-1111-4111-8111-111111111111';
update public.app_entitlements set credits=9,plan='owner-configured-paid',period_start=now() where user_id='22222222-2222-4222-8222-222222222222' and product='aelio';
do $$ declare cid uuid;result integer;begin
 select id into cid from public.app_conversations where owner_id='22222222-2222-4222-8222-222222222222' and product='aelio' limit 1;
 update public.app_conversations set busy_until=null where id=cid;
 result:=public.app_reserve_chat(cid,'22222222-2222-4222-8222-222222222222',null,2,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
 if result<>8 then raise exception 'Actual paid allowance not respected';end if;
end $$;
rollback;
