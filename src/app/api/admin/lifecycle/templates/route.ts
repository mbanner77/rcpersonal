import { z } from "zod";
import { db } from "@/lib/prisma";
import { requireUser, type SessionUser } from "@/lib/auth";

const TaskTypeValues = ["ONBOARDING", "OFFBOARDING"] as const;

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  type: z.enum(TaskTypeValues),
  ownerRoleId: z.string().cuid(),
  relativeDueDays: z.number().int().min(-365).max(365),
  active: z.boolean().optional().default(true),
});

const updateSchema = z.object({
  id: z.string().cuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  type: z.enum(TaskTypeValues).optional(),
  ownerRoleId: z.string().cuid().optional(),
  relativeDueDays: z.number().int().min(-365).max(365).optional(),
  active: z.boolean().optional(),
});

function ensureAdmin(user: SessionUser) {
  if (user.role !== "ADMIN") throw new Response("Forbidden", { status: 403 });
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    ensureAdmin(user);

    // Parse optional type filter from query params
    const url = new URL(req.url);
    const typeFilter = url.searchParams.get("type");
    const whereClause: { type?: string } = {};
    if (typeFilter && (typeFilter === "ONBOARDING" || typeFilter === "OFFBOARDING")) {
      whereClause.type = typeFilter;
    }
    
    // Check if taskTemplate table exists
    try {
      // Try with role include first (using select to exclude legacy ownerRole field)
      const templates = await (db as any)["taskTemplate"].findMany({
        where: whereClause,
        orderBy: [{ type: "asc" }, { title: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          ownerRoleId: true,
          relativeDueDays: true,
          active: true,
          createdAt: true,
          updatedAt: true,
          role: { select: { id: true, key: true, label: true } },
        },
      });
      // Transform to rename 'role' to 'ownerRole' for frontend compatibility
      const transformed = templates.map((t: Record<string, unknown>) => {
        const { role, ...rest } = t;
        return { ...rest, ownerRole: role ?? { id: "", key: "", label: "—" } };
      });
      return Response.json(transformed);
    } catch {
      // Relation might not exist yet, try without include
      try {
        const templates = await (db as any)["taskTemplate"].findMany({
          where: whereClause,
          orderBy: [{ type: "asc" }, { title: "asc" }],
          select: {
            id: true,
            title: true,
            description: true,
            type: true,
            ownerRoleId: true,
            relativeDueDays: true,
            active: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        // Add placeholder ownerRole for templates without relation
        const transformed = templates.map((t: Record<string, unknown>) => ({
          ...t,
          ownerRole: { id: "", key: "", label: "—" },
        }));
        return Response.json(transformed);
      } catch {
        // Table doesn't exist at all
        return Response.json([]);
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    if (/does not exist|relation|column|undefined|null|Cannot read/i.test(msg)) {
      return Response.json([]);
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    ensureAdmin(user);
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    const data = parsed.data;
    
    // Get the role key to use for legacy ownerRole enum column
    const roleInfo = data.ownerRoleId ? await (db as any)["lifecycleRole"].findUnique({
      where: { id: data.ownerRoleId },
      select: { key: true },
    }) : null;
    
    // Map role key to legacy enum value (must match DB enum exactly)
    const legacyEnumMap: Record<string, string> = {
      ADMIN: "ADMIN",
      HR: "HR", 
      IT: "IT",
      UNIT_LEAD: "UNIT_LEAD",
      TEAM_LEAD: "TEAM_LEAD",
      PEOPLE_MANAGER: "PEOPLE_MANAGER",
    };
    const legacyOwnerRole = roleInfo?.key && legacyEnumMap[roleInfo.key] ? legacyEnumMap[roleInfo.key] : "HR";
    
    // Use raw SQL to insert with the legacy enum value
    const id = `c${Date.now()}${Math.random().toString(36).substring(2, 9)}`;
    await (db as any).$executeRawUnsafe(
      `INSERT INTO "TaskTemplate" (id, title, description, type, "ownerRole", "ownerRoleId", "relativeDueDays", active, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, CAST($4 AS "TaskType"), CAST($5 AS "UserRole"), $6, $7, $8, NOW(), NOW())`,
      id,
      data.title,
      data.description ?? null,
      data.type,
      legacyOwnerRole,
      data.ownerRoleId,
      data.relativeDueDays,
      data.active
    );
    
    // Fetch the created record with relations (excluding legacy ownerRole field)
    const created = await (db as any)["taskTemplate"].findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        ownerRoleId: true,
        relativeDueDays: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        role: { select: { id: true, key: true, label: true } },
      },
    });
    
    if (!created) {
      return Response.json({ error: "Template created but could not be fetched" }, { status: 500 });
    }
    
    // Transform to rename 'role' to 'ownerRole' for frontend compatibility
    const { role, ...rest } = created as Record<string, unknown>;
    return Response.json({ ...rest, ownerRole: role }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    ensureAdmin(user);
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    const { id, ...rest } = parsed.data;
    
    const updated = await (db as any)["taskTemplate"].update({
      where: { id },
      data: rest,
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        ownerRoleId: true,
        relativeDueDays: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        role: { select: { id: true, key: true, label: true } },
      },
    });
    // Transform to rename 'role' to 'ownerRole' for frontend compatibility
    const { role, ...updatedRest } = updated as Record<string, unknown>;
    return Response.json({ ...updatedRest, ownerRole: role });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
