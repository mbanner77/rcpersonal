import { z } from "zod";
import { db } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const TaskTypeValues = ["ONBOARDING", "OFFBOARDING"] as const;
const TaskStatusValues = ["OPEN", "DONE", "BLOCKED"] as const;
const OwnerRoleValues = ["ADMIN", "HR", "PEOPLE_MANAGER", "TEAM_LEAD", "UNIT_LEAD"] as const;

const querySchema = z.object({
  id: z.string().cuid().optional(),
  type: z.enum(TaskTypeValues).optional(),
  status: z.enum(TaskStatusValues).optional(),
  ownerRole: z.enum(OwnerRoleValues).optional(),
  employeeId: z.string().cuid().optional(),
  q: z.string().max(100).optional(),
});

const patchSchema = z.object({
  id: z.string().cuid(),
  status: z.enum(TaskStatusValues).optional(),
  notes: z.string().max(2000).nullable().optional(),
  dueDate: z.string().datetime().optional(),
});

const DAY_MS = 1000 * 60 * 60 * 24;

function normalizeTask(task: any) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const due = task.dueDate ? new Date(task.dueDate) : null;
  let daysUntilDue: number | null = null;
  let overdueDays: number | null = null;
  let isOverdue = false;
  let isDueToday = false;

  if (due) {
    const dueStart = new Date(due);
    dueStart.setHours(0, 0, 0, 0);
    const diffDays = Math.round((dueStart.getTime() - todayStart.getTime()) / DAY_MS);
    if (diffDays < 0) {
      isOverdue = true;
      overdueDays = Math.abs(diffDays);
    } else if (diffDays === 0) {
      isDueToday = true;
      daysUntilDue = 0;
    } else {
      daysUntilDue = diffDays;
    }
  }

  return {
    id: task.id,
    type: task.type,
    status: task.status,
    ownerRole: task.ownerRole,
    dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
    notes: task.notes ?? null,
    employee: task.employee,
    template: task.template,
    createdAt: task.createdAt ? new Date(task.createdAt).toISOString() : null,
    updatedAt: task.updatedAt ? new Date(task.updatedAt).toISOString() : null,
    completedAt: task.completedAt ? new Date(task.completedAt).toISOString() : null,
    isOverdue,
    isDueToday,
    daysUntilDue,
    overdueDays,
  };
}

export async function GET(req: Request) {
  await requireUser();
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const { id, type, status, ownerRole, employeeId, q } = parsed.data;
  const where: any = {};
  if (id) where.id = id;
  if (type) where.type = type;
  if (status) where.status = status;
  if (ownerRole) where.ownerRole = ownerRole;
  if (employeeId) where.employeeId = employeeId;
  if (q) {
    const search = q.trim();
    if (search) {
      where.OR = [
        { employee: { firstName: { contains: search, mode: "insensitive" } } },
        { employee: { lastName: { contains: search, mode: "insensitive" } } },
        { template: { title: { contains: search, mode: "insensitive" } } },
      ];
    }
  }

  const tasks = await (db as any)["taskAssignment"].findMany({
    where,
    orderBy: [{ dueDate: "asc" }],
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, email: true } },
      template: { select: { id: true, title: true, ownerRole: true, type: true } },
    },
  });
  const normalized = tasks.map((task: any) => normalizeTask(task));
  return Response.json(id ? (normalized[0] ?? null) : normalized);
}

export async function PATCH(req: Request) {
  await requireUser();
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const { id, status, notes, dueDate } = parsed.data;

  const data: any = {};
  if (status) {
    data.status = status;
    if (status === "DONE") data.completedAt = new Date();
    if (status !== "DONE") data.completedAt = null;
  }
  if (notes !== undefined) data.notes = notes ?? null;
  if (dueDate !== undefined) data.dueDate = new Date(dueDate);

  const updated = await (db as any)["taskAssignment"].update({ where: { id }, data });
  return Response.json(normalizeTask(updated));
}
