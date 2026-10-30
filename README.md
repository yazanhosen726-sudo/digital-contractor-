# Sitewise Business Compass

PROJECT: AI DIGITAL CONTRACTOR



Phase 1 — Core Intelligence, Business Logic & Functional Foundation



1. YOUR ROLE



Act as a senior software architect, AI systems engineer, financial systems engineer, and construction-industry domain expert.



Your mission is to build the functional foundation of an AI-powered digital contractor: an intelligent operational system that helps construction contractors manage their entire business through one connected service.



We are not building a conventional construction management SaaS with a chatbot attached.



We are building an intelligent system that understands construction business operations, maintains accurate business records, connects financial and operational data, detects problems, generates actionable insights, and helps contractors make better decisions.



Think of this product as a digital business partner that works alongside the contractor.



2. CRITICAL DEVELOPMENT PRIORITY



Focus on the SERVICE, not the interface.



Do not spend development time creating a sophisticated dashboard, designing elaborate screens, adding animations, or polishing visual components.



The interface is secondary at this stage.



Prioritize, in this exact order:



1. Data architecture and business entities.

2. Database integrity and relationships.

3. Core business logic and calculations.

4. Construction project and expense management.

5. Financial accuracy and reporting.

6. AI intelligence and contextual understanding.

7. Integration between all business functions.

8. Security, reliability, and extensibility.

9. A minimal functional interface for testing the service.



Build real functionality, not a collection of static screens or demonstrations.



Do not simulate successful operations with hardcoded responses.



Every implemented feature must work against real application data and persist its results.



Before making architectural decisions, inspect the existing project, its current technology stack, installed integrations, database, authentication, and existing functionality. Reuse working components where appropriate rather than unnecessarily rebuilding them.



3. THE PRODUCT VISION



The platform combines six intelligent business capabilities:



1. AI Accountant.

2. AI Financial Manager.

3. AI Project Manager.

4. AI Procurement Manager.

5. AI Business Advisor.

6. AI Design Assistant.



These are not six isolated chatbots.



They must operate as connected capabilities within one system, sharing authorized access to a consistent source of business data.



For example:



A steel purchase should automatically affect the relevant project's expenses, procurement records, budget consumption, supplier history, and financial reports.



The AI should understand these relationships and explain their implications.



The long-term objective is to help a contractor run a construction business with less administrative work, greater financial visibility, and better operational control.



4. CORE BUSINESS DATA MODEL



Design a normalized, extensible database with appropriate relationships, constraints, indexes, timestamps, and auditability.



At minimum, establish the following entities.



A. Organizations and Users



- Organizations or contractor businesses.

- Users and their organization memberships.

- Roles and permissions.

- Organization-level settings.

- Currency and regional preferences.



Every organization must have strictly isolated business data.



One contractor must never be able to access another contractor's projects, invoices, financial information, or AI conversation context.



Design the system for future multi-user collaboration and multi-tenant SaaS operation.



B. Construction Projects



Each project should support:



- Project name and unique identifier.

- Client and location.

- Project status.

- Start date and expected completion date.

- Contract value.

- Original budget.

- Current approved budget.

- Project-specific currency where applicable.

- Categories of planned costs.

- Actual expenses.

- Committed costs, where supported.

- Project notes and attachments.

- Relevant suppliers, workers, invoices, and transactions.



The system must calculate actual project costs from recorded transactions rather than relying on manually maintained totals.



Keep original budget, approved budget changes, actual expenses, and outstanding commitments conceptually separate.



C. Expenses and Transactions



Support expenses across the entire construction operation, including:



- Steel and reinforcement.

- Cement and concrete.

- Sand, aggregates, and other materials.

- Tools and equipment.

- Equipment rental.

- Transportation and fuel.

- Labor and subcontractors.

- Electrical and plumbing work.

- Finishing materials.

- Cleaning and waste removal.

- Permits and administrative expenses.

- Other configurable expense categories.



Each expense should support:



- Amount and currency.

- Transaction date.

- Description.

- Category.

- Associated project, when applicable.

- Supplier or payee, when applicable.

- Payment status.

- Payment method, when recorded.

- Tax information, when applicable.

- Supporting documents.

- Created-by information.

- Approval status, when applicable.

- Audit history.



Support both project-specific and general business expenses.



Never silently discard an expense that cannot immediately be assigned to a project. Store it as unallocated and flag it for review.



Prevent duplicate records where possible, but do not automatically delete potentially legitimate transactions.



D. Invoices and Documents



Build a document-processing foundation that can support supplier invoices, receipts, expense documents, and related financial records.



The system should eventually extract:



- Supplier name.

- Invoice number.

- Invoice date.

- Due date.

- Line items.

- Quantities and unit prices.

- Subtotals.

- Taxes.

- Discounts.

- Total amount.

- Currency.

- Payment status.



Where technically supported, implement document upload and AI-assisted extraction.



Validate extracted information against mathematical totals and existing business records.



Store the original document and the extracted structured data together.



Clearly distinguish verified information from AI-extracted information that still requires review.



If an OCR or AI provider is not configured, provide a functional manual-entry fallback rather than pretending that automatic extraction is working.



Invoice creation, document processing, and expense recording must use a consistent underlying data model to avoid duplicate financial entries.



E. Suppliers and Procurement



Support:



- Supplier profiles.

- Contact information.

- Supplied materials and services.

- Supplier invoice history.

- Historical purchase prices.

- Purchase records.

- Payment obligations.

- Supplier-specific notes.

- Purchase order records, when implemented.



The system should be able to compare historical prices for equivalent items.



Price comparisons must account for relevant differences such as units, quantities, currency, delivery costs, and dates whenever that information is available.



Never present incomparable prices as if they were equivalent.



F. Workers and Labor Costs



Establish support for:



- Workers and subcontractors.

- Roles and work arrangements.

- Project assignments.

- Recorded working hours or days.

- Agreed rates.

- Labor expenses.

- Recorded payments.

- Outstanding amounts.



Do not treat estimated labor costs as confirmed expenses.



Clearly distinguish planned labor costs, recorded labor costs, and actual payments.



G. Budgets and Financial Obligations



Track:



- Original project budgets.

- Approved budget revisions.

- Actual expenses.

- Outstanding supplier invoices.

- Recorded purchase commitments.

- Expected payments.

- Recorded incoming payments.

- Receivables and payables.



Avoid double-counting an invoice as both a purchase commitment and an actual expense.



Define explicit transaction and payment states so the financial system remains consistent.



5. CORE FINANCIAL ENGINE



Build a reliable calculation layer that serves as the single source of truth for financial figures.



Implement the following calculations where the required data exists:



- Total actual expenses.

- Expenses by project.

- Expenses by category.

- Expenses by supplier.

- Budget consumption.

- Remaining budget.

- Budget variance.

- Outstanding payables.

- Outstanding receivables.

- Recorded incoming and outgoing cash movements.

- Project revenue.

- Project gross profit, where revenue and direct costs are available.

- Business-level financial summaries.



Use explicit definitions for every financial metric.



For example:



Budget remaining = current approved budget minus actual expenses, with committed but unpaid costs reported separately.



Do not confuse accounting profit with cash available in the bank.



Do not treat unpaid invoices as cash payments.



Do not calculate profit when the necessary revenue or cost information is missing.



Use decimal-safe monetary calculations, explicit rounding rules, and currency-aware data structures.



Support transaction-level currency storage and preserve original amounts.



If transactions involve multiple currencies, use an explicit exchange-rate record and conversion date before aggregating them into a reporting currency.



Never silently add amounts denominated in different currencies.



All financial calculations must be performed by deterministic application logic or database queries, not invented by the language model.



The AI may explain the calculations, but it must obtain the underlying figures from the financial engine.



6. AI ACCOUNTANT



Build an AI capability that helps contractors understand and organize financial records.



It should be able to:



- Explain recorded expenses.

- Summarize invoices and receipts.

- Identify uncategorized expenses.

- Flag possible duplicate invoices.

- Detect missing financial information.

- Explain outstanding obligations.

- Summarize spending by project and category.

- Answer questions about recorded financial transactions.

- Recommend records that require human review.



When an invoice or expense is processed, the system should propose an appropriate category and project when sufficient evidence exists.



If the system is uncertain, ask for clarification rather than guessing.



The AI must distinguish between recorded facts, calculated results, estimates, and recommendations.



7. AI FINANCIAL MANAGER



Build a capability that monitors the contractor's financial position.



It should:



- Compare actual spending with approved budgets.

- Identify unusually high expenses.

- Monitor upcoming payment obligations.

- Highlight missing or inconsistent financial records.

- Identify projects with declining budget headroom.

- Produce cash-flow summaries from available records.

- Estimate future costs when sufficient historical or planned data exists.

- Explain the assumptions behind forecasts.



Forecasts must be clearly labeled as estimates.



Never present predicted revenue, profit, or future cash availability as guaranteed outcomes.



Where data is insufficient, explicitly explain what is missing.



8. AI PROJECT MANAGER



Build project-level operational intelligence.



It should:



- Summarize project financial status.

- Track important dates and recorded milestones.

- Identify projects approaching budget limits.

- Flag overdue tasks when task data is available.

- Compare planned and actual costs.

- Highlight missing project information.

- Identify operational risks supported by available evidence.

- Generate concise project status reports.



Do not claim to know the physical percentage of construction completion unless supported by recorded milestones, verified updates, or relevant integrations.



Clearly distinguish financial progress from physical construction progress.



9. AI PROCUREMENT MANAGER



Build procurement intelligence around actual purchase records.



It should:



- Analyze historical purchase prices.

- Compare suppliers for equivalent materials.

- Identify unusual price increases.

- Highlight repeated purchases that may require review.

- Identify potentially excessive purchasing.

- Track known material requirements and purchase commitments.

- Summarize supplier performance based on available records.



Do not claim to know current market prices without access to a reliable, current pricing source.



Do not automatically place orders, make payments, or commit the contractor to a purchase.



Any external transaction or financially consequential action must require explicit authorization.



10. AI BUSINESS ADVISOR



Create a business advisory capability that can reason across the contractor's authorized business data.



It should answer questions such as:



- Which projects are consuming more budget than expected?

- Where are the largest recorded expenses?

- Which suppliers have increased their prices?

- Which invoices require attention?

- What financial obligations are approaching?

- Which projects have insufficient financial data?

- What actions could improve cost control?

- What information should the contractor investigate next?



Every significant recommendation should include:



1. The observation.

2. The supporting data.

3. Why it matters.

4. A recommended next step.

5. Any uncertainty or missing information.



Recommendations must be evidence-based, practical, and specific to the contractor's actual records.



Do not generate generic business advice when relevant business data is available.



11. AI DESIGN ASSISTANT — FOUNDATION ONLY



The product will eventually include an advanced design and creative workspace for construction planning, drawing, and design-related workflows.



For this phase, establish only the architectural foundations needed for future integration.



Do not build the full design editor, drawing workspace, CAD tools, or advanced visualization system now.



Do not allow design-related functionality to delay the financial and operational core.



Keep the architecture extensible so a dedicated design module can be introduced later without restructuring the entire platform.



12. THE CENTRAL AI ASSISTANT



Create one central AI orchestration layer that can interpret a contractor's request and determine which capabilities and business data are required.



Examples:



"How much did I spend on steel this month?"



The assistant should retrieve the relevant transactions, apply the correct date and currency filters, calculate the result, and provide a traceable summary.



"Which project is closest to exceeding its budget?"



The assistant should compare the current approved budgets with actual project expenses and identify the project with the smallest remaining budget or the greatest relevant budget pressure.



"Find invoices that might have been recorded twice."



The assistant should identify potential matches using supplier, invoice number, date, amount, and other available fields, then present the candidates for review.



"Prepare a financial summary for my current projects."



The assistant should retrieve authorized project records, calculate the relevant financial metrics, identify missing data, and produce a structured summary.



The orchestration layer must use real application services and authorized database queries.



It must never rely on conversational memory as the authoritative source of financial information.



Use persistent business records as the source of truth.



Maintain separate, appropriately scoped conversation context for each organization and user.



The assistant must not access data outside the requesting user's permissions.



13. ACTION EXECUTION AND APPROVALS



The AI should eventually be capable of carrying out authorized business operations, not merely generating text.



Establish a controlled action architecture with:



- Defined tools and permitted operations.

- Input validation.

- Permission checks.

- Structured execution results.

- Audit logs.

- Error handling.

- Idempotency where appropriate.

- Confirmation requirements for consequential actions.



Examples of low-risk operations may include retrieving records, preparing summaries, and calculating totals.



Actions such as recording financial transactions, approving invoices, changing approved budgets, sending purchase orders, or initiating payments must follow explicit authorization rules.



The system must never claim that an action was completed unless the underlying operation actually succeeded.



14. RELIABILITY AND DATA INTEGRITY



Implement:



- Server-side validation.

- Database constraints.

- Appropriate access control.

- Row-level security where supported by the selected database.

- Organization-level data isolation.

- Auditable changes to important records.

- Safe error handling.

- Duplicate detection.

- Transaction-safe financial operations.

- Reliable handling of failed AI requests.

- Protection against unauthorized AI tool execution.

- Protection against malicious instructions embedded in uploaded documents.



Treat uploaded invoices and documents as untrusted data.



Instructions found inside a document must never override the application's security rules or the contractor's permissions.



Do not expose API keys or privileged credentials in client-side code.



Do not use hardcoded sample business data in production logic.



Seeded test data may be used in a separate development or testing environment.



15. INTERNATIONAL-READY ARCHITECTURE



Build the service with international expansion in mind.



Support configurable:



- Currencies.

- Time zones.

- Date formats.

- Languages.

- Regional settings.

- Measurement units.

- Tax configuration.



Do not hardcode one country's tax rules into the core financial engine.



Tax calculations must be based on explicit, configurable rules appropriate to the relevant jurisdiction.



Do not claim that the platform provides legally compliant accounting or tax reporting in a country unless the required rules and validations have actually been implemented.



The architecture should support future integrations with accounting systems, payment providers, document-processing services, and external construction tools.



Do not build unnecessary integrations during the initial phase.



16. TECHNICAL IMPLEMENTATION



Inspect the existing project and use its established stack where appropriate.



If the project is already configured with Supabase, use its existing setup where suitable.



If a database or backend is not configured, choose a compatible architecture that supports secure authentication, relational business data, server-side operations, and AI integration.



Use environment variables for credentials and provider configuration.



Keep AI orchestration, financial calculations, document processing, authorization, and database access in clearly separated service layers.



Create reusable business services instead of duplicating calculations across individual features.



Define clear schemas for AI inputs and outputs.



Validate AI-generated structured data before using it in business operations.



Add automated tests for important calculations, transaction states, organization isolation, and permission checks.



Document setup requirements and any external API dependencies.



Do not claim a feature is implemented when it depends on an unconfigured external service.



17. INITIAL IMPLEMENTATION MILESTONES



Build the product in the following order.



Milestone 1 — Foundation



- Inspect the project and confirm the architecture.

- Establish authentication and organization isolation.

- Create the core database schema and relationships.

- Implement project, supplier, expense, and invoice records.

- Establish financial calculation services.

- Implement validation and auditability.



Milestone 2 — Operational Functionality



- Implement project budgets and expense tracking.

- Implement invoice and receipt attachment handling.

- Implement supplier and procurement records.

- Implement labor-cost records.

- Implement financial summaries and project reports.



Milestone 3 — AI Intelligence



- Connect the AI to authorized business services.

- Implement natural-language queri

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b757c513-1c88-46a1-becf-722ef7cbb33b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
