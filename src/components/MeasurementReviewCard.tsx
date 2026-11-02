import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { REVIEW_UNITS } from "@/lib/measurements";
import { effectiveMeasurement, type ReviewAction, type ReviewedCandidate, type ReviewUnit } from "@/lib/measurement-review";

export type ReviewDecision = { action: ReviewAction; correctedValue?: number | undefined; correctedUnit?: ReviewUnit | undefined; note?: string | undefined };

type Mode = "idle" | "edit" | "reject";

const stateLabels = { pending: "Pending", approved: "Approved", rejected: "Rejected" } as const;
const stateBadge = { pending: "secondary", approved: "default", rejected: "destructive" } as const;

function describeDecision(reviewed: ReviewedCandidate, currentUserId: string | null): string {
  const { latest } = reviewed;
  if (!latest) return "Not reviewed yet. The extracted value is unverified.";
  const who = latest.actor_id === currentUserId ? "you" : "a team member";
  const when = new Date(latest.created_at).toLocaleString();
  if (latest.action === "reopened") return `Reopened ${when} by ${who}. Awaiting a new decision.`;
  return `${latest.action === "approved" ? "Approved" : "Rejected"} ${when} by ${who}.`;
}

export function MeasurementReviewCard({ reviewed, fileName, currentUserId, canWrite, busy, onDecide }: {
  reviewed: ReviewedCandidate; fileName: string; currentUserId: string | null; canWrite: boolean; busy: boolean; onDecide: (decision: ReviewDecision) => void;
}) {
  const { candidate, state, latest } = reviewed;
  const current = effectiveMeasurement(candidate, latest);
  const edited = latest !== null && latest.corrected_value !== null;
  const [mode, setMode] = useState<Mode>("idle");
  const [value, setValue] = useState(String(candidate.value));
  const [unit, setUnit] = useState<ReviewUnit | "">(current.unit ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const location = candidate.location;

  function startEdit() {
    setError(null);
    setMode("edit");
  }

  function submitEdit() {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return setError("Enter a value greater than zero.");
    if (!unit) return setError("Choose a unit.");
    onDecide({ action: "approve", correctedValue: parsed, correctedUnit: unit });
  }

  function submitReject() {
    onDecide({ action: "reject", note: note.trim() || undefined });
  }

  return (
    <article className="rounded-lg border bg-card p-4 text-card-foreground" aria-label={`Measurement ${candidate.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-lg font-semibold tabular-nums">{current.unit ? `${current.value} ${current.unit}` : `${current.value} (no unit)`}</p>
          {edited && <p className="text-xs text-muted-foreground">Extracted as {candidate.value}{candidate.unit ? ` ${candidate.unit}` : " (no unit)"}</p>}
        </div>
        <Badge variant={stateBadge[state]}>{stateLabels[state]}</Badge>
      </div>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-muted-foreground">Source drawing</dt><dd className="break-all">{fileName} · page {candidate.page}</dd></div>
        <div><dt className="text-muted-foreground">Location on page</dt><dd className="tabular-nums">x {Math.round(location.x)}, y {Math.round(location.y)} PDF points</dd></div>
      </dl>
      <div className="mt-3 text-sm">
        <p className="text-muted-foreground">Exact source text</p>
        <p className="mt-1 break-words rounded bg-muted/40 p-2 font-mono">{candidate.text}</p>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{describeDecision(reviewed, currentUserId)}</p>

      {canWrite && mode === "edit" && (
        <div className="mt-4 space-y-3 rounded-md border p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Value</span>
              <Input type="number" inputMode="decimal" step="any" min="0" value={value} onChange={e => setValue(e.target.value)} />
            </label>
            <div className="space-y-1 text-sm">
              <span className="font-medium">Unit</span>
              <Select value={unit} onValueChange={next => setUnit(REVIEW_UNITS.find(option => option === next) ?? "")}>
                <SelectTrigger aria-label="Unit"><SelectValue placeholder="Choose unit" /></SelectTrigger>
                <SelectContent>{REVIEW_UNITS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Your corrected value is saved alongside the original extraction, which is kept unchanged.</p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={submitEdit}>Save and approve</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setMode("idle")}>Cancel</Button>
          </div>
        </div>
      )}

      {canWrite && mode === "reject" && (
        <div className="mt-4 space-y-3 rounded-md border p-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Reason (optional)</span>
            <Textarea rows={2} maxLength={500} value={note} onChange={e => setNote(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="destructive" disabled={busy} onClick={submitReject}>Confirm rejection</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setMode("idle")}>Cancel</Button>
          </div>
        </div>
      )}

      {canWrite && mode === "idle" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {state === "pending" && candidate.unit && <Button size="sm" disabled={busy} onClick={() => onDecide({ action: "approve" })}>Approve</Button>}
          {state === "pending" && <Button size="sm" variant="outline" disabled={busy} onClick={startEdit}>{candidate.unit ? "Edit and approve" : "Add unit and approve"}</Button>}
          {state === "pending" && <Button size="sm" variant="outline" disabled={busy} onClick={() => setMode("reject")}>Reject</Button>}
          {state !== "pending" && <Button size="sm" variant="outline" disabled={busy} onClick={() => onDecide({ action: "reopen" })}>Reopen</Button>}
        </div>
      )}
    </article>
  );
}
