import { db } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { renderToBuffer, Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import React, { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";

// Certificate settings type
type CertificateSettings = {
  companyName: string;
  companyStreet: string;
  companyCity: string;
  companyPhone: string;
  companyWebsite: string;
  companyLogo: string;
  companyIntro: string;
};

// Default values
const DEFAULT_CERT_SETTINGS: CertificateSettings = {
  companyName: "RealCore Consulting GmbH",
  companyStreet: "",
  companyCity: "",
  companyPhone: "",
  companyWebsite: "",
  companyLogo: "https://realcore.info/bilder/rc-logo.png",
  companyIntro: "Die RealCore Consulting GmbH ist ein führendes Beratungsunternehmen im Bereich IT, mit einem besonderen Schwerpunkt auf der SAP-Technologie. Das Unternehmen unterstützt seine Kunden bei der Implementierung und Optimierung von SAP-Lösungen, um deren Geschäftsprozesse effizienter zu gestalten. Dabei legt RealCore besonderen Wert auf eine partnerschaftliche Zusammenarbeit und die Entwicklung maßgeschneiderter Lösungen, um den individuellen Anforderungen der Kunden gerecht zu werden. Ziel ist es, durch praxisorientierte Beratung und exzellente Expertise nachhaltige Erfolge und eine hohe Kundenzufriedenheit sicherzustellen.",
};

// Supported image types for react-pdf
const SUPPORTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/gif"];

// Helper to fetch image and convert to base64 for PDF embedding
async function fetchImageAsBase64(url: string): Promise<string | null> {
  if (!url || url.trim() === "") return null;
  
  try {
    console.log("Fetching logo from:", url);
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PDFGenerator/1.0)",
        "Accept": "image/png, image/jpeg, image/gif",
      },
    });
    
    console.log("Logo fetch response:", { status: response.status, ok: response.ok });
    
    if (!response.ok) {
      console.error("Failed to fetch logo, status:", response.status);
      return null;
    }
    
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0) {
      console.error("Logo image is empty");
      return null;
    }
    
    // Determine content type from response or URL extension
    let contentType = response.headers.get("content-type")?.split(";")[0]?.trim();
    
    // If content-type is missing or generic, try to determine from URL
    if (!contentType || contentType === "application/octet-stream" || !contentType.startsWith("image/")) {
      const ext = url.split(".").pop()?.toLowerCase()?.split("?")[0];
      switch (ext) {
        case "png": contentType = "image/png"; break;
        case "jpg":
        case "jpeg": contentType = "image/jpeg"; break;
        case "gif": contentType = "image/gif"; break;
        default: contentType = "image/png"; // Default to PNG
      }
    }
    
    // Only allow supported image types (react-pdf doesn't support SVG, WebP well)
    if (!SUPPORTED_IMAGE_TYPES.includes(contentType)) {
      console.error("Unsupported image type:", contentType);
      return null;
    }
    
    const base64 = Buffer.from(buffer).toString("base64");
    console.log("Logo converted to base64, content-type:", contentType, "size:", base64.length);
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error("Failed to fetch logo image:", error);
    return null;
  }
}

// PDF Styles - Professional German work certificate layout
const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 60,
    fontSize: 11,
    lineHeight: 1.7,
    fontFamily: "Helvetica",
  },
  // Letterhead
  letterhead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: "#1a1a1a",
    borderBottomStyle: "solid",
  },
  logo: {
    width: 120,
    height: 40,
    objectFit: "contain",
  },
  companyInfo: {
    textAlign: "right",
    fontSize: 8,
    color: "#666",
    lineHeight: 1.4,
  },
  companyName: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 3,
  },
  // Title section
  titleSection: {
    marginTop: 30,
    marginBottom: 25,
    textAlign: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1a1a1a",
    letterSpacing: 1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#333",
  },
  // Employee info box
  employeeBox: {
    backgroundColor: "#f8f8f8",
    padding: 15,
    marginBottom: 25,
    borderLeftWidth: 3,
    borderLeftColor: "#1a1a1a",
    borderLeftStyle: "solid",
  },
  employeeLabel: {
    fontSize: 9,
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  employeeName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  employeeDetails: {
    fontSize: 10,
    color: "#444",
    lineHeight: 1.5,
  },
  // Content
  content: {
    marginBottom: 20,
  },
  paragraph: {
    textAlign: "justify",
    marginBottom: 12,
    fontSize: 11,
    lineHeight: 1.7,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 40,
    left: 60,
    right: 60,
  },
  footerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  dateSection: {
    width: "45%",
  },
  dateLabel: {
    fontSize: 9,
    color: "#666",
    marginBottom: 5,
  },
  dateLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    borderBottomStyle: "solid",
    paddingBottom: 3,
    marginBottom: 3,
  },
  dateText: {
    fontSize: 10,
  },
  signatureSection: {
    width: "45%",
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    borderBottomStyle: "solid",
    marginBottom: 5,
    height: 40,
  },
  signatureLabel: {
    fontSize: 8,
    color: "#666",
    textAlign: "center",
  },
  // Page number
  pageNumber: {
    position: "absolute",
    bottom: 20,
    right: 60,
    fontSize: 8,
    color: "#999",
  },
  // Confidential mark
  confidential: {
    position: "absolute",
    top: 20,
    right: 60,
    fontSize: 8,
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: 1,
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
  settings: CertificateSettings;
};

// Helper to create the PDF document using React.createElement
function createPdfDocument(certificate: CertificateData): ReactElement<DocumentProps> {
  const settings = certificate.settings;
  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(date));
  };

  const formatShortDate = (date: Date | null) => {
    if (!date) return "";
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(date));
  };

  const typeLabels: Record<string, string> = {
    ZWISCHENZEUGNIS: "Zwischenzeugnis",
    ENDZEUGNIS: "Arbeitszeugnis",
    EINFACH: "Einfaches Arbeitszeugnis",
    QUALIFIZIERT: "Qualifiziertes Arbeitszeugnis",
  };

  const docTitle = certificate.title || typeLabels[certificate.type] || "Arbeitszeugnis";
  
  // Prepend company intro to content if available
  const companyIntro = settings.companyIntro ? settings.companyIntro.trim() : "";
  const mainContent = certificate.fullContent || "";
  const fullText = companyIntro 
    ? `${companyIntro}\n\n${mainContent}`
    : mainContent;
  const paragraphs = fullText.split("\n\n").filter(Boolean);

  // Calculate employment duration
  const startDate = new Date(certificate.startDate);
  const endDate = certificate.endDate ? new Date(certificate.endDate) : new Date();
  const years = Math.floor((endDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  const months = Math.floor(((endDate.getTime() - startDate.getTime()) % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
  const durationText = years > 0 
    ? `${years} Jahr${years !== 1 ? "e" : ""}${months > 0 ? ` und ${months} Monat${months !== 1 ? "e" : ""}` : ""}`
    : `${months} Monat${months !== 1 ? "e" : ""}`;

  // Build paragraph elements
  const paragraphElements = paragraphs.map((para, idx) =>
    React.createElement(Text, { key: idx, style: styles.paragraph }, para)
  );

  // Build the document structure
  return React.createElement(
    Document,
    { title: docTitle, author: "HR-Modul", subject: `Arbeitszeugnis für ${certificate.employeeName}` },
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      // Confidential mark
      React.createElement(Text, { style: styles.confidential }, "Vertraulich"),
      // Letterhead with logo and company info
      React.createElement(
        View,
        { style: styles.letterhead },
        settings.companyLogo && settings.companyLogo.startsWith("data:image/") ? React.createElement(Image, { style: styles.logo, src: settings.companyLogo }) : null,
        React.createElement(
          View,
          { style: styles.companyInfo },
          React.createElement(Text, { style: styles.companyName }, settings.companyName || ""),
          settings.companyStreet ? React.createElement(Text, null, settings.companyStreet) : null,
          settings.companyCity ? React.createElement(Text, null, settings.companyCity) : null,
          settings.companyPhone ? React.createElement(Text, null, `Tel: ${settings.companyPhone}`) : null,
          settings.companyWebsite ? React.createElement(Text, null, settings.companyWebsite) : null
        )
      ),
      // Title
      React.createElement(
        View,
        { style: styles.titleSection },
        React.createElement(Text, { style: styles.title }, docTitle)
      ),
      // Employee info box
      React.createElement(
        View,
        { style: styles.employeeBox },
        React.createElement(Text, { style: styles.employeeLabel }, "Ausgestellt für"),
        React.createElement(Text, { style: styles.employeeName }, certificate.employeeName),
        React.createElement(
          Text,
          { style: styles.employeeDetails },
          certificate.jobTitle ? `Position: ${certificate.jobTitle}` : ""
        ),
        React.createElement(
          Text,
          { style: styles.employeeDetails },
          `Beschäftigungszeitraum: ${formatShortDate(certificate.startDate)} – ${certificate.endDate ? formatShortDate(certificate.endDate) : "heute"}`
        ),
        React.createElement(
          Text,
          { style: styles.employeeDetails },
          `Beschäftigungsdauer: ${durationText}`
        )
      ),
      // Content
      React.createElement(View, { style: styles.content }, ...paragraphElements),
      // Footer with date and signature
      React.createElement(
        View,
        { style: styles.footer },
        React.createElement(
          View,
          { style: styles.footerContent },
          // Date section
          React.createElement(
            View,
            { style: styles.dateSection },
            React.createElement(Text, { style: styles.dateLabel }, "Ort, Datum"),
            React.createElement(View, { style: styles.dateLine }),
            React.createElement(Text, { style: styles.dateText }, formatDate(certificate.issueDate))
          ),
          // Signature section
          React.createElement(
            View,
            { style: styles.signatureSection },
            React.createElement(View, { style: styles.signatureLine }),
            React.createElement(Text, { style: styles.signatureLabel }, "Geschäftsführung / Personalabteilung")
          )
        )
      ),
      // Page number
      React.createElement(
        Text,
        { style: styles.pageNumber, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Seite ${pageNumber} von ${totalPages}` },
        null
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

    // Load certificate and settings in parallel
    const [certificate, settings] = await Promise.all([
      (db as unknown as { workCertificate: { findUnique: (args: { where: { id: string }; select: Record<string, boolean> }) => Promise<{
        id: string;
        title: string | null;
        type: string;
        employeeName: string;
        jobTitle: string | null;
        startDate: Date;
        endDate: Date | null;
        issueDate: Date;
        fullContent: string | null;
        status: string;
      } | null> } }).workCertificate.findUnique({
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
      }),
      db.setting.findUnique({ where: { id: 1 } }),
    ]);

    if (!certificate) {
      return Response.json({ error: "Zeugnis nicht gefunden" }, { status: 404 });
    }

    if (!certificate.fullContent) {
      return Response.json(
        { error: "Zeugnis hat noch keinen Inhalt. Bitte zuerst generieren." },
        { status: 400 }
      );
    }

    // Build certificate settings from DB or use defaults
    const certSettings = settings as typeof settings & {
      certCompanyName?: string;
      certCompanyStreet?: string;
      certCompanyCity?: string;
      certCompanyPhone?: string;
      certCompanyWebsite?: string;
      certCompanyLogo?: string;
      certCompanyIntro?: string;
    };
    
    // Fetch logo as base64 to avoid CORS issues in PDF generation
    const logoUrl = certSettings?.certCompanyLogo || DEFAULT_CERT_SETTINGS.companyLogo;
    const logoBase64 = logoUrl ? await fetchImageAsBase64(logoUrl) : null;
    
    const certConfig: CertificateSettings = {
      companyName: certSettings?.certCompanyName || DEFAULT_CERT_SETTINGS.companyName,
      companyStreet: certSettings?.certCompanyStreet || DEFAULT_CERT_SETTINGS.companyStreet,
      companyCity: certSettings?.certCompanyCity || DEFAULT_CERT_SETTINGS.companyCity,
      companyPhone: certSettings?.certCompanyPhone || DEFAULT_CERT_SETTINGS.companyPhone,
      companyWebsite: certSettings?.certCompanyWebsite || DEFAULT_CERT_SETTINGS.companyWebsite,
      companyLogo: logoBase64 || "", // Use base64 encoded logo
      companyIntro: certSettings?.certCompanyIntro || DEFAULT_CERT_SETTINGS.companyIntro,
    };

    // Generate PDF
    const pdfDocument = createPdfDocument({ ...certificate, settings: certConfig });
    const pdfBuffer = await renderToBuffer(pdfDocument);

    // Create filename
    const filename = `Zeugnis_${certificate.employeeName.replace(/\s+/g, "_")}_${
      new Date().toISOString().slice(0, 10)
    }.pdf`;

    // Convert Buffer to Uint8Array for Response compatibility
    const uint8Array = new Uint8Array(pdfBuffer);

    return new Response(uint8Array, {
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
