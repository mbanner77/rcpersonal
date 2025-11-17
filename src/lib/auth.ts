import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/prisma";

export const SESSION_COOKIE = "rc_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 Stunden

export type SessionRole = "ADMIN" | "HR" | "PEOPLE_MANAGER" | "UNIT_LEAD" | "TEAM_LEAD";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: SessionRole;
  unitId: string | null;
  unitName: string | null;
};

export function hasRole(user: SessionUser | null | undefined, roles: SessionRole | SessionRole[]): boolean {
  if (!user) return false;
  const list = Array.isArray(roles) ? roles : [roles];
  return list.includes(user.role);
}

export async function requireRoles(roles: SessionRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new Response("Forbidden", { status: 403 });
  }
  return user;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

export function buildSessionCookie(value: string, maxAge = SESSION_TTL_SECONDS) {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await db.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });
  return { token, expiresAt };
}

export async function destroySession(token: string | undefined) {
  if (!token) return;
  await db.session.deleteMany({ where: { token } });
}

async function fetchSessionUser(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          unit: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.delete({ where: { id: session.id } });
    return null;
  }
  const u = session.user;
  return {
    id: u.id,
    email: u.email,
    name: u.name ?? null,
    role: u.role,
    unitId: u.unitId ?? null,
    unitName: u.unit?.name ?? null,
  };
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return fetchSessionUser(token);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  return requireRoles(["ADMIN"]);
}
