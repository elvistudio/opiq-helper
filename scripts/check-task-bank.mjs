#!/usr/bin/env node

import {
  formatTaskBankDiagnostic,
  loadTaskBankRepository,
  validateTaskBankRepository,
} from './lib/task-bank.mjs';

try {
  const repository = await loadTaskBankRepository();
  const result = validateTaskBankRepository(repository);
  for (const entry of result.diagnostics) {
    console.error(formatTaskBankDiagnostic(entry));
  }
  if (result.summary.errors > 0) {
    console.error(`Task-bank check failed: ${result.summary.errors} error(s).`);
    process.exitCode = 1;
  } else {
    console.log(
      `Task-bank check passed: ${result.summary.specifications} specifications, `
      + `${result.summary.tasks} tasks, ${result.summary.reviews} reviews, `
      + `${result.summary.indexed} indexed relationships.`,
    );
  }
} catch (error) {
  console.error(`Task-bank check failed: ${error.message}`);
  process.exitCode = 1;
}
