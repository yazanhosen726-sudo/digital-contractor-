import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createBoq, listBoqs } from "@/lib/boq.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BoqEditorDialog } from "@/components/BoqEditorDialog";
import { BOQ_PENDING } from "@/lib/drawing-workflow";

function GenerateBoqDialog({ projectId, open, onOpenChange, onCreated }: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (boqId: string) => void;
}) {
  const [title, setTitle] = useState("Bill of quantities");
  const [reference, setReference] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useServerFn(createBoq);

  async function submit() {
    setError(null);
    if (!title.trim()) { setError("Enter a title for the BOQ."); return; }
    setWorking(true);
    try {
      const created = await create({ data: { projectId, title: title.trim(), ...(reference.trim() ? { reference: reference.trim() } : {}) } });
      toast.success("BOQ draft generated from the takeoff.");
      onCreated(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the BOQ. Try again.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate BOQ</DialogTitle>
          <DialogDescription>Creates a draft with one line for each takeoff item. Lines can be edited before the BOQ is issued.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <label className="grid gap-1 text-sm font-medium">Title
            <Input value={title} maxLength={120} disabled={working} onChange={e => setTitle(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-medium">Reference (optional)
            <Input value={reference} maxLength={60} disabled={working} onChange={e => setReference(e.target.value)} placeholder="e.g. Tender 04" />
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={working} onClick={() => void submit()}>{working ? "Generating…" : "Generate draft"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectBoq({ projectId, canWrite }: { projectId: string; canWrite: boolean }) {
  const qc = useQueryClient();
  const list = useServerFn(listBoqs);
  const key = ["boqs", projectId];
  const { data, error, isPending } = useQuery({
    queryKey: key,
    queryFn: () => list({ data: { projectId } }),
  });
  const [generating, setGenerating] = useState(false);
  const [openBoqId, setOpenBoqId] = useState<string | null>(null);

  function opened(boqId: string) {
    setGenerating(false);
    setOpenBoqId(boqId);
    void qc.invalidateQueries({ queryKey: key });
  }

  const boqs = data?.boqs ?? [];

  return (
    <section className="mt-8 border-t pt-6" aria-label="Bill of quantities">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Bill of quantities</h2>
          <p className="text-sm text-muted-foreground">Generated from the quantity takeoff. Review and issue when every line is complete.</p>
        </div>
        {canWrite && <Button disabled={isPending || !!error || !data?.available} onClick={() => setGenerating(true)}><Plus className="mr-2 size-4" />Generate BOQ</Button>}
      </div>

      {isPending && <p className="mt-4 text-sm text-muted-foreground">Loading BOQs…</p>}
      {error && <p role="alert" className="mt-4 text-sm text-destructive">Could not load the BOQs: {error.message}</p>}

      {data && !data.available && <p className="mt-4 text-sm text-muted-foreground">{BOQ_PENDING}</p>}
      {data?.available && (
        <ul className="mt-6 space-y-3">
          {boqs.length === 0 && <li className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No BOQ yet. Generate one once the takeoff has items.</li>}
          {boqs.map(boq => (
            <li key={boq.id}>
              <button
                type="button"
                onClick={() => setOpenBoqId(boq.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0">
                  <span className="block break-words font-medium">{boq.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    Revision {boq.revision}{boq.reference ? ` · Ref ${boq.reference}` : ""} · Created {new Date(boq.created_at).toLocaleDateString()}
                  </span>
                </span>
                <Badge variant={boq.status === "issued" ? "default" : "outline"}>{boq.status === "issued" ? "Issued" : "Draft"}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}

      {generating && (
        <GenerateBoqDialog projectId={projectId} open onOpenChange={open => { if (!open) setGenerating(false); }} onCreated={opened} />
      )}
      {openBoqId && (
        <BoqEditorDialog
          key={openBoqId}
          boqId={openBoqId}
          projectId={projectId}
          canWrite={canWrite}
          onClose={() => { setOpenBoqId(null); void qc.invalidateQueries({ queryKey: key }); }}
          onOpenBoq={opened}
        />
      )}
    </section>
  );
}
