import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthContext";
import { toRussianError } from "../lib/errors";
import type { CrmObject } from "../types";

// Object row + number of tasks the current user can see (RLS applies to the count too)
type ObjectRow = CrmObject & { tasks: { count: number }[] };

export default function ObjectsPage() {
  const { isManager } = useAuth();
  const navigate = useNavigate();

  const [objects, setObjects] = useState<ObjectRow[] | null>(null); // null = loading
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0); // change it to reload the list

  // "New object" form
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");

  // Inline edit: id of the object being edited
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");

  const [busy, setBusy] = useState(false); // a request is running
  const [actionError, setActionError] = useState<string | null>(null);

  // Load objects with task counts
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("objects")
        .select("*, tasks(count)")
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        setLoadError(toRussianError(error));
        setObjects([]);
      } else {
        setLoadError(null);
        setObjects(data as ObjectRow[]);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    const address = newAddress.trim();
    if (!name || !address) {
      setActionError("Заполните название и адрес");
      return;
    }

    setBusy(true);
    setActionError(null);
    const { error } = await supabase.from("objects").insert({ name, address });
    setBusy(false);

    if (error) {
      setActionError(toRussianError(error));
      return;
    }
    setNewName("");
    setNewAddress("");
    setReloadKey((k) => k + 1);
  }

  function startEdit(obj: ObjectRow) {
    setEditingId(obj.id);
    setEditName(obj.name);
    setEditAddress(obj.address);
    setActionError(null);
  }

  async function handleSaveEdit(id: string) {
    const name = editName.trim();
    const address = editAddress.trim();
    if (!name || !address) {
      setActionError("Заполните название и адрес");
      return;
    }

    setBusy(true);
    setActionError(null);
    const { error } = await supabase.from("objects").update({ name, address }).eq("id", id);
    setBusy(false);

    if (error) {
      setActionError(toRussianError(error));
      return;
    }
    setEditingId(null);
    setReloadKey((k) => k + 1);
  }

  async function handleDelete(obj: ObjectRow) {
    if (!confirm(`Удалить объект «${obj.name}»?`)) return;

    setBusy(true);
    setActionError(null);
    // Fails with code 23503 if the object still has tasks
    const { error } = await supabase.from("objects").delete().eq("id", obj.id);
    setBusy(false);

    if (error) {
      setActionError(toRussianError(error));
      return;
    }
    setReloadKey((k) => k + 1);
  }

  return (
    <div>
      <h1>Объекты</h1>

      {isManager && (
        <form className="card form form-inline" onSubmit={handleCreate}>
          <h2>Новый объект</h2>
          <input
            placeholder="Название"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            placeholder="Адрес"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={busy}>
            Создать
          </button>
        </form>
      )}

      {actionError && <p className="error">{actionError}</p>}
      {loadError && <p className="error">{loadError}</p>}

      {objects === null ? (
        <p>Загрузка...</p>
      ) : objects.length === 0 ? (
        <p className="muted">Объектов пока нет</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Название</th>
              <th>Адрес</th>
              <th>Задач</th>
              {isManager && <th></th>}
            </tr>
          </thead>
          <tbody>
            {objects.map((obj) =>
              editingId === obj.id ? (
                // Edit mode for this row
                <tr key={obj.id}>
                  <td>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </td>
                  <td>
                    <input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
                  </td>
                  <td>{obj.tasks[0]?.count ?? 0}</td>
                  <td className="actions">
                    <button className="btn btn-primary" disabled={busy} onClick={() => handleSaveEdit(obj.id)}>
                      Сохранить
                    </button>
                    <button className="btn btn-secondary" disabled={busy} onClick={() => setEditingId(null)}>
                      Отмена
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={obj.id} className="clickable" onClick={() => navigate(`/objects/${obj.id}`)}>
                  <td>{obj.name}</td>
                  <td>{obj.address}</td>
                  <td>{obj.tasks[0]?.count ?? 0}</td>
                  {isManager && (
                    // stopPropagation: clicking a button must not open the object card
                    <td className="actions" onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-secondary" disabled={busy} onClick={() => startEdit(obj)}>
                        Изменить
                      </button>
                      <button className="btn btn-danger" disabled={busy} onClick={() => handleDelete(obj)}>
                        Удалить
                      </button>
                    </td>
                  )}
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
