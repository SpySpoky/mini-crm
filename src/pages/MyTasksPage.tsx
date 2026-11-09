import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthContext";
import { toRussianError } from "../lib/errors";
import { formatDateTime } from "../lib/format";
import { STATUS_LABELS } from "../lib/statuses";
import StatusBadge from "../components/StatusBadge";
import type { Task, TaskStatus } from "../types";

const ALL_STATUSES = Object.keys(STATUS_LABELS) as TaskStatus[];

export default function MyTasksPage() {
  const { profile, isManager } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<Task[] | null>(null); // null = loading
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskStatus | "all">("all");

  const userId = profile?.id;

  useEffect(() => {
    if (!userId || isManager) return;
    let cancelled = false;

    async function load(executorId: string) {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, object:objects(name)")
        .eq("executor_id", executorId)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      setLoadError(error ? toRussianError(error) : null);
      setTasks((data as Task[] | null) ?? []);
    }

    load(userId);
    return () => {
      cancelled = true;
    };
  }, [userId, isManager]);

  // This page is for executors only
  if (isManager) return <Navigate to="/objects" replace />;

  const visibleTasks = tasks?.filter((t) => filter === "all" || t.status === filter) ?? [];

  return (
    <div>
      <h1>Мои задачи</h1>

      <div className="filters">
        <button
          className={filter === "all" ? "btn btn-primary" : "btn btn-secondary"}
          onClick={() => setFilter("all")}
        >
          Все
        </button>
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            className={filter === s ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => setFilter(s)}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {loadError && <p className="error">{loadError}</p>}

      {tasks === null ? (
        <p>Загрузка...</p>
      ) : visibleTasks.length === 0 ? (
        <p className="muted">Задач нет</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Задача</th>
              <th>Объект</th>
              <th>Статус</th>
              <th>Создана</th>
            </tr>
          </thead>
          <tbody>
            {visibleTasks.map((task) => (
              <tr key={task.id} className="clickable" onClick={() => navigate(`/tasks/${task.id}`)}>
                <td>{task.title}</td>
                <td>{task.object?.name ?? "—"}</td>
                <td>
                  <StatusBadge status={task.status} />
                </td>
                <td>{formatDateTime(task.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
