import type { ReactNode } from 'react';
import { AppHeader } from './AppHeader';
import { useLanguage } from '@/lib/language';
export function Screen({ title, orgName, children, action }: { title: string; orgName?: string | undefined; children: ReactNode; action?: ReactNode }) {
  const { t } = useLanguage();
  return <><AppHeader orgName={orgName} /><main className="dc-main"><div className="dc-content"><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">{t(title)}</h1>{action}</div>{children}</div></main></>;
}
export function Totals({ values }: { values: Record<string, string> }) {
  const { language, t } = useLanguage();
  return <div className="space-y-1">{Object.entries(values).length ? Object.entries(values).map(([currency, value]) => <bdi key={currency} className="block break-words text-2xl font-bold">{Number(value).toLocaleString(language === 'ar' ? 'ar' : 'en-US', { style: 'currency', currency })}</bdi>) : <span className="text-sm text-muted-foreground">{t('No currency totals')}</span>}</div>;
}