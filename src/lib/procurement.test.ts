// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  autoLineNumbers,
  buildSchedule,
  computeEstimateTotals,
  computeLineTotal,
  deriveStatus,
  generateEstimateLines,
  generateProcurementDrafts,
  matchPriceCatalog,
  sortEstimateLines,
  summarizeDeliveries,
  upcomingDeliveries,
  validateDeliveryQuantity,
  type Delivery,
  type EstimateLine,
  type PriceCatalogEntry,
  type ProcurementItem,
} from "./procurement";
import type { BoqLine } from "./boq";
import { round } from "./takeoff";

function boqLine(overrides: Partial<BoqLine> & Pick<BoqLine, "id">): BoqLine {
  return {
    sortOrder: 0, takeoffItemId: null, itemNumber: "1.1", section: "General",
    category: null, description: "Test", unit: "m", quantity: 10, basis: "calculated",
    notes: null, calculatedQuantity: 10, ...overrides,
  };
}

function item(overrides: Partial<ProcurementItem> & Pick<ProcurementItem, "id">): ProcurementItem {
  return {
    boqItemId: null, materialName: "Cement", description: null,
    requiredQuantity: 100, unit: "bag", boqReference: "1.1", phase: null,
    requiredDate: null, priority: "medium", status: "required", notes: null,
    sortOrder: 0, ...overrides,
  };
}

function delivery(overrides: Partial<Delivery> & Pick<Delivery, "id" | "procurementItemId">): Delivery {
  return {
    plannedDate: "2026-11-10", deliveryQuantity: 50, status: "planned",
    notes: null, sortOrder: 0, ...overrides,
  };
}

function priceEntry(overrides: Partial<PriceCatalogEntry> & Pick<PriceCatalogEntry, "id">): PriceCatalogEntry {
  return {
    material: "Cement", unit: "bag", estimatedPrice: 8, currency: "USD",
    priceDate: "2026-11-01", sourceRef: null, notes: null, ...overrides,
  };
}

function estimateLine(overrides: Partial<EstimateLine> & Pick<EstimateLine, "id">): EstimateLine {
  return {
    procurementItemId: null, lineNumber: "1", materialName: "Cement",
    description: null, specifications: null, quantity: 100, unit: "bag",
    estimatedUnitPrice: 8, lineTotal: 800, sortOrder: 0, ...overrides,
  };
}

describe("Phase 1: procurement requirement generation from BOQ", () => {
  const lines = [
    boqLine({ id: "bl-1", description: "Cement bags", quantity: 100, unit: "bag", itemNumber: "1.1", category: "Concrete Works", notes: "OPC 42.5" }),
    boqLine({ id: "bl-2", description: "Steel bars", quantity: 250, unit: "m", itemNumber: "1.2", category: "Reinforcement" }),
    boqLine({ id: "bl-3", description: "Empty line", quantity: 0, unit: "ea", itemNumber: "2.1" }),
    boqLine({ id: "bl-4", description: "No unit line", quantity: 50, unit: null, itemNumber: "2.2" }),
    boqLine({ id: "bl-5", description: "No quantity line", quantity: null, unit: "m", itemNumber: "2.3" }),
  ];
  const drafts = generateProcurementDrafts(lines);

  it("creates a draft only for BOQ lines with a positive quantity and a unit", () => {
    expect(drafts).toHaveLength(2);
    expect(drafts.map(d => d.materialName)).toEqual(["Cement bags", "Steel bars"]);
  });

  it("transfers the quantity and unit from the BOQ line", () => {
    expect(drafts[0]!.requiredQuantity).toBe(100);
    expect(drafts[0]!.unit).toBe("bag");
    expect(drafts[1]!.requiredQuantity).toBe(250);
    expect(drafts[1]!.unit).toBe("m");
  });

  it("preserves the BOQ source reference and traceability", () => {
    expect(drafts[0]!.boqItemId).toBe("bl-1");
    expect(drafts[0]!.boqReference).toBe("1.1");
    expect(drafts[1]!.boqItemId).toBe("bl-2");
  });

  it("copies the category as the construction phase and notes as description", () => {
    expect(drafts[0]!.phase).toBe("Concrete Works");
    expect(drafts[0]!.description).toBe("OPC 42.5");
  });

  it("defaults priority to medium and status to required", () => {
    expect(drafts.every(d => d.priority === "medium")).toBe(true);
    expect(drafts.every(d => d.status === "required")).toBe(true);
  });

  it("does not mutate the BOQ lines", () => {
    const snapshot = JSON.stringify(lines);
    generateProcurementDrafts(lines);
    expect(JSON.stringify(lines)).toBe(snapshot);
  });
});

describe("Phase 2: delivery scheduling and remaining quantities", () => {
  const it1 = item({ id: "pi-1", requiredQuantity: 100 });
  const deliveries = [
    delivery({ id: "d-1", procurementItemId: "pi-1", deliveryQuantity: 30, status: "delivered", sortOrder: 0 }),
    delivery({ id: "d-2", procurementItemId: "pi-1", deliveryQuantity: 50, status: "planned", sortOrder: 1 }),
    delivery({ id: "d-3", procurementItemId: "pi-1", deliveryQuantity: 10, status: "cancelled", sortOrder: 2 }),
  ];

  it("tracks purchased, pending, and remaining quantities, excluding cancelled deliveries", () => {
    const summary = summarizeDeliveries(it1, deliveries);
    expect(summary.totalDelivered).toBe(30);
    expect(summary.totalScheduled).toBe(50);
    expect(summary.totalActive).toBe(80);
    expect(summary.remaining).toBe(20);
    expect(summary.percentScheduled).toBe(80);
  });

  it("warns when a new delivery exceeds the remaining requirement", () => {
    const warning = validateDeliveryQuantity(it1, deliveries, 30);
    expect(warning).not.toBeNull();
    expect(warning!.severity).toBe("warning");
    expect(warning!.message).toContain("exceeds the remaining");
  });

  it("allows a delivery that fits within the remaining quantity", () => {
    const warning = validateDeliveryQuantity(it1, deliveries, 20);
    expect(warning).toBeNull();
  });

  it("rejects negative or invalid delivery quantities", () => {
    expect(validateDeliveryQuantity(it1, [], -5)?.severity).toBe("error");
    expect(validateDeliveryQuantity(it1, [], Number.NaN)?.severity).toBe("error");
  });

  it("derives the procurement status from deliveries", () => {
    expect(deriveStatus(it1, [])).toBe("required");
    expect(deriveStatus(it1, [delivery({ id: "d", procurementItemId: "pi-1", deliveryQuantity: 50, status: "planned" })])).toBe("scheduled");
    expect(deriveStatus(it1, [delivery({ id: "d", procurementItemId: "pi-1", deliveryQuantity: 30, status: "delivered" })])).toBe("partially_purchased");
    expect(deriveStatus(it1, [delivery({ id: "d", procurementItemId: "pi-1", deliveryQuantity: 100, status: "delivered" })])).toBe("purchased");
  });

  it("lists upcoming deliveries within a date window", () => {
    const futureItem = item({ id: "pi-up", requiredQuantity: 50 });
    const pastItem = item({ id: "pi-past", requiredQuantity: 50 });
    const upcoming = upcomingDeliveries(
      [futureItem, pastItem],
      [
        delivery({ id: "d-up", procurementItemId: "pi-up", plannedDate: "2026-11-05", status: "planned" }),
        delivery({ id: "d-past", procurementItemId: "pi-past", plannedDate: "2026-10-01", status: "planned" }),
      ],
      30,
      new Date("2026-11-01"),
    );
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0]!.item.id).toBe("pi-up");
  });
});

describe("Phase 3: average price estimation", () => {
  const it1 = item({ id: "pi-1", materialName: "Cement", unit: "bag", requiredQuantity: 100 });
  const catalog = [
    priceEntry({ id: "pc-1", material: "Cement", unit: "bag", estimatedPrice: 8 }),
    priceEntry({ id: "pc-2", material: "Steel bars", unit: "m", estimatedPrice: 5 }),
  ];

  it("matches a price catalog entry by material name and unit", () => {
    const match = matchPriceCatalog(it1, catalog);
    expect(match).not.toBeNull();
    expect(match!.estimatedPrice).toBe(8);
  });

  it("returns null when no matching material and unit exist", () => {
    const match = matchPriceCatalog(item({ id: "x", materialName: "Gravel", unit: "m3" }), catalog);
    expect(match).toBeNull();
  });

  it("computes a line total from quantity and estimated unit price", () => {
    expect(computeLineTotal(100, 8)).toBe(800);
    expect(computeLineTotal(0, 8)).toBe(0);
  });

  it("generates estimate lines with prices from the catalog, leaving zero when no price exists", () => {
    const lines = generateEstimateLines([it1, item({ id: "pi-2", materialName: "Gravel", unit: "m3", requiredQuantity: 20 })], catalog, "USD");
    expect(lines).toHaveLength(2);
    expect(lines[0]!.estimatedUnitPrice).toBe(8);
    expect(lines[0]!.lineTotal).toBe(800);
    expect(lines[1]!.estimatedUnitPrice).toBe(0);
    expect(lines[1]!.lineTotal).toBe(0);
  });

  it("does not use a price when the currency does not match", () => {
    const eurCatalog = [priceEntry({ id: "pc-eur", material: "Cement", unit: "bag", estimatedPrice: 7, currency: "EUR" })];
    const lines = generateEstimateLines([it1], eurCatalog, "USD");
    expect(lines[0]!.estimatedUnitPrice).toBe(0);
  });
});

describe("Phase 4: purchase estimate totals, editing, and reordering", () => {
  const lines = [
    estimateLine({ id: "el-1", lineTotal: 800, sortOrder: 0 }),
    estimateLine({ id: "el-2", lineTotal: 1200, sortOrder: 1 }),
    estimateLine({ id: "el-3", lineTotal: 500, sortOrder: 2 }),
  ];

  it("computes subtotal and grand total with transport, tax, and discount", () => {
    const totals = computeEstimateTotals(lines, { transportCost: 100, taxAmount: 200, discountAmount: 50 });
    expect(totals.subtotal).toBe(2500);
    expect(totals.grandTotal).toBe(2750);
  });

  it("never goes below zero on the grand total", () => {
    const totals = computeEstimateTotals(lines, { transportCost: 0, taxAmount: 0, discountAmount: 9999 });
    expect(totals.grandTotal).toBe(0);
  });

  it("sorts lines by sort order", () => {
    const shuffled = [...lines].reverse();
    const sorted = sortEstimateLines(shuffled);
    expect(sorted.map(l => l.id)).toEqual(["el-1", "el-2", "el-3"]);
  });

  it("renumbers lines from the current order", () => {
    const reordered = [
      estimateLine({ id: "el-3", lineTotal: 500, sortOrder: 0 }),
      estimateLine({ id: "el-1", lineTotal: 800, sortOrder: 1 }),
      estimateLine({ id: "el-2", lineTotal: 1200, sortOrder: 2 }),
    ];
    const numbers = autoLineNumbers(reordered);
    expect(numbers.get("el-3")).toBe("1");
    expect(numbers.get("el-1")).toBe("2");
    expect(numbers.get("el-2")).toBe("3");
  });
});

describe("Phase 2 schedule overview", () => {
  const items = [
    item({ id: "pi-1", materialName: "Cement", unit: "bag", requiredQuantity: 100, phase: "Foundations" }),
    item({ id: "pi-2", materialName: "Steel", unit: "m", requiredQuantity: 50, phase: "Structure" }),
  ];
  const deliveries = [
    delivery({ id: "d-1", procurementItemId: "pi-1", deliveryQuantity: 40, status: "planned" }),
    delivery({ id: "d-2", procurementItemId: "pi-2", deliveryQuantity: 50, status: "delivered" }),
  ];
  const catalog = [priceEntry({ id: "pc-1", material: "Cement", unit: "bag", estimatedPrice: 8 })];

  it("groups deliveries by item and computes per-item summaries", () => {
    const rows = buildSchedule(items, deliveries, catalog);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.summary.remaining).toBe(60);
    expect(rows[1]!.summary.remaining).toBe(0);
    expect(rows[1]!.summary.totalDelivered).toBe(50);
  });

  it("flags items without a catalog price", () => {
    const rows = buildSchedule(items, deliveries, catalog);
    expect(rows[0]!.hasPrice).toBe(true);
    expect(rows[0]!.estimatedTotal).toBe(800);
    expect(rows[1]!.hasPrice).toBe(false);
    expect(rows[1]!.estimatedTotal).toBeNull();
  });
});

describe("rounding helper", () => {
  it("rounds to 6 decimal places", () => {
    expect(round(1.123456789)).toBe(1.123457);
    expect(round(0)).toBe(0);
  });
});
