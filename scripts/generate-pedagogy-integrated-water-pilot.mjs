#!/usr/bin/env node
import {
  checkGeneratedFiles,
  generateWaterPilotArtifacts,
  generationSummary,
  stableIntegrationJson,
  writeGeneratedFiles,
} from './lib/pedagogy-generation-integration.mjs';

const args = process.argv.slice(2);
const allowed = new Set(['--check', '--write', '--summary', '--debug', '--lesson']);
let mode = 'summary';
let lessonId = null;
for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (!allowed.has(argument)) {
    console.error(`Unknown argument: ${argument}`);
    process.exit(2);
  }
  if (argument === '--lesson') {
    lessonId = args[index + 1];
    if (!lessonId || lessonId.startsWith('--')) {
      console.error('--lesson requires a lesson ID');
      process.exit(2);
    }
    index += 1;
  } else if (argument === '--check' || argument === '--write') {
    mode = argument.slice(2);
  } else if (argument === '--summary') {
    mode = 'summary';
  } else if (argument === '--debug') {
    mode = 'debug';
  }
}

try {
  const generated = await generateWaterPilotArtifacts();
  if (lessonId && !generated.rows.has(lessonId)) {
    console.error(`Unknown pilot lesson: ${lessonId}`);
    process.exit(1);
  }
  if (mode === 'write') {
    await writeGeneratedFiles(generated);
    console.log(`Wrote ${generated.files.size} deterministic pilot files.`);
  } else if (mode === 'check') {
    const mismatches = await checkGeneratedFiles(generated);
    if (mismatches.length) {
      for (const mismatch of mismatches) console.error(mismatch);
      process.exit(1);
    }
    console.log(`Pedagogy water pilot is current (${generated.files.size} files).`);
  } else {
    const summary = generationSummary(generated);
    if (lessonId) summary.lessons = summary.lessons.filter((row) => row.lesson_id === lessonId);
    if (mode === 'debug') {
      summary.debug = summary.lessons.map((lesson) => {
        const row = generated.rows.get(lesson.lesson_id);
        return {
          lesson_id: lesson.lesson_id,
          selection_status: row.selection.decision.status,
          task_bindings: row.taskBindings,
          timing_reconciliation: row.reconciliation,
          homeschool_status: row.homeschool.decision.status,
          homeschool_warnings: row.homeschool.decision.warnings,
        };
      });
    }
    console.log(stableIntegrationJson(summary).trimEnd());
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
