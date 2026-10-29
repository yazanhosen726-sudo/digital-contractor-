import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Digital Contractor — Run your construction business" },
      { name: "description", content: "Projects, budgets, suppliers, costs and payments for contractors in one secure place." },
      { property: "og:title", content: "Digital Contractor" },
      { property: "og:description", content: "Projects, budgets, suppliers, costs and payments for contractors in one secure place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-6 text-center">
      <h1 className="max-w-xl text-4xl font-bold tracking-tight">Your construction business, in one place.</h1>
      <p className="mt-4 max-w-md text-muted-foreground">Track projects, budgets, costs and payments with exact numbers your whole team can trust.</p>
      <Button asChild className="mt-8" size="lg"><Link to="/auth">Sign in or create account</Link></Button>
    </main>
  );
}
