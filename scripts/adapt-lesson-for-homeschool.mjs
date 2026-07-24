#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  adaptLessonForHomeschool,
  createPedagogyHomeschoolValidators,
  loadPedagogyHomeschoolRepository,
  materializeHomeschoolFixture,
  pedagogyHomeschoolPaths,
  serializeHomeschoolYaml,
} from './lib/pedagogy-homeschool.mjs';
import { parseStrictPedagogyYaml } from './lib/pedagogy-knowledge.mjs';
import { stablePedagogyJson } from './lib/pedagogy-selection.mjs';

function usage() {
  return `Usage:
  node scripts/adapt-lesson-for-homeschool.mjs
  node scripts/adapt-lesson-for-homeschool.mjs --fixture <fixture-id> [--summary|--debug|--trace|--json]
  node scripts/adapt-lesson-for-homeschool.mjs --request <path> [--summary|--debug|--trace|--json] [--output <path>]
  node scripts/adapt-lesson-for-homeschool.mjs --write-examples

The command is deterministic, offline, and read-only unless --output or
--write-examples is explicitly supplied.`;
}

function parseArgs(argv) {
  const options = {
    fixture: null,
    request: null,
    output: null,
    mode: 'summary',
    writeExamples: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--fixture') options.fixture = argv[++index];
    else if (value === '--request') options.request = argv[++index];
    else if (value === '--output') options.output = argv[++index];
    else if (value === '--summary') options.mode = 'summary';
    else if (value === '--debug') options.mode = 'debug';
    else if (value === '--trace') options.mode = 'trace';
    else if (value === '--json') options.mode = 'json';
    else if (value === '--write-examples') options.writeExamples = true;
    else if (value === '--help' || value === '-h') {
      console.log(usage());
      process.exit(0);
    } else throw new Error(`unknown argument ${value}`);
  }
  if (options.fixture && options.request) throw new Error('choose either --fixture or --request');
  if (options.output && !options.request && !options.fixture) {
    throw new Error('--output requires --fixture or --request');
  }
  return options;
}

function schemaErrors(validate) {
  return (validate.errors ?? []).map((error) => (
    `${error.instancePath || '/'} ${error.message}`
    + (error.params?.additionalProperty ? `: ${error.params.additionalProperty}` : '')
  ));
}

function summary(result) {
  if (result.decision.status === 'failure') {
    return [
      `Request: ${result.decision.request_id}`,
      `Status: failure (${result.decision.failure.code})`,
      result.decision.failure.message,
      ...result.decision.failure.details.map((detail) => `- ${detail}`),
    ].join('\n');
  }
  return [
    `Request: ${result.decision.request_id}`,
    'Status: success',
    `Variant: ${result.decision.selected_variant}`,
    `Pattern: ${result.decision.derived_selection_decision.selected_pattern.pattern_id}`,
    `Sessions: ${result.weeklyStudyPlan.sessions.length}`,
    `Learner minutes: ${result.package.timing.total_learner_minutes}`,
    `Adult minutes: ${result.parentGuidance.timing.total_adult_minutes}`,
    `Teacher review: ${result.package.status.teacher_review}`,
    `Home trial: ${result.package.status.home_trial}`,
    `Homeschool ready: ${result.package.status.homeschool_ready}`,
  ].join('\n');
}

function debugView(result) {
  return {
    status: result.decision.status,
    selected_variant: result.decision.selected_variant,
    source_identity: result.decision.source_identity,
    failure: result.decision.failure,
    warnings: result.decision.warnings,
    phase_adaptations: result.decision.phase_adaptations,
    teacher_override_adaptations: result.decision.teacher_override_adaptations,
    answer_binding_decisions: result.decision.answer_binding_decisions,
    adult_role_decisions: result.decision.adult_role_decisions,
    safety_checks: result.decision.safety_checks,
    answer_access_checks: result.decision.answer_access_checks,
    timing_checks: result.decision.timing_checks,
  };
}

async function readRequest(filePath) {
  const raw = await fs.readFile(path.resolve(filePath), 'utf8');
  return filePath.endsWith('.json') ? JSON.parse(raw) : parseStrictPedagogyYaml(raw, filePath);
}

async function writeExplicitOutput(filePath, value, json = false) {
  const absolute = path.resolve(filePath);
  const root = path.resolve(process.cwd());
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    throw new Error('output path must stay inside the repository');
  }
  await fs.writeFile(
    absolute,
    json ? stablePedagogyJson(value) : serializeHomeschoolYaml(value),
  );
}

const options = parseArgs(process.argv.slice(2));
const repository = await loadPedagogyHomeschoolRepository({
  examplesOptional: true,
  skipExamples: options.writeExamples,
});
const validators = createPedagogyHomeschoolValidators(repository);

if (options.writeExamples) {
  const examples = repository.fixtures.data.fixtures
    .filter((fixture) => fixture.expected.example_id)
    .map((fixture) => {
      const request = materializeHomeschoolFixture(repository, fixture);
      const result = adaptLessonForHomeschool(repository, request);
      if (result.decision.status !== 'success') {
        throw new Error(`fixture ${fixture.fixture_id} did not produce a homeschool package`);
      }
      return {
        example_id: fixture.expected.example_id,
        homeschool_lesson_dna: result.homeschoolLessonDna,
        package: result.package,
        parent_guidance: result.parentGuidance,
        weekly_study_plan: result.weeklyStudyPlan,
      };
    })
    .sort((left, right) => Buffer.from(left.example_id).compare(Buffer.from(right.example_id)));
  const artifact = {
    schema_version: '1.0',
    artifact_type: 'homeschool_package_examples',
    examples,
  };
  await writeExplicitOutput(pedagogyHomeschoolPaths.examples, artifact);
  console.log(
    `Wrote ${examples.length} deterministic homeschool examples to `
    + `${pedagogyHomeschoolPaths.examples}.`,
  );
  process.exit(0);
}

if (!options.fixture && !options.request) {
  const rows = repository.fixtures.data.fixtures.map((fixture) => {
    const result = adaptLessonForHomeschool(
      repository,
      materializeHomeschoolFixture(repository, fixture),
    );
    return {
      fixture_id: fixture.fixture_id,
      status: result.decision.status,
      variant: result.decision.selected_variant,
      pattern_id:
        result.decision.derived_selection_decision?.selected_pattern?.pattern_id ?? null,
      failure_code: result.decision.failure?.code ?? null,
    };
  });
  console.log(stablePedagogyJson({
    mode: 'committed_fixture_inspection',
    ordering: 'fixture_id_bytewise',
    fixtures: rows,
  }).trimEnd());
  process.exit(0);
}

let request;
if (options.fixture) {
  const fixture = repository.fixtures.data.fixtures.find(
    (candidate) => candidate.fixture_id === options.fixture,
  );
  if (!fixture) throw new Error(`unknown fixture ${options.fixture}`);
  request = materializeHomeschoolFixture(repository, fixture);
} else request = await readRequest(options.request);

if (!validators.request(request)) {
  console.error(stablePedagogyJson({ errors: schemaErrors(validators.request) }).trimEnd());
  process.exit(2);
}

const result = adaptLessonForHomeschool(repository, request);
let outputValue;
let outputText;
if (options.mode === 'summary') outputText = summary(result);
else if (options.mode === 'debug') {
  outputValue = debugView(result);
  outputText = stablePedagogyJson(outputValue).trimEnd();
} else {
  outputValue = result;
  outputText = stablePedagogyJson(result).trimEnd();
}
if (options.output) {
  await writeExplicitOutput(options.output, outputValue ?? result, options.mode === 'json');
  console.log(`Wrote deterministic homeschool output to ${options.output}.`);
} else console.log(outputText);
if (result.decision.status === 'failure') process.exitCode = 1;
