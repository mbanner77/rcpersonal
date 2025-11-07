"use client";

import { useEffect, useState } from "react";

type TestLog = { ts: string; message: string };

type SettingsDto = {
  managerEmails: string;
  birthdayEmailTemplate: string;
  jubileeEmailTemplate: string;
  jubileeYearsCsv: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  sendOnBirthday: boolean;
  sendOnJubilee: boolean;
  dailySendHour: number;
};

type TestResult = {
  accepted?: string[];
  rejected?: string[];
  messageId?: string;
  response?: string;
  envelope?: { from?: string; to?: string[] };
  logs?: TestLog[];
  durationMs?: number;
  config?: { host: string; port: number; user: string; from: string; secure: boolean };
  error?: string;
};

export default function SettingsPage() {
  const [data, setData] = useState<SettingsDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/settings");
      const json = await res.json();
      setData(json);
      if (typeof json.managerEmails === "string" && json.managerEmails.includes("@")) {
        setTestTo(json.managerEmails.split(",")[0].trim());
      }
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    const ok = res.ok;
    setSaving(false);
    setMsg(ok ? "Gespeichert" : "Fehler beim Speichern");
  }

  function update<K extends keyof SettingsDto>(key: K, value: SettingsDto[K]) {
    if (!data) return;
    setData({ ...data, [key]: value });
  }

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Einstellungen</h1>
      {!data ? (
        <p className="text-zinc-600">Lade…</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">
          <div>
            <label className="block text-sm font-medium">Manager-Verteiler (Komma-getrennt)</label>
            <input
              className="mt-1 w-full border rounded p-2"
              value={data.managerEmails}
              onChange={(e) => update("managerEmails", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Jubiläumsjahre (CSV)</label>
            <input
              className="mt-1 w-full border rounded p-2"
              value={data.jubileeYearsCsv}
              onChange={(e) => update("jubileeYearsCsv", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Geburtstags-Template</label>
            <textarea
              className="mt-1 w-full border rounded p-2 h-28"
              value={data.birthdayEmailTemplate}
              onChange={(e) => update("birthdayEmailTemplate", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Jubiläums-Template</label>
            <textarea
              className="mt-1 w-full border rounded p-2 h-28"
              value={data.jubileeEmailTemplate}
              onChange={(e) => update("jubileeEmailTemplate", e.target.value)}
            />
          </div>

          <div className="pt-4 border-t">
            <h2 className="text-lg font-medium mb-2">E-Mail-Server</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">SMTP Host</label>
                <input className="mt-1 w-full border rounded p-2" value={data.smtpHost} onChange={(e) => update("smtpHost", e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium">SMTP Port</label>
                <input type="number" className="mt-1 w-full border rounded p-2" value={data.smtpPort} onChange={(e) => update("smtpPort", Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-sm font-medium">SMTP Benutzer</label>
                <input className="mt-1 w-full border rounded p-2" value={data.smtpUser} onChange={(e) => update("smtpUser", e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium">SMTP Passwort</label>
                <input type="password" className="mt-1 w-full border rounded p-2" value={data.smtpPass} onChange={(e) => update("smtpPass", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium">Absender (From)</label>
                <input className="mt-1 w-full border rounded p-2" value={data.smtpFrom} onChange={(e) => update("smtpFrom", e.target.value)} />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h2 className="text-lg font-medium mb-2">Sendezeit & Ereignisse</h2>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={data.sendOnBirthday} onChange={(e) => update("sendOnBirthday", e.target.checked)} /> Geburtstagsmails senden
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={data.sendOnJubilee} onChange={(e) => update("sendOnJubilee", e.target.checked)} /> Jubiläumsmails senden
              </label>
              <label className="flex items-center gap-2">
                Stunde:
                <input type="number" min={0} max={23} value={data.dailySendHour} onChange={(e) => update("dailySendHour", Number(e.target.value))} className="border rounded p-1 w-16" />
              </label>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h2 className="text-lg font-medium mb-2">Testmail</h2>
            <div className="flex items-center gap-2">
              <input className="border rounded p-2 flex-1" placeholder="Empfänger" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
              <button type="button" disabled={testing} onClick={async () => {
                setTesting(true); setMsg(""); setTestResult(null);
                try {
                  const res = await fetch("/api/settings/test-mail", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: testTo }) });
                  const json = await res.json().catch(() => null);
                  if (res.ok) {
                    setMsg("Testmail gesendet");
                    setTestResult(json ?? null);
                  } else {
                    setMsg(json?.error || "Fehler beim Senden");
                    setTestResult(json ?? { error: json?.error });
                  }
                } finally { setTesting(false); }
              }} className="rounded border px-3 py-2">{testing ? "Sende…" : "Testmail senden"}</button>
              {testResult && (
                <button type="button" onClick={() => setShowDialog(true)} className="rounded border px-3 py-2">
                  Details
                </button>
              )}
            </div>
            {testResult && (
              <div className="mt-3 text-xs bg-zinc-50 dark:bg-zinc-900 border rounded p-3 space-y-1">
                {testResult.error && <p className="text-red-600">Fehler: {testResult.error}</p>}
                {testResult.accepted && <p>Accepted: {testResult.accepted.join(", ") || "–"}</p>}
                {testResult.rejected && testResult.rejected.length > 0 && <p className="text-red-500">Rejected: {testResult.rejected.join(", ")}</p>}
                {testResult.messageId && <p>Message ID: {testResult.messageId}</p>}
                {testResult.response && <p>SMTP Antwort: {testResult.response}</p>}
                {testResult.envelope && (
                  <p>Envelope: From {testResult.envelope.from ?? "?"} → {(testResult.envelope.to ?? []).join(", ") || "?"}</p>
                )}
                {typeof testResult.durationMs === "number" && <p>Dauer: {testResult.durationMs} ms</p>}
              </div>
            )}
          </div>

          <button disabled={saving} className="rounded bg-black text-white px-4 py-2 disabled:opacity-50">
            {saving ? "Speichern…" : "Speichern"}
          </button>
          {msg && <p className="text-sm text-zinc-700">{msg}</p>}
        </form>
      )}

      {showDialog && testResult && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-950 border rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-lg font-semibold">SMTP Testlog</h3>
              <button onClick={() => setShowDialog(false)} className="text-sm text-zinc-600 hover:text-zinc-900">Schließen</button>
            </div>
            <div className="p-4 space-y-4 text-sm overflow-y-auto">
              {testResult.config && (
                <div>
                  <h4 className="font-medium">Konfiguration</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 text-xs text-zinc-600">
                    <span>Host: {testResult.config.host}:{testResult.config.port}</span>
                    <span>User: {testResult.config.user}</span>
                    <span>From: {testResult.config.from}</span>
                    <span>Secure: {testResult.config.secure ? "Ja" : "Nein"}</span>
                  </div>
                </div>
              )}
              <div>
                <h4 className="font-medium">Log-Ausgabe</h4>
                <div className="bg-zinc-50 dark:bg-zinc-900 border rounded p-3 space-y-1 max-h-56 overflow-y-auto">
                  {(testResult.logs ?? []).map((entry) => (
                    <div key={entry.ts}><span className="text-zinc-500">[{entry.ts}]</span> {entry.message}</div>
                  ))}
                  {(testResult.logs ?? []).length === 0 && <div className="text-zinc-500">Keine Logs verfügbar.</div>}
                </div>
              </div>
              <div className="space-y-1">
                <h4 className="font-medium">SMTP Antwort</h4>
                <p>Accepted: {testResult.accepted?.join(", ") || "–"}</p>
                <p>Rejected: {testResult.rejected?.join(", ") || "–"}</p>
                <p>Message ID: {testResult.messageId || "–"}</p>
                <p>Response: {testResult.response || "–"}</p>
                <p>Envelope: From {testResult.envelope?.from ?? "?"} → {(testResult.envelope?.to ?? []).join(", ") || "?"}</p>
                {typeof testResult.durationMs === "number" && <p>Dauer: {testResult.durationMs} ms</p>}
                {testResult.error && <p className="text-red-600">Fehler: {testResult.error}</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
