#!/usr/bin/env node

import {
  formatPedagogyDiagnostic,
  loadPedagogyKnowledge,
  validatePedagogyKnowledge,
} from './lib/pedagogy-knowledge.mjs';

try {
  const repository = await loadPedagogyKnowledge();
  const result = validatePedagogyKnowledge(repository);
  for (const warning of result.warnings) console.warn(formatPedagogyDiagnostic(warning));
  for (const error of result.errors) console.error(formatPedagogyDiagnostic(error));
  if (!result.valid) {
    console.error(
      `Pedagogical knowledge validation failed with ${result.errors.length} error(s) and ${result.warnings.length} warning(s).`,
    );
    process.exitCode = 1;
  } else {
    console.log(
      `Pedagogical knowledge valid: ${result.counts.references} references, `
      + `${result.counts.principles} principles, ${result.counts.activities} activities, `
      + `${result.counts.patterns} patterns, ${result.warnings.length} warnings.`,
    );
  }
} catch (error) {
  console.error(`Pedagogical knowledge validation failed: ${error.message}`);
  process.exitCode = 1;
}
