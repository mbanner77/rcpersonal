"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Status = { id: string; key: string; label: string; isDone: boolean };
type Role = { id: string; key: string; label: string };
type Employee = { id: string; firstName: string; lastName: string; email: string | null; startDate: string | null; exitDate: string | null };

type Task = {
  id: string;
  type: "ONBOARDING" | "OFFBOARDING";
  status: Status | null;
  ownerRole: Role | null;
  dueDate: string | null;
  notes: string | null;
  employee: { id: string; firstName: string; lastName: string; email: string | null };
  template: { id: string; title: string; type: "ONBOARDING" | "OFFBOARDING" };
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

type StatusFilter = string | "ALL"; // statusId or ALL
type OwnerFilter = string | "ALL"; // ownerRoleId or ALL

const statusClassesByDone: Record<"done" | "open", string> = {
  done: "border-emerald-200 bg-emerald-50 text-emerald-700",
  open: "border-amber-200 bg-amber-50 text-amber-800",
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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<string | null>(null);
  const [showGeneratePanel, setShowGeneratePanel] = useState(false);

  // Load employees for the generate panel
  const loadEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/employees");
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.data ?? []);
        setEmployees(list);
      }
    } catch (err) {
      console.error("Failed to load employees:", err);
    }
  }, []);

  // Generate tasks for an employee
  const generateTasks = async () => {
    if (!selectedEmployeeId) return;
    setGenerating(true);
    setGenerateResult(null);
    try {
      const res = await fetch("/api/lifecycle/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: selectedEmployeeId, type: taskType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Fehler beim Generieren");
      setGenerateResult(`${json.generated} Aufgaben erstellt`);
      setSelectedEmployeeId("");
      void load();
    } catch (err) {
      setGenerateResult(err instanceof Error ? err.message : "Fehler beim Generieren");
    } finally {
      setGenerating(false);
    }
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ type: taskType });
      if (statusFilter !== "ALL") params.set("statusId", statusFilter);
      if (ownerFilter !== "ALL") params.set("ownerRoleId", ownerFilter);
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

  useEffect(() => {
    if (showGeneratePanel) void loadEmployees();
  }, [showGeneratePanel, loadEmployees]);

  const statistics = useMemo(() => {
    const byStatus = new Map<string, number>();
    let total = 0;
    let overdue = 0;
    for (const t of tasks) {
      total++;
      if (t.isOverdue) overdue++;
      const key = t.status?.label ?? "(kein Status)";
      byStatus.set(key, (byStatus.get(key) ?? 0) + 1);
    }
    return { total, overdue, byStatus };
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

  const updateStatus = async (id: string, statusId: string) => {
    const previous = tasks;
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, status: task.status && task.status.id === statusId ? task.status : task.status } : task))
    );
    setStatusUpdatingId(id);
    try {
      const res = await fetch(`/api/lifecycle/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, statusId }),
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

  // Ableitungen für Filter/Buttons
  const distinctStatuses: Status[] = useMemo(() => {
    const seen = new Map<string, Status>();
    for (const t of tasks) if (t.status && !seen.has(t.status.id)) seen.set(t.status.id, t.status);
    return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [tasks]);
  const distinctRoles: Role[] = useMemo(() => {
    const seen = new Map<string, Role>();
    for (const t of tasks) if (t.ownerRole && !seen.has(t.ownerRole.id)) seen.set(t.ownerRole.id, t.ownerRole);
    return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [tasks]);

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
            onClick={() => setShowGeneratePanel(!showGeneratePanel)}
            className="rounded bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
          >
            {showGeneratePanel ? "Schließen" : "Aufgaben generieren"}
          </button>
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

      {showGeneratePanel && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-emerald-800">
            {taskType === "ONBOARDING" ? "Onboarding" : "Offboarding"}-Aufgaben für Mitarbeiter generieren
          </h3>
          <p className="mb-4 text-xs text-emerald-700">
            Wählen Sie einen Mitarbeiter aus, um basierend auf den aktiven Vorlagen automatisch Aufgaben zu erstellen.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-emerald-800">Mitarbeiter</span>
              <select
                className="min-w-[300px] rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
              >
                <option value="">Bitte wählen… ({employees.length} Mitarbeiter)</option>
                {employees.map((emp) => {
                  const hasRequiredDate = taskType === "ONBOARDING" ? emp.startDate : emp.exitDate;
                  const dateLabel = taskType === "ONBOARDING" 
                    ? (emp.startDate ? `Start: ${new Date(emp.startDate).toLocaleDateString()}` : "⚠️ Kein Startdatum")
                    : (emp.exitDate ? `Austritt: ${new Date(emp.exitDate).toLocaleDateString()}` : "⚠️ Kein Austrittsdatum");
                  return (
                    <option key={emp.id} value={emp.id} disabled={!hasRequiredDate}>
                      {emp.lastName}, {emp.firstName} — {dateLabel}
                    </option>
                  );
                })}
              </select>
            </label>
            <button
              type="button"
              onClick={generateTasks}
              disabled={!selectedEmployeeId || generating}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {generating ? "Generiere…" : "Aufgaben generieren"}
            </button>
          </div>
          {generateResult && (
            <div className="mt-3 rounded border border-emerald-300 bg-white px-3 py-2 text-sm text-emerald-800">
              {generateResult}
            </div>
          )}
          {employees.length === 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
              Lade Mitarbeiterliste… Falls keine Mitarbeiter angezeigt werden, prüfen Sie die Employees-Seite.
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3 rounded border border-zinc-200 bg-white p-3 text-xs md:grid-cols-3">
        <div className="rounded border border-zinc-100 bg-zinc-50 p-3">
          <div className="text-zinc-500">Gesamt</div>
          <div className="text-xl font-semibold">{statistics.total}</div>
        </div>
        <div className="rounded border border-amber-100 bg-amber-50 p-3">
          <div className="text-amber-600">Offen</div>
          <div className="text-xl font-semibold">{Array.from(statistics.byStatus.entries()).filter(([k]) => k !== "Erledigt").reduce((n, [, v]) => n + v, 0)}</div>
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
            {distinctStatuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
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
            {distinctRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
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
                    {task.ownerRole && (
                      <span className="rounded border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                        {task.ownerRole.label}
                      </span>
                    )}
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
                  {task.status && (
                    <span
                      className={`rounded border px-2 py-1 ${
                        (task.status.isDone ? statusClassesByDone.done : statusClassesByDone.open)
                      }`}
                    >
                      {task.status.label}
                    </span>
                  )}
                  {distinctStatuses.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`rounded border px-2 py-1 transition hover:bg-zinc-100 ${
                        task.status?.id === s.id ? "border-zinc-400" : "border-zinc-200"
                      }`}
                      onClick={() => updateStatus(task.id, s.id)}
                      disabled={statusUpdatingId === task.id}
                    >
                      {s.label}
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
