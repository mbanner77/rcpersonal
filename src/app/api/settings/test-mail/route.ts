import { db } from "@/lib/prisma";
import nodemailer from "nodemailer";

type LogEntry = { ts: string; message: string };

export const runtime = "nodejs";

export async function POST(req: Request) {
  const logs: LogEntry[] = [];
  const startedAt = Date.now();
  const log = (message: string) => {
    logs.push({ ts: new Date().toISOString(), message });
  };

  try {
    const body = await req.json().catch(() => ({} as { to?: string }));
    const to = String(body?.to ?? "").trim();
    if (!to) return Response.json({ error: "to required", logs }, { status: 400 });

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
    const secure = typeof s?.smtpSecure === "boolean" ? s.smtpSecure : port === 465;
    const rejectUnauthorized = typeof s?.smtpRejectUnauthorized === "boolean" ? s.smtpRejectUnauthorized : true;

    log(`SMTP Konfiguration geladen: host=${host}:${port}, user=${user}, secure=${secure}, rejectUnauthorized=${rejectUnauthorized}`);
    log(`Versuche Verbindung aufzubauen…`);

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      logger: false,
      tls: { rejectUnauthorized },
    });

    log(`Verifiziere Zugangsdaten…`);
    await transporter.verify();
    log(`SMTP Verify erfolgreich.`);

    log(`Sende Testmail an ${to}…`);
    const info = await transporter.sendMail({ from, to, subject: "Testmail", html: "<p>Dies ist eine Testmail.</p>" });
    log(`Mail gesendet. Antwort: ${info.response ?? "(keine)"}`);

    const durationMs = Date.now() - startedAt;

    return Response.json({
      ok: true,
      accepted: info.accepted,
      rejected: info.rejected,
      messageId: info.messageId,
      response: info.response,
      envelope: info.envelope,
      logs,
      durationMs,
      config: { host, port, user, from, secure, rejectUnauthorized },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    log(`Fehler: ${msg}`);
    return Response.json({ error: msg, logs }, { status: 500 });
  }
}
