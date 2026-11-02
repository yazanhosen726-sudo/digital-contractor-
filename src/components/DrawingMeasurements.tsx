import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MeasurementReviewDialog } from "@/components/MeasurementReviewDialog";
import { measurementStatusLabels, type MeasurementExtraction } from "@/lib/measurements";
import { reviewCandidates, reviewTotals, type ReviewEvent } from "@/lib/measurement-review";

export function DrawingMeasurements({ extraction, events, canExtract, canWrite, busy, projectId, documentId, fileName, currentUserId, onExtract, onChanged }: {
  extraction: MeasurementExtraction | null; events: ReviewEvent[]; canExtract: boolean; canWrite: boolean; busy: boolean;
  projectId: string; documentId: string; fileName: string; currentUserId: string | null; onExtract: () => void; onChanged: () => void;
}) {
  const [reviewing, setReviewing] = useState(false);
  if (!extraction) {
    return canExtract ? <div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><span className="text-muted-foreground">Measurement candidates not extracted yet.</span><Button variant="outline" size="sm" disabled={busy} onClick={onExtract}>Extract measurements</Button></div> : null;
  }
  const totals = reviewTotals(reviewCandidates(extraction, events));
  return (
    <div className="mt-3 space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Measurement candidates · {totals.total}</span>
        <Badge variant="secondary">{measurementStatusLabels[extraction.status]}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="default">Approved {totals.approved}</Badge>
        <Badge variant="secondary">Pending {totals.pending}</Badge>
        <Badge variant="outline">Rejected {totals.rejected}</Badge>
      </div>
      <Button variant="outline" size="sm" onClick={() => setReviewing(true)}>{canWrite ? "Verify measurements" : "View measurements"}</Button>
      <details>
        <summary className="cursor-pointer text-muted-foreground">Extraction notes</summary>
        <div className="mt-3 space-y-3">
          <p className="text-muted-foreground">Candidates are unverified text readings until a team member approves them.</p>
          {extraction.warnings.length > 0 && <ul className="list-disc space-y-1 pl-5 text-muted-foreground">{extraction.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
          {extraction.pages.map(page => <div key={page.page}><h3 className="font-medium">Page {page.page} · {page.contentType.replace(/_/g, " ")}</h3>{page.scaleEvidence.length > 0 && <p className="mt-1">Scale notes: {page.scaleEvidence.map(s => s.text).join(" · ")}</p>}{page.unitEvidence.length > 0 && <p className="mt-1">Unit notes: {page.unitEvidence.map(s => s.text).join(" · ")}</p>}</div>)}
        </div>
      </details>
      {reviewing && (
        <MeasurementReviewDialog
          open={reviewing}
          onOpenChange={setReviewing}
          projectId={projectId}
          documentId={documentId}
          fileName={fileName}
          extraction={extraction}
          events={events}
          canWrite={canWrite}
          currentUserId={currentUserId}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}
