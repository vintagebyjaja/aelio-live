begin;
insert into auth.users(id,email) values('a1a1a1a1-0000-4000-8000-000000000001','aurevia-one@local.test'),('b2b2b2b2-0000-4000-8000-000000000002','aurevia-two@local.test');
insert into core.memberships(user_id,product_id) values('a1a1a1a1-0000-4000-8000-000000000001','aelio'),('b2b2b2b2-0000-4000-8000-000000000002','aelio') on conflict do nothing;
insert into public.app_conversations(id,owner_id,title,participants) values('c3c3c3c3-0000-4000-8000-000000000003','a1a1a1a1-0000-4000-8000-000000000001','Owner meeting','{}'),('d4d4d4d4-0000-4000-8000-000000000004','b2b2b2b2-0000-4000-8000-000000000002','Other private meeting','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1a1a1a1-0000-4000-8000-000000000001',true);
do $$declare s jsonb;begin
 s:=public.app_aurevia_state();perform public.app_aurevia_state();
 if s#>>'{residence,owner_id}'<>auth.uid()::text or (select count(*) from public.app_aurevia_residences)<>1 then raise exception 'A1 residence owner/idempotency failure'; end if;
 perform public.app_aurevia_preferences('Coastal retreat','office','low');
 if(select destination from public.app_aurevia_residences)<>'office' then raise exception 'A2 preference persistence failure'; end if;
 begin perform public.app_aurevia_preferences('Name','unknown','high');raise exception 'A3 invalid destination accepted';exception when invalid_parameter_value then null;end;
 begin perform public.app_aurevia_preferences('Name','plaza','ultra');raise exception 'A4 invalid quality accepted';exception when invalid_parameter_value then null;end;
 begin perform public.app_aurevia_meeting('d4d4d4d4-0000-4000-8000-000000000004','Foreign transcript');raise exception 'A5 foreign thread linked';exception when insufficient_privilege then null;end;
 perform public.app_aurevia_meeting('c3c3c3c3-0000-4000-8000-000000000003','Owner purpose');
 if(select count(*) from public.app_aurevia_meetings)<>1 then raise exception 'A6 meeting missing';end if;
 begin insert into public.app_aurevia_residences(owner_id) values('b2b2b2b2-0000-4000-8000-000000000002');raise exception 'A7 direct insert permitted';exception when insufficient_privilege then null;end;
 begin update public.app_aurevia_meetings set owner_id='b2b2b2b2-0000-4000-8000-000000000002';raise exception 'A8 direct update permitted';exception when insufficient_privilege then null;end;
 raise notice 'A1-A8 owner residence, preferences, meeting ownership and direct writes: pass';
end $$;
select set_config('request.jwt.claim.sub','b2b2b2b2-0000-4000-8000-000000000002',true);
do $$begin
 if(select count(*) from public.app_aurevia_residences)<>0 or(select count(*) from public.app_aurevia_meetings)<>0 then raise exception 'A9 cross-owner RLS leakage';end if;
 if jsonb_array_length(public.app_aurevia_state()->'meetings')<>0 then raise exception 'A10 cross-owner RPC leakage';end if;
 raise notice 'A9-A10 second account RLS/RPC isolation: pass';
end $$;
reset role;
set local role anon;
do $$begin
 begin perform public.app_aurevia_state();raise exception 'A11 anonymous RPC permitted';exception when insufficient_privilege then null;end;
 begin perform * from public.app_aurevia_meetings;raise exception 'A12 anonymous SELECT permitted';exception when insufficient_privilege then null;end;
 raise notice 'A11-A12 anonymous denial: pass';
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','a1a1a1a1-0000-4000-8000-000000000001',true);
do $$begin
 for i in 2..10 loop perform public.app_aurevia_meeting('c3c3c3c3-0000-4000-8000-000000000003','Meeting');end loop;
 begin perform public.app_aurevia_meeting('c3c3c3c3-0000-4000-8000-000000000003','Too many');raise exception 'A13 meeting throttle failed';exception when program_limit_exceeded then null;end;
 raise notice 'A13 bounded meeting creation: pass';
end $$;
reset role;
rollback;
