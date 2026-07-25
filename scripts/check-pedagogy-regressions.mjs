#!/usr/bin/env node
import {
  buildPedagogyRegressionReport,
  loadPedagogyRegressionRepository,
  runPedagogyRegressions,
  validatePedagogyRegressionReport,
} from './lib/pedagogy-regressions.mjs';

const repository = await loadPedagogyRegressionRepository();
const run = await runPedagogyRegressions(repository);
const report = buildPedagogyRegressionReport(repository, run);
const schemaErrors = validatePedagogyRegressionReport(repository, report);
const errors = [
  ...repository.configurationErrors,
  ...run.errors,
  ...schemaErrors,
];
if (errors.length > 0) {
  for (const error of errors) console.error(`[ERROR] ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Pedagogy regressions passed: ${report.counts.total} cases and `
    + `${report.counts.invariants.total} semantic invariants; `
    + `${report.counts.by_case_kind.production_classroom} classroom, `
    + `${report.counts.by_case_kind.production_homeschool} homeschool, `
    + `${report.counts.by_case_kind.architecture_only} architecture-only, `
    + `${report.counts.by_case_kind.deliberate_failure} deliberate failure, `
    + `${report.counts.by_case_kind.stale_evidence} stale-evidence.`,
  );
}
