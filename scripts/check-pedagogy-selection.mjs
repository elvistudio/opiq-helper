#!/usr/bin/env node

import {
  loadPedagogySelectionRepository,
  validatePedagogySelection,
} from './lib/pedagogy-selection.mjs';

try {
  const repository = await loadPedagogySelectionRepository();
  const result = validatePedagogySelection(repository);
  if (!result.valid) {
    for (const error of result.errors) console.error(`ERROR ${error}`);
    process.exitCode = 1;
  } else {
    console.log(
      `Pedagogy selection valid: ${result.counts.patterns} patterns, `
      + `${result.counts.targets} targets, ${result.counts.fixtures} fixtures `
      + `(${result.counts.successfulFixtures} success, ${result.counts.failureFixtures} structured failure), `
      + `${result.counts.examples} lesson DNA examples.`,
    );
  }
  for (const warning of result.warnings) console.warn(`WARNING ${warning}`);
} catch (error) {
  console.error(`ERROR ${error.message}`);
  process.exitCode = 1;
}
