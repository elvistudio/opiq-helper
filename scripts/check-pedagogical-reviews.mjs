#!/usr/bin/env node

import {
  formatPedagogicalReviewDiagnostic,
  loadPedagogicalReviewRepository,
  validatePedagogicalReviewRepository,
} from './lib/pedagogical-reviews.mjs';

try {
  const repository = await loadPedagogicalReviewRepository();
  const result = validatePedagogicalReviewRepository(repository);
  for (const diagnostic of result.diagnostics) console.error(formatPedagogicalReviewDiagnostic(diagnostic));
  if (result.summary.errors > 0) {
    console.error(`Pedagogical-review check failed: ${result.summary.errors} error(s), ${result.summary.warnings} warning(s).`);
    process.exitCode = 1;
  } else {
    console.log(
      `Pedagogical-review check passed: ${result.summary.packs} pack, `
      + `${result.summary.completedReviews} completed teacher reviews, ${result.summary.analysedTrials} analysed classroom trials; `
      + `${result.summary.warnings} workflow warning(s).`,
    );
  }
} catch (error) {
  console.error(`Pedagogical-review check failed: ${error.message}`);
  process.exitCode = 1;
}
