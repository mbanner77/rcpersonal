import { z } from "zod";
import { db } from "@/lib/prisma";
import { requireUser, hasRole } from "@/lib/auth";

const CreateTicketSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  category: z.enum([
    "BONUS", "SALARY", "ADDRESS_CHANGE", "BANK_CHANGE", "CONTRACT",
    "VACATION", "SICK_LEAVE", "ONBOARDING", "OFFBOARDING", "CERTIFICATE", "OTHER"
  ]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  employeeId: z.string().cuid().optional(),
});

const UpdateTicketSchema = z.object({
  id: z.string().cuid(),
  status: z.enum(["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assignedToId: z.string().cuid().nullable().optional(),
});

const CATEGORY_LABELS: Record<string, string> = {
  BONUS: "Bonusabrechnung",
  SALARY: "Gehaltsabrechnung",
  ADDRESS_CHANGE: "Adressänderung",
  BANK_CHANGE: "Bankverbindung",
  CONTRACT: "Vertragsfragen",
  VACATION: "Urlaubsfragen",
  SICK_LEAVE: "Krankmeldung",
  ONBOARDING: "Onboarding",
  OFFBOARDING: "Offboarding",
  CERTIFICATE: "Zeugnisse",
  OTHER: "Sonstiges",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Offen",
  IN_PROGRESS: "In Bearbeitung",
  WAITING: "Wartet auf Info",
  RESOLVED: "Gelöst",
  CLOSED: "Geschlossen",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Niedrig",
  MEDIUM: "Mittel",
  HIGH: "Hoch",
  URGENT: "Dringend",
};

// Generate ticket number
async function generateTicketNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.hRTicket.count({
    where: {
      ticketNumber: { startsWith: `HR-${year}-` }
    }
  });
  return `HR-${year}-${String(count + 1).padStart(4, "0")}`;
}

// GET - List tickets
export async function GET() {
  try {
    const user = await requireUser();

    const whereClause = hasRole(user, "ADMIN") || hasRole(user, "HR")
      ? {} // Admin/HR sees all
      : { createdById: user.id }; // Others see only their own

    const tickets = await db.hRTicket.findMany({
      where: whereClause,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, email: true, name: true } },
        assignedTo: { select: { id: true, email: true, name: true } },
        _count: { select: { comments: true } },
      },
      orderBy: [
        { status: "asc" },
        { priority: "desc" },
        { createdAt: "desc" },
      ],
    });

    return Response.json(
      tickets.map(t => ({
        ...t,
        categoryLabel: CATEGORY_LABELS[t.legacyCategory] ?? t.legacyCategory,
        statusLabel: STATUS_LABELS[t.status] ?? t.status,
        priorityLabel: PRIORITY_LABELS[t.priority] ?? t.priority,
      }))
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fehler";
    return Response.json({ error: msg }, { status: 500 });
  }
}

// POST - Create ticket
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = CreateTicketSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const ticketNumber = await generateTicketNumber();

    const ticket = await db.hRTicket.create({
      data: {
        ticketNumber,
        title: parsed.data.title,
        description: parsed.data.description,
        legacyCategory: parsed.data.category,
        priority: parsed.data.priority ?? "MEDIUM",
        employeeId: parsed.data.employeeId,
        createdById: user.id,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, email: true, name: true } },
      },
    });

    return Response.json({
      ...ticket,
      categoryLabel: CATEGORY_LABELS[ticket.legacyCategory],
      statusLabel: STATUS_LABELS[ticket.status],
      priorityLabel: PRIORITY_LABELS[ticket.priority],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fehler";
    return Response.json({ error: msg }, { status: 500 });
  }
}

// PATCH - Update ticket
export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = UpdateTicketSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Only HR/Admin can update tickets
    if (!hasRole(user, "ADMIN") && !hasRole(user, "HR")) {
      return Response.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id, ...data } = parsed.data;
    const updateData: Record<string, unknown> = { ...data };

    // Set timestamps based on status
    if (data.status === "RESOLVED") {
      updateData.resolvedAt = new Date();
    } else if (data.status === "CLOSED") {
      updateData.closedAt = new Date();
    }

    const ticket = await db.hRTicket.update({
      where: { id },
      data: updateData,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, email: true, name: true } },
        assignedTo: { select: { id: true, email: true, name: true } },
      },
    });

    return Response.json({
      ...ticket,
      categoryLabel: CATEGORY_LABELS[ticket.legacyCategory],
      statusLabel: STATUS_LABELS[ticket.status],
      priorityLabel: PRIORITY_LABELS[ticket.priority],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fehler";
    return Response.json({ error: msg }, { status: 500 });
  }
}
