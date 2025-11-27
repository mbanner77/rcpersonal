export const dynamic = "force-dynamic";
import type React from "react";
import Link from "next/link";
import { db } from "@/lib/prisma";
import Controls from "./Controls";
import { findUpcomingJubilees, parseJubileeYears, type EmployeeLike, isBirthday } from "@/lib/jubilee";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  // Load all dashboard data in parallel
  const [settings, employees, lastImport, taskStats, upcomingReminders] = await Promise.all([
    db.setting.findUnique({ where: { id: 1 } }),
    db.employee.findMany({ orderBy: { lastName: "asc" } }),
    db.employeeImportLog.findFirst({ orderBy: { createdAt: "desc" } }),
    // Task statistics
    (async () => {
      try {
        const [total, open, overdue] = await Promise.all([
          (db as unknown as { taskAssignment: { count: () => Promise<number> } }).taskAssignment.count(),
          (db as unknown as { taskAssignment: { count: (args: { where: { status: { isDone: boolean } } }) => Promise<number> } }).taskAssignment.count({ 
            where: { status: { isDone: false } } 
          }),
          (db as unknown as { taskAssignment: { count: (args: { where: { status: { isDone: boolean }; dueDate: { lt: Date } } }) => Promise<number> } }).taskAssignment.count({ 
            where: { status: { isDone: false }, dueDate: { lt: new Date() } } 
          }),
        ]);
        return { total, open, overdue, completed: total - open };
      } catch { return { total: 0, open: 0, overdue: 0, completed: 0 }; }
    })(),
    // Upcoming reminders (next 7 days)
    (async () => {
      try {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        return await (db as unknown as { reminder: { findMany: (args: { where: { dueDate: { gte: Date; lte: Date } }; include: { employee: { select: { firstName: true; lastName: true } } }; orderBy: { dueDate: "asc" }; take: number }) => Promise<Array<{ id: string; type: string; dueDate: Date; employee: { firstName: string; lastName: string } | null }>> } }).reminder.findMany({
          where: { dueDate: { gte: new Date(), lte: nextWeek } },
          include: { employee: { select: { firstName: true, lastName: true } } },
          orderBy: { dueDate: "asc" },
          take: 5,
        });
      } catch { return []; }
    })(),
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
  const lastImportDate = lastImport?.createdAt ?? null;
  const newEmployeesSinceLastImport: EmployeeRow[] = lastImportDate
    ? activeEmployees
        .filter((employee: EmployeeRow) => {
          const createdAt = employee.createdAt instanceof Date ? employee.createdAt : new Date(employee.createdAt);
          return createdAt.getTime() >= lastImportDate.getTime();
        })
        .sort((a, b) => {
          const aCreated = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
          const bCreated = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
          return bCreated - aCreated;
        })
    : [];
  const newEmployeesPreview = newEmployeesSinceLastImport.slice(0, 3).map((employee) => `${employee.firstName} ${employee.lastName}`).join(", ");

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

  function Chart({ data, title, color = "indigo", icon }: { data: number[]; title: string; color?: string; icon?: React.ReactNode }) {
    const max = Math.max(1, ...data);
    const total = data.reduce((sum, n) => sum + n, 0);
    const w = 560;
    const h = 120;
    const barW = w / data.length;
    const colorClasses: Record<string, { bar: string; highlight: string; bg: string }> = {
      indigo: { bar: "fill-indigo-400", highlight: "fill-indigo-500", bg: "from-indigo-500/10 to-indigo-500/5" },
      emerald: { bar: "fill-emerald-400", highlight: "fill-emerald-500", bg: "from-emerald-500/10 to-emerald-500/5" },
      amber: { bar: "fill-amber-400", highlight: "fill-amber-500", bg: "from-amber-500/10 to-amber-500/5" },
      rose: { bar: "fill-rose-400", highlight: "fill-rose-500", bg: "from-rose-500/10 to-rose-500/5" },
    };
    const c = colorClasses[color] ?? colorClasses.indigo;
    return (
      <div className={`rounded-2xl border border-zinc-200 bg-gradient-to-br ${c.bg} p-5 dark:border-zinc-700`}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{title}</span>
          </div>
          <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-400">Gesamt: {total}</span>
        </div>
        <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-2">
          {data.map((v, i) => {
            const bh = Math.max(4, Math.round((v / max) * (h - 28)));
            const x = i * barW + 4;
            const y = h - 16 - bh;
            const isMax = v === max && max > 0;
            return (
              <g key={i}>
                <rect x={x} y={y} width={barW - 8} height={bh} rx={4} className={`${isMax ? c.highlight : c.bar} transition-all duration-300`}>
                  <title>{monthLabels[i]}: {v}</title>
                </rect>
                {v > 0 && <text x={x + (barW - 8) / 2} y={y - 4} textAnchor="middle" fontSize="9" fontWeight="600" className="fill-zinc-600 dark:fill-zinc-400">{v}</text>}
                <text x={x + (barW - 8) / 2} y={h - 2} textAnchor="middle" fontSize="9" className="fill-zinc-500">{monthLabels[i]}</text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Dashboard</h1>
            <p className="mt-1 text-sm text-zinc-500">Übersicht über Mitarbeitende, Jubiläen und Geburtstage</p>
          </div>
          <Controls years={[currYear - 1, currYear, currYear + 1]} />
        </div>

        {/* KPI Cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Link
            href={`${buildFocusHref("jubilees-7")}#focus`}
            className={`group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:bg-zinc-800 ${
              focusParam === "jubilees-7" ? "border-amber-500 ring-2 ring-amber-400" : "border-zinc-200 hover:border-amber-300 dark:border-zinc-700"
            }`}
          >
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-amber-100/50 transition-transform group-hover:scale-125 dark:bg-amber-900/20" />
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
              </div>
              <div className="mt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">Jubiläen (7 Tage)</div>
              <div className="mt-1 text-3xl font-bold text-zinc-900 dark:text-white">{hits7.length}</div>
              <p className="mt-1 truncate text-xs text-zinc-500">{hits7.slice(0, 2).map((h) => `${h.employee.firstName} ${h.employee.lastName}`).join(", ") || "Keine anstehend"}</p>
            </div>
          </Link>

          <Link
            href={`${buildFocusHref("jubilees-window")}#focus`}
            className={`group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:bg-zinc-800 ${
              focusParam === "jubilees-window" ? "border-purple-500 ring-2 ring-purple-400" : "border-zinc-200 hover:border-purple-300 dark:border-zinc-700"
            }`}
          >
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-purple-100/50 transition-transform group-hover:scale-125 dark:bg-purple-900/20" />
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-900/30">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <div className="mt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">Jubiläen ({windowDays}T)</div>
              <div className="mt-1 text-3xl font-bold text-zinc-900 dark:text-white">{hitsWindow.length}</div>
              <p className="mt-1 text-xs text-zinc-500">Spitzenjahr: {order[0] ?? "–"} Jahre</p>
            </div>
          </Link>

          <Link
            href={`/dashboard/drilldown?kind=birthdays&year=${currYear}&month=${now.getMonth()}`}
            className={`group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:bg-zinc-800 ${
              focusParam === "birthdays-today" ? "border-rose-500 ring-2 ring-rose-400" : "border-zinc-200 hover:border-rose-300 dark:border-zinc-700"
            }`}
          >
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-rose-100/50 transition-transform group-hover:scale-125 dark:bg-rose-900/20" />
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-900/30">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.701 2.701 0 01-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" /></svg>
              </div>
              <div className="mt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">Geburtstage heute</div>
              <div className="mt-1 text-3xl font-bold text-zinc-900 dark:text-white">{birthdaysToday}</div>
              <p className="mt-1 text-xs text-zinc-500">Gesamt {currYear}: {totals.birthdays}</p>
            </div>
          </Link>

          <Link
            href={`${buildFocusHref("new-hires")}#focus`}
            className={`group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:bg-zinc-800 ${
              focusParam === "new-hires" ? "border-emerald-500 ring-2 ring-emerald-400" : "border-zinc-200 hover:border-emerald-300 dark:border-zinc-700"
            }`}
          >
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-emerald-100/50 transition-transform group-hover:scale-125 dark:bg-emerald-900/20" />
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
              </div>
              <div className="mt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">Neue Eintritte</div>
              <div className="mt-1 text-3xl font-bold text-zinc-900 dark:text-white">{newEmployeesSinceLastImport.length}</div>
              <p className="mt-1 truncate text-xs text-zinc-500">{lastImportDate ? (newEmployeesPreview || "Keine neuen") : "Kein Import"}</p>
            </div>
          </Link>

          <Link
            href={`${buildFocusHref("exits")}#focus`}
            className={`group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:bg-zinc-800 ${
              focusParam === "exits" ? "border-zinc-500 ring-2 ring-zinc-400" : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700"
            }`}
          >
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-zinc-100/50 transition-transform group-hover:scale-125 dark:bg-zinc-700/20" />
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-zinc-700/50">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </div>
              <div className="mt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">Ausgetreten</div>
              <div className="mt-1 text-3xl font-bold text-zinc-900 dark:text-white">{exitedEmployees.length}</div>
              <p className="mt-1 truncate text-xs text-zinc-500">{exitedEmployees.slice(0, 2).map((e: EmployeeRow) => `${e.lastName}`).join(", ") || "Keine"}</p>
            </div>
          </Link>
        </div>

        {/* Quick Actions & Today's Focus Row */}
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Quick Actions */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-zinc-900 dark:text-white">
              <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              Schnellaktionen
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/employees" className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-indigo-600 dark:hover:bg-indigo-900/20">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" /></svg>
                Mitarbeiter
              </Link>
              <Link href="/onboarding" className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-emerald-600 dark:hover:bg-emerald-900/20">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                Onboarding
              </Link>
              <Link href="/offboarding" className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-rose-600 dark:hover:bg-rose-900/20">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Offboarding
              </Link>
              <Link href="/admin/reminders" className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-amber-600 dark:hover:bg-amber-900/20">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                Erinnerungen
              </Link>
            </div>
          </div>

          {/* Lifecycle Task Stats */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-zinc-900 dark:text-white">
              <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
              Lifecycle-Aufgaben
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-700/50">
                <div className="text-2xl font-bold text-zinc-900 dark:text-white">{taskStats.total}</div>
                <div className="text-xs text-zinc-500">Gesamt</div>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-900/20">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{taskStats.completed}</div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400">Erledigt</div>
              </div>
              <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-900/20">
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{taskStats.open}</div>
                <div className="text-xs text-amber-600 dark:text-amber-400">Offen</div>
              </div>
              <div className="rounded-xl bg-rose-50 p-3 dark:bg-rose-900/20">
                <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{taskStats.overdue}</div>
                <div className="text-xs text-rose-600 dark:text-rose-400">Überfällig</div>
              </div>
            </div>
            {taskStats.total > 0 && (
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs text-zinc-500">
                  <span>Fortschritt</span>
                  <span>{Math.round((taskStats.completed / taskStats.total) * 100)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(taskStats.completed / taskStats.total) * 100}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* Upcoming Reminders */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
            <h3 className="mb-4 flex items-center justify-between font-semibold text-zinc-900 dark:text-white">
              <span className="flex items-center gap-2">
                <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Anstehende Erinnerungen
              </span>
              <Link href="/admin/reminders" className="text-xs font-normal text-indigo-600 hover:underline">Alle</Link>
            </h3>
            {upcomingReminders.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-500">Keine Erinnerungen in den nächsten 7 Tagen</p>
            ) : (
              <ul className="space-y-2">
                {upcomingReminders.map((reminder) => (
                  <li key={reminder.id} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{reminder.type}</span>
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">{reminder.employee?.lastName}, {reminder.employee?.firstName}</span>
                    </div>
                    <span className="text-xs text-zinc-500">{new Date(reminder.dueDate).toLocaleDateString("de-DE")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      {focusParam === "birthdays-today" && (
        <div id="focus" className="rounded-lg border p-4 bg-white dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium">Geburtstage heute</h2>
              <p className="text-sm text-zinc-500">Direkte Übersicht aller Mitarbeitenden mit Geburtstag am {now.toLocaleDateString()}.</p>
            </div>
            <Link href={buildFocusHref()} className="text-sm text-zinc-500 underline">Schließen</Link>
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
        <div id="focus" className="rounded-lg border p-4 bg-white dark:bg-zinc-900 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium">Ausgetretene Mitarbeitende</h2>
              <p className="text-sm text-zinc-500">Alle aktuell als „Ausgetreten“ markierten Personen.</p>
            </div>
            <Link href={buildFocusHref()} className="text-sm text-zinc-500 underline">Schließen</Link>
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
        <div id="focus" className="rounded-lg border p-4 bg-white dark:bg-zinc-900 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Jubiläen in den nächsten 7 Tagen</h2>
            <Link href={buildFocusHref()} className="text-sm text-zinc-500 underline">Schließen</Link>
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
        <div id="focus" className="rounded-lg border p-4 bg-white dark:bg-zinc-900 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium">Jubiläen in den nächsten {windowDays} Tagen</h2>
              <p className="text-sm text-zinc-500">Gesamtliste aller Treffer im aktuellen Beobachtungsfenster.</p>
            </div>
            <Link href={buildFocusHref()} className="text-sm text-zinc-500 underline">Schließen</Link>
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

      {focusParam === "new-hires" && (
        <div id="focus" className="rounded-lg border p-4 bg-white dark:bg-zinc-900 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium">Eingetretene Mitarbeitende</h2>
              <p className="text-sm text-zinc-500">
                {lastImportDate
                  ? `Neu erfasst seit dem letzten Import am ${lastImportDate.toLocaleDateString("de-DE")}.`
                  : "Noch keine Import-Historie vorhanden."}
              </p>
            </div>
            <Link href={buildFocusHref()} className="text-sm text-zinc-500 underline">Schließen</Link>
          </div>
          {lastImportDate ? (
            newEmployeesSinceLastImport.length === 0 ? (
              <p className="text-sm text-zinc-600">Keine neuen Eintritte seit dem letzten Import.</p>
            ) : (
              <ul className="divide-y">
                {newEmployeesSinceLastImport.map((employee: EmployeeRow) => {
                  const createdAt = employee.createdAt instanceof Date ? employee.createdAt : new Date(employee.createdAt);
                  const startDate = new Date(employee.startDate);
                  return (
                    <li key={employee.id} className="py-2 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <span>{employee.lastName}, {employee.firstName}</span>
                      <span className="text-sm text-zinc-500">
                        Erstellt am {createdAt.toLocaleDateString("de-DE")}
                        {Number.isFinite(startDate.getTime()) ? ` · Startdatum: ${startDate.toLocaleDateString("de-DE")}` : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )
          ) : (
            <p className="text-sm text-zinc-600">Bitte führen Sie einen Import durch, um neue Eintritte zu verfolgen.</p>
          )}
        </div>
      )}

      {/* Charts Section */}
      <div className="mb-8">
        <h2 className="mb-4 text-xl font-bold text-zinc-900 dark:text-white">Statistiken {currYear}</h2>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-3">
            <Chart 
              data={birthdaysPerMonth} 
              title="Geburtstage pro Monat" 
              color="rose"
              icon={<svg className="h-5 w-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.701 2.701 0 01-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" /></svg>}
            />
            <div className="flex flex-wrap gap-1.5">
              <a className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-300" href={`/dashboard/drilldown?kind=birthdays&year=${currYear}`}>Alle Details</a>
              {monthLabels.map((ml, i) => (
                <a key={ml} href={`/dashboard/drilldown?kind=birthdays&year=${currYear}&month=${i}`} className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 transition hover:border-rose-300 hover:bg-rose-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-rose-600">{ml}</a>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <Chart 
              data={jubileesPerMonth} 
              title="Jubiläen pro Monat" 
              color="amber"
              icon={<svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>}
            />
            <div className="flex flex-wrap gap-1.5">
              <a className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300" href={`/dashboard/drilldown?kind=jubilees&year=${currYear}`}>Alle Details</a>
              {monthLabels.map((ml, i) => (
                <a key={ml} href={`/dashboard/drilldown?kind=jubilees&year=${currYear}&month=${i}`} className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 transition hover:border-amber-300 hover:bg-amber-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-amber-600">{ml}</a>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <Chart 
              data={hiresPerMonth} 
              title="Eintritte pro Monat" 
              color="emerald"
              icon={<svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>}
            />
            <div className="flex flex-wrap gap-1.5">
              <a className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300" href={`/dashboard/drilldown?kind=hires&year=${currYear}`}>Alle Details</a>
              {monthLabels.map((ml, i) => (
                <a key={ml} href={`/dashboard/drilldown?kind=hires&year=${currYear}&month=${i}`} className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-emerald-600">{ml}</a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quarterly Section */}
      <div>
        <h2 className="mb-4 text-xl font-bold text-zinc-900 dark:text-white">Geburtstage nach Quartal {currYear}</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {quarters.map((q, idx) => (
            <div key={q.title} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
              <div className="flex items-center justify-between border-b border-zinc-100 bg-gradient-to-r from-zinc-50 to-white px-5 py-3 dark:border-zinc-700 dark:from-zinc-800 dark:to-zinc-800">
                <div className="flex items-center gap-2">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${idx === 0 ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30" : idx === 1 ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" : idx === 2 ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30" : "bg-rose-100 text-rose-600 dark:bg-rose-900/30"}`}>Q{idx + 1}</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{q.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <a className="rounded-lg bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300" href={`/dashboard/drilldown?kind=birthdays&year=${currYear}&quarter=${idx}`}>Details</a>
                  <a className="rounded-lg bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300" href={`/api/export/dashboard?kind=birthdays&year=${currYear}&quarter=${idx}`}>CSV</a>
                  <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">{q.items.length}</span>
                </div>
              </div>
              {/* Quarterly Items List */}
              <div className="max-h-64 overflow-y-auto px-5 py-3">
                {q.items.length === 0 ? (
                  <p className="py-4 text-center text-sm text-zinc-500">Keine Geburtstage in diesem Quartal.</p>
                ) : (
                  <ul className="divide-y divide-zinc-100 dark:divide-zinc-700">
                    {q.items.map((p) => (
                      <li key={`${q.title}-${p.name}-${p.dateLabel}`} className="flex items-center justify-between py-2">
                        <span className="text-sm text-zinc-800 dark:text-zinc-200">{p.name}</span>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">{p.dateLabel}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
