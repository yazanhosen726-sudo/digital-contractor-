// @vitest-environment node
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const url = process.env["DRAWING_TEST_URL"];
const key = process.env["DRAWING_TEST_KEY"];
const token = process.env["DRAWING_TEST_TOKEN"];
const id = process.env["DRAWING_TEST_ID"];
const path = process.env["DRAWING_TEST_PATH"];
describe.skipIf(!url || !key || !token || !id || !path)("drawing storage and organization isolation", () => {
  function client(authenticated = true) {
    if (!url || !key || !token) throw new Error("Integration environment required");
    return createClient(url, key, { auth: { persistSession: false }, global: { headers: authenticated ? { Authorization: `Bearer ${token}` } : {}, fetch: (input, init) => { const headers = new Headers(init?.headers); if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization"); headers.set("apikey", key); return fetch(input, { ...init, headers }); } } });
  }
  it("reads the uploaded project drawing as its member", async () => { const { data, error } = await client().from("documents").select("id,status").eq("id", id).single(); expect(error === null).toBe(true); expect(data?.status).toBe("needs_review"); });
  it("downloads the private original as its member", async () => { const { data, error } = await client().storage.from("documents").download(path ?? ""); expect(error === null).toBe(true); expect((await data?.text())?.startsWith("%PDF-")).toBe(true); });
  it("denies anonymous private source downloads", async () => { const { error } = await client(false).storage.from("documents").download(path ?? ""); expect(error !== null).toBe(true); });
  it("does not expose the document anonymously", async () => { const { data } = await client(false).from("documents").select("id").eq("id", id); expect(data?.length ?? 0).toBe(0); });
  it("rejects writes to an organization the caller does not belong to", async () => { const { error } = await client().from("documents").insert({ org_id: "00000000-0000-4000-8000-000000000001", kind: "drawing", file_name: "denied.pdf", storage_path: "00000000-0000-4000-8000-000000000001/denied.pdf" }); expect(error?.code).toBe("42501"); });
});