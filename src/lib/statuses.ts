import type { TaskStatus } from "../types";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  review: "На проверке",
  accepted: "Принята",
  rework: "На доработке",
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  new: "#6b7280",
  in_progress: "#2563eb",
  review: "#d97706",
  accepted: "#16a34a",
  rework: "#dc2626"
};