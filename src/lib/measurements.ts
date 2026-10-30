import type { PdfInspection, TextEvidence } from "./drawings";

export const MEASUREMENT_VERSION = 1;
export type MeasurementStatus = "completed" | "partially_completed" | "requires_verification" | "failed";
export const measurementStatusLabels: Record<MeasurementStatus, string> = {
  completed: "Completed", partially_completed: "Partially completed", requires_verification: "Requires verification", failed: "Failed",
};
type Source = { page: number; text: string; textItemIndexes: number[]; location: { x: number; y: number; width: number; height: number; coordinateSystem: "PDF page space" } };
export type MeasurementCandidate = Source & {
  id: string; value: number; unit: "mm" | "cm" | "m" | "ft" | "in" | null;
  method: "explicit_text_annotation" | "labeled_unitless_annotation";
  confidence: "medium" | "low"; confidenceBasis: string;
  verification: "required"; verificationReasons: string[];
};
export type MeasurementExtraction = {
  version: 1; extractedAt: string; sourceChecksum: string; status: MeasurementStatus;
  candidates: MeasurementCandidate[];
  pages: { page: number; contentType: "image_based" | "mixed" | "text_or_vector" | "empty";
    vectorOperators: number; imageOperators: number; scaleEvidence: Source[]; unitEvidence: Source[] }[];
  warnings: string[]; error?: string;
};
const MAX_CANDIDATES = 2000;
const numeric = "(?:\\d+(?:\\.\\d+)?|\\.\\d+)";
const amount = "(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|" + numeric + ")";
const metric = new RegExp(`(?<![\\w.,/+-])(${numeric})\\s*(mm|cm|m|ft|in)\\b(?![²³]|\\s*\\^\\s*[23])`, "gi");
const imperial = new RegExp(`(?<![\\w.,/+-])(${amount})\\s*(['′]|[\"″])(?:\\s*-?\\s*(${amount})\\s*[\"″])?`, "g");
const unitless = new RegExp(`\\b(?:length|width|height|depth|dimension|dim)\\s*[:=]\\s*(${numeric})(?![\\w.,/])`, "gi");
function parseAmount(raw: string): number {
  const parts = raw.trim().split(/\s+/); const fraction = parts.at(-1) ?? "";
  if (!fraction.includes("/")) return Number(raw);
  const [top, bottom] = fraction.split("/").map(Number);
  if (top === undefined || bottom === undefined || bottom === 0) return NaN;
  return (parts.length > 1 ? Number(parts[0]) : 0) + top / bottom;
}
function groups(items: TextEvidence[]): { text: string; indexes: number[] }[] {
  const result: { text: string; indexes: number[] }[] = [];
  items.forEach((item, index) => {
    if (!item.text.trim()) return;
    const group = result.at(-1); const lastIndex = group?.indexes.at(-1);
    const last = lastIndex === undefined ? undefined : items[lastIndex];
    const gap = last ? item.x - (last.x + last.width) : Infinity;
    const nearby = last && Math.abs(item.y - last.y) <= 2 && gap >= -2 && gap <= Math.max(12, Math.abs(last.height) * 2);
    if (group && nearby) { group.text += ` ${item.text}`; group.indexes.push(index); }
    else result.push({ text: item.text, indexes: [index] });
  });
  return result;
}
function source(page: number, text: string, indexes: number[], items: TextEvidence[]): Source {
  const selected = indexes.flatMap(i => items[i] ? [items[i]] : []);
  const x = Math.min(...selected.map(i => i.x)); const y = Math.min(...selected.map(i => i.y));
  return { page, text, textItemIndexes: indexes, location: { x, y,
    width: Math.max(...selected.map(i => i.x + Math.abs(i.width))) - x,
    height: Math.max(...selected.map(i => i.y + Math.abs(i.height))) - y, coordinateSystem: "PDF page space" } };
}
export function extractMeasurements(inspection: PdfInspection, sourceChecksum: string): MeasurementExtraction {
  const candidates: MeasurementCandidate[] = []; let capped = false;
  const pages: MeasurementExtraction["pages"] = [];
  for (const page of inspection.pages) {
    const hasText = page.textItems.some(i => i.text.trim());
    const result: MeasurementExtraction["pages"][number] = { page: page.page,
      contentType: page.imageOperators > 0 ? (hasText || page.vectorOperators > 0 ? "mixed" : "image_based") : (hasText || page.vectorOperators > 0 ? "text_or_vector" : "empty"),
      vectorOperators: page.vectorOperators, imageOperators: page.imageOperators, scaleEvidence: [], unitEvidence: [] };
    for (const group of groups(page.textItems)) {
      const evidence = (text: string) => source(page.page, text, group.indexes, page.textItems);
      for (const match of group.text.matchAll(/\bscale\s*[:=]?\s*(?:\d+(?:\.\d+)?\s*:\s*\d+(?:\.\d+)?|[^\n]{0,45}?["″]\s*=\s*[^\n]{1,20}?['′])|\bnot\s+to\s+scale\b|\bN\.?T\.?S\.?\b/gi)) result.scaleEvidence.push(evidence(match[0]));
      for (const match of group.text.matchAll(/\b(?:all\s+)?(?:dimensions|units|measurements)\s*(?:are\s*)?(?:in|[:=])\s*(?:millimet(?:er|re)s?|centimet(?:er|re)s?|met(?:er|re)s?|millimeters|mm|cm|m|feet|ft|inches|in)\b/gi)) result.unitEvidence.push(evidence(match[0]));
      const occupied: { start: number; end: number }[] = [];
      const add = (raw: string, start: number, value: number, unit: MeasurementCandidate["unit"], method: MeasurementCandidate["method"]) => {
        if (!Number.isFinite(value) || value <= 0) return;
        if (candidates.length >= MAX_CANDIDATES) { capped = true; return; }
        occupied.push({ start, end: start + raw.length });
        candidates.push({ ...evidence(raw), id: `p${page.page}-m${candidates.length + 1}`, value, unit, method,
          confidence: unit && group.indexes.length === 1 ? "medium" : "low",
          confidenceBasis: "Text parsing confidence only; no engineering accuracy or drawing-element association established.",
          verification: "required", verificationReasons: ["Drawing scale has not been human-verified.", "Annotation meaning and associated drawing element require review.", ...(unit ? [] : ["Measurement unit is missing; page unit notes are not applied automatically."])] });
      };
      for (const m of group.text.matchAll(metric)) {
        // Reject suffixes of ambiguous grouped/decimal-comma numbers and area/volume annotations.
        const before = group.text.slice(Math.max(0, m.index - 3), m.index);
        if (/\d[, ]\s*$/.test(before) || /\d[,]/.test(m[0])) continue;
        add(m[0], m.index, Number(m[1]), m[2]?.toLowerCase() as MeasurementCandidate["unit"], "explicit_text_annotation");
      }
      for (const m of group.text.matchAll(imperial)) {
        const feet = m[2] === "'" || m[2] === "′";
        const value = parseAmount(m[1] ?? "") + (feet && m[3] ? parseAmount(m[3]) / 12 : 0);
        add(m[0], m.index, value, feet ? "ft" : "in", "explicit_text_annotation");
      }
      for (const m of group.text.matchAll(unitless)) {
        if (occupied.some(o => o.start < m.index + m[0].length && o.end > m.index)) continue;
        add(m[0], m.index, Number(m[1]), null, "labeled_unitless_annotation");
      }
    }
    pages.push(result);
  }
  const unsupported = pages.some(p => p.imageOperators > 0 || (p.vectorOperators > 0 && !inspection.pages.find(i => i.page === p.page)?.textItems.some(i => i.text.trim())));
  const warnings = ["All candidates are unverified; no geometry-derived construction lengths were calculated.", "Locations bound contributing text items in PDF page space, not construction coordinates; rotated text needs visual review.",
    ...(unsupported ? ["Image content or geometry without text remains unmeasured. OCR and geometric measurement are not included."] : []),
    ...(capped ? ["Candidate limit reached; only the first 2000 candidates were retained."] : []),
    ...(!candidates.length ? ["No supported written measurements found. This does not establish that the drawing has no dimensions."] : [])];
  return { version: MEASUREMENT_VERSION, extractedAt: new Date().toISOString(), sourceChecksum,
    status: candidates.length ? (unsupported || capped ? "partially_completed" : "requires_verification") : (unsupported ? "requires_verification" : "completed"), candidates, pages, warnings };
}