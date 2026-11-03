import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTakeoffItem, loadTakeoff } from "@/lib/takeoff.functions";
import {
  TAKEOFF_METHOD_LABELS,
  TAKEOFF_UNIT_LABELS,
  itemQuantity,
  summarizeTakeoff,
  type CatalogMeasurement,
  type TakeoffItem,
} from "@/lib/takeoff";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TakeoffItemDialog } from "@/components/TakeoffItemDialog";

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
}

function sourceLabel(source: { documentId: string; candidateId: string; occurrence: number }, catalog: CatalogMeasurement[]) {
  const match = catalog.find(item => item.documentId === source.documentId && item.candidateId === source.candidateId);
  if (!match) return "No longer approved";
  const repeat = source.occurrence > 1 ? ` (copy ${source.occurrence})` : "";
  return `${match.fileName} · page ${match.page} · ${match.text}${repeat}`;
}

export function ProjectTakeoff({ projectId, orgId, canWrite }: { projectId: string; orgId: string; canWrite: boolean }) {
  const qc = useQueryClient();
  const load = useServerFn(loadTakeoff);
  const remove = useServerFn(deleteTakeoffItem);
  const [editing, setEditing] = useState<{ item: TakeoffItem | null } | null>(null);
  const key = ["takeoff", orgId, projectId];
  const { data, error, isPending } = useQuery({
    queryKey: key,
    queryFn: () => load({ data: { projectId } }),
  });

  async function removeItem(item: TakeoffItem) {
    if (!window.confirm(`Delete "${item.name}" from the takeoff?`)) return;
    try {
      await remove({ data: { projectId, itemId: item.id } });
      toast.success("Takeoff item deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the takeoff item.");
    } finally {
      await qc.invalidateQueries({ queryKey: key });
    }
  }

  const items = data?.items ?? [];
  const catalog = data?.catalog ?? [];
  const summary = summarizeTakeoff(items, catalog);

  return (
    <section className="mt-8 border-t pt-6" aria-label="Quantity takeoff">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Quantity takeoff</h2>
          <p className="text-sm text-muted-foreground">Built only from approved drawing measurements.</p>
        </div>
        {canWrite && <Button disabled={isPending || !!error} onClick={() => setEditing({ item: null })}><Plus className="mr-2 size-4" />Add item</Button>}
      </div>

      {isPending && <p className="mt-4 text-sm text-muted-foreground">Loading takeoff…</p>}
      {error && <p role="alert" className="mt-4 text-sm text-destructive">Could not load the takeoff: {error.message}</p>}

      {data && (
        <>
          <div className="mt-6">
            <h3 className="font-medium">Project summary</h3>
            {summary.rows.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No totals yet. Add a takeoff item to see the summary.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Category</th>
                      <th className="px-3 py-2 font-medium">Unit</th>
                      <th className="px-3 py-2 text-right font-medium">Calculated</th>
                      <th className="px-3 py-2 text-right font-medium">Manual</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                      <th className="px-3 py-2 text-right font-medium">Items</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {summary.rows.map(row => (
                      <tr key={`${row.category}-${row.unit}`}>
                        <td className="px-3 py-2">{row.category}</td>
                        <td className="px-3 py-2">{TAKEOFF_UNIT_LABELS[row.unit]}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatNumber(row.calculated)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatNumber(row.manual)}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatNumber(row.total)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.itemCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {summary.errors.length > 0 && (
              <div role="alert" className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <p className="font-medium">{summary.errors.length} item{summary.errors.length === 1 ? "" : "s"} left out of the totals:</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {summary.errors.map(problem => <li key={problem.itemId}>{problem.name}: {problem.error}</li>)}
                </ul>
              </div>
            )}
          </div>

          <ul className="mt-6 space-y-3">
            {items.length === 0 && <li className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No takeoff items yet.</li>}
            {items.map(item => {
              const quantity = itemQuantity(item, catalog);
              return (
                <li key={item.id} className="rounded-lg border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium break-words">{item.name}</p>
                        {item.category && <Badge variant="outline">{item.category}</Badge>}
                        <Badge variant={item.basis === "calculated" ? "secondary" : "outline"}>{item.basis === "calculated" ? "Calculated" : "Manual"}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.basis === "calculated" && item.method ? TAKEOFF_METHOD_LABELS[item.method] : "Typed in by a team member"}
                        {item.method === "multiply" && item.factor !== null ? ` · × ${formatNumber(item.factor)}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      {quantity.ok ? (
                        <p className="text-xl font-semibold tabular-nums">{formatNumber(quantity.value)} <span className="text-sm font-normal text-muted-foreground">{TAKEOFF_UNIT_LABELS[item.unit]}</span></p>
                      ) : (
                        <p role="alert" className="max-w-xs text-sm text-destructive">{quantity.error}</p>
                      )}
                    </div>
                  </div>
                  {item.basis === "calculated" && item.sources.length > 0 && (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                      {item.sources.map(source => <li key={`${source.documentId}-${source.candidateId}-${source.occurrence}`} className="break-words">{sourceLabel(source, catalog)}</li>)}
                    </ul>
                  )}
                  {item.notes && <p className="mt-3 text-sm text-muted-foreground">{item.notes}</p>}
                  {canWrite && (
                    <div className="mt-3 flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing({ item })}><Pencil className="mr-2 size-4" />Edit</Button>
                      <Button variant="ghost" size="sm" onClick={() => void removeItem(item)} aria-label={`Delete ${item.name}`}><Trash2 className="mr-2 size-4" />Delete</Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {editing && canWrite && (
        <TakeoffItemDialog
          projectId={projectId}
          catalog={catalog}
          item={editing.item}
          open
          onOpenChange={open => { if (!open) setEditing(null); }}
          onSaved={() => void qc.invalidateQueries({ queryKey: key })}
        />
      )}
    </section>
  );
}
