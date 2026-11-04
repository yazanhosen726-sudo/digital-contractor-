import type { BoqLine } from "./boq";
import { round } from "./takeoff";

export const PROCUREMENT_PRIORITIES = ["low", "medium", "high"] as const;
export type ProcurementPriority = (typeof PROCUREMENT_PRIORITIES)[number];

export const PROCUREMENT_STATUSES = ["required", "scheduled", "partially_purchased", "purchased", "cancelled"] as const;
export type ProcurementStatus = (typeof PROCUREMENT_STATUSES)[number];

export const DELIVERY_STATUSES = ["planned", "delivered", "cancelled"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const ESTIMATE_STATUSES = ["draft", "issued"] as const;
export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

export const PRIORITY_LABELS: Record<ProcurementPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const PROCUREMENT_STATUS_LABELS: Record<ProcurementStatus, string> = {
  required: "Required",
  scheduled: "Scheduled",
  partially_purchased: "Partially purchased",
  purchased: "Purchased",
  cancelled: "Cancelled",
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  planned: "Planned",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export type ProcurementItem = {
  id: string;
  boqItemId: string | null;
  materialName: string;
  description: string | null;
  requiredQuantity: number;
  unit: string;
  boqReference: string | null;
  phase: string | null;
  requiredDate: string | null;
  priority: ProcurementPriority;
  status: ProcurementStatus;
  notes: string | null;
  sortOrder: number;
};

export type ProcurementItemDraft = Omit<ProcurementItem, "id">;

export type Delivery = {
  id: string;
  procurementItemId: string;
  plannedDate: string | null;
  deliveryQuantity: number;
  status: DeliveryStatus;
  notes: string | null;
  sortOrder: number;
};

export type DeliveryDraft = Omit<Delivery, "id" | "procurementItemId">;

export type PriceCatalogEntry = {
  id: string;
  material: string;
  unit: string;
  estimatedPrice: number;
  currency: string;
  priceDate: string;
  sourceRef: string | null;
  notes: string | null;
};

export type EstimateLine = {
  id: string;
  procurementItemId: string | null;
  lineNumber: string;
  materialName: string;
  description: string | null;
  specifications: string | null;
  quantity: number;
  unit: string;
  estimatedUnitPrice: number;
  lineTotal: number;
  sortOrder: number;
};

export type EstimateLineDraft = Omit<EstimateLine, "id">;

export type PurchaseEstimate = {
  id: string;
  documentNumber: string;
  documentDate: string;
  plannedDeliveryDate: string | null;
  companyName: string | null;
  companyAddress: string | null;
  companyContact: string | null;
  projectName: string | null;
  supplierName: string | null;
  supplierContact: string | null;
  currency: string;
  subtotal: number;
  transportCost: number;
  taxAmount: number;
  discountAmount: number;
  grandTotal: number;
  notesTerms: string | null;
  status: EstimateStatus;
  revision: number;
};

export const SUGGESTED_MATERIALS = [
  "Cement", "Steel reinforcement", "Sand", "Gravel", "Concrete",
  "Blocks and bricks", "Waterproofing materials", "Paint",
  "Electrical supplies", "Plumbing supplies", "Other construction materials",
] as const;

export const INDICATIVE_LABEL = "Indicative Estimate — Not a Supplier Quotation";

export function generateProcurementDrafts(boqLines: BoqLine[]): ProcurementItemDraft[] {
  return boqLines
    .filter(line => line.quantity !== null && line.quantity > 0 && line.unit !== null)
    .map((line, index) => ({
      boqItemId: line.id,
      materialName: line.description?.trim() || "Unnamed material",
      description: line.notes ?? null,
      requiredQuantity: round(line.quantity!),
      unit: line.unit!,
      boqReference: line.itemNumber || null,
      phase: line.category ?? null,
      requiredDate: null,
      priority: "medium" as const,
      status: "required" as const,
      notes: null,
      sortOrder: index,
    }));
}

export type DeliverySummary = {
  totalScheduled: number;
  totalDelivered: number;
  totalActive: number;
  remaining: number;
  percentScheduled: number;
};

export function summarizeDeliveries(item: Pick<ProcurementItem, "requiredQuantity">, deliveries: Delivery[]): DeliverySummary {
  const active = deliveries.filter(d => d.status !== "cancelled");
  const scheduled = active.filter(d => d.status === "planned").reduce((sum, d) => sum + d.deliveryQuantity, 0);
  const delivered = active.filter(d => d.status === "delivered").reduce((sum, d) => sum + d.deliveryQuantity, 0);
  const totalActive = round(scheduled + delivered);
  const remaining = round(Math.max(0, item.requiredQuantity - totalActive));
  const percentScheduled = item.requiredQuantity > 0 ? Math.min(100, round((totalActive / item.requiredQuantity) * 100)) : 0;
  return { totalScheduled: round(scheduled), totalDelivered: round(delivered), totalActive, remaining, percentScheduled };
}

export type DeliveryWarning = { severity: "error" | "warning"; message: string };

export function validateDeliveryQuantity(
  item: Pick<ProcurementItem, "requiredQuantity" | "id">,
  deliveries: Delivery[],
  newQuantity: number,
  excludeDeliveryId?: string,
): DeliveryWarning | null {
  if (!Number.isFinite(newQuantity) || newQuantity < 0) {
    return { severity: "error", message: "The delivery quantity must be zero or more." };
  }
  const active = deliveries.filter(d => d.status !== "cancelled" && d.id !== excludeDeliveryId);
  const existingTotal = round(active.reduce((sum, d) => sum + d.deliveryQuantity, 0));
  const newTotal = round(existingTotal + newQuantity);
  if (newTotal > item.requiredQuantity) {
    return {
      severity: "warning",
      message: `This delivery brings the total to ${newTotal} ${"units"}, which exceeds the remaining requirement of ${item.requiredQuantity}. Proceed only if the excess is intentional.`,
    };
  }
  return null;
}

export function matchPriceCatalog(
  item: Pick<ProcurementItem, "materialName" | "unit">,
  catalog: PriceCatalogEntry[],
): PriceCatalogEntry | null {
  const normalise = (text: string) => text.trim().toLowerCase();
  return catalog.find(entry =>
    normalise(entry.material) === normalise(item.materialName) && entry.unit === item.unit,
  ) ?? null;
}

export function computeLineTotal(quantity: number, unitPrice: number): number {
  return round(quantity * unitPrice);
}

export function computeEstimateTotals(lines: EstimateLine[], adjustments: { transportCost: number; taxAmount: number; discountAmount: number }) {
  const subtotal = round(lines.reduce((sum, line) => sum + line.lineTotal, 0));
  const grandTotal = round(Math.max(0, subtotal + adjustments.transportCost + adjustments.taxAmount - adjustments.discountAmount));
  return { subtotal, grandTotal };
}

export function sortEstimateLines(lines: EstimateLine[]): EstimateLine[] {
  return [...lines].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function autoLineNumbers(lines: EstimateLine[]): Map<string, string> {
  const numbers = new Map<string, string>();
  sortEstimateLines(lines).forEach((line, index) => numbers.set(line.id, String(index + 1)));
  return numbers;
}

export function generateEstimateLines(
  items: ProcurementItem[],
  catalog: PriceCatalogEntry[],
  currency: string,
): EstimateLineDraft[] {
  return items.map((item, index) => {
    const price = matchPriceCatalog(item, catalog);
    const unitPrice = price && price.currency === currency ? price.estimatedPrice : 0;
    return {
      procurementItemId: item.id,
      lineNumber: String(index + 1),
      materialName: item.materialName,
      description: item.description,
      specifications: null,
      quantity: item.requiredQuantity,
      unit: item.unit,
      estimatedUnitPrice: unitPrice,
      lineTotal: computeLineTotal(item.requiredQuantity, unitPrice),
      sortOrder: index,
    };
  });
}

export type ProcurementScheduleRow = {
  item: ProcurementItem;
  deliveries: Delivery[];
  summary: DeliverySummary;
  hasPrice: boolean;
  estimatedPrice: number | null;
  estimatedTotal: number | null;
  currency: string | null;
};

export function buildSchedule(
  items: ProcurementItem[],
  deliveries: Delivery[],
  catalog: PriceCatalogEntry[],
): ProcurementScheduleRow[] {
  return items.map(item => {
    const itemDeliveries = deliveries.filter(d => d.procurementItemId === item.id).sort((a, b) => a.sortOrder - b.sortOrder);
    const summary = summarizeDeliveries(item, itemDeliveries);
    const price = matchPriceCatalog(item, catalog);
    return {
      item,
      deliveries: itemDeliveries,
      summary,
      hasPrice: price !== null,
      estimatedPrice: price?.estimatedPrice ?? null,
      estimatedTotal: price ? round(item.requiredQuantity * price.estimatedPrice) : null,
      currency: price?.currency ?? null,
    };
  });
}

export function upcomingDeliveries(
  items: ProcurementItem[],
  deliveries: Delivery[],
  withinDays: number,
  now: Date = new Date(),
): { date: string; item: ProcurementItem; delivery: Delivery }[] {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + withinDays);
  const result: { date: string; item: ProcurementItem; delivery: Delivery }[] = [];
  for (const item of items) {
    for (const delivery of deliveries.filter(d => d.procurementItemId === item.id && d.status === "planned" && d.plannedDate)) {
      const deliveryDate = new Date(delivery.plannedDate!);
      if (deliveryDate >= now && deliveryDate <= cutoff) {
        result.push({ date: delivery.plannedDate!, item, delivery });
      }
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

export function deriveStatus(item: Pick<ProcurementItem, "requiredQuantity">, deliveries: Delivery[]): ProcurementStatus {
  const active = deliveries.filter(d => d.status !== "cancelled");
  if (active.length === 0) return "required";
  const delivered = active.filter(d => d.status === "delivered").reduce((sum, d) => sum + d.deliveryQuantity, 0);
  const totalActive = round(active.reduce((sum, d) => sum + d.deliveryQuantity, 0));
  if (delivered >= item.requiredQuantity && item.requiredQuantity > 0) return "purchased";
  if (delivered > 0) return "partially_purchased";
  if (totalActive > 0) return "scheduled";
  return "required";
}
