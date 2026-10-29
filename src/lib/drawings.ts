export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const MAX_PDF_PAGES = 50;
export type TextEvidence = { text: string; x: number; y: number; width: number; height: number };
export type PageInspection = { page: number; textItems: TextEvidence[]; vectorOperators: number; imageOperators: number; annotationCandidates: string[] };
export type PdfInspection = { version: 1; inspectedAt: string; pageCount: number; pages: PageInspection[]; measurementStatus: "unverified"; warnings: string[] };

export function validatePdf(bytes: Uint8Array, name: string) {
  if (!name.toLowerCase().endsWith(".pdf")) throw new Error("Only PDF drawings are supported. Export DWG or DXF drawings to PDF first.");
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PDF_BYTES) throw new Error("PDF files must be nonempty and no larger than 20 MiB.");
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") throw new Error("The file does not have a valid PDF signature.");
}

export function annotationCandidates(text: string): string[] {
  // Printed annotations are evidence only, not interpreted dimensions or scale.
  return [...new Set(text.match(/\b(?:scale\s*[:=]?\s*\d+\s*:\s*\d+|\d+(?:\.\d+)?\s*(?:mm|cm|m|ft|in)\b|\d+\s*['′]\s*(?:\d+\s*["″])?)/gi) ?? [])].slice(0, 100);
}

export function assertDrawingAccess(document: { org_id: string; project_id: string | null; storage_path: string; kind: string }, project: { id: string; org_id: string }) {
  if (document.org_id !== project.org_id || document.project_id !== project.id || document.kind !== "drawing" || !document.storage_path.startsWith(`${project.org_id}/${project.id}/`)) throw new Error("Drawing is not accessible in this project.");
}