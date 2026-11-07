import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { ArrowUpRight, BriefcaseBusiness, CalendarDays, CheckCircle2, ChevronRight, CircleDollarSign, Filter, Plus, Search, Sparkles, TrendingUp, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { membershipQuery, projectsQuery, WRITE_ROLES } from "@/lib/org";
import { projectInput } from "@/lib/contractor.schemas";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Overview — Buildwell" }, { name: "description", content: "Your construction operations at a glance." }] }),
  component: Dashboard,
});

const usd = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const statusLabel = (status: string) => status.replaceAll("_", " ");

function Dashboard() {
  const { data: membership, isLoading, error } = useQuery(membershipQuery);
  if (isLoading) return <p className="p-8 text-muted-foreground">Loading your workspace…</p>;
  if (error) return <p className="p-8 text-destructive">{error.message}</p>;
  const org = membership?.organizations;
  if (!org) return <><AppHeader /><CreateOrg /></>;
  return <><AppHeader orgName={org.name} /><Workspace orgId={org.id} canWrite={WRITE_ROLES.includes(membership.role)} /></>;
}

function Workspace({ orgId, canWrite }: { orgId: string; canWrite: boolean }) {
  const { data: projects = [], isLoading } = useQuery(projectsQuery(orgId));
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const filtered = useMemo(() => projects.filter(project => {
    const matchesSearch = `${project.name} ${project.code} ${project.location ?? ""}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (filter === "all" || project.status === filter);
  }), [filter, projects, search]);
  const active = projects.filter(project => project.status === "active").length;
  const totalValue = projects.reduce((sum, project) => sum + Number(project.contract_value ?? 0), 0);
  const totalBudget = projects.reduce((sum, project) => sum + Number(project.original_budget ?? 0), 0);

  return (
    <main className="min-h-[calc(100vh-4rem)] lg:ml-64">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-sm font-medium text-accent">Thursday, November 6, 2026</p><h1 className="display-serif mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Good morning, Rajesh.</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">Here is the operational pulse across your construction business.</p></div>
          <div className="flex gap-2">{canWrite && <Button onClick={() => setShowNew(!showNew)} className="rounded-xl"><Plus className="mr-2 size-4" />New project</Button>}<Button variant="outline" className="hidden rounded-xl sm:flex"><CalendarDays className="mr-2 size-4" />This month</Button></div>
        </div>

        {showNew && <NewProject orgId={orgId} onDone={() => setShowNew(false)} />}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Active projects" value={String(active)} helper={`${projects.length} total in workspace`} icon={BriefcaseBusiness} tone="dark" />
          <MetricCard label="Contract value" value={usd(totalValue)} helper="Across all projects" icon={CircleDollarSign} tone="sand" />
          <MetricCard label="Allocated budget" value={usd(totalBudget)} helper="Original project budgets" icon={WalletCards} tone="white" />
          <MetricCard label="Delivery health" value={projects.length ? "On track" : "—"} helper="Based on current project status" icon={TrendingUp} tone="white" />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="soft-shadow rounded-2xl border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Project value overview</h2><p className="mt-1 text-sm text-muted-foreground">Contract value compared with allocated budget.</p></div><Badge variant="outline" className="rounded-full">Live workspace data</Badge></div>
            <div className="mt-7 flex items-end gap-2 sm:gap-4" style={{ minHeight: 170 }}>
              {[{ label: "Contract", value: totalValue, color: "bg-primary" }, { label: "Budget", value: totalBudget, color: "bg-accent" }].map(bar => <div key={bar.label} className="flex flex-1 flex-col items-center gap-3"><div className="flex h-36 w-full max-w-24 items-end rounded-xl bg-muted p-1"><div className={`w-full rounded-lg ${bar.color} transition-all`} style={{ height: `${Math.max(8, Math.min(100, totalBudget ? (bar.value / Math.max(totalBudget, totalValue, 1)) * 100 : 8))}%` }} /></div><div className="text-center"><p className="text-xs text-muted-foreground">{bar.label}</p><p className="mt-0.5 text-sm font-semibold">{usd(bar.value)}</p></div></div>)}
              <div className="ml-auto hidden max-w-[260px] flex-1 rounded-xl bg-[#f1e6d5] p-4 sm:block"><div className="flex items-center gap-2 text-sm font-medium text-[#79531f]"><Sparkles className="size-4" />Planning insight</div><p className="mt-2 text-sm leading-6 text-[#6d5a3b]">Keep budgets and takeoff quantities aligned before issuing your next BOQ.</p></div>
            </div>
          </div>
          <div className="soft-shadow rounded-2xl border bg-primary p-5 text-primary-foreground sm:p-6"><div className="flex items-start justify-between"><div><p className="text-sm text-primary-foreground/60">Upcoming procurement</p><h2 className="mt-2 text-3xl font-semibold">3 <span className="text-base font-normal text-primary-foreground/60">items need review</span></h2></div><div className="rounded-xl bg-primary-foreground/10 p-2.5"><PackageIcon /></div></div><div className="mt-8 space-y-3">{["Cement · Foundation phase", "Steel reinforcement · Structure", "Electrical supplies · Fit-out"].map((item, index) => <div key={item} className="flex items-center gap-3 border-t border-primary-foreground/10 pt-3 text-sm"><span className={`size-2 rounded-full ${index === 0 ? "bg-accent" : "bg-primary-foreground/40"}`} /><span className="flex-1 text-primary-foreground/80">{item}</span><ChevronRight className="size-4 text-primary-foreground/40" /></div>)}</div><button type="button" className="mt-6 text-sm font-medium text-accent hover:underline">Open procurement planning <ArrowUpRight className="ml-1 inline size-3.5" /></button></div>
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-semibold">Your projects</h2><p className="mt-1 text-sm text-muted-foreground">Every active build, one clear view.</p></div><div className="flex w-full gap-2 sm:w-auto"><div className="relative flex-1 sm:w-64"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search projects" className="rounded-xl pl-9" /></div><select aria-label="Filter projects" value={filter} onChange={event => setFilter(event.target.value)} className="rounded-xl border bg-card px-3 text-sm"><option value="all">All status</option><option value="active">Active</option><option value="planning">Planning</option><option value="on_hold">On hold</option><option value="completed">Completed</option></select><Button variant="outline" size="icon" className="rounded-xl sm:hidden"><Filter className="size-4" /></Button></div></div>
          {isLoading ? <p className="mt-6 text-muted-foreground">Loading projects…</p> : filtered.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed bg-card p-10 text-center"><CheckCircle2 className="mx-auto size-8 text-muted-foreground/50" /><p className="mt-3 font-medium">No matching projects</p><p className="mt-1 text-sm text-muted-foreground">Try a different search or create a new project.</p></div> : <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map(project => <ProjectCard key={project.id} project={project} />)}</div>}
        </section>
      </div>
      <nav className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-30 flex border-t bg-card/95 px-4 py-2 backdrop-blur lg:hidden"><Link to="/dashboard" className="flex flex-1 flex-col items-center gap-1 py-1 text-accent"><LayoutIcon /><span className="text-[10px] font-medium">Overview</span></Link><Link to="/dashboard" className="flex flex-1 flex-col items-center gap-1 py-1 text-muted-foreground"><BriefcaseBusiness className="size-5" /><span className="text-[10px]">Projects</span></Link><Link to="/dashboard" className="flex flex-1 flex-col items-center gap-1 py-1 text-muted-foreground"><PackageIcon /><span className="text-[10px]">Buy</span></Link><Link to="/dashboard" className="flex flex-1 flex-col items-center gap-1 py-1 text-muted-foreground"><MessageIcon /><span className="text-[10px]">Assistant</span></Link></nav>
    </main>
  );
}

function MetricCard({ label, value, helper, icon: Icon, tone }: { label: string; value: string; helper: string; icon: typeof BriefcaseBusiness; tone: "dark" | "sand" | "white" }) {
  const classes = tone === "dark" ? "bg-primary text-primary-foreground" : tone === "sand" ? "bg-[#f1e6d5] text-[#362a1a]" : "bg-card";
  return <div className={`card-hover soft-shadow rounded-2xl border p-5 ${classes}`}><div className="flex items-center justify-between"><p className={`text-sm ${tone === "white" ? "text-muted-foreground" : "opacity-65"}`}>{label}</p><Icon className={`size-5 ${tone === "white" ? "text-accent" : "opacity-70"}`} /></div><p className="mt-5 text-2xl font-semibold tracking-tight">{value}</p><p className={`mt-1 text-xs ${tone === "white" ? "text-muted-foreground" : "opacity-60"}`}>{helper}</p></div>;
}

function ProjectCard({ project }: { project: { id: string; name: string; code: string; location: string | null; status: string; original_budget: number | string; contract_value: number | string } }) {
  const progress = project.status === "completed" ? 100 : project.status === "active" ? 64 : project.status === "on_hold" ? 32 : 12;
  return <Link to="/projects/$projectId" params={{ projectId: project.id }} className="card-hover soft-shadow group rounded-2xl border bg-card p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{project.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{project.code}{project.location ? ` · ${project.location}` : ""}</p></div><Badge variant={project.status === "active" ? "default" : "secondary"} className="rounded-full capitalize">{statusLabel(project.status)}</Badge></div><div className="mt-7"><div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Project progress</span><span className="font-semibold">{progress}%</span></div><div className="mt-2 h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} /></div></div><div className="mt-5 flex items-end justify-between border-t pt-4"><div><p className="text-xs text-muted-foreground">Contract value</p><p className="mt-1 font-semibold">{usd(Number(project.contract_value ?? 0))}</p></div><ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div></Link>;
}

function CreateOrg() {
  const qc = useQueryClient(); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const name = String(new FormData(event.currentTarget).get("name")).trim(); if (!name) return; setBusy(true); const { error } = await supabase.rpc("create_organization", { _name: name, _currency: "USD" }); setBusy(false); if (error) { toast.error(error.message); return; } toast.success("Business created"); qc.invalidateQueries({ queryKey: ["membership"] }); }
  return <main className="mx-auto max-w-md px-4 py-20"><p className="text-sm font-medium text-accent">Welcome to Buildwell</p><h1 className="display-serif mt-2 text-4xl font-semibold">Set up your business</h1><p className="mt-3 text-muted-foreground">Create your workspace to start managing projects, budgets, and procurement.</p><form onSubmit={submit} className="mt-8 space-y-4 rounded-2xl border bg-card p-5 soft-shadow"><div className="space-y-2"><Label htmlFor="name">Business name</Label><Input id="name" name="name" required maxLength={200} placeholder="e.g. Maurya Construction" /></div><Button disabled={busy} className="w-full">Create workspace</Button></form></main>;
}

function PackageIcon() { return <Package className="size-5" />; }
function LayoutIcon() { return <LayoutDashboard className="size-5" />; }
function MessageIcon() { return <MessageSquare className="size-5" />; }
