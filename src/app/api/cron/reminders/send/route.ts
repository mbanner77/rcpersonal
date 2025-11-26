import { db } from "@/lib/prisma";
import { sendMail } from "@/lib/email";
import { requireUser, hasRole } from "@/lib/auth";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function formatDate(d: Date) {
  return d.toLocaleDateString("de-DE");
}

export async function POST() {
  // Limit to ADMIN for now; could also add CRON secret later if needed
  const user = await requireUser();
  if (!hasRole(user, "ADMIN")) return new Response("Forbidden", { status: 403 });

  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);

  // Load active reminders with schedules and recipients
  const reminders = await db.reminder.findMany({
    where: { active: true },
    include: {
      employee: { select: { firstName: true, lastName: true } },
      schedules: true,
      recipients: true,
    },
  });

  let sent = 0;
  for (const r of reminders) {
    const due = new Date(r.dueDate);
    for (const s of r.schedules) {
      const targetDay = new Date(due);
      targetDay.setDate(targetDay.getDate() - s.daysBefore);
      // if schedule falls on today
      if (targetDay >= dayStart && targetDay <= dayEnd) {
        // Optional timeOfDay gate: if provided, only send after that time
        if (s.timeOfDay) {
          const [hh, mm] = s.timeOfDay.split(":").map((n) => parseInt(n || "0", 10));
          const gate = new Date(today);
          gate.setHours(hh || 0, mm || 0, 0, 0);
          if (today < gate) continue;
        }

        for (const rec of r.recipients) {
          // Dedup: check if a log exists today for this reminder/schedule/email
          const already = await db.reminderSendLog.findFirst({
            where: {
              reminderId: r.id,
              scheduleLabel: s.label,
              targetEmail: rec.email,
              sentAt: { gte: dayStart, lte: dayEnd },
            },
          });
          if (already) continue;

          const subject = `Erinnerung: ${r.type} – ${r.employee?.lastName ?? ""}, ${r.employee?.firstName ?? ""} – ${formatDate(due)}`;
          const html = `
            <p><strong>Erinnerung:</strong> ${r.type}</p>
            ${r.description ? `<p>${r.description}</p>` : ""}
            <p><strong>Berechtigter:</strong> ${r.employee?.lastName ?? ""}, ${r.employee?.firstName ?? ""}</p>
            <p><strong>Fälligkeit:</strong> ${formatDate(due)}</p>
            <p><strong>Hinweis:</strong> ${s.label} (${s.daysBefore} Tage vorher${s.timeOfDay ? `, ${s.timeOfDay} Uhr` : ""})</p>
          `;

          await sendMail({ to: rec.email, subject, html });
          await db.reminderSendLog.create({
            data: { reminderId: r.id, scheduleLabel: s.label, targetEmail: rec.email },
          });
          sent++;
        }
      }
    }
  }

  return Response.json({ ok: true, sent });
}
