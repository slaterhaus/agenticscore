import { scanSpec, type ParsedSpec } from "../scanner/parser.js";
import { rules, type ScoringRule, type RuleResult } from "./rules.js";

export interface CategoryScore {
  category: string;
  score: number;
  maxWeight: number;
  weightedScore: number;
  rules: Array<{ id: string; name: string; score: number; findings: string[] }>;
}

export interface AgentReadinessReport {
  specTitle: string;
  specVersion: string;
  overallScore: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  categories: CategoryScore[];
  topFindings: string[];
  operationCount: number;
  schemaCount: number;
  scoredAt: string;
}

/**
 * Score an OpenAPI spec for AI agent readiness.
 * Returns a 0-100 score with category breakdowns and actionable findings.
 */
export function scoreSpec(input: string): AgentReadinessReport {
  const parsed = scanSpec(input);
  return scoreFromParsed(parsed);
}

export function scoreFromParsed(parsed: ParsedSpec): AgentReadinessReport {
  const categoryMap = new Map<string, CategoryScore>();

  for (const rule of rules) {
    if (!categoryMap.has(rule.category)) {
      categoryMap.set(rule.category, {
        category: rule.category,
        score: 0,
        maxWeight: 0,
        weightedScore: 0,
        rules: [],
      });
    }

    const category = categoryMap.get(rule.category)!;
    const result = rule.evaluate(parsed);

    category.maxWeight += rule.weight;
    category.weightedScore += result.score * rule.weight;
    category.rules.push({
      id: rule.id,
      name: rule.name,
      score: Math.round(result.score * 100),
      findings: result.findings,
    });
  }

  // Calculate category scores and overall
  let totalWeight = 0;
  let totalWeightedScore = 0;

  for (const category of categoryMap.values()) {
    category.score = category.maxWeight > 0
      ? Math.round((category.weightedScore / category.maxWeight) * 100)
      : 0;
    totalWeight += category.maxWeight;
    totalWeightedScore += category.weightedScore;
  }

  const overallScore = totalWeight > 0
    ? Math.round((totalWeightedScore / totalWeight) * 100)
    : 0;

  // Collect top findings (most impactful)
  const allFindings: string[] = [];
  for (const category of categoryMap.values()) {
    for (const rule of category.rules) {
      allFindings.push(...rule.findings);
    }
  }

  const grade = overallScore >= 90 ? "A"
    : overallScore >= 75 ? "B"
    : overallScore >= 60 ? "C"
    : overallScore >= 40 ? "D"
    : "F";

  return {
    specTitle: parsed.metadata.title,
    specVersion: parsed.metadata.version,
    overallScore,
    grade,
    categories: Array.from(categoryMap.values()),
    topFindings: allFindings.slice(0, 10),
    operationCount: parsed.metadata.operationCount,
    schemaCount: parsed.metadata.schemaCount,
    scoredAt: new Date().toISOString(),
  };
}
