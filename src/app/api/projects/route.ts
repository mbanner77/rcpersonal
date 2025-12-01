import { z } from "zod";
import { db } from "@/lib/prisma";
import { requireUser, hasRole } from "@/lib/auth";

const CreateProjectSchema = z.object({
  name: z.string().min(3).max(200),
  description: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  budget: z.number().positive().optional(),
  maxParticipants: z.number().int().min(1).optional(),
});

const ApplySchema = z.object({
  projectId: z.string().cuid(),
  employeeId: z.string().cuid(),
  motivation: z.string().min(10).optional(),
  hoursPerWeek: z.number().int().min(1).max(40).optional(),
});

const UpdateApplicationSchema = z.object({
  applicationId: z.string().cuid(),
  status: z.enum(["APPROVED", "REJECTED"]),
  notes: z.string().optional(),
});

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Ausstehend",
  APPROVED: "Genehmigt",
  REJECTED: "Abgelehnt",
  WITHDRAWN: "Zurückgezogen",
};

// GET - List projects and applications
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const employeeId = searchParams.get("employeeId");

    // Get applications for a specific project
    if (projectId) {
      const applications = await db.projectApplication.findMany({
        where: { projectId },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, jobTitle: true, email: true } },
          approvedBy: { select: { id: true, email: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return Response.json(
        applications.map(a => ({
          ...a,
          statusLabel: STATUS_LABELS[a.status] ?? a.status,
        }))
      );
    }

    // Get applications for a specific employee
    if (employeeId) {
      const applications = await db.projectApplication.findMany({
        where: { employeeId },
        include: {
          project: true,
          approvedBy: { select: { id: true, email: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return Response.json(
        applications.map(a => ({
          ...a,
          statusLabel: STATUS_LABELS[a.status] ?? a.status,
        }))
      );
    }

    // Get all active projects
    const projects = await db.internalProject.findMany({
      where: { isActive: true },
      include: {
        createdBy: { select: { id: true, email: true, name: true } },
        _count: {
          select: {
            applications: { where: { status: "APPROVED" } },
          },
        },
        applications: {
          where: { status: "PENDING" },
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(
      projects.map(p => ({
        ...p,
        approvedCount: p._count.applications,
        pendingCount: p.applications.length,
      }))
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fehler";
    return Response.json({ error: msg }, { status: 500 });
  }
}

// POST - Create project or apply
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const action = body.action as string;

    // Apply for project
    if (action === "apply") {
      const parsed = ApplySchema.safeParse(body);
      if (!parsed.success) {
        return Response.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      // Check if already applied
      const existing = await db.projectApplication.findUnique({
        where: {
          projectId_employeeId: {
            projectId: parsed.data.projectId,
            employeeId: parsed.data.employeeId,
          },
        },
      });

      if (existing) {
        return Response.json({ error: "Bewerbung existiert bereits" }, { status: 400 });
      }

      // Check max participants
      const project = await db.internalProject.findUnique({
        where: { id: parsed.data.projectId },
        include: {
          _count: { select: { applications: { where: { status: "APPROVED" } } } },
        },
      });

      if (project?.maxParticipants && project._count.applications >= project.maxParticipants) {
        return Response.json({ error: "Maximale Teilnehmerzahl erreicht" }, { status: 400 });
      }

      const application = await db.projectApplication.create({
        data: {
          projectId: parsed.data.projectId,
          employeeId: parsed.data.employeeId,
          motivation: parsed.data.motivation,
          hoursPerWeek: parsed.data.hoursPerWeek,
        },
        include: {
          project: { select: { id: true, name: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      return Response.json({
        ...application,
        statusLabel: STATUS_LABELS[application.status],
      });
    }

    // Approve/Reject application
    if (action === "decide") {
      if (!hasRole(user, "ADMIN") && !hasRole(user, "HR")) {
        return Response.json({ error: "Keine Berechtigung" }, { status: 403 });
      }

      const parsed = UpdateApplicationSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const application = await db.projectApplication.update({
        where: { id: parsed.data.applicationId },
        data: {
          status: parsed.data.status,
          notes: parsed.data.notes,
          approvedById: user.id,
          approvedAt: new Date(),
        },
        include: {
          project: { select: { id: true, name: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      return Response.json({
        ...application,
        statusLabel: STATUS_LABELS[application.status],
      });
    }

    // Create new project (Admin/HR only)
    if (!hasRole(user, "ADMIN") && !hasRole(user, "HR")) {
      return Response.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const parsed = CreateProjectSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const project = await db.internalProject.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
        budget: parsed.data.budget,
        maxParticipants: parsed.data.maxParticipants,
        createdById: user.id,
      },
    });

    return Response.json(project);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fehler";
    return Response.json({ error: msg }, { status: 500 });
  }
}

// DELETE - Close project or withdraw application
export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { projectId, applicationId } = body;

    if (applicationId) {
      // Withdraw own application
      const app = await db.projectApplication.findUnique({
        where: { id: applicationId },
        include: { employee: true },
      });

      // Only allow withdrawal of own applications or by admin
      if (!hasRole(user, "ADMIN") && !hasRole(user, "HR")) {
        return Response.json({ error: "Keine Berechtigung" }, { status: 403 });
      }

      await db.projectApplication.update({
        where: { id: applicationId },
        data: { status: "WITHDRAWN" },
      });

      return Response.json({ success: true });
    }

    if (projectId) {
      if (!hasRole(user, "ADMIN")) {
        return Response.json({ error: "Keine Berechtigung" }, { status: 403 });
      }

      await db.internalProject.update({
        where: { id: projectId },
        data: { isActive: false },
      });

      return Response.json({ success: true });
    }

    return Response.json({ error: "Keine ID angegeben" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fehler";
    return Response.json({ error: msg }, { status: 500 });
  }
}
