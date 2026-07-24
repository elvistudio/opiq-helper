#!/usr/bin/env node

import {
  loadPedagogyHomeschoolRepository,
  validatePedagogyHomeschool,
} from './lib/pedagogy-homeschool.mjs';

try {
  const repository = await loadPedagogyHomeschoolRepository();
  const result = validatePedagogyHomeschool(repository);
  if (!result.valid) {
    for (const error of result.errors) console.error(`ERROR ${error}`);
    process.exitCode = 1;
  } else {
    console.log(
      `Pedagogy homeschool valid: ${result.counts.fixtures} fixtures `
      + `(${result.counts.successfulFixtures} success, `
      + `${result.counts.failureFixtures} structured failure), `
      + `${result.counts.examples} generated examples, ${result.counts.schemas} schemas.`,
    );
  }
  for (const warning of result.warnings) console.warn(`WARNING ${warning}`);
} catch (error) {
  console.error(`ERROR ${error.message}`);
  process.exitCode = 1;
}
