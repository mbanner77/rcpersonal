import { z } from "zod";
import { db } from "@/lib/prisma";
import { requireUser, type SessionUser } from "@/lib/auth";

const EmployeeStatusValues = ["ACTIVE", "ONBOARDING", "OFFBOARDING", "EXITED"] as const;
const TaskTypeValues = ["ONBOARDING", "OFFBOARDING"] as const;

const bodySchema = z.object({
  id: z.string().cuid(),
  status: z.enum(EmployeeStatusValues),
  startDate: z.coerce.date().optional(),
  exitDate: z.coerce.date().optional(),
  overwrite: z.boolean().optional().default(false),
});

function canChangeStatus(user: SessionUser) {
  return user.role === "ADMIN" || user.role === "HR" || user.role === "UNIT_LEAD";
}

async function generateForEmployee(employeeId: string, type: typeof TaskTypeValues[number], overwrite: boolean) {
  const employee = await (db as any)["employee"].findUnique({
    where: { id: employeeId },
    select: { id: true, startDate: true, exitDate: true },
  });
  if (!employee) throw new Error("Employee not found");
  const anchorDate: Date | null = type === "ONBOARDING" ? new Date(employee.startDate) : employee.exitDate ? new Date(employee.exitDate) : null;
  if (!anchorDate || isNaN(anchorDate.getTime())) return 0;

  const templates: Array<any> = await (db as any)["taskTemplate"].findMany({
    where: { type, active: true },
    select: { id: true, relativeDueDays: true, ownerRoleId: true },
  });
  let count = 0;
  for (const tpl of templates) {
    const due = new Date(anchorDate);
    due.setDate(due.getDate() + (tpl.relativeDueDays || 0));
    if (overwrite) {
      await (db as any)["taskAssignment"].upsert({
        where: { employeeId_taskTemplateId: { employeeId, taskTemplateId: tpl.id } },
        update: { type, dueDate: due, ownerRoleId: tpl.ownerRoleId, statusId: "status_OPEN" },
        create: { employeeId, taskTemplateId: tpl.id, type, dueDate: due, ownerRoleId: tpl.ownerRoleId, statusId: "status_OPEN" },
      });
      count++;
    } else {
      try {
        await (db as any)["taskAssignment"].create({
          data: { employeeId, taskTemplateId: tpl.id, type, dueDate: due, ownerRoleId: tpl.ownerRoleId, statusId: "status_OPEN" },
        });
        count++;
      } catch (_) {
        // ignore duplicates
      }
    }
  }
  return count;
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!canChangeStatus(user)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const { id, status, startDate, exitDate, overwrite } = parsed.data;

  const updates: any = { status };
  if (startDate) updates.startDate = startDate;
  if (exitDate) updates.exitDate = exitDate;

  const updated = await (db as any)["employee"].update({ where: { id }, data: updates, select: { id: true, status: true } });

  let generated = 0;
  if (status === "ONBOARDING") {
    generated = await generateForEmployee(id, "ONBOARDING", overwrite);
  } else if (status === "OFFBOARDING") {
    generated = await generateForEmployee(id, "OFFBOARDING", overwrite);
  }

  return Response.json({ employee: updated, generated });
}
