// @vitest-environment node
import { describe, expect, it } from "vitest";
import { annotationCandidates, assertDrawingAccess, MAX_PDF_BYTES, validatePdf } from "./drawings";
import { inspectPdf } from "./pdf-inspection.server";

function pdfFixture(content = "BT /F1 12 Tf 50 700 Td (Scale 1:100 5000 mm) Tj ET 50 50 100 100 re S", pages = 1) {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, i) => `${5 + i} 0 R`).join(" ")}] /Count ${pages} >>`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${content.length} >>\nstream\n${content}\nendstream`, ...Array.from({ length: pages }, () => "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents 4 0 R >>")];
  let output = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((obj, i) => { offsets.push(output.length); output += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = output.length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(output);
}
describe("PDF drawing rules", () => {
  it("accepts only PDF drawings", () => expect(() => validatePdf(pdfFixture(), "plan.dwg")).toThrow("Only PDF"));
  it("rejects spoofed PDFs", () => expect(() => validatePdf(new TextEncoder().encode("not pdf"), "plan.pdf")).toThrow("signature"));
  it("caps sources at 20 MiB", () => { expect(MAX_PDF_BYTES).toBe(20 * 1024 * 1024); expect(() => validatePdf(new Uint8Array(MAX_PDF_BYTES + 1), "plan.pdf")).toThrow("20 MiB"); });
  it("retains printed annotations without interpreting them", () => expect(annotationCandidates("Scale 1:100 wall 5000 mm")).toEqual(["Scale 1:100", "5000 mm"]));
  it("rejects another organization", () => expect(() => assertDrawingAccess({ org_id: "b", project_id: "p", storage_path: "b/p/file.pdf", kind: "drawing" }, { id: "p", org_id: "a" })).toThrow("not accessible"));
  it("rejects a sibling project path", () => expect(() => assertDrawingAccess({ org_id: "a", project_id: "p", storage_path: "a/other/file.pdf", kind: "drawing" }, { id: "p", org_id: "a" })).toThrow("not accessible"));
  it("inspects real PDF bytes for text and vectors but never verifies dimensions", async () => { const result = await inspectPdf(pdfFixture()); expect(result.pageCount).toBe(1); expect(result.pages[0]?.textItems.map(i => i.text).join(" ")).toContain("5000 mm"); expect(result.pages[0]?.vectorOperators).toBeGreaterThan(0); expect(result.measurementStatus).toBe("unverified"); });
  it("rejects more than 50 pages", async () => expect(inspectPdf(pdfFixture("", 51))).rejects.toThrow("50 pages"));
  it("identifies image-only PDF content without inventing text", async () => { const result = await inspectPdf(pdfFixture("q 100 0 0 100 50 50 cm BI /W 1 /H 1 /CS /RGB /BPC 8 /F /ASCIIHexDecode ID ff0000> EI Q")); expect(result.pages[0]?.imageOperators).toBeGreaterThan(0); expect(result.pages[0]?.textItems).toEqual([]); expect(result.measurementStatus).toBe("unverified"); });
  it("fails corrupt PDF content", async () => expect(inspectPdf(new TextEncoder().encode("%PDF-corrupt"))).rejects.toThrow());
});