"use client";

import { useEffect, useMemo, useState } from "react";

type Unit = {
  id: string;
  name: string;
  leader: string | null;
  deputy: string | null;
  _count?: { employees: number };
};

type EmployeeRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  startDate: string | Date;
  birthDate: string | Date;
  lockAll: boolean;
  lockFirstName: boolean;
  lockLastName: boolean;
  lockStartDate: boolean;
  lockBirthDate: boolean;
  lockEmail: boolean;
  unitId: string | null;
  unit?: Unit | null;
  status: "ACTIVE" | "EXITED";
  exitDate: string | Date | null;
};

export default function EmployeesPage() {
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<EmployeeRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const pageSize = 10;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement;
    if (!input?.files?.[0]) {
      setStatus("Bitte eine .xlsx-Datei auswählen.");
      return;
    }
    const fd = new FormData();
    fd.append("file", input.files[0]);
    setBusy(true);
    setStatus("");
    try {
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setStatus(`Fehler: ${data?.error ?? res.statusText}`);
      } else {
        setStatus(`Import: neu=${data.created}, aktualisiert=${data.updated}, übersprungen=${data.skippedLocked}`);
        await load();
      }
    } catch {
      setStatus("Unerwarteter Fehler beim Upload.");
    } finally {
      setBusy(false);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/employees");
      const data = await res.json();
      const mapped = (data as EmployeeRow[]).map((row) => ({
        ...row,
        unitId: (row.unitId ?? row.unit?.id ?? null) as string | null,
        status: (row.status ?? "ACTIVE") as "ACTIVE" | "EXITED",
        exitDate: row.exitDate ?? null,
      }));
      setItems(mapped);
    } finally {
      setLoading(false);
    }
  }

  async function loadUnits() {
    setUnitsLoading(true);
    try {
      const res = await fetch("/api/units");
      const data = await res.json();
      setUnits(data as Unit[]);
    } finally {
      setUnitsLoading(false);
    }
  }

  async function save(row: EmployeeRow) {
    const payload = {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      startDate: row.startDate,
      birthDate: row.birthDate,
      lockAll: row.lockAll,
      lockFirstName: row.lockFirstName,
      lockLastName: row.lockLastName,
      lockStartDate: row.lockStartDate,
      lockBirthDate: row.lockBirthDate,
      lockEmail: row.lockEmail,
      unitId: row.unitId,
      status: row.status,
      exitDate: row.exitDate ? row.exitDate : null,
    };
    const res = await fetch("/api/employees", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(`Fehler beim Speichern: ${j?.error ?? res.statusText}`);
    } else {
      setStatus("Gespeichert");
      await load();
    }
  }

  function onFieldChange(id: string, key: string, value: unknown) {
    if (!items) return;
    setItems(items.map((it) => (it.id === id ? { ...it, [key]: value } : it)));
  }

  useEffect(() => {
    void load();
    void loadUnits();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!items) return [] as EmployeeRow[];
    if (!q) return items;
    return items.filter((e) =>
      `${e.lastName} ${e.firstName} ${e.email ?? ""}`.toLowerCase().includes(q)
    );
  }, [items, query]);

  const totalPages = Math.max(1, Math.ceil((filtered?.length ?? 0) / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage]);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mitarbeiter</h1>
        <p className="text-zinc-600 mt-2">Excel-Import (.xlsx) – Spalten: Name, Vorname | Nachname | Eintrittsdatum | Geburtstag</p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 w-full max-w-lg" encType="multipart/form-data">
        <input type="file" name="file" accept=".xlsx" className="border rounded p-2" />
        <button disabled={busy} className="rounded bg-black text-white px-4 py-2 disabled:opacity-50">
          {busy ? "Import läuft …" : "Import starten"}
        </button>
      </form>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={load} className="rounded border px-3 py-1">Liste neu laden</button>
        <a href="/api/template" className="rounded border px-3 py-1">Excel-Vorlage laden</a>
        <a href="/api/employees/export.csv" className="rounded border px-3 py-1">Export CSV</a>
        <a href="/api/employees/export.xlsx" className="rounded border px-3 py-1">Export XLSX</a>
        <button onClick={() => setUnitDialogOpen(true)} className="rounded border px-3 py-1">Units verwalten</button>
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          placeholder="Suche (Name/Email)"
          className="border rounded p-2 flex-1 min-w-[220px]"
        />
        {loading && <span className="text-sm text-zinc-600">Lade…</span>}
        {unitsLoading && <span className="text-sm text-zinc-600">Units werden geladen…</span>}
      </div>
      {status && <p className="text-sm text-zinc-700">{status}</p>}

      {items && filtered && (
        <div className="overflow-auto">
          <table className="min-w-[800px] w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="p-2">Nachname</th>
                <th className="p-2">Vorname</th>
                <th className="p-2">Email</th>
                <th className="p-2">Eintritt</th>
                <th className="p-2">Geburtstag</th>
                <th className="p-2">Unit</th>
                <th className="p-2">Locks</th>
                <th className="p-2">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((it) => (
                <tr key={it.id} className="border-b">
                  <td className="p-2">
                    <input className="border rounded p-1 w-full" value={it.lastName ?? ""} onChange={(e) => onFieldChange(it.id, "lastName", e.target.value)} />
                  </td>
                  <td className="p-2">
                    <input className="border rounded p-1 w-full" value={it.firstName ?? ""} onChange={(e) => onFieldChange(it.id, "firstName", e.target.value)} />
                  </td>
                  <td className="p-2">
                    <input className="border rounded p-1 w-full" value={it.email ?? ""} onChange={(e) => onFieldChange(it.id, "email", e.target.value)} />
                  </td>
                  <td className="p-2">
                    <input type="date" className="border rounded p-1" value={it.startDate ? String(it.startDate).slice(0,10) : ""} onChange={(e) => onFieldChange(it.id, "startDate", e.target.value)} />
                  </td>
                  <td className="p-2">
                    <input type="date" className="border rounded p-1" value={it.birthDate ? String(it.birthDate).slice(0,10) : ""} onChange={(e) => onFieldChange(it.id, "birthDate", e.target.value)} />
                  </td>
                  <td className="p-2">
                    <select
                      className="border rounded p-1 w-full"
                      value={it.unitId ?? ""}
                      onChange={(e) => {
                        const val = e.target.value || null;
                        onFieldChange(it.id, "unitId", val);
                        const found = units.find((u) => u.id === val);
                        onFieldChange(it.id, "unit", found ?? null);
                      }}
                    >
                      <option value="">– Keine –</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                    {it.unit?.leader && <div className="text-xs text-zinc-500">Leitung: {it.unit.leader}</div>}
                    {it.unit?.deputy && <div className="text-xs text-zinc-500">Stellv.: {it.unit.deputy}</div>}
                  </td>
                  <td className="p-2">
                    <div className="flex flex-col gap-2 text-xs">
                      <label className="flex items-center gap-2 whitespace-nowrap">
                        <input type="checkbox" checked={!!it.lockAll} onChange={(e) => onFieldChange(it.id, "lockAll", e.target.checked)} />
                        Datensatz
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <label className="flex items-center gap-1 whitespace-nowrap"><input type="checkbox" checked={!!it.lockFirstName} onChange={(e) => onFieldChange(it.id, "lockFirstName", e.target.checked)} /> Vorname</label>
                        <label className="flex items-center gap-1 whitespace-nowrap"><input type="checkbox" checked={!!it.lockLastName} onChange={(e) => onFieldChange(it.id, "lockLastName", e.target.checked)} /> Nachname</label>
                        <label className="flex items-center gap-1 whitespace-nowrap"><input type="checkbox" checked={!!it.lockEmail} onChange={(e) => onFieldChange(it.id, "lockEmail", e.target.checked)} /> Email</label>
                        <label className="flex items-center gap-1 whitespace-nowrap"><input type="checkbox" checked={!!it.lockStartDate} onChange={(e) => onFieldChange(it.id, "lockStartDate", e.target.checked)} /> Eintritt</label>
                        <label className="flex items-center gap-1 whitespace-nowrap"><input type="checkbox" checked={!!it.lockBirthDate} onChange={(e) => onFieldChange(it.id, "lockBirthDate", e.target.checked)} /> Geburtstag</label>
                      </div>
                    </div>
                  </td>
                  <td className="p-2">
                    <button onClick={() => save(it)} className="rounded bg-black text-white px-3 py-1">Speichern</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between mt-3 text-sm">
            <span>{filtered.length} Einträge</span>
            <div className="flex items-center gap-2">
              <button disabled={currentPage<=1} onClick={() => setPage((p) => Math.max(1, p-1))} className="border rounded px-2 py-1 disabled:opacity-50">Zurück</button>
              <span>Seite {currentPage} / {totalPages}</span>
              <button disabled={currentPage>=totalPages} onClick={() => setPage((p) => Math.min(totalPages, p+1))} className="border rounded px-2 py-1 disabled:opacity-50">Weiter</button>
            </div>
          </div>
        </div>
      )}

      {unitDialogOpen && (
        <UnitDialog
          units={units}
          onClose={() => setUnitDialogOpen(false)}
          onRefresh={async () => {
            await loadUnits();
            await load();
          }}
        />
      )}
    </div>
  );
}

function UnitDialog({ units, onClose, onRefresh }: { units: Unit[]; onClose: () => void; onRefresh: () => Promise<void> }) {
  const [localUnits, setLocalUnits] = useState<Unit[]>(units);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUnit, setNewUnit] = useState({ name: "", leader: "", deputy: "" });
  const [error, setError] = useState<string>("");

  function updateLocal(id: string, patch: Partial<Unit>) {
    setLocalUnits((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }

  async function saveUnit(unit: Unit) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/units", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: unit.id,
          name: unit.name,
          leader: unit.leader,
          deputy: unit.deputy,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || res.statusText);
      }
      await onRefresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Fehler beim Speichern";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function deleteUnit(id: string) {
    if (!confirm("Unit wirklich löschen? Zugeordnete Mitarbeiter werden auf 'Keine' gesetzt.")) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/units", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || res.statusText);
      }
      await onRefresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Fehler beim Löschen";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function createUnit() {
    const payload = {
      name: newUnit.name.trim(),
      leader: newUnit.leader.trim() || null,
      deputy: newUnit.deputy.trim() || null,
    };
    if (!payload.name) {
      setError("Name darf nicht leer sein");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/units", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || res.statusText);
      }
      setNewUnit({ name: "", leader: "", deputy: "" });
      await onRefresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Fehler beim Anlegen";
      setError(msg);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-950 border rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-lg font-semibold">Units verwalten</h3>
          <button onClick={onClose} className="text-sm text-zinc-600 hover:text-zinc-900">Schließen</button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto">
          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="space-y-3">
            {localUnits.length === 0 && <p className="text-sm text-zinc-600">Noch keine Units angelegt.</p>}
            {localUnits.map((unit) => (
              <div key={unit.id} className="border rounded p-3 space-y-2 bg-zinc-50 dark:bg-zinc-900">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <label className="text-xs text-zinc-500">Name
                    <input
                      className="border rounded p-2 w-full"
                      value={unit.name}
                      onChange={(e) => updateLocal(unit.id, { name: e.target.value })}
                    />
                  </label>
                  <label className="text-xs text-zinc-500">Leitung
                    <input
                      className="border rounded p-2 w-full"
                      value={unit.leader ?? ""}
                      onChange={(e) => updateLocal(unit.id, { leader: e.target.value })}
                    />
                  </label>
                  <label className="text-xs text-zinc-500">Stellvertretung
                    <input
                      className="border rounded p-2 w-full"
                      value={unit.deputy ?? ""}
                      onChange={(e) => updateLocal(unit.id, { deputy: e.target.value })}
                    />
                  </label>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>Mitarbeiter: {unit._count?.employees ?? "–"}</span>
                  <div className="flex gap-2 text-sm">
                    <button onClick={() => saveUnit(unit)} className="border rounded px-3 py-1" disabled={saving}>Speichern</button>
                    <button onClick={() => deleteUnit(unit.id)} className="border rounded px-3 py-1 text-red-600" disabled={saving}>Löschen</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border rounded p-3 bg-zinc-50 dark:bg-zinc-900 space-y-2">
            <h4 className="font-medium text-sm">Neue Unit anlegen</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input className="border rounded p-2" placeholder="Name" value={newUnit.name} onChange={(e) => setNewUnit((prev) => ({ ...prev, name: e.target.value }))} />
              <input className="border rounded p-2" placeholder="Leitung" value={newUnit.leader} onChange={(e) => setNewUnit((prev) => ({ ...prev, leader: e.target.value }))} />
              <input className="border rounded p-2" placeholder="Stellvertretung" value={newUnit.deputy} onChange={(e) => setNewUnit((prev) => ({ ...prev, deputy: e.target.value }))} />
            </div>
            <button onClick={createUnit} className="border rounded px-3 py-1" disabled={creating}>Anlegen</button>
          </div>
        </div>
      </div>
    </div>
  );
}
