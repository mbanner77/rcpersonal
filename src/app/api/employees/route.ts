import { db } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const user = await requireUser();
  const where = user.role === "UNIT_LEAD" && user.unitId ? { unitId: user.unitId } : {};
  const items = await db.employee.findMany({ where, orderBy: { lastName: "asc" }, include: { unit: true } });
  return Response.json(items);
}

export async function PATCH(req: Request) {
  const user = await requireUser();
  const body = await req.json();
  const id = String(body.id ?? "");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  type Updatable = {
    firstName: string;
    lastName: string;
    email: string | null;
    startDate: Date | string;
    birthDate: Date | string;
    lockAll: boolean;
    lockFirstName: boolean;
    lockLastName: boolean;
    lockStartDate: boolean;
    lockBirthDate: boolean;
    lockEmail: boolean;
    unitId: string | null;
  };
  const data: Partial<Updatable> = {};
  if (Object.prototype.hasOwnProperty.call(body, "firstName")) data.firstName = String(body.firstName);
  if (Object.prototype.hasOwnProperty.call(body, "lastName")) data.lastName = String(body.lastName);
  if (Object.prototype.hasOwnProperty.call(body, "email")) data.email = body.email === null ? null : String(body.email);
  if (Object.prototype.hasOwnProperty.call(body, "startDate")) data.startDate = body.startDate as string | Date;
  if (Object.prototype.hasOwnProperty.call(body, "birthDate")) data.birthDate = body.birthDate as string | Date;
  if (Object.prototype.hasOwnProperty.call(body, "lockAll")) data.lockAll = Boolean(body.lockAll);
  if (Object.prototype.hasOwnProperty.call(body, "lockFirstName")) data.lockFirstName = Boolean(body.lockFirstName);
  if (Object.prototype.hasOwnProperty.call(body, "lockLastName")) data.lockLastName = Boolean(body.lockLastName);
  if (Object.prototype.hasOwnProperty.call(body, "lockStartDate")) data.lockStartDate = Boolean(body.lockStartDate);
  if (Object.prototype.hasOwnProperty.call(body, "lockBirthDate")) data.lockBirthDate = Boolean(body.lockBirthDate);
  if (Object.prototype.hasOwnProperty.call(body, "lockEmail")) data.lockEmail = Boolean(body.lockEmail);
  if (Object.prototype.hasOwnProperty.call(body, "unitId")) {
    const incoming = body.unitId;
    data.unitId = incoming === null || incoming === "" ? null : String(incoming);
  }

  // parse date strings if provided
  if (typeof data.startDate === "string") data.startDate = new Date(data.startDate);
  if (typeof data.birthDate === "string") data.birthDate = new Date(data.birthDate);

  // Generate email if empty and not locked
  function norm(s?: string | null) {
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

  const current = await db.employee.findUnique({ where: { id } });
  if (!current) return Response.json({ error: "not found" }, { status: 404 });
  if (user.role === "UNIT_LEAD" && user.unitId && current.unitId !== user.unitId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const effFirst = (data.firstName ?? current.firstName) as string;
  const effLast = (data.lastName ?? current.lastName) as string;
  const effEmail = (data.email ?? current.email) as string | null;
  const effLockEmail = (data.lockEmail ?? current.lockEmail) as boolean;
  if (!effLockEmail && (!effEmail || effEmail === "")) {
    const fn = norm(effFirst);
    const ln = norm(effLast);
    if (fn && ln) data.email = `${fn}.${ln}@realcore.de`;
  }

  const updated = await db.employee.update({ where: { id }, data, include: { unit: true } });
  return Response.json(updated);
}
