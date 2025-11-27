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
  // Reminder trigger state
  const [triggeringReminders, setTriggeringReminders] = useState(false);
  const [reminderResult, setReminderResult] = useState<{ ok: boolean; message: string; sent?: number } | null>(null);

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
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Einstellungen</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Konfigurieren Sie E-Mail-Vorlagen, SMTP-Server und Benachrichtigungen.</p>
        </div>

        {!data ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-zinc-500">
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
              Lade Einstellungen…
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Benachrichtigungen Card */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Benachrichtigungen</h2>
                  <p className="text-xs text-zinc-500">Manager-Verteiler und Jubiläumsjahre</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Manager-Verteiler (Komma-getrennt)</label>
                  <input
                    className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
                    value={data.managerEmails}
                    onChange={(e) => update("managerEmails", e.target.value)}
                    placeholder="manager1@example.com, manager2@example.com"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Jubiläumsjahre (CSV)</label>
                  <input
                    className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
                    value={data.jubileeYearsCsv}
                    onChange={(e) => update("jubileeYearsCsv", e.target.value)}
                    placeholder="5,10,15,20,25,30,35,40"
                  />
                </div>
              </div>
            </div>

            {/* E-Mail Templates Card */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                  <svg className="h-5 w-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">E-Mail-Vorlagen</h2>
                  <p className="text-xs text-zinc-500">Verwenden Sie {"{{firstName}}"}, {"{{lastName}}"}, {"{{years}}"} als Platzhalter</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Geburtstags-Template</label>
                  <textarea
                    className="h-28 w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm transition focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
                    value={data.birthdayEmailTemplate}
                    onChange={(e) => update("birthdayEmailTemplate", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Jubiläums-Template</label>
                  <textarea
                    className="h-28 w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm transition focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
                    value={data.jubileeEmailTemplate}
                    onChange={(e) => update("jubileeEmailTemplate", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* SMTP Server Card */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                  <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">E-Mail-Server (SMTP)</h2>
                  <p className="text-xs text-zinc-500">SMTP-Verbindungseinstellungen für den E-Mail-Versand</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">SMTP Host</label>
                  <input className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white" value={data.smtpHost} onChange={(e) => update("smtpHost", e.target.value)} placeholder="smtp.example.com" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">SMTP Port</label>
                  <input type="number" className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white" value={data.smtpPort} onChange={(e) => update("smtpPort", Number(e.target.value))} placeholder="465" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">SMTP Benutzer</label>
                  <input className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white" value={data.smtpUser} onChange={(e) => update("smtpUser", e.target.value)} placeholder="user@example.com" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">SMTP Passwort</label>
                  <input type="password" className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white" value={data.smtpPass} onChange={(e) => update("smtpPass", e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Absender (From)</label>
                  <input className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white" value={data.smtpFrom} onChange={(e) => update("smtpFrom", e.target.value)} placeholder="noreply@example.com" />
                </div>
              </div>
            </div>

            {/* Sendezeit & Ereignisse Card */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                  <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Sendezeit & Ereignisse</h2>
                  <p className="text-xs text-zinc-500">Aktivieren Sie automatische E-Mail-Benachrichtigungen</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 transition hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-700/50 dark:hover:bg-zinc-700">
                  <input type="checkbox" checked={data.sendOnBirthday} onChange={(e) => update("sendOnBirthday", e.target.checked)} className="h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500" />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Geburtstagsmails senden</span>
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 transition hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-700/50 dark:hover:bg-zinc-700">
                  <input type="checkbox" checked={data.sendOnJubilee} onChange={(e) => update("sendOnJubilee", e.target.checked)} className="h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500" />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Jubiläumsmails senden</span>
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 dark:border-zinc-600 dark:bg-zinc-700/50">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Sendezeit:</span>
                  <input type="number" min={0} max={23} value={data.dailySendHour} onChange={(e) => update("dailySendHour", Number(e.target.value))} className="w-16 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-center text-sm focus:border-amber-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-white" />
                  <span className="text-sm text-zinc-500">Uhr</span>
                </div>
              </div>
            </div>

            {/* Erinnerungen Card */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
                  <svg className="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Erinnerungen (Lifecycle)</h2>
                  <p className="text-xs text-zinc-500">Automatischer und manueller Erinnerungsversand für HR-Ereignisse</p>
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Erinnerungen werden automatisch über den Cron-Job versendet (täglich zur konfigurierten Sendezeit). 
                  Sie können den Versand auch manuell anstoßen.
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    disabled={triggeringReminders}
                    onClick={async () => {
                      setTriggeringReminders(true);
                      setReminderResult(null);
                      try {
                        const res = await fetch("/api/cron/reminders/send", { 
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ manual: true })
                        });
                        const json = await res.json().catch(() => null);
                        if (res.ok) {
                          setReminderResult({ 
                            ok: true, 
                            message: `Erfolgreich: ${json?.sent ?? 0} Erinnerungen versendet`,
                            sent: json?.sent ?? 0
                          });
                        } else {
                          setReminderResult({ 
                            ok: false, 
                            message: json?.error ?? `Fehler: HTTP ${res.status}` 
                          });
                        }
                      } catch (err) {
                        setReminderResult({ 
                          ok: false, 
                          message: err instanceof Error ? err.message : "Unbekannter Fehler" 
                        });
                      } finally {
                        setTriggeringReminders(false);
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    {triggeringReminders ? "Sende…" : "Erinnerungen jetzt senden"}
                  </button>
                  <a 
                    href="/admin/reminders" 
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Erinnerungen verwalten
                  </a>
                </div>
                {reminderResult && (
                  <div className={`mt-2 rounded-lg border px-4 py-3 text-sm ${reminderResult.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400" : "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"}`}>
                    {reminderResult.ok ? "✓" : "✗"} {reminderResult.message}
                  </div>
                )}
              </div>
            </div>

            {/* Testmail Card */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-900/30">
                  <svg className="h-5 w-5 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Testmail</h2>
                  <p className="text-xs text-zinc-500">Senden Sie eine Test-E-Mail, um die SMTP-Konfiguration zu prüfen</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm transition focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white" placeholder="empfaenger@example.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
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
                }} className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-600 dark:bg-rose-900/20 dark:text-rose-300">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  {testing ? "Sende…" : "Testmail senden"}
                </button>
                {testResult && (
                  <button type="button" onClick={() => setShowDialog(true)} className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Details
                  </button>
                )}
              </div>
              {testResult && (
                <div className={`mt-4 rounded-lg border p-4 text-sm ${testResult.error ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20" : "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-900/20"}`}>
                  {testResult.error && <p className="font-medium text-red-700 dark:text-red-400">Fehler: {testResult.error}</p>}
                  {testResult.accepted && <p className="text-emerald-700 dark:text-emerald-400">✓ Accepted: {testResult.accepted.join(", ") || "–"}</p>}
                  {testResult.rejected && testResult.rejected.length > 0 && <p className="text-red-600">✗ Rejected: {testResult.rejected.join(", ")}</p>}
                  {testResult.messageId && <p className="text-zinc-600 dark:text-zinc-400">Message ID: {testResult.messageId}</p>}
                  {typeof testResult.durationMs === "number" && <p className="text-zinc-500">Dauer: {testResult.durationMs} ms</p>}
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
              <div>
                {msg && (
                  <p className={`text-sm font-medium ${msg.includes("Fehler") ? "text-red-600" : "text-emerald-600"}`}>
                    {msg.includes("Fehler") ? "✗" : "✓"} {msg}
                  </p>
                )}
              </div>
              <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-black px-6 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                {saving ? "Speichern…" : "Einstellungen speichern"}
              </button>
            </div>
          </form>
        )}

        {showDialog && testResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl max-h-[80vh] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-800">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-700">
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">SMTP Testlog</h3>
              <button onClick={() => setShowDialog(false)} className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-200">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm overflow-y-auto">
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
    </div>
  );
}
