"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  startDate: string;
  exitDate: string | null;
};

type Category = {
  id: string;
  key: string;
  label: string;
  orderIndex: number;
};

type Certificate = {
  id: string;
  employeeId: string;
  type: string;
  typeLabel: string;
  title: string | null;
  status: string;
  statusLabel: string;
  issueDate: string;
  employeeName: string;
  jobTitle: string | null;
  startDate: string;
  endDate: string | null;
  fullContent: string | null;
  notes: string | null;
  createdAt: string;
  employee: { id: string; firstName: string; lastName: string; jobTitle: string | null };
  sections: Array<{
    id: string;
    categoryKey: string;
    orderIndex: number;
    content: string;
    rating: number | null;
  }>;
};

const CERTIFICATE_TYPES = [
  { value: "QUALIFIZIERT", label: "Qualifiziertes Zeugnis" },
  { value: "EINFACH", label: "Einfaches Zeugnis" },
  { value: "ZWISCHENZEUGNIS", label: "Zwischenzeugnis" },
  { value: "ENDZEUGNIS", label: "Endzeugnis" },
];

const RATING_OPTIONS = [
  { value: 1, label: "Sehr gut" },
  { value: 2, label: "Gut" },
  { value: 3, label: "Befriedigend" },
  { value: 4, label: "Ausreichend" },
  { value: 5, label: "Mangelhaft" },
];

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700 border-zinc-200",
  REVIEW: "bg-amber-100 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  ISSUED: "bg-blue-100 text-blue-700 border-blue-200",
  ARCHIVED: "bg-zinc-200 text-zinc-600 border-zinc-300",
};

export default function CertificatesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  
  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedType, setSelectedType] = useState("QUALIFIZIERT");
  
  // Generate form state
  const [editingCertificate, setEditingCertificate] = useState<Certificate | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  
  // Preview state
  const [previewCertificate, setPreviewCertificate] = useState<Certificate | null>(null);
  
  // Edit sections state
  const [editingSections, setEditingSections] = useState<Certificate | null>(null);
  const [sectionContents, setSectionContents] = useState<Record<string, string>>({});
  const [savingSections, setSavingSections] = useState(false);
  
  // Seeding state
  const [seeding, setSeeding] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, catRes, certRes] = await Promise.all([
        fetch("/api/employees"),
        fetch("/api/admin/certificates/categories"),
        fetch("/api/certificates"),
      ]);

      if (empRes.ok) {
        const data = await empRes.json();
        setEmployees(Array.isArray(data) ? data : data.data ?? []);
      }
      if (catRes.ok) {
        const data = await catRes.json();
        setCategories(Array.isArray(data) ? data : []);
      }
      if (certRes.ok) {
        const data = await certRes.json();
        setCertificates(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Failed to load data:", e);
      setError("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Create certificate
  const createCertificate = async () => {
    if (!selectedEmployeeId) {
      setError("Bitte wählen Sie einen Mitarbeiter");
      return;
    }
    
    setError(null);
    try {
      const res = await fetch("/api/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedEmployeeId,
          type: selectedType,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fehler beim Erstellen");
      }

      const cert = await res.json();
      setShowCreateForm(false);
      setSelectedEmployeeId("");
      
      // Initialize ratings and open generator
      const initialRatings: Record<string, number> = {};
      categories.forEach(cat => {
        initialRatings[cat.key] = 2; // Default to "Gut"
      });
      setRatings(initialRatings);
      setEditingCertificate(cert);
      
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    }
  };

  // Generate certificate content
  const generateCertificate = async () => {
    if (!editingCertificate) return;
    
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/certificates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certificateId: editingCertificate.id,
          ratings,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fehler beim Generieren");
      }

      const updated = await res.json();
      setPreviewCertificate(updated);
      setEditingCertificate(null);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setGenerating(false);
    }
  };

  // Update certificate status
  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch("/api/certificates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });

      if (!res.ok) {
        throw new Error("Fehler beim Aktualisieren");
      }

      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    }
  };

  // Delete certificate
  const deleteCertificate = async (id: string) => {
    if (!confirm("Zeugnis wirklich löschen?")) return;
    
    try {
      const res = await fetch("/api/certificates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) {
        throw new Error("Fehler beim Löschen");
      }

      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    }
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Text in Zwischenablage kopiert!");
    } catch {
      alert("Kopieren fehlgeschlagen");
    }
  };

  // Download PDF
  const downloadPDF = async (id: string) => {
    try {
      const res = await fetch(`/api/certificates/${id}/pdf`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "PDF-Erstellung fehlgeschlagen");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("content-disposition")?.split("filename=")[1]?.replace(/"/g, "") || "Zeugnis.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF-Download fehlgeschlagen");
    }
  };

  // Open section editor
  const openSectionEditor = (cert: Certificate) => {
    const contents: Record<string, string> = {};
    cert.sections.forEach(s => {
      contents[s.id] = s.content;
    });
    setSectionContents(contents);
    setEditingSections(cert);
  };

  // Save sections
  const saveSections = async () => {
    if (!editingSections) return;
    setSavingSections(true);
    try {
      const sections = Object.entries(sectionContents).map(([id, content]) => ({ id, content }));
      const res = await fetch(`/api/certificates/${editingSections.id}/sections`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections }),
      });
      if (!res.ok) {
        throw new Error("Speichern fehlgeschlagen");
      }
      setEditingSections(null);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setSavingSections(false);
    }
  };

  // Seed standard text blocks
  const seedTextBlocks = async () => {
    if (!confirm("Standard-Textbausteine für deutsche Arbeitszeugnisse erstellen?")) return;
    setSeeding(true);
    try {
      const res = await fetch("/api/admin/certificates/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Fehler");
      }
      alert(data.message);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-zinc-500">Lade Daten...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Arbeitszeugnisse</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Generieren Sie Arbeitszeugnisse basierend auf Standardtextbausteinen
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.length === 0 && (
            <button
              onClick={seedTextBlocks}
              disabled={seeding}
              className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
            >
              {seeding ? "Erstelle..." : "⚡ Standard-Textbausteine laden"}
            </button>
          )}
          <Link
            href="/admin/certificates"
            className="rounded border px-3 py-2 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Textbausteine verwalten
          </Link>
          <button
            onClick={() => setShowCreateForm(true)}
            className="rounded bg-black px-3 py-2 text-xs font-medium text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
          >
            + Neues Zeugnis
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Schließen</button>
        </div>
      )}

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-800">
            <h2 className="text-lg font-semibold mb-4">Neues Zeugnis erstellen</h2>
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium">Mitarbeiter</span>
                <select
                  className="mt-1 w-full rounded border px-3 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-600"
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                >
                  <option value="">Bitte wählen...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.lastName}, {emp.firstName} — {emp.jobTitle ?? "Keine Position"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium">Zeugnistyp</span>
                <select
                  className="mt-1 w-full rounded border px-3 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-600"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                >
                  {CERTIFICATE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowCreateForm(false)}
                className="rounded border px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                Abbrechen
              </button>
              <button
                onClick={createCertificate}
                className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 dark:bg-white dark:text-black"
              >
                Erstellen & Bewertung
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rating/Generate Modal */}
      {editingCertificate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-auto p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-800">
            <h2 className="text-lg font-semibold mb-2">Zeugnis generieren</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Für: <strong>{editingCertificate.employeeName}</strong> — {editingCertificate.typeLabel}
            </p>
            
            <p className="text-sm mb-4">
              Wählen Sie für jede Kategorie eine Bewertung. Die passenden Textbausteine werden automatisch ausgewählt.
            </p>
            
            <div className="space-y-3 mb-6">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between rounded border p-3 dark:border-zinc-700">
                  <span className="font-medium">{cat.label}</span>
                  <select
                    className="rounded border px-3 py-1.5 text-sm dark:bg-zinc-900 dark:border-zinc-600"
                    value={ratings[cat.key] ?? 2}
                    onChange={(e) => setRatings({ ...ratings, [cat.key]: parseInt(e.target.value) })}
                  >
                    {RATING_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            
            {categories.length === 0 && (
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 mb-4 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400">
                Keine Kategorien gefunden. Bitte erstellen Sie zuerst <Link href="/admin/certificates" className="underline">Kategorien und Textbausteine</Link>.
              </div>
            )}
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingCertificate(null)}
                className="rounded border px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                Abbrechen
              </button>
              <button
                onClick={generateCertificate}
                disabled={generating || categories.length === 0}
                className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {generating ? "Generiere..." : "Zeugnis generieren"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section Edit Modal */}
      {editingSections && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-auto p-4">
          <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-800 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Zeugnis bearbeiten</h2>
              <button
                onClick={() => setEditingSections(null)}
                className="text-zinc-500 hover:text-zinc-700"
              >
                ✕
              </button>
            </div>
            
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              <strong>{editingSections.employeeName}</strong> — Bearbeiten Sie die einzelnen Abschnitte
            </p>
            
            <div className="space-y-4 mb-6">
              {editingSections.sections.map((section, idx) => {
                const category = categories.find(c => c.key === section.categoryKey);
                return (
                  <div key={section.id} className="rounded border p-4 dark:border-zinc-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">
                        {idx + 1}. {category?.label || section.categoryKey}
                      </span>
                      {section.rating && (
                        <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700">
                          Note {section.rating}
                        </span>
                      )}
                    </div>
                    <textarea
                      className="w-full rounded border px-3 py-2 text-sm min-h-[120px] font-serif dark:bg-zinc-900 dark:border-zinc-600"
                      value={sectionContents[section.id] || ""}
                      onChange={(e) => setSectionContents({ ...sectionContents, [section.id]: e.target.value })}
                    />
                  </div>
                );
              })}
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingSections(null)}
                className="rounded border px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                Abbrechen
              </button>
              <button
                onClick={saveSections}
                disabled={savingSections}
                className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {savingSections ? "Speichere..." : "Änderungen speichern"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewCertificate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-auto p-4">
          <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-800 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Zeugnis-Vorschau</h2>
              <button
                onClick={() => setPreviewCertificate(null)}
                className="text-zinc-500 hover:text-zinc-700"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              <strong>{previewCertificate.employeeName}</strong> — {previewCertificate.typeLabel}
            </div>
            
            <div className="rounded border p-6 bg-white dark:bg-zinc-900 dark:border-zinc-700 mb-4">
              <pre className="whitespace-pre-wrap font-serif text-base leading-relaxed">
                {previewCertificate.fullContent || "Kein Inhalt generiert"}
              </pre>
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => copyToClipboard(previewCertificate.fullContent || "")}
                className="rounded border px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                📋 Kopieren
              </button>
              <button
                onClick={() => downloadPDF(previewCertificate.id)}
                className="rounded border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700 hover:bg-blue-100"
              >
                📄 PDF herunterladen
              </button>
              <button
                onClick={() => {
                  openSectionEditor(previewCertificate);
                  setPreviewCertificate(null);
                }}
                className="rounded border px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                ✏️ Bearbeiten
              </button>
              <button
                onClick={() => setPreviewCertificate(null)}
                className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 dark:bg-white dark:text-black"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Certificates List */}
      <div className="space-y-3">
        {certificates.length === 0 ? (
          <div className="text-center py-12 rounded border border-zinc-200 bg-white dark:bg-zinc-800 dark:border-zinc-700">
            <div className="text-4xl mb-3">📄</div>
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">Noch keine Zeugnisse erstellt</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 dark:bg-white dark:text-black"
            >
              Erstes Zeugnis erstellen
            </button>
          </div>
        ) : (
          certificates.map((cert) => (
            <div
              key={cert.id}
              className="rounded border border-zinc-200 bg-white p-4 dark:bg-zinc-800 dark:border-zinc-700"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{cert.title || cert.employeeName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[cert.status] ?? STATUS_COLORS.DRAFT}`}>
                      {cert.statusLabel}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                      {cert.typeLabel}
                    </span>
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    <Link href={`/employees/${cert.employeeId}`} className="underline hover:no-underline">
                      {cert.employee.firstName} {cert.employee.lastName}
                    </Link>
                    {" — "}
                    {cert.jobTitle ?? cert.employee.jobTitle ?? "Keine Position"}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    Erstellt: {new Date(cert.createdAt).toLocaleDateString("de-DE")}
                    {cert.fullContent && ` • ${cert.sections.length} Abschnitte`}
                  </div>
                </div>
                <div className="flex gap-2">
                  {cert.fullContent && (
                    <>
                      <button
                        onClick={() => setPreviewCertificate(cert)}
                        className="rounded border px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700"
                      >
                        Vorschau
                      </button>
                      <button
                        onClick={() => downloadPDF(cert.id)}
                        className="rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-100"
                      >
                        PDF
                      </button>
                      <button
                        onClick={() => openSectionEditor(cert)}
                        className="rounded border px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700"
                      >
                        Bearbeiten
                      </button>
                    </>
                  )}
                  {cert.status === "DRAFT" && (
                    <>
                      <button
                        onClick={() => {
                          const initialRatings: Record<string, number> = {};
                          categories.forEach(cat => {
                            const section = cert.sections.find(s => s.categoryKey === cat.key);
                            initialRatings[cat.key] = section?.rating ?? 2;
                          });
                          setRatings(initialRatings);
                          setEditingCertificate(cert);
                        }}
                        className="rounded border px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700"
                      >
                        {cert.fullContent ? "Neu generieren" : "Generieren"}
                      </button>
                      <button
                        onClick={() => updateStatus(cert.id, "REVIEW")}
                        className="rounded bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600"
                      >
                        Zur Prüfung
                      </button>
                    </>
                  )}
                  {cert.status === "REVIEW" && (
                    <button
                      onClick={() => updateStatus(cert.id, "APPROVED")}
                      className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      Genehmigen
                    </button>
                  )}
                  {cert.status === "APPROVED" && (
                    <button
                      onClick={() => updateStatus(cert.id, "ISSUED")}
                      className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      Ausstellen
                    </button>
                  )}
                  <button
                    onClick={() => deleteCertificate(cert.id)}
                    className="rounded border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                  >
                    Löschen
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
