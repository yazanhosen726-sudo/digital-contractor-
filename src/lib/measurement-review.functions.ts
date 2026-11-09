import { legacyClient } from "@/lib/legacy-schema";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadWritableDrawing } from "./drawings.functions";
import { MEASUREMENT_VERSION, REVIEW_UNITS, type MeasurementExtraction } from "./measurements";
import { nextEventAction, stateOf, type ReviewEvent } from "./measurement-review";

const reviewInput = z.object({
  documentId: z.string().uuid(),
  projectId: z.string().uuid(),
  candidateId: z.string().min(1).max(64),
  action: z.enum(["approve", "reject", "reopen"]),
  correctedValue: z.number().positive().lt(1_000_000_000).optional(),
  correctedUnit: z.enum(REVIEW_UNITS).optional(),
  note: z.string().trim().max(500).optional(),
}).refine(input => input.action === "approve" || (input.correctedValue === undefined && input.correctedUnit === undefined), "Only approval can change a value or unit.")
  .refine(input => (input.correctedValue === undefined) === (input.correctedUnit === undefined), "Enter both a value and a unit.");

export const reviewMeasurement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(reviewInput)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { document, previous } = await loadWritableDrawing(supabase, data);
    const stored = previous["measurements"];
    if (!stored || typeof stored !== "object" || Array.isArray(stored) || stored["version"] !== MEASUREMENT_VERSION) throw new Error("Extract measurements before reviewing them.");
    const extraction = stored as unknown as MeasurementExtraction;
    const candidate = extraction.candidates.find(item => item.id === data.candidateId);
    if (!candidate) throw new Error("That measurement is no longer in this drawing's extraction.");
    const { data: history, error: historyError } = await legacyClient(supabase).from("measurement_review_events").select("document_id, candidate_id, source_checksum, action, corrected_value, corrected_unit, actor_id, created_at").eq("document_id", document.id).eq("candidate_id", candidate.id).eq("source_checksum", extraction.sourceChecksum).order("created_at", { ascending: true });
    if (historyError) throw new Error("Could not load the review history. Try again.");
    const latest: ReviewEvent | null = history.at(-1) ?? null;
    const action = nextEventAction(stateOf(latest), data.action);
    const finalUnit = data.correctedUnit ?? candidate.unit;
    if (action === "approved" && !finalUnit) throw new Error("Choose a unit before approving this measurement.");
    const { error: insertError } = await legacyClient(supabase).from("measurement_review_events").insert({
      org_id: document.org_id,
      document_id: document.id,
      candidate_id: candidate.id,
      source_checksum: extraction.sourceChecksum,
      action,
      corrected_value: data.correctedValue ?? null,
      corrected_unit: data.correctedUnit ?? null,
      note: data.note || null,
    });
    if (insertError) {
      console.error("Measurement review insert failed", insertError.code, insertError.message);
      throw new Error("Could not save the decision. Try again.");
    }
    return { candidateId: candidate.id, action };
  });
