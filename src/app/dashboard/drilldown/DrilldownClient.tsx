"use client";

import { useMemo, useState } from "react";

type Row = { id: string; name: string; email: string; date: string; extra?: string };

const monthLabels = ["Jan","Feb","Mrz","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

export default function DrilldownClient({ initialRows, initialMonth = null, extraLabel, dateLabel = "Datum" }: { initialRows: Row[]; initialMonth?: number | null; extraLabel?: string; dateLabel?: string }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [month, setMonth] = useState<number | null>(initialMonth ?? null);


  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let out = initialRows;
    if (month !== null) {
      out = out.filter((r) => new Date(r.date).getMonth() === month);
    }
    if (!query) return out;
    return out.filter((r) => r.name.toLowerCase().includes(query) || r.email.toLowerCase().includes(query));
  }, [initialRows, q, month]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const start = (page - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1 text-xs">
        <button onClick={() => { setMonth(null); setPage(1); }} className={`border rounded px-2 py-1 ${month === null ? "bg-black text-white" : ""}`}>Alle</button>
        {monthLabels.map((ml, i) => (
          <button key={ml} onClick={() => { setMonth(i); setPage(1); }} className={`border rounded px-2 py-1 ${month === i ? "bg-black text-white" : ""}`}>{ml}</button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="Suche (Name/E-Mail)"
          className="border rounded p-2 flex-1 min-w-[220px]"
        />
        <div className="text-sm text-zinc-600">{filtered.length} Einträge</div>
      </div>

      {pageRows.length === 0 ? (
        <p className="text-zinc-600">Keine Einträge.</p>
      ) : (
        <table className="w-full border text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr>
              <th className="text-left p-2 border">Name</th>
              <th className="text-left p-2 border">E-Mail</th>
              {extraLabel && <th className="text-left p-2 border">{extraLabel}</th>}
              <th className="text-left p-2 border">{dateLabel}</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr key={r.id} className="odd:bg-white even:bg-zinc-50 dark:odd:bg-zinc-900 dark:even:bg-zinc-800">
                <td className="p-2 border">{r.name}</td>
                <td className="p-2 border">{r.email}</td>
                {extraLabel && <td className="p-2 border">{r.extra ?? ""}</td>}
                <td className="p-2 border">{new Date(r.date).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex items-center justify-between text-sm">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="rounded border px-3 py-1 disabled:opacity-50"
        >Zurück</button>
        <div>Seite {page} / {totalPages}</div>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className="rounded border px-3 py-1 disabled:opacity-50"
        >Weiter</button>
      </div>
    </div>
  );
}
