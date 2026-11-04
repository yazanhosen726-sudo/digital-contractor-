// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  autoItemNumbers,
  generateBoqLines,
  liveQuantities,
  orderAfterItemMove,
  orderAfterSectionMove,
  summarizeBoqByUnit,
  validateBoq,
  type BoqLine,
} from "./boq";
import type { CatalogMeasurement, TakeoffItem } from "./takeoff";

const measurement = (candidateId: string, value: number, unit: CatalogMeasurement["unit"], documentId = "doc-1"): CatalogMeasurement => ({
  candidateId, page: 1, text: candidateId, value, unit, documentId, fileName: "plan.pdf",
});

const catalog = [
  measurement("w1", 3.5, "m"),
  measurement("w2", 4, "m"),
  measurement("h1", 2.4, "m"),
  measurement("ceiling", 3, "m"),
  measurement("door", 1, "m", "doc-2"),
];

const takeoff = (overrides: Partial<TakeoffItem> & Pick<TakeoffItem, "id" | "name">): TakeoffItem => ({
  category: null, unit: "m", basis: "calculated", method: "sum", factor: null, manualQuantity: null, notes: null, sources: [], ...overrides,
});

const items: TakeoffItem[] = [
  takeoff({ id: "t-walls", name: "Internal walls", category: "Masonry", sources: [{ documentId: "doc-1", candidateId: "w1", occurrence: 1 }, { documentId: "doc-1", candidateId: "w2", occurrence: 1 }], notes: "Ground floor" }),
  takeoff({ id: "t-slab", name: "Slab area", category: "Concrete Works", unit: "m2", method: "area", sources: [{ documentId: "doc-1", candidateId: "w1", occurrence: 1 }, { documentId: "doc-1", candidateId: "h1", occurrence: 1 }] }),
  takeoff({ id: "t-manual", name: "Allowance for kerbs", category: null, unit: "ea", basis: "manual", method: null, manualQuantity: 6 }),
  takeoff({ id: "t-doors", name: "Doors", category: "Masonry", unit: "ea", method: "count", sources: [{ documentId: "doc-2", candidateId: "door", occurrence: 1 }] }),
];

function toLines(drafts: ReturnType<typeof generateBoqLines>): BoqLine[] {
  return drafts.map((draft, index) => ({ ...draft, id: `line-${index}` }));
}

const liveFor = (takeoffItems: TakeoffItem[]) => liveQuantities(takeoffItems, catalog);

describe("BOQ generation from takeoff", () => {
  const drafts = generateBoqLines(items, catalog);

  it("creates exactly one line per takeoff item and no extra lines", () => {
    expect(drafts).toHaveLength(items.length);
    expect(drafts.map(line => line.takeoffItemId).sort()).toEqual(items.map(item => item.id).sort());
  });

  it("carries the calculated quantity and unit from the takeoff calculation", () => {
    const walls = drafts.find(line => line.takeoffItemId === "t-walls")!;
    expect(walls.quantity).toBe(7.5);
    expect(walls.unit).toBe("m");
    expect(walls.basis).toBe("calculated");
    expect(walls.calculatedQuantity).toBe(7.5);
    const slab = drafts.find(line => line.takeoffItemId === "t-slab")!;
    expect(slab.unit).toBe("m2");
    expect(slab.quantity).toBeCloseTo(8.4, 6);
  });

  it("keeps manual takeoff quantities marked as manual with no calculated value", () => {
    const manual = drafts.find(line => line.takeoffItemId === "t-manual")!;
    expect(manual.basis).toBe("manual");
    expect(manual.quantity).toBe(6);
    expect(manual.calculatedQuantity).toBeNull();
  });

  it("groups by takeoff category and uses General for items with no category", () => {
    expect(drafts.map(line => line.section)).toEqual(["Masonry", "Masonry", "Concrete Works", "General"]);
    expect(drafts.map(line => line.itemNumber)).toEqual(["1.1", "1.2", "2.1", "3.1"]);
  });

  it("does not invent descriptions, notes, or lines for empty categories", () => {
    const walls = drafts.find(line => line.takeoffItemId === "t-walls")!;
    expect(walls.description).toBe("Internal walls");
    expect(walls.notes).toBe("Ground floor");
    expect(drafts.some(line => line.section === "Finishes")).toBe(false);
  });

  it("keeps an item with a calculation error and leaves its quantity empty", () => {
    const broken = takeoff({ id: "t-bad", name: "Bad area", unit: "m2", method: "area", category: "Finishes", sources: [{ documentId: "doc-1", candidateId: "w1", occurrence: 1 }] });
    const line = generateBoqLines([broken], catalog)[0]!;
    expect(line.quantity).toBeNull();
    expect(line.calculatedQuantity).toBeNull();
    const issues = validateBoq(toLines([line]), liveFor([broken]));
    expect(issues.some(issue => issue.severity === "error" && issue.message.includes("cannot be calculated"))).toBe(true);
  });

  it("does not mutate the takeoff records it reads", () => {
    const snapshot = JSON.stringify(items);
    generateBoqLines(items, catalog);
    expect(JSON.stringify(items)).toBe(snapshot);
  });
});

describe("validation warnings", () => {
  const lines = toLines(generateBoqLines(items, catalog));

  it("returns no issues for a clean generated BOQ", () => {
    expect(validateBoq(lines, liveFor(items))).toEqual([]);
  });

  it("flags a missing description, unit, and quantity without fixing them", () => {
    const edited = lines.map(line => line.id === "line-2" ? { ...line, description: "  ", unit: null, quantity: null } : line);
    const messages = validateBoq(edited, liveFor(items)).filter(issue => issue.lineId === "line-2").map(issue => issue.message);
    expect(messages).toEqual(expect.arrayContaining(["Add a description.", "Choose a unit.", "Add a quantity."]));
    expect(edited.find(line => line.id === "line-2")!.description).toBe("  ");
  });

  it("flags negative and non-finite quantities", () => {
    const edited = lines.map(line => line.id === "line-2" ? { ...line, basis: "manual" as const, quantity: -2 } : line);
    expect(validateBoq(edited, liveFor(items)).some(issue => issue.lineId === "line-2" && issue.message.includes("zero or more"))).toBe(true);
  });

  it("flags a calculated line whose unit no longer matches its takeoff item", () => {
    const edited = lines.map(line => line.id === "line-0" ? { ...line, unit: "ft" as const } : line);
    expect(validateBoq(edited, liveFor(items)).some(issue => issue.lineId === "line-0" && issue.severity === "error" && issue.message.includes("does not match"))).toBe(true);
  });

  it("flags a calculated line with no remaining source", () => {
    const orphaned = lines.map(line => line.id === "line-1" ? { ...line, takeoffItemId: null } : line);
    expect(validateBoq(orphaned, liveFor(items)).some(issue => issue.lineId === "line-1" && issue.message.includes("no longer exists"))).toBe(true);
  });

  it("warns when the takeoff has changed since the line was taken", () => {
    const changed = items.map(item => item.id === "t-walls" ? { ...item, sources: [{ documentId: "doc-1", candidateId: "w1", occurrence: 1 }] } : item);
    const issues = validateBoq(lines, liveFor(changed));
    expect(issues).toContainEqual({ lineId: "line-0", severity: "warning", message: "The takeoff has changed since this quantity was taken. Refresh it to update." });
  });

  it("warns on a takeoff item listed twice and on identical manual descriptions", () => {
    const duplicatedTakeoff = [...lines, { ...lines[0]!, id: "line-dup", sortOrder: 9 }];
    expect(validateBoq(duplicatedTakeoff, liveFor(items))).toContainEqual({ lineId: "line-dup", severity: "warning", message: "This takeoff item is already in the BOQ." });

    const manual = { ...lines[3]!, takeoffItemId: null };
    const sameManual = [manual, { ...manual, id: "manual-2", sortOrder: 9, description: " allowance for KERBS" }];
    expect(validateBoq(sameManual, liveFor(items))).toContainEqual({ lineId: "manual-2", severity: "warning", message: "Another line has the same section, description, and unit." });
  });
});

describe("manual versus calculated lines", () => {
  const lines = toLines(generateBoqLines(items, catalog));

  it("summarizes calculated and manual quantities separately per unit", () => {
    const { rows, unquantified } = summarizeBoqByUnit(lines);
    expect(unquantified).toBe(0);
    expect(rows.find(row => row.unit === "m")).toEqual({ unit: "m", lineCount: 1, calculated: 7.5, manual: 0, total: 7.5 });
    expect(rows.find(row => row.unit === "ea")).toEqual({ unit: "ea", lineCount: 2, calculated: 1, manual: 6, total: 7 });
  });

  it("never converts between units and counts unquantified lines separately", () => {
    const withBlank = [...lines, { ...lines[0]!, id: "blank", sortOrder: 9, quantity: null }];
    const { rows, unquantified } = summarizeBoqByUnit(withBlank);
    expect(unquantified).toBe(1);
    expect(rows.map(row => row.unit).sort()).toEqual(["ea", "m", "m2"]);
  });
});

describe("editing order and numbering", () => {
  const lines = toLines(generateBoqLines(items, catalog));

  it("moves a single item up or down and returns null at the edges", () => {
    expect(orderAfterItemMove(lines, "line-1", -1)).toEqual(["line-1", "line-0", "line-2", "line-3"]);
    expect(orderAfterItemMove(lines, "line-3", 1)).toBeNull();
    expect(orderAfterItemMove(lines, "line-0", -1)).toBeNull();
  });

  it("moves a whole section past its neighbour", () => {
    expect(orderAfterSectionMove(lines, "Concrete Works", -1)).toEqual(["line-2", "line-0", "line-1", "line-3"]);
    expect(orderAfterSectionMove(lines, "General", 1)).toBeNull();
  });

  it("renumbers items from the current section and order", () => {
    const reordered = lines.map(line => line.id === "line-3" ? { ...line, sortOrder: -1 } : line);
    const numbers = autoItemNumbers(reordered);
    expect(numbers.get("line-3")).toBe("1.1");
    expect(numbers.get("line-0")).toBe("2.1");
  });
});

describe("takeoff preservation", () => {
  it("leaves the takeoff catalog and items unchanged when lines are edited", () => {
    const snapshot = JSON.stringify({ items, catalog });
    const lines = toLines(generateBoqLines(items, catalog));
    validateBoq(lines.map(line => ({ ...line, quantity: 99 })), liveFor(items));
    summarizeBoqByUnit(lines);
    expect(JSON.stringify({ items, catalog })).toBe(snapshot);
  });
});
