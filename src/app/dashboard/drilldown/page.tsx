import Link from "next/link";
import { db } from "@/lib/prisma";
import DrilldownClient from "./DrilldownClient";
import KindSwitcher from "./KindSwitcher";
import { parseJubileeYears } from "@/lib/jubilee";

export const dynamic = "force-dynamic";

type SearchParams = {
  kind?: string | string[];
  year?: string | string[];
  month?: string | string[];
  quarter?: string | string[];
};

export default async function DrilldownPage({ searchParams }: { searchParams: SearchParams }) {
  const rawKind = (Array.isArray(searchParams.kind) ? searchParams.kind[0] : searchParams.kind ?? "").toString().toLowerCase();
  type Kind = "birthdays" | "hires" | "jubilees";
  const kind: Kind = rawKind === "hires" ? "hires" : rawKind === "jubilees" ? "jubilees" : "birthdays";
  const rawYear = Array.isArray(searchParams.year) ? searchParams.year[0] : searchParams.year;
  const year = Number(rawYear ?? new Date().getFullYear()) || new Date().getFullYear();
  const rawMonth = Array.isArray(searchParams.month) ? searchParams.month[0] : searchParams.month;
  const month = rawMonth !== undefined ? Math.max(0, Math.min(11, Number(rawMonth))) : null;
  const rawQuarter = Array.isArray(searchParams.quarter) ? searchParams.quarter[0] : searchParams.quarter;
  const q = rawQuarter !== undefined ? Math.max(0, Math.min(3, Number(rawQuarter))) : null;
  const quarter = q;

  const [setting, employees] = await Promise.all([
    db.setting.findUnique({ where: { id: 1 } }),
    db.employee.findMany({ orderBy: { lastName: "asc" } }),
  ]);
  const years = parseJubileeYears(setting);

  const rows = employees.flatMap((e: { id: string; firstName: string; lastName: string; email: string | null; startDate: Date; birthDate: Date }) => {
    const out: { id: string; name: string; email: string; date: string; extra?: string }[] = [];
    if (kind === "birthdays") {
      const b = new Date(e.birthDate);
      const m = b.getMonth();
      if (month !== null && m !== month) return out;
      if (quarter !== null && Math.floor(m / 3) !== quarter) return out;
      out.push({ id: e.id, name: `${e.lastName}, ${e.firstName}`, email: e.email ?? "", date: new Date(year, m, b.getDate()).toISOString() });
    } else if (kind === "hires") {
      const s = new Date(e.startDate);
      if (s.getFullYear() !== year) return out;
      const m = s.getMonth();
      if (month !== null && m !== month) return out;
      if (quarter !== null && Math.floor(m / 3) !== quarter) return out;
      out.push({ id: e.id, name: `${e.lastName}, ${e.firstName}`, email: e.email ?? "", date: s.toISOString() });
    } else if (kind === "jubilees") {
      const s = new Date(e.startDate);
      const m = s.getMonth();
      if (month !== null && m !== month) return out;
      if (quarter !== null && Math.floor(m / 3) !== quarter) return out;
      const yrs = year - s.getFullYear();
      if (yrs > 0 && years.includes(yrs)) {
        // show original start date in details
        out.push({ id: e.id, name: `${e.lastName}, ${e.firstName}`, email: e.email ?? "", date: s.toISOString(), extra: `${yrs} Jahre` });
      }
    }
    return out;
  });

  rows.sort((a: { date: string; name: string }, b: { date: string; name: string }) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.name.localeCompare(b.name));

  const backHref = "/dashboard";
  const exportHref = `/api/export/dashboard?kind=${encodeURIComponent(kind)}&year=${year}` +
    (month !== null ? `&month=${month}` : "") + (quarter !== null ? `&quarter=${quarter}` : "");

  const titleKind = kind === "birthdays" ? "Geburtstagen & Jubiläen" : kind === "hires" ? "Eintritte" : "Jubiläen";

  return (
    <div className="p-8 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{titleKind} {year}</h1>
        <div className="flex items-center gap-2 text-sm">
          <a href={exportHref} className="rounded border px-3 py-1">CSV Export</a>
          <Link href={backHref} className="rounded border px-3 py-1">Zurück</Link>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full border px-2 py-0.5">Typ: {titleKind}</span>
        <span className="rounded-full border px-2 py-0.5">Jahr: {year}</span>
        {month !== null && <span className="rounded-full border px-2 py-0.5">Monat: {month + 1}</span>}
        {quarter !== null && <span className="rounded-full border px-2 py-0.5">Quartal: {quarter + 1}</span>}
      </div>
      <KindSwitcher />
      <DrilldownClient
        key={`${kind}-${year}-${month ?? 'all'}`}
        initialRows={rows}
        initialMonth={month}
        extraLabel={kind === "jubilees" ? "Jahre" : undefined}
        dateLabel={kind === "hires" || kind === "jubilees" ? "Eintritt" : "Geburtstag"}
      />
    </div>
  );
}
