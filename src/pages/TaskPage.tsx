import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthContext";
import { toRussianError } from "../lib/errors";
import { formatDateTime } from "../lib/format";
import { STATUS_LABELS } from "../lib/statuses";
import { getAvailableActions, type TaskAction } from "../lib/workflow";
import StatusBadge from "../components/StatusBadge";
import type { Profile, Task, TaskHistory, TaskStatus } from "../types";

// "22P02" = the id in the URL is not a valid uuid -> treat as "not found"
const INVALID_ID = "22P02";

export default function TaskPage() {
  const { id = "" } = useParams();
  const { profile, isManager } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<Task | null>(null); // null after loading = not found
  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [busy, setBusy] = useState(false); // a request is running
  const [actionError, setActionError] = useState<string | null>(null);

  // "Return for rework" comment box
  const [reworkOpen, setReworkOpen] = useState(false);
  const [reworkComment, setReworkComment] = useState("");

  // Edit form (manager only)
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editExecutorId, setEditExecutorId] = useState("");
  const [executors, setExecutors] = useState<Pick<Profile, "id" | "full_name">[]>([]);

  // Load the task and its history
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [taskRes, historyRes] = await Promise.all([
        supabase
          .from("tasks")
          .select(
            "*, executor:profiles!tasks_executor_id_fkey(full_name), author:profiles!tasks_author_id_fkey(full_name), object:objects(name)",
          )
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("task_history")
          .select("*, changed_by_profile:profiles!task_history_changed_by_fkey(full_name)")
          .eq("task_id", id)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false }),
      ]);

      if (cancelled) return;

      const error = taskRes.error ?? historyRes.error;
      if (error && error.code !== INVALID_ID) {
        setLoadError(toRussianError(error));
      } else {
        setLoadError(null);
      }
      setTask((taskRes.data as Task | null) ?? null);
      setHistory((historyRes.data as TaskHistory[] | null) ?? []);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  // Manager needs the executors list for the edit form
  useEffect(() => {
    if (!isManager) return;
    let cancelled = false;

    async function loadExecutors() {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "executor")
        .order("full_name");
      if (!cancelled) setExecutors(data ?? []);
    }

    loadExecutors();
    return () => {
      cancelled = true;
    };
  }, [isManager]);

  // The ONLY way to change status: the database function change_task_status
  async function changeStatus(toStatus: TaskStatus, comment: string | null) {
    setBusy(true);
    setActionError(null);
    const { error } = await supabase.rpc("change_task_status", {
      p_task_id: id,
      p_new_status: toStatus,
      p_comment: comment,
    });
    setBusy(false);

    if (error) {
      setActionError(toRussianError(error));
      return;
    }
    setReworkOpen(false);
    setReworkComment("");
    setReloadKey((k) => k + 1); // reload task and history
  }

  function handleActionClick(action: TaskAction) {
    if (action.requiresComment) {
      setReworkOpen(true); // ask for a comment first
    } else {
      changeStatus(action.toStatus, null);
    }
  }

  function startEdit() {
    if (!task) return;
    setEditTitle(task.title);
    setEditDescription(task.description);
    setEditExecutorId(task.executor_id);
    setActionError(null);
    setEditing(true);
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    const title = editTitle.trim();
    if (!title) {
      setActionError("Введите название задачи");
      return;
    }

    setBusy(true);
    setActionError(null);
    const { data, error } = await supabase
      .from("tasks")
      .update({ title, description: editDescription.trim(), executor_id: editExecutorId })
      .eq("id", id)
      .select();
    setBusy(false);

    if (error) {
      setActionError(toRussianError(error));
      return;
    }
    if (!data || data.length === 0) {
      // RLS silently updated nothing
      setActionError("Недостаточно прав для этого действия");
      return;
    }
    setEditing(false);
    setReloadKey((k) => k + 1);
  }

  async function handleDelete() {
    if (!task) return;
    if (!confirm(`Удалить задачу «${task.title}»?`)) return;

    setBusy(true);
    setActionError(null);
    // RLS allows deleting only "new" tasks; otherwise 0 rows are deleted without an error
    const { data, error } = await supabase.from("tasks").delete().eq("id", id).select();
    setBusy(false);

    if (error) {
      setActionError(toRussianError(error));
      return;
    }
    if (!data || data.length === 0) {
      setActionError("Удалить можно только задачу в статусе «Новая»");
      return;
    }
    navigate(`/objects/${task.object_id}`, { replace: true });
  }

  if (loading) return <p>Загрузка...</p>;
  if (loadError) return <p className="error">{loadError}</p>;
  if (!task) return <p>Задача не найдена</p>;

  const actions = getAvailableActions(task, profile);

  return (
    <div>
      <p>
        <Link to={`/objects/${task.object_id}`}>← {task.object?.name ?? "Объект"}</Link>
      </p>

      <h1>
        {task.title} <StatusBadge status={task.status} />
      </h1>

      <div className="card">
        <dl className="details">
          <dt>Описание</dt>
          <dd className="pre-wrap">{task.description || "—"}</dd>
          <dt>Объект</dt>
          <dd>
            <Link to={`/objects/${task.object_id}`}>{task.object?.name ?? "—"}</Link>
          </dd>
          <dt>Исполнитель</dt>
          <dd>{task.executor?.full_name ?? "—"}</dd>
          <dt>Автор</dt>
          <dd>{task.author?.full_name ?? "—"}</dd>
          <dt>Создана</dt>
          <dd>{formatDateTime(task.created_at)}</dd>
        </dl>
      </div>

      {/* Status buttons */}
      {actions.length > 0 && (
        <div className="actions">
          {actions.map((action) => (
            <button
              key={action.toStatus}
              className={action.requiresComment ? "btn btn-danger" : "btn btn-primary"}
              disabled={busy}
              onClick={() => handleActionClick(action)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {reworkOpen && (
        <div className="card form">
          <label>
            Комментарий (что нужно исправить)
            <textarea rows={3} value={reworkComment} onChange={(e) => setReworkComment(e.target.value)} />
          </label>
          <div className="actions">
            <button
              className="btn btn-danger"
              disabled={busy || reworkComment.trim() === ""}
              onClick={() => changeStatus("rework", reworkComment.trim())}
            >
              Подтвердить возврат
            </button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => setReworkOpen(false)}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Manager tools */}
      {isManager && !editing && (
        <div className="actions">
          {task.status !== "accepted" && (
            <button className="btn btn-secondary" disabled={busy} onClick={startEdit}>
              Редактировать
            </button>
          )}
          {task.status === "new" && (
            <button className="btn btn-danger" disabled={busy} onClick={handleDelete}>
              Удалить
            </button>
          )}
        </div>
      )}

      {isManager && editing && task.status !== "accepted" && (
        <form className="card form" onSubmit={handleSaveEdit}>
          <h2>Редактирование</h2>
          <label>
            Название
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          </label>
          <label>
            Описание
            <textarea rows={3} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
          </label>
          <label>
            Исполнитель
            <select value={editExecutorId} onChange={(e) => setEditExecutorId(e.target.value)}>
              {executors.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.full_name}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              Сохранить
            </button>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setEditing(false)}>
              Отмена
            </button>
          </div>
        </form>
      )}

      {actionError && <p className="error">{actionError}</p>}

      <h2>История</h2>
      {history.length === 0 ? (
        <p className="muted">Записей нет</p>
      ) : (
        <ul className="history">
          {history.map((h) => (
            <li key={h.id}>
              <span className="muted">{formatDateTime(h.created_at)}</span>{" "}
              <strong>{h.changed_by_profile?.full_name ?? "—"}</strong>:{" "}
              {h.from_status === null
                ? "Создана"
                : `${STATUS_LABELS[h.from_status]} → ${STATUS_LABELS[h.to_status]}`}
              {h.comment && <div className="comment">«{h.comment}»</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
