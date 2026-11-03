import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { saveTakeoffItem } from "@/lib/takeoff.functions";
import {
  TAKEOFF_BASES,
  TAKEOFF_METHODS,
  TAKEOFF_METHOD_LABELS,
  TAKEOFF_UNITS,
  TAKEOFF_UNIT_LABELS,
  itemQuantity,
  type CatalogMeasurement,
  type SourceRef,
  type TakeoffBasis,
  type TakeoffItem,
  type TakeoffMethod,
  type TakeoffUnit,
} from "@/lib/takeoff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Draft = {
  name: string;
  category: string;
  unit: TakeoffUnit;
  basis: TakeoffBasis;
  method: TakeoffMethod;
  factor: string;
  manualQuantity: string;
  notes: string;
  sources: SourceRef[];
};

const optionalNumber = (text: string) => (text.trim() === "" ? null : Number(text));

function draftFrom(item: TakeoffItem | null): Draft {
  return {
    name: item?.name ?? "",
    category: item?.category ?? "",
    unit: item?.unit ?? "m",
    basis: item?.basis ?? "calculated",
    method: item?.method ?? "sum",
    factor: item?.factor?.toString() ?? "",
    manualQuantity: item?.manualQuantity?.toString() ?? "",
    notes: item?.notes ?? "",
    sources: item?.sources ?? [],
  };
}

function previewItem(draft: Draft): TakeoffItem {
  return {
    id: "draft",
    name: draft.name,
    category: draft.category.trim() || null,
    unit: draft.unit,
    basis: draft.basis,
    method: draft.basis === "calculated" ? draft.method : null,
    factor: draft.basis === "calculated" && draft.method === "multiply" ? optionalNumber(draft.factor) : null,
    manualQuantity: draft.basis === "manual" ? optionalNumber(draft.manualQuantity) : null,
    notes: draft.notes.trim() || null,
    sources: draft.basis === "calculated" ? draft.sources : [],
  };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
}

export function TakeoffItemDialog({ projectId, catalog, item, open, onOpenChange, onSaved }: {
  projectId: string;
  catalog: CatalogMeasurement[];
  item: TakeoffItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(item));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = useServerFn(saveTakeoffItem);
  const preview = itemQuantity(previewItem(draft), catalog);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft(current => ({ ...current, [key]: value }));
  }

  function countOf(documentId: string, candidateId: string) {
    return draft.sources.filter(source => source.documentId === documentId && source.candidateId === candidateId).length;
  }

  function include(documentId: string, candidateId: string) {
    update("sources", [...draft.sources, { documentId, candidateId, occurrence: countOf(documentId, candidateId) + 1 }]);
  }

  function removeLast(documentId: string, candidateId: string) {
    const count = countOf(documentId, candidateId);
    if (count === 0) return;
    const sources = draft.sources.filter(source => !(source.documentId === documentId && source.candidateId === candidateId && source.occurrence === count));
    update("sources", sources);
  }

  function clearAll(documentId: string, candidateId: string) {
    update("sources", draft.sources.filter(source => !(source.documentId === documentId && source.candidateId === candidateId)));
  }

  async function submit() {
    setError(null);
    const category = draft.category.trim();
    const notes = draft.notes.trim();
    const factor = optionalNumber(draft.factor);
    const manualQuantity = optionalNumber(draft.manualQuantity);
    const calculated = draft.basis === "calculated";
    const multiplies = calculated && draft.method === "multiply";
    setSaving(true);
    try {
      await save({
        data: {
          projectId,
          ...(item ? { itemId: item.id } : {}),
          name: draft.name.trim(),
          ...(category ? { category } : {}),
          unit: draft.unit,
          basis: draft.basis,
          ...(calculated ? { method: draft.method } : {}),
          ...(multiplies && factor !== null ? { factor } : {}),
          ...(!calculated && manualQuantity !== null ? { manualQuantity } : {}),
          ...(notes ? { notes } : {}),
          sources: calculated ? draft.sources : [],
        },
      });
      toast.success(item ? "Takeoff item updated." : "Takeoff item added.");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the takeoff item. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const approvedByDrawing = Object.values(
    catalog.reduce<Record<string, { documentId: string; fileName: string; items: CatalogMeasurement[] }>>((groups, measurement) => {
      const group = groups[measurement.documentId] ?? { documentId: measurement.documentId, fileName: measurement.fileName, items: [] };
      group.items.push(measurement);
      groups[measurement.documentId] = group;
      return groups;
    }, {}),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? "Edit takeoff item" : "New takeoff item"}</DialogTitle>
          <DialogDescription>Quantities come only from approved measurements. Pending and rejected measurements are not listed.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <label className="grid gap-1 text-sm font-medium">Name
            <Input value={draft.name} maxLength={120} onChange={e => update("name", e.target.value)} placeholder="e.g. Internal wall length" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">Category (optional)
              <Input value={draft.category} maxLength={80} onChange={e => update("category", e.target.value)} placeholder="e.g. Walls" />
            </label>
            <label className="grid gap-1 text-sm font-medium">Unit
              <select className="rounded-md border bg-background px-3 py-2 text-sm" value={draft.unit} onChange={e => update("unit", e.target.value as TakeoffUnit)}>
                {TAKEOFF_UNITS.map(unit => <option key={unit} value={unit}>{TAKEOFF_UNIT_LABELS[unit]}</option>)}
              </select>
            </label>
          </div>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Source of quantity</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {TAKEOFF_BASES.map(basis => (
                <label key={basis} className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors ${draft.basis === basis ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}>
                  <input type="radio" name="basis" className="mt-1" checked={draft.basis === basis} onChange={() => update("basis", basis)} />
                  <span>
                    <span className="font-medium">{basis === "calculated" ? "Calculated from measurements" : "Manual quantity"}</span>
                    <span className="block text-muted-foreground">{basis === "calculated" ? "Updates automatically when measurements change." : "A value you type in. It is kept separate from calculated totals."}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {draft.basis === "calculated" ? (
            <>
              <label className="grid gap-1 text-sm font-medium">Calculation
                <select className="rounded-md border bg-background px-3 py-2 text-sm" value={draft.method} onChange={e => update("method", e.target.value as TakeoffMethod)}>
                  {TAKEOFF_METHODS.map(method => <option key={method} value={method}>{TAKEOFF_METHOD_LABELS[method]}</option>)}
                </select>
              </label>
              {draft.method === "multiply" && (
                <label className="grid gap-1 text-sm font-medium">Multiplier (for example, number of identical runs)
                  <Input inputMode="decimal" value={draft.factor} onChange={e => update("factor", e.target.value)} placeholder="e.g. 3" />
                </label>
              )}
              <div className="grid gap-2">
                <p className="text-sm font-medium">Approved measurements <span className="font-normal text-muted-foreground">· {draft.sources.length} included</span></p>
                {approvedByDrawing.length === 0 && <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No approved measurements yet. Verify measurements on a drawing first.</p>}
                <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                  {approvedByDrawing.map(group => (
                    <div key={group.documentId}>
                      <p className="mb-1 break-all text-xs font-medium text-muted-foreground">{group.fileName}</p>
                      <ul className="divide-y rounded-md border">
                        {group.items.map(measurement => {
                          const count = countOf(measurement.documentId, measurement.candidateId);
                          return (
                            <li key={measurement.candidateId} className="flex flex-wrap items-center justify-between gap-2 p-2 text-sm">
                              <label className="flex min-w-0 cursor-pointer items-center gap-2">
                                <input type="checkbox" checked={count > 0} onChange={() => (count > 0 ? clearAll(measurement.documentId, measurement.candidateId) : include(measurement.documentId, measurement.candidateId))} />
                                <span className="min-w-0 break-words">{measurement.text} <span className="text-muted-foreground">· page {measurement.page}</span></span>
                              </label>
                              {count > 0 && (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground">Included {count}×</span>
                                  <Button type="button" variant="outline" size="sm" onClick={() => removeLast(measurement.documentId, measurement.candidateId)}>−</Button>
                                  <Button type="button" variant="outline" size="sm" title="Add this measurement again" onClick={() => include(measurement.documentId, measurement.candidateId)}>+</Button>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <label className="grid gap-1 text-sm font-medium">Quantity
              <Input inputMode="decimal" value={draft.manualQuantity} onChange={e => update("manualQuantity", e.target.value)} placeholder="e.g. 12" />
            </label>
          )}

          <label className="grid gap-1 text-sm font-medium">Notes (optional)
            <Textarea value={draft.notes} maxLength={500} onChange={e => update("notes", e.target.value)} rows={2} />
          </label>

          <div className="rounded-md border bg-muted/30 p-3 text-sm" aria-live="polite">
            <p className="text-muted-foreground">Result</p>
            {preview.ok ? (
              <p className="text-lg font-semibold">{formatNumber(preview.value)} {TAKEOFF_UNIT_LABELS[draft.unit]}</p>
            ) : (
              <p role="alert" className="text-destructive">{preview.error}</p>
            )}
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={saving || draft.name.trim() === "" || !preview.ok}>{saving ? "Saving…" : "Save item"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

