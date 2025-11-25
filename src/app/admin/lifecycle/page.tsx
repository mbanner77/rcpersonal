"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/hooks/useSession";

type TemplateType = "ONBOARDING" | "OFFBOARDING";

type Role = { id: string; key: string; label: string };

type LifecycleTemplate = {
  id: string;
  title: string;
  description: string | null;
  type: TemplateType;
  ownerRole: Role;
  relativeDueDays: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  title: string;
  description: string;
  type: TemplateType;
  ownerRoleId: string;
  relativeDueDays: string;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  type: "ONBOARDING",
  ownerRoleId: "",
  relativeDueDays: "0",
  active: true,
};

const TYPE_LABELS: Record<TemplateType, string> = {
  ONBOARDING: "Onboarding",
  OFFBOARDING: "Offboarding",
};

// Rollen werden dynamisch geladen

function parseApiError(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (Array.isArray(error)) {
    const messages = error
      .map((item) => parseApiError(item, ""))
      .filter((msg): msg is string => Boolean(msg));
    if (messages.length) return messages.join("\n");
    return fallback;
  }
  if (typeof error === "object") {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage;
    }
    const formErrors = (error as { formErrors?: string[] }).formErrors ?? [];
    const fieldErrorsRecord = (error as { fieldErrors?: Record<string, string[]> }).fieldErrors ?? {};
    const fieldErrors = Object.values(fieldErrorsRecord).flat().filter(Boolean);
    const combined = [...formErrors, ...fieldErrors];
    if (combined.length) {
      return combined.join("\n");
    }
  }
  return fallback;
}

export default function AdminLifecyclePage() {
  const { user, loading: sessionLoading, error: sessionError } = useSession();
  const [templates, setTemplates] = useState<LifecycleTemplate[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<LifecycleTemplate | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<TemplateType | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState(""
  );

  const isAdmin = user?.role === "ADMIN";

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/lifecycle/templates");
      if (!res.ok) {
        throw new Error(`Vorlagen konnten nicht geladen werden (${res.status})`);
      }
      const json = (await res.json()) as LifecycleTemplate[];
      setTemplates(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const res = await fetch("/api/admin/lifecycle/roles");
      if (!res.ok) throw new Error(`Rollen konnten nicht geladen werden (${res.status})`);
      const data = (await res.json()) as Role[];
      setRoles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    void loadTemplates();
    void loadRoles();
  }, [isAdmin]);

  const filteredTemplates = useMemo(() => {
    const query = appliedSearch.trim().toLowerCase();
    return templates
      .filter((tpl) => (filterType === "ALL" ? true : tpl.type === filterType))
      .filter((tpl) =>
        query
          ? tpl.title.toLowerCase().includes(query) || (tpl.description?.toLowerCase() ?? "").includes(query)
          : true
      )
      .sort((a, b) => {
        if (a.type === b.type) return a.title.localeCompare(b.title);
        return a.type.localeCompare(b.type);
      });
  }, [templates, filterType, appliedSearch]);

  const openCreate = () => {
    setDialogMode("create");
    setActiveTemplate(null);
    setForm({ ...EMPTY_FORM });
  };

  const openEdit = (tpl: LifecycleTemplate) => {
    setDialogMode("edit");
    setActiveTemplate(tpl);
    setForm({
      title: tpl.title,
      description: tpl.description ?? "",
      type: tpl.type,
      ownerRoleId: tpl.ownerRole.id,
      relativeDueDays: String(tpl.relativeDueDays),
      active: tpl.active,
    });
  };

  const closeDialog = () => {
    setDialogMode(null);
    setActiveTemplate(null);
    setForm({ ...EMPTY_FORM });
    setSaving(false);
  };

  const submitCreate = async () => {
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() ? form.description.trim() : undefined,
        type: form.type,
        ownerRoleId: form.ownerRoleId,
        relativeDueDays: Number.parseInt(form.relativeDueDays, 10) || 0,
        active: form.active,
      };
      const res = await fetch("/api/admin/lifecycle/templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const message = parseApiError(json?.error ?? json, "Vorlage konnte nicht angelegt werden");
        throw new Error(message);
      }
      setTemplates((prev) => [...prev, json as LifecycleTemplate]);
      closeDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const submitUpdate = async () => {
    if (!activeTemplate) return;
    setSaving(true);
    try {
      const payload = {
        id: activeTemplate.id,
        title: form.title.trim(),
        description: form.description.trim() ? form.description.trim() : null,
        type: form.type,
        ownerRoleId: form.ownerRoleId,
        relativeDueDays: Number.parseInt(form.relativeDueDays, 10) || 0,
        active: form.active,
      };
      const res = await fetch("/api/admin/lifecycle/templates", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const message = parseApiError(json?.error ?? json, "Vorlage konnte nicht aktualisiert werden");
        throw new Error(message);
      }
      setTemplates((prev) => prev.map((tpl) => (tpl.id === activeTemplate.id ? (json as LifecycleTemplate) : tpl)));
      closeDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (tpl: LifecycleTemplate) => {
    try {
      const res = await fetch("/api/admin/lifecycle/templates", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: tpl.id, active: !tpl.active }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const message = parseApiError(json?.error ?? json, "Status konnte nicht geändert werden");
        throw new Error(message);
      }
      setTemplates((prev) => prev.map((item) => (item.id === tpl.id ? (json as LifecycleTemplate) : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (sessionLoading) {
    return <div className="p-6 text-sm text-zinc-600">Authentifizierung wird geprüft…</div>;
  }

  if (sessionError) {
    return <div className="p-6 text-sm text-red-600">Fehler beim Laden der Session: {sessionError}</div>;
  }

  if (!isAdmin) {
    return <div className="p-6 text-sm text-red-600">Zugriff verweigert. Nur Admins können Lifecycle-Vorlagen verwalten.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Lifecycle-Vorlagen</h1>
          <p className="text-sm text-zinc-600">
            Lege Aufgaben-Templates für Onboarding- und Offboarding-Prozesse an und optimiere den Ablauf.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90"
        >
          Neue Vorlage anlegen
        </button>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <form
        className="grid gap-4 rounded border border-zinc-200 bg-white p-4 text-sm md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          setAppliedSearch(search.trim());
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">Typ</span>
          <select
            className="rounded border px-3 py-2"
            value={filterType}
            onChange={(event) => setFilterType(event.target.value as typeof filterType)}
          >
            <option value="ALL">Alle</option>
            <option value="ONBOARDING">Onboarding</option>
            <option value="OFFBOARDING">Offboarding</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 md:col-span-3">
          <span className="text-xs font-medium text-zinc-600">Suche</span>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border px-3 py-2"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Titel oder Beschreibung"
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

      {loading ? (
        <div className="text-sm text-zinc-500">Lade Vorlagen…</div>
      ) : (
        <div className="space-y-3">
          {filteredTemplates.map((tpl) => (
            <div key={tpl.id} className="rounded border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span>{tpl.title}</span>
                    <span className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                      {TYPE_LABELS[tpl.type]}
                    </span>
                    <span className="rounded border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">{tpl.ownerRole.label}</span>
                    {!tpl.active && (
                      <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        Deaktiviert
                      </span>
                    )}
                  </div>
                  {tpl.description && <p className="text-xs text-zinc-600">{tpl.description}</p>}
                  <div className="text-xs text-zinc-500">
                    Fällig {tpl.relativeDueDays >= 0 ? `+${tpl.relativeDueDays}` : tpl.relativeDueDays} Tage relativ zum {tpl.type === "ONBOARDING" ? "Start" : "Austritt"}.
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Aktualisiert am {new Date(tpl.updatedAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    className="rounded border px-3 py-1 hover:bg-zinc-100"
                    onClick={() => openEdit(tpl)}
                  >
                    Bearbeiten
                  </button>
                  <button
                    type="button"
                    className={`rounded border px-3 py-1 ${tpl.active ? "border-amber-300 text-amber-700 hover:bg-amber-50" : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"}`}
                    onClick={() => void toggleActive(tpl)}
                  >
                    {tpl.active ? "Deaktivieren" : "Aktivieren"}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!loading && filteredTemplates.length === 0 && (
            <div className="rounded border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
              Keine Vorlagen für die Auswahl gefunden.
            </div>
          )}
        </div>
      )}

      {dialogMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {dialogMode === "create" ? "Neue Lifecycle-Vorlage" : `Vorlage \"${activeTemplate?.title}\" bearbeiten`}
              </h2>
              <button type="button" onClick={closeDialog} className="text-sm text-zinc-500 hover:text-zinc-800">
                Schließen
              </button>
            </div>
            <div className="grid gap-4 text-sm md:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-600">Titel</span>
                <input
                  className="rounded border px-3 py-2"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-600">Typ</span>
                <select
                  className="rounded border px-3 py-2"
                  value={form.type}
                  onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as TemplateType }))}
                >
                  <option value="ONBOARDING">Onboarding</option>
                  <option value="OFFBOARDING">Offboarding</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-600">Owner-Rolle</span>
                <select
                  className="rounded border px-3 py-2"
                  value={form.ownerRoleId}
                  onChange={(event) => setForm((prev) => ({ ...prev, ownerRoleId: event.target.value }))}
                >
                  <option value="">Bitte wählen…</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-600">Relative Fälligkeit (Tage)</span>
                <input
                  type="number"
                  className="rounded border px-3 py-2"
                  value={form.relativeDueDays}
                  onChange={(event) => setForm((prev) => ({ ...prev, relativeDueDays: event.target.value }))}
                />
              </label>
              <label className="md:col-span-2 flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-600">Beschreibung</span>
                <textarea
                  className="min-h-[100px] rounded border px-3 py-2"
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Optional: detaillierte Beschreibung oder Checkliste"
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-zinc-600">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
                />
                Vorlage aktiv
              </label>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button type="button" onClick={closeDialog} className="rounded border px-3 py-2 text-sm">
                Abbrechen
              </button>
              <button
                type="button"
                onClick={dialogMode === "create" ? submitCreate : submitUpdate}
                disabled={saving}
                className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Speichern…" : dialogMode === "create" ? "Anlegen" : "Speichern"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
