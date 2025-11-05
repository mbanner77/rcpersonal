import { NextRequest } from "next/server";
import { createSession, buildSessionCookie, hashPassword, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/prisma";

const DEFAULT_ADMIN_EMAIL = "admin@realcore.de";
const DEFAULT_ADMIN_PASSWORD = "RealCore2025!";

async function ensureDefaultAdmin() {
  const count = await db.user.count();
  if (count > 0) return;
  await db.user.create({
    data: {
      email: DEFAULT_ADMIN_EMAIL,
      name: "Administrator",
      passwordHash: await hashPassword(DEFAULT_ADMIN_PASSWORD),
      role: "ADMIN",
    },
  });
}

export async function POST(req: NextRequest) {
  await ensureDefaultAdmin();

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").toLowerCase().trim();
  const password = String(body?.password ?? "");
  if (!email || !password) {
    return Response.json({ error: "E-Mail und Passwort erforderlich" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return Response.json({ error: "Unbekannter Benutzer" }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return Response.json({ error: "Falsches Passwort" }, { status: 401 });
  }

  const { token } = await createSession(user.id);
  const res = Response.json({ ok: true, role: user.role, unitId: user.unitId });
  res.headers.append("Set-Cookie", buildSessionCookie(token));
  return res;
}
