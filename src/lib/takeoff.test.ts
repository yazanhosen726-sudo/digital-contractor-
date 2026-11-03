// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { PdfInspection, TextEvidence } from "./drawings";
import { extractMeasurements, type MeasurementExtraction } from "./measurements";
import { approvedMeasurements, type ReviewEvent } from "./measurement-review";
import {
  calculateQuantity,
  itemQuantity,
  resolveSources,
  summarizeTakeoff,
  type CatalogMeasurement,
  type TakeoffItem,
} from "./takeoff";

function line(texts: string[], y = 700): TextEvidence[] {
  return texts.map((text, i) => ({ text, x: 50 + i * 200, y, width: text.length * 6, height: 10 }));
}

function extractionFor(texts: string[]): MeasurementExtraction {
  const inspection: PdfInspection = {
    version: 1, inspectedAt: "2026-01-01T00:00:00.000Z", pageCount: 1, measurementStatus: "unverified", warnings: [],
    pages: [{ page: 1, textItems: line(texts), vectorOperators: 0, imageOperators: 0, annotationCandidates: [] }],
  };
  return extractMeasurements(inspection, "abc");
}

function approve(candidateId: string): ReviewEvent {
  return { document_id: "doc-1", candidate_id: candidateId, source_checksum: "abc", action: "approved", corrected_value: null, corrected_unit: null, actor_id: "user-1", created_at: "2026-01-01T00:00:01.000Z" };
}

function reject(candidateId: string): ReviewEvent {
  return { ...approve(candidateId), action: "rejected" };
}

function catalogFor(extraction: MeasurementExtraction, events: ReviewEvent[]): CatalogMeasurement[] {
  return approvedMeasurements(extraction, events).map(item => ({ ...item, documentId: "doc-1", fileName: "plan.pdf" }));
}

function item(overrides: Partial<TakeoffItem>): TakeoffItem {
  return { id: "item-1", name: "Item", category: null, unit: "m", basis: "calculated", method: "sum", factor: null, manualQuantity: null, notes: null, sources: [], ...overrides };
}

const refs = (...ids: string[]) => ids.map(candidateId => ({ documentId: "doc-1", candidateId, occurrence: 1 }));

const texts = ["Wall 5000 mm", "Door 900 mm", "Slab 3.5 m", "Beam 4.0 m", "Stair 2.2 m"];
const extraction = extractionFor(texts);
const all = ["p1-m1", "p1-m2", "p1-m3", "p1-m4", "p1-m5"];
const catalog = catalogFor(extraction, all.map(approve));

describe("takeoff calculations", () => {
  it("sums same-unit approved measurements", () => {
    expect(calculateQuantity({ method: "sum", unit: "mm", factor: null }, resolveSources(refs("p1-m1", "p1-m2"), catalog))).toBe(5900);
  });

  it("rejects a sum that mixes units", () => {
    expect(() => calculateQuantity({ method: "sum", unit: "m", factor: null }, resolveSources(refs("p1-m1", "p1-m3"), catalog))).toThrow("different units");
  });

  it("rejects an item unit that does not match the measurements", () => {
    expect(() => calculateQuantity({ method: "sum", unit: "m", factor: null }, resolveSources(refs("p1-m1"), catalog))).toThrow("item unit is m");
  });

  it("multiplies a same-unit sum by an explicit positive factor", () => {
    expect(calculateQuantity({ method: "multiply", unit: "m", factor: 3 }, resolveSources(refs("p1-m3", "p1-m4"), catalog))).toBe(22.5);
  });

  it("rejects a multiplier that is zero or missing", () => {
    expect(() => calculateQuantity({ method: "multiply", unit: "m", factor: 0 }, resolveSources(refs("p1-m3"), catalog))).toThrow("multiplier greater than zero");
    expect(() => calculateQuantity({ method: "multiply", unit: "m", factor: null }, resolveSources(refs("p1-m3"), catalog))).toThrow("multiplier greater than zero");
  });

  it("calculates area from two independent same-unit dimensions", () => {
    expect(calculateQuantity({ method: "area", unit: "m2", factor: null }, resolveSources(refs("p1-m3", "p1-m4"), catalog))).toBe(14);
  });

  it("rejects area with insufficient inputs", () => {
    expect(() => calculateQuantity({ method: "area", unit: "m2", factor: null }, resolveSources(refs("p1-m3"), catalog))).toThrow("exactly 2");
  });

  it("rejects area built from the same measurement twice", () => {
    const sources = [{ documentId: "doc-1", candidateId: "p1-m3", occurrence: 1 }, { documentId: "doc-1", candidateId: "p1-m3", occurrence: 2 }];
    expect(() => calculateQuantity({ method: "area", unit: "m2", factor: null }, resolveSources(sources, catalog))).toThrow("different measurements");
  });

  it("rejects area with mixed units", () => {
    expect(() => calculateQuantity({ method: "area", unit: "m2", factor: null }, resolveSources(refs("p1-m1", "p1-m3"), catalog))).toThrow("different units");
  });

  it("calculates volume from three independent dimensions", () => {
    expect(calculateQuantity({ method: "volume", unit: "m3", factor: null }, resolveSources(refs("p1-m3", "p1-m4", "p1-m5"), catalog))).toBe(30.8);
  });

  it("rejects volume with insufficient inputs", () => {
    expect(() => calculateQuantity({ method: "volume", unit: "m3", factor: null }, resolveSources(refs("p1-m3", "p1-m4"), catalog))).toThrow("exactly 3");
  });

  it("counts explicitly identified measurements in the count unit", () => {
    expect(calculateQuantity({ method: "count", unit: "ea", factor: null }, resolveSources(refs("p1-m1", "p1-m2"), catalog))).toBe(2);
    expect(() => calculateQuantity({ method: "count", unit: "m", factor: null }, resolveSources(refs("p1-m1"), catalog))).toThrow("item unit is m");
  });
});

describe("takeoff traceability and approval", () => {
  it("keeps each source tied to its drawing and measurement", () => {
    expect(resolveSources(refs("p1-m1"), catalog)).toEqual([{ documentId: "doc-1", fileName: "plan.pdf", candidateId: "p1-m1", page: 1, text: "5000 mm", value: 5000, unit: "mm" }]);
  });

  it("excludes pending and rejected measurements from the catalog", () => {
    const mixed = catalogFor(extraction, [approve("p1-m1"), reject("p1-m2")]);
    expect(mixed.map(item => item.candidateId)).toEqual(["p1-m1"]);
  });

  it("refuses an item that references a pending or rejected measurement", () => {
    const pendingOnly = catalogFor(extraction, [approve("p1-m1")]);
    expect(() => resolveSources(refs("p1-m2"), pendingOnly)).toThrow("no longer approved");
    const quantity = itemQuantity(item({ unit: "mm", sources: refs("p1-m1", "p1-m2") }), pendingOnly);
    expect(quantity.ok).toBe(false);
  });

  it("allows the same measurement again only with an explicit occurrence", () => {
    const implicit = [{ documentId: "doc-1", candidateId: "p1-m1", occurrence: 1 }, { documentId: "doc-1", candidateId: "p1-m1", occurrence: 3 }];
    expect(() => resolveSources(implicit, catalog)).toThrow("explicitly");
    const explicit = [...refs("p1-m1"), { documentId: "doc-1", candidateId: "p1-m1", occurrence: 2 }];
    expect(calculateQuantity({ method: "sum", unit: "mm", factor: null }, resolveSources(explicit, catalog))).toBe(10000);
  });

  it("summarizes calculated and manual quantities by category and unit, excluding errors", () => {
    const items: TakeoffItem[] = [
      item({ id: "a", name: "Walls", category: "Walls", unit: "mm", sources: refs("p1-m1") }),
      item({ id: "b", name: "Doors", category: "Walls", unit: "mm", sources: refs("p1-m2") }),
      item({ id: "c", name: "Extra", category: "Walls", unit: "mm", basis: "manual", method: null, manualQuantity: 100, sources: [] }),
      item({ id: "d", name: "Broken", category: "Walls", unit: "mm", sources: refs("p1-m3") }),
    ];
    const { rows, errors } = summarizeTakeoff(items, catalog);
    expect(rows).toEqual([{ category: "Walls", unit: "mm", calculated: 5900, manual: 100, total: 6000, itemCount: 3 }]);
    expect(errors.map(error => error.itemId)).toEqual(["d"]);
  });
});
