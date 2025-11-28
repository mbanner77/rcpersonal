"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Status = { id: string; key: string; label: string; isDone: boolean };
type Role = { id: string; key: string; label: string };
type Employee = { id: string; firstName: string; lastName: string; email: string | null; startDate: string | null; exitDate: string | null };
type AvailableTemplate = { id: string; title: string; type: string; active: boolean };

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
type TemplateFilter = string | "ALL"; // templateId or ALL
type Template = { id: string; title: string };

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
  const [templateFilter, setTemplateFilter] = useState<TemplateFilter>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editOwnerRoleId, setEditOwnerRoleId] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [availableTemplates, setAvailableTemplates] = useState<AvailableTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(""); // empty = all templates
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<string | null>(null);
  const [showGeneratePanel, setShowGeneratePanel] = useState(false);
  const [allStatuses, setAllStatuses] = useState<Status[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);

  // Load all available statuses and roles on mount
  const loadStatusesAndRoles = useCallback(async () => {
    try {
      const [statusRes, roleRes] = await Promise.all([
        fetch("/api/admin/lifecycle/statuses"),
        fetch("/api/admin/lifecycle/roles"),
      ]);
      if (statusRes.ok) {
        const data = await statusRes.json();
        const list = Array.isArray(data) ? data : (data.data ?? []);
        setAllStatuses(list);
      }
      if (roleRes.ok) {
        const data = await roleRes.json();
        const list = Array.isArray(data) ? data : (data.data ?? []);
        setAllRoles(list);
      }
    } catch (err) {
      console.error("Failed to load statuses/roles:", err);
    }
  }, []);

  // Load statuses and roles on mount
  useEffect(() => {
    void loadStatusesAndRoles();
  }, [loadStatusesAndRoles]);

  // Load employees and templates for the generate panel
  const loadEmployeesAndTemplates = useCallback(async () => {
    try {
      // Load employees
      const empRes = await fetch("/api/employees");
      if (empRes.ok) {
        const data = await empRes.json();
        const list = Array.isArray(data) ? data : (data.data ?? []);
        setEmployees(list);
      }
      // Load templates for this task type
      const tplRes = await fetch(`/api/admin/lifecycle/templates?type=${taskType}`);
      if (tplRes.ok) {
        const tplData = await tplRes.json();
        const tplList = Array.isArray(tplData) ? tplData : (tplData.data ?? []);
        // Filter to only active templates
        setAvailableTemplates(tplList.filter((t: AvailableTemplate) => t.active));
      }
    } catch (err) {
      console.error("Failed to load employees/templates:", err);
    }
  }, [taskType]);

  // Generate tasks for an employee
  const generateTasks = async () => {
    if (!selectedEmployeeId) {
      console.warn("[generateTasks] No employee selected");
      return;
    }
    console.log("[generateTasks] Starting generation for employee:", selectedEmployeeId, "type:", taskType);
    setGenerating(true);
    setGenerateResult(null);
    try {
      const body: { employeeId: string; type: string; templateId?: string } = {
        employeeId: selectedEmployeeId,
        type: taskType,
      };
      if (selectedTemplateId) {
        body.templateId = selectedTemplateId;
      }
      console.log("[generateTasks] Sending request with body:", body);
      const res = await fetch("/api/lifecycle/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      console.log("[generateTasks] Response status:", res.status);
      const json = await res.json();
      console.log("[generateTasks] Response JSON:", json);
      if (!res.ok) {
        const errorMsg = typeof json?.error === "object" ? JSON.stringify(json.error) : (json?.error ?? "Fehler beim Generieren");
        throw new Error(errorMsg);
      }
      setGenerateResult(`${json.generated} Aufgaben erstellt`);
      setSelectedEmployeeId("");
      void load();
    } catch (err) {
      console.error("[generateTasks] Error:", err);
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
    if (showGeneratePanel) void loadEmployeesAndTemplates();
  }, [showGeneratePanel, loadEmployeesAndTemplates]);

  const resetFilters = () => {
    setStatusFilter("ALL");
    setOwnerFilter("ALL");
    setTemplateFilter("ALL");
    setAppliedSearch("");
    setSearchInput("");
  };

  const beginEdit = (task: Task) => {
    setEditingId(task.id);
    setEditNotes(task.notes ?? "");
    setEditDueDate(task.dueDate ? task.dueDate.slice(0, 10) : "");
    setEditOwnerRoleId(task.ownerRole?.id ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditNotes("");
    setEditDueDate("");
    setEditOwnerRoleId("");
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
      if (editOwnerRoleId) {
        payload.ownerRoleId = editOwnerRoleId;
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

  // Delete a task
  const deleteTask = async (id: string) => {
    if (!confirm("Aufgabe wirklich löschen?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/lifecycle/tasks`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      setTasks((current) => current.filter((task) => task.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aufgabe konnte nicht gelöscht werden");
    } finally {
      setDeletingId(null);
    }
  };

  // Ableitungen für Filter/Buttons
  const distinctStatuses: Status[] = useMemo(() => {
    const seen = new Map<string, Status>();
    for (const t of tasks) if (t.status && !seen.has(t.status.id)) seen.set(t.status.id, t.status);
    return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [tasks]);

  // Find the "done" status for the "Mark as done" button (use allStatuses to always find it)
  const doneStatus = useMemo(() => {
    return allStatuses.find(s => s.isDone) ?? null;
  }, [allStatuses]);
  const distinctRoles: Role[] = useMemo(() => {
    const seen = new Map<string, Role>();
    for (const t of tasks) if (t.ownerRole && !seen.has(t.ownerRole.id)) seen.set(t.ownerRole.id, t.ownerRole);
    return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [tasks]);

  const distinctTemplates: Template[] = useMemo(() => {
    const seen = new Map<string, Template>();
    for (const t of tasks) if (t.template && !seen.has(t.template.id)) seen.set(t.template.id, { id: t.template.id, title: t.template.title });
    return Array.from(seen.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [tasks]);

  // Filter tasks by template locally
  const filteredTasks = useMemo(() => {
    if (templateFilter === "ALL") return tasks;
    return tasks.filter(t => t.template?.id === templateFilter);
  }, [tasks, templateFilter]);

  // Statistics based on filtered tasks
  const statistics = useMemo(() => {
    const byStatus = new Map<string, number>();
    let total = 0;
    let overdue = 0;
    for (const t of filteredTasks) {
      total++;
      if (t.isOverdue) overdue++;
      const key = t.status?.label ?? "(kein Status)";
      byStatus.set(key, (byStatus.get(key) ?? 0) + 1);
    }
    return { total, overdue, byStatus };
  }, [filteredTasks]);

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
            Wählen Sie einen Mitarbeiter und optional eine bestimmte Vorlage aus, um Aufgaben zu erstellen.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-emerald-800">Mitarbeiter</span>
              <select
                className="min-w-[280px] rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-emerald-800">Vorlage</span>
              <select
                className="min-w-[250px] rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
              >
                <option value="">Alle aktiven Vorlagen ({availableTemplates.length})</option>
                {availableTemplates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={generateTasks}
              disabled={!selectedEmployeeId || generating || availableTemplates.length === 0}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title={!selectedEmployeeId ? "Bitte wählen Sie zuerst einen Mitarbeiter aus" : availableTemplates.length === 0 ? "Keine Vorlagen verfügbar" : ""}
            >
              {generating ? "Generiere…" : "Aufgaben generieren"}
            </button>
          </div>
          {/* Validation hints */}
          {!selectedEmployeeId && employees.length > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Bitte wählen Sie einen Mitarbeiter aus, um Aufgaben zu generieren.
            </div>
          )}
          {availableTemplates.length === 0 && employees.length > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Keine aktiven {taskType === "ONBOARDING" ? "Onboarding" : "Offboarding"}-Vorlagen gefunden. Bitte erstellen Sie zuerst Vorlagen im Lifecycle-Admin-Bereich.
            </div>
          )}
          {generateResult && (
            <div className={`mt-3 rounded border px-3 py-2 text-sm ${generateResult.includes("0 Aufgaben") || generateResult.toLowerCase().includes("fehler") ? "border-amber-300 bg-amber-50 text-amber-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>
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
        className="grid gap-4 rounded border border-zinc-200 bg-white p-4 text-sm md:grid-cols-5"
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
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">Vorlage</span>
          <select
            className="rounded border px-3 py-2"
            value={templateFilter}
            onChange={(event) => setTemplateFilter(event.target.value as TemplateFilter)}
          >
            <option value="ALL">Alle Vorlagen</option>
            {distinctTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
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
        {filteredTasks.map((task) => {
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
                  {/* Mark as Done button - only show if task is not done and doneStatus exists */}
                  {doneStatus && !task.status?.isDone && (
                    <button
                      type="button"
                      className="rounded bg-emerald-600 px-3 py-1.5 text-white transition hover:bg-emerald-700 disabled:opacity-50"
                      onClick={() => updateStatus(task.id, doneStatus.id)}
                      disabled={statusUpdatingId === task.id}
                    >
                      {statusUpdatingId === task.id ? "…" : "✓ Erledigt"}
                    </button>
                  )}
                  {/* Status dropdown for other status changes */}
                  <select
                    className="rounded border border-zinc-200 px-2 py-1.5 text-xs"
                    value={task.status?.id ?? ""}
                    onChange={(e) => e.target.value && updateStatus(task.id, e.target.value)}
                    disabled={statusUpdatingId === task.id}
                  >
                    <option value="" disabled>Status ändern...</option>
                    {allStatuses.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="rounded border px-2 py-1.5 hover:bg-zinc-100"
                    onClick={() => (isEditing ? cancelEdit() : beginEdit(task))}
                  >
                    {isEditing ? "Abbrechen" : "Bearbeiten"}
                  </button>
                  {/* Delete button */}
                  <button
                    type="button"
                    className="rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
                    onClick={() => deleteTask(task.id)}
                    disabled={deletingId === task.id}
                    title="Aufgabe löschen"
                  >
                    {deletingId === task.id ? "…" : "🗑"}
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
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-zinc-600">Zuständige Rolle</span>
                    <select
                      className="rounded border px-3 py-2"
                      value={editOwnerRoleId}
                      onChange={(event) => setEditOwnerRoleId(event.target.value)}
                    >
                      <option value="">-- Rolle wählen --</option>
                      {allRoles.map((r) => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
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
