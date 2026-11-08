--First Block
create type public.user_role as enum ('manager', 'executor');

create type public.task_status as enum (
  'new', 'in_progress', 'review', 'accepted', 'rework'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  role public.user_role not null,
  created_at timestamptz not null default now()
);
--Second Block
create table public.objects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  address text not null check (length(trim(address)) > 0),
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  object_id uuid not null references public.objects(id) on delete restrict,
  executor_id uuid not null references public.profiles(id),
  status public.task_status not null default 'new',
  author_id uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_object_id_idx on public.tasks(object_id);
create index tasks_executor_id_idx on public.tasks(executor_id);

--Third Block

create table public.task_history (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks(id) on delete cascade,
  changed_by uuid references public.profiles(id),
  from_status public.task_status,
  to_status public.task_status not null,
  comment text,
  created_at timestamptz not null default now()
);

create index task_history_task_id_idx on public.task_history(task_id);

--Fourth Block function

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'manager'
  );
$$;

--fifth block 

-- BEFORE INSERT: fix the data before it is saved
create or replace function public.tasks_before_insert()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = new.executor_id and role = 'executor'
  ) then
    raise exception 'Assigned user is not an executor';
  end if;

  new.status     := 'new';
  new.author_id  := coalesce(auth.uid(), new.author_id);
  new.created_at := now();
  new.updated_at := now();

  return new;
end;
$$;

create trigger tasks_before_insert
before insert on public.tasks
for each row execute function public.tasks_before_insert();


-- AFTER INSERT: write the first history record ("task created")
create or replace function public.tasks_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.task_history (task_id, changed_by, from_status, to_status)
  values (new.id, new.author_id, null, 'new');

  return null;
end;
$$;

create trigger tasks_after_insert
after insert on public.tasks
for each row execute function public.tasks_after_insert();

-- =========================================
-- Fifth Block B
-- =========================================

create or replace function public.tasks_before_update()
returns trigger
language plpgsql
as $$
begin
  -- 1. Status can be changed ONLY through change_task_status()
  if new.status is distinct from old.status
     and current_setting('app.status_change', true) is distinct from 'on' then
    raise exception 'Status can only be changed via change_task_status()';
  end if;

  -- 2. Author and creation date can never be changed
  if new.author_id is distinct from old.author_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Author and creation date cannot be changed';
  end if;

  -- 3. Accepted task cannot be edited
  if old.status = 'accepted' then
    raise exception 'Accepted task cannot be edited';
  end if;

  -- 4. If executor is changed, the new one must be an executor
  if new.executor_id is distinct from old.executor_id
     and not exists (
       select 1 from public.profiles
       where id = new.executor_id and role = 'executor'
     ) then
    raise exception 'Assigned user is not an executor';
  end if;

  new.updated_at := now();

  return new;
end;
$$;

create trigger tasks_before_update
before update on public.tasks
for each row execute function public.tasks_before_update();

-- =========================================
-- BLOCK 6: Status change function (the ONLY way to change status)
-- =========================================

create or replace function public.change_task_status(
  p_task_id    uuid,
  p_new_status public.task_status,
  p_comment    text default null
)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task        public.tasks;
  v_old_status  public.task_status;
  v_user_id     uuid    := auth.uid();
  v_is_manager  boolean := public.is_manager();
  v_is_executor boolean;
  v_comment     text    := nullif(trim(p_comment), '');
begin

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_task
  from public.tasks
  where id = p_task_id
  for update;

  if not found then
    raise exception 'Task not found';
  end if;

  v_is_executor := (v_task.executor_id = v_user_id);

  if not v_is_manager and not v_is_executor then
    raise exception 'Task not found';
  end if;

  v_old_status := v_task.status;

  -- Allowed transitions
  if v_old_status = 'new' and p_new_status = 'in_progress' then
    if not v_is_executor then raise exception 'Not allowed'; end if;

  elsif v_old_status = 'in_progress' and p_new_status = 'review' then
    if not v_is_executor then raise exception 'Not allowed'; end if;

  elsif v_old_status = 'review' and p_new_status = 'accepted' then
    if not v_is_manager then raise exception 'Not allowed'; end if;

  elsif v_old_status = 'review' and p_new_status = 'rework' then
    if not v_is_manager then raise exception 'Not allowed'; end if;
    if v_comment is null then
      raise exception 'Comment is required when returning a task';
    end if;

  elsif v_old_status = 'rework' and p_new_status = 'in_progress' then
    if not v_is_executor then raise exception 'Not allowed'; end if;

  else
    raise exception 'Transition % -> % is not allowed', v_old_status, p_new_status;
  end if;

  -- Tell the update trigger (block 5b) that this status change is legal
  perform set_config('app.status_change', 'on', true);

  update public.tasks
  set status = p_new_status
  where id = p_task_id
  returning * into v_task;

  -- Turn the permission off again right away
  perform set_config('app.status_change', 'off', true);

  -- Write history
  insert into public.task_history (task_id, changed_by, from_status, to_status, comment)
  values (p_task_id, v_user_id, v_old_status, p_new_status, v_comment);

  return v_task;
end;
$$;

-- Only logged-in users can call this function
revoke execute on function public.change_task_status(uuid, public.task_status, text) from public, anon;
grant  execute on function public.change_task_status(uuid, public.task_status, text) to authenticated;


-- =========================================
-- BLOCK 7: Row Level Security
-- =========================================

-- Turn RLS on. From now on: no policy = no access.
alter table public.profiles     enable row level security;
alter table public.objects      enable row level security;
alter table public.tasks        enable row level security;
alter table public.task_history enable row level security;


-- ---------- PROFILES ----------
-- Any signed-in user can read names and roles (needed to show "author", "executor")
create policy "profiles_select_authenticated"
on public.profiles for select
to authenticated
using (true);


-- ---------- OBJECTS ----------
-- Manager sees all objects; executor sees only objects where he has a task
create policy "objects_select"
on public.objects for select
to authenticated
using (
  public.is_manager()
  or exists (
    select 1 from public.tasks t
    where t.object_id = objects.id
      and t.executor_id = auth.uid()
  )
);

-- Only manager can create, edit, delete objects
create policy "objects_insert_manager"
on public.objects for insert
to authenticated
with check (public.is_manager());

create policy "objects_update_manager"
on public.objects for update
to authenticated
using (public.is_manager())
with check (public.is_manager());

create policy "objects_delete_manager"
on public.objects for delete
to authenticated
using (public.is_manager());


-- ---------- TASKS ----------
-- Manager sees all tasks; executor sees only his own
create policy "tasks_select"
on public.tasks for select
to authenticated
using (
  public.is_manager()
  or executor_id = auth.uid()
);

-- Only manager can create and edit tasks
-- (executors change status only via change_task_status)
create policy "tasks_insert_manager"
on public.tasks for insert
to authenticated
with check (public.is_manager());

create policy "tasks_update_manager"
on public.tasks for update
to authenticated
using (public.is_manager())
with check (public.is_manager());

-- Manager can delete only tasks that are still "new"
create policy "tasks_delete_manager"
on public.tasks for delete
to authenticated
using (public.is_manager() and status = 'new');


-- ---------- TASK HISTORY ----------
-- Read: manager sees all; executor sees history of his own tasks.
-- No insert/update/delete policies at all: history is written only by the database.
create policy "task_history_select"
on public.task_history for select
to authenticated
using (
  public.is_manager()
  or exists (
    select 1 from public.tasks t
    where t.id = task_history.task_id
      and t.executor_id = auth.uid()
  )
);


-- ---------- EXTRA HARDENING ----------
-- Anonymous (not signed-in) users get nothing at all
revoke all on public.profiles, public.objects, public.tasks, public.task_history from anon;

-- Nobody can write to history or profiles through the API
revoke insert, update, delete, truncate on public.task_history from authenticated;
revoke insert, update, delete, truncate on public.profiles     from authenticated;
revoke truncate on public.objects, public.tasks from authenticated;

-- Helper function: only for signed-in users
revoke execute on function public.is_manager() from public, anon;
grant  execute on function public.is_manager() to authenticated;