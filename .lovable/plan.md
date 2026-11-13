# Drawing workflow repair
- Preserve the existing document pipeline and all database/access rules.
- Detect scanned pages and explain why embedded-text extraction cannot read them; do not invent candidates.
- Treat confirmed missing review/takeoff/BOQ storage as unavailable, not as a loading failure. Keep other errors visible and disable unsupported writes.
- Test image-only PDF inspection and signed-in project empty states.
- OCR is blocked by approval: no free OCR engine is installed, and the existing AI connection incurs usage charges. Do not add paid processing or dependencies without approval.