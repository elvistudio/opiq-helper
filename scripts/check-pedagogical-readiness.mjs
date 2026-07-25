#!/usr/bin/env node

import {
  buildPedagogicalReadinessReport,
  checkPedagogicalReadinessReport,
  createPedagogicalReadinessReportValidator,
  PEDAGOGICAL_READINESS_REPORT_PATH,
} from './lib/pedagogical-readiness.mjs';

async function main() {
  const reportCheck = process.argv.slice(2).includes('--report');
  const report = reportCheck
    ? await checkPedagogicalReadinessReport()
    : await buildPedagogicalReadinessReport();
  const validator = await createPedagogicalReadinessReportValidator();
  if (!validator(report)) {
    throw new Error(`readiness report schema invalid: ${JSON.stringify(validator.errors)}`);
  }
  console.log(
    `Pedagogical readiness: classroom=${report.classroom_ready}, `
    + `homeschool=${report.homeschool_ready}, `
    + `${report.blockers.length} blocker(s), `
    + `${report.evidence_paths.length} evidence record(s).`,
  );
  if (reportCheck) console.log(`Committed report is current: ${PEDAGOGICAL_READINESS_REPORT_PATH}`);
}

main().catch((error) => {
  console.error(`Pedagogical readiness check failed${error.code ? ` [${error.code}]` : ''}: ${error.message}`);
  process.exitCode = 1;
});
