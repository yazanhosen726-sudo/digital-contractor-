/*
# Measurement verification events

1. New Tables
- `measurement_review_events`: an append-only log of verification decisions for measurement candidates extracted from drawings.
  - `id` (uuid, primary key)
  - `org_id` (uuid, business that owns the drawing)
  - `document_id` (uuid, the drawing the candidate came from)
  - `candidate_id` (text, the candidate identifier inside the drawing's extraction, e.g. "p1-m3")
  - `source_checksum` (text, SHA-256 of the drawing the candidate was extracted from)
  - `action` (text: approved, rejected, or reopened)
  - `corrected_value` and `corrected_unit` (set only on approval when the reviewer changed the extracted value or unit; both null otherwise)
  - `note` (optional reviewer note, up to 500 characters)
  - `actor_id` (uuid, the signed-in user who made the decision; defaults to the current user)
  - `created_at` (timestamp of the decision)

2. Modified Tables
- None. The original extraction stays in `documents.extracted_data.measurements` and is never changed by reviews.

3. Current state
- A candidate with no events is pending.
- The latest event for a candidate determines its state: approved, rejected, or pending again after a reopen.

4. Security
- Row level security is enabled on `measurement_review_events`.
- Grants: SELECT and INSERT only, to `authenticated`. There is no UPDATE or DELETE grant or policy, so decisions cannot be edited or erased.
- SELECT: organization members can read events for their business.
- INSERT: only users who can write to the business (`can_write_org`), and only as themselves (`actor_id = auth.uid()`).
- The existing organization reference trigger ensures the drawing belongs to the same business.

5. Important notes
- Audit logging follows the existing `audit_row` pattern used by other tables.
- Only approved measurements are meant to feed future quantity calculations; that filter is applied in application code.
*/

CREATE TABLE IF NOT EXISTS measurement_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  document_id uuid NOT NULL REFERENCES documents(id),
  candidate_id text NOT NULL CHECK (char_length(candidate_id) BETWEEN 1 AND 64),
  source_checksum text NOT NULL CHECK (char_length(source_checksum) = 64),
  action text NOT NULL CHECK (action IN ('approved', 'rejected', 'reopened')),
  corrected_value numeric CHECK (corrected_value IS NULL OR (corrected_value > 0 AND corrected_value < 1000000000)),
  corrected_unit text CHECK (corrected_unit IS NULL OR corrected_unit IN ('mm', 'cm', 'm', 'ft', 'in')),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  actor_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (corrected_value IS NULL OR action = 'approved'),
  CHECK ((corrected_value IS NULL) = (corrected_unit IS NULL))
);

CREATE INDEX IF NOT EXISTS measurement_review_events_document_idx ON measurement_review_events (document_id, candidate_id, created_at);
CREATE INDEX IF NOT EXISTS measurement_review_events_org_idx ON measurement_review_events (org_id);

ALTER TABLE measurement_review_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON measurement_review_events TO authenticated;

DROP POLICY IF EXISTS "org read" ON measurement_review_events;
CREATE POLICY "org read" ON measurement_review_events FOR SELECT
  TO authenticated USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "org insert" ON measurement_review_events;
CREATE POLICY "org insert" ON measurement_review_events FOR INSERT
  TO authenticated WITH CHECK (public.can_write_org(org_id) AND actor_id = auth.uid());

DROP TRIGGER IF EXISTS enforce_org_references ON measurement_review_events;
CREATE TRIGGER enforce_org_references BEFORE INSERT OR UPDATE ON measurement_review_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_org_references();

DROP TRIGGER IF EXISTS audit_row ON measurement_review_events;
CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON measurement_review_events
  FOR EACH ROW EXECUTE FUNCTION public.audit_row();
