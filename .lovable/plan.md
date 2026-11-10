# Restore core project functionality

## Focused repairs
- Accept blank optional budget and contract amounts as unknown values, not invented zeros; keep validation for supplied amounts.
- Select the signed-in user's own business membership before checking project-write permissions.
- Keep Dashboard, Projects and project-detail links consistent, and keep project content clear of the existing navigation.
- Leave Expenses, Invoices, Financial analytics and Procurement unavailable: these route pages do not exist yet. Building them is outside this repair.

## Verification
- Check existing organization access policies without changing the database.
- Add regression tests for optional amounts, membership selection and implemented route matching.
- Create one clearly named verification project through the signed-in form; confirm its saved values and visibility after reloading Projects and Dashboard.
- Check desktop/mobile navigation and automatic production validation; report any unverified checks honestly.

No schema, migration, permission, redesign or destructive changes are planned.