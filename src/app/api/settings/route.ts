import { db } from "@/lib/prisma";
import { z } from "zod";

function defaultSettings() {
  return {
    managerEmails: "",
    birthdayEmailTemplate: "Happy Birthday, {{firstName}}!",
    jubileeEmailTemplate: "Congrats on {{years}} years, {{firstName}}!",
    jubileeYearsCsv: "5,10,15,20,25,30,35,40",
    smtpHost: "smtp.strato.de",
    smtpPort: 465,
    smtpUser: "rccpersonal@futurestore.shop",
    smtpPass: "",
    smtpFrom: "rccpersonal@futurestore.shop",
    smtpSecure: true,
    smtpRejectUnauthorized: true,
    sendOnBirthday: true,
    sendOnJubilee: true,
    dailySendHour: 8,
  };
}

export async function GET() {
  const defaults = defaultSettings();
  let found = await db.setting.findUnique({ where: { id: 1 } });
  if (!found) {
    // create settings with defaults on first GET so values are persisted
    found = await db.setting.create({ data: { id: 1, ...defaults } });
  } else {
    // ensure smtp defaults are persisted if fields are blank
    const patch: Partial<typeof defaults> = {};
    if (!found.smtpHost) patch.smtpHost = defaults.smtpHost;
    if (!found.smtpPort) patch.smtpPort = defaults.smtpPort;
    if (!found.smtpUser) patch.smtpUser = defaults.smtpUser;
    if (!found.smtpPass) patch.smtpPass = defaults.smtpPass;
    if (!found.smtpFrom) patch.smtpFrom = defaults.smtpFrom;
    if (typeof found.smtpSecure !== "boolean") patch.smtpSecure = defaults.smtpSecure;
    if (typeof found.smtpRejectUnauthorized !== "boolean") patch.smtpRejectUnauthorized = defaults.smtpRejectUnauthorized;
    if (Object.keys(patch).length > 0) {
      found = await db.setting.update({ where: { id: 1 }, data: patch });
    }
  }
  return Response.json({
    managerEmails: found.managerEmails,
    birthdayEmailTemplate: found.birthdayEmailTemplate,
    jubileeEmailTemplate: found.jubileeEmailTemplate,
    jubileeYearsCsv: found.jubileeYearsCsv,
    smtpHost: found.smtpHost,
    smtpPort: found.smtpPort,
    smtpUser: found.smtpUser,
    smtpPass: found.smtpPass,
    smtpFrom: found.smtpFrom,
    smtpSecure: found.smtpSecure,
    smtpRejectUnauthorized: found.smtpRejectUnauthorized,
    sendOnBirthday: found.sendOnBirthday,
    sendOnJubilee: found.sendOnJubilee,
    dailySendHour: found.dailySendHour,
  });
}

export async function POST(req: Request) {
  const schema = z.object({
    managerEmails: z.string().transform((s) => s.trim()),
    birthdayEmailTemplate: z.string().min(1),
    jubileeEmailTemplate: z.string().min(1),
    jubileeYearsCsv: z
      .string()
      .transform((s) => s.replace(/\s+/g, ""))
      .refine((s) => /^\d+(,\d+)*$/.test(s), {
        message: "jubileeYearsCsv must be comma-separated integers",
      }),
    smtpHost: z.string().optional().transform((s) => s?.trim() ?? ""),
    smtpPort: z.coerce.number().int().min(1).max(65535).default(465),
    smtpUser: z.string().optional().transform((s) => s?.trim() ?? ""),
    smtpPass: z.string().optional().transform((s) => s?.trim() ?? ""),
    smtpFrom: z.string().optional().transform((s) => s?.trim() ?? ""),
    smtpSecure: z.coerce.boolean().default(true),
    smtpRejectUnauthorized: z.coerce.boolean().default(true),
    sendOnBirthday: z.coerce.boolean().default(true),
    sendOnJubilee: z.coerce.boolean().default(true),
    dailySendHour: z.coerce.number().int().min(0).max(23).default(8),
  });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  await db.setting.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });
  return Response.json({ ok: true });
}
