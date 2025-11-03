export const dynamic = "force-dynamic";
import Link from "next/link";
import { db } from "@/lib/prisma";
import { findUpcomingJubilees, isBirthday, parseJubileeYears, type EmployeeLike } from "@/lib/jubilee";

export default async function Home() {
  const [settings, employees] = await Promise.all([
    db.setting.findUnique({ where: { id: 1 } }),
    db.employee.findMany({ orderBy: { lastName: "asc" } }),
  ]);
  const years = parseJubileeYears(settings);
  const employeesLike = employees as unknown as EmployeeLike[];
  const totalEmployees = employees.length;
  const hits30 = findUpcomingJubilees(employeesLike, years, 30);
  const birthdaysToday = employees.reduce((count: number, e: { birthDate: Date }) => count + (isBirthday(new Date(e.birthDate)) ? 1 : 0), 0);

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-zinc-50 to-white p-10 dark:from-zinc-900 dark:to-zinc-950">
        <div className="relative z-10 max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight">Jubiläen & Mitarbeiter leicht im Blick</h1>
          <p className="mt-3 text-zinc-600 dark:text-zinc-400">
            Importiere Mitarbeiter, verwalte Daten und entdecke anstehende Jubiläen – inkl. automatischer E-Mail-Benachrichtigungen.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/employees" className="rounded-lg bg-black px-5 py-2.5 text-white hover:opacity-90">Jetzt Mitarbeiter importieren</Link>
            <Link href="/dashboard" className="rounded-lg border px-5 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900">Zum Dashboard</Link>
            <Link href="/settings" className="rounded-lg border px-5 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900">Einstellungen</Link>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-tr from-emerald-400/20 to-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-tr from-fuchsia-400/20 to-indigo-400/20 blur-3xl" />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 dark:bg-zinc-900">
          <div className="text-sm text-zinc-500">Mitarbeiter gesamt</div>
          <div className="mt-1 text-4xl font-semibold">{totalEmployees}</div>
        </div>
        <div className="rounded-xl border bg-white p-5 dark:bg-zinc-900">
          <div className="text-sm text-zinc-500">Jubiläen (30 Tage)</div>
          <div className="mt-1 text-4xl font-semibold">{hits30.length}</div>
        </div>
        <div className="rounded-xl border bg-white p-5 dark:bg-zinc-900">
          <div className="text-sm text-zinc-500">Geburtstage heute</div>
          <div className="mt-1 text-4xl font-semibold">{birthdaysToday}</div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border p-5">
          <h2 className="text-lg font-medium">Schnellstart</h2>
          <ol className="mt-3 list-decimal pl-5 text-sm text-zinc-700 dark:text-zinc-300 space-y-2">
            <li>Excel-Vorlage laden und Mitarbeiterdaten befüllen.</li>
            <li>Datei unter <span className="font-medium">Employees → Import</span> hochladen.</li>
            <li>Einstellungen (Manager-Verteiler, E-Mail-Templates) überprüfen.</li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href="/api/template" className="rounded border px-4 py-2">Excel-Vorlage</a>
            <Link href="/employees" className="rounded border px-4 py-2">Zu Employees</Link>
          </div>
        </div>
        <div className="rounded-xl border p-5">
          <h2 className="text-lg font-medium">Tipps</h2>
          <ul className="mt-3 list-disc pl-5 text-sm text-zinc-700 dark:text-zinc-300 space-y-2">
            <li>Felder/Datensätze sperren, um Überschreiben durch Re-Import zu verhindern.</li>
            <li>Auto-E-Mail erstellt <span className="font-mono">vorname.nachname@realcore.de</span>, wenn nicht gesetzt.</li>
            <li>Geburtstags- und Jubiläumsmails laufen über die tägliche Routine.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
