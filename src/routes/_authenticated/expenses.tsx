import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { CalendarDays, Receipt } from 'lucide-react';
import { BusinessScreen } from '@/components/BusinessScreen';
import { DateValue, EmptyRecords, FilterBar, Money, PendingFeature, SearchRecords } from '@/components/BusinessUi';
import { Totals } from '@/components/Screen';
import { Badge } from '@/components/ui/badge';
import { financialReport } from '@/lib/finance/report';
import { useLanguage } from '@/lib/language';
import { screenHead, type BusinessRecords } from '@/lib/screen-data';

export const Route = createFileRoute('/_authenticated/expenses')({
  head: () => screenHead('Expenses', 'Review your organization’s recorded construction expenses and payment obligations.'),
  component: ExpensesPage,
});

function ExpensesPage() {
  return <BusinessScreen title="Expenses">{data => <ExpensesContent data={data} />}</BusinessScreen>;
}

function ExpensesContent({ data }: { data: BusinessRecords }) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const report = financialReport(data);
  const projects = new Map(data.projects.map(project => [project.id, project.name]));
  const suppliers = new Map(data.suppliers.map(supplier => [supplier.id, supplier.name]));
  const rows = data.expenses.filter(expense => {
    const text = `${expense.description} ${expense.invoice_number ?? ''} ${projects.get(expense.project_id ?? '') ?? ''} ${suppliers.get(expense.supplier_id ?? '') ?? ''}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (filter === 'all' || filter === expense.status || (filter === 'review' && expense.needs_review));
  });

  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2">
      <section className="dc-record"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('Actual cost')}</p><Totals values={report.actualCosts} /></section>
      <section className="dc-record"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('Payables')}</p><Totals values={report.payables} /></section>
    </div>
    <PendingFeature title={t('Add expense / Scan receipt')} description={t('Expense entry and receipt scanning are not connected yet. Existing records remain available below.')} />
    <SearchRecords value={search} onChange={setSearch} placeholder={t('Search vendor, project, or invoice…')} />
    <FilterBar value={filter} onChange={setFilter} options={[
      { value: 'all', label: t('All'), count: data.expenses.length },
      { value: 'recorded', label: t('recorded'), count: data.expenses.filter(row => row.status === 'recorded').length },
      { value: 'draft', label: t('draft'), count: data.expenses.filter(row => row.status === 'draft').length },
      { value: 'review', label: t('Review required'), count: report.reviewCount },
    ]} />
    <div className="flex items-center justify-between text-sm text-muted-foreground"><span>{t('Recent transactions')}</span><span>{t('Sorted by date')}</span></div>
    {rows.length === 0 ? <EmptyRecords>{t('No expenses found')}</EmptyRecords> : <div className="grid gap-3 xl:grid-cols-2">{rows.map(expense => <article key={expense.id} className="dc-record soft-shadow">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><Receipt className="size-5" /></span><div className="min-w-0"><h2 className="break-words font-semibold"><bdi>{expense.description}</bdi></h2><p className="mt-1 text-xs text-muted-foreground"><bdi>{projects.get(expense.project_id ?? '') ?? t('General business expense')}</bdi>{expense.supplier_id ? <> · <bdi>{suppliers.get(expense.supplier_id) ?? t('Not available')}</bdi></> : null}</p></div></div>
        <div className="text-end"><Money value={expense.total_amount} currency={expense.currency} /><div className="mt-1 flex flex-wrap justify-end gap-1"><Badge variant="secondary">{t(expense.status)}</Badge>{expense.needs_review && <Badge variant="outline">{t('Review required')}</Badge>}</div></div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" /><DateValue value={expense.transaction_date} /></span><span>{expense.document_id ? t('Document attached') : t('No attachment')}{expense.invoice_number ? ` · ${expense.invoice_number}` : ''}</span></div>
    </article>)}</div>}
  </div>;
}
