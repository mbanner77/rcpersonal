import { z } from "zod";
import { db } from "@/lib/prisma";
import { requireUser, hasRole } from "@/lib/auth";

const CreateVehicleSchema = z.object({
  licensePlate: z.string().min(3).max(20),
  brand: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  type: z.enum(["CAR", "VAN", "TRUCK", "MOTORCYCLE", "EBIKE", "OTHER"]).optional(),
  year: z.number().int().min(1990).max(2030).optional(),
  color: z.string().max(50).optional(),
  vin: z.string().max(50).optional(),
  leasingCompany: z.string().max(100).optional(),
  leasingStart: z.string().datetime().optional(),
  leasingEnd: z.string().datetime().optional(),
  leasingMonthly: z.number().positive().optional(),
  fuelType: z.string().max(50).optional(),
  mileage: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

const AssignVehicleSchema = z.object({
  vehicleId: z.string().cuid(),
  employeeId: z.string().cuid(),
  notes: z.string().optional(),
});

const AddCostSchema = z.object({
  vehicleId: z.string().cuid(),
  type: z.enum(["LEASING", "FUEL", "REPAIR", "MAINTENANCE", "INSURANCE", "TAX", "TOLL", "PARKING", "CLEANING", "OTHER"]),
  amount: z.number().positive(),
  date: z.string().datetime(),
  description: z.string().optional(),
  invoiceNo: z.string().optional(),
  mileage: z.number().int().min(0).optional(),
});

const TYPE_LABELS: Record<string, string> = {
  CAR: "PKW",
  VAN: "Transporter",
  TRUCK: "LKW",
  MOTORCYCLE: "Motorrad",
  EBIKE: "E-Bike",
  OTHER: "Sonstiges",
};

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Verfügbar",
  ASSIGNED: "Zugewiesen",
  MAINTENANCE: "Wartung",
  DECOMMISSIONED: "Außer Betrieb",
};

const COST_TYPE_LABELS: Record<string, string> = {
  LEASING: "Leasing",
  FUEL: "Tanken",
  REPAIR: "Reparatur",
  MAINTENANCE: "Wartung",
  INSURANCE: "Versicherung",
  TAX: "Kfz-Steuer",
  TOLL: "Maut",
  PARKING: "Parken",
  CLEANING: "Reinigung",
  OTHER: "Sonstiges",
};

// GET - List vehicles with assignments and costs
export async function GET(req: Request) {
  try {
    await requireUser();

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const vehicles = await db.vehicle.findMany({
      where: includeInactive ? {} : { status: { not: "DECOMMISSIONED" } },
      include: {
        assignments: {
          where: { isActive: true },
          include: {
            employee: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
          },
        },
        costs: {
          orderBy: { date: "desc" },
          take: 5,
        },
        _count: { select: { costs: true } },
      },
      orderBy: { brand: "asc" },
    });

    // Calculate total costs per vehicle
    const vehiclesWithTotals = await Promise.all(
      vehicles.map(async (v) => {
        const costSum = await db.vehicleCost.aggregate({
          where: { vehicleId: v.id },
          _sum: { amount: true },
        });
        return {
          ...v,
          typeLabel: TYPE_LABELS[v.type] ?? v.type,
          statusLabel: STATUS_LABELS[v.status] ?? v.status,
          totalCosts: costSum._sum.amount ?? 0,
          currentAssignment: v.assignments[0] ?? null,
        };
      })
    );

    return Response.json(vehiclesWithTotals);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fehler";
    return Response.json({ error: msg }, { status: 500 });
  }
}

// POST - Create vehicle or assign/add cost
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!hasRole(user, "ADMIN") && !hasRole(user, "HR")) {
      return Response.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await req.json();
    const action = body.action as string;

    // Assign vehicle to employee
    if (action === "assign") {
      const parsed = AssignVehicleSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      // End current assignment if exists
      await db.vehicleAssignment.updateMany({
        where: { vehicleId: parsed.data.vehicleId, isActive: true },
        data: { isActive: false, endDate: new Date() },
      });

      // Create new assignment
      const assignment = await db.vehicleAssignment.create({
        data: {
          vehicleId: parsed.data.vehicleId,
          employeeId: parsed.data.employeeId,
          notes: parsed.data.notes,
        },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true } },
          vehicle: { select: { id: true, licensePlate: true, brand: true, model: true } },
        },
      });

      // Update vehicle status
      await db.vehicle.update({
        where: { id: parsed.data.vehicleId },
        data: { status: "ASSIGNED" },
      });

      return Response.json(assignment);
    }

    // Add cost
    if (action === "cost") {
      const parsed = AddCostSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const cost = await db.vehicleCost.create({
        data: {
          vehicleId: parsed.data.vehicleId,
          type: parsed.data.type,
          amount: parsed.data.amount,
          date: new Date(parsed.data.date),
          description: parsed.data.description,
          invoiceNo: parsed.data.invoiceNo,
          mileage: parsed.data.mileage,
          createdById: user.id,
        },
      });

      // Update vehicle mileage if provided
      if (parsed.data.mileage) {
        await db.vehicle.update({
          where: { id: parsed.data.vehicleId },
          data: { mileage: parsed.data.mileage },
        });
      }

      return Response.json({
        ...cost,
        typeLabel: COST_TYPE_LABELS[cost.type],
      });
    }

    // Create new vehicle
    const parsed = CreateVehicleSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const vehicle = await db.vehicle.create({
      data: {
        licensePlate: parsed.data.licensePlate.toUpperCase(),
        brand: parsed.data.brand,
        model: parsed.data.model,
        type: parsed.data.type ?? "CAR",
        year: parsed.data.year,
        color: parsed.data.color,
        vin: parsed.data.vin,
        leasingCompany: parsed.data.leasingCompany,
        leasingStart: parsed.data.leasingStart ? new Date(parsed.data.leasingStart) : undefined,
        leasingEnd: parsed.data.leasingEnd ? new Date(parsed.data.leasingEnd) : undefined,
        leasingMonthly: parsed.data.leasingMonthly,
        fuelType: parsed.data.fuelType,
        mileage: parsed.data.mileage,
        notes: parsed.data.notes,
      },
    });

    return Response.json({
      ...vehicle,
      typeLabel: TYPE_LABELS[vehicle.type],
      statusLabel: STATUS_LABELS[vehicle.status],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fehler";
    return Response.json({ error: msg }, { status: 500 });
  }
}

// DELETE - Remove vehicle or unassign
export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    if (!hasRole(user, "ADMIN")) {
      return Response.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await req.json();
    const { vehicleId, action } = body;

    if (action === "unassign") {
      await db.vehicleAssignment.updateMany({
        where: { vehicleId, isActive: true },
        data: { isActive: false, endDate: new Date() },
      });
      await db.vehicle.update({
        where: { id: vehicleId },
        data: { status: "AVAILABLE" },
      });
      return Response.json({ success: true });
    }

    // Decommission vehicle (soft delete)
    await db.vehicle.update({
      where: { id: vehicleId },
      data: { status: "DECOMMISSIONED" },
    });

    return Response.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fehler";
    return Response.json({ error: msg }, { status: 500 });
  }
}
