"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/hooks/useSession";

type ReminderType = "GEHALT" | "MEILENSTEIN" | "SONDERBONUS" | "STAFFELBONUS" | "URLAUBSGELD" | "WEIHNACHTSGELD";

type Employee = { id: string; firstName: string; lastName: string; email: string | null };

type Schedule = { label: string; daysBefore: number; timeOfDay?: string | null; orderIndex?: number };

type Recipient = { email: string; orderIndex?: number };

type Reminder = {
  id: string;
  type: ReminderType;
  description?: string | null;
  employeeId: string;
  dueDate: string;
  active: boolean;
  employee?: Employee;
  schedules: Array<Required<Schedule>>;
  recipients: Array<Required<Recipient>>;
};

type FormState = {
  id?: string;
  type: ReminderType;
  description: string;
  employeeId: string;
  dueDate: string; // yyyy-mm-dd
  active: boolean;
  schedules: Schedule[];
  recipients: Recipient[];
};

const TYPES: ReminderType[] = ["GEHALT", "MEILENSTEIN", "SONDERBONUS", "STAFFELBONUS", "URLAUBSGELD", "WEIHNACHTSGELD"];

const EMPTY: FormState = {
  type: "GEHALT",
  description: "",
  employeeId: "",
  dueDate: new Date().toISOString().slice(0, 10),
  active: true,
  schedules: [
    { label: "1 Woche vorher", daysBefore: 7, timeOfDay: "09:00", orderIndex: 0 },
    { label: "1 Tag vorher", daysBefore: 1, timeOfDay: "09:00", orderIndex: 1 },
    { label: "Fälligkeit", daysBefore: 0, timeOfDay: "09:00", orderIndex: 2 },
  ],
  recipients: [],
};

function parseApiError(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (Array.isArray(error)) return (error as unknown[]).map((e) => parseApiError(e, "")).filter(Boolean).join("\n") || fallback;
  if (typeof error === "object") {
    const msg = (error as any).message;
    if (typeof msg === "string" && msg.trim()) return msg;
    const f = (error as any).formErrors ?? [];
    const r = (error as any).fieldErrors ?? {};
    const all = [...f, ...Object.values(r).flat()];
    if (all.length) return all.join("\n");
  }
  return fallback;
}

export default function RemindersPage() {
  const { user } = useSession();
  const isAllowed = user?.role === "ADMIN" || user?.role === "UNIT_LEAD";

  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/reminders", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Reminder[];
      setItems(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }

  async function loadEmployees() {
    try {
      setEmployeesLoading(true);
      const res = await fetch("/api/employees", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setEmployees(
          (data as any[]).map((r) => ({ id: r.id, firstName: r.firstName, lastName: r.lastName, email: r.email ?? null }))
        );
      }
    } finally {
      setEmployeesLoading(false);
    }
  }

  useEffect(() => {
    if (isAllowed) {
      void load();
      void loadEmployees();
    }
  }, [isAllowed]);

  const sorted = useMemo(
    () => items.slice().sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
    [items]
  );

  const openCreate = () => {
    setForm({ ...EMPTY });
    setDialogOpen(true);
  };

  const openEdit = (r: Reminder) => {
    setForm({
      id: r.id,
      type: r.type,
      description: r.description ?? "",
      employeeId: r.employeeId,
      dueDate: r.dueDate.substring(0, 10),
      active: r.active,
      schedules: r.schedules.map((s) => ({ label: s.label, daysBefore: s.daysBefore, timeOfDay: s.timeOfDay ?? null, orderIndex: s.orderIndex })),
      recipients: r.recipients.map((x) => ({ email: x.email, orderIndex: x.orderIndex })),
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setForm({ ...EMPTY });
    setSaving(false);
  };

  async function submit() {
    setSaving(true);
    try {
      // Parse semicolon-separated emails into individual recipient entries
      const allRecipients: Recipient[] = [];
      form.recipients.forEach((r) => {
        const emails = r.email.split(/[;,]/).map((e) => e.trim()).filter(Boolean);
        emails.forEach((email) => allRecipients.push({ email, orderIndex: allRecipients.length }));
      });
      if (allRecipients.length === 0) {
        throw new Error("Mindestens ein Empfänger erforderlich");
      }
      const payload = {
        ...(form.id ? { id: form.id } : {}),
        type: form.type,
        description: form.description.trim() || undefined,
        employeeId: form.employeeId,
        dueDate: new Date(form.dueDate),
        active: form.active,
        schedules: form.schedules.map((s, i) => ({ label: s.label.trim(), daysBefore: s.daysBefore | 0, timeOfDay: s.timeOfDay?.trim() || undefined, orderIndex: s.orderIndex ?? i })),
        recipients: allRecipients,
      };
      const method = form.id ? "PATCH" : "POST";
      const res = await fetch("/api/admin/reminders", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(parseApiError(json?.error ?? json, "Speichern fehlgeschlagen"));
      await load();
      closeDialog();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Wirklich löschen?")) return;
    const res = await fetch("/api/admin/reminders", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    if (res.ok) await load();
  }

  const typeColors: Record<ReminderType, string> = {
    GEHALT: "bg-emerald-100 text-emerald-800 border-emerald-200",
    MEILENSTEIN: "bg-blue-100 text-blue-800 border-blue-200",
    SONDERBONUS: "bg-purple-100 text-purple-800 border-purple-200",
    STAFFELBONUS: "bg-indigo-100 text-indigo-800 border-indigo-200",
    URLAUBSGELD: "bg-amber-100 text-amber-800 border-amber-200",
    WEIHNACHTSGELD: "bg-rose-100 text-rose-800 border-rose-200",
  };

  const typeLabels: Record<ReminderType, string> = {
    GEHALT: "Gehalt",
    MEILENSTEIN: "Meilenstein",
    SONDERBONUS: "Sonderbonus",
    STAFFELBONUS: "Staffelbonus",
    URLAUBSGELD: "Urlaubsgeld",
    WEIHNACHTSGELD: "Weihnachtsgeld",
  };

  if (!isAllowed) return <div className="p-6 text-sm text-red-600">Zugriff verweigert</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Erinnerungen</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Einmalige Erinnerungen mit mehreren Hinweisen und Empfängern.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Neue Erinnerung
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">{error}</div>}
      {loading && <div className="flex items-center gap-2 text-sm text-zinc-500"><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>Lade…</div>}

      <div className="grid gap-4">
        {sorted.map((r) => {
          const emp = employees.find((x) => x.id === r.employeeId);
          const dueDate = new Date(r.dueDate);
          const isPast = dueDate < new Date();
          return (
            <div key={r.id} className={`group rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800 ${!r.active ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${typeColors[r.type]}`}>
                      {typeLabels[r.type]}
                    </span>
                    {!r.active && <span className="rounded-full border border-zinc-300 bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">Inaktiv</span>}
                    {isPast && r.active && <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">Überfällig</span>}
                  </div>
                  <div>
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{r.description || "Keine Beschreibung"}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                      <span className="flex items-center gap-1.5">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        {emp ? `${emp.firstName} ${emp.lastName}` : "—"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        {dueDate.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        {r.schedules.length} {r.schedules.length === 1 ? "Erinnerung" : "Erinnerungen"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        {r.recipients.length} {r.recipients.length === 1 ? "Empfänger" : "Empfänger"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
                  <button onClick={() => openEdit(r)} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600">
                    Bearbeiten
                  </button>
                  <button onClick={() => remove(r.id)} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 shadow-sm transition hover:bg-red-50 dark:border-red-800 dark:bg-zinc-700 dark:text-red-400 dark:hover:bg-red-900/20">
                    Löschen
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && !loading && (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center dark:border-zinc-700 dark:bg-zinc-800/50">
            <svg className="mx-auto h-12 w-12 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            <h3 className="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">Keine Erinnerungen</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Erstellen Sie eine neue Erinnerung, um loszulegen.</p>
            <button onClick={openCreate} className="mt-4 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
              Neue Erinnerung erstellen
            </button>
          </div>
        )}
      </div>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-800">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{form.id ? "Erinnerung bearbeiten" : "Neue Erinnerung"}</h2>
              <button onClick={closeDialog} className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-200">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Typ</span>
                <select className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 transition focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white dark:focus:border-white dark:focus:ring-white/10" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as ReminderType }))}>
                  {TYPES.map((t) => (
                    <option key={t} value={t}>{typeLabels[t]}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Fälligkeit</span>
                <input type="date" className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 transition focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white dark:focus:border-white dark:focus:ring-white/10" value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} />
              </label>
              <label className="col-span-2 flex flex-col gap-1.5">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Beschreibung</span>
                <textarea className="min-h-[70px] rounded-lg border border-zinc-300 bg-white px-3 py-2.5 transition focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white dark:focus:border-white dark:focus:ring-white/10" placeholder="Wofür ist diese Erinnerung?" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
              </label>
              <label className="col-span-2 flex flex-col gap-1.5">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Berechtigter Mitarbeiter</span>
                <select className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 transition focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white dark:focus:border-white dark:focus:ring-white/10" value={form.employeeId} onChange={(e) => setForm((p) => ({ ...p, employeeId: e.target.value }))}>
                  <option value="">Bitte wählen…</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.lastName}, {e.firstName}{e.email ? ` (${e.email})` : ""}
                    </option>
                  ))}
                </select>
                {employeesLoading && <span className="text-xs text-zinc-500 dark:text-zinc-400">Lade Mitarbeitende…</span>}
              </label>
              <label className="col-span-2 flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800">
                <input type="checkbox" className="h-4 w-4 rounded border-zinc-300 text-black focus:ring-black dark:border-zinc-600 dark:bg-zinc-700" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Erinnerung ist aktiv</span>
              </label>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-6">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Erinnerungszeitpunkte</h3>
                  <button
                    className="flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
                    onClick={() => setForm((p) => ({ ...p, schedules: [...p.schedules, { label: "Neue Erinnerung", daysBefore: 0, timeOfDay: "09:00", orderIndex: p.schedules.length }] }))}
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Hinzufügen
                  </button>
                </div>
                <div className="space-y-2">
                  {form.schedules.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input className="flex-[3] rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm transition focus:border-black focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-white" placeholder="Bezeichnung" value={s.label} onChange={(e) => setForm((p) => { const list = p.schedules.slice(); list[i] = { ...list[i], label: e.target.value }; return { ...p, schedules: list }; })} />
                      <input type="number" className="w-16 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm transition focus:border-black focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-white" placeholder="Tage" value={s.daysBefore} onChange={(e) => setForm((p) => { const list = p.schedules.slice(); list[i] = { ...list[i], daysBefore: Number(e.target.value) }; return { ...p, schedules: list }; })} />
                      <input className="w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm transition focus:border-black focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-white" placeholder="HH:mm" value={s.timeOfDay ?? ""} onChange={(e) => setForm((p) => { const list = p.schedules.slice(); list[i] = { ...list[i], timeOfDay: e.target.value || null }; return { ...p, schedules: list }; })} />
                      <button className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => setForm((p) => ({ ...p, schedules: p.schedules.filter((_, idx) => idx !== i) }))}>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Empfänger</h3>
                  <button
                    className="flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
                    onClick={() => setForm((p) => ({ ...p, recipients: [...p.recipients, { email: "" }] }))}
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Hinzufügen
                  </button>
                </div>
                <div className="space-y-2">
                  {form.recipients.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input className="flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm transition focus:border-black focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-white" placeholder="E-Mail (mehrere per ; trennen)" value={r.email} onChange={(e) => setForm((p) => { const list = p.recipients.slice(); list[i] = { ...list[i], email: e.target.value }; return { ...p, recipients: list }; })} />
                      <button className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => setForm((p) => ({ ...p, recipients: p.recipients.filter((_, idx) => idx !== i) }))}>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  ))}
                  {form.recipients.length === 0 && (
                    <div className="text-xs text-zinc-600">Tipp: Mehrere Adressen per Semikolon einfügen.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={closeDialog} className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600">Abbrechen</button>
              <button onClick={submit} disabled={saving || !form.employeeId} className="rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200">{saving ? "Speichern…" : "Speichern"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
