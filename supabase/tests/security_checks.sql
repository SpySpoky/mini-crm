-- =========================================
-- SECURITY CHECKS
-- =========================================


-- TEST 1. Alexey sees only his own tasks. Expected: 3 rows
select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where full_name = 'Алексей Смирнов'), 'role', 'authenticated')::text, true);
select set_config('role', 'authenticated', true);
select title, status from public.tasks;


-- TEST 2. Alexey sees only objects where he has tasks. Expected: 2 rows (no "Тверская")
select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where full_name = 'Алексей Смирнов'), 'role', 'authenticated')::text, true);
select set_config('role', 'authenticated', true);
select name from public.objects;


-- TEST 3. Alexey sees history only of his tasks. Expected: 10
select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where full_name = 'Алексей Смирнов'), 'role', 'authenticated')::text, true);
select set_config('role', 'authenticated', true);
select count(*) from public.task_history;


-- TEST 4. Alexey tries to change a task directly. Expected: 0 rows changed
select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where full_name = 'Алексей Смирнов'), 'role', 'authenticated')::text, true);
select set_config('role', 'authenticated', true);
update public.tasks set title = 'Hacked' returning title;


-- TEST 5. Alexey tries to create a task. Expected: ERROR (row-level security)
select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where full_name = 'Алексей Смирнов'), 'role', 'authenticated')::text, true);
select set_config('role', 'authenticated', true);
insert into public.tasks (title, object_id, executor_id)
select 'Hacked task', id, auth.uid() from public.objects limit 1;


-- TEST 6. Alexey tries to delete history. Expected: ERROR (permission denied)
select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where full_name = 'Алексей Смирнов'), 'role', 'authenticated')::text, true);
select set_config('role', 'authenticated', true);
delete from public.task_history;


-- TEST 7. Alexey tries to fake history. Expected: ERROR (permission denied)
select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where full_name = 'Алексей Смирнов'), 'role', 'authenticated')::text, true);
select set_config('role', 'authenticated', true);
insert into public.task_history (task_id, changed_by, from_status, to_status)
select id, auth.uid(), 'review', 'accepted' from public.tasks limit 1;


-- TEST 8. Manager tries to change status directly (not via function). Expected: ERROR
select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where full_name = 'Иван Петров'), 'role', 'authenticated')::text, true);
select set_config('role', 'authenticated', true);
update public.tasks set status = 'accepted' where title = 'Устройство кровли';


-- TEST 9. Manager sees everything. Expected: 8 rows
select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where full_name = 'Иван Петров'), 'role', 'authenticated')::text, true);
select set_config('role', 'authenticated', true);
select title, status from public.tasks;


-- TEST 10. Not signed-in user (anon) sees nothing. Expected: ERROR (permission denied)
select set_config('role', 'anon', true);
select * from public.tasks;