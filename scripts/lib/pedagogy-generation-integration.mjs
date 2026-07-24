import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { stringify } from 'yaml';
import {
  parseStrictCurriculumYaml,
  safeRepositoryPath,
} from './curriculum-maps.mjs';
import {
  loadPedagogySelectionRepository,
  selectLessonPedagogy,
  serializePedagogyYaml,
  sha256PedagogyValue,
  stablePedagogyJson,
} from './pedagogy-selection.mjs';
import {
  adaptLessonForHomeschool,
  loadPedagogyHomeschoolRepository,
  serializeHomeschoolYaml,
} from './pedagogy-homeschool.mjs';

export const PEDAGOGY_INTEGRATION_VERSION = '1.0';
export const WATER_PILOT_UNIT_ID = 'grade-5-water-four-lesson-plan';
export const WATER_PILOT_PACK = 'teacher-packs/grade-5-science/water';
export const WATER_PILOT_LESSONS = [
  'lesson-plans/grade-5-science/water/lesson-01.yaml',
  'lesson-plans/grade-5-science/water/lesson-02.yaml',
  'lesson-plans/grade-5-science/water/lesson-03.yaml',
  'lesson-plans/grade-5-science/water/lesson-04.yaml',
];
export const WATER_PILOT_THEMATIC =
  'lesson-plans/grade-5-science/water/thematic-plan.yaml';
export const WATER_PILOT_INDEX =
  'teacher-packs/grade-5-science/water/materials-index.yaml';

const SET_KEYS = new Set([
  'acceptable_variants',
  'curriculum_outcome_refs',
  'instructional_roles',
  'language_functions',
  'languages',
  'lesson_ids',
  'objective_refs',
  'official_outcome_refs',
  'oral_output_terms_et',
  'provenance_refs',
  'safety_requirements',
  'terms_et',
]);

function compareBytewise(left, right) {
  return Buffer.from(String(left)).compare(Buffer.from(String(right)));
}

function sorted(values) {
  return [...values].sort(compareBytewise);
}

function uniqueSorted(values) {
  return sorted([...new Set(values)]);
}

function stableContentValue(value, key = '') {
  if (Array.isArray(value)) {
    const result = value.map((item) => stableContentValue(item));
    return SET_KEYS.has(key)
      ? result.sort((left, right) => compareBytewise(
        JSON.stringify(left),
        JSON.stringify(right),
      ))
      : result;
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort(compareBytewise)
    .map((childKey) => [childKey, stableContentValue(value[childKey], childKey)]));
}

function contentDigest(value) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(stableContentValue(value)))
    .digest('hex');
}

export function lessonContentProjection(lesson) {
  return {
    specification_version: '1.0',
    lesson_id: lesson.lesson_id,
    unit_ref: lesson.unit_ref,
    canonical_route: lesson.canonical_route,
    source_evidence: (lesson.evidence_linkage?.opiq_records ?? []).map((record) => ({
      record_id: record.record_id,
      canonical_url: record.canonical_url,
      canonical_source_id: record.canonical_source_id,
      book_id: record.book_id,
      language: record.language,
      programme_type: record.programme_type,
      instructional_roles: record.instructional_roles,
      provenance: record.provenance,
    })),
    content_objectives: lesson.objectives?.content_objectives,
    subject_success_criteria: lesson.objectives?.subject_success_criteria,
    estonian_language_objectives: lesson.objectives?.estonian_language_objectives,
    estonian_success_criteria: lesson.objectives?.estonian_success_criteria,
    anticipated_misconceptions: lesson.objectives?.anticipated_misconceptions,
    questions: (lesson.questions ?? []).map((question) => ({
      question_id: question.question_id,
      question_ru: question.question_ru,
      question_et: question.question_et,
      full_expected_answer_ru: question.full_expected_answer_ru,
      short_oral_answer_et: question.short_oral_answer_et,
      acceptable_variants: question.acceptable_variants,
      misconception_to_watch: question.misconception_to_watch,
      objective_refs: question.objective_refs,
      provenance_refs: question.provenance_refs,
    })),
    language_policy: {
      instruction_language: lesson.instruction_language,
      subject_support_language: lesson.subject_support_language,
      learner_language_level: lesson.learner_language_profile?.learner_language_level,
      assessment_policy: lesson.methodology?.content_language_assessment_policy,
      full_expected_answer_ru: lesson.language_load?.full_expected_answer_ru,
      short_expected_oral_answer_et: lesson.language_load?.short_expected_oral_answer_et,
      oral_output_terms_et: lesson.language_load?.oral_output_terms_et,
    },
    practical_science: lesson.practical_work
      ? {
        work_id: lesson.practical_work.work_id,
        safety_requirements: lesson.practical_work.safety_requirements,
        materials: lesson.practical_work.materials,
        steps: lesson.practical_work.steps,
        expected_observations: lesson.practical_work.expected_observations,
        expected_conclusion_ru: lesson.practical_work.expected_conclusion_ru,
      }
      : null,
    assessment: lesson.assessment,
  };
}

export function computeLessonContentIdentity(lesson) {
  return {
    specification_version: '1.0',
    algorithm: 'sha256',
    value: contentDigest(lessonContentProjection(lesson)),
  };
}

export function unitContentProjection(thematic, lessonIdentities) {
  return {
    specification_version: '1.0',
    unit_id: thematic.unit_id,
    canonical_route: thematic.canonical_route,
    selected_opiq_sources: (thematic.selected_opiq_sources ?? []).map((source) => ({
      record_id: source.record_id,
      canonical_url: source.canonical_url,
      language: source.language,
      instructional_roles: source.instructional_roles,
      provenance: source.provenance,
    })),
    unit_learning_outcomes: thematic.unit_learning_outcomes,
    unit_content_success_criteria: thematic.unit_content_success_criteria,
    unit_estonian_language_targets: thematic.unit_estonian_language_targets,
    cumulative_glossary: thematic.cumulative_glossary,
    lesson_content_identities: sorted([...lessonIdentities.entries()])
      .map(([lessonId, identity]) => ({
        lesson_id: lessonId,
        content_identity: identity,
      })),
  };
}

export function computeUnitContentIdentity(thematic, lessonIdentities) {
  return {
    specification_version: '1.0',
    algorithm: 'sha256',
    value: contentDigest(unitContentProjection(thematic, lessonIdentities)),
  };
}

async function readYaml(rootDir, repositoryPath) {
  const filePath = safeRepositoryPath(rootDir, repositoryPath, repositoryPath);
  return parseStrictCurriculumYaml(await fs.readFile(filePath, 'utf8'), repositoryPath);
}

function retrievalWindows(selectionInput) {
  return (selectionInput.future_retrieval_windows ?? []).map((entry) => ({
    ...entry.window,
    capability: entry.capability,
  }));
}

export function buildIntegratedSelectionRequest(lesson) {
  const input = lesson.pedagogical_integration.selection_input;
  const supportRoles = [
    'familiar_instruction',
    'labels',
    'sentence_frame',
    'short_oral_response',
    'short_written_response',
    'terminology',
  ];
  return {
    schema_version: '1.0',
    artifact_type: 'pedagogical_selection_request',
    request_id: `${lesson.lesson_id}-classroom-selection`,
    learner_context: {
      grade: lesson.grade,
      subject: lesson.subject,
      delivery_mode: 'classroom',
      group_size: input.delivery.group_size,
      supported_group_formats: input.delivery.supported_group_formats,
      lesson_duration_minutes: lesson.duration_minutes,
      study_context: 'classroom',
    },
    lesson_context: {
      purpose: input.purpose,
      content_types: input.content_types,
      required_capabilities: input.required_capabilities,
      desired_capabilities: input.desired_capabilities,
      phase_needs: input.phase_needs,
      context_flags: input.context_flags,
      previous_target_ids: [],
      future_retrieval_windows: retrievalWindows(input),
      required_pattern_id: input.preferences.required_pattern_id,
    },
    language_profile: {
      primary_instruction_language: lesson.instruction_language,
      maximum_total_productive_language_demand:
        input.maximum_total_productive_language_demand,
      estonian_support: {
        enabled: true,
        language: lesson.subject_support_language,
        learner_level: lesson.learner_language_profile.learner_language_level,
        allowed_roles: supportRoles,
        subject_explanation_language: 'ru',
        sentence_frames_required: true,
        word_bank_required: true,
        assessment_requested: lesson.assessment.some((row) => row.domain === 'estonian_language'),
      },
    },
    resources: input.resources,
    constraints: input.constraints,
    preferences: {
      preferred_pattern_ids: [input.preferences.required_pattern_id],
      preferred_target_ids: input.preferences.preferred_target_ids,
      excluded_target_ids: input.preferences.excluded_target_ids,
      avoid_recent_target_ids: [],
      preferred_group_formats: input.preferences.preferred_group_formats,
      teacher_overrides: input.preferences.teacher_overrides.map((override) => ({
        ...override,
        author_role: 'teacher',
      })),
    },
  };
}

function selectionResultOrThrow(repository, lesson) {
  const request = buildIntegratedSelectionRequest(lesson);
  const result = selectLessonPedagogy(repository, request);
  if (!result.lessonDna) {
    const details = result.decision.failure?.details?.join('; ') ?? 'unknown failure';
    throw new Error(
      `${lesson.lesson_id} selection failed: ${result.decision.failure?.code}: ${details}`,
    );
  }
  return { request, ...result };
}

function bindingByPhase(lesson) {
  return new Map(lesson.pedagogical_integration.phase_bindings
    .map((binding) => [binding.dna_phase_id, binding]));
}

export function reconcileLessonTiming(lesson, lessonDna) {
  const stages = new Map(lesson.stages.map((stage) => [stage.stage_id, stage]));
  const bindings = bindingByPhase(lesson);
  const usedStages = new Map();
  const phaseRows = lessonDna.phases.map((phase) => {
    const binding = bindings.get(phase.phase_id);
    if (!binding) throw new Error(`${lesson.lesson_id}: unrendered DNA phase ${phase.phase_id}`);
    let linkedStageMinutes = 0;
    for (const stageId of binding.lesson_stage_ids) {
      const stage = stages.get(stageId);
      if (!stage) throw new Error(`${lesson.lesson_id}: unknown stage ${stageId}`);
      if (usedStages.has(stageId)) {
        throw new Error(
          `${lesson.lesson_id}: stage ${stageId} is bound to both `
          + `${usedStages.get(stageId)} and ${phase.phase_id}`,
        );
      }
      usedStages.set(stageId, phase.phase_id);
      linkedStageMinutes += stage.duration_minutes;
    }
    if (linkedStageMinutes < phase.activity_minutes) {
      throw new Error(
        `${lesson.lesson_id}: phase ${phase.phase_id} has ${linkedStageMinutes} bound `
        + `minutes below activity minimum ${phase.activity_minutes}`,
      );
    }
    return {
      phase_id: phase.phase_id,
      target_id: phase.target.target_id,
      lesson_stage_ids: binding.lesson_stage_ids,
      activity_minutes: phase.activity_minutes,
      setup_minutes: phase.setup_minutes,
      cleanup_minutes: phase.cleanup_minutes,
      transition_minutes: phase.transition_minutes,
      linked_stage_minutes: linkedStageMinutes,
      source_access_policy: binding.source_access_policy,
      status: 'reconciled',
    };
  });
  const declaredStageTotal = lesson.stages
    .reduce((sum, stage) => sum + stage.duration_minutes, 0);
  if (declaredStageTotal !== lesson.duration_minutes) {
    throw new Error(
      `${lesson.lesson_id}: stage total ${declaredStageTotal} does not equal `
      + `${lesson.duration_minutes}`,
    );
  }
  const declaredNonDna = new Set(
    lesson.pedagogical_integration.non_dna_stage_roles.map((row) => row.lesson_stage_id),
  );
  const unbound = lesson.stages
    .map((stage) => stage.stage_id)
    .filter((stageId) => !usedStages.has(stageId));
  for (const stageId of unbound) {
    if (!declaredNonDna.has(stageId)) {
      throw new Error(`${lesson.lesson_id}: unbound stage ${stageId} lacks non-DNA rationale`);
    }
  }
  for (const stageId of declaredNonDna) {
    if (!stages.has(stageId)) throw new Error(`${lesson.lesson_id}: unknown non-DNA stage ${stageId}`);
    if (usedStages.has(stageId)) throw new Error(`${lesson.lesson_id}: bound stage ${stageId} is also non-DNA`);
  }
  if (!lessonDna.timing.fits || lessonDna.timing.total_planned_minutes > lesson.duration_minutes) {
    throw new Error(`${lesson.lesson_id}: selected DNA does not fit 45 minutes`);
  }
  return {
    lesson_id: lesson.lesson_id,
    lesson_duration_minutes: lesson.duration_minutes,
    declared_stage_total_minutes: declaredStageTotal,
    dna_total_planned_minutes: lessonDna.timing.total_planned_minutes,
    dna_unallocated_minutes: lessonDna.timing.unallocated_minutes,
    phases: phaseRows,
    non_dna_stage_roles: lesson.pedagogical_integration.non_dna_stage_roles,
    status: 'reconciled',
  };
}

function contentBindingsForHomeschool(lesson, lessonDna) {
  const bindings = bindingByPhase(lesson);
  return lessonDna.phases.map((phase) => {
    const binding = bindings.get(phase.phase_id);
    const practical = phase.phase_id === 'practical-work'
      || phase.phase_id === 'safety-orientation';
    const needsAnswer = [
      'conclusion',
      'correction',
      'evidence-check',
      'formative-check',
      'guided-practice',
      'retrieval',
    ].includes(phase.phase_id);
    return {
      phase_id: phase.phase_id,
      learner_material_refs: binding.student_material_ids.length
        ? binding.student_material_ids
        : binding.teacher_material_ids,
      task_refs: [`${lesson.lesson_id}/${phase.phase_id}-task`],
      answer_key_refs: needsAnswer ? binding.answer_key_material_ids : [],
      teacher_explanation_refs: binding.teacher_material_ids,
      estonian_support_refs: binding.oral_answer_refs,
      procedure_refs: practical ? [`${lesson.lesson_id}/approved-procedure`] : [],
      safety_refs: practical ? [`${lesson.lesson_id}/safety-controls`] : [],
    };
  });
}

function adaptationContext(lesson) {
  const input = lesson.pedagogical_integration.selection_input;
  const homeschool = input.homeschool;
  const resources = structuredClone(input.resources);
  resources.adult_safety_supervision_available =
    homeschool.adult_context.safety_supervision_available;
  return {
    variant: homeschool.variant,
    learner_count: homeschool.learner_count,
    learner_session_minutes: homeschool.learner_session_minutes,
    maximum_sessions: homeschool.maximum_sessions,
    maximum_total_productive_language_demand:
      homeschool.maximum_total_productive_language_demand,
    resources,
    adult_context: structuredClone(homeschool.adult_context),
    accessibility_priorities: input.constraints.accessibility_priorities,
    answer_access_policy: {
      first_attempt_without_answer: true,
      key_release: homeschool.answer_key_release,
      corrections_visible: true,
      correction_method: 'separate_colour',
      unresolved_question_recorded: true,
    },
    teacher_override_policy: 'require_preservation',
    limited_adaptation_policy: 'allow_with_warning',
    homeschool_preferences: {
      preferred_target_ids: [],
      excluded_target_ids: [],
    },
  };
}

function buildHomeschoolRequest(lesson, selectionRequest, lessonDna) {
  return {
    schema_version: '1.0',
    artifact_type: 'homeschool_adaptation_request',
    request_id: `${lesson.lesson_id}-homeschool-adaptation`,
    source: {
      selection_request: selectionRequest,
      lesson_dna: lessonDna,
    },
    adaptation_context: adaptationContext(lesson),
    content_bindings: contentBindingsForHomeschool(lesson, lessonDna),
  };
}

function markdownEscaped(value) {
  return String(value ?? '').replace(/\|/gu, '\\|').trim();
}

function targetNameRu(selectionRepository, targetId) {
  const [activityId, profileId = null] = targetId.split('::');
  const activity = selectionRepository.knowledge.activities.data.activities
    .find((candidate) => candidate.activity_id === activityId);
  if (!activity) throw new Error(`unknown selected activity ${activityId}`);
  if (!profileId) return activity.names.ru;
  const profile = activity.execution_profiles
    ?.find((candidate) => candidate.profile_id === profileId);
  if (!profile) throw new Error(`unknown selected execution profile ${targetId}`);
  return profile.names.ru;
}

function teacherRegion(lesson, lessonDna, reconciliation, selectionRepository) {
  const rows = lessonDna.phases.map((phase) => {
    const timing = reconciliation.phases.find((row) => row.phase_id === phase.phase_id);
    return `| ${phase.phase_id} | ${targetNameRu(selectionRepository, phase.target.target_id)} | `
      + `\`${phase.target.target_id}\` | `
      + `${timing.lesson_stage_ids.join(', ')} | ${phase.activity_minutes} + `
      + `${phase.setup_minutes} setup + ${phase.cleanup_minutes} cleanup | `
      + `${phase.source_access.first_attempt} |`;
  });
  const rationales = lessonDna.phases.map((phase) => (
    `- **${phase.phase_id}:** ${phase.rationale_ru}`
  ));
  return [
    '## Сгенерированная педагогическая структура',
    '',
    `Паттерн: **${lessonDna.pattern.pattern_id}**. Это операционное предложение,`,
    'которое ожидает независимого педагогического ревью и не является заявлением об эффективности.',
    '',
    '| DNA phase | Метод | Target ID | Стадии урока | Время | Источник при первой попытке |',
    '|---|---|---|---|---:|---|',
    ...rows,
    '',
    '### Обоснование выбора',
    '',
    ...rationales,
    '',
    'Действия учителя, ожидаемое свидетельство ученика, безопасность,',
    'дифференциация и оценивание остаются в связанных стадиях этого руководства;',
    'генератор не заменяет их новой научной формулировкой.',
    '',
    'Сложное предметное объяснение остаётся русскоязычным. Эстонский ограничен',
    'терминами, подписями, знакомыми инструкциями, рамками и коротким ответом A1–A2.',
  ].join('\n');
}

function studentRegion(lesson, lessonDna) {
  const question = lesson.questions[0];
  return [
    '## Самостоятельная попытка и исправление',
    '',
    '1. Закрой учебник и ключ. Запиши или скажи свой первый ответ.',
    `2. Ответь по-русски: **${markdownEscaped(question.question_ru)}**`,
    '3. После первой попытки открой ключ, сравни и исправь неточность другим цветом.',
    `4. Коротко по-эстонски: **${markdownEscaped(question.question_et)}**`,
    '',
    `Первая попытка выполняется без ответа. Выбранная структура содержит `
      + `${lessonDna.phases.length} проверяемых этапа(ов), но технические названия ребёнку не нужны.`,
  ].join('\n');
}

function taskBindings(lesson, lessonDna, materialsIndex) {
  const materials = new Map(materialsIndex.materials.map((entry) => [
    entry.material.material_id,
    entry.material,
  ]));
  const bindings = bindingByPhase(lesson);
  return lessonDna.phases.map((phase) => {
    const binding = bindings.get(phase.phase_id);
    const studentMaterial = materials.get(binding.student_material_ids[0]);
    const answerMaterial = materials.get(binding.answer_key_material_ids[0]);
    if (!studentMaterial?.artifact_path) {
      throw new Error(`${lesson.lesson_id}: ${phase.phase_id} lacks student artifact path`);
    }
    if (!answerMaterial?.artifact_path) {
      throw new Error(`${lesson.lesson_id}: ${phase.phase_id} lacks answer-key artifact path`);
    }
    return {
      task_id: `${lesson.lesson_id}/${phase.phase_id}-task`,
      lesson_id: lesson.lesson_id,
      phase_id: phase.phase_id,
      target_id: phase.target.target_id,
      student_artifact_path: studentMaterial.artifact_path,
      answer_key_artifact_path: answerMaterial.artifact_path,
      source_access_policy: binding.source_access_policy,
      answer_access_policy: 'after_first_attempt',
      assessment_refs: binding.assessment_refs,
      oral_answer_refs: binding.oral_answer_refs,
    };
  });
}

function answerRegion(lesson, generatedTaskBindings) {
  const question = lesson.questions[0];
  const taskRows = generatedTaskBindings.map((binding) => (
    `| \`${binding.task_id}\` | \`${binding.phase_id}\` | `
    + `\`${binding.target_id}\` | \`${binding.student_artifact_path}\` | `
    + `\`${binding.answer_key_artifact_path}\` | ${binding.answer_access_policy} |`
  ));
  return [
    '## Сгенерированная привязка попытки и ключа',
    '',
    '| Task ID | Phase ID | Target ID | Student artifact | Answer key | Доступ к ключу |',
    '|---|---|---|---|---|---|',
    ...taskRows,
    '',
    `Lesson ID: \`${lesson.lesson_id}\`. Доступ к ключу разрешён только после`,
    'самостоятельной первой попытки.',
    '',
    `Правильный предметный ответ: ${question.full_expected_answer_ru}`,
    '',
    `Допустимый короткий эстонский ответ: ${question.short_oral_answer_et}`,
    '',
    `Типичная ошибка: ${question.misconception_to_watch}`,
    '',
    'Предметное понимание оценивается по научному смыслу русского ответа. Качество',
    'эстонской формы фиксируется отдельно и не снижает предметный результат автоматически.',
  ].join('\n');
}

export function applyGeneratedRegion(source, regionId, body) {
  const begin = `<!-- OPIQ-PEDAGOGY:BEGIN ${regionId} -->`;
  const end = `<!-- OPIQ-PEDAGOGY:END ${regionId} -->`;
  const beginCount = source.split(begin).length - 1;
  const endCount = source.split(end).length - 1;
  if (beginCount > 1 || endCount > 1) throw new Error(`duplicate generated region ${regionId}`);
  if (beginCount !== endCount) throw new Error(`broken generated region ${regionId}`);
  const region = `${begin}\n${body.trim()}\n${end}`;
  if (beginCount === 0) {
    if (/<!-- OPIQ-PEDAGOGY:(?:BEGIN|END)/u.test(source)) {
      const opens = source.match(/<!-- OPIQ-PEDAGOGY:BEGIN/gu)?.length ?? 0;
      const closes = source.match(/<!-- OPIQ-PEDAGOGY:END/gu)?.length ?? 0;
      if (opens !== closes) throw new Error('broken generated region outside requested marker');
    }
    return `${source.trimEnd()}\n\n${region}\n`;
  }
  const start = source.indexOf(begin);
  const finish = source.indexOf(end, start);
  if (finish < start) throw new Error(`nested or reversed generated region ${regionId}`);
  return `${source.slice(0, start)}${region}${source.slice(finish + end.length)}`;
}

function oralStudentMarkdown(lessons) {
  const blocks = lessons.map((lesson) => {
    const question = lesson.questions[0];
    return [
      `## Урок ${lesson.position_in_unit}: ${lesson.title_ru}`,
      '',
      `Вопрос: ${question.question_ru}`,
      '',
      'Моя первая попытка по-русски:',
      '',
      '__________________________________________________________________',
      '',
      `Короткий вопрос по-эстонски: ${question.question_et}`,
      '',
      'Мой короткий ответ:',
      '',
      '__________________________________________________________________',
      '',
      `Слова для подготовки: ${lesson.language_load.oral_output_terms_et.join(', ')}.`,
      '',
      'После первой попытки попроси ключ, сравни смысл и исправь неточность другим цветом.',
    ].join('\n');
  });
  return [
    '# Подготовка устного ответа: блок «Вода»',
    '',
    'Сначала отвечай без ключа. Полное научное объяснение дай по-русски;',
    'по-эстонски требуется только короткий поддержанный ответ A1–A2.',
    '',
    ...blocks,
    '',
    'Provenance: вопросы и языковые цели взяты из четырёх production lesson YAML;',
    'новые научные ответы не создавались.',
    '',
  ].join('\n');
}

function oralTeacherMarkdown(lessons) {
  const blocks = lessons.map((lesson) => {
    const question = lesson.questions[0];
    return [
      `## ${lesson.lesson_id}`,
      '',
      `Вопрос: ${question.question_ru}`,
      '',
      `Полный ожидаемый ответ по-русски: ${question.full_expected_answer_ru}`,
      '',
      `Короткий ответ по-эстонски: ${question.short_oral_answer_et}`,
      '',
      `Допустимые варианты: ${(question.acceptable_variants ?? []).join('; ')}`,
      '',
      `Исправляемое заблуждение: ${question.misconception_to_watch}`,
      '',
      'Предметный и эстонский языковой результат фиксируются отдельно.',
    ].join('\n');
  });
  return [
    '# Ключ и руководство к подготовке устного ответа',
    '',
    ...blocks,
    '',
    'Provenance: ответы воспроизведены из существующих question records lesson YAML.',
    '',
  ].join('\n');
}

function homeschoolLessonMarkdown(lesson, result) {
  const packageArtifact = result.package;
  const question = lesson.questions[0];
  const urls = lesson.evidence_linkage.opiq_records
    .map((record) => `- [${record.title}](${record.canonical_url})`);
  const safety = lesson.position_in_unit === 3
    ? [
      '## Безопасность',
      '',
      '- Только пассивное таяние льда и наблюдение холодной поверхности.',
      '- Нельзя использовать чайник, плиту, открытый огонь или горячий сосуд.',
      '- Взрослый готовит разрешённые материалы, находится рядом и контролирует уборку.',
      '- Взрослый не объясняет предметный вывод вместо ребёнка.',
      '',
    ]
    : [];
  return [
    `# ${lesson.title_ru}: домашний вариант`,
    '',
    `Content identity: \`${lesson.pedagogical_integration.content_identity.value}\``,
    '',
    'Это сгенерированный вариант существующего урока, а не отдельная программа.',
    'Сложное объяснение остаётся по-русски; эстонский ограничен заявленной поддержкой.',
    '',
    '## Порядок работы',
    '',
    ...packageArtifact.learner_plan.steps.map((step, index) => (
      `${index + 1}. ${step.instruction_ru} `
      + `(источник: ${step.source_access})`
    )),
    '',
    '## Первая попытка',
    '',
    `Ответь без ключа: ${question.question_ru}`,
    '',
    'После попытки открой ключ по указанному правилу, сравни и исправь другим цветом.',
    '',
    ...safety,
    '## Opiq',
    '',
    ...urls,
    '',
    'Статус: teacher review pending; home trial not started; homeschool_ready: false.',
    '',
  ].join('\n');
}

function parentLessonMarkdown(lesson, result) {
  return [
    `# Роль взрослого: ${lesson.title_ru}`,
    '',
    `Вариант: \`${result.package.context.variant}\`.`,
    '',
    `- Ответственность ребёнка: ${result.parentGuidance.responsibility_boundary.child_responsibility_ru}`,
    `- Поддержка взрослого: ${result.parentGuidance.responsibility_boundary.adult_support_ru}`,
    `- Надзор безопасности: ${result.parentGuidance.responsibility_boundary.adult_safety_supervision_ru}`,
    `- Ответственность учителя: ${result.parentGuidance.responsibility_boundary.subject_teacher_responsibility_ru}`,
    '',
    'Взрослый не является автоматически предметным учителем и не формулирует',
    'научный ответ вместо ребёнка. Ключ открывается только после первой попытки.',
    '',
    'Статус: педагогическое ревью ожидается; домашняя апробация не начата.',
    '',
  ].join('\n');
}

function integrationIndex(lessons, unitIdentity, rows) {
  return {
    schema_version: '1.0',
    artifact_type: 'pedagogy_generation_integration_index',
    integration_version: PEDAGOGY_INTEGRATION_VERSION,
    unit_id: WATER_PILOT_UNIT_ID,
    unit_content_identity: unitIdentity,
    lessons: lessons.map((lesson) => {
      const row = rows.get(lesson.lesson_id);
      return {
        lesson_id: lesson.lesson_id,
        content_identity: lesson.pedagogical_integration.content_identity,
        selection_request_path:
          lesson.pedagogical_integration.generated_artifacts.selection_request_path,
        selection_request_digest: row.selection.decision.request_digest,
        selection_decision_path:
          lesson.pedagogical_integration.generated_artifacts.selection_decision_path,
        lesson_dna_path: lesson.pedagogical_integration.generated_artifacts.lesson_dna_path,
        lesson_dna_digest: sha256PedagogyValue(row.lessonDna),
        selected_pattern_id: row.lessonDna.pattern.pattern_id,
        selected_target_ids: row.lessonDna.phases.map((phase) => phase.target.target_id),
        task_bindings: row.taskBindings,
        timing_reconciliation: row.reconciliation,
        classroom_rendered_paths: row.classroomRenderedPaths,
        homeschool_request_path:
          lesson.pedagogical_integration.generated_artifacts.homeschool_request_path,
        homeschool_decision_path:
          lesson.pedagogical_integration.generated_artifacts.homeschool_decision_path,
        homeschool_package_path:
          lesson.pedagogical_integration.generated_artifacts.homeschool_package_path,
        parent_guidance_path:
          lesson.pedagogical_integration.generated_artifacts.parent_guidance_path,
        weekly_study_plan_path:
          lesson.pedagogical_integration.generated_artifacts.weekly_study_plan_path,
        homeschool_rendered_path:
          lesson.pedagogical_integration.generated_artifacts.homeschool_rendered_path,
        readiness: {
          structural_state: 'generated',
          teacher_review: 'pending',
          classroom_trial: 'not_tested',
          classroom_ready: false,
          homeschool_ready: false,
          effectiveness_claimed: false,
        },
      };
    }),
    determinism: {
      ordering: 'bytewise',
      ai_used: false,
      network_used: false,
      randomness_used: false,
      volatile_timestamps: false,
    },
  };
}

function yaml(value) {
  return stringify(value, { lineWidth: 100, sortMapEntries: false });
}

async function currentMarkdown(rootDir, repositoryPath) {
  return fs.readFile(safeRepositoryPath(rootDir, repositoryPath, repositoryPath), 'utf8');
}

export async function generateWaterPilotArtifacts({ rootDir = process.cwd() } = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const [lessons, thematic, materialsIndex, selectionRepository, homeschoolRepository] =
    await Promise.all([
      Promise.all(WATER_PILOT_LESSONS.map((file) => readYaml(absoluteRoot, file))),
      readYaml(absoluteRoot, WATER_PILOT_THEMATIC),
      readYaml(absoluteRoot, WATER_PILOT_INDEX),
      loadPedagogySelectionRepository({ rootDir: absoluteRoot }),
      loadPedagogyHomeschoolRepository({ rootDir: absoluteRoot }),
    ]);
  const identities = new Map(lessons.map((lesson) => [
    lesson.lesson_id,
    computeLessonContentIdentity(lesson),
  ]));
  for (const lesson of lessons) {
    const recorded = lesson.pedagogical_integration?.content_identity;
    const current = identities.get(lesson.lesson_id);
    if (!recorded || recorded.value !== current.value) {
      throw new Error(
        `${lesson.lesson_id}: recorded content identity ${recorded?.value ?? '<missing>'} `
        + `does not match ${current.value}`,
      );
    }
  }
  const unitIdentity = computeUnitContentIdentity(thematic, identities);
  if (thematic.pedagogical_integration?.unit_content_identity?.value !== unitIdentity.value) {
    throw new Error(
      `unit content identity does not match current content: ${unitIdentity.value}`,
    );
  }
  if (materialsIndex.pedagogical_integration?.unit_content_identity?.value !== unitIdentity.value) {
    throw new Error('materials index unit content identity is stale');
  }
  const files = new Map();
  const rows = new Map();
  for (const lesson of lessons) {
    const selection = selectionResultOrThrow(selectionRepository, lesson);
    const reconciliation = reconcileLessonTiming(lesson, selection.lessonDna);
    const generatedTaskBindings = taskBindings(lesson, selection.lessonDna, materialsIndex);
    const homeschoolRequest = buildHomeschoolRequest(
      lesson,
      selection.request,
      selection.lessonDna,
    );
    const homeschool = adaptLessonForHomeschool(homeschoolRepository, homeschoolRequest);
    if (!homeschool.package) {
      throw new Error(
        `${lesson.lesson_id} homeschool adaptation failed: `
        + `${homeschool.decision.failure?.code}: `
        + `${homeschool.decision.failure?.details?.join('; ')}`,
      );
    }
    const generated = lesson.pedagogical_integration.generated_artifacts;
    files.set(generated.selection_request_path, serializePedagogyYaml(selection.request));
    files.set(generated.selection_decision_path, serializePedagogyYaml(selection.decision));
    files.set(generated.lesson_dna_path, serializePedagogyYaml(selection.lessonDna));
    files.set(generated.homeschool_request_path, serializeHomeschoolYaml(homeschoolRequest));
    files.set(generated.homeschool_decision_path, serializeHomeschoolYaml(homeschool.decision));
    files.set(generated.homeschool_package_path, serializeHomeschoolYaml(homeschool.package));
    files.set(generated.parent_guidance_path, serializeHomeschoolYaml(homeschool.parentGuidance));
    files.set(generated.weekly_study_plan_path, serializeHomeschoolYaml(homeschool.weeklyStudyPlan));
    files.set(generated.homeschool_rendered_path, homeschoolLessonMarkdown(lesson, homeschool));
    const number = String(lesson.position_in_unit).padStart(2, '0');
    const parentRenderedPath =
      `${WATER_PILOT_PACK}/homeschool/lesson-${number}-parent-guidance.md`;
    files.set(parentRenderedPath, parentLessonMarkdown(lesson, homeschool));
    const teacherPath = `${WATER_PILOT_PACK}/lessons/lesson-${number}.md`;
    const studentPath = lesson.evidence_linkage.author_materials
      .find((material) => material.audience === 'student')?.artifact_path;
    const answerPath = `${WATER_PILOT_PACK}/answers/lesson-${number}-answer-key.md`;
    files.set(teacherPath, applyGeneratedRegion(
      await currentMarkdown(absoluteRoot, teacherPath),
      `lesson=${lesson.lesson_id} audience=teacher`,
      teacherRegion(lesson, selection.lessonDna, reconciliation, selectionRepository),
    ));
    files.set(studentPath, applyGeneratedRegion(
      await currentMarkdown(absoluteRoot, studentPath),
      `lesson=${lesson.lesson_id} audience=student`,
      studentRegion(lesson, selection.lessonDna),
    ));
    files.set(answerPath, applyGeneratedRegion(
      await currentMarkdown(absoluteRoot, answerPath),
      `lesson=${lesson.lesson_id} audience=answer-key`,
      answerRegion(lesson, generatedTaskBindings),
    ));
    rows.set(lesson.lesson_id, {
      selection,
      lessonDna: selection.lessonDna,
      reconciliation,
      taskBindings: generatedTaskBindings,
      homeschoolRequest,
      homeschool,
      classroomRenderedPaths: [teacherPath, studentPath, answerPath],
      parentRenderedPath,
    });
  }
  files.set(
    `${WATER_PILOT_PACK}/student/water-oral-answer-preparation.md`,
    oralStudentMarkdown(lessons),
  );
  files.set(
    `${WATER_PILOT_PACK}/answers/water-oral-answer-guidance.md`,
    oralTeacherMarkdown(lessons),
  );
  files.set(
    `${WATER_PILOT_PACK}/pedagogy/integration-index.yaml`,
    yaml(integrationIndex(lessons, unitIdentity, rows)),
  );
  return {
    rootDir: absoluteRoot,
    lessons,
    thematic,
    materialsIndex,
    identities,
    unitIdentity,
    rows,
    files: new Map([...files.entries()].sort(([left], [right]) => compareBytewise(left, right))),
  };
}

export async function writeGeneratedFiles(generated) {
  for (const [repositoryPath, content] of generated.files) {
    const filePath = safeRepositoryPath(generated.rootDir, repositoryPath, repositoryPath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
  }
}

export async function checkGeneratedFiles(generated) {
  const mismatches = [];
  for (const [repositoryPath, expected] of generated.files) {
    const filePath = safeRepositoryPath(generated.rootDir, repositoryPath, repositoryPath);
    let actual;
    try {
      actual = await fs.readFile(filePath, 'utf8');
    } catch {
      mismatches.push(`${repositoryPath}: missing`);
      continue;
    }
    if (actual !== expected) mismatches.push(`${repositoryPath}: stale`);
  }
  return mismatches;
}

export function generationSummary(generated) {
  return {
    integration_version: PEDAGOGY_INTEGRATION_VERSION,
    unit_id: WATER_PILOT_UNIT_ID,
    unit_content_identity: generated.unitIdentity.value,
    lesson_count: generated.lessons.length,
    generated_file_count: generated.files.size,
    lessons: generated.lessons.map((lesson) => {
      const row = generated.rows.get(lesson.lesson_id);
      return {
        lesson_id: lesson.lesson_id,
        content_identity: generated.identities.get(lesson.lesson_id).value,
        pattern_id: row.lessonDna.pattern.pattern_id,
        target_ids: row.lessonDna.phases.map((phase) => phase.target.target_id),
        selection_request_digest: row.selection.decision.request_digest,
        lesson_dna_digest: sha256PedagogyValue(row.lessonDna),
        timing_status: row.reconciliation.status,
        homeschool_variant: row.homeschool.package.context.variant,
        homeschool_ready: false,
      };
    }),
    guarantees: {
      ai_used: false,
      network_used: false,
      randomness_used: false,
      volatile_timestamps: false,
    },
  };
}

export function stableIntegrationJson(value) {
  return stablePedagogyJson(value);
}
