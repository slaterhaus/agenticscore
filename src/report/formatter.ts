import pc from "picocolors";
import type { AgentReadinessReport } from "../scoring/engine.js";

export type ReportFormat = "json" | "text" | "markdown";

/**
 * Format a scoring report for different output targets.
 */
export function generateReport(report: AgentReadinessReport, format: ReportFormat = "text"): string {
  switch (format) {
    case "json":
      return JSON.stringify(report, null, 2);
    case "markdown":
      return formatMarkdown(report);
    case "text":
    default:
      return formatText(report);
  }
}

function gradeColor(grade: string, text: string): string {
  switch (grade) {
    case "A": return pc.green(text);
    case "B": return pc.yellow(text);
    case "C": return pc.yellow(text);
    case "D": return pc.red(text);
    case "F": return pc.red(pc.bold(text));
    default: return text;
  }
}

function barColor(score: number, bar: string): string {
  if (score >= 80) return pc.green(bar);
  if (score >= 60) return pc.yellow(bar);
  if (score >= 40) return pc.red(bar);
  return pc.dim(bar);
}

function formatText(report: AgentReadinessReport): string {
  const lines: string[] = [];

  const scoreText = `${report.overallScore}/100 (Grade ${report.grade})`;
  lines.push(`\n  ${gradeColor(report.grade, `Agent Readiness: ${scoreText}`)}`);
  lines.push(`  ${pc.dim(report.specTitle)} ${pc.dim(`v${report.specVersion}`)}`);
  lines.push(`  ${pc.dim(`${report.operationCount} operations, ${report.schemaCount} schemas`)}\n`);

  lines.push("  Categories:");
  for (const cat of report.categories) {
    const filled = Math.round(cat.score / 10);
    const bar = "█".repeat(filled) + "░".repeat(10 - filled);
    lines.push(`    ${pc.dim(cat.category.padEnd(12))} ${barColor(cat.score, bar)} ${cat.score}%`);
  }

  if (report.topFindings.length > 0) {
    lines.push(`\n  ${pc.red("Issues:")}`);
    for (const finding of report.topFindings.slice(0, 5)) {
      lines.push(`    ${pc.dim("•")} ${finding}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

function formatMarkdown(report: AgentReadinessReport): string {
  const lines: string[] = [];

  lines.push(`# Agent Readiness Report: ${report.specTitle}`);
  lines.push("");
  lines.push(`**Score:** ${report.overallScore}/100 (Grade ${report.grade})`);
  lines.push(`**Version:** ${report.specVersion}`);
  lines.push(`**Operations:** ${report.operationCount} | **Schemas:** ${report.schemaCount}`);
  lines.push(`**Scored:** ${report.scoredAt}`);
  lines.push("");

  lines.push("## Category Breakdown");
  lines.push("");
  lines.push("| Category | Score | Details |");
  lines.push("|----------|-------|---------|");
  for (const cat of report.categories) {
    const ruleDetails = cat.rules.map((r) => `${r.name}: ${r.score}%`).join(", ");
    lines.push(`| ${cat.category} | ${cat.score}% | ${ruleDetails} |`);
  }

  if (report.topFindings.length > 0) {
    lines.push("");
    lines.push("## Findings");
    lines.push("");
    for (const finding of report.topFindings) {
      lines.push(`- ${finding}`);
    }
  }

  return lines.join("\n");
}
