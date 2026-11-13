// @vitest-environment node
import { describe, expect, it } from "vitest";
import { missingWorkflowStorage } from "./drawing-workflow";

describe("drawing workflow availability", () => {
  it("recognizes absent legacy storage", () => {
    expect(missingWorkflowStorage({ code: "PGRST205" })).toBe(true);
    expect(missingWorkflowStorage({ code: "42P01" })).toBe(true);
  });
  it("does not hide permission errors", () => {
    expect(missingWorkflowStorage({ code: "42501" })).toBe(false);
  });
  it("does not hide connectivity or unrelated query errors", () => {
    expect(missingWorkflowStorage({ code: "" })).toBe(false);
    expect(missingWorkflowStorage({ code: "42703" })).toBe(false);
    expect(missingWorkflowStorage(null)).toBe(false);
  });
});