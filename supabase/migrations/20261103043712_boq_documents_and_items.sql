/*
# Bill of Quantities: documents and items

1. New Tables
- `boqs`: a BOQ document for a project. Holds title, reference, revision number, and status (draft or issued). Revisions of the same BOQ share a `series_id`.
- `boq_items`: one line in a BOQ. Holds item number, section, category, description, unit, quantity, basis (calculated or manual), the quantity captured when the line was calculated, notes, and sort order. It links to the Takeoff item it came from when there is one.

2. Modified Tables
- None. Takeoff items, measurements, and review history are not changed by BOQ work.

3. Security
- RLS enabled on both tables.
- Organization members can read. Writers (owner, admin, accountant, project manager, member) can create, edit, and delete draft BOQ rows.
- Issued BOQs are locked at the database level: their lines cannot be inserted, updated, or deleted.
- A trigger checks that a BOQ line's Takeoff link and BOQ belong to the same organization and project.
- Grants are limited to the authenticated role. No anon access.

4. Important Notes
- Deleting a Takeoff item leaves the BOQ line in place with its link cleared, so the missing source is visible in validation.
- Deleting a BOQ line never touches its Takeoff item.
- Quantity sign checks are enforced in the application and in validation, so existing bad values are flagged rather than hidden.
*/

CREATE TABLE IF NOT EXISTS boqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  series_id uuid NOT NULL DEFAULT gen_random_uuid(),
  revision integer NOT NULL DEFAULT 1 CHECK (revision BETWEEN 1 AND 10000),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  reference text CHECK (reference IS NULL OR char_length(reference) <= 60),
  status text NOT NULL DEFAULT 'draft' CHECK (status = ANY (ARRAY['draft','issued'])),
  issued_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT boqs_series_revision_unique UNIQUE (series_id, revision),
  CONSTRAINT boqs_issue_shape CHECK ((status = 'draft') = (issued_at IS NULL))
);

CREATE INDEX IF NOT EXISTS boqs_project_idx ON boqs (project_id);
CREATE INDEX IF NOT EXISTS boqs_org_idx ON boqs (org_id);

CREATE TABLE IF NOT EXISTS boq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  boq_id uuid NOT NULL REFERENCES boqs(id) ON DELETE CASCADE,
  takeoff_item_id uuid REFERENCES takeoff_items(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  item_number text NOT NULL DEFAULT '' CHECK (char_length(item_number) <= 20),
  section text NOT NULL CHECK (char_length(btrim(section)) BETWEEN 1 AND 80),
  category text CHECK (category IS NULL OR char_length(category) <= 80),
  description text CHECK (description IS NULL OR char_length(description) <= 500),
  unit text CHECK (unit IS NULL OR unit = ANY (ARRAY['mm','cm','m','ft','in','mm2','cm2','m2','ft2','in2','mm3','cm3','m3','ft3','in3','ea'])),
  quantity numeric CHECK (quantity IS NULL OR quantity < 1000000000),
  calculated_quantity numeric CHECK (calculated_quantity IS NULL OR calculated_quantity < 1000000000),
  basis text NOT NULL CHECK (basis = ANY (ARRAY['calculated','manual'])),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 1000),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS boq_items_boq_idx ON boq_items (boq_id, sort_order);
CREATE INDEX IF NOT EXISTS boq_items_takeoff_idx ON boq_items (takeoff_item_id);
CREATE INDEX IF NOT EXISTS boq_items_org_idx ON boq_items (org_id);

ALTER TABLE boqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE boq_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON boqs FROM PUBLIC, anon;
REVOKE ALL ON boq_items FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON boqs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON boq_items TO authenticated;

DROP POLICY IF EXISTS "org read boqs" ON boqs;
CREATE POLICY "org read boqs" ON boqs FOR SELECT
  TO authenticated USING (is_org_member(org_id));

DROP POLICY IF EXISTS "org insert boqs" ON boqs;
CREATE POLICY "org insert boqs" ON boqs FOR INSERT
  TO authenticated WITH CHECK (can_write_org(org_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "org update draft boqs" ON boqs;
CREATE POLICY "org update draft boqs" ON boqs FOR UPDATE
  TO authenticated USING (can_write_org(org_id) AND status = 'draft') WITH CHECK (can_write_org(org_id));

DROP POLICY IF EXISTS "org read boq items" ON boq_items;
CREATE POLICY "org read boq items" ON boq_items FOR SELECT
  TO authenticated USING (is_org_member(org_id));

DROP POLICY IF EXISTS "org insert draft boq items" ON boq_items;
CREATE POLICY "org insert draft boq items" ON boq_items FOR INSERT
  TO authenticated WITH CHECK (
    can_write_org(org_id)
    AND created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM boqs b WHERE b.id = boq_id AND b.org_id = boq_items.org_id AND b.status = 'draft')
  );

DROP POLICY IF EXISTS "org update draft boq items" ON boq_items;
CREATE POLICY "org update draft boq items" ON boq_items FOR UPDATE
  TO authenticated USING (
    can_write_org(org_id)
    AND EXISTS (SELECT 1 FROM boqs b WHERE b.id = boq_id AND b.status = 'draft')
  ) WITH CHECK (
    can_write_org(org_id)
    AND EXISTS (SELECT 1 FROM boqs b WHERE b.id = boq_id AND b.org_id = boq_items.org_id AND b.status = 'draft')
  );

DROP POLICY IF EXISTS "org delete draft boq items" ON boq_items;
CREATE POLICY "org delete draft boq items" ON boq_items FOR DELETE
  TO authenticated USING (
    can_write_org(org_id)
    AND EXISTS (SELECT 1 FROM boqs b WHERE b.id = boq_id AND b.status = 'draft')
  );

CREATE OR REPLACE FUNCTION enforce_boq_item_references()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  boq_org uuid;
  boq_project uuid;
  takeoff_org uuid;
  takeoff_project uuid;
BEGIN
  SELECT org_id, project_id INTO boq_org, boq_project FROM public.boqs WHERE id = NEW.boq_id;
  IF boq_org IS NULL OR boq_org <> NEW.org_id THEN
    RAISE EXCEPTION 'boq must belong to the same business';
  END IF;
  IF NEW.takeoff_item_id IS NOT NULL THEN
    SELECT org_id, project_id INTO takeoff_org, takeoff_project FROM public.takeoff_items WHERE id = NEW.takeoff_item_id;
    IF takeoff_org IS NULL OR takeoff_org <> NEW.org_id OR takeoff_project <> boq_project THEN
      RAISE EXCEPTION 'takeoff item must belong to the same project';
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION enforce_boq_item_references() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_org_references ON boqs;
CREATE TRIGGER enforce_org_references BEFORE INSERT OR UPDATE ON boqs
  FOR EACH ROW EXECUTE FUNCTION enforce_org_references();

DROP TRIGGER IF EXISTS audit_row ON boqs;
CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON boqs
  FOR EACH ROW EXECUTE FUNCTION audit_row();

DROP TRIGGER IF EXISTS enforce_org_references ON boq_items;
CREATE TRIGGER enforce_org_references BEFORE INSERT OR UPDATE ON boq_items
  FOR EACH ROW EXECUTE FUNCTION enforce_org_references();

DROP TRIGGER IF EXISTS enforce_boq_item_references ON boq_items;
CREATE TRIGGER enforce_boq_item_references BEFORE INSERT OR UPDATE ON boq_items
  FOR EACH ROW EXECUTE FUNCTION enforce_boq_item_references();

DROP TRIGGER IF EXISTS audit_row ON boq_items;
CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON boq_items
  FOR EACH ROW EXECUTE FUNCTION audit_row();
