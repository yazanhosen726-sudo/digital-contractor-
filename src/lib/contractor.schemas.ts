import { z } from 'zod';
export const orgInput = z.object({ orgId: z.string().uuid() });
const text = z.string().trim().min(1).max(300);
const currency = z.string().regex(/^[A-Z]{3}$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s, 'Invalid date');
export const amount = z.string().regex(/^\d{1,14}(\.\d{1,2})?$/, 'Enter a positive amount with at most two decimal places');
const optionalId = z.string().uuid().nullable();
export const projectInput = orgInput.extend({ name: text, code: text, location: z.string().max(500), currency, original_budget: amount, contract_value: amount, status: z.enum(['planning','active','on_hold','completed','cancelled']) });
export const projectInsertInput = projectInput.transform(({ orgId, original_budget, contract_value, ...project }) => ({
  ...project, org_id: orgId, original_budget: Number(original_budget), contract_value: Number(contract_value),
}));
export const supplierInput = orgInput.extend({ name: text, email: z.union([z.literal(''),z.string().email().max(255)]), phone: z.string().max(80), notes: z.string().max(2000) });
export const expenseInput = orgInput.extend({ description: text, project_id: optionalId, category_id: optionalId, supplier_id: optionalId, purchase_order_id: optionalId, document_id: optionalId, invoice_number: z.string().max(100), transaction_date: date, due_date: date.nullable(), currency, subtotal: amount, discount_amount: amount, tax_amount: amount, is_general_overhead: z.boolean() });
export const invoiceInput = orgInput.extend({ project_id: optionalId, reference: text, issue_date: date, due_date: date.nullable(), currency, total_amount: amount.refine(v => Number(v)>0) });
export const paymentInput = orgInput.extend({ direction: z.enum(['incoming','outgoing']), target_id: z.string().uuid(), payment_date: date, currency, amount: amount.refine(v => Number(v)>0), method: z.string().max(100), idempotency_key: z.string().uuid() });
export const workerInput = orgInput.extend({ name: text, trade: z.string().max(200), currency, default_rate: amount, arrangement: z.enum(['hourly','daily','fixed','subcontractor']) });
export const laborInput = orgInput.extend({ worker_id: z.string().uuid(), project_id: optionalId, work_date: date, quantity: z.string().regex(/^\d{1,7}(\.\d{1,2})?$/).refine(v => Number(v)>0), unit: z.enum(['hours','days','lump_sum']), rate: amount, currency, planned: z.boolean() });
export const orderInput = orgInput.extend({ supplier_id: z.string().uuid(), project_id: optionalId, po_number: text, order_date: date, currency, total_amount: amount, status: z.enum(['draft','issued','partially_invoiced','closed','cancelled']) });
export const revisionInput = orgInput.extend({ project_id: z.string().uuid(), amount_delta: z.string().regex(/^-?\d{1,14}(\.\d{1,2})?$/).refine(v => Number(v)!==0), reason: text });
export const revisionDecision = orgInput.extend({ id: z.string().uuid(), status: z.enum(['approved','rejected']) });
export const documentInput = orgInput.extend({ id: z.string().uuid(), project_id: optionalId, file_name: text, mime_type: z.enum(['application/pdf','image/jpeg','image/png','image/webp']), size_bytes: z.number().int().positive().max(20*1024*1024), kind: z.enum(['invoice','receipt','contract','drawing','photo','other']) });