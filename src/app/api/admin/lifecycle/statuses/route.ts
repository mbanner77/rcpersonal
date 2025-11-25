import { z } from "zod";
import { db } from "@/lib/prisma";
import { requireUser, type SessionUser } from "@/lib/auth";

const createSchema = z.object({
  key: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  type: z.enum(["ONBOARDING", "OFFBOARDING"]).nullable().optional(),
  orderIndex: z.number().int().min(0).optional().default(0),
  active: z.boolean().optional().default(true),
  isDone: z.boolean().optional().default(false),
  isDefault: z.boolean().optional().default(false),
});

const updateSchema = z.object({
  id: z.string().cuid(),
  key: z.string().min(1).max(100).optional(),
  label: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  type: z.enum(["ONBOARDING", "OFFBOARDING"]).nullable().optional(),
  orderIndex: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  isDone: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

function ensureAdmin(user: SessionUser) {
  if (user.role !== "ADMIN") throw new Response("Forbidden", { status: 403 });
}

export async function GET() {
  const user = await requireUser();
  ensureAdmin(user);
  const items = await (db as any)["lifecycleStatus"].findMany({ orderBy: [{ orderIndex: "asc" }, { key: "asc" }] });
  return Response.json(items);
}

export async function POST(req: Request) {
  const user = await requireUser();
  ensureAdmin(user);
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const created = await (db as any)["lifecycleStatus"].create({ data: parsed.data });
  return Response.json(created, { status: 201 });
}

export async function PATCH(req: Request) {
  const user = await requireUser();
  ensureAdmin(user);
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const { id, ...rest } = parsed.data;
  const updated = await (db as any)["lifecycleStatus"].update({ where: { id }, data: rest });
  return Response.json(updated);
}
