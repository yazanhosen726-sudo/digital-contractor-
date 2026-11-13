// Only missing-relation errors represent an unprovisioned workflow.
// Permissions, network failures and other database errors must remain errors.
export function missingWorkflowStorage(error: { code: string } | null): boolean {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

export const TAKEOFF_PENDING = "No approved measurements are available. Measurement approval and quantity takeoff are not enabled for this business yet.";
export const BOQ_PENDING = "No BOQ is available. BOQ generation is not enabled for this business yet; approved measurements and a quantity takeoff are required.";
export const SCANNED_PDF_PENDING = "This page is image-based. Its visible dimensions cannot be read by embedded-text inspection. OCR is not connected; upload a PDF with selectable dimension text to extract candidates.";