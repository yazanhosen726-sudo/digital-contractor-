# First-stage PDF measurement candidates

## Verified foundation
Existing organization membership, project records, private document storage, audit triggers and decimal-safe financial services will be reused. AI packages and a gateway key are present; the default model is available, but no working AI drawing integration exists in application code.

## Execution plan
1. Parse explicit written metric/imperial measurements and labeled unitless dimensions from existing PDF text evidence. Retain the exact text, value, unit, page, contributing text elements and page-space bounds. Join only nearby same-line text fragments; never infer lengths from geometry or scale.
2. Record possible scale/unit annotations and image/vector indicators per page. All scale evidence remains unverified; scanned/image-based pages need manual review because OCR is not included.
3. Save versioned candidate results in the existing document JSON, separate from verified records, with checksum, extraction method, confidence and completed/partial/verification/failed outcomes. Reuse successful results and upgrade previously inspected files through an explicit extraction button.
4. Show candidate results in the existing drawing list without redesign. Test concrete parsing and safety rules, then exercise stored-file extraction, persistence and failure in the signed-in project.

## Scope
PDF only, existing private storage and document records, existing interface. Deterministic text parsing only; no new tables, integrations, AI calls, OCR, geometric measurement, BOQ, costs or commercial documents. Confidence describes annotation parsing, not engineering accuracy. A completed parse is not verified measurement. Representative contractor drawings with independently checked dimensions are required for real-world accuracy claims.

## Subsequent milestones
- Drawing extraction and human measurement verification; maintain separate revisions and affected-output revalidation.
- Deterministic reviewed quantities and traceable partial BOQs, with duplicate prevention.
- Price references and separate-currency deterministic estimates; missing prices remain unresolved.
- Reviewed procurement requirements, equivalent-product quotation comparisons and draft RFQs.
- Distinct estimate, quotation and invoice-related documents; explicit authorization before distribution or commitments.
- Full design-to-procurement end-to-end and security testing.

## Technical decisions and limits
- Use the existing TanStack authenticated server-function boundary and membership checks. Browser reads continue through organization-isolated policies.
- Use a serverless PDF.js bundle through unpdf, not a model, for this first milestone. No AI call or engineering calculation is required to inspect actual PDF evidence.
- DXF strategy: a pure JavaScript ASCII DXF parser, preserving units, layers and entities, in a later milestone; do not accept DXF as successfully analyzed now.
- DWG requires an authorized conversion service or a contractor-exported PDF/DXF. No such service is configured, so DWG is rejected with a clear explanation.
- Twenty MiB per source and fifty PDF pages per inspection. Over-limit, encrypted, corrupt and unsupported documents fail visibly, never partially succeed.
- Automatic BOQ, pricing, RFQs and invoices are not part of this first milestone and will not be presented as working.