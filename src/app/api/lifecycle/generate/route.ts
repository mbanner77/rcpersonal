import { z } from "zod";
import { db } from "@/lib/prisma";
import { requireUser, type SessionUser } from "@/lib/auth";

const TaskTypeValues = ["ONBOARDING", "OFFBOARDING"] as const;

const bodySchema = z.object({
  employeeId: z.string().cuid(),
  type: z.enum(TaskTypeValues),
  // optional: regenerate even if exists
  overwrite: z.boolean().optional().default(false),
});

function canGenerate(user: SessionUser) {
  // ADMIN/HR/UNIT_LEAD dürfen generieren
  return user.role === "ADMIN" || user.role === "HR" || user.role === "UNIT_LEAD";
}

// Map role keys to legacy UserRole enum values (for the DB column "ownerRole")
const legacyOwnerRoleMap: Record<string, string> = {
  ADMIN: "ADMIN",
  HR: "HR",
  IT: "IT",
  UNIT_LEAD: "UNIT_LEAD",
  TEAM_LEAD: "TEAM_LEAD",
  PEOPLE_MANAGER: "PEOPLE_MANAGER",
};

// Map status keys to legacy TaskStatus enum values (for the DB column "status")
const legacyStatusMap: Record<string, string> = {
  OPEN: "OPEN",
  DONE: "DONE",
  BLOCKED: "BLOCKED",
};

export async function POST(req: Request) {
  const user = await requireUser();
  if (!canGenerate(user)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const { employeeId, type, overwrite } = parsed.data;

  const employee = await (db as any)["employee"].findUnique({
    where: { id: employeeId },
    select: { id: true, startDate: true, exitDate: true },
  });
  if (!employee) return Response.json({ error: "Employee not found" }, { status: 404 });

  const anchorDate: Date | null = type === "ONBOARDING" ? new Date(employee.startDate) : employee.exitDate ? new Date(employee.exitDate) : null;
  if (!anchorDate || isNaN(anchorDate.getTime())) {
    return Response.json({ error: `Missing ${(type === "ONBOARDING" ? "startDate" : "exitDate")}` }, { status: 400 });
  }

  // Get templates with their role key for legacy enum mapping
  const templates = await (db as any)["taskTemplate"].findMany({
    where: { type, active: true },
    orderBy: { title: "asc" },
    select: { 
      id: true, 
      relativeDueDays: true, 
      ownerRoleId: true,
      role: { select: { key: true } },
    },
  });

  // Get the default "OPEN" status dynamically
  let defaultStatus = await (db as any)["lifecycleStatus"].findFirst({
    where: { OR: [{ key: "OPEN" }, { isDefault: true }] },
    select: { id: true, key: true },
  });
  if (!defaultStatus) {
    // Create default status if not exists
    defaultStatus = await (db as any)["lifecycleStatus"].create({
      data: { key: "OPEN", label: "Offen", description: "Aufgabe wurde noch nicht begonnen", isDone: false, isDefault: true, orderIndex: 0 },
      select: { id: true, key: true },
    });
  }
  const openStatusId = defaultStatus.id;
  const legacyStatusValue = legacyStatusMap[defaultStatus.key] ?? "OPEN";

  let generatedCount = 0;
  for (const tpl of templates) {
    const due = new Date(anchorDate);
    due.setDate(due.getDate() + (tpl.relativeDueDays || 0));
    
    // Get legacy enum values
    const roleKey = tpl.role?.key ?? "HR";
    const legacyOwnerRoleValue = legacyOwnerRoleMap[roleKey] ?? "HR";
    const id = `c${Date.now()}${Math.random().toString(36).substring(2, 9)}`;

    try {
      if (overwrite) {
        // Upsert: try update first, then insert if not exists
        const existing = await (db as any)["taskAssignment"].findUnique({
          where: { employeeId_taskTemplateId: { employeeId, taskTemplateId: tpl.id } },
          select: { id: true },
        });
        
        if (existing) {
          // Update existing
          await (db as any).$executeRawUnsafe(
            `UPDATE "TaskAssignment" SET 
              type = CAST($1 AS "TaskType"), 
              "dueDate" = $2, 
              "ownerRoleId" = $3,
              "ownerRole" = CAST($4 AS "UserRole"),
              "statusId" = $5,
              status = CAST($6 AS "TaskStatus"),
              "updatedAt" = NOW()
            WHERE id = $7`,
            type, due, tpl.ownerRoleId, legacyOwnerRoleValue, openStatusId, legacyStatusValue, existing.id
          );
          generatedCount++;
        } else {
          // Insert new
          await (db as any).$executeRawUnsafe(
            `INSERT INTO "TaskAssignment" (id, "employeeId", "taskTemplateId", type, "dueDate", "ownerRoleId", "ownerRole", "statusId", status, "createdAt", "updatedAt")
             VALUES ($1, $2, $3, CAST($4 AS "TaskType"), $5, $6, CAST($7 AS "UserRole"), $8, CAST($9 AS "TaskStatus"), NOW(), NOW())`,
            id, employeeId, tpl.id, type, due, tpl.ownerRoleId, legacyOwnerRoleValue, openStatusId, legacyStatusValue
          );
          generatedCount++;
        }
      } else {
        // Create if not exists, ignore on conflict
        await (db as any).$executeRawUnsafe(
          `INSERT INTO "TaskAssignment" (id, "employeeId", "taskTemplateId", type, "dueDate", "ownerRoleId", "ownerRole", "statusId", status, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, CAST($4 AS "TaskType"), $5, $6, CAST($7 AS "UserRole"), $8, CAST($9 AS "TaskStatus"), NOW(), NOW())
           ON CONFLICT ("employeeId", "taskTemplateId") DO NOTHING`,
          id, employeeId, tpl.id, type, due, tpl.ownerRoleId, legacyOwnerRoleValue, openStatusId, legacyStatusValue
        );
        generatedCount++;
      }
    } catch (err) {
      console.error("Failed to generate task:", err);
      // Skip on error (e.g., unique violation)
    }
  }

  return Response.json({ generated: generatedCount });
}
