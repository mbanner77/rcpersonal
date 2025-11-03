import { NextRequest } from "next/server";

export async function POST(_req: NextRequest) {
  const res = Response.json({ ok: true });
  // Expire cookie immediately
  res.headers.append(
    "Set-Cookie",
    "rc_auth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
  );
  return res;
}
