import { createServerFn } from "@tanstack/react-start";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  generateBoqLines,
  liveQuantities,
  validateBoq,
  type BoqLine,
  type BoqLineDraft,
} from "./boq";
import { itemQuantity, round, TAKEOFF_BASES, TAKEOFF_UNITS } from "./takeoff";
import { loadTakeoffSnapshot } from "./takeoff.functions";

type Supabase = SupabaseClient<Database>;

const lineRow = z.object({
  id: z.string().uuid(),
  takeoff_item_id: z.string().uuid().nullable(),
  sort_order: z.number().int(),
  item_number: z.string(),
  section: z.string(),
  category: z.string().nullable(),
  description: z.string().nullable(),
  unit: z.enum(TAKEOFF_UNITS).nullable(),
  quantity: z.number().nullable(),
  calculated_quantity: z.number().nullable(),
  basis: z.enum(TAKEOFF_BASES),
  notes: z.string().nullable(),
});

const boqRow = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  org_id: z.string().uuid(),
  series_id: z.string().uuid(),
  revision: z.number().int(),
  title: z.string(),
  reference: z.string().nullable(),
  status: z.enum(["draft", "issued"]),
  issued_at: z.string().nullable(),
  created_at: z.string(),
});

const LINE_COLUMNS = "id, takeoff_item_id, sort_order, item_number, section, category, description, unit, quantity, calculated_quantity, basis, notes";

function toLine(row: z.infer<typeof lineRow>): BoqLine {
  return {
    id: row.id,
    sortOrder: row.sort_order,
    takeoffItemId: row.takeoff_item_id,
    itemNumber: row.item_number,
    section: row.section,
    category: row.category,
    description: row.description,
    unit: row.unit,
    quantity: row.quantity,
    calculatedQuantity: row.calculated_quantity,
    basis: row.basis,
    notes: row.notes,
  };
}

function lineValues(line: BoqLineDraft) {
  return {
    takeoff_item_id: line.takeoffItemId,
    sort_order: line.sortOrder,
    item_number: line.itemNumber,
    section: line.section,
    category: line.category,
    description: line.description,
    unit: line.unit,
    quantity: line.quantity,
    calculated_quantity: line.calculatedQuantity,
    basis: line.basis,
    notes: line.notes,
  };
}

function fail(error: PostgrestError | null, message: string): never {
  if (error?.code === "42501") throw new Error("You do not have permission to change this BOQ.");
  if (error) console.error("BOQ operation failed", error.code, error.message);
  throw new Error(message);
}

async function loadBoqRow(supabase: Supabase, boqId: string) {
  const { data, error } = await supabase.from("boqs").select("id, project_id, org_id, series_id, revision, title, reference, status, issued_at, created_at").eq("id", boqId).maybeSingle();
  if (error) fail(error, "Could not load this BOQ. Try again.");
  if (!data) throw new Error("This BOQ could not be found.");
  return boqRow.parse(data);
}

async function requireDraft(supabase: Supabase, boqId: string) {
  const boq = await loadBoqRow(supabase, boqId);
  if (boq.status !== "draft") throw new Error("This BOQ has been issued and can no longer be changed. Create a new revision to make changes.");
  return boq;
}

async function loadLines(supabase: Supabase, boqId: string): Promise<BoqLine[]> {
  const { data, error } = await supabase.from("boq_items").select(LINE_COLUMNS).eq("boq_id", boqId).order("sort_order", { ascending: true });
  if (error) fail(error, "Could not load the BOQ lines. Try again.");
  return z.array(lineRow).parse(data ?? []).map(toLine);
}

async function insertLines(supabase: Supabase, boqId: string, orgId: string, lines: BoqLineDraft[]) {
  if (lines.length === 0) return;
  const { error } = await supabase.from("boq_items").insert(lines.map(line => ({ ...lineValues(line), org_id: orgId, boq_id: boqId })));
  if (error) fail(error, "Could not save the BOQ lines. Try again.");
}

async function discardBoq(supabase: Supabase, boqId: string) {
  const { error } = await supabase.from("boqs").delete().eq("id", boqId);
  if (error) console.error("BOQ cleanup failed", error.code, error.message);
}

const boqIdInput = z.object({ boqId: z.string().uuid() });

export const listBoqs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ projectId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("boqs").select("id, title, reference, revision, status, series_id, created_at").eq("project_id", data.projectId).order("created_at", { ascending: false });
    if (error) fail(error, "Could not load the BOQs. Try again.");
    return z.array(z.object({
      id: z.string().uuid(),
      title: z.string(),
      reference: z.string().nullable(),
      revision: z.number().int(),
      status: z.enum(["draft", "issued"]),
      series_id: z.string().uuid(),
      created_at: z.string(),
    })).parse(rows ?? []);
  });

export const loadBoq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(boqIdInput)
  .handler(async ({ data, context }) => {
    const boq = await loadBoqRow(context.supabase, data.boqId);
    const lines = await loadLines(context.supabase, data.boqId);
    const snapshot = await loadTakeoffSnapshot(context.supabase, boq.project_id);
    return { boq, lines, takeoffItems: snapshot.items, catalog: snapshot.catalog };
  });

export const createBoq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    projectId: z.string().uuid(),
    title: z.string().trim().min(1).max(120),
    reference: z.string().trim().max(60).optional(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { items, catalog } = await loadTakeoffSnapshot(supabase, data.projectId);
    if (items.length === 0) throw new Error("Add takeoff items before generating a BOQ.");
    const { data: project, error: projectError } = await supabase.from("projects").select("org_id").eq("id", data.projectId).maybeSingle();
    if (projectError || !project) throw new Error("This project could not be found.");

    const { data: created, error } = await supabase.from("boqs").insert({
      org_id: project.org_id,
      project_id: data.projectId,
      title: data.title,
      reference: data.reference || null,
    }).select("id").single();
    if (error) fail(error, "Could not create the BOQ. Try again.");

    try {
      await insertLines(supabase, created.id, project.org_id, generateBoqLines(items, catalog));
    } catch (lineError) {
      await discardBoq(supabase, created.id);
      throw lineError;
    }
    return { id: created.id };
  });

export const createBoqRevision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(boqIdInput)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const source = await loadBoqRow(supabase, data.boqId);
    const lines = await loadLines(supabase, data.boqId);
    const { data: latest, error: latestError } = await supabase.from("boqs").select("revision").eq("series_id", source.series_id).order("revision", { ascending: false }).limit(1).maybeSingle();
    if (latestError) fail(latestError, "Could not create a new revision. Try again.");
    const { data: created, error } = await supabase.from("boqs").insert({
      org_id: source.org_id,
      project_id: source.project_id,
      series_id: source.series_id,
      revision: (latest?.revision ?? source.revision) + 1,
      title: source.title,
      reference: source.reference,
    }).select("id").single();
    if (error) fail(error, "Could not create a new revision. Try again.");

    try {
      await insertLines(supabase, created.id, source.org_id, lines);
    } catch (lineError) {
      await discardBoq(supabase, created.id);
      throw lineError;
    }
    return { id: created.id };
  });

export const issueBoq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(boqIdInput)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const boq = await requireDraft(supabase, data.boqId);
    const lines = await loadLines(supabase, data.boqId);
    const snapshot = await loadTakeoffSnapshot(supabase, boq.project_id);
    const errors = validateBoq(lines, liveQuantities(snapshot.items, snapshot.catalog)).filter(issue => issue.severity === "error");
    if (errors.length > 0) throw new Error(`Resolve the ${errors.length} ${errors.length === 1 ? "error" : "errors"} in this BOQ before issuing it.`);
    const { data: issued, error } = await supabase.from("boqs").update({ status: "issued", issued_at: new Date().toISOString() }).eq("id", data.boqId).eq("status", "draft").select("id").maybeSingle();
    if (error) fail(error, "Could not issue this BOQ. Try again.");
    if (!issued) throw new Error("This BOQ has already been issued.");
    return { id: issued.id };
  });

const quantityInput = z.number().min(0).lt(1_000_000_000);
const textInput = z.string().trim().max(500);

const lineInput = z.object({
  boqId: z.string().uuid(),
  lineId: z.string().uuid().optional(),
  section: z.string().trim().min(1, "Enter a section name.").max(80),
  itemNumber: z.string().trim().max(20),
  category: z.string().trim().max(80).optional(),
  description: textInput.optional(),
  unit: z.enum(TAKEOFF_UNITS).optional(),
  quantity: quantityInput.nullable().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const saveBoqLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(lineInput)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const boq = await requireDraft(supabase, data.boqId);
    const patch = {
      section: data.section,
      item_number: data.itemNumber,
      ...(data.category !== undefined ? { category: data.category || null } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
      ...(data.unit !== undefined ? { unit: data.unit } : {}),
      ...(data.quantity !== undefined ? { quantity: data.quantity === null ? null : round(data.quantity) } : {}),
    };

    if (!data.lineId) {
      const lines = await loadLines(supabase, boq.id);
      const { data: created, error } = await supabase.from("boq_items").insert({
        ...patch,
        org_id: boq.org_id,
        boq_id: boq.id,
        basis: "manual",
        sort_order: lines.length,
      }).select("id").single();
      if (error) fail(error, "Could not add the line. Try again.");
      return { id: created.id };
    }

    const { data: existing, error: existingError } = await supabase.from("boq_items").select("id, basis, unit, quantity").eq("id", data.lineId).eq("boq_id", boq.id).maybeSingle();
    if (existingError) fail(existingError, "Could not load the line. Try again.");
    if (!existing) throw new Error("That BOQ line no longer exists.");
    if (existing.basis === "calculated" && data.unit !== undefined && data.unit !== existing.unit) {
      throw new Error("A calculated quantity takes its unit from the takeoff. Change the takeoff item instead.");
    }
    const quantityChanged = data.quantity !== undefined && data.quantity !== existing.quantity;
    const { data: updated, error } = await supabase.from("boq_items").update({
      ...patch,
      ...(quantityChanged ? { basis: "manual" as const } : {}),
    }).eq("id", data.lineId).eq("boq_id", boq.id).select("id").maybeSingle();
    if (error) fail(error, "Could not save the line. Try again.");
    if (!updated) throw new Error("That BOQ line no longer exists.");
    return { id: updated.id };
  });

export const refreshBoqLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ boqId: z.string().uuid(), lineId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const boq = await requireDraft(supabase, data.boqId);
    const line = (await loadLines(supabase, boq.id)).find(candidate => candidate.id === data.lineId);
    if (!line) throw new Error("That BOQ line no longer exists.");
    if (!line.takeoffItemId) throw new Error("This line is not linked to a takeoff item.");
    const { items, catalog } = await loadTakeoffSnapshot(supabase, boq.project_id);
    const item = items.find(candidate => candidate.id === line.takeoffItemId);
    if (!item) throw new Error("The takeoff item this line came from no longer exists.");
    const quantity = itemQuantity(item, catalog);
    if (!quantity.ok) throw new Error(quantity.error);
    const { data: updated, error } = await supabase.from("boq_items").update({
      unit: item.unit,
      basis: item.basis,
      quantity: quantity.value,
      calculated_quantity: item.basis === "calculated" ? quantity.value : null,
    }).eq("id", line.id).eq("boq_id", boq.id).select("id").maybeSingle();
    if (error) fail(error, "Could not refresh the line. Try again.");
    if (!updated) throw new Error("That BOQ line no longer exists.");
    return { id: updated.id };
  });

export const deleteBoqLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ boqId: z.string().uuid(), lineId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const boq = await requireDraft(supabase, data.boqId);
    const { data: removed, error } = await supabase.from("boq_items").delete().eq("id", data.lineId).eq("boq_id", boq.id).select("id").maybeSingle();
    if (error) fail(error, "Could not remove the line. Try again.");
    if (!removed) throw new Error("That BOQ line no longer exists.");
    return { id: removed.id };
  });

export const reorderBoqLines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ boqId: z.string().uuid(), orderedIds: z.array(z.string().uuid()).min(1).max(5000) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const boq = await requireDraft(supabase, data.boqId);
    const existing = await loadLines(supabase, boq.id);
    const known = new Set(existing.map(line => line.id));
    if (existing.length !== data.orderedIds.length || new Set(data.orderedIds).size !== data.orderedIds.length || data.orderedIds.some(id => !known.has(id))) {
      throw new Error("The BOQ changed since it was loaded. Reload it and try again.");
    }
    const results = await Promise.all(data.orderedIds.map((id, index) => supabase.from("boq_items").update({ sort_order: index }).eq("id", id).eq("boq_id", boq.id)));
    const failed = results.find(result => result.error);
    if (failed?.error) fail(failed.error, "Could not save the new order. Try again.");
    return { count: data.orderedIds.length };
  });
