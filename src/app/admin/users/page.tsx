"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/hooks/useSession";
import Dialog, { DialogFooter, FormField, inputClassName, selectClassName } from "@/components/Dialog";

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

  const roleLabels: Record<UserRole, string> = {
    ADMIN: "Admin",
    HR: "HR",
    PEOPLE_MANAGER: "People Manager",
    UNIT_LEAD: "Unit-Leiter",
    TEAM_LEAD: "Team-Leiter",
  };

  const roleColors: Record<UserRole, string> = {
    ADMIN: "bg-purple-100 text-purple-700 border-purple-200",
    HR: "bg-blue-100 text-blue-700 border-blue-200",
    PEOPLE_MANAGER: "bg-emerald-100 text-emerald-700 border-emerald-200",
    UNIT_LEAD: "bg-amber-100 text-amber-700 border-amber-200",
    TEAM_LEAD: "bg-rose-100 text-rose-700 border-rose-200",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Benutzerverwaltung</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Lege neue Benutzer an, passe Rollen an oder lösche Einträge.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Benutzer anlegen
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500"><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>Lade Benutzer…</div>
      ) : (
        <div className="grid gap-3">
          {sortedUsers.map((u) => (
            <div key={u.id} className="group flex items-center justify-between rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-700">
                  <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">{(u.name || u.email).charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{u.name || u.email}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${roleColors[u.role]}`}>{roleLabels[u.role]}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                    <span>{u.email}</span>
                    {u.unit && <span className="flex items-center gap-1"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>{u.unit.name}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => openEdit(u)}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
                >
                  Bearbeiten
                </button>
                <button
                  type="button"
                  onClick={() => deleteUser(u)}
                  className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 shadow-sm transition hover:bg-red-50 dark:border-red-800 dark:bg-zinc-700 dark:text-red-400 dark:hover:bg-red-900/20"
                  disabled={deleting}
                >
                  Löschen
                </button>
              </div>
            </div>
          ))}
          {sortedUsers.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center dark:border-zinc-700 dark:bg-zinc-800/50">
              <svg className="mx-auto h-12 w-12 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              <h3 className="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">Keine Benutzer vorhanden</h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Erstellen Sie einen neuen Benutzer, um loszulegen.</p>
            </div>
          )}
        </div>
      )}

      <Dialog
        open={!!dialogMode}
        onClose={closeDialog}
        title={dialogMode === "create" ? "Neuen Benutzer anlegen" : "Benutzer bearbeiten"}
        subtitle={dialogMode === "create" ? "Erstellen Sie einen neuen Benutzer mit Zugangsdaten" : "Passen Sie die Benutzerinformationen an"}
        icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
        iconColor="purple"
        footer={
          <DialogFooter
            onCancel={closeDialog}
            onSave={dialogMode === "create" ? submitCreate : submitUpdate}
            saving={saving}
            saveText={dialogMode === "create" ? "Anlegen" : "Speichern"}
          />
        }
      >
        <div className="space-y-4">
          <FormField label="E-Mail" required>
            <input
              type="email"
              className={inputClassName}
              placeholder="name@firma.de"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </FormField>
          <FormField label="Name">
            <input
              className={inputClassName}
              placeholder="Vor- und Nachname"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Rolle">
              <select
                className={selectClassName}
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as FormState["role"] }))}
              >
                <option value="ADMIN">Admin</option>
                <option value="HR">HR</option>
                <option value="PEOPLE_MANAGER">People Manager</option>
                <option value="UNIT_LEAD">Unit-Leiter</option>
                <option value="TEAM_LEAD">Team-Leiter</option>
              </select>
            </FormField>
            <FormField label="Unit">
              <select
                className={selectClassName}
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
            </FormField>
          </div>
          <FormField label="Passwort" hint={dialogMode === "edit" ? "leer = unverändert" : undefined}>
            <input
              type="password"
              className={inputClassName}
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </FormField>
        </div>
      </Dialog>
    </div>
  );
}
