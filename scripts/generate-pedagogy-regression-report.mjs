#!/usr/bin/env node
import {
  buildPedagogyRegressionReport,
  checkPedagogyRegressionReport,
  loadPedagogyRegressionRepository,
  PEDAGOGY_REGRESSION_REPORT,
  runPedagogyRegressions,
  validatePedagogyRegressionReport,
  writePedagogyRegressionReport,
} from './lib/pedagogy-regressions.mjs';

const args = new Set(process.argv.slice(2));
const check = args.has('--check');
const repository = await loadPedagogyRegressionRepository();
const run = runPedagogyRegressions(repository);
const report = buildPedagogyRegressionReport(repository, run);
const errors = [
  ...repository.configurationErrors,
  ...run.errors,
  ...validatePedagogyRegressionReport(repository, report),
];
if (errors.length === 0 && check) {
  errors.push(...await checkPedagogyRegressionReport(repository, report));
}
if (errors.length > 0) {
  for (const error of errors) console.error(`[ERROR] ${error}`);
  process.exitCode = 1;
} else if (check) {
  console.log(
    `Pedagogy regression report is current: ${PEDAGOGY_REGRESSION_REPORT} `
    + `(${report.counts.total} cases).`,
  );
} else {
  await writePedagogyRegressionReport(repository, report);
  console.log(
    `Wrote ${PEDAGOGY_REGRESSION_REPORT} with ${report.counts.total} cases.`,
  );
}
