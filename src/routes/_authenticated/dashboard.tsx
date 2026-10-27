import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
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
  head: () => ({
    meta: [
      { title: "Projects — Digital Contractor" },
      { name: "description", content: "Your construction projects and budgets." },
      { property: "og:title", content: "Projects — Digital Contractor" },
      { property: "og:description", content: "Your construction projects and budgets." },
    ],
  }),
  component: Dashboard,
});

const usd = (v: string | number | null) => (v === null ? "—" : Number(v).toLocaleString("en-US", { style: "currency", currency: "USD" }));

function Dashboard() {
  const { data: membership, isLoading, error } = useQuery(membershipQuery);
  if (isLoading) return <p className="p-8 text-muted-foreground">Loading…</p>;
  if (error) return <p className="p-8 text-destructive">{error.message}</p>;
  const org = membership?.organizations;
  if (!org) return (<><AppHeader /><CreateOrg /></>);
  return (
    <>
      <AppHeader orgName={org.name} />
      <Projects orgId={org.id} canWrite={WRITE_ROLES.includes(membership.role)} />
    </>
  );
}

function CreateOrg() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name")).trim();
    if (!name) return;
    setBusy(true);
    const { error } = await supabase.rpc("create_organization", { _name: name, _currency: "USD" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Business created");
    qc.invalidateQueries({ queryKey: ["membership"] });
  }
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">Set up your business</h1>
      <p className="mt-1 text-sm text-muted-foreground">You'll be the owner. Amounts are in USD.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-1"><Label htmlFor="name">Business name</Label><Input id="name" name="name" required maxLength={200} /></div>
        <Button disabled={busy}>Create business</Button>
      </form>
    </main>
  );
}

function Projects({ orgId, canWrite }: { orgId: string; canWrite: boolean }) {
  const { data: projects = [], isLoading } = useQuery(projectsQuery(orgId));
  const [open, setOpen] = useState(false);
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        {canWrite && <Button onClick={() => setOpen(!open)}>{open ? "Cancel" : "New project"}</Button>}
      </div>
      {open && <NewProject orgId={orgId} onDone={() => setOpen(false)} />}
      {isLoading ? <p className="mt-6 text-muted-foreground">Loading…</p> : projects.length === 0 ? (
        <p className="mt-6 text-muted-foreground">No projects yet.</p>
      ) : (
        <ul className="mt-6 divide-y rounded-lg border bg-card">
          {projects.map((p) => (
            <li key={p.id}>
              <Link to="/projects/$projectId" params={{ projectId: p.id }} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-muted/50">
                <div><p className="font-medium">{p.name}</p><p className="text-sm text-muted-foreground">{p.code}{p.location ? ` · ${p.location}` : ""}</p></div>
                <div className="flex items-center gap-3 text-sm"><span>Budget {usd(p.original_budget)}</span><Badge variant="secondary">{p.status.replace("_", " ")}</Badge></div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function NewProject({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const parsed = projectInput.safeParse({ orgId, name: f["name"], code: f["code"], location: f["location"] ?? "", currency: "USD", original_budget: f["original_budget"], contract_value: f["contract_value"], status: "planning" });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Check the form"); return; }
    const { orgId: org_id, ...rest } = parsed.data;
    setBusy(true);
    const { error } = await supabase.from("projects").insert({ org_id, ...rest, location: rest.location || null, // exact decimal strings; the database stores numeric without float rounding
      original_budget: rest.original_budget as unknown as number, contract_value: rest.contract_value as unknown as number });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Project added");
    qc.invalidateQueries({ queryKey: ["projects", orgId] });
    onDone();
  }
  return (
    <form onSubmit={submit} className="mt-6 grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
      <div className="space-y-1"><Label htmlFor="name">Project name</Label><Input id="name" name="name" required /></div>
      <div className="space-y-1"><Label htmlFor="code">Project code</Label><Input id="code" name="code" required placeholder="P-001" /></div>
      <div className="space-y-1"><Label htmlFor="location">Location</Label><Input id="location" name="location" /></div>
      <div className="space-y-1"><Label htmlFor="original_budget">Budget (USD)</Label><Input id="original_budget" name="original_budget" inputMode="decimal" required placeholder="0.00" /></div>
      <div className="space-y-1"><Label htmlFor="contract_value">Contract value (USD)</Label><Input id="contract_value" name="contract_value" inputMode="decimal" required placeholder="0.00" /></div>
      <div className="flex items-end"><Button disabled={busy}>Save project</Button></div>
    </form>
  );
}
