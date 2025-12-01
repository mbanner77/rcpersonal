import { db } from "@/lib/prisma";
import { requireUser, hasRole } from "@/lib/auth";
import { z } from "zod";

// Schemas
const TicketCategorySchema = z.object({
  key: z.string().min(2).max(50).regex(/^[A-Z_]+$/, "Key must be uppercase with underscores"),
  label: z.string().min(2).max(100),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

const QualificationCategorySchema = z.object({
  key: z.string().min(2).max(50).regex(/^[A-Z_]+$/, "Key must be uppercase with underscores"),
  label: z.string().min(2).max(100),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  isCompanyWide: z.boolean().optional(),
  defaultValidityMonths: z.number().min(1).max(120).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

// Default categories for initial seeding
const DEFAULT_TICKET_CATEGORIES = [
  { key: "BONUS", label: "Bonusabrechnung", icon: "💰", color: "green", sortOrder: 1 },
  { key: "SALARY", label: "Gehaltsabrechnung", icon: "💵", color: "blue", sortOrder: 2 },
  { key: "ADDRESS_CHANGE", label: "Adressänderung", icon: "🏠", color: "purple", sortOrder: 3 },
  { key: "BANK_CHANGE", label: "Bankverbindung", icon: "🏦", color: "cyan", sortOrder: 4 },
  { key: "CONTRACT", label: "Vertragsfragen", icon: "📋", color: "orange", sortOrder: 5 },
  { key: "VACATION", label: "Urlaubsfragen", icon: "🏖️", color: "teal", sortOrder: 6 },
  { key: "SICK_LEAVE", label: "Krankmeldung", icon: "🏥", color: "red", sortOrder: 7 },
  { key: "ONBOARDING", label: "Onboarding", icon: "👋", color: "emerald", sortOrder: 8 },
  { key: "OFFBOARDING", label: "Offboarding", icon: "👋", color: "slate", sortOrder: 9 },
  { key: "CERTIFICATE", label: "Zeugnisse", icon: "📜", color: "amber", sortOrder: 10 },
  { key: "OTHER", label: "Sonstiges", icon: "📌", color: "gray", sortOrder: 99 },
];

const DEFAULT_QUALIFICATION_CATEGORIES = [
  { key: "FIRST_AID", label: "Ersthelfer", icon: "🏥", color: "red", isCompanyWide: true, defaultValidityMonths: 24, sortOrder: 1 },
  { key: "FIRE_SAFETY", label: "Brandschutzhelfer", icon: "🔥", color: "orange", isCompanyWide: true, defaultValidityMonths: 36, sortOrder: 2 },
  { key: "SAFETY_OFFICER", label: "Sicherheitsbeauftragter", icon: "🦺", color: "yellow", isCompanyWide: false, sortOrder: 3 },
  { key: "DATA_PROTECTION", label: "Datenschutzbeauftragter", icon: "🔒", color: "purple", isCompanyWide: false, sortOrder: 4 },
  { key: "WORKS_COUNCIL", label: "Betriebsrat", icon: "🤝", color: "blue", isCompanyWide: false, sortOrder: 5 },
  { key: "APPRENTICE_TRAINER", label: "Ausbilder (AEVO)", icon: "👨‍🏫", color: "green", isCompanyWide: false, sortOrder: 6 },
  { key: "FORKLIFT", label: "Staplerführerschein", icon: "🚜", color: "amber", defaultValidityMonths: 12, sortOrder: 7 },
  { key: "CRANE", label: "Kranführerschein", icon: "🏗️", color: "slate", defaultValidityMonths: 12, sortOrder: 8 },
  { key: "HAZMAT", label: "Gefahrgut", icon: "☢️", color: "rose", defaultValidityMonths: 60, sortOrder: 9 },
  { key: "ELECTRICAL", label: "Elektrofachkraft", icon: "⚡", color: "cyan", isCompanyWide: false, sortOrder: 10 },
  { key: "LANGUAGE", label: "Sprachzertifikat", icon: "🌍", color: "indigo", isCompanyWide: false, sortOrder: 11 },
  { key: "IT_CERTIFICATION", label: "IT-Zertifizierung", icon: "💻", color: "violet", defaultValidityMonths: 36, sortOrder: 12 },
  { key: "PROJECT_MGMT", label: "Projektmanagement", icon: "📊", color: "teal", defaultValidityMonths: 36, sortOrder: 13 },
  { key: "OTHER", label: "Sonstiges", icon: "📋", color: "gray", isCompanyWide: false, sortOrder: 99 },
];

export async function GET(req: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // "ticket" or "qualification"

    if (type === "ticket") {
      const categories = await db.ticketCategory.findMany({
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { tickets: true } } },
      });
      return Response.json(categories);
    }

    if (type === "qualification") {
      const categories = await db.qualificationCategory.findMany({
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { qualifications: true } } },
      });
      return Response.json(categories);
    }

    return Response.json({ error: "Type parameter required (ticket or qualification)" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fehler";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!hasRole(user, "ADMIN")) {
      return Response.json({ error: "Nur Admins" }, { status: 403 });
    }

    const body = await req.json();
    const { type, action, ...data } = body;

    // Seed default categories
    if (action === "seed") {
      if (type === "ticket") {
        let created = 0;
        for (const cat of DEFAULT_TICKET_CATEGORIES) {
          const existing = await db.ticketCategory.findUnique({ where: { key: cat.key } });
          if (!existing) {
            await db.ticketCategory.create({ data: cat });
            created++;
          }
        }
        return Response.json({ success: true, created, message: `${created} Ticket-Kategorien erstellt` });
      }

      if (type === "qualification") {
        let created = 0;
        for (const cat of DEFAULT_QUALIFICATION_CATEGORIES) {
          const existing = await db.qualificationCategory.findUnique({ where: { key: cat.key } });
          if (!existing) {
            await db.qualificationCategory.create({ data: cat });
            created++;
          }
        }
        return Response.json({ success: true, created, message: `${created} Qualifikations-Kategorien erstellt` });
      }
    }

    // Create new category
    if (type === "ticket") {
      const parsed = TicketCategorySchema.parse(data);
      const category = await db.ticketCategory.create({ data: parsed });
      return Response.json(category, { status: 201 });
    }

    if (type === "qualification") {
      const parsed = QualificationCategorySchema.parse(data);
      const category = await db.qualificationCategory.create({ data: parsed });
      return Response.json(category, { status: 201 });
    }

    return Response.json({ error: "Type parameter required" }, { status: 400 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json({ error: "Validierungsfehler", details: e.issues }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Fehler";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    if (!hasRole(user, "ADMIN")) {
      return Response.json({ error: "Nur Admins" }, { status: 403 });
    }

    const body = await req.json();
    const { type, id, ...data } = body;

    if (!id) {
      return Response.json({ error: "ID erforderlich" }, { status: 400 });
    }

    if (type === "ticket") {
      const parsed = TicketCategorySchema.partial().parse(data);
      const category = await db.ticketCategory.update({
        where: { id },
        data: parsed,
      });
      return Response.json(category);
    }

    if (type === "qualification") {
      const parsed = QualificationCategorySchema.partial().parse(data);
      const category = await db.qualificationCategory.update({
        where: { id },
        data: parsed,
      });
      return Response.json(category);
    }

    return Response.json({ error: "Type parameter required" }, { status: 400 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json({ error: "Validierungsfehler", details: e.issues }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Fehler";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    if (!hasRole(user, "ADMIN")) {
      return Response.json({ error: "Nur Admins" }, { status: 403 });
    }

    const body = await req.json();
    const { type, id } = body;

    if (!id) {
      return Response.json({ error: "ID erforderlich" }, { status: 400 });
    }

    if (type === "ticket") {
      // Check if category is in use
      const count = await db.hRTicket.count({ where: { categoryId: id } });
      if (count > 0) {
        return Response.json({ error: `Kategorie wird von ${count} Tickets verwendet` }, { status: 400 });
      }
      await db.ticketCategory.delete({ where: { id } });
      return Response.json({ success: true });
    }

    if (type === "qualification") {
      // Check if category is in use
      const count = await db.qualification.count({ where: { categoryId: id } });
      if (count > 0) {
        return Response.json({ error: `Kategorie wird von ${count} Qualifikationen verwendet` }, { status: 400 });
      }
      await db.qualificationCategory.delete({ where: { id } });
      return Response.json({ success: true });
    }

    return Response.json({ error: "Type parameter required" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fehler";
    return Response.json({ error: msg }, { status: 500 });
  }
}
