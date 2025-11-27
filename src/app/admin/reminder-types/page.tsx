"use client";

import { useEffect, useState } from "react";

type ReminderType = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  color: string | null;
  orderIndex: number;
  active: boolean;
};

const DEFAULT_COLORS = [
  { name: "Grau", value: "gray" },
  { name: "Rot", value: "red" },
  { name: "Orange", value: "orange" },
  { name: "Gelb", value: "amber" },
  { name: "Grün", value: "emerald" },
  { name: "Blau", value: "blue" },
  { name: "Indigo", value: "indigo" },
  { name: "Violett", value: "violet" },
  { name: "Pink", value: "pink" },
];

export default function ReminderTypesPage() {
  const [types, setTypes] = useState<ReminderType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  // Form state
  const [formKey, setFormKey] = useState("");
  const [formLabel, setFormLabel] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formColor, setFormColor] = useState("gray");
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadTypes = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/reminder-types");
      if (!res.ok) throw new Error("Fehler beim Laden");
      const data = await res.json();
      setTypes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTypes();
  }, []);

  const resetForm = () => {
    setFormKey("");
    setFormLabel("");
    setFormDescription("");
    setFormColor("gray");
    setFormActive(true);
    setFormError(null);
    setEditingId(null);
    setShowNew(false);
  };

  const startEdit = (type: ReminderType) => {
    setEditingId(type.id);
    setFormKey(type.key);
    setFormLabel(type.label);
    setFormDescription(type.description || "");
    setFormColor(type.color || "gray");
    setFormActive(type.active);
    setFormError(null);
    setShowNew(false);
  };

  const startNew = () => {
    resetForm();
    setShowNew(true);
  };

  const saveType = async () => {
    if (!formKey.trim() || !formLabel.trim()) {
      setFormError("Schlüssel und Anzeigename sind erforderlich");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const body = {
        key: formKey.toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z_]/g, ""),
        label: formLabel.trim(),
        description: formDescription.trim() || null,
        color: formColor,
        active: formActive,
      };

      let res: Response;
      if (editingId) {
        res = await fetch("/api/admin/reminder-types", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, ...body }),
        });
      } else {
        res = await fetch("/api/admin/reminder-types", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Fehler beim Speichern");
      }

      await loadTypes();
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const deleteType = async (id: string) => {
    if (!confirm("Diesen Erinnerungstyp wirklich löschen?")) return;

    try {
      const res = await fetch(`/api/admin/reminder-types?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Fehler beim Löschen");
      }
      await loadTypes();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Fehler beim Löschen");
    }
  };

  const getColorClasses = (color: string | null) => {
    const c = color || "gray";
    return {
      bg: `bg-${c}-100 dark:bg-${c}-900/30`,
      text: `text-${c}-700 dark:text-${c}-400`,
      border: `border-${c}-200 dark:border-${c}-800`,
    };
  };

  if (loading && types.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-zinc-500">Lade Erinnerungstypen...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Erinnerungstypen</h1>
          <p className="text-sm text-zinc-500">Verwalten Sie die verfügbaren Typen für Erinnerungen</p>
        </div>
        <button
          onClick={startNew}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neuer Typ
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* New/Edit Form */}
      {(showNew || editingId) && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
            {editingId ? "Typ bearbeiten" : "Neuen Typ erstellen"}
          </h2>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Schlüssel (intern)
              </label>
              <input
                type="text"
                value={formKey}
                onChange={(e) => setFormKey(e.target.value.toUpperCase().replace(/\s+/g, "_"))}
                placeholder="z.B. SONDERBONUS"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm uppercase focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
                disabled={!!editingId}
              />
              <p className="mt-1 text-xs text-zinc-500">Nur Großbuchstaben und Unterstriche</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Anzeigename
              </label>
              <input
                type="text"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="z.B. Sonderbonus"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Beschreibung (optional)
              </label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Kurze Beschreibung des Typs"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Farbe
              </label>
              <select
                value={formColor}
                onChange={(e) => setFormColor(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
              >
                {DEFAULT_COLORS.map((c) => (
                  <option key={c.value} value={c.value}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Aktiv</span>
              </label>
            </div>
          </div>

          {formError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {formError}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={resetForm}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
            >
              Abbrechen
            </button>
            <button
              onClick={saveType}
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Speichere..." : "Speichern"}
            </button>
          </div>
        </div>
      )}

      {/* Types List */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-700">
          <h2 className="font-semibold text-zinc-900 dark:text-white">Vorhandene Typen ({types.length})</h2>
        </div>
        
        {types.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-zinc-500">
            Keine Erinnerungstypen vorhanden. Erstellen Sie den ersten Typ.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {types.map((type) => {
              const colors = getColorClasses(type.color);
              return (
                <li key={type.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${colors.bg} ${colors.text}`}>
                      {type.label}
                    </span>
                    <div>
                      <code className="text-xs text-zinc-500">{type.key}</code>
                      {type.description && (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">{type.description}</p>
                      )}
                    </div>
                    {!type.active && (
                      <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-700">
                        Inaktiv
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(type)}
                      className="rounded p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                      title="Bearbeiten"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteType(type.id)}
                      className="rounded p-2 text-zinc-500 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                      title="Löschen"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
