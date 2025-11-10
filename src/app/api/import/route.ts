export const runtime = "nodejs";
import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { db } from "@/lib/prisma";

type EmployeeStatus = "ACTIVE" | "EXITED";

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
    const maxBytes = 8 * 1024 * 1024; // 8 MB
    if (typeof file.size === "number" && file.size > maxBytes) {
      return Response.json({ error: `Datei ist zu groß (>${Math.floor(maxBytes/1024/1024)}MB). Bitte Datei aufteilen.` }, { status: 413 });
    }
    const buf = Buffer.from(await file.arrayBuffer());

    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return Response.json({ error: "No sheet found" }, { status: 400 });
    const ref = ws["!ref"];
    if (!ref) return Response.json({ error: "Sheet has no data" }, { status: 400 });
    const range = XLSX.utils.decode_range(ref);
    const headerRow = range.s.r; // assume first row is header
    const totalRows = range.e.r - headerRow; // data rows (excluding header)
    const maxRows = 5000;
    if (totalRows > maxRows) {
      return Response.json({ error: `Zu viele Zeilen (${totalRows}). Maximal ${maxRows} Zeilen pro Upload, bitte Datei aufteilen.` }, { status: 400 });
    }

    let created = 0;
    let updated = 0;
    let skippedLocked = 0;
    let exited = 0;
    let skippedExitLocked = 0;
    let reactivated = 0;

    const allEmployees = await db.employee.findMany({
      select: { id: true, firstName: true, lastName: true, birthDate: true, lockAll: true, status: true },
    });
    const touched = new Set<string>();

    const batchSize = 300; // process in small chunks to reduce memory
    for (let offset = 0; offset < totalRows; offset += batchSize) {
      const endOffset = Math.min(offset + batchSize - 1, totalRows - 1);
      const batchRange = {
        s: { r: headerRow, c: range.s.c }, // include header in each batch so keys are preserved
        e: { r: headerRow + 1 + endOffset, c: range.e.c },
      };
      const batchRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, {
        raw: false,
        defval: null,
        range: batchRange,
      });

      for (const r of batchRows) {
        const parsed = parseRow(r);
        const { firstName, lastName, startDate, birthDate, email } = parsed;
        if (!firstName || !lastName || !birthDate) {
          continue; // insufficient data
        }

        const existing = await db.employee.findUnique({
          where: { firstName_lastName_birthDate: { firstName, lastName, birthDate } },
        });

        if (!existing) {
          const autoEmail = email ?? buildEmail(firstName, lastName) ?? undefined;
          const createdEmployee = await db.employee.create({
            data: {
              firstName: firstName!,
              lastName: lastName!,
              startDate: (startDate ?? new Date()),
              birthDate: birthDate!,
              ...(autoEmail !== undefined ? { email: autoEmail } : {}),
              status: "ACTIVE",
              exitDate: null,
            },
          });
          touched.add(createdEmployee.id);
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
          status: EmployeeStatus;
          exitDate: Date | null;
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

        if (existing.status === "EXITED") {
          updateData.status = "ACTIVE";
          updateData.exitDate = null;
        }

        if (Object.keys(updateData).length > 0) {
          const updatedEmployee = await db.employee.update({
            where: { id: existing.id },
            data: updateData,
          });
          touched.add(updatedEmployee.id);
          updated++;
          if (existing.status === "EXITED" && updateData.status === "ACTIVE") {
            reactivated++;
          }
        } else {
          touched.add(existing.id);
          skippedLocked++;
        }
      }
    }

    const now = new Date();
    for (const employee of allEmployees) {
      if (employee.status === "EXITED") continue;
      if (touched.has(employee.id)) continue;
      if (employee.lockAll) {
        skippedExitLocked++;
        continue;
      }
      await db.employee.update({
        where: { id: employee.id },
        data: { status: "EXITED", exitDate: now },
      });
      exited++;
    }

    await db.employeeImportLog.create({
      data: {
        created,
        updated,
        skippedLocked,
        exited,
        skippedExitLocked,
        reactivated,
      },
    });

    return Response.json({ created, updated, skippedLocked, exited, skippedExitLocked, reactivated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
