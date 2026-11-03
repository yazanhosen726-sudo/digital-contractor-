/*
# Quantity takeoff items and measurement sources

1. New Tables
- `takeoff_items`: one quantity line per project. Holds the name, optional category, unit, basis (calculated or manual), calculation method, optional multiplier, manual quantity (manual basis only), and notes.
- `takeoff_item_sources`: links a takeoff item to the approved measurements it uses. Stores the drawing, the measurement ID, the source checksum, and an occurrence number (1 normally; 2 or more only when the user explicitly includes the same measurement again).

2. Modified Tables
- None. Original extracted measurements and review history are not changed.

3. Security
- RLS enabled on both tables.
- `takeoff_items`: members can read (is_org_member). Writers can insert, update, and delete (can_write_org). Insert requires created_by = auth.uid().
- `takeoff_item_sources`: members can read. Writers can insert and delete. Insert requires the item to belong to the same organization. No update policy, so sources are replaced rather than edited.
- Grants limited to the authenticated role. No anon access.

4. Important Notes
- Quantities are not stored. They are recalculated from the currently approved measurements every time, so a reopened or rejected measurement cannot keep feeding an old total.
- Calculation rules are enforced in the application; these constraints guard the basic shape of each row.
- Audit and cross-organization reference triggers match the existing tables.
*/

CREATE TABLE IF NOT EXISTS takeoff_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  category text CHECK (category IS NULL OR char_length(category) <= 80),
  unit text NOT NULL CHECK (unit = ANY (ARRAY['mm','cm','m','ft','in','mm2','cm2','m2','ft2','in2','mm3','cm3','m3','ft3','in3','ea'])),
  basis text NOT NULL CHECK (basis = ANY (ARRAY['calculated','manual'])),
  method text CHECK (method IS NULL OR method = ANY (ARRAY['individual','sum','count','multiply','area','volume'])),
  factor numeric CHECK (factor IS NULL OR (factor > 0 AND factor < 1000000)),
  manual_quantity numeric CHECK (manual_quantity IS NULL OR (manual_quantity >= 0 AND manual_quantity < 1000000000)),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT takeoff_items_basis_shape CHECK (
    (basis = 'manual' AND method IS NULL AND factor IS NULL AND manual_quantity IS NOT NULL)
    OR (basis = 'calculated' AND method IS NOT NULL AND manual_quantity IS NULL
        AND ((method = 'multiply') = (factor IS NOT NULL)))
  )
);

CREATE INDEX IF NOT EXISTS takeoff_items_project_idx ON takeoff_items (project_id);
CREATE INDEX IF NOT EXISTS takeoff_items_org_idx ON takeoff_items (org_id);

CREATE TABLE IF NOT EXISTS takeoff_item_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES takeoff_items(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  candidate_id text NOT NULL CHECK (char_length(candidate_id) BETWEEN 1 AND 64),
  source_checksum text NOT NULL CHECK (char_length(source_checksum) = 64),
  occurrence integer NOT NULL DEFAULT 1 CHECK (occurrence BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT takeoff_item_sources_unique UNIQUE (item_id, document_id, candidate_id, occurrence)
);

CREATE INDEX IF NOT EXISTS takeoff_item_sources_item_idx ON takeoff_item_sources (item_id);
CREATE INDEX IF NOT EXISTS takeoff_item_sources_document_idx ON takeoff_item_sources (document_id);
CREATE INDEX IF NOT EXISTS takeoff_item_sources_org_idx ON takeoff_item_sources (org_id);

ALTER TABLE takeoff_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE takeoff_item_sources ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON takeoff_items FROM PUBLIC, anon;
REVOKE ALL ON takeoff_item_sources FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON takeoff_items TO authenticated;
GRANT SELECT, INSERT, DELETE ON takeoff_item_sources TO authenticated;

DROP POLICY IF EXISTS "org read takeoff items" ON takeoff_items;
CREATE POLICY "org read takeoff items" ON takeoff_items FOR SELECT
  TO authenticated USING (is_org_member(org_id));

DROP POLICY IF EXISTS "org insert takeoff items" ON takeoff_items;
CREATE POLICY "org insert takeoff items" ON takeoff_items FOR INSERT
  TO authenticated WITH CHECK (can_write_org(org_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "org update takeoff items" ON takeoff_items;
CREATE POLICY "org update takeoff items" ON takeoff_items FOR UPDATE
  TO authenticated USING (can_write_org(org_id)) WITH CHECK (can_write_org(org_id));

DROP POLICY IF EXISTS "org delete takeoff items" ON takeoff_items;
CREATE POLICY "org delete takeoff items" ON takeoff_items FOR DELETE
  TO authenticated USING (can_write_org(org_id));

DROP POLICY IF EXISTS "org read takeoff sources" ON takeoff_item_sources;
CREATE POLICY "org read takeoff sources" ON takeoff_item_sources FOR SELECT
  TO authenticated USING (is_org_member(org_id));

DROP POLICY IF EXISTS "org insert takeoff sources" ON takeoff_item_sources;
CREATE POLICY "org insert takeoff sources" ON takeoff_item_sources FOR INSERT
  TO authenticated WITH CHECK (
    can_write_org(org_id)
    AND EXISTS (SELECT 1 FROM takeoff_items i WHERE i.id = item_id AND i.org_id = takeoff_item_sources.org_id)
  );

DROP POLICY IF EXISTS "org delete takeoff sources" ON takeoff_item_sources;
CREATE POLICY "org delete takeoff sources" ON takeoff_item_sources FOR DELETE
  TO authenticated USING (can_write_org(org_id));

DROP TRIGGER IF EXISTS enforce_org_references ON takeoff_items;
CREATE TRIGGER enforce_org_references BEFORE INSERT OR UPDATE ON takeoff_items
  FOR EACH ROW EXECUTE FUNCTION enforce_org_references();

DROP TRIGGER IF EXISTS audit_row ON takeoff_items;
CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON takeoff_items
  FOR EACH ROW EXECUTE FUNCTION audit_row();

DROP TRIGGER IF EXISTS enforce_org_references ON takeoff_item_sources;
CREATE TRIGGER enforce_org_references BEFORE INSERT OR UPDATE ON takeoff_item_sources
  FOR EACH ROW EXECUTE FUNCTION enforce_org_references();

DROP TRIGGER IF EXISTS audit_row ON takeoff_item_sources;
CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON takeoff_item_sources
  FOR EACH ROW EXECUTE FUNCTION audit_row();
