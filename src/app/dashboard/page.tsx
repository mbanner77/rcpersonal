export const dynamic = "force-dynamic";
import { db } from "@/lib/prisma";
import Controls from "./Controls";
import { findUpcomingJubilees, parseJubileeYears, type EmployeeLike, isBirthday } from "@/lib/jubilee";
import dynamicImport from "next/dynamic";

const AiAssistant = dynamicImport(() => import("./AiAssistant"), { ssr: false, loading: () => <div className="rounded border p-4 bg-white dark:bg-zinc-900 text-sm text-zinc-600">Lade KI-Assistent…</div> });

type SearchParams = Record<string, string | string[] | undefined>;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const [settings, employees] = await Promise.all([
    db.setting.findUnique({ where: { id: 1 } }),
    db.employee.findMany({ orderBy: { lastName: "asc" } }),
  ]);
  const years = parseJubileeYears(settings);
  const employeesLike = employees as unknown as EmployeeLike[];
  const daysParam = Array.isArray(searchParams?.days) ? searchParams?.days[0] : searchParams?.days;
  const windowDays = Math.max(1, Math.min(365, Number(daysParam ?? 30) || 30));
  const hitsWindow = findUpcomingJubilees(employeesLike, years, windowDays);
  const hits7 = findUpcomingJubilees(employeesLike, years, 7);
  const birthdaysToday = employees.reduce((count: number, e: { birthDate: Date }) => count + (isBirthday(new Date(e.birthDate)) ? 1 : 0), 0);

  const grouped = hitsWindow.reduce<Record<number, typeof hitsWindow>>((acc, h) => {
    (acc[h.years] ||= []).push(h);
    return acc;
  }, {});
  const order = Object.keys(grouped)
    .map((n) => parseInt(n, 10))
    .sort((a, b) => a - b);

  const now = new Date();
  const yearParam = Array.isArray(searchParams?.year) ? searchParams?.year[0] : searchParams?.year;
  const currYear = Number(yearParam ?? now.getFullYear()) || now.getFullYear();
  const monthLabels = ["Jan","Feb","Mrz","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

  const birthdaysPerMonth = Array.from({ length: 12 }, () => 0);
  for (const e of employees) {
    const d = new Date(e.birthDate);
    birthdaysPerMonth[d.getMonth()]++;
  }

  // Birthdays per quarter (current selected year)
  type Person = { name: string; dateLabel: string };
  const quarters: { title: string; items: Person[] }[] = [
    { title: "Q1 (Jan–Mär)", items: [] },
    { title: "Q2 (Apr–Jun)", items: [] },
    { title: "Q3 (Jul–Sep)", items: [] },
    { title: "Q4 (Okt–Dez)", items: [] },
  ];
  for (const e of employees) {
    const b = new Date(e.birthDate);
    const m = b.getMonth();
    const q = Math.floor(m / 3);
    const thisYear = new Date(currYear, m, b.getDate());
    const name = `${e.lastName}, ${e.firstName}`;
    quarters[q].items.push({ name, dateLabel: thisYear.toLocaleDateString() });
  }
  for (const q of quarters) q.items.sort((a, b) => a.dateLabel.localeCompare(b.dateLabel));

  const hiresPerMonth = Array.from({ length: 12 }, () => 0);
  for (const e of employees) {
    const s = new Date(e.startDate);
    if (s.getFullYear() === currYear) hiresPerMonth[s.getMonth()]++;
  }

  const jubileesPerMonth = Array.from({ length: 12 }, () => 0);
  for (const e of employees) {
    const start = new Date(e.startDate);
    const anniv = new Date(currYear, start.getMonth(), start.getDate());
    const yrs = currYear - start.getFullYear();
    if (yrs > 0 && years.includes(yrs)) {
      jubileesPerMonth[anniv.getMonth()]++;
    }
  }

  const totals = {
    birthdays: birthdaysPerMonth.reduce((sum, n) => sum + n, 0),
    hires: hiresPerMonth.reduce((sum, n) => sum + n, 0),
    jubilees: jubileesPerMonth.reduce((sum, n) => sum + n, 0),
  };

  const highlightColor = "fill-lime-500 dark:fill-lime-400";

  function Chart({ data, title }: { data: number[]; title: string }) {
    const max = Math.max(1, ...data);
    const w = 560;
    const h = 140;
    const barW = w / data.length;
    return (
      <div className="rounded-lg border p-4 bg-white dark:bg-zinc-900">
        <div className="mb-2 flex items-center justify-between text-sm text-zinc-600">
          <span>{title}</span>
          <span className="text-xs text-zinc-500">Gesamt: {data.reduce((sum, n) => sum + n, 0)}</span>
        </div>
        <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
          {data.map((v, i) => {
            const bh = Math.round((v / max) * (h - 24));
            const x = i * barW + 6;
            const y = h - 6 - bh;
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width={barW - 12}
                  height={bh}
                  rx={3}
                  className={`fill-zinc-800 dark:fill-zinc-200 ${v === max && max > 0 ? highlightColor : ""}`}
                >
                  <title>{monthLabels[i]}: {v}</title>
                </rect>
                <text x={x + (barW - 12) / 2} y={y - 4} textAnchor="middle" fontSize="10" className="fill-zinc-500">{v}</text>
                <text x={x + (barW - 12) / 2} y={h - 8} textAnchor="middle" fontSize="10" className="fill-zinc-600">{monthLabels[i]}</text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <Controls years={[currYear - 1, currYear, currYear + 1]} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-lg border p-4 bg-white dark:bg-zinc-900 space-y-1">
          <div className="text-sm text-zinc-500">Jubiläen (nächste 7 Tage)</div>
          <div className="text-3xl font-semibold">{hits7.length}</div>
          <p className="text-xs text-zinc-500">{hits7.slice(0, 3).map((h) => `${h.employee.firstName} ${h.employee.lastName} (${h.years}J)`).join(", ") || "Keine."}</p>
        </div>
        <div className="rounded-lg border p-4 bg-white dark:bg-zinc-900 space-y-1">
          <div className="text-sm text-zinc-500">Jubiläen (nächste {windowDays} Tage)</div>
          <div className="text-3xl font-semibold">{hitsWindow.length}</div>
          <p className="text-xs text-zinc-500">Spitzenjahr: {order[0] ?? "–"} Jahre</p>
        </div>
        <div className="rounded-lg border p-4 bg-white dark:bg-zinc-900 space-y-1">
          <div className="text-sm text-zinc-500">Geburtstage heute</div>
          <div className="text-3xl font-semibold">{birthdaysToday}</div>
          <p className="text-xs text-zinc-500">Gesamt Geburtstage {currYear}: {totals.birthdays}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-6">
          <h2 className="text-xl font-medium">Jubiläen (nächste {windowDays} Tage)</h2>
          {order.length === 0 ? (
            <p className="text-zinc-600">Keine anstehenden Jubiläen.</p>
          ) : (
            order.map((y) => (
              <div key={y} className="space-y-2">
                <h3 className="text-lg font-medium">{y} Jahre</h3>
                <ul className="divide-y border rounded bg-white dark:bg-zinc-900">
                  {grouped[y].map((h) => (
                    <li key={h.employee.id} className="p-3 flex items-center justify-between">
                      <span>{h.employee.lastName}, {h.employee.firstName}</span>
                      <span className="text-sm text-zinc-600">am {h.anniversaryDate.toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
        <AiAssistant />
      </div>

      <h2 className="text-xl font-medium">Auswertungen {currYear}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Chart data={birthdaysPerMonth} title="Geburtstage pro Monat" />
          <div>
            <a className="text-sm underline" href={`/dashboard/drilldown?kind=birthdays&year=${currYear}`}>Alle Details</a>
          </div>
          <div className="flex flex-wrap gap-1 text-xs text-zinc-700">
            {monthLabels.map((ml, i) => (
              <a key={ml} href={`/dashboard/drilldown?kind=birthdays&year=${currYear}&month=${i}`} className="border rounded-full px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">{ml}</a>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Chart data={jubileesPerMonth} title="Jubiläen pro Monat" />
          <div>
            <a className="text-sm underline" href={`/dashboard/drilldown?kind=jubilees&year=${currYear}`}>Alle Details</a>
          </div>
          <div className="flex flex-wrap gap-1 text-xs text-zinc-700">
            {monthLabels.map((ml, i) => (
              <a key={ml} href={`/dashboard/drilldown?kind=jubilees&year=${currYear}&month=${i}`} className="border rounded-full px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">{ml}</a>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Chart data={hiresPerMonth} title="Eintritte pro Monat" />
          <div>
            <a className="text-sm underline" href={`/dashboard/drilldown?kind=hires&year=${currYear}`}>Alle Details</a>
          </div>
          <div className="flex flex-wrap gap-1 text-xs text-zinc-700">
            {monthLabels.map((ml, i) => (
              <a key={ml} href={`/dashboard/drilldown?kind=hires&year=${currYear}&month=${i}`} className="border rounded-full px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">{ml}</a>
            ))}
          </div>
        </div>
      </div>

      <h2 className="text-xl font-medium">Geburtstage nach Quartal {currYear}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quarters.map((q) => (
          <div key={q.title} className="rounded-lg border p-4 bg-white dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <div className="text-sm text-zinc-600">{q.title}</div>
              <div className="flex items-center gap-3 text-sm text-zinc-600">
                <a className="underline" href={`/dashboard/drilldown?kind=birthdays&year=${currYear}&quarter=${quarters.indexOf(q)}`}>Details</a>
                <a className="underline" href={`/api/export/dashboard?kind=birthdays&year=${currYear}&quarter=${quarters.indexOf(q)}`}>CSV</a>
                <div>{q.items.length} Personen</div>
              </div>
            </div>
            {q.items.length === 0 ? (
              <p className="text-zinc-600 mt-2">Keine Geburtstage.</p>
            ) : (
              <ul className="mt-2 divide-y">
                {q.items.map((p) => (
                  <li key={`${q.title}-${p.name}-${p.dateLabel}`} className="py-1 flex items-center justify-between">
                    <span>{p.name}</span>
                    <span className="text-sm text-zinc-600">{p.dateLabel}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
