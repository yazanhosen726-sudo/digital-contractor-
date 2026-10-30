import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { measurementStatusLabels, type MeasurementExtraction } from "@/lib/measurements";

const MAX_LISTED_CANDIDATES = 200;

export function DrawingMeasurements({ extraction, canExtract, busy, onExtract }: { extraction: MeasurementExtraction | null; canExtract: boolean; busy: boolean; onExtract: () => void }) {
  if (!extraction) {
    return canExtract ? <div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><span className="text-muted-foreground">Measurement candidates not extracted yet.</span><Button variant="outline" size="sm" disabled={busy} onClick={onExtract}>Extract measurements</Button></div> : null;
  }
  const listed = extraction.candidates.slice(0, MAX_LISTED_CANDIDATES);
  return (
    <details className="mt-3 text-sm">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 font-medium">Measurement candidates · {extraction.candidates.length} <Badge variant="secondary">{measurementStatusLabels[extraction.status]}</Badge></summary>
      <div className="mt-3 space-y-3">
        <p className="text-muted-foreground">Candidates are unverified text readings. They are not confirmed dimensions and are not used for quantities or costs.</p>
        {extraction.warnings.length > 0 && <ul className="list-disc space-y-1 pl-5 text-muted-foreground">{extraction.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
        {extraction.pages.map(page => <div key={page.page}><h3 className="font-medium">Page {page.page} · {page.contentType.replace(/_/g, " ")}</h3>{page.scaleEvidence.length > 0 && <p className="mt-1">Scale notes: {page.scaleEvidence.map(s => s.text).join(" · ")}</p>}{page.unitEvidence.length > 0 && <p className="mt-1">Unit notes: {page.unitEvidence.map(s => s.text).join(" · ")}</p>}</div>)}
        {listed.length > 0 && <div className="max-h-72 overflow-auto rounded border"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-muted"><tr><th className="p-2 font-medium">Page</th><th className="p-2 font-medium">Text</th><th className="p-2 font-medium">Value</th><th className="p-2 font-medium">Confidence</th></tr></thead><tbody>{listed.map(candidate => <tr key={candidate.id} className="border-t"><td className="p-2">{candidate.page}</td><td className="p-2 break-all">{candidate.text}</td><td className="p-2 tabular-nums">{candidate.value}{candidate.unit ? ` ${candidate.unit}` : " (no unit)"}</td><td className="p-2 capitalize">{candidate.confidence}</td></tr>)}</tbody></table></div>}
        {extraction.candidates.length > MAX_LISTED_CANDIDATES && <p className="text-muted-foreground">Showing the first {MAX_LISTED_CANDIDATES} of {extraction.candidates.length} candidates.</p>}
      </div>
    </details>
  );
}
