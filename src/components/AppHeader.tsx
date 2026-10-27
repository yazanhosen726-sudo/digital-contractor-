import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function AppHeader({ orgName }: { orgName?: string | undefined }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/dashboard" className="font-semibold">{orgName ?? "Digital Contractor"}</Link>
        <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
      </div>
    </header>
  );
}
