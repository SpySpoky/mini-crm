type ErrorLike = { message?: string; code?: string } | null | undefined;

// Exact database / Supabase messages -> Russian text for the user.
const MESSAGES: Record<string, string> = {
  "Invalid login credentials": "Неверный email или пароль",
  "Not authenticated": "Нужно войти в систему",
  "Not allowed": "Недостаточно прав для этого действия",
  "Task not found": "Задача не найдена",
  "Comment is required when returning a task": "При возврате на доработку нужен комментарий",
  "Status can only be changed via change_task_status()": "Статус можно менять только кнопками действий",
  "Author and creation date cannot be changed": "Автора и дату создания менять нельзя",
  "Accepted task cannot be edited": "Принятую задачу нельзя редактировать",
  "Assigned user is not an executor":
    "Исполнителем можно назначить только пользователя с ролью «Исполнитель»",
};

// Turns any Supabase / Postgres error into a Russian message.
export function toRussianError(error: ErrorLike): string {
  const message = error?.message ?? "";
  const code = error?.code ?? "";

  // Foreign key violation: the object still has tasks
  if (code === "23503") return "Нельзя удалить объект, у которого есть задачи";

  if (Object.hasOwn(MESSAGES, message)) return MESSAGES[message];

  if (message.startsWith("Transition")) return "Такой переход статуса запрещён";

  const lower = message.toLowerCase();
  if (code === "42501" || lower.includes("row-level security") || lower.includes("permission denied")) {
    return "Недостаточно прав для этого действия";
  }

  return "Произошла ошибка: " + (message || "неизвестная ошибка");
}
