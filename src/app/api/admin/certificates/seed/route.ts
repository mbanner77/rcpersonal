import { db } from "@/lib/prisma";
import { requireUser, hasRole } from "@/lib/auth";

// Standard German work certificate text blocks
const SEED_DATA = {
  categories: [
    { key: "INTRO", label: "Einleitung", description: "Einführung und persönliche Daten", orderIndex: 0 },
    { key: "TASKS", label: "Tätigkeitsbeschreibung", description: "Aufgaben und Verantwortlichkeiten", orderIndex: 1 },
    { key: "PERFORMANCE", label: "Leistungsbeurteilung", description: "Arbeitsleistung und Ergebnisse", orderIndex: 2 },
    { key: "BEHAVIOR", label: "Verhalten", description: "Sozialverhalten und Zusammenarbeit", orderIndex: 3 },
    { key: "CLOSING", label: "Schlussformel", description: "Abschluss und Zukunftswünsche", orderIndex: 4 },
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
      content: `{fullName}, geboren am {birthDate}, war vom {startDate} bis zum {endDate} in unserem Unternehmen in der Abteilung {department} als {jobTitle} beschäftigt.`,
    },

    // TASKS - Tätigkeitsbeschreibung (same for all ratings)
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
