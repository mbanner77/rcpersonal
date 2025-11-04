import { db } from "@/lib/prisma";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as { to?: string }));
    const to = String(body?.to ?? "").trim();
    if (!to) return Response.json({ error: "to required" }, { status: 400 });

    const s = await db.setting.findUnique({ where: { id: 1 } });
    const host = s?.smtpHost || process.env.SMTP_HOST || "mail.realcore.info";
    const port = Number(s?.smtpPort ?? process.env.SMTP_PORT ?? 465);
    const user = s?.smtpUser || process.env.SMTP_USER || "rccpersonal@realcore.info";
    const pass = s?.smtpPass || process.env.SMTP_PASS || "RealCore2025!";
    const from = s?.smtpFrom || process.env.SMTP_FROM || user;

    const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    await transporter.sendMail({ from, to, subject: "Testmail", html: "<p>Dies ist eine Testmail.</p>" });

    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
