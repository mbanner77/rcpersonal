"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/hooks/useSession";

type Qualification = {
  id: string;
  type: string;
  typeLabel: string;
  name: string;
  description?: string;
  validityMonths?: number;
  employeeCount: number;
};

type EmployeeQualification = {
  id: string;
  employeeId: string;
  employee: { id: string; firstName: string; lastName: string; jobTitle?: string; email?: string };
  qualification: { id: string; type: string; name: string };
  typeLabel: string;
  obtainedDate: string;
  expiryDate?: string | null;
  certificateNo?: string;
  issuer?: string;
  isExpired: boolean;
  isExpiringSoon: boolean;
};

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
};

type Location = {
  id: string;
  name: string;
};

const QUALIFICATION_TYPES = [
  { value: "FIRST_AID", label: "Ersthelfer", icon: "🏥", color: "bg-red-100 text-red-700" },
  { value: "FIRE_SAFETY", label: "Brandschutzhelfer", icon: "🔥", color: "bg-orange-100 text-orange-700" },
  { value: "SAFETY_OFFICER", label: "Sicherheitsbeauftragter", icon: "🦺", color: "bg-yellow-100 text-yellow-700" },
  { value: "DATA_PROTECTION", label: "Datenschutzbeauftragter", icon: "🔒", color: "bg-purple-100 text-purple-700" },
  { value: "WORKS_COUNCIL", label: "Betriebsrat", icon: "🤝", color: "bg-blue-100 text-blue-700" },
  { value: "APPRENTICE_TRAINER", label: "Ausbilder", icon: "👨‍🏫", color: "bg-green-100 text-green-700" },
  { value: "FORKLIFT", label: "Staplerführerschein", icon: "🚜", color: "bg-amber-100 text-amber-700" },
  { value: "CRANE", label: "Kranführerschein", icon: "🏗️", color: "bg-slate-100 text-slate-700" },
  { value: "HAZMAT", label: "Gefahrgut", icon: "☢️", color: "bg-rose-100 text-rose-700" },
  { value: "ELECTRICAL", label: "Elektrofachkraft", icon: "⚡", color: "bg-cyan-100 text-cyan-700" },
  { value: "LANGUAGE", label: "Sprachzertifikat", icon: "🌍", color: "bg-indigo-100 text-indigo-700" },
  { value: "IT_CERTIFICATION", label: "IT-Zertifizierung", icon: "💻", color: "bg-violet-100 text-violet-700" },
  { value: "PROJECT_MGMT", label: "Projektmanagement", icon: "📊", color: "bg-teal-100 text-teal-700" },
  { value: "OTHER", label: "Sonstiges", icon: "📋", color: "bg-gray-100 text-gray-700" },
];

// SAP Certification Categories for visual grouping
const SAP_CATEGORIES = [
  { key: "S/4HANA", label: "SAP S/4HANA", icon: "🏢", color: "from-blue-500 to-blue-600", keywords: ["S/4HANA"] },
  { key: "BTP", label: "SAP BTP", icon: "☁️", color: "from-sky-500 to-sky-600", keywords: ["BTP", "Build Low-Code", "Cloud Application Programming"] },
  { key: "ABAP", label: "SAP ABAP", icon: "💻", color: "from-indigo-500 to-indigo-600", keywords: ["ABAP", "NetWeaver"] },
  { key: "Fiori", label: "SAP Fiori/UI5", icon: "🎨", color: "from-purple-500 to-purple-600", keywords: ["Fiori", "SAPUI5"] },
  { key: "Analytics", label: "SAP Analytics", icon: "📊", color: "from-emerald-500 to-emerald-600", keywords: ["Analytics Cloud", "BW/4HANA", "BusinessObjects", "Datasphere"] },
  { key: "HANA", label: "SAP HANA", icon: "🗄️", color: "from-orange-500 to-orange-600", keywords: ["HANA Cloud", "HANA (Edition", "HANA Modeling"] },
  { key: "SuccessFactors", label: "SAP SuccessFactors", icon: "👥", color: "from-pink-500 to-pink-600", keywords: ["SuccessFactors"] },
  { key: "Ariba", label: "SAP Ariba", icon: "🛒", color: "from-amber-500 to-amber-600", keywords: ["Ariba"] },
  { key: "CX", label: "SAP CX", icon: "🎯", color: "from-rose-500 to-rose-600", keywords: ["Sales Cloud", "Service Cloud", "Commerce Cloud", "Marketing Cloud", "Customer Data", "Emarsys"] },
  { key: "SCM", label: "SAP SCM/Logistik", icon: "🚚", color: "from-teal-500 to-teal-600", keywords: ["Warehouse Management", "Transportation", "IBP", "Digital Manufacturing"] },
  { key: "Other", label: "Weitere SAP", icon: "⚙️", color: "from-slate-500 to-slate-600", keywords: ["Concur", "Fieldglass", "Signavio", "Solution Manager", "Activate", "Security"] },
];

export default function QualificationsPage() {
  const { user } = useSession();
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [employeeQuals, setEmployeeQuals] = useState<EmployeeQualification[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [showExpiring, setShowExpiring] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [selectedSapCategory, setSelectedSapCategory] = useState<string | null>(null);
  const [showSapSection, setShowSapSection] = useState(true);

  // Assign form
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [assignQualId, setAssignQualId] = useState("");
  const [assignObtainedDate, setAssignObtainedDate] = useState(new Date().toISOString().split("T")[0]);
  const [assignCertNo, setAssignCertNo] = useState("");
  const [assignIssuer, setAssignIssuer] = useState("");

  const isAdmin = user?.role === "ADMIN" || user?.role === "HR";

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedType) {
      loadTypeEmployees(selectedType);
    }
  }, [selectedType]);

  async function loadData() {
    try {
      const [qualsRes, empsRes, locsRes] = await Promise.all([
        fetch("/api/qualifications"),
        fetch("/api/employees?status=ACTIVE"),
        fetch("/api/admin/locations"),
      ]);
      if (qualsRes.ok) setQualifications(await qualsRes.json());
      if (empsRes.ok) setEmployees(await empsRes.json());
      if (locsRes.ok) {
        const data = await locsRes.json();
        setLocations(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadTypeEmployees(type: string) {
    const res = await fetch(`/api/qualifications?type=${type}`);
    if (res.ok) setEmployeeQuals(await res.json());
  }

  async function assignQualification(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/qualifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "assign",
        employeeId: assignEmployeeId,
        qualificationId: assignQualId,
        obtainedDate: new Date(assignObtainedDate).toISOString(),
        certificateNo: assignCertNo || undefined,
        issuer: assignIssuer || undefined,
      }),
    });
    if (res.ok) {
      setShowAssign(false);
      setAssignEmployeeId("");
      setAssignQualId("");
      setAssignCertNo("");
      setAssignIssuer("");
      loadData();
      if (selectedType) loadTypeEmployees(selectedType);
    }
  }

  async function removeQualification(id: string) {
    if (!confirm("Qualifikation wirklich entfernen?")) return;
    const res = await fetch("/api/qualifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok && selectedType) {
      loadTypeEmployees(selectedType);
      loadData();
    }
  }

  // Get expiring qualifications (next 90 days)
  const expiringQuals = employeeQuals.filter((eq) => eq.isExpiringSoon && !eq.isExpired);
  const expiredQuals = employeeQuals.filter((eq) => eq.isExpired);

  // Filter first aiders by location
  const filteredEmployeeQuals = selectedLocation === "all"
    ? employeeQuals
    : employeeQuals; // Would need location data on employee to filter

  const getTypeInfo = (type: string) => QUALIFICATION_TYPES.find((t) => t.value === type) || QUALIFICATION_TYPES[QUALIFICATION_TYPES.length - 1];

  // Stats
  const totalFirstAiders = qualifications.find((q) => q.type === "FIRST_AID")?.employeeCount || 0;
  const totalFireSafety = qualifications.find((q) => q.type === "FIRE_SAFETY")?.employeeCount || 0;

  // SAP Qualifications - filter IT certs that contain "SAP"
  const sapQualifications = qualifications.filter(q => 
    q.type === "IT_CERTIFICATION" && q.name.toLowerCase().includes("sap")
  );
  const totalSapCertifications = sapQualifications.reduce((sum, q) => sum + q.employeeCount, 0);

  // Group SAP qualifications by category
  const getSapCategory = (name: string) => {
    for (const cat of SAP_CATEGORIES) {
      if (cat.keywords.some(kw => name.includes(kw))) {
        return cat.key;
      }
    }
    return "Other";
  };

  const sapByCategory = SAP_CATEGORIES.map(cat => {
    const certs = sapQualifications.filter(q => getSapCategory(q.name) === cat.key);
    const totalCount = certs.reduce((sum, c) => sum + c.employeeCount, 0);
    return { ...cat, certs, totalCount, certCount: certs.length };
  }).filter(cat => cat.certCount > 0);

  // Get SAP certs for selected category
  const selectedSapCerts = selectedSapCategory 
    ? sapQualifications.filter(q => getSapCategory(q.name) === selectedSapCategory)
    : [];

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
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Qualifikationen</h1>
          <p className="mt-1 text-sm text-zinc-500">Ersthelfer, Brandschutz und weitere Zertifizierungen</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowExpiring(!showExpiring)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
              showExpiring
                ? "bg-amber-100 text-amber-700"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Ablaufend ({expiringQuals.length + expiredQuals.length})
          </button>
          {isAdmin && qualifications.length === 0 && (
            <button
              onClick={async () => {
                const res = await fetch("/api/qualifications/seed", { method: "POST" });
                if (res.ok) loadData();
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-200"
            >
              Standardtypen laden
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowAssign(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Zuweisen
            </button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏥</span>
            <div>
              <p className="text-xs font-medium text-red-600 dark:text-red-400">Ersthelfer</p>
              <p className="text-2xl font-bold text-red-700 dark:text-red-300">{totalFirstAiders}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-900/20">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔥</span>
            <div>
              <p className="text-xs font-medium text-orange-600 dark:text-orange-400">Brandschutzhelfer</p>
              <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{totalFireSafety}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 dark:border-blue-800 dark:from-blue-900/20 dark:to-indigo-900/20">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔷</span>
            <div>
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400">SAP Zertifikate</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{totalSapCertifications}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⏰</span>
            <div>
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Läuft bald ab</p>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{expiringQuals.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-900/20">
          <div className="flex items-center gap-2">
            <span className="text-2xl">❌</span>
            <div>
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">Abgelaufen</p>
              <p className="text-2xl font-bold text-rose-700 dark:text-rose-300">{expiredQuals.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* SAP Certifications Dashboard */}
      {showSapSection && sapQualifications.length > 0 && (
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 p-6 dark:border-blue-800 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-violet-900/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-2xl text-white shadow-lg">
                🔷
              </div>
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">SAP Zertifizierungen</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {totalSapCertifications} Zertifikate in {sapByCategory.length} Kategorien
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSapSection(false)}
              className="rounded-lg p-2 text-zinc-400 hover:bg-white/50 hover:text-zinc-600 dark:hover:bg-zinc-700"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* SAP Category Cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sapByCategory.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setSelectedSapCategory(selectedSapCategory === cat.key ? null : cat.key)}
                className={`group relative overflow-hidden rounded-xl p-4 text-left transition-all duration-200 ${
                  selectedSapCategory === cat.key
                    ? "bg-gradient-to-br " + cat.color + " text-white shadow-lg scale-[1.02]"
                    : "bg-white hover:shadow-md dark:bg-zinc-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{cat.icon}</span>
                  <div className={`rounded-full px-2.5 py-1 text-sm font-bold ${
                    selectedSapCategory === cat.key
                      ? "bg-white/20 text-white"
                      : "bg-gradient-to-r " + cat.color + " text-white"
                  }`}>
                    {cat.totalCount}
                  </div>
                </div>
                <p className={`mt-2 font-semibold ${selectedSapCategory === cat.key ? "text-white" : "text-zinc-900 dark:text-white"}`}>
                  {cat.label}
                </p>
                <p className={`text-xs ${selectedSapCategory === cat.key ? "text-white/80" : "text-zinc-500"}`}>
                  {cat.certCount} Zertifikat{cat.certCount !== 1 ? "e" : ""}
                </p>
              </button>
            ))}
          </div>

          {/* Selected SAP Category Details */}
          {selectedSapCategory && selectedSapCerts.length > 0 && (
            <div className="mt-4 rounded-xl bg-white p-4 dark:bg-zinc-800">
              <h3 className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white mb-3">
                <span>{SAP_CATEGORIES.find(c => c.key === selectedSapCategory)?.icon}</span>
                {SAP_CATEGORIES.find(c => c.key === selectedSapCategory)?.label} Zertifikate
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {selectedSapCerts.map((cert) => (
                  <div
                    key={cert.id}
                    onClick={() => {
                      setSelectedType("IT_CERTIFICATION");
                      // Load employees with this specific qualification
                    }}
                    className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 p-3 cursor-pointer hover:border-blue-200 hover:bg-blue-50 dark:border-zinc-700 dark:bg-zinc-700/50 dark:hover:border-blue-600 dark:hover:bg-blue-900/20"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-zinc-900 dark:text-white truncate">
                        {cert.name.replace("SAP Certified Associate - ", "").replace("SAP Certified ", "")}
                      </p>
                    </div>
                    <span className="ml-2 flex-shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                      {cert.employeeCount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Show SAP section button when hidden */}
      {!showSapSection && sapQualifications.length > 0 && (
        <button
          onClick={() => setShowSapSection(true)}
          className="w-full rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-4 text-center text-blue-600 hover:border-blue-300 hover:bg-blue-50 dark:border-blue-800 dark:bg-blue-900/10 dark:text-blue-400"
        >
          <span className="text-xl mr-2">🔷</span>
          SAP Zertifizierungen anzeigen ({totalSapCertifications})
        </button>
      )}

      {/* Expiring Warnings */}
      {showExpiring && (expiringQuals.length > 0 || expiredQuals.length > 0) && (
        <div className="space-y-4">
          {expiredQuals.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <h3 className="flex items-center gap-2 font-semibold text-red-700 dark:text-red-300">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Abgelaufene Qualifikationen ({expiredQuals.length})
              </h3>
              <div className="mt-3 space-y-2">
                {expiredQuals.map((eq) => (
                  <div key={eq.id} className="flex items-center justify-between rounded-lg bg-white p-3 dark:bg-zinc-800">
                    <div>
                      <p className="font-medium">{eq.employee.firstName} {eq.employee.lastName}</p>
                      <p className="text-sm text-zinc-500">{eq.qualification.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-red-600">Abgelaufen</p>
                      <p className="text-xs text-zinc-500">{eq.expiryDate ? new Date(eq.expiryDate).toLocaleDateString("de-DE") : "-"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {expiringQuals.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
              <h3 className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-300">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Läuft in 90 Tagen ab ({expiringQuals.length})
              </h3>
              <div className="mt-3 space-y-2">
                {expiringQuals.map((eq) => (
                  <div key={eq.id} className="flex items-center justify-between rounded-lg bg-white p-3 dark:bg-zinc-800">
                    <div>
                      <p className="font-medium">{eq.employee.firstName} {eq.employee.lastName}</p>
                      <p className="text-sm text-zinc-500">{eq.qualification.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-amber-600">Läuft ab</p>
                      <p className="text-xs text-zinc-500">{eq.expiryDate ? new Date(eq.expiryDate).toLocaleDateString("de-DE") : "-"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Qualification Types Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {QUALIFICATION_TYPES.map((type) => {
          const qual = qualifications.find((q) => q.type === type.value);
          const count = qual?.employeeCount || 0;
          const isSelected = selectedType === type.value;

          return (
            <button
              key={type.value}
              onClick={() => setSelectedType(isSelected ? null : type.value)}
              className={`rounded-xl border p-4 text-left transition ${
                isSelected
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                  : "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">{type.icon}</span>
                <span className={`rounded-full px-2 py-0.5 text-lg font-bold ${isSelected ? "bg-white/20" : type.color}`}>
                  {count}
                </span>
              </div>
              <p className="mt-2 font-medium">{type.label}</p>
            </button>
          );
        })}
      </div>

      {/* Selected Type Employee List */}
      {selectedType && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-white">
              <span>{getTypeInfo(selectedType).icon}</span>
              {getTypeInfo(selectedType).label}
            </h2>
            {selectedType === "FIRST_AID" && locations.length > 0 && (
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700"
              >
                <option value="all">Alle Standorte</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="mt-4">
            {filteredEmployeeQuals.length === 0 ? (
              <p className="text-center text-zinc-500 py-8">Keine Mitarbeiter mit dieser Qualifikation</p>
            ) : (
              <div className="space-y-2">
                {filteredEmployeeQuals.map((eq) => (
                  <div
                    key={eq.id}
                    className={`flex items-center justify-between rounded-lg border p-3 ${
                      eq.isExpired
                        ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                        : eq.isExpiringSoon
                        ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
                        : "border-zinc-100 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-700/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-700 dark:bg-zinc-600 dark:text-zinc-200">
                        {eq.employee.firstName.charAt(0)}{eq.employee.lastName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-white">
                          {eq.employee.firstName} {eq.employee.lastName}
                        </p>
                        <p className="text-sm text-zinc-500">{eq.employee.jobTitle || eq.employee.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm">
                        <p className="text-zinc-500">Erworben: {new Date(eq.obtainedDate).toLocaleDateString("de-DE")}</p>
                        {eq.expiryDate && (
                          <p className={eq.isExpired ? "text-red-600 font-medium" : eq.isExpiringSoon ? "text-amber-600 font-medium" : "text-zinc-500"}>
                            {eq.isExpired ? "Abgelaufen: " : "Gültig bis: "}
                            {new Date(eq.expiryDate).toLocaleDateString("de-DE")}
                          </p>
                        )}
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => removeQualification(eq.id)}
                          className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-red-600 dark:hover:bg-zinc-600"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Qualifikation zuweisen</h2>
            <form onSubmit={assignQualification} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Mitarbeiter *</label>
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
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Qualifikation *</label>
                <select
                  value={assignQualId}
                  onChange={(e) => setAssignQualId(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
                >
                  <option value="">-- Auswählen --</option>
                  {qualifications.map((q) => (
                    <option key={q.id} value={q.id}>{getTypeInfo(q.type).icon} {q.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Erworben am *</label>
                <input
                  type="date"
                  value={assignObtainedDate}
                  onChange={(e) => setAssignObtainedDate(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Zertifikat-Nr.</label>
                  <input
                    type="text"
                    value={assignCertNo}
                    onChange={(e) => setAssignCertNo(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Aussteller</label>
                  <input
                    type="text"
                    value={assignIssuer}
                    onChange={(e) => setAssignIssuer(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
                    placeholder="z.B. DRK"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowAssign(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700">
                  Abbrechen
                </button>
                <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900">
                  Zuweisen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
