import { z } from "zod";
import { AbsenceStatus, AbsenceType, Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { requireUser, type SessionUser } from "@/lib/auth";

const absenceInclude = {
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      unitId: true,
      unit: { select: { id: true, name: true } },
      teamId: true,
      team: { select: { id: true, name: true } },
      departmentId: true,
      department: { select: { id: true, name: true } },
      locationId: true,
      location: { select: { id: true, name: true } },
    },
  },
  unit: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  team: { select: { id: true, name: true } },
  location: { select: { id: true, name: true } },
  createdBy: { select: { id: true, email: true, name: true } },
  approvedBy: { select: { id: true, email: true, name: true } },
} satisfies Prisma.AbsenceInclude;

function toResponse(absence: Prisma.AbsenceGetPayload<{ include: typeof absenceInclude }>) {
  return {
    id: absence.id,
    employeeId: absence.employeeId,
    employee: absence.employee,
    unitId: absence.unitId,
    unit: absence.unit,
    departmentId: absence.departmentId,
    department: absence.department,
    teamId: absence.teamId,
    team: absence.team,
    locationId: absence.locationId,
    location: absence.location,
    type: absence.type,
    status: absence.status,
    startDate: absence.startDate.toISOString(),
    endDate: absence.endDate.toISOString(),
    description: absence.description ?? null,
    managerComment: absence.managerComment ?? null,
    createdById: absence.createdById,
    createdBy: absence.createdBy,
    approvedById: absence.approvedById,
    approvedBy: absence.approvedBy,
    approvedAt: absence.approvedAt ? absence.approvedAt.toISOString() : null,
    declineReason: absence.declineReason ?? null,
    createdAt: absence.createdAt.toISOString(),
    updatedAt: absence.updatedAt.toISOString(),
  };
}

const elevatedRoles: AbsenceAllowedRole[] = ["ADMIN", "HR", "PEOPLE_MANAGER"];
const leadRoles: AbsenceAllowedRole[] = ["UNIT_LEAD", "TEAM_LEAD"];
type AbsenceAllowedRole = SessionUser["role"];

function ensureDateOrder(start: Date, end: Date) {
  if (start > end) {
    throw new Response("startDate must be before or equal to endDate", { status: 400 });
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

function canManageAbsence(user: SessionUser, absence: Prisma.AbsenceGetPayload<{ include: typeof absenceInclude }> | { unitId: string | null; employee: { unitId: string | null; id: string }; createdById: string | null }): boolean {
  if (elevatedRoles.includes(user.role)) return true;
  if (leadRoles.includes(user.role) && user.unitId) {
    if (absence.unitId === user.unitId) return true;
    if (absence.employee?.unitId === user.unitId) return true;
  }
  if (absence.createdById && absence.createdById === user.id) return true;
  return false;
}

const createSchema = z.object({
  employeeId: z.string().cuid(),
  type: z.nativeEnum(AbsenceType).default("VACATION"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  description: z.string().max(2000).optional(),
});

const querySchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  status: z.nativeEnum(AbsenceStatus).optional(),
  employeeId: z.string().cuid().optional(),
  unitId: z.string().cuid().optional(),
});

const updateSchema = z.object({
  id: z.string().cuid(),
  description: z.string().max(2000).nullable().optional(),
  managerComment: z.string().max(2000).nullable().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  type: z.nativeEnum(AbsenceType).optional(),
  status: z.nativeEnum(AbsenceStatus).optional(),
  declineReason: z.string().max(2000).nullable().optional(),
});

export async function GET(req: Request) {
  const user = await requireUser();
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { start, end, status, employeeId, unitId } = parsed.data;

  const where: Prisma.AbsenceWhereInput = {};
  if (start) {
    const startDate = new Date(start);
    if (Number.isNaN(startDate.getTime())) {
      return Response.json({ error: "Invalid start date" }, { status: 400 });
    }
    where.endDate = { gte: startDate };
  }
  if (end) {
    const endDate = new Date(end);
    if (Number.isNaN(endDate.getTime())) {
      return Response.json({ error: "Invalid end date" }, { status: 400 });
    }
    const startDateFilter: Prisma.DateTimeFilter = {};
    if (isPlainObject(where.startDate)) {
      Object.assign(startDateFilter, where.startDate as Prisma.DateTimeFilter);
    }
    startDateFilter.lte = endDate;
    where.startDate = startDateFilter;
  }
  if (status) where.status = status;
  if (employeeId) where.employeeId = employeeId;
  if (unitId) where.unitId = unitId;

  if (!elevatedRoles.includes(user.role)) {
    if (leadRoles.includes(user.role) && user.unitId) {
      where.OR = [
        { unitId: user.unitId },
        { employee: { unitId: user.unitId } },
      ];
    } else {
      // default: only absences created for employees managed by this user (none yet) or created by user
      where.OR = [
        { createdById: user.id },
      ];
    }
  }

  const absences = await db.absence.findMany({
    where,
    orderBy: [{ startDate: "asc" }, { employee: { lastName: "asc" } }],
    include: absenceInclude,
  });
  return Response.json(absences.map(toResponse));
}

export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  const employee = await db.employee.findUnique({
    where: { id: data.employeeId },
    select: {
      id: true,
      unitId: true,
      departmentId: true,
      teamId: true,
      locationId: true,
    },
  });
  if (!employee) {
    return Response.json({ error: "Employee not found" }, { status: 404 });
  }

  if (
    !elevatedRoles.includes(user.role) &&
    !(leadRoles.includes(user.role) && user.unitId && employee.unitId === user.unitId)
  ) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  ensureDateOrder(data.startDate, data.endDate);

  const created = await db.absence.create({
    data: {
      employeeId: employee.id,
      unitId: employee.unitId,
      departmentId: employee.departmentId,
      teamId: employee.teamId,
      locationId: employee.locationId,
      type: data.type,
      status: AbsenceStatus.PENDING,
      startDate: data.startDate,
      endDate: data.endDate,
      description: data.description?.trim() || null,
      createdById: user.id,
    },
    include: absenceInclude,
  });

  return Response.json(toResponse(created), { status: 201 });
}

export async function PATCH(req: Request) {
  const user = await requireUser();
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, status, startDate, endDate, description, managerComment, type, declineReason } = parsed.data;
  const current = await db.absence.findUnique({ where: { id }, include: absenceInclude });
  if (!current) {
    return Response.json({ error: "Absence not found" }, { status: 404 });
  }

  if (!canManageAbsence(user, current)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates: Prisma.AbsenceUpdateInput = {};
  if (startDate) updates.startDate = startDate;
  if (endDate) updates.endDate = endDate;
  if (updates.startDate && updates.endDate) ensureDateOrder(updates.startDate as Date, updates.endDate as Date);
  if (updates.startDate && !updates.endDate) ensureDateOrder(updates.startDate as Date, current.endDate);
  if (!updates.startDate && updates.endDate) ensureDateOrder(current.startDate, updates.endDate as Date);
  if (description !== undefined) updates.description = description?.trim() || null;
  if (managerComment !== undefined) updates.managerComment = managerComment?.trim() || null;
  if (type) updates.type = type;

  if (status) {
    if (!elevatedRoles.concat(leadRoles).includes(user.role)) {
      return Response.json({ error: "Status change not allowed" }, { status: 403 });
    }
    if (status === AbsenceStatus.APPROVED) {
      updates.status = AbsenceStatus.APPROVED;
      updates.approvedBy = { connect: { id: user.id } };
      updates.approvedAt = new Date();
      updates.declineReason = null;
    } else if (status === AbsenceStatus.DECLINED) {
      updates.status = AbsenceStatus.DECLINED;
      updates.approvedBy = { connect: { id: user.id } };
      updates.approvedAt = new Date();
      updates.declineReason = declineReason?.trim() || "";
    } else if (status === AbsenceStatus.CANCELLED) {
      if (!(current.createdById === user.id || elevatedRoles.includes(user.role))) {
        return Response.json({ error: "Nur Ersteller oder HR können stornieren" }, { status: 403 });
      }
      updates.status = AbsenceStatus.CANCELLED;
      updates.approvedBy = { disconnect: true };
      updates.approvedAt = null;
    } else if (status === AbsenceStatus.PENDING) {
      updates.status = AbsenceStatus.PENDING;
      updates.approvedBy = { disconnect: true };
      updates.approvedAt = null;
      updates.declineReason = null;
    }
  }

  const updated = await db.absence.update({ where: { id }, data: updates, include: absenceInclude });
  return Response.json(toResponse(updated));
}
