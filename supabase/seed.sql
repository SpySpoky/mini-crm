--First seads
insert into public.profiles (id, full_name, role)
values (
  (select id from auth.users where email = 'manager@gmail.com'),
  'Иван Петров',
  'manager'
);

insert into public.profiles (id, full_name, role)
values (
  (select id from auth.users where email = 'user1@gmail.com'),
  'Алексей Смирнов',
  'executor'
);

insert into public.profiles (id, full_name, role)
values (
  (select id from auth.users where email = 'user2@gmail.com'),
  'Дмитрий Козлов',
  'executor'
);

-- =========================================
-- SEED PART 2: Objects, tasks, status history
-- Run AFTER part 1 (profiles)
-- =========================================

do $$
declare
  v_manager uuid := (select id from public.profiles where full_name = 'Иван Петров');
  v_exec1   uuid := (select id from public.profiles where full_name = 'Алексей Смирнов');
  v_exec2   uuid := (select id from public.profiles where full_name = 'Дмитрий Козлов');
  v_obj1 uuid; v_obj2 uuid; v_obj3 uuid;
  v_t1 uuid; v_t2 uuid; v_t3 uuid; v_t4 uuid;
  v_t5 uuid; v_t6 uuid; v_t7 uuid; v_t8 uuid;
begin
  -- Do not seed twice
  if exists (select 1 from public.objects) then
    raise notice 'Objects already exist, seed skipped';
    return;
  end if;

  -- ---------- Objects ----------
  insert into public.objects (name, address, created_by)
  values ('ЖК «Солнечный», корпус 2', 'г. Москва, ул. Лесная, д. 12', v_manager)
  returning id into v_obj1;

  insert into public.objects (name, address, created_by)
  values ('Складской комплекс «Восток»', 'г. Москва, Шоссейная ул., д. 45', v_manager)
  returning id into v_obj2;

  insert into public.objects (name, address, created_by)
  values ('Ремонт офиса на Тверской', 'г. Москва, ул. Тверская, д. 8, оф. 301', v_manager)
  returning id into v_obj3;

  -- ---------- Tasks (all start as "new") ----------
  insert into public.tasks (title, description, object_id, executor_id, author_id)
  values ('Залить фундамент секции А', 'Бетон М300, проверить опалубку перед заливкой', v_obj1, v_exec1, v_manager)
  returning id into v_t1;

  insert into public.tasks (title, description, object_id, executor_id, author_id)
  values ('Монтаж опалубки 3 этажа', 'По чертежу КЖ-3', v_obj1, v_exec1, v_manager)
  returning id into v_t2;

  insert into public.tasks (title, description, object_id, executor_id, author_id)
  values ('Армирование плиты перекрытия', 'Арматура А500, шаг 200 мм', v_obj1, v_exec2, v_manager)
  returning id into v_t3;

  insert into public.tasks (title, description, object_id, executor_id, author_id)
  values ('Устройство кровли', 'Мембрана ПВХ, утеплитель 150 мм', v_obj2, v_exec2, v_manager)
  returning id into v_t4;

  insert into public.tasks (title, description, object_id, executor_id, author_id)
  values ('Монтаж секционных ворот', '4 ворот, проём 4×4 м', v_obj2, v_exec2, v_manager)
  returning id into v_t5;

  insert into public.tasks (title, description, object_id, executor_id, author_id)
  values ('Прокладка электрики', 'Освещение складской зоны', v_obj2, v_exec1, v_manager)
  returning id into v_t6;

  insert into public.tasks (title, description, object_id, executor_id, author_id)
  values ('Демонтаж перегородок', 'Перегородки ГКЛ в переговорной', v_obj3, v_exec2, v_manager)
  returning id into v_t7;

  insert into public.tasks (title, description, object_id, executor_id, author_id)
  values ('Покраска стен', 'Цвет по согласованию с заказчиком', v_obj3, v_exec2, v_manager)
  returning id into v_t8;

  -- ---------- Move statuses as real users ----------
  -- Act as Alexey (executor 1)
  perform set_config('request.jwt.claims', json_build_object('sub', v_exec1, 'role', 'authenticated')::text, true);
  perform public.change_task_status(v_t1, 'in_progress');
  perform public.change_task_status(v_t1, 'review');
  perform public.change_task_status(v_t2, 'in_progress');
  perform public.change_task_status(v_t2, 'review');
  perform public.change_task_status(v_t6, 'in_progress');

  -- Act as Dmitry (executor 2)
  perform set_config('request.jwt.claims', json_build_object('sub', v_exec2, 'role', 'authenticated')::text, true);
  perform public.change_task_status(v_t3, 'in_progress');
  perform public.change_task_status(v_t4, 'in_progress');
  perform public.change_task_status(v_t4, 'review');
  perform public.change_task_status(v_t8, 'in_progress');
  perform public.change_task_status(v_t8, 'review');

  -- Act as Ivan (manager)
  perform set_config('request.jwt.claims', json_build_object('sub', v_manager, 'role', 'authenticated')::text, true);
  perform public.change_task_status(v_t1, 'accepted');
  perform public.change_task_status(v_t2, 'rework', 'Опалубка установлена с отклонением по уровню, переделать');
  perform public.change_task_status(v_t8, 'rework', 'Видны полосы на стене у окна, перекрасить');

  -- Act as Dmitry again: back to work after rework
  perform set_config('request.jwt.claims', json_build_object('sub', v_exec2, 'role', 'authenticated')::text, true);
  perform public.change_task_status(v_t8, 'in_progress');

  -- Stop impersonating
  perform set_config('request.jwt.claims', '', true);

  raise notice 'Seed done: 3 objects, 8 tasks';
end $$;