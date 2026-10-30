# Drawing inspection and future measurement requirements

## Current pipeline
PDF-only sources use existing private document storage, document records and organization access rules. The server validates PDF extension, signature and a 20 MiB size limit. The inspector reads at most 50 pages, preserves text with page-space coordinates, counts image and vector drawing operators and records explicit printed annotation candidates. Success means inspected and unverified, never measured or quantity-ready. Original sources are stored under unique paths without overwrite; SHA-256 is checked before inspection. Successful results are reused and failed attempts can be retried.

Text, image and operator counts are evidence indicators, not a complete geometry model. Raster content is not OCR-processed. Page coordinates, glyph bounds and vector paths cannot establish construction lengths without verified scale, units, viewport and rotation. Time/text/operator limits reject oversized inspections rather than returning partial success. A synchronous request can be interrupted; an extracting record can be retried after two minutes. No durable background queue is currently added.

## Next measurement evaluation
Use representative contractor drawings with known, independently reviewed reference dimensions. Evaluate vector-text, mixed and scanned sheets separately. Retain original sheet and detail references, raw annotation evidence, explicit unit and scale labels, human calibration and revision history. Resolve different scales on the same page before interpreting geometry. Compare extracted candidates against reviewed ground truth with documented tolerances; unresolved or contradictory cases remain unverified. The synthetic PDF tests validate parsing and indicators only, not construction measurement accuracy. Actual drawing accuracy has not yet been demonstrated.

## Validation completed — 2026-10-30
- 25 tests passed: 10 PDF/access-validation tests, 7 live private-storage/document-access tests, and 8 existing financial regression tests.
- Signed-in project flow verified in the browser using synthetic PDFs: upload, automatic inspection, saved evidence after reload, byte-identical original download, corrupt-file failure, and explicit retry. No browser page errors occurred in the completed run.
- Live access checks confirmed member reads/downloads, anonymous read/download/upload/write denial, and rejection of document insertion into an unrelated organization. Helper tests reject mismatched organization and project paths. Direct browser downloads use the authenticated storage client and storage access policies; they do not require a separate server-function wrapper.
- Two independent organization sessions have not been tested against each other's existing records. Real contractor drawing accuracy and published Worker runtime remain unverified.
- An initial development dependency refresh interrupted requests, leaving uploaded records recoverable through Inspect; the final uninterrupted upload flow passed. Test drawing records remain in the existing project as explicitly named validation files.

## DXF
Do not accept DXF as analyzed yet. A pure JavaScript ASCII DXF parser is a feasible next evaluation, but must preserve header units, layers, entities, block/insert transforms, text, dimension objects and unsupported entities. Require explicit units and representative-file coverage tests. Confirm the selected parser license and version before adoption. Raw coordinates alone do not establish quantities.

## DWG
No conversion integration is configured. Ask for a PDF export for this milestone. Native DWG requires a vendor-supported conversion/SDK integration and evaluation of supported DWG versions, deployment compatibility, commercial licensing, costs, retention, data location and contractor authorization. LibreDWG-based options are GPL-3.0 and require licensing review; commercial options such as RealDWG/Apryse require vendor confirmation. Conversion must retain source provenance and warnings about skipped objects. No conversion or CAD coverage is claimed.

## Dependencies
unpdf 1.4.0 uses the serverless PDF.js bundle for deterministic inspection; no AI service or canvas rendering is involved. Retain unpdf MIT and PDF.js Apache-2.0 notices with redistributed software. Worker deployment behavior must also be verified after publication; local parsing tests do not establish hosted runtime compatibility.