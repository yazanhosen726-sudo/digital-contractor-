import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowUpRight, Package } from 'lucide-react';
import { BusinessScreen } from '@/components/BusinessScreen';
import { DateValue, EmptyRecords, FilterBar, Money, PendingFeature, SearchRecords } from '@/components/BusinessUi';
import { Totals } from '@/components/Screen';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/lib/language';
import { screenHead, sumCurrency, type BusinessRecords } from '@/lib/screen-data';

export const Route = createFileRoute('/_authenticated/procurement')({
  head: () => screenHead('Procurement', 'Review real purchase orders, suppliers, projects and expected delivery dates.'),
  component: ProcurementPage,
});

function ProcurementPage() {
  return <BusinessScreen title="Procurement">{data => <ProcurementContent data={data} />}</BusinessScreen>;
}

function ProcurementContent({ data }: { data: BusinessRecords }) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const projects = new Map(data.projects.map(project => [project.id, project.name]));
  const suppliers = new Map(data.suppliers.map(supplier => [supplier.id, supplier.name]));
  const orderValues = sumCurrency(data.purchase_orders.filter(order => order.status !== 'cancelled'), order => order.total_amount);
  const active = data.purchase_orders.filter(order => ['issued', 'partially_invoiced'].includes(order.status)).length;
  const rows = data.purchase_orders.filter(order => {
    const text = `${order.po_number} ${projects.get(order.project_id ?? '') ?? ''} ${suppliers.get(order.supplier_id) ?? ''} ${order.notes ?? ''}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (filter === 'all' || filter === order.status);
  });
  const statuses = ['draft', 'issued', 'partially_invoiced', 'closed', 'cancelled'] as const;

  return <div className="space-y-5">
    <SearchRecords value={search} onChange={setSearch} placeholder={t('Search PO, supplier, or project…')} />
    <section className="dc-record soft-shadow">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('Procurement overview')}</p><div className="mt-2"><Totals values={orderValues} /></div><p className="mt-1 text-xs text-muted-foreground">{t('Purchase order value, excluding cancelled orders')}</p></div><div className="rounded-xl bg-secondary px-4 py-3 text-end"><p className="font-semibold text-primary">{active} {t('Active POs')}</p><p className="text-xs text-muted-foreground">{data.purchase_orders.length} {t('total orders')}</p></div></div>
      <div className="mt-4 grid grid-cols-3 gap-2">{[['draft', 'Draft'], ['issued', 'Issued'], ['closed', 'Closed']].map(([status, label]) => <div key={status} className="rounded-lg bg-secondary/60 p-3"><p className="text-xs text-muted-foreground">{t(label)}</p><p className="mt-1 text-xl font-bold">{data.purchase_orders.filter(order => status === 'issued' ? ['issued', 'partially_invoiced'].includes(order.status) : order.status === status).length}</p></div>)}</div>
    </section>
    <FilterBar value={filter} onChange={setFilter} options={[{ value: 'all', label: t('All'), count: data.purchase_orders.length }, ...statuses.map(status => ({ value: status as string, label: t(status), count: data.purchase_orders.filter(order => order.status === status).length }))]} />
    {rows.length === 0 ? <EmptyRecords>{t('No purchase orders found')}</EmptyRecords> : <div className="grid gap-3 xl:grid-cols-2">{rows.map(order => <article key={order.id} className="dc-record soft-shadow">
      <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><Package className="size-5" /></span><div className="min-w-0"><p className="text-xs uppercase tracking-wide text-muted-foreground"><bdi>{order.po_number}</bdi></p><h2 className="mt-1 break-words font-semibold"><bdi>{suppliers.get(order.supplier_id) ?? t('Not available')}</bdi></h2></div></div><Badge variant="secondary">{t(order.status)}</Badge></div>
      <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-secondary/50 p-3 text-sm"><div><p className="text-xs text-muted-foreground">{t('Project')}</p><p className="mt-1 break-words font-medium"><bdi>{projects.get(order.project_id ?? '') ?? t('No linked project')}</bdi></p></div><div><p className="text-xs text-muted-foreground">{t('Supplier')}</p><p className="mt-1 break-words font-medium"><bdi>{suppliers.get(order.supplier_id) ?? t('Not available')}</bdi></p></div></div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs text-muted-foreground">{t('Amount')}</p><Money value={order.total_amount} currency={order.currency} /></div><div className="text-end text-xs text-muted-foreground"><p>{t('Order date')}: <DateValue value={order.order_date} /></p><p className="mt-1">{t('Expected delivery')}: <DateValue value={order.expected_delivery_date} /></p></div></div>
      {order.project_id && projects.has(order.project_id) && <Link to="/projects/$projectId" params={{ projectId: order.project_id }} className="mt-4 inline-flex items-center gap-1 border-t pt-3 text-sm font-medium text-primary">{t('View project')}<ArrowUpRight className="size-4" /></Link>}
    </article>)}</div>}
    <PendingFeature title={t('Purchase estimates pending')} description={t('New material requests, bids and shipment tracking are not connected yet. Existing purchase orders remain available above.')} />
  </div>;
}
