"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/hooks/useSession";

type TicketCategory = {
  id: string;
  key: string;
  label: string;
  description?: string;
  icon?: string;
  color?: string;
  isActive: boolean;
  sortOrder: number;
  _count: { tickets: number };
};

type QualificationCategory = {
  id: string;
  key: string;
  label: string;
  description?: string;
  icon?: string;
  color?: string;
  isCompanyWide: boolean;
  defaultValidityMonths?: number | null;
  isActive: boolean;
  sortOrder: number;
  _count: { qualifications: number };
};

const COLORS = [
  { value: "gray", label: "Grau", bg: "bg-gray-100", text: "text-gray-700" },
  { value: "red", label: "Rot", bg: "bg-red-100", text: "text-red-700" },
  { value: "orange", label: "Orange", bg: "bg-orange-100", text: "text-orange-700" },
  { value: "amber", label: "Amber", bg: "bg-amber-100", text: "text-amber-700" },
  { value: "yellow", label: "Gelb", bg: "bg-yellow-100", text: "text-yellow-700" },
  { value: "green", label: "Grün", bg: "bg-green-100", text: "text-green-700" },
  { value: "emerald", label: "Smaragd", bg: "bg-emerald-100", text: "text-emerald-700" },
  { value: "teal", label: "Teal", bg: "bg-teal-100", text: "text-teal-700" },
  { value: "cyan", label: "Cyan", bg: "bg-cyan-100", text: "text-cyan-700" },
  { value: "blue", label: "Blau", bg: "bg-blue-100", text: "text-blue-700" },
  { value: "indigo", label: "Indigo", bg: "bg-indigo-100", text: "text-indigo-700" },
  { value: "violet", label: "Violett", bg: "bg-violet-100", text: "text-violet-700" },
  { value: "purple", label: "Lila", bg: "bg-purple-100", text: "text-purple-700" },
  { value: "rose", label: "Rose", bg: "bg-rose-100", text: "text-rose-700" },
  { value: "slate", label: "Schiefer", bg: "bg-slate-100", text: "text-slate-700" },
];

const ICONS = ["💰", "💵", "🏠", "🏦", "📋", "🏖️", "🏥", "👋", "📜", "📌", "🔥", "🦺", "🔒", "🤝", "👨‍🏫", "🚜", "🏗️", "☢️", "⚡", "🌍", "💻", "📊", "✅", "❌", "⭐", "🎯", "📁", "🎓", "🔧", "💼"];

export default function CategoriesPage() {
  const { user } = useSession();
  const [activeTab, setActiveTab] = useState<"ticket" | "qualification">("ticket");
  const [ticketCategories, setTicketCategories] = useState<TicketCategory[]>([]);
  const [qualificationCategories, setQualificationCategories] = useState<QualificationCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<TicketCategory | QualificationCategory | null>(null);

  // Form state
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("📋");
  const [color, setColor] = useState("gray");
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [isCompanyWide, setIsCompanyWide] = useState(false);
  const [defaultValidityMonths, setDefaultValidityMonths] = useState<string>("");

  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      const [ticketRes, qualRes] = await Promise.all([
        fetch("/api/admin/categories?type=ticket"),
        fetch("/api/admin/categories?type=qualification"),
      ]);
      if (ticketRes.ok) setTicketCategories(await ticketRes.json());
      if (qualRes.ok) setQualificationCategories(await qualRes.json());
    } finally {
      setLoading(false);
    }
  }

  async function seedCategories(type: "ticket" | "qualification") {
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, action: "seed" }),
    });
    if (res.ok) {
      loadCategories();
    }
  }

  function resetForm() {
    setKey("");
    setLabel("");
    setDescription("");
    setIcon("📋");
    setColor("gray");
    setIsActive(true);
    setSortOrder(0);
    setIsCompanyWide(false);
    setDefaultValidityMonths("");
  }

  function openEdit(item: TicketCategory | QualificationCategory) {
    setEditItem(item);
    setKey(item.key);
    setLabel(item.label);
    setDescription(item.description || "");
    setIcon(item.icon || "📋");
    setColor(item.color || "gray");
    setIsActive(item.isActive);
    setSortOrder(item.sortOrder);
    if ("isCompanyWide" in item) {
      setIsCompanyWide(item.isCompanyWide);
      setDefaultValidityMonths(item.defaultValidityMonths?.toString() || "");
    }
    setShowCreate(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const data: Record<string, unknown> = {
      type: activeTab,
      key: key.toUpperCase().replace(/[^A-Z_]/g, "_"),
      label,
      description: description || undefined,
      icon,
      color,
      isActive,
      sortOrder,
    };

    if (activeTab === "qualification") {
      data.isCompanyWide = isCompanyWide;
      data.defaultValidityMonths = defaultValidityMonths ? parseInt(defaultValidityMonths) : null;
    }

    if (editItem) {
      data.id = editItem.id;
    }

    const res = await fetch("/api/admin/categories", {
      method: editItem ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      setShowCreate(false);
      setEditItem(null);
      resetForm();
      loadCategories();
    } else {
      const err = await res.json();
      alert(err.error || "Fehler beim Speichern");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Kategorie wirklich löschen?")) return;
    
    const res = await fetch("/api/admin/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: activeTab, id }),
    });

    if (res.ok) {
      loadCategories();
    } else {
      const err = await res.json();
      alert(err.error || "Fehler beim Löschen");
    }
  }

  async function toggleActive(id: string, currentState: boolean) {
    const res = await fetch("/api/admin/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: activeTab, id, isActive: !currentState }),
    });
    if (res.ok) loadCategories();
  }

  const getColorClasses = (colorName: string) => {
    const c = COLORS.find((col) => col.value === colorName);
    return c ? `${c.bg} ${c.text}` : "bg-gray-100 text-gray-700";
  };

  const currentCategories = activeTab === "ticket" ? ticketCategories : qualificationCategories;

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-red-700">Nur Administratoren können Kategorien verwalten.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Kategorien verwalten</h1>
          <p className="mt-1 text-sm text-zinc-500">HR-Ticket-Kategorien und Qualifikationstypen pflegen</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditItem(null);
            setShowCreate(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neue Kategorie
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-700">
        <button
          onClick={() => setActiveTab("ticket")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === "ticket"
              ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          🎫 HR-Ticket-Kategorien ({ticketCategories.length})
        </button>
        <button
          onClick={() => setActiveTab("qualification")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === "qualification"
              ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          🏅 Qualifikationstypen ({qualificationCategories.length})
        </button>
      </div>

      {/* Seed Button */}
      {currentCategories.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-amber-700 dark:text-amber-300">
            Keine Kategorien vorhanden. Möchten Sie die Standard-Kategorien laden?
          </p>
          <button
            onClick={() => seedCategories(activeTab)}
            className="mt-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Standard-Kategorien laden
          </button>
        </div>
      )}

      {/* Categories List */}
      <div className="space-y-2">
        {currentCategories.map((cat) => (
          <div
            key={cat.id}
            className={`flex items-center justify-between rounded-xl border p-4 ${
              cat.isActive
                ? "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
                : "border-zinc-100 bg-zinc-50 opacity-60 dark:border-zinc-800 dark:bg-zinc-900"
            }`}
          >
            <div className="flex items-center gap-4">
              <span className="text-2xl">{cat.icon || "📋"}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-900 dark:text-white">{cat.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getColorClasses(cat.color || "gray")}`}>
                    {cat.key}
                  </span>
                  {"isCompanyWide" in cat && cat.isCompanyWide && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      Pflicht
                    </span>
                  )}
                  {!cat.isActive && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      Inaktiv
                    </span>
                  )}
                </div>
                <p className="text-sm text-zinc-500">
                  {cat.description || "Keine Beschreibung"}
                  {"defaultValidityMonths" in cat && cat.defaultValidityMonths && (
                    <span className="ml-2">• Gültigkeit: {cat.defaultValidityMonths} Monate</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-500 dark:bg-zinc-700">
                {"tickets" in cat._count ? cat._count.tickets : cat._count.qualifications} verwendet
              </span>
              <button
                onClick={() => toggleActive(cat.id, cat.isActive)}
                className={`rounded-lg p-2 ${
                  cat.isActive
                    ? "text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                    : "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                }`}
                title={cat.isActive ? "Deaktivieren" : "Aktivieren"}
              >
                {cat.isActive ? (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => openEdit(cat)}
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => handleDelete(cat.id)}
                className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                disabled={("tickets" in cat._count ? cat._count.tickets : cat._count.qualifications) > 0}
                title={("tickets" in cat._count ? cat._count.tickets : cat._count.qualifications) > 0 ? "Wird verwendet - kann nicht gelöscht werden" : "Löschen"}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 dark:bg-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {editItem ? "Kategorie bearbeiten" : "Neue Kategorie"}
            </h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Key *</label>
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z_]/g, "_"))}
                    required
                    disabled={!!editItem}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono uppercase disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-700"
                    placeholder="BONUS"
                  />
                  <p className="mt-1 text-xs text-zinc-400">Nur Großbuchstaben und _</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Label *</label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
                    placeholder="Bonusabrechnung"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Beschreibung</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Icon</label>
                  <div className="mt-1 flex flex-wrap gap-1 rounded-lg border border-zinc-300 p-2 dark:border-zinc-600">
                    {ICONS.map((ic) => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setIcon(ic)}
                        className={`rounded p-1 text-lg ${icon === ic ? "bg-zinc-200 dark:bg-zinc-600" : "hover:bg-zinc-100 dark:hover:bg-zinc-700"}`}
                      >
                        {ic}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Farbe</label>
                  <div className="mt-1 flex flex-wrap gap-1 rounded-lg border border-zinc-300 p-2 dark:border-zinc-600">
                    {COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setColor(c.value)}
                        className={`rounded px-2 py-1 text-xs ${c.bg} ${c.text} ${color === c.value ? "ring-2 ring-zinc-900 dark:ring-white" : ""}`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Sortierung</label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  <label htmlFor="isActive" className="text-sm text-zinc-700 dark:text-zinc-300">
                    Aktiv
                  </label>
                </div>
              </div>

              {activeTab === "qualification" && (
                <div className="grid grid-cols-2 gap-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isCompanyWide"
                      checked={isCompanyWide}
                      onChange={(e) => setIsCompanyWide(e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-300"
                    />
                    <label htmlFor="isCompanyWide" className="text-sm text-zinc-700 dark:text-zinc-300">
                      Unternehmenspflicht
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Standard-Gültigkeit (Monate)</label>
                    <input
                      type="number"
                      value={defaultValidityMonths}
                      onChange={(e) => setDefaultValidityMonths(e.target.value)}
                      min="1"
                      max="120"
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
                      placeholder="Leer = unbegrenzt"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    setEditItem(null);
                    resetForm();
                  }}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
                >
                  {editItem ? "Speichern" : "Erstellen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
