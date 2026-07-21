#!/usr/bin/env node

import {
  formatTeacherPackDiagnostic,
  loadTeacherPackRepository,
  validateTeacherPackRepository,
} from './lib/teacher-packs.mjs';

try {
  const repository = await loadTeacherPackRepository();
  const result = validateTeacherPackRepository(repository);
  for (const diagnostic of result.diagnostics) console.error(formatTeacherPackDiagnostic(diagnostic));
  if (result.summary.errors > 0) {
    console.error(`Teacher-pack check failed: ${result.summary.errors} error(s), ${result.summary.warnings} warning(s).`);
    process.exitCode = 1;
  } else {
    console.log(
      `Teacher-pack check passed: ${result.summary.packs} pack, ${result.summary.lessons} lessons, `
      + `${result.summary.materials} registered materials, ${result.summary.studentDocuments} student files; `
      + `${result.summary.warnings} readiness warning(s).`,
    );
  }
} catch (error) {
  console.error(`Teacher-pack check failed: ${error.message}`);
  process.exitCode = 1;
}
