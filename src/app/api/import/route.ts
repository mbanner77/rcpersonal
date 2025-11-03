import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { db } from "@/lib/prisma";

type ParsedRow = {
  firstName: string | null;
  lastName: string | null;
  startDate: Date | null;
  birthDate: Date | null;
  email?: string | null;
};

function normalizeHeader(h: unknown): string {
  return String(h ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function normalizeNamePart(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z\s-]/g, "")
    .replace(/\s+/g, ".")
    .replace(/-+/g, ".")
    .replace(/\.+/g, ".")
    .trim();
}

function buildEmail(firstName: string | null, lastName: string | null): string | null {
  const fn = normalizeNamePart(firstName);
  const ln = normalizeNamePart(lastName);
  if (!fn || !ln) return null;
  return `${fn}.${ln}@realcore.de`;
}

function parseDateFlexible(input: unknown): Date | null {
  if (!input) return null;
  const s = String(input).trim();
  // Excel may give ISO-like strings already
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) return new Date(iso);

  // Handle dd.MM.yy or dd.MM.yyyy
  const m = s.match(/^([0-3]?\d)\.([0-1]?\d)\.(\d{2}|\d{4})$/);
  if (!m) return null;
  const [, ddStr, mmStr, yyStr] = m;
  const dd = parseInt(ddStr!, 10);
  const mm = parseInt(mmStr!, 10) - 1;
  let yyyy = parseInt(yyStr!, 10);
  if (yyStr!.length === 2) {
    yyyy = yyyy < 50 ? 2000 + yyyy : 1900 + yyyy;
  }
  const d = new Date(yyyy, mm, dd);
  return Number.isNaN(d.getTime()) ? null : d;
}

// pick helper removed; build creates fully-typed Prisma inputs directly

function parseRow(obj: Record<string, unknown>): ParsedRow {
  const map: Record<string, string> = {};
  for (const k of Object.keys(obj)) map[normalizeHeader(k)] = k;

  const keyA = map["name, vorname"] ?? map["name vorname"];
  const keyLast = map["nachname"] ?? map["name"];
  const keyStart = map["eintrittsdatum"] ?? map["eintritt"] ?? map["startdatum"];
  const keyBirth = map["geburtstag"] ?? map["geburtsdatum"];
  const keyEmail = map["email"] ?? map["e-mail"] ?? map["mail"];

  let firstName: string | null = null;
  let lastName: string | null = null;

  if (keyA && obj[keyA]) {
    const raw = String(obj[keyA]);
    const parts = raw.split(",");
    if (parts.length >= 2) {
      lastName = parts[0]?.trim() || null;
      firstName = parts.slice(1).join(",").trim() || null;
    } else {
      firstName = raw.trim();
    }
  }
  if (keyLast && obj[keyLast]) {
    // Prefer explicit Nachname column if present
    lastName = String(obj[keyLast]).trim() || lastName;
  }

  const startVal = keyStart ? obj[keyStart as string] : undefined;
  const birthVal = keyBirth ? obj[keyBirth as string] : undefined;
  const emailVal = keyEmail ? obj[keyEmail as string] : undefined;
  const startDate = keyStart ? parseDateFlexible(startVal) : null;
  const birthDate = keyBirth ? parseDateFlexible(birthVal) : null;
  const email = keyEmail ? String((emailVal ?? "")).trim() || null : null;

  return { firstName, lastName, startDate, birthDate, email };
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return Response.json({ error: "file is required" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());

    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return Response.json({ error: "No sheet found" }, { status: 400 });
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, {
      raw: false,
      defval: null,
    });

    let created = 0;
    let updated = 0;
    let skippedLocked = 0;

    for (const r of rows) {
      const parsed = parseRow(r);
      const { firstName, lastName, startDate, birthDate, email } = parsed;
      if (!firstName || !lastName || !birthDate) {
        continue; // insufficient data
      }

      // find existing by natural unique
      const existing = await db.employee.findUnique({
        where: { firstName_lastName_birthDate: { firstName, lastName, birthDate } },
      });

      if (!existing) {
        const autoEmail = email ?? buildEmail(firstName, lastName) ?? undefined;
        await db.employee.create({
          data: {
            firstName: firstName!,
            lastName: lastName!,
            startDate: (startDate ?? new Date()),
            birthDate: birthDate!,
            ...(autoEmail !== undefined ? { email: autoEmail } : {}),
          },
        });
        created++;
        continue;
      }

      if (existing.lockAll) {
        skippedLocked++;
        continue;
      }

      const updateData: Partial<{
        firstName: string;
        lastName: string;
        startDate: Date;
        birthDate: Date;
        email: string | null;
      }> = {};
      if (!existing.lockFirstName && firstName && existing.firstName !== firstName) {
        updateData.firstName = firstName;
      }
      if (!existing.lockLastName && lastName && existing.lastName !== lastName) {
        updateData.lastName = lastName;
      }
      if (!existing.lockStartDate && startDate && existing.startDate.getTime() !== startDate.getTime()) {
        updateData.startDate = startDate;
      }
      if (!existing.lockBirthDate && birthDate && existing.birthDate.getTime() !== birthDate.getTime()) {
        updateData.birthDate = birthDate;
      }
      if (!existing.lockEmail) {
        if (email != null && email !== existing.email) {
          updateData.email = email;
        } else if (!existing.email) {
          const auto = buildEmail(firstName, lastName);
          if (auto && auto !== existing.email) updateData.email = auto;
        }
      }

      if (Object.keys(updateData).length > 0) {
        await db.employee.update({
          where: { id: existing.id },
          data: updateData,
        });
        updated++;
      } else {
        skippedLocked++;
      }
    }

    return Response.json({ created, updated, skippedLocked });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
