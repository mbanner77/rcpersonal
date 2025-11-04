// @ts-expect-error - @xenova/transformers ships without TypeScript types
import { pipeline } from "@xenova/transformers";

let generatorPromise: Promise<ReturnType<typeof pipeline>> | null = null;

async function getGenerator() {
  if (!generatorPromise) {
    generatorPromise = pipeline("text-generation", "Xenova/phi-2" as const, {
      device: "cpu",
    });
  }
  return generatorPromise;
}

export async function generateInsightPrompt(question: string, stats: {
  windowDays: number;
  hits7: number;
  hitsWindow: number;
  topYears: number[];
  birthdaysToday: number;
  totals: { birthdays: number; hires: number; jubilees: number };
}): Promise<string> {
  const prompt = `Du bist ein hilfreicher Assistent für ein HR-Dashboard. Nutze die folgenden Zahlen und beantworte die Frage kurz und sachlich.

Kennzahlen:
- Jubiläen in 7 Tagen: ${stats.hits7}
- Jubiläen in ${stats.windowDays} Tagen: ${stats.hitsWindow}
- Häufigste Jubiläumsjahre: ${stats.topYears.join(", ") || "keine"}
- Geburtstage heute: ${stats.birthdaysToday}
- Geburtstage gesamt dieses Jahr: ${stats.totals.birthdays}
- Eintritte gesamt dieses Jahr: ${stats.totals.hires}
- Jubiläen gesamt dieses Jahr: ${stats.totals.jubilees}

Frage: ${question}

Antwort:`;

  const generator = await getGenerator();
  const output = await generator(prompt, {
    max_new_tokens: 120,
    temperature: 0.7,
    top_p: 0.9,
  });

  const text = Array.isArray(output) ? output[0]?.generated_text ?? "" : (output as { generated_text?: string })?.generated_text ?? "";
  return text.split("Antwort:").pop()?.trim() || text.trim() || "Ich habe dazu keine Information.";
}
