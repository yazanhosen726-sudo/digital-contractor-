import { getDocumentProxy, getResolvedPDFJS } from "unpdf";
import { annotationCandidates, MAX_PDF_PAGES, type PdfInspection, type TextEvidence } from "./drawings";

export async function inspectPdf(bytes: Uint8Array): Promise<PdfInspection> {
  const pdf = await getDocumentProxy(bytes, { isEvalSupported: false, useSystemFonts: false, stopAtErrors: true });
  const deadline = Date.now() + 25_000;
  const timer = setTimeout(() => { void pdf.destroy(); }, 30_000);
  try {
    if (pdf.numPages > MAX_PDF_PAGES) throw new Error("PDF inspection supports at most 50 pages. Split the drawing set and upload again.");
    const { OPS } = await getResolvedPDFJS();
    const vectorOps = new Set([OPS.constructPath, OPS.stroke, OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke]);
    const imageOps = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject, OPS.paintImageXObjectRepeat, OPS.paintImageMaskXObjectRepeat, OPS.paintInlineImageXObjectGroup, OPS.paintImageMaskXObjectGroup]);
    const pages: PdfInspection["pages"] = [];
    let totalText = 0;
    for (let number = 1; number <= pdf.numPages; number++) {
      if (Date.now() > deadline) throw new Error("Inspection time limit exceeded. Split this PDF into smaller files.");
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const textItems: TextEvidence[] = [];
      for (const item of content.items) {
        if (!("str" in item)) continue;
        totalText += item.str.length;
        if (totalText > 200_000 || textItems.length >= 10_000) throw new Error("PDF text exceeds inspection limits. Split this PDF into smaller files.");
        textItems.push({ text: item.str, x: item.transform[4] ?? 0, y: item.transform[5] ?? 0, width: item.width, height: item.height });
      }
      const operators = await page.getOperatorList();
      if (operators.fnArray.length > 200_000) throw new Error("PDF geometry exceeds inspection limits. Split this PDF into smaller files.");
      pages.push({ page: number, textItems, vectorOperators: operators.fnArray.filter(op => vectorOps.has(op)).length, imageOperators: operators.fnArray.filter(op => imageOps.has(op)).length, annotationCandidates: annotationCandidates(textItems.map(i => i.text).join(" ")) });
      page.cleanup();
    }
    return { version: 1, inspectedAt: new Date().toISOString(), pageCount: pdf.numPages, pages, measurementStatus: "unverified", warnings: ["PDF coordinates are page-space evidence, not construction dimensions. Scale and units have not been verified.", ...(pages.some(p => p.imageOperators > 0) ? ["Raster images detected. OCR and calibrated image measurement have not been performed."] : []), "Printed annotation candidates and vector operators do not establish reliable dimensions or quantities."] };
  } finally {
    clearTimeout(timer);
    await pdf.destroy();
  }
}