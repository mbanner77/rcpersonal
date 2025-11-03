"use client";

import { useState } from "react";

export default function LoginPage() {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.error ?? "Login fehlgeschlagen");
      } else {
        const next = new URLSearchParams(location.search).get("next") ?? "/";
        location.href = next;
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm p-6">
      <h1 className="text-2xl font-semibold mb-4">Login</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          type="password"
          placeholder="Passwort"
          className="border rounded p-2"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <button disabled={loading} className="rounded bg-black text-white px-4 py-2 disabled:opacity-50">
          {loading ? "Bitte warten…" : "Anmelden"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
