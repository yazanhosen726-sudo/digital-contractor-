import type { Database } from '@/integrations/supabase/types';

// Contracts for preserved Bolt modules. These tables are NOT provisioned in the
// connected database; this file describes their expected shape, not availability.
type Table<R, Required extends keyof R> = {
  Row: R; Insert: Pick<R, Required> & Partial<R>; Update: Partial<R>; Relationships: [];
};
type Base = { id: string; org_id: string; created_at: string };
type Boq = Base & { project_id: string; series_id: string; revision: number; title: string; reference: string | null; status: 'draft' | 'issued'; issued_at: string | null };
type BoqItem = Base & { boq_id: string; takeoff_item_id: string | null; sort_order: number; item_number: string; section: string; category: string | null; description: string | null; unit: 'm' | 'm2' | 'm3' | 'kg' | 'ton' | 'pcs' | 'lot' | null; quantity: number | null; calculated_quantity: number | null; basis: 'manual' | 'calculated'; notes: string | null };
type Takeoff = Base & { project_id: string; name: string; category: string | null; unit: string; basis: string; method: string | null; factor: number | null; manual_quantity: number | null; notes: string | null };
type Review = Base & { document_id: string; candidate_id: string; source_checksum: string; action: 'approved' | 'corrected' | 'rejected' | 'reopened'; corrected_value: number | null; corrected_unit: 'mm' | 'cm' | 'm' | 'ft' | 'in' | null; actor_id: string | null; note: string | null };
type Item = Base & { project_id: string; boq_item_id: string | null; material_name: string; description: string | null; required_quantity: number; unit: string; boq_reference: string | null; phase: string | null; required_date: string | null; priority: 'low' | 'normal' | 'high' | 'urgent'; status: 'planned' | 'partially_delivered' | 'delivered'; notes: string | null; sort_order: number };
type Delivery = Base & { procurement_item_id: string; planned_date: string | null; delivery_quantity: number; status: 'planned' | 'delivered' | 'cancelled'; notes: string | null; sort_order: number };
type Price = Base & { material: string; unit: string; estimated_price: number; currency: string; price_date: string; source_ref: string | null; notes: string | null; updated_at: string };
type Estimate = Base & { project_id: string; series_id: string; revision: number; document_number: string; document_date: string; planned_delivery_date: string | null; company_name: string | null; company_address: string | null; company_contact: string | null; project_name: string | null; supplier_name: string | null; supplier_contact: string | null; currency: string; subtotal: number; transport_cost: number; tax_amount: number; discount_amount: number; grand_total: number; notes_terms: string | null; status: 'draft' | 'issued'; issued_at: string | null };
type EstimateLine = Base & { estimate_id: string; procurement_item_id: string | null; sort_order: number; line_number: string; material_name: string; description: string | null; specifications: string | null; quantity: number; unit: string; estimated_unit_price: number; line_total: number };
export type LegacyDatabase = Omit<Database, 'public'> & { public: Omit<Database['public'], 'Tables'> & { Tables: Database['public']['Tables'] & {
  boqs: Table<Boq, 'org_id' | 'project_id' | 'title'>;
  boq_items: Table<BoqItem, 'org_id' | 'boq_id' | 'section' | 'item_number'>;
  takeoff_items: Table<Takeoff, 'org_id' | 'project_id' | 'name' | 'unit' | 'basis'>;
  takeoff_item_sources: Table<Base & { item_id: string; document_id: string; candidate_id: string; source_checksum: string; occurrence: number }, 'org_id' | 'item_id' | 'document_id' | 'candidate_id' | 'source_checksum' | 'occurrence'>;
  measurement_review_events: Table<Review, 'org_id' | 'document_id' | 'candidate_id' | 'source_checksum' | 'action'>;
  procurement_items: Table<Item, 'org_id' | 'project_id' | 'material_name' | 'required_quantity' | 'unit'>;
  procurement_deliveries: Table<Delivery, 'org_id' | 'procurement_item_id' | 'delivery_quantity'>;
  procurement_price_catalog: Table<Price, 'org_id' | 'material' | 'unit' | 'estimated_price' | 'currency' | 'price_date'>;
  purchase_estimates: Table<Estimate, 'org_id' | 'project_id' | 'document_number'>;
  purchase_estimate_lines: Table<EstimateLine, 'org_id' | 'estimate_id' | 'material_name' | 'quantity' | 'unit' | 'estimated_unit_price' | 'line_total'>;
} } };