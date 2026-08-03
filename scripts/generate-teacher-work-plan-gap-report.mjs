#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  GAP_REPORT_JSON_PATH,
  GAP_REPORT_MARKDOWN_PATH,
  GAP_REPORT_SCHEMA_PATH,
  buildTeacherWorkPlanGapReport,
  formatTeacherWorkPlanGapReportDiagnostic,
  renderTeacherWorkPlanGapReportMarkdown,
  serializeTeacherWorkPlanGapReport,
  validateTeacherWorkPlanGapReport,
} from './lib/teacher-work-plan-gap-report.mjs';
import {
  loadTeacherWorkPlanCurriculumMapRepository,
} from './lib/teacher-work-plan-curriculum-maps.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseMode(argumentsList) {
  if (argumentsList.length !== 1 || !['--write', '--check'].includes(argumentsList[0])) {
    throw new Error('choose exactly one mode: --write or --check');
  }
  return argumentsList[0];
}

async function read(repositoryPath) {
  return fs.readFile(path.join(rootDir, repositoryPath), 'utf8');
}

try {
  const mode = parseMode(process.argv.slice(2));
  const repository = await loadTeacherWorkPlanCurriculumMapRepository({ rootDir });
  const report = await buildTeacherWorkPlanGapReport({ rootDir, repository });
  const schema = JSON.parse(await read(GAP_REPORT_SCHEMA_PATH));
  const validation = validateTeacherWorkPlanGapReport(report, { schema, repository });
  if (validation.diagnostics.length > 0) {
    throw new Error(validation.diagnostics.map(formatTeacherWorkPlanGapReportDiagnostic).join('\n'));
  }
  const jsonBytes = serializeTeacherWorkPlanGapReport(report);
  const markdownBytes = renderTeacherWorkPlanGapReportMarkdown(report);
  if (mode === '--write') {
    await Promise.all([
      fs.writeFile(path.join(rootDir, GAP_REPORT_JSON_PATH), jsonBytes, 'utf8'),
      fs.writeFile(path.join(rootDir, GAP_REPORT_MARKDOWN_PATH), markdownBytes, 'utf8'),
    ]);
    console.log(
      `Generated teacher work-plan gap report: ${report.aggregate_summary.route_count} routes, `
      + `${report.aggregate_summary.total_source_record_count} source records, `
      + `${report.aggregate_summary.gap_item_count} gap items.`,
    );
  } else {
    const [committedJson, committedMarkdown] = await Promise.all([
      read(GAP_REPORT_JSON_PATH),
      read(GAP_REPORT_MARKDOWN_PATH),
    ]);
    const stale = [];
    if (committedJson !== jsonBytes) stale.push(GAP_REPORT_JSON_PATH);
    if (committedMarkdown !== markdownBytes) stale.push(GAP_REPORT_MARKDOWN_PATH);
    if (stale.length > 0) throw new Error(`generated artifact is stale: ${stale.join(', ')}`);
    console.log(
      `Teacher work-plan gap report is current: ${report.aggregate_summary.route_count} routes, `
      + `${report.aggregate_summary.total_source_record_count} source records, `
      + `${report.aggregate_summary.gap_item_count} gap items.`,
    );
  }
} catch (error) {
  console.error(`Teacher work-plan gap report failed: ${error.message}`);
  process.exitCode = 1;
}
