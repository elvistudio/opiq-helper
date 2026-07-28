#!/usr/bin/env node

import {
  formatCurriculumDiagnostic,
  loadCurriculumMapRepository,
  validateCurriculumMapRepository,
} from './lib/curriculum-maps.mjs';
import {
  formatComplianceDiagnostic,
  load2026ComplianceRepository,
  validate2026ComplianceRepository,
} from './lib/2026-27-compliance.mjs';

try {
  const repository = await loadCurriculumMapRepository();
  const result = validateCurriculumMapRepository(repository);
  const complianceRepository = await load2026ComplianceRepository();
  const complianceResult = await validate2026ComplianceRepository(complianceRepository);
  for (const diagnostic of result.diagnostics) console.error(formatCurriculumDiagnostic(diagnostic));
  for (const diagnostic of complianceResult.diagnostics) console.error(formatComplianceDiagnostic(diagnostic));
  const totalErrors = result.summary.errors + complianceResult.summary.errors;
  const totalWarnings = result.summary.warnings + complianceResult.summary.warnings;
  if (totalErrors > 0) {
    console.error(`Curriculum map check failed: ${totalErrors} error(s), ${totalWarnings} warning(s).`);
    process.exitCode = 1;
  } else {
    console.log(
      `Curriculum map check passed: ${result.summary.artifacts} artifacts, `
      + `${result.summary.topics} topics, ${result.summary.selectedUnitRecords} golden-unit records, `
      + `${result.summary.pageReferences} canonical page references validated; `
      + `${complianceResult.summary.outcomes} compliance outcomes and `
      + `${complianceResult.summary.requirements} home-learning requirements validated.`,
    );
  }
} catch (error) {
  console.error(`Curriculum map check failed: ${error.message}`);
  process.exitCode = 1;
}
