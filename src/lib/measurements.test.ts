// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { PdfInspection, TextEvidence } from "./drawings";
import { extractMeasurements } from "./measurements";

function line(texts: string[], y = 700): TextEvidence[] {
  return texts.map((text, i) => ({ text, x: 50 + i * 200, y, width: text.length * 6, height: 10 }));
}

function inspection(items: TextEvidence[], imageOperators = 0, vectorOperators = 0): PdfInspection {
  return {
    version: 1, inspectedAt: "2026-01-01T00:00:00.000Z", pageCount: 1, measurementStatus: "unverified", warnings: [],
    pages: [{ page: 1, textItems: items, vectorOperators, imageOperators, annotationCandidates: [] }],
  };
}

describe("measurement candidates", () => {
  it("parses an explicit metric annotation with location evidence and required verification", () => {
    const result = extractMeasurements(inspection(line(["Wall 5000 mm"])), "abc");
    expect(result.candidates).toHaveLength(1);
    const [candidate] = result.candidates;
    expect(candidate?.value).toBe(5000);
    expect(candidate?.unit).toBe("mm");
    expect(candidate?.method).toBe("explicit_text_annotation");
    expect(candidate?.verification).toBe("required");
    expect(candidate?.location.coordinateSystem).toBe("PDF page space");
    expect(result.sourceChecksum).toBe("abc");
  });

  it("converts feet and inches annotations to decimal feet", () => {
    const [candidate] = extractMeasurements(inspection(line(["10'-6\""])), "abc").candidates;
    expect(candidate?.value).toBeCloseTo(10.5);
    expect(candidate?.unit).toBe("ft");
  });

  it("keeps labeled unitless dimensions without assigning a unit", () => {
    const [candidate] = extractMeasurements(inspection(line(["Length: 3.5"])), "abc").candidates;
    expect(candidate?.value).toBe(3.5);
    expect(candidate?.unit).toBeNull();
    expect(candidate?.method).toBe("labeled_unitless_annotation");
    expect(candidate?.confidence).toBe("low");
  });

  it("rejects area annotations and grouped thousands", () => {
    expect(extractMeasurements(inspection(line(["Slab 25 m²"])), "abc").candidates).toHaveLength(0);
    expect(extractMeasurements(inspection(line(["1,500 mm"])), "abc").candidates).toHaveLength(0);
  });

  it("records scale and unit notes as unverified evidence", () => {
    const result = extractMeasurements(inspection(line(["Scale 1:100", "All dimensions in mm"])), "abc");
    expect(result.pages[0]?.scaleEvidence.map(s => s.text)).toEqual(["Scale 1:100"]);
    expect(result.pages[0]?.unitEvidence).toHaveLength(1);
    expect(result.candidates).toHaveLength(0);
  });

  it("does not claim completion for image content without text", () => {
    const result = extractMeasurements(inspection([], 1), "abc");
    expect(result.pages[0]?.contentType).toBe("image_based");
    expect(result.status).toBe("requires_verification");
    expect(result.warnings.some(w => w.includes("OCR"))).toBe(true);
  });

  it("reports parsed candidates on mixed content as partially completed", () => {
    const result = extractMeasurements(inspection(line(["Door 900 mm"]), 1), "abc");
    expect(result.status).toBe("partially_completed");
  });
});
