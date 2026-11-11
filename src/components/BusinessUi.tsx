import { Clock3, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/lib/language';

export function Money({ value, currency, className = 'text-xl font-bold' }: { value: string | number | null | undefined; currency: string; className?: string }) {
  const { language, t } = useLanguage();
  if (value === null || value === undefined) return <span className="text-sm text-muted-foreground">{t('Not available')}</span>;
  return <bdi className={`break-words tabular-nums ${className}`}>{Number(value).toLocaleString(language === 'ar' ? 'ar' : 'en-US', { style: 'currency', currency })}</bdi>;
}

export function DateValue({ value }: { value: string | null }) {
  const { language, t } = useLanguage();
  if (!value) return <span>{t('Not available')}</span>;
  return <time dateTime={value}>{new Intl.DateTimeFormat(language === 'ar' ? 'ar' : 'en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`))}</time>;
}

export function SearchRecords({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  const { t } = useLanguage();
  return <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute start-3 top-3 size-4 text-muted-foreground" /><Input aria-label={t('Search records')} placeholder={placeholder} className="bg-card ps-9" value={value} onChange={event => onChange(event.target.value)} /></div>;
}

export function FilterBar({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: { value: string; label: string; count?: number }[] }) {
  return <div className="flex gap-2 overflow-x-auto pb-1">{options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold ${value === option.value ? 'bg-foreground text-background' : 'bg-card text-muted-foreground'}`}>{option.label}{option.count === undefined ? '' : ` (${option.count})`}</button>)}</div>;
}

export function PendingFeature({ title, description }: { title: string; description: string }) {
  return <section className="flex items-start gap-3 rounded-xl border border-dashed bg-secondary/45 p-4" aria-label={title}><Clock3 className="mt-0.5 size-5 shrink-0 text-primary" /><div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div></section>;
}

export function EmptyRecords({ children }: { children: string }) {
  return <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">{children}</p>;
}
