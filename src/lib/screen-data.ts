import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { centsToString, toCents } from '@/lib/finance/money';

export type BusinessRecords = {
  projects: Database['public']['Tables']['projects']['Row'][];
  expenses: Database['public']['Tables']['expenses']['Row'][];
  receivables: Database['public']['Tables']['receivables']['Row'][];
  payments: Database['public']['Tables']['payments']['Row'][];
  purchase_orders: Database['public']['Tables']['purchase_orders']['Row'][];
  budget_revisions: Database['public']['Tables']['budget_revisions']['Row'][];
  exchange_rates: Database['public']['Tables']['exchange_rates']['Row'][];
  suppliers: Database['public']['Tables']['suppliers']['Row'][];
};

export function sumCurrency<T extends { currency: string }>(rows: T[], amount: (row: T) => string | number) {
  const totals = new Map<string, bigint>();
  for (const row of rows) totals.set(row.currency, (totals.get(row.currency) ?? 0n) + toCents(amount(row)));
  return Object.fromEntries([...totals].map(([currency, cents]) => [currency, centsToString(cents)]));
}

export const businessRecordsQuery = (orgId: string) => queryOptions({
  queryKey: ['business-records', orgId],
  queryFn: async () => {
    const [projects, expenses, receivables, payments, purchase_orders, budget_revisions, exchange_rates, suppliers] = await Promise.all([
      supabase.from('projects').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
      supabase.from('expenses').select('*').eq('org_id', orgId).order('transaction_date', { ascending: false }),
      supabase.from('receivables').select('*').eq('org_id', orgId).order('issue_date', { ascending: false }),
      supabase.from('payments').select('*').eq('org_id', orgId),
      supabase.from('purchase_orders').select('*').eq('org_id', orgId).order('order_date', { ascending: false }),
      supabase.from('budget_revisions').select('*').eq('org_id', orgId),
      supabase.from('exchange_rates').select('*').eq('org_id', orgId),
      supabase.from('suppliers').select('*').eq('org_id', orgId),
    ]);
    const error = [projects, expenses, receivables, payments, purchase_orders, budget_revisions, exchange_rates, suppliers].find(result => result.error)?.error;
    if (error) throw error;
    return { projects: projects.data ?? [], expenses: expenses.data ?? [], receivables: receivables.data ?? [], payments: payments.data ?? [], purchase_orders: purchase_orders.data ?? [], budget_revisions: budget_revisions.data ?? [], exchange_rates: exchange_rates.data ?? [], suppliers: suppliers.data ?? [] };
  },
});
export function screenHead(title: string, description: string) {
  return { meta: [{ title: `${title} — DC` }, { name: 'description', content: description }, { property: 'og:title', content: `${title} — DC` }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] };
}