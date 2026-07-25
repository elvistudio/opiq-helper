#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildPedagogyQualityReport,
  evaluatePedagogyQuality,
  serializePedagogyQualityReport,
} from './lib/pedagogy-quality-gates.mjs';
import {
  loadWaterPilotPedagogyQualityRepository,
  WATER_QUALITY_REPORT_ID,
  WATER_QUALITY_REPORT_PATH,
} from './lib/pedagogy-quality-production.mjs';

function usage(message) {
  throw new Error(
    `${message}\nUsage: node scripts/check-pedagogy-quality.mjs `
    + '[--json] [--path <repository-path>] [--report] [--strict-warnings]',
  );
}

function parseArguments(argumentsList) {
  const options = {
    json: false,
    path: null,
    report: false,
    strictWarnings: false,
  };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--json') options.json = true;
    else if (argument === '--report') options.report = true;
    else if (argument === '--strict-warnings') options.strictWarnings = true;
    else if (argument === '--path') {
      options.path = argumentsList[index + 1];
      if (!options.path) usage('--path requires a repository path');
      index += 1;
    } else usage(`unknown option ${argument}`);
  }
  if (options.report && options.path) {
    usage('--report verifies the complete committed production report and cannot use --path');
  }
  return options;
}

function displayDiagnostic(diagnostic) {
  return `[${diagnostic.severity.toUpperCase()}] ${diagnostic.gate_id}@`
    + `${diagnostic.gate_version} ${diagnostic.artifact_path} `
    + `${diagnostic.record_id} ${diagnostic.code}: ${diagnostic.message}`;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const repository = await loadWaterPilotPedagogyQualityRepository();
  const evaluation = evaluatePedagogyQuality(repository, {
    requestedPath: options.path,
  });
  const report = buildPedagogyQualityReport(repository, evaluation, {
    reportId: WATER_QUALITY_REPORT_ID,
    reportPath: WATER_QUALITY_REPORT_PATH,
    requestedPath: options.path,
  });
  const serialized = serializePedagogyQualityReport(report);
  if (options.report) {
    const committed = await fs.readFile(
      path.join(repository.rootDir, WATER_QUALITY_REPORT_PATH),
      'utf8',
    );
    if (committed !== serialized) {
      throw new Error(`${WATER_QUALITY_REPORT_PATH} is stale; regenerate the report`);
    }
  }
  if (options.json) {
    process.stdout.write(serialized);
  } else {
    for (const diagnostic of evaluation.diagnostics) {
      console.log(displayDiagnostic(diagnostic));
    }
    console.log(
      `Pedagogical quality: ${evaluation.structuralStatus}; `
      + `${evaluation.counts.errors} error(s), `
      + `${evaluation.counts.warnings} warning(s), `
      + `${evaluation.counts.info} info diagnostic(s), `
      + `${evaluation.records.length} record(s).`,
    );
    if (options.report) {
      console.log(`Committed report is current: ${WATER_QUALITY_REPORT_PATH}`);
    }
  }
  if (
    evaluation.counts.errors > 0
    || (options.strictWarnings && evaluation.counts.warnings > 0)
  ) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Pedagogical quality check failed: ${error.message}`);
  process.exitCode = 1;
});
