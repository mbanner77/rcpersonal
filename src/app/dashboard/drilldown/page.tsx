import Link from "next/link";
import { db } from "@/lib/prisma";
import DrilldownClient from "./DrilldownClient";

export const dynamic = "force-dynamic";

type SearchParams = {
  kind?: string;
  year?: string;
  month?: string;
  quarter?: string;
};

export default async function DrilldownPage({ searchParams }: { searchParams: SearchParams }) {
  const kind = (searchParams.kind ?? "").toString();
  const year = Number(searchParams.year ?? new Date().getFullYear());
  const month = searchParams.month !== undefined ? Number(searchParams.month) : null;
  const quarter = searchParams.quarter !== undefined ? Number(searchParams.quarter) : null;

  const employees = await db.employee.findMany({ orderBy: { lastName: "asc" } });

  const rows = employees.flatMap((e: { id: string; firstName: string; lastName: string; email: string | null; startDate: Date; birthDate: Date }) => {
    const out: { id: string; name: string; email: string; date: string }[] = [];
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
      out.push({ id: e.id, name: `${e.lastName}, ${e.firstName}`, email: e.email ?? "", date: new Date(year, m, s.getDate()).toISOString() });
    }
    return out;
  });

  rows.sort((a: { date: string; name: string }, b: { date: string; name: string }) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.name.localeCompare(b.name));

  const backHref = "/dashboard";
  const exportHref = `/api/export/dashboard?kind=${encodeURIComponent(kind)}&year=${year}` +
    (month !== null ? `&month=${month}` : "") + (quarter !== null ? `&quarter=${quarter}` : "");

  const titleKind = kind === "birthdays" ? "Geburtstage" : kind === "hires" ? "Eintritte" : kind === "jubilees" ? "Jubiläen" : "Details";

  return (
    <div className="p-8 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{titleKind} {year}</h1>
        <div className="flex items-center gap-2 text-sm">
          <a href={exportHref} className="rounded border px-3 py-1">CSV Export</a>
          <Link href={backHref} className="rounded border px-3 py-1">Zurück</Link>
        </div>
      </div>
      <DrilldownClient initialRows={rows} />
    </div>
  );
}
