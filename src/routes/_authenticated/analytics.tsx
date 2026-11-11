import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BusinessScreen } from '@/components/BusinessScreen';
import { EmptyRecords, Money } from '@/components/BusinessUi';
import { Totals } from '@/components/Screen';
import { centsToString, toCents } from '@/lib/finance/money';
import { financialReport } from '@/lib/finance/report';
import { useLanguage } from '@/lib/language';
import { screenHead, type BusinessRecords } from '@/lib/screen-data';

export const Route = createFileRoute('/_authenticated/analytics')({
  head: () => screenHead('Financial analytics', 'Deterministic cash flow, cost, invoice and project financial reporting.'),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  return <BusinessScreen title="Financial analytics">{data => <AnalyticsContent data={data} />}</BusinessScreen>;
}

function AnalyticsContent({ data }: { data: BusinessRecords }) {
  const { t, language } = useLanguage();
  const [days, setDays] = useState(30);
  const [currency, setCurrency] = useState('');
  const cutoff = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const periodPayments = data.payments.filter(payment => payment.payment_date >= cutoff);
  const fullReport = financialReport(data);
  const periodReport = financialReport({ ...data, payments: periodPayments });
  const currencies = [...new Set(periodPayments.map(payment => payment.currency))];
  const chartCurrency = currencies.includes(currency) ? currency : currencies[0] ?? '';
  const daily = new Map<string, bigint>();
  for (const payment of periodPayments.filter(row => row.currency === chartCurrency)) {
    const amount = payment.direction === 'incoming' ? toCents(payment.amount) : -toCents(payment.amount);
    daily.set(payment.payment_date, (daily.get(payment.payment_date) ?? 0n) + amount);
  }
  const chart = [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, amount: Number(centsToString(amount)) }));
  const paidInvoices = data.receivables.filter(invoice => invoice.status === 'issued' && toCents(invoice.total_amount) > 0n && data.payments.filter(payment => payment.receivable_id === invoice.id && payment.direction === 'incoming').reduce((sum, payment) => sum + toCents(payment.amount), 0n) >= toCents(invoice.total_amount)).length;

  return <div className="space-y-5">
    <div className="grid grid-cols-4 rounded-xl bg-secondary p-1" aria-label={t('Payment period')}>{[7, 30, 90, 365].map(value => <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)} className={`rounded-lg py-2 text-xs font-semibold ${days === value ? 'bg-foreground text-background' : 'text-muted-foreground'}`}>{value === 365 ? '1Y' : `${value}D`}</button>)}</div>
    <section className="dc-record soft-shadow">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('Cash flow')}</p><h2 className="mt-1 font-semibold">{t('Payment activity by date')}</h2></div>{currencies.length > 0 && <select aria-label={t('Currency')} className="rounded-lg border bg-card p-2 text-sm" value={chartCurrency} onChange={event => setCurrency(event.target.value)}>{currencies.map(code => <option key={code}>{code}</option>)}</select>}</div>
      {chart.length === 0 ? <EmptyRecords>{t('No payment activity in this period')}</EmptyRecords> : <div className="h-56 w-full" dir="ltr"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={(date: string) => new Intl.DateTimeFormat(language === 'ar' ? 'ar' : 'en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))} fontSize={11} /><YAxis fontSize={11} width={55} /><Tooltip /><Area type="monotone" dataKey="amount" name={chartCurrency} stroke="var(--primary)" fill="var(--accent)" fillOpacity={0.2} /></AreaChart></ResponsiveContainer></div>}
    </section>
    <div className="grid gap-3 sm:grid-cols-3">{([['Cash in', periodReport.cashIn], ['Cash out', periodReport.cashOut], ['Net cash', periodReport.netCash]] as const).map(([label, values]) => <section key={label} className="dc-record"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(label)}</p><Totals values={values} /></section>)}</div>
    <h2 className="pt-2 text-lg font-bold">{t('Quick stats')}</h2>
    <div className="grid grid-cols-2 gap-3">
      <section className="dc-record"><p className="text-sm text-muted-foreground">{t('Total projects')}</p><p className="mt-2 text-2xl font-bold">{data.projects.length}</p></section>
      <section className="dc-record"><p className="text-sm text-muted-foreground">{t('Paid invoices')}</p><p className="mt-2 text-2xl font-bold">{paidInvoices}</p></section>
      <section className="dc-record"><p className="mb-2 text-sm text-muted-foreground">{t('Actual cost')}</p><Totals values={fullReport.actualCosts} /></section>
      <section className="dc-record"><p className="mb-2 text-sm text-muted-foreground">{t('Outstanding')}</p><Totals values={fullReport.receivables} /></section>
    </div>
    <section><h2 className="mb-3 text-lg font-bold">{t('Project financial summary')}</h2>{fullReport.projects.length === 0 ? <EmptyRecords>{t('No projects found')}</EmptyRecords> : <div className="grid gap-3 md:grid-cols-2">{fullReport.projects.map(project => <article key={project.id} className="dc-record"><h3 className="font-semibold"><bdi>{project.name}</bdi></h3><div className="mt-3 flex items-end justify-between gap-3"><div><p className="text-xs text-muted-foreground">{t('Actual cost')}</p><Money value={project.actualCost} currency={project.currency} /></div>{project.budgetConsumption !== null && <p className="text-sm text-muted-foreground">{project.budgetConsumption}% {t('budget used')}</p>}</div>{project.issues.length > 0 && <p className="mt-2 text-xs text-destructive">{project.issues.join(' · ')}</p>}</article>)}</div>}</section>
  </div>;
}
