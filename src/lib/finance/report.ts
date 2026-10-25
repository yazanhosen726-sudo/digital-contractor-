import { toCents, centsToString, percent } from './money';
import { convert, type ExchangeRateRow } from './fx';

type Amount = number | string;
export interface Cost { id: string; project_id: string | null; category_id: string | null; supplier_id: string | null; purchase_order_id: string | null; currency: string; total_amount: Amount; transaction_date: string; status: string; approval_status: string; needs_review: boolean }
export interface Invoice { id: string; project_id: string | null; currency: string; total_amount: Amount; status: string }
export interface Cash { expense_id: string | null; receivable_id: string | null; project_id: string | null; currency: string; amount: Amount; direction: string }
export interface Project { id: string; name: string; currency: string; original_budget: Amount | null; contract_value: Amount | null }
export interface Commitment { id: string; project_id: string | null; currency: string; total_amount: Amount; status: string; order_date: string }
export interface Revision { project_id: string; amount_delta: Amount; status: string }
export function isActual(e: Cost) { return e.status === 'recorded' && (e.approval_status === 'approved' || e.approval_status === 'not_required'); }
function grouped<T>(rows: T[], currency: (row: T) => string, amount: (row: T) => bigint) {
  const totals: Record<string, bigint> = {};
  for (const row of rows) { const code = currency(row); totals[code] = (totals[code] ?? 0n) + amount(row); }
  return Object.fromEntries(Object.entries(totals).map(([c, n]) => [c, centsToString(n)]));
}
export function financialReport(data: { projects: Project[]; expenses: Cost[]; receivables: Invoice[]; payments: Cash[]; purchase_orders: Commitment[]; budget_revisions: Revision[]; exchange_rates: ExchangeRateRow[] }) {
  const actual = data.expenses.filter(isActual);
  const issued = data.receivables.filter(r => r.status === 'issued');
  const paid = (id: string, kind: 'expense_id' | 'receivable_id') => data.payments.filter(p => p[kind] === id).reduce((sum, p) => sum + toCents(p.amount), 0n);
  const projectReports = data.projects.map(project => {
    const issues: string[] = [];
    let costs = 0n;
    for (const expense of actual.filter(e => e.project_id === project.id)) {
      const result = convert({ cents: toCents(expense.total_amount), currency: expense.currency }, project.currency, expense.transaction_date, data.exchange_rates);
      if (result.converted) costs += result.converted.cents; else issues.push(result.reason ?? 'Exchange rate missing');
    }
    let commitments = 0n;
    for (const po of data.purchase_orders.filter(p => p.project_id === project.id && ['issued','partially_invoiced'].includes(p.status))) {
      const invoiced = actual.filter(e => e.purchase_order_id === po.id && e.currency === po.currency).reduce((sum, e) => sum + toCents(e.total_amount), 0n);
      if (actual.some(e => e.purchase_order_id === po.id && e.currency !== po.currency)) { issues.push('Purchase order and invoice currencies differ; commitment cannot be reconciled'); continue; }
      const remaining = toCents(po.total_amount) - invoiced;
      const converted = convert({ cents: remaining > 0n ? remaining : 0n, currency: po.currency }, project.currency, po.order_date, data.exchange_rates);
      if (converted.converted) commitments += converted.converted.cents; else issues.push(converted.reason ?? 'Exchange rate missing');
    }
    const approvedBudget = project.original_budget === null ? null : toCents(project.original_budget) + data.budget_revisions.filter(r => r.project_id === project.id && r.status === 'approved').reduce((sum, r) => sum + toCents(r.amount_delta),0n);
    const complete = issues.length === 0;
    return { id: project.id, name: project.name, currency: project.currency, originalBudget: project.original_budget === null ? null : centsToString(toCents(project.original_budget)), approvedBudget: approvedBudget === null ? null : centsToString(approvedBudget), actualCost: complete ? centsToString(costs) : null, commitments: complete ? centsToString(commitments) : null, remainingBudget: complete && approvedBudget !== null ? centsToString(approvedBudget - costs) : null, availableAfterCommitments: complete && approvedBudget !== null ? centsToString(approvedBudget - costs - commitments) : null, budgetConsumption: complete && approvedBudget !== null ? percent(costs, approvedBudget) : null, projectedMargin: complete && project.contract_value !== null ? centsToString(toCents(project.contract_value) - costs - commitments) : null, issues };
  });
  return {
    actualCosts: grouped(actual, e => e.currency, e => toCents(e.total_amount)),
    payables: grouped(data.expenses.filter(e => e.status === 'recorded'), e => e.currency, e => toCents(e.total_amount) - paid(e.id,'expense_id')),
    receivables: grouped(issued, e => e.currency, e => toCents(e.total_amount) - paid(e.id,'receivable_id')),
    invoicedRevenue: grouped(issued, e => e.currency, e => toCents(e.total_amount)),
    cashIn: grouped(data.payments.filter(p => p.direction === 'incoming'), p => p.currency, p => toCents(p.amount)),
    cashOut: grouped(data.payments.filter(p => p.direction === 'outgoing'), p => p.currency, p => toCents(p.amount)),
    netCash: grouped(data.payments, p => p.currency, p => p.direction === 'incoming' ? toCents(p.amount) : -toCents(p.amount)),
    reviewCount: data.expenses.filter(e => e.status !== 'void' && e.needs_review).length,
    projects: projectReports,
  };
}