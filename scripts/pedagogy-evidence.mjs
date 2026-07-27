#!/usr/bin/env node

import fs from 'node:fs/promises';
import {
  parseStrictCurriculumYaml,
  safeRepositoryPath,
} from './lib/curriculum-maps.mjs';
import {
  assertPedagogicalEvidenceFinalGuards,
  writeNormalizedPedagogicalEvidenceFile,
} from './lib/pedagogical-evidence-final-guards.mjs';
import {
  normalizePedagogicalEvidenceIntake,
  preparePedagogicalEvidenceBundle,
  registerPedagogicalEvidence,
} from './lib/pedagogical-evidence-workflow.mjs';
import {
  formatPedagogicalReviewDiagnostic,
  loadPedagogicalReviewRepository,
  validatePedagogicalReviewRepository,
} from './lib/pedagogical-reviews.mjs';

function parseArguments(values) {
  const options = { write: false };
  for (let index = 0; index < values.length; index += 1) {
    const argument = values[index];
    if (argument === '--write') options.write = true;
    else if (argument.startsWith('--')) {
      const key = argument.slice(2).replaceAll('-', '_');
      const value = values[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value`);
      options[key] = value;
      index += 1;
    } else throw new Error(`unexpected argument ${argument}`);
  }
  return options;
}

async function loadNormalizedRecord(recordPath) {
  return parseStrictCurriculumYaml(
    await fs.readFile(
      safeRepositoryPath(
        process.cwd(),
        recordPath,
        'normalized pedagogical evidence input',
      ),
      'utf8',
    ),
    recordPath,
  );
}

async function main() {
  const [command, ...argumentsList] = process.argv.slice(2);
  const options = parseArguments(argumentsList);
  if (command === 'prepare') {
    const result = await preparePedagogicalEvidenceBundle({
      packPath: options.pack,
      kind: options.kind,
      recordId: options.id,
      date: options.date,
      outputDirectory: options.output,
    });
    console.log(`Prepared checklist: ${result.checklist_path}`);
    console.log(`Prepared JSON intake: ${result.intake_path}`);
  } else if (command === 'normalize') {
    const result = await normalizePedagogicalEvidenceIntake({
      intakePath: options.input,
      outputPath: null,
    });
    assertPedagogicalEvidenceFinalGuards(result.record);
    if (options.output) {
      await writeNormalizedPedagogicalEvidenceFile({
        outputPath: options.output,
        yaml: result.yaml,
        record: result.record,
      });
      console.log(`Normalized evidence: ${options.output}`);
    } else process.stdout.write(result.yaml);
  } else if (command === 'register') {
    assertPedagogicalEvidenceFinalGuards(
      await loadNormalizedRecord(options.input),
    );
    const result = await registerPedagogicalEvidence({
      packPath: options.pack,
      recordPath: options.input,
      targetPath: options.target,
      write: options.write,
    });
    console.log(
      `Registered ${result.target_path}; fingerprint remains ${result.after.value} `
      + `(${result.after.file_count} files).`,
    );
  } else if (command === 'check') {
    const repository = await loadPedagogicalReviewRepository();
    for (const artifact of [
      ...repository.reviewRecords,
      ...repository.trialRecords,
      ...repository.homeTrialRecords,
    ]) {
      assertPedagogicalEvidenceFinalGuards(artifact.data);
    }
    const result = validatePedagogicalReviewRepository(repository);
    for (const diagnostic of result.diagnostics) {
      console.error(formatPedagogicalReviewDiagnostic(diagnostic));
    }
    if (result.summary.errors > 0) {
      throw new Error(`${result.summary.errors} pedagogical evidence validation error(s)`);
    }
    const examplePaths = [
      'pedagogical-reviews/grade-5-science/water/examples/classroom-trial/intake.json',
      'pedagogical-reviews/grade-5-science/water/examples/home-trial/intake.json',
      'pedagogical-reviews/grade-5-science/water/examples/teacher-review/intake.json',
    ];
    for (const intakePath of examplePaths) {
      const normalized = await normalizePedagogicalEvidenceIntake({ intakePath });
      assertPedagogicalEvidenceFinalGuards(normalized.record);
    }
    console.log(
      `Pedagogical evidence valid: ${result.summary.completedReviews} review(s), `
      + `${result.summary.analysedTrials} classroom trial(s), `
      + `${result.summary.analysedHomeTrials} home trial(s), `
      + `${examplePaths.length} deterministic intake example(s).`,
    );
  } else {
    throw new Error(
      'Usage: pedagogy-evidence.mjs prepare|normalize|register|check [options]',
    );
  }
}

main().catch((error) => {
  console.error(`Pedagogical evidence workflow failed${error.code ? ` [${error.code}]` : ''}: ${error.message}`);
  process.exitCode = 1;
});
