import { db } from "@/lib/prisma";
import { requireUser, hasRole } from "@/lib/auth";

// Standard German work certificate text blocks
// Following the official German "Zeugnissprache" conventions
const SEED_DATA = {
  categories: [
    { key: "INTRO", label: "Einleitung", description: "Einführung und persönliche Daten", orderIndex: 0 },
    { key: "COMPANY", label: "Unternehmensbeschreibung", description: "Kurze Vorstellung des Unternehmens", orderIndex: 1 },
    { key: "TASKS", label: "Tätigkeitsbeschreibung", description: "Aufgaben und Verantwortlichkeiten", orderIndex: 2 },
    { key: "SKILLS", label: "Fachkenntnisse", description: "Besondere Fähigkeiten und Qualifikationen", orderIndex: 3 },
    { key: "PERFORMANCE", label: "Leistungsbeurteilung", description: "Arbeitsleistung und Ergebnisse", orderIndex: 4 },
    { key: "BEHAVIOR", label: "Verhalten", description: "Sozialverhalten und Zusammenarbeit", orderIndex: 5 },
    { key: "CLOSING", label: "Schlussformel", description: "Abschluss und Zukunftswünsche", orderIndex: 6 },
  ],
  textBlocks: [
    // INTRO - Einleitung
    {
      categoryKey: "INTRO",
      title: "Standardeinleitung",
      rating: 2,
      isDefault: true,
      content: `{fullName}, geboren am {birthDate}, war vom {startDate} bis zum {endDate} in unserem Unternehmen als {jobTitle} tätig.`,
    },
    {
      categoryKey: "INTRO",
      title: "Einleitung mit Abteilung",
      rating: 2,
      isDefault: false,
      content: `{fullName}, geboren am {birthDate}, trat am {startDate} in unser Unternehmen ein und war bis zum {endDate} in der Abteilung {department} als {jobTitle} beschäftigt.`,
    },
    {
      categoryKey: "INTRO",
      title: "Zwischenzeugnis Einleitung",
      rating: 2,
      isDefault: false,
      content: `{fullName}, geboren am {birthDate}, ist seit dem {startDate} in unserem Unternehmen als {jobTitle} tätig.`,
    },

    // COMPANY - Unternehmensbeschreibung
    {
      categoryKey: "COMPANY",
      title: "IT-Unternehmen",
      rating: 2,
      isDefault: true,
      content: `Unser Unternehmen ist ein führender Anbieter im Bereich IT-Dienstleistungen und Softwareentwicklung. Mit über 100 Mitarbeitern betreuen wir nationale und internationale Kunden aus verschiedenen Branchen.`,
    },
    {
      categoryKey: "COMPANY",
      title: "Beratungsunternehmen",
      rating: 2,
      isDefault: false,
      content: `Unser Unternehmen ist eine etablierte Unternehmensberatung mit Fokus auf digitale Transformation und Prozessoptimierung. Wir unterstützen mittelständische und große Unternehmen bei der Umsetzung ihrer strategischen Ziele.`,
    },

    // TASKS - Tätigkeitsbeschreibung
    {
      categoryKey: "TASKS",
      title: "Allgemeine Tätigkeitsbeschreibung",
      rating: 2,
      isDefault: true,
      content: `Zu {possessive} Aufgabenbereich gehörten insbesondere:

• Selbstständige Bearbeitung von Projekten und Aufgaben im Verantwortungsbereich
• Koordination und Abstimmung mit internen und externen Partnern
• Erstellung von Dokumentationen und Reports
• Mitwirkung bei der Optimierung von Prozessen und Abläufen
• Unterstützung bei fachbereichsübergreifenden Projekten`,
    },
    {
      categoryKey: "TASKS",
      title: "IT/Entwicklung",
      rating: 2,
      isDefault: false,
      content: `Zu {possessive} Hauptaufgaben gehörten:

• Konzeption, Entwicklung und Wartung von Softwarelösungen
• Technische Analyse von Kundenanforderungen
• Code Reviews und Qualitätssicherung
• Zusammenarbeit im agilen Team nach Scrum-Methodik
• Dokumentation von technischen Spezifikationen
• Betreuung und Weiterentwicklung bestehender Systeme`,
    },
    {
      categoryKey: "TASKS",
      title: "Projektmanagement",
      rating: 2,
      isDefault: false,
      content: `{fullName} war verantwortlich für:

• Planung, Steuerung und Überwachung von Projekten
• Führung und Koordination von Projektteams
• Stakeholder-Management und Kundenkommunikation
• Budget- und Ressourcenplanung
• Risikomanagement und Qualitätssicherung
• Erstellung von Projektberichten und Präsentationen`,
    },
    {
      categoryKey: "TASKS",
      title: "Personalwesen/HR",
      rating: 2,
      isDefault: false,
      content: `Der Aufgabenbereich umfasste:

• Betreuung des gesamten Employee Lifecycles
• Recruiting und Bewerbermanagement
• Personaladministration und Vertragswesen
• Beratung von Führungskräften in personalrelevanten Fragen
• Durchführung von Mitarbeitergesprächen
• Entwicklung und Umsetzung von HR-Prozessen`,
    },

    // SKILLS - Fachkenntnisse
    {
      categoryKey: "SKILLS",
      title: "Sehr gut (Note 1)",
      rating: 1,
      isDefault: true,
      content: `{fullName} verfügt über hervorragende Fachkenntnisse, die {pronoun} stets gewinnbringend einsetzte. {Pronoun} bildete sich kontinuierlich fort und war immer auf dem neuesten Stand der fachlichen Entwicklungen. {Possessive} analytische Denkweise und {possessive} ausgeprägte Problemlösungskompetenz waren für das Team von großem Wert.`,
    },
    {
      categoryKey: "SKILLS",
      title: "Gut (Note 2)",
      rating: 2,
      isDefault: true,
      content: `{fullName} verfügt über fundierte Fachkenntnisse, die {pronoun} zielgerichtet einsetzte. {Pronoun} zeigte stets Interesse an fachlicher Weiterbildung und hielt {possessive} Wissen aktuell. {Possessive} analytische Denkweise und Problemlösungskompetenz überzeugten.`,
    },
    {
      categoryKey: "SKILLS",
      title: "Befriedigend (Note 3)",
      rating: 3,
      isDefault: true,
      content: `{fullName} verfügt über solide Fachkenntnisse, die {pronoun} sachgerecht einsetzte. {Pronoun} war bereit, sich fachlich weiterzubilden.`,
    },

    // PERFORMANCE - Leistungsbeurteilung
    {
      categoryKey: "PERFORMANCE",
      title: "Sehr gut (Note 1)",
      rating: 1,
      isDefault: true,
      content: `{fullName} erledigte alle Aufgaben stets zu unserer vollsten Zufriedenheit. {Pronoun} zeigte außerordentliches Engagement und übertraf regelmäßig unsere Erwartungen. {Pronoun} zeichnete sich durch herausragende Fachkenntnisse, schnelle Auffassungsgabe und ein ausgeprägtes analytisches Denkvermögen aus. Die Arbeitsergebnisse waren stets von höchster Qualität und wurden termingerecht geliefert. {Pronoun} arbeitete äußerst selbstständig, zuverlässig und mit großer Sorgfalt.`,
    },
    {
      categoryKey: "PERFORMANCE",
      title: "Gut (Note 2)",
      rating: 2,
      isDefault: true,
      content: `{fullName} erledigte alle Aufgaben stets zu unserer vollen Zufriedenheit. {Pronoun} zeigte großes Engagement und erfüllte unsere Erwartungen in jeder Hinsicht. {Pronoun} verfügt über fundierte Fachkenntnisse und eine gute Auffassungsgabe. Die Arbeitsergebnisse waren von hoher Qualität und wurden termingerecht abgeliefert. {Pronoun} arbeitete selbstständig, zuverlässig und sorgfältig.`,
    },
    {
      categoryKey: "PERFORMANCE",
      title: "Befriedigend (Note 3)",
      rating: 3,
      isDefault: true,
      content: `{fullName} erledigte alle Aufgaben zu unserer vollen Zufriedenheit. {Pronoun} zeigte Engagement und erfüllte unsere Erwartungen. {Pronoun} verfügt über gute Fachkenntnisse. Die Arbeitsergebnisse waren von guter Qualität. {Pronoun} arbeitete zuverlässig und sorgfältig.`,
    },
    {
      categoryKey: "PERFORMANCE",
      title: "Ausreichend (Note 4)",
      rating: 4,
      isDefault: true,
      content: `{fullName} erledigte die übertragenen Aufgaben zu unserer Zufriedenheit. {Pronoun} erfüllte die an {possessive} Position gestellten Anforderungen. Die Arbeitsergebnisse entsprachen den Erwartungen.`,
    },
    {
      categoryKey: "PERFORMANCE",
      title: "Mangelhaft (Note 5)",
      rating: 5,
      isDefault: true,
      content: `{fullName} bemühte sich, die übertragenen Aufgaben zu erfüllen. {Pronoun} war stets bestrebt, den Anforderungen gerecht zu werden.`,
    },

    // BEHAVIOR - Verhalten
    {
      categoryKey: "BEHAVIOR",
      title: "Sehr gut (Note 1)",
      rating: 1,
      isDefault: true,
      content: `Das Verhalten von {fullName} gegenüber Vorgesetzten, Kollegen und Kunden war jederzeit vorbildlich. {Pronoun} war ein geschätztes Teammitglied und trug maßgeblich zu einem positiven Arbeitsklima bei. {Possessive} Kommunikationsfähigkeit und Teamorientierung waren ausgezeichnet.`,
    },
    {
      categoryKey: "BEHAVIOR",
      title: "Gut (Note 2)",
      rating: 2,
      isDefault: true,
      content: `Das Verhalten von {fullName} gegenüber Vorgesetzten, Kollegen und Kunden war stets einwandfrei. {Pronoun} war ein geschätztes Teammitglied und trug zu einem guten Arbeitsklima bei. {Possessive} Kommunikationsfähigkeit und Teamorientierung überzeugten.`,
    },
    {
      categoryKey: "BEHAVIOR",
      title: "Befriedigend (Note 3)",
      rating: 3,
      isDefault: true,
      content: `Das Verhalten von {fullName} gegenüber Vorgesetzten, Kollegen und Kunden war einwandfrei. {Pronoun} fügte sich gut in das Team ein.`,
    },
    {
      categoryKey: "BEHAVIOR",
      title: "Ausreichend (Note 4)",
      rating: 4,
      isDefault: true,
      content: `Das Verhalten von {fullName} gegenüber Vorgesetzten und Kollegen war korrekt.`,
    },
    {
      categoryKey: "BEHAVIOR",
      title: "Mangelhaft (Note 5)",
      rating: 5,
      isDefault: true,
      content: `{fullName} verhielt sich gegenüber Vorgesetzten und Kollegen insgesamt angemessen.`,
    },

    // CLOSING - Schlussformel
    {
      categoryKey: "CLOSING",
      title: "Sehr gut (Note 1)",
      rating: 1,
      isDefault: true,
      content: `{fullName} verlässt unser Unternehmen auf eigenen Wunsch. Wir bedauern {possessive} Weggang außerordentlich und danken {pronoun} für die stets hervorragende Zusammenarbeit. Für {possessive} berufliche und private Zukunft wünschen wir {pronoun} alles Gute und weiterhin viel Erfolg.`,
    },
    {
      categoryKey: "CLOSING",
      title: "Gut (Note 2)",
      rating: 2,
      isDefault: true,
      content: `{fullName} verlässt unser Unternehmen auf eigenen Wunsch. Wir bedauern {possessive} Weggang und danken {pronoun} für die gute Zusammenarbeit. Für {possessive} berufliche und private Zukunft wünschen wir {pronoun} alles Gute und viel Erfolg.`,
    },
    {
      categoryKey: "CLOSING",
      title: "Befriedigend (Note 3)",
      rating: 3,
      isDefault: true,
      content: `{fullName} verlässt unser Unternehmen auf eigenen Wunsch. Wir danken {pronoun} für die Zusammenarbeit und wünschen {pronoun} für die Zukunft alles Gute.`,
    },
    {
      categoryKey: "CLOSING",
      title: "Ausreichend (Note 4)",
      rating: 4,
      isDefault: true,
      content: `{fullName} verlässt unser Unternehmen. Wir wünschen {pronoun} für die Zukunft alles Gute.`,
    },
    {
      categoryKey: "CLOSING",
      title: "Mangelhaft (Note 5)",
      rating: 5,
      isDefault: true,
      content: `{fullName} verlässt unser Unternehmen. Wir wünschen {pronoun} alles Gute.`,
    },

    // Alternative closings
    {
      categoryKey: "CLOSING",
      title: "Zwischenzeugnis - Sehr gut",
      rating: 1,
      isDefault: false,
      content: `Wir freuen uns auf die weitere Zusammenarbeit mit {fullName} und sind überzeugt, dass {pronoun} auch zukünftig hervorragende Leistungen erbringen wird.`,
    },
    {
      categoryKey: "CLOSING",
      title: "Zwischenzeugnis - Gut",
      rating: 2,
      isDefault: false,
      content: `Wir freuen uns auf die weitere Zusammenarbeit mit {fullName}.`,
    },
  ],
};

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!hasRole(user, "ADMIN")) {
      return Response.json({ error: "Zugriff verweigert" }, { status: 403 });
    }

    const results = {
      categories: 0,
      textBlocks: 0,
      errors: [] as string[],
    };

    // Create categories
    for (const cat of SEED_DATA.categories) {
      try {
        await db.certificateCategory.upsert({
          where: { key: cat.key },
          update: { label: cat.label, description: cat.description, orderIndex: cat.orderIndex },
          create: cat,
        });
        results.categories++;
      } catch (e) {
        results.errors.push(`Kategorie ${cat.key}: ${e instanceof Error ? e.message : "Fehler"}`);
      }
    }

    // Get category IDs
    const categories = await db.certificateCategory.findMany();
    const categoryMap = new Map(categories.map(c => [c.key, c.id]));

    // Create text blocks
    for (const block of SEED_DATA.textBlocks) {
      const categoryId = categoryMap.get(block.categoryKey);
      if (!categoryId) {
        results.errors.push(`Textbaustein "${block.title}": Kategorie ${block.categoryKey} nicht gefunden`);
        continue;
      }

      try {
        // Check if similar block exists
        const existing = await db.certificateTextBlock.findFirst({
          where: {
            categoryId,
            rating: block.rating,
            title: block.title,
          },
        });

        if (existing) {
          await db.certificateTextBlock.update({
            where: { id: existing.id },
            data: {
              content: block.content,
              isDefault: block.isDefault,
            },
          });
        } else {
          await db.certificateTextBlock.create({
            data: {
              categoryId,
              title: block.title,
              content: block.content,
              rating: block.rating,
              isDefault: block.isDefault,
              active: true,
            },
          });
        }
        results.textBlocks++;
      } catch (e) {
        results.errors.push(`Textbaustein "${block.title}": ${e instanceof Error ? e.message : "Fehler"}`);
      }
    }

    return Response.json({
      success: true,
      message: `${results.categories} Kategorien und ${results.textBlocks} Textbausteine erstellt/aktualisiert`,
      ...results,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    return Response.json({ error: msg }, { status: 500 });
  }
}
