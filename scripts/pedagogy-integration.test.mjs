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
  generateWaterPilotArtifacts,
  generationSummary,
  lessonContentProjection,
  stableIntegrationJson,
} from './lib/pedagogy-generation-integration.mjs';
import {
  computeTeacherPackFingerprintFromRepository,
} from './lib/teacher-pack-fingerprints.mjs';
import { loadTeacherPackRepository } from './lib/teacher-packs.mjs';

const rootDir = process.cwd();
let generated;
let validators;

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function readYaml(file) {
  return parse(await fs.readFile(file, 'utf8'));
}

async function createValidators() {
  const [courseMap, common, integration, lesson, thematic, pack] = await Promise.all([
    readJson('schemas/course-map.schema.json'),
    readJson('schemas/teaching-plan-common.schema.json'),
    readJson('schemas/pedagogy-generation-integration.schema.json'),
    readJson('schemas/lesson-plan.schema.json'),
    readJson('schemas/thematic-plan.schema.json'),
    readJson('schemas/teacher-pack.schema.json'),
  ]);
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  ajv.addSchema(courseMap);
  ajv.addSchema(common);
  ajv.addSchema(integration);
  return {
    lesson: ajv.compile(lesson),
    thematic: ajv.compile(thematic),
    pack: ajv.compile(pack),
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

test('integrated versions require the integration contract and legacy forbids it', async () => {
  const lesson = structuredClone(generated.lessons[0]);
  delete lesson.pedagogical_integration;
  assert.equal(validators.lesson(lesson), false);
  const legacy = structuredClone(generated.lessons[0]);
  legacy.schema_version = '1.1';
  assert.equal(validators.lesson(legacy), false);
  const thematic = structuredClone(generated.thematic);
  delete thematic.pedagogical_integration;
  assert.equal(validators.thematic(thematic), false);
  const pack = structuredClone(generated.materialsIndex);
  delete pack.pedagogical_integration;
  assert.equal(validators.pack(pack), false);
});

test('schemas reject unknown integration fields and false readiness', () => {
  const extra = structuredClone(generated.lessons[0]);
  extra.pedagogical_integration.unexpected = true;
  assert.equal(validators.lesson(extra), false);
  const falseReady = structuredClone(generated.lessons[0]);
  falseReady.pedagogical_integration.status.classroom_ready = true;
  assert.equal(validators.lesson(falseReady), false);
  const falseReviewed = structuredClone(generated.thematic);
  falseReviewed.pedagogical_integration.status.teacher_review = 'approved';
  assert.equal(validators.thematic(falseReviewed), false);
});

test('all pilot lessons stay on the exact canonical route and ordinary ru/et evidence', () => {
  for (const lesson of generated.lessons) {
    assert.equal(lesson.canonical_route.source_id, 'grade-5-science');
    assert.equal(
      lesson.canonical_route.md_path,
      'project-files/outputs/opiq_5klass_loodusopetus.md',
    );
    assert.deepEqual(
      [...new Set(lesson.evidence_linkage.opiq_records.map((row) => row.language))].sort(),
      [...new Set(lesson.evidence_linkage.opiq_records.map((row) => row.language))].sort()
        .filter((language) => ['et', 'ru'].includes(language)),
    );
    assert.ok(lesson.evidence_linkage.opiq_records.every(
      (row) => row.canonical_source_id === 'grade-5-science',
    ));
    assert.ok(lesson.evidence_linkage.opiq_records.every(
      (row) => row.programme_type === 'ordinary',
    ));
  }
});

test('content identities are stable, unique, and shared by classroom and homeschool indexes', () => {
  const values = [];
  for (const lesson of generated.lessons) {
    const first = computeLessonContentIdentity(lesson);
    const second = computeLessonContentIdentity(structuredClone(lesson));
    assert.deepEqual(first, second);
    assert.equal(first.value, lesson.pedagogical_integration.content_identity.value);
    values.push(first.value);
    const row = generated.rows.get(lesson.lesson_id);
    assert.equal(row.homeschool.package.source_identity.source_lesson_dna_digest.length, 64);
  }
  assert.equal(new Set(values).size, 4);
  assert.equal(
    generated.unitIdentity.value,
    generated.thematic.pedagogical_integration.unit_content_identity.value,
  );
});

test('content identity changes for scientific evidence and ignores readiness/delivery timing', () => {
  const original = generated.lessons[2];
  const sourceChanged = structuredClone(original);
  sourceChanged.evidence_linkage.opiq_records[0].canonical_url =
    'https://www.opiq.ee/kit/17/chapter/999999';
  assert.notEqual(
    computeLessonContentIdentity(sourceChanged).value,
    computeLessonContentIdentity(original).value,
  );
  const answerChanged = structuredClone(original);
  answerChanged.questions[0].full_expected_answer_ru += ' Изменено.';
  assert.notEqual(
    computeLessonContentIdentity(answerChanged).value,
    computeLessonContentIdentity(original).value,
  );
  const safetyChanged = structuredClone(original);
  safetyChanged.practical_work.safety_requirements.push('Новый контроль.');
  assert.notEqual(
    computeLessonContentIdentity(safetyChanged).value,
    computeLessonContentIdentity(original).value,
  );
  const readinessChanged = structuredClone(original);
  readinessChanged.artifact_readiness.teacher_review.notes = 'Иная readiness note.';
  readinessChanged.stages[0].duration_minutes += 1;
  readinessChanged.stages[1].duration_minutes -= 1;
  assert.equal(
    computeLessonContentIdentity(readinessChanged).value,
    computeLessonContentIdentity(original).value,
  );
});

test('set ordering does not change the lesson content digest', () => {
  const original = generated.lessons[0];
  const reordered = structuredClone(original);
  reordered.evidence_linkage.opiq_records[0].instructional_roles.reverse();
  reordered.questions[0].acceptable_variants.reverse();
  assert.equal(
    computeLessonContentIdentity(reordered).value,
    computeLessonContentIdentity(original).value,
  );
  assert.deepEqual(
    lessonContentProjection(reordered).lesson_id,
    original.lesson_id,
  );
});

test('four selection requests and lesson DNAs use expected patterns and current versions', () => {
  const expected = new Map([
    ['grade-5-water-01-properties', 'concept-introduction-classroom'],
    ['grade-5-water-02-states', 'concept-introduction-classroom'],
    ['grade-5-water-03-melting-condensation', 'safe-practical-investigation'],
    ['grade-5-water-04-changes-review', 'retrieval-and-consolidation'],
  ]);
  for (const lesson of generated.lessons) {
    const row = generated.rows.get(lesson.lesson_id);
    assert.equal(row.selection.decision.status, 'success');
    assert.equal(row.lessonDna.pattern.pattern_id, expected.get(lesson.lesson_id));
    assert.equal(row.lessonDna.versions.engine, '1.1');
    assert.equal(row.lessonDna.versions.selection_rules, '1.0');
    assert.equal(row.lessonDna.versions.taxonomy, '1.0');
    assert.equal(row.lessonDna.status.teacher_review, 'pending');
  }
});

test('lesson 3 retains the exact safe compact observation overrides', () => {
  const row = generated.rows.get('grade-5-water-03-melting-condensation');
  assert.ok(row.lessonDna.phases.some((phase) => (
    phase.target.target_id
      === 'learning-stations::practical-compact-teacher-prepared-observation'
  )));
  assert.equal(row.lessonDna.teacher_overrides.length, 2);
  assert.ok(row.lessonDna.teacher_overrides.every((override) => override.status === 'accepted'));
  assert.ok(row.lessonDna.phases.find(
    (phase) => phase.phase_id === 'practical-work',
  ).safety.requires_adult_supervision);
});

test('timing reconciliation covers four 45-minute lessons without hidden overflow', () => {
  for (const lesson of generated.lessons) {
    const row = generated.rows.get(lesson.lesson_id);
    assert.equal(row.reconciliation.lesson_duration_minutes, 45);
    assert.equal(row.reconciliation.declared_stage_total_minutes, 45);
    assert.equal(row.reconciliation.status, 'reconciled');
    assert.ok(row.lessonDna.timing.total_planned_minutes <= 45);
    assert.equal(row.lessonDna.timing.reserve_minutes, 3);
    assert.ok(row.reconciliation.phases.every((phase) => (
      phase.linked_stage_minutes >= phase.activity_minutes
    )));
  }
});

test('every consuming DNA phase and every stage has an explicit role', () => {
  for (const lesson of generated.lessons) {
    const row = generated.rows.get(lesson.lesson_id);
    assert.equal(
      row.reconciliation.phases.length,
      row.lessonDna.phases.length,
    );
    const covered = new Set(row.reconciliation.phases.flatMap((phase) => phase.lesson_stage_ids));
    for (const nonDna of row.reconciliation.non_dna_stage_roles) {
      assert.ok(!covered.has(nonDna.lesson_stage_id));
      covered.add(nonDna.lesson_stage_id);
    }
    assert.deepEqual(
      [...covered].sort(),
      lesson.stages.map((stage) => stage.stage_id).sort(),
    );
  }
});

test('generated output is byte-identical and current', async () => {
  const second = await generateWaterPilotArtifacts();
  assert.equal(
    stableIntegrationJson(generationSummary(generated)),
    stableIntegrationJson(generationSummary(second)),
  );
  assert.deepEqual([...generated.files], [...second.files]);
  assert.deepEqual(await checkGeneratedFiles(generated), []);
});

test('generated-region writer is idempotent and rejects broken or duplicate markers', () => {
  const initial = '# Manual\n';
  const once = applyGeneratedRegion(initial, 'lesson=test audience=teacher', 'Generated');
  const twice = applyGeneratedRegion(once, 'lesson=test audience=teacher', 'Generated');
  assert.equal(once, twice);
  assert.ok(twice.startsWith('# Manual\n'));
  assert.throws(
    () => applyGeneratedRegion(
      '<!-- OPIQ-PEDAGOGY:BEGIN lesson=test audience=teacher -->',
      'lesson=test audience=teacher',
      'Generated',
    ),
    /broken generated region/u,
  );
  const duplicate = `${once}\n${once}`;
  assert.throws(
    () => applyGeneratedRegion(duplicate, 'lesson=test audience=teacher', 'Generated'),
    /duplicate generated region/u,
  );
});

test('teacher, student, and answer-key renderings preserve audience boundaries', () => {
  for (const lesson of generated.lessons) {
    const number = String(lesson.position_in_unit).padStart(2, '0');
    const teacher = generated.files.get(
      `teacher-packs/grade-5-science/water/lessons/lesson-${number}.md`,
    );
    const studentPath = lesson.evidence_linkage.author_materials
      .find((material) => material.audience === 'student').artifact_path;
    const student = generated.files.get(studentPath);
    const answer = generated.files.get(
      `teacher-packs/grade-5-science/water/answers/lesson-${number}-answer-key.md`,
    );
    assert.match(teacher, /Сгенерированная педагогическая структура/u);
    assert.match(teacher, new RegExp(generated.rows.get(lesson.lesson_id).lessonDna.pattern.pattern_id));
    assert.doesNotMatch(student, /taxonomy|selection score|teacher override/iu);
    assert.match(student, /Самостоятельная попытка/u);
    const row = generated.rows.get(lesson.lesson_id);
    assert.equal(row.taskBindings.length, row.lessonDna.phases.length);
    for (const binding of row.taskBindings) {
      assert.equal(binding.lesson_id, lesson.lesson_id);
      assert.equal(binding.answer_access_policy, 'after_first_attempt');
      assert.match(answer, new RegExp(
        binding.task_id.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'),
      ));
      assert.match(answer, new RegExp(
        binding.student_artifact_path.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'),
      ));
      assert.match(answer, new RegExp(
        binding.answer_key_artifact_path.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'),
      ));
    }
    assert.match(answer, /Предметное понимание оценивается/u);
  }
});

test('oral-answer preparation covers exactly four existing question records', () => {
  const student = generated.files.get(
    'teacher-packs/grade-5-science/water/student/water-oral-answer-preparation.md',
  );
  const teacher = generated.files.get(
    'teacher-packs/grade-5-science/water/answers/water-oral-answer-guidance.md',
  );
  for (const lesson of generated.lessons) {
    const question = lesson.questions[0];
    assert.match(student, new RegExp(question.question_ru.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
    assert.match(teacher, new RegExp(
      question.full_expected_answer_ru.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'),
    ));
    assert.match(teacher, new RegExp(
      question.short_oral_answer_et.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'),
    ));
  }
  assert.match(student, /Сначала отвечай без ключа/u);
});

test('homeschool packages reproduce source identity and preserve readiness boundaries', () => {
  for (const lesson of generated.lessons) {
    const row = generated.rows.get(lesson.lesson_id);
    const homeschoolInput = lesson.pedagogical_integration.selection_input.homeschool;
    assert.equal(row.homeschoolRequest.adaptation_context.variant, homeschoolInput.variant);
    assert.equal(
      row.homeschoolRequest.adaptation_context.maximum_total_productive_language_demand,
      homeschoolInput.maximum_total_productive_language_demand,
    );
    assert.deepEqual(
      row.homeschoolRequest.adaptation_context.adult_context,
      homeschoolInput.adult_context,
    );
    assert.equal(
      row.homeschool.decision.source_identity.source_lesson_dna_digest,
      row.homeschool.package.source_identity.source_lesson_dna_digest,
    );
    assert.equal(row.homeschool.package.status.teacher_review, 'pending');
    assert.equal(row.homeschool.package.status.home_trial, 'not_started');
    assert.equal(row.homeschool.package.status.homeschool_ready, false);
    assert.equal(row.homeschool.package.status.effectiveness_claimed, false);
    assert.equal(row.homeschool.parentGuidance.status.homeschool_ready, false);
    assert.equal(
      row.homeschool.parentGuidance.responsibility_boundary
        .subject_teacher_responsibility_ru.length > 0,
      true,
    );
  }
});

test('lesson 3 homeschool variant preserves passive-observation safety', () => {
  const row = generated.rows.get('grade-5-water-03-melting-condensation');
  assert.equal(row.homeschool.package.context.variant, 'parent_child');
  assert.equal(row.homeschool.parentGuidance.safety.adult_supervision_required, true);
  assert.equal(row.homeschool.parentGuidance.safety.teacher_authorization_required, true);
  assert.ok(row.homeschool.decision.safety_checks.every((check) => check.passed === true));
  const rendered = generated.files.get(
    'teacher-packs/grade-5-science/water/homeschool/lesson-03-parent-supported.md',
  );
  assert.match(rendered, /пассивное таяние льда/u);
  assert.match(rendered, /Нельзя использовать чайник, плиту, открытый огонь/u);
});

test('answer access and assessment separation remain explicit', () => {
  for (const lesson of generated.lessons) {
    const row = generated.rows.get(lesson.lesson_id);
    assert.equal(
      row.homeschool.package.assessment.separation_policy,
      'separate_subject_and_estonian_language_evidence',
    );
    assert.equal(row.homeschool.parentGuidance.answer_access.first_attempt_without_answer, true);
    assert.equal(row.homeschool.parentGuidance.answer_access.correction_method, 'separate_colour');
    assert.ok(row.homeschool.decision.answer_binding_decisions.length > 0);
  }
});

test('delayed retrieval is relative, forward, and includes an honest next-unit link', () => {
  const links = generated.thematic.pedagogical_integration.delayed_retrieval_links;
  assert.equal(links.length, 4);
  assert.ok(links.slice(0, 3).every((link) => link.relative_window.after_lessons === 1));
  assert.equal(links[3].relative_window.next_unit, true);
  assert.equal(links[3].target_lesson_id, 'next_unit');
  assert.ok(links.every((link) => !('date' in link.relative_window)));
});

test('reviewable fingerprint scope includes integration and homeschool, excluding evidence/index', async () => {
  const repository = await loadTeacherPackRepository({ rootDir });
  const water = repository.indexes.find(
    (artifact) => artifact.data.pack_id === 'grade-5-science-water-teacher-pack',
  );
  const result = await computeTeacherPackFingerprintFromRepository(repository, water);
  assert.ok(result.files.some((file) => file.includes('/pedagogy/classroom/')));
  assert.ok(result.files.some((file) => file.includes('/pedagogy/homeschool/')));
  assert.ok(result.files.some((file) => file.includes('/homeschool/lesson-01-')));
  assert.ok(!result.files.includes('teacher-packs/grade-5-science/water/materials-index.yaml'));
  assert.ok(!result.files.some((file) => file.startsWith('pedagogical-reviews/')));
  assert.equal(result.value.length, 64);
});

test('water-use-cycle control fingerprint remains at the pre-migration baseline', async () => {
  const repository = await loadTeacherPackRepository({ rootDir });
  const control = repository.indexes.find(
    (artifact) => artifact.data.pack_id === 'grade-5-science-water-use-cycle-teacher-pack',
  );
  const result = await computeTeacherPackFingerprintFromRepository(repository, control);
  assert.equal(
    result.value,
    '9db2c9e754ec57cc65b9892ee6230b700188e3be77ea2b328757873787d36a98',
  );
  assert.equal(result.file_count, 44);
});

test('CLI contracts: check succeeds, unknown argument exits 2, and no volatile source is used', async () => {
  const check = spawnSync(
    process.execPath,
    ['scripts/generate-pedagogy-integrated-water-pilot.mjs', '--check'],
    { cwd: rootDir, encoding: 'utf8' },
  );
  assert.equal(check.status, 0, check.stderr);
  const unknown = spawnSync(
    process.execPath,
    ['scripts/generate-pedagogy-integrated-water-pilot.mjs', '--unknown'],
    { cwd: rootDir, encoding: 'utf8' },
  );
  assert.equal(unknown.status, 2);
  const debugArgs = [
    'scripts/generate-pedagogy-integrated-water-pilot.mjs',
    '--lesson',
    'grade-5-water-01-properties',
    '--debug',
  ];
  const debugFirst = spawnSync(process.execPath, debugArgs, {
    cwd: rootDir,
    encoding: 'utf8',
  });
  const debugSecond = spawnSync(process.execPath, debugArgs, {
    cwd: rootDir,
    encoding: 'utf8',
  });
  assert.equal(debugFirst.status, 0, debugFirst.stderr);
  assert.equal(debugFirst.stdout, debugSecond.stdout);
  assert.match(debugFirst.stdout, /"task_bindings"/u);
  const source = await fs.readFile(
    'scripts/lib/pedagogy-generation-integration.mjs',
    'utf8',
  );
  assert.doesNotMatch(source, /fetch\s*\(|Math\.random|Date\.now|new Date\s*\(/u);
});

test('production pilot contains no PDF/DOC, symlink, or personal-data storage artifact', async () => {
  const queue = ['teacher-packs/grade-5-science/water/pedagogy', 'teacher-packs/grade-5-science/water/homeschool'];
  while (queue.length) {
    const directory = queue.pop();
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const file = `${directory}/${entry.name}`;
      const stat = await fs.lstat(file);
      assert.equal(stat.isSymbolicLink(), false);
      if (stat.isDirectory()) queue.push(file);
      else assert.doesNotMatch(file, /\.(?:pdf|docx?)$/iu);
    }
  }
  for (const content of generated.files.values()) {
    assert.doesNotMatch(content, /date_of_birth|student_name|parent_email/iu);
  }
});

test('selection request builder is deterministic and keeps Russian-primary A1-A2 policy', () => {
  for (const lesson of generated.lessons) {
    const first = buildIntegratedSelectionRequest(lesson);
    const second = buildIntegratedSelectionRequest(structuredClone(lesson));
    assert.deepEqual(first, second);
    assert.equal(first.language_profile.primary_instruction_language, 'ru');
    assert.equal(
      first.language_profile.maximum_total_productive_language_demand,
      lesson.pedagogical_integration.selection_input
        .maximum_total_productive_language_demand,
    );
    assert.equal(first.language_profile.estonian_support.language, 'et');
    assert.equal(first.language_profile.estonian_support.learner_level, 'A1-A2');
    assert.equal(first.language_profile.estonian_support.subject_explanation_language, 'ru');
  }
});
