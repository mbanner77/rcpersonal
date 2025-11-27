import { z } from "zod";
import { db } from "@/lib/prisma";
import { requireUser, type SessionUser } from "@/lib/auth";

const TaskTypeValues = ["ONBOARDING", "OFFBOARDING"] as const;

const bodySchema = z.object({
  employeeId: z.string().cuid(),
  type: z.enum(TaskTypeValues),
  // optional: regenerate even if exists
  overwrite: z.boolean().optional().default(false),
  // optional: only generate for a specific template
  templateId: z.string().cuid().optional(),
});

function canGenerate(user: SessionUser) {
  // ADMIN/HR/UNIT_LEAD dürfen generieren
  return user.role === "ADMIN" || user.role === "HR" || user.role === "UNIT_LEAD";
}


export async function POST(req: Request) {
  console.log("[generate] POST request received");
  
  const user = await requireUser();
  console.log("[generate] User:", user?.email, "Role:", user?.role);
  
  if (!canGenerate(user)) {
    console.log("[generate] Forbidden - user role not allowed");
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  console.log("[generate] Request body:", body);
  
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    console.log("[generate] Validation failed:", parsed.error.flatten());
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { employeeId, type, overwrite, templateId } = parsed.data;
  console.log("[generate] Parsed data:", { employeeId, type, overwrite, templateId });

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
  // If templateId is provided, only generate for that specific template
  const templateWhere: { type: string; active: boolean; id?: string } = { type, active: true };
  if (templateId) {
    templateWhere.id = templateId;
  }
  
  console.log("[generate] Looking for templates with:", JSON.stringify(templateWhere));
  
  const templates = await (db as any)["taskTemplate"].findMany({
    where: templateWhere,
    orderBy: { title: "asc" },
    select: { 
      id: true, 
      title: true,
      relativeDueDays: true, 
      ownerRoleId: true,
      type: true,
      active: true,
      role: { select: { key: true } },
    },
  });
  
  console.log(`[generate] Found ${templates.length} templates:`, templates.map((t: { id: string; title: string; type: string; active: boolean }) => `${t.title} (${t.type}, active=${t.active})`));
  
  // If templateId was provided but no templates found, check why
  if (templateId && templates.length === 0) {
    const templateCheck = await (db as any)["taskTemplate"].findUnique({
      where: { id: templateId },
      select: { id: true, title: true, type: true, active: true },
    });
    if (templateCheck) {
      const reasons: string[] = [];
      if (templateCheck.type !== type) reasons.push(`Typ ist ${templateCheck.type}, nicht ${type}`);
      if (!templateCheck.active) reasons.push("Vorlage ist nicht aktiv");
      console.log(`[generate] Template ${templateId} exists but filtered out:`, reasons);
      return Response.json({ 
        error: `Vorlage "${templateCheck.title}" kann nicht verwendet werden: ${reasons.join(", ")}`,
        generated: 0 
      }, { status: 400 });
    } else {
      return Response.json({ error: "Vorlage nicht gefunden", generated: 0 }, { status: 404 });
    }
  }
  
  if (templates.length === 0) {
    return Response.json({ 
      error: `Keine aktiven ${type === "ONBOARDING" ? "Onboarding" : "Offboarding"}-Vorlagen gefunden`,
      generated: 0 
    }, { status: 400 });
  }

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

  // Get a default role if templates don't have one
  let defaultRoleId: string | null = null;
  let defaultRole = await (db as any)["lifecycleRole"].findFirst({
    where: { OR: [{ key: "HR" }, { key: "ADMIN" }] },
    select: { id: true, key: true },
  });
  console.log("[generate] Default role lookup result:", defaultRole);
  
  if (!defaultRole) {
    // Create default HR role if none exists
    console.log("[generate] No default role found, creating HR role...");
    try {
      defaultRole = await (db as any)["lifecycleRole"].create({
        data: { 
          key: "HR", 
          label: "HR", 
          description: "Human Resources",
          orderIndex: 0 
        },
        select: { id: true, key: true },
      });
      console.log("[generate] Created default HR role:", defaultRole.id);
    } catch (createErr) {
      console.error("[generate] Failed to create default role:", createErr);
    }
  }
  
  if (defaultRole) {
    defaultRoleId = defaultRole.id;
  }
  console.log("[generate] Using defaultRoleId:", defaultRoleId);

  let generatedCount = 0;
  for (const tpl of templates) {
    const due = new Date(anchorDate);
    due.setDate(due.getDate() + (tpl.relativeDueDays || 0));

    // ownerRoleId is required - use template's role or fallback to default
    const roleId = tpl.ownerRoleId || defaultRoleId;
    console.log(`[generate] Template ${tpl.id} (${tpl.title}): ownerRoleId=${tpl.ownerRoleId}, using roleId=${roleId}`);
    
    if (!roleId) {
      console.error(`[generate] Skipping template ${tpl.id}: No ownerRoleId and no default role available`);
      continue;
    }

    // Get role key for legacy column (if role was looked up)
    let roleKey = "HR"; // default
    if (tpl.role?.key) {
      roleKey = tpl.role.key;
    } else if (defaultRole?.key) {
      roleKey = defaultRole.key;
    }

    try {
      if (overwrite) {
        // Upsert: try update first, then insert if not exists
        const existing = await (db as any)["taskAssignment"].findUnique({
          where: { employeeId_taskTemplateId: { employeeId, taskTemplateId: tpl.id } },
          select: { id: true },
        });
        
        if (existing) {
          // Update existing
          await (db as any)["taskAssignment"].update({
            where: { id: existing.id },
            data: {
              type,
              dueDate: due,
              ownerRole: { connect: { id: roleId } },
              status: { connect: { id: openStatusId } },
              // Legacy columns for backward compatibility with production DB constraints
              ownerRoleLegacy: roleKey,
              statusLegacy: defaultStatus?.key || "OPEN",
            },
          });
          generatedCount++;
        } else {
          // Insert new with proper relation connects
          await (db as any)["taskAssignment"].create({
            data: {
              employee: { connect: { id: employeeId } },
              template: { connect: { id: tpl.id } },
              type,
              dueDate: due,
              ownerRole: { connect: { id: roleId } },
              status: { connect: { id: openStatusId } },
              // Legacy columns for backward compatibility with production DB constraints
              ownerRoleLegacy: roleKey,
              statusLegacy: defaultStatus?.key || "OPEN",
            },
          });
          generatedCount++;
        }
      } else {
        // Create if not exists
        try {
          await (db as any)["taskAssignment"].create({
            data: {
              employee: { connect: { id: employeeId } },
              template: { connect: { id: tpl.id } },
              type,
              dueDate: due,
              ownerRole: { connect: { id: roleId } },
              status: { connect: { id: openStatusId } },
              // Legacy columns for backward compatibility with production DB constraints
              ownerRoleLegacy: roleKey,
              statusLegacy: defaultStatus?.key || "OPEN",
            },
          });
          generatedCount++;
        } catch (createErr: unknown) {
          // Ignore unique constraint violations (task already exists)
          const errorCode = (createErr as { code?: string })?.code;
          if (errorCode !== 'P2002') {
            throw createErr;
          }
        }
      }
    } catch (err) {
      console.error("Failed to generate task:", err);
      // Skip on error (e.g., unique violation)
    }
  }

  return Response.json({ generated: generatedCount });
}
