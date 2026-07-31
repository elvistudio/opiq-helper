#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { computeLessonContentIdentity } from './lib/pedagogy-generation-integration.mjs';

const moduleId = 'grade-2-weather-water-safety-pilot';
const projectId = 'grade-2-project-weather-water-safety';
const packRoot = 'teacher-packs/grade-2/weather-water-safety';
const outputPaths = {
  lesson1: 'lesson-plans/grade-2/weather-water-safety/lesson-01-weather-observation.yaml',
  lesson2: 'lesson-plans/grade-2/weather-water-safety/lesson-02-weather-data-time.yaml',
  materialsIndex: `${packRoot}/materials-index.yaml`,
};

const approaches = [
  'content_language_dual_objectives',
  'planned_translanguaging',
  'gradual_scaffolding',
  'pluriliteracies',
  'multimodal_support',
  'vocabulary_recycling',
  'cognitive_load_control',
  'separate_content_language_assessment',
];

function provenance(category, sourceReference, notes) {
  return {
    category,
    source_reference: sourceReference,
    notes,
  };
}

function material({
  id,
  title,
  type,
  artifactPath,
  audience,
  languages = ['ru'],
  printable = true,
  category,
  sourceReference,
  notes,
  answerKeyPath,
  openEnded = false,
}) {
  return {
    material_id: id,
    title,
    material_type: type,
    artifact_path: artifactPath,
    audience,
    languages,
    printable,
    ...(answerKeyPath ? { answer_key_path: answerKeyPath } : {}),
    ...(openEnded ? {
      answer_key_exemption: {
        open_ended: true,
        reason: 'The learner records current observed evidence, so no single fixed answer is valid.',
      },
    } : {}),
    provenance: provenance(category, sourceReference, notes),
  };
}

function pendingOriginality(lessonId, materials, internalRefs) {
  return {
    review_id: `${lessonId}-originality-review`,
    status: 'pending',
    reviewer: null,
    reviewer_role: null,
    reviewed_on: null,
    reviewed_version: {
      commit_sha: null,
      content_fingerprint: {
        algorithm: 'sha256',
        specification_version: '1.0',
        value: null,
        file_count: null,
      },
    },
    covered_author_material_ids: materials.map((entry) => entry.material_id),
    internal_source_analysis_refs: internalRefs,
    dimensions: {
      wording_independence: 'pending',
      context_independence: 'pending',
      data_independence: 'pending',
      question_sequence_independence: 'pending',
      scaffolding_independence: 'pending',
      distractor_independence: 'not_applicable',
      visual_independence: 'not_applicable',
      answer_independence: 'pending',
    },
    prohibited_source_content: {
      copied_text: false,
      screenshots: false,
      copied_illustrations: false,
      copied_answer_keys: false,
      extracted_interactive_content: false,
    },
    notes: 'Lesson-level human originality review has not yet been performed; task-level approvals remain separate evidence.',
  };
}

function integrationFor(lesson, {
  purpose,
  contentTypes,
  requiredCapabilities,
  contextFlags,
  guideMaterialId,
  primaryStudentMaterialId,
}) {
  const scopes = lesson.evidence_linkage.author_materials
    .filter((entry) => entry.audience === 'student')
    .map((entry) => ({
      material_id: entry.material_id,
      delivery_scope: ['classroom'],
    }));
  const subjectCriterion = lesson.assessment.find((entry) => entry.affects === 'subject_assessment');
  const languageCriterion = lesson.assessment.find((entry) => entry.affects === 'language_assessment');
  const oralAnswer = lesson.questions[0].question_id;
  const phaseBindings = lesson.stages.map((stage) => ({
    dna_phase_id: stage.stage_id,
    lesson_stage_ids: [stage.stage_id],
    timing_allocations: [{
      lesson_stage_id: stage.stage_id,
      activity_minutes: stage.duration_minutes,
      setup_minutes: 0,
      cleanup_minutes: 0,
      transition_minutes: 0,
      compatibility_basis: 'standard',
    }],
    teacher_material_ids: [guideMaterialId],
    student_material_ids: stage.material_refs.filter((id) => (
      lesson.evidence_linkage.author_materials.find((entry) => entry.material_id === id)?.audience === 'student'
    )),
    answer_key_material_ids: [],
    assessment_refs: stage.stage_type === 'assessment'
      ? [subjectCriterion.criterion_id, languageCriterion.criterion_id]
      : [],
    oral_answer_refs: [oralAnswer],
    source_access_policy: stage.stage_type === 'assessment' ? 'closed_first_attempt' : 'open',
    render_contract: {
      execution_mode: stage.stage_type === 'practical_observation'
        ? 'practical_task'
        : stage.stage_type === 'assessment'
          ? 'assessment_task'
          : stage.stage_type === 'independent_output'
            ? 'learner_task'
            : 'teacher_led',
      task_id: `${lesson.lesson_id}/${stage.stage_id}`,
      learner_instruction_ru: stage.pupil_action_ru,
      prompt_source_refs: [`stage:${stage.stage_id}:pupil_action_ru`],
      learner_success_criterion_ru: [stage.expected_evidence_of_learning],
      learner_language_support_ru: stage.expected_pupil_language.et,
      answer_evidence_refs: [`stage:${stage.stage_id}:expected_evidence_of_learning`],
      teacher_action_source_refs: [`stage:${stage.stage_id}:teacher_action_ru`],
      answer_language_refs: [`question:${oralAnswer}:short_oral_answer_et`],
      acceptable_variant_refs: [`question:${oralAnswer}:acceptable_variants`],
      misconception_refs: [`question:${oralAnswer}:misconception_to_watch`],
      evaluation_mode: stage.stage_type === 'assessment'
        ? 'evidence_criterion'
        : 'teacher_observation',
      answer_access_policy: stage.stage_type === 'assessment'
        ? 'after_first_attempt'
        : 'not_applicable',
    },
    binding_rationale_ru: `Этап ${stage.stage_id} полностью связан с авторскими материалами и длительностью этого урока.`,
  }));
  const plannedRoot = `${packRoot}/planned/pedagogy/${lesson.lesson_id}`;
  return {
    integration_version: '1.0',
    migration_state: 'integrated',
    content_identity: computeLessonContentIdentity(lesson),
    selection_input: {
      purpose,
      content_types: contentTypes,
      required_capabilities: requiredCapabilities,
      desired_capabilities: ['formative_assessment', 'retrieval'],
      phase_needs: ['activation', 'explanation', 'guided_practice', 'formative_assessment'],
      context_flags: contextFlags,
      maximum_total_productive_language_demand: 'low',
      delivery: {
        group_size: 24,
        supported_group_formats: ['individual', 'pair', 'whole_class'],
      },
      resources: {
        available: ['paper', 'writing_tool', 'clock', 'window_view'],
        unavailable: ['internet', 'laboratory_materials'],
        printer_available: true,
        internet_available: false,
        projector_available: false,
        laboratory_materials_available: false,
        measuring_tools_available: false,
        outdoor_access_available: contextFlags.practical,
        adult_safety_supervision_available: true,
      },
      constraints: {
        max_teacher_preparation: 'low',
        max_teacher_facilitation: 'medium',
        max_learner_setup: 'minimal',
        max_parent_effort: 'none',
        accessibility_priorities: ['working_memory_support', 'language_scaffolding'],
        retrieval_first_attempt_without_source: true,
      },
      preferences: {
        required_pattern_id: 'guided-individual-evidence',
        preferred_target_ids: ['individual-record', 'short-oral-report'],
        excluded_target_ids: [],
        preferred_group_formats: ['individual', 'pair', 'whole_class'],
        teacher_overrides: [],
      },
      homeschool: {
        variant: 'independent',
        learner_count: 1,
        learner_session_minutes: 45,
        maximum_sessions: 1,
        maximum_total_productive_language_demand: 'low',
        resources: {
          available: ['paper', 'writing_tool'],
          unavailable: ['internet', 'laboratory_materials', 'measuring_tools'],
          printer_available: false,
          internet_available: false,
          projector_available: false,
          laboratory_materials_available: false,
          measuring_tools_available: false,
          outdoor_access_available: false,
          adult_safety_supervision_available: false,
        },
        material_delivery_scopes: scopes,
        adult_context: {
          available: false,
          max_support_minutes: 0,
          max_effort: 'none',
          allowed_roles: [],
          safety_supervision_available: false,
          subject_explanation_available: false,
        },
        answer_key_release: 'self_managed_after_attempt',
        teacher_override_policy: 'require_preservation',
        adapted_task_contracts: [],
        practical_policy: null,
      },
      future_retrieval_windows: [],
    },
    assessment_integration: {
      subject_assessment: {
        enabled: true,
        target_phase_ids: [lesson.stages.at(-1).stage_id],
        criterion_refs: lesson.assessment
          .filter((entry) => entry.affects === 'subject_assessment')
          .map((entry) => entry.criterion_id),
      },
      estonian_language_assessment: {
        enabled: true,
        target_phase_ids: [lesson.stages.at(-1).stage_id],
        criterion_refs: lesson.assessment
          .filter((entry) => entry.affects === 'language_assessment')
          .map((entry) => entry.criterion_id),
      },
      separation_policy: 'separate_subject_and_estonian_language_evidence',
      provenance: { source: 'lesson_assessment_bindings' },
    },
    phase_bindings: phaseBindings,
    timing_reconciliation: {
      compatibility_rules_version: '1.0',
      reserve_allocations: [],
      non_dna_allocations: [],
    },
    generated_artifacts: {
      selection_request_path: `${plannedRoot}/selection-request.yaml`,
      selection_decision_path: `${plannedRoot}/selection-decision.yaml`,
      lesson_dna_path: `${plannedRoot}/lesson-dna.yaml`,
      homeschool_request_path: `${plannedRoot}/homeschool-request.yaml`,
      homeschool_decision_path: `${plannedRoot}/homeschool-decision.yaml`,
      homeschool_package_path: `${plannedRoot}/homeschool-package.yaml`,
      parent_guidance_path: `${packRoot}/parent/materials-time-guide.md`,
      weekly_study_plan_path: `${plannedRoot}/weekly-study-plan.md`,
      homeschool_rendered_path: `${plannedRoot}/homeschool-rendered.md`,
      home_practical_policy_path: null,
    },
    status: {
      structural_state: 'proposed',
      teacher_review: 'pending',
      classroom_trial: 'not_tested',
      classroom_ready: false,
      homeschool_ready: false,
      effectiveness_claimed: false,
    },
  };
}

function stage({
  id,
  minutes,
  type,
  contentPurpose,
  languagePurpose,
  teacherAction,
  pupilAction,
  materials,
  scaffolds = [],
  newLanguage = [],
  ru = [],
  et = [],
  prompt,
  subjectEvidence,
  languageEvidence,
  expectedEvidence,
  transition,
}) {
  return {
    stage_id: id,
    duration_minutes: minutes,
    stage_type: type,
    content_purpose_ru: contentPurpose,
    language_purpose_et: languagePurpose,
    teacher_action_ru: teacherAction,
    pupil_action_ru: pupilAction,
    teacher_language: ['ru', 'et'],
    expected_pupil_language: { ru, et },
    material_refs: materials,
    provenance_refs: materials,
    scaffold_refs: scaffolds,
    new_language_items: newLanguage,
    formative_check: {
      prompt_ru: prompt,
      subject_evidence: subjectEvidence,
      language_evidence: languageEvidence,
    },
    expected_evidence_of_learning: expectedEvidence,
    transition,
  };
}

function commonLesson({
  lessonId,
  position,
  subject,
  subjectEt,
  titleRu,
  titleEt,
  route,
  profile,
  level,
  officialMapId,
  outcomeId,
  materials,
  stages,
  objectives,
  languageLoad,
  cognitiveLoad,
  scaffolds,
  multimodalSupport,
  questions,
  practicalWork,
  assessment,
  homework,
  commercialCore,
  originalityRefs,
  integrationOptions,
}) {
  const lesson = {
    schema_version: '1.3',
    artifact_type: 'bilingual_lesson',
    lesson_id: lessonId,
    grade: 2,
    subject,
    subject_et: subjectEt,
    title_ru: titleRu,
    title_et: titleEt,
    duration_minutes: 45,
    duration_tolerance: {
      minutes: 0,
      reason: 'Все этапы должны точно составлять заявленные сорок пять минут.',
    },
    unit_ref: moduleId,
    position_in_unit: position,
    canonical_route: route,
    instruction_language: 'ru',
    subject_support_language: 'et',
    learner_language_profile: {
      profile_id: profile,
      learner_language_level: level,
      uses_default: true,
      overrides: [],
    },
    evidence_linkage: {
      curriculum_map_id: officialMapId,
      official_outcome_refs: [outcomeId],
      course_map_ref: projectId,
      opiq_records: [],
      author_materials: materials,
    },
    methodology: {
      model: 'russian_primary_estonian_supported',
      approaches,
      content_priority: 'subject_comprehension_not_reduced_by_language_support',
      language_path: stages.map((entry, index) => ({
        sequence: index + 1,
        stage_id: entry.stage_id,
        language_mode: [
          'activate_prior_knowledge',
          'establish_concept_ru',
          'introduce_term_et',
          'supported_task_et',
          'short_oral_answer_et',
        ][index],
        description: [
          'Ученик активирует знакомое содержание на русском языке.',
          'Полное предметное объяснение сначала даётся по-русски.',
          'Эстонские единицы вводятся после понимания содержания.',
          'Индивидуальное задание выполняется с видимой языковой опорой.',
          'Предметный результат и короткая эстонская фраза проверяются отдельно.',
        ][index],
      })),
      learner_estonian_level: level,
      planned_support_level: 'high',
      scaffold_release: {
        introduction: 'full_support',
        guided_practice: 'partial_support',
        final_output: 'short_independent_output',
      },
      content_language_assessment_policy: 'separate_content_and_estonian_language_evidence',
    },
    objectives,
    language_load: languageLoad,
    cognitive_load: cognitiveLoad,
    scaffolds,
    multimodal_support: multimodalSupport,
    stages,
    questions,
    practical_work: practicalWork,
    assessment,
    differentiation: {
      supports: [
        {
          type: 'additional_russian_explanation',
          implementation_ru: 'Повторить предметный алгоритм по одному шагу, сохранив тот же предметный результат.',
          preserves_subject_objective: true,
        },
        {
          type: 'reduced_estonian_output',
          implementation_ru: 'Разрешить прочитать одну короткую фразу по видимой рамке без сокращения предметной работы.',
          preserves_subject_objective: true,
        },
      ],
      challenge_extension: 'Добавить второе доказательство к русскому предметному ответу без увеличения обязательной эстонской части.',
      simplified_curriculum_opt_in: {
        enabled: false,
        notes: 'Материалы упрощённой программы не используются в обычном маршруте этого урока.',
      },
    },
    homework,
    artifact_readiness: {
      schema_complete: true,
      content_complete: true,
      materials_resolved: true,
      print_ready: false,
      teacher_review: {
        status: 'pending',
        reviewer_role: null,
        reviewed_at: null,
        notes: 'Независимая педагогическая проверка урока ещё не выполнена.',
      },
      classroom_trial: {
        status: 'not_tested',
        tested_at: null,
        context: null,
        notes: 'Урок ещё не апробирован в классе или дома.',
      },
      classroom_ready: false,
      readiness_status: 'materials_resolved',
    },
    delivery_model: {
      core_mode: 'standalone_commercial_core',
      opiq_required: false,
      opiq_companion_policy: 'none',
      family_overlay_supported: false,
      customer_can_complete_without_opiq: true,
      publication_status: 'internal_review',
    },
    commercial_core: commercialCore,
    opiq_companions: [],
    originality_review: pendingOriginality(lessonId, materials, originalityRefs),
    family_overlay_hooks: [],
    provenance: provenance(
      'author_created_bridge',
      `${projectId}; ${officialMapId}`,
      'Independently authored standalone lesson uses registered Grade 2 route architecture without copying source prose or tasks.',
    ),
  };
  lesson.pedagogical_integration = integrationFor(lesson, integrationOptions);
  return lesson;
}

function buildLesson1() {
  const explanationPath = `${packRoot}/student/lesson-01-weather-explanation.md`;
  const observationPath = `${packRoot}/student/lesson-01-observation-sheet.md`;
  const exitPath = `${packRoot}/student/lesson-01-exit-card.md`;
  const answerPath = `${packRoot}/answers/lesson-01-answer-guidance.md`;
  const guidePath = `${packRoot}/teacher/lesson-01-guide.md`;
  const materials = [
    material({
      id: 'g2-weather-observation-explanation',
      title: 'Самостоятельное русское объяснение наблюдения погоды',
      type: 'explanation',
      artifactPath: explanationPath,
      audience: 'student',
      languages: ['ru', 'et'],
      category: 'author_created_explanation',
      sourceReference: 'grade-2 weather observation standalone explanation',
      notes: 'Original explanation defines bounded observation without reproducing textbook prose.',
    }),
    material({
      id: 'g2-weather-observation-worked-example',
      title: 'Разобранный пример записи погоды',
      type: 'worked_example',
      artifactPath: explanationPath,
      audience: 'student',
      languages: ['ru', 'et'],
      category: 'author_created_worked_example',
      sourceReference: 'grade-2 weather observation model',
      notes: 'Original model separates direct evidence from an unsupported forecast.',
    }),
    material({
      id: 'g2-weather-observation-task',
      title: 'Индивидуальный лист наблюдения за погодой',
      type: 'worksheet',
      artifactPath: observationPath,
      audience: 'student',
      languages: ['ru', 'et'],
      category: 'author_created_worksheet',
      sourceReference: 'grade-2 weather observation procedure',
      notes: 'Original printable procedure requires individual evidence before the shared board.',
      openEnded: true,
    }),
    material({
      id: 'g2-weather-observation-assessment',
      title: 'Раздельная выходная карточка урока 1',
      type: 'assessment',
      artifactPath: exitPath,
      audience: 'student',
      languages: ['ru', 'et'],
      category: 'author_created_assessment',
      sourceReference: 'grade-2 weather observation exit card',
      notes: 'Original exit card separates subject evidence from Estonian oral evidence.',
      openEnded: true,
    }),
    material({
      id: 'g2-weather-observation-expected-guidance',
      title: 'Teacher-only guidance к открытому наблюдению',
      type: 'expected_answers',
      artifactPath: answerPath,
      audience: 'teacher',
      category: 'author_created_expected_answers',
      sourceReference: 'grade-2 weather observation teacher guidance',
      notes: 'Teacher-only guidance describes acceptable evidence without inventing one fixed weather answer.',
    }),
    material({
      id: 'g2-weather-observation-lesson-guide',
      title: 'Внутренний guide урока 1',
      type: 'lesson_guide',
      artifactPath: guidePath,
      audience: 'teacher',
      languages: ['ru', 'et'],
      category: 'author_created_explanation',
      sourceReference: 'grade-2 weather observation lesson procedure',
      notes: 'Teacher guide records timing, safety controls, and evidence attribution.',
    }),
  ];
  const stages = [
    stage({
      id: 'activate-weather',
      minutes: 5,
      type: 'activation',
      contentPurpose: 'Отделить наблюдение текущей погоды от предположения о будущем.',
      languagePurpose: 'Aktiveerida tuttav sõna ilm.',
      teacherAction: 'Показывает два высказывания и просит определить, где записано наблюдение.',
      pupilAction: 'Выбирает наблюдаемое высказывание и объясняет выбор по-русски.',
      materials: ['g2-weather-observation-explanation'],
      ru: ['Я могу увидеть этот признак сейчас.'],
      et: [],
      prompt: 'Что можно проверить прямо сейчас?',
      subjectEvidence: 'Ученик отличает наблюдение от прогноза.',
      languageEvidence: 'Эстонская продукция на этом этапе не требуется.',
      expectedEvidence: 'Индивидуальный русский ответ называет один проверяемый текущий признак.',
      transition: 'Переход к полному русскому объяснению.',
    }),
    stage({
      id: 'explain-weather-ru',
      minutes: 8,
      type: 'russian_concept_explanation',
      contentPurpose: 'Сформировать полный безопасный алгоритм наблюдения погоды.',
      languagePurpose: 'Sisu mõistmine toimub vene keeles.',
      teacherAction: 'Объясняет признаки погоды, границы одного наблюдения и правила безопасности.',
      pupilAction: 'Следит по объяснению и располагает пять признаков в порядке наблюдения.',
      materials: ['g2-weather-observation-explanation'],
      scaffolds: ['weather-russian-explanation'],
      ru: ['Сначала я записываю время, потом наблюдаю признаки.'],
      et: [],
      prompt: 'Почему одно наблюдение не является прогнозом?',
      subjectEvidence: 'Ученик связывает вывод с текущим временем и местом.',
      languageEvidence: 'Содержание объясняется полностью по-русски.',
      expectedEvidence: 'Ученик по-русски воспроизводит не менее трёх шагов безопасной процедуры.',
      transition: 'Переход к пяти видимым эстонским словам.',
    }),
    stage({
      id: 'bridge-weather-et',
      minutes: 7,
      type: 'estonian_language_bridge',
      contentPurpose: 'Связать уже понятые признаки с пятью ограниченными словами для описания погоды.',
      languagePurpose: 'Õppida ilm, vihmane, tuuline, pilvine ja päikeseline.',
      teacherAction: 'Показывает слова рядом с русскими эквивалентами и моделирует одну короткую рамку.',
      pupilAction: 'Соотносит пять слов с погодными условиями и повторяет одну рамку с поддержкой.',
      materials: ['g2-weather-observation-explanation'],
      scaffolds: ['weather-word-bank', 'weather-description-sentence-frame'],
      newLanguage: ['ilm', 'vihmane', 'tuuline', 'pilvine', 'päikeseline', 'vaatle'],
      ru: ['Это слово обозначает наблюдаемый признак.'],
      et: ['Täna on pilvine ilm.'],
      prompt: 'Покажи слово для облачной погоды.',
      subjectEvidence: 'Ученик сохраняет связь слова с наблюдаемым признаком.',
      languageEvidence: 'Ученик узнаёт не менее четырёх из пяти слов.',
      expectedEvidence: 'Ученик соотносит целевые слова с безопасно наблюдаемыми признаками погоды.',
      transition: 'Переход к индивидуальному наблюдению.',
    }),
    stage({
      id: 'individual-weather-observation',
      minutes: 17,
      type: 'practical_observation',
      contentPurpose: 'Получить индивидуальную запись признака и доказательства.',
      languagePurpose: 'Kasutada üht toetatud lauset.',
      teacherAction: 'Организует наблюдение через закрытое окно или разрешённый контролируемый выход.',
      pupilAction: 'Самостоятельно заполняет лист, пишет русский вывод и только затем передаёт одну запись на доску.',
      materials: ['g2-weather-observation-task'],
      scaffolds: ['weather-word-bank', 'weather-description-sentence-frame'],
      ru: ['Я вижу признак и могу назвать доказательство.'],
      et: ['Täna on tuuline ilm.'],
      prompt: 'Какое доказательство записано на твоём листе?',
      subjectEvidence: 'Лист содержит время, признак и индивидуальное доказательство.',
      languageEvidence: 'Короткая фраза дана по рамке после предметного вывода.',
      expectedEvidence: 'Каждый ученик создаёт собственный лист до сборки подписанной общей доски.',
      transition: 'Переход к раздельной выходной проверке.',
    }),
    stage({
      id: 'assess-weather-separately',
      minutes: 8,
      type: 'assessment',
      contentPurpose: 'Отдельно проверить предметное доказательство и языковой output.',
      languagePurpose: 'Hinnata lühikest lauset eraldi.',
      teacherAction: 'Собирает карточку и отдельно отмечает предметный результат и понятность фразы.',
      pupilAction: 'Пишет признак с доказательством и произносит одну короткую эстонскую фразу.',
      materials: ['g2-weather-observation-assessment'],
      scaffolds: ['weather-description-sentence-frame'],
      ru: ['Признак подтверждается моим наблюдением.'],
      et: ['Täna on ___ ilm.'],
      prompt: 'Как доказательство связано с признаком?',
      subjectEvidence: 'Письменная предметная строка содержит признак и наблюдаемое доказательство.',
      languageEvidence: 'Отдельно зафиксирована одна понятная поддержанная фраза.',
      expectedEvidence: 'Предметная и эстонская строки заполнены независимо друг от друга.',
      transition: 'Урок завершается без обязательного домашнего наблюдения.',
    }),
  ];
  return commonLesson({
    lessonId: 'grade-2-weather-water-safety-01-observation',
    position: 1,
    subject: 'science',
    subjectEt: 'loodusõpetus',
    titleRu: 'Наблюдаем погоду безопасно',
    titleEt: 'Vaatleme ilma ohutult',
    route: {
      source_id: 'grade-2-science',
      md_path: 'project-files/outputs/opiq_2klass_loodusopetus.md',
      source_archive: 'project-files/inputs/final-zips/opiq_2klass_loodus_ja_inimeseopetus_2_klassile_v2.zip',
      qa_path: 'project-files/outputs/opiq_2klass_loodusopetus_qa.json',
    },
    profile: 'grade-2-science-a1-default',
    level: 'A1',
    officialMapId: 'grade-2-science-official-curriculum',
    outcomeId: 'ee-prk-2026-stage1-natural-science-guided-inquiry',
    materials,
    stages,
    objectives: {
      content_objectives: [{
        objective_id: 'record-current-weather-evidence',
        text_ru: 'Ученик безопасно наблюдает текущую погоду и записывает признак вместе с доказательством.',
        observable_output_ru: 'Индивидуальный лист содержит время, признак, доказательство и краткий русский вывод.',
        curriculum_outcome_refs: ['ee-prk-2026-stage1-natural-science-guided-inquiry'],
      }],
      estonian_language_objectives: [{
        objective_id: 'say-one-weather-frame-et',
        text_ru: 'Ученик произносит одну короткую поддержанную фразу о наблюдаемой погоде.',
        text_et: 'Õpilane ütleb ühe toetatud lause ilma kohta.',
        observable_output: 'give_short_oral_answer',
        minimum_quantity: 1,
        language_functions: ['name', 'describe'],
      }],
      subject_success_criteria: [{
        criterion_id: 'subject-weather-evidence',
        descriptor: 'Запись связывает текущий признак погоды с безопасно наблюдаемым доказательством.',
        acceptable_evidence: 'Индивидуальный лист и русский вывод ученика, созданные до общей доски.',
      }],
      estonian_success_criteria: [{
        criterion_id: 'language-one-weather-sentence',
        descriptor: 'Одна короткая фраза по видимой рамке понятна слушателю.',
        acceptable_evidence: 'Индивидуальная устная фраза с одним уместным целевым словом.',
      }],
      prerequisites: ['Ученик может описать по-русски то, что видит в данный момент.'],
      anticipated_misconceptions: [
        'Прогноз на вечер ошибочно записывается как текущее наблюдение.',
        'Наличие ветра определяется без наблюдаемого безопасного признака.',
      ],
    },
    languageLoad: {
      new_terms_et: [
        ['ilm', 'погода', 'Ilm on õhu ja taeva seisund.'],
        ['vihmane', 'дождливая', 'Vihmane ilm tähendab, et sajab vihma.'],
        ['tuuline', 'ветреная', 'Tuulise ilmaga liiguvad oksad, lipp või rohi.'],
        ['pilvine', 'облачная', 'Pilvise ilmaga on taevas palju pilvi.'],
        ['päikeseline', 'солнечная', 'Päikeselise ilmaga paistab päike.'],
      ].map(([termEt, equivalentRu, definition]) => ({
        term_et: termEt,
        equivalent_ru: equivalentRu,
        simple_definition_et: definition,
        provenance: provenance(
          'author_created_bridge',
          'grade-2 weather bilingual word bank',
          'Short original definition supports only the bounded A1 weather vocabulary.',
        ),
        first_use_stage: 'bridge-weather-et',
        reuse_stage_refs: ['individual-weather-observation', 'assess-weather-separately'],
      })),
      recycled_terms_et: [],
      new_instruction_verbs_et: [{
        verb_et: 'vaatle',
        equivalent_ru: 'наблюдай',
        provenance: provenance(
          'author_created_bridge',
          'grade-2 weather observation instruction',
          'The instruction verb is introduced with teacher modelling and a visible procedure.',
        ),
        first_use_stage: 'bridge-weather-et',
        reuse_stage_refs: ['individual-weather-observation'],
      }],
      recycled_instruction_verbs_et: [],
      model_sentences: [{
        text_et: 'Täna on tuuline ilm.',
        translation_ru: 'Сегодня ветрено.',
        terms_et: ['tuuline', 'ilm'],
        provenance: provenance(
          'author_created_bridge',
          'grade-2 weather oral model',
          'Original short sentence models one bounded supported weather statement.',
        ),
      }],
      sentence_frames: [{
        frame_id: 'weather-description-frame',
        frame_et: 'Täna on ___ ilm.',
        purpose_ru: 'Рамка ограничивает обязательную эстонскую продукцию одной короткой фразой.',
        stage_refs: ['bridge-weather-et', 'individual-weather-observation', 'assess-weather-separately'],
        provenance: provenance(
          'author_created_bridge',
          'grade-2 weather sentence frame',
          'Original A1 frame supports one oral output after the Russian conclusion.',
        ),
      }],
      expected_receptive_language_et: ['Vaatle ilma.', 'Näita sõna.', 'Ütle üks lause.'],
      expected_supported_productive_language_et: [
        'Täna on vihmane ilm.',
        'Täna on tuuline ilm.',
        'Täna on pilvine ilm.',
        'Täna on päikeseline ilm.',
      ],
      expected_independent_productive_language_et: ['Täna on ___ ilm.'],
      full_expected_answer_ru: 'Я наблюдал(а) погоду в указанное время, записал(а) текущий признак и подтвердил(а) его тем, что можно было безопасно увидеть.',
      short_expected_oral_answer_et: 'Täna on ___ ilm.',
      oral_output_terms_et: ['ilm', 'vihmane', 'tuuline', 'pilvine', 'päikeseline'],
    },
    cognitiveLoad: {
      new_subject_concepts: 2,
      new_estonian_terms: 5,
      new_instruction_verbs: 1,
      new_sentence_structures: 1,
      independent_output_sentences: 1,
      rationale: 'Полное понятие и процедура устанавливаются по-русски; эстонский output ограничен одной рамкой.',
    },
    scaffolds: [
      {
        scaffold_id: 'weather-russian-explanation',
        type: 'russian_explanation',
        description_ru: 'Учитель по-русски моделирует отличие наблюдения от прогноза и полный безопасный порядок.',
        stage_refs: ['explain-weather-ru'],
        release: {
          at_stage: 'individual-weather-observation',
          how_reduced_ru: 'Ученик следует напечатанному порядку без повторного устного объяснения каждого шага.',
        },
        provenance: provenance(
          'author_created_explanation',
          'grade-2 weather standalone explanation',
          'Original Russian explanation preserves full subject demand before language support.',
        ),
      },
      {
        scaffold_id: 'weather-word-bank',
        type: 'word_bank',
        description_ru: 'Пять целевых слов остаются видимыми рядом с русскими эквивалентами.',
        stage_refs: ['bridge-weather-et', 'individual-weather-observation'],
        release: {
          at_stage: 'assess-weather-separately',
          how_reduced_ru: 'На выходной карточке остаётся только список слов без русского перевода.',
        },
        provenance: provenance(
          'author_created_bridge',
          'grade-2 weather word bank',
          'Bounded bilingual word bank contains five independently authored term links.',
        ),
      },
      {
        scaffold_id: 'weather-description-sentence-frame',
        type: 'sentence_frame',
        description_ru: 'Рамка поддерживает одну короткую устную фразу после русского вывода.',
        stage_refs: ['bridge-weather-et', 'individual-weather-observation', 'assess-weather-separately'],
        release: {
          at_stage: 'assess-weather-separately',
          how_reduced_ru: 'Ученик самостоятельно выбирает одно подходящее прилагательное для пустого места.',
        },
        provenance: provenance(
          'author_created_bridge',
          'grade-2 weather sentence frame',
          'Original frame limits productive language load to a single supported sentence.',
        ),
      },
    ],
    multimodalSupport: [{
      support_id: 'weather-observation-table-support',
      type: 'table',
      stage_refs: ['individual-weather-observation'],
      material_ref: 'g2-weather-observation-task',
      provenance: provenance(
        'author_created_worksheet',
        'grade-2 weather observation sheet',
        'Original table externalises the safe observation sequence and evidence fields.',
      ),
    }],
    questions: [{
      question_id: 'weather-evidence-question',
      question_ru: 'Какой признак погоды ты наблюдал(а) и чем можешь его доказать?',
      question_et: 'Milline ilm on täna?',
      full_expected_answer_ru: 'Ответ называет текущий признак и конкретное безопасно наблюдаемое доказательство.',
      short_oral_answer_et: 'Täna on ___ ilm.',
      acceptable_variants: ['Допустим любой точный текущий признак с соответствующим наблюдаемым доказательством.'],
      misconception_to_watch: 'Ученик сообщает прогноз или мнение вместо наблюдаемого доказательства.',
      objective_refs: ['record-current-weather-evidence', 'say-one-weather-frame-et'],
      provenance_refs: ['g2-weather-observation-task'],
    }],
    practicalWork: {
      work_id: 'safe-individual-weather-observation',
      title_ru: 'Безопасное индивидуальное наблюдение погоды',
      title_et: 'Ohutu individuaalne ilmavaatlus',
      safety_requirements: [
        'Основной режим — наблюдение через закрытое окно без открывания и высовывания.',
        'Выход возможен только по решению учителя или взрослого и под непосредственным присмотром.',
        'Нельзя приближаться к дороге, воде, скользкому краю или грозе ради наблюдения.',
      ],
      teacher_controlled_steps: [
        'Учитель выбирает безопасное место и решает, остаётся ли группа в помещении.',
        'Учитель прекращает наблюдение при изменении условий или отсутствии контроля.',
      ],
      pupil_steps: [
        'Записать время и место до начала наблюдения.',
        'Отметить солнце, облака, дождь и безопасный признак ветра.',
        'Записать собственный русский вывод и короткую эстонскую фразу.',
        'Передать одну запись на общую доску только после завершения своего листа.',
      ],
      materials: ['Индивидуальный печатный лист', 'Карандаш', 'Часы', 'Безопасный обзор через закрытое окно'],
      observation_table: {
        columns: ['время', 'солнце', 'облака', 'дождь', 'ветер', 'доказательство'],
        data_collection_ru: 'Каждый ученик самостоятельно отмечает текущие признаки до совместного обсуждения.',
      },
      expected_observation_ru: 'Запись соответствует условиям в месте и времени наблюдения и содержит видимое доказательство.',
      expected_conclusion_ru: 'Вывод описывает текущую погоду и не превращает одно наблюдение в общий прогноз.',
      russian_report_target: 'Один полный русский вывод с признаком и доказательством на индивидуальном листе.',
      short_estonian_conclusion: 'Täna on ___ ilm.',
      opiq_source_record_ids: [],
      provenance_refs: ['g2-weather-observation-task', 'g2-weather-observation-explanation'],
    },
    assessment: [
      ['weather-subject-understanding', 'subject_understanding', 'Связь текущего признака с наблюдаемым доказательством.', 'Индивидуальный русский вывод и заполненная строка доказательства.', 'Один точный признак и одно уместное доказательство.', 'subject_assessment'],
      ['weather-practical-safety', 'practical_skill', 'Следование безопасной процедуре и индивидуальная фиксация до доски.', 'Заполненный лист и соблюдение teacher-controlled boundary.', 'Все обязательные безопасные шаги соблюдены.', 'subject_assessment'],
      ['weather-et-recognition', 'estonian_terminology_recognition', 'Узнавание пяти целевых погодных слов.', 'Выбор или указание не менее четырёх слов.', 'Не менее четырёх из пяти слов.', 'language_assessment'],
      ['weather-et-supported', 'supported_estonian_production', 'Заполнение устной рамки подходящим погодным прилагательным.', 'Короткая фраза с видимой рамкой.', 'Одна понятная поддержанная фраза.', 'language_assessment'],
      ['weather-et-independent', 'independent_estonian_production', 'Самостоятельный выбор одного уместного погодного прилагательного в рамке.', 'Индивидуальная устная фраза на выходе.', 'Одно уместное прилагательное выбрано без подсказки ответа.', 'language_assessment'],
    ].map(([criterion_id, domain, what_is_checked, acceptable_evidence, success_threshold, affects]) => ({
      criterion_id,
      domain,
      what_is_checked,
      acceptable_evidence,
      success_threshold,
      affects,
    })),
    homework: {
      content_task_ru: 'Обязательного домашнего наблюдения нет; по указанию учителя можно перечитать безопасный порядок.',
      estonian_language_component: 'При желании один раз прочитать рамку «Täna on ___ ilm.».',
      expected_minutes: 5,
      source_reference: 'g2-weather-observation-explanation',
      required_opiq_url: null,
      adult_support_expected: false,
      success_guidance_ru: 'Домашний выход к дороге или воде не требуется и не разрешается этим материалом.',
      provenance: provenance(
        'author_created_worksheet',
        'grade-2 weather optional consolidation',
        'No required home observation or Opiq access is introduced by this lesson.',
      ),
    },
    commercialCore: {
      explanation_material_ids: ['g2-weather-observation-explanation'],
      worked_example_material_ids: ['g2-weather-observation-worked-example'],
      task_material_ids: ['g2-weather-observation-task'],
      expected_answer_material_ids: [],
      worked_solution_material_ids: [],
      assessment_material_ids: ['g2-weather-observation-assessment'],
      assessment_criterion_ids: ['weather-subject-understanding', 'weather-practical-safety', 'weather-et-independent'],
      learner_output_refs: ['safe-individual-weather-observation', 'weather-evidence-question'],
      success_criteria_refs: ['subject-weather-evidence', 'language-one-weather-sentence'],
      task_contracts: [{
        task_material_id: 'g2-weather-observation-task',
        response_mode: 'open_ended',
        open_ended: true,
        open_ended_exemption: {
          reason: 'The correct observation depends on current local weather and must be supported by individual evidence.',
        },
      }],
    },
    originalityRefs: [
      'grade-programmes/grade-2/project-modules.yaml#grade-2-project-weather-water-safety',
      'curriculum-maps/grade-2-science/official-curriculum.yaml',
    ],
    integrationOptions: {
      purpose: 'practical_investigation',
      contentTypes: ['conceptual_text', 'practical_observation'],
      requiredCapabilities: ['observation', 'individual_evidence'],
      contextFlags: { practical: true, map_or_data: false, retrieval: false, assessment: true },
      guideMaterialId: 'g2-weather-observation-lesson-guide',
      primaryStudentMaterialId: 'g2-weather-observation-task',
    },
  });
}

function buildLesson2() {
  const explanationPath = `${packRoot}/student/lesson-02-weather-data-explanation.md`;
  const comparisonPath = `${packRoot}/student/g2-weather-data-comparison-task.md`;
  const timePath = `${packRoot}/student/g2-time-measurement-problem-task.md`;
  const exitPath = `${packRoot}/student/lesson-02-exit-card.md`;
  const answerPath = `${packRoot}/answers/lesson-02-answer-guidance.md`;
  const guidePath = `${packRoot}/teacher/lesson-02-guide.md`;
  const materials = [
    material({
      id: 'g2-weather-data-time-explanation',
      title: 'Самостоятельное объяснение сравнения данных и времени',
      type: 'explanation',
      artifactPath: explanationPath,
      audience: 'student',
      languages: ['ru', 'et'],
      category: 'author_created_explanation',
      sourceReference: 'grade-2 weather data and time standalone explanation',
      notes: 'Original explanation supplies every strategy needed without Opiq access.',
    }),
    material({
      id: 'g2-weather-data-time-worked-example',
      title: 'Разобранный пример с другими длительностями',
      type: 'worked_example',
      artifactPath: explanationPath,
      audience: 'student',
      category: 'author_created_worked_example',
      sourceReference: 'grade-2 weather data and time worked example',
      notes: 'Original example models the operation order without revealing either integrated task answer.',
    }),
    material({
      id: 'g2-weather-data-comparison-task',
      title: 'Одобренное задание о сравнении данных осадков',
      type: 'task_set',
      artifactPath: comparisonPath,
      audience: 'student',
      category: 'author_created_task_set',
      sourceReference: 'task-bank/tasks/grade-2/weather-water-safety/03-weather-data-comparison.yaml',
      notes: 'Learner rendering preserves the approved customer projection and excludes teacher answers.',
      answerKeyPath: answerPath,
    }),
    material({
      id: 'g2-time-measurement-problem-task',
      title: 'Одобренная задача о длительности наблюдения',
      type: 'task_set',
      artifactPath: timePath,
      audience: 'student',
      category: 'author_created_task_set',
      sourceReference: 'task-bank/tasks/grade-2/weather-water-safety/04-time-measurement-problem.yaml',
      notes: 'Learner rendering preserves the approved customer projection and excludes teacher answers.',
      answerKeyPath: answerPath,
    }),
    material({
      id: 'g2-weather-data-comparison-expected-answers',
      title: 'Teacher-only expected answer для сравнения осадков',
      type: 'expected_answers',
      artifactPath: answerPath,
      audience: 'teacher',
      category: 'author_created_expected_answers',
      sourceReference: 'g2-weather-data-comparison-task answer contract',
      notes: 'Approved expected answer remains in a teacher-only file after the first attempt.',
    }),
    material({
      id: 'g2-weather-data-comparison-worked-solution',
      title: 'Teacher-only worked solution для сравнения осадков',
      type: 'worked_solution',
      artifactPath: answerPath,
      audience: 'teacher',
      category: 'author_created_worked_solution',
      sourceReference: 'g2-weather-data-comparison-task worked solution',
      notes: 'Approved calculation steps remain separated from every learner-facing file.',
    }),
    material({
      id: 'g2-time-measurement-problem-expected-answers',
      title: 'Teacher-only expected answer для задачи о времени',
      type: 'expected_answers',
      artifactPath: answerPath,
      audience: 'teacher',
      category: 'author_created_expected_answers',
      sourceReference: 'g2-time-measurement-problem-task answer contract',
      notes: 'Approved expected answer remains in a teacher-only file after the first attempt.',
    }),
    material({
      id: 'g2-time-measurement-problem-worked-solution',
      title: 'Teacher-only worked solution для задачи о времени',
      type: 'worked_solution',
      artifactPath: answerPath,
      audience: 'teacher',
      category: 'author_created_worked_solution',
      sourceReference: 'g2-time-measurement-problem-task worked solution',
      notes: 'Approved add-then-convert steps remain separated from every learner-facing file.',
    }),
    material({
      id: 'g2-weather-data-time-assessment',
      title: 'Раздельная выходная карточка урока 2',
      type: 'assessment',
      artifactPath: exitPath,
      audience: 'student',
      languages: ['ru', 'et'],
      category: 'author_created_assessment',
      sourceReference: 'grade-2 weather data and time exit card',
      notes: 'Original exit card separates calculation checks from the Estonian oral frame.',
      answerKeyPath: answerPath,
    }),
    material({
      id: 'g2-weather-data-time-lesson-guide',
      title: 'Внутренний guide урока 2',
      type: 'lesson_guide',
      artifactPath: guidePath,
      audience: 'teacher',
      languages: ['ru', 'et'],
      category: 'author_created_explanation',
      sourceReference: 'grade-2 weather data and time lesson procedure',
      notes: 'Teacher guide records exact approved task integration, timing, and evidence separation.',
    }),
  ];
  const stages = [
    stage({
      id: 'activate-data',
      minutes: 5,
      type: 'activation',
      contentPurpose: 'Вспомнить, что число читается вместе с подписью и единицей.',
      languagePurpose: 'Taaskasutada sõna ilm.',
      teacherAction: 'Показывает два числа с разными подписями и просит назвать, что именно измерено.',
      pupilAction: 'По-русски связывает каждое число с подписью и единицей измерения.',
      materials: ['g2-weather-data-time-explanation'],
      ru: ['Число нужно читать вместе с подписью.'],
      et: ['ilm'],
      prompt: 'Что обозначает это число?',
      subjectEvidence: 'Ученик называет величину и единицу.',
      languageEvidence: 'Ученик узнаёт повторяемое слово ilm.',
      expectedEvidence: 'Индивидуальный ответ связывает число с величиной и единицей измерения.',
      transition: 'Переход к русскому алгоритму сравнения.',
    }),
    stage({
      id: 'explain-data-time-ru',
      minutes: 8,
      type: 'russian_concept_explanation',
      contentPurpose: 'Освоить алгоритмы максимум–минимум–разность и сложение длительностей.',
      languagePurpose: 'Sisu mõistmine toimub vene keeles.',
      teacherAction: 'По-русски моделирует порядок сравнения и правило 60 минут равно 1 часу.',
      pupilAction: 'Расставляет карточки шагов в правильном порядке и объясняет выбор.',
      materials: ['g2-weather-data-time-explanation'],
      scaffolds: ['data-russian-explanation'],
      ru: ['Сначала нахожу максимум и минимум, затем разность.'],
      et: [],
      prompt: 'Какой шаг выполняется перед вычитанием?',
      subjectEvidence: 'Ученик называет максимум, минимум и действие разности.',
      languageEvidence: 'Эстонская продукция на этапе объяснения не требуется.',
      expectedEvidence: 'Ученик по-русски воспроизводит оба вычислительных алгоритма по порядку.',
      transition: 'Переход к примеру с другими данными.',
    }),
    stage({
      id: 'bridge-data-et',
      minutes: 7,
      type: 'estonian_language_bridge',
      contentPurpose: 'Закрепить единицы и краткую устную рамку после понимания математики.',
      languagePurpose: 'Õppida millimeeter, minut, tund ja kokku.',
      teacherAction: 'Показывает четыре слова и моделирует две короткие рамки без ответов к заданиям.',
      pupilAction: 'Соотносит единицы с величинами и повторяет одну рамку с нейтральным числом.',
      materials: ['g2-weather-data-time-explanation'],
      scaffolds: ['data-word-bank', 'data-sentence-frame'],
      newLanguage: ['millimeeter', 'minut', 'tund', 'kokku', 'võrdle', 'liida'],
      ru: ['Миллиметр — единица длины, минута и час — единицы времени.'],
      et: ['Kokku on kümme minutit.'],
      prompt: 'Покажи слово для часа.',
      subjectEvidence: 'Ученик правильно различает единицы длины и времени.',
      languageEvidence: 'Ученик узнаёт четыре новых слова.',
      expectedEvidence: 'Единицы измерения связаны с правильными величинами до индивидуальных задач.',
      transition: 'Переход к двум индивидуальным заданиям.',
    }),
    stage({
      id: 'solve-approved-tasks',
      minutes: 17,
      type: 'independent_output',
      contentPurpose: 'Получить индивидуальные вычисления по двум одобренным заданиям.',
      languagePurpose: 'Hoida matemaatika ja eesti keele tõend eraldi.',
      teacherAction: 'Выдаёт только два одобренных learner files и не показывает teacher-only guidance.',
      pupilAction: 'Индивидуально решает обе задачи, показывает действия и только затем обсуждает записи.',
      materials: ['g2-weather-data-comparison-task', 'g2-time-measurement-problem-task'],
      scaffolds: ['data-word-bank'],
      ru: ['Я показываю сравнение, действие и единицу.', 'Я складываю две длительности.'],
      et: [],
      prompt: 'Какие два числа нужно использовать для разности?',
      subjectEvidence: 'Есть индивидуальные максимум, минимум, разность и add-then-convert решение.',
      languageEvidence: 'Эстонская продукция не входит в task-bank answers.',
      expectedEvidence: 'Каждый ученик сохраняет собственные вычисления до общей проверки или доски.',
      transition: 'Переход к раздельной выходной проверке.',
    }),
    stage({
      id: 'assess-data-separately',
      minutes: 8,
      type: 'assessment',
      contentPurpose: 'Отдельно проверить математику и короткую эстонскую фразу.',
      languagePurpose: 'Hinnata üht lühikest lauset eraldi.',
      teacherAction: 'Проверяет ответы по teacher-only guidance и отдельно слушает одну рамку.',
      pupilAction: 'Проверяет единицы и действие, затем произносит одну выбранную эстонскую фразу.',
      materials: ['g2-weather-data-time-assessment'],
      scaffolds: ['data-sentence-frame'],
      ru: ['Я могу объяснить, почему использовал(а) эту единицу.'],
      et: ['Kõige rohkem on ___.', 'Kokku on ___ minutit.'],
      prompt: 'Почему в ответе нужно сохранить единицу?',
      subjectEvidence: 'Выходная карточка подтверждает проверку подписи, действия и единицы.',
      languageEvidence: 'Одна короткая фраза отмечена отдельно от математики.',
      expectedEvidence: 'Математические строки и индивидуальный устный output имеют разные критерии.',
      transition: 'Урок завершается без интеграции других task-bank items.',
    }),
  ];
  return commonLesson({
    lessonId: 'grade-2-weather-water-safety-02-data-time',
    position: 2,
    subject: 'mathematics',
    subjectEt: 'matemaatika',
    titleRu: 'Сравниваем данные о погоде и время',
    titleEt: 'Võrdleme ilmaandmeid ja aega',
    route: {
      source_id: 'grade-2-mathematics',
      md_path: 'project-files/outputs/opiq_2klass_matemaatika.md',
      source_archive: 'project-files/inputs/final-zips/opiq_2klass_matemaatika_2_klassile_v2.zip',
      qa_path: 'project-files/outputs/opiq_2klass_matemaatika_qa.json',
    },
    profile: 'grade-2-mathematics-a1-a2-default',
    level: 'A1-A2',
    officialMapId: 'grade-2-mathematics-official-curriculum',
    outcomeId: 'ee-prk-2026-stage1-mathematics-real-life',
    materials,
    stages,
    objectives: {
      content_objectives: [{
        objective_id: 'solve-weather-data-and-time',
        text_ru: 'Ученик сравнивает четыре значения осадков и решает задачу на общую длительность.',
        observable_output_ru: 'Индивидуальные записи показывают максимум, минимум, разность, сложение и перевод шестидесяти минут в один час.',
        curriculum_outcome_refs: ['ee-prk-2026-stage1-mathematics-real-life'],
      }],
      estonian_language_objectives: [{
        objective_id: 'say-one-data-frame-et',
        text_ru: 'Ученик произносит одну короткую поддержанную фразу о результате после вычисления.',
        text_et: 'Õpilane ütleb ühe toetatud lause tulemuse kohta.',
        observable_output: 'give_short_oral_answer',
        minimum_quantity: 1,
        language_functions: ['name', 'compare', 'report'],
      }],
      subject_success_criteria: [{
        criterion_id: 'subject-two-correct-solutions',
        descriptor: 'Обе работы показывают требуемые действия и сохраняют правильные единицы.',
        acceptable_evidence: 'Два индивидуальных learner sheets до просмотра teacher-only guidance.',
      }],
      estonian_success_criteria: [{
        criterion_id: 'language-one-data-sentence',
        descriptor: 'Одна выбранная короткая рамка с результатом понятна слушателю.',
        acceptable_evidence: 'Индивидуальная устная фраза после завершения математической работы.',
      }],
      prerequisites: [
        'Ученик сравнивает двузначные целые числа и выполняет сложение и вычитание в пределах ста.',
        'Ученик знает, что число в задаче читается вместе с единицей измерения.',
      ],
      anticipated_misconceptions: [
        'Из максимума вычитается второе по величине число вместо минимума.',
        'Шестьдесят минут ошибочно называются двумя часами.',
      ],
    },
    languageLoad: {
      new_terms_et: [
        ['millimeeter', 'миллиметр', 'Millimeeter on väike pikkusühik.'],
        ['minut', 'минута', 'Minut on ajaühik.'],
        ['tund', 'час', 'Tund on kuuskümmend minutit.'],
        ['kokku', 'всего', 'Kokku näitab kogu hulka või aega.'],
      ].map(([termEt, equivalentRu, definition]) => ({
        term_et: termEt,
        equivalent_ru: equivalentRu,
        simple_definition_et: definition,
        provenance: provenance(
          'author_created_bridge',
          'grade-2 data and time bilingual word bank',
          'Short original definition supports bounded A1-A2 mathematics language.',
        ),
        first_use_stage: 'bridge-data-et',
        reuse_stage_refs: ['assess-data-separately'],
      })),
      recycled_terms_et: [{
        term_et: 'ilm',
        equivalent_ru: 'погода',
        source_lesson_id: 'grade-2-weather-water-safety-01-observation',
        reuse_stage_refs: ['activate-data', 'solve-approved-tasks'],
      }],
      new_instruction_verbs_et: [
        ['võrdle', 'сравни'],
        ['liida', 'сложи'],
      ].map(([verbEt, equivalentRu]) => ({
        verb_et: verbEt,
        equivalent_ru: equivalentRu,
        provenance: provenance(
          'author_created_bridge',
          'grade-2 data and time instruction bank',
          'Instruction verb is introduced only after the Russian calculation strategy.',
        ),
        first_use_stage: 'bridge-data-et',
        reuse_stage_refs: ['solve-approved-tasks'],
      })),
      recycled_instruction_verbs_et: [],
      model_sentences: [{
        text_et: 'Kokku on kümme minutit.',
        translation_ru: 'Всего десять минут.',
        terms_et: ['kokku', 'minut'],
        provenance: provenance(
          'author_created_bridge',
          'grade-2 data and time oral model',
          'Original model uses data different from both approved integrated tasks.',
        ),
      }],
      sentence_frames: [{
        frame_id: 'data-result-frame',
        frame_et: 'Kokku on ___ minutit.',
        purpose_ru: 'Рамка поддерживает одну короткую фразу после полного русского вычисления.',
        stage_refs: ['bridge-data-et', 'assess-data-separately'],
        provenance: provenance(
          'author_created_bridge',
          'grade-2 data result frame',
          'Original A1-A2 frame remains separate from mathematics assessment.',
        ),
      }],
      expected_receptive_language_et: ['Võrdle arve.', 'Liida ajad.', 'Ütle üks lause.'],
      expected_supported_productive_language_et: ['Kõige rohkem on ___.', 'Kokku on ___ minutit.'],
      expected_independent_productive_language_et: ['Kokku on ___ minutit.'],
      full_expected_answer_ru: 'Ученик правильно находит максимум и минимум осадков, вычисляет разность, складывает две длительности и показывает равенство шестидесяти минут одному часу.',
      short_expected_oral_answer_et: 'Kokku on ___ minutit.',
      oral_output_terms_et: ['kokku', 'minut'],
    },
    cognitiveLoad: {
      new_subject_concepts: 2,
      new_estonian_terms: 4,
      new_instruction_verbs: 2,
      new_sentence_structures: 1,
      independent_output_sentences: 1,
      rationale: 'Русский язык сохраняет полную вычислительную нагрузку; эстонская продукция ограничена одной фразой.',
    },
    scaffolds: [
      {
        scaffold_id: 'data-russian-explanation',
        type: 'russian_explanation',
        description_ru: 'Учитель по-русски моделирует оба алгоритма без раскрытия ответов индивидуальных задач.',
        stage_refs: ['explain-data-time-ru'],
        release: {
          at_stage: 'solve-approved-tasks',
          how_reduced_ru: 'Во время первой попытки остаются только нейтральные шаги стратегии.',
        },
        provenance: provenance(
          'author_created_explanation',
          'grade-2 data and time standalone explanation',
          'Original Russian explanation precedes and preserves full independent calculations.',
        ),
      },
      {
        scaffold_id: 'data-word-bank',
        type: 'word_bank',
        description_ru: 'Четыре новых слова и повторяемое ilm остаются видимыми без готового ответа.',
        stage_refs: ['bridge-data-et', 'solve-approved-tasks'],
        release: {
          at_stage: 'assess-data-separately',
          how_reduced_ru: 'На выходе ученик самостоятельно выбирает одну из двух рамок.',
        },
        provenance: provenance(
          'author_created_bridge',
          'grade-2 data and time word bank',
          'Original bounded word bank does not alter either approved task projection.',
        ),
      },
      {
        scaffold_id: 'data-sentence-frame',
        type: 'sentence_frame',
        description_ru: 'Рамка поддерживает один краткий устный отчёт после вычисления.',
        stage_refs: ['bridge-data-et', 'assess-data-separately'],
        release: {
          at_stage: 'assess-data-separately',
          how_reduced_ru: 'Ученик сам выбирает число из собственной завершённой работы.',
        },
        provenance: provenance(
          'author_created_bridge',
          'grade-2 data result frame',
          'Original frame keeps the oral output separate from the task-bank answer contract.',
        ),
      },
    ],
    multimodalSupport: [{
      support_id: 'weather-data-table-support',
      type: 'table',
      stage_refs: ['solve-approved-tasks'],
      material_ref: 'g2-weather-data-comparison-task',
      provenance: provenance(
        'author_created_task_set',
        'g2-weather-data-comparison-task',
        'Approved learner table supplies the exact four-value data comparison projection.',
      ),
    }],
    questions: [{
      question_id: 'data-strategy-question',
      question_ru: 'Как проверить, что для разности выбраны самое большое и самое маленькое значения?',
      question_et: 'Kuidas sa arve võrdled?',
      full_expected_answer_ru: 'Нужно сравнить все четыре значения, отметить максимум и минимум, затем вычесть минимум из максимума.',
      short_oral_answer_et: 'Kõige rohkem on ___.',
      acceptable_variants: ['Допустим любой верный способ сравнения всех четырёх значений.'],
      misconception_to_watch: 'Ученик сравнивает максимум только с соседним или вторым по величине значением.',
      objective_refs: ['solve-weather-data-and-time', 'say-one-data-frame-et'],
      provenance_refs: ['g2-weather-data-comparison-task'],
    }],
    practicalWork: null,
    assessment: [
      ['data-time-subject', 'subject_understanding', 'Максимум, минимум, разность, сложение длительностей и перевод единицы.', 'Два индивидуальных решения с действиями и единицами.', 'Обе задачи решены с показанными действиями.', 'subject_assessment'],
      ['data-et-recognition', 'estonian_terminology_recognition', 'Различение слов millimeeter, minut, tund и kokku.', 'Указание правильного слова по значению.', 'Не менее трёх из четырёх слов.', 'language_assessment'],
      ['data-et-supported', 'supported_estonian_production', 'Использование одной видимой рамки с собственным результатом.', 'Короткая фраза после завершения математики.', 'Одна понятная поддержанная фраза.', 'language_assessment'],
      ['data-et-independent', 'independent_estonian_production', 'Самостоятельный выбор уместной рамки для результата.', 'Индивидуальная устная фраза на выходе.', 'Уместная рамка выбрана без подсказки ответа.', 'language_assessment'],
    ].map(([criterion_id, domain, what_is_checked, acceptable_evidence, success_threshold, affects]) => ({
      criterion_id,
      domain,
      what_is_checked,
      acceptable_evidence,
      success_threshold,
      affects,
    })),
    homework: {
      content_task_ru: 'Обязательного домашнего задания нет; по указанию учителя можно проверить единицы в своих двух решениях.',
      estonian_language_component: 'При желании один раз прочитать выбранную короткую рамку.',
      expected_minutes: 5,
      source_reference: 'g2-weather-data-time-explanation',
      required_opiq_url: null,
      adult_support_expected: false,
      success_guidance_ru: 'Повторная проверка не требует Opiq, новых данных или раскрытия teacher-only guidance.',
      provenance: provenance(
        'author_created_worksheet',
        'grade-2 data and time optional consolidation',
        'No required home work or Opiq access is introduced by this lesson.',
      ),
    },
    commercialCore: {
      explanation_material_ids: ['g2-weather-data-time-explanation'],
      worked_example_material_ids: ['g2-weather-data-time-worked-example'],
      task_material_ids: ['g2-weather-data-comparison-task', 'g2-time-measurement-problem-task'],
      expected_answer_material_ids: [
        'g2-weather-data-comparison-expected-answers',
        'g2-time-measurement-problem-expected-answers',
      ],
      worked_solution_material_ids: [
        'g2-weather-data-comparison-worked-solution',
        'g2-time-measurement-problem-worked-solution',
      ],
      assessment_material_ids: ['g2-weather-data-time-assessment'],
      assessment_criterion_ids: ['data-time-subject', 'data-et-independent'],
      learner_output_refs: ['solve-weather-data-and-time', 'data-strategy-question'],
      success_criteria_refs: ['subject-two-correct-solutions', 'language-one-data-sentence'],
      task_contracts: [
        {
          task_material_id: 'g2-weather-data-comparison-task',
          response_mode: 'computational',
          open_ended: false,
          expected_answer_material_ids: ['g2-weather-data-comparison-expected-answers'],
          worked_solution_material_ids: ['g2-weather-data-comparison-worked-solution'],
        },
        {
          task_material_id: 'g2-time-measurement-problem-task',
          response_mode: 'computational',
          open_ended: false,
          expected_answer_material_ids: ['g2-time-measurement-problem-expected-answers'],
          worked_solution_material_ids: ['g2-time-measurement-problem-worked-solution'],
        },
      ],
    },
    originalityRefs: [
      'task-bank/reviews/grade-2/weather-water-safety/03-weather-data-comparison.yaml',
      'task-bank/reviews/grade-2/weather-water-safety/04-time-measurement-problem.yaml',
      'a450745bbd382c4758d7cbc96f998b27db76288e',
    ],
    integrationOptions: {
      purpose: 'map_or_data_interpretation',
      contentTypes: ['data_table', 'word_problem'],
      requiredCapabilities: ['data_interpretation', 'calculation'],
      contextFlags: { practical: false, map_or_data: true, retrieval: true, assessment: true },
      guideMaterialId: 'g2-weather-data-time-lesson-guide',
      primaryStudentMaterialId: 'g2-weather-data-comparison-task',
    },
  });
}

export function buildGrade2WeatherWaterSafetyLessons() {
  return [buildLesson1(), buildLesson2()];
}

function buildMaterialsIndex(lessons) {
  const lessonEntries = lessons.flatMap((lesson) => (
    lesson.evidence_linkage.author_materials.map((entry) => ({
      lesson_ids: [lesson.lesson_id],
      required_for_pack: true,
      material: entry,
    }))
  ));
  const bothLessonIds = lessons.map((lesson) => lesson.lesson_id);
  const lesson2Id = lessons.find((lesson) => lesson.position_in_unit === 2)?.lesson_id;
  const sharedEntries = [
    material({
      id: 'g2-weather-water-pack-overview',
      title: 'Внутренний обзор teacher pack',
      type: 'pack_overview',
      artifactPath: `${packRoot}/teacher/pack-overview.md`,
      audience: 'shared',
      languages: ['ru', 'et'],
      category: 'author_created_bridge',
      sourceReference: moduleId,
      notes: 'Internal overview states the two-authored and two-planned lesson boundary.',
    }),
    material({
      id: 'g2-weather-water-teacher-guide',
      title: 'Общее руководство учителя',
      type: 'teacher_guide',
      artifactPath: `${packRoot}/teacher/pack-overview.md`,
      audience: 'teacher',
      languages: ['ru', 'et'],
      category: 'author_created_explanation',
      sourceReference: moduleId,
      notes: 'Internal guide records standalone delivery and the incomplete module boundary.',
    }),
    material({
      id: 'g2-weather-water-rubric',
      title: 'Rubric индивидуальных доказательств',
      type: 'rubric',
      artifactPath: `${packRoot}/teacher/assessment-rubric.md`,
      audience: 'teacher',
      languages: ['ru', 'et'],
      category: 'author_created_assessment',
      sourceReference: moduleId,
      notes: 'Original rubric separates subject, calculation, and Estonian-language evidence.',
    }),
    material({
      id: 'g2-weather-water-parent-guide',
      title: 'Памятка о материалах, времени и роли взрослого',
      type: 'parent_guide',
      artifactPath: `${packRoot}/parent/materials-time-guide.md`,
      audience: 'parent',
      languages: ['ru'],
      category: 'author_created_bridge',
      sourceReference: moduleId,
      notes: 'Internal parent note sets time, supervision, and no-home-readiness boundaries.',
    }),
    material({
      id: 'g2-weather-water-homeschool-guide',
      title: 'Ограниченная памятка для возможной домашней адаптации',
      type: 'homeschool_guide',
      artifactPath: `${packRoot}/parent/materials-time-guide.md`,
      audience: 'parent',
      languages: ['ru'],
      category: 'author_created_bridge',
      sourceReference: moduleId,
      notes: 'Required index role explicitly states that no home trial or home-ready status exists.',
    }),
    material({
      id: 'g2-weather-water-answer-key',
      title: 'Teacher-only answer guidance',
      type: 'answer_key',
      artifactPath: `${packRoot}/answers/lesson-02-answer-guidance.md`,
      audience: 'teacher',
      languages: ['ru'],
      category: 'author_created_expected_answers',
      sourceReference: 'g2-weather-data-comparison-task; g2-time-measurement-problem-task',
      notes: 'Teacher-only answer key is separated from all learner-facing task files.',
    }),
  ].map((entry) => ({
    lesson_ids: entry.material_id === 'g2-weather-water-answer-key'
      ? [lesson2Id]
      : bothLessonIds,
    required_for_pack: true,
    material: entry,
  }));
  return {
    schema_version: '1.2',
    artifact_type: 'teacher_pack_materials_index',
    pack_id: 'grade-2-weather-water-safety-teacher-pack',
    unit_ref: moduleId,
    pack_path: packRoot,
    grade: 2,
    subject: 'integrated_project',
    subject_et: 'lõimitud projekt',
    instruction_language: 'ru',
    subject_support_language: 'et',
    canonical_route: {
      source_id: 'grade-2-science',
      md_path: 'project-files/outputs/opiq_2klass_loodusopetus.md',
      source_archive: 'project-files/inputs/final-zips/opiq_2klass_loodus_ja_inimeseopetus_2_klassile_v2.zip',
      qa_path: 'project-files/outputs/opiq_2klass_loodusopetus_qa.json',
    },
    lesson_ids: bothLessonIds,
    opiq_sources: [],
    reviewable_content: {
      specification_version: '1.0',
      explicit_paths: [
        'grade-programmes/grade-2/pilot-modules/weather-water-safety.yaml',
        outputPaths.lesson1,
        outputPaths.lesson2,
      ],
      directory_paths: [
        `${packRoot}/student`,
        `${packRoot}/teacher`,
        `${packRoot}/answers`,
        `${packRoot}/parent`,
      ],
      derived_material_paths: true,
    },
    pedagogical_review: {
      guide_path: `${packRoot}/review-templates/review-guide.md`,
      template_path: `${packRoot}/review-templates/teacher-review-template.yaml`,
      review_record_paths: [],
      classroom_status: 'pending',
      homeschool_status: 'pending',
      status: 'pending',
    },
    classroom_trial: {
      template_path: `${packRoot}/review-templates/classroom-trial-template.yaml`,
      trial_record_paths: [],
      status: 'not_tested',
    },
    home_trial: {
      template_path: `${packRoot}/review-templates/home-trial-template.yaml`,
      trial_record_paths: [],
      status: 'not_started',
    },
    readiness: { report_path: null },
    materials: [...sharedEntries, ...lessonEntries],
  };
}

function serialize(value) {
  return YAML.stringify(value, { aliasDuplicateObjects: false, lineWidth: 120 });
}

export async function generatedLessonFiles(rootDir = process.cwd()) {
  const lessons = buildGrade2WeatherWaterSafetyLessons();
  const [lesson1, lesson2] = lessons;
  return new Map([
    [outputPaths.lesson1, serialize(lesson1)],
    [outputPaths.lesson2, serialize(lesson2)],
    [outputPaths.materialsIndex, serialize(buildMaterialsIndex(lessons))],
  ]);
}

export async function writeGeneratedLessons(rootDir = process.cwd()) {
  const files = await generatedLessonFiles(rootDir);
  for (const [repositoryPath, content] of files) {
    const absolutePath = path.join(rootDir, repositoryPath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, 'utf8');
  }
  return files;
}

export async function checkGeneratedLessons(rootDir = process.cwd()) {
  const files = await generatedLessonFiles(rootDir);
  const stale = [];
  for (const [repositoryPath, expected] of files) {
    let actual = null;
    try {
      actual = await fs.readFile(path.join(rootDir, repositoryPath), 'utf8');
    } catch {
      // Reported as stale below.
    }
    if (actual !== expected) stale.push(repositoryPath);
  }
  return stale;
}

const isEntrypoint = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  const check = process.argv.includes('--check');
  const write = process.argv.includes('--write');
  if (check === write) {
    console.error('Usage: node scripts/generate-grade-2-weather-water-safety-pilot.mjs (--check | --write)');
    process.exitCode = 2;
  } else if (write) {
    const files = await writeGeneratedLessons();
    console.log(`Wrote ${files.size} Grade 2 weather/water pilot generated files.`);
  } else {
    const stale = await checkGeneratedLessons();
    if (stale.length > 0) {
      console.error(`Generated Grade 2 weather/water pilot lessons are stale: ${stale.join(', ')}`);
      process.exitCode = 1;
    } else {
      console.log('Generated Grade 2 weather/water pilot lessons are current.');
    }
  }
}
