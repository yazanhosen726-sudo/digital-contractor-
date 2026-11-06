import { createServerFn } from "@tanstack/react-start";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  computeEstimateTotals,
  computeLineTotal,
  deriveStatus,
  generateEstimateLines,
  generateProcurementDrafts,
  INDICATIVE_LABEL,
  PROCUREMENT_PRIORITIES,
  PROCUREMENT_STATUSES,
  round,
  validateDeliveryQuantity,
  type Delivery,
  type EstimateLine,
  type PriceCatalogEntry,
  type ProcurementItem,
  type PurchaseEstimate,
} from "./procurement";
import { autoLineNumbers } from "./procurement";

type Supabase = SupabaseClient<Database>;

function fail(error: PostgrestError | null, message: string): never {
  if (error?.code === "42501") throw new Error("You do not have permission to perform this action.");
  if (error) console.error("Procurement operation failed", error.code, error.message);
  throw new Error(message);
}

async function getProjectOrg(supabase: Supabase, projectId: string): Promise<string> {
  const { data, error } = await supabase.from("projects").select("org_id").eq("id", projectId).maybeSingle();
  if (error || !data) throw new Error("This project could not be found.");
  return data.org_id;
}

const itemRow = z.object({
  id: z.string().uuid(),
  boq_item_id: z.string().uuid().nullable(),
  material_name: z.string(),
  description: z.string().nullable(),
  required_quantity: z.number(),
  unit: z.string(),
  boq_reference: z.string().nullable(),
  phase: z.string().nullable(),
  required_date: z.string().nullable(),
  priority: z.enum(PROCUREMENT_PRIORITIES),
  status: z.enum(PROCUREMENT_STATUSES),
  notes: z.string().nullable(),
  sort_order: z.number().int(),
});

const deliveryRow = z.object({
  id: z.string().uuid(),
  procurement_item_id: z.string().uuid(),
  planned_date: z.string().nullable(),
  delivery_quantity: z.number(),
  status: z.enum(["planned", "delivered", "cancelled"]),
  notes: z.string().nullable(),
  sort_order: z.number().int(),
});

const priceRow = z.object({
  id: z.string().uuid(),
  material: z.string(),
  unit: z.string(),
  estimated_price: z.number(),
  currency: z.string(),
  price_date: z.string(),
  source_ref: z.string().nullable(),
  notes: z.string().nullable(),
});

const estimateRow = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  org_id: z.string().uuid(),
  series_id: z.string().uuid(),
  revision: z.number().int(),
  document_number: z.string(),
  document_date: z.string(),
  planned_delivery_date: z.string().nullable(),
  company_name: z.string().nullable(),
  company_address: z.string().nullable(),
  company_contact: z.string().nullable(),
  project_name: z.string().nullable(),
  supplier_name: z.string().nullable(),
  supplier_contact: z.string().nullable(),
  currency: z.string(),
  subtotal: z.number(),
  transport_cost: z.number(),
  tax_amount: z.number(),
  discount_amount: z.number(),
  grand_total: z.number(),
  notes_terms: z.string().nullable(),
  status: z.enum(["draft", "issued"]),
  issued_at: z.string().nullable(),
  created_at: z.string(),
});

const estimateLineRow = z.object({
  id: z.string().uuid(),
  estimate_id: z.string().uuid(),
  procurement_item_id: z.string().uuid().nullable(),
  sort_order: z.number().int(),
  line_number: z.string(),
  material_name: z.string(),
  description: z.string().nullable(),
  specifications: z.string().nullable(),
  quantity: z.number(),
  unit: z.string(),
  estimated_unit_price: z.number(),
  line_total: z.number(),
});

function toItem(row: z.infer<typeof itemRow>): ProcurementItem {
  return {
    id: row.id, boqItemId: row.boq_item_id, materialName: row.material_name,
    description: row.description, requiredQuantity: row.required_quantity, unit: row.unit,
    boqReference: row.boq_reference, phase: row.phase, requiredDate: row.required_date,
    priority: row.priority, status: row.status, notes: row.notes, sortOrder: row.sort_order,
  };
}

function toDelivery(row: z.infer<typeof deliveryRow>): Delivery {
  return {
    id: row.id, procurementItemId: row.procurement_item_id, plannedDate: row.planned_date,
    deliveryQuantity: row.delivery_quantity, status: row.status, notes: row.notes, sortOrder: row.sort_order,
  };
}

function toPriceEntry(row: z.infer<typeof priceRow>): PriceCatalogEntry {
  return {
    id: row.id, material: row.material, unit: row.unit, estimatedPrice: row.estimated_price,
    currency: row.currency, priceDate: row.price_date, sourceRef: row.source_ref, notes: row.notes,
  };
}

function toEstimate(row: z.infer<typeof estimateRow>): PurchaseEstimate {
  return {
    id: row.id, documentNumber: row.document_number, documentDate: row.document_date,
    plannedDeliveryDate: row.planned_delivery_date, companyName: row.company_name,
    companyAddress: row.company_address, companyContact: row.company_contact,
    projectName: row.project_name, supplierName: row.supplier_name,
    supplierContact: row.supplier_contact, currency: row.currency, subtotal: row.subtotal,
    transportCost: row.transport_cost, taxAmount: row.tax_amount,
    discountAmount: row.discount_amount, grandTotal: row.grand_total,
    notesTerms: row.notes_terms, status: row.status, revision: row.revision,
  };
}

function toEstimateLine(row: z.infer<typeof estimateLineRow>): EstimateLine {
  return {
    id: row.id, procurementItemId: row.procurement_item_id, lineNumber: row.line_number,
    materialName: row.material_name, description: row.description,
    specifications: row.specifications, quantity: row.quantity, unit: row.unit,
    estimatedUnitPrice: row.estimated_unit_price, lineTotal: row.line_total, sortOrder: row.sort_order,
  };
}

async function loadBoqItems(supabase: Supabase, projectId: string) {
  const { data: boqs, error: boqError } = await supabase.from("boqs").select("id").eq("project_id", projectId).eq("status", "issued").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (boqError) fail(boqError, "Could not load the BOQ. Try again.");
  if (!boqs) return [];
  const { data: lines, error: lineError } = await supabase.from("boq_items").select("id, takeoff_item_id, sort_order, item_number, section, category, description, unit, quantity, calculated_quantity, basis, notes").eq("boq_id", boqs.id).order("sort_order", { ascending: true });
  if (lineError) fail(lineError, "Could not load the BOQ lines. Try again.");
  return (lines ?? []).map(row => ({
    id: row.id, sortOrder: row.sort_order, takeoffItemId: row.takeoff_item_id,
    itemNumber: row.item_number, section: row.section, category: row.category,
    description: row.description, unit: row.unit, quantity: row.quantity,
    calculatedQuantity: row.calculated_quantity, basis: row.basis, notes: row.notes,
  }));
}

export const loadProcurement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ projectId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: items, error: itemError } = await supabase.from("procurement_items").select("id, boq_item_id, material_name, description, required_quantity, unit, boq_reference, phase, required_date, priority, status, notes, sort_order").eq("project_id", data.projectId).order("sort_order", { ascending: true });
    if (itemError) fail(itemError, "Could not load the procurement items. Try again.");
    const parsedItems = z.array(itemRow).parse(items ?? []);

    const { data: deliveries, error: deliveryError } = parsedItems.length === 0 ? { data: [], error: null } : await supabase.from("procurement_deliveries").select("id, procurement_item_id, planned_date, delivery_quantity, status, notes, sort_order").in("procurement_item_id", parsedItems.map(i => i.id)).order("sort_order", { ascending: true });
    if (deliveryError) fail(deliveryError, "Could not load the deliveries. Try again.");
    const parsedDeliveries = z.array(deliveryRow).parse(deliveries ?? []);

    const orgId = parsedItems.length > 0 ? parsedItems[0]!.id : await getProjectOrg(supabase, data.projectId);
    const { data: prices, error: priceError } = await supabase.from("procurement_price_catalog").select("id, material, unit, estimated_price, currency, price_date, source_ref, notes").eq("org_id", orgId).order("material", { ascending: true });
    if (priceError) fail(priceError, "Could not load the price catalog. Try again.");
    const parsedPrices = z.array(priceRow).parse(prices ?? []);

    return {
      items: parsedItems.map(toItem),
      deliveries: parsedDeliveries.map(toDelivery),
      prices: parsedPrices.map(toPriceEntry),
      indicativeLabel: INDICATIVE_LABEL,
    };
  });

export const generateProcurementItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ projectId: z.string().uuid(), selectedBoqItemIds: z.array(z.string().uuid()).optional() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const orgId = await getProjectOrg(supabase, data.projectId);
    const boqItems = await loadBoqItems(supabase, data.projectId);
    if (boqItems.length === 0) throw new Error("Issue a BOQ before generating procurement items.");

    const { data: existing, error: existingError } = await supabase.from("procurement_items").select("boq_item_id").eq("project_id", data.projectId).not("boq_item_id", "is", null);
    if (existingError) fail(existingError, "Could not check existing procurement items. Try again.");
    const alreadyLinked = new Set((existing ?? []).map(row => row.boq_item_id));

    const selectable = data.selectedBoqItemIds ? new Set(data.selectedBoqItemIds) : null;
    const drafts = generateProcurementDrafts(boqItems).filter(draft => {
      if (!draft.boqItemId) return true;
      if (alreadyLinked.has(draft.boqItemId)) return false;
      if (selectable && !selectable.has(draft.boqItemId)) return false;
      return true;
    });
    if (drafts.length === 0) throw new Error("All selected BOQ items are already in the procurement list.");

    const { data: created, error } = await supabase.from("procurement_items").insert(drafts.map(d => ({
      org_id: orgId, project_id: data.projectId, boq_item_id: d.boqItemId,
      material_name: d.materialName, description: d.description, required_quantity: d.requiredQuantity,
      unit: d.unit, boq_reference: d.boqReference, phase: d.phase, required_date: d.requiredDate,
      priority: d.priority, status: d.status, notes: d.notes, sort_order: d.sortOrder,
    }))).select("id");
    if (error) fail(error, "Could not generate the procurement items. Try again.");
    return { count: created?.length ?? 0 };
  });

const saveItemInput = z.object({
  projectId: z.string().uuid(),
  itemId: z.string().uuid().optional(),
  materialName: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  requiredQuantity: z.number().min(0).lt(1_000_000_000),
  unit: z.string().trim().min(1).max(20),
  boqReference: z.string().trim().max(120).optional(),
  phase: z.string().trim().max(80).optional(),
  requiredDate: z.string().optional(),
  priority: z.enum(PROCUREMENT_PRIORITIES),
  notes: z.string().trim().max(1000).optional(),
});

export const saveProcurementItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(saveItemInput)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const orgId = await getProjectOrg(supabase, data.projectId);
    const values = {
      material_name: data.materialName,
      description: data.description || null,
      required_quantity: round(data.requiredQuantity),
      unit: data.unit,
      boq_reference: data.boqReference || null,
      phase: data.phase || null,
      required_date: data.requiredDate || null,
      priority: data.priority,
      notes: data.notes || null,
    };
    if (data.itemId) {
      const { data: updated, error } = await supabase.from("procurement_items").update(values).eq("id", data.itemId).eq("project_id", data.projectId).select("id").maybeSingle();
      if (error) fail(error, "Could not save the procurement item. Try again.");
      if (!updated) throw new Error("That procurement item no longer exists.");
      return { id: updated.id };
    }
    const { data: created, error } = await supabase.from("procurement_items").insert({ ...values, org_id: orgId, project_id: data.projectId }).select("id").single();
    if (error) fail(error, "Could not add the procurement item. Try again.");
    return { id: created.id };
  });

export const deleteProcurementItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ projectId: z.string().uuid(), itemId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: removed, error } = await context.supabase.from("procurement_items").delete().eq("id", data.itemId).eq("project_id", data.projectId).select("id").maybeSingle();
    if (error) fail(error, "Could not delete the procurement item. Try again.");
    if (!removed) throw new Error("That procurement item no longer exists.");
    return { id: removed.id };
  });

const saveDeliveryInput = z.object({
  itemId: z.string().uuid(),
  deliveryId: z.string().uuid().optional(),
  plannedDate: z.string().optional(),
  deliveryQuantity: z.number().min(0).lt(1_000_000_000),
  status: z.enum(["planned", "delivered", "cancelled"]).optional(),
  notes: z.string().trim().max(500).optional(),
  overrideWarning: z.boolean().optional(),
});

export const saveDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(saveDeliveryInput)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: itemData, error: itemError } = await supabase.from("procurement_items").select("id, org_id, required_quantity").eq("id", data.itemId).maybeSingle();
    if (itemError || !itemData) throw new Error("That procurement item could not be found.");
    const orgId = itemData.org_id;

    const { data: existingDeliveries, error: delError } = await supabase.from("procurement_deliveries").select("id, procurement_item_id, planned_date, delivery_quantity, status, notes, sort_order").eq("procurement_item_id", data.itemId);
    if (delError) fail(delError, "Could not load existing deliveries. Try again.");
    const deliveries = z.array(deliveryRow).parse(existingDeliveries ?? []).map(toDelivery);

    const warning = validateDeliveryQuantity(
      { requiredQuantity: Number(itemData.required_quantity), id: data.itemId },
      deliveries, data.deliveryQuantity, data.deliveryId,
    );
    if (warning && warning.severity === "warning" && !data.overrideWarning) {
      throw new Error(warning.message + " Confirm to proceed.");
    }
    if (warning && warning.severity === "error") {
      throw new Error(warning.message);
    }

    const values = {
      planned_date: data.plannedDate || null,
      delivery_quantity: round(data.deliveryQuantity),
      status: data.status ?? "planned",
      notes: data.notes || null,
    };
    if (data.deliveryId) {
      const { data: updated, error } = await supabase.from("procurement_deliveries").update(values).eq("id", data.deliveryId).eq("procurement_item_id", data.itemId).select("id").maybeSingle();
      if (error) fail(error, "Could not save the delivery. Try again.");
      if (!updated) throw new Error("That delivery no longer exists.");
    } else {
      const { data: created, error } = await supabase.from("procurement_deliveries").insert({ ...values, org_id: orgId, procurement_item_id: data.itemId, sort_order: deliveries.length }).select("id").single();
      if (error) fail(error, "Could not add the delivery. Try again.");
    }

    const newStatus = deriveStatus({ requiredQuantity: Number(itemData.required_quantity) }, [
      ...deliveries.filter(d => d.id !== data.deliveryId),
      { id: data.deliveryId ?? "new", procurementItemId: data.itemId, ...values, sortOrder: 0 } as Delivery,
    ]);
    await supabase.from("procurement_items").update({ status: newStatus }).eq("id", data.itemId);
    return { status: newStatus };
  });

export const deleteDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ itemId: z.string().uuid(), deliveryId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: removed, error } = await supabase.from("procurement_deliveries").delete().eq("id", data.deliveryId).eq("procurement_item_id", data.itemId).select("id").maybeSingle();
    if (error) fail(error, "Could not delete the delivery. Try again.");
    if (!removed) throw new Error("That delivery no longer exists.");
    const { data: itemData } = await supabase.from("procurement_items").select("required_quantity").eq("id", data.itemId).maybeSingle();
    const { data: remaining } = await supabase.from("procurement_deliveries").select("id, procurement_item_id, planned_date, delivery_quantity, status, notes, sort_order").eq("procurement_item_id", data.itemId);
    const newStatus = deriveStatus({ requiredQuantity: Number(itemData?.required_quantity ?? 0) }, z.array(deliveryRow).parse(remaining ?? []).map(toDelivery));
    await supabase.from("procurement_items").update({ status: newStatus }).eq("id", data.itemId);
    return { status: newStatus };
  });

export const listPriceCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({}))
  .handler(async ({ context }) => {
    const { data: memberships, error: memberError } = await context.supabase.from("org_members").select("org_id");
    if (memberError) fail(memberError, "Could not load the price catalog. Try again.");
    const orgIds = (memberships ?? []).map(m => m.org_id);
    if (orgIds.length === 0) return { entries: [] };
    const { data: prices, error } = await context.supabase.from("procurement_price_catalog").select("id, material, unit, estimated_price, currency, price_date, source_ref, notes").in("org_id", orgIds).order("material", { ascending: true });
    if (error) fail(error, "Could not load the price catalog. Try again.");
    return { entries: z.array(priceRow).parse(prices ?? []).map(toPriceEntry) };
  });

const savePriceInput = z.object({
  entryId: z.string().uuid().optional(),
  material: z.string().trim().min(1).max(200),
  unit: z.string().trim().min(1).max(20),
  estimatedPrice: z.number().min(0).lt(1_000_000_000),
  currency: z.string().trim().length(3).default("USD"),
  priceDate: z.string().optional(),
  sourceRef: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const savePriceEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(savePriceInput)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: membership, error: memberError } = await supabase.from("org_members").select("org_id, role").eq("user_id", userId).maybeSingle();
    if (memberError || !membership) throw new Error("You do not belong to a business.");
    const orgId = membership.org_id;
    const values = {
      material: data.material, unit: data.unit, estimated_price: round(data.estimatedPrice),
      currency: data.currency, price_date: data.priceDate || new Date().toISOString().slice(0, 10),
      source_ref: data.sourceRef || null, notes: data.notes || null, updated_at: new Date().toISOString(),
    };
    if (data.entryId) {
      const { data: updated, error } = await supabase.from("procurement_price_catalog").update(values).eq("id", data.entryId).eq("org_id", orgId).select("id").maybeSingle();
      if (error) fail(error, "Could not save the price entry. Try again.");
      if (!updated) throw new Error("That price entry no longer exists.");
      return { id: updated.id };
    }
    const { data: created, error } = await supabase.from("procurement_price_catalog").insert({ ...values, org_id: orgId }).select("id").single();
    if (error) fail(error, "Could not add the price entry. Try again.");
    return { id: created.id };
  });

export const deletePriceEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ entryId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: removed, error } = await context.supabase.from("procurement_price_catalog").delete().eq("id", data.entryId).select("id").maybeSingle();
    if (error) fail(error, "Could not delete the price entry. Try again.");
    if (!removed) throw new Error("That price entry no longer exists.");
    return { id: removed.id };
  });

export const listEstimates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ projectId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("purchase_estimates").select("id, document_number, revision, status, currency, grand_total, created_at").eq("project_id", data.projectId).order("created_at", { ascending: false });
    if (error) fail(error, "Could not load the purchase estimates. Try again.");
    return z.array(z.object({
      id: z.string().uuid(), document_number: z.string(), revision: z.number().int(),
      status: z.enum(["draft", "issued"]), currency: z.string(), grand_total: z.number(), created_at: z.string(),
    })).parse(rows ?? []);
  });

export const loadEstimate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ estimateId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: est, error: estError } = await context.supabase.from("purchase_estimates").select("id, project_id, org_id, series_id, revision, document_number, document_date, planned_delivery_date, company_name, company_address, company_contact, project_name, supplier_name, supplier_contact, currency, subtotal, transport_cost, tax_amount, discount_amount, grand_total, notes_terms, status, issued_at, created_at").eq("id", data.estimateId).maybeSingle();
    if (estError) fail(estError, "Could not load this estimate. Try again.");
    if (!est) throw new Error("This estimate could not be found.");
    const estimate = toEstimate(estimateRow.parse(est));

    const { data: lines, error: lineError } = await context.supabase.from("purchase_estimate_lines").select("id, estimate_id, procurement_item_id, sort_order, line_number, material_name, description, specifications, quantity, unit, estimated_unit_price, line_total").eq("estimate_id", data.estimateId).order("sort_order", { ascending: true });
    if (lineError) fail(lineError, "Could not load the estimate lines. Try again.");
    const estimateLines = z.array(estimateLineRow).parse(lines ?? []).map(toEstimateLine);

    return { estimate, lines: estimateLines, indicativeLabel: INDICATIVE_LABEL };
  });

export const createEstimate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    projectId: z.string().uuid(),
    documentNumber: z.string().trim().min(1).max(60),
    procurementItemIds: z.array(z.string().uuid()).optional(),
    currency: z.string().trim().length(3).default("USD"),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const orgId = await getProjectOrg(supabase, data.projectId);

    const { data: items, error: itemError } = await supabase.from("procurement_items").select("id, boq_item_id, material_name, description, required_quantity, unit, boq_reference, phase, required_date, priority, status, notes, sort_order").eq("project_id", data.projectId).order("sort_order", { ascending: true });
    if (itemError) fail(itemError, "Could not load procurement items. Try again.");
    const parsedItems = z.array(itemRow).parse(items ?? []).map(toItem);
    const selectedItems = data.procurementItemIds ? parsedItems.filter(i => data.procurementItemIds!.includes(i.id)) : parsedItems;
    if (selectedItems.length === 0) throw new Error("Add procurement items before creating a purchase estimate.");

    const { data: prices, error: priceError } = await supabase.from("procurement_price_catalog").select("id, material, unit, estimated_price, currency, price_date, source_ref, notes").eq("org_id", orgId);
    if (priceError) fail(priceError, "Could not load the price catalog. Try again.");
    const catalog = z.array(priceRow).parse(prices ?? []).map(toPriceEntry);

    const drafts = generateEstimateLines(selectedItems, catalog, data.currency);
    const totals = computeEstimateTotals(
      drafts.map((d, i) => ({ ...d, id: `new-${i}` })),
      { transportCost: 0, taxAmount: 0, discountAmount: 0 },
    );

    const { data: project, error: projectError } = await supabase.from("projects").select("name").eq("id", data.projectId).maybeSingle();
    if (projectError) fail(projectError, "Could not load the project. Try again.");

    const { data: created, error } = await supabase.from("purchase_estimates").insert({
      org_id: orgId, project_id: data.projectId, document_number: data.documentNumber,
      project_name: project?.name ?? null, currency: data.currency,
      subtotal: totals.subtotal, grand_total: totals.grandTotal,
    }).select("id").single();
    if (error) fail(error, "Could not create the purchase estimate. Try again.");

    if (drafts.length > 0) {
      const { error: lineError } = await supabase.from("purchase_estimate_lines").insert(drafts.map((d, i) => ({
        org_id: orgId, estimate_id: created.id, procurement_item_id: d.procurementItemId,
        sort_order: d.sortOrder, line_number: String(i + 1), material_name: d.materialName,
        description: d.description, specifications: d.specifications, quantity: d.quantity,
        unit: d.unit, estimated_unit_price: d.estimatedUnitPrice, line_total: d.lineTotal,
      })));
      if (lineError) {
        await supabase.from("purchase_estimates").delete().eq("id", created.id);
        fail(lineError, "Could not create the estimate lines. Try again.");
      }
    }
    return { id: created.id };
  });

const saveEstimateLineInput = z.object({
  estimateId: z.string().uuid(),
  lineId: z.string().uuid().optional(),
  materialName: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  specifications: z.string().trim().max(500).optional(),
  quantity: z.number().min(0).lt(1_000_000_000),
  unit: z.string().trim().min(1).max(20),
  estimatedUnitPrice: z.number().min(0).lt(1_000_000_000),
});

export const saveEstimateLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(saveEstimateLineInput)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: est, error: estError } = await supabase.from("purchase_estimates").select("id, org_id, status").eq("id", data.estimateId).maybeSingle();
    if (estError) fail(estError, "Could not load this estimate. Try again.");
    if (!est) throw new Error("This estimate could not be found.");
    if (est.status === "issued") throw new Error("This estimate has been issued and can no longer be changed.");

    const lineTotal = computeLineTotal(data.quantity, data.estimatedUnitPrice);
    const values = {
      material_name: data.materialName, description: data.description || null,
      specifications: data.specifications || null, quantity: round(data.quantity),
      unit: data.unit, estimated_unit_price: round(data.estimatedUnitPrice), line_total: lineTotal,
    };
    if (data.lineId) {
      const { data: updated, error } = await supabase.from("purchase_estimate_lines").update(values).eq("id", data.lineId).eq("estimate_id", data.estimateId).select("id").maybeSingle();
      if (error) fail(error, "Could not save the line. Try again.");
      if (!updated) throw new Error("That line no longer exists.");
    } else {
      const { data: existing } = await supabase.from("purchase_estimate_lines").select("id").eq("estimate_id", data.estimateId);
      const { data: created, error } = await supabase.from("purchase_estimate_lines").insert({ ...values, org_id: est.org_id, estimate_id: data.estimateId, sort_order: (existing ?? []).length }).select("id").single();
      if (error) fail(error, "Could not add the line. Try again.");
    }
    await recalcEstimateTotals(supabase, data.estimateId);
    return { ok: true };
  });

export const deleteEstimateLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ estimateId: z.string().uuid(), lineId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: est } = await supabase.from("purchase_estimates").select("status").eq("id", data.estimateId).maybeSingle();
    if (est?.status === "issued") throw new Error("This estimate has been issued and can no longer be changed.");
    const { data: removed, error } = await supabase.from("purchase_estimate_lines").delete().eq("id", data.lineId).eq("estimate_id", data.estimateId).select("id").maybeSingle();
    if (error) fail(error, "Could not delete the line. Try again.");
    if (!removed) throw new Error("That line no longer exists.");
    await recalcEstimateTotals(supabase, data.estimateId);
    return { ok: true };
  });

export const reorderEstimateLines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ estimateId: z.string().uuid(), orderedIds: z.array(z.string().uuid()).min(1).max(5000) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: est } = await supabase.from("purchase_estimates").select("status").eq("id", data.estimateId).maybeSingle();
    if (est?.status === "issued") throw new Error("This estimate has been issued and can no longer be changed.");
    const { data: lines } = await supabase.from("purchase_estimate_lines").select("id").eq("estimate_id", data.estimateId);
    const known = new Set((lines ?? []).map(l => l.id));
    if (data.orderedIds.length !== known.size || data.orderedIds.some(id => !known.has(id))) {
      throw new Error("The estimate changed since it was loaded. Reload it and try again.");
    }
    const numbers = new Map<string, string>();
    data.orderedIds.forEach((id, index) => numbers.set(id, String(index + 1)));
    await Promise.all(data.orderedIds.map((id, index) => supabase.from("purchase_estimate_lines").update({ sort_order: index, line_number: String(index + 1) }).eq("id", id).eq("estimate_id", data.estimateId)));
    return { count: data.orderedIds.length };
  });

const updateEstimateInput = z.object({
  estimateId: z.string().uuid(),
  documentNumber: z.string().trim().min(1).max(60).optional(),
  documentDate: z.string().optional(),
  plannedDeliveryDate: z.string().nullable().optional(),
  companyName: z.string().trim().max(200).nullable().optional(),
  companyAddress: z.string().trim().max(500).nullable().optional(),
  companyContact: z.string().trim().max(200).nullable().optional(),
  projectName: z.string().trim().max(200).nullable().optional(),
  supplierName: z.string().trim().max(200).nullable().optional(),
  supplierContact: z.string().trim().max(500).nullable().optional(),
  currency: z.string().trim().length(3).optional(),
  transportCost: z.number().min(0).lt(1_000_000_000_000).optional(),
  taxAmount: z.number().min(0).lt(1_000_000_000_000).optional(),
  discountAmount: z.number().min(0).lt(1_000_000_000_000).optional(),
  notesTerms: z.string().trim().max(2000).nullable().optional(),
});

export const updateEstimate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(updateEstimateInput)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: est, error: estError } = await supabase.from("purchase_estimates").select("id, status").eq("id", data.estimateId).maybeSingle();
    if (estError) fail(estError, "Could not load this estimate. Try again.");
    if (!est) throw new Error("This estimate could not be found.");
    if (est.status === "issued") throw new Error("This estimate has been issued and can no longer be changed.");

    const values: Record<string, unknown> = {};
    if (data.documentNumber !== undefined) values.document_number = data.documentNumber;
    if (data.documentDate !== undefined) values.document_date = data.documentDate;
    if (data.plannedDeliveryDate !== undefined) values.planned_delivery_date = data.plannedDeliveryDate;
    if (data.companyName !== undefined) values.company_name = data.companyName;
    if (data.companyAddress !== undefined) values.company_address = data.companyAddress;
    if (data.companyContact !== undefined) values.company_contact = data.companyContact;
    if (data.projectName !== undefined) values.project_name = data.projectName;
    if (data.supplierName !== undefined) values.supplier_name = data.supplierName;
    if (data.supplierContact !== undefined) values.supplier_contact = data.supplierContact;
    if (data.currency !== undefined) values.currency = data.currency;
    if (data.transportCost !== undefined) values.transport_cost = round(data.transportCost);
    if (data.taxAmount !== undefined) values.tax_amount = round(data.taxAmount);
    if (data.discountAmount !== undefined) values.discount_amount = round(data.discountAmount);
    if (data.notesTerms !== undefined) values.notes_terms = data.notesTerms;

    if (Object.keys(values).length > 0) {
      const { error } = await supabase.from("purchase_estimates").update(values).eq("id", data.estimateId).eq("status", "draft");
      if (error) fail(error, "Could not save the estimate. Try again.");
    }
    await recalcEstimateTotals(supabase, data.estimateId);
    return { ok: true };
  });

async function recalcEstimateTotals(supabase: Supabase, estimateId: string) {
  const { data: est } = await supabase.from("purchase_estimates").select("transport_cost, tax_amount, discount_amount").eq("id", estimateId).maybeSingle();
  if (!est) return;
  const { data: lines } = await supabase.from("purchase_estimate_lines").select("line_total").eq("estimate_id", estimateId);
  const subtotal = round((lines ?? []).reduce((sum, l) => sum + Number(l.line_total), 0));
  const grandTotal = round(Math.max(0, subtotal + Number(est.transport_cost) + Number(est.tax_amount) - Number(est.discount_amount)));
  await supabase.from("purchase_estimates").update({ subtotal, grand_total: grandTotal }).eq("id", estimateId);
}

export const issueEstimate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ estimateId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: est } = await supabase.from("purchase_estimates").select("status").eq("id", data.estimateId).maybeSingle();
    if (!est) throw new Error("This estimate could not be found.");
    if (est.status !== "draft") throw new Error("This estimate has already been issued.");
    const { data: lines } = await supabase.from("purchase_estimate_lines").select("quantity, estimated_unit_price").eq("estimate_id", data.estimateId);
    if ((lines ?? []).length === 0) throw new Error("Add at least one line before issuing this estimate.");
    const { data: issued, error } = await supabase.from("purchase_estimates").update({ status: "issued", issued_at: new Date().toISOString() }).eq("id", data.estimateId).eq("status", "draft").select("id").maybeSingle();
    if (error) fail(error, "Could not issue this estimate. Try again.");
    if (!issued) throw new Error("This estimate has already been issued.");
    return { id: issued.id };
  });

export const duplicateEstimate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ estimateId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: est, error: estError } = await supabase.from("purchase_estimates").select("id, org_id, project_id, series_id, revision, document_number, document_date, planned_delivery_date, company_name, company_address, company_contact, project_name, supplier_name, supplier_contact, currency, transport_cost, tax_amount, discount_amount, notes_terms").eq("id", data.estimateId).maybeSingle();
    if (estError) fail(estError, "Could not load this estimate. Try again.");
    if (!est) throw new Error("This estimate could not be found.");
    const { data: latest, error: latestError } = await supabase.from("purchase_estimates").select("revision").eq("series_id", est.series_id).order("revision", { ascending: false }).limit(1).maybeSingle();
    if (latestError) fail(latestError, "Could not duplicate this estimate. Try again.");
    const { data: created, error } = await supabase.from("purchase_estimates").insert({
      org_id: est.org_id, project_id: est.project_id, series_id: est.series_id,
      revision: (latest?.revision ?? est.revision) + 1, document_number: est.document_number,
      document_date: est.document_date, planned_delivery_date: est.planned_delivery_date,
      company_name: est.company_name, company_address: est.company_address,
      company_contact: est.company_contact, project_name: est.project_name,
      supplier_name: est.supplier_name, supplier_contact: est.supplier_contact,
      currency: est.currency, transport_cost: est.transport_cost, tax_amount: est.tax_amount,
      discount_amount: est.discount_amount, notes_terms: est.notes_terms,
    }).select("id").single();
    if (error) fail(error, "Could not duplicate this estimate. Try again.");
    const { data: lines } = await supabase.from("purchase_estimate_lines").select("procurement_item_id, sort_order, line_number, material_name, description, specifications, quantity, unit, estimated_unit_price, line_total").eq("estimate_id", data.estimateId).order("sort_order", { ascending: true });
    if (lines && lines.length > 0) {
      const { error: lineError } = await supabase.from("purchase_estimate_lines").insert(lines.map(l => ({
        org_id: est.org_id, estimate_id: created.id, procurement_item_id: l.procurement_item_id,
        sort_order: l.sort_order, line_number: l.line_number, material_name: l.material_name,
        description: l.description, specifications: l.specifications, quantity: l.quantity,
        unit: l.unit, estimated_unit_price: l.estimated_unit_price, line_total: l.line_total,
      })));
      if (lineError) {
        await supabase.from("purchase_estimates").delete().eq("id", created.id);
        fail(lineError, "Could not duplicate the estimate lines. Try again.");
      }
    }
    return { id: created.id };
  });

export { autoLineNumbers };
