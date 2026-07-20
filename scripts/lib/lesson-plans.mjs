import fs from 'node:fs/promises';
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

const lessonArtifactType = 'bilingual_lesson';
const unitArtifactType = 'bilingual_thematic_plan';
const courseArtifactType = 'annual_course_plan';
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
  commonSchemaPath = 'schemas/teaching-plan-common.schema.json',
  profileSchemaPath = 'schemas/language-profiles.schema.json',
  lessonSchemaPath = 'schemas/lesson-plan.schema.json',
  thematicSchemaPath = 'schemas/thematic-plan.schema.json',
  annualSchemaPath = 'schemas/annual-course.schema.json',
} = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const [lessonFiles, annualFiles] = await Promise.all([
    loadYamlArtifacts(absoluteRoot, lessonPlansPath),
    loadYamlArtifacts(absoluteRoot, annualCoursesPath),
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
  };
}

function createValidators(context) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  ajv.addSchema(context.curriculum.schemas.course);
  ajv.addSchema(context.schemas.common);
  return {
    profiles: ajv.compile(context.schemas.profiles),
    lesson: ajv.compile(context.schemas.lesson),
    thematic: ajv.compile(context.schemas.thematic),
    annual: ajv.compile(context.schemas.annual),
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

function validateAuthorMaterials(diagnostics, artifact) {
  const materials = artifact.data.evidence_linkage?.author_materials ?? [];
  addDuplicateDiagnostics(diagnostics, materials.map((material) => material.material_id), {
    file: artifact.file,
    field: '/evidence_linkage/author_materials',
    label: 'author material ID',
  });
  for (const [index, material] of materials.entries()) {
    if (!authorProvenance.has(material.provenance?.category)) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `/evidence_linkage/author_materials/${index}/provenance/category`, 'author material requires author-created provenance'));
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
  validateAuthorMaterials(diagnostics, artifact);
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
  validateLessonEvidence(diagnostics, artifact, context, indexes);
  validateLessonMethodology(diagnostics, artifact);
  validateLessonLanguageLoad(diagnostics, artifact);
  validateLessonStages(diagnostics, artifact);
  validateLessonReferencesAndAssessment(diagnostics, artifact);
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
  validateUnitProgressions(diagnostics, artifact, lessonsById);
}

function validateUnitProgressions(diagnostics, artifact, lessonsById) {
  const unit = artifact.data;
  const lessonIds = unit.lesson_ids ?? [];
  const lessonIdSet = new Set(lessonIds);
  const glossary = unit.cumulative_glossary ?? [];
  addDuplicateDiagnostics(diagnostics, glossary.map((entry) => normalize(entry.term_et)), {
    file: artifact.file, field: '/cumulative_glossary', label: 'glossary term',
  });
  const glossaryByTerm = new Map(glossary.map((entry) => [normalize(entry.term_et), entry]));
  const allNewTerms = new Map();
  for (const lessonId of lessonIds) {
    const lesson = lessonsById.get(lessonId)?.data;
    for (const term of lesson?.language_load?.new_terms_et ?? []) allNewTerms.set(normalize(term.term_et), lessonId);
  }
  for (const [term, lessonId] of allNewTerms) {
    const entry = glossaryByTerm.get(term);
    if (!entry) diagnostics.push(makeDiagnostic('error', artifact.file, '/cumulative_glossary', `new lesson term is missing from glossary: ${term}`));
    else if (entry.introduced_in_lesson !== lessonId) diagnostics.push(makeDiagnostic('error', artifact.file, '/cumulative_glossary', `term ${term} must be introduced in ${lessonId}`));
  }
  for (const [term, entry] of glossaryByTerm) {
    if (!allNewTerms.has(term)) diagnostics.push(makeDiagnostic('error', artifact.file, '/cumulative_glossary', `glossary term is not introduced by a linked lesson: ${entry.term_et}`));
    for (const lessonId of entry.recycled_in_lessons ?? []) {
      const lesson = lessonsById.get(lessonId)?.data;
      const used = [
        ...(lesson?.language_load?.new_terms_et ?? []).map((item) => normalize(item.term_et)),
        ...(lesson?.language_load?.recycled_terms_et ?? []).map((item) => normalize(item.term_et)),
      ];
      if (!used.includes(term)) diagnostics.push(makeDiagnostic('error', artifact.file, '/cumulative_glossary', `term ${entry.term_et} is not used in declared recycling lesson ${lessonId}`));
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

function validateAnnualCourse(diagnostics, artifact, context, indexes, unitsById) {
  const course = artifact.data;
  validateCanonicalRoute(diagnostics, artifact, context.curriculum);
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
  const topics = new Map((topicInventory?.topics ?? []).map((topic) => [topic.topic_id, topic]));
  const books = new Map((bookInventory?.books ?? []).map((book) => [book.book_id, book]));
  const units = course.ordered_units ?? [];
  const unitIds = units.map((unit) => unit.unit_id);
  addDuplicateDiagnostics(diagnostics, unitIds, { file: artifact.file, field: '/ordered_units', label: 'annual unit ID' });
  let estimatedLessons = 0;
  let representedLessons = 0;
  for (const [index, unit] of units.entries()) {
    if (unit.order !== index + 1) diagnostics.push(makeDiagnostic('error', artifact.file, `/ordered_units/${index}/order`, `expected order ${index + 1}`));
    estimatedLessons += unit.estimated_lessons ?? 0;
    const topic = topics.get(unit.topic_id);
    if (!topic) diagnostics.push(makeDiagnostic('error', artifact.file, `/ordered_units/${index}/topic_id`, `unknown verified topic inventory ID ${unit.topic_id}`));
    else if (topic.title_ru !== unit.title_ru || topic.title_et !== unit.title_et) diagnostics.push(makeDiagnostic('error', artifact.file, `/ordered_units/${index}`, 'unit titles must match the verified topic inventory'));
    for (const bookId of unit.selected_book_ids ?? []) {
      if (!books.has(bookId)) diagnostics.push(makeDiagnostic('error', artifact.file, `/ordered_units/${index}/selected_book_ids`, `unknown audited book ${bookId}`));
      if (topic && !(topic.books_covering ?? []).includes(bookId)) diagnostics.push(makeDiagnostic('error', artifact.file, `/ordered_units/${index}/selected_book_ids`, `book ${bookId} is not registered for topic ${unit.topic_id}`));
    }
    for (const outcomeId of unit.curriculum_outcome_ids ?? []) {
      if (!officialOutcomeIds.includes(outcomeId)) diagnostics.push(makeDiagnostic('error', artifact.file, `/ordered_units/${index}/curriculum_outcome_ids`, `unknown course outcome ${outcomeId}`));
    }
    if (unit.status === 'represented_by_thematic_plan') {
      const linked = unitsById.get(unit.thematic_plan_ref);
      if (!linked) diagnostics.push(makeDiagnostic('error', artifact.file, `/ordered_units/${index}/thematic_plan_ref`, `unknown unit reference ${unit.thematic_plan_ref}`));
      else {
        representedLessons += linked.data.lesson_count ?? 0;
        if (linked.data.unit_id !== unit.unit_id || linked.data.grade !== course.grade || linked.data.subject !== course.subject) diagnostics.push(makeDiagnostic('error', artifact.file, `/ordered_units/${index}/thematic_plan_ref`, 'linked thematic plan ID, grade, and subject must match annual unit'));
      }
    } else if (unit.thematic_plan_ref !== null) diagnostics.push(makeDiagnostic('error', artifact.file, `/ordered_units/${index}/thematic_plan_ref`, 'topic-inventory-only unit cannot claim a thematic plan'));
  }
  if (course.lesson_estimate?.estimated_planned_lessons !== estimatedLessons) diagnostics.push(makeDiagnostic('error', artifact.file, '/lesson_estimate/estimated_planned_lessons', `expected ordered-unit estimate ${estimatedLessons}`));
  if (course.lesson_estimate?.represented_lessons !== representedLessons) diagnostics.push(makeDiagnostic('error', artifact.file, '/lesson_estimate/represented_lessons', `expected linked lesson count ${representedLessons}`));
  addDuplicateDiagnostics(diagnostics, (course.selected_source_books ?? []).map((entry) => entry.book_id), { file: artifact.file, field: '/selected_source_books', label: 'selected book ID' });
  for (const [index, entry] of (course.selected_source_books ?? []).entries()) {
    const book = books.get(entry.book_id);
    if (!book) diagnostics.push(makeDiagnostic('error', artifact.file, `/selected_source_books/${index}/book_id`, `unknown audited book ${entry.book_id}`));
    else {
      if (book.language !== entry.language) diagnostics.push(makeDiagnostic('error', artifact.file, `/selected_source_books/${index}/language`, `expected ${book.language}`));
      if (book.programme_type !== 'ordinary' || !book.eligible_for_ordinary_course) diagnostics.push(makeDiagnostic('error', artifact.file, `/selected_source_books/${index}/book_id`, 'annual default sources must be eligible ordinary-programme books'));
    }
  }
  const knownUnitIds = new Set(unitIds);
  for (const field of [
    'russian_explanation_coverage',
    'estonian_vocabulary_progression',
    'estonian_instruction_language_progression',
    'sentence_and_oral_answer_progression',
  ]) {
    const entries = course[field] ?? [];
    if (!sameSet(entries.map((entry) => entry.unit_id), unitIds)) diagnostics.push(makeDiagnostic('error', artifact.file, `/${field}`, 'annual progression must contain each excerpt unit exactly once'));
  }
  const orderById = new Map(units.map((unit, index) => [unit.unit_id, index]));
  for (const [index, interval] of (course.planned_vocabulary_recycling_intervals ?? []).entries()) {
    const introduced = orderById.get(interval.introduced_in_unit);
    const recycled = orderById.get(interval.recycled_in_unit);
    if (introduced === undefined || recycled === undefined) diagnostics.push(makeDiagnostic('error', artifact.file, `/planned_vocabulary_recycling_intervals/${index}`, 'vocabulary interval references an unknown unit'));
    else if (recycled <= introduced || interval.interval_units !== recycled - introduced) diagnostics.push(makeDiagnostic('error', artifact.file, `/planned_vocabulary_recycling_intervals/${index}`, 'recycling unit must follow introduction and interval_units must match the order distance'));
  }
  for (const field of ['practical_work_calendar', 'revision_calendar', 'subject_assessment_calendar', 'language_assessment_calendar']) {
    addDuplicateDiagnostics(diagnostics, (course[field] ?? []).map((entry) => entry.calendar_id), { file: artifact.file, field: `/${field}`, label: 'calendar ID' });
    for (const [index, entry] of (course[field] ?? []).entries()) if (!knownUnitIds.has(entry.unit_id)) diagnostics.push(makeDiagnostic('error', artifact.file, `/${field}/${index}/unit_id`, `unknown unit ${entry.unit_id}`));
  }
  for (const [index, decision] of (course.deduplication_decisions ?? []).entries()) {
    if (!topics.has(decision.topic_id)) diagnostics.push(makeDiagnostic('error', artifact.file, `/deduplication_decisions/${index}/topic_id`, `unknown topic ${decision.topic_id}`));
  }
  for (const [index, coverage] of (course.outcome_coverage ?? []).entries()) {
    if (!officialOutcomeIds.includes(coverage.outcome_id)) diagnostics.push(makeDiagnostic('error', artifact.file, `/outcome_coverage/${index}/outcome_id`, `unknown official outcome ${coverage.outcome_id}`));
    for (const unitId of coverage.unit_ids ?? []) if (!knownUnitIds.has(unitId)) diagnostics.push(makeDiagnostic('error', artifact.file, `/outcome_coverage/${index}/unit_ids`, `unknown unit ${unitId}`));
    if (coverage.official_scope.startsWith('school_stage_') && course.completeness?.declared_complete) diagnostics.push(makeDiagnostic('error', artifact.file, '/completeness', 'annual excerpt cannot claim complete exact-grade coverage from school-stage evidence'));
  }
  if (
    course.completeness?.scope === 'small_annual_course_excerpt'
    && (course.completeness.declared_complete || course.completeness.status !== 'incomplete')
  ) diagnostics.push(makeDiagnostic('error', artifact.file, '/completeness', 'annual excerpt must remain explicitly incomplete'));
  if (
    course.completeness?.declared_complete
    && (
      (course.outcome_coverage ?? []).some((coverage) => coverage.coverage_status !== 'verified')
      || (course.known_gaps ?? []).length > 0
    )
  ) diagnostics.push(makeDiagnostic('error', artifact.file, '/completeness', 'full annual course cannot declare complete while outcomes are unresolved or known gaps remain'));
}

export function validateLessonPlanRepository(context) {
  const diagnostics = [];
  const validators = createValidators(context);
  const indexes = curriculumIndexes(context);
  const profilesArtifacts = context.artifacts.filter((artifact) => artifact.data.artifact_type === profileArtifactType);
  const lessonArtifacts = context.artifacts.filter((artifact) => artifact.data.artifact_type === lessonArtifactType);
  const unitArtifacts = context.artifacts.filter((artifact) => artifact.data.artifact_type === unitArtifactType);
  const courseArtifacts = context.artifacts.filter((artifact) => artifact.data.artifact_type === courseArtifactType);
  const knownTypes = new Set([profileArtifactType, lessonArtifactType, unitArtifactType, courseArtifactType]);
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
  addDuplicateDiagnostics(diagnostics, [...lessonArtifacts, ...unitArtifacts, ...courseArtifacts].map(artifactId), {
    file: 'teaching plans', field: '/', label: 'artifact ID',
  });
  const profiles = new Map((profilesArtifacts[0]?.data.profiles ?? []).map((profile) => [profile.profile_id, profile]));
  for (const artifact of profilesArtifacts) validateProfileArtifact(diagnostics, artifact);
  const lessonsById = new Map(lessonArtifacts.map((artifact) => [artifact.data.lesson_id, artifact]));
  const unitsById = new Map(unitArtifacts.map((artifact) => [artifact.data.unit_id, artifact]));
  for (const artifact of lessonArtifacts) validateLesson(diagnostics, artifact, context, indexes, profiles);
  for (const artifact of unitArtifacts) validateUnit(diagnostics, artifact, context, indexes, lessonsById);
  for (const artifact of courseArtifacts) validateAnnualCourse(diagnostics, artifact, context, indexes, unitsById);
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length;
  return {
    diagnostics,
    summary: {
      profiles: profiles.size,
      lessons: lessonArtifacts.length,
      units: unitArtifacts.length,
      annualCourses: courseArtifacts.length,
      pageReferences: lessonArtifacts.reduce((sum, artifact) => sum + (artifact.data.evidence_linkage?.opiq_records?.length ?? 0), 0)
        + unitArtifacts.reduce((sum, artifact) => sum + (artifact.data.selected_opiq_sources?.length ?? 0), 0),
      errors,
      warnings,
    },
  };
}

export function formatLessonPlanDiagnostic(diagnostic) {
  return `[${diagnostic.severity.toUpperCase()}] ${diagnostic.file} ${diagnostic.field}: ${diagnostic.reason}`;
}
