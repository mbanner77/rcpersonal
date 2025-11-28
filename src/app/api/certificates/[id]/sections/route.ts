import { z } from "zod";
import { db } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const UpdateSectionSchema = z.object({
  sectionId: z.string().cuid(),
  content: z.string().min(1),
});

const UpdateAllSectionsSchema = z.object({
  sections: z.array(z.object({
    id: z.string().cuid(),
    content: z.string(),
  })),
});

// Get all sections for a certificate
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;

    const sections = await db.workCertificateSection.findMany({
      where: { certificateId: id },
      orderBy: { orderIndex: "asc" },
      include: {
        textBlock: {
          select: {
            id: true,
            title: true,
            category: { select: { key: true, label: true } },
          },
        },
      },
    });

    return Response.json(sections);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    return Response.json({ error: msg }, { status: 500 });
  }
}

// Update a single section
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id: certificateId } = await params;
    const body = await req.json();
    const parsed = UpdateSectionSchema.safeParse(body);
    
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { sectionId, content } = parsed.data;

    // Update the section
    const section = await db.workCertificateSection.update({
      where: { id: sectionId },
      data: { content },
    });

    // Rebuild full content from all sections
    const allSections = await db.workCertificateSection.findMany({
      where: { certificateId },
      orderBy: { orderIndex: "asc" },
    });

    const fullContent = allSections.map(s => s.content).join("\n\n");

    // Update certificate's full content
    await db.workCertificate.update({
      where: { id: certificateId },
      data: { fullContent },
    });

    return Response.json(section);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    return Response.json({ error: msg }, { status: 500 });
  }
}

// Update all sections at once (for bulk edit)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id: certificateId } = await params;
    const body = await req.json();
    const parsed = UpdateAllSectionsSchema.safeParse(body);
    
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Update each section
    for (const section of parsed.data.sections) {
      await db.workCertificateSection.update({
        where: { id: section.id },
        data: { content: section.content },
      });
    }

    // Rebuild full content
    const allSections = await db.workCertificateSection.findMany({
      where: { certificateId },
      orderBy: { orderIndex: "asc" },
    });

    const fullContent = allSections.map(s => s.content).join("\n\n");

    // Update certificate
    const certificate = await db.workCertificate.update({
      where: { id: certificateId },
      data: { fullContent },
      include: {
        sections: { orderBy: { orderIndex: "asc" } },
      },
    });

    return Response.json(certificate);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    return Response.json({ error: msg }, { status: 500 });
  }
}
