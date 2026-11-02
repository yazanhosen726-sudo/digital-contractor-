import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Upload, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadDrawing, inspectDrawing, extractDrawingMeasurements } from "@/lib/drawings.functions";
import { MAX_PDF_BYTES, type PdfInspection } from "@/lib/drawings";
import { MEASUREMENT_VERSION, type MeasurementExtraction } from "@/lib/measurements";
import type { ReviewEvent } from "@/lib/measurement-review";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DrawingMeasurements } from "@/components/DrawingMeasurements";

export function ProjectDrawings({ projectId, orgId, canWrite }: { projectId: string; orgId: string; canWrite: boolean }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const upload = useServerFn(uploadDrawing);
  const inspect = useServerFn(inspectDrawing);
  const extract = useServerFn(extractDrawingMeasurements);
  const key = ["drawings", orgId, projectId];
  const eventsKey = ["measurement-events", orgId, projectId];
  const { data: drawings = [], error, isPending } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("documents").select("*").eq("org_id", orgId).eq("project_id", projectId).eq("kind", "drawing").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: busy ? 2000 : 10_000,
  });
  const { data: reviewEvents = [] } = useQuery({
    queryKey: eventsKey,
    enabled: drawings.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("measurement_review_events").select("document_id, candidate_id, source_checksum, action, corrected_value, corrected_unit, actor_id, created_at").eq("org_id", orgId).in("document_id", drawings.map(drawing => drawing.id)).order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
  const { data: currentUserId = null } = useQuery({
    queryKey: ["current-user-id"],
    queryFn: async () => (await supabase.auth.getSession()).data.session?.user.id ?? null,
  });
  async function runInspection(id: string) {
    setBusy(id);
    try { await inspect({ data: { documentId: id, projectId } }); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Inspection failed."); }
    finally { setBusy(null); await qc.invalidateQueries({ queryKey: key }); }
  }
  async function runMeasurements(id: string) {
    setMeasuring(true);
    try { await extract({ data: { documentId: id, projectId } }); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Measurement extraction failed."); }
    finally { setMeasuring(false); await qc.invalidateQueries({ queryKey: key }); }
  }
  async function selectFile(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf") || file.size > MAX_PDF_BYTES) { toast.error("Select a PDF no larger than 20 MiB."); return; }
    setBusy("upload");
    try {
      const form = new FormData(); form.set("projectId", projectId); form.set("file", file);
      const { id } = await upload({ data: form });
      await qc.invalidateQueries({ queryKey: key });
      await runInspection(id);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Upload failed."); }
    finally { setBusy(null); await qc.invalidateQueries({ queryKey: key }); if (input.current) input.current.value = ""; }
  }
  async function download(path: string, name: string) {
    const { data, error } = await supabase.storage.from("documents").download(path);
    if (error || !data) { toast.error("Source file is unavailable."); return; }
    const url = URL.createObjectURL(data); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="mt-8 border-t pt-6" aria-label="Project drawings">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Drawings</h2>
        {canWrite && <><input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="PDF drawing" onChange={e => void selectFile(e.target.files?.[0])} /><Button disabled={busy !== null} onClick={() => input.current?.click()}><Upload className="mr-2 size-4" />{busy === "upload" ? "Uploading…" : "Upload PDF"}</Button></>}
      </div>
      {isPending && <p className="mt-4 text-sm text-muted-foreground">Loading drawings…</p>}
      {error && <p role="alert" className="mt-4 text-sm text-destructive">Could not load drawings: {error.message}</p>}
      {!isPending && !error && drawings.length === 0 && <p className="mt-4 text-sm text-muted-foreground">No drawings uploaded.</p>}
      <ul className="mt-4 divide-y">
        {drawings.map(drawing => {
          const metadata = drawing.extracted_data && typeof drawing.extracted_data === "object" && !Array.isArray(drawing.extracted_data) ? drawing.extracted_data : {};
          const inspection = metadata["inspection"] as unknown as PdfInspection | undefined;
          const storedMeasurements = metadata["measurements"] as unknown as MeasurementExtraction | undefined;
          const measurements = storedMeasurements?.version === MEASUREMENT_VERSION ? storedMeasurements : null;
          const issues = Array.isArray(drawing.extraction_issues) ? drawing.extraction_issues.filter((i): i is string => typeof i === "string") : [];
          const status = busy === drawing.id ? "Inspecting…" : ({ uploaded: "Uploaded", extracting: "Inspecting / interrupted", needs_review: "Inspected · unverified", verified: "Reviewed", failed: "Failed" })[drawing.status];
          return <li key={drawing.id} className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0"><p className="break-all font-medium">{drawing.file_name}</p><p className="text-xs text-muted-foreground">{new Date(drawing.created_at).toLocaleString()} · {((drawing.size_bytes ?? 0) / 1024).toFixed(0)} KiB</p></div>
              <div className="flex flex-wrap items-center gap-2"><Badge variant={drawing.status === "failed" ? "destructive" : "secondary"}>{status}</Badge><Button variant="ghost" size="icon" title="Download original PDF" aria-label={`Download ${drawing.file_name}`} onClick={() => void download(drawing.storage_path, drawing.file_name)}><Download className="size-4" /></Button>{canWrite && !inspection && <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void runInspection(drawing.id)}><RefreshCw className="mr-2 size-4" />{drawing.status === "uploaded" ? "Inspect" : "Retry inspection"}</Button>}</div>
            </div>
            {issues.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
            <DrawingMeasurements extraction={measurements} events={reviewEvents.filter((event: ReviewEvent) => event.document_id === drawing.id)} canExtract={canWrite && inspection !== undefined} canWrite={canWrite} busy={busy !== null || measuring} projectId={projectId} documentId={drawing.id} fileName={drawing.file_name} currentUserId={currentUserId} onExtract={() => void runMeasurements(drawing.id)} onChanged={() => void qc.invalidateQueries({ queryKey: eventsKey })} />
            {inspection && <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium">PDF evidence · {inspection.pageCount} pages</summary><div className="mt-3 space-y-4">{inspection.pages.map(page => <div key={page.page}><h3 className="font-medium">Page {page.page}</h3><p className="text-muted-foreground">Text: {page.textItems.some(t => t.text.trim()) ? "extractable" : "none found"} · Vector operators: {page.vectorOperators} · Image operators: {page.imageOperators}</p>{page.annotationCandidates.length > 0 && <p className="mt-1">Unverified annotation candidates: {page.annotationCandidates.join(" · ")}</p>}<pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded border bg-muted/30 p-3 font-mono text-xs">{page.textItems.map(i => i.text).join(" ") || "No extractable text."}</pre></div>)}<p className="break-all text-xs text-muted-foreground">SHA-256: {String(metadata["checksum"] ?? "Unavailable")}</p></div></details>}
          </li>;
        })}
      </ul>
    </section>
  );
}