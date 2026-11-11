import { useState } from 'react';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, LayoutDashboard, Receipt, FileText, ChartNoAxesCombined, Package, Menu, X, LogOut, Languages } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/language';

const navigation = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Projects', icon: Building2, to: '/projects' },
  { label: 'Expenses', icon: Receipt, to: '/expenses' },
  { label: 'Invoices', icon: FileText, to: '/invoices' },
  { label: 'Financial analytics', icon: ChartNoAxesCombined, to: '/analytics' },
  { label: 'Procurement', icon: Package, to: '/procurement' },
] as const;

export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  return <Button variant="ghost" size="sm" aria-label="Switch language" onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}><Languages className="size-4" /><span lang={language === 'en' ? 'ar' : 'en'}>{language === 'en' ? 'العربية' : 'English'}</span></Button>;
}

export function AppHeader({ orgName }: { orgName?: string | undefined }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  async function signOut() { await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); void navigate({ to: '/auth', replace: true }); }
  const selected = navigation.find(item => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)) ?? navigation[0];
  const links = navigation.map(({ label, icon: Icon, to }) => <Link key={to} to={to} onClick={() => setOpen(false)} aria-current={selected.to === to ? 'page' : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm ${selected.to === to ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/80 hover:bg-sidebar-accent'}`}><Icon className="size-5 shrink-0" />{t(label)}</Link>);

  return <>
    <aside className="shell-sidebar dc-sidebar fixed inset-y-0 z-40 hidden w-60 flex-col border-e lg:flex"><div className="flex items-center gap-3 px-6 py-7"><span className="dc-logo">DC</span><span className="text-sm font-semibold">{t('Digital Contractor')}</span></div><p className="px-6 pb-6 text-sm"><bdi>{orgName ?? t('Your business')}</bdi></p><nav className="space-y-1 px-3">{links}</nav><Button variant="ghost" className="m-3 mt-auto justify-start text-sidebar-foreground" onClick={() => void signOut()}><LogOut className="size-4" />{t('Sign out')}</Button></aside>
    <header className="dc-header sticky top-0 z-30 border-b bg-background/95 backdrop-blur"><div className="flex h-16 items-center justify-between gap-2 px-4 sm:px-6"><div className="flex min-w-0 items-center gap-2"><Button variant="ghost" size="icon" className="lg:hidden" aria-label={t('Menu')} onClick={() => setOpen(true)}><Menu className="size-5" /></Button><span className="dc-logo">DC</span><div className="min-w-0"><p className="text-[10px] uppercase text-muted-foreground">{t('Digital Contractor')}</p><p className="truncate text-sm font-semibold">{t(selected.label)}</p></div></div><LanguageSwitch /></div></header>
    <nav className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card/95 backdrop-blur lg:hidden">{navigation.filter(item => item.label !== 'Financial analytics').map(({ label, icon: Icon, to }) => <Link key={to} to={to} aria-current={selected.to === to ? 'page' : undefined} className={`flex min-w-0 flex-col items-center gap-1 px-1 py-3 ${selected.to === to ? 'text-primary' : 'text-muted-foreground'}`}><Icon className="size-5" /><span className="text-center text-[10px]">{t(label)}</span></Link>)}</nav>
    {open && <div className="fixed inset-0 z-50 bg-overlay lg:hidden"><div className="shell-sidebar flex h-full w-72 max-w-[85vw] flex-col p-4"><div className="mb-5 flex items-center justify-between"><b>{t('Digital Contractor')}</b><Button variant="ghost" size="icon" aria-label={t('Close')} onClick={() => setOpen(false)}><X /></Button></div><nav>{links}</nav><Button variant="ghost" className="mt-auto text-sidebar-foreground" onClick={() => void signOut()}><LogOut />{t('Sign out')}</Button></div></div>}
  </>;
}
