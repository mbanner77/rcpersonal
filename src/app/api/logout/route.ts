import { destroySession, clearSessionCookie, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const token = cookieHeader
    .split(/;\s*/)
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.split("=")[1];

  await destroySession(token);
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", clearSessionCookie());
  return res;
}
