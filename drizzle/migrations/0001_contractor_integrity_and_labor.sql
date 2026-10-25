CREATE OR REPLACE FUNCTION public.enforce_org_references() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE field text; target text; linked uuid; linked_org uuid; row_data jsonb := to_jsonb(NEW);
BEGIN
  FOR field,target IN SELECT * FROM (VALUES ('project_id','projects'),('client_id','clients'),('supplier_id','suppliers'),('worker_id','workers'),('category_id','expense_categories'),('purchase_order_id','purchase_orders'),('document_id','documents'),('expense_id','expenses'),('receivable_id','receivables'),('tax_rate_id','tax_rates'),('conversation_id','ai_conversations')) AS refs(f,t) LOOP
    IF row_data ? field AND row_data->>field IS NOT NULL THEN
      linked := (row_data->>field)::uuid;
      EXECUTE format('SELECT org_id FROM public.%I WHERE id=$1',target) INTO linked_org USING linked;
      IF linked_org IS NULL OR linked_org <> NEW.org_id THEN RAISE EXCEPTION '% must belong to the same business',field; END IF;
      IF field='conversation_id' AND NOT EXISTS(SELECT 1 FROM public.ai_conversations WHERE id=linked AND user_id=NEW.user_id) THEN RAISE EXCEPTION 'conversation belongs to another user'; END IF;
    END IF;
  END LOOP;
  IF TG_OP='UPDATE' AND NEW.org_id<>OLD.org_id THEN RAISE EXCEPTION 'business ownership cannot change'; END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
FOREACH t IN ARRAY ARRAY['projects','project_budget_lines','budget_revisions','milestones','workers','purchase_orders','documents','expenses','expense_lines','labor_entries','receivables','payments','ai_messages','ai_actions','design_assets'] LOOP
EXECUTE format('CREATE TRIGGER org_references BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_org_references()',t);
END LOOP; END $$;
CREATE OR REPLACE FUNCTION public.enforce_financial_updates() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE paid numeric; BEGIN
IF TG_TABLE_NAME='expenses' THEN
SELECT coalesce(sum(amount),0) INTO paid FROM public.payments WHERE expense_id=NEW.id;
IF paid>0 AND (NEW.status<>'recorded' OR NEW.currency<>OLD.currency OR NEW.total_amount<paid) THEN RAISE EXCEPTION 'paid expense cannot be voided, change currency, or be reduced below payments'; END IF;
ELSE
SELECT coalesce(sum(amount),0) INTO paid FROM public.payments WHERE receivable_id=NEW.id;
IF paid>0 AND (NEW.status<>'issued' OR NEW.currency<>OLD.currency OR NEW.total_amount<paid) THEN RAISE EXCEPTION 'paid invoice cannot be voided, change currency, or be reduced below payments'; END IF;
END IF; RETURN NEW; END $$;
CREATE TRIGGER financial_update BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.enforce_financial_updates();
CREATE TRIGGER financial_update BEFORE UPDATE ON public.receivables FOR EACH ROW EXECUTE FUNCTION public.enforce_financial_updates();
CREATE OR REPLACE FUNCTION public.enforce_labor_amount() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN IF NEW.amount<>round(NEW.quantity*NEW.rate,2) THEN RAISE EXCEPTION 'labor amount must equal quantity times rate'; END IF; RETURN NEW; END $$;
CREATE TRIGGER labor_amount BEFORE INSERT OR UPDATE ON public.labor_entries FOR EACH ROW EXECUTE FUNCTION public.enforce_labor_amount();
CREATE OR REPLACE FUNCTION public.record_labor(_org uuid,_worker uuid,_project uuid,_date date,_quantity numeric,_unit text,_rate numeric,_currency text,_planned boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
DECLARE expense uuid; labor uuid; category uuid; worker_name text; total numeric := round(_quantity*_rate,2);
BEGIN
IF NOT public.can_write_org(_org) THEN RAISE EXCEPTION 'not authorized'; END IF;
SELECT name INTO worker_name FROM public.workers WHERE id=_worker AND org_id=_org;
IF worker_name IS NULL THEN RAISE EXCEPTION 'worker not found'; END IF;
IF NOT _planned THEN
SELECT id INTO category FROM public.expense_categories WHERE org_id=_org AND code='labor';
INSERT INTO public.expenses(org_id,project_id,worker_id,category_id,description,transaction_date,currency,subtotal,total_amount,source,created_by) VALUES(_org,_project,_worker,category,'Labor: '||worker_name,_date,_currency,total,total,'labor_entry',auth.uid()) RETURNING id INTO expense;
END IF;
INSERT INTO public.labor_entries(org_id,worker_id,project_id,work_date,quantity,unit,rate,currency,amount,status,expense_id,created_by) VALUES(_org,_worker,_project,_date,_quantity,_unit,_rate,_currency,total,CASE WHEN _planned THEN 'planned'::public.labor_status ELSE 'recorded'::public.labor_status END,expense,auth.uid()) RETURNING id INTO labor;
RETURN labor;
END $$;
REVOKE ALL ON FUNCTION public.record_labor(uuid,uuid,uuid,date,numeric,text,numeric,text,boolean) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.record_labor(uuid,uuid,uuid,date,numeric,text,numeric,text,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.enforce_payment_project() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE project uuid; BEGIN
IF NEW.expense_id IS NOT NULL THEN SELECT project_id INTO project FROM public.expenses WHERE id=NEW.expense_id;
ELSIF NEW.receivable_id IS NOT NULL THEN SELECT project_id INTO project FROM public.receivables WHERE id=NEW.receivable_id;
ELSE RETURN NEW; END IF;
NEW.project_id:=project; RETURN NEW; END $$;
CREATE TRIGGER payment_project BEFORE INSERT OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.enforce_payment_project();