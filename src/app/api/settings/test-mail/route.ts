import { db } from "@/lib/prisma";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as { to?: string }));
    const to = String(body?.to ?? "").trim();
    if (!to) return Response.json({ error: "to required" }, { status: 400 });

    const s = await db.setting.findUnique({ where: { id: 1 } });
    // Hard defaults: Strato
    const def = {
      host: "smtp.strato.de",
      port: 465,
      user: "rccpersonal@futurestore.shop",
      pass: "",
      from: "rccpersonal@futurestore.shop",
    };
    const host = s?.smtpHost || def.host;
    const port = Number(s?.smtpPort ?? def.port);
    const user = s?.smtpUser || def.user;
    const pass = s?.smtpPass || def.pass;
    const from = s?.smtpFrom || user || def.from;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
    });

    // Verify first to surface clear errors
    await transporter.verify();
    const info = await transporter.sendMail({ from, to, subject: "Testmail", html: "<p>Dies ist eine Testmail.</p>" });

    return Response.json({ ok: true, accepted: info.accepted, rejected: info.rejected, messageId: info.messageId, response: info.response, envelope: info.envelope });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
