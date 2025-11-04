"use client";

import { useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const suggestions = [
  "Wie viele Jubiläen stehen im nächsten Monat an?",
  "Welche Teams haben die meisten Geburtstage im kommenden Quartal?",
  "Gib mir einen kurzen Überblick über Eintritte und Jubiläen dieses Jahres.",
];

export default function AiAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(question: string) {
    if (!question.trim() || loading) return;
    setLoading(true);
    setError(null);
    const nextMessages: Message[] = [...messages, { role: "user", content: question.trim() }];
    setMessages(nextMessages);
    setInput("");

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        throw new Error(`Fehler: ${res.status}`);
      }
      const json = await res.json() as { answer: string };
      setMessages([...nextMessages, { role: "assistant", content: json.answer?.trim() || "(keine Antwort)" }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      setError(msg);
      setMessages(nextMessages);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border bg-white dark:bg-zinc-900 p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">AI Insights Assistant</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Stelle Fragen zu Geburtstagen, Jubiläen oder Eintritten. Das Modell läuft lokal (Transformers.js) – keine API-Keys nötig.</p>
      </div>

      {messages.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto border rounded p-3 bg-zinc-50 dark:bg-zinc-950 text-sm">
          {messages.map((m, idx) => (
            <div key={idx} className={m.role === "user" ? "text-right" : "text-left"}>
              <span className={`inline-block px-3 py-2 rounded ${m.role === "user" ? "bg-black text-white" : "bg-white dark:bg-zinc-800"}`}>
                {m.content}
              </span>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <input
          className="flex-1 border rounded px-3 py-2 text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Frage stellen…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        <button
          type="button"
          className="rounded bg-black text-white px-4 py-2 text-sm disabled:opacity-60"
          disabled={loading}
          onClick={() => send(input)}
        >
          {loading ? "Denke…" : "Fragen"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            className="border rounded-full px-3 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => send(s)}
            disabled={loading}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
