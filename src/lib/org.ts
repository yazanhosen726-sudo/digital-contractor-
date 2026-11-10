import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const membershipQuery = queryOptions({
  queryKey: ["membership"],
  queryFn: async () => {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!auth.user) throw new Error('Sign in to access your business');
    const { data, error } = await supabase
      .from("org_members")
      .select("role, organizations(id, name, reporting_currency)")
      .eq("user_id", auth.user.id)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
});

export const projectsQuery = (orgId: string) =>
  queryOptions({
    queryKey: ["projects", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, code, name, location, status, currency, original_budget, contract_value")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const WRITE_ROLES = ["owner", "admin", "accountant", "project_manager", "member"];
