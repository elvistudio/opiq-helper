#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createPedagogySelectionValidators,
  loadPedagogySelectionRepository,
  selectLessonPedagogy,
  serializePedagogyYaml,
  stablePedagogyJson,
} from './lib/pedagogy-selection.mjs';
import { parseStrictPedagogyYaml } from './lib/pedagogy-knowledge.mjs';

function usage() {
  return `Usage:
  node scripts/select-lesson-pedagogy.mjs
  node scripts/select-lesson-pedagogy.mjs --fixture <fixture-id> [--summary|--debug|--trace|--json]
  node scripts/select-lesson-pedagogy.mjs --request <path> [--summary|--debug|--trace|--json] [--output <path>]
  node scripts/select-lesson-pedagogy.mjs --write-examples

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

function summary(result) {
  const decision = result.decision;
  if (decision.status === 'failure') {
    return [
      `Request: ${decision.request_id}`,
      `Status: failure (${decision.failure.code})`,
      decision.failure.message,
      ...decision.failure.details.map((detail) => `- ${detail}`),
    ].join('\n');
  }
  return [
    `Request: ${decision.request_id}`,
    `Status: success`,
    `Pattern: ${decision.selected_pattern.pattern_id}`,
    `Targets: ${decision.slot_decisions.map((slot) => slot.selected_target_id).filter(Boolean).join(', ')}`,
    `Timing: ${result.lessonDna.timing.total_planned_minutes}/${result.lessonDna.context.duration_minutes} minutes`,
    `Teacher review: ${result.lessonDna.status.teacher_review}`,
    `Effectiveness claimed: ${result.lessonDna.status.effectiveness_claimed}`,
  ].join('\n');
}

function debugView(result) {
  return {
    status: result.decision.status,
    selected_pattern: result.decision.selected_pattern,
    slot_decisions: result.decision.slot_decisions.map((slot) => ({
      slot_id: slot.slot_id,
      phase: slot.phase,
      selected_target_id: slot.selected_target_id,
      score: slot.score,
      excluded: slot.considered_candidates
        .filter((candidate) => !candidate.hard_filter_passed)
        .map((candidate) => ({
          target_id: candidate.target_id,
          reasons: candidate.hard_filter_reasons,
        })),
    })),
    teacher_override_results: result.decision.teacher_override_results,
    failure: result.decision.failure,
  };
}

async function readRequest(filePath) {
  const absolute = path.resolve(filePath);
  const raw = await fs.readFile(absolute, 'utf8');
  if (filePath.endsWith('.json')) return JSON.parse(raw);
  return parseStrictPedagogyYaml(raw, filePath);
}

async function writeExplicitOutput(filePath, value, json = false) {
  const absolute = path.resolve(filePath);
  const root = path.resolve(process.cwd());
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    throw new Error('output path must stay inside the repository');
  }
  await fs.writeFile(absolute, json ? stablePedagogyJson(value) : serializePedagogyYaml(value));
}

const options = parseArgs(process.argv.slice(2));
const repository = await loadPedagogySelectionRepository({ examplesOptional: true });
const validators = createPedagogySelectionValidators(repository);

if (options.writeExamples) {
  const examples = repository.fixtures.data.fixtures
    .filter((fixture) => fixture.expected.example_id)
    .map((fixture) => {
      const result = selectLessonPedagogy(repository, fixture.request);
      if (!result.lessonDna) throw new Error(`fixture ${fixture.fixture_id} did not produce lesson DNA`);
      return { ...result.lessonDna, lesson_dna_id: fixture.expected.example_id };
    })
    .sort((left, right) => Buffer.from(left.lesson_dna_id).compare(Buffer.from(right.lesson_dna_id)));
  const artifact = {
    schema_version: '1.0',
    artifact_type: 'lesson_dna_examples',
    examples,
  };
  const output = 'knowledge/pedagogy/selection/lesson-dna-examples.yaml';
  await writeExplicitOutput(output, artifact);
  console.log(`Wrote ${examples.length} deterministic lesson DNA examples to ${output}.`);
  process.exit(0);
}

if (!options.fixture && !options.request) {
  const rows = repository.fixtures.data.fixtures.map((fixture) => {
    const result = selectLessonPedagogy(repository, fixture.request);
    return {
      fixture_id: fixture.fixture_id,
      status: result.decision.status,
      pattern_id: result.decision.selected_pattern?.pattern_id ?? null,
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
  const fixture = repository.fixtures.data.fixtures.find((item) => item.fixture_id === options.fixture);
  if (!fixture) throw new Error(`unknown fixture ${options.fixture}`);
  request = fixture.request;
} else request = await readRequest(options.request);

if (!validators.request(request)) {
  console.error(stablePedagogyJson({ errors: validators.request.errors }).trimEnd());
  process.exit(2);
}

const result = selectLessonPedagogy(repository, request);
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
  console.log(`Wrote deterministic selection output to ${options.output}.`);
} else console.log(outputText);
if (result.decision.status === 'failure') process.exitCode = 1;
