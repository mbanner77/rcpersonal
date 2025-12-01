import { z } from "zod";
import { db } from "@/lib/prisma";
import { requireUser, hasRole } from "@/lib/auth";

const CreateQualificationSchema = z.object({
  type: z.enum([
    "FIRST_AID", "FIRE_SAFETY", "SAFETY_OFFICER", "DATA_PROTECTION",
    "WORKS_COUNCIL", "APPRENTICE_TRAINER", "FORKLIFT", "CRANE",
    "HAZMAT", "ELECTRICAL", "LANGUAGE", "IT_CERTIFICATION", "PROJECT_MGMT", "OTHER"
  ]),
  name: z.string().min(2).max(200),
  description: z.string().optional(),
  isCompanyWide: z.boolean().optional(),
  validityMonths: z.number().int().min(1).max(120).optional(),
});

const AssignQualificationSchema = z.object({
  employeeId: z.string().cuid(),
  qualificationId: z.string().cuid(),
  obtainedDate: z.string().datetime(),
  expiryDate: z.string().datetime().optional(),
  certificateNo: z.string().optional(),
  issuer: z.string().optional(),
  notes: z.string().optional(),
});

const TYPE_LABELS: Record<string, string> = {
  FIRST_AID: "Ersthelfer",
  FIRE_SAFETY: "Brandschutzhelfer",
  SAFETY_OFFICER: "Sicherheitsbeauftragter",
  DATA_PROTECTION: "Datenschutzbeauftragter",
  WORKS_COUNCIL: "Betriebsrat",
  APPRENTICE_TRAINER: "Ausbilder",
  FORKLIFT: "Staplerführerschein",
  CRANE: "Kranführerschein",
  HAZMAT: "Gefahrgut",
  ELECTRICAL: "Elektrofachkraft",
  LANGUAGE: "Sprachzertifikat",
  IT_CERTIFICATION: "IT-Zertifizierung",
  PROJECT_MGMT: "Projektmanagement",
  OTHER: "Sonstiges",
};

// GET - List qualifications or employees with qualifications
export async function GET(req: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const employeeId = searchParams.get("employeeId");

    // Get employees with specific qualification type
    if (type) {
      const employees = await db.employeeQualification.findMany({
        where: {
          qualification: { type: type as "FIRST_AID" | "FIRE_SAFETY" | "SAFETY_OFFICER" | "DATA_PROTECTION" | "WORKS_COUNCIL" | "APPRENTICE_TRAINER" | "FORKLIFT" | "CRANE" | "HAZMAT" | "ELECTRICAL" | "LANGUAGE" | "IT_CERTIFICATION" | "PROJECT_MGMT" | "OTHER" },
          isActive: true,
          employee: { status: "ACTIVE" },
        },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, jobTitle: true, email: true } },
          qualification: true,
        },
        orderBy: { employee: { lastName: "asc" } },
      });

      return Response.json(
        employees.map(eq => ({
          ...eq,
          typeLabel: TYPE_LABELS[eq.qualification.type] ?? eq.qualification.type,
          isExpired: eq.expiryDate ? new Date(eq.expiryDate) < new Date() : false,
          isExpiringSoon: eq.expiryDate 
            ? new Date(eq.expiryDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) 
            : false,
        }))
      );
    }

    // Get all qualifications for an employee
    if (employeeId) {
      const quals = await db.employeeQualification.findMany({
        where: { employeeId, isActive: true },
        include: { qualification: true },
        orderBy: { qualification: { type: "asc" } },
      });

      return Response.json(
        quals.map(eq => ({
          ...eq,
          typeLabel: TYPE_LABELS[eq.qualification.type] ?? eq.qualification.type,
          isExpired: eq.expiryDate ? new Date(eq.expiryDate) < new Date() : false,
        }))
      );
    }

    // Get all qualification types with counts
    const qualifications = await db.qualification.findMany({
      include: {
        _count: {
          select: { employeeQuals: { where: { isActive: true } } },
        },
      },
      orderBy: { type: "asc" },
    });

    return Response.json(
      qualifications.map(q => ({
        ...q,
        typeLabel: TYPE_LABELS[q.type] ?? q.type,
        employeeCount: q._count.employeeQuals,
      }))
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fehler";
    return Response.json({ error: msg }, { status: 500 });
  }
}

// POST - Create qualification or assign to employee
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!hasRole(user, "ADMIN") && !hasRole(user, "HR")) {
      return Response.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await req.json();
    const action = body.action as string;

    // Assign qualification to employee
    if (action === "assign") {
      const parsed = AssignQualificationSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      // Calculate expiry date if qualification has validity period
      let expiryDate = parsed.data.expiryDate ? new Date(parsed.data.expiryDate) : undefined;
      
      if (!expiryDate) {
        const qual = await db.qualification.findUnique({
          where: { id: parsed.data.qualificationId },
        });
        if (qual?.validityMonths) {
          const obtained = new Date(parsed.data.obtainedDate);
          expiryDate = new Date(obtained);
          expiryDate.setMonth(expiryDate.getMonth() + qual.validityMonths);
        }
      }

      const assignment = await db.employeeQualification.upsert({
        where: {
          employeeId_qualificationId: {
            employeeId: parsed.data.employeeId,
            qualificationId: parsed.data.qualificationId,
          },
        },
        update: {
          obtainedDate: new Date(parsed.data.obtainedDate),
          expiryDate,
          certificateNo: parsed.data.certificateNo,
          issuer: parsed.data.issuer,
          notes: parsed.data.notes,
          isActive: true,
        },
        create: {
          employeeId: parsed.data.employeeId,
          qualificationId: parsed.data.qualificationId,
          obtainedDate: new Date(parsed.data.obtainedDate),
          expiryDate,
          certificateNo: parsed.data.certificateNo,
          issuer: parsed.data.issuer,
          notes: parsed.data.notes,
        },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true } },
          qualification: true,
        },
      });

      return Response.json({
        ...assignment,
        typeLabel: TYPE_LABELS[assignment.qualification.type],
      });
    }

    // Create new qualification type
    const parsed = CreateQualificationSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const qualification = await db.qualification.create({
      data: {
        type: parsed.data.type,
        name: parsed.data.name,
        description: parsed.data.description,
        isCompanyWide: parsed.data.isCompanyWide ?? false,
        validityMonths: parsed.data.validityMonths,
      },
    });

    return Response.json({
      ...qualification,
      typeLabel: TYPE_LABELS[qualification.type],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fehler";
    return Response.json({ error: msg }, { status: 500 });
  }
}

// DELETE - Remove qualification assignment
export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    if (!hasRole(user, "ADMIN") && !hasRole(user, "HR")) {
      return Response.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await req.json();
    const { id } = body;

    await db.employeeQualification.update({
      where: { id },
      data: { isActive: false },
    });

    return Response.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fehler";
    return Response.json({ error: msg }, { status: 500 });
  }
}
