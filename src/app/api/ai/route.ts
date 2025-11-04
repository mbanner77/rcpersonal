import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { findUpcomingJubilees, parseJubileeYears, type EmployeeLike, isBirthday } from "@/lib/jubilee";
import { generateInsightPrompt } from "@/lib/ai/insights";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    if (!question) {
      return NextResponse.json({ error: "Frage erforderlich" }, { status: 400 });
    }

    const [settings, employees] = await Promise.all([
      db.setting.findUnique({ where: { id: 1 } }),
      db.employee.findMany({ orderBy: { lastName: "asc" } }),
    ]);

    const years = parseJubileeYears(settings);
    const employeesLike = employees as unknown as EmployeeLike[];

    const windowDays = 30;
    const hits7 = findUpcomingJubilees(employeesLike, years, 7);
    const hitsWindow = findUpcomingJubilees(employeesLike, years, windowDays);

    const grouped = hitsWindow.reduce<Record<number, typeof hitsWindow>>((acc, h) => {
      (acc[h.years] ||= []).push(h);
      return acc;
    }, {});
    const topYears = Object.keys(grouped)
      .map((n) => parseInt(n, 10))
      .sort((a, b) => a - b)
      .slice(0, 5);

    const birthdaysToday = employees.reduce(
      (count: number, e: { birthDate: Date }) => count + (isBirthday(new Date(e.birthDate)) ? 1 : 0),
      0,
    );

    const birthdaysPerMonth = Array.from({ length: 12 }, () => 0);
    const hiresPerMonth = Array.from({ length: 12 }, () => 0);
    const jubileesPerMonth = Array.from({ length: 12 }, () => 0);

    const now = new Date();
    const currYear = now.getFullYear();

    for (const e of employees) {
      const b = new Date(e.birthDate);
      birthdaysPerMonth[b.getMonth()]++;
    }

    for (const e of employees) {
      const s = new Date(e.startDate);
      if (s.getFullYear() === currYear) {
        hiresPerMonth[s.getMonth()]++;
      }
    }

    for (const e of employees) {
      const start = new Date(e.startDate);
      const yrs = currYear - start.getFullYear();
      if (yrs > 0 && years.includes(yrs)) {
        jubileesPerMonth[start.getMonth()]++;
      }
    }

    const totals = {
      birthdays: birthdaysPerMonth.reduce((sum, n) => sum + n, 0),
      hires: hiresPerMonth.reduce((sum, n) => sum + n, 0),
      jubilees: jubileesPerMonth.reduce((sum, n) => sum + n, 0),
    };

    const answer = await generateInsightPrompt(question, {
      windowDays,
      hits7: hits7.length,
      hitsWindow: hitsWindow.length,
      topYears,
      birthdaysToday,
      totals,
    });

    return NextResponse.json({ answer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
