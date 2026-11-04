/*
# Procurement Planning and Purchase Management

1. New Tables
- `procurement_items`: A material/purchasing requirement derived from a BOQ line. Holds material name, description, required quantity, unit, BOQ source reference, construction phase, required purchase date, priority, and procurement status. Links to a `boq_items` row (ON DELETE SET NULL so deleting a BOQ line leaves the requirement visible but unlinked).
- `procurement_deliveries`: A scheduled delivery for a procurement item. Holds planned date, delivery quantity, and status. Multiple deliveries can split one requirement.
- `procurement_price_catalog`: A reusable per-business catalog of indicative average unit prices. Holds material, unit, estimated average unit price, currency (default USD), price date, optional source/reference, and notes.
- `purchase_estimates`: An editable Purchase Estimate document. Holds company info, project, document number, date, planned delivery date, supplier info (optional), currency, subtotal, transport, tax, discount, grand total, notes/terms, and status (draft or issued). Linked to a project.
- `purchase_estimate_lines`: A line in a Purchase Estimate. Holds material description, specifications, quantity, unit, estimated unit price, estimated line total, and sort order. Links to a procurement item (ON DELETE SET NULL).

2. Modified Tables
- None. BOQ, takeoff, and measurement tables are untouched.

3. Security
- RLS enabled on all five new tables.
- Organization members can read (`is_org_member`). Writers (`can_write_org`) can create, edit, and delete.
- Purchase estimates that have been issued are locked: lines cannot be inserted, updated, or deleted.
- A trigger checks that procurement items link to BOQ lines within the same organization and project.
- Grants limited to `authenticated` only. No anon access.
- `enforce_org_references` and `audit_row` triggers on all tables.
- A dedicated `enforce_procurement_references` trigger validates cross-table org/project consistency for procurement items and estimate lines.

4. Important Notes
- Estimated prices are indicative only. The application labels them "Indicative Estimate — Not a Supplier Quotation".
- No supplier quotation, purchase order, or invoice data is created here. The architecture separates estimates from actual procurement.
- Deleting a BOQ line leaves the procurement item in place with its link cleared, so the requirement remains visible.
- Deleting a procurement item never touches its BOQ source.
- Future supplier quotation and purchase order tables can reference procurement items without redesign.
*/

CREATE TABLE IF NOT EXISTS procurement_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  boq_item_id uuid REFERENCES boq_items(id) ON DELETE SET NULL,
  material_name text NOT NULL CHECK (char_length(btrim(material_name)) BETWEEN 1 AND 200),
  description text CHECK (description IS NULL OR char_length(description) <= 1000),
  required_quantity numeric NOT NULL CHECK (required_quantity >= 0 AND required_quantity < 1000000000),
  unit text NOT NULL CHECK (char_length(unit) BETWEEN 1 AND 20),
  boq_reference text CHECK (boq_reference IS NULL OR char_length(boq_reference) <= 120),
  phase text CHECK (phase IS NULL OR char_length(phase) <= 80),
  required_date date,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority = ANY (ARRAY['low','medium','high'])),
  status text NOT NULL DEFAULT 'required' CHECK (status = ANY (ARRAY['required','scheduled','partially_purchased','purchased','cancelled'])),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 1000),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS procurement_items_project_idx ON procurement_items (project_id, sort_order);
CREATE INDEX IF NOT EXISTS procurement_items_org_idx ON procurement_items (org_id);
CREATE INDEX IF NOT EXISTS procurement_items_boq_idx ON procurement_items (boq_item_id);
CREATE INDEX IF NOT EXISTS procurement_items_status_idx ON procurement_items (status, required_date);

CREATE TABLE IF NOT EXISTS procurement_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  procurement_item_id uuid NOT NULL REFERENCES procurement_items(id) ON DELETE CASCADE,
  planned_date date,
  delivery_quantity numeric NOT NULL CHECK (delivery_quantity >= 0 AND delivery_quantity < 1000000000),
  status text NOT NULL DEFAULT 'planned' CHECK (status = ANY (ARRAY['planned','delivered','cancelled'])),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS procurement_deliveries_item_idx ON procurement_deliveries (procurement_item_id, sort_order);
CREATE INDEX IF NOT EXISTS procurement_deliveries_org_idx ON procurement_deliveries (org_id);
CREATE INDEX IF NOT EXISTS procurement_deliveries_date_idx ON procurement_deliveries (planned_date, status);

CREATE TABLE IF NOT EXISTS procurement_price_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  material text NOT NULL CHECK (char_length(btrim(material)) BETWEEN 1 AND 200),
  unit text NOT NULL CHECK (char_length(unit) BETWEEN 1 AND 20),
  estimated_price numeric NOT NULL CHECK (estimated_price >= 0 AND estimated_price < 1000000000),
  currency text NOT NULL DEFAULT 'USD' CHECK (char_length(currency) BETWEEN 3 AND 3),
  price_date date NOT NULL DEFAULT CURRENT_DATE,
  source_ref text CHECK (source_ref IS NULL OR char_length(source_ref) <= 200),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS procurement_price_catalog_org_idx ON procurement_price_catalog (org_id);
CREATE INDEX IF NOT EXISTS procurement_price_catalog_material_idx ON procurement_price_catalog (org_id, material, unit);

CREATE TABLE IF NOT EXISTS purchase_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  series_id uuid NOT NULL DEFAULT gen_random_uuid(),
  revision integer NOT NULL DEFAULT 1 CHECK (revision BETWEEN 1 AND 10000),
  document_number text NOT NULL CHECK (char_length(btrim(document_number)) BETWEEN 1 AND 60),
  document_date date NOT NULL DEFAULT CURRENT_DATE,
  planned_delivery_date date,
  company_name text CHECK (company_name IS NULL OR char_length(company_name) <= 200),
  company_address text CHECK (company_address IS NULL OR char_length(company_address) <= 500),
  company_contact text CHECK (company_contact IS NULL OR char_length(company_contact) <= 200),
  project_name text CHECK (project_name IS NULL OR char_length(project_name) <= 200),
  supplier_name text CHECK (supplier_name IS NULL OR char_length(supplier_name) <= 200),
  supplier_contact text CHECK (supplier_contact IS NULL OR char_length(supplier_contact) <= 500),
  currency text NOT NULL DEFAULT 'USD' CHECK (char_length(currency) BETWEEN 3 AND 3),
  subtotal numeric NOT NULL DEFAULT 0 CHECK (subtotal >= 0 AND subtotal < 1000000000000),
  transport_cost numeric NOT NULL DEFAULT 0 CHECK (transport_cost >= 0 AND transport_cost < 1000000000000),
  tax_amount numeric NOT NULL DEFAULT 0 CHECK (tax_amount >= 0 AND tax_amount < 1000000000000),
  discount_amount numeric NOT NULL DEFAULT 0 CHECK (discount_amount >= 0 AND discount_amount < 1000000000000),
  grand_total numeric NOT NULL DEFAULT 0 CHECK (grand_total >= 0 AND grand_total < 1000000000000),
  notes_terms text CHECK (notes_terms IS NULL OR char_length(notes_terms) <= 2000),
  status text NOT NULL DEFAULT 'draft' CHECK (status = ANY (ARRAY['draft','issued'])),
  issued_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchase_estimates_series_revision_unique UNIQUE (series_id, revision),
  CONSTRAINT purchase_estimates_issue_shape CHECK ((status = 'draft') = (issued_at IS NULL))
);

CREATE INDEX IF NOT EXISTS purchase_estimates_project_idx ON purchase_estimates (project_id);
CREATE INDEX IF NOT EXISTS purchase_estimates_org_idx ON purchase_estimates (org_id);

CREATE TABLE IF NOT EXISTS purchase_estimate_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  estimate_id uuid NOT NULL REFERENCES purchase_estimates(id) ON DELETE CASCADE,
  procurement_item_id uuid REFERENCES procurement_items(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  line_number text NOT NULL DEFAULT '' CHECK (char_length(line_number) <= 20),
  material_name text NOT NULL CHECK (char_length(btrim(material_name)) BETWEEN 1 AND 200),
  description text CHECK (description IS NULL OR char_length(description) <= 1000),
  specifications text CHECK (specifications IS NULL OR char_length(specifications) <= 500),
  quantity numeric NOT NULL DEFAULT 0 CHECK (quantity >= 0 AND quantity < 1000000000),
  unit text NOT NULL CHECK (char_length(unit) BETWEEN 1 AND 20),
  estimated_unit_price numeric NOT NULL DEFAULT 0 CHECK (estimated_unit_price >= 0 AND estimated_unit_price < 1000000000),
  line_total numeric NOT NULL DEFAULT 0 CHECK (line_total >= 0 AND line_total < 1000000000000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchase_estimate_lines_estimate_idx ON purchase_estimate_lines (estimate_id, sort_order);
CREATE INDEX IF NOT EXISTS purchase_estimate_lines_org_idx ON purchase_estimate_lines (org_id);
CREATE INDEX IF NOT EXISTS purchase_estimate_lines_procurement_idx ON purchase_estimate_lines (procurement_item_id);

ALTER TABLE procurement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_price_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_estimate_lines ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON procurement_items FROM PUBLIC, anon;
REVOKE ALL ON procurement_deliveries FROM PUBLIC, anon;
REVOKE ALL ON procurement_price_catalog FROM PUBLIC, anon;
REVOKE ALL ON purchase_estimates FROM PUBLIC, anon;
REVOKE ALL ON purchase_estimate_lines FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON procurement_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON procurement_deliveries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON procurement_price_catalog TO authenticated;
GRANT SELECT, INSERT, UPDATE ON purchase_estimates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON purchase_estimate_lines TO authenticated;

DROP POLICY IF EXISTS "org read procurement_items" ON procurement_items;
CREATE POLICY "org read procurement_items" ON procurement_items FOR SELECT
  TO authenticated USING (is_org_member(org_id));

DROP POLICY IF EXISTS "org insert procurement_items" ON procurement_items;
CREATE POLICY "org insert procurement_items" ON procurement_items FOR INSERT
  TO authenticated WITH CHECK (can_write_org(org_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "org update procurement_items" ON procurement_items;
CREATE POLICY "org update procurement_items" ON procurement_items FOR UPDATE
  TO authenticated USING (can_write_org(org_id)) WITH CHECK (can_write_org(org_id));

DROP POLICY IF EXISTS "org delete procurement_items" ON procurement_items;
CREATE POLICY "org delete procurement_items" ON procurement_items FOR DELETE
  TO authenticated USING (can_write_org(org_id));

DROP POLICY IF EXISTS "org read procurement_deliveries" ON procurement_deliveries;
CREATE POLICY "org read procurement_deliveries" ON procurement_deliveries FOR SELECT
  TO authenticated USING (is_org_member(org_id));

DROP POLICY IF EXISTS "org insert procurement_deliveries" ON procurement_deliveries;
CREATE POLICY "org insert procurement_deliveries" ON procurement_deliveries FOR INSERT
  TO authenticated WITH CHECK (can_write_org(org_id));

DROP POLICY IF EXISTS "org update procurement_deliveries" ON procurement_deliveries;
CREATE POLICY "org update procurement_deliveries" ON procurement_deliveries FOR UPDATE
  TO authenticated USING (can_write_org(org_id)) WITH CHECK (can_write_org(org_id));

DROP POLICY IF EXISTS "org delete procurement_deliveries" ON procurement_deliveries;
CREATE POLICY "org delete procurement_deliveries" ON procurement_deliveries FOR DELETE
  TO authenticated USING (can_write_org(org_id));

DROP POLICY IF EXISTS "org read price_catalog" ON procurement_price_catalog;
CREATE POLICY "org read price_catalog" ON procurement_price_catalog FOR SELECT
  TO authenticated USING (is_org_member(org_id));

DROP POLICY IF EXISTS "org insert price_catalog" ON procurement_price_catalog;
CREATE POLICY "org insert price_catalog" ON procurement_price_catalog FOR INSERT
  TO authenticated WITH CHECK (can_write_org(org_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "org update price_catalog" ON procurement_price_catalog;
CREATE POLICY "org update price_catalog" ON procurement_price_catalog FOR UPDATE
  TO authenticated USING (can_write_org(org_id)) WITH CHECK (can_write_org(org_id));

DROP POLICY IF EXISTS "org delete price_catalog" ON procurement_price_catalog;
CREATE POLICY "org delete price_catalog" ON procurement_price_catalog FOR DELETE
  TO authenticated USING (can_write_org(org_id));

DROP POLICY IF EXISTS "org read purchase_estimates" ON purchase_estimates;
CREATE POLICY "org read purchase_estimates" ON purchase_estimates FOR SELECT
  TO authenticated USING (is_org_member(org_id));

DROP POLICY IF EXISTS "org insert purchase_estimates" ON purchase_estimates;
CREATE POLICY "org insert purchase_estimates" ON purchase_estimates FOR INSERT
  TO authenticated WITH CHECK (can_write_org(org_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "org update draft purchase_estimates" ON purchase_estimates;
CREATE POLICY "org update draft purchase_estimates" ON purchase_estimates FOR UPDATE
  TO authenticated USING (can_write_org(org_id) AND status = 'draft') WITH CHECK (can_write_org(org_id));

DROP POLICY IF EXISTS "org read estimate_lines" ON purchase_estimate_lines;
CREATE POLICY "org read estimate_lines" ON purchase_estimate_lines FOR SELECT
  TO authenticated USING (is_org_member(org_id));

DROP POLICY IF EXISTS "org insert draft estimate_lines" ON purchase_estimate_lines;
CREATE POLICY "org insert draft estimate_lines" ON purchase_estimate_lines FOR INSERT
  TO authenticated WITH CHECK (
    can_write_org(org_id)
    AND EXISTS (SELECT 1 FROM purchase_estimates e WHERE e.id = estimate_id AND e.org_id = purchase_estimate_lines.org_id AND e.status = 'draft')
  );

DROP POLICY IF EXISTS "org update draft estimate_lines" ON purchase_estimate_lines;
CREATE POLICY "org update draft estimate_lines" ON purchase_estimate_lines FOR UPDATE
  TO authenticated USING (
    can_write_org(org_id)
    AND EXISTS (SELECT 1 FROM purchase_estimates e WHERE e.id = estimate_id AND e.status = 'draft')
  ) WITH CHECK (
    can_write_org(org_id)
    AND EXISTS (SELECT 1 FROM purchase_estimates e WHERE e.id = estimate_id AND e.org_id = purchase_estimate_lines.org_id AND e.status = 'draft')
  );

DROP POLICY IF EXISTS "org delete draft estimate_lines" ON purchase_estimate_lines;
CREATE POLICY "org delete draft estimate_lines" ON purchase_estimate_lines FOR DELETE
  TO authenticated USING (
    can_write_org(org_id)
    AND EXISTS (SELECT 1 FROM purchase_estimates e WHERE e.id = estimate_id AND e.status = 'draft')
  );

CREATE OR REPLACE FUNCTION enforce_procurement_references()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_org uuid;
  item_project uuid;
  boq_org uuid;
  boq_project uuid;
  estimate_org uuid;
  estimate_project uuid;
BEGIN
  IF TG_TABLE_NAME = 'procurement_items' THEN
    IF NEW.boq_item_id IS NOT NULL THEN
      SELECT bi.org_id, b.project_id INTO boq_org, boq_project
        FROM public.boq_items bi
        JOIN public.boqs b ON b.id = bi.boq_id
        WHERE bi.id = NEW.boq_item_id;
      IF boq_org IS NULL OR boq_org <> NEW.org_id OR boq_project <> NEW.project_id THEN
        RAISE EXCEPTION 'BOQ item must belong to the same project and business';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'purchase_estimate_lines' THEN
    SELECT e.org_id, e.project_id INTO estimate_org, estimate_project
      FROM public.purchase_estimates e WHERE e.id = NEW.estimate_id;
    IF estimate_org IS NULL OR estimate_org <> NEW.org_id THEN
      RAISE EXCEPTION 'estimate must belong to the same business';
    END IF;
    IF NEW.procurement_item_id IS NOT NULL THEN
      SELECT org_id, project_id INTO item_org, item_project
        FROM public.procurement_items WHERE id = NEW.procurement_item_id;
      IF item_org IS NULL OR item_org <> NEW.org_id OR item_project <> estimate_project THEN
        RAISE EXCEPTION 'procurement item must belong to the same project';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION enforce_procurement_references() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_org_references ON procurement_items;
CREATE TRIGGER enforce_org_references BEFORE INSERT OR UPDATE ON procurement_items
  FOR EACH ROW EXECUTE FUNCTION enforce_org_references();

DROP TRIGGER IF EXISTS enforce_procurement_references ON procurement_items;
CREATE TRIGGER enforce_procurement_references BEFORE INSERT OR UPDATE ON procurement_items
  FOR EACH ROW EXECUTE FUNCTION enforce_procurement_references();

DROP TRIGGER IF EXISTS audit_row ON procurement_items;
CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON procurement_items
  FOR EACH ROW EXECUTE FUNCTION audit_row();

DROP TRIGGER IF EXISTS enforce_org_references ON procurement_deliveries;
CREATE TRIGGER enforce_org_references BEFORE INSERT OR UPDATE ON procurement_deliveries
  FOR EACH ROW EXECUTE FUNCTION enforce_org_references();

DROP TRIGGER IF EXISTS audit_row ON procurement_deliveries;
CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON procurement_deliveries
  FOR EACH ROW EXECUTE FUNCTION audit_row();

DROP TRIGGER IF EXISTS enforce_org_references ON procurement_price_catalog;
CREATE TRIGGER enforce_org_references BEFORE INSERT OR UPDATE ON procurement_price_catalog
  FOR EACH ROW EXECUTE FUNCTION enforce_org_references();

DROP TRIGGER IF EXISTS audit_row ON procurement_price_catalog;
CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON procurement_price_catalog
  FOR EACH ROW EXECUTE FUNCTION audit_row();

DROP TRIGGER IF EXISTS enforce_org_references ON purchase_estimates;
CREATE TRIGGER enforce_org_references BEFORE INSERT OR UPDATE ON purchase_estimates
  FOR EACH ROW EXECUTE FUNCTION enforce_org_references();

DROP TRIGGER IF EXISTS audit_row ON purchase_estimates;
CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON purchase_estimates
  FOR EACH ROW EXECUTE FUNCTION audit_row();

DROP TRIGGER IF EXISTS enforce_org_references ON purchase_estimate_lines;
CREATE TRIGGER enforce_org_references BEFORE INSERT OR UPDATE ON purchase_estimate_lines
  FOR EACH ROW EXECUTE FUNCTION enforce_org_references();

DROP TRIGGER IF EXISTS enforce_procurement_references ON purchase_estimate_lines;
CREATE TRIGGER enforce_procurement_references BEFORE INSERT OR UPDATE ON purchase_estimate_lines
  FOR EACH ROW EXECUTE FUNCTION enforce_procurement_references();

DROP TRIGGER IF EXISTS audit_row ON purchase_estimate_lines;
CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON purchase_estimate_lines
  FOR EACH ROW EXECUTE FUNCTION audit_row();
