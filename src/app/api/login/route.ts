import { NextRequest } from "next/server";

const PASSWORD = "RealCore2025!";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const password = String(body?.password ?? "");
  if (password !== PASSWORD) {
    return Response.json({ error: "Falsches Passwort" }, { status: 401 });
  }
  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    `rc_auth=ok; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 8}`
  );
  return res;
}
