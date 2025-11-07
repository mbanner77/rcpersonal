import { db } from "@/lib/prisma";
import { findJubileesOnDay, parseJubileeYears, type EmployeeLike } from "@/lib/jubilee";
import { renderTemplate, sendMail } from "@/lib/email";

function parseList(csv: string): string[] {
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function GET() {
  const today = new Date();

  const [settings, employees] = await Promise.all([
    db.setting.findUnique({ where: { id: 1 } }),
    db.employee.findMany(),
  ]);

  const years = parseJubileeYears(settings ?? undefined);
  const jubileeHits = findJubileesOnDay(employees as EmployeeLike[], years, today);

  // Birthdays
  const birthdayTemplate = settings?.birthdayEmailTemplate ?? "Happy Birthday, {{firstName}}!";
  let birthdaySent = 0;
  for (const e of employees) {
    const b = new Date(e.birthDate);
    if (b.getDate() === today.getDate() && b.getMonth() === today.getMonth()) {
      if (e.email) {
        const html = renderTemplate(birthdayTemplate, {
          firstName: e.firstName,
          lastName: e.lastName,
        });
        await sendMail({ to: e.email, subject: "Alles Gute zum Geburtstag!", html });
        birthdaySent++;
      }
    }
  }

  // Managers
  const managerEmails = parseList(settings?.managerEmails ?? "");
  let managerSent = 0;
  if (managerEmails.length && jubileeHits.length) {
    const rows = jubileeHits
      .map((h) => `${h.years} Jahre: ${h.employee.lastName}, ${h.employee.firstName}`)
      .join("<br>");
    const html = renderTemplate(settings?.jubileeEmailTemplate ?? "Congrats on {{years}} years, {{firstName}}!", {
      years: "",
      firstName: "",
    }) + `<div style="margin-top:12px">${rows}</div>`;
    await sendMail({ to: managerEmails, subject: "Jubilare heute", html });
    managerSent = managerEmails.length;
  }

  return Response.json({ birthdays: birthdaySent, jubileeHits: jubileeHits.length, managersNotified: managerSent });
}
