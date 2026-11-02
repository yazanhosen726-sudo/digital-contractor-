import { REVIEW_UNITS, type MeasurementCandidate, type MeasurementExtraction } from "./measurements";

export type ReviewUnit = (typeof REVIEW_UNITS)[number];
export type ReviewState = "pending" | "approved" | "rejected";
export type ReviewAction = "approve" | "reject" | "reopen";
export type ReviewEventAction = "approved" | "rejected" | "reopened";

export type ReviewEvent = {
  document_id: string;
  candidate_id: string;
  source_checksum: string;
  action: string;
  corrected_value: number | null;
  corrected_unit: string | null;
  actor_id: string;
  created_at: string;
};

export type ReviewedCandidate = { candidate: MeasurementCandidate; state: ReviewState; latest: ReviewEvent | null };

export type ReviewTotals = { total: number; approved: number; pending: number; rejected: number };

export type ApprovedMeasurement = { candidateId: string; page: number; text: string; value: number; unit: ReviewUnit };

const TRANSITIONS: Record<ReviewAction, { from: ReviewState[]; event: ReviewEventAction; refusal: string }> = {
  approve: { from: ["pending"], event: "approved", refusal: "Reopen this measurement before changing its decision." },
  reject: { from: ["pending"], event: "rejected", refusal: "Reopen this measurement before changing its decision." },
  reopen: { from: ["approved", "rejected"], event: "reopened", refusal: "This measurement is not reviewed yet." },
};

export function isReviewUnit(value: string | null): value is ReviewUnit {
  return REVIEW_UNITS.some(unit => unit === value);
}

export function stateOf(latest: ReviewEvent | null): ReviewState {
  if (!latest || latest.action === "reopened") return "pending";
  return latest.action === "approved" ? "approved" : "rejected";
}

export function nextEventAction(state: ReviewState, action: ReviewAction): ReviewEventAction {
  const rule = TRANSITIONS[action];
  if (!rule.from.includes(state)) throw new Error(rule.refusal);
  return rule.event;
}

function latestEventsByCandidate(extraction: MeasurementExtraction, events: ReviewEvent[]): Map<string, ReviewEvent> {
  const sorted = events
    .filter(event => event.source_checksum === extraction.sourceChecksum)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  return new Map(sorted.map(event => [event.candidate_id, event]));
}

export function reviewCandidates(extraction: MeasurementExtraction, events: ReviewEvent[]): ReviewedCandidate[] {
  const latest = latestEventsByCandidate(extraction, events);
  return extraction.candidates.map(candidate => {
    const event = latest.get(candidate.id) ?? null;
    return { candidate, state: stateOf(event), latest: event };
  });
}

export function effectiveMeasurement(candidate: MeasurementCandidate, latest: ReviewEvent | null): { value: number; unit: ReviewUnit | null } {
  if (latest?.action === "approved" && latest.corrected_value !== null && isReviewUnit(latest.corrected_unit)) {
    return { value: latest.corrected_value, unit: latest.corrected_unit };
  }
  return { value: candidate.value, unit: isReviewUnit(candidate.unit) ? candidate.unit : null };
}

export function reviewTotals(reviewed: ReviewedCandidate[]): ReviewTotals {
  const totals: ReviewTotals = { total: reviewed.length, approved: 0, pending: 0, rejected: 0 };
  for (const item of reviewed) totals[item.state]++;
  return totals;
}

// Quantity calculations must consume only this list; pending and rejected candidates are excluded.
export function approvedMeasurements(extraction: MeasurementExtraction, events: ReviewEvent[]): ApprovedMeasurement[] {
  return reviewCandidates(extraction, events).flatMap(({ candidate, state, latest }) => {
    if (state !== "approved") return [];
    const { value, unit } = effectiveMeasurement(candidate, latest);
    return unit ? [{ candidateId: candidate.id, page: candidate.page, text: candidate.text, value, unit }] : [];
  });
}
