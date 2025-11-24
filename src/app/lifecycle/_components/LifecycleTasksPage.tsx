"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

const TASK_STATUSES = ["OPEN", "DONE", "BLOCKED"] as const;
const OWNER_ROLES = ["ADMIN", "HR", "PEOPLE_MANAGER", "TEAM_LEAD", "UNIT_LEAD"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type OwnerRole = (typeof OWNER_ROLES)[number];

type Task = {
  id: string;
  type: "ONBOARDING" | "OFFBOARDING";
  status: TaskStatus;
  ownerRole: OwnerRole;
  dueDate: string | null;
  notes: string | null;
  employee: { id: string; firstName: string; lastName: string; email: string | null };
  template: { id: string; title: string; ownerRole: OwnerRole; type: "ONBOARDING" | "OFFBOARDING" };
  createdAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
  isOverdue: boolean;
  isDueToday: boolean;
  daysUntilDue: number | null;
  overdueDays: number | null;
};

type Props = {
  taskType: "ONBOARDING" | "OFFBOARDING";
  title: string;
};

type StatusFilter = TaskStatus | "ALL";
type OwnerFilter = OwnerRole | "ALL";

const statusLabel: Record<TaskStatus, string> = {
  OPEN: "Offen",
  DONE: "Erledigt",
  BLOCKED: "Blockiert",
};

const ownerRoleLabel: Record<OwnerRole, string> = {
  ADMIN: "Admin",
  HR: "HR",
  PEOPLE_MANAGER: "People Manager",
  TEAM_LEAD: "Team Lead",
  UNIT_LEAD: "Unit Lead",
};

const statusClasses: Record<TaskStatus, string> = {
  OPEN: "border-amber-200 bg-amber-50 text-amber-800",
  DONE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  BLOCKED: "border-rose-200 bg-rose-50 text-rose-700",
};

function formatDueInfo(task: Task): string {
  if (!task.dueDate) {
    return "Kein Fälligkeitsdatum";
  }
  const date = new Date(task.dueDate);
  const dateStr = date.toLocaleDateString();
  if (task.isOverdue && typeof task.overdueDays === "number") {
    return `${dateStr} · ${task.overdueDays === 1 ? "1 Tag überfällig" : `${task.overdueDays} Tage überfällig`}`;
  }
  if (task.isDueToday) {
    return `${dateStr} · Heute fällig`;
  }
  if (typeof task.daysUntilDue === "number") {
    return `${dateStr} · in ${task.daysUntilDue === 1 ? "1 Tag" : `${task.daysUntilDue} Tagen`}`;
  }
  return dateStr;
}

function formatNotes(notes: string | null): string {
  if (!notes) return "Keine Notizen";
  return notes.trim() || "Keine Notizen";
}

export default function LifecycleTasksPage({ taskType, title }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ type: taskType });
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (ownerFilter !== "ALL") params.set("ownerRole", ownerFilter);
      if (appliedSearch.trim()) params.set("q", appliedSearch.trim());
      const res = await fetch(`/api/lifecycle/tasks?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as Task[];
      setTasks(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, [taskType, statusFilter, ownerFilter, appliedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const statistics = useMemo(() => {
    return tasks.reduce(
      (acc, task) => {
        acc.total += 1;
        acc.byStatus[task.status] = (acc.byStatus[task.status] ?? 0) + 1;
        if (task.isOverdue) acc.overdue += 1;
        return acc;
      },
      {
        total: 0,
        overdue: 0,
        byStatus: { OPEN: 0, DONE: 0, BLOCKED: 0 } as Record<TaskStatus, number>,
      }
    );
  }, [tasks]);

  const resetFilters = () => {
    setStatusFilter("ALL");
    setOwnerFilter("ALL");
    setAppliedSearch("");
    setSearchInput("");
  };

  const beginEdit = (task: Task) => {
    setEditingId(task.id);
    setEditNotes(task.notes ?? "");
    setEditDueDate(task.dueDate ? task.dueDate.slice(0, 10) : "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditNotes("");
    setEditDueDate("");
  };

  const updateStatus = async (id: string, status: TaskStatus) => {
    const previous = tasks;
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, status } : task)));
    setStatusUpdatingId(id);
    try {
      const res = await fetch(`/api/lifecycle/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const updated = (await res.json()) as Task;
      setTasks((current) => current.map((task) => (task.id === id ? updated : task)));
    } catch (err) {
      setTasks(previous);
      setError(err instanceof Error ? err.message : "Status konnte nicht aktualisiert werden");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSavingId(editingId);
    try {
      const payload: Record<string, unknown> = { id: editingId };
      payload.notes = editNotes.trim() ? editNotes.trim() : null;
      if (editDueDate) {
        payload.dueDate = new Date(`${editDueDate}T00:00:00`).toISOString();
      }
      const res = await fetch(`/api/lifecycle/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const updated = (await res.json()) as Task;
      setTasks((current) => current.map((task) => (task.id === updated.id ? updated : task)));
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Änderungen konnten nicht gespeichert werden");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-zinc-600">
            Verwalte Aufgaben für {taskType === "ONBOARDING" ? "den Start" : "den Austritt"} deiner Mitarbeitenden.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded border px-3 py-2 text-xs font-medium hover:bg-zinc-50"
            disabled={loading}
          >
            {loading ? "Aktualisiere…" : "Neu laden"}
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded border px-3 py-2 text-xs hover:bg-zinc-50"
          >
            Filter zurücksetzen
          </button>
        </div>
      </div>

      <div className="grid gap-3 rounded border border-zinc-200 bg-white p-3 text-xs md:grid-cols-3">
        <div className="rounded border border-zinc-100 bg-zinc-50 p-3">
          <div className="text-zinc-500">Gesamt</div>
          <div className="text-xl font-semibold">{statistics.total}</div>
        </div>
        <div className="rounded border border-amber-100 bg-amber-50 p-3">
          <div className="text-amber-600">Offen</div>
          <div className="text-xl font-semibold">{statistics.byStatus.OPEN}</div>
        </div>
        <div className="rounded border border-rose-100 bg-rose-50 p-3">
          <div className="text-rose-600">Überfällig</div>
          <div className="text-xl font-semibold">{statistics.overdue}</div>
        </div>
      </div>

      <form
        className="grid gap-4 rounded border border-zinc-200 bg-white p-4 text-sm md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          setAppliedSearch(searchInput.trim());
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">Status</span>
          <select
            className="rounded border px-3 py-2"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          >
            <option value="ALL">Alle</option>
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">Owner-Rolle</span>
          <select
            className="rounded border px-3 py-2"
            value={ownerFilter}
            onChange={(event) => setOwnerFilter(event.target.value as OwnerFilter)}
          >
            <option value="ALL">Alle Rollen</option>
            {OWNER_ROLES.map((role) => (
              <option key={role} value={role}>
                {ownerRoleLabel[role]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs font-medium text-zinc-600">Suche (Mitarbeiter oder Aufgabe)</span>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border px-3 py-2"
              value={searchInput}
              placeholder="z.B. Laptop oder Müller"
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <button
              type="submit"
              className="rounded bg-black px-4 py-2 text-xs font-medium text-white hover:bg-black/90"
            >
              Anwenden
            </button>
          </div>
        </label>
      </form>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="text-sm text-zinc-500">Lade Aufgaben…</div>}

      <div className="space-y-3">
        {tasks.map((task) => {
          const isEditing = editingId === task.id;
          const dueInfo = formatDueInfo(task);
          return (
            <div
              key={task.id}
              className={`rounded border p-4 shadow-sm transition ${
                task.isOverdue
                  ? "border-rose-200 bg-rose-50"
                  : task.isDueToday
                  ? "border-amber-200 bg-amber-50"
                  : "border-zinc-200 bg-white"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span className="truncate">{task.template.title}</span>
                    <span className="rounded border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                      {ownerRoleLabel[task.ownerRole]}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                    <span>
                      Für:
                      {" "}
                      <Link className="underline" href={`/employees/${task.employee.id}`}>
                        {task.employee.firstName} {task.employee.lastName}
                      </Link>
                    </span>
                    {task.employee.email && <span>({task.employee.email})</span>}
                    <span>Fällig: {dueInfo}</span>
                  </div>
                  {!isEditing && (
                    <div className="text-xs text-zinc-600">
                      Notiz: <span className="font-medium text-zinc-700">{formatNotes(task.notes)}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                  <span className={`rounded border px-2 py-1 ${statusClasses[task.status]}`}>
                    {statusLabel[task.status]}
                  </span>
                  {TASK_STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`rounded border px-2 py-1 transition hover:bg-zinc-100 ${
                        task.status === status ? "border-zinc-400" : "border-zinc-200"
                      }`}
                      onClick={() => updateStatus(task.id, status)}
                      disabled={statusUpdatingId === task.id}
                    >
                      {statusLabel[status]}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="rounded border px-2 py-1 hover:bg-zinc-100"
                    onClick={() => (isEditing ? cancelEdit() : beginEdit(task))}
                  >
                    {isEditing ? "Abbrechen" : "Bearbeiten"}
                  </button>
                </div>
              </div>

              {isEditing && (
                <div className="mt-4 grid gap-3 border-t pt-4 text-sm md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-zinc-600">Fälligkeitsdatum</span>
                    <input
                      type="date"
                      className="rounded border px-3 py-2"
                      value={editDueDate}
                      onChange={(event) => setEditDueDate(event.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1 md:col-span-2">
                    <span className="text-xs font-medium text-zinc-600">Notizen</span>
                    <textarea
                      className="min-h-[80px] rounded border px-3 py-2"
                      value={editNotes}
                      onChange={(event) => setEditNotes(event.target.value)}
                    />
                  </label>
                  <div className="md:col-span-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      className="rounded border px-3 py-2 text-xs hover:bg-zinc-100"
                      onClick={cancelEdit}
                      disabled={savingId === task.id}
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      className="rounded bg-black px-4 py-2 text-xs font-medium text-white hover:bg-black/90 disabled:opacity-60"
                      onClick={saveEdit}
                      disabled={savingId === task.id}
                    >
                      {savingId === task.id ? "Speichere…" : "Speichern"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!loading && tasks.length === 0 && (
          <div className="rounded border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
            Keine Aufgaben für die gewählten Filter gefunden.
          </div>
        )}
      </div>
    </div>
  );
}
