import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MeasurementReviewCard, type ReviewDecision } from "@/components/MeasurementReviewCard";
import { reviewMeasurement } from "@/lib/measurement-review.functions";
import { reviewCandidates, reviewTotals, type ReviewEvent, type ReviewState } from "@/lib/measurement-review";
import type { MeasurementExtraction } from "@/lib/measurements";

const MAX_LISTED = 200;
type Filter = ReviewState | "all";
const filters: { value: Filter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

export function MeasurementReviewDialog({ open, onOpenChange, projectId, documentId, fileName, extraction, events, canWrite, currentUserId, onChanged }: {
  open: boolean; onOpenChange: (open: boolean) => void; projectId: string; documentId: string; fileName: string;
  extraction: MeasurementExtraction; events: ReviewEvent[]; canWrite: boolean; currentUserId: string | null; onChanged: () => void;
}) {
  const review = useServerFn(reviewMeasurement);
  const [filter, setFilter] = useState<Filter>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const reviewed = reviewCandidates(extraction, events);
  const totals = reviewTotals(reviewed);
  const visible = reviewed.filter(item => filter === "all" || item.state === filter);

  async function decide(candidateId: string, decision: ReviewDecision) {
    setBusyId(candidateId);
    try {
      await review({ data: { documentId, projectId, candidateId, ...decision } });
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the decision.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{canWrite ? "Verify measurements" : "Measurements"}</DialogTitle>
          <DialogDescription className="break-all">{fileName}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Approved</p><p className="text-lg font-semibold tabular-nums">{totals.approved}</p></div>
          <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Pending</p><p className="text-lg font-semibold tabular-nums">{totals.pending}</p></div>
          <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Rejected</p><p className="text-lg font-semibold tabular-nums">{totals.rejected}</p></div>
        </div>
        <p className="text-xs text-muted-foreground">Only approved measurements are used for quantities. Check each value against the drawing, because the app does not verify scale.</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter measurements">
          {filters.map(option => {
            const count = option.value === "all" ? totals.total : totals[option.value];
            return <Button key={option.value} size="sm" variant={filter === option.value ? "default" : "outline"} aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>{option.label} · {count}</Button>;
          })}
        </div>
        {visible.length === 0 && <p className="text-sm text-muted-foreground">No measurements in this view.</p>}
        <div className="space-y-3">
          {visible.slice(0, MAX_LISTED).map(item => (
            <MeasurementReviewCard
              key={`${item.candidate.id}-${item.state}`}
              reviewed={item}
              fileName={fileName}
              currentUserId={currentUserId}
              canWrite={canWrite}
              busy={busyId !== null}
              onDecide={decision => void decide(item.candidate.id, decision)}
            />
          ))}
        </div>
        {visible.length > MAX_LISTED && <p className="text-sm text-muted-foreground">Showing the first {MAX_LISTED} of {visible.length} measurements in this view. Use the filters to narrow the list.</p>}
      </DialogContent>
    </Dialog>
  );
}
