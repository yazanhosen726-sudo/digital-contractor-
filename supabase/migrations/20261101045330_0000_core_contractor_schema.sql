CREATE TYPE public.org_role AS ENUM ('owner','admin','accountant','project_manager','member','viewer');
CREATE TYPE public.project_status AS ENUM ('planning','active','on_hold','completed','cancelled');
CREATE TYPE public.expense_status AS ENUM ('draft','recorded','void');
CREATE TYPE public.approval_status AS ENUM ('not_required','pending','approved','rejected');
CREATE TYPE public.data_source AS ENUM ('manual','ai_extracted','verified','labor_entry');
CREATE TYPE public.payment_direction AS ENUM ('outgoing','incoming');
CREATE TYPE public.po_status AS ENUM ('draft','issued','partially_invoiced','closed','cancelled');
CREATE TYPE public.revision_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.labor_status AS ENUM ('planned','recorded','void');
CREATE TYPE public.receivable_status AS ENUM ('draft','issued','void');
CREATE TYPE public.document_status AS ENUM ('uploaded','extracting','needs_review','verified','failed');
CREATE TYPE public.ai_action_status AS ENUM ('proposed','confirmed','executed','rejected','failed');

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  locale text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile write" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, display_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  reporting_currency char(3) NOT NULL DEFAULT 'USD' CHECK (reporting_currency ~ '^[A-Z]{3}$'),
  timezone text NOT NULL DEFAULT 'UTC',
  locale text NOT NULL DEFAULT 'en',
  date_format text NOT NULL DEFAULT 'yyyy-MM-dd',
  measurement_system text NOT NULL DEFAULT 'metric' CHECK (measurement_system IN ('metric','imperial')),
  country_code char(2),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.org_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
CREATE INDEX ON public.org_members(user_id);

CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE org_id = _org AND user_id = auth.uid())
$$;
CREATE OR REPLACE FUNCTION public.has_org_role(_org uuid, _roles public.org_role[]) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE org_id = _org AND user_id = auth.uid() AND role = ANY(_roles))
$$;
CREATE OR REPLACE FUNCTION public.can_write_org(_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_org_role(_org, ARRAY['owner','admin','accountant','project_manager','member']::public.org_role[])
$$;
CREATE OR REPLACE FUNCTION public.can_manage_finance(_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_org_role(_org, ARRAY['owner','admin','accountant']::public.org_role[])
$$;
CREATE OR REPLACE FUNCTION public.is_org_admin(_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_org_role(_org, ARRAY['owner','admin']::public.org_role[])
$$;

GRANT SELECT, UPDATE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read org" ON public.organizations FOR SELECT TO authenticated USING (public.is_org_member(id));
CREATE POLICY "admins update org" ON public.organizations FOR UPDATE TO authenticated USING (public.is_org_admin(id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_members TO authenticated;
GRANT ALL ON public.org_members TO service_role;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read memberships" ON public.org_members FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "admins add members" ON public.org_members FOR INSERT TO authenticated WITH CHECK (public.is_org_admin(org_id) AND role <> 'owner');
CREATE POLICY "admins update members" ON public.org_members FOR UPDATE TO authenticated USING (public.is_org_admin(org_id) AND role <> 'owner') WITH CHECK (role <> 'owner');
CREATE POLICY "admins remove members" ON public.org_members FOR DELETE TO authenticated USING (public.is_org_admin(org_id) AND role <> 'owner');

CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  is_labor boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, code)
);

CREATE TABLE public.tax_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  jurisdiction text,
  rate_percent numeric(7,4) NOT NULL CHECK (rate_percent >= 0 AND rate_percent <= 100),
  is_inclusive boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_currency char(3) NOT NULL CHECK (from_currency ~ '^[A-Z]{3}$'),
  to_currency char(3) NOT NULL CHECK (to_currency ~ '^[A-Z]{3}$'),
  rate numeric(20,10) NOT NULL CHECK (rate > 0),
  rate_date date NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_currency <> to_currency),
  UNIQUE (org_id, from_currency, to_currency, rate_date)
);

CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  email text, phone text, address text, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  location text,
  status public.project_status NOT NULL DEFAULT 'planning',
  start_date date,
  expected_completion_date date,
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  contract_value numeric(18,2) CHECK (contract_value IS NULL OR contract_value >= 0),
  original_budget numeric(18,2) CHECK (original_budget IS NULL OR original_budget >= 0),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, code),
  CHECK (expected_completion_date IS NULL OR start_date IS NULL OR expected_completion_date >= start_date)
);
CREATE INDEX ON public.projects(org_id, status);

CREATE TABLE public.project_budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.expense_categories(id),
  planned_amount numeric(18,2) NOT NULL CHECK (planned_amount >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, category_id)
);

CREATE TABLE public.budget_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  amount_delta numeric(18,2) NOT NULL CHECK (amount_delta <> 0),
  reason text NOT NULL,
  status public.revision_status NOT NULL DEFAULT 'pending',
  requested_by uuid,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.budget_revisions(project_id, status);

CREATE TABLE public.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_date date,
  completed_at timestamptz,
  verified boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  contact_name text, email text, phone text, address text, tax_id text,
  supplies text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX suppliers_org_name_uq ON public.suppliers(org_id, lower(name));

CREATE TABLE public.workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  trade text,
  arrangement text NOT NULL DEFAULT 'daily' CHECK (arrangement IN ('hourly','daily','fixed','subcontractor')),
  default_rate numeric(18,2) CHECK (default_rate IS NULL OR default_rate >= 0),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  phone text, notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  po_number text NOT NULL,
  order_date date NOT NULL DEFAULT current_date,
  expected_delivery_date date,
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  total_amount numeric(18,2) NOT NULL CHECK (total_amount >= 0),
  status public.po_status NOT NULL DEFAULT 'draft',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, po_number)
);

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  kind text NOT NULL DEFAULT 'invoice' CHECK (kind IN ('invoice','receipt','contract','drawing','photo','other')),
  status public.document_status NOT NULL DEFAULT 'uploaded',
  extracted_data jsonb,
  extraction_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  extraction_model text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  is_general_overhead boolean NOT NULL DEFAULT false,
  category_id uuid REFERENCES public.expense_categories(id),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  worker_id uuid REFERENCES public.workers(id) ON DELETE SET NULL,
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  invoice_number text,
  description text NOT NULL CHECK (length(trim(description)) > 0),
  transaction_date date NOT NULL,
  due_date date,
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  subtotal numeric(18,2) NOT NULL CHECK (subtotal >= 0),
  discount_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  tax_rate_id uuid REFERENCES public.tax_rates(id),
  total_amount numeric(18,2) NOT NULL CHECK (total_amount >= 0),
  status public.expense_status NOT NULL DEFAULT 'recorded',
  approval_status public.approval_status NOT NULL DEFAULT 'not_required',
  source public.data_source NOT NULL DEFAULT 'manual',
  needs_review boolean NOT NULL DEFAULT false,
  review_reasons text[] NOT NULL DEFAULT '{}',
  payment_method text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (total_amount = subtotal - discount_amount + tax_amount),
  CHECK (due_date IS NULL OR due_date >= transaction_date)
);
CREATE INDEX ON public.expenses(org_id, transaction_date);
CREATE INDEX ON public.expenses(project_id);
CREATE INDEX ON public.expenses(supplier_id);
CREATE INDEX ON public.expenses(category_id);
CREATE INDEX ON public.expenses(org_id, supplier_id, invoice_number);

CREATE TABLE public.expense_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  item_key text,
  quantity numeric(18,4) NOT NULL CHECK (quantity > 0),
  unit text NOT NULL,
  unit_price numeric(18,4) NOT NULL CHECK (unit_price >= 0),
  line_total numeric(18,2) NOT NULL CHECK (line_total >= 0),
  delivery_included boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.expense_lines(org_id, item_key);

CREATE TABLE public.labor_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.workers(id),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  work_date date NOT NULL,
  quantity numeric(10,2) NOT NULL CHECK (quantity > 0),
  unit text NOT NULL CHECK (unit IN ('hours','days','lump_sum')),
  rate numeric(18,2) NOT NULL CHECK (rate >= 0),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  amount numeric(18,2) NOT NULL CHECK (amount >= 0),
  status public.labor_status NOT NULL DEFAULT 'recorded',
  expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.labor_entries(org_id, worker_id);

CREATE TABLE public.receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  reference text NOT NULL,
  issue_date date NOT NULL,
  due_date date,
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  total_amount numeric(18,2) NOT NULL CHECK (total_amount > 0),
  status public.receivable_status NOT NULL DEFAULT 'issued',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, reference)
);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  direction public.payment_direction NOT NULL,
  expense_id uuid REFERENCES public.expenses(id) ON DELETE RESTRICT,
  receivable_id uuid REFERENCES public.receivables(id) ON DELETE RESTRICT,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  payment_date date NOT NULL,
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  method text,
  reference text,
  idempotency_key text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((direction = 'outgoing' AND receivable_id IS NULL) OR (direction = 'incoming' AND expense_id IS NULL)),
  UNIQUE (org_id, idempotency_key)
);
CREATE INDEX ON public.payments(org_id, payment_date);
CREATE INDEX ON public.payments(expense_id);
CREATE INDEX ON public.payments(receivable_id);

CREATE TABLE public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id uuid NOT NULL,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL,
  actor_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.audit_log(org_id, table_name, record_id);

CREATE OR REPLACE FUNCTION public.audit_row() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  INSERT INTO public.audit_log(org_id, table_name, record_id, action, actor_id, old_data, new_data)
  VALUES (r.org_id, TG_TABLE_NAME, r.id, TG_OP, auth.uid(),
          CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
          CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END);
  RETURN NULL;
END $$;

CREATE TABLE public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  tool_trace jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.ai_messages(conversation_id, created_at);

CREATE TABLE public.ai_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  payload jsonb NOT NULL,
  summary text NOT NULL,
  status public.ai_action_status NOT NULL DEFAULT 'proposed',
  result jsonb,
  error text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.design_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  asset_type text NOT NULL DEFAULT 'drawing',
  title text NOT NULL,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  version int NOT NULL DEFAULT 1,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['expense_categories','tax_rates','exchange_rates','clients','projects','project_budget_lines',
    'budget_revisions','milestones','suppliers','workers','purchase_orders','documents','expenses','expense_lines',
    'labor_entries','receivables','payments','design_assets']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "org read" ON public.%I FOR SELECT TO authenticated USING (public.is_org_member(org_id))', t);
    EXECUTE format('CREATE POLICY "org insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_write_org(org_id))', t);
    EXECUTE format('CREATE POLICY "org update" ON public.%I FOR UPDATE TO authenticated USING (public.can_write_org(org_id)) WITH CHECK (public.can_write_org(org_id))', t);
    EXECUTE format('CREATE POLICY "org delete" ON public.%I FOR DELETE TO authenticated USING (public.is_org_admin(org_id))', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['clients','projects','suppliers','workers','purchase_orders','documents','expenses','receivables','design_assets','organizations']
  LOOP
    EXECUTE format('CREATE TRIGGER touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['projects','budget_revisions','suppliers','workers','purchase_orders','documents','expenses',
    'labor_entries','receivables','payments','exchange_rates','tax_rates','expense_categories','project_budget_lines']
  LOOP
    EXECUTE format('CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row()', t);
  END LOOP;
END $$;

DROP POLICY "org insert" ON public.payments;
DROP POLICY "org update" ON public.payments;
CREATE POLICY "finance insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(org_id));
CREATE POLICY "finance update payments" ON public.payments FOR UPDATE TO authenticated USING (public.can_manage_finance(org_id)) WITH CHECK (public.can_manage_finance(org_id));
DROP POLICY "org update" ON public.budget_revisions;
CREATE POLICY "finance decide revisions" ON public.budget_revisions FOR UPDATE TO authenticated USING (public.can_manage_finance(org_id) OR public.is_org_admin(org_id)) WITH CHECK (public.can_manage_finance(org_id) OR public.is_org_admin(org_id));

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance read audit" ON public.audit_log FOR SELECT TO authenticated USING (public.has_org_role(org_id, ARRAY['owner','admin','accountant']::public.org_role[]));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations, public.ai_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ai_actions TO authenticated;
GRANT ALL ON public.ai_conversations, public.ai_messages, public.ai_actions TO service_role;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own convs" ON public.ai_conversations FOR ALL TO authenticated USING (user_id = auth.uid() AND public.is_org_member(org_id)) WITH CHECK (user_id = auth.uid() AND public.is_org_member(org_id));
CREATE POLICY "own msgs" ON public.ai_messages FOR ALL TO authenticated USING (user_id = auth.uid() AND public.is_org_member(org_id)) WITH CHECK (user_id = auth.uid() AND public.is_org_member(org_id));
CREATE POLICY "own actions" ON public.ai_actions FOR ALL TO authenticated USING (user_id = auth.uid() AND public.is_org_member(org_id)) WITH CHECK (user_id = auth.uid() AND public.is_org_member(org_id));

CREATE OR REPLACE FUNCTION public.enforce_expense_integrity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE dup_count int;
BEGIN
  IF NEW.project_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM projects WHERE id = NEW.project_id AND org_id = NEW.org_id) THEN RAISE EXCEPTION 'project belongs to another organization'; END IF;
  IF NEW.supplier_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM suppliers WHERE id = NEW.supplier_id AND org_id = NEW.org_id) THEN RAISE EXCEPTION 'supplier belongs to another organization'; END IF;
  IF NEW.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM expense_categories WHERE id = NEW.category_id AND org_id = NEW.org_id) THEN RAISE EXCEPTION 'category belongs to another organization'; END IF;
  IF NEW.purchase_order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM purchase_orders WHERE id = NEW.purchase_order_id AND org_id = NEW.org_id) THEN RAISE EXCEPTION 'purchase order belongs to another organization'; END IF;
  IF NEW.worker_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM workers WHERE id = NEW.worker_id AND org_id = NEW.org_id) THEN RAISE EXCEPTION 'worker belongs to another organization'; END IF;
  IF NEW.document_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM documents WHERE id = NEW.document_id AND org_id = NEW.org_id) THEN RAISE EXCEPTION 'document belongs to another organization'; END IF;

  NEW.review_reasons := array_remove(array_remove(array_remove(array_remove(NEW.review_reasons, 'unallocated'), 'uncategorized'), 'possible_duplicate'), 'ai_extracted_unverified');
  IF NEW.project_id IS NULL AND NOT NEW.is_general_overhead THEN NEW.review_reasons := NEW.review_reasons || 'unallocated'; END IF;
  IF NEW.category_id IS NULL THEN NEW.review_reasons := NEW.review_reasons || 'uncategorized'; END IF;
  IF NEW.source = 'ai_extracted' THEN NEW.review_reasons := NEW.review_reasons || 'ai_extracted_unverified'; END IF;
  SELECT count(*) INTO dup_count FROM expenses e
   WHERE e.org_id = NEW.org_id AND e.id <> NEW.id AND e.status <> 'void'
     AND ((NEW.invoice_number IS NOT NULL AND e.invoice_number IS NOT NULL AND lower(e.invoice_number) = lower(NEW.invoice_number)
           AND e.supplier_id IS NOT DISTINCT FROM NEW.supplier_id)
       OR (e.supplier_id IS NOT DISTINCT FROM NEW.supplier_id AND e.total_amount = NEW.total_amount
           AND e.currency = NEW.currency AND abs(e.transaction_date - NEW.transaction_date) <= 3));
  IF dup_count > 0 AND NEW.status <> 'void' THEN NEW.review_reasons := NEW.review_reasons || 'possible_duplicate'; END IF;
  NEW.needs_review := cardinality(NEW.review_reasons) > 0;
  RETURN NEW;
END $$;
CREATE TRIGGER expense_integrity BEFORE INSERT OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.enforce_expense_integrity();

CREATE OR REPLACE FUNCTION public.enforce_payment_integrity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_total numeric; target_currency char(3); target_org uuid; paid numeric;
BEGIN
  IF NEW.expense_id IS NOT NULL THEN
    SELECT total_amount, currency, org_id INTO target_total, target_currency, target_org FROM expenses WHERE id = NEW.expense_id AND status = 'recorded' FOR UPDATE;
    IF target_org IS NULL THEN RAISE EXCEPTION 'expense not found or not recorded'; END IF;
    SELECT COALESCE(sum(amount),0) INTO paid FROM payments WHERE expense_id = NEW.expense_id AND id <> NEW.id;
  ELSIF NEW.receivable_id IS NOT NULL THEN
    SELECT total_amount, currency, org_id INTO target_total, target_currency, target_org FROM receivables WHERE id = NEW.receivable_id AND status = 'issued' FOR UPDATE;
    IF target_org IS NULL THEN RAISE EXCEPTION 'receivable not found or not issued'; END IF;
    SELECT COALESCE(sum(amount),0) INTO paid FROM payments WHERE receivable_id = NEW.receivable_id AND id <> NEW.id;
  ELSE
    RETURN NEW;
  END IF;
  IF target_org <> NEW.org_id THEN RAISE EXCEPTION 'record belongs to another organization'; END IF;
  IF target_currency <> NEW.currency THEN RAISE EXCEPTION 'payment currency % does not match record currency %', NEW.currency, target_currency; END IF;
  IF paid + NEW.amount > target_total THEN RAISE EXCEPTION 'payment exceeds outstanding amount (outstanding %)', target_total - paid; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payment_integrity BEFORE INSERT OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.enforce_payment_integrity();

CREATE OR REPLACE FUNCTION public.enforce_revision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM projects WHERE id = NEW.project_id AND org_id = NEW.org_id) THEN RAISE EXCEPTION 'project belongs to another organization'; END IF;
  IF TG_OP = 'INSERT' THEN NEW.status := 'pending'; NEW.requested_by := auth.uid(); END IF;
  IF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    IF OLD.status <> 'pending' THEN RAISE EXCEPTION 'revision already decided'; END IF;
    NEW.decided_by := auth.uid(); NEW.decided_at := now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER revision_rules BEFORE INSERT OR UPDATE ON public.budget_revisions FOR EACH ROW EXECUTE FUNCTION public.enforce_revision();

CREATE OR REPLACE FUNCTION public.create_organization(_name text, _currency text DEFAULT 'USD') RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO organizations(name, reporting_currency, created_by) VALUES (_name, upper(_currency), auth.uid()) RETURNING id INTO new_id;
  INSERT INTO org_members(org_id, user_id, role) VALUES (new_id, auth.uid(), 'owner');
  INSERT INTO expense_categories(org_id, code, name, is_labor) VALUES
    (new_id,'steel','Steel & reinforcement',false),(new_id,'cement','Cement & concrete',false),
    (new_id,'aggregates','Sand, aggregates & materials',false),(new_id,'tools','Tools & equipment',false),
    (new_id,'equipment_rental','Equipment rental',false),(new_id,'transport','Transportation & fuel',false),
    (new_id,'labor','Labor',true),(new_id,'subcontractors','Subcontractors',true),
    (new_id,'electrical_plumbing','Electrical & plumbing',false),(new_id,'finishing','Finishing materials',false),
    (new_id,'cleaning_waste','Cleaning & waste removal',false),(new_id,'permits_admin','Permits & administrative',false),
    (new_id,'other','Other',false);
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.create_organization(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_organization(text, text) TO authenticated;

CREATE POLICY "org members read docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND public.is_org_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY "org writers upload docs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND public.can_write_org(((storage.foldername(name))[1])::uuid));
CREATE POLICY "org admins delete docs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND public.is_org_admin(((storage.foldername(name))[1])::uuid));
