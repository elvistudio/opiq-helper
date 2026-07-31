#!/usr/bin/env node

import {
  loadCommercialCourseFixtures,
  validateCommercialCourseFixtures,
} from './lib/commercial-course-fixtures.mjs';

try {
  const fixtures = await loadCommercialCourseFixtures();
  const result = validateCommercialCourseFixtures(fixtures);
  for (const entry of result.diagnostics) {
    console.error(`[${entry.severity.toUpperCase()}] ${entry.file} ${entry.field}: ${entry.reason}`);
  }
  if (result.summary.errors > 0) {
    console.error(`Commercial-course schema check failed: ${result.summary.errors} error(s).`);
    process.exitCode = 1;
  } else {
    console.log(
      `Commercial-course schema check passed: ${result.summary.lessons} lesson fixtures, `
      + `${result.summary.thematicPlans} thematic aggregate, ${result.summary.annualCourses} annual aggregate; `
      + `production includes ${result.production.summary.profiles} profiles and `
      + `${result.production.summary.lessons} lessons, with ${result.production.summary.annualCourses} annual course, `
      + `${result.production.summary.annualComponents} annual components, `
      + `${result.production.summary.annualUnits} annual units, `
      + `${result.production.summary.annualSelectedPages} annual selected pages, `
      + `${result.production.summary.pageReferences} page references, `
      + `${result.production.summary.externalSources} external sources, and `
      + `${result.production.summary.warnings} warnings.`,
    );
  }
} catch (error) {
  console.error(`Commercial-course schema check failed: ${error.message}`);
  process.exitCode = 1;
}
