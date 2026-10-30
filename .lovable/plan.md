# Finish PDF upload and inspection validation

## Verified foundation
Existing organization membership, project records, private document storage, audit triggers and decimal-safe financial services will be reused. AI packages and a gateway key are present; the default model is available, but no working AI drawing integration exists in application code.

## Execution plan
1. Run the existing PDF tests; fix only demonstrated failures.
2. Sign into the existing business and exercise upload, saved inspection evidence, original download, failure and retry through the project page.
3. Run private-storage and organization-access tests against the uploaded record, including an unrelated organization where available. Keep reusable tests in the project.
4. Confirm current page metadata and app errors, then update the milestone checklist and technical assessment with verified results and limitations.

## Scope
PDF only, existing private storage and document records, existing interface. No redesign, new database tables, AI extraction, quantity takeoff, pricing or procurement. Test PDFs demonstrate parsing, not reliable construction measurements. Actual-drawing accuracy and published-runtime checks remain explicitly unverified until suitable drawings and publication are available.

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