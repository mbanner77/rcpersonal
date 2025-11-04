import { db } from "@/lib/prisma";
import DrilldownChooser from "./DrilldownChooser";
import DrilldownHeader from "./DrilldownHeader";
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

  const birthdaysRows = employees.flatMap((e: { id: string; firstName: string; lastName: string; email: string | null; startDate: Date; birthDate: Date }) => {
    const out: { id: string; name: string; email: string; date: string; extra?: string }[] = [];
    const b = new Date(e.birthDate);
    const m = b.getMonth();
    if (month !== null && m !== month) return out;
    if (quarter !== null && Math.floor(m / 3) !== quarter) return out;
    out.push({ id: e.id, name: `${e.lastName}, ${e.firstName}`, email: e.email ?? "", date: new Date(year, m, b.getDate()).toISOString() });
    return out;
  }).sort((a: { date: string; name: string }, b: { date: string; name: string }) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.name.localeCompare(b.name));

  const hiresRows = employees.flatMap((e: { id: string; firstName: string; lastName: string; email: string | null; startDate: Date; birthDate: Date }) => {
    const out: { id: string; name: string; email: string; date: string; extra?: string }[] = [];
    const s = new Date(e.startDate);
    if (s.getFullYear() !== year) return out;
    const m = s.getMonth();
    if (month !== null && m !== month) return out;
    if (quarter !== null && Math.floor(m / 3) !== quarter) return out;
    out.push({ id: e.id, name: `${e.lastName}, ${e.firstName}`, email: e.email ?? "", date: s.toISOString() });
    return out;
  }).sort((a: { date: string; name: string }, b: { date: string; name: string }) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.name.localeCompare(b.name));

  const jubileesRows = employees
    .flatMap((e: { id: string; firstName: string; lastName: string; email: string | null; startDate: Date; birthDate: Date }) => {
      const out: { id: string; name: string; email: string; date: string; extra?: string }[] = [];
      const s = new Date(e.startDate);
      const m = s.getMonth();
      if (month !== null && m !== month) return out;
      if (quarter !== null && Math.floor(m / 3) !== quarter) return out;
      const yrs = year - s.getFullYear();
      if (yrs > 0 && years.includes(yrs)) {
        out.push({ id: e.id, name: `${e.lastName}, ${e.firstName}`, email: e.email ?? "", date: s.toISOString(), extra: `${yrs} Jahre` });
      }
      return out;
    })
    .sort((a: { date: string; name: string }, b: { date: string; name: string }) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.name.localeCompare(b.name));

  return (
    <div className="p-8 space-y-4">
      <DrilldownHeader year={year} month={month} quarter={quarter} />
      <KindSwitcher />
      <DrilldownChooser
        birthdays={birthdaysRows}
        hires={hiresRows}
        jubilees={jubileesRows}
        initialMonth={month}
      />
    </div>
  );
}
