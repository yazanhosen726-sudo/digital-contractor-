import { itemQuantity, round, type CatalogMeasurement, type ItemQuantity, type TakeoffBasis, type TakeoffItem, type TakeoffUnit } from "./takeoff";

export const UNSORTED_SECTION = "General";

export type BoqLine = {
  id: string;
  sortOrder: number;
  takeoffItemId: string | null;
  itemNumber: string;
  section: string;
  category: string | null;
  description: string | null;
  unit: TakeoffUnit | null;
  quantity: number | null;
  calculatedQuantity: number | null;
  basis: TakeoffBasis;
  notes: string | null;
};

export type BoqLineDraft = Omit<BoqLine, "id">;

export type LiveQuantity = { unit: TakeoffUnit; quantity: ItemQuantity };

export type BoqIssue = { lineId: string; severity: "error" | "warning"; message: string };

export type BoqUnitSummary = { unit: TakeoffUnit; lineCount: number; calculated: number; manual: number; total: number };

export function liveQuantities(items: TakeoffItem[], catalog: CatalogMeasurement[]): Map<string, LiveQuantity> {
  return new Map(items.map(item => [item.id, { unit: item.unit, quantity: itemQuantity(item, catalog) }]));
}

export function sortLines(lines: BoqLine[]): BoqLine[] {
  return [...lines].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function groupBySection(lines: BoqLine[]): { section: string; lines: BoqLine[] }[] {
  const groups = new Map<string, BoqLine[]>();
  for (const line of sortLines(lines)) groups.set(line.section, [...(groups.get(line.section) ?? []), line]);
  return [...groups].map(([section, sectionLines]) => ({ section, lines: sectionLines }));
}

export function generateBoqLines(items: TakeoffItem[], catalog: CatalogMeasurement[]): BoqLineDraft[] {
  const sections = new Map<string, TakeoffItem[]>();
  for (const item of items) {
    const section = item.category?.trim() || UNSORTED_SECTION;
    sections.set(section, [...(sections.get(section) ?? []), item]);
  }
  const drafts: BoqLineDraft[] = [];
  let sectionNumber = 0;
  for (const [section, sectionItems] of sections) {
    sectionNumber += 1;
    sectionItems.forEach((item, index) => {
      const quantity = itemQuantity(item, catalog);
      const value = quantity.ok ? quantity.value : null;
      drafts.push({
        sortOrder: drafts.length,
        takeoffItemId: item.id,
        itemNumber: `${sectionNumber}.${index + 1}`,
        section,
        category: item.category?.trim() || null,
        description: item.name,
        unit: item.unit,
        quantity: value,
        calculatedQuantity: item.basis === "calculated" ? value : null,
        basis: item.basis,
        notes: item.notes,
      });
    });
  }
  return drafts;
}

export function autoItemNumbers(lines: BoqLine[]): Map<string, string> {
  const numbers = new Map<string, string>();
  groupBySection(lines).forEach((group, sectionIndex) => {
    group.lines.forEach((line, index) => numbers.set(line.id, `${sectionIndex + 1}.${index + 1}`));
  });
  return numbers;
}

export function orderAfterItemMove(lines: BoqLine[], lineId: string, direction: -1 | 1): string[] | null {
  const ids = sortLines(lines).map(line => line.id);
  const index = ids.indexOf(lineId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ids.length) return null;
  [ids[index], ids[target]] = [ids[target]!, ids[index]!];
  return ids;
}

export function orderAfterSectionMove(lines: BoqLine[], section: string, direction: -1 | 1): string[] | null {
  const groups = groupBySection(lines);
  const index = groups.findIndex(group => group.section === section);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= groups.length) return null;
  [groups[index], groups[target]] = [groups[target]!, groups[index]!];
  return groups.flatMap(group => group.lines.map(line => line.id));
}

const normalise = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");

export function validateBoq(lines: BoqLine[], live: Map<string, LiveQuantity>): BoqIssue[] {
  const issues: BoqIssue[] = [];
  const takeoffSeen = new Set<string>();
  const descriptionSeen = new Set<string>();
  for (const line of sortLines(lines)) {
    const add = (severity: BoqIssue["severity"], message: string) => issues.push({ lineId: line.id, severity, message });
    const current = line.basis === "calculated" && line.takeoffItemId ? live.get(line.takeoffItemId) : undefined;

    if (!line.description?.trim()) add("error", "Add a description.");
    if (line.unit === null) add("error", "Choose a unit.");

    if (line.basis === "calculated") {
      if (!current) add("error", "The takeoff item this quantity came from no longer exists. Replace the quantity manually or remove the line.");
      else {
        if (line.unit !== null && line.unit !== current.unit) add("error", `The unit (${line.unit}) does not match the takeoff unit (${current.unit}).`);
        if (!current.quantity.ok) add("error", `The takeoff quantity cannot be calculated: ${current.quantity.error}`);
        else if (line.calculatedQuantity !== current.quantity.value) add("warning", "The takeoff has changed since this quantity was taken. Refresh it to update.");
      }
    }

    if (line.quantity === null) {
      if (line.basis === "manual" || current?.quantity.ok) add("error", "Add a quantity.");
    } else if (!Number.isFinite(line.quantity) || line.quantity < 0) {
      add("error", "The quantity must be zero or more.");
    }

    if (line.takeoffItemId) {
      if (takeoffSeen.has(line.takeoffItemId)) add("warning", "This takeoff item is already in the BOQ.");
      takeoffSeen.add(line.takeoffItemId);
    } else if (line.description?.trim()) {
      const key = `${normalise(line.section)}|${normalise(line.description)}|${line.unit ?? ""}`;
      if (descriptionSeen.has(key)) add("warning", "Another line has the same section, description, and unit.");
      descriptionSeen.add(key);
    }
  }
  return issues;
}

export function summarizeBoqByUnit(lines: BoqLine[]): { rows: BoqUnitSummary[]; unquantified: number } {
  const rows = new Map<TakeoffUnit, BoqUnitSummary>();
  let unquantified = 0;
  for (const line of lines) {
    if (line.quantity === null || line.unit === null) { unquantified += 1; continue; }
    const row = rows.get(line.unit) ?? { unit: line.unit, lineCount: 0, calculated: 0, manual: 0, total: 0 };
    if (line.basis === "calculated") row.calculated = round(row.calculated + line.quantity);
    else row.manual = round(row.manual + line.quantity);
    row.total = round(row.calculated + row.manual);
    row.lineCount += 1;
    rows.set(line.unit, row);
  }
  return { rows: [...rows.values()].sort((a, b) => a.unit.localeCompare(b.unit)), unquantified };
}
