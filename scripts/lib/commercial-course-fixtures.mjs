import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  computeCommercialOriginalityFingerprint,
  validateCommercialAnnualCourse,
  validateCommercialLesson,
  validateCommercialThematicPlan,
} from './commercial-course-schema.mjs';
import {
  loadLessonPlanRepository,
  validateLessonPlanRepository,
} from './lesson-plans.mjs';

const fixtureRoot = 'test-fixtures/commercial-course-schema';
const materialRoot = `${fixtureRoot}/materials`;

function artifactByFile(repository, file) {
  const artifact = repository.artifacts.find((entry) => entry.file === file);
  if (!artifact) throw new Error(`fixture base artifact is missing: ${file}`);
  return artifact;
}

function parseCoordinates(url) {
  const match = /\/kit\/(\d+)\/chapter\/(\d+)/u.exec(url);
  if (!match) throw new Error(`fixture companion URL has no kit/chapter coordinates: ${url}`);
  return { kit_id: Number(match[1]), chapter_id: Number(match[2]) };
}

function fixtureMaterials() {
  return [
    {
      material_id: 'commercial-explanation',
      title: 'Самостоятельное авторское объяснение',
      material_type: 'explanation',
      artifact_path: `${materialRoot}/explanation.md`,
      audience: 'student',
      languages: ['ru', 'et'],
      printable: true,
      provenance: {
        category: 'author_created_explanation',
        source_reference: 'commercial fixture independent explanation',
        notes: 'Original fixture wording demonstrates a customer-complete explanation without copied source prose.',
      },
    },
    {
      material_id: 'commercial-worked-example',
      title: 'Авторский разобранный пример',
      material_type: 'worked_example',
      artifact_path: `${materialRoot}/worked-example.md`,
      audience: 'student',
      languages: ['ru'],
      printable: true,
      provenance: {
        category: 'author_created_worked_example',
        source_reference: 'commercial fixture worked example',
        notes: 'Original worked example models observation and conclusion as separate reasoning steps.',
      },
    },
    {
      material_id: 'commercial-task-set',
      title: 'Авторский комплект заданий',
      material_type: 'task_set',
      artifact_path: `${materialRoot}/tasks.md`,
      audience: 'student',
      languages: ['ru', 'et'],
      printable: true,
      answer_key_path: `${materialRoot}/expected-answers.md`,
      provenance: {
        category: 'author_created_task_set',
        source_reference: 'commercial fixture task set',
        notes: 'Original tasks are sufficient for the standalone contract and do not require an Opiq page.',
      },
    },
    {
      material_id: 'commercial-expected-answers',
      title: 'Авторские ожидаемые ответы',
      material_type: 'expected_answers',
      artifact_path: `${materialRoot}/expected-answers.md`,
      audience: 'teacher',
      languages: ['ru'],
      printable: true,
      provenance: {
        category: 'author_created_expected_answers',
        source_reference: 'commercial fixture expected answers',
        notes: 'Teacher-only answer evidence is separate from every customer task artifact.',
      },
    },
    {
      material_id: 'commercial-worked-solution',
      title: 'Авторский разбор решения',
      material_type: 'worked_solution',
      artifact_path: `${materialRoot}/worked-solution.md`,
      audience: 'teacher',
      languages: ['ru'],
      printable: true,
      provenance: {
        category: 'author_created_worked_solution',
        source_reference: 'commercial fixture worked solution',
        notes: 'Teacher-only procedural solution explains the reasoning sequence without reproducing a source answer.',
      },
    },
    {
      material_id: 'commercial-assessment',
      title: 'Авторская проверка результата',
      material_type: 'assessment',
      artifact_path: `${materialRoot}/assessment.md`,
      audience: 'student',
      languages: ['ru', 'et'],
      printable: true,
      answer_key_path: `${materialRoot}/expected-answers.md`,
      provenance: {
        category: 'author_created_assessment',
        source_reference: 'commercial fixture assessment',
        notes: 'Original assessment preserves first-attempt separation and uses a teacher-only answer artifact.',
      },
    },
  ];
}

function familyHooks(lesson) {
  const stageId = lesson.stages[0].stage_id;
  const objectiveId = lesson.objectives.content_objectives[0].objective_id;
  const criterionId = lesson.assessment[0].criterion_id;
  const refs = {
    stage_ids: [stageId],
    material_ids: ['commercial-task-set'],
    objective_ids: [objectiveId],
    assessment_criterion_ids: [criterionId],
  };
  return [
    {
      hook_id: 'foundation-participation-hook',
      hook_role: 'foundation_participation',
      supported_lanes: ['foundation'],
      core_refs: refs,
      shared_product_supported: true,
      individual_evidence_required: false,
      shared_evidence_replaces_individual: false,
      notes: 'Foundation participation is observational and is never reported as Grade 2 or Grade 4 mastery.',
    },
    {
      hook_id: 'grade-2-individual-hook',
      hook_role: 'grade_2_responsibility',
      supported_lanes: ['grade_2'],
      core_refs: refs,
      shared_product_supported: true,
      individual_evidence_required: true,
      shared_evidence_replaces_individual: false,
      notes: 'The Grade 2 lane references the shared core but retains a separate individual evidence requirement.',
    },
    {
      hook_id: 'grade-4-extension-hook',
      hook_role: 'grade_4_extension',
      supported_lanes: ['grade_4'],
      core_refs: refs,
      shared_product_supported: true,
      individual_evidence_required: true,
      shared_evidence_replaces_individual: false,
      notes: 'The Grade 4 extension references stable core IDs and retains a separate individual evidence requirement.',
    },
  ];
}

function companionFrom(record, mode) {
  const coordinates = parseCoordinates(record.canonical_url);
  const customerVisible = mode === 'customer_visible';
  return {
    companion_id: customerVisible ? 'optional-customer-companion' : 'internal-unverified-companion',
    source_record: structuredClone(record),
    ...coordinates,
    companion_role: 'additional_practice',
    access: {
      mode: customerVisible ? 'pupil_license' : 'unverified',
      ...(customerVisible ? { license_type: 'individual-pupil-account' } : {}),
      last_checked_on: customerVisible ? '2026-07-28' : null,
      check_status: customerVisible ? 'login_required' : 'not_checked',
      notes: customerVisible
        ? 'Access requires the learner or family to hold the stated licence; the author task remains complete without it.'
        : 'The link is retained only for internal author analysis until access is verified.',
    },
    publication_visibility: customerVisible ? 'customer_visible' : 'internal_only',
    standalone_fallback: {
      exists: true,
      author_material_ids: ['commercial-task-set'],
      lesson_stage_refs: [],
      notes: 'The author-created task set provides the same instructional role without requiring Opiq access.',
    },
  };
}

function buildLesson(rootDir, baseArtifact, variant) {
  const lesson = structuredClone(baseArtifact.data);
  const sourceRecord = structuredClone(lesson.evidence_linkage.opiq_records[0]);
  lesson.schema_version = '1.3';
  lesson.lesson_id = `commercial-${variant.fixture_id}`;
  lesson.evidence_linkage.opiq_records = [];
  lesson.evidence_linkage.author_materials = fixtureMaterials();
  for (const stage of lesson.stages) stage.material_refs = ['commercial-explanation'];
  const companions = variant.companion_mode === 'none'
    ? []
    : [companionFrom(sourceRecord, variant.companion_mode)];
  const hooks = variant.family_hooks ? familyHooks(lesson) : [];
  lesson.delivery_model = {
    core_mode: 'standalone_commercial_core',
    opiq_required: false,
    opiq_companion_policy: companions.length === 0 ? 'none' : 'optional',
    family_overlay_supported: hooks.length > 0,
    customer_can_complete_without_opiq: true,
    publication_status: 'internal_review',
  };
  lesson.commercial_core = {
    explanation_material_ids: ['commercial-explanation'],
    worked_example_material_ids: ['commercial-worked-example'],
    task_material_ids: ['commercial-task-set'],
    expected_answer_material_ids: ['commercial-expected-answers'],
    worked_solution_material_ids: ['commercial-worked-solution'],
    assessment_material_ids: ['commercial-assessment'],
    assessment_criterion_ids: [lesson.assessment[0].criterion_id],
    learner_output_refs: [lesson.questions[0].question_id],
    success_criteria_refs: [lesson.objectives.subject_success_criteria[0].criterion_id],
    task_contracts: [
      {
        task_material_id: 'commercial-task-set',
        response_mode: 'procedural',
        open_ended: false,
        expected_answer_material_ids: ['commercial-expected-answers'],
        worked_solution_material_ids: ['commercial-worked-solution'],
      },
    ],
  };
  lesson.opiq_companions = companions;
  lesson.family_overlay_hooks = hooks;
  const covered = lesson.evidence_linkage.author_materials.map((entry) => entry.material_id);
  lesson.originality_review = {
    review_id: `originality-${variant.fixture_id}`,
    status: 'approved',
    reviewer: 'fixture-reviewer',
    reviewer_role: 'originality-reviewer',
    reviewed_on: '2026-07-28',
    reviewed_version: {
      commit_sha: '1111111111111111111111111111111111111111',
      content_fingerprint: computeCommercialOriginalityFingerprint(rootDir, lesson, covered),
    },
    covered_author_material_ids: covered,
    internal_source_analysis_refs: [`internal-analysis/${sourceRecord.record_id}`],
    dimensions: {
      wording_independence: 'independent',
      context_independence: 'independent',
      data_independence: 'independent',
      question_sequence_independence: 'independent',
      scaffolding_independence: 'independent',
      distractor_independence: 'not_applicable',
      visual_independence: 'not_applicable',
      answer_independence: 'independent',
    },
    prohibited_source_content: {
      copied_text: false,
      screenshots: false,
      copied_illustrations: false,
      copied_answer_keys: false,
      extracted_interactive_content: false,
    },
    notes: 'Human fixture review records independent authorship dimensions without claiming automated proof of originality.',
  };
  return lesson;
}

function buildThematic(baseArtifact, lessons) {
  const unit = structuredClone(baseArtifact.data);
  unit.schema_version = '1.3';
  unit.lesson_ids = lessons.map((lesson) => lesson.lesson_id);
  unit.lesson_count = lessons.length;
  unit.recommended_lesson_sequence = lessons.map((lesson, index) => ({
    order: index + 1,
    lesson_id: lesson.lesson_id,
    duration_minutes: lesson.duration_minutes,
    focus_ru: `Коммерческий schema fixture ${index + 1} проверяет отдельный delivery contract.`,
  }));
  unit.expected_total_duration_minutes = lessons.reduce((sum, lesson) => sum + lesson.duration_minutes, 0);
  unit.selected_opiq_sources = [];
  unit.delivery_model = {
    core_mode: 'standalone_commercial_core',
    opiq_required: false,
    opiq_companion_policy: 'optional',
    family_overlay_supported: true,
    customer_can_complete_without_opiq: true,
    publication_status: 'internal_review',
  };
  unit.commercial_core_summary = {
    standalone_lesson_ids: lessons.map((lesson) => lesson.lesson_id),
    all_lessons_standalone: true,
  };
  const companions = lessons.flatMap((lesson) => lesson.opiq_companions);
  unit.opiq_companion_summary = {
    companion_ids: companions.map((entry) => entry.companion_id),
    customer_visible_companion_ids: companions
      .filter((entry) => entry.publication_visibility === 'customer_visible')
      .map((entry) => entry.companion_id),
  };
  unit.family_overlay_hook_index = lessons.flatMap((lesson) => lesson.family_overlay_hooks.map((hook) => ({
    hook_id: hook.hook_id,
    lesson_id: lesson.lesson_id,
  })));
  unit.originality_review_summary = {
    approved_lesson_ids: lessons.map((lesson) => lesson.lesson_id),
    all_publication_reviews_current: true,
  };
  return unit;
}

function buildAnnual(baseArtifact, thematic) {
  const course = structuredClone(baseArtifact.data);
  course.schema_version = '2.2';
  for (const unit of course.ordered_units) {
    const linked = unit.thematic_plan_ref === thematic.unit_id;
    unit.full_thematic_plan_exists = linked;
    unit.thematic_plan_ref = linked ? thematic.unit_id : null;
  }
  course.delivery_model = {
    core_mode: 'standalone_commercial_core',
    opiq_required: false,
    opiq_companion_policy: 'optional',
    family_overlay_supported: true,
    customer_can_complete_without_opiq: true,
    publication_status: 'internal_review',
  };
  course.commercial_release_policy = {
    all_required_lessons_standalone: true,
    publication_status: 'internal_review',
    originality_review_required: true,
    does_not_imply_classroom_readiness: true,
  };
  course.opiq_companion_policy = {
    policy: 'optional',
    accepted_access_modes: ['free', 'pupil_license', 'private_user_license'],
    customer_visible_requires_fallback: true,
    teacher_only_internal: true,
    simplified_requires_learner_opt_in: true,
  };
  course.family_overlay_policy = {
    supported: true,
    grade_2_individual_evidence_required: true,
    grade_4_individual_evidence_required: true,
    shared_evidence_replaces_individual: false,
  };
  course.originality_review_policy = {
    publication_requires_approved_current_review: true,
    automated_originality_claimed: false,
  };
  return course;
}

function createSchemaValidators(repository) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  ajv.addSchema(repository.curriculum.schemas.course);
  ajv.addSchema(repository.schemas.common);
  ajv.addSchema(repository.schemas.pedagogyIntegration);
  ajv.addSchema(repository.schemas.topicSynthesis);
  ajv.addSchema(repository.schemas.annual);
  return {
    lesson: ajv.compile(repository.schemas.lesson),
    thematic: ajv.compile(repository.schemas.thematic),
    annual: ajv.getSchema(repository.schemas.annual.$id),
  };
}

export async function loadCommercialCourseFixtures({
  rootDir = process.cwd(),
  manifestPath = `${fixtureRoot}/fixture-manifest.json`,
} = {}) {
  const repository = await loadLessonPlanRepository({ rootDir });
  const absoluteManifest = path.join(rootDir, manifestPath);
  const manifest = JSON.parse(await fs.readFile(absoluteManifest, 'utf8'));
  const ordered = [...manifest.variants].sort(
    (left, right) => Buffer.from(left.fixture_id).compare(Buffer.from(right.fixture_id)),
  );
  const lessons = ordered.map((variant) => buildLesson(
    rootDir,
    artifactByFile(repository, variant.base_lesson_path),
    variant,
  ));
  const thematic = buildThematic(artifactByFile(repository, manifest.thematic_base_path), lessons);
  const annual = buildAnnual(artifactByFile(repository, manifest.annual_base_path), thematic);
  return {
    rootDir,
    manifestPath,
    manifest,
    repository,
    validators: createSchemaValidators(repository),
    lessons,
    thematicPlans: [thematic],
    annualCourses: [annual],
  };
}

function schemaDiagnostics(validator, data, file) {
  if (validator(data)) return [];
  return (validator.errors ?? []).map((error) => ({
    severity: 'error',
    file,
    field: error.instancePath || '/',
    reason: error.keyword === 'required'
      ? `missing required field ${error.params.missingProperty}`
      : error.message,
  }));
}

export function validateCommercialCourseFixtures(fixtures) {
  const diagnostics = [];
  const context = fixtures.repository;
  for (const lesson of fixtures.lessons) {
    const file = `${fixtures.manifestPath}#${lesson.lesson_id}`;
    diagnostics.push(...schemaDiagnostics(fixtures.validators.lesson, lesson, file));
    validateCommercialLesson(diagnostics, { file, data: lesson }, context);
  }
  const lessonMap = new Map(fixtures.lessons.map((lesson) => [
    lesson.lesson_id,
    { file: `${fixtures.manifestPath}#${lesson.lesson_id}`, data: lesson },
  ]));
  for (const thematic of fixtures.thematicPlans) {
    const file = `${fixtures.manifestPath}#${thematic.unit_id}`;
    diagnostics.push(...schemaDiagnostics(fixtures.validators.thematic, thematic, file));
    validateCommercialThematicPlan(diagnostics, { file, data: thematic }, lessonMap, fixtures.rootDir);
  }
  const unitMap = new Map(fixtures.thematicPlans.map((unit) => [
    unit.unit_id,
    { file: `${fixtures.manifestPath}#${unit.unit_id}`, data: unit },
  ]));
  for (const annual of fixtures.annualCourses) {
    const file = `${fixtures.manifestPath}#${annual.course_id}`;
    diagnostics.push(...schemaDiagnostics(fixtures.validators.annual, annual, file));
    validateCommercialAnnualCourse(diagnostics, { file, data: annual }, unitMap);
  }
  const production = validateLessonPlanRepository(fixtures.repository);
  if (
    production.summary.lessons !== 10
    || production.summary.annualCourses !== 1
    || production.summary.annualComponents !== 4
    || production.summary.annualUnits !== 10
    || production.summary.annualSelectedPages !== 36
    || production.summary.pageReferences !== 84
    || production.summary.externalSources !== 0
    || production.summary.warnings !== 15
    || production.summary.errors !== 0
  ) {
    diagnostics.push({
      severity: 'error',
      file: 'lesson-plans',
      field: '/',
      reason: `legacy production baseline changed: ${JSON.stringify(production.summary)}`,
    });
  }
  return {
    diagnostics,
    production,
    summary: {
      lessons: fixtures.lessons.length,
      thematicPlans: fixtures.thematicPlans.length,
      annualCourses: fixtures.annualCourses.length,
      errors: diagnostics.filter((entry) => entry.severity === 'error').length,
    },
  };
}
