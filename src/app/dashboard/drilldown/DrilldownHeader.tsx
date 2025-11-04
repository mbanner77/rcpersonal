"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

export default function DrilldownHeader({ year, month, quarter }: { year: number; month: number | null; quarter: number | null }) {
  const sp = useSearchParams();
  const rawKind = (sp.get("kind") || "birthdays").toLowerCase();
  const kind: "birthdays" | "hires" | "jubilees" = rawKind === "hires" ? "hires" : rawKind === "jubilees" ? "jubilees" : "birthdays";

  const title = useMemo(() => (kind === "birthdays" ? "Geburtstagen & Jubiläen" : kind === "hires" ? "Eintritte" : "Jubiläen"), [kind]);

  const exportHref = useMemo(() => {
    const p = new URLSearchParams(sp.toString());
    // ensure year/month/quarter present as in SSR
    p.set("year", String(year));
    if (month !== null) p.set("month", String(month)); else p.delete("month");
    if (quarter !== null) p.set("quarter", String(quarter)); else p.delete("quarter");
    p.set("kind", kind);
    return `/api/export/dashboard?${p.toString()}`;
  }, [sp, kind, year, month, quarter]);

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{title} {year}</h1>
        <div className="flex items-center gap-2 text-sm">
          <a href={exportHref} className="rounded border px-3 py-1">CSV Export</a>
          <Link href="/dashboard" className="rounded border px-3 py-1">Zurück</Link>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full border px-2 py-0.5">Typ: {title}</span>
        <span className="rounded-full border px-2 py-0.5">Jahr: {year}</span>
        {month !== null && <span className="rounded-full border px-2 py-0.5">Monat: {month + 1}</span>}
        {quarter !== null && <span className="rounded-full border px-2 py-0.5">Quartal: {quarter + 1}</span>}
      </div>
    </>
  );
}
