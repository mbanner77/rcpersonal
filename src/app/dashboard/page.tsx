export const dynamic = "force-dynamic";
import { db } from "@/lib/prisma";
import { findUpcomingJubilees, parseJubileeYears, type EmployeeLike, isBirthday } from "@/lib/jubilee";

export default async function DashboardPage() {
  const [settings, employees] = await Promise.all([
    db.setting.findUnique({ where: { id: 1 } }),
    db.employee.findMany({ orderBy: { lastName: "asc" } }),
  ]);
  const years = parseJubileeYears(settings);
  const employeesLike = employees as unknown as EmployeeLike[];
  const hits30 = findUpcomingJubilees(employeesLike, years, 30);
  const hits7 = findUpcomingJubilees(employeesLike, years, 7);
  const birthdaysToday = employees.reduce((count: number, e: { birthDate: Date }) => count + (isBirthday(new Date(e.birthDate)) ? 1 : 0), 0);

  const grouped = hits30.reduce<Record<number, typeof hits30>>((acc, h) => {
    (acc[h.years] ||= []).push(h);
    return acc;
  }, {});
  const order = Object.keys(grouped)
    .map((n) => parseInt(n, 10))
    .sort((a, b) => a - b);

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border p-4 bg-white dark:bg-zinc-900">
          <div className="text-sm text-zinc-500">Jubiläen (7 Tage)</div>
          <div className="text-3xl font-semibold">{hits7.length}</div>
        </div>
        <div className="rounded-lg border p-4 bg-white dark:bg-zinc-900">
          <div className="text-sm text-zinc-500">Jubiläen (30 Tage)</div>
          <div className="text-3xl font-semibold">{hits30.length}</div>
        </div>
        <div className="rounded-lg border p-4 bg-white dark:bg-zinc-900">
          <div className="text-sm text-zinc-500">Geburtstage heute</div>
          <div className="text-3xl font-semibold">{birthdaysToday}</div>
        </div>
      </div>

      <h2 className="text-xl font-medium">Jubiläen (nächste 30 Tage)</h2>
      {order.length === 0 ? (
        <p className="text-zinc-600">Keine anstehenden Jubiläen.</p>
      ) : (
        order.map((y) => (
          <div key={y} className="space-y-2">
            <h2 className="text-xl font-medium">{y} Jahre</h2>
            <ul className="divide-y border rounded bg-white dark:bg-zinc-900">
              {grouped[y].map((h) => (
                <li key={h.employee.id} className="p-3 flex items-center justify-between">
                  <span>
                    {h.employee.lastName}, {h.employee.firstName}
                  </span>
                  <span className="text-sm text-zinc-600">
                    am {h.anniversaryDate.toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
