import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { FileText } from 'lucide-react';
import { BusinessScreen } from '@/components/BusinessScreen';
import { DateValue, EmptyRecords, FilterBar, Money, PendingFeature, SearchRecords } from '@/components/BusinessUi';
import { Totals } from '@/components/Screen';
import { Badge } from '@/components/ui/badge';
import { centsToString, toCents } from '@/lib/finance/money';
import { financialReport } from '@/lib/finance/report';
import { useLanguage } from '@/lib/language';
import { screenHead, sumCurrency, type BusinessRecords } from '@/lib/screen-data';

export const Route = createFileRoute('/_authenticated/invoices')({
  head: () => screenHead('Invoices', 'Review client invoices, collected payments and outstanding balances.'),
  component: InvoicesPage,
});

function InvoicesPage() {
  return <BusinessScreen title="Invoices">{data => <InvoicesContent data={data} />}</BusinessScreen>;
}

function InvoicesContent({ data }: { data: BusinessRecords }) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const report = financialReport(data);
  const projects = new Map(data.projects.map(project => [project.id, project.name]));
  const paidFor = (id: string) => data.payments.filter(payment => payment.receivable_id === id && payment.direction === 'incoming').reduce((sum, payment) => sum + toCents(payment.amount), 0n);
  const collected = sumCurrency(data.payments.filter(payment => payment.receivable_id && payment.direction === 'incoming'), payment => payment.amount);
  const today = new Date().toISOString().slice(0, 10);
  const derivedStatus = (invoice: BusinessRecords['receivables'][number]) => {
    if (invoice.status === 'draft' || invoice.status === 'void') return invoice.status;
    const outstanding = toCents(invoice.total_amount) - paidFor(invoice.id);
    if (toCents(invoice.total_amount) > 0n && outstanding <= 0n) return 'paid';
    if (invoice.due_date && invoice.due_date < today) return 'overdue';
    return 'pending';
  };
  const rows = data.receivables.filter(invoice => {
    const status = derivedStatus(invoice);
    const text = `${invoice.reference} ${projects.get(invoice.project_id ?? '') ?? ''}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (filter === 'all' || filter === status || (filter === 'pending' && status === 'draft'));
  });
  const awaiting = data.receivables.filter(invoice => ['pending', 'overdue'].includes(derivedStatus(invoice))).length;

  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3">
      <section className="dc-record"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('Collected')}</p><Totals values={collected} /></section>
      <section className="dc-record"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('Outstanding')}</p><Totals values={report.receivables} /><p className="mt-2 text-xs text-muted-foreground">{awaiting} {t('awaiting payment')}</p></section>
    </div>
    <SearchRecords value={search} onChange={setSearch} placeholder={t('Search invoices…')} />
    <FilterBar value={filter} onChange={setFilter} options={[
      { value: 'all', label: t('All'), count: data.receivables.length },
      { value: 'paid', label: t('Paid') },
      { value: 'pending', label: t('Pending') },
      { value: 'overdue', label: t('Overdue') },
    ]} />
    {rows.length === 0 ? <EmptyRecords>{t('No invoices found')}</EmptyRecords> : <div className="grid gap-3 xl:grid-cols-2">{rows.map(invoice => {
      const status = derivedStatus(invoice);
      const paid = paidFor(invoice.id);
      return <article key={invoice.id} className="dc-record soft-shadow flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><FileText className="size-5" /></span><div className="min-w-0"><h2 className="break-words font-semibold"><bdi>{invoice.reference}</bdi></h2><p className="mt-1 text-sm"><bdi>{projects.get(invoice.project_id ?? '') ?? t('No linked project')}</bdi></p><p className="mt-1 text-xs text-muted-foreground"><DateValue value={invoice.issue_date} />{invoice.due_date ? <> · {t('Due date')}: <DateValue value={invoice.due_date} /></> : null}</p></div></div>
        <div className="text-end"><Money value={invoice.total_amount} currency={invoice.currency} /><div className="mt-1"><Badge variant={status === 'overdue' ? 'destructive' : 'secondary'}>{t(status)}</Badge></div>{paid > 0n && <p className="mt-2 text-xs text-muted-foreground">{t('Collected')}: <Money value={centsToString(paid)} currency={invoice.currency} className="font-medium" /></p>}</div>
      </article>;
    })}</div>}
    <PendingFeature title={t('Invoice generation pending')} description={t('New invoice generation is not connected yet. Existing invoices and payment-backed balances remain available.')} />
  </div>;
}
