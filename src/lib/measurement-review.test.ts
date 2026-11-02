// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { PdfInspection, TextEvidence } from "./drawings";
import { extractMeasurements, type MeasurementExtraction } from "./measurements";
import {
  approvedMeasurements,
  nextEventAction,
  reviewCandidates,
  reviewTotals,
  type ReviewEvent,
} from "./measurement-review";

function line(texts: string[], y = 700): TextEvidence[] {
  return texts.map((text, i) => ({ text, x: 50 + i * 200, y, width: text.length * 6, height: 10 }));
}

function extractionFor(texts: string[], checksum = "abc"): MeasurementExtraction {
  const inspection: PdfInspection = {
    version: 1, inspectedAt: "2026-01-01T00:00:00.000Z", pageCount: 1, measurementStatus: "unverified", warnings: [],
    pages: [{ page: 1, textItems: line(texts), vectorOperators: 0, imageOperators: 0, annotationCandidates: [] }],
  };
  return extractMeasurements(inspection, checksum);
}

function decision(candidateId: string, action: ReviewEvent["action"], order: number, extra: Partial<ReviewEvent> = {}): ReviewEvent {
  return {
    document_id: "doc-1", candidate_id: candidateId, source_checksum: "abc", action,
    corrected_value: null, corrected_unit: null, actor_id: "user-1",
    created_at: `2026-01-01T00:00:${String(order).padStart(2, "0")}.000Z`, ...extra,
  };
}

describe("measurement verification", () => {
  it("approves a candidate as extracted and counts it as approved", () => {
    const extraction = extractionFor(["Wall 5000 mm"]);
    const events = [decision("p1-m1", "approved", 1)];
    const [reviewed] = reviewCandidates(extraction, events);
    expect(reviewed?.state).toBe("approved");
    expect(reviewTotals(reviewCandidates(extraction, events))).toEqual({ total: 1, approved: 1, pending: 0, rejected: 0 });
    expect(approvedMeasurements(extraction, events)).toEqual([{ candidateId: "p1-m1", page: 1, text: "5000 mm", value: 5000, unit: "mm" }]);
  });

  it("stores edited value and unit separately and keeps the original extraction", () => {
    const extraction = extractionFor(["Wall 5000 mm"]);
    const events = [decision("p1-m1", "approved", 1, { corrected_value: 4.8, corrected_unit: "m" })];
    expect(approvedMeasurements(extraction, events)).toEqual([{ candidateId: "p1-m1", page: 1, text: "5000 mm", value: 4.8, unit: "m" }]);
    expect(extraction.candidates[0]?.value).toBe(5000);
    expect(extraction.candidates[0]?.unit).toBe("mm");
  });

  it("excludes rejected candidates from approved measurements", () => {
    const extraction = extractionFor(["Wall 5000 mm"]);
    const events = [decision("p1-m1", "rejected", 1)];
    expect(reviewCandidates(extraction, events)[0]?.state).toBe("rejected");
    expect(reviewTotals(reviewCandidates(extraction, events))).toEqual({ total: 1, approved: 0, pending: 0, rejected: 1 });
    expect(approvedMeasurements(extraction, events)).toEqual([]);
    expect(() => nextEventAction("rejected", "approve")).toThrow("Reopen this measurement");
  });

  it("reopens a reviewed candidate so it can be decided again", () => {
    const extraction = extractionFor(["Wall 5000 mm"]);
    const approved = [decision("p1-m1", "approved", 1)];
    expect(nextEventAction("approved", "reopen")).toBe("reopened");
    const reopened = [...approved, decision("p1-m1", "reopened", 2)];
    expect(reviewCandidates(extraction, reopened)[0]?.state).toBe("pending");
    expect(approvedMeasurements(extraction, reopened)).toEqual([]);
    const reapproved = [...reopened, decision("p1-m1", "approved", 3, { corrected_value: 5, corrected_unit: "m" })];
    expect(approvedMeasurements(extraction, reapproved)[0]?.value).toBe(5);
    expect(() => nextEventAction("pending", "reopen")).toThrow("not reviewed yet");
  });

  it("ignores decisions recorded against a different drawing version", () => {
    const extraction = extractionFor(["Wall 5000 mm"], "new-checksum");
    const events = [decision("p1-m1", "approved", 1)];
    expect(reviewCandidates(extraction, events)[0]?.state).toBe("pending");
    expect(approvedMeasurements(extraction, events)).toEqual([]);
  });

  it("keeps unitless candidates out of approved measurements until a unit is chosen", () => {
    const extraction = extractionFor(["Wall 5000 mm", "Length: 3.5"]);
    expect(extraction.candidates.map(c => c.id)).toEqual(["p1-m1", "p1-m2"]);
    expect(approvedMeasurements(extraction, [decision("p1-m2", "approved", 1)])).toEqual([]);
    const corrected = [decision("p1-m2", "approved", 1, { corrected_value: 3.5, corrected_unit: "m" })];
    expect(approvedMeasurements(extraction, corrected)).toEqual([{ candidateId: "p1-m2", page: 1, text: "Length: 3.5", value: 3.5, unit: "m" }]);
    expect(reviewTotals(reviewCandidates(extraction, [decision("p1-m1", "rejected", 1)]))).toEqual({ total: 2, approved: 0, pending: 1, rejected: 1 });
  });
});
