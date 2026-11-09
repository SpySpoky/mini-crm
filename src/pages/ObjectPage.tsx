import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthContext";
import { toRussianError } from "../lib/errors";
import { formatDateTime } from "../lib/format";
import StatusBadge from "../components/StatusBadge";
import type { CrmObject, Profile, Task } from "../types";

// "22P02" = the id in the URL is not a valid uuid -> treat as "not found"
const INVALID_ID = "22P02";

export default function ObjectPage() {
  const { id = "" } = useParams();
  const { isManager } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [object, setObject] = useState<CrmObject | null>(null); // null after loading = not found
  const [tasks, setTasks] = useState<Task[]>([]);
  const [executors, setExecutors] = useState<Pick<Profile, "id" | "full_name">[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // "New task" form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [executorId, setExecutorId] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Object and its tasks in parallel. RLS shows the executor only his own tasks.
      const [objectRes, tasksRes] = await Promise.all([
        supabase.from("objects").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("tasks")
          .select("*, executor:profiles!tasks_executor_id_fkey(full_name)")
          .eq("object_id", id)
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;

      const error = objectRes.error ?? tasksRes.error;
      if (error && error.code !== INVALID_ID) {
        setLoadError(toRussianError(error));
      } else {
        setLoadError(null);
      }
      setObject((objectRes.data as CrmObject | null) ?? null);
      setTasks((tasksRes.data as Task[] | null) ?? []);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  // Manager needs the list of executors for the "New task" form
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

  async function handleCreateTask(e: FormEvent) {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFormError("Введите название задачи");
      return;
    }
    if (!executorId) {
      setFormError("Выберите исполнителя");
      return;
    }

    setBusy(true);
    setFormError(null);
    // status, author and dates are set by the database
    const { error } = await supabase.from("tasks").insert({
      title: cleanTitle,
      description: description.trim(),
      object_id: id,
      executor_id: executorId,
    });
    setBusy(false);

    if (error) {
      setFormError(toRussianError(error));
      return;
    }
    setTitle("");
    setDescription("");
    setExecutorId("");
    setReloadKey((k) => k + 1);
  }

  if (loading) return <p>Загрузка...</p>;
  if (loadError) return <p className="error">{loadError}</p>;
  if (!object) return <p>Объект не найден</p>;

  return (
    <div>
      <p>
        <Link to="/objects">← Все объекты</Link>
      </p>
      <h1>{object.name}</h1>
      <p className="muted">{object.address}</p>

      {isManager && (
        <form className="card form" onSubmit={handleCreateTask}>
          <h2>Новая задача</h2>
          <label>
            Название
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Описание
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label>
            Исполнитель
            <select value={executorId} onChange={(e) => setExecutorId(e.target.value)}>
              <option value="">— выберите —</option>
              {executors.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.full_name}
                </option>
              ))}
            </select>
          </label>
          {formError && <p className="error">{formError}</p>}
          <div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Создание..." : "Создать задачу"}
            </button>
          </div>
        </form>
      )}

      <h2>Задачи</h2>
      {tasks.length === 0 ? (
        <p className="muted">Задач пока нет</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Задача</th>
              <th>Исполнитель</th>
              <th>Статус</th>
              <th>Создана</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className="clickable" onClick={() => navigate(`/tasks/${task.id}`)}>
                <td>{task.title}</td>
                <td>{task.executor?.full_name ?? "—"}</td>
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
