-- Disposable synthetic accounts; never production data.
begin;
insert into auth.users(id,email) values('17171717-0000-4000-8000-000000000001','native-owner@local.test'),('17171717-0000-4000-8000-000000000002','native-other@local.test');
insert into core.memberships(user_id,product_id)values('17171717-0000-4000-8000-000000000001','aelio'),('17171717-0000-4000-8000-000000000002','aelio')on conflict do nothing;
insert into core.creator_earnings(user_id,source,provider_event_id,gross_cents,fee_cents,status)values
 ('17171717-0000-4000-8000-000000000001','agent-sale','fixture-confirmed-event-a',10000,2000,'available'),
 ('17171717-0000-4000-8000-000000000002','design-sale','fixture-confirmed-event-b',1500,400,'pending');
set local role authenticated;
select set_config('request.jwt.claim.sub','17171717-0000-4000-8000-000000000001',true);
do $$declare p jsonb; id uuid;begin
 p:=public.app_native_save(null,0,'{"title":"Private site","kind":"website","files":{"index.html":"<h1>Private owner content</h1>"},"memory":"Private decision","deployment":{"repository":"https://github.com/example/site","env_names":["SECRET_NAME_ONLY"]}}');
 id:=(p->>'id')::uuid;perform set_config('test.native_id',id::text,true);
 if p->>'revision'<>'1' then raise exception 'initial revision';end if;
 perform public.app_native_save(id,1,'{"title":"Private site edited","kind":"website","files":{"index.html":"version2"},"memory":"","deployment":{}}');
 begin perform public.app_native_save(id,null,'{"title":"null revision","kind":"website","files":{}}');raise exception 'null revision accepted';exception when invalid_parameter_value then null;end;
 if (select count(*)from public.app_native_project_versions where project_id=id)<>2 then raise exception 'missing independent snapshots';end if;
 begin perform public.app_native_save(id,1,'{"title":"stale","kind":"website","files":{},"deployment":{}}');raise exception 'stale save accepted';exception when serialization_failure then null;end;
 begin perform public.app_native_save(null,0,'{"title":"bad","kind":"website","files":{"../escape":"x"}}');raise exception 'unsafe path accepted';exception when invalid_parameter_value then if sqlerrm='unsafe path accepted' then raise;end if;end;
 begin perform public.app_native_save(null,0,'{"title":"bad","kind":"website","files":{".env":"credential"}}');raise exception 'credentials accepted';exception when invalid_parameter_value then if sqlerrm='credentials accepted' then raise;end if;end;
 begin perform public.app_native_save(null,0,'{"title":"bad","kind":"website","files":{},"deployment":{"env_values":{"TOKEN":"bad"}}}');raise exception 'secret values accepted';exception when invalid_parameter_value then if sqlerrm='secret values accepted' then raise;end if;end;
 begin insert into public.app_native_projects(title,kind)values('forged','website');raise exception 'direct write accepted';exception when insufficient_privilege then null;end;
 p:=public.app_native_wallet();if(p#>>'{earnings,available_cents}')::int<>8000 or(p#>>'{earnings,pending_cents}')::int<>0 or(p->>'payouts_enabled')::boolean then raise exception 'wallet earnings/payout isolation';end if;
 begin insert into core.creator_earnings(user_id,source,provider_event_id,gross_cents,fee_cents,status)values(auth.uid(),'fake','forged',999,0,'available');raise exception 'member minted earnings';exception when insufficient_privilege then null;end;
 raise notice 'Native owner CRUD, snapshots, revision conflicts, safe files and real-money isolation: pass';
end $$;
select set_config('request.jwt.claim.sub','17171717-0000-4000-8000-000000000002',true);
do $$begin
 if (select count(*)from public.app_native_projects)<>0 or(select count(*)from public.app_native_project_versions)<>0 then raise exception 'cross-owner project leak';end if;
 begin perform public.app_native_save(current_setting('test.native_id')::uuid,2,'{"title":"forged","kind":"website","files":{}}');raise exception 'cross-owner write accepted';exception when insufficient_privilege then null;end;
 if (public.app_native_wallet()#>>'{earnings,pending_cents}')::int<>1100 then raise exception 'cross-owner wallet leak';end if;
 raise notice 'Native cross-account project/version/wallet isolation: pass';
end $$;
set local role anon;
do $$begin
 begin perform public.app_native_wallet();raise exception 'anonymous wallet accepted';exception when insufficient_privilege then null;end;
 begin perform public.app_native_save(null,0,'{}');raise exception 'anonymous project accepted';exception when insufficient_privilege then null;end;
 raise notice 'Native anonymous and financial mutation denial: pass';
end $$;
rollback;
