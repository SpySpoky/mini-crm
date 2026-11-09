# Mini-CRM "Objects and Tasks"

A small CRM for a construction company. A **manager** creates construction objects and tasks
and assigns them to **executors**. Executors move tasks through a fixed workflow
(`new → in_progress → review → accepted`, with `review → rework → in_progress` for rework),
and every status change is recorded in the task history.

UI language: Russian.

## Stack

- React 19 + TypeScript, built with Vite
- React Router (`react-router-dom`)
- Supabase: Postgres, Auth, Row Level Security (`@supabase/supabase-js`)
- Plain CSS, no UI library

## Supabase setup

Do these steps in order:

1. Create a new project at [supabase.com](https://supabase.com).
2. **Authentication → Sign In / Providers**: turn off **"Allow new users to sign up"**.
3. **Authentication → Users → Add user** (check **Auto Confirm User**). Create 3 users:
   - `manager@gmail.com` (Иван Петров, manager)
   - `user1@gmail.com` (Алексей Смирнов, executor)
   - `user2@gmail.com` (Дмитрий Козлов, executor)

   The emails must match the ones in `supabase/seed.sql`, because the seed finds users by email.
4. **SQL Editor**: run the files below in this order:
   1. `supabase/migrations/20261108000000_init.sql` creates the schema, triggers, the status function and RLS.
   2. `supabase/seed.sql` creates profiles for the 3 users and demo data.
   3. `supabase/tests/security_checks.sql`: run the checks **one by one** and compare the results with the comments in the file.

## Local run

1. Copy `.env.example` to `.env.local` and fill in:
   - `VITE_SUPABASE_URL` is the project URL (Project Settings → Data API).
   - `VITE_SUPABASE_PUBLISHABLE_KEY` is the **publishable** (or anon) key. Never use the secret / service_role key.
2. `npm install`
3. `npm run dev` and open the URL it prints (usually http://localhost:5173).

Other commands: `npm run build`, `npm run lint`, `npm run preview`.

## Deploy

TBD. `vercel.json` already contains the SPA rewrite, so all routes go to `index.html`.

## Security model

- **Row Level Security** is on for all tables. A manager sees everything. An executor sees only
  their own tasks, only the objects where they have tasks, and only the history of their own tasks.
  Only a manager can create, edit and delete objects and tasks.
- **One status function**: status changes only through `change_task_status()`, which checks the
  allowed transitions and roles. A trigger blocks a direct `UPDATE` of `status`.
- **History is written only by the database** (triggers and the status function). There are no
  write privileges on `task_history` through the API.
- **Anonymous access is revoked**: the `anon` role has no privileges on any table or function.
- **No secret keys in the frontend**: the app uses only the public publishable/anon key.
  All protection is in the database, and the UI only hides buttons the user can't use.

See [DECISIONS.md](DECISIONS.md) for the product decisions.
