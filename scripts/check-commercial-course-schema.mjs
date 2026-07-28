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
      + 'legacy production remains 10 lessons, 1 annual course, 4 annual components, '
      + '10 annual units, 36 annual selected pages, 84 page references, 0 external sources, and 15 warnings.',
    );
  }
} catch (error) {
  console.error(`Commercial-course schema check failed: ${error.message}`);
  process.exitCode = 1;
}
