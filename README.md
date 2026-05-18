# AgenticScore

**Score any API's readiness for AI agent consumption.**

AI agents (Claude, GPT, custom agents) are consuming APIs at scale — but most APIs weren't designed for machine callers. AgenticScore scores your OpenAPI spec from 0-100 across 6 dimensions that determine how well AI agents can use your API without human intervention.

## Quick Start

```bash
npx agenticscore score your-api.yaml
```

Output:

```
  🟠 Agent Readiness: 47/100 (Grade D)
  My API v2.1.0
  23 operations, 15 schemas

  Categories:
    examples     ████░░░░░░ 40%
    semantics    █████░░░░░ 50%
    intent       ██████░░░░ 60%
    errors       ███░░░░░░░ 30%
    parameters   █████░░░░░ 55%
    pagination   ██░░░░░░░░ 20%

  Top Issues:
    • 18/23 operations lack examples
    • 12/23 operations don't document error responses
    • 3 list operations lack pagination parameters
```

## Install

```bash
# Global install
npm install -g agenticscore

# Or run directly
npx agenticscore score api.yaml
```

## Scoring Categories

| Category | Weight | What It Measures |
|----------|--------|-----------------|
| **Examples** | 25% | Do operations include request/response examples for agents to learn from? |
| **Semantics** | 33% | Are descriptions clear enough for agents to understand intent? |
| **Intent** | 17% | Do operationIds clearly express what each endpoint does? |
| **Errors** | 15% | Are failure modes documented so agents can handle them? |
| **Parameters** | 8% | Are query/path parameters described? |
| **Pagination** | 7% | Can agents iterate list endpoints? |

## CI/CD Integration

Fail your build if agent readiness drops below a threshold:

```bash
agenticscore score api.yaml --min-score 70
```

Exit code 1 if score is below the threshold.

### GitHub Actions

```yaml
- name: Check API Agent Readiness
  run: npx agenticscore score ./openapi.yaml --min-score 70
```

## Output Formats

```bash
# Pretty terminal output (default)
agenticscore score api.yaml

# JSON (for programmatic use)
agenticscore score api.yaml --format json

# Markdown (for PRs/docs)
agenticscore score api.yaml --format markdown
```

## Why This Matters

AI agents need APIs that are:

1. **Self-documenting** — Agents can't read your wiki. They need descriptions *in the spec*.
2. **Example-rich** — Agents learn request/response shapes from examples, not guesswork.
3. **Predictable in failure** — RFC 9457 Problem Detail lets agents parse and retry intelligently.
4. **Navigable** — Pagination, filtering, and sorting must be documented for agents to iterate data.
5. **Intent-clear** — `listActiveUsers` tells an agent what it does. `get_1` does not.

## The 5 Fixes That Move Any API from D to A

1. Add request/response examples to every operation
2. Write 2-sentence descriptions (what it does + when to use it)
3. Document error responses with RFC 9457 Problem Detail
4. Use descriptive operationIds (`listUsers`, not `get_1`)
5. Document pagination parameters on list endpoints

## Programmatic Usage

```typescript
import { scoreSpec } from "agenticscore";
import { readFileSync } from "fs";

const spec = readFileSync("api.yaml", "utf-8");
const report = scoreSpec(spec);

console.log(report.overallScore); // 0-100
console.log(report.grade);        // A, B, C, D, F
console.log(report.topFindings);  // Actionable fix list
```

## Custom Rules (Coming Soon)

```typescript
import { scoreSpec } from "agenticscore";
import { rules } from "agenticscore/rules";

// Add your own rules
const customRules = [
  ...rules,
  {
    id: "my-rule",
    name: "Custom Check",
    category: "semantics",
    weight: 5,
    description: "My organization's requirement",
    evaluate: (spec) => ({ score: 1, findings: [] }),
  },
];
```

## License

MIT
