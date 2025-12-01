export const dynamic = "force-dynamic";
import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/prisma";
import { findUpcomingJubilees, isBirthday, parseJubileeYears, type EmployeeLike } from "@/lib/jubilee";

export default async function Home() {
  // Fetch all data in parallel
  const [settings, employees, onboardingTasks, offboardingTasks, ticketStats, assetStats, vehicleStats] = await Promise.all([
    db.setting.findUnique({ where: { id: 1 } }),
    db.employee.findMany({ orderBy: { lastName: "asc" } }),
    (db as unknown as { taskAssignment: { count: (args: { where: { type: string; status?: { isDone: boolean } } }) => Promise<number> } }).taskAssignment?.count?.({ where: { type: "ONBOARDING" } }).catch(() => 0) ?? Promise.resolve(0),
    (db as unknown as { taskAssignment: { count: (args: { where: { type: string; status?: { isDone: boolean } } }) => Promise<number> } }).taskAssignment?.count?.({ where: { type: "OFFBOARDING" } }).catch(() => 0) ?? Promise.resolve(0),
    // HR Tickets
    (async () => {
      try {
        const open = await (db as unknown as { hRTicket: { count: (args: { where: { status: string } }) => Promise<number> } }).hRTicket.count({ where: { status: "OPEN" } });
        return { open };
      } catch { return { open: 0 }; }
    })(),
    // Assets
    (async () => {
      try {
        const [total, pending] = await Promise.all([
          (db as unknown as { asset: { count: () => Promise<number> } }).asset.count(),
          (db as unknown as { assetTransfer: { count: (args: { where: { status: string } }) => Promise<number> } }).assetTransfer.count({ where: { status: "PENDING" } }),
        ]);
        return { total, pending };
      } catch { return { total: 0, pending: 0 }; }
    })(),
    // Vehicles
    (async () => {
      try {
        const total = await (db as unknown as { vehicle: { count: () => Promise<number> } }).vehicle.count();
        return { total };
      } catch { return { total: 0 }; }
    })(),
  ]);
  
  const years = parseJubileeYears(settings);
  const employeesLike = employees as unknown as EmployeeLike[];
  const activeEmployees = employees.filter(e => e.status === "ACTIVE");
  const totalEmployees = activeEmployees.length;
  const exitedEmployees = employees.filter(e => e.status === "EXITED").length;
  const hits30 = findUpcomingJubilees(employeesLike, years, 30);
  const birthdaysToday = activeEmployees.reduce((count: number, e: { birthDate: Date }) => count + (isBirthday(new Date(e.birthDate)) ? 1 : 0), 0);
  
  // New hires in last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const newHires = activeEmployees.filter(e => new Date(e.startDate) >= thirtyDaysAgo).length;

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-indigo-50 via-white to-emerald-50 dark:border-zinc-800 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800">
        <div className="grid lg:grid-cols-2 gap-8 p-8 lg:p-12">
          <div className="relative z-10 flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 w-fit">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              HR-Modul
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Mitarbeiter. Prozesse.<br />
              <span className="bg-gradient-to-r from-indigo-600 to-emerald-600 bg-clip-text text-transparent">Alles im Griff.</span>
            </h1>
            <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-300">
              Verwalten Sie Mitarbeiterdaten, steuern Sie Onboarding & Offboarding-Prozesse und behalten Sie alle HR-relevanten Informationen zentral im Blick.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/employees" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-700">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                Mitarbeiter verwalten
              </Link>
              <Link href="/lifecycle/onboarding" className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                Onboarding
              </Link>
              <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                Dashboard
              </Link>
            </div>
          </div>
          <div className="relative hidden lg:flex items-center justify-center">
            <div className="relative w-full max-w-md">
              <Image
                src="/hr-illustration.svg"
                alt="HR-Modul Illustration"
                width={400}
                height={300}
                className="w-full h-auto"
                priority
              />
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-gradient-to-tr from-indigo-400/20 to-purple-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-gradient-to-tr from-emerald-400/20 to-cyan-400/20 blur-3xl" />
      </section>

      {/* Statistics Grid */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Link href="/employees" className="group rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-indigo-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
            <div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">Aktive Mitarbeiter</div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{totalEmployees}</div>
            </div>
          </div>
        </Link>
        
        <Link href="/lifecycle/onboarding" className="group rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-emerald-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-700">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            </div>
            <div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">Onboarding-Aufgaben</div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{onboardingTasks}</div>
            </div>
          </div>
        </Link>
        
        <Link href="/lifecycle/offboarding" className="group rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-rose-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-rose-700">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" /></svg>
            </div>
            <div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">Offboarding-Aufgaben</div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{offboardingTasks}</div>
            </div>
          </div>
        </Link>
        
        <Link href="/dashboard" className="group rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-amber-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-amber-700">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" /></svg>
            </div>
            <div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">Jubiläen (30 Tage)</div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{hits30.length}</div>
            </div>
          </div>
        </Link>
      </section>

      {/* Additional Stats Row */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">Neue Eintritte (30 Tage)</div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{newHires}</div>
            </div>
          </div>
        </div>
        
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </div>
            <div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">Ausgetreten</div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{exitedEmployees}</div>
            </div>
          </div>
        </div>
        
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-100 text-pink-600 dark:bg-pink-900/50 dark:text-pink-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" /></svg>
            </div>
            <div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">Geburtstage heute</div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{birthdaysToday}</div>
            </div>
          </div>
        </div>
        
        <Link href="/admin/reminders" className="group rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-cyan-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-cyan-700">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 text-cyan-600 dark:bg-cyan-900/50 dark:text-cyan-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            </div>
            <div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">Erinnerungen</div>
              <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Verwalten →</div>
            </div>
          </div>
        </Link>
      </section>

      {/* HR-Tools Section */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">HR-Tools</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link href="/tickets" className="group rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-blue-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-700">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
              </div>
              <div>
                <div className="font-semibold text-zinc-900 dark:text-zinc-50">HR-Tickets</div>
                <div className="text-sm text-zinc-500">
                  {ticketStats.open > 0 ? (
                    <span className="text-blue-600 dark:text-blue-400">{ticketStats.open} offene Anfragen</span>
                  ) : (
                    "Keine offenen Anfragen"
                  )}
                </div>
              </div>
            </div>
          </Link>

          <Link href="/hardware" className="group rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-cyan-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-cyan-700">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100 text-cyan-600 dark:bg-cyan-900/50 dark:text-cyan-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <div>
                <div className="font-semibold text-zinc-900 dark:text-zinc-50">Hardware</div>
                <div className="text-sm text-zinc-500">
                  {assetStats.total} Geräte
                  {assetStats.pending > 0 && (
                    <span className="ml-1 text-orange-600 dark:text-orange-400">· {assetStats.pending} Übertragungen</span>
                  )}
                </div>
              </div>
            </div>
          </Link>

          <Link href="/fleet" className="group rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-violet-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-violet-700">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
              </div>
              <div>
                <div className="font-semibold text-zinc-900 dark:text-zinc-50">Fuhrpark</div>
                <div className="text-sm text-zinc-500">{vehicleStats.total} Fahrzeuge</div>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Mitarbeiterverwaltung</h2>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Importieren, bearbeiten und verwalten Sie alle Mitarbeiterstammdaten zentral.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/employees" className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800">
              Mitarbeiter
            </Link>
            <a href="/api/template" className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800">
              Excel-Vorlage
            </a>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
            </div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Lifecycle-Management</h2>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Steuern Sie Onboarding- und Offboarding-Prozesse mit strukturierten Aufgaben.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/lifecycle/onboarding" className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              Onboarding
            </Link>
            <Link href="/lifecycle/offboarding" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100 dark:border-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
              Offboarding
            </Link>
            <Link href="/admin/lifecycle" className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800">
              Vorlagen
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Administration</h2>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Konfigurieren Sie das System, verwalten Sie Benutzer und Einstellungen.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/users" className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800">
              Benutzer
            </Link>
            <Link href="/settings" className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800">
              Einstellungen
            </Link>
            <Link href="/admin/reminders" className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800">
              Erinnerungen
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
