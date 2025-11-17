import { z } from "zod";
import { UserRole } from "@prisma/client";
import { db } from "@/lib/prisma";
import { requireAdmin, hashPassword } from "@/lib/auth";

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  unitId: true,
  unit: { select: { id: true, name: true } },
  createdAt: true,
  updatedAt: true,
} as const;

type SelectedUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  unitId: string | null;
  unit: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
};

type UserResponse = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  unitId: string | null;
  unit: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
};

function sanitize(user: SelectedUser): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    unitId: user.unitId,
    unit: user.unit ? { id: user.unit.id, name: user.unit.name } : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

async function ensureAnotherAdmin(excludeUserId?: string) {
  const admins = await db.user.count({
    where: {
      role: "ADMIN",
      ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
    },
  });
  if (admins === 0) {
    throw new Response("Es muss mindestens ein Admin übrig bleiben", { status: 400 });
  }
}

export async function GET() {
  await requireAdmin();
  const users = (await db.user.findMany({
    orderBy: { email: "asc" },
    select: userSelect,
  })) as SelectedUser[];
  return Response.json(users.map(sanitize));
}

const createSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  name: z.string().optional().transform((v) => (v?.trim() ? v.trim() : null)),
  password: z.string().min(8),
  role: z.nativeEnum(UserRole),
  unitId: z.string().optional().transform((v) => (v ? v : null)),
});

export async function POST(req: Request) {
  await requireAdmin();
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { email, name, password, role, unitId } = parsed.data;
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return Response.json({ error: "E-Mail bereits vergeben" }, { status: 409 });
  }
  const passwordHash = await hashPassword(password);
  const user = (await db.user.create({
    data: {
      email,
      name,
      passwordHash,
      role,
      unitId: unitId || null,
    },
    select: userSelect,
  })) as SelectedUser;
  return Response.json(sanitize(user), { status: 201 });
}

const updateSchema = z.object({
  id: z.string().cuid(),
  email: z.string().email().transform((v) => v.toLowerCase()).optional(),
  name: z.string().optional().transform((v) => (v?.trim() ? v.trim() : null)),
  role: z.nativeEnum(UserRole).optional(),
  unitId: z.string().optional().transform((v) => (v ? v : null)),
  password: z.string().min(8).optional(),
});

export async function PATCH(req: Request) {
  const current = await requireAdmin();
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { id, email, name, role, unitId, password } = parsed.data;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) {
    return Response.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }
  const data: Record<string, unknown> = {};
  if (typeof email === "string" && email !== user.email) {
    const conflict = await db.user.findUnique({ where: { email } });
    if (conflict && conflict.id !== id) {
      return Response.json({ error: "E-Mail bereits vergeben" }, { status: 409 });
    }
    data.email = email;
  }
  if (name !== undefined) data.name = name;
  if (role && role !== user.role) {
    if (user.role === "ADMIN" && role !== "ADMIN") {
      await ensureAnotherAdmin(id);
    }
    data.role = role;
  }
  if (unitId !== undefined) data.unitId = unitId;
  if (password) {
    data.passwordHash = await hashPassword(password);
  }
  if (Object.keys(data).length === 0) {
    const fresh = (await db.user.findUnique({ where: { id }, select: userSelect })) as SelectedUser | null;
    return Response.json(sanitize(fresh!));
  }
  const updated = (await db.user.update({ where: { id }, data, select: userSelect })) as SelectedUser;
  // Prevent current admin from demoting themselves to non-admin inadvertently, but allow change
  if (updated.id === current.id && updated.role !== "ADMIN") {
    return Response.json({ error: "Du kannst deine eigene Rolle nicht herabstufen" }, { status: 400 });
  }
  return Response.json(sanitize(updated));
}

const deleteSchema = z.object({ id: z.string().cuid() });

export async function DELETE(req: Request) {
  const current = await requireAdmin();
  const parsed = deleteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { id } = parsed.data;
  if (id === current.id) {
    return Response.json({ error: "Eigenes Konto kann nicht gelöscht werden" }, { status: 400 });
  }
  const user = await db.user.findUnique({ where: { id } });
  if (!user) {
    return Response.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }
  if (user.role === "ADMIN") {
    await ensureAnotherAdmin(id);
  }
  await db.session.deleteMany({ where: { userId: id } });
  await db.user.delete({ where: { id } });
  return Response.json({ ok: true });
}
