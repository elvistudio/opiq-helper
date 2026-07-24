import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse } from 'yaml';
import {
  applyGeneratedRegion,
  buildIntegratedSelectionRequest,
  checkGeneratedFiles,
  computeLessonContentIdentity,
  computeUnitContentIdentity,
  generateWaterPilotArtifacts,
  generationSummary,
  lessonRequestsEstonianAssessment,
  reconcileLessonTiming,
  removeGeneratedRegion,
  resolveLessonContentRef,
  resolveProductionMaterialRef,
  stableIntegrationJson,
  taskBindings,
} from './lib/pedagogy-generation-integration.mjs';
import {
  computeTeacherPackFingerprintFromRepository,
} from './lib/teacher-pack-fingerprints.mjs';
import { loadTeacherPackRepository } from './lib/teacher-packs.mjs';

const rootDir = process.cwd();
const lessonIds = [
  'grade-5-water-01-properties',
  'grade-5-water-02-states',
  'grade-5-water-03-melting-condensation',
  'grade-5-water-04-changes-review',
];
let generated;
let validators;

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function readYaml(file) {
  return parse(await fs.readFile(file, 'utf8'));
}

function rowFor(lessonId) {
  return generated.rows.get(lessonId);
}

function lessonFor(lessonId) {
  return generated.lessons.find((lesson) => lesson.lesson_id === lessonId);
}

function escaped(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function mutateTiming(lessonId, mutate) {
  const lesson = structuredClone(lessonFor(lessonId));
  const dna = structuredClone(rowFor(lessonId).lessonDna);
  mutate(lesson, dna);
  return () => reconcileLessonTiming(lesson, dna);
}

async function createValidators() {
  const [
    courseMap,
    common,
    integration,
    lesson,
    thematic,
    pack,
    homePolicy,
  ] = await Promise.all([
    readJson('schemas/course-map.schema.json'),
    readJson('schemas/teaching-plan-common.schema.json'),
    readJson('schemas/pedagogy-generation-integration.schema.json'),
    readJson('schemas/lesson-plan.schema.json'),
    readJson('schemas/thematic-plan.schema.json'),
    readJson('schemas/teacher-pack.schema.json'),
    readJson('schemas/home-practical-policy.schema.json'),
  ]);
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  ajv.addSchema(courseMap);
  ajv.addSchema(common);
  ajv.addSchema(integration);
  return {
    lesson: ajv.compile(lesson),
    thematic: ajv.compile(thematic),
    pack: ajv.compile(pack),
    homePolicy: ajv.compile(homePolicy),
  };
}

test.before(async () => {
  [generated, validators] = await Promise.all([
    generateWaterPilotArtifacts(),
    createValidators(),
  ]);
});

test('schema migration keeps legacy and validates the integrated pilot', async () => {
  const legacyLesson = await readYaml(
    'lesson-plans/grade-5-science/water-use-cycle/lesson-01.yaml',
  );
  const legacyThematic = await readYaml(
    'lesson-plans/grade-5-science/water-use-cycle/thematic-plan.yaml',
  );
  const legacyPack = await readYaml(
    'teacher-packs/grade-5-science/water-use-cycle/materials-index.yaml',
  );
  assert.equal(validators.lesson(legacyLesson), true);
  assert.equal(validators.thematic(legacyThematic), true);
  assert.equal(validators.pack(legacyPack), true);
  for (const lesson of generated.lessons) assert.equal(validators.lesson(lesson), true);
  assert.equal(validators.thematic(generated.thematic), true);
  assert.equal(validators.pack(generated.materialsIndex), true);
});

test('integrated versions require the integration contract', () => {
  const lesson = structuredClone(generated.lessons[0]);
  delete lesson.pedagogical_integration;
  assert.equal(validators.lesson(lesson), false);
  const legacy = structuredClone(generated.lessons[0]);
  legacy.schema_version = '1.1';
  assert.equal(validators.lesson(legacy), false);
});

test('strict integration schemas reject unknown fields and false readiness', () => {
  const extra = structuredClone(generated.lessons[0]);
  extra.pedagogical_integration.unexpected = true;
  assert.equal(validators.lesson(extra), false);
  const ready = structuredClone(generated.thematic);
  ready.pedagogical_integration.status.classroom_ready = true;
  assert.equal(validators.thematic(ready), false);
});

test('pilot remains exact-route ordinary Russian and Estonian evidence', () => {
  for (const lesson of generated.lessons) {
    assert.equal(lesson.canonical_route.source_id, 'grade-5-science');
    for (const source of lesson.evidence_linkage.opiq_records) {
      assert.equal(source.canonical_source_id, 'grade-5-science');
      assert.equal(source.programme_type, 'ordinary');
      assert.ok(['ru', 'et'].includes(source.language));
    }
  }
});

test('four production identities and the unit identity are current', () => {
  const identities = new Map();
  for (const lesson of generated.lessons) {
    const current = computeLessonContentIdentity(lesson);
    assert.deepEqual(current, lesson.pedagogical_integration.content_identity);
    identities.set(lesson.lesson_id, current);
  }
  assert.deepEqual(
    computeUnitContentIdentity(generated.thematic, identities),
    generated.thematic.pedagogical_integration.unit_content_identity,
  );
});

test('lesson 3 keeps compact classroom practical and a distinct home profile', () => {
  const row = rowFor('grade-5-water-03-melting-condensation');
  assert.equal(
    row.lessonDna.phases.find((phase) => phase.phase_id === 'practical-work')
      .target.target_id,
    'learning-stations::practical-compact-teacher-prepared-observation',
  );
  assert.equal(
    row.homeschool.decision.phase_adaptations.find(
      (entry) => entry.source_phase_id === 'practical-work',
    ).adapted_target_id,
    'learning-stations::practical-home-passive-ice-observation',
  );
});

test('generator reports four lessons and sixty-three deterministic files', () => {
  const summary = generationSummary(generated);
  assert.equal(summary.lesson_count, 4);
  assert.equal(summary.generated_file_count, 63);
  assert.deepEqual(summary.guarantees, {
    ai_used: false,
    network_used: false,
    randomness_used: false,
    volatile_timestamps: false,
  });
});

test('generated-region operations preserve manual content and are idempotent', () => {
  const initial = '# Manual\n\nManual paragraph.\n';
  const once = applyGeneratedRegion(initial, 'lesson=test phase=x', 'Generated');
  const twice = applyGeneratedRegion(once, 'lesson=test phase=x', 'Generated');
  assert.equal(once, twice);
  assert.match(once, /Manual paragraph/u);
  assert.equal(removeGeneratedRegion(once, 'lesson=test phase=x'), initial);
});

test('generated-region operations reject broken and duplicate markers', () => {
  assert.throws(
    () => applyGeneratedRegion(
      '<!-- OPIQ-PEDAGOGY:BEGIN lesson=test phase=x -->',
      'lesson=test phase=x',
      'Generated',
    ),
    /broken generated region/u,
  );
  const once = applyGeneratedRegion('', 'lesson=test phase=x', 'Generated');
  assert.throws(
    () => applyGeneratedRegion(`${once}\n${once}`, 'lesson=test phase=x', 'Generated'),
    /duplicate generated region/u,
  );
});

// Timing: 14 focused production and mutation cases.
for (const lessonId of lessonIds) {
  test(`timing: ${lessonId} partitions exactly 45 minutes`, () => {
    const reconciliation = rowFor(lessonId).reconciliation;
    assert.equal(reconciliation.lesson_duration_minutes, 45);
    assert.equal(reconciliation.declared_stage_total_minutes, 45);
    assert.equal(
      reconciliation.dna_total_planned_minutes + reconciliation.non_dna_minutes,
      45,
    );
    assert.ok(reconciliation.stage_partitions.every(
      (stage) => stage.allocated_minutes === stage.duration_minutes,
    ));
  });
}

test('timing: activity-only fit fails when setup allocation is missing', () => {
  assert.throws(mutateTiming(lessonIds[0], (lesson) => {
    lesson.pedagogical_integration.phase_bindings[0].timing_allocations[0]
      .setup_minutes = 0;
  }), /setup_minutes allocation/u);
});

test('timing: cleanup overflow is rejected', () => {
  assert.throws(mutateTiming(lessonIds[2], (lesson) => {
    lesson.pedagogical_integration.phase_bindings
      .find((binding) => binding.dna_phase_id === 'practical-work')
      .timing_allocations[0].cleanup_minutes += 1;
  }), /cleanup_minutes allocation|capacity/u);
});

test('timing: transition overflow is rejected', () => {
  assert.throws(mutateTiming(lessonIds[2], (lesson) => {
    lesson.pedagogical_integration.phase_bindings
      .find((binding) => binding.dna_phase_id === 'evidence-check')
      .timing_allocations[2].transition_minutes += 1;
  }), /transition_minutes allocation|capacity/u);
});

test('timing: stage capacity cannot be exceeded', () => {
  assert.throws(mutateTiming(lessonIds[0], (lesson, dna) => {
    const allocation = lesson.pedagogical_integration.phase_bindings
      .find((binding) => binding.dna_phase_id === 'guided-practice')
      .timing_allocations[0];
    allocation.activity_minutes += 5;
    dna.phases.find((phase) => phase.phase_id === 'guided-practice')
      .activity_minutes += 5;
  }), /capacity/u);
});

test('timing: one stage may serve two phases through explicit allocations', () => {
  const observe = rowFor(lessonIds[0]).reconciliation.stage_partitions
    .find((stage) => stage.lesson_stage_id === 'observe-water');
  assert.deepEqual(
    observe.phase_allocations.map((entry) => entry.phase_id).sort(),
    ['formative-check', 'guided-practice'],
  );
});

test('timing: double counting a stage minute is rejected', () => {
  assert.throws(mutateTiming(lessonIds[0], (lesson, dna) => {
    const allocation = lesson.pedagogical_integration.phase_bindings
      .find((binding) => binding.dna_phase_id === 'formative-check')
      .timing_allocations.find((entry) => entry.lesson_stage_id === 'observe-water');
    allocation.activity_minutes += 2;
    dna.phases.find((phase) => phase.phase_id === 'formative-check')
      .activity_minutes += 2;
  }), /capacity/u);
});

test('timing: reserve sum must match DNA reserve', () => {
  assert.throws(mutateTiming(lessonIds[0], (lesson) => {
    lesson.pedagogical_integration.timing_reconciliation.reserve_allocations[0]
      .minutes += 1;
  }), /reserve allocation|reserve/u);
});

test('timing: non-DNA sum must match DNA unallocated minutes', () => {
  assert.throws(mutateTiming(lessonIds[0], (lesson) => {
    lesson.pedagogical_integration.timing_reconciliation.non_dna_allocations[0]
      .minutes = 0;
  }), /non-DNA|partition/u);
});

test('timing: unknown stage is rejected', () => {
  assert.throws(mutateTiming(lessonIds[0], (lesson) => {
    lesson.pedagogical_integration.phase_bindings[0].lesson_stage_ids = ['unknown'];
    lesson.pedagogical_integration.phase_bindings[0].timing_allocations[0]
      .lesson_stage_id = 'unknown';
  }), /unknown timing stage/u);
});

test('timing: semantic phase and stage mismatch is rejected', () => {
  assert.throws(mutateTiming(lessonIds[0], (lesson) => {
    const binding = lesson.pedagogical_integration.phase_bindings
      .find((entry) => entry.dna_phase_id === 'activation');
    binding.lesson_stage_ids = ['homework-launch'];
    binding.timing_allocations[0].lesson_stage_id = 'homework-launch';
  }), /semantic stage mismatch/u);
});

// Estonian assessment: 9 focused cases.
for (const lessonId of lessonIds) {
  test(`assessment: ${lessonId} requests and preserves Estonian assessment`, () => {
    const lesson = lessonFor(lessonId);
    const row = rowFor(lessonId);
    assert.equal(lessonRequestsEstonianAssessment(lesson), true);
    assert.equal(
      row.selection.request.language_profile.estonian_support.assessment_requested,
      true,
    );
    assert.equal(row.lessonDna.assessment.estonian_language_assessment.enabled, true);
    assert.equal(row.homeschool.package.assessment.estonian_language_assessment, true);
  });
}

for (const domain of [
  'estonian_terminology_recognition',
  'supported_estonian_production',
  'independent_estonian_production',
]) {
  test(`assessment: ${domain} enables the request`, () => {
    const lesson = structuredClone(lessonFor(lessonIds[0]));
    lesson.assessment = [{
      criterion_id: 'language-check',
      domain,
      what_is_checked: 'x',
      acceptable_evidence: 'x',
      success_threshold: 'x',
      affects: 'language_assessment',
    }];
    assert.equal(lessonRequestsEstonianAssessment(lesson), true);
  });
}

test('assessment: every language target phase exists in DNA', () => {
  for (const lessonId of lessonIds) {
    const row = rowFor(lessonId);
    const ids = new Set(row.lessonDna.phases.map((phase) => phase.phase_id));
    assert.ok(
      row.lessonDna.assessment.estonian_language_assessment.target_phase_ids
        .every((phaseId) => ids.has(phaseId)),
    );
  }
});

test('assessment: subject and language evidence remain separate', () => {
  for (const lessonId of lessonIds) {
    const assessment = rowFor(lessonId).lessonDna.assessment;
    assert.equal(
      assessment.separation_policy,
      'separate_subject_and_estonian_language_evidence',
    );
    assert.equal(assessment.subject_assessment.enabled, true);
    assert.equal(assessment.estonian_language_assessment.enabled, true);
  }
});

// Content identity: 11 focused cases.
for (const [name, mutate] of [
  ['teacher-controlled step', (lesson) => lesson.practical_work.teacher_controlled_steps.push('Новый шаг.')],
  ['pupil step', (lesson) => lesson.practical_work.pupil_steps.push('Новый шаг.')],
  ['expected observation', (lesson) => { lesson.practical_work.expected_observation_ru += ' Изменено.'; }],
  ['expected conclusion', (lesson) => { lesson.practical_work.expected_conclusion_ru += ' Изменено.'; }],
  ['safety requirement', (lesson) => lesson.practical_work.safety_requirements.push('Новая мера.')],
]) {
  test(`content identity changes for ${name}`, () => {
    const lesson = structuredClone(lessonFor(lessonIds[2]));
    const before = computeLessonContentIdentity(lesson).value;
    mutate(lesson);
    assert.notEqual(computeLessonContentIdentity(lesson).value, before);
  });
}

test('content identity ignores readiness changes', () => {
  const lesson = structuredClone(lessonFor(lessonIds[0]));
  const before = computeLessonContentIdentity(lesson);
  lesson.artifact_readiness.teacher_review.notes = 'changed';
  assert.deepEqual(computeLessonContentIdentity(lesson), before);
});

test('content identity ignores delivery and timing changes', () => {
  const lesson = structuredClone(lessonFor(lessonIds[0]));
  const before = computeLessonContentIdentity(lesson);
  lesson.pedagogical_integration.selection_input.delivery.group_size = 12;
  lesson.pedagogical_integration.timing_reconciliation.reserve_allocations[0].minutes = 2;
  assert.deepEqual(computeLessonContentIdentity(lesson), before);
});

test('content identity ignores canonical Opiq record ordering', () => {
  const lesson = structuredClone(lessonFor(lessonIds[2]));
  const before = computeLessonContentIdentity(lesson);
  lesson.evidence_linkage.opiq_records.reverse();
  assert.deepEqual(computeLessonContentIdentity(lesson), before);
});

test('unit identity ignores selected source ordering', () => {
  const identities = new Map(generated.lessons.map((lesson) => [
    lesson.lesson_id,
    lesson.pedagogical_integration.content_identity,
  ]));
  const thematic = structuredClone(generated.thematic);
  const before = computeUnitContentIdentity(thematic, identities);
  thematic.selected_opiq_sources.reverse();
  assert.deepEqual(computeUnitContentIdentity(thematic, identities), before);
});

test('procedure step order changes content identity', () => {
  const lesson = structuredClone(lessonFor(lessonIds[2]));
  const before = computeLessonContentIdentity(lesson);
  lesson.practical_work.pupil_steps.reverse();
  assert.notDeepEqual(computeLessonContentIdentity(lesson), before);
});

test('unit digest is stable for semantically equivalent source ordering', () => {
  const identities = new Map(generated.lessons.map((lesson) => [
    lesson.lesson_id,
    lesson.pedagogical_integration.content_identity,
  ]));
  const reversed = structuredClone(generated.thematic);
  reversed.selected_opiq_sources.reverse();
  assert.deepEqual(
    computeUnitContentIdentity(generated.thematic, identities),
    computeUnitContentIdentity(reversed, identities),
  );
});

// Pedagogy materialization: 17 focused cases.
for (const lessonId of lessonIds) {
  test(`materialization: ${lessonId} has one task per selected phase`, () => {
    const row = rowFor(lessonId);
    assert.equal(row.taskBindings.length, row.lessonDna.phases.length);
    assert.deepEqual(
      row.taskBindings.map((task) => task.phase_id).sort(),
      row.lessonDna.phases.map((phase) => phase.phase_id).sort(),
    );
  });

  test(`materialization: ${lessonId} student regions expose task IDs without internals`, () => {
    const row = rowFor(lessonId);
    for (const task of row.taskBindings) {
      const student = task.student_artifact_paths
        .map((artifactPath) => generated.files.get(artifactPath))
        .find((text) => text?.includes(task.task_id));
      assert.ok(student, task.task_id);
      assert.doesNotMatch(student, /taxonomy|selection score|teacher override/iu);
    }
  });

  test(`materialization: ${lessonId} answer-bearing tasks resolve to keys`, () => {
    const row = rowFor(lessonId);
    for (const task of row.taskBindings.filter((entry) => entry.answer_key_artifact_path)) {
      const answer = generated.files.get(task.answer_key_artifact_path);
      assert.match(answer, new RegExp(escaped(task.task_id)));
      assert.equal(task.answer_access_policy, 'after_first_attempt');
    }
  });
}

test('materialization: activation tasks do not receive fictitious keys', () => {
  for (const lessonId of lessonIds) {
    const orientationTasks = rowFor(lessonId).taskBindings.filter(
      (task) => ['activation', 'safety-orientation'].includes(task.phase_id),
    );
    for (const task of orientationTasks) {
      assert.equal(task.evaluation_mode, 'teacher_observation');
      assert.equal(task.answer_key_artifact_path, null);
      assert.equal(task.answer_access_policy, 'not_applicable');
    }
  }
});

test('materialization: concept maps require nodes or connections', () => {
  for (const lessonId of lessonIds) {
    for (const task of rowFor(lessonId).taskBindings.filter(
      (entry) => entry.target_id === 'concept-map',
    )) {
      assert.match(task.learner_instruction_ru, /узл|связ/iu);
    }
  }
});

test('materialization: recall tasks require closed-source recall', () => {
  for (const lessonId of lessonIds) {
    for (const task of rowFor(lessonId).taskBindings.filter(
      (entry) => /recall|retrieval-summary/u.test(entry.target_id),
    )) {
      assert.equal(task.source_access_policy, 'closed_first_attempt');
      assert.match(task.learner_instruction_ru, /закрой.*источник|по памяти/iu);
    }
  }
});

test('materialization: self-tests contain attempt, check, and correction', () => {
  for (const lessonId of lessonIds) {
    for (const task of rowFor(lessonId).taskBindings.filter(
      (entry) => entry.target_id === 'retrieval-self-test',
    )) {
      assert.match(task.learner_instruction_ru, /попыт/iu);
      assert.match(task.learner_instruction_ru, /пров|свер/iu);
      assert.match(task.learner_instruction_ru, /исправ/iu);
    }
  }
});

test('materialization: practical task carries approved procedure and evidence refs', () => {
  const task = rowFor(lessonIds[2]).taskBindings.find(
    (entry) => entry.phase_id === 'practical-work',
  );
  assert.ok(task.prompt_source_refs.some((ref) => ref.includes('pupil_steps')));
  assert.ok(task.evidence_source_refs.some((ref) => ref.includes('expected_observation')));
  assert.ok(task.safety_controls_ru.length > 0);
});

test('materialization: wrong material binding is rejected', () => {
  const lesson = structuredClone(lessonFor(lessonIds[0]));
  lesson.pedagogical_integration.phase_bindings[0].student_material_ids = ['unknown'];
  assert.throws(
    () => taskBindings(lesson, rowFor(lessonIds[0]).lessonDna, generated.materialsIndex),
    /unresolved production material/u,
  );
});

test('materialization: a missing phase binding is rejected', () => {
  const lesson = structuredClone(lessonFor(lessonIds[0]));
  lesson.pedagogical_integration.phase_bindings.pop();
  assert.throws(
    () => taskBindings(lesson, rowFor(lessonIds[0]).lessonDna, generated.materialsIndex),
    /Cannot read properties|unrendered|undefined/u,
  );
});

// Homeschool rendering: 11 focused cases.
for (const lessonId of lessonIds) {
  test(`homeschool: ${lessonId} resolves every material and task ref`, () => {
    const resolution = rowFor(lessonId).homeschoolRenderResolution;
    assert.equal(resolution.content_refs_resolved, true);
    assert.equal(resolution.task_refs_resolved, true);
    assert.equal(resolution.answer_refs_resolved, true);
    for (const step of resolution.steps) {
      assert.ok(step.resolved_materials.length > 0);
      assert.ok(step.resolved_tasks.length > 0);
    }
  });

  test(`homeschool: ${lessonId} child rendering contains paths, actions, and evidence`, () => {
    const lesson = lessonFor(lessonId);
    const row = rowFor(lessonId);
    const markdown = generated.files.get(
      lesson.pedagogical_integration.generated_artifacts.homeschool_rendered_path,
    );
    for (const step of row.homeschoolRenderResolution.steps) {
      for (const material of step.resolved_materials) {
        assert.match(markdown, new RegExp(escaped(material.artifact_path)));
      }
      for (const task of step.resolved_tasks) {
        assert.match(markdown, new RegExp(escaped(task.learner_instruction_ru)));
        assert.match(markdown, new RegExp(escaped(task.expected_evidence_ru.slice(0, 24))));
      }
    }
    assert.doesNotMatch(markdown, /указанный материал/iu);
  });
}

test('homeschool: adapted methods receive materialized target-specific tasks', () => {
  const expected = new Set([
    'true-false-anticipation',
    'venn-diagram',
    'kwl-table',
    'learning-stations::paper-classification',
    'error-correction',
    'exit-ticket',
    'learning-stations::practical-home-passive-ice-observation',
  ]);
  const seen = new Set();
  for (const row of generated.rows.values()) {
    for (const step of row.homeschoolRenderResolution.steps) {
      for (const task of step.resolved_tasks) {
        if (task.task_id.includes('--home-')) seen.add(task.target_id);
      }
    }
  }
  for (const target of expected) assert.ok(seen.has(target), target);
});

test('homeschool: parent guidance preserves roles and answer release', () => {
  for (const lessonId of lessonIds) {
    const lesson = lessonFor(lessonId);
    const row = rowFor(lessonId);
    const parent = generated.files.get(
      `teacher-packs/grade-5-science/water/homeschool/lesson-0${lesson.position_in_unit}-parent-guidance.md`,
    );
    assert.match(parent, /Ответственность ребёнка/u);
    assert.match(parent, /Ответственность учителя/u);
    assert.match(parent, /Ключ/u);
    assert.equal(row.homeschool.package.status.homeschool_ready, false);
  }
});

test('homeschool: unresolved material and content refs fail explicitly', () => {
  assert.throws(
    () => resolveProductionMaterialRef('unknown', generated.materialsIndex),
    /unresolved production material/u,
  );
  assert.throws(
    () => resolveLessonContentRef(lessonFor(lessonIds[0]), 'stage:nope:pupil_action_ru'),
    /unresolved lesson content ref/u,
  );
});

// Home safety: 18 focused cases.
test('home safety: lesson 3 policy passes its strict schema', () => {
  assert.equal(validators.homePolicy(rowFor(lessonIds[2]).homePracticalPolicy), true);
});

test('home safety: policy forbids heating and hot equipment', () => {
  const text = rowFor(lessonIds[2]).homePracticalPolicy.prohibited_actions_ru.join(' ');
  for (const term of ['чайник', 'плит', 'открытый огонь', 'кипят', 'горяч']) {
    assert.match(text, new RegExp(term, 'iu'));
  }
});

test('home safety: policy allows passive ice and cold-surface observation', () => {
  const text = rowFor(lessonIds[2]).homePracticalPolicy.child_steps_ru.join(' ');
  assert.match(text, /пассивное таяние/iu);
  assert.match(text, /холодн.*поверхност/iu);
});

test('home safety: request resources exclude laboratory and measuring tools', () => {
  const resources = rowFor(lessonIds[2]).homeschoolRequest.adaptation_context.resources;
  assert.equal(resources.laboratory_materials_available, false);
  assert.equal(resources.measuring_tools_available, false);
  assert.ok(resources.unavailable.includes('laboratory_materials'));
  assert.ok(resources.unavailable.includes('measuring_tools'));
});

test('home safety: unsafe classroom target is not falsely preserved', () => {
  const adaptation = rowFor(lessonIds[2]).homeschool.decision.phase_adaptations.find(
    (entry) => entry.source_phase_id === 'practical-work',
  );
  assert.equal(adaptation.action, 'reselected');
  assert.equal(adaptation.adapted_target_id, 'learning-stations::practical-home-passive-ice-observation');
});

test('home safety: final homeschool DNA carries policy supervision', () => {
  const row = rowFor(lessonIds[2]);
  const phase = row.homeschool.homeschoolLessonDna.phases.find(
    (entry) => entry.phase_id === 'practical-work',
  );
  assert.equal(phase.safety.requires_adult_supervision, true);
  assert.deepEqual(phase.safety.controls_ru, row.homePracticalPolicy.safety_controls_ru);
});

test('home safety: procedure and safety policy refs resolve', () => {
  const resolution = rowFor(lessonIds[2]).homeschoolRenderResolution;
  assert.equal(resolution.procedure_refs_resolved, true);
  assert.equal(resolution.safety_refs_resolved, true);
  assert.ok(resolution.phase_bindings.some((binding) => binding.procedures.length > 0));
  assert.ok(resolution.phase_bindings.some((binding) => binding.safety.length > 0));
});

test('home safety: child Markdown is generated from policy', () => {
  const policy = rowFor(lessonIds[2]).homePracticalPolicy;
  const markdown = generated.files.get(
    'teacher-packs/grade-5-science/water/homeschool/lesson-03-parent-supported.md',
  );
  for (const control of policy.safety_controls_ru) assert.match(markdown, new RegExp(escaped(control)));
  for (const action of policy.prohibited_actions_ru) assert.match(markdown, new RegExp(escaped(action)));
});

test('home safety: parent Markdown is generated from policy', () => {
  const policy = rowFor(lessonIds[2]).homePracticalPolicy;
  const markdown = generated.files.get(
    'teacher-packs/grade-5-science/water/homeschool/lesson-03-parent-guidance.md',
  );
  for (const step of policy.adult_steps_ru) assert.match(markdown, new RegExp(escaped(step)));
  for (const stop of policy.stop_conditions_ru) assert.match(markdown, new RegExp(escaped(stop)));
});

test('home safety: package safety equals policy safety', () => {
  const row = rowFor(lessonIds[2]);
  assert.deepEqual(
    row.homeschool.package.safety.controls_ru,
    row.homePracticalPolicy.safety_controls_ru,
  );
  assert.deepEqual(
    row.homeschool.package.safety.stop_conditions_ru,
    row.homePracticalPolicy.stop_conditions_ru,
  );
});

test('home safety: teacher authorization and adult supervision are required', () => {
  const policy = rowFor(lessonIds[2]).homePracticalPolicy;
  assert.equal(policy.teacher_authorization_required, true);
  assert.equal(policy.adult_supervision_required, true);
});

test('home safety: parent does not receive subject explanation role', () => {
  const row = rowFor(lessonIds[2]);
  assert.equal(
    row.homeschoolRequest.adaptation_context.adult_context
      .subject_explanation_available,
    false,
  );
  assert.ok(!row.homeschoolRequest.adaptation_context.adult_context
    .allowed_roles.includes('subject_explanation_required'));
});

test('home safety: review and trial status remain pending', () => {
  const policy = rowFor(lessonIds[2]).homePracticalPolicy;
  assert.equal(policy.status.teacher_review, 'pending');
  assert.equal(policy.status.home_trial, 'not_started');
  assert.equal(policy.status.homeschool_ready, false);
});

test('home safety: policy artifact path is explicit only for lesson 3', () => {
  for (const lessonId of lessonIds) {
    const pathValue = lessonFor(lessonId).pedagogical_integration
      .generated_artifacts.home_practical_policy_path;
    if (lessonId === lessonIds[2]) assert.match(pathValue, /lesson-03-home-practical-policy/u);
    else assert.equal(pathValue, null);
  }
});

test('home safety: no position-based lesson heuristic remains in generator', async () => {
  const source = await fs.readFile(
    'scripts/lib/pedagogy-generation-integration.mjs',
    'utf8',
  );
  assert.doesNotMatch(source, /position_in_unit\s*===\s*3|lesson-03.*includes/gu);
});

test('home safety: homework mismatch is machine-readable and documented', () => {
  const relationship = rowFor(lessonIds[2]).homePracticalPolicy.homework_relationship;
  assert.equal(relationship.same_scientific_observation, false);
  assert.equal(relationship.homework_adult_support_expected, false);
  assert.equal(relationship.generated_lesson_adult_supervision_required, true);
});

test('home safety: generated practical task uses policy child steps', () => {
  const row = rowFor(lessonIds[2]);
  const task = row.homeschoolRenderResolution.steps
    .find((step) => step.phase_id === 'practical-work').resolved_tasks[0];
  for (const step of row.homePracticalPolicy.child_steps_ru) {
    assert.match(task.learner_instruction_ru, new RegExp(escaped(step)));
  }
});

test('home safety: safety checks pass and no false readiness is introduced', () => {
  const row = rowFor(lessonIds[2]);
  assert.ok(row.homeschool.decision.safety_checks.every((check) => check.passed));
  assert.equal(row.homeschool.package.status.homeschool_ready, false);
  assert.equal(row.homeschool.package.status.home_trial, 'not_started');
});

// Determinism and scope: 11 focused cases.
test('determinism: repeated generation is byte-identical', async () => {
  const second = await generateWaterPilotArtifacts();
  assert.equal(
    stableIntegrationJson(generationSummary(generated)),
    stableIntegrationJson(generationSummary(second)),
  );
  assert.deepEqual([...generated.files], [...second.files]);
});

test('determinism: committed generated files are current', async () => {
  assert.deepEqual(await checkGeneratedFiles(generated), []);
});

test('determinism: binding order does not change selection request', () => {
  const lesson = structuredClone(lessonFor(lessonIds[0]));
  const before = buildIntegratedSelectionRequest(lesson);
  lesson.pedagogical_integration.phase_bindings.reverse();
  assert.deepEqual(buildIntegratedSelectionRequest(lesson), before);
});

test('determinism: resource-ref order is normalized in production resolution', () => {
  const rows = rowFor(lessonIds[0]).homeschoolRenderResolution.steps;
  for (const step of rows) {
    assert.deepEqual(
      step.resolved_materials.map((material) => material.material_id),
      [...step.resolved_materials.map((material) => material.material_id)]
        .sort((a, b) => Buffer.from(a).compare(Buffer.from(b))),
    );
  }
});

test('scope: water-use-cycle fingerprint stays at the control baseline', async () => {
  const repository = await loadTeacherPackRepository({ rootDir });
  const control = repository.indexes.find(
    (artifact) => artifact.data.pack_id
      === 'grade-5-science-water-use-cycle-teacher-pack',
  );
  const fingerprint = await computeTeacherPackFingerprintFromRepository(repository, control);
  assert.equal(
    fingerprint.value,
    '9db2c9e754ec57cc65b9892ee6230b700188e3be77ea2b328757873787d36a98',
  );
  assert.equal(fingerprint.file_count, 44);
});

test('scope: generator cannot target the source manifest or canonical Opiq outputs', () => {
  for (const file of generated.files.keys()) {
    assert.notEqual(file, 'source-manifest.json');
    assert.doesNotMatch(file, /^project-files\//u);
  }
});

test('scope: no PDF or DOC is introduced', async () => {
  const tracked = spawnSync('git', ['ls-files'], { encoding: 'utf8' }).stdout
    .split('\n').filter(Boolean);
  assert.equal(tracked.some((file) => /\.(?:pdf|docx?)$/iu.test(file)), false);
});

test('scope: generated production artifacts contain no personal data fields', () => {
  for (const [file, content] of generated.files) {
    assert.doesNotMatch(content, /student_name|date_of_birth|personal_code/iu, file);
  }
});

test('scope: review and trial evidence paths are not generated', () => {
  for (const file of generated.files.keys()) {
    assert.doesNotMatch(file, /^pedagogical-reviews\//u);
    assert.doesNotMatch(file, /review-record|trial-record/u);
  }
});

test('CLI: check succeeds and unknown arguments fail with code 2', () => {
  const check = spawnSync(
    process.execPath,
    ['scripts/generate-pedagogy-integrated-water-pilot.mjs', '--check'],
    { encoding: 'utf8' },
  );
  assert.equal(check.status, 0, check.stderr);
  const invalid = spawnSync(
    process.execPath,
    ['scripts/generate-pedagogy-integrated-water-pilot.mjs', '--unknown'],
    { encoding: 'utf8' },
  );
  assert.equal(invalid.status, 2);
});

test('production readiness remains review-pending and not tested', () => {
  for (const lessonId of lessonIds) {
    const row = rowFor(lessonId);
    assert.equal(row.lessonDna.status.teacher_review, 'pending');
    assert.equal(row.lessonDna.status.classroom_trial, 'not_started');
    assert.equal(row.lessonDna.status.classroom_ready, false);
    assert.equal(row.homeschool.package.status.teacher_review, 'pending');
    assert.equal(row.homeschool.package.status.home_trial, 'not_started');
    assert.equal(row.homeschool.package.status.homeschool_ready, false);
  }
});
