import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createBoqRevision, issueBoq, loadBoq, reorderBoqLines } from "@/lib/boq.functions";
import {
  groupBySection,
  liveQuantities,
  orderAfterItemMove,
  orderAfterSectionMove,
  summarizeBoqByUnit,
  validateBoq,
  type BoqLine,
  type LiveQuantity,
} from "@/lib/boq";
import { TAKEOFF_UNIT_LABELS } from "@/lib/takeoff";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BoqLineList, formatBoqNumber } from "@/components/BoqLineList";
import { BoqLineDialog } from "@/components/BoqLineDialog";

const STATUS_LABELS = { draft: "Draft", issued: "Issued" } as const;

export function BoqEditorDialog({ boqId, projectId, canWrite, onClose, onOpenBoq }: {
  boqId: string;
  projectId: string;
  canWrite: boolean;
  onClose: () => void;
  onOpenBoq: (boqId: string) => void;
}) {
  const qc = useQueryClient();
  const load = useServerFn(loadBoq);
  const issue = useServerFn(issueBoq);
  const revise = useServerFn(createBoqRevision);
  const reorder = useServerFn(reorderBoqLines);
  const [editing, setEditing] = useState<{ line: BoqLine | null } | null>(null);
  const [working, setWorking] = useState(false);
  const key = ["boq", boqId];
  const { data, error, isPending } = useQuery({
    queryKey: key,
    queryFn: () => load({ data: { boqId } }),
  });

  const lines = data?.lines ?? [];
  const takeoffItems = data?.takeoffItems ?? [];
  const catalog = data?.catalog ?? [];
  const live = useMemo<Map<string, LiveQuantity>>(() => liveQuantities(takeoffItems, catalog), [takeoffItems, catalog]);
  const issues = validateBoq(lines, live);
  const errorCount = issues.filter(issueItem => issueItem.severity === "error").length;
  const summary = summarizeBoqByUnit(lines);
  const sections = groupBySection(lines).map(group => group.section);
  const issued = data?.boq.status === "issued";
  const editable = canWrite && !issued;
  const lineById = new Map(lines.map(line => [line.id, line]));

  async function run(action: () => Promise<unknown>, success: string) {
    setWorking(true);
    try {
      await action();
      toast.success(success);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setWorking(false);
      await qc.invalidateQueries({ queryKey: key });
      await qc.invalidateQueries({ queryKey: ["boqs", projectId] });
    }
  }

  function moveLine(lineId: string, direction: -1 | 1) {
    const orderedIds = orderAfterItemMove(lines, lineId, direction);
    if (orderedIds) void run(() => reorder({ data: { boqId, orderedIds } }), "Order updated.");
  }

  function moveSection(section: string, direction: -1 | 1) {
    const orderedIds = orderAfterSectionMove(lines, section, direction);
    if (orderedIds) void run(() => reorder({ data: { boqId, orderedIds } }), "Section order updated.");
  }

  function issueNow() {
    if (!window.confirm("Issue this BOQ? After it is issued, its lines cannot be edited. You can create a new revision to make changes.")) return;
    void run(() => issue({ data: { boqId } }), "BOQ issued.");
  }

  async function createRevision() {
    setWorking(true);
    try {
      const created = await revise({ data: { boqId } });
      toast.success("New revision created.");
      onOpenBoq(created.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create a new revision. Try again.");
    } finally {
      setWorking(false);
      await qc.invalidateQueries({ queryKey: ["boqs", projectId] });
    }
  }

  const editingTakeoff = editing?.line?.takeoffItemId ? takeoffItems.find(item => item.id === editing.line?.takeoffItemId) : undefined;

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="break-words pr-6">{data?.boq.title ?? "Bill of quantities"}</DialogTitle>
          <DialogDescription>
            {data ? (
              <span className="flex flex-wrap items-center gap-2">
                <span>Revision {data.boq.revision}</span>
                {data.boq.reference && <span>· Ref {data.boq.reference}</span>}
                <Badge variant={issued ? "default" : "outline"}>{STATUS_LABELS[data.boq.status]}</Badge>
              </span>
            ) : "Loading BOQ…"}
          </DialogDescription>
        </DialogHeader>

        {isPending && <p className="text-sm text-muted-foreground">Loading BOQ…</p>}
        {error && <p role="alert" className="text-sm text-destructive">Could not load this BOQ: {error.message}</p>}

        {data && (
          <div className="space-y-6">
            {issued && (
              <p className="rounded-md border bg-muted/40 p-3 text-sm">This revision has been issued and is read-only. Create a new revision to make changes.</p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {editable && <Button variant="outline" disabled={working} onClick={() => setEditing({ line: null })}><Plus className="mr-2 size-4" />Add line</Button>}
              {editable && <Button disabled={working || errorCount > 0} onClick={issueNow}>Issue BOQ</Button>}
              {canWrite && issued && <Button variant="outline" disabled={working} onClick={() => void createRevision()}>New revision</Button>}
              {editable && errorCount > 0 && <p className="text-sm text-destructive">Resolve {errorCount} {errorCount === 1 ? "error" : "errors"} to issue.</p>}
            </div>

            <section aria-label="Summary by unit" className="space-y-3">
              <h3 className="font-semibold">Summary by unit</h3>
              {summary.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No quantities yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[28rem] text-sm">
                    <thead className="bg-muted/50 text-left text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Unit</th>
                        <th className="px-3 py-2 text-right font-medium">Calculated</th>
                        <th className="px-3 py-2 text-right font-medium">Manual</th>
                        <th className="px-3 py-2 text-right font-medium">Total</th>
                        <th className="px-3 py-2 text-right font-medium">Lines</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {summary.rows.map(row => (
                        <tr key={row.unit}>
                          <td className="px-3 py-2">{TAKEOFF_UNIT_LABELS[row.unit]}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatBoqNumber(row.calculated)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatBoqNumber(row.manual)}</td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatBoqNumber(row.total)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.lineCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Quantities are added up only within the same unit; units are not converted.
                {summary.unquantified > 0 && ` ${summary.unquantified} ${summary.unquantified === 1 ? "line has" : "lines have"} no quantity and ${summary.unquantified === 1 ? "is" : "are"} left out.`}
              </p>
            </section>

            {issues.length > 0 && (
              <section aria-label="Checks" className="rounded-lg border p-4">
                <h3 className="font-semibold">Checks ({errorCount} {errorCount === 1 ? "error" : "errors"}, {issues.length - errorCount} {issues.length - errorCount === 1 ? "warning" : "warnings"})</h3>
                <ul className="mt-2 space-y-2 text-sm">
                  {issues.map((issueItem, index) => {
                    const target = lineById.get(issueItem.lineId);
                    return (
                      <li key={index} className={issueItem.severity === "error" ? "text-destructive" : "text-amber-800"}>
                        <span className="font-medium">{target?.itemNumber || "Line"} {target?.description ?? ""}:</span> {issueItem.message}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <section aria-label="BOQ lines" className="space-y-3">
              <h3 className="font-semibold">Lines</h3>
              <BoqLineList
                lines={lines}
                issues={issues}
                canWrite={editable}
                onEdit={line => setEditing({ line })}
                onMoveLine={moveLine}
                onMoveSection={moveSection}
              />
            </section>
          </div>
        )}

        {editing && data && (
          <BoqLineDialog
            boqId={boqId}
            line={editing.line}
            lineCount={section => lines.filter(line => line.section === section).length}
            sections={sections}
            takeoffItem={editingTakeoff}
            catalog={catalog}
            canWrite={editable}
            open
            onOpenChange={open => { if (!open) setEditing(null); }}
            onChanged={() => void qc.invalidateQueries({ queryKey: key })}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
