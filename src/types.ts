export type UserRole = "manager" | "executor";

export type TaskStatus = "new" | "in_progress" | "review" | "accepted" | "rework";

export type Profile = {
    id: string;
    full_name: string;
    role: UserRole;
    created_at: string;
};

export type CrmObject = {
    id: string;
    name: string;
    address: string;
    created_by: string | null;
    created_at: string;
};

type PersonRef = { full_name: string };
type ObjectRef = { name: string };

export type Task = {
    id: string;
  title: string;
  description: string;
  object_id: string;
  executor_id: string;
  status: TaskStatus;
  author_id: string;
  created_at: string;
  updated_at: string;
  executor?: PersonRef | null;
  author?: PersonRef | null;
  object?: ObjectRef | null;
};

export type TaskHistory = {
  id: number;
  task_id: string;
  changed_by: string | null;
  from_status: TaskStatus | null;
  to_status: TaskStatus;
  comment: string | null;
  created_at: string;
  changed_by_profile?: PersonRef | null;
};