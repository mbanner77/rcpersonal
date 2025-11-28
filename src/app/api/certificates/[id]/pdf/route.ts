import { db } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import React, { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 60,
    fontSize: 11,
    lineHeight: 1.6,
  },
  header: {
    marginBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    borderBottomStyle: "solid",
    paddingBottom: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    textAlign: "center",
    color: "#555",
  },
  section: {
    marginBottom: 15,
  },
  paragraph: {
    textAlign: "justify",
    marginBottom: 10,
  },
  footer: {
    position: "absolute",
    bottom: 60,
    left: 60,
    right: 60,
  },
  signatureLine: {
    marginTop: 50,
    borderTopWidth: 1,
    borderTopColor: "#333",
    borderTopStyle: "solid",
    width: 200,
    paddingTop: 5,
  },
  dateLocation: {
    marginTop: 30,
    fontSize: 10,
  },
  meta: {
    fontSize: 9,
    color: "#666",
    marginTop: 5,
  },
});

type CertificateData = {
  title: string | null;
  type: string;
  employeeName: string;
  jobTitle: string | null;
  startDate: Date;
  endDate: Date | null;
  issueDate: Date;
  fullContent: string | null;
};

// Helper to create the PDF document using React.createElement
function createPdfDocument(certificate: CertificateData): ReactElement<DocumentProps> {
  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(date));
  };

  const typeLabels: Record<string, string> = {
    ZWISCHENZEUGNIS: "Zwischenzeugnis",
    ENDZEUGNIS: "Arbeitszeugnis",
    EINFACH: "Einfaches Zeugnis",
    QUALIFIZIERT: "Qualifiziertes Arbeitszeugnis",
  };

  const docTitle = certificate.title || typeLabels[certificate.type] || "Arbeitszeugnis";
  const paragraphs = (certificate.fullContent || "").split("\n\n").filter(Boolean);

  // Build paragraph elements
  const paragraphElements = paragraphs.map((para, idx) =>
    React.createElement(Text, { key: idx, style: styles.paragraph }, para)
  );

  // Build the document structure
  return React.createElement(
    Document,
    { title: docTitle, author: "HR-Modul" },
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      // Header
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(Text, { style: styles.title }, docTitle),
        React.createElement(Text, { style: styles.subtitle }, "für " + certificate.employeeName)
      ),
      // Content
      React.createElement(View, { style: styles.section }, ...paragraphElements),
      // Footer
      React.createElement(
        View,
        { style: styles.footer },
        React.createElement(Text, { style: styles.dateLocation }, "Ort, den " + formatDate(certificate.issueDate)),
        React.createElement(View, { style: styles.signatureLine }),
        React.createElement(Text, { style: styles.meta }, "Unterschrift Geschäftsführung / Personalabteilung")
      )
    )
  ) as ReactElement<DocumentProps>;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    
    const { id } = await params;

    const certificate = await db.workCertificate.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        type: true,
        employeeName: true,
        jobTitle: true,
        startDate: true,
        endDate: true,
        issueDate: true,
        fullContent: true,
        status: true,
      },
    });

    if (!certificate) {
      return Response.json({ error: "Zeugnis nicht gefunden" }, { status: 404 });
    }

    if (!certificate.fullContent) {
      return Response.json(
        { error: "Zeugnis hat noch keinen Inhalt. Bitte zuerst generieren." },
        { status: 400 }
      );
    }

    // Generate PDF
    const pdfDocument = createPdfDocument(certificate);
    const pdfBuffer = await renderToBuffer(pdfDocument);

    // Create filename
    const filename = `Zeugnis_${certificate.employeeName.replace(/\s+/g, "_")}_${
      new Date().toISOString().slice(0, 10)
    }.pdf`;

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error("PDF generation error:", e);
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    return Response.json({ error: msg }, { status: 500 });
  }
}
