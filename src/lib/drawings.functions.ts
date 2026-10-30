import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import { assertDrawingAccess, validatePdf, type PdfInspection } from "./drawings";
import { extractMeasurements, MEASUREMENT_VERSION } from "./measurements";

const drawingInput = z.object({ documentId: z.string().uuid(), projectId: z.string().uuid() });

function metadataOf(value: Json | null): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

async function loadWritableDrawing(supabase: SupabaseClient<Database>, data: z.infer<typeof drawingInput>) {
  const [{ data: document }, { data: project }] = await Promise.all([
    supabase.from("documents").select("*").eq("id", data.documentId).single(),
    supabase.from("projects").select("id,org_id").eq("id", data.projectId).single(),
  ]);
  if (!document || !project) throw new Error("Drawing is not accessible.");
  assertDrawingAccess(document, project);
  const { data: writer, error: roleError } = await supabase.rpc("can_write_org", { _org: project.org_id });
  if (roleError || !writer) throw new Error("You do not have permission to change drawings.");
  return { document, previous: metadataOf(document.extracted_data) };
}

export const uploadDrawing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: FormData) => {
    if (!(input instanceof FormData)) throw new Error("Invalid upload.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const projectId = z.string().uuid().parse(data.get("projectId"));
    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("Select a PDF drawing.");
    const { supabase, userId } = context;
    const { data: project, error: projectError } = await supabase.from("projects").select("id,org_id").eq("id", projectId).single();
    if (projectError || !project) throw new Error("Project is not accessible.");
    const { data: writer, error: roleError } = await supabase.rpc("can_write_org", { _org: project.org_id });
    if (roleError || !writer) throw new Error("You do not have permission to upload drawings.");
    if (file.size > 20 * 1024 * 1024) throw new Error("PDF files must be no larger than 20 MiB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    validatePdf(bytes, file.name);
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    const checksum = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
    const id = crypto.randomUUID();
    const path = `${project.org_id}/${project.id}/${id}.pdf`;
    const { error: insertError } = await supabase.from("documents").insert({ id, org_id: project.org_id, project_id: project.id, storage_path: path, file_name: file.name.replace(/[\x00-\x1f]/g, "").slice(0, 200), kind: "drawing", mime_type: "application/pdf", size_bytes: bytes.byteLength, uploaded_by: userId, status: "uploaded", extracted_data: { checksum, pipeline: "pdf-inspection-v1", attempts: [] } });
    if (insertError) { console.error("Drawing record insert failed", insertError.code, insertError.message); throw new Error("Could not record the drawing."); }
    const { error: uploadError } = await supabase.storage.from("documents").upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (uploadError) {
      await supabase.from("documents").update({ status: "failed", extraction_issues: ["Upload failed. Select the file and upload again."] }).eq("id", id);
      throw new Error("Upload failed. Select the file and upload again.");
    }
    return { id };
  });

export const inspectDrawing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(drawingInput)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { document, previous } = await loadWritableDrawing(supabase, data);
    if (previous["inspection"] && document.status === "needs_review") return { id: document.id, status: "needs_review" };
    if (document.status === "extracting" && Date.now() - Date.parse(document.updated_at) < 120_000) throw new Error("Inspection is already running. Try again in two minutes if it remains interrupted.");
    const now = new Date().toISOString();
    const { data: claimed, error: claimError } = await supabase.from("documents").update({ status: "extracting", updated_at: now }).eq("id", document.id).eq("updated_at", document.updated_at).select("id").maybeSingle();
    if (claimError || !claimed) throw new Error("Drawing changed. Refresh and try again.");
    const attempts: Json[] = Array.isArray(previous["attempts"]) ? previous["attempts"] : [];
    try {
      const { data: blob, error: downloadError } = await supabase.storage.from("documents").download(document.storage_path);
      if (downloadError || !blob) throw new Error("Source file is unavailable. Upload it again.");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      validatePdf(bytes, document.file_name);
      const hash = await crypto.subtle.digest("SHA-256", bytes);
      const checksum = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
      if (checksum !== previous["checksum"]) throw new Error("Source checksum changed. Upload a new revision instead.");
      const { inspectPdf } = await import("./pdf-inspection.server");
      const inspection = await inspectPdf(bytes);
      const measurements = extractMeasurements(inspection, checksum);
      const { error } = await supabase.from("documents").update({ status: "needs_review", extraction_model: "unpdf-1.4.0", extracted_data: { ...previous, inspection: inspection as unknown as Json, measurements: measurements as unknown as Json, attempts: [...attempts, { startedAt: now, finishedAt: new Date().toISOString(), status: "needs_review" }] }, extraction_issues: inspection.warnings }).eq("id", document.id);
      if (error) throw new Error("Could not save inspection. Retry inspection.");
      return { id: document.id, status: "needs_review" };
    } catch (error) {
      const message = error instanceof Error && /^(PDF |Source |Inspection |Could not)/.test(error.message) ? error.message : "PDF inspection failed. The file may be encrypted, corrupt or unsupported. Upload an unlocked PDF or retry.";
      const { error: saveError } = await supabase.from("documents").update({ status: "failed", extraction_issues: [message], extracted_data: { ...previous, attempts: [...attempts, { startedAt: now, finishedAt: new Date().toISOString(), status: "failed", error: message }] } }).eq("id", document.id);
      if (saveError) throw new Error("Inspection failed and its status could not be saved. Refresh and retry after two minutes.");
      return { id: document.id, status: "failed" };
    }
  });

export const extractDrawingMeasurements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(drawingInput)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { document, previous } = await loadWritableDrawing(supabase, data);
    const inspection = previous["inspection"];
    const checksum = previous["checksum"];
    if (!inspection || typeof inspection !== "object" || typeof checksum !== "string") throw new Error("Inspect this drawing before extracting measurements.");
    const existing = previous["measurements"];
    if (existing && typeof existing === "object" && !Array.isArray(existing) && existing["version"] === MEASUREMENT_VERSION) return { id: document.id, status: existing["status"] };
    const measurements = extractMeasurements(inspection as unknown as PdfInspection, checksum);
    const { error } = await supabase.from("documents").update({ extracted_data: { ...previous, measurements: measurements as unknown as Json } }).eq("id", document.id);
    if (error) throw new Error("Could not save measurements. Try again.");
    return { id: document.id, status: measurements.status };
  });
