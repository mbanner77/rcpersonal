import { z } from "zod";
import { db } from "@/lib/prisma";
import { requireUser, hasRole } from "@/lib/auth";

const CreateAssetSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.enum(["LAPTOP", "DESKTOP", "MONITOR", "PHONE", "TABLET", "KEYBOARD", "MOUSE", "HEADSET", "DOCKING_STATION", "PRINTER", "CAMERA", "PROJECTOR", "FURNITURE", "OTHER"]).optional(),
  serial: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  purchaseDate: z.string().datetime().optional(),
  purchasePrice: z.number().positive().optional(),
  currentValue: z.number().min(0).optional(),
  warrantyEnd: z.string().datetime().optional(),
  condition: z.enum(["NEW", "EXCELLENT", "GOOD", "FAIR", "POOR"]).optional(),
  notes: z.string().optional(),
});

const AssignAssetSchema = z.object({
  assetId: z.string().cuid(),
  employeeId: z.string().cuid(),
});

const CreateTransferSchema = z.object({
  assetId: z.string().cuid(),
  employeeId: z.string().cuid(),
  type: z.enum(["SALE", "GIFT", "RETURN", "REASSIGNMENT"]),
  salePrice: z.number().min(0).optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

const CATEGORY_LABELS: Record<string, string> = {
  LAPTOP: "Laptop",
  DESKTOP: "Desktop-PC",
  MONITOR: "Monitor",
  PHONE: "Smartphone",
  TABLET: "Tablet",
  KEYBOARD: "Tastatur",
  MOUSE: "Maus",
  HEADSET: "Headset",
  DOCKING_STATION: "Docking Station",
  PRINTER: "Drucker",
  CAMERA: "Kamera",
  PROJECTOR: "Projektor",
  FURNITURE: "Möbel",
  OTHER: "Sonstiges",
};

const STATUS_LABELS: Record<string, string> = {
  IN_STOCK: "Auf Lager",
  ASSIGNED: "Zugewiesen",
  MAINTENANCE: "Wartung",
  TRANSFER_PENDING: "Übertragung ausstehend",
  SOLD: "Verkauft",
  DISPOSED: "Entsorgt",
  LOST: "Verloren",
};

const CONDITION_LABELS: Record<string, string> = {
  NEW: "Neu",
  EXCELLENT: "Sehr gut",
  GOOD: "Gut",
  FAIR: "Befriedigend",
  POOR: "Mangelhaft",
};

const TRANSFER_TYPE_LABELS: Record<string, string> = {
  SALE: "Verkauf",
  GIFT: "Schenkung",
  RETURN: "Rückgabe",
  REASSIGNMENT: "Umzuweisung",
};

const TRANSFER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Ausstehend",
  APPROVED: "Genehmigt",
  ACCEPTED: "Akzeptiert",
  REJECTED: "Abgelehnt",
  CANCELLED: "Storniert",
  COMPLETED: "Abgeschlossen",
};

// Generate asset tag
async function generateAssetTag(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `HW-${year}-`;
  
  const lastAsset = await db.asset.findFirst({
    where: { assetTag: { startsWith: prefix } },
    orderBy: { assetTag: "desc" },
  });

  let nextNum = 1;
  if (lastAsset?.assetTag) {
    const match = lastAsset.assetTag.match(/(\d+)$/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }

  return `${prefix}${nextNum.toString().padStart(4, "0")}`;
}

// Generate transfer number
async function generateTransferNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `TRF-${year}-`;
  
  const lastTransfer = await db.assetTransfer.findFirst({
    where: { transferNumber: { startsWith: prefix } },
    orderBy: { transferNumber: "desc" },
  });

  let nextNum = 1;
  if (lastTransfer?.transferNumber) {
    const match = lastTransfer.transferNumber.match(/(\d+)$/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }

  return `${prefix}${nextNum.toString().padStart(4, "0")}`;
}

// GET - List assets and transfers
export async function GET(req: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(req.url);
    const view = searchParams.get("view"); // "assets", "transfers", "transfer-detail"
    const transferId = searchParams.get("transferId");
    const status = searchParams.get("status");
    const category = searchParams.get("category");

    // Get single transfer detail
    if (view === "transfer-detail" && transferId) {
      const transfer = await db.assetTransfer.findUnique({
        where: { id: transferId },
        include: {
          asset: true,
          employee: { select: { id: true, firstName: true, lastName: true, email: true, jobTitle: true } },
          requestedBy: { select: { id: true, email: true, name: true } },
          approvedBy: { select: { id: true, email: true, name: true } },
          rejectedBy: { select: { id: true, email: true, name: true } },
        },
      });

      if (!transfer) {
        return Response.json({ error: "Transfer nicht gefunden" }, { status: 404 });
      }

      return Response.json({
        ...transfer,
        typeLabel: TRANSFER_TYPE_LABELS[transfer.type] ?? transfer.type,
        statusLabel: TRANSFER_STATUS_LABELS[transfer.status] ?? transfer.status,
        asset: {
          ...transfer.asset,
          categoryLabel: CATEGORY_LABELS[transfer.asset.category] ?? transfer.asset.category,
          conditionLabel: CONDITION_LABELS[transfer.asset.condition] ?? transfer.asset.condition,
        },
      });
    }

    // Get transfers list
    if (view === "transfers") {
      const whereClause: Record<string, unknown> = {};
      if (status) whereClause.status = status;

      const transfers = await db.assetTransfer.findMany({
        where: whereClause,
        include: {
          asset: { select: { id: true, name: true, assetTag: true, category: true, serial: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
          requestedBy: { select: { id: true, email: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return Response.json(transfers.map((t) => ({
        ...t,
        typeLabel: TRANSFER_TYPE_LABELS[t.type] ?? t.type,
        statusLabel: TRANSFER_STATUS_LABELS[t.status] ?? t.status,
        asset: {
          ...t.asset,
          categoryLabel: CATEGORY_LABELS[t.asset.category] ?? t.asset.category,
        },
      })));
    }

    // Default: Get assets list
    const whereClause: Record<string, unknown> = {};
    if (status) whereClause.status = status;
    if (category) whereClause.category = category;

    const assets = await db.asset.findMany({
      where: whereClause,
      include: {
        assignedToEmployee: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { transferRequests: true } },
      },
      orderBy: { name: "asc" },
    });

    return Response.json(assets.map((a) => ({
      ...a,
      categoryLabel: CATEGORY_LABELS[a.category] ?? a.category,
      statusLabel: STATUS_LABELS[a.status] ?? a.status,
      conditionLabel: CONDITION_LABELS[a.condition] ?? a.condition,
    })));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fehler";
    return Response.json({ error: msg }, { status: 500 });
  }
}

// POST - Create asset, assign, or create transfer
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!hasRole(user, "ADMIN") && !hasRole(user, "HR")) {
      return Response.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await req.json();
    const action = body.action as string;

    // Assign asset to employee
    if (action === "assign") {
      const parsed = AssignAssetSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const asset = await db.asset.update({
        where: { id: parsed.data.assetId },
        data: {
          assignedToEmployeeId: parsed.data.employeeId,
          assignedAt: new Date(),
          status: "ASSIGNED",
        },
        include: {
          assignedToEmployee: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      return Response.json({
        ...asset,
        categoryLabel: CATEGORY_LABELS[asset.category],
        statusLabel: STATUS_LABELS[asset.status],
      });
    }

    // Unassign asset
    if (action === "unassign") {
      const { assetId } = body;
      const asset = await db.asset.update({
        where: { id: assetId },
        data: {
          assignedToEmployeeId: null,
          assignedAt: null,
          status: "IN_STOCK",
        },
      });

      return Response.json({
        ...asset,
        categoryLabel: CATEGORY_LABELS[asset.category],
        statusLabel: STATUS_LABELS[asset.status],
      });
    }

    // Create transfer request (sale/gift/return)
    if (action === "transfer") {
      const parsed = CreateTransferSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const asset = await db.asset.findUnique({ where: { id: parsed.data.assetId } });
      if (!asset) {
        return Response.json({ error: "Asset nicht gefunden" }, { status: 404 });
      }

      const transferNumber = await generateTransferNumber();

      const transfer = await db.assetTransfer.create({
        data: {
          transferNumber,
          assetId: parsed.data.assetId,
          employeeId: parsed.data.employeeId,
          type: parsed.data.type,
          originalValue: asset.purchasePrice,
          depreciatedValue: asset.currentValue,
          salePrice: parsed.data.salePrice,
          reason: parsed.data.reason,
          notes: parsed.data.notes,
          requestedById: user.id,
        },
        include: {
          asset: true,
          employee: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // Update asset status
      await db.asset.update({
        where: { id: parsed.data.assetId },
        data: { status: "TRANSFER_PENDING" },
      });

      return Response.json(transfer, { status: 201 });
    }

    // Create new asset
    const parsed = CreateAssetSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const assetTag = await generateAssetTag();

    const asset = await db.asset.create({
      data: {
        assetTag,
        name: parsed.data.name,
        description: parsed.data.description,
        category: parsed.data.category ?? "OTHER",
        serial: parsed.data.serial,
        manufacturer: parsed.data.manufacturer,
        model: parsed.data.model,
        purchaseDate: parsed.data.purchaseDate ? new Date(parsed.data.purchaseDate) : undefined,
        purchasePrice: parsed.data.purchasePrice,
        currentValue: parsed.data.currentValue ?? parsed.data.purchasePrice,
        warrantyEnd: parsed.data.warrantyEnd ? new Date(parsed.data.warrantyEnd) : undefined,
        condition: parsed.data.condition ?? "GOOD",
        notes: parsed.data.notes,
      },
    });

    return Response.json({
      ...asset,
      categoryLabel: CATEGORY_LABELS[asset.category],
      statusLabel: STATUS_LABELS[asset.status],
      conditionLabel: CONDITION_LABELS[asset.condition],
    }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fehler";
    return Response.json({ error: msg }, { status: 500 });
  }
}

// PATCH - Approve/reject transfers, update assets
export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { action, transferId, assetId, ...data } = body;

    // Approve transfer
    if (action === "approve" && transferId) {
      if (!hasRole(user, "ADMIN")) {
        return Response.json({ error: "Nur Admins können genehmigen" }, { status: 403 });
      }

      const transfer = await db.assetTransfer.update({
        where: { id: transferId },
        data: {
          status: "APPROVED",
          approvedById: user.id,
          approvedAt: new Date(),
        },
        include: { asset: true, employee: true },
      });

      return Response.json(transfer);
    }

    // Reject transfer
    if (action === "reject" && transferId) {
      if (!hasRole(user, "ADMIN")) {
        return Response.json({ error: "Nur Admins können ablehnen" }, { status: 403 });
      }

      const transfer = await db.assetTransfer.update({
        where: { id: transferId },
        data: {
          status: "REJECTED",
          rejectedById: user.id,
          rejectedAt: new Date(),
          rejectionReason: data.reason,
        },
      });

      // Reset asset status
      await db.asset.update({
        where: { id: transfer.assetId },
        data: { status: "ASSIGNED" },
      });

      return Response.json(transfer);
    }

    // Employee accepts transfer
    if (action === "accept" && transferId) {
      const transfer = await db.assetTransfer.update({
        where: { id: transferId },
        data: {
          status: "ACCEPTED",
          employeeAccepted: true,
          employeeAcceptedAt: new Date(),
          employeeSignature: data.signature,
        },
      });

      return Response.json(transfer);
    }

    // Complete transfer
    if (action === "complete" && transferId) {
      if (!hasRole(user, "ADMIN")) {
        return Response.json({ error: "Nur Admins können abschließen" }, { status: 403 });
      }

      const transfer = await db.assetTransfer.findUnique({ where: { id: transferId } });
      if (!transfer) {
        return Response.json({ error: "Transfer nicht gefunden" }, { status: 404 });
      }

      // Update transfer status
      const updatedTransfer = await db.assetTransfer.update({
        where: { id: transferId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      // Update asset based on transfer type
      let newStatus = "SOLD";
      if (transfer.type === "GIFT") newStatus = "SOLD";
      if (transfer.type === "RETURN") newStatus = "IN_STOCK";
      if (transfer.type === "REASSIGNMENT") newStatus = "ASSIGNED";

      await db.asset.update({
        where: { id: transfer.assetId },
        data: {
          status: newStatus as "SOLD" | "IN_STOCK" | "ASSIGNED",
          assignedToEmployeeId: transfer.type === "RETURN" ? null : transfer.employeeId,
        },
      });

      return Response.json(updatedTransfer);
    }

    // Update asset
    if (assetId) {
      if (!hasRole(user, "ADMIN") && !hasRole(user, "HR")) {
        return Response.json({ error: "Keine Berechtigung" }, { status: 403 });
      }

      const asset = await db.asset.update({
        where: { id: assetId },
        data: {
          name: data.name,
          description: data.description,
          category: data.category,
          serial: data.serial,
          manufacturer: data.manufacturer,
          model: data.model,
          purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
          purchasePrice: data.purchasePrice,
          currentValue: data.currentValue,
          warrantyEnd: data.warrantyEnd ? new Date(data.warrantyEnd) : undefined,
          condition: data.condition,
          status: data.status,
          notes: data.notes,
        },
      });

      return Response.json({
        ...asset,
        categoryLabel: CATEGORY_LABELS[asset.category],
        statusLabel: STATUS_LABELS[asset.status],
        conditionLabel: CONDITION_LABELS[asset.condition],
      });
    }

    return Response.json({ error: "Action erforderlich" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fehler";
    return Response.json({ error: msg }, { status: 500 });
  }
}

// DELETE - Cancel transfer or delete asset
export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    if (!hasRole(user, "ADMIN")) {
      return Response.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await req.json();
    const { transferId, assetId } = body;

    if (transferId) {
      const transfer = await db.assetTransfer.findUnique({ where: { id: transferId } });
      if (!transfer) {
        return Response.json({ error: "Transfer nicht gefunden" }, { status: 404 });
      }

      await db.assetTransfer.update({
        where: { id: transferId },
        data: { status: "CANCELLED" },
      });

      // Reset asset status
      await db.asset.update({
        where: { id: transfer.assetId },
        data: { status: "ASSIGNED" },
      });

      return Response.json({ success: true });
    }

    if (assetId) {
      await db.asset.delete({ where: { id: assetId } });
      return Response.json({ success: true });
    }

    return Response.json({ error: "ID erforderlich" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fehler";
    return Response.json({ error: msg }, { status: 500 });
  }
}
