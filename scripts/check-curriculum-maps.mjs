#!/usr/bin/env node

import {
  formatCurriculumDiagnostic,
  loadCurriculumMapRepository,
  validateCurriculumMapRepository,
} from './lib/curriculum-maps.mjs';

try {
  const repository = await loadCurriculumMapRepository();
  const result = validateCurriculumMapRepository(repository);
  for (const diagnostic of result.diagnostics) console.error(formatCurriculumDiagnostic(diagnostic));
  if (result.summary.errors > 0) {
    console.error(`Curriculum map check failed: ${result.summary.errors} error(s), ${result.summary.warnings} warning(s).`);
    process.exitCode = 1;
  } else {
    console.log(
      `Curriculum map check passed: ${result.summary.artifacts} artifacts, `
      + `${result.summary.topics} topics, ${result.summary.selectedUnitRecords} golden-unit records, `
      + `${result.summary.pageReferences} canonical page references validated.`,
    );
  }
} catch (error) {
  console.error(`Curriculum map check failed: ${error.message}`);
  process.exitCode = 1;
}
