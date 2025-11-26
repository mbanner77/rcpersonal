import { db } from "@/lib/prisma";
import { requireUser, type SessionUser } from "@/lib/auth";

// Type-safe db access helper
const prisma = db as unknown as {
  lifecycleRole: {
    findUnique: (args: { where: { key: string } }) => Promise<{ id: string; key: string } | null>;
    findMany: () => Promise<Array<{ id: string; key: string }>>;
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
    count: () => Promise<number>;
  };
  lifecycleStatus: {
    findUnique: (args: { where: { key: string } }) => Promise<{ id: string } | null>;
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
    count: () => Promise<number>;
  };
  taskTemplate: {
    findFirst: (args: { where: { title: string; type: string } }) => Promise<{ id: string } | null>;
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
    count: () => Promise<number>;
  };
  $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<number>;
};

// Map role keys to legacy enum values
const legacyEnumMap: Record<string, string> = {
  ADMIN: "ADMIN",
  HR: "HR",
  IT: "IT", 
  UNIT_LEAD: "UNIT_LEAD",
  TEAM_LEAD: "TEAM_LEAD",
  PEOPLE_MANAGER: "PEOPLE_MANAGER",
};

// Helper to create template with raw SQL (for legacy enum column)
async function createTemplateRaw(
  title: string,
  description: string,
  type: "ONBOARDING" | "OFFBOARDING",
  ownerRoleId: string,
  roleKey: string,
  relativeDueDays: number
): Promise<void> {
  const id = `c${Date.now()}${Math.random().toString(36).substring(2, 9)}`;
  const legacyOwnerRole = legacyEnumMap[roleKey] ?? "HR";
  await prisma.$executeRawUnsafe(
    `INSERT INTO "TaskTemplate" (id, title, description, type, "ownerRole", "ownerRoleId", "relativeDueDays", active, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4::"TaskType", $5::"LifecycleOwnerRole", $6, $7, true, NOW(), NOW())`,
    id,
    title,
    description,
    type,
    legacyOwnerRole,
    ownerRoleId,
    relativeDueDays
  );
}

function ensureAdmin(user: SessionUser) {
  if (user.role !== "ADMIN") throw new Response("Forbidden", { status: 403 });
}

// Default roles for lifecycle management
const DEFAULT_ROLES = [
  { key: "ADMIN", label: "Admin", description: "Administratoren", type: null, orderIndex: 0 },
  { key: "HR", label: "HR", description: "Human Resources", type: null, orderIndex: 1 },
  { key: "IT", label: "IT", description: "IT-Abteilung", type: null, orderIndex: 2 },
  { key: "UNIT_LEAD", label: "Unit-Leiter", description: "Abteilungsleiter", type: null, orderIndex: 3 },
  { key: "TEAM_LEAD", label: "Team-Leiter", description: "Teamleiter", type: null, orderIndex: 4 },
  { key: "PEOPLE_MANAGER", label: "People Manager", description: "Personalverantwortliche", type: null, orderIndex: 5 },
];

// Default statuses for task tracking
const DEFAULT_STATUSES = [
  { key: "OPEN", label: "Offen", description: "Aufgabe wurde noch nicht begonnen", isDone: false, isDefault: true, type: null, orderIndex: 0 },
  { key: "IN_PROGRESS", label: "In Bearbeitung", description: "Aufgabe wird gerade bearbeitet", isDone: false, isDefault: false, type: null, orderIndex: 1 },
  { key: "BLOCKED", label: "Blockiert", description: "Aufgabe kann nicht fortgesetzt werden", isDone: false, isDefault: false, type: null, orderIndex: 2 },
  { key: "DONE", label: "Erledigt", description: "Aufgabe wurde abgeschlossen", isDone: true, isDefault: false, type: null, orderIndex: 3 },
];

// Sample onboarding templates
const ONBOARDING_TEMPLATES = [
  { title: "Willkommens-E-Mail senden", description: "Sende eine Begrüßungs-E-Mail mit Informationen zum ersten Tag", roleKey: "HR", days: -3 },
  { title: "Arbeitsplatz vorbereiten", description: "Schreibtisch, Stuhl und Monitor bereitstellen", roleKey: "IT", days: -2 },
  { title: "Laptop bereitstellen", description: "Laptop mit Standardsoftware konfigurieren und bereitstellen", roleKey: "IT", days: -1 },
  { title: "Zugangskarten erstellen", description: "Gebäudezugang und Berechtigungen einrichten", roleKey: "HR", days: -1 },
  { title: "E-Mail-Konto einrichten", description: "Firmen-E-Mail und Microsoft 365 Zugang erstellen", roleKey: "IT", days: -1 },
  { title: "Einführung in Unternehmenswerte", description: "Präsentation zu Kultur und Werten", roleKey: "HR", days: 0 },
  { title: "Teamvorstellung", description: "Neue Mitarbeiter dem Team vorstellen", roleKey: "TEAM_LEAD", days: 0 },
  { title: "IT-Einführung", description: "Systeme, VPN, Passwörter und Sicherheitsrichtlinien erklären", roleKey: "IT", days: 0 },
  { title: "HR-Formalitäten", description: "Vertragsunterlagen, Steuerformulare und Benefits erklären", roleKey: "HR", days: 1 },
  { title: "Softwarezugänge einrichten", description: "Jira, Confluence, Slack und weitere Tools konfigurieren", roleKey: "IT", days: 1 },
  { title: "Mentor zuweisen", description: "Erfahrenen Kollegen als Ansprechpartner zuweisen", roleKey: "TEAM_LEAD", days: 1 },
  { title: "30-Tage-Gespräch planen", description: "Feedback-Gespräch nach dem ersten Monat vereinbaren", roleKey: "PEOPLE_MANAGER", days: 7 },
  { title: "Probezeit-Feedback", description: "Bewertung nach Ende der Probezeit", roleKey: "PEOPLE_MANAGER", days: 90 },
];

// Sample offboarding templates
const OFFBOARDING_TEMPLATES = [
  { title: "Kündigungsbestätigung", description: "Schriftliche Bestätigung des Austritts", roleKey: "HR", days: -14 },
  { title: "Übergabeplan erstellen", description: "Dokumentation der Aufgaben und Verantwortlichkeiten", roleKey: "TEAM_LEAD", days: -14 },
  { title: "Arbeitszeugnis vorbereiten", description: "Qualifiziertes Arbeitszeugnis erstellen", roleKey: "HR", days: -7 },
  { title: "Wissenstransfer", description: "Einarbeitung des Nachfolgers oder Dokumentation", roleKey: "TEAM_LEAD", days: -7 },
  { title: "Exit-Gespräch führen", description: "Feedback-Gespräch zum Austritt", roleKey: "HR", days: -3 },
  { title: "Zugänge deaktivieren", description: "E-Mail, VPN und Systemzugänge zum Stichtag sperren", roleKey: "IT", days: 0 },
  { title: "Hardware einsammeln", description: "Laptop, Handy und Zugangskarten zurücknehmen", roleKey: "IT", days: 0 },
  { title: "Abschlussdokumente aushändigen", description: "Zeugnis, Lohnabrechnung und Bescheinigungen übergeben", roleKey: "HR", days: 0 },
  { title: "Accounts löschen", description: "E-Mail-Konto und Benutzerzugänge endgültig entfernen", roleKey: "IT", days: 30 },
];

export async function POST() {
  try {
    const user = await requireUser();
    ensureAdmin(user);

    const results = {
      roles: { created: 0, skipped: 0 },
      statuses: { created: 0, skipped: 0 },
      templates: { created: 0, skipped: 0 },
    };

    // 1. Seed roles
    for (const roleData of DEFAULT_ROLES) {
      try {
        const existing = await prisma.lifecycleRole.findUnique({ where: { key: roleData.key } });
        if (existing) {
          results.roles.skipped++;
          continue;
        }
        await prisma.lifecycleRole.create({ data: roleData });
        results.roles.created++;
      } catch {
        results.roles.skipped++;
      }
    }

    // 2. Seed statuses
    for (const statusData of DEFAULT_STATUSES) {
      try {
        const existing = await prisma.lifecycleStatus.findUnique({ where: { key: statusData.key } });
        if (existing) {
          results.statuses.skipped++;
          continue;
        }
        await prisma.lifecycleStatus.create({ data: statusData });
        results.statuses.created++;
      } catch {
        results.statuses.skipped++;
      }
    }

    // Get role map for templates
    const roles = await prisma.lifecycleRole.findMany();
    const roleMap = new Map(roles.map((r) => [r.key, r.id]));

    // 3. Seed onboarding templates
    for (const tpl of ONBOARDING_TEMPLATES) {
      try {
        const ownerRoleId = roleMap.get(tpl.roleKey);
        if (!ownerRoleId) continue;
        
        const existing = await prisma.taskTemplate.findFirst({
          where: { title: tpl.title, type: "ONBOARDING" },
        });
        if (existing) {
          results.templates.skipped++;
          continue;
        }
        await createTemplateRaw(
          tpl.title,
          tpl.description,
          "ONBOARDING",
          ownerRoleId,
          tpl.roleKey,
          tpl.days
        );
        results.templates.created++;
      } catch {
        results.templates.skipped++;
      }
    }

    // 4. Seed offboarding templates
    for (const tpl of OFFBOARDING_TEMPLATES) {
      try {
        const ownerRoleId = roleMap.get(tpl.roleKey);
        if (!ownerRoleId) continue;
        
        const existing = await prisma.taskTemplate.findFirst({
          where: { title: tpl.title, type: "OFFBOARDING" },
        });
        if (existing) {
          results.templates.skipped++;
          continue;
        }
        await createTemplateRaw(
          tpl.title,
          tpl.description,
          "OFFBOARDING",
          ownerRoleId,
          tpl.roleKey,
          tpl.days
        );
        results.templates.created++;
      } catch {
        results.templates.skipped++;
      }
    }

    return Response.json({
      success: true,
      message: "Seed-Daten wurden erfolgreich erstellt",
      results,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await requireUser();
    ensureAdmin(user);

    // Return current counts
    const [rolesCount, statusesCount, templatesCount] = await Promise.all([
      prisma.lifecycleRole.count(),
      prisma.lifecycleStatus.count(),
      prisma.taskTemplate.count(),
    ]);

    return Response.json({
      roles: rolesCount,
      statuses: statusesCount,
      templates: templatesCount,
      hasData: rolesCount > 0 && statusesCount > 0,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
