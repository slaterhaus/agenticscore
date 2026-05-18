import { describe, it, expect } from "vitest";
import { scoreSpec } from "../src";
import { readFileSync } from "fs";
import { join } from "path";

describe("agenticscore Scoring Engine", () => {
  it("scores a well-designed spec highly", () => {
    const spec = readFileSync(join(__dirname, "../examples/petstore-good.yaml"), "utf-8");
    const report = scoreSpec(spec);

    expect(report.overallScore).toBeGreaterThan(75);
    expect(report.grade).toMatch(/^[AB]$/);
    expect(report.specTitle).toBe("Pet Store API");
    expect(report.operationCount).toBe(4);
    expect(report.categories.length).toBeGreaterThan(0);
  });

  it("scores a poorly-designed spec low", () => {
    const spec = readFileSync(join(__dirname, "../examples/generic-bad.yaml"), "utf-8");
    const report = scoreSpec(spec);

    expect(report.overallScore).toBeLessThan(40);
    expect(report.grade).toMatch(/^[DF]$/);
    expect(report.topFindings.length).toBeGreaterThan(0);
  });

  it("produces actionable findings for bad specs", () => {
    const spec = readFileSync(join(__dirname, "../examples/generic-bad.yaml"), "utf-8");
    const report = scoreSpec(spec);

    // Should flag missing descriptions, examples, error docs
    const allFindings = report.topFindings.join(" ");
    expect(allFindings).toContain("lack");
  });

  it("returns all 6 categories", () => {
    const spec = readFileSync(join(__dirname, "../examples/petstore-good.yaml"), "utf-8");
    const report = scoreSpec(spec);

    const categoryNames = report.categories.map((c) => c.category);
    expect(categoryNames).toContain("examples");
    expect(categoryNames).toContain("semantics");
    expect(categoryNames).toContain("intent");
    expect(categoryNames).toContain("errors");
    expect(categoryNames).toContain("parameters");
    expect(categoryNames).toContain("pagination");
  });

  it("handles empty spec gracefully", () => {
    const spec = `openapi: "3.0.0"\ninfo:\n  title: Empty\n  version: "1.0"\npaths: {}`;
    const report = scoreSpec(spec);

    expect(report.overallScore).toBeDefined();
    expect(report.operationCount).toBe(0);
  });

  it("supports JSON input", () => {
    const spec = JSON.stringify({
      openapi: "3.0.0",
      info: { title: "JSON API", version: "1.0" },
      paths: {
        "/items": {
          get: {
            operationId: "listItems",
            summary: "List all items",
            description: "Returns a paginated list of items in the catalog.",
            responses: { "200": { description: "OK" } },
          },
        },
      },
    });
    const report = scoreSpec(spec);

    expect(report.specTitle).toBe("JSON API");
    expect(report.operationCount).toBe(1);
  });
});
