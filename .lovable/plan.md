# Design-to-procurement implementation

## Verified foundation
Existing organization membership, project records, private document storage, audit triggers and decimal-safe financial services will be reused. AI packages and a gateway key are present; the default model is available, but no working AI drawing integration exists in application code.

## First working milestone
1. Add project drawing uploads without changing the existing interface or business records.
2. Store PDF, PNG, JPEG and WebP files privately, tied to authenticated organizations and projects. Validate signatures, size and format on the server.
3. Inspect PDFs deterministically on the backend: page count, extractable text with page coordinates, image/vector indicators, explicit unit and scale annotations. Preserve raw evidence; never interpret PDF coordinates as construction dimensions.
4. Record immutable source files, checksums, processing attempts, status, error details and unverified results. Repeated successful processing returns the saved result; failures can be retried explicitly.
5. Show source evidence and unresolved scale, units and raster limitations on the project page. Images are accepted as sources but remain unverified pending a later vision workflow.
6. Test file validation, PDF extraction, authentication, storage access, project links, retries and organization isolation.

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