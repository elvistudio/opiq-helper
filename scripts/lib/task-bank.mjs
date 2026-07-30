import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  listYamlFiles,
  parseStrictCurriculumYaml,
  relativeDisplay,
  safeRepositoryPath,
} from './curriculum-maps.mjs';

const internalCustomerPatterns = [
  ['TB_CUSTOMER_OPIQ_URL', /https?:\/\/(?:www\.)?opiq\.ee\//iu, 'Opiq URL'],
  [
    'TB_CUSTOMER_INTERNAL_RECORD',
    /\b(?:opiq|canonical|source)[-_ ]?record(?:[-_: ]+[a-z0-9][a-z0-9_-]*)?\b/iu,
    'internal record ID',
  ],
  [
    'TB_CUSTOMER_INTERNAL_PATH',
    /(?:project-files|external-sources|compliance|task-bank\/specifications|test-fixtures)\/[^\s]+/iu,
    'internal repository path',
  ],
  ['TB_CUSTOMER_ARCHIVE_PATH', /\b[^\s]+\.(?:zip|jsonl)\b/iu, 'source archive path'],
  ['TB_CUSTOMER_QA_PATH', /\b[^\s/]+_qa\.json\b/iu, 'QA path'],
  [
    'TB_CUSTOMER_ANALYSIS_NOTE',
    /\b(?:source analysis|similarity review|reviewer note|internal analysis)(?:\s+id)?\b/iu,
    'internal analysis or review note',
  ],
];

const youthTrainingRouteIds = new Set([
  'grade-2-kodututarde-training',
  'grade-2-noorte-kotkaste-training',
]);
const firstLanguageEstonianRouteId = 'grade-2-estonian';
const mixedGrade2RouteId = 'grade-2-nature-and-human-studies';
const peWaterSafetyOutcomeId = 'ee-prk-2026-stage1-physical-education-water-safety';
const similarityDimensionFields = [
  'wording_independence',
  'context_independence',
  'data_independence',
  'question_sequence_independence',
  'scaffolding_independence',
  'distractor_independence',
  'visual_independence',
  'answer_independence',
];

function byteSort(left, right) {
  return Buffer.from(left).compare(Buffer.from(right));
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort(byteSort)
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function stableTaskBankJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function extractCustomerVisibleProjection(task) {
  return structuredClone({
    projection_version: '1.0',
    task_id: task.task_id,
    task_version: task.task_version,
    grade: task.grade,
    subject: task.subject,
    instruction_language: task.instruction_language,
    learner_language_level: task.learner_language_level,
    official_outcome_ids: task.official_outcome_ids,
    target_skill: task.target_skill,
    response_mode: task.response_mode,
    difficulty: task.difficulty,
    expected_time_minutes: task.expected_time_minutes,
    customer_content: task.customer_content,
    answer_contract: task.answer_contract,
  });
}

export function computeTaskFingerprint(task) {
  const projection = extractCustomerVisibleProjection(task);
  return {
    algorithm: 'sha256',
    specification_version: '1.0',
    value: crypto.createHash('sha256').update(stableTaskBankJson(projection)).digest('hex'),
    file_count: 1,
  };
}

function fingerprintEquals(left, right) {
  return ['algorithm', 'specification_version', 'value', 'file_count']
    .every((field) => left?.[field] === right?.[field]);
}

function sameSet(left = [], right = []) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return leftSet.size === rightSet.size
    && [...leftSet].every((value) => rightSet.has(value));
}

function duplicateValues(values = []) {
  const seen = new Set();
  return [...new Set(values.filter((value) => {
    if (seen.has(value)) return true;
    seen.add(value);
    return false;
  }))];
}

function diagnostic(diagnostics, code, artifact, field, reason) {
  diagnostics.push({
    severity: 'error',
    code,
    file: artifact?.file ?? '<task-bank>',
    field,
    reason,
  });
}

function schemaReason(error) {
  if (error.keyword === 'additionalProperties') {
    return `unknown field ${error.params.additionalProperty}`;
  }
  if (error.keyword === 'required') {
    return `missing required field ${error.params.missingProperty}`;
  }
  return error.message ?? `failed ${error.keyword}`;
}

function addSchemaDiagnostics(diagnostics, artifact, validator) {
  if (validator(artifact.data)) return;
  for (const error of validator.errors ?? []) {
    diagnostic(
      diagnostics,
      'TB_SCHEMA_INVALID',
      artifact,
      error.instancePath || '/',
      schemaReason(error),
    );
  }
}

function walkStrings(value, callback, field = '') {
  if (typeof value === 'string') {
    callback(value, field || '/');
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walkStrings(entry, callback, `${field}/${index}`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    walkStrings(entry, callback, `${field}/${key}`);
  }
}

function parseSourceMarkdown(markdown, routeId) {
  const records = new Map();
  const snippets = [];
  const blocks = markdown.split(/(?=^### \d+\.\s)/gmu);
  for (const block of blocks) {
    const canonicalUrl = /^- URL:\s*(https:\/\/www\.opiq\.ee\/kit\/\d+\/chapter\/\d+)\s*$/mu
      .exec(block)?.[1];
    if (!canonicalUrl) continue;
    const programmeType = /^- Programme type:\s*([a-z_]+)\s*$/mu.exec(block)?.[1];
    const bookId = /^- Book ID:\s*(.+)\s*$/mu.exec(block)?.[1]?.trim();
    const language = /^- Language:\s*(.+)\s*$/mu.exec(block)?.[1]?.trim();
    const title = /^### \d+\.\s*(.+)\s*$/mu.exec(block)?.[1]?.trim();
    records.set(canonicalUrl, {
      routeId,
      canonicalUrl,
      programmeType,
      bookId,
      language,
      title,
    });
    const taskExamples = /^- Task examples:\s*(.*)$/gmu;
    for (const match of block.matchAll(taskExamples)) {
      for (const example of match[1].split(/;\s+/u)) {
        const normalized = normalizeText(example);
        if (normalized.length >= 35) snippets.push({ routeId, canonicalUrl, text: normalized });
        for (const sentence of example.split(/(?<=[.!?])\s+/u)) {
          const normalizedSentence = normalizeText(sentence);
          if (normalizedSentence.length >= 35) {
            snippets.push({ routeId, canonicalUrl, text: normalizedSentence });
          }
        }
      }
    }
  }
  return { records, snippets };
}

async function readJson(rootDir, repositoryPath, label) {
  const file = safeRepositoryPath(rootDir, repositoryPath, label);
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function readSchema(rootDir, repositoryPath) {
  return readJson(rootDir, repositoryPath, `${repositoryPath} schema path`);
}

async function loadYamlArtifacts(rootDir, directoryPath) {
  const directory = safeRepositoryPath(rootDir, directoryPath, `${directoryPath} directory`);
  const files = (await listYamlFiles(directory))
    .sort((left, right) => byteSort(relativeDisplay(rootDir, left), relativeDisplay(rootDir, right)));
  const artifacts = [];
  for (const absoluteFile of files) {
    const file = relativeDisplay(rootDir, absoluteFile);
    try {
      const data = parseStrictCurriculumYaml(await fs.readFile(absoluteFile, 'utf8'), file);
      artifacts.push({ file, data });
    } catch (error) {
      throw new Error(`TB_YAML_INVALID ${error.message}`);
    }
  }
  return artifacts;
}

function createValidators(schemas) {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    validateFormats: false,
  });
  ajv.addSchema(schemas.course);
  ajv.addSchema(schemas.common);
  return {
    specification: ajv.compile(schemas.specification),
    task: ajv.compile(schemas.task),
    review: ajv.compile(schemas.review),
    index: ajv.compile(schemas.index),
  };
}

export async function loadTaskBankRepository({
  rootDir = process.cwd(),
  taskBankPath = 'task-bank',
  specificationPath = 'task-bank/specifications',
  taskPath = 'task-bank/tasks',
  reviewPath = 'task-bank/reviews',
  indexPath = 'task-bank/task-bank-index.yaml',
  manifestPath = 'source-manifest.json',
  outcomeIndexPath = 'compliance/estonia/2026-27/outcome-index.yaml',
} = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const [
    manifest,
    specifications,
    tasks,
    reviews,
    commonSchema,
    courseSchema,
    specificationSchema,
    taskSchema,
    reviewSchema,
    indexSchema,
  ] = await Promise.all([
    readJson(absoluteRoot, manifestPath, 'source manifest path'),
    loadYamlArtifacts(absoluteRoot, specificationPath),
    loadYamlArtifacts(absoluteRoot, taskPath),
    loadYamlArtifacts(absoluteRoot, reviewPath),
    readSchema(absoluteRoot, 'schemas/teaching-plan-common.schema.json'),
    readSchema(absoluteRoot, 'schemas/course-map.schema.json'),
    readSchema(absoluteRoot, 'schemas/task-specification.schema.json'),
    readSchema(absoluteRoot, 'schemas/authored-task.schema.json'),
    readSchema(absoluteRoot, 'schemas/task-originality-review.schema.json'),
    readSchema(absoluteRoot, 'schemas/task-bank-index.schema.json'),
  ]);
  const indexFile = safeRepositoryPath(absoluteRoot, indexPath, 'task-bank index path');
  let index;
  try {
    index = {
      file: relativeDisplay(absoluteRoot, indexFile),
      data: parseStrictCurriculumYaml(
        await fs.readFile(indexFile, 'utf8'),
        relativeDisplay(absoluteRoot, indexFile),
      ),
    };
  } catch (error) {
    throw new Error(`TB_YAML_INVALID ${error.message}`);
  }
  const outcomeFile = safeRepositoryPath(absoluteRoot, outcomeIndexPath, 'outcome index path');
  let outcomeIndex;
  try {
    outcomeIndex = parseStrictCurriculumYaml(
      await fs.readFile(outcomeFile, 'utf8'),
      relativeDisplay(absoluteRoot, outcomeFile),
    );
  } catch (error) {
    throw new Error(`TB_YAML_INVALID ${error.message}`);
  }

  const routesById = new Map((manifest.sources ?? []).map((route) => [route.id, route]));
  const selectedRouteIds = [...new Set(specifications.flatMap(
    (artifact) => artifact.data.source_analysis?.route_ids ?? [],
  ))].filter((routeId) => routesById.has(routeId)).sort(byteSort);
  const sourceRecordsByRoute = new Map();
  const sourceSnippets = [];
  for (const routeId of selectedRouteIds) {
    const route = routesById.get(routeId);
    const sourceFile = safeRepositoryPath(absoluteRoot, route.md_path, `manifest route ${routeId} md_path`);
    const parsed = parseSourceMarkdown(await fs.readFile(sourceFile, 'utf8'), routeId);
    sourceRecordsByRoute.set(routeId, parsed.records);
    sourceSnippets.push(...parsed.snippets);
  }

  const schemas = {
    common: commonSchema,
    course: courseSchema,
    specification: specificationSchema,
    task: taskSchema,
    review: reviewSchema,
    index: indexSchema,
  };
  return {
    rootDir: absoluteRoot,
    taskBankPath,
    manifestPath,
    outcomeIndexPath,
    manifest,
    outcomeIndex,
    outcomesById: new Map((outcomeIndex.outcomes ?? []).map((outcome) => [
      outcome.outcome_id,
      outcome,
    ])),
    routesById,
    sourceRecordsByRoute,
    sourceSnippets,
    schemas,
    validators: createValidators(schemas),
    specifications,
    tasks,
    reviews,
    index,
  };
}

function validateNeutrality(diagnostics, artifact, sourceSnippets) {
  walkStrings(artifact.data, (text, field) => {
    const normalized = normalizeText(text);
    if (normalized.length > 500 && field.startsWith('/source_analysis/')) {
      diagnostic(
        diagnostics,
        'TB_SPEC_LONG_SOURCE_EXCERPT',
        artifact,
        field,
        'neutral specification source-analysis text is too long for a neutral finding',
      );
    }
    for (const snippet of sourceSnippets) {
      if (normalized.includes(snippet.text)) {
        diagnostic(
          diagnostics,
          'TB_SPEC_SOURCE_WORDING',
          artifact,
          field,
          `neutral specification contains source task wording from ${snippet.routeId}`,
        );
        break;
      }
    }
  });
}

function normalizedOutcomeScope(outcome) {
  if (outcome?.scope?.kind === 'school_stage') {
    return {
      kind: 'school_stage',
      school_stage: outcome.scope.school_stage,
      terminal_grade: outcome.scope.terminal_grade,
      exact_grade_claimed: outcome.scope.exact_grade_claimed,
    };
  }
  return {
    kind: outcome?.scope?.kind,
    school_stage: null,
    terminal_grade: outcome?.scope?.grade ?? null,
    exact_grade_claimed: outcome?.scope?.exact_grade_claimed,
  };
}

function validateSpecification(diagnostics, artifact, repository) {
  const specification = artifact.data;
  const sourceAnalysis = specification.source_analysis ?? {};
  const outcomes = [];
  for (const [index, outcomeId] of (specification.official_outcome_ids ?? []).entries()) {
    const outcome = repository.outcomesById.get(outcomeId);
    if (!outcome) {
      diagnostic(
        diagnostics,
        'TB_UNKNOWN_OUTCOME',
        artifact,
        `/official_outcome_ids/${index}`,
        `unknown official outcome ID ${outcomeId}`,
      );
      continue;
    }
    outcomes.push(outcome);
    const relevanceField = `grade_${specification.grade}_relevant`;
    if (outcome[relevanceField] !== true) {
      diagnostic(
        diagnostics,
        'TB_OUTCOME_GRADE_MISMATCH',
        artifact,
        `/official_outcome_ids/${index}`,
        `${outcomeId} is not marked relevant to Grade ${specification.grade}`,
      );
    }
    if (!isDeepStrictEqual(specification.official_scope, normalizedOutcomeScope(outcome))) {
      diagnostic(
        diagnostics,
        'TB_OUTCOME_SCOPE_MISMATCH',
        artifact,
        '/official_scope',
        `${outcomeId} scope does not match the declared specification scope`,
      );
    }
  }
  if (specification.grade === 2 && (
    specification.official_scope?.kind !== 'school_stage'
    || specification.official_scope?.school_stage !== 1
    || specification.official_scope?.terminal_grade !== 3
    || specification.official_scope?.exact_grade_claimed !== false
  )) {
    diagnostic(
      diagnostics,
      'TB_EXACT_GRADE_CLAIM',
      artifact,
      '/official_scope',
      'Grade 2 uses school-stage-I evidence with terminal grade 3 and cannot claim an exact national Grade 2 allocation',
    );
  }
  if (specification.grade === 2 && specification.instruction_language !== 'ru') {
    diagnostic(
      diagnostics,
      'TB_GRADE2_INSTRUCTION_LANGUAGE',
      artifact,
      '/instruction_language',
      'the default Grade 2 seed profile requires Russian task instructions',
    );
  }

  const routeIds = sourceAnalysis.route_ids ?? [];
  const roles = sourceAnalysis.source_roles ?? [];
  const roleIds = roles.map((entry) => entry.route_id);
  if (!sameSet(routeIds, roleIds) || duplicateValues(roleIds).length > 0) {
    diagnostic(
      diagnostics,
      'TB_SOURCE_ROLE_LINK',
      artifact,
      '/source_analysis/source_roles',
      'every declared route requires exactly one source role',
    );
  }

  if (sourceAnalysis.source_status === 'missing_route') {
    if (
      routeIds.length !== 0
      || roles.length !== 0
      || (sourceAnalysis.canonical_record_refs ?? []).length !== 0
      || sourceAnalysis.content_strategy !== 'author_created_required'
    ) {
      diagnostic(
        diagnostics,
        'TB_MISSING_ROUTE_CONTRACT',
        artifact,
        '/source_analysis',
        'missing-route specifications require no route or record references and author_created_required',
      );
    }
  } else if (
    sourceAnalysis.source_status === 'available_route'
    && (routeIds.length === 0 || sourceAnalysis.content_strategy !== 'neutral_source_analysis')
  ) {
    diagnostic(
      diagnostics,
      'TB_AVAILABLE_ROUTE_CONTRACT',
      artifact,
      '/source_analysis',
      'available-route specifications require at least one route and neutral_source_analysis',
    );
  }

  for (const [index, routeId] of routeIds.entries()) {
    const route = repository.routesById.get(routeId);
    if (!route) {
      diagnostic(
        diagnostics,
        'TB_UNKNOWN_ROUTE',
        artifact,
        `/source_analysis/route_ids/${index}`,
        `unknown source-manifest route ${routeId}`,
      );
      continue;
    }
    if (route.grade !== specification.grade) {
      diagnostic(
        diagnostics,
        'TB_ADJACENT_GRADE_ROUTE',
        artifact,
        `/source_analysis/route_ids/${index}`,
        `${routeId} is Grade ${route.grade}, not Grade ${specification.grade}`,
      );
    }
    if (youthTrainingRouteIds.has(routeId)) {
      diagnostic(
        diagnostics,
        'TB_YOUTH_TRAINING_ROUTE',
        artifact,
        `/source_analysis/route_ids/${index}`,
        `${routeId} is youth-training material, not ordinary school curriculum evidence`,
      );
    }
    if (routeId === firstLanguageEstonianRouteId && specification.grade === 2) {
      diagnostic(
        diagnostics,
        'TB_FIRST_LANGUAGE_ESTONIAN_ROUTE',
        artifact,
        `/source_analysis/route_ids/${index}`,
        'first-language Estonian cannot be used for the default Russian-speaking Grade 2 profile',
      );
    }
    const role = roles.find((entry) => entry.route_id === routeId);
    if (routeId === mixedGrade2RouteId) {
      if (
        role?.role !== 'mixed_subject_support'
        || role?.manual_topic_review_required !== true
        || sourceAnalysis.manual_topic_review_required !== true
      ) {
        diagnostic(
          diagnostics,
          'TB_MIXED_ROUTE_BOUNDARY',
          artifact,
          `/source_analysis/source_roles/${Math.max(0, roles.indexOf(role))}`,
          'mixed nature-and-human-studies route requires mixed_subject_support and manual topic review',
        );
      }
    } else if (route.subject !== specification.subject) {
      diagnostic(
        diagnostics,
        'TB_ROUTE_SUBJECT_MISMATCH',
        artifact,
        `/source_analysis/route_ids/${index}`,
        `${routeId} subject ${route.subject} does not match ${specification.subject}`,
      );
    }
    for (const requiredPath of [route.md_path, route.qa_path]) {
      if (!(sourceAnalysis.evidence_basis ?? []).includes(requiredPath)) {
        diagnostic(
          diagnostics,
          'TB_SOURCE_EVIDENCE_BASIS',
          artifact,
          '/source_analysis/evidence_basis',
          `${routeId} requires its manifest-selected Markdown and QA paths in the internal evidence basis`,
        );
        break;
      }
    }
  }

  for (const [index, reference] of (sourceAnalysis.canonical_record_refs ?? []).entries()) {
    if (!routeIds.includes(reference.route_id)) {
      diagnostic(
        diagnostics,
        'TB_RECORD_ROUTE_LINK',
        artifact,
        `/source_analysis/canonical_record_refs/${index}/route_id`,
        'canonical record reference must use a declared route',
      );
      continue;
    }
    const record = repository.sourceRecordsByRoute.get(reference.route_id)?.get(reference.canonical_url);
    if (!record) {
      diagnostic(
        diagnostics,
        'TB_UNKNOWN_CANONICAL_RECORD',
        artifact,
        `/source_analysis/canonical_record_refs/${index}/canonical_url`,
        'canonical record URL is not present in the manifest-selected Markdown route',
      );
      continue;
    }
    if (record.programmeType !== reference.programme_type) {
      diagnostic(
        diagnostics,
        'TB_RECORD_METADATA_MISMATCH',
        artifact,
        `/source_analysis/canonical_record_refs/${index}/programme_type`,
        `declared programme type does not match canonical source metadata (${record.programmeType})`,
      );
    }
    if (record.programmeType === 'simplified_curriculum') {
      diagnostic(
        diagnostics,
        'TB_SIMPLIFIED_DEFAULT_SOURCE',
        artifact,
        `/source_analysis/canonical_record_refs/${index}`,
        'simplified-curriculum records cannot be ordinary default task evidence',
      );
    }
    if (youthTrainingRouteIds.has(reference.route_id) || record.programmeType === 'youth_training') {
      diagnostic(
        diagnostics,
        'TB_YOUTH_TRAINING_SOURCE',
        artifact,
        `/source_analysis/canonical_record_refs/${index}`,
        'youth-training records cannot be school-curriculum task evidence',
      );
    }
    const kitId = Number(/\/kit\/(\d+)\//u.exec(reference.canonical_url)?.[1]);
    if (
      ['supplementary', 'supplementary_material'].includes(record.programmeType)
      && reference.evidence_role !== 'optional_project_support'
    ) {
      diagnostic(
        diagnostics,
        'TB_SUPPLEMENTARY_MASTERY_SOURCE',
        artifact,
        `/source_analysis/canonical_record_refs/${index}`,
        'supplementary material may not be represented as mastery-core evidence',
      );
    }
    if (kitId === 330 && reference.evidence_role !== 'optional_project_support') {
      diagnostic(
        diagnostics,
        'TB_KIT330_BOUNDARY',
        artifact,
        `/source_analysis/canonical_record_refs/${index}`,
        'kit 330 is internal optional project support only',
      );
    }
  }

  if ((specification.official_outcome_ids ?? []).includes(peWaterSafetyOutcomeId)) {
    if (
      sourceAnalysis.source_status !== 'missing_route'
      || routeIds.length !== 0
      || sourceAnalysis.content_strategy !== 'author_created_required'
      || sourceAnalysis.replacement_by_human_studies_forbidden !== true
    ) {
      diagnostic(
        diagnostics,
        'TB_PE_MISSING_ROUTE',
        artifact,
        '/source_analysis',
        'physical-education water safety requires a missing route and forbids replacement by human-studies evidence',
      );
    }
  }

  validateNeutrality(diagnostics, artifact, repository.sourceSnippets);
}

function validateCustomerBoundary(diagnostics, artifact, sourceSnippets) {
  const projection = extractCustomerVisibleProjection(artifact.data);
  walkStrings(projection, (text, field) => {
    for (const [code, pattern, label] of internalCustomerPatterns) {
      if (pattern.test(text)) {
        diagnostic(
          diagnostics,
          code,
          artifact,
          field,
          `customer-visible projection exposes ${label}`,
        );
      }
    }
    const normalized = normalizeText(text);
    for (const snippet of sourceSnippets) {
      if (normalized.includes(snippet.text)) {
        diagnostic(
          diagnostics,
          'TB_CUSTOMER_SOURCE_EXCERPT',
          artifact,
          field,
          `customer-visible projection contains source task or answer wording from ${snippet.routeId}`,
        );
        break;
      }
    }
  });
}

function validateTask(diagnostics, artifact, specificationsById, repository) {
  const task = artifact.data;
  const specification = specificationsById.get(task.specification_id)?.data;
  if (!specification) {
    diagnostic(
      diagnostics,
      'TB_MISSING_SPECIFICATION_REF',
      artifact,
      '/specification_id',
      `task references missing specification ${task.specification_id ?? '<missing>'}`,
    );
  } else {
    for (const field of [
      'grade',
      'subject',
      'instruction_language',
      'learner_language_level',
      'official_outcome_ids',
      'target_skill',
      'response_mode',
      'difficulty',
      'expected_time_minutes',
    ]) {
      const matches = Array.isArray(task[field])
        ? sameSet(task[field], specification[field])
        : isDeepStrictEqual(task[field], specification[field]);
      if (!matches) {
        diagnostic(
          diagnostics,
          'TB_TASK_SPECIFICATION_MISMATCH',
          artifact,
          `/${field}`,
          `${field} does not match the neutral specification`,
        );
      }
    }
  }
  if (task.authoring_provenance?.specification_ref !== task.specification_id) {
    diagnostic(
      diagnostics,
      'TB_AUTHORING_SPECIFICATION_LINK',
      artifact,
      '/authoring_provenance/specification_ref',
      'authoring provenance must point to the task specification',
    );
  }
  if (task.response_mode !== 'open_ended' && !task.answer_contract?.answer) {
    diagnostic(
      diagnostics,
      'TB_CLOSED_TASK_ANSWER',
      artifact,
      '/answer_contract/answer',
      'closed task requires an answer',
    );
  }
  if (
    ['procedural', 'computational'].includes(task.response_mode)
    && !task.answer_contract?.worked_solution
  ) {
    diagnostic(
      diagnostics,
      'TB_WORKED_SOLUTION_REQUIRED',
      artifact,
      '/answer_contract/worked_solution',
      `${task.response_mode} task requires a step-by-step worked solution`,
    );
  }
  if (
    task.response_mode === 'open_ended'
    && !task.answer_contract?.open_ended_justification
  ) {
    diagnostic(
      diagnostics,
      'TB_OPEN_ENDED_JUSTIFICATION',
      artifact,
      '/answer_contract/open_ended_justification',
      'open-ended task requires an explicit justification',
    );
  }
  if (
    task.customer_content?.estonian_output_requirement?.required === true
    && !sameSet(
      ['subject_result', 'estonian_language'],
      (task.answer_contract?.success_criteria ?? []).map((criterion) => criterion.dimension)
        .filter((dimension) => ['subject_result', 'estonian_language'].includes(dimension)),
    )
  ) {
    diagnostic(
      diagnostics,
      'TB_SEPARATE_LANGUAGE_ASSESSMENT',
      artifact,
      '/answer_contract/success_criteria',
      'Estonian output requires separate subject-result and Estonian-language criteria',
    );
  }
  if (
    task.standalone_contract?.works_without_opiq !== true
    || task.standalone_contract?.external_access_required !== false
  ) {
    diagnostic(
      diagnostics,
      'TB_STANDALONE_REQUIRED',
      artifact,
      '/standalone_contract',
      'commercial task must work without Opiq or external access',
    );
  }
  validateCustomerBoundary(diagnostics, artifact, repository.sourceSnippets);
}

function validateReview(diagnostics, artifact, tasksById, specificationsById) {
  const review = artifact.data;
  const taskArtifact = tasksById.get(review.task_id);
  const specificationArtifact = specificationsById.get(review.specification_id);
  if (!taskArtifact) {
    diagnostic(
      diagnostics,
      'TB_MISSING_TASK_REF',
      artifact,
      '/task_id',
      `review references missing task ${review.task_id ?? '<missing>'}`,
    );
    return;
  }
  if (!specificationArtifact) {
    diagnostic(
      diagnostics,
      'TB_MISSING_REVIEW_SPECIFICATION_REF',
      artifact,
      '/specification_id',
      `review references missing specification ${review.specification_id ?? '<missing>'}`,
    );
  }
  const task = taskArtifact.data;
  if (task.specification_id !== review.specification_id) {
    diagnostic(
      diagnostics,
      'TB_REVIEW_CROSS_LINK',
      artifact,
      '/specification_id',
      'review task and specification references do not belong together',
    );
  }
  if (task.originality_review_ref !== review.review_id) {
    diagnostic(
      diagnostics,
      'TB_TASK_REVIEW_LINK',
      artifact,
      '/review_id',
      'task does not reference this originality review',
    );
  }
  const currentFingerprint = computeTaskFingerprint(task);
  if (!fingerprintEquals(review.reviewed_version?.content_fingerprint, currentFingerprint)) {
    diagnostic(
      diagnostics,
      'TB_STALE_REVIEW_FINGERPRINT',
      artifact,
      '/reviewed_version/content_fingerprint',
      'review fingerprint is stale for the deterministic customer-visible projection',
    );
  }
  if (review.status === 'approved') {
    if (
      !review.reviewer
      || !review.reviewer_role
      || !review.reviewed_on
      || !review.reviewed_version?.commit_sha
    ) {
      diagnostic(
        diagnostics,
        'TB_APPROVED_REVIEW_IDENTITY',
        artifact,
        '/',
        'approved review requires a human reviewer, role, date, and commit SHA',
      );
    }
    const incomplete = similarityDimensionFields.filter(
      (field) => !['independent', 'not_applicable'].includes(review.dimensions?.[field]),
    );
    if (incomplete.length > 0) {
      diagnostic(
        diagnostics,
        'TB_APPROVED_REVIEW_DIMENSIONS',
        artifact,
        '/dimensions',
        `approved review has unresolved independence dimensions: ${incomplete.join(', ')}`,
      );
    }
    if ((review.similarity_flags ?? []).length > 0) {
      diagnostic(
        diagnostics,
        'TB_APPROVED_REVIEW_SIMILARITY',
        artifact,
        '/similarity_flags',
        'approved review cannot retain unresolved similarity flags',
      );
    }
  }
  if ((review.similarity_flags ?? []).length >= 2 && review.human_review_required !== true) {
    diagnostic(
      diagnostics,
      'TB_SIMILARITY_HUMAN_REVIEW',
      artifact,
      '/human_review_required',
      'multiple distinctive similarity flags require human review',
    );
  }
}

function validatePublication(diagnostics, taskArtifact, reviewArtifact) {
  const task = taskArtifact.data;
  const status = task.standalone_contract?.publication_status;
  if (!['publication_ready', 'customer_released'].includes(status)) return;
  const review = reviewArtifact?.data;
  const current = review
    && fingerprintEquals(review.reviewed_version?.content_fingerprint, computeTaskFingerprint(task));
  const completeDimensions = review && similarityDimensionFields.every(
    (field) => ['independent', 'not_applicable'].includes(review.dimensions?.[field]),
  );
  if (
    review?.status !== 'approved'
    || !current
    || !completeDimensions
    || (review.similarity_flags ?? []).length > 0
  ) {
    diagnostic(
      diagnostics,
      'TB_PUBLICATION_REVIEW_GATE',
      taskArtifact,
      '/standalone_contract/publication_status',
      'publication-ready status requires a current approved human originality review with no unresolved flags',
    );
  }
}

function artifactMaps(diagnostics, artifacts, idField, label) {
  const map = new Map();
  for (const artifact of artifacts) {
    const id = artifact.data[idField];
    if (map.has(id)) {
      diagnostic(
        diagnostics,
        'TB_DUPLICATE_ID',
        artifact,
        `/${idField}`,
        `duplicate ${label} ID ${id}`,
      );
    } else {
      map.set(id, artifact);
    }
  }
  return map;
}

function validateGlobalIds(diagnostics, groups) {
  const seen = new Map();
  for (const [label, artifacts, idField] of groups) {
    for (const artifact of artifacts) {
      const id = artifact.data[idField];
      if (!id) continue;
      if (seen.has(id)) {
        diagnostic(
          diagnostics,
          'TB_DUPLICATE_ID',
          artifact,
          `/${idField}`,
          `${label} ID ${id} duplicates ${seen.get(id)}`,
        );
      } else {
        seen.set(id, `${label} ID`);
      }
    }
  }
}

function validateIndex(
  diagnostics,
  repository,
  specificationsById,
  tasksById,
  reviewsById,
) {
  const indexArtifact = repository.index;
  const entries = indexArtifact.data.entries ?? [];
  for (const field of ['specification_id', 'task_id', 'originality_review_id']) {
    for (const duplicate of duplicateValues(entries.map((entry) => entry[field]))) {
      diagnostic(
        diagnostics,
        'TB_INDEX_DUPLICATE',
        indexArtifact,
        '/entries',
        `duplicate indexed ${field} ${duplicate}`,
      );
    }
  }
  for (const [index, entry] of entries.entries()) {
    const specificationArtifact = specificationsById.get(entry.specification_id);
    const taskArtifact = tasksById.get(entry.task_id);
    const reviewArtifact = reviewsById.get(entry.originality_review_id);
    const links = [
      ['specification_path', specificationArtifact],
      ['task_path', taskArtifact],
      ['originality_review_path', reviewArtifact],
    ];
    for (const [pathField, target] of links) {
      try {
        safeRepositoryPath(repository.rootDir, entry[pathField], `index ${pathField}`);
      } catch (error) {
        diagnostic(
          diagnostics,
          'TB_UNSAFE_REPOSITORY_PATH',
          indexArtifact,
          `/entries/${index}/${pathField}`,
          error.message,
        );
      }
      if (!target || target.file !== entry[pathField]) {
        diagnostic(
          diagnostics,
          'TB_STALE_INDEX_REFERENCE',
          indexArtifact,
          `/entries/${index}/${pathField}`,
          `${pathField} does not resolve to the indexed artifact`,
        );
      }
    }
    if (!specificationArtifact || !taskArtifact || !reviewArtifact) continue;
    const specification = specificationArtifact.data;
    const task = taskArtifact.data;
    const review = reviewArtifact.data;
    const comparisons = [
      ['task specification ID', task.specification_id, entry.specification_id],
      ['review task ID', review.task_id, entry.task_id],
      ['review specification ID', review.specification_id, entry.specification_id],
      ['grade', task.grade, entry.grade],
      ['subject', task.subject, entry.subject],
      ['publication status', task.standalone_contract?.publication_status, entry.publication_status],
    ];
    for (const [label, actual, expected] of comparisons) {
      if (!isDeepStrictEqual(actual, expected)) {
        diagnostic(
          diagnostics,
          'TB_INDEX_CROSS_LINK',
          indexArtifact,
          `/entries/${index}`,
          `indexed ${label} is stale or cross-linked`,
        );
      }
    }
    if (
      !sameSet(specification.official_outcome_ids, entry.official_outcome_ids)
      || !sameSet(task.official_outcome_ids, entry.official_outcome_ids)
    ) {
      diagnostic(
        diagnostics,
        'TB_INDEX_OUTCOME_LINK',
        indexArtifact,
        `/entries/${index}/official_outcome_ids`,
        'indexed outcome IDs do not match both specification and task',
      );
    }
    const currentFingerprint = computeTaskFingerprint(task);
    if (!fingerprintEquals(currentFingerprint, entry.current_fingerprint)) {
      diagnostic(
        diagnostics,
        'TB_STALE_INDEX_FINGERPRINT',
        indexArtifact,
        `/entries/${index}/current_fingerprint`,
        'indexed fingerprint is stale',
      );
    }
    const expectedStatus = review.status === 'approved'
      ? 'current_approved'
      : 'current_pending_review';
    if (
      fingerprintEquals(currentFingerprint, entry.current_fingerprint)
      && entry.current_fingerprint_status !== expectedStatus
    ) {
      diagnostic(
        diagnostics,
        'TB_INDEX_FINGERPRINT_STATUS',
        indexArtifact,
        `/entries/${index}/current_fingerprint_status`,
        `current fingerprint status must be ${expectedStatus}`,
      );
    }
  }

  const expected = [
    ['specification', specificationsById, 'specification_id'],
    ['task', tasksById, 'task_id'],
    ['review', reviewsById, 'originality_review_id'],
  ];
  for (const [label, map, field] of expected) {
    for (const id of map.keys()) {
      const count = entries.filter((entry) => entry[field] === id).length;
      if (count !== 1) {
        diagnostic(
          diagnostics,
          'TB_INDEX_MISSING_ARTIFACT',
          indexArtifact,
          '/entries',
          `${label} ${id} must appear exactly once in the index`,
        );
      }
    }
  }
}

export function validateTaskBankRepository(repository) {
  const diagnostics = [];
  for (const artifact of repository.specifications) {
    addSchemaDiagnostics(diagnostics, artifact, repository.validators.specification);
  }
  for (const artifact of repository.tasks) {
    addSchemaDiagnostics(diagnostics, artifact, repository.validators.task);
  }
  for (const artifact of repository.reviews) {
    addSchemaDiagnostics(diagnostics, artifact, repository.validators.review);
  }
  addSchemaDiagnostics(diagnostics, repository.index, repository.validators.index);

  const specificationsById = artifactMaps(
    diagnostics,
    repository.specifications,
    'specification_id',
    'specification',
  );
  const tasksById = artifactMaps(diagnostics, repository.tasks, 'task_id', 'task');
  const reviewsById = artifactMaps(
    diagnostics,
    repository.reviews,
    'review_id',
    'originality review',
  );
  validateGlobalIds(diagnostics, [
    ['specification', repository.specifications, 'specification_id'],
    ['task', repository.tasks, 'task_id'],
    ['review', repository.reviews, 'review_id'],
  ]);

  for (const artifact of repository.specifications) {
    validateSpecification(diagnostics, artifact, repository);
  }
  for (const artifact of repository.tasks) {
    validateTask(diagnostics, artifact, specificationsById, repository);
  }
  for (const artifact of repository.reviews) {
    validateReview(diagnostics, artifact, tasksById, specificationsById);
  }
  for (const taskArtifact of repository.tasks) {
    validatePublication(
      diagnostics,
      taskArtifact,
      reviewsById.get(taskArtifact.data.originality_review_ref),
    );
  }
  validateIndex(
    diagnostics,
    repository,
    specificationsById,
    tasksById,
    reviewsById,
  );

  diagnostics.sort((left, right) => {
    const fileOrder = byteSort(left.file, right.file);
    if (fileOrder !== 0) return fileOrder;
    const fieldOrder = byteSort(left.field, right.field);
    if (fieldOrder !== 0) return fieldOrder;
    return byteSort(left.code, right.code);
  });
  return {
    diagnostics,
    summary: {
      specifications: repository.specifications.length,
      tasks: repository.tasks.length,
      reviews: repository.reviews.length,
      indexed: repository.index.data.entries?.length ?? 0,
      errors: diagnostics.length,
    },
  };
}

export function formatTaskBankDiagnostic(entry) {
  return `[${entry.code}] ${entry.file} ${entry.field}: ${entry.reason}`;
}
