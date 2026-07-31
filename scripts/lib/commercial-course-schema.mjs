import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { makeDiagnostic, safeRepositoryPath } from './curriculum-maps.mjs';

const authorCreatedCategories = new Set([
  'author_created_explanation',
  'author_created_bridge',
  'author_created_worksheet',
  'author_created_assessment',
  'author_created_worked_example',
  'author_created_task_set',
  'author_created_worked_solution',
  'author_created_expected_answers',
]);

function diagnostic(diagnostics, artifact, field, reason) {
  diagnostics.push(makeDiagnostic('error', artifact.file, field, reason));
}

function sameSet(left = [], right = []) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return leftSet.size === rightSet.size && [...leftSet].every((value) => rightSet.has(value));
}

function duplicateValues(values = []) {
  const seen = new Set();
  return [...new Set(values.filter((value) => {
    if (seen.has(value)) return true;
    seen.add(value);
    return false;
  }))];
}

function materialFiles(lesson, materialIds) {
  const wanted = new Set(materialIds);
  const files = [];
  for (const material of lesson.evidence_linkage?.author_materials ?? []) {
    if (!wanted.has(material.material_id)) continue;
    files.push(material.artifact_path);
    if (material.answer_key_path) files.push(material.answer_key_path);
  }
  return [...new Set(files)].sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
}

export function computeCommercialOriginalityFingerprint(rootDir, lesson, materialIds) {
  const entries = materialFiles(lesson, materialIds).map((repositoryPath) => {
    const absolutePath = safeRepositoryPath(rootDir, repositoryPath, 'originality review material path');
    const bytes = fs.readFileSync(absolutePath);
    return {
      path: repositoryPath,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    };
  });
  return {
    algorithm: 'sha256',
    specification_version: '1.0',
    value: crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex'),
    file_count: entries.length,
  };
}

function fingerprintEquals(left, right) {
  return ['algorithm', 'specification_version', 'value', 'file_count']
    .every((field) => left?.[field] === right?.[field]);
}

function courseMapFor(context, mapId) {
  return context.curriculum?.artifacts?.find(
    (artifact) => artifact.data.artifact_type === 'thematic_unit'
      && artifact.data.map_id === mapId,
  )?.data;
}

function grade2ProjectFor(context, projectId) {
  const projectArtifact = context.grade2Programme?.projectModules?.data;
  const project = projectArtifact?.projects?.find((entry) => entry.project_id === projectId);
  return project ? { grade: projectArtifact.grade, project } : null;
}

function grade2BookInventoryFor(context, routeId) {
  return context.curriculum?.artifacts?.find((artifact) => (
    artifact.data.artifact_type === 'grade_programme_book_inventory'
      && artifact.data.route_id === routeId
  ))?.data;
}

function commonProgrammeType(value) {
  return ({
    ordinary_curriculum: 'ordinary',
    simplified_curriculum: 'simplified_curriculum',
    supplementary: 'supplementary',
    teacher_support: 'teacher_support',
  })[value] ?? 'unknown';
}

function normalizedSubject(value) {
  return value?.trim().toLowerCase().replace(/[\s-]+/gu, '_');
}

function grade2ProjectRecords(context, projectContext, routeId) {
  const alignment = projectContext?.project?.source_alignments?.find((entry) => (
    entry.route_id === routeId
  ));
  const inventory = grade2BookInventoryFor(context, routeId);
  if (!alignment || !inventory) return { alignment, inventory, records: [] };
  const selectedIds = new Set(alignment.source_record_ids ?? []);
  const records = (inventory.source_records ?? [])
    .filter((entry) => selectedIds.has(entry.record_id))
    .map((entry) => {
      const book = inventory.books?.find((candidate) => (
        candidate.book_id === entry.book_id && candidate.record_ids?.includes(entry.record_id)
      ));
      return {
        authoritative: {
          record_id: entry.record_id,
          canonical_url: entry.canonical_url,
          canonical_source_id: routeId,
          book_id: entry.book_id,
          title: entry.title,
          language: entry.language,
          programme_type: commonProgrammeType(book?.programme_type),
        },
        book,
      };
    });
  return { alignment, inventory, records };
}

function validateCommercialCore(diagnostics, artifact) {
  const lesson = artifact.data;
  const core = lesson.commercial_core ?? {};
  const materials = lesson.evidence_linkage?.author_materials ?? [];
  const materialsById = new Map(materials.map((material) => [material.material_id, material]));
  const groups = [
    ['explanation_material_ids', new Set(['explanation'])],
    ['worked_example_material_ids', new Set(['worked_example'])],
    ['task_material_ids', new Set(['task_set', 'worksheet'])],
    ['expected_answer_material_ids', new Set(['expected_answers', 'answer_key'])],
    ['worked_solution_material_ids', new Set(['worked_solution'])],
    ['assessment_material_ids', new Set(['assessment'])],
  ];
  for (const [field, acceptedTypes] of groups) {
    for (const id of core[field] ?? []) {
      const material = materialsById.get(id);
      if (!material) {
        diagnostic(diagnostics, artifact, `/commercial_core/${field}`, `unknown author material ${id}`);
      } else if (!acceptedTypes.has(material.material_type)) {
        diagnostic(
          diagnostics,
          artifact,
          `/commercial_core/${field}`,
          `${id} has material type ${material.material_type}; expected ${[...acceptedTypes].join(' or ')}`,
        );
      }
      if (material && !authorCreatedCategories.has(material.provenance?.category)) {
        diagnostic(diagnostics, artifact, `/commercial_core/${field}`, `${id} is not author-created`);
      }
      if (
        material
        && ['explanation_material_ids', 'worked_example_material_ids', 'task_material_ids', 'assessment_material_ids'].includes(field)
        && !['student', 'shared'].includes(material.audience)
      ) {
        diagnostic(diagnostics, artifact, `/commercial_core/${field}`, `${id} must be available to the learner`);
      }
      if (
        material
        && ['expected_answer_material_ids', 'worked_solution_material_ids'].includes(field)
        && material.audience !== 'teacher'
      ) {
        diagnostic(diagnostics, artifact, `/commercial_core/${field}`, `${id} must remain teacher-only`);
      }
    }
  }
  const assessmentIds = new Set((lesson.assessment ?? []).map((entry) => entry.criterion_id));
  for (const id of core.assessment_criterion_ids ?? []) {
    if (!assessmentIds.has(id)) diagnostic(diagnostics, artifact, '/commercial_core/assessment_criterion_ids', `unknown assessment criterion ${id}`);
  }
  const successIds = new Set([
    ...(lesson.objectives?.subject_success_criteria ?? []).map((entry) => entry.criterion_id),
    ...(lesson.objectives?.estonian_success_criteria ?? []).map((entry) => entry.criterion_id),
  ]);
  for (const id of core.success_criteria_refs ?? []) {
    if (!successIds.has(id)) diagnostic(diagnostics, artifact, '/commercial_core/success_criteria_refs', `unknown success criterion ${id}`);
  }
  const outputIds = new Set([
    ...(lesson.questions ?? []).map((entry) => entry.question_id),
    ...(lesson.objectives?.content_objectives ?? []).map((entry) => entry.objective_id),
    ...(lesson.objectives?.estonian_language_objectives ?? []).map((entry) => entry.objective_id),
    ...(lesson.practical_work ? [lesson.practical_work.work_id] : []),
  ]);
  for (const id of core.learner_output_refs ?? []) {
    if (!outputIds.has(id)) diagnostic(diagnostics, artifact, '/commercial_core/learner_output_refs', `unknown measurable learner output ${id}`);
  }
  const taskIds = new Set(core.task_material_ids ?? []);
  if (!sameSet(
    core.task_material_ids,
    (core.task_contracts ?? []).map((entry) => entry.task_material_id),
  )) {
    diagnostic(diagnostics, artifact, '/commercial_core/task_contracts', 'every task material requires exactly one task contract');
  }
  const expectedAnswerIds = new Set(core.expected_answer_material_ids ?? []);
  const workedSolutionIds = new Set(core.worked_solution_material_ids ?? []);
  for (const [index, contract] of (core.task_contracts ?? []).entries()) {
    if (!taskIds.has(contract.task_material_id)) {
      diagnostic(diagnostics, artifact, `/commercial_core/task_contracts/${index}/task_material_id`, 'task contract must reference task_material_ids');
    }
    for (const id of [
      ...(contract.expected_answer_material_ids ?? []),
      ...(contract.worked_solution_material_ids ?? []),
    ]) {
      if (!materialsById.has(id)) diagnostic(diagnostics, artifact, `/commercial_core/task_contracts/${index}`, `unknown task evidence material ${id}`);
    }
    for (const id of contract.expected_answer_material_ids ?? []) {
      if (!expectedAnswerIds.has(id)) diagnostic(diagnostics, artifact, `/commercial_core/task_contracts/${index}/expected_answer_material_ids`, `${id} is not declared as commercial expected-answer material`);
    }
    for (const id of contract.worked_solution_material_ids ?? []) {
      if (!workedSolutionIds.has(id)) diagnostic(diagnostics, artifact, `/commercial_core/task_contracts/${index}/worked_solution_material_ids`, `${id} is not declared as commercial worked-solution material`);
    }
    if (!contract.open_ended && (contract.expected_answer_material_ids ?? []).length === 0) {
      diagnostic(diagnostics, artifact, `/commercial_core/task_contracts/${index}`, 'closed task requires expected answers');
    }
    if (
      ['procedural', 'computational'].includes(contract.response_mode)
      && (contract.worked_solution_material_ids ?? []).length === 0
    ) {
      diagnostic(diagnostics, artifact, `/commercial_core/task_contracts/${index}`, `${contract.response_mode} task requires a worked solution`);
    }
  }
  for (const id of core.expected_answer_material_ids ?? []) {
    const answer = materialsById.get(id);
    if (!answer) continue;
    for (const taskId of core.task_material_ids ?? []) {
      const task = materialsById.get(taskId);
      if (task?.artifact_path === answer.artifact_path) {
        diagnostic(diagnostics, artifact, '/commercial_core', 'student task and expected-answer material must use separate artifacts');
      }
    }
  }
}

function parseOpiqCoordinates(url) {
  const match = /^https:\/\/www\.opiq\.ee\/kit\/(\d+)\/chapter\/(\d+)(?:[/?#]|$)/u.exec(url ?? '');
  return match ? { kitId: Number(match[1]), chapterId: Number(match[2]) } : null;
}

function validDate(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}$/u.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function differingRecordFields(record, authoritativeRecord) {
  return [...new Set([
    ...Object.keys(record ?? {}),
    ...Object.keys(authoritativeRecord ?? {}),
  ])]
    .sort((left, right) => Buffer.from(left).compare(Buffer.from(right)))
    .filter((field) => !isDeepStrictEqual(record?.[field], authoritativeRecord?.[field]));
}

function validateCompanions(diagnostics, artifact, context) {
  const lesson = artifact.data;
  const companions = lesson.opiq_companions ?? [];
  for (const duplicate of duplicateValues(companions.map((entry) => entry.companion_id))) {
    diagnostic(diagnostics, artifact, '/opiq_companions', `duplicate companion ID ${duplicate}`);
  }
  const courseMap = courseMapFor(context, lesson.evidence_linkage?.course_map_ref);
  const projectContext = grade2ProjectFor(context, lesson.evidence_linkage?.course_map_ref);
  const projectRecords = grade2ProjectRecords(
    context,
    projectContext,
    lesson.canonical_route?.source_id,
  );
  const selectedRecordByUrl = new Map(
    courseMap
      ? (courseMap.selected_records ?? []).map((record) => [record.canonical_url, {
        authoritative: record,
        book: null,
      }])
      : projectRecords.records.map((entry) => [entry.authoritative.canonical_url, entry]),
  );
  const materials = new Set((lesson.evidence_linkage?.author_materials ?? []).map((entry) => entry.material_id));
  const stages = new Set((lesson.stages ?? []).map((entry) => entry.stage_id));
  for (const [index, companion] of companions.entries()) {
    const field = `/opiq_companions/${index}`;
    const record = companion.source_record ?? {};
    const selectedRecord = selectedRecordByUrl.get(record.canonical_url);
    const authoritativeRecord = selectedRecord?.authoritative;
    if (record.canonical_source_id !== lesson.canonical_route?.source_id) {
      diagnostic(diagnostics, artifact, `${field}/source_record/canonical_source_id`, 'companion source snapshot must use the lesson canonical route');
    }
    const mapMatchesLesson = courseMap
      ? courseMap.grade === lesson.grade && courseMap.subject === lesson.subject
      : projectContext?.grade === lesson.grade
        && projectRecords.inventory?.grade === lesson.grade
        && normalizedSubject(projectRecords.inventory?.subject) === normalizedSubject(lesson.subject);
    if (!mapMatchesLesson) {
      diagnostic(diagnostics, artifact, `${field}/source_record`, 'companion course-map grade and subject must match the lesson');
    }
    if (!authoritativeRecord) {
      diagnostic(diagnostics, artifact, `${field}/source_record/canonical_url`, 'companion URL is not selected in the linked course map');
    } else {
      const fields = courseMap
        ? differingRecordFields(record, authoritativeRecord)
        : Object.keys(authoritativeRecord).filter((key) => (
          !isDeepStrictEqual(record?.[key], authoritativeRecord[key])
        ));
      for (const mismatch of fields) {
        diagnostic(
          diagnostics,
          artifact,
          `${field}/source_record/${mismatch}`,
          `companion source-record metadata does not match the authoritative selected course-map record: ${mismatch}`,
        );
      }
      if (authoritativeRecord.canonical_source_id !== lesson.canonical_route?.source_id) {
        diagnostic(
          diagnostics,
          artifact,
          `${field}/source_record/canonical_source_id`,
          'authoritative companion record is not owned by the lesson canonical route',
        );
      }
      if (!courseMap) {
        const expectedSourceReference = `${authoritativeRecord.canonical_source_id} / kit ${companion.kit_id} / chapter ${companion.chapter_id}`;
        if (!sameSet(record.instructional_roles, ['optional_extension'])) {
          diagnostic(diagnostics, artifact, `${field}/source_record/instructional_roles`, 'Grade 2 project companion must remain an optional extension');
        }
        if (record.provenance?.category !== 'opiq_textbook'
            || record.provenance?.source_reference !== expectedSourceReference) {
          diagnostic(diagnostics, artifact, `${field}/source_record/provenance`, 'Grade 2 project companion provenance must identify the exact registered route and URL coordinates');
        }
        const eligibility = selectedRecord?.book?.eligibility ?? {};
        if (eligibility.ordinary_default_use !== true
            || eligibility.learner_specific_simplified_use !== false
            || eligibility.supplementary_use !== false
            || eligibility.mixed_subject_use !== false) {
          diagnostic(diagnostics, artifact, `${field}/source_record`, 'Grade 2 project companion must be an ordinary default-eligible record, not simplified, supplementary, or mixed-subject content');
        }
      }
    }
    const coordinates = parseOpiqCoordinates(authoritativeRecord?.canonical_url);
    if (!coordinates || coordinates.kitId !== companion.kit_id || coordinates.chapterId !== companion.chapter_id) {
      diagnostic(diagnostics, artifact, field, 'companion kit_id and chapter_id must match the canonical URL');
    }
    const access = companion.access ?? {};
    if (companion.publication_visibility === 'customer_visible') {
      if (!access.mode || ['teacher_only', 'unverified'].includes(access.mode)) {
        diagnostic(diagnostics, artifact, `${field}/access/mode`, 'customer-visible companion requires a verified pupil access mode');
      }
      if (!validDate(access.last_checked_on)) diagnostic(diagnostics, artifact, `${field}/access/last_checked_on`, 'customer-visible companion requires a valid access-check date');
      if (['unavailable', 'not_checked'].includes(access.check_status)) {
        diagnostic(diagnostics, artifact, `${field}/access/check_status`, 'unavailable or unchecked companion cannot be customer-visible');
      }
      const fallback = companion.standalone_fallback ?? {};
      const references = [...(fallback.author_material_ids ?? []), ...(fallback.lesson_stage_refs ?? [])];
      if (fallback.exists !== true || references.length === 0) {
        diagnostic(diagnostics, artifact, `${field}/standalone_fallback`, 'customer-visible companion requires a standalone fallback reference');
      }
    }
    if (access.mode === 'teacher_only' && companion.publication_visibility !== 'internal_only') {
      diagnostic(diagnostics, artifact, `${field}/publication_visibility`, 'teacher-only companion must remain internal');
    }
    if (access.mode === 'unverified' && companion.publication_visibility !== 'internal_only') {
      diagnostic(diagnostics, artifact, `${field}/publication_visibility`, 'unverified companion must remain internal');
    }
    if (['pupil_license', 'private_user_license'].includes(access.mode) && !access.license_type) {
      diagnostic(diagnostics, artifact, `${field}/access/license_type`, 'licence-required companion requires licence metadata');
    }
    if (
      authoritativeRecord?.programme_type === 'simplified_curriculum'
      && !companion.simplified_curriculum_opt_in?.learner_specific
    ) {
      diagnostic(diagnostics, artifact, `${field}/simplified_curriculum_opt_in`, 'simplified-curriculum companion requires explicit learner-specific opt-in');
    }
    if (
      authoritativeRecord?.programme_type === 'teacher_support'
      || authoritativeRecord?.provenance?.category === 'opiq_teacher_support'
    ) {
      if (companion.publication_visibility !== 'internal_only') {
        diagnostic(diagnostics, artifact, `${field}/publication_visibility`, 'teacher-support source cannot be customer-visible pupil material');
      }
    }
    for (const id of companion.standalone_fallback?.author_material_ids ?? []) {
      if (!materials.has(id)) diagnostic(diagnostics, artifact, `${field}/standalone_fallback/author_material_ids`, `unknown fallback material ${id}`);
    }
    for (const id of companion.standalone_fallback?.lesson_stage_refs ?? []) {
      if (!stages.has(id)) diagnostic(diagnostics, artifact, `${field}/standalone_fallback/lesson_stage_refs`, `unknown fallback stage ${id}`);
    }
  }
  if (lesson.delivery_model?.opiq_companion_policy === 'none' && companions.length > 0) {
    diagnostic(diagnostics, artifact, '/opiq_companions', 'companion policy none requires an empty companion list');
  }
}

function originalityState(lesson, rootDir) {
  const review = lesson.originality_review ?? {};
  let current = false;
  try {
    const computed = computeCommercialOriginalityFingerprint(
      rootDir,
      lesson,
      review.covered_author_material_ids ?? [],
    );
    current = fingerprintEquals(review.reviewed_version?.content_fingerprint, computed);
  } catch {
    current = false;
  }
  const approved = review.status === 'approved'
    && Boolean(review.reviewer)
    && Boolean(review.reviewer_role)
    && validDate(review.reviewed_on)
    && Boolean(review.reviewed_version?.commit_sha)
    && Object.values(review.dimensions ?? {}).every((value) => ['independent', 'not_applicable'].includes(value));
  return { approved, current };
}

function validateOriginality(diagnostics, artifact, context) {
  const lesson = artifact.data;
  const review = lesson.originality_review ?? {};
  const materials = lesson.evidence_linkage?.author_materials ?? [];
  const materialIds = new Set(materials.map((entry) => entry.material_id));
  for (const id of review.covered_author_material_ids ?? []) {
    if (!materialIds.has(id)) diagnostic(diagnostics, artifact, '/originality_review/covered_author_material_ids', `unknown covered material ${id}`);
  }
  const { approved, current } = originalityState(lesson, context.rootDir);
  if (review.status === 'approved' && !approved) {
    diagnostic(diagnostics, artifact, '/originality_review', 'approved originality review requires reviewer, role, date, commit, notes, and completed dimensions');
  }
  if (review.status === 'approved' && !current) {
    diagnostic(diagnostics, artifact, '/originality_review/reviewed_version/content_fingerprint', 'originality review fingerprint is stale');
  }
  if (['publication_ready', 'customer_released'].includes(lesson.delivery_model?.publication_status)) {
    if (!approved || !current) diagnostic(diagnostics, artifact, '/delivery_model/publication_status', 'publication requires a current approved originality review');
    if (!sameSet(review.covered_author_material_ids, materials.map((entry) => entry.material_id))) {
      diagnostic(diagnostics, artifact, '/originality_review/covered_author_material_ids', 'publication originality review must cover every author material');
    }
  }
  const customerFiles = materials
    .filter((entry) => ['student', 'parent', 'shared'].includes(entry.audience))
    .map((entry) => entry.artifact_path);
  for (const repositoryPath of customerFiles) {
    try {
      const absolutePath = safeRepositoryPath(context.rootDir, repositoryPath, 'customer material path');
      const content = fs.readFileSync(absolutePath, 'utf8');
      for (const reference of review.internal_source_analysis_refs ?? []) {
        if (reference.length >= 6 && content.includes(reference)) {
          diagnostic(diagnostics, artifact, '/originality_review/internal_source_analysis_refs', `internal source-analysis reference is exposed in customer material ${repositoryPath}`);
        }
      }
    } catch {
      // The existing material resolver reports missing files with their exact path.
    }
  }
}

function validateFamilyHooks(diagnostics, artifact) {
  const lesson = artifact.data;
  const hooks = lesson.family_overlay_hooks ?? [];
  const known = {
    stage_ids: new Set((lesson.stages ?? []).map((entry) => entry.stage_id)),
    material_ids: new Set((lesson.evidence_linkage?.author_materials ?? []).map((entry) => entry.material_id)),
    objective_ids: new Set([
      ...(lesson.objectives?.content_objectives ?? []).map((entry) => entry.objective_id),
      ...(lesson.objectives?.estonian_language_objectives ?? []).map((entry) => entry.objective_id),
    ]),
    assessment_criterion_ids: new Set((lesson.assessment ?? []).map((entry) => entry.criterion_id)),
  };
  for (const duplicate of duplicateValues(hooks.map((entry) => entry.hook_id))) {
    diagnostic(diagnostics, artifact, '/family_overlay_hooks', `duplicate family hook ID ${duplicate}`);
  }
  for (const [index, hook] of hooks.entries()) {
    for (const [field, values] of Object.entries(hook.core_refs ?? {})) {
      for (const value of values ?? []) {
        if (!known[field]?.has(value)) diagnostic(diagnostics, artifact, `/family_overlay_hooks/${index}/core_refs/${field}`, `unknown core reference ${value}`);
      }
    }
    if (
      (hook.supported_lanes ?? []).some((lane) => ['grade_2', 'grade_4'].includes(lane))
      && hook.individual_evidence_required !== true
    ) {
      diagnostic(diagnostics, artifact, `/family_overlay_hooks/${index}/individual_evidence_required`, 'Grade 2 and Grade 4 family lanes require individual evidence');
    }
    if (hook.shared_evidence_replaces_individual !== false) {
      diagnostic(diagnostics, artifact, `/family_overlay_hooks/${index}/shared_evidence_replaces_individual`, 'shared family evidence cannot replace individual evidence');
    }
    if (
      hook.hook_role === 'foundation_participation'
      && !sameSet(hook.supported_lanes, ['foundation'])
    ) {
      diagnostic(diagnostics, artifact, `/family_overlay_hooks/${index}/supported_lanes`, 'Foundation participation supports only the Foundation lane');
    }
    if (
      hook.hook_role === 'grade_2_responsibility'
      && !(hook.supported_lanes ?? []).includes('grade_2')
    ) {
      diagnostic(diagnostics, artifact, `/family_overlay_hooks/${index}/supported_lanes`, 'Grade 2 responsibility hook must support the Grade 2 lane');
    }
    if (
      hook.hook_role === 'grade_4_extension'
      && !(hook.supported_lanes ?? []).includes('grade_4')
    ) {
      diagnostic(diagnostics, artifact, `/family_overlay_hooks/${index}/supported_lanes`, 'Grade 4 extension hook must support the Grade 4 lane');
    }
  }
  if (lesson.delivery_model?.family_overlay_supported === false && hooks.length > 0) {
    diagnostic(diagnostics, artifact, '/family_overlay_hooks', 'family_overlay_supported false requires an empty hook list');
  }
  if (lesson.delivery_model?.family_overlay_supported === true && hooks.length === 0) {
    diagnostic(diagnostics, artifact, '/family_overlay_hooks', 'family_overlay_supported true requires at least one valid hook');
  }
}

export function validateCommercialLesson(diagnostics, artifact, context) {
  const lesson = artifact.data;
  if (lesson.schema_version !== '1.3') return;
  if (lesson.delivery_model?.opiq_required !== false || lesson.delivery_model?.customer_can_complete_without_opiq !== true) {
    diagnostic(diagnostics, artifact, '/delivery_model', 'standalone commercial lesson must be completable without Opiq');
  }
  validateCommercialCore(diagnostics, artifact);
  validateCompanions(diagnostics, artifact, context);
  validateOriginality(diagnostics, artifact, context);
  validateFamilyHooks(diagnostics, artifact);
}

export function validateCommercialThematicPlan(
  diagnostics,
  artifact,
  lessonsById,
  rootDir = process.cwd(),
) {
  const unit = artifact.data;
  if (unit.schema_version !== '1.3') return;
  const linked = (unit.lesson_ids ?? []).map((id) => lessonsById.get(id)?.data).filter(Boolean);
  if (linked.length !== (unit.lesson_ids ?? []).length) return;
  const allStandalone = linked.every((lesson) => lesson.schema_version === '1.3'
    && lesson.delivery_model?.opiq_required === false
    && lesson.delivery_model?.customer_can_complete_without_opiq === true);
  if (unit.commercial_core_summary?.all_lessons_standalone !== allStandalone) {
    diagnostic(diagnostics, artifact, '/commercial_core_summary/all_lessons_standalone', 'thematic standalone summary must equal linked lesson delivery contracts');
  }
  if ((unit.selected_opiq_sources ?? []).length === 0 && !allStandalone) {
    diagnostic(diagnostics, artifact, '/selected_opiq_sources', 'empty thematic Opiq sources require every linked lesson to be standalone');
  }
  const standaloneIds = linked.filter((lesson) => lesson.delivery_model?.opiq_required === false).map((lesson) => lesson.lesson_id);
  if (!sameSet(unit.commercial_core_summary?.standalone_lesson_ids, standaloneIds)) {
    diagnostic(diagnostics, artifact, '/commercial_core_summary/standalone_lesson_ids', 'standalone lesson summary does not match linked lessons');
  }
  const companions = linked.flatMap((lesson) => lesson.opiq_companions ?? []);
  if (!sameSet(unit.opiq_companion_summary?.companion_ids, companions.map((entry) => entry.companion_id))) {
    diagnostic(diagnostics, artifact, '/opiq_companion_summary/companion_ids', 'companion summary must equal the linked lesson union');
  }
  if (!sameSet(
    unit.opiq_companion_summary?.customer_visible_companion_ids,
    companions.filter((entry) => entry.publication_visibility === 'customer_visible').map((entry) => entry.companion_id),
  )) {
    diagnostic(diagnostics, artifact, '/opiq_companion_summary/customer_visible_companion_ids', 'customer-visible companion summary is stale');
  }
  const expectedHooks = linked.flatMap((lesson) => (lesson.family_overlay_hooks ?? []).map((hook) => `${lesson.lesson_id}/${hook.hook_id}`));
  const actualHooks = (unit.family_overlay_hook_index ?? []).map((entry) => `${entry.lesson_id}/${entry.hook_id}`);
  if (!sameSet(actualHooks, expectedHooks)) diagnostic(diagnostics, artifact, '/family_overlay_hook_index', 'family hook index must resolve to linked lesson hooks');
  const originalityByLesson = new Map(linked.map((lesson) => [
    lesson.lesson_id,
    originalityState(lesson, rootDir),
  ]));
  const approvedIds = linked.filter((lesson) => {
    const state = originalityByLesson.get(lesson.lesson_id);
    return state.approved && state.current;
  }).map((lesson) => lesson.lesson_id);
  if (!sameSet(unit.originality_review_summary?.approved_lesson_ids, approvedIds)) {
    diagnostic(diagnostics, artifact, '/originality_review_summary/approved_lesson_ids', 'originality summary must equal current approved linked lessons');
  }
  const allCurrent = approvedIds.length === linked.length;
  if (unit.originality_review_summary?.all_publication_reviews_current !== allCurrent) {
    diagnostic(diagnostics, artifact, '/originality_review_summary/all_publication_reviews_current', 'originality-current summary must equal linked lesson reviews');
  }
  if (['publication_ready', 'customer_released'].includes(unit.delivery_model?.publication_status)) {
    const allLessonsPublishable = linked.every((lesson) => (
      ['publication_ready', 'customer_released'].includes(lesson.delivery_model?.publication_status)
    ));
    if (!allCurrent || !allLessonsPublishable) {
      diagnostic(diagnostics, artifact, '/delivery_model/publication_status', 'thematic publication requires every linked lesson to be publication-ready with a current originality review');
    }
  }
}

export function validateCommercialAnnualCourse(diagnostics, artifact, unitsById) {
  const course = artifact.data;
  if (course.schema_version !== '2.2') return;
  const bindings = course.ordered_units ?? [];
  const requiredBindings = bindings.filter((binding) => binding.mandatory_status === 'curated_core');
  const resolvedUnit = (binding) => unitsById.get(binding.thematic_plan_ref)?.data;
  for (const [index, binding] of bindings.entries()) {
    if (binding.full_thematic_plan_exists && !binding.thematic_plan_ref) {
      diagnostic(diagnostics, artifact, `/ordered_units/${index}/thematic_plan_ref`, `implemented commercial unit is missing its thematic reference: ${binding.unit_id}`);
    }
    if (!binding.full_thematic_plan_exists && binding.thematic_plan_ref) {
      diagnostic(diagnostics, artifact, `/ordered_units/${index}`, `unimplemented commercial unit cannot retain a thematic reference: ${binding.unit_id}`);
    }
    if (binding.full_thematic_plan_exists && binding.thematic_plan_ref && !resolvedUnit(binding)) {
      diagnostic(diagnostics, artifact, `/ordered_units/${index}/thematic_plan_ref`, `implemented commercial unit is unresolved: ${binding.thematic_plan_ref}`);
    }
  }
  const bindingIsStandalone = (binding) => {
    const unit = resolvedUnit(binding);
    return binding.full_thematic_plan_exists === true
      && Boolean(binding.thematic_plan_ref)
      && Boolean(unit)
      && unit.unit_id === binding.thematic_plan_ref
      && unit.schema_version === '1.3'
      && unit.commercial_core_summary?.all_lessons_standalone === true
      && unit.delivery_model?.opiq_required === false;
  };
  const allRequiredStandalone = requiredBindings.length > 0
    && requiredBindings.every(bindingIsStandalone);
  if (
    course.commercial_release_policy?.all_required_lessons_standalone
    !== allRequiredStandalone
  ) {
    diagnostic(
      diagnostics,
      artifact,
      '/commercial_release_policy/all_required_lessons_standalone',
      'annual standalone claim must match every required annual unit',
    );
  }
  if (course.delivery_model?.opiq_required !== false) {
    diagnostic(diagnostics, artifact, '/delivery_model/opiq_required', 'standalone annual course cannot require Opiq');
  }
  if (course.opiq_companion_policy?.policy === 'optional'
    && course.opiq_companion_policy?.customer_visible_requires_fallback !== true) {
    diagnostic(diagnostics, artifact, '/opiq_companion_policy', 'optional customer companions require author-created fallbacks');
  }
  if (course.family_overlay_policy?.shared_evidence_replaces_individual !== false) {
    diagnostic(diagnostics, artifact, '/family_overlay_policy', 'annual family policy cannot replace individual evidence');
  }
  const releaseStatus = course.commercial_release_policy?.publication_status;
  if (course.delivery_model?.publication_status !== releaseStatus) {
    diagnostic(diagnostics, artifact, '/commercial_release_policy/publication_status', 'annual delivery and commercial publication statuses must agree');
  }
  if (['publication_ready', 'customer_released'].includes(releaseStatus)) {
    const completeness = course.completeness ?? {};
    const requiredUnitsPublicationReady = requiredBindings.length > 0
      && requiredBindings.every((binding) => {
        const unit = resolvedUnit(binding);
        return bindingIsStandalone(binding)
          && binding.implementation_status === 'validated_production_unit'
          && unit.originality_review_summary?.all_publication_reviews_current === true
          && ['publication_ready', 'customer_released'].includes(unit.delivery_model?.publication_status);
      });
    const fullyAuthored = completeness.scope === 'fully_authored_annual_course'
      && completeness.implementation_status === 'fully_authored'
      && completeness.declared_complete === true
      && completeness.all_thematic_plans_authored === true
      && completeness.all_lessons_authored === true;
    const fallbacksRequired = course.opiq_companion_policy?.customer_visible_requires_fallback === true;
    if (
      !allRequiredStandalone
      || !requiredUnitsPublicationReady
      || !fullyAuthored
      || !fallbacksRequired
    ) {
      diagnostic(
        diagnostics,
        artifact,
        '/commercial_release_policy/publication_status',
        'annual publication requires every required unit to be resolved, standalone, publication-ready, originality-current, fallback-protected, and fully authored',
      );
    }
  }
}

export function commercialFixtureSummary(fixtures) {
  return {
    lessons: fixtures.lessons.length,
    thematicPlans: fixtures.thematicPlans.length,
    annualCourses: fixtures.annualCourses.length,
    companions: fixtures.lessons.reduce((sum, lesson) => sum + lesson.opiq_companions.length, 0),
    familyHooks: fixtures.lessons.reduce((sum, lesson) => sum + lesson.family_overlay_hooks.length, 0),
  };
}
