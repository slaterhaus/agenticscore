#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync } from "fs";
import { scoreSpec } from "./scoring/engine.js";
import { generateReport } from "./report/formatter.js";

const program = new Command();

program
  .name("agenticscore")
  .description("Score your API's readiness for AI agent consumption")
  .version("0.1.0");

program
  .command("score")
  .description("Score an OpenAPI spec file")
  .argument("<spec-file>", "Path to OpenAPI spec (YAML or JSON)")
  .option("-f, --format <format>", "Output format: text, json, markdown", "text")
  .option("--min-score <score>", "Exit with code 1 if score is below this threshold", "0")
  .action((specFile, options) => {
    const content = readFileSync(specFile, "utf-8");
    const report = scoreSpec(content);
    const output = generateReport(report, options.format);

    console.log(output);

    const minScore = parseInt(options.minScore, 10);
    if (report.overallScore < minScore) {
      console.error(`\n  ❌ Score ${report.overallScore} is below minimum ${minScore}\n`);
      process.exit(1);
    }
  });

program.parse();
