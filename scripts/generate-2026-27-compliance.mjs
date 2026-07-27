#!/usr/bin/env node

import {
  build2026ComplianceDerivedArtifacts,
  formatComplianceDiagnostic,
  load2026ComplianceRepository,
  validate2026ComplianceDerivedArtifacts,
  validate2026ComplianceRepository,
  write2026ComplianceDerivedArtifacts,
} from './lib/2026-27-compliance.mjs';

const args = new Set(process.argv.slice(2));
const allowed = new Set(['--check', '--registry-only']);
const unknown = [...args].filter((argument) => !allowed.has(argument));

if (unknown.length > 0) {
  console.error(`2026/27 compliance check failed: unknown option(s): ${unknown.join(', ')}`);
  process.exitCode = 1;
} else {
  try {
    const repository = await load2026ComplianceRepository();
    const result = await validate2026ComplianceRepository(repository, {
      registryOnly: args.has('--registry-only'),
    });
    for (const diagnostic of result.diagnostics) console.error(formatComplianceDiagnostic(diagnostic));
    if (result.summary.errors > 0) {
      console.error(
        `2026/27 compliance check failed: ${result.summary.errors} error(s), `
        + `${result.summary.warnings} warning(s).`,
      );
      process.exitCode = 1;
    } else if (args.has('--registry-only')) {
      console.log(`Official source registry passed: ${result.summary.sources} version-pinned source records.`);
    } else {
      const artifacts = build2026ComplianceDerivedArtifacts(repository);
      if (args.has('--check')) {
        const diagnostics = await validate2026ComplianceDerivedArtifacts(repository, artifacts);
        for (const diagnostic of diagnostics) console.error(formatComplianceDiagnostic(diagnostic));
        if (diagnostics.length > 0) {
          console.error(`2026/27 compliance artifact check failed: ${diagnostics.length} error(s).`);
          process.exitCode = 1;
        } else {
          console.log(
            `2026/27 compliance check passed: ${result.summary.sources} sources, `
            + `${result.summary.outcomes} outcomes, ${result.summary.requirements} requirements, `
            + `${artifacts.size} derived artifacts current.`,
          );
        }
      } else {
        await write2026ComplianceDerivedArtifacts(repository, artifacts);
        console.log(
          `Generated ${artifacts.size} deterministic 2026/27 compliance artifacts from `
          + `${result.summary.sources} official source records.`,
        );
      }
    }
  } catch (error) {
    console.error(`2026/27 compliance check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
