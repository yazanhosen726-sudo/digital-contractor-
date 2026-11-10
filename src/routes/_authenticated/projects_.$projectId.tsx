import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { membershipQuery, WRITE_ROLES } from "@/lib/org";
import { financialReport } from "@/lib/finance/report";
import { AppHeader } from "@/components/AppHeader";
import { Screen } from "@/components/Screen";
import { Badge } from "@/components/ui/badge";
import { ProjectDrawings } from "@/components/ProjectDrawings";
import { ProjectTakeoff } from "@/components/ProjectTakeoff";
import { ProjectBoq } from "@/components/ProjectBoq";
export const Route = createFileRoute("/_authenticated/projects_/$projectId")({
  head: () => ({
    meta: [
      { title: "Project — Digital Contractor" },
      { name: "description", content: "Project budget, costs and commitments." },
      { property: "og:title", content: "Project — Digital Contractor" },
      { property: "og:description", content: "Project budget, costs and commitments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectPage,
});

const STATUSES = ["planning", "active", "on_hold", "completed", "cancelled"] as const;
const usd = (v: string | null | undefined) => (v == null ? "Not available" : Number(v).toLocaleString("en-US", { style: "currency", currency: "USD" }));

function ProjectPage() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();
  const { data: membership } = useQuery(membershipQuery);
  const { data, isLoading, error } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const [p, e, po, br, r, pay, fx] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
        supabase.from("expenses").select("*").eq("project_id", projectId),
        supabase.from("purchase_orders").select("*").eq("project_id", projectId),
        supabase.from("budget_revisions").select("*").eq("project_id", projectId),
        supabase.from("receivables").select("*").eq("project_id", projectId),
        supabase.from("payments").select("*").eq("project_id", projectId),
        supabase.from("exchange_rates").select("*"),
      ]);
      const err = [p, e, po, br, r, pay, fx].find((x) => x.error)?.error;
      if (err) throw err;
      return { project: p.data, expenses: e.data ?? [], purchase_orders: po.data ?? [], budget_revisions: br.data ?? [], receivables: r.data ?? [], payments: pay.data ?? [], exchange_rates: fx.data ?? [] };
    },
  });

  if (isLoading) return <p className="p-8 text-muted-foreground">Loading…</p>;
  if (error) return <p className="p-8 text-destructive">{error.message}</p>;
  if (!data?.project) return (<><AppHeader /><p className="p-8">Project not found. <Link to="/projects" className="underline">Back to projects</Link></p></>);
  const project = data.project;
  const report = financialReport({ ...data, projects: [project] }).projects[0];
  const canWrite = membership ? WRITE_ROLES.includes(membership.role) : false;

  async function setStatus(status: (typeof STATUSES)[number]) {
    const { error } = await supabase.from("projects").update({ status }).eq("id", projectId);
    if (error) { toast.error(error.message); return; }
    toast.success("Status updated");
    qc.invalidateQueries({ queryKey: ["project", projectId] });
    qc.invalidateQueries({ queryKey: ["projects"] });
  }

  const stats: [string, string | null | undefined][] = [
    ["Original budget", report?.originalBudget],
    ["Approved budget", report?.approvedBudget],
    ["Actual cost", report?.actualCost],
    ["Open purchase commitments", report?.commitments],
    ["Remaining budget", report?.remainingBudget],
    ["Available after commitments", report?.availableAfterCommitments],
    ["Contract value", project.contract_value === null ? null : String(project.contract_value)],
    ["Projected margin", report?.projectedMargin],
  ];

  return (
    <Screen title="Projects" orgName={membership?.organizations?.name}>
        <Link to="/projects" className="text-sm text-muted-foreground underline">← All projects</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            <p className="text-sm text-muted-foreground">{project.code}{project.location ? ` · ${project.location}` : ""}</p>
          </div>
          {canWrite ? (
            <select aria-label="Project status" className="rounded-md border bg-background px-3 py-2 text-sm" value={project.status} onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
          ) : <Badge variant="secondary">{project.status.replace("_", " ")}</Badge>}
        </div>
        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(([label, v]) => (
            <div key={label} className="rounded-lg border bg-card p-4"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 text-lg font-semibold">{usd(v)}</dd></div>
          ))}
        </dl>
        {report?.budgetConsumption != null && <p className="mt-4 text-sm">Budget used: {report.budgetConsumption}%</p>}
        {report && report.issues.length > 0 && (
          <ul className="mt-4 list-disc pl-5 text-sm text-destructive">{report.issues.map((i) => <li key={i}>{i}</li>)}</ul>
        )}
        <p className="mt-6 text-sm text-muted-foreground">{data.expenses.length} costs · {data.purchase_orders.length} purchase orders · {data.receivables.length} client invoices recorded.</p>
        <ProjectDrawings projectId={project.id} orgId={project.org_id} canWrite={canWrite} />
        <ProjectTakeoff projectId={project.id} orgId={project.org_id} canWrite={canWrite} />
        <ProjectBoq projectId={project.id} canWrite={canWrite} />
    </Screen>
  );
}
