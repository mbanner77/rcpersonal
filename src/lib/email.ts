import nodemailer from "nodemailer";

export type MailOptions = {
  to: string | string[];
  subject: string;
  html: string;
};

export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{{2}\s*(\w+)\s*\}{2}/g, (_, k: string) => String(vars[k] ?? ""));
}

export async function sendMail({ to, subject, html }: MailOptions) {
  // Defaults (fallback) per Anforderung (Strato)
  const defaultHost = "smtp.strato.de";
  const defaultPort = 465;
  const defaultUser = "rccpersonal@futurestore.shop";
  const defaultPass = "";
  const defaultFrom = defaultUser;

  const host = process.env.SMTP_HOST || defaultHost;
  const port = Number(process.env.SMTP_PORT || defaultPort);
  const user = process.env.SMTP_USER || defaultUser;
  const pass = process.env.SMTP_PASS || defaultPass;
  const from = process.env.SMTP_FROM || user || defaultFrom;

  if (!host || !user || !pass || !from) {
    console.warn("SMTP not fully configured; skipping send.");
    return { skipped: true } as const;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const info = await transporter.sendMail({ from, to, subject, html });
  return { ok: true, messageId: (info as any)?.messageId } as const;
}
