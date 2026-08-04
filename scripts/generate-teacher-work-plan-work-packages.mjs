#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  GAP_REPORT_JSON_PATH,
  GAP_REPORT_MARKDOWN_PATH,
  buildTeacherWorkPlanGapReport,
  renderTeacherWorkPlanGapReportMarkdown,
  serializeTeacherWorkPlanGapReport,
} from './lib/teacher-work-plan-gap-report.mjs';
import {
  WORK_PACKAGE_AUDIT_PATH,
  formatTeacherWorkPlanWorkPackageDiagnostic,
  loadTeacherWorkPlanWorkPackages,
  renderTeacherWorkPlanWorkPackagesMarkdown,
  validateTeacherWorkPlanWorkPackages,
} from './lib/teacher-work-plan-work-packages.mjs';

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
  const gapReport = await buildTeacherWorkPlanGapReport({ rootDir });
  const expectedGapJson = serializeTeacherWorkPlanGapReport(gapReport);
  const expectedGapMarkdown = renderTeacherWorkPlanGapReportMarkdown(gapReport);
  const [committedGapJson, committedGapMarkdown] = await Promise.all([
    read(GAP_REPORT_JSON_PATH),
    read(GAP_REPORT_MARKDOWN_PATH),
  ]);
  const staleGapArtifacts = [];
  if (committedGapJson !== expectedGapJson) staleGapArtifacts.push(GAP_REPORT_JSON_PATH);
  if (committedGapMarkdown !== expectedGapMarkdown) staleGapArtifacts.push(GAP_REPORT_MARKDOWN_PATH);
  if (staleGapArtifacts.length > 0) {
    throw new Error(`current source gap report is stale: ${staleGapArtifacts.join(', ')}`);
  }

  const loaded = await loadTeacherWorkPlanWorkPackages({ rootDir, gapReport });
  const validation = validateTeacherWorkPlanWorkPackages(loaded.artifact, {
    schema: loaded.schema,
    gapReport,
  });
  if (validation.diagnostics.length > 0) {
    throw new Error(validation.diagnostics.map(formatTeacherWorkPlanWorkPackageDiagnostic).join('\n'));
  }
  const markdown = renderTeacherWorkPlanWorkPackagesMarkdown(loaded.artifact);
  if (mode === '--write') {
    await fs.writeFile(path.join(rootDir, WORK_PACKAGE_AUDIT_PATH), markdown, 'utf8');
    console.log(
      `Generated teacher work-plan priority package audit: ${validation.summary.priority_gaps} gaps, `
      + `${validation.summary.work_packages} packages, ${validation.summary.ready} ready, `
      + `${validation.summary.blocked} blocked.`,
    );
  } else {
    if (loaded.markdownText === null) throw new Error(`generated artifact is missing: ${WORK_PACKAGE_AUDIT_PATH}`);
    if (loaded.markdownText !== markdown) throw new Error(`generated artifact is stale: ${WORK_PACKAGE_AUDIT_PATH}`);
    console.log(
      `Teacher work-plan priority package audit is current: ${validation.summary.priority_gaps} gaps, `
      + `${validation.summary.work_packages} packages, ${validation.summary.ready} ready, `
      + `${validation.summary.blocked} blocked.`,
    );
  }
} catch (error) {
  console.error(`Teacher work-plan priority packages failed: ${error.message}`);
  process.exitCode = 1;
}
