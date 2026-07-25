#!/usr/bin/env node
import {
  loadCommittedPedagogyRegressionReport,
  loadPedagogyRegressionRepository,
  validateCommittedPedagogyRegressionReport,
} from './lib/pedagogy-regressions.mjs';

const repository = await loadPedagogyRegressionRepository();
const report = await loadCommittedPedagogyRegressionReport(repository);
const errors = await validateCommittedPedagogyRegressionReport(
  repository,
  report,
);
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
    + `${report.counts.by_case_kind.stale_evidence} stale-evidence, `
    + `${report.counts.by_case_kind.evidence_readiness} evidence-readiness.`,
  );
}
