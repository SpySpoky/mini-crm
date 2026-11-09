import type { Profile, Task, TaskStatus } from "../types";

export type TaskAction = {
  toStatus: TaskStatus;
  label: string;
  requiresComment: boolean;
};

// Which status buttons to show for this user and task.
// Mirrors change_task_status() in the database.
// NOTE: the database is the real protection; this only decides which buttons to show.
export function getAvailableActions(
  task: Pick<Task, "status" | "executor_id">,
  profile: Profile | null,
): TaskAction[] {
  if (!profile) return [];

  const isManager = profile.role === "manager";
  const isAssignedExecutor = task.executor_id === profile.id;

  switch (task.status) {
    case "new":
      return isAssignedExecutor
        ? [{ toStatus: "in_progress", label: "Взять в работу", requiresComment: false }]
        : [];
    case "in_progress":
      return isAssignedExecutor
        ? [{ toStatus: "review", label: "Отправить на проверку", requiresComment: false }]
        : [];
    case "review":
      return isManager
        ? [
            { toStatus: "accepted", label: "Принять", requiresComment: false },
            { toStatus: "rework", label: "Вернуть на доработку", requiresComment: true },
          ]
        : [];
    case "rework":
      return isAssignedExecutor
        ? [{ toStatus: "in_progress", label: "Вернуть в работу", requiresComment: false }]
        : [];
    case "accepted":
      return [];
  }
}
