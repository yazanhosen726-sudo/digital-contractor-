import { useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Building2, ChevronDown, LayoutDashboard, LogOut, Menu, MessageSquare, Package, Search, Settings, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const navigation = [
  { label: "Overview", icon: LayoutDashboard, to: "/dashboard" as const },
  { label: "Projects", icon: Building2, to: "/dashboard" as const },
  { label: "Procurement", icon: Package, to: "/dashboard" as const },
  { label: "AI Assistant", icon: MessageSquare, to: "/dashboard" as const },
];

export function AppHeader({ orgName }: { orgName?: string | undefined }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <>
      <aside className="shell-sidebar fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border lg:flex">
        <div className="flex h-20 items-center gap-3 px-7">
          <div className="grid size-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><Building2 className="size-5" /></div>
          <div><p className="font-semibold tracking-tight">Buildwell</p><p className="text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/50">Contractor OS</p></div>
        </div>
        <div className="px-4"><div className="rounded-xl bg-sidebar-accent px-3 py-3"><p className="text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/50">Workspace</p><p className="mt-1 truncate text-sm font-medium">{orgName ?? "Your business"}</p></div></div>
        <nav className="mt-8 flex-1 space-y-1 px-4">
          <p className="mb-3 px-3 text-[10px] font-medium uppercase tracking-[0.18em] text-sidebar-foreground/40">Workspace</p>
          {navigation.map(({ label, icon: Icon, to }, index) => <Link key={label} to={to} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${index === 0 && location.pathname === "/dashboard" ? "bg-sidebar-primary font-medium text-sidebar-primary-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"}`}><Icon className="size-4" />{label}{label === "Procurement" && <span className="ml-auto rounded-full bg-sidebar-primary/20 px-1.5 py-0.5 text-[10px] text-sidebar-primary">3</span>}</Link>)}
          <p className="mb-3 mt-8 px-3 text-[10px] font-medium uppercase tracking-[0.18em] text-sidebar-foreground/40">Manage</p>
          <Link to="/dashboard" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"><Package className="size-4" />Documents</Link>
          <Link to="/dashboard" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"><Settings className="size-4" />Settings</Link>
        </nav>
        <div className="border-t border-sidebar-border p-4"><button type="button" onClick={() => void signOut()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"><LogOut className="size-4" />Sign out</button></div>
      </aside>

      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur lg:ml-64">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button type="button" aria-label="Open navigation" onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-muted lg:hidden"><Menu className="size-5" /></button>
          <Link to="/dashboard" className="flex items-center gap-2 lg:hidden"><span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Building2 className="size-4" /></span><span className="font-semibold">Buildwell</span></Link>
          <div className="relative ml-auto hidden w-full max-w-sm md:block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input className="h-9 w-full rounded-xl border bg-card pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" placeholder="Search projects, documents…" /></div>
          <button type="button" aria-label="Notifications" className="relative rounded-xl border bg-card p-2.5 hover:bg-muted"><Bell className="size-4" /><span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-accent" /></button>
          <button type="button" className="flex items-center gap-2 rounded-xl border bg-card py-1.5 pl-1.5 pr-2.5 hover:bg-muted"><span className="grid size-7 place-items-center rounded-lg bg-soft-accent bg-[#f1e6d5] text-xs font-semibold text-[#7d5724]">RM</span><span className="hidden text-sm font-medium sm:inline">Rajesh Maurya</span><ChevronDown className="size-3.5 text-muted-foreground" /></button>
        </div>
      </header>

      {open && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Close navigation" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} /><div className="shell-sidebar relative flex h-full w-72 flex-col shadow-2xl"><div className="flex h-20 items-center justify-between px-6"><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><Building2 className="size-5" /></div><p className="font-semibold">Buildwell</p></div><button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-sidebar-accent"><X className="size-5" /></button></div><nav className="space-y-1 px-4">{navigation.map(({ label, icon: Icon, to }) => <Link key={label} to={to} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent"><Icon className="size-4" />{label}</Link>)}</nav><button type="button" onClick={() => void signOut()} className="mt-auto flex items-center gap-3 border-t border-sidebar-border px-7 py-5 text-sm text-sidebar-foreground/70"><LogOut className="size-4" />Sign out</button></div></div>}
    </>
  );
}
