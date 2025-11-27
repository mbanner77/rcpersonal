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

  async function save(id: string) {
    const row = items?.find((r) => r.id === id);
    if (!row) return;
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
    setItems((prev) => {
      if (!prev) return prev;
      return prev.map((it) => (it.id === id ? { ...it, [key]: value } : it));
    });
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
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-800">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Mitarbeiter</h1>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Verwalten Sie Ihre Mitarbeiterdaten und importieren Sie neue Einträge aus Excel
              </p>
            </div>
            <div className="flex items-center gap-2">
              {loading && (
                <span className="flex items-center gap-2 text-sm text-zinc-500">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  Lade Daten...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Import Section */}
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-white">
            <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Excel-Import
          </h2>
          <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-4" encType="multipart/form-data">
            <div className="flex-1 min-w-[280px]">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Datei auswählen
              </label>
              <input 
                type="file" 
                name="file" 
                accept=".xlsx" 
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white dark:file:bg-zinc-600 dark:file:text-zinc-200" 
              />
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">Spalten: Nachname | Vorname | Email | Eintrittsdatum | Geburtstag</p>
            </div>
            <button 
              disabled={busy} 
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  Import läuft…
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  Import starten
                </>
              )}
            </button>
          </form>
          {status && (
            <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${status.startsWith("Fehler") ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"}`}>
              {status}
            </div>
          )}
        </div>

        {/* Actions Bar */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button 
            onClick={load} 
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Aktualisieren
          </button>
          <a 
            href="/api/template" 
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Vorlage
          </a>
          <a 
            href="/api/employees/export.csv" 
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
            CSV
          </a>
          <a 
            href="/api/employees/export.xlsx" 
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
            XLSX
          </a>
          <button 
            onClick={() => setUnitDialogOpen(true)} 
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            Units verwalten
          </button>
          <div className="flex-1" />
          <div className="relative min-w-[280px]">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Mitarbeiter suchen..."
              className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-10 pr-4 text-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
            />
          </div>
        </div>

        {/* Employee List */}
        {items && filtered && (
          <>
            {/* Stats Bar */}
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{filtered.length} Mitarbeiter gefunden</span>
            </div>

            {/* Employee Cards */}
            <div className="space-y-4">
              {paged.map((it) => (
                <div key={it.id} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Name Fields */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Nachname</label>
                      <input 
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white" 
                        value={it.lastName ?? ""} 
                        onChange={(e) => onFieldChange(it.id, "lastName", e.target.value)} 
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Vorname</label>
                      <input 
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white" 
                        value={it.firstName ?? ""} 
                        onChange={(e) => onFieldChange(it.id, "firstName", e.target.value)} 
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Email</label>
                      <input 
                        type="email"
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white" 
                        value={it.email ?? ""} 
                        onChange={(e) => onFieldChange(it.id, "email", e.target.value)} 
                      />
                    </div>
                    
                    {/* Date Fields */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Eintritt</label>
                      <input 
                        type="date" 
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white" 
                        value={it.startDate ? String(it.startDate).slice(0,10) : ""} 
                        onChange={(e) => onFieldChange(it.id, "startDate", e.target.value)} 
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Geburtstag</label>
                      <input 
                        type="date" 
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white" 
                        value={it.birthDate ? String(it.birthDate).slice(0,10) : ""} 
                        onChange={(e) => onFieldChange(it.id, "birthDate", e.target.value)} 
                      />
                    </div>
                    
                    {/* Unit Field */}
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Unit</label>
                      <select
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
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
                      {it.unit?.leader && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Leitung: {it.unit.leader}</p>}
                    </div>
                  </div>
                  
                  {/* Lock Controls & Save Button */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-100 pt-4 dark:border-zinc-700">
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input 
                          type="checkbox" 
                          className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600" 
                          checked={!!it.lockAll} 
                          onChange={(e) => onFieldChange(it.id, "lockAll", e.target.checked)} 
                        />
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">Alles sperren</span>
                      </label>
                      <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-600" />
                      <div className="flex flex-wrap gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                        <label className="flex items-center gap-1.5 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-200">
                          <input type="checkbox" className="h-3.5 w-3.5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600" checked={!!it.lockFirstName} onChange={(e) => onFieldChange(it.id, "lockFirstName", e.target.checked)} />
                          Vorname
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-200">
                          <input type="checkbox" className="h-3.5 w-3.5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600" checked={!!it.lockLastName} onChange={(e) => onFieldChange(it.id, "lockLastName", e.target.checked)} />
                          Nachname
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-200">
                          <input type="checkbox" className="h-3.5 w-3.5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600" checked={!!it.lockEmail} onChange={(e) => onFieldChange(it.id, "lockEmail", e.target.checked)} />
                          Email
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-200">
                          <input type="checkbox" className="h-3.5 w-3.5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600" checked={!!it.lockStartDate} onChange={(e) => onFieldChange(it.id, "lockStartDate", e.target.checked)} />
                          Eintritt
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-200">
                          <input type="checkbox" className="h-3.5 w-3.5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600" checked={!!it.lockBirthDate} onChange={(e) => onFieldChange(it.id, "lockBirthDate", e.target.checked)} />
                          Geburtstag
                        </label>
                      </div>
                    </div>
                    <button 
                      onClick={() => save(it.id)} 
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Speichern
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-6 flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Seite {currentPage} von {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button 
                  disabled={currentPage<=1} 
                  onClick={() => setPage((p) => Math.max(1, p-1))} 
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Zurück
                </button>
                <button 
                  disabled={currentPage>=totalPages} 
                  onClick={() => setPage((p) => Math.min(totalPages, p+1))} 
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
                >
                  Weiter
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
          </>
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
    </div>
  );
}

function UnitDialog({ units, onClose, onRefresh }: { units: Unit[]; onClose: () => void; onRefresh: () => Promise<void> }) {
  const [localUnits, setLocalUnits] = useState<Unit[]>(units);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUnit, setNewUnit] = useState({ name: "", leader: "", deputy: "" });
  const [error, setError] = useState<string>("");
  const [filter, setFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { setLocalUnits(units); }, [units]);
  function updateLocal(id: string, patch: Partial<Unit>) {
    setLocalUnits((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }
  async function saveUnit(unit: Unit) {
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/units", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: unit.id, name: unit.name.trim(), leader: unit.leader?.trim() || null, deputy: unit.deputy?.trim() || null }) });
      if (!res.ok) { const j = await res.json().catch(() => null); throw new Error(j?.error || res.statusText); }
      await onRefresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Fehler beim Speichern"); } finally { setSaving(false); }
  }
  async function deleteUnit(id: string) {
    const original = units.find((u) => u.id === id); const empCount = original?._count?.employees ?? 0;
    const msg = empCount > 0 ? `Unit wirklich löschen? ${empCount} zugeordnete Mitarbeitende werden auf 'Keine' gesetzt.` : "Unit wirklich löschen? Zugeordnete Mitarbeiter werden auf 'Keine' gesetzt.";
    if (!confirm(msg)) return; setSaving(true); setError("");
    try {
      const res = await fetch("/api/units", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
      if (!res.ok) { const j = await res.json().catch(() => null); throw new Error(j?.error || res.statusText); }
      await onRefresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Fehler beim Löschen"); } finally { setSaving(false); }
  }
  async function createUnit() {
    const payload = { name: newUnit.name.trim(), leader: newUnit.leader.trim() || null, deputy: newUnit.deputy.trim() || null };
    if (!payload.name) { setError("Name darf nicht leer sein"); return; }
    if (units.some((u) => u.name.trim().toLowerCase() === payload.name.toLowerCase())) { setError("Name existiert bereits"); return; }
    setCreating(true); setError("");
    try {
      const res = await fetch("/api/units", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const j = await res.json().catch(() => null); throw new Error(j?.error || res.statusText); }
      setNewUnit({ name: "", leader: "", deputy: "" });
      await onRefresh();
      setShowCreate(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Fehler beim Anlegen"); } finally { setCreating(false); }
  }

  const visibleUnits = localUnits
    .filter((u) => u.name.toLowerCase().includes(filter.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const createForm = showCreate ? (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
      <input className="border rounded p-2" placeholder="Name" value={newUnit.name} onChange={(e) => setNewUnit((prev) => ({ ...prev, name: e.target.value }))} />
      <input className="border rounded p-2" placeholder="Leitung" value={newUnit.leader} onChange={(e) => setNewUnit((prev) => ({ ...prev, leader: e.target.value }))} />
      <input className="border rounded p-2" placeholder="Stellvertretung" value={newUnit.deputy} onChange={(e) => setNewUnit((prev) => ({ ...prev, deputy: e.target.value }))} />
      <div className="flex items-center gap-2">
        <button onClick={createUnit} className="border rounded px-3 py-2 disabled:opacity-50" disabled={creating || newUnit.name.trim() === "" || units.some((u) => u.name.trim().toLowerCase() === newUnit.name.trim().toLowerCase())}>Anlegen</button>
      </div>
    </div>
  ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-700">
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Units verwalten</h3>
          <button onClick={onClose} className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-200">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-0 overflow-y-auto">
          <div className="sticky top-0 z-10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur border-b">
            <div className="p-3 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <input className="border rounded p-2 flex-1 min-w-[220px]" placeholder="Suche (Name)" value={filter} onChange={(e) => setFilter(e.target.value)} />
                <button onClick={() => setShowCreate((v) => !v)} className="border rounded px-3 py-2">
                  {showCreate ? "Abbrechen" : "Neue Unit"}
                </button>
                <div className="text-xs text-zinc-500 whitespace-nowrap">{localUnits.length} Units</div>
              </div>
              {createForm}
            </div>
          </div>
          <div className="p-4 space-y-4">
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="space-y-3">
              {visibleUnits.length === 0 && <p className="text-sm text-zinc-600">Noch keine Units angelegt.</p>}
              {visibleUnits.map((unit) => {
                const original = units.find((x) => x.id === unit.id);
                const isDirty = !original || original.name !== unit.name || (original.leader ?? "") !== (unit.leader ?? "") || (original.deputy ?? "") !== (unit.deputy ?? "");
                const nameEmpty = unit.name.trim() === "";
                const nameDuplicate = units.some((u) => u.id !== unit.id && u.name.trim().toLowerCase() === unit.name.trim().toLowerCase());
                const disableSave = saving || nameEmpty || nameDuplicate || !isDirty;
                return (
                  <div key={unit.id} className="border rounded-lg p-3 space-y-2 bg-zinc-50 dark:bg-zinc-900">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{original?.name ?? unit.name}</div>
                      <span className="text-xs px-2 py-0.5 rounded-full border bg-white dark:bg-zinc-800">{unit._count?.employees ?? "–"} Mitarbeitende</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <label className="text-xs text-zinc-500">Name
                        <input className="border rounded p-2 w-full" value={unit.name} onChange={(e) => updateLocal(unit.id, { name: e.target.value })} />
                      </label>
                      <label className="text-xs text-zinc-500">Leitung
                        <input className="border rounded p-2 w-full" value={unit.leader ?? ""} onChange={(e) => updateLocal(unit.id, { leader: e.target.value })} />
                      </label>
                      <label className="text-xs text-zinc-500">Stellvertretung
                        <input className="border rounded p-2 w-full" value={unit.deputy ?? ""} onChange={(e) => updateLocal(unit.id, { deputy: e.target.value })} />
                      </label>
                    </div>
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <div className="flex gap-2">
                        {isDirty && (
                          <button onClick={() => original && updateLocal(unit.id, { name: original.name, leader: original.leader ?? null, deputy: original.deputy ?? null })} className="border rounded px-3 py-1">Zurücksetzen</button>
                        )}
                      </div>
                      <div className="flex gap-2 text-sm">
                        <button onClick={() => saveUnit(unit)} className="border rounded px-3 py-1 disabled:opacity-50" disabled={disableSave}>Speichern</button>
                        <button onClick={() => deleteUnit(unit.id)} className="border rounded px-3 py-1 text-red-600 disabled:opacity-50" disabled={saving}>Löschen</button>
                      </div>
                    </div>
                    {(nameEmpty || nameDuplicate) && (
                      <div className="text-xs text-red-600">{nameEmpty ? "Name darf nicht leer sein" : "Name existiert bereits"}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
