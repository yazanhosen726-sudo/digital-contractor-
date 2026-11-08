# Stitch UI integration into DC

## Scope and safeguards
Integrate the eight supplied Stitch designs into the current application, not a new app. Preserve the database, migrations, organization access rules, authentication, server functions and existing drawing, measurement, takeoff, BOQ and financial operations. No schema changes, new integrations or invented business data.

## Screen mapping
| Stitch screen | Integration |
| --- | --- |
| Welcome / sign-in | Restyle the existing sign-in and account-creation experience; retain its authentication operations. The exported screenshot is blank, so use its HTML as the reference. Unconfigured social sign-in and other unsupported actions remain clearly unavailable. |
| Main dashboard | Restyle the existing dashboard with real project counts, statuses and recent projects. Remove fabricated names, dates, progress and procurement data currently displayed. |
| Projects list | Add a dedicated authenticated project-list page using the existing project query, search, status filtering and project-creation operation. Keep existing detail URLs. |
| Project details | Apply the supplied layout around real project information and financial values; retain access to drawing inspection, measurement verification, takeoff and BOQ tools. Do not invent site progress, personnel or milestone data. |
| Expenses | Display existing organization-scoped expense records, real amounts, dates and statuses. Actions without an existing supported workflow are visibly unavailable. |
| Invoices | Display existing receivable records and payment-backed collected/outstanding values. Invoice generation remains unavailable unless an existing applicable operation supports it. |
| Financial analytics | Present the existing deterministic financial report in the supplied visual style; keep currencies separate and use actual payment dates for any period filtering. No fabricated trends or margins. |
| Procurement | Display existing purchase-order/planning records and applicable existing estimates. Preserve current procurement logic; do not invent shipment tracking, bids or approval operations. |

## Implementation sequence
1. Establish Stitch's supplied typography, bronze/charcoal/ivory tokens, spacing and mobile controls in the existing styling system. Convert the shared header, desktop navigation and mobile bottom navigation into reusable React UI with real destinations.
2. Add persistent English/Arabic preference, translated integrated-screen labels, document language/direction and direction-aware layouts. Preserve user-entered names and use isolated mixed-language values. Existing engineering tools remain fully accessible; translate their interface labels without altering calculations or stored evidence.
3. Integrate sign-in, dashboard, projects list and project details first, retaining working forms, authorization checks and tools.
4. Integrate expenses, invoices, analytics and procurement as actual authenticated application pages reading existing organization-scoped records. Show honest loading, empty, error and unavailable states. Reuse existing operations rather than adding backend behavior just to match the designs.
5. Validate navigation, project creation and saved records with the signed-in application; check phone, tablet and desktop layouts in English and Arabic, language persistence and absence of overlapping or clipped controls.

## Visual adaptations required by real data
- Use supplied construction imagery only as illustrative imagery, never as a claimed photograph of an actual project. Do not copy demo people, projects, suppliers, receipts or certification claims.
- Missing project photos, progress, team, timeline or shipment information is explicitly unavailable; retain the layout where possible without presenting invented values.
- Preserve all existing financial distinctions and currencies even where the designs show a single dollar total.

## Technical details
- Keep TanStack Start routing, the current authenticated gate and generated backend clients unchanged.
- Use existing UI components and dependencies. Add only focused presentation/language modules and missing screen routes; do not replace package configuration or generated route files.
- Existing compilation failures are already present in the dashboard and procurement code. Make only the minimum repairs needed to restore compilation, keeping backend behavior and authorization intact; verify procurement repairs with its existing tests.
- Run relevant existing tests plus small tests for persistent language selection and any changed financial display aggregation rules. Review the platform's automatic TypeScript and production-build results; do not run duplicate manual builds.

## Completion report
Report the integrated screens, preserved workflows, tests and responsive/RTL results, any failed checks, and any features that remain unavailable. No production deployment or database changes are included.