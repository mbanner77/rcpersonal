export const dynamic = "force-dynamic";
import { db } from "@/lib/prisma";
import Controls from "./Controls";
import { findUpcomingJubilees, parseJubileeYears, type EmployeeLike, isBirthday } from "@/lib/jubilee";
import AiAssistant from "./AiAssistant";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const [settings, employees] = await Promise.all([
    db.setting.findUnique({ where: { id: 1 } }),
    db.employee.findMany({ orderBy: { lastName: "asc" } }),
  ]);
  const years = parseJubileeYears(settings);
  type EmployeeRow = (typeof employees)[number];
  const activeEmployees: EmployeeRow[] = employees.filter((employee: EmployeeRow) => employee.status === "ACTIVE");
  const exitedEmployees = employees
    .filter((employee: EmployeeRow) => employee.status === "EXITED")
    .map((employee: EmployeeRow) => ({
      ...employee,
      exitDate: employee.exitDate ? new Date(employee.exitDate) : null,
    }))
    .sort((a: EmployeeRow & { exitDate: Date | null }, b: EmployeeRow & { exitDate: Date | null }) => {
      const aTime = a.exitDate ? a.exitDate.getTime() : 0;
      const bTime = b.exitDate ? b.exitDate.getTime() : 0;
      return bTime - aTime;
    });
  const employeesLike = activeEmployees as unknown as EmployeeLike[];
  type EmployeeRecord = (typeof activeEmployees)[number];
  type BirthdayPerson = { id: string; firstName: string; lastName: string; birthDate: Date };
  const daysParam = Array.isArray(searchParams?.days) ? searchParams?.days[0] : searchParams?.days;
  const windowDays = Math.max(1, Math.min(365, Number(daysParam ?? 30) || 30));
  const hitsWindow = findUpcomingJubilees(employeesLike, years, windowDays);
  const hits7 = findUpcomingJubilees(employeesLike, years, 7);
  const birthdaysTodayList: BirthdayPerson[] = activeEmployees
    .filter((employee: EmployeeRecord) => isBirthday(new Date(employee.birthDate)))
    .map((employee: EmployeeRecord) => ({
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      birthDate: new Date(employee.birthDate),
    }))
    .sort((a: BirthdayPerson, b: BirthdayPerson) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  const birthdaysToday = birthdaysTodayList.length;

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
  const focusParamRaw = Array.isArray(searchParams?.focus) ? searchParams.focus[0] : searchParams?.focus;
  const focusParam = typeof focusParamRaw === "string" ? focusParamRaw : undefined;
  const monthLabels = ["Jan","Feb","Mrz","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

  const preservedQueryEntries: [string, string][] = [];
  if (typeof daysParam === "string") preservedQueryEntries.push(["days", daysParam]);
  if (typeof yearParam === "string") preservedQueryEntries.push(["year", yearParam]);
  const buildFocusHref = (focus?: string) => {
    const params = new URLSearchParams(preservedQueryEntries);
    if (focus) params.set("focus", focus);
    const qs = params.toString();
    return qs ? `/dashboard?${qs}` : "/dashboard";
  };

  const birthdaysPerMonth = Array.from({ length: 12 }, () => 0);
  for (const e of activeEmployees) {
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
  for (const e of activeEmployees) {
    const b = new Date(e.birthDate);
    const m = b.getMonth();
    const q = Math.floor(m / 3);
    const thisYear = new Date(currYear, m, b.getDate());
    const name = `${e.lastName}, ${e.firstName}`;
    quarters[q].items.push({ name, dateLabel: thisYear.toLocaleDateString() });
  }
  for (const q of quarters) q.items.sort((a, b) => a.dateLabel.localeCompare(b.dateLabel));

  const hiresPerMonth = Array.from({ length: 12 }, () => 0);
  for (const e of activeEmployees) {
    const s = new Date(e.startDate);
    if (s.getFullYear() === currYear) hiresPerMonth[s.getMonth()]++;
  }

  const jubileesPerMonth = Array.from({ length: 12 }, () => 0);
  for (const e of activeEmployees) {
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <a
          href={buildFocusHref("jubilees-7")}
          className={`rounded-lg border p-4 bg-white dark:bg-zinc-900 space-y-1 block transition hover:border-lime-400 hover:-translate-y-0.5 ${
            focusParam === "jubilees-7" ? "border-lime-500 ring-2 ring-lime-400" : ""
          }`}
        >
          <div className="text-sm text-zinc-500">Jubiläen (nächste 7 Tage)</div>
          <div className="text-3xl font-semibold">{hits7.length}</div>
          <p className="text-xs text-zinc-500">{hits7.slice(0, 3).map((h) => `${h.employee.firstName} ${h.employee.lastName} (${h.years}J)`).join(", ") || "Keine."}</p>
        </a>
        <a
          href={buildFocusHref("jubilees-window")}
          className={`rounded-lg border p-4 bg-white dark:bg-zinc-900 space-y-1 block transition hover:border-lime-400 hover:-translate-y-0.5 ${
            focusParam === "jubilees-window" ? "border-lime-500 ring-2 ring-lime-400" : ""
          }`}
        >
          <div className="text-sm text-zinc-500">Jubiläen (nächste {windowDays} Tage)</div>
          <div className="text-3xl font-semibold">{hitsWindow.length}</div>
          <p className="text-xs text-zinc-500">Spitzenjahr: {order[0] ?? "–"} Jahre</p>
        </a>
        <a
          href={buildFocusHref("birthdays-today")}
          className={`rounded-lg border p-4 bg-white dark:bg-zinc-900 space-y-1 block transition hover:border-lime-400 hover:-translate-y-0.5 ${
            focusParam === "birthdays-today" ? "border-lime-500 ring-2 ring-lime-400" : ""
          }`}
        >
          <div className="text-sm text-zinc-500">Geburtstage heute</div>
          <div className="text-3xl font-semibold">{birthdaysToday}</div>
          <p className="text-xs text-zinc-500">Gesamt Geburtstage {currYear}: {totals.birthdays}</p>
        </a>
        <a
          href={buildFocusHref("exits")}
          className={`rounded-lg border p-4 bg-white dark:bg-zinc-900 space-y-1 block transition hover:border-lime-400 hover:-translate-y-0.5 ${
            focusParam === "exits" ? "border-lime-500 ring-2 ring-lime-400" : ""
          }`}
        >
          <div className="text-sm text-zinc-500">Ausgetretene Mitarbeitende</div>
          <div className="text-3xl font-semibold">{exitedEmployees.length}</div>
          <p className="text-xs text-zinc-500">
            {exitedEmployees.slice(0, 3).map((employee: EmployeeRow & { exitDate: Date | null }) => `${employee.lastName}, ${employee.firstName}${employee.exitDate ? ` (${employee.exitDate.toLocaleDateString()})` : ""}`).join(" · ") || "Keine."}
          </p>
        </a>
      </div>

      {focusParam === "birthdays-today" && (
        <div className="rounded-lg border p-4 bg-white dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium">Geburtstage heute</h2>
              <p className="text-sm text-zinc-500">Direkte Übersicht aller Mitarbeitenden mit Geburtstag am {now.toLocaleDateString()}.</p>
            </div>
            <a href={buildFocusHref()} className="text-sm text-zinc-500 underline">Schließen</a>
          </div>
          {birthdaysTodayList.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600">Heute feiert niemand Geburtstag.</p>
          ) : (
            <ul className="mt-3 divide-y">
              {birthdaysTodayList.map((person: BirthdayPerson) => {
                const age = now.getFullYear() - person.birthDate.getFullYear();
                return (
                  <li key={person.id} className="py-2 flex items-center justify-between">
                    <span>{person.lastName}, {person.firstName}</span>
                    <span className="text-sm text-zinc-500">{person.birthDate.toLocaleDateString()} · {age}. Geburtstag</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {focusParam === "exits" && (
        <div className="rounded-lg border p-4 bg-white dark:bg-zinc-900 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium">Ausgetretene Mitarbeitende</h2>
              <p className="text-sm text-zinc-500">Alle aktuell als „Ausgetreten“ markierten Personen.</p>
            </div>
            <a href={buildFocusHref()} className="text-sm text-zinc-500 underline">Schließen</a>
          </div>
          {exitedEmployees.length === 0 ? (
            <p className="text-sm text-zinc-600">Derzeit sind keine Mitarbeitenden als ausgetreten markiert.</p>
          ) : (
            <ul className="divide-y">
              {exitedEmployees.map((employee: EmployeeRow & { exitDate: Date | null }) => (
                <li key={employee.id} className="py-2 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <span>{employee.lastName}, {employee.firstName}</span>
                  <span className="text-sm text-zinc-500">
                    Austrittsdatum: {employee.exitDate ? employee.exitDate.toLocaleDateString() : "unbekannt"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {focusParam === "jubilees-7" && (
        <div className="rounded-lg border p-4 bg-white dark:bg-zinc-900 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Jubiläen in den nächsten 7 Tagen</h2>
            <a href={buildFocusHref()} className="text-sm text-zinc-500 underline">Schließen</a>
          </div>
          {hits7.length === 0 ? (
            <p className="text-sm text-zinc-600">In den kommenden sieben Tagen stehen keine Jubiläen an.</p>
          ) : (
            <ul className="divide-y">
              {hits7.map((hit) => (
                <li key={`${hit.employee.id}-${hit.years}`} className="py-2 flex items-center justify-between">
                  <span>{hit.employee.lastName}, {hit.employee.firstName}</span>
                  <span className="text-sm text-zinc-500">{hit.anniversaryDate.toLocaleDateString()} · {hit.years} Jahre</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {focusParam === "jubilees-window" && (
        <div className="rounded-lg border p-4 bg-white dark:bg-zinc-900 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium">Jubiläen in den nächsten {windowDays} Tagen</h2>
              <p className="text-sm text-zinc-500">Gesamtliste aller Treffer im aktuellen Beobachtungsfenster.</p>
            </div>
            <a href={buildFocusHref()} className="text-sm text-zinc-500 underline">Schließen</a>
          </div>
          {hitsWindow.length === 0 ? (
            <p className="text-sm text-zinc-600">Keine anstehenden Jubiläen im gewählten Zeitraum.</p>
          ) : (
            order.map((y) => (
              <div key={`focus-${y}`} className="space-y-2">
                <h3 className="text-md font-medium">{y} Jahre</h3>
                <ul className="divide-y">
                  {grouped[y].map((hit) => (
                    <li key={`${hit.employee.id}-${hit.years}`} className="py-2 flex items-center justify-between">
                      <span>{hit.employee.lastName}, {hit.employee.firstName}</span>
                      <span className="text-sm text-zinc-500">{hit.anniversaryDate.toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}

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
