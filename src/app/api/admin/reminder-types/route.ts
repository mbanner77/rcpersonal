import { db } from "@/lib/prisma";
import { requireUser, hasRole } from "@/lib/auth";
import { z } from "zod";

// Type-safe access to new model (will be properly typed after migration)
// Model is named reminderTypeConfig in Prisma (table: ReminderTypeConfig)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = db as any;

// Schema for creating/updating reminder types
const reminderTypeSchema = z.object({
  key: z.string().min(1).max(50).regex(/^[A-Z_]+$/, "Key must be uppercase with underscores"),
  label: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  orderIndex: z.number().int().optional(),
  active: z.boolean().optional(),
});

// GET - List all reminder types
export async function GET() {
  try {
    const user = await requireUser();
    if (!hasRole(user, "ADMIN") && !hasRole(user, "HR")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const types = await prisma.reminderTypeConfig.findMany({
      orderBy: [{ orderIndex: "asc" }, { label: "asc" }],
    });

    return Response.json(types);
  } catch (error) {
    console.error("Failed to fetch reminder types:", error);
    return Response.json({ error: "Failed to fetch reminder types" }, { status: 500 });
  }
}

// POST - Create a new reminder type
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!hasRole(user, "ADMIN")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = reminderTypeSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { key, label, description, color, orderIndex, active } = parsed.data;

    // Check if key already exists
    const existing = await prisma.reminderTypeConfig.findUnique({ where: { key } });
    if (existing) {
      return Response.json({ error: "Ein Typ mit diesem Schlüssel existiert bereits" }, { status: 409 });
    }

    // Get next orderIndex if not provided
    let order = orderIndex;
    if (order === undefined) {
      const maxOrder = await prisma.reminderTypeConfig.aggregate({ _max: { orderIndex: true } });
      order = (maxOrder._max.orderIndex ?? -1) + 1;
    }

    const newType = await prisma.reminderTypeConfig.create({
      data: {
        key,
        label,
        description: description ?? null,
        color: color ?? null,
        orderIndex: order,
        active: active ?? true,
      },
    });

    return Response.json(newType, { status: 201 });
  } catch (error) {
    console.error("Failed to create reminder type:", error);
    return Response.json({ error: "Failed to create reminder type" }, { status: 500 });
  }
}

// PUT - Update a reminder type
export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    if (!hasRole(user, "ADMIN")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { id, ...data } = body;
    
    if (!id || typeof id !== "string") {
      return Response.json({ error: "ID is required" }, { status: 400 });
    }

    const parsed = reminderTypeSchema.partial().safeParse(data);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Check if type exists
    const existing = await prisma.reminderTypeConfig.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: "Typ nicht gefunden" }, { status: 404 });
    }

    // If key is being changed, check for duplicates
    if (parsed.data.key && parsed.data.key !== existing.key) {
      const duplicate = await prisma.reminderTypeConfig.findUnique({ where: { key: parsed.data.key } });
      if (duplicate) {
        return Response.json({ error: "Ein Typ mit diesem Schlüssel existiert bereits" }, { status: 409 });
      }
    }

    const updated = await prisma.reminderTypeConfig.update({
      where: { id },
      data: parsed.data,
    });

    return Response.json(updated);
  } catch (error) {
    console.error("Failed to update reminder type:", error);
    return Response.json({ error: "Failed to update reminder type" }, { status: 500 });
  }
}

// DELETE - Delete a reminder type
export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    if (!hasRole(user, "ADMIN")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return Response.json({ error: "ID is required" }, { status: 400 });
    }

    // Check if type is in use
    const inUse = await prisma.reminder.count({ where: { reminderTypeId: id } });
    if (inUse > 0) {
      return Response.json({ 
        error: `Dieser Typ wird von ${inUse} Erinnerung(en) verwendet und kann nicht gelöscht werden` 
      }, { status: 409 });
    }

    await prisma.reminderTypeConfig.delete({ where: { id } });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to delete reminder type:", error);
    return Response.json({ error: "Failed to delete reminder type" }, { status: 500 });
  }
}
