"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/hooks/useSession";

type UserRole = "ADMIN" | "HR" | "PEOPLE_MANAGER" | "UNIT_LEAD" | "TEAM_LEAD";

type UserDto = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  unitId: string | null;
  unit: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
};

type UnitDto = {
  id: string;
  name: string;
};

type FormState = {
  email: string;
  name: string;
  role: UserRole;
  unitId: string | null;
  password: string;
};

const EMPTY_FORM: FormState = {
  email: "",
  name: "",
  role: "UNIT_LEAD",
  unitId: null,
  password: "",
};

function parseApiError(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (Array.isArray(error)) {
    const messages: string[] = error
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

export default function AdminUsersPage() {
  const { user, loading: sessionLoading, error: sessionError } = useSession();
  const [users, setUsers] = useState<UserDto[]>([]);
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [activeUser, setActiveUser] = useState<UserDto | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const [usersRes, unitsRes] = await Promise.all([
          fetch("/api/users"),
          fetch("/api/units"),
        ]);
        if (!active) return;
        if (!usersRes.ok) {
          throw new Error(`Benutzer konnten nicht geladen werden (${usersRes.status})`);
        }
        if (!unitsRes.ok) {
          throw new Error(`Units konnten nicht geladen werden (${unitsRes.status})`);
        }
        const [usersJson, unitsJson] = await Promise.all([usersRes.json(), unitsRes.json()]);
        setUsers(usersJson as UserDto[]);
        setUnits((unitsJson as UnitDto[]).map((u) => ({ id: u.id, name: u.name })));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [isAdmin]);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => a.email.localeCompare(b.email));
  }, [users]);

  const openCreate = () => {
    setDialogMode("create");
    setForm({ ...EMPTY_FORM });
    setActiveUser(null);
  };

  const openEdit = (u: UserDto) => {
    setDialogMode("edit");
    setActiveUser(u);
    setForm({
      email: u.email,
      name: u.name ?? "",
      role: u.role,
      unitId: u.unitId,
      password: "",
    });
  };

  const closeDialog = () => {
    setDialogMode(null);
    setActiveUser(null);
    setForm({ ...EMPTY_FORM });
    setSaving(false);
  };

  async function submitCreate() {
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          name: form.name,
          role: form.role,
          unitId: form.unitId ?? undefined,
          password: form.password,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const message = parseApiError(json?.error ?? json, "Fehler beim Anlegen");
        throw new Error(message);
      }
      setUsers((prev) => [...prev, json as UserDto]);
      closeDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function submitUpdate() {
    if (!activeUser) return;
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: activeUser.id,
          email: form.email,
          name: form.name,
          role: form.role,
          unitId: form.unitId ?? undefined,
          password: form.password || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const message = parseApiError(json?.error ?? json, "Fehler beim Aktualisieren");
        throw new Error(message);
      }
      setUsers((prev) => prev.map((u) => (u.id === activeUser.id ? (json as UserDto) : u)));
      closeDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser(target: UserDto) {
    if (!window.confirm(`Soll der Benutzer ${target.email} wirklich gelöscht werden?`)) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: target.id }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error ?? "Fehler beim Löschen");
      }
      setUsers((prev) => prev.filter((u) => u.id !== target.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  }

  if (sessionLoading) {
    return <div className="p-6 text-sm text-zinc-600">Authentifizierung wird geprüft…</div>;
  }

  if (sessionError) {
    return <div className="p-6 text-sm text-red-600">Fehler beim Laden der Session: {sessionError}</div>;
  }

  if (!isAdmin) {
    return <div className="p-6 text-sm text-red-600">Zugriff verweigert. Nur Admins können Benutzer verwalten.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Benutzerverwaltung</h1>
          <p className="text-sm text-zinc-600">Lege neue Benutzer an, passe Rollen an oder lösche Einträge.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90"
        >
          Benutzer anlegen
        </button>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="text-sm text-zinc-500">Lade Benutzer…</div>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left">
              <tr>
                <th className="px-4 py-2 font-semibold">E-Mail</th>
                <th className="px-4 py-2 font-semibold">Name</th>
                <th className="px-4 py-2 font-semibold">Rolle</th>
                <th className="px-4 py-2 font-semibold">Unit</th>
                <th className="px-4 py-2 font-semibold">Aktualisiert</th>
                <th className="px-4 py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {sortedUsers.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2">{u.name || "–"}</td>
                  <td className="px-4 py-2">{u.role === "ADMIN" ? "Admin" : "Unit-Leiter"}</td>
                  <td className="px-4 py-2">{u.unit?.name ?? "–"}</td>
                  <td className="px-4 py-2 text-xs text-zinc-500">{new Date(u.updatedAt).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="rounded border px-3 py-1 text-xs hover:bg-zinc-100"
                      >
                        Bearbeiten
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteUser(u)}
                        className="rounded border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                        disabled={deleting}
                      >
                        Löschen
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-zinc-500">
                    Keine Benutzer vorhanden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {dialogMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {dialogMode === "create" ? "Neuen Benutzer anlegen" : `Benutzer ${activeUser?.email} bearbeiten`}
              </h2>
              <button type="button" onClick={closeDialog} className="text-sm text-zinc-500 hover:text-zinc-800">
                Schließen
              </button>
            </div>
            <div className="space-y-4">
              <label className="block text-sm">
                <span className="font-medium">E-Mail</span>
                <input
                  type="email"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Name</span>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Rolle</span>
                <select
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as FormState["role"] }))}
                >
                  <option value="ADMIN">Admin</option>
                  <option value="HR">HR</option>
                  <option value="PEOPLE_MANAGER">People Manager</option>
                  <option value="UNIT_LEAD">Unit-Leiter</option>
                  <option value="TEAM_LEAD">Team-Leiter</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium">Zugeordnete Unit</span>
                <select
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.unitId ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, unitId: e.target.value ? e.target.value : null }))
                  }
                >
                  <option value="">– keine –</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium">Passwort {dialogMode === "edit" && <span className="text-xs text-zinc-500">(leer lassen, um nicht zu ändern)</span>}</span>
                <input
                  type="password"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
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
