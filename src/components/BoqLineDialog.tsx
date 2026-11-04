import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { deleteBoqLine, refreshBoqLine, saveBoqLine } from "@/lib/boq.functions";
import type { BoqLine } from "@/lib/boq";
import {
  TAKEOFF_METHOD_LABELS,
  TAKEOFF_UNITS,
  TAKEOFF_UNIT_LABELS,
  describeSource,
  itemQuantity,
  type CatalogMeasurement,
  type TakeoffItem,
  type TakeoffUnit,
} from "@/lib/takeoff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBoqNumber } from "@/components/BoqLineList";

type LineDraft = {
  section: string;
  itemNumber: string;
  category: string;
  description: string;
  unit: TakeoffUnit | "";
  quantity: string;
  notes: string;
};

function draftFrom(line: BoqLine | null, defaultSection: string, defaultNumber: string): LineDraft {
  return {
    section: line?.section ?? defaultSection,
    itemNumber: line?.itemNumber ?? defaultNumber,
    category: line?.category ?? "",
    description: line?.description ?? "",
    unit: line?.unit ?? "",
    quantity: line?.quantity?.toString() ?? "",
    notes: line?.notes ?? "",
  };
}

export function BoqLineDialog({ boqId, line, lineCount, sections, takeoffItem, catalog, canWrite, open, onOpenChange, onChanged }: {
  boqId: string;
  line: BoqLine | null;
  lineCount: (section: string) => number;
  sections: string[];
  takeoffItem: TakeoffItem | undefined;
  catalog: CatalogMeasurement[];
  canWrite: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const defaultSection = sections[0] ?? "General";
  const defaultNumber = `${Math.max(sections.indexOf(defaultSection), 0) + 1}.${lineCount(defaultSection) + 1}`;
  const [draft, setDraft] = useState<LineDraft>(() => draftFrom(line, defaultSection, defaultNumber));
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const save = useServerFn(saveBoqLine);
  const refresh = useServerFn(refreshBoqLine);
  const remove = useServerFn(deleteBoqLine);
  const calculated = line?.basis === "calculated";
  const linked = line?.takeoffItemId ? takeoffItem : undefined;
  const current = takeoffItem ? itemQuantity(takeoffItem, catalog) : null;

  function update<K extends keyof LineDraft>(key: K, value: LineDraft[K]) {
    setDraft(existing => ({ ...existing, [key]: value }));
  }

  function parseQuantity(): number | null | "invalid" {
    const text = draft.quantity.trim();
    if (text === "") return null;
    const value = Number(text);
    return Number.isFinite(value) && value >= 0 ? value : "invalid";
  }

  async function submit() {
    setError(null);
    const quantity = parseQuantity();
    if (quantity === "invalid") { setError("Enter a quantity of zero or more."); return; }
    if (!draft.section.trim()) { setError("Enter a section name."); return; }
    const quantityChanged = line ? quantity !== line.quantity : quantity !== null;
    setWorking(true);
    try {
      await save({
        data: {
          boqId,
          ...(line ? { lineId: line.id } : {}),
          section: draft.section.trim(),
          itemNumber: draft.itemNumber.trim(),
          category: draft.category.trim(),
          description: draft.description.trim(),
          notes: draft.notes.trim(),
          ...(!calculated && draft.unit !== "" ? { unit: draft.unit } : {}),
          ...(quantityChanged ? { quantity } : {}),
        },
      });
      toast.success(line ? "Line saved." : "Line added.");
      onChanged();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the line. Try again.");
    } finally {
      setWorking(false);
    }
  }

  async function refreshFromTakeoff() {
    if (!line) return;
    setError(null);
    setWorking(true);
    try {
      await refresh({ data: { boqId, lineId: line.id } });
      toast.success("Quantity updated from the takeoff.");
      onChanged();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the quantity. Try again.");
    } finally {
      setWorking(false);
    }
  }

  async function removeLine() {
    if (!line) return;
    if (!window.confirm("Remove this line from the BOQ? The takeoff item stays in the takeoff.")) return;
    setError(null);
    setWorking(true);
    try {
      await remove({ data: { boqId, lineId: line.id } });
      toast.success("Line removed from the BOQ.");
      onChanged();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the line. Try again.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{line ? "Edit BOQ line" : "Add BOQ line"}</DialogTitle>
          <DialogDescription>
            {calculated
              ? "This quantity was calculated from approved measurements. Its unit comes from the takeoff."
              : "Lines typed here are manual entries. They are not taken from a drawing."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <label className="grid gap-1 text-sm font-medium">Description
            <Input value={draft.description} maxLength={500} disabled={!canWrite || working} onChange={e => update("description", e.target.value)} placeholder="e.g. Blockwork to internal walls" />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-1 text-sm font-medium">Section
              <Input list="boq-sections" value={draft.section} maxLength={80} disabled={!canWrite || working} onChange={e => update("section", e.target.value)} />
              <datalist id="boq-sections">{sections.map(section => <option key={section} value={section} />)}</datalist>
            </label>
            <label className="grid gap-1 text-sm font-medium">Item number
              <Input value={draft.itemNumber} maxLength={20} disabled={!canWrite || working} onChange={e => update("itemNumber", e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm font-medium">Category (optional)
              <Input value={draft.category} maxLength={80} disabled={!canWrite || working} onChange={e => update("category", e.target.value)} />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">Unit
              <select className="rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-60" value={draft.unit} disabled={!canWrite || working || calculated} onChange={e => update("unit", e.target.value as TakeoffUnit | "")}>
                <option value="">Not set</option>
                {TAKEOFF_UNITS.map(unit => <option key={unit} value={unit}>{TAKEOFF_UNIT_LABELS[unit]}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">Quantity
              <Input inputMode="decimal" value={draft.quantity} disabled={!canWrite || working} onChange={e => update("quantity", e.target.value)} placeholder="Not set" />
              {calculated && <span className="text-xs font-normal text-muted-foreground">Changing this value turns the line into a manual entry.</span>}
            </label>
          </div>
          <label className="grid gap-1 text-sm font-medium">Notes (optional)
            <Textarea value={draft.notes} maxLength={1000} disabled={!canWrite || working} onChange={e => update("notes", e.target.value)} />
          </label>
        </div>

        {line && (
          <section aria-label="Quantity source" className="mt-6 rounded-lg border bg-muted/30 p-4 text-sm">
            <h3 className="font-medium">Where this quantity comes from</h3>
            {calculated && linked && (
              <>
                <p className="mt-2">Takeoff item: <span className="font-medium">{linked.name}</span>{linked.method ? ` · ${TAKEOFF_METHOD_LABELS[linked.method]}` : ""}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                  {linked.sources.map(source => <li key={`${source.documentId}-${source.candidateId}-${source.occurrence}`} className="break-words">{describeSource(source, catalog)}</li>)}
                </ul>
                {current && current.ok && line.quantity !== null && current.value !== line.quantity && (
                  <p className="mt-3 text-amber-800">The takeoff now gives {formatBoqNumber(current.value)} {TAKEOFF_UNIT_LABELS[linked.unit]}. Use "Update from takeoff" to bring this line up to date.</p>
                )}
              </>
            )}
            {calculated && !linked && <p className="mt-2 text-destructive">The takeoff item this came from no longer exists.</p>}
            {!calculated && <p className="mt-2 text-muted-foreground">Typed in by a team member. Not calculated from a drawing or verified by AI.</p>}
            {!calculated && linked && <p className="mt-2 text-muted-foreground">Linked to takeoff item: {linked.name}</p>}
            {line.basis === "manual" && linked?.basis === "calculated" && line.calculatedQuantity !== null && (
              <p className="mt-2 text-muted-foreground">Calculated value when it was taken: {formatBoqNumber(line.calculatedQuantity)}. The quantity was changed by hand.</p>
            )}
          </section>
        )}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          {line && canWrite && (
            <div className="flex flex-col gap-2 sm:flex-row">
              {line.takeoffItemId && linked && (
                <Button variant="outline" disabled={working} onClick={() => void refreshFromTakeoff()}>Update from takeoff</Button>
              )}
              <Button variant="ghost" disabled={working} onClick={() => void removeLine()}>Remove from BOQ</Button>
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            {canWrite && <Button disabled={working} onClick={() => void submit()}>{working ? "Saving…" : "Save line"}</Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

