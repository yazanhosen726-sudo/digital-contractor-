CREATE OR REPLACE FUNCTION public.enforce_org_references() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE field text; target text; linked uuid; linked_org uuid; row_data jsonb := to_jsonb(NEW);
BEGIN
  FOR field,target IN SELECT * FROM (VALUES ('project_id','projects'),('client_id','clients'),('supplier_id','suppliers'),('worker_id','workers'),('category_id','expense_categories'),('purchase_order_id','purchase_orders'),('document_id','documents'),('expense_id','expenses'),('receivable_id','receivables'),('tax_rate_id','tax_rates'),('conversation_id','ai_conversations')) AS refs(f,t) LOOP
    IF row_data ? field AND row_data->>field IS NOT NULL THEN
      linked := (row_data->>field)::uuid;
      EXECUTE format('SELECT org_id FROM public.%I WHERE id=$1',target) INTO linked_org USING linked;
      IF linked_org IS NULL OR linked_org <> NEW.org_id THEN RAISE EXCEPTION '% must belong to the same business',field; END IF;
      IF field='conversation_id' THEN
        IF NOT EXISTS(SELECT 1 FROM public.ai_conversations WHERE id=linked AND user_id=(row_data->>'user_id')::uuid) THEN RAISE EXCEPTION 'conversation belongs to another user'; END IF;
      END IF;
    END IF;
  END LOOP;
  IF TG_OP='UPDATE' AND NEW.org_id<>OLD.org_id THEN RAISE EXCEPTION 'business ownership cannot change'; END IF;
  RETURN NEW;
END $$;