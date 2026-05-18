import type { ParsedSpec, OperationEntry, SchemaEntry } from "../scanner/parser.js";

export interface ScoringRule {
  id: string;
  name: string;
  category: "examples" | "semantics" | "errors" | "pagination" | "intent" | "parameters";
  weight: number;
  description: string;
  evaluate: (spec: ParsedSpec) => RuleResult;
}

export interface RuleResult {
  score: number; // 0-1
  findings: string[];
}

/**
 * Agentic Readiness scoring rules.
 * Each rule evaluates a specific dimension of how well an API can be consumed by AI agents.
 */
export const rules: ScoringRule[] = [
  // ─── EXAMPLES ───────────────────────────────────────────
  {
    id: "examples-operations",
    name: "Operation Examples",
    category: "examples",
    weight: 15,
    description: "Operations should include request/response examples so agents can understand expected data shapes",
    evaluate: (spec) => {
      const withExamples = spec.operations.filter((op) => op.hasExamples).length;
      const total = spec.operations.length;
      const score = total > 0 ? withExamples / total : 0;
      const missing = spec.operations.filter((op) => !op.hasExamples);
      return {
        score,
        findings: missing.length > 0
          ? [`${missing.length}/${total} operations lack examples: ${missing.slice(0, 5).map((o) => `${o.method.toUpperCase()} ${o.path}`).join(", ")}`]
          : [],
      };
    },
  },
  {
    id: "examples-schemas",
    name: "Schema Examples",
    category: "examples",
    weight: 10,
    description: "Schemas should include examples for AI agents to understand data models",
    evaluate: (spec) => {
      const withExamples = spec.schemas.filter((s) => s.hasExamples).length;
      const total = spec.schemas.length;
      const score = total > 0 ? withExamples / total : 0;
      return {
        score,
        findings: total - withExamples > 0
          ? [`${total - withExamples}/${total} schemas lack examples`]
          : [],
      };
    },
  },

  // ─── SEMANTICS ──────────────────────────────────────────
  {
    id: "semantics-descriptions",
    name: "Operation Descriptions",
    category: "semantics",
    weight: 15,
    description: "Every operation needs a clear description for agents to understand intent",
    evaluate: (spec) => {
      const withDesc = spec.operations.filter((op) => op.description && op.description.length > 20).length;
      const total = spec.operations.length;
      const score = total > 0 ? withDesc / total : 0;
      const missing = spec.operations.filter((op) => !op.description || op.description.length <= 20);
      return {
        score,
        findings: missing.length > 0
          ? [`${missing.length}/${total} operations have missing/short descriptions`]
          : [],
      };
    },
  },
  {
    id: "semantics-summaries",
    name: "Operation Summaries",
    category: "semantics",
    weight: 10,
    description: "Short summaries help agents quickly classify operations without reading full descriptions",
    evaluate: (spec) => {
      const withSummary = spec.operations.filter((op) => op.summary && op.summary.length > 5).length;
      const total = spec.operations.length;
      return {
        score: total > 0 ? withSummary / total : 0,
        findings: total - withSummary > 0
          ? [`${total - withSummary}/${total} operations lack summaries`]
          : [],
      };
    },
  },
  {
    id: "semantics-schema-descriptions",
    name: "Schema Descriptions",
    category: "semantics",
    weight: 8,
    description: "Schema-level descriptions help agents understand data models",
    evaluate: (spec) => {
      const withDesc = spec.schemas.filter((s) => s.hasDescription).length;
      const total = spec.schemas.length;
      return {
        score: total > 0 ? withDesc / total : 0,
        findings: total - withDesc > 0
          ? [`${total - withDesc}/${total} schemas lack descriptions`]
          : [],
      };
    },
  },

  // ─── INTENT ─────────────────────────────────────────────
  {
    id: "intent-operation-ids",
    name: "Descriptive Operation IDs",
    category: "intent",
    weight: 12,
    description: "operationId should clearly express intent (e.g., 'listUsers' not 'get_1')",
    evaluate: (spec) => {
      const good = spec.operations.filter((op) => {
        if (!op.operationId) return false;
        // Penalize generic IDs like "get_1", "endpoint2", single words
        return op.operationId.length > 5 && /[a-z][A-Z]|_[a-z]/.test(op.operationId);
      }).length;
      const total = spec.operations.length;
      return {
        score: total > 0 ? good / total : 0,
        findings: total - good > 0
          ? [`${total - good}/${total} operations have missing/poor operationIds`]
          : [],
      };
    },
  },
  {
    id: "intent-tags",
    name: "Tag Organization",
    category: "intent",
    weight: 5,
    description: "Tags help agents categorize and discover related operations",
    evaluate: (spec) => {
      const tagged = spec.operations.filter((op) => op.tags.length > 0).length;
      const total = spec.operations.length;
      const hasGlobalTags = spec.metadata.hasTags;
      const score = total > 0 ? (tagged / total) * (hasGlobalTags ? 1 : 0.7) : 0;
      return {
        score,
        findings: !hasGlobalTags ? ["No global tags defined with descriptions"] : [],
      };
    },
  },

  // ─── ERRORS ─────────────────────────────────────────────
  {
    id: "errors-standard-codes",
    name: "Standard Error Responses",
    category: "errors",
    weight: 10,
    description: "Operations should document error responses (4xx/5xx) so agents can handle failures",
    evaluate: (spec) => {
      const withErrors = spec.operations.filter((op) => {
        const codes = Object.keys(op.responses);
        return codes.some((c) => c.startsWith("4") || c.startsWith("5"));
      }).length;
      const total = spec.operations.length;
      return {
        score: total > 0 ? withErrors / total : 0,
        findings: total - withErrors > 0
          ? [`${total - withErrors}/${total} operations don't document error responses`]
          : [],
      };
    },
  },
  {
    id: "errors-problem-detail",
    name: "RFC 9457 Problem Detail",
    category: "errors",
    weight: 5,
    description: "Error responses should follow RFC 9457 (Problem Details) for machine-parseable errors",
    evaluate: (spec) => {
      // Check if any error response references a problem-detail-like schema
      let hasProblemDetail = false;
      for (const op of spec.operations) {
        for (const [code, resp] of Object.entries(op.responses)) {
          if (!code.startsWith("4") && !code.startsWith("5")) continue;
          if (resp.content?.["application/problem+json"]) {
            hasProblemDetail = true;
            break;
          }
          const json = resp.content?.["application/json"];
          if (json?.schema) {
            const schema = json.schema as any;
            const props = schema.properties || {};
            if (props.type && props.title && props.status) {
              hasProblemDetail = true;
              break;
            }
          }
        }
        if (hasProblemDetail) break;
      }
      return {
        score: hasProblemDetail ? 1 : 0,
        findings: !hasProblemDetail
          ? ["No RFC 9457 Problem Detail format detected in error responses"]
          : [],
      };
    },
  },

  // ─── PARAMETERS ─────────────────────────────────────────
  {
    id: "parameters-descriptions",
    name: "Parameter Descriptions",
    category: "parameters",
    weight: 8,
    description: "All parameters should have descriptions so agents know what values to provide",
    evaluate: (spec) => {
      let described = 0;
      let total = 0;
      for (const op of spec.operations) {
        for (const param of op.parameters) {
          total++;
          if (param.description && param.description.length > 5) described++;
        }
      }
      return {
        score: total > 0 ? described / total : 1,
        findings: total - described > 0
          ? [`${total - described}/${total} parameters lack descriptions`]
          : [],
      };
    },
  },

  // ─── PAGINATION ─────────────────────────────────────────
  {
    id: "pagination-support",
    name: "Pagination Documentation",
    category: "pagination",
    weight: 7,
    description: "List endpoints should document pagination parameters (limit, offset, cursor) for agents to iterate",
    evaluate: (spec) => {
      const listOps = spec.operations.filter(
        (op) => op.method === "get" && (op.operationId?.match(/list|getAll|search|find/i) || op.path.match(/\/$/))
      );
      if (listOps.length === 0) return { score: 1, findings: [] };

      const paginated = listOps.filter((op) =>
        op.parameters.some((p) => /limit|offset|cursor|page|per_page/i.test(p.name))
      );

      return {
        score: paginated.length / listOps.length,
        findings: listOps.length - paginated.length > 0
          ? [`${listOps.length - paginated.length} list operations lack pagination parameters`]
          : [],
      };
    },
  },
];
