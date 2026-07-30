#!/usr/bin/env node

import fs from 'node:fs/promises';
import {
  loadPedagogyRegressionRepository,
  runPedagogyRegressions,
} from './lib/pedagogy-regressions.mjs';

function usage(message) {
  throw new Error(
    `${message}\nUsage: node scripts/run-pedagogy-regression-worker.mjs `
    + '<request-json> <result-json>',
  );
}

async function main() {
  const [requestPath, resultPath, ...extra] = process.argv.slice(2);
  if (!requestPath || !resultPath || extra.length > 0) usage('invalid worker arguments');
  const request = JSON.parse(await fs.readFile(requestPath, 'utf8'));
  if (
    !Array.isArray(request.case_ids)
    || request.case_ids.length === 0
    || request.case_ids.some((value) => typeof value !== 'string' || value.length === 0)
    || new Set(request.case_ids).size !== request.case_ids.length
  ) {
    usage('request case_ids must be a non-empty unique string array');
  }

  const repository = await loadPedagogyRegressionRepository();
  const run = await runPedagogyRegressions(repository, {
    caseIds: request.case_ids,
  });
  await fs.writeFile(resultPath, `${JSON.stringify({
    case_ids: request.case_ids,
    run,
  })}\n`);
  console.log(
    `Pedagogy regression worker completed ${run.results.length} case(s); `
    + `${run.errors.length} error(s).`,
  );
}

main().catch((error) => {
  console.error(`Pedagogy regression worker failed: ${error.message}`);
  process.exitCode = 1;
});
