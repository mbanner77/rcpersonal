import { z } from "zod";
import { db } from "@/lib/prisma";
import { sendMail } from "@/lib/email";
import { requireUser, hasRole } from "@/lib/auth";

const bodySchema = z.object({
  reminderId: z.string().cuid(),
});

function formatDate(d: Date) {
  return d.toLocaleDateString("de-DE");
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!hasRole(user, "ADMIN") && !hasRole(user, "HR")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { reminderId } = parsed.data;

  // Load the reminder with all related data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reminder = await db.reminder.findUnique({
    where: { id: reminderId },
    include: {
      employee: { select: { firstName: true, lastName: true } },
      schedules: true,
      recipients: true,
    },
  }) as any;

  if (!reminder) {
    return Response.json({ error: "Reminder not found" }, { status: 404 });
  }

  if (reminder.recipients.length === 0) {
    return Response.json({ error: "No recipients configured" }, { status: 400 });
  }

  const due = new Date(reminder.dueDate);
  const subject = `Erinnerung: ${reminder.typeLegacy} – ${reminder.employee?.lastName ?? ""}, ${reminder.employee?.firstName ?? ""} – ${formatDate(due)}`;
  
  // Build schedule info for the email
  const scheduleInfo = reminder.schedules.length > 0
    ? reminder.schedules.map((s: { label: string; daysBefore: number; timeOfDay: string | null }) => `${s.label} (${s.daysBefore} Tage vorher${s.timeOfDay ? `, ${s.timeOfDay} Uhr` : ""})`).join(", ")
    : "Manuell gesendet";

  const html = `
    <p><strong>Erinnerung:</strong> ${reminder.typeLegacy}</p>
    ${reminder.description ? `<p>${reminder.description}</p>` : ""}
    <p><strong>Berechtigter:</strong> ${reminder.employee?.lastName ?? ""}, ${reminder.employee?.firstName ?? ""}</p>
    <p><strong>Fälligkeit:</strong> ${formatDate(due)}</p>
    <p><strong>Hinweise:</strong> ${scheduleInfo}</p>
    <p><em>Diese Erinnerung wurde manuell gesendet.</em></p>
  `;

  let sent = 0;
  const errors: string[] = [];

  for (const rec of reminder.recipients) {
    try {
      await sendMail({ to: rec.email, subject, html });
      // Log the send
      await db.reminderSendLog.create({
        data: {
          reminderId: reminder.id,
          scheduleLabel: "Manuell gesendet",
          targetEmail: rec.email,
        },
      });
      sent++;
    } catch (err) {
      errors.push(`${rec.email}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  if (sent === 0 && errors.length > 0) {
    return Response.json({ error: `Failed to send: ${errors.join("; ")}` }, { status: 500 });
  }

  return Response.json({ 
    ok: true, 
    sent, 
    recipients: reminder.recipients.map((r: { email: string }) => r.email),
    errors: errors.length > 0 ? errors : undefined,
  });
}
