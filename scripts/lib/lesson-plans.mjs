import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  listYamlFiles,
  loadCurriculumMapRepository,
  makeDiagnostic,
  parseStrictCurriculumYaml,
  relativeDisplay,
  safeRepositoryPath,
  validateCanonicalRoute,
  validatePageReferences,
} from './curriculum-maps.mjs';
import {
  validateCourseTopicSyntheses,
  validateExternalSourceRegistry,
} from './topic-synthesis.mjs';

const lessonArtifactType = 'bilingual_lesson';
const unitArtifactType = 'bilingual_thematic_plan';
const courseArtifactType = 'annual_course_plan';
const sourceMatrixArtifactType = 'annual_source_selection_matrix';
const roadmapArtifactType = 'annual_implementation_roadmap';
const languageProgressionArtifactType = 'annual_language_progression';
const teachingCalendarsArtifactType = 'annual_teaching_calendars';
const externalRegistryArtifactType = 'external_source_registry';
const profileArtifactType = 'learner_language_profiles';
const requiredApproaches = new Set([
  'content_language_dual_objectives',
  'planned_translanguaging',
  'gradual_scaffolding',
  'pluriliteracies',
  'multimodal_support',
  'vocabulary_recycling',
  'cognitive_load_control',
  'separate_content_language_assessment',
]);
const authorProvenance = new Set([
  'author_created_explanation',
  'author_created_bridge',
  'author_created_worksheet',
  'author_created_assessment',
]);

function normalize(value) {
  return String(value ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim().toLowerCase();
}

function schemaReason(error) {
  if (error.keyword === 'additionalProperties') return `unknown field ${error.params.additionalProperty}`;
  if (error.keyword === 'required') return `missing required field ${error.params.missingProperty}`;
  return error.message ?? `failed ${error.keyword}`;
}

function addSchemaDiagnostics(diagnostics, artifact, validator) {
  if (validator(artifact.data)) return;
  for (const error of validator.errors ?? []) {
    diagnostics.push(makeDiagnostic('error', artifact.file, error.instancePath || '/', schemaReason(error)));
  }
}

function addDuplicateDiagnostics(diagnostics, values, { file, field, label }) {
  const seen = new Set();
  for (const value of values.filter((entry) => entry !== undefined && entry !== null)) {
    if (seen.has(value)) diagnostics.push(makeDiagnostic('error', file, field, `duplicate ${label}: ${value}`));
    seen.add(value);
  }
}

function sameSet(left, right) {
  const leftSet = new Set(left ?? []);
  const rightSet = new Set(right ?? []);
  return leftSet.size === rightSet.size && [...leftSet].every((value) => rightSet.has(value));
}

function findCurriculumArtifacts(context, type) {
  return context.curriculum.artifacts.filter((artifact) => artifact.data.artifact_type === type);
}

function artifactId(artifact) {
  if (artifact.data.artifact_type === lessonArtifactType) return artifact.data.lesson_id;
  if (artifact.data.artifact_type === unitArtifactType) return artifact.data.unit_id;
  if (artifact.data.artifact_type === courseArtifactType) return artifact.data.course_id;
  if ([
    sourceMatrixArtifactType,
    roadmapArtifactType,
    languageProgressionArtifactType,
    teachingCalendarsArtifactType,
  ].includes(artifact.data.artifact_type)) {
    return artifact.data.artifact_id;
  }
  if (artifact.data.artifact_type === externalRegistryArtifactType) return artifact.data.registry_id;
  return null;
}

async function loadYamlArtifacts(rootDir, directoryPath) {
  const directory = safeRepositoryPath(rootDir, directoryPath, `${directoryPath} path`);
  const files = await listYamlFiles(directory);
  const artifacts = [];
  for (const filePath of files) {
    const file = relativeDisplay(rootDir, filePath);
    artifacts.push({ file, data: parseStrictCurriculumYaml(await fs.readFile(filePath, 'utf8'), file) });
  }
  return artifacts;
}

export async function loadLessonPlanRepository({
  rootDir = process.cwd(),
  lessonPlansPath = 'lesson-plans',
  annualCoursesPath = 'annual-courses',
  externalSourcesPath = 'external-sources',
  commonSchemaPath = 'schemas/teaching-plan-common.schema.json',
  profileSchemaPath = 'schemas/language-profiles.schema.json',
  lessonSchemaPath = 'schemas/lesson-plan.schema.json',
  thematicSchemaPath = 'schemas/thematic-plan.schema.json',
  annualSchemaPath = 'schemas/annual-course.schema.json',
  annualComponentsSchemaPath = 'schemas/annual-course-components.schema.json',
  topicSynthesisSchemaPath = 'schemas/topic-synthesis.schema.json',
  externalSourceRegistrySchemaPath = 'schemas/external-source-registry.schema.json',
} = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const [lessonFiles, annualFiles, externalArtifacts] = await Promise.all([
    loadYamlArtifacts(absoluteRoot, lessonPlansPath),
    loadYamlArtifacts(absoluteRoot, annualCoursesPath),
    loadYamlArtifacts(absoluteRoot, externalSourcesPath),
  ]);
  const artifacts = [...lessonFiles, ...annualFiles];
  const additionalSourceIds = [...new Set(artifacts
    .map((artifact) => artifact.data.canonical_route?.source_id)
    .filter(Boolean))];
  const schemaPaths = {
    common: commonSchemaPath,
    profiles: profileSchemaPath,
    lesson: lessonSchemaPath,
    thematic: thematicSchemaPath,
    annual: annualSchemaPath,
    annualComponents: annualComponentsSchemaPath,
    topicSynthesis: topicSynthesisSchemaPath,
    externalSourceRegistry: externalSourceRegistrySchemaPath,
  };
  const schemaEntries = await Promise.all(Object.entries(schemaPaths).map(async ([name, schemaPath]) => {
    const schemaFile = safeRepositoryPath(absoluteRoot, schemaPath, `${name} schema path`);
    return [name, JSON.parse(await fs.readFile(schemaFile, 'utf8'))];
  }));
  const curriculum = await loadCurriculumMapRepository({
    rootDir: absoluteRoot,
    additionalSourceIds,
  });
  return {
    rootDir: absoluteRoot,
    curriculum,
    schemas: Object.fromEntries(schemaEntries),
    artifacts,
    externalArtifacts,
  };
}

function createValidators(context) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  ajv.addSchema(context.curriculum.schemas.course);
  ajv.addSchema(context.schemas.common);
  ajv.addSchema(context.schemas.topicSynthesis);
  ajv.addSchema(context.schemas.annual);
  return {
    profiles: ajv.compile(context.schemas.profiles),
    lesson: ajv.compile(context.schemas.lesson),
    thematic: ajv.compile(context.schemas.thematic),
    annual: ajv.getSchema(context.schemas.annual.$id),
    annualComponents: ajv.compile(context.schemas.annualComponents),
    externalSourceRegistry: ajv.compile(context.schemas.externalSourceRegistry),
  };
}

function curriculumIndexes(context) {
  const officialMaps = findCurriculumArtifacts(context, 'official_curriculum_map');
  const bookInventories = findCurriculumArtifacts(context, 'book_inventory');
  const topicInventories = findCurriculumArtifacts(context, 'topic_inventory');
  const courseMaps = findCurriculumArtifacts(context, 'thematic_unit');
  return {
    officialById: new Map(officialMaps.map((artifact) => [artifact.data.map_id, artifact.data])),
    booksBySource: new Map(bookInventories.map((artifact) => [artifact.data.canonical_route.source_id, artifact.data])),
    topicsBySource: new Map(topicInventories.map((artifact) => [artifact.data.canonical_route.source_id, artifact.data])),
    courseMapById: new Map(courseMaps.map((artifact) => [artifact.data.map_id, artifact.data])),
  };
}

function validateProfileArtifact(diagnostics, artifact) {
  const profiles = artifact.data.profiles ?? [];
  addDuplicateDiagnostics(diagnostics, profiles.map((profile) => profile.profile_id), {
    file: artifact.file,
    field: '/profiles',
    label: 'language profile ID',
  });
  const requiredTargets = new Map([
    ['5/science', 'grade 5 science'],
    ['6/science', 'grade 6 science'],
    ['7/geography', 'grade 7 geography'],
  ]);
  for (const profile of profiles) requiredTargets.delete(`${profile.grade}/${profile.subject}`);
  for (const label of requiredTargets.values()) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/profiles', `missing reusable default for ${label}`));
  }
}

function validateOfficialLink(diagnostics, artifact, mapId, outcomeIds, indexes, field = '/evidence_linkage') {
  const officialMap = indexes.officialById.get(mapId);
  if (!officialMap) {
    diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/curriculum_map_id`, `unknown official curriculum map ${mapId ?? '<missing>'}`));
    return null;
  }
  if (
    officialMap.grade !== artifact.data.grade
    || officialMap.subject !== artifact.data.subject
    || officialMap.subject_et !== artifact.data.subject_et
  ) {
    diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/curriculum_map_id`, 'official curriculum map grade and subject must match the artifact'));
  }
  const knownOutcomes = new Set((officialMap.outcomes ?? []).map((outcome) => outcome.outcome_id));
  for (const outcomeId of outcomeIds ?? []) {
    if (!knownOutcomes.has(outcomeId)) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/official_outcome_refs`, `unknown official outcome ${outcomeId}`));
    }
  }
  return officialMap;
}

function pageReferences(records, fieldPrefix) {
  return (records ?? []).map((record, index) => ({
    record,
    field: `${fieldPrefix}/${index}`,
    selected: true,
    rejected: false,
  }));
}

function validateArtifactRouteAndPages(diagnostics, artifact, context, indexes, records, fieldPrefix, options = {}) {
  const routeData = validateCanonicalRoute(diagnostics, artifact, context.curriculum);
  const sourceId = artifact.data.canonical_route?.source_id;
  const bookInventory = indexes.booksBySource.get(sourceId);
  if (!bookInventory) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/canonical_route/source_id', `no validated book inventory for ${sourceId ?? '<missing>'}`));
    return routeData;
  }
  validatePageReferences(
    diagnostics,
    artifact,
    routeData,
    bookInventory,
    pageReferences(records, fieldPrefix),
    options,
  );
  return routeData;
}

function resolveMaterialPath(diagnostics, artifact, repositoryPath, field, context) {
  try {
    const resolved = safeRepositoryPath(context.rootDir, repositoryPath, field);
    if (!fsSync.existsSync(resolved) || !fsSync.statSync(resolved).isFile()) {
      diagnostics.push(makeDiagnostic('error', artifact.file, field, `material file does not exist: ${repositoryPath ?? '<missing>'}`));
      return null;
    }
    return resolved;
  } catch (error) {
    diagnostics.push(makeDiagnostic('error', artifact.file, field, error.message));
    return null;
  }
}

function validRecordedDate(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/u.test(value)
    && !Number.isNaN(Date.parse(value));
}

function validateAuthorMaterials(diagnostics, artifact, context) {
  const materials = artifact.data.evidence_linkage?.author_materials ?? [];
  addDuplicateDiagnostics(diagnostics, materials.map((material) => material.material_id), {
    file: artifact.file,
    field: '/evidence_linkage/author_materials',
    label: 'author material ID',
  });
  let allResolved = true;
  let allStudentPrintable = true;
  for (const [index, material] of materials.entries()) {
    const field = `/evidence_linkage/author_materials/${index}`;
    if (!authorProvenance.has(material.provenance?.category)) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/provenance/category`, 'author material requires author-created provenance'));
    }
    const artifactFile = resolveMaterialPath(diagnostics, artifact, material.artifact_path, `${field}/artifact_path`, context);
    if (!artifactFile) allResolved = false;
    if (material.audience === 'student' && /\.ya?ml$/iu.test(material.artifact_path ?? '')) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/artifact_path`, 'student material cannot use a YAML plan as its ready artifact'));
      allStudentPrintable = false;
    }
    if (material.printable && !/\.(?:md|html)$/iu.test(material.artifact_path ?? '')) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/printable`, 'printable material must be a Markdown or HTML file'));
      if (material.audience === 'student') allStudentPrintable = false;
    }
    if (material.audience === 'student' && material.printable !== true) allStudentPrintable = false;
    if (['worksheet', 'assessment'].includes(material.material_type)) {
      if (!material.answer_key_path && !material.answer_key_exemption?.open_ended) {
        diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/answer_key_path`, `${material.material_type} requires an answer key or an explicit open-ended exemption`));
        allResolved = false;
      }
    }
    if (material.answer_key_path) {
      const answerKey = resolveMaterialPath(diagnostics, artifact, material.answer_key_path, `${field}/answer_key_path`, context);
      if (!answerKey) allResolved = false;
      if (answerKey && artifactFile && answerKey === artifactFile) {
        diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/answer_key_path`, 'answer key must be separate from the student artifact'));
        allResolved = false;
      }
    }
  }
  return { allResolved, allStudentPrintable };
}

function validateLessonReadiness(diagnostics, artifact, materialState) {
  const readiness = artifact.data.artifact_readiness ?? {};
  const review = readiness.teacher_review ?? {};
  const trial = readiness.classroom_trial ?? {};
  if (readiness.content_complete && !readiness.schema_complete) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/artifact_readiness/content_complete', 'content_complete requires schema_complete'));
  }
  if (readiness.materials_resolved && !materialState.allResolved) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/artifact_readiness/materials_resolved', 'materials_resolved cannot be true while a declared material or answer key is unresolved'));
  }
  if (readiness.materials_resolved && !readiness.content_complete) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/artifact_readiness/materials_resolved', 'materials_resolved requires content_complete'));
  }
  if (readiness.print_ready && !materialState.allStudentPrintable) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/artifact_readiness/print_ready', 'print_ready cannot be true while a required student material is not printable'));
  }
  if (readiness.print_ready && !readiness.materials_resolved) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/artifact_readiness/print_ready', 'print_ready requires materials_resolved'));
  }
  if (review.status === 'approved') {
    if (!normalize(review.reviewer_role) || !validRecordedDate(review.reviewed_at) || !normalize(review.notes)) {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/artifact_readiness/teacher_review', 'approved teacher review requires reviewer role, valid date, and notes'));
    }
  } else if (review.status === 'pending' && review.reviewed_at !== null) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/artifact_readiness/teacher_review/reviewed_at', 'pending teacher review must not record a review date'));
  }
  if (trial.status === 'tested') {
    if (!validRecordedDate(trial.tested_at) || !normalize(trial.context) || !normalize(trial.notes)) {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/artifact_readiness/classroom_trial', 'tested classroom trial requires a valid date, context, and notes'));
    }
  } else if (trial.status === 'not_tested' && (trial.tested_at !== null || trial.context !== null)) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/artifact_readiness/classroom_trial', 'not_tested classroom trial must not record a date or context'));
  }
  const status = readiness.readiness_status;
  if (status === 'schema_complete' && !readiness.schema_complete) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/artifact_readiness/readiness_status', 'schema_complete status requires schema_complete: true'));
  }
  if (status === 'content_complete' && !(readiness.schema_complete && readiness.content_complete)) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/artifact_readiness/readiness_status', 'content_complete status requires schema_complete and content_complete'));
  }
  const requiresResolvedPack = [
    'materials_resolved',
    'print_ready',
    'teacher_pack_complete_pending_review',
    'teacher_reviewed',
    'classroom_tested',
    'classroom_ready',
  ].includes(status);
  if (requiresResolvedPack && !(readiness.schema_complete && readiness.content_complete && readiness.materials_resolved)) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/artifact_readiness/readiness_status', `${status} requires schema, content, and materials to be complete`));
  }
  if (['print_ready', 'teacher_pack_complete_pending_review', 'teacher_reviewed', 'classroom_tested', 'classroom_ready'].includes(status) && !readiness.print_ready) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/artifact_readiness/readiness_status', `${status} requires print_ready`));
  }
  if (status === 'teacher_pack_complete_pending_review' && review.status !== 'pending') {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/artifact_readiness/readiness_status', 'teacher_pack_complete_pending_review requires pending teacher review'));
  }
  if (status === 'teacher_reviewed' && review.status !== 'approved') {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/artifact_readiness/readiness_status', 'teacher_reviewed requires approved teacher review'));
  }
  if (status === 'classroom_tested' && trial.status !== 'tested') {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/artifact_readiness/readiness_status', 'classroom_tested requires a recorded classroom trial'));
  }
  if (status === 'classroom_ready' && readiness.classroom_ready !== true) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/artifact_readiness/readiness_status', 'classroom_ready status requires classroom_ready: true'));
  }
  if (readiness.classroom_ready) {
    const unresolvedReadinessWarnings = [];
    if (review.status !== 'approved') unresolvedReadinessWarnings.push('teacher review is not approved');
    if (trial.status !== 'tested') unresolvedReadinessWarnings.push('classroom trial is not recorded');
    if (!readiness.print_ready || !materialState.allResolved || !materialState.allStudentPrintable) unresolvedReadinessWarnings.push('materials are not fully resolved and printable');
    if (unresolvedReadinessWarnings.length > 0) {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/artifact_readiness/classroom_ready', `classroom_ready cannot be true with unresolved readiness warnings: ${unresolvedReadinessWarnings.join('; ')}`));
    }
    if (status !== 'classroom_ready') {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/artifact_readiness/readiness_status', 'classroom_ready: true requires readiness_status classroom_ready'));
    }
  }
}

function validateLessonEvidence(diagnostics, artifact, context, indexes) {
  const lesson = artifact.data;
  const records = lesson.evidence_linkage?.opiq_records ?? [];
  addDuplicateDiagnostics(diagnostics, records.map((record) => record.record_id), {
    file: artifact.file, field: '/evidence_linkage/opiq_records', label: 'lesson Opiq record ID',
  });
  addDuplicateDiagnostics(diagnostics, records.map((record) => record.canonical_url), {
    file: artifact.file, field: '/evidence_linkage/opiq_records', label: 'lesson canonical URL',
  });
  const allowSimplifiedSelection = lesson.differentiation?.simplified_curriculum_opt_in?.enabled === true;
  validateArtifactRouteAndPages(
    diagnostics,
    artifact,
    context,
    indexes,
    records,
    '/evidence_linkage/opiq_records',
    { allowSimplifiedSelection },
  );
  const officialMap = validateOfficialLink(
    diagnostics,
    artifact,
    lesson.evidence_linkage?.curriculum_map_id,
    lesson.evidence_linkage?.official_outcome_refs,
    indexes,
  );
  const courseMap = indexes.courseMapById.get(lesson.evidence_linkage?.course_map_ref);
  if (!courseMap) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/evidence_linkage/course_map_ref', `unknown course map ${lesson.evidence_linkage?.course_map_ref ?? '<missing>'}`));
  } else {
    if (
      courseMap.grade !== lesson.grade
      || courseMap.subject !== lesson.subject
      || courseMap.canonical_route?.source_id !== lesson.canonical_route?.source_id
    ) {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/evidence_linkage/course_map_ref', 'course map route, grade, and subject must match the lesson'));
    }
    const selectedUrls = new Set((courseMap.selected_records ?? []).map((record) => record.canonical_url));
    for (const [index, record] of records.entries()) {
      if (!selectedUrls.has(record.canonical_url)) {
        diagnostics.push(makeDiagnostic('error', artifact.file, `/evidence_linkage/opiq_records/${index}/canonical_url`, 'lesson Opiq evidence must be selected in the linked merged course map'));
      }
    }
  }
  const objectiveOutcomes = (lesson.objectives?.content_objectives ?? [])
    .flatMap((objective) => objective.curriculum_outcome_refs ?? []);
  const linkedOutcomes = lesson.evidence_linkage?.official_outcome_refs ?? [];
  for (const outcomeId of objectiveOutcomes) {
    if (!linkedOutcomes.includes(outcomeId)) {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/objectives/content_objectives', `objective references unlinked outcome ${outcomeId}`));
    }
  }
  if (officialMap && objectiveOutcomes.length === 0) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/objectives/content_objectives', 'content objectives require official outcome references'));
  }
  return validateAuthorMaterials(diagnostics, artifact, context);
}

function validateLessonMethodology(diagnostics, artifact) {
  const lesson = artifact.data;
  const methodology = lesson.methodology ?? {};
  if (methodology.model !== 'russian_primary_estonian_supported') {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/methodology/model', 'required methodology model is russian_primary_estonian_supported'));
  }
  const approaches = new Set(methodology.approaches ?? []);
  for (const approach of requiredApproaches) {
    if (!approaches.has(approach)) diagnostics.push(makeDiagnostic('error', artifact.file, '/methodology/approaches', `missing required approach ${approach}`));
  }
  if (lesson.instruction_language !== 'ru' || lesson.subject_support_language !== 'et') {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/instruction_language', 'russian_primary_estonian_supported requires ru instruction and et subject support'));
  }
  const vaguePatterns = [
    /improve estonian/u,
    /practise language/u,
    /understand terminology/u,
    /улучшить эстон/u,
    /практиковать язык/u,
    /понять терминолог/u,
    /parandada eesti/u,
    /harjutada keelt/u,
    /mõista terminoloog/u,
  ];
  for (const [index, objective] of (lesson.objectives?.estonian_language_objectives ?? []).entries()) {
    const text = normalize(`${objective.text_ru ?? ''} ${objective.text_et ?? ''}`);
    if (vaguePatterns.some((pattern) => pattern.test(text))) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `/objectives/estonian_language_objectives/${index}`, 'language objective is vague; require a measurable learner output'));
    }
    if (!objective.observable_output || !Number.isInteger(objective.minimum_quantity)) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `/objectives/estonian_language_objectives/${index}`, 'language objective requires observable_output and minimum_quantity'));
    }
  }
}

function validateLessonLanguageLoad(diagnostics, artifact) {
  const lesson = artifact.data;
  const load = lesson.language_load ?? {};
  const newTerms = load.new_terms_et ?? [];
  const recycledTerms = load.recycled_terms_et ?? [];
  const newVerbs = load.new_instruction_verbs_et ?? [];
  const recycledVerbs = load.recycled_instruction_verbs_et ?? [];
  const newTermNames = newTerms.map((term) => normalize(term.term_et));
  const recycledTermNames = recycledTerms.map((term) => normalize(term.term_et));
  const newVerbNames = newVerbs.map((verb) => normalize(verb.verb_et));
  const recycledVerbNames = recycledVerbs.map((verb) => normalize(verb.verb_et));
  for (const [values, label, field] of [
    [newTermNames, 'new term', '/language_load/new_terms_et'],
    [recycledTermNames, 'recycled term', '/language_load/recycled_terms_et'],
    [newVerbNames, 'new instruction verb', '/language_load/new_instruction_verbs_et'],
    [recycledVerbNames, 'recycled instruction verb', '/language_load/recycled_instruction_verbs_et'],
  ]) addDuplicateDiagnostics(diagnostics, values, { file: artifact.file, field, label });
  for (const value of newTermNames) {
    if (recycledTermNames.includes(value)) diagnostics.push(makeDiagnostic('error', artifact.file, '/language_load', `term cannot be both new and recycled: ${value}`));
  }
  for (const value of newVerbNames) {
    if (recycledVerbNames.includes(value)) diagnostics.push(makeDiagnostic('error', artifact.file, '/language_load', `instruction verb cannot be both new and recycled: ${value}`));
  }
  if (newTermNames.length + recycledTermNames.length === 0) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/language_load', 'lesson requires Estonian subject terminology'));
  }
  if (!normalize(load.full_expected_answer_ru)) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/language_load/full_expected_answer_ru', 'lesson requires a full Russian subject answer target'));
  }
  if (!normalize(load.short_expected_oral_answer_et)) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/language_load/short_expected_oral_answer_et', 'lesson requires short Estonian oral output'));
  }
  const availableTerms = new Set([...newTermNames, ...recycledTermNames]);
  for (const [index, term] of (load.oral_output_terms_et ?? []).entries()) {
    if (!availableTerms.has(normalize(term))) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `/language_load/oral_output_terms_et/${index}`, `oral-output term was not introduced or recycled: ${term}`));
    }
  }
  for (const [index, sentence] of (load.model_sentences ?? []).entries()) {
    for (const term of sentence.terms_et ?? []) {
      if (!availableTerms.has(normalize(term))) {
        diagnostics.push(makeDiagnostic('error', artifact.file, `/language_load/model_sentences/${index}/terms_et`, `model-sentence term was not introduced or recycled: ${term}`));
      }
    }
  }
  const counts = lesson.cognitive_load ?? {};
  const expectedCounts = [
    ['new_estonian_terms', newTerms.length],
    ['new_instruction_verbs', newVerbs.length],
    ['new_sentence_structures', (load.sentence_frames ?? []).length],
    ['independent_output_sentences', (load.expected_independent_productive_language_et ?? []).length],
  ];
  for (const [field, expected] of expectedCounts) {
    if (counts[field] !== expected) diagnostics.push(makeDiagnostic('error', artifact.file, `/cognitive_load/${field}`, `expected ${expected}, found ${counts[field]}`));
  }
}

function validateLessonStages(diagnostics, artifact) {
  const lesson = artifact.data;
  const stages = lesson.stages ?? [];
  const stageIds = stages.map((stage) => stage.stage_id);
  const stageOrder = new Map(stageIds.map((id, index) => [id, index]));
  addDuplicateDiagnostics(diagnostics, stageIds, { file: artifact.file, field: '/stages', label: 'stage ID' });
  const duration = stages.reduce((sum, stage) => sum + (stage.duration_minutes ?? 0), 0);
  const tolerance = lesson.duration_tolerance?.minutes ?? 0;
  if (Math.abs(duration - (lesson.duration_minutes ?? 0)) > tolerance) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/stages', `stage duration total ${duration} does not reconcile with lesson duration ${lesson.duration_minutes} and tolerance ${tolerance}`));
  }
  const languagePath = lesson.methodology?.language_path ?? [];
  addDuplicateDiagnostics(diagnostics, languagePath.map((step) => step.sequence), {
    file: artifact.file, field: '/methodology/language_path', label: 'language-path sequence',
  });
  for (const [index, step] of languagePath.entries()) {
    if (!stageOrder.has(step.stage_id)) diagnostics.push(makeDiagnostic('error', artifact.file, `/methodology/language_path/${index}/stage_id`, `unknown stage ${step.stage_id}`));
    if (step.sequence !== index + 1) diagnostics.push(makeDiagnostic('error', artifact.file, `/methodology/language_path/${index}/sequence`, `expected sequence ${index + 1}`));
  }
  const recordIds = (lesson.evidence_linkage?.opiq_records ?? []).map((record) => record.record_id);
  const materialIds = (lesson.evidence_linkage?.author_materials ?? []).map((material) => material.material_id);
  const knownMaterials = new Set([...recordIds, ...materialIds]);
  addDuplicateDiagnostics(diagnostics, [...recordIds, ...materialIds], {
    file: artifact.file, field: '/evidence_linkage', label: 'material reference ID',
  });
  const scaffolds = lesson.scaffolds ?? [];
  const scaffoldIds = scaffolds.map((scaffold) => scaffold.scaffold_id);
  const knownScaffolds = new Set(scaffoldIds);
  addDuplicateDiagnostics(diagnostics, scaffoldIds, { file: artifact.file, field: '/scaffolds', label: 'scaffold ID' });
  for (const [index, scaffold] of scaffolds.entries()) {
    for (const stageId of [...(scaffold.stage_refs ?? []), scaffold.release?.at_stage]) {
      if (stageId && !stageOrder.has(stageId)) diagnostics.push(makeDiagnostic('error', artifact.file, `/scaffolds/${index}`, `unknown scaffold stage ${stageId}`));
    }
  }
  for (const [index, stage] of stages.entries()) {
    const provenanceRefs = new Set(stage.provenance_refs ?? []);
    for (const materialRef of [...(stage.material_refs ?? []), ...provenanceRefs]) {
      if (!knownMaterials.has(materialRef)) diagnostics.push(makeDiagnostic('error', artifact.file, `/stages/${index}/material_refs`, `unknown material or provenance reference ${materialRef}`));
    }
    for (const materialRef of stage.material_refs ?? []) {
      if (!provenanceRefs.has(materialRef)) diagnostics.push(makeDiagnostic('error', artifact.file, `/stages/${index}/provenance_refs`, `material ${materialRef} requires stage-level provenance linkage`));
    }
    for (const scaffoldRef of stage.scaffold_refs ?? []) {
      if (!knownScaffolds.has(scaffoldRef)) diagnostics.push(makeDiagnostic('error', artifact.file, `/stages/${index}/scaffold_refs`, `unknown scaffold ${scaffoldRef}`));
      const scaffold = scaffolds.find((candidate) => candidate.scaffold_id === scaffoldRef);
      if (scaffold && !(scaffold.stage_refs ?? []).includes(stage.stage_id)) {
        diagnostics.push(makeDiagnostic('error', artifact.file, `/stages/${index}/scaffold_refs`, `scaffold ${scaffoldRef} does not declare stage ${stage.stage_id}`));
      }
    }
    if ((stage.new_language_items ?? []).length > 0 && (stage.scaffold_refs ?? []).length === 0) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `/stages/${index}/scaffold_refs`, 'stage introducing new language requires a linked scaffold'));
    }
  }
  for (const [index, support] of (lesson.multimodal_support ?? []).entries()) {
    if (!knownMaterials.has(support.material_ref)) diagnostics.push(makeDiagnostic('error', artifact.file, `/multimodal_support/${index}/material_ref`, `unknown material ${support.material_ref}`));
    for (const stageId of support.stage_refs ?? []) {
      if (!stageOrder.has(stageId)) diagnostics.push(makeDiagnostic('error', artifact.file, `/multimodal_support/${index}/stage_refs`, `unknown stage ${stageId}`));
    }
  }
  const allNewLanguage = new Set([
    ...(lesson.language_load?.new_terms_et ?? []).map((term) => normalize(term.term_et)),
    ...(lesson.language_load?.new_instruction_verbs_et ?? []).map((verb) => normalize(verb.verb_et)),
  ]);
  for (const [group, nameField] of [
    [lesson.language_load?.new_terms_et ?? [], 'term_et'],
    [lesson.language_load?.new_instruction_verbs_et ?? [], 'verb_et'],
  ]) {
    for (const item of group) {
      const first = item.first_use_stage;
      if (!stageOrder.has(first)) diagnostics.push(makeDiagnostic('error', artifact.file, '/language_load', `unknown first-use stage ${first}`));
      const stage = stages.find((candidate) => candidate.stage_id === first);
      if (stage && !(stage.new_language_items ?? []).map(normalize).includes(normalize(item[nameField]))) {
        diagnostics.push(makeDiagnostic('error', artifact.file, '/language_load', `${item[nameField]} is absent from new_language_items at ${first}`));
      }
      for (const reuse of item.reuse_stage_refs ?? []) {
        if (!stageOrder.has(reuse)) diagnostics.push(makeDiagnostic('error', artifact.file, '/language_load', `unknown reuse stage ${reuse}`));
        else if (stageOrder.get(reuse) <= stageOrder.get(first)) diagnostics.push(makeDiagnostic('error', artifact.file, '/language_load', `${item[nameField]} reuse stage must follow its first-use stage`));
      }
    }
  }
  for (const [index, stage] of stages.entries()) {
    for (const item of stage.new_language_items ?? []) {
      if (!allNewLanguage.has(normalize(item))) diagnostics.push(makeDiagnostic('error', artifact.file, `/stages/${index}/new_language_items`, `undeclared new language item ${item}`));
    }
  }
}

function validateLessonReferencesAndAssessment(diagnostics, artifact) {
  const lesson = artifact.data;
  const objectiveIds = new Set([
    ...(lesson.objectives?.content_objectives ?? []).map((objective) => objective.objective_id),
    ...(lesson.objectives?.estonian_language_objectives ?? []).map((objective) => objective.objective_id),
  ]);
  addDuplicateDiagnostics(diagnostics, [...objectiveIds], { file: artifact.file, field: '/objectives', label: 'objective ID' });
  const knownRefs = new Set([
    ...(lesson.evidence_linkage?.opiq_records ?? []).map((record) => record.record_id),
    ...(lesson.evidence_linkage?.author_materials ?? []).map((material) => material.material_id),
  ]);
  for (const [index, question] of (lesson.questions ?? []).entries()) {
    for (const objectiveRef of question.objective_refs ?? []) {
      if (!objectiveIds.has(objectiveRef)) diagnostics.push(makeDiagnostic('error', artifact.file, `/questions/${index}/objective_refs`, `unknown objective ${objectiveRef}`));
    }
    for (const provenanceRef of question.provenance_refs ?? []) {
      if (!knownRefs.has(provenanceRef)) diagnostics.push(makeDiagnostic('error', artifact.file, `/questions/${index}/provenance_refs`, `unknown provenance reference ${provenanceRef}`));
    }
  }
  const practical = lesson.practical_work;
  if (practical) {
    const recordIds = new Set((lesson.evidence_linkage?.opiq_records ?? []).map((record) => record.record_id));
    for (const id of practical.opiq_source_record_ids ?? []) {
      if (!recordIds.has(id)) diagnostics.push(makeDiagnostic('error', artifact.file, '/practical_work/opiq_source_record_ids', `unknown selected Opiq record ${id}`));
    }
    for (const ref of practical.provenance_refs ?? []) {
      if (!knownRefs.has(ref)) diagnostics.push(makeDiagnostic('error', artifact.file, '/practical_work/provenance_refs', `unknown provenance reference ${ref}`));
    }
    if ((practical.safety_requirements ?? []).length === 0) diagnostics.push(makeDiagnostic('error', artifact.file, '/practical_work/safety_requirements', 'practical work requires safety information'));
  }
  const assessments = lesson.assessment ?? [];
  const domains = new Set(assessments.map((criterion) => criterion.domain));
  const requiredDomains = [
    'subject_understanding',
    'estonian_terminology_recognition',
    'supported_estonian_production',
    'independent_estonian_production',
  ];
  if (practical) requiredDomains.push('practical_skill');
  for (const domain of requiredDomains) {
    if (!domains.has(domain)) diagnostics.push(makeDiagnostic('error', artifact.file, '/assessment', `missing assessment domain ${domain}`));
  }
  const pureSubject = assessments.some((criterion) => ['subject_understanding', 'practical_skill'].includes(criterion.domain) && criterion.affects === 'subject_assessment');
  const pureLanguage = assessments.some((criterion) => criterion.domain.startsWith('estonian_') || criterion.domain.includes('estonian'))
    && assessments.some((criterion) => (criterion.domain.startsWith('estonian_') || criterion.domain.includes('estonian')) && criterion.affects === 'language_assessment');
  if (!pureSubject || !pureLanguage) diagnostics.push(makeDiagnostic('error', artifact.file, '/assessment', 'content and Estonian-language assessment must have separate criteria'));
  for (const [index, criterion] of assessments.entries()) {
    if (['subject_understanding', 'practical_skill'].includes(criterion.domain) && criterion.affects === 'language_assessment') {
      diagnostics.push(makeDiagnostic('error', artifact.file, `/assessment/${index}/affects`, 'subject or practical evidence cannot affect only language assessment'));
    }
    if (criterion.domain.includes('estonian') && criterion.affects === 'subject_assessment') {
      diagnostics.push(makeDiagnostic('error', artifact.file, `/assessment/${index}/affects`, 'Estonian production cannot affect only subject assessment'));
    }
  }
  const homeworkUrl = lesson.homework?.required_opiq_url;
  if (homeworkUrl && !(lesson.evidence_linkage?.opiq_records ?? []).some((record) => record.canonical_url === homeworkUrl)) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/homework/required_opiq_url', 'homework Opiq URL must be selected in lesson evidence'));
  }
}

function validateLessonProfile(diagnostics, artifact, profiles) {
  const lesson = artifact.data;
  const use = lesson.learner_language_profile ?? {};
  const profile = profiles.get(use.profile_id);
  if (!profile) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/learner_language_profile/profile_id', `unknown language profile ${use.profile_id ?? '<missing>'}`));
    return null;
  }
  if (profile.grade !== lesson.grade || profile.subject !== lesson.subject) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/learner_language_profile/profile_id', 'language profile grade and subject must match lesson'));
  }
  if (use.uses_default && use.learner_language_level !== profile.learner_language_level) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/learner_language_profile/learner_language_level', `default profile level is ${profile.learner_language_level}`));
  }
  if (!use.uses_default) {
    const overridden = new Set((use.overrides ?? []).map((override) => override.field));
    if (use.learner_language_level !== profile.learner_language_level && !overridden.has('learner_language_level')) {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/learner_language_profile/overrides', 'changed learner level requires an explicit learner-specific override'));
    }
  }
  return profile;
}

function addLessonWarnings(diagnostics, artifact, profile) {
  if (!profile) return;
  const lesson = artifact.data;
  const thresholds = profile.warning_thresholds ?? {};
  const load = lesson.language_load ?? {};
  const warningChecks = [
    [(load.new_terms_et ?? []).length, thresholds.max_new_terms_per_lesson, '/language_load/new_terms_et', 'new Estonian terms'],
    [(load.new_instruction_verbs_et ?? []).length, thresholds.max_new_instruction_verbs_per_lesson, '/language_load/new_instruction_verbs_et', 'new Estonian instruction verbs'],
    [(load.sentence_frames ?? []).length, thresholds.max_new_sentence_structures_per_lesson, '/language_load/sentence_frames', 'new sentence structures'],
    [(load.expected_independent_productive_language_et ?? []).length, thresholds.max_independent_output_sentences, '/language_load/expected_independent_productive_language_et', 'independent Estonian output sentences'],
  ];
  for (const [actual, maximum, field, label] of warningChecks) {
    if (Number.isInteger(maximum) && actual > maximum) diagnostics.push(makeDiagnostic('warning', artifact.file, field, `${label} ${actual} exceed profile threshold ${maximum}`));
  }
  if (
    thresholds.warn_if_no_recycled_terms_after_first_lesson
    && lesson.position_in_unit > 1
    && (load.recycled_terms_et ?? []).length === 0
  ) diagnostics.push(makeDiagnostic('warning', artifact.file, '/language_load/recycled_terms_et', 'lesson after position 1 has no recycled Estonian term'));
  if ((load.expected_independent_productive_language_et ?? []).length === 0) {
    diagnostics.push(makeDiagnostic('warning', artifact.file, '/language_load/expected_independent_productive_language_et', 'lesson has no independent Estonian output'));
  }
  const release = lesson.methodology?.scaffold_release ?? {};
  if (release.introduction === release.guided_practice && release.guided_practice === release.final_output) {
    diagnostics.push(makeDiagnostic('warning', artifact.file, '/methodology/scaffold_release', 'lesson does not reduce scaffold level'));
  }
  if ((lesson.cognitive_load?.new_subject_concepts ?? 0) > 0 && (lesson.multimodal_support ?? []).length === 0) {
    diagnostics.push(makeDiagnostic('warning', artifact.file, '/multimodal_support', 'new subject concepts have no multimodal support'));
  }
}

function validateLesson(diagnostics, artifact, context, indexes, profiles) {
  const materialState = validateLessonEvidence(diagnostics, artifact, context, indexes);
  validateLessonMethodology(diagnostics, artifact);
  validateLessonLanguageLoad(diagnostics, artifact);
  validateLessonStages(diagnostics, artifact);
  validateLessonReferencesAndAssessment(diagnostics, artifact);
  validateLessonReadiness(diagnostics, artifact, materialState ?? { allResolved: false, allStudentPrintable: false });
  const profile = validateLessonProfile(diagnostics, artifact, profiles);
  addLessonWarnings(diagnostics, artifact, profile);
}

function validateUnit(diagnostics, artifact, context, indexes, lessonsById) {
  const unit = artifact.data;
  const records = unit.selected_opiq_sources ?? [];
  addDuplicateDiagnostics(diagnostics, records.map((record) => record.record_id), {
    file: artifact.file, field: '/selected_opiq_sources', label: 'unit Opiq record ID',
  });
  addDuplicateDiagnostics(diagnostics, records.map((record) => record.canonical_url), {
    file: artifact.file, field: '/selected_opiq_sources', label: 'unit canonical URL',
  });
  validateArtifactRouteAndPages(diagnostics, artifact, context, indexes, records, '/selected_opiq_sources');
  const officialMap = validateOfficialLink(
    diagnostics,
    artifact,
    unit.curriculum_map_id,
    (unit.linked_outcomes ?? []).map((mapping) => mapping.outcome_id),
    indexes,
    '/',
  );
  const courseMap = indexes.courseMapById.get(unit.course_map_ref);
  if (!courseMap) diagnostics.push(makeDiagnostic('error', artifact.file, '/course_map_ref', `unknown course map ${unit.course_map_ref ?? '<missing>'}`));
  else {
    const selectedUrls = new Set((courseMap.selected_records ?? []).map((record) => record.canonical_url));
    for (const [index, record] of records.entries()) {
      if (!selectedUrls.has(record.canonical_url)) diagnostics.push(makeDiagnostic('error', artifact.file, `/selected_opiq_sources/${index}/canonical_url`, 'unit source must be selected in the linked merged course map'));
    }
    const mappingStatus = new Map((courseMap.official_curriculum?.outcome_mappings ?? []).map((mapping) => [mapping.outcome_id, mapping.coverage_status]));
    for (const [index, mapping] of (unit.linked_outcomes ?? []).entries()) {
      if (mappingStatus.get(mapping.outcome_id) !== mapping.coverage_status) diagnostics.push(makeDiagnostic('error', artifact.file, `/linked_outcomes/${index}/coverage_status`, `expected linked course-map status ${mappingStatus.get(mapping.outcome_id) ?? '<missing>'}`));
    }
  }
  if (officialMap?.official_scope?.kind === 'school_stage' && unit.completeness?.declared_complete) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/completeness', 'school-stage pilot with partial mappings cannot declare complete curriculum coverage'));
  }
  const lessonIds = unit.lesson_ids ?? [];
  addDuplicateDiagnostics(diagnostics, lessonIds, { file: artifact.file, field: '/lesson_ids', label: 'lesson ID' });
  const sequence = unit.recommended_lesson_sequence ?? [];
  if (!sameSet(lessonIds, sequence.map((entry) => entry.lesson_id))) diagnostics.push(makeDiagnostic('error', artifact.file, '/recommended_lesson_sequence', 'sequence lesson IDs must exactly match lesson_ids'));
  if (unit.lesson_count !== lessonIds.length) diagnostics.push(makeDiagnostic('error', artifact.file, '/lesson_count', `expected ${lessonIds.length}`));
  let totalDuration = 0;
  for (const [index, entry] of sequence.entries()) {
    if (entry.order !== index + 1) diagnostics.push(makeDiagnostic('error', artifact.file, `/recommended_lesson_sequence/${index}/order`, `expected order ${index + 1}`));
    const lessonArtifact = lessonsById.get(entry.lesson_id);
    if (!lessonArtifact) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `/recommended_lesson_sequence/${index}/lesson_id`, `unknown lesson reference ${entry.lesson_id}`));
      continue;
    }
    const lesson = lessonArtifact.data;
    totalDuration += lesson.duration_minutes ?? 0;
    if (entry.duration_minutes !== lesson.duration_minutes) diagnostics.push(makeDiagnostic('error', artifact.file, `/recommended_lesson_sequence/${index}/duration_minutes`, `expected linked lesson duration ${lesson.duration_minutes}`));
    if (lesson.position_in_unit !== entry.order || lesson.unit_ref !== unit.unit_id) diagnostics.push(makeDiagnostic('error', artifact.file, `/recommended_lesson_sequence/${index}`, 'linked lesson position and unit_ref must match the sequence'));
    for (const field of ['grade', 'subject', 'subject_et']) {
      if (lesson[field] !== unit[field]) diagnostics.push(makeDiagnostic('error', artifact.file, `/recommended_lesson_sequence/${index}`, `linked lesson ${field} must match unit`));
    }
    if (lesson.canonical_route?.source_id !== unit.canonical_route?.source_id) diagnostics.push(makeDiagnostic('error', artifact.file, `/recommended_lesson_sequence/${index}`, 'linked lesson canonical route must match unit'));
  }
  if (unit.expected_total_duration_minutes !== totalDuration) diagnostics.push(makeDiagnostic('error', artifact.file, '/expected_total_duration_minutes', `expected linked lesson total ${totalDuration}`));
  const selectedUrls = new Set(records.map((record) => record.canonical_url));
  for (const lessonId of lessonIds) {
    const lesson = lessonsById.get(lessonId)?.data;
    for (const record of lesson?.evidence_linkage?.opiq_records ?? []) {
      if (!selectedUrls.has(record.canonical_url)) diagnostics.push(makeDiagnostic('error', artifact.file, '/selected_opiq_sources', `linked lesson URL is missing from unit sources: ${record.canonical_url}`));
    }
  }
  for (const [index, mapping] of (unit.linked_outcomes ?? []).entries()) {
    for (const lessonId of mapping.lesson_ids ?? []) {
      const lesson = lessonsById.get(lessonId)?.data;
      if (!lesson) diagnostics.push(makeDiagnostic('error', artifact.file, `/linked_outcomes/${index}/lesson_ids`, `unknown lesson reference ${lessonId}`));
      else if (!(lesson.evidence_linkage?.official_outcome_refs ?? []).includes(mapping.outcome_id)) diagnostics.push(makeDiagnostic('error', artifact.file, `/linked_outcomes/${index}/lesson_ids`, `lesson ${lessonId} does not reference outcome ${mapping.outcome_id}`));
    }
  }
  const teacherPack = unit.teacher_pack ?? {};
  try {
    const packDirectory = safeRepositoryPath(context.rootDir, teacherPack.path, 'teacher_pack path');
    if (!fsSync.existsSync(packDirectory) || !fsSync.statSync(packDirectory).isDirectory()) {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/teacher_pack/path', `teacher-pack directory does not exist: ${teacherPack.path ?? '<missing>'}`));
    } else if (!fsSync.existsSync(path.join(packDirectory, 'materials-index.yaml'))) {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/teacher_pack/path', 'teacher-pack directory requires materials-index.yaml'));
    }
  } catch (error) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/teacher_pack/path', error.message));
  }
  const linkedReadiness = lessonIds.map((lessonId) => lessonsById.get(lessonId)?.data.artifact_readiness).filter(Boolean);
  if (teacherPack.materials_resolved && linkedReadiness.some((readiness) => !readiness.materials_resolved)) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/teacher_pack/materials_resolved', 'teacher pack cannot resolve materials while a linked lesson remains unresolved'));
  }
  if (teacherPack.print_ready && linkedReadiness.some((readiness) => !readiness.print_ready)) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/teacher_pack/print_ready', 'teacher pack cannot be print ready while a linked lesson is not print ready'));
  }
  if (teacherPack.teacher_review_status === 'approved' && linkedReadiness.some((readiness) => readiness.teacher_review?.status !== 'approved')) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/teacher_pack/teacher_review_status', 'approved teacher pack requires approved review for every linked lesson'));
  }
  if (teacherPack.classroom_ready && linkedReadiness.some((readiness) => !readiness.classroom_ready)) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/teacher_pack/classroom_ready', 'classroom-ready teacher pack requires every linked lesson to be classroom ready'));
  }
  validateUnitProgressions(diagnostics, artifact, lessonsById);
}

function validateUnitProgressions(diagnostics, artifact, lessonsById) {
  const unit = artifact.data;
  const lessonIds = unit.lesson_ids ?? [];
  const lessonIdSet = new Set(lessonIds);
  const lessonOrder = new Map((unit.recommended_lesson_sequence ?? [])
    .map((entry, index) => [entry.lesson_id, index]));
  const glossary = unit.cumulative_glossary ?? [];
  addDuplicateDiagnostics(diagnostics, glossary.map((entry) => normalize(entry.term_et)), {
    file: artifact.file, field: '/cumulative_glossary', label: 'glossary term',
  });
  const glossaryByTerm = new Map(glossary.map((entry) => [normalize(entry.term_et), entry]));
  const introductionsByTerm = new Map();
  for (const lessonId of lessonIds) {
    const lesson = lessonsById.get(lessonId)?.data;
    for (const term of lesson?.language_load?.new_terms_et ?? []) {
      const termName = normalize(term.term_et);
      const introductionLessons = introductionsByTerm.get(termName) ?? new Set();
      introductionLessons.add(lessonId);
      introductionsByTerm.set(termName, introductionLessons);
    }
  }
  for (const [term, introductionLessons] of introductionsByTerm) {
    const entry = glossaryByTerm.get(term);
    if (!entry) diagnostics.push(makeDiagnostic('error', artifact.file, '/cumulative_glossary', `new lesson term is missing from glossary: ${term}`));
    const uniqueIntroductionLessons = [...introductionLessons];
    if (uniqueIntroductionLessons.length > 1) {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/cumulative_glossary', `term ${term} is introduced by multiple linked lessons: ${uniqueIntroductionLessons.join(', ')}`));
    } else if (entry && entry.introduced_in_lesson !== uniqueIntroductionLessons[0]) {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/cumulative_glossary', `term ${term} must be introduced in ${uniqueIntroductionLessons[0]}`));
    }
  }
  for (const [index, entry] of glossary.entries()) {
    const term = normalize(entry.term_et);
    const field = `/cumulative_glossary/${index}`;
    const introductionLessonId = entry.introduced_in_lesson;
    const introductionOrder = lessonOrder.get(introductionLessonId);
    const introductionLessons = introductionsByTerm.get(term);
    if (!lessonIdSet.has(introductionLessonId)) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/introduced_in_lesson`, `introduction lesson ${introductionLessonId} is not linked to the thematic plan`));
    }
    if (!introductionLessons) {
      diagnostics.push(makeDiagnostic('error', artifact.file, field, `glossary term is not introduced by a linked lesson: ${entry.term_et}`));
    }
    const recyclingLessonIds = entry.recycled_in_lessons ?? [];
    addDuplicateDiagnostics(diagnostics, recyclingLessonIds, {
      file: artifact.file, field: `${field}/recycled_in_lessons`, label: `recycling lesson for term ${entry.term_et}`,
    });
    if (
      recyclingLessonIds.length === 0
      && introductionOrder !== undefined
      && introductionLessons?.has(introductionLessonId)
    ) {
      diagnostics.push(makeDiagnostic(
        'warning',
        artifact.file,
        `${field}/recycled_in_lessons`,
        `term ${entry.term_et} is introduced in lesson ${introductionOrder + 1} but is not recycled in a later lesson of the unit`,
      ));
    }
    for (const lessonId of recyclingLessonIds) {
      if (!lessonIdSet.has(lessonId)) {
        diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/recycled_in_lessons`, `recycling lesson ${lessonId} is not linked to the thematic plan`));
        continue;
      }
      if (lessonId === introductionLessonId) {
        diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/recycled_in_lessons`, `term ${entry.term_et} cannot be recycled in its introduction lesson ${lessonId}`));
        continue;
      }
      const recyclingOrder = lessonOrder.get(lessonId);
      if (introductionOrder !== undefined && recyclingOrder !== undefined && recyclingOrder < introductionOrder) {
        diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/recycled_in_lessons`, `recycling lesson ${lessonId} must follow introduction lesson ${introductionLessonId} for term ${entry.term_et}`));
        continue;
      }
      const lesson = lessonsById.get(lessonId)?.data;
      if (!lesson) continue;
      const recycledTerms = (lesson.language_load?.recycled_terms_et ?? [])
        .map((item) => normalize(item.term_et));
      if (!recycledTerms.includes(term)) {
        diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/recycled_in_lessons`, `recycling lesson ${lessonId} does not list term ${entry.term_et} in recycled_terms_et`));
      }
    }
  }
  const progressionGroups = [
    ['vocabulary_by_lesson', 'term_et', 'new_terms_et', 'recycled_terms_et'],
    ['instruction_verbs_progression', 'verb_et', 'new_instruction_verbs_et', 'recycled_instruction_verbs_et'],
  ];
  for (const [field, nameField, newField, recycledField] of progressionGroups) {
    const entries = unit[field] ?? [];
    if (!sameSet(entries.map((entry) => entry.lesson_id), lessonIds)) diagnostics.push(makeDiagnostic('error', artifact.file, `/${field}`, 'progression must contain each linked lesson exactly once'));
    for (const [index, entry] of entries.entries()) {
      const lesson = lessonsById.get(entry.lesson_id)?.data;
      if (!lesson) continue;
      const expectedNew = (lesson.language_load?.[newField] ?? []).map((item) => item[nameField]);
      const expectedRecycled = (lesson.language_load?.[recycledField] ?? []).map((item) => item[nameField]);
      if (!sameSet(entry.introduced, expectedNew)) diagnostics.push(makeDiagnostic('error', artifact.file, `/${field}/${index}/introduced`, `must match linked lesson ${newField}`));
      if (!sameSet(entry.recycled, expectedRecycled)) diagnostics.push(makeDiagnostic('error', artifact.file, `/${field}/${index}/recycled`, `must match linked lesson ${recycledField}`));
    }
  }
  for (const field of ['sentence_frame_progression', 'language_function_progression', 'scaffolding_progression']) {
    const entries = unit[field] ?? [];
    if (!sameSet(entries.map((entry) => entry.lesson_id), lessonIds)) diagnostics.push(makeDiagnostic('error', artifact.file, `/${field}`, 'progression must contain each linked lesson exactly once'));
  }
  for (const [index, entry] of (unit.sentence_frame_progression ?? []).entries()) {
    const lesson = lessonsById.get(entry.lesson_id)?.data;
    const expected = (lesson?.language_load?.sentence_frames ?? []).map((frame) => frame.frame_id);
    if (!sameSet(entry.introduced, expected)) diagnostics.push(makeDiagnostic('error', artifact.file, `/sentence_frame_progression/${index}/introduced`, 'must match linked lesson sentence frames'));
  }
  for (const [index, entry] of (unit.scaffolding_progression ?? []).entries()) {
    const release = lessonsById.get(entry.lesson_id)?.data.methodology?.scaffold_release;
    if (release && ['introduction', 'guided_practice', 'final_output'].some((field) => entry[field] !== release[field])) diagnostics.push(makeDiagnostic('error', artifact.file, `/scaffolding_progression/${index}`, 'must match linked lesson scaffold release'));
  }
  for (const field of ['practical_work', 'revision']) {
    for (const [index, item] of (unit[field] ?? []).entries()) {
      if (!lessonIdSet.has(item.lesson_id)) diagnostics.push(makeDiagnostic('error', artifact.file, `/${field}/${index}/lesson_id`, `unknown lesson ${item.lesson_id}`));
    }
  }
  const assessmentDomains = new Set();
  for (const [index, point] of (unit.assessment_points ?? []).entries()) {
    if (!lessonIdSet.has(point.lesson_id)) diagnostics.push(makeDiagnostic('error', artifact.file, `/assessment_points/${index}/lesson_id`, `unknown lesson ${point.lesson_id}`));
    for (const domain of point.domains ?? []) assessmentDomains.add(domain);
  }
  if (!assessmentDomains.has('subject') || ![...assessmentDomains].some((domain) => domain.startsWith('estonian_'))) diagnostics.push(makeDiagnostic('error', artifact.file, '/assessment_points', 'unit requires planned subject and Estonian assessment points'));
  const statuses = new Map((unit.linked_outcomes ?? []).map((mapping) => [mapping.outcome_id, mapping.coverage_status]));
  const buckets = {
    verified: unit.completeness?.verified_outcome_ids ?? [],
    partial: unit.completeness?.partial_outcome_ids ?? [],
    missing: unit.completeness?.missing_outcome_ids ?? [],
    ambiguous: unit.completeness?.ambiguous_outcome_ids ?? [],
  };
  const classified = new Map();
  for (const [status, ids] of Object.entries(buckets)) {
    for (const id of ids) {
      if (classified.has(id)) diagnostics.push(makeDiagnostic('error', artifact.file, '/completeness', `outcome ${id} is classified more than once`));
      classified.set(id, status);
    }
  }
  if (statuses.size !== classified.size || [...statuses].some(([id, status]) => classified.get(id) !== status)) diagnostics.push(makeDiagnostic('error', artifact.file, '/completeness', 'outcome buckets must exactly match linked outcome statuses'));
  if (unit.completeness?.declared_complete && [...classified.values()].some((status) => status !== 'verified')) diagnostics.push(makeDiagnostic('error', artifact.file, '/completeness', 'unit cannot declare complete while outcomes are partial, missing, or ambiguous'));
}

function topicRecordIndex(topicInventory) {
  const byId = new Map();
  for (const topic of topicInventory?.topics ?? []) {
    for (const kind of ['selected_records', 'alternative_records', 'rejected_records']) {
      for (const record of topic[kind] ?? []) byId.set(record.record_id, { record, topicId: topic.topic_id });
    }
  }
  return byId;
}

function validateAnnualComponentIdentity(diagnostics, artifact, courseArtifact, context) {
  validateCanonicalRoute(diagnostics, artifact, context.curriculum);
  const course = courseArtifact?.data;
  if (!course) return;
  for (const field of ['grade', 'subject', 'subject_et', 'instruction_language', 'subject_support_language']) {
    if (artifact.data[field] !== course[field]) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `/${field}`, `must match linked annual course ${course.course_id}`));
    }
  }
  if (artifact.data.course_ref !== course.course_id) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/course_ref', `expected ${course.course_id}`));
  }
  if (artifact.data.canonical_route?.source_id !== course.canonical_route?.source_id) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/canonical_route/source_id', 'component route must match its annual course'));
  }
}

function validateSourceSelectionMatrix(diagnostics, artifact, courseArtifact, context, indexes) {
  validateAnnualComponentIdentity(diagnostics, artifact, courseArtifact, context);
  const course = courseArtifact?.data;
  if (!course) return { selectedById: new Map(), selectedCount: 0, teacherReviewUnitIds: new Set() };
  const sourceId = artifact.data.canonical_route?.source_id;
  const routeData = context.curriculum.routes[sourceId];
  const topicInventory = indexes.topicsBySource.get(sourceId);
  const bookInventory = indexes.booksBySource.get(sourceId);
  const topicRecords = topicRecordIndex(topicInventory);
  const books = new Map((bookInventory?.books ?? []).map((book) => [book.book_id, book]));
  const eligibleBookIds = (bookInventory?.books ?? [])
    .filter((book) => book.programme_type === 'ordinary' && book.eligible_for_ordinary_course && book.page_evidence === 'page_records')
    .map((book) => book.book_id);
  const excludedBookIds = (bookInventory?.books ?? [])
    .filter((book) => !eligibleBookIds.includes(book.book_id))
    .map((book) => book.book_id);
  if (!sameSet(artifact.data.eligible_book_ids, eligibleBookIds)) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/eligible_book_ids', 'must exactly match audited ordinary books with page evidence'));
  }
  if (!sameSet((artifact.data.excluded_books ?? []).map((entry) => entry.book_id), excludedBookIds)) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/excluded_books', 'must exactly list audited books excluded from ordinary page selection'));
  }
  const mainUnits = new Map((course.ordered_units ?? []).map((unit) => [unit.unit_id, unit]));
  const componentUnits = artifact.data.units ?? [];
  if (!sameSet(componentUnits.map((unit) => unit.unit_id), [...mainUnits.keys()])) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/units', 'source matrix must contain each annual unit exactly once'));
  }
  addDuplicateDiagnostics(diagnostics, componentUnits.map((unit) => unit.unit_id), {
    file: artifact.file, field: '/units', label: 'source-matrix unit ID',
  });
  const selectedById = new Map();
  const selectedUrls = [];
  const rejectedUrls = [];
  const allRecordIds = [];
  for (const [unitIndex, unit] of componentUnits.entries()) {
    const field = `/units/${unitIndex}`;
    const mainUnit = mainUnits.get(unit.unit_id);
    if (!mainUnit) continue;
    if (!sameSet(unit.topic_inventory_refs, mainUnit.topic_inventory_refs)) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/topic_inventory_refs`, 'must match the annual unit topic references'));
    }
    const selectedIds = (unit.selected_sources ?? []).map((selection) => selection.record_id);
    if (!sameSet(selectedIds, mainUnit.selected_source_record_ids)) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/selected_sources`, 'selected record IDs must exactly match the annual unit'));
    }
    addDuplicateDiagnostics(diagnostics, selectedIds, { file: artifact.file, field: `${field}/selected_sources`, label: 'selected record ID' });
    const resolvedReferences = [];
    for (const [selectionIndex, selection] of (unit.selected_sources ?? []).entries()) {
      const selectionField = `${field}/selected_sources/${selectionIndex}`;
      const indexed = topicRecords.get(selection.record_id);
      if (!indexed || !(unit.topic_inventory_refs ?? []).includes(indexed.topicId)) {
        diagnostics.push(makeDiagnostic('error', artifact.file, `${selectionField}/record_id`, `unknown record ${selection.record_id} for mapped topic inventory groups`));
        continue;
      }
      if (selection.canonical_url !== indexed.record.canonical_url) {
        diagnostics.push(makeDiagnostic('error', artifact.file, `${selectionField}/canonical_url`, `expected ${indexed.record.canonical_url}`));
      }
      const resolved = {
        ...indexed.record,
        instructional_roles: selection.instructional_roles,
        provenance: selection.provenance,
        selection_rationale: selection.selection_rationale,
      };
      resolvedReferences.push({ record: resolved, field: selectionField, selected: true, rejected: false });
      selectedById.set(selection.record_id, { record: resolved, unitId: unit.unit_id });
      selectedUrls.push(selection.canonical_url);
      allRecordIds.push(selection.record_id);
    }
    validatePageReferences(diagnostics, artifact, routeData, bookInventory, resolvedReferences);

    const rejectedById = new Map();
    const rejectedReferences = [];
    for (const [rejectedIndex, rejected] of (unit.rejected_duplicates ?? []).entries()) {
      const rejectedField = `${field}/rejected_duplicates/${rejectedIndex}`;
      const matches = routeData?.records.filter((record) => record.url === rejected.canonical_url) ?? [];
      const canonical = matches[0];
      if (matches.length !== 1) {
        diagnostics.push(makeDiagnostic('error', artifact.file, `${rejectedField}/canonical_url`, `rejected candidate URL must occur exactly once in the canonical route; found ${matches.length}`));
        continue;
      }
      if (canonical.book_id !== rejected.book_id) {
        diagnostics.push(makeDiagnostic('error', artifact.file, `${rejectedField}/book_id`, `expected ${canonical.book_id}`));
      }
      const book = books.get(rejected.book_id);
      const resolved = {
        record_id: rejected.record_id,
        canonical_url: rejected.canonical_url,
        canonical_source_id: sourceId,
        book_id: rejected.book_id,
        title: canonical.title,
        language: canonical.language,
        programme_type: book?.programme_type ?? 'unknown',
        instructional_roles: ['optional_extension'],
        provenance: rejected.provenance,
        selection_rationale: `Rejected annual candidate: ${rejected.rejection_reason}`,
        rejection_reason: rejected.rejection_reason,
      };
      rejectedReferences.push({ record: resolved, field: rejectedField, selected: false, rejected: true });
      rejectedById.set(rejected.record_id, resolved);
      rejectedUrls.push(rejected.canonical_url);
      allRecordIds.push(rejected.record_id);
    }
    validatePageReferences(diagnostics, artifact, routeData, bookInventory, rejectedReferences);
    const selectedIdSet = new Set(selectedIds);
    const rejectedIdSet = new Set(rejectedById.keys());
    const roleRecordIds = new Set();
    const acceptedSourceRoles = {
      core_explanation_ru: ['core_explanation_ru'],
      core_source_et: ['core_source_et'],
      visual_or_diagram: ['bilingual_visual', 'map_skill', 'data_interpretation', 'digital_map'],
      practical_or_experiment: ['experiment', 'fieldwork', 'data_interpretation'],
      practice_ru: ['practice_ru'],
      practice_et: ['practice_et'],
      revision: ['revision'],
      assessment: ['assessment'],
      optional_extension: ['optional_extension'],
    };
    for (const [role, decision] of Object.entries(unit.role_matrix ?? {})) {
      if (decision.status === 'selected' && (decision.record_ids ?? []).length === 0) {
        diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/role_matrix/${role}`, 'selected role requires at least one selected record'));
      }
      if (decision.status !== 'selected' && (decision.record_ids ?? []).length > 0) {
        diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/role_matrix/${role}`, `${decision.status} role cannot name selected records`));
      }
      for (const recordId of decision.record_ids ?? []) {
        roleRecordIds.add(recordId);
        const selected = unit.selected_sources?.find((entry) => entry.record_id === recordId);
        if (!selectedIdSet.has(recordId)) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/role_matrix/${role}/record_ids`, `unknown selected record ${recordId}`));
        else if (!(acceptedSourceRoles[role] ?? []).some((candidate) => selected.instructional_roles?.includes(candidate))) {
          diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/role_matrix/${role}/record_ids`, `${recordId} has no instructional role supporting ${role}`));
        }
      }
    }
    for (const recordId of selectedIdSet) {
      if (!roleRecordIds.has(recordId)) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/role_matrix`, `selected record ${recordId} has no best-source role decision`));
    }
    const bookDecisions = unit.book_decisions ?? [];
    if (!sameSet(bookDecisions.map((entry) => entry.book_id), eligibleBookIds)) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/book_decisions`, 'must contain every eligible audited book exactly once'));
    }
    addDuplicateDiagnostics(diagnostics, bookDecisions.map((entry) => entry.book_id), { file: artifact.file, field: `${field}/book_decisions`, label: 'book decision' });
    for (const [decisionIndex, decision] of bookDecisions.entries()) {
      const decisionField = `${field}/book_decisions/${decisionIndex}`;
      const candidateIds = new Set([...(decision.candidate_record_ids ?? []), ...(decision.selected_record_ids ?? [])]);
      for (const recordId of candidateIds) {
        const selected = unit.selected_sources?.find((entry) => entry.record_id === recordId);
        const rejected = rejectedById.get(recordId);
        const resolved = selected ? topicRecords.get(recordId)?.record : rejected;
        if (!resolved) diagnostics.push(makeDiagnostic('error', artifact.file, `${decisionField}/candidate_record_ids`, `unknown unit candidate ${recordId}`));
        else if (resolved.book_id !== decision.book_id) diagnostics.push(makeDiagnostic('error', artifact.file, `${decisionField}/book_id`, `candidate ${recordId} belongs to ${resolved.book_id}`));
      }
      for (const recordId of decision.selected_record_ids ?? []) {
        if (!selectedIdSet.has(recordId)) diagnostics.push(makeDiagnostic('error', artifact.file, `${decisionField}/selected_record_ids`, `unknown selected record ${recordId}`));
      }
      const hasSelected = (decision.selected_record_ids ?? []).length > 0;
      if ((decision.decision === 'selected') !== hasSelected) {
        diagnostics.push(makeDiagnostic('error', artifact.file, `${decisionField}/decision`, 'selected decision must correspond exactly to non-empty selected_record_ids'));
      }
      for (const recordId of decision.candidate_record_ids ?? []) {
        if (!selectedIdSet.has(recordId) && !rejectedIdSet.has(recordId)) {
          diagnostics.push(makeDiagnostic('error', artifact.file, `${decisionField}/candidate_record_ids`, `candidate ${recordId} is neither selected nor explicitly rejected`));
        }
      }
    }
  }
  addDuplicateDiagnostics(diagnostics, allRecordIds, { file: artifact.file, field: '/units', label: 'annual source record ID' });
  addDuplicateDiagnostics(diagnostics, selectedUrls, { file: artifact.file, field: '/units', label: 'selected canonical URL' });
  addDuplicateDiagnostics(diagnostics, rejectedUrls, { file: artifact.file, field: '/units', label: 'rejected canonical URL' });
  for (const url of selectedUrls) {
    if (rejectedUrls.includes(url)) diagnostics.push(makeDiagnostic('error', artifact.file, '/units', `canonical URL is both selected and rejected: ${url}`));
  }
  return {
    selectedById,
    selectedCount: selectedUrls.length,
    teacherReviewUnitIds: new Set(componentUnits
      .filter((unit) => unit.teacher_review_required)
      .map((unit) => unit.unit_id)),
  };
}

function validateImplementationRoadmap(diagnostics, artifact, courseArtifact, context) {
  validateAnnualComponentIdentity(diagnostics, artifact, courseArtifact, context);
  const course = courseArtifact?.data;
  if (!course) return;
  const mainUnits = new Map((course.ordered_units ?? []).map((unit) => [unit.unit_id, unit]));
  const roadmapUnits = artifact.data.units ?? [];
  if (!sameSet(roadmapUnits.map((unit) => unit.unit_id), [...mainUnits.keys()])) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/units', 'roadmap must contain each annual unit exactly once'));
  }
  addDuplicateDiagnostics(diagnostics, roadmapUnits.map((unit) => unit.unit_id), { file: artifact.file, field: '/units', label: 'roadmap unit ID' });
  addDuplicateDiagnostics(diagnostics, roadmapUnits.map((unit) => unit.implementation_order), { file: artifact.file, field: '/units', label: 'implementation order' });
  const orderedImplementation = [...roadmapUnits].sort((left, right) => left.implementation_order - right.implementation_order);
  for (const [index, unit] of orderedImplementation.entries()) {
    if (unit.implementation_order !== index) diagnostics.push(makeDiagnostic('error', artifact.file, '/units', `implementation order must be contiguous from 0; expected ${index}`));
  }
  const phases = artifact.data.phases ?? [];
  addDuplicateDiagnostics(diagnostics, phases.map((phase) => phase.phase_id), { file: artifact.file, field: '/phases', label: 'roadmap phase ID' });
  const phaseIds = new Set(phases.map((phase) => phase.phase_id));
  const phaseUnitIds = phases.flatMap((phase) => phase.unit_ids ?? []);
  if (!sameSet(phaseUnitIds, [...mainUnits.keys()])) diagnostics.push(makeDiagnostic('error', artifact.file, '/phases', 'roadmap phases must partition every annual unit'));
  addDuplicateDiagnostics(diagnostics, phaseUnitIds, { file: artifact.file, field: '/phases', label: 'phase unit ID' });
  for (const [index, phase] of phases.entries()) {
    if (phase.order !== index + 1) diagnostics.push(makeDiagnostic('error', artifact.file, `/phases/${index}/order`, `expected phase order ${index + 1}`));
  }
  for (const [index, unit] of roadmapUnits.entries()) {
    const field = `/units/${index}`;
    const mainUnit = mainUnits.get(unit.unit_id);
    if (!mainUnit) continue;
    if (!phaseIds.has(unit.issue_18_phase)) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/issue_18_phase`, `unknown roadmap phase ${unit.issue_18_phase}`));
    if (!(phases.find((phase) => phase.phase_id === unit.issue_18_phase)?.unit_ids ?? []).includes(unit.unit_id)) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/issue_18_phase`, 'unit is absent from its declared phase'));
    }
    if (unit.approximate_lesson_count !== mainUnit.estimated_lessons) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/approximate_lesson_count`, `expected ${mainUnit.estimated_lessons}`));
    if (unit.synthesis_readiness !== mainUnit.topic_synthesis?.readiness) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/synthesis_readiness`, `expected ${mainUnit.topic_synthesis?.readiness ?? '<missing>'}`));
    if (unit.implementation_status !== mainUnit.implementation_status) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/implementation_status`, `expected ${mainUnit.implementation_status}`));
    for (const dependency of unit.dependencies ?? []) if (!mainUnits.has(dependency)) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/dependencies`, `unknown unit ${dependency}`));
    if (unit.implementation_status === 'validated_production_unit') {
      const expectedPath = safeRepositoryPath(context.rootDir, unit.expected_thematic_plan_path, `${unit.unit_id} thematic plan path`);
      if (!fsSync.existsSync(expectedPath)) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/expected_thematic_plan_path`, 'validated production thematic plan does not exist'));
    }
  }
}

function validateAnnualCourse(diagnostics, artifact, context, indexes, unitsById, componentsById, profiles, sourceValidation) {
  const course = artifact.data;
  const languageArtifact = componentsById.get(course.language_progression_ref?.artifact_id);
  const calendarArtifact = componentsById.get(course.teaching_calendars_ref?.artifact_id);
  const language = languageArtifact?.data ?? {};
  const calendars = calendarArtifact?.data ?? {};
  const languageFile = languageArtifact?.file ?? artifact.file;
  const calendarFile = calendarArtifact?.file ?? artifact.file;
  validateCanonicalRoute(diagnostics, artifact, context.curriculum);
  if (!profiles.has(course.learner_language_profile_ref)) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/learner_language_profile_ref', `unknown language profile ${course.learner_language_profile_ref}`));
  }
  const sourceId = course.canonical_route?.source_id;
  const topicInventory = indexes.topicsBySource.get(sourceId);
  const bookInventory = indexes.booksBySource.get(sourceId);
  if (!topicInventory) diagnostics.push(makeDiagnostic('error', artifact.file, '/canonical_route/source_id', `no topic inventory for ${sourceId ?? '<missing>'}`));
  if (!bookInventory) diagnostics.push(makeDiagnostic('error', artifact.file, '/canonical_route/source_id', `no book inventory for ${sourceId ?? '<missing>'}`));
  const officialOutcomeIds = [];
  for (const [index, reference] of (course.official_curriculum_references ?? []).entries()) {
    const officialMap = validateOfficialLink(diagnostics, artifact, reference.curriculum_map_id, reference.outcome_ids, indexes, `/official_curriculum_references/${index}`);
    officialOutcomeIds.push(...(reference.outcome_ids ?? []));
    if (officialMap?.official_scope?.kind === 'school_stage') {
      const expectedScope = `school_stage_${officialMap.official_scope.school_stage}`;
      if (reference.official_scope !== expectedScope || reference.exact_grade_claimed !== false) diagnostics.push(makeDiagnostic('error', artifact.file, `/official_curriculum_references/${index}`, 'school-stage outcome cannot be represented as exact grade 5'));
    }
  }
  addDuplicateDiagnostics(diagnostics, officialOutcomeIds, { file: artifact.file, field: '/official_curriculum_references', label: 'official outcome reference' });
  const topics = new Map((topicInventory?.topics ?? []).map((topic) => [topic.topic_id, topic]));
  const books = new Map((bookInventory?.books ?? []).map((book) => [book.book_id, book]));
  const units = course.ordered_units ?? [];
  const unitIds = units.map((unit) => unit.unit_id);
  const knownUnitIds = new Set(unitIds);
  const orderById = new Map(units.map((unit, index) => [unit.unit_id, index]));
  addDuplicateDiagnostics(diagnostics, unitIds, { file: artifact.file, field: '/ordered_units', label: 'annual unit ID' });
  let estimatedLessons = 0;
  let representedLessons = 0;
  const allocationTotals = { core_instruction: 0, practical_work: 0, revision: 0, subject_assessment: 0, language_assessment: 0 };
  for (const [index, unit] of units.entries()) {
    const field = `/ordered_units/${index}`;
    if (unit.order !== index + 1) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/order`, `expected order ${index + 1}`));
    estimatedLessons += unit.estimated_lessons ?? 0;
    for (const key of Object.keys(allocationTotals)) allocationTotals[key] += unit.lesson_allocation?.[key] ?? 0;
    const allocation = Object.values(unit.lesson_allocation ?? {}).reduce((sum, value) => sum + value, 0);
    if (allocation !== unit.estimated_lessons) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/lesson_allocation`, `allocation ${allocation} must equal estimated lessons ${unit.estimated_lessons}`));
    const mappedTopics = (unit.topic_inventory_refs ?? []).map((topicId) => topics.get(topicId));
    for (const [topicIndex, topicId] of (unit.topic_inventory_refs ?? []).entries()) {
      if (!topics.has(topicId)) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/topic_inventory_refs/${topicIndex}`, `unknown verified topic inventory ID ${topicId}`));
    }
    if (mappedTopics.length === 1 && mappedTopics[0] && (mappedTopics[0].title_ru !== unit.title_ru || mappedTopics[0].title_et !== unit.title_et)) {
      diagnostics.push(makeDiagnostic('error', artifact.file, field, 'preserved unit titles must match the verified topic inventory'));
    }
    for (const bookId of unit.source_book_ids ?? []) {
      const book = books.get(bookId);
      if (!book) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/source_book_ids`, `unknown audited book ${bookId}`));
      else if (book.programme_type !== 'ordinary' || !book.eligible_for_ordinary_course || book.page_evidence !== 'page_records') {
        diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/source_book_ids`, `book ${bookId} is not eligible ordinary page evidence`));
      }
    }
    for (const mapping of unit.linked_official_outcomes ?? []) {
      if (!officialOutcomeIds.includes(mapping.outcome_id)) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/linked_official_outcomes`, `unknown course outcome ${mapping.outcome_id}`));
    }
    for (const prerequisite of unit.prerequisite_unit_ids ?? []) {
      const prerequisiteOrder = orderById.get(prerequisite);
      if (prerequisiteOrder === undefined) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/prerequisite_unit_ids`, `unknown prerequisite unit ${prerequisite}`));
      else if (prerequisiteOrder >= index) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/prerequisite_unit_ids`, `prerequisite unit ${prerequisite} must occur earlier`));
    }
    for (const later of unit.later_reuse_unit_ids ?? []) {
      const laterOrder = orderById.get(later);
      if (laterOrder === undefined) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/later_reuse_unit_ids`, `unknown reuse unit ${later}`));
      else if (laterOrder <= index) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/later_reuse_unit_ids`, `reuse unit ${later} must occur later`));
    }
    if (unit.full_thematic_plan_exists) {
      const linked = unitsById.get(unit.thematic_plan_ref);
      if (!linked) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/thematic_plan_ref`, `unknown unit reference ${unit.thematic_plan_ref}`));
      else {
        representedLessons += linked.data.lesson_count ?? 0;
        if (linked.data.unit_id !== unit.unit_id || linked.data.grade !== course.grade || linked.data.subject !== course.subject) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/thematic_plan_ref`, 'linked thematic plan ID, grade, and subject must match annual unit'));
      }
    } else if (unit.thematic_plan_ref !== null) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/thematic_plan_ref`, 'unit without a full thematic plan must use null'));
    }
  }
  if (course.lesson_estimate?.estimated_planned_lessons !== estimatedLessons) diagnostics.push(makeDiagnostic('error', artifact.file, '/lesson_estimate/estimated_planned_lessons', `expected ordered-unit estimate ${estimatedLessons}`));
  if (course.lesson_estimate?.represented_lessons !== representedLessons) diagnostics.push(makeDiagnostic('error', artifact.file, '/lesson_estimate/represented_lessons', `expected linked lesson count ${representedLessons}`));
  const budget = course.lesson_budget ?? {};
  if (budget.unit_estimate_total !== estimatedLessons) diagnostics.push(makeDiagnostic('error', artifact.file, '/lesson_budget/unit_estimate_total', `expected ${estimatedLessons}`));
  for (const key of Object.keys(allocationTotals)) {
    if (budget.planned_breakdown?.[key] !== allocationTotals[key]) diagnostics.push(makeDiagnostic('error', artifact.file, `/lesson_budget/planned_breakdown/${key}`, `expected ${allocationTotals[key]}`));
  }
  const scenarios = budget.scenarios ?? [];
  addDuplicateDiagnostics(diagnostics, scenarios.map((scenario) => scenario.scenario_id), { file: artifact.file, field: '/lesson_budget/scenarios', label: 'lesson-budget scenario ID' });
  const baseline = scenarios.find((scenario) => scenario.scenario_id === budget.recommended_baseline_scenario_id);
  if (!baseline) diagnostics.push(makeDiagnostic('error', artifact.file, '/lesson_budget/recommended_baseline_scenario_id', 'recommended baseline must reference a scenario'));
  else if (!baseline.architecture_fits || baseline.shortfall_lessons !== 0) diagnostics.push(makeDiagnostic('error', artifact.file, '/lesson_budget/recommended_baseline_scenario_id', 'recommended baseline must fit the architecture without a shortfall'));
  for (const [index, scenario] of scenarios.entries()) {
    const expectedAvailable = scenario.teaching_weeks * scenario.lessons_per_week;
    if (scenario.available_lessons !== expectedAvailable) diagnostics.push(makeDiagnostic('error', artifact.file, `/lesson_budget/scenarios/${index}/available_lessons`, `expected ${expectedAvailable}`));
    if (scenario.architecture_requirement_lessons !== estimatedLessons) diagnostics.push(makeDiagnostic('error', artifact.file, `/lesson_budget/scenarios/${index}/architecture_requirement_lessons`, `expected ${estimatedLessons}`));
    const left = scenario.available_lessons + scenario.shortfall_lessons;
    const right = estimatedLessons + scenario.reserve_lessons + scenario.school_specific_or_lost_lessons;
    if (left !== right) diagnostics.push(makeDiagnostic('error', artifact.file, `/lesson_budget/scenarios/${index}`, `budget does not reconcile: ${left} versus ${right}`));
    if (scenario.architecture_fits !== (scenario.shortfall_lessons === 0)) diagnostics.push(makeDiagnostic('error', artifact.file, `/lesson_budget/scenarios/${index}/architecture_fits`, 'architecture_fits must match whether shortfall is zero'));
    if (!scenario.architecture_fits) diagnostics.push(makeDiagnostic('warning', artifact.file, `/lesson_budget/scenarios/${index}`, `scenario ${scenario.scenario_id} has a ${scenario.shortfall_lessons}-lesson shortfall and cannot carry the full architecture`));
  }
  if (baseline && baseline.reserve_lessons / baseline.available_lessons < 0.1) diagnostics.push(makeDiagnostic('warning', artifact.file, '/lesson_budget/recommended_baseline_scenario_id', 'recommended baseline reserves less than 10% of available lessons'));

  addDuplicateDiagnostics(diagnostics, (course.selected_source_books ?? []).map((entry) => entry.book_id), { file: artifact.file, field: '/selected_source_books', label: 'selected book ID' });
  for (const [index, entry] of (course.selected_source_books ?? []).entries()) {
    const book = books.get(entry.book_id);
    if (!book) diagnostics.push(makeDiagnostic('error', artifact.file, `/selected_source_books/${index}/book_id`, `unknown audited book ${entry.book_id}`));
    else {
      if (book.language !== entry.language) diagnostics.push(makeDiagnostic('error', artifact.file, `/selected_source_books/${index}/language`, `expected ${book.language}`));
      if (book.programme_type !== 'ordinary' || !book.eligible_for_ordinary_course || book.page_evidence !== 'page_records') diagnostics.push(makeDiagnostic('error', artifact.file, `/selected_source_books/${index}/book_id`, 'annual default sources must be eligible ordinary-programme books with page evidence'));
    }
  }
  for (const [index, decision] of (course.topic_architecture_decisions ?? []).entries()) {
    if (!knownUnitIds.has(decision.new_unit_id)) diagnostics.push(makeDiagnostic('error', artifact.file, `/topic_architecture_decisions/${index}/new_unit_id`, `unknown annual unit ${decision.new_unit_id}`));
    for (const topicId of decision.old_topic_ids ?? []) if (!topics.has(topicId)) diagnostics.push(makeDiagnostic('error', artifact.file, `/topic_architecture_decisions/${index}/old_topic_ids`, `unknown topic ${topicId}`));
  }
  for (const [index, decision] of (course.deduplication_decisions ?? []).entries()) {
    if (!topics.has(decision.topic_id)) diagnostics.push(makeDiagnostic('error', artifact.file, `/deduplication_decisions/${index}/topic_id`, `unknown topic ${decision.topic_id}`));
  }

  for (const field of ['estonian_language_progression']) {
    const entries = language[field] ?? [];
    if (!sameSet(entries.map((entry) => entry.unit_id), unitIds)) diagnostics.push(makeDiagnostic('error', languageFile, `/${field}`, 'annual progression must contain each annual unit exactly once'));
  }
  const progressionByUnit = new Map((language.estonian_language_progression ?? []).map((entry) => [entry.unit_id, entry]));
  const introducedTerms = new Map();
  for (const [index, progression] of (language.estonian_language_progression ?? []).entries()) {
    const newTerms = (progression.new_terms_et ?? []).map(normalize);
    const recycledTerms = (progression.recycled_terms_et ?? []).map(normalize);
    for (const term of newTerms) {
      if (introducedTerms.has(term)) diagnostics.push(makeDiagnostic('error', languageFile, `/estonian_language_progression/${index}/new_terms_et`, `term ${term} is introduced in more than one annual unit`));
      introducedTerms.set(term, progression.unit_id);
      if (recycledTerms.includes(term)) diagnostics.push(makeDiagnostic('error', languageFile, `/estonian_language_progression/${index}`, `term cannot be both new and recycled in one unit: ${term}`));
    }
    const unit = units.find((candidate) => candidate.unit_id === progression.unit_id);
    if (unit && newTerms.length > unit.estimated_lessons * 4) diagnostics.push(makeDiagnostic('warning', languageFile, `/estonian_language_progression/${index}/new_terms_et`, `unit ${progression.unit_id} introduces ${newTerms.length} terms across ${unit.estimated_lessons} estimated lessons`));
  }
  const intervalKeys = [];
  for (const [index, interval] of (language.planned_vocabulary_recycling_intervals ?? []).entries()) {
    const introduced = orderById.get(interval.introduced_in_unit);
    const recycled = orderById.get(interval.recycled_in_unit);
    intervalKeys.push(`${normalize(interval.term_et)}|${interval.recycled_in_unit}`);
    if (introduced === undefined || recycled === undefined) diagnostics.push(makeDiagnostic('error', languageFile, `/planned_vocabulary_recycling_intervals/${index}`, 'vocabulary interval references an unknown unit'));
    else if (recycled <= introduced || interval.interval_units !== recycled - introduced) diagnostics.push(makeDiagnostic('error', languageFile, `/planned_vocabulary_recycling_intervals/${index}`, 'recycling unit must follow introduction and interval_units must match the order distance'));
    const introduction = progressionByUnit.get(interval.introduced_in_unit);
    const recycling = progressionByUnit.get(interval.recycled_in_unit);
    if (!(introduction?.new_terms_et ?? []).map(normalize).includes(normalize(interval.term_et))) diagnostics.push(makeDiagnostic('error', languageFile, `/planned_vocabulary_recycling_intervals/${index}/term_et`, `term ${interval.term_et} is not introduced in ${interval.introduced_in_unit}`));
    if (!(recycling?.recycled_terms_et ?? []).map(normalize).includes(normalize(interval.term_et))) diagnostics.push(makeDiagnostic('error', languageFile, `/planned_vocabulary_recycling_intervals/${index}/term_et`, `term ${interval.term_et} is not recycled in ${interval.recycled_in_unit}`));
  }
  addDuplicateDiagnostics(diagnostics, intervalKeys, { file: languageFile, field: '/planned_vocabulary_recycling_intervals', label: 'term/recycling-unit interval' });
  for (const term of ['lahus', 'termomeeter', 'jäätumine', 'aurustumine', 'olekumuutus']) {
    if (!(language.planned_vocabulary_recycling_intervals ?? []).some((interval) => normalize(interval.term_et) === term)) diagnostics.push(makeDiagnostic('warning', languageFile, '/planned_vocabulary_recycling_intervals', `important water-unit term ${term} has no later thematic-unit recycling plan`));
  }

  addDuplicateDiagnostics(diagnostics, (calendars.practical_work_calendar ?? []).map((entry) => entry.activity_id), { file: calendarFile, field: '/practical_work_calendar', label: 'practical activity ID' });
  const practicalUnits = new Set();
  for (const [index, activity] of (calendars.practical_work_calendar ?? []).entries()) {
    practicalUnits.add(activity.unit_id);
    const unit = units.find((candidate) => candidate.unit_id === activity.unit_id);
    if (!unit) diagnostics.push(makeDiagnostic('error', calendarFile, `/practical_work_calendar/${index}/unit_id`, `unknown unit ${activity.unit_id}`));
    for (const recordId of activity.selected_opiq_record_ids ?? []) if (!unit?.selected_source_record_ids?.includes(recordId)) diagnostics.push(makeDiagnostic('error', calendarFile, `/practical_work_calendar/${index}/selected_opiq_record_ids`, `record ${recordId} is not selected for ${activity.unit_id}`));
  }
  for (const unit of units.filter((candidate) => candidate.mandatory_status === 'curated_core')) {
    if (!practicalUnits.has(unit.unit_id)) diagnostics.push(makeDiagnostic('warning', calendarFile, '/practical_work_calendar', `mandatory unit ${unit.unit_id} has no planned practical activity`));
  }
  addDuplicateDiagnostics(diagnostics, (calendars.revision_calendar ?? []).map((entry) => entry.revision_id), { file: calendarFile, field: '/revision_calendar', label: 'revision ID' });
  const revisedUnits = new Set();
  for (const [index, revision] of (calendars.revision_calendar ?? []).entries()) {
    const afterOrder = orderById.get(revision.after_unit_id);
    if (afterOrder === undefined) diagnostics.push(makeDiagnostic('error', calendarFile, `/revision_calendar/${index}/after_unit_id`, `unknown unit ${revision.after_unit_id}`));
    for (const unitId of revision.unit_ids ?? []) {
      revisedUnits.add(unitId);
      const unitOrder = orderById.get(unitId);
      if (unitOrder === undefined) diagnostics.push(makeDiagnostic('error', calendarFile, `/revision_calendar/${index}/unit_ids`, `unknown unit ${unitId}`));
      else if (afterOrder !== undefined && unitOrder > afterOrder) diagnostics.push(makeDiagnostic('error', calendarFile, `/revision_calendar/${index}/unit_ids`, `revision after ${revision.after_unit_id} cannot cover later unit ${unitId}`));
    }
  }
  for (const unit of units.filter((candidate) => candidate.mandatory_status === 'curated_core')) if (!revisedUnits.has(unit.unit_id)) diagnostics.push(makeDiagnostic('warning', calendarFile, '/revision_calendar', `mandatory unit ${unit.unit_id} has no cumulative revision link`));
  const assessmentIds = [
    ...(calendars.subject_assessment_calendar ?? []).map((entry) => entry.assessment_id),
    ...(calendars.language_assessment_calendar ?? []).map((entry) => entry.assessment_id),
  ];
  addDuplicateDiagnostics(diagnostics, assessmentIds, { file: calendarFile, field: '/subject_assessment_calendar', label: 'assessment ID' });
  for (const [field, allowed] of [
    ['subject_assessment_calendar', new Set(['subject_understanding', 'practical_skill'])],
    ['language_assessment_calendar', new Set(['estonian_terminology_recognition', 'supported_estonian_production', 'independent_estonian_production'])],
  ]) {
    for (const [index, assessment] of (calendars[field] ?? []).entries()) {
      if (!knownUnitIds.has(assessment.unit_id)) diagnostics.push(makeDiagnostic('error', calendarFile, `/${field}/${index}/unit_id`, `unknown unit ${assessment.unit_id}`));
      for (const domain of assessment.domains ?? []) if (!allowed.has(domain)) diagnostics.push(makeDiagnostic('error', calendarFile, `/${field}/${index}/domains`, `${domain} belongs in the other assessment calendar`));
    }
  }
  const summativeOrders = (calendars.subject_assessment_calendar ?? [])
    .filter((entry) => entry.assessment_mode === 'summative')
    .map((entry) => orderById.get(entry.unit_id))
    .filter(Number.isInteger)
    .sort((left, right) => left - right);
  for (let index = 2; index < summativeOrders.length; index += 1) {
    if (summativeOrders[index] - summativeOrders[index - 2] <= 2) {
      diagnostics.push(makeDiagnostic('warning', calendarFile, '/subject_assessment_calendar', 'three summative subject assessments are clustered within three consecutive units'));
      break;
    }
  }
  const courseCoverage = new Map((course.outcome_coverage ?? []).map((entry) => [entry.outcome_id, entry]));
  addDuplicateDiagnostics(diagnostics, [...courseCoverage.keys()], { file: artifact.file, field: '/outcome_coverage', label: 'outcome coverage ID' });
  if (!sameSet([...courseCoverage.keys()], officialOutcomeIds)) diagnostics.push(makeDiagnostic('error', artifact.file, '/outcome_coverage', 'every referenced official outcome must appear exactly once in annual coverage'));
  for (const [index, coverage] of (course.outcome_coverage ?? []).entries()) {
    if (!officialOutcomeIds.includes(coverage.outcome_id)) diagnostics.push(makeDiagnostic('error', artifact.file, `/outcome_coverage/${index}/outcome_id`, `unknown official outcome ${coverage.outcome_id}`));
    for (const unitId of coverage.unit_ids ?? []) {
      const unit = units.find((candidate) => candidate.unit_id === unitId);
      if (!unit) diagnostics.push(makeDiagnostic('error', artifact.file, `/outcome_coverage/${index}/unit_ids`, `unknown unit ${unitId}`));
      else if (!(unit.linked_official_outcomes ?? []).some((mapping) => mapping.outcome_id === coverage.outcome_id && mapping.coverage_status === coverage.coverage_status)) diagnostics.push(makeDiagnostic('error', artifact.file, `/outcome_coverage/${index}`, `unit ${unitId} does not declare matching ${coverage.coverage_status} coverage`));
    }
    if (coverage.official_scope.startsWith('school_stage_') && course.completeness?.declared_complete) diagnostics.push(makeDiagnostic('error', artifact.file, '/completeness', 'school-stage evidence cannot establish official exact-grade completeness'));
    if (coverage.coverage_status === 'ambiguous') diagnostics.push(makeDiagnostic('warning', artifact.file, `/outcome_coverage/${index}`, `official outcome ${coverage.outcome_id} remains ambiguous`));
  }
  addDuplicateDiagnostics(diagnostics, (course.teacher_review_decisions ?? []).map((entry) => entry.decision_id), { file: artifact.file, field: '/teacher_review_decisions', label: 'teacher-review decision ID' });
  const pendingTeacherReviewUnits = new Set();
  for (const [index, decision] of (course.teacher_review_decisions ?? []).entries()) {
    for (const unitId of decision.unit_ids ?? []) if (!knownUnitIds.has(unitId)) diagnostics.push(makeDiagnostic('error', artifact.file, `/teacher_review_decisions/${index}/unit_ids`, `unknown unit ${unitId}`));
    if (decision.status === 'pending' || decision.status === 'blocked') {
      for (const unitId of decision.unit_ids ?? []) pendingTeacherReviewUnits.add(unitId);
      diagnostics.push(makeDiagnostic('warning', artifact.file, `/teacher_review_decisions/${index}`, `teacher review ${decision.decision_id} is ${decision.status}: ${decision.reason}`));
    }
  }
  for (const unitId of sourceValidation?.teacherReviewUnitIds ?? []) {
    if (!pendingTeacherReviewUnits.has(unitId)) diagnostics.push(makeDiagnostic('error', artifact.file, '/teacher_review_decisions', `source selection for ${unitId} requires a pending or blocked teacher-review decision`));
  }
  const completeness = course.completeness ?? {};
  const fullyImplementedUnits = units.every((unit) => unit.full_thematic_plan_exists);
  if (completeness.all_thematic_plans_authored !== fullyImplementedUnits) diagnostics.push(makeDiagnostic('error', artifact.file, '/completeness/all_thematic_plans_authored', `expected ${fullyImplementedUnits}`));
  if (completeness.declared_complete && (
    !completeness.architecture_complete
    || !completeness.all_units_sequenced
    || !completeness.all_sources_selected
    || !completeness.official_curriculum_coverage_complete
    || !completeness.all_thematic_plans_authored
    || !completeness.all_lessons_authored
    || (course.outcome_coverage ?? []).some((coverage) => coverage.coverage_status !== 'verified')
    || (course.known_gaps ?? []).length > 0
  )) diagnostics.push(makeDiagnostic('error', artifact.file, '/completeness', 'annual course cannot declare fully authored completion while implementation, coverage, or known gaps remain'));
  if (completeness.scope === 'complete_annual_architecture' && completeness.declared_complete) diagnostics.push(makeDiagnostic('error', artifact.file, '/completeness', 'complete architecture is not the same as a fully authored annual course'));

  for (const [field, expectedType] of [
    ['source_selection_matrix_ref', sourceMatrixArtifactType],
    ['implementation_roadmap_ref', roadmapArtifactType],
    ['language_progression_ref', languageProgressionArtifactType],
    ['teaching_calendars_ref', teachingCalendarsArtifactType],
  ]) {
    const reference = course[field];
    const component = componentsById.get(reference?.artifact_id);
    if (!component || component.data.artifact_type !== expectedType) diagnostics.push(makeDiagnostic('error', artifact.file, `/${field}/artifact_id`, `unknown ${expectedType} ${reference?.artifact_id ?? '<missing>'}`));
    else if (component.file !== reference.path) diagnostics.push(makeDiagnostic('error', artifact.file, `/${field}/path`, `expected ${component.file}`));
  }
}

export function validateLessonPlanRepository(context) {
  const diagnostics = [];
  const validators = createValidators(context);
  const indexes = curriculumIndexes(context);
  const profilesArtifacts = context.artifacts.filter((artifact) => artifact.data.artifact_type === profileArtifactType);
  const lessonArtifacts = context.artifacts.filter((artifact) => artifact.data.artifact_type === lessonArtifactType);
  const unitArtifacts = context.artifacts.filter((artifact) => artifact.data.artifact_type === unitArtifactType);
  const courseArtifacts = context.artifacts.filter((artifact) => artifact.data.artifact_type === courseArtifactType);
  const sourceMatrixArtifacts = context.artifacts.filter((artifact) => artifact.data.artifact_type === sourceMatrixArtifactType);
  const roadmapArtifacts = context.artifacts.filter((artifact) => artifact.data.artifact_type === roadmapArtifactType);
  const languageProgressionArtifacts = context.artifacts.filter((artifact) => artifact.data.artifact_type === languageProgressionArtifactType);
  const teachingCalendarsArtifacts = context.artifacts.filter((artifact) => artifact.data.artifact_type === teachingCalendarsArtifactType);
  const externalRegistryArtifacts = context.externalArtifacts ?? [];
  const componentArtifacts = [
    ...sourceMatrixArtifacts,
    ...roadmapArtifacts,
    ...languageProgressionArtifacts,
    ...teachingCalendarsArtifacts,
  ];
  const knownTypes = new Set([
    profileArtifactType,
    lessonArtifactType,
    unitArtifactType,
    courseArtifactType,
    sourceMatrixArtifactType,
    roadmapArtifactType,
    languageProgressionArtifactType,
    teachingCalendarsArtifactType,
  ]);
  for (const artifact of context.artifacts) {
    const type = artifact.data.artifact_type;
    if (!knownTypes.has(type)) diagnostics.push(makeDiagnostic('error', artifact.file, '/artifact_type', `unknown plan artifact type ${type ?? '<missing>'}`));
  }
  if (profilesArtifacts.length !== 1) diagnostics.push(makeDiagnostic('error', 'lesson-plans', '/', `expected exactly one ${profileArtifactType}, found ${profilesArtifacts.length}`));
  if (lessonArtifacts.length === 0) diagnostics.push(makeDiagnostic('error', 'lesson-plans', '/', 'at least one bilingual_lesson is required'));
  if (unitArtifacts.length === 0) diagnostics.push(makeDiagnostic('error', 'lesson-plans', '/', 'at least one bilingual_thematic_plan is required'));
  if (courseArtifacts.length === 0) diagnostics.push(makeDiagnostic('error', 'annual-courses', '/', 'at least one annual_course_plan is required'));
  for (const artifact of profilesArtifacts) addSchemaDiagnostics(diagnostics, artifact, validators.profiles);
  for (const artifact of lessonArtifacts) addSchemaDiagnostics(diagnostics, artifact, validators.lesson);
  for (const artifact of unitArtifacts) addSchemaDiagnostics(diagnostics, artifact, validators.thematic);
  for (const artifact of courseArtifacts) addSchemaDiagnostics(diagnostics, artifact, validators.annual);
  for (const artifact of componentArtifacts) addSchemaDiagnostics(diagnostics, artifact, validators.annualComponents);
  for (const artifact of externalRegistryArtifacts) addSchemaDiagnostics(diagnostics, artifact, validators.externalSourceRegistry);
  addDuplicateDiagnostics(diagnostics, [
    ...lessonArtifacts,
    ...unitArtifacts,
    ...courseArtifacts,
    ...componentArtifacts,
    ...externalRegistryArtifacts,
  ].map(artifactId), {
    file: 'teaching plans', field: '/', label: 'artifact ID',
  });
  const profiles = new Map((profilesArtifacts[0]?.data.profiles ?? []).map((profile) => [profile.profile_id, profile]));
  for (const artifact of profilesArtifacts) validateProfileArtifact(diagnostics, artifact);
  const lessonsById = new Map(lessonArtifacts.map((artifact) => [artifact.data.lesson_id, artifact]));
  const unitsById = new Map(unitArtifacts.map((artifact) => [artifact.data.unit_id, artifact]));
  const coursesById = new Map(courseArtifacts.map((artifact) => [artifact.data.course_id, artifact]));
  const componentsById = new Map(componentArtifacts.map((artifact) => [artifact.data.artifact_id, artifact]));
  const externalRegistriesById = new Map();
  const externalSourcesByRegistryId = new Map();
  for (const artifact of externalRegistryArtifacts) {
    const registryId = artifact.data.registry_id;
    if (externalRegistriesById.has(registryId)) diagnostics.push(makeDiagnostic('error', artifact.file, '/registry_id', `duplicate external source registry ID: ${registryId}`));
    externalRegistriesById.set(registryId, artifact);
    externalSourcesByRegistryId.set(registryId, validateExternalSourceRegistry(diagnostics, artifact));
  }
  for (const artifact of lessonArtifacts) validateLesson(diagnostics, artifact, context, indexes, profiles);
  for (const artifact of unitArtifacts) validateUnit(diagnostics, artifact, context, indexes, lessonsById);
  const sourceValidationByCourse = new Map();
  for (const artifact of sourceMatrixArtifacts) {
    const course = coursesById.get(artifact.data.course_ref);
    if (!course) diagnostics.push(makeDiagnostic('error', artifact.file, '/course_ref', `unknown annual course ${artifact.data.course_ref ?? '<missing>'}`));
    const result = validateSourceSelectionMatrix(diagnostics, artifact, course, context, indexes);
    if (course) sourceValidationByCourse.set(course.data.course_id, result);
  }
  for (const artifact of roadmapArtifacts) {
    const course = coursesById.get(artifact.data.course_ref);
    if (!course) diagnostics.push(makeDiagnostic('error', artifact.file, '/course_ref', `unknown annual course ${artifact.data.course_ref ?? '<missing>'}`));
    validateImplementationRoadmap(diagnostics, artifact, course, context);
  }
  for (const artifact of [...languageProgressionArtifacts, ...teachingCalendarsArtifacts]) {
    const course = coursesById.get(artifact.data.course_ref);
    if (!course) diagnostics.push(makeDiagnostic('error', artifact.file, '/course_ref', `unknown annual course ${artifact.data.course_ref ?? '<missing>'}`));
    validateAnnualComponentIdentity(diagnostics, artifact, course, context);
  }
  for (const artifact of courseArtifacts) {
    const sourceValidation = sourceValidationByCourse.get(artifact.data.course_id);
    validateAnnualCourse(
      diagnostics,
      artifact,
      context,
      indexes,
      unitsById,
      componentsById,
      profiles,
      sourceValidation,
    );
    const registryId = artifact.data.external_source_registry_ref?.artifact_id;
    validateCourseTopicSyntheses({
      diagnostics,
      courseArtifact: artifact,
      selectedById: sourceValidation?.selectedById ?? new Map(),
      externalRegistryArtifact: externalRegistriesById.get(registryId),
      externalSourcesById: externalSourcesByRegistryId.get(registryId) ?? new Map(),
    });
  }
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length;
  return {
    diagnostics,
    summary: {
      profiles: profiles.size,
      lessons: lessonArtifacts.length,
      units: unitArtifacts.length,
      annualCourses: courseArtifacts.length,
      annualComponents: componentArtifacts.length,
      annualUnits: courseArtifacts.reduce((sum, artifact) => sum + (artifact.data.ordered_units?.length ?? 0), 0),
      annualSelectedPages: [...sourceValidationByCourse.values()].reduce((sum, result) => sum + result.selectedCount, 0),
      externalSources: [...externalSourcesByRegistryId.values()].reduce((sum, sources) => sum + sources.size, 0),
      pageReferences: lessonArtifacts.reduce((sum, artifact) => sum + (artifact.data.evidence_linkage?.opiq_records?.length ?? 0), 0)
        + unitArtifacts.reduce((sum, artifact) => sum + (artifact.data.selected_opiq_sources?.length ?? 0), 0)
        + [...sourceValidationByCourse.values()].reduce((sum, result) => sum + result.selectedCount, 0),
      errors,
      warnings,
    },
  };
}

export function formatLessonPlanDiagnostic(diagnostic) {
  return `[${diagnostic.severity.toUpperCase()}] ${diagnostic.file} ${diagnostic.field}: ${diagnostic.reason}`;
}
