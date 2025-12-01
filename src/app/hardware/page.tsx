"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/hooks/useSession";

type Asset = {
  id: string;
  assetTag?: string;
  name: string;
  description?: string;
  category: string;
  categoryLabel: string;
  serial?: string;
  manufacturer?: string;
  model?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  currentValue?: number;
  warrantyEnd?: string;
  status: string;
  statusLabel: string;
  condition: string;
  conditionLabel: string;
  assignedToEmployee?: { id: string; firstName: string; lastName: string } | null;
  _count?: { transferRequests: number };
};

type Transfer = {
  id: string;
  transferNumber: string;
  type: string;
  typeLabel: string;
  status: string;
  statusLabel: string;
  salePrice?: number;
  requestedAt: string;
  asset: { id: string; name: string; assetTag?: string; category: string; categoryLabel: string; serial?: string };
  employee: { id: string; firstName: string; lastName: string };
  requestedBy: { id: string; email: string; name?: string };
};

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
};

const CATEGORIES = [
  { value: "LAPTOP", label: "Laptop", icon: "💻" },
  { value: "DESKTOP", label: "Desktop-PC", icon: "🖥️" },
  { value: "MONITOR", label: "Monitor", icon: "🖵" },
  { value: "PHONE", label: "Smartphone", icon: "📱" },
  { value: "TABLET", label: "Tablet", icon: "📲" },
  { value: "KEYBOARD", label: "Tastatur", icon: "⌨️" },
  { value: "MOUSE", label: "Maus", icon: "🖱️" },
  { value: "HEADSET", label: "Headset", icon: "🎧" },
  { value: "DOCKING_STATION", label: "Docking Station", icon: "🔌" },
  { value: "PRINTER", label: "Drucker", icon: "🖨️" },
  { value: "CAMERA", label: "Kamera", icon: "📷" },
  { value: "PROJECTOR", label: "Projektor", icon: "📽️" },
  { value: "FURNITURE", label: "Möbel", icon: "🪑" },
  { value: "OTHER", label: "Sonstiges", icon: "📦" },
];

const CONDITIONS = [
  { value: "NEW", label: "Neu" },
  { value: "EXCELLENT", label: "Sehr gut" },
  { value: "GOOD", label: "Gut" },
  { value: "FAIR", label: "Befriedigend" },
  { value: "POOR", label: "Mangelhaft" },
];

const TRANSFER_TYPES = [
  { value: "SALE", label: "Verkauf an Mitarbeiter", icon: "💰" },
  { value: "GIFT", label: "Schenkung", icon: "🎁" },
];

export default function HardwarePage() {
  const { user } = useSession();
  const [activeTab, setActiveTab] = useState<"inventory" | "transfers">("inventory");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showTransfer, setShowTransfer] = useState<Asset | null>(null);
  const [showAssign, setShowAssign] = useState<Asset | null>(null);
  const [showPrintForm, setShowPrintForm] = useState<Transfer | null>(null);

  // Create form
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("LAPTOP");
  const [serial, setSerial] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [condition, setCondition] = useState("GOOD");

  // Transfer form
  const [transferType, setTransferType] = useState("SALE");
  const [transferEmployeeId, setTransferEmployeeId] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [transferReason, setTransferReason] = useState("");

  // Assign form
  const [assignEmployeeId, setAssignEmployeeId] = useState("");

  const isAdmin = user?.role === "ADMIN" || user?.role === "HR";

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [assetsRes, transfersRes, employeesRes] = await Promise.all([
        fetch("/api/assets"),
        fetch("/api/assets?view=transfers"),
        fetch("/api/employees?status=ACTIVE"),
      ]);
      if (assetsRes.ok) setAssets(await assetsRes.json());
      if (transfersRes.ok) setTransfers(await transfersRes.json());
      if (employeesRes.ok) setEmployees(await employeesRes.json());
    } finally {
      setLoading(false);
    }
  }

  function resetCreateForm() {
    setName("");
    setDescription("");
    setCategory("LAPTOP");
    setSerial("");
    setManufacturer("");
    setModel("");
    setPurchaseDate("");
    setPurchasePrice("");
    setCurrentValue("");
    setCondition("GOOD");
  }

  async function createAsset(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          category,
          serial: serial || undefined,
          manufacturer: manufacturer || undefined,
          model: model || undefined,
          purchaseDate: purchaseDate ? new Date(purchaseDate).toISOString() : undefined,
          purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
          currentValue: currentValue ? parseFloat(currentValue) : undefined,
          condition,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        resetCreateForm();
        loadData();
      } else {
        const err = await res.json();
        alert(`Fehler: ${err.error || JSON.stringify(err)}`);
      }
    } catch (err) {
      alert(`Fehler: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`);
    } finally {
      setCreating(false);
    }
  }

  async function assignAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!showAssign || !assignEmployeeId) return;
    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "assign",
        assetId: showAssign.id,
        employeeId: assignEmployeeId,
      }),
    });
    if (res.ok) {
      setShowAssign(null);
      setAssignEmployeeId("");
      loadData();
    }
  }

  async function unassignAsset(assetId: string) {
    if (!confirm("Hardware wirklich freigeben?")) return;
    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unassign", assetId }),
    });
    if (res.ok) loadData();
  }

  async function createTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!showTransfer || !transferEmployeeId) return;
    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "transfer",
        assetId: showTransfer.id,
        employeeId: transferEmployeeId,
        type: transferType,
        salePrice: salePrice ? parseFloat(salePrice) : undefined,
        reason: transferReason || undefined,
      }),
    });
    if (res.ok) {
      setShowTransfer(null);
      setTransferType("SALE");
      setTransferEmployeeId("");
      setSalePrice("");
      setTransferReason("");
      loadData();
    }
  }

  async function approveTransfer(transferId: string) {
    const res = await fetch("/api/assets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", transferId }),
    });
    if (res.ok) loadData();
  }

  async function rejectTransfer(transferId: string) {
    const reason = prompt("Ablehnungsgrund:");
    if (reason === null) return;
    const res = await fetch("/api/assets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", transferId, reason }),
    });
    if (res.ok) loadData();
  }

  async function completeTransfer(transferId: string) {
    if (!confirm("Übertragung als abgeschlossen markieren?")) return;
    const res = await fetch("/api/assets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete", transferId }),
    });
    if (res.ok) loadData();
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "IN_STOCK": return "bg-green-100 text-green-700";
      case "ASSIGNED": return "bg-blue-100 text-blue-700";
      case "TRANSFER_PENDING": return "bg-amber-100 text-amber-700";
      case "SOLD": return "bg-purple-100 text-purple-700";
      case "MAINTENANCE": return "bg-orange-100 text-orange-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getTransferStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "bg-amber-100 text-amber-700";
      case "APPROVED": return "bg-blue-100 text-blue-700";
      case "ACCEPTED": return "bg-cyan-100 text-cyan-700";
      case "COMPLETED": return "bg-green-100 text-green-700";
      case "REJECTED": return "bg-red-100 text-red-700";
      case "CANCELLED": return "bg-gray-100 text-gray-500";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getCategoryIcon = (cat: string) => {
    return CATEGORIES.find((c) => c.value === cat)?.icon || "📦";
  };

  // Stats
  const totalAssets = assets.length;
  const availableAssets = assets.filter((a) => a.status === "IN_STOCK").length;
  const assignedAssets = assets.filter((a) => a.status === "ASSIGNED").length;
  const totalValue = assets.reduce((sum, a) => sum + (Number(a.currentValue) || 0), 0);
  const pendingTransfers = transfers.filter((t) => t.status === "PENDING" || t.status === "APPROVED").length;

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Hardware-Verwaltung</h1>
          <p className="mt-1 text-sm text-zinc-500">Inventar, Zuweisung und Mitarbeiter-Abkauf</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Hardware hinzufügen
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-xs font-medium text-zinc-500">Gesamt</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">{totalAssets}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-xs font-medium text-zinc-500">Verfügbar</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{availableAssets}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-xs font-medium text-zinc-500">Zugewiesen</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">{assignedAssets}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-xs font-medium text-zinc-500">Gesamtwert</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">{totalValue.toLocaleString("de-DE")} €</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-xs font-medium text-zinc-500">Offene Übertragungen</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{pendingTransfers}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-700">
        <button
          onClick={() => setActiveTab("inventory")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === "inventory"
              ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
              : "border-transparent text-zinc-500 hover:text-zinc-700"
          }`}
        >
          📦 Inventar ({assets.length})
        </button>
        <button
          onClick={() => setActiveTab("transfers")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === "transfers"
              ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
              : "border-transparent text-zinc-500 hover:text-zinc-700"
          }`}
        >
          🔄 Übertragungen ({transfers.length})
        </button>
      </div>

      {/* Inventory Tab */}
      {activeTab === "inventory" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getCategoryIcon(asset.category)}</span>
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-white">{asset.name}</p>
                    {asset.assetTag && (
                      <p className="text-xs text-zinc-500">{asset.assetTag}</p>
                    )}
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(asset.status)}`}>
                  {asset.statusLabel}
                </span>
              </div>

              <div className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                {asset.manufacturer && <p>{asset.manufacturer} {asset.model}</p>}
                {asset.serial && <p className="text-xs">S/N: {asset.serial}</p>}
              </div>

              {asset.assignedToEmployee && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 p-2 dark:bg-blue-900/20">
                  <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    {asset.assignedToEmployee.firstName} {asset.assignedToEmployee.lastName}
                  </span>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-700">
                <div className="text-sm">
                  <span className="text-zinc-500">Wert: </span>
                  <span className="font-medium text-zinc-900 dark:text-white">
                    {Number(asset.currentValue || 0).toLocaleString("de-DE")} €
                  </span>
                </div>
                <span className={`rounded px-2 py-0.5 text-xs ${
                  asset.condition === "NEW" || asset.condition === "EXCELLENT" 
                    ? "bg-green-100 text-green-700" 
                    : asset.condition === "GOOD" 
                      ? "bg-blue-100 text-blue-700" 
                      : "bg-amber-100 text-amber-700"
                }`}>
                  {asset.conditionLabel}
                </span>
              </div>

              {isAdmin && (
                <div className="mt-3 flex gap-2">
                  {asset.status === "IN_STOCK" ? (
                    <button
                      onClick={() => setShowAssign(asset)}
                      className="flex-1 rounded-lg bg-blue-100 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-200"
                    >
                      Zuweisen
                    </button>
                  ) : asset.status === "ASSIGNED" ? (
                    <>
                      <button
                        onClick={() => unassignAsset(asset.id)}
                        className="flex-1 rounded-lg bg-gray-100 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                      >
                        Freigeben
                      </button>
                      <button
                        onClick={() => {
                          setShowTransfer(asset);
                          setSalePrice(asset.currentValue?.toString() || "");
                          setTransferEmployeeId(asset.assignedToEmployee?.id || "");
                        }}
                        className="flex-1 rounded-lg bg-purple-100 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-200"
                      >
                        Verkauf/Abkauf
                      </button>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          ))}

          {assets.length === 0 && (
            <div className="col-span-full rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-800">
              <p className="text-zinc-500">Keine Hardware vorhanden</p>
            </div>
          )}
        </div>
      )}

      {/* Transfers Tab */}
      {activeTab === "transfers" && (
        <div className="space-y-3">
          {transfers.map((transfer) => (
            <div
              key={transfer.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{getCategoryIcon(transfer.asset.category)}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-900 dark:text-white">{transfer.transferNumber}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getTransferStatusColor(transfer.status)}`}>
                        {transfer.statusLabel}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {transfer.asset.name} {transfer.asset.assetTag && `(${transfer.asset.assetTag})`}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {transfer.typeLabel} an {transfer.employee.firstName} {transfer.employee.lastName}
                      {transfer.salePrice && ` • ${Number(transfer.salePrice).toLocaleString("de-DE")} €`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {transfer.status === "PENDING" && isAdmin && (
                    <>
                      <button
                        onClick={() => approveTransfer(transfer.id)}
                        className="rounded-lg bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-200"
                      >
                        Genehmigen
                      </button>
                      <button
                        onClick={() => rejectTransfer(transfer.id)}
                        className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200"
                      >
                        Ablehnen
                      </button>
                    </>
                  )}
                  {(transfer.status === "APPROVED" || transfer.status === "ACCEPTED") && isAdmin && (
                    <>
                      <button
                        onClick={() => setShowPrintForm(transfer)}
                        className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300"
                      >
                        📄 Formular
                      </button>
                      <button
                        onClick={() => completeTransfer(transfer.id)}
                        className="rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-200"
                      >
                        Abschließen
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}

          {transfers.length === 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-800">
              <p className="text-zinc-500">Keine Übertragungen vorhanden</p>
            </div>
          )}
        </div>
      )}

      {/* Create Asset Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 dark:bg-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Neue Hardware</h2>
            <form onSubmit={createAsset} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
                    placeholder="z.B. MacBook Pro 14"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Kategorie</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Zustand</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
                  >
                    {CONDITIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Hersteller</label>
                  <input
                    type="text"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
                    placeholder="Apple"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Modell</label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
                    placeholder="M3 Pro"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Seriennummer</label>
                  <input
                    type="text"
                    value={serial}
                    onChange={(e) => setSerial(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Kaufdatum</label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Kaufpreis (€)</label>
                  <input
                    type="number"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    step="0.01"
                    min="0"
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Aktueller Wert (€)</label>
                  <input
                    type="number"
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    step="0.01"
                    min="0"
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Beschreibung</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300">
                  Abbrechen
                </button>
                <button type="submit" disabled={creating} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 disabled:opacity-50">
                  {creating ? "Erstelle..." : "Erstellen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Hardware zuweisen</h2>
            <p className="text-sm text-zinc-500">{showAssign.name}</p>
            <form onSubmit={assignAsset} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Mitarbeiter</label>
                <select
                  value={assignEmployeeId}
                  onChange={(e) => setAssignEmployeeId(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
                >
                  <option value="">-- Auswählen --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.lastName}, {emp.firstName}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowAssign(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300">
                  Abbrechen
                </button>
                <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  Zuweisen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Hardware-Abkauf</h2>
            <p className="text-sm text-zinc-500">{showTransfer.name}</p>
            <form onSubmit={createTransfer} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Art der Übertragung</label>
                <select
                  value={transferType}
                  onChange={(e) => setTransferType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
                >
                  {TRANSFER_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Mitarbeiter</label>
                <select
                  value={transferEmployeeId}
                  onChange={(e) => setTransferEmployeeId(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
                >
                  <option value="">-- Auswählen --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.lastName}, {emp.firstName}</option>
                  ))}
                </select>
              </div>
              {transferType === "SALE" && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Verkaufspreis (€)</label>
                  <input
                    type="number"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    step="0.01"
                    min="0"
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
                  />
                  <p className="mt-1 text-xs text-zinc-500">Aktueller Wert: {Number(showTransfer.currentValue || 0).toLocaleString("de-DE")} €</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Begründung</label>
                <textarea
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
                  placeholder="z.B. Geräte-Upgrade, Altes Gerät"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowTransfer(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300">
                  Abbrechen
                </button>
                <button type="submit" className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700">
                  Antrag stellen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Form Modal */}
      {showPrintForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-8 dark:bg-zinc-800">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Hardware-Überlassungsvertrag</h2>
              <button
                onClick={() => setShowPrintForm(null)}
                className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 print:hidden"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Printable Form Content */}
            <div id="print-form" className="space-y-6 text-sm">
              <div className="text-center border-b pb-4">
                <h3 className="text-lg font-semibold">Hardware-{showPrintForm.typeLabel}svertrag</h3>
                <p className="text-zinc-500">Vorgangsnummer: {showPrintForm.transferNumber}</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">Arbeitgeber</h4>
                  <p>realcore GmbH</p>
                  <p>Musterstraße 123</p>
                  <p>12345 Musterstadt</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Mitarbeiter</h4>
                  <p>{showPrintForm.employee.firstName} {showPrintForm.employee.lastName}</p>
                  <p className="text-zinc-500">Personalnummer: ____________</p>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2">Hardware-Details</h4>
                <table className="w-full text-left">
                  <tbody>
                    <tr><td className="py-1 text-zinc-500 w-1/3">Bezeichnung:</td><td>{showPrintForm.asset.name}</td></tr>
                    <tr><td className="py-1 text-zinc-500">Asset-Tag:</td><td>{showPrintForm.asset.assetTag || "—"}</td></tr>
                    <tr><td className="py-1 text-zinc-500">Seriennummer:</td><td>{showPrintForm.asset.serial || "—"}</td></tr>
                    <tr><td className="py-1 text-zinc-500">Kategorie:</td><td>{showPrintForm.asset.categoryLabel}</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2">Vertragsbedingungen</h4>
                {showPrintForm.type === "SALE" ? (
                  <>
                    <p className="mb-2">Der Arbeitgeber verkauft die oben genannte Hardware an den Mitarbeiter zum Preis von:</p>
                    <p className="text-xl font-bold text-center py-2">{Number(showPrintForm.salePrice || 0).toLocaleString("de-DE")} €</p>
                    <p className="text-xs text-zinc-500 mt-2">
                      Der Kaufpreis wird mit der nächsten Gehaltsabrechnung verrechnet / ist per Überweisung zu begleichen.
                    </p>
                  </>
                ) : (
                  <p>Der Arbeitgeber überlässt die oben genannte Hardware unentgeltlich an den Mitarbeiter.</p>
                )}
              </div>

              <div className="border rounded-lg p-4 text-xs">
                <h4 className="font-semibold mb-2">Hinweise</h4>
                <ul className="list-disc list-inside space-y-1 text-zinc-600">
                  <li>Mit der Übernahme geht das Eigentum an der Hardware auf den Mitarbeiter über.</li>
                  <li>Garantie- und Gewährleistungsansprüche werden nicht übertragen.</li>
                  <li>Der Mitarbeiter übernimmt die Hardware in dem Zustand, in dem sie sich befindet.</li>
                  <li>Der geldwerte Vorteil wird entsprechend den steuerlichen Vorschriften behandelt.</li>
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-8">
                <div>
                  <p className="mb-12">Datum: ____________________</p>
                  <div className="border-t border-zinc-400 pt-2">
                    <p>Unterschrift Arbeitgeber</p>
                  </div>
                </div>
                <div>
                  <p className="mb-12">Datum: ____________________</p>
                  <div className="border-t border-zinc-400 pt-2">
                    <p>Unterschrift Mitarbeiter</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t print:hidden">
              <button
                onClick={() => setShowPrintForm(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300"
              >
                Schließen
              </button>
              <button
                onClick={() => window.print()}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
              >
                🖨️ Drucken
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
