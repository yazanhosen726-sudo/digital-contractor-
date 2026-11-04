import type { ApprovedMeasurement, ReviewUnit } from "./measurement-review";

export const TAKEOFF_UNITS = [
  "mm", "cm", "m", "ft", "in",
  "mm2", "cm2", "m2", "ft2", "in2",
  "mm3", "cm3", "m3", "ft3", "in3",
  "ea",
] as const;
export type TakeoffUnit = (typeof TAKEOFF_UNITS)[number];

export const TAKEOFF_METHODS = ["individual", "sum", "count", "multiply", "area", "volume"] as const;
export type TakeoffMethod = (typeof TAKEOFF_METHODS)[number];

export const TAKEOFF_BASES = ["calculated", "manual"] as const;
export type TakeoffBasis = (typeof TAKEOFF_BASES)[number];

export const TAKEOFF_UNIT_LABELS: Record<TakeoffUnit, string> = {
  mm: "mm", cm: "cm", m: "m", ft: "ft", in: "in",
  mm2: "mm²", cm2: "cm²", m2: "m²", ft2: "ft²", in2: "in²",
  mm3: "mm³", cm3: "cm³", m3: "m³", ft3: "ft³", in3: "in³",
  ea: "each",
};

export const TAKEOFF_METHOD_LABELS: Record<TakeoffMethod, string> = {
  individual: "Single measurement",
  sum: "Sum of measurements",
  count: "Count of measurements",
  multiply: "Sum × multiplier",
  area: "Area (width × height)",
  volume: "Volume (length × width × height)",
};

export type CatalogMeasurement = ApprovedMeasurement & { documentId: string; fileName: string };
export type SourceRef = { documentId: string; candidateId: string; occurrence: number };

export type TakeoffItem = {
  id: string;
  name: string;
  category: string | null;
  unit: TakeoffUnit;
  basis: TakeoffBasis;
  method: TakeoffMethod | null;
  factor: number | null;
  manualQuantity: number | null;
  notes: string | null;
  sources: SourceRef[];
};

export type ItemQuantity = { ok: true; value: number; basis: TakeoffBasis } | { ok: false; error: string };

export type SummaryRow = { category: string; unit: TakeoffUnit; calculated: number; manual: number; total: number; itemCount: number };

export const round = (value: number) => Math.round(value * 1e6) / 1e6;
const sourceKey = (ref: { documentId: string; candidateId: string }) => `${ref.documentId}:${ref.candidateId}`;

export function resolveSources(sources: SourceRef[], catalog: CatalogMeasurement[]): CatalogMeasurement[] {
  const occurrences = new Map<string, number[]>();
  for (const ref of sources) {
    const key = sourceKey(ref);
    occurrences.set(key, [...(occurrences.get(key) ?? []), ref.occurrence]);
  }
  for (const list of occurrences.values()) {
    const sorted = [...list].sort((a, b) => a - b);
    if (sorted.some((value, index) => value !== index + 1)) throw new Error("A repeated measurement must be added explicitly. Remove the duplicate and try again.");
  }
  return sources.map(ref => {
    const match = catalog.find(item => item.documentId === ref.documentId && item.candidateId === ref.candidateId);
    if (!match) throw new Error("A measurement in this item is no longer approved. Remove it to continue.");
    return match;
  });
}

function sameUnit(measurements: CatalogMeasurement[]): ReviewUnit {
  const unit = measurements[0]!.unit;
  if (measurements.some(item => item.unit !== unit)) throw new Error("These measurements use different units. Use measurements in one unit for this item.");
  return unit;
}

function requireUnit(actual: string, expected: TakeoffUnit) {
  if (actual !== expected) throw new Error(`These measurements give ${actual}, but the item unit is ${expected}.`);
}

function requireIndependent(measurements: CatalogMeasurement[], count: number, label: string) {
  if (measurements.length !== count) throw new Error(`${label} needs exactly ${count} approved measurements.`);
  if (new Set(measurements.map(sourceKey)).size !== count) throw new Error(`${label} needs ${count} different measurements, not the same one repeated.`);
}

export function calculateQuantity(
  spec: { method: TakeoffMethod; unit: TakeoffUnit; factor: number | null },
  measurements: CatalogMeasurement[],
): number {
  switch (spec.method) {
    case "individual": {
      if (measurements.length !== 1) throw new Error("An individual item needs exactly one approved measurement.");
      requireUnit(measurements[0]!.unit, spec.unit);
      return round(measurements[0]!.value);
    }
    case "sum": {
      if (measurements.length < 1) throw new Error("Add at least one approved measurement.");
      requireUnit(sameUnit(measurements), spec.unit);
      return round(measurements.reduce((total, item) => total + item.value, 0));
    }
    case "count": {
      if (measurements.length < 1) throw new Error("Add at least one approved measurement.");
      requireUnit("ea", spec.unit);
      return measurements.length;
    }
    case "multiply": {
      if (measurements.length < 1) throw new Error("Add at least one approved measurement.");
      if (spec.factor === null || !Number.isFinite(spec.factor) || spec.factor <= 0) throw new Error("Enter a multiplier greater than zero.");
      const unit = sameUnit(measurements);
      requireUnit(unit, spec.unit);
      return round(measurements.reduce((total, item) => total + item.value, 0) * spec.factor);
    }
    case "area": {
      requireIndependent(measurements, 2, "An area");
      const unit = sameUnit(measurements);
      requireUnit(`${unit}2`, spec.unit);
      return round(measurements[0]!.value * measurements[1]!.value);
    }
    case "volume": {
      requireIndependent(measurements, 3, "A volume");
      const unit = sameUnit(measurements);
      requireUnit(`${unit}3`, spec.unit);
      return round(measurements.reduce((total, item) => total * item.value, 1));
    }
  }
}

export function itemQuantity(item: TakeoffItem, catalog: CatalogMeasurement[]): ItemQuantity {
  try {
    if (item.basis === "manual") {
      if (item.manualQuantity === null) throw new Error("Enter a manual quantity.");
      return { ok: true, value: item.manualQuantity, basis: "manual" };
    }
    if (item.method === null) throw new Error("Choose how this quantity is calculated.");
    const measurements = resolveSources(item.sources, catalog);
    return { ok: true, value: calculateQuantity({ method: item.method, unit: item.unit, factor: item.factor }, measurements), basis: "calculated" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "This quantity could not be calculated." };
  }
}

export function describeSource(source: SourceRef, catalog: CatalogMeasurement[]): string {
  const match = catalog.find(item => item.documentId === source.documentId && item.candidateId === source.candidateId);
  if (!match) return "No longer approved";
  const repeat = source.occurrence > 1 ? ` (copy ${source.occurrence})` : "";
  return `${match.fileName} · page ${match.page} · ${match.text}${repeat}`;
}

export function summarizeTakeoff(items: TakeoffItem[], catalog: CatalogMeasurement[]) {
  const groups = new Map<string, SummaryRow>();
  const errors: { itemId: string; name: string; error: string }[] = [];
  for (const item of items) {
    const quantity = itemQuantity(item, catalog);
    if (!quantity.ok) { errors.push({ itemId: item.id, name: item.name, error: quantity.error }); continue; }
    const category = item.category?.trim() || "Uncategorized";
    const key = `${category}\u0000${item.unit}`;
    const row = groups.get(key) ?? { category, unit: item.unit, calculated: 0, manual: 0, total: 0, itemCount: 0 };
    if (quantity.basis === "calculated") row.calculated = round(row.calculated + quantity.value);
    else row.manual = round(row.manual + quantity.value);
    row.total = round(row.calculated + row.manual);
    row.itemCount += 1;
    groups.set(key, row);
  }
  const rows = [...groups.values()].sort((a, b) => a.category.localeCompare(b.category) || a.unit.localeCompare(b.unit));
  return { rows, errors };
}
