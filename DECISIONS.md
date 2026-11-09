# Decisions

The assignment left some rules open. These are the choices made. Each one is a
default and is easy to change.

1. **An object cannot be deleted while it has tasks** (`on delete restrict`), so task history is kept.
   *Default decision — can be changed.*
2. **Tasks can be deleted only in status "new".** After work has started, the task and its history stay.
   *Default decision — can be changed.*
3. **Accepted tasks cannot be edited** (a trigger blocks it).
   *Default decision — can be changed.*
4. **The manager can reassign the executor in any status except "accepted".**
   *Default decision — can be changed.*
5. **An executor sees only their own tasks**, even on objects shared with other executors.
   *Default decision — can be changed.*
6. **All signed-in users can read profiles** (name and role only), so authors and executors can be shown.
   *Default decision — can be changed.*
7. **Status changes only through one database function, `change_task_status`.** A trigger blocks a direct `UPDATE` of status.
   *Default decision — can be changed.*
8. **History is written only by the database** (triggers and the function). There is no write access through the API.
   *Default decision — can be changed.*
9. **An executor who is not assigned to a task gets "Task not found" instead of "Not allowed"**, so they can't probe for other tasks.
   *Default decision — can be changed.*
10. **Users and profiles are created by an administrator by hand** (sign-up is disabled).
    *Default decision — can be changed.*
11. **Sessions use Supabase defaults** (the user stays signed in until they log out). In production,
    consider session time limits and an inactivity timeout.
    *Default decision — can be changed.*

## Not done / out of scope

- Pagination
- Notifications
- Editing history
- Automated frontend tests
- Realtime updates
