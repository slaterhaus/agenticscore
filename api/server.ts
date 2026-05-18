import { Hono } from "hono";
import { cors } from "hono/cors";
import { scoreSpec } from "../src/scoring/engine.js";
import { generateReport } from "../src/report/formatter.js";

const app = new Hono();
app.use("/*", cors());

/**
 * Score an OpenAPI spec for AI agent readiness.
 * Accepts YAML or JSON spec in the request body.
 */
app.post("/api/v1/score", async (c) => {
  const contentType = c.req.header("content-type") || "";
  let specContent: string;

  if (contentType.includes("multipart/form-data")) {
    const formData = await c.req.formData();
    const file = formData.get("spec") as File;
    if (!file) return c.json({ error: "No spec file provided" }, 400);
    specContent = await file.text();
  } else {
    specContent = await c.req.text();
  }

  try {
    const report = scoreSpec(specContent);
    return c.json(report);
  } catch (err) {
    return c.json({ error: "Failed to parse spec", details: (err as Error).message }, 400);
  }
});

/**
 * Score and return formatted report (text or markdown).
 */
app.post("/api/v1/score/report", async (c) => {
  const format = c.req.query("format") || "markdown";
  const specContent = await c.req.text();

  try {
    const report = scoreSpec(specContent);
    const formatted = generateReport(report, format as any);
    return c.text(formatted);
  } catch (err) {
    return c.json({ error: "Failed to parse spec", details: (err as Error).message }, 400);
  }
});

/**
 * Health check.
 */
app.get("/health", (c) => c.json({ status: "ok", version: "0.1.0" }));

export default app;

const port = parseInt(process.env.PORT || "3849");
console.log(`AgenticScore API running on :${port}`);
