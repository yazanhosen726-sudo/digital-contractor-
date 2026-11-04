import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { MEASUREMENT_VERSION, type MeasurementExtraction } from "./measurements";
import { approvedMeasurements, type ReviewEvent } from "./measurement-review";
import {
  TAKEOFF_BASES,
  TAKEOFF_METHODS,
  TAKEOFF_UNITS,
  itemQuantity,
  type CatalogMeasurement,
  type SourceRef,
  type TakeoffItem,
} from "./takeoff";

const itemRow = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category: z.string().nullable(),
  unit: z.enum(TAKEOFF_UNITS),
  basis: z.enum(TAKEOFF_BASES),
  method: z.enum(TAKEOFF_METHODS).nullable(),
  factor: z.number().nullable(),
  manual_quantity: z.number().nullable(),
  notes: z.string().nullable(),
});

const sourceRow = z.object({
  item_id: z.string().uuid(),
  document_id: z.string().uuid(),
  candidate_id: z.string(),
  occurrence: z.number().int(),
});

const documentRow = z.object({ id: z.string().uuid(), file_name: z.string(), extracted_data: z.unknown() });

function storedExtraction(value: unknown): MeasurementExtraction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const measurements = (value as Record<string, unknown>)["measurements"];
  if (!measurements || typeof measurements !== "object" || Array.isArray(measurements)) return null;
  return (measurements as Record<string, unknown>)["version"] === MEASUREMENT_VERSION ? measurements as unknown as MeasurementExtraction : null;
}

async function loadApprovedCatalog(supabase: SupabaseClient<Database>, projectId: string) {
  const { data: documents, error: documentError } = await supabase.from("documents").select("id, file_name, extracted_data").eq("project_id", projectId).eq("kind", "drawing");
  if (documentError) throw new Error("Could not load the project drawings. Try again.");
  const drawings = z.array(documentRow).parse(documents ?? []);
  const { data: events, error: eventError } = drawings.length === 0 ? { data: [], error: null } : await supabase.from("measurement_review_events").select("document_id, candidate_id, source_checksum, action, corrected_value, corrected_unit, actor_id, created_at").in("document_id", drawings.map(drawing => drawing.id)).order("created_at", { ascending: true });
  if (eventError) throw new Error("Could not load the measurement decisions. Try again.");
  const reviewEvents = (events ?? []) as ReviewEvent[];
  const catalog: CatalogMeasurement[] = [];
  const checksums = new Map<string, string>();
  for (const drawing of drawings) {
    const extraction = storedExtraction(drawing.extracted_data);
    if (!extraction) continue;
    checksums.set(drawing.id, extraction.sourceChecksum);
    const forDocument = reviewEvents.filter(event => event.document_id === drawing.id);
    for (const measurement of approvedMeasurements(extraction, forDocument)) {
      catalog.push({ ...measurement, documentId: drawing.id, fileName: drawing.file_name });
    }
  }
  return { catalog, checksums };
}

export async function loadTakeoffSnapshot(supabase: SupabaseClient<Database>, projectId: string): Promise<{ items: TakeoffItem[]; catalog: CatalogMeasurement[] }> {
  const { catalog } = await loadApprovedCatalog(supabase, projectId);
  const { data: rows, error: itemError } = await supabase.from("takeoff_items").select("id, name, category, unit, basis, method, factor, manual_quantity, notes").eq("project_id", projectId).order("created_at", { ascending: true });
  if (itemError) throw new Error("Could not load the takeoff items. Try again.");
  const parsedItems = z.array(itemRow).parse(rows ?? []);
  const { data: sources, error: sourceError } = parsedItems.length === 0 ? { data: [], error: null } : await supabase.from("takeoff_item_sources").select("item_id, document_id, candidate_id, occurrence").in("item_id", parsedItems.map(row => row.id)).order("occurrence", { ascending: true });
  if (sourceError) throw new Error("Could not load the measurement links. Try again.");
  const parsedSources = z.array(sourceRow).parse(sources ?? []);
  const items: TakeoffItem[] = parsedItems.map(row => ({
    id: row.id,
    name: row.name,
    category: row.category,
    unit: row.unit,
    basis: row.basis,
    method: row.method,
    factor: row.factor,
    manualQuantity: row.manual_quantity,
    notes: row.notes,
    sources: parsedSources
      .filter(source => source.item_id === row.id)
      .map(source => ({ documentId: source.document_id, candidateId: source.candidate_id, occurrence: source.occurrence })),
  }));
  return { items, catalog };
}

export const loadTakeoff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ projectId: z.string().uuid() }))
  .handler(async ({ data, context }) => loadTakeoffSnapshot(context.supabase, data.projectId));

const sourceInput = z.object({
  documentId: z.string().uuid(),
  candidateId: z.string().min(1).max(64),
  occurrence: z.number().int().min(1).max(100),
});

const saveInput = z.object({
  projectId: z.string().uuid(),
  itemId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().max(80).optional(),
  unit: z.enum(TAKEOFF_UNITS),
  basis: z.enum(TAKEOFF_BASES),
  method: z.enum(TAKEOFF_METHODS).optional(),
  factor: z.number().positive().lt(1_000_000).optional(),
  manualQuantity: z.number().min(0).lt(1_000_000_000).optional(),
  notes: z.string().trim().max(500).optional(),
  sources: z.array(sourceInput).max(500),
}).superRefine((input, ctx) => {
  if (input.basis === "manual") {
    if (input.manualQuantity === undefined) ctx.addIssue({ code: "custom", message: "Enter a manual quantity.", path: ["manualQuantity"] });
    if (input.method !== undefined || input.factor !== undefined || input.sources.length > 0) ctx.addIssue({ code: "custom", message: "A manual quantity cannot use measurements or a calculation method." });
    return;
  }
  if (input.method === undefined) ctx.addIssue({ code: "custom", message: "Choose how this quantity is calculated.", path: ["method"] });
  if (input.manualQuantity !== undefined) ctx.addIssue({ code: "custom", message: "A calculated quantity cannot have a manual value." });
  if ((input.method === "multiply") !== (input.factor !== undefined)) ctx.addIssue({ code: "custom", message: "Only multiplication takes a multiplier.", path: ["factor"] });
});

export const saveTakeoffItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(saveInput)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { catalog, checksums } = await loadApprovedCatalog(supabase, data.projectId);
    const sources: SourceRef[] = data.sources.map(source => ({ documentId: source.documentId, candidateId: source.candidateId, occurrence: source.occurrence }));
    const check = itemQuantity({
      id: data.itemId ?? "new",
      name: data.name,
      category: data.category || null,
      unit: data.unit,
      basis: data.basis,
      method: data.method ?? null,
      factor: data.factor ?? null,
      manualQuantity: data.manualQuantity ?? null,
      notes: data.notes || null,
      sources: data.basis === "manual" ? [] : sources,
    }, catalog);
    if (!check.ok) throw new Error(check.error);

    const { data: project, error: projectError } = await supabase.from("projects").select("org_id").eq("id", data.projectId).maybeSingle();
    if (projectError || !project) throw new Error("This project could not be found.");

    const values = {
      name: data.name,
      category: data.category || null,
      unit: data.unit,
      basis: data.basis,
      method: data.basis === "manual" ? null : data.method ?? null,
      factor: data.method === "multiply" ? data.factor ?? null : null,
      manual_quantity: data.basis === "manual" ? data.manualQuantity ?? null : null,
      notes: data.notes || null,
    };
    let itemId = data.itemId;
    if (itemId) {
      const { data: updated, error } = await supabase.from("takeoff_items").update(values).eq("id", itemId).eq("project_id", data.projectId).select("id").maybeSingle();
      if (error) { console.error("Takeoff item update failed", error.code, error.message); throw new Error("Could not save the takeoff item. Try again."); }
      if (!updated) throw new Error("That takeoff item no longer exists.");
      const { error: clearError } = await supabase.from("takeoff_item_sources").delete().eq("item_id", itemId);
      if (clearError) { console.error("Takeoff source reset failed", clearError.code, clearError.message); throw new Error("Could not save the measurement links. Try again."); }
    } else {
      const { data: created, error } = await supabase.from("takeoff_items").insert({ ...values, org_id: project.org_id, project_id: data.projectId }).select("id").single();
      if (error) { console.error("Takeoff item insert failed", error.code, error.message); throw new Error("Could not save the takeoff item. Try again."); }
      itemId = created.id;
    }

    if (data.basis === "calculated" && sources.length > 0) {
      const rows = sources.map(source => {
        const checksum = checksums.get(source.documentId);
        if (!checksum) throw new Error("A measurement's drawing has no extracted measurements.");
        return { org_id: project.org_id, item_id: itemId, document_id: source.documentId, candidate_id: source.candidateId, source_checksum: checksum, occurrence: source.occurrence };
      });
      const { error } = await supabase.from("takeoff_item_sources").insert(rows);
      if (error) { console.error("Takeoff source insert failed", error.code, error.message); throw new Error("Could not link the measurements. Try again."); }
    }
    return { id: itemId };
  });

export const deleteTakeoffItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ projectId: z.string().uuid(), itemId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { error, data: removed } = await context.supabase.from("takeoff_items").delete().eq("id", data.itemId).eq("project_id", data.projectId).select("id").maybeSingle();
    if (error) { console.error("Takeoff item delete failed", error.code, error.message); throw new Error("Could not delete the takeoff item. Try again."); }
    if (!removed) throw new Error("That takeoff item no longer exists.");
    return { id: removed.id };
  });
