"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/hooks/useSession";
import Dialog, { DialogFooter, FormField, inputClassName, selectClassName, textareaClassName, checkboxClassName } from "@/components/Dialog";

type Status = { id: string; key: string; label: string; description?: string | null; type?: "ONBOARDING" | "OFFBOARDING" | null; orderIndex: number; active: boolean; isDone: boolean; isDefault: boolean };

type FormState = {
  id?: string;
  key: string;
  label: string;
  description: string;
  type: "" | "ONBOARDING" | "OFFBOARDING";
  orderIndex: string;
  active: boolean;
  isDone: boolean;
  isDefault: boolean;
};

const EMPTY: FormState = { key: "", label: "", description: "", type: "", orderIndex: "0", active: true, isDone: false, isDefault: false };

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

export default function StatusesPage() {
  const { user } = useSession();
  const isAdmin = user?.role === "ADMIN";

  const [items, setItems] = useState<Status[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/lifecycle/statuses", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Status[];
      setItems(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin]);

  const openCreate = () => { setForm({ ...EMPTY }); setDialogOpen(true); };
  const openEdit = (s: Status) => {
    setForm({ id: s.id, key: s.key, label: s.label, description: s.description ?? "", type: (s.type ?? "") as FormState["type"], orderIndex: String(s.orderIndex), active: s.active, isDone: s.isDone, isDefault: s.isDefault });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setForm({ ...EMPTY }); setSaving(false); };

  async function submit() {
    setSaving(true);
    try {
      const payload: any = {
        key: form.key.trim(),
        label: form.label.trim(),
        description: form.description.trim() || undefined,
        type: form.type || undefined,
        orderIndex: Number.parseInt(form.orderIndex, 10) || 0,
        active: form.active,
        isDone: form.isDone,
        isDefault: form.isDefault,
      };
      const method = form.id ? "PATCH" : "POST";
      if (form.id) payload.id = form.id;
      const res = await fetch("/api/admin/lifecycle/statuses", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
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

  const sorted = useMemo(() => items.slice().sort((a, b) => a.orderIndex - b.orderIndex || a.label.localeCompare(b.label)), [items]);

  const typeColors = {
    ONBOARDING: "bg-emerald-100 text-emerald-700 border-emerald-200",
    OFFBOARDING: "bg-rose-100 text-rose-700 border-rose-200",
  };

  if (!isAdmin) return <div className="p-6 text-sm text-red-600">Zugriff verweigert</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Lifecycle-Status</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Definiere Statuswerte inkl. Abschluss-Logik.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Neuer Status
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">{error}</div>}
      {loading && <div className="flex items-center gap-2 text-sm text-zinc-500"><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>Lade…</div>}

      <div className="grid gap-3">
        {sorted.map((s) => (
          <div key={s.id} className={`group flex items-center justify-between rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800 ${!s.active ? "opacity-60" : ""}`}>
            <div className="flex items-center gap-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.isDone ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`}>
                {s.isDone ? (
                  <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                )}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{s.label}</span>
                  <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">{s.key}</code>
                  {s.type && <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${typeColors[s.type]}`}>{s.type === "ONBOARDING" ? "Onboarding" : "Offboarding"}</span>}
                  {s.isDone && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">Erledigt</span>}
                  {s.isDefault && <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400">Standard</span>}
                  {!s.active && <span className="rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">Inaktiv</span>}
                </div>
                {s.description && <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{s.description}</p>}
              </div>
            </div>
            <button onClick={() => openEdit(s)} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 opacity-0 shadow-sm transition hover:bg-zinc-50 group-hover:opacity-100 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600">
              Bearbeiten
            </button>
          </div>
        ))}
        {sorted.length === 0 && !loading && (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center dark:border-zinc-700 dark:bg-zinc-800/50">
            <svg className="mx-auto h-12 w-12 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <h3 className="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">Keine Status vorhanden</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Erstellen Sie einen neuen Status, um loszulegen.</p>
          </div>
        )}
      </div>

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        title={form.id ? "Status bearbeiten" : "Neuer Status"}
        subtitle="Definieren Sie einen Status für Lifecycle-Aufgaben"
        icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        iconColor="amber"
        footer={
          <DialogFooter
            onCancel={closeDialog}
            onSave={submit}
            saving={saving}
          />
        }
      >
        <div className="grid gap-4">
          <FormField label="Schlüssel" required>
            <input className={inputClassName} placeholder="z.B. OPEN" value={form.key} onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))} />
          </FormField>
          <FormField label="Bezeichnung" required>
            <input className={inputClassName} placeholder="z.B. Offen" value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} />
          </FormField>
          <FormField label="Beschreibung">
            <textarea className={textareaClassName} placeholder="Optionale Beschreibung..." value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Typ">
              <select className={selectClassName} value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as FormState["type"] }))}>
                <option value="">Alle</option>
                <option value="ONBOARDING">Onboarding</option>
                <option value="OFFBOARDING">Offboarding</option>
              </select>
            </FormField>
            <FormField label="Reihenfolge">
              <input type="number" className={inputClassName} value={form.orderIndex} onChange={(e) => setForm((p) => ({ ...p, orderIndex: e.target.value }))} />
            </FormField>
          </div>
          <div className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className={checkboxClassName} checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Status ist aktiv</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-700" checked={form.isDone} onChange={(e) => setForm((p) => ({ ...p, isDone: e.target.checked }))} />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Markiert Aufgabe als erledigt</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700" checked={form.isDefault} onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))} />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Standardstatus für neue Aufgaben</span>
            </label>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
