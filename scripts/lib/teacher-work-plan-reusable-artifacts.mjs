import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import Ajv2020 from 'ajv/dist/2020.js';
import { parseDocument } from 'yaml';

import {
  loadTeacherWorkPlanWorkPackages,
  validateTeacherWorkPlanWorkPackages,
} from './teacher-work-plan-work-packages.mjs';

export const REUSABLE_ARTIFACT_ROOT = 'teacher-work-plan-artifacts';
export const REUSABLE_ARTIFACT_SCHEMA_PATH =
  'schemas/teacher-work-plan-reusable-artifact.schema.json';

const INDEX_PATH =
  'teacher-work-plan-artifacts/grade-6-science/soil-organisms/artifact-index.yaml';
const PILOT_ROOT = 'teacher-work-plan-artifacts/grade-6-science/soil-organisms';
const REVIEW_REGISTRY_PATH = `${PILOT_ROOT}/reviews/review-registry.yaml`;
const GAP_REPORT_PATH = 'evaluations/teacher-work-plans/grades-5-7-gap-report.json';
const TOPIC_INVENTORY_PATH = 'curriculum-maps/grade-6-science/topic-inventory.yaml';
const BOOK_INVENTORY_PATH = 'curriculum-maps/grade-6-science/book-inventory.yaml';
const CROSSWALK_PATH = 'curriculum-maps/grade-6-science/teacher-work-plan-crosswalk.yaml';
const MANIFEST_PATH = 'source-manifest.json';
const EXTRACTION_PATH = 'evaluations/teacher-work-plans/grade-6-science-extraction.json';
const LANGUAGE_PROFILE_PATH = 'lesson-plans/language-profiles.yaml';
const CANONICAL_MARKDOWN_PATH = 'project-files/outputs/opiq_6klass_loodusopetus.md';

const EXPECTED_FILES = Object.freeze([
  'answer-key.md',
  'artifact-index.yaml',
  'assessment-rubric.md',
  'observation-table.md',
  'oral-support.md',
  'practical-protocol.md',
  'reviews',
  'student-worksheet.md',
  'teacher-guide.md',
]);

const EXPECTED_CAPABILITIES = Object.freeze([
  'teacher_guide',
  'practical_protocol',
  'observation_table',
  'student_worksheet',
  'answer_key',
  'assessment_rubric',
  'oral_support',
]);

const EXPECTED_MATERIAL_PATHS = Object.freeze([
  `${PILOT_ROOT}/teacher-guide.md`,
  `${PILOT_ROOT}/practical-protocol.md`,
  `${PILOT_ROOT}/observation-table.md`,
  `${PILOT_ROOT}/student-worksheet.md`,
  `${PILOT_ROOT}/answer-key.md`,
  `${PILOT_ROOT}/assessment-rubric.md`,
  `${PILOT_ROOT}/oral-support.md`,
]);

const EXPECTED_GAPS = Object.freeze([
  Object.freeze({
    gap_id: 'grade-6-science-lesson-008',
    mapping_id: 'lesson-008',
    source_record_kind: 'lesson_range',
    source_block_id: 'muld',
    lesson_span: { lesson_start: 8, lesson_end: 8 },
    source_pages: [3, 4],
    source_topic_et: 'Mullaorganismide välivaatlus',
    normalized_mapping_topic_et: 'Mullaorganismide välivaatlus',
    coverage_status: 'missing',
    bridge_type: 'independently_authored_practical_required',
    topic_inventory_refs: ['soil-formation-and-properties'],
  }),
  Object.freeze({
    gap_id: 'grade-6-science-lesson-009',
    mapping_id: 'lesson-009',
    source_record_kind: 'lesson_range',
    source_block_id: 'muld',
    lesson_span: { lesson_start: 9, lesson_end: 9 },
    source_pages: [4],
    source_topic_et: 'Mullaorganismid',
    normalized_mapping_topic_et: 'Mullaorganismid',
    coverage_status: 'missing',
    bridge_type: 'independently_authored_bridge_required',
    topic_inventory_refs: ['soil-formation-and-properties'],
  }),
]);

const EXPECTED_CONTEXT = Object.freeze([
  Object.freeze({
    inventory_bucket: 'selected_records',
    topic_inventory_ref: 'soil-formation-and-properties',
    record_id: 'soil-ru-core',
    canonical_url: 'https://www.opiq.ee/kit/269/chapter/15287',
    canonical_source_id: 'grade-6-science',
    book_id: '5k_loodusõpetus_koolibri_rus',
    title: 'Состав почвы',
    language: 'ru',
    programme_type: 'unknown',
    programme_type_evidence_status: 'ambiguous',
    default_course_eligibility: 'unverified',
    instructional_roles: ['core_explanation_ru', 'practice_ru'],
    relationship_to_pilot: 'soil_context_only_not_soil_organism_evidence',
    required_for_learner_completion: false,
  }),
  Object.freeze({
    inventory_bucket: 'selected_records',
    topic_inventory_ref: 'soil-formation-and-properties',
    record_id: 'soil-et-formation',
    canonical_url: 'https://www.opiq.ee/kit/580/chapter/32151',
    canonical_source_id: 'grade-6-science',
    book_id: '5k_loodusõpetus_koolibri_2025_est',
    title: 'Muldade teke ja areng',
    language: 'et',
    programme_type: 'unknown',
    programme_type_evidence_status: 'ambiguous',
    default_course_eligibility: 'unverified',
    instructional_roles: ['core_source_et', 'terminology_et', 'bilingual_visual'],
    relationship_to_pilot: 'soil_context_only_not_soil_organism_evidence',
    required_for_learner_completion: false,
  }),
  Object.freeze({
    inventory_bucket: 'selected_records',
    topic_inventory_ref: 'soil-formation-and-properties',
    record_id: 'soil-et-pit',
    canonical_url: 'https://www.opiq.ee/kit/580/chapter/32155',
    canonical_source_id: 'grade-6-science',
    book_id: '5k_loodusõpetus_koolibri_2025_est',
    title: 'Mullakaeve',
    language: 'et',
    programme_type: 'unknown',
    programme_type_evidence_status: 'ambiguous',
    default_course_eligibility: 'unverified',
    instructional_roles: ['practice_et', 'experiment', 'fieldwork', 'data_interpretation'],
    relationship_to_pilot: 'soil_context_only_not_soil_organism_protocol',
    required_for_learner_completion: false,
  }),
  Object.freeze({
    inventory_bucket: 'alternative_records',
    topic_inventory_ref: 'soil-formation-and-properties',
    record_id: 'soil-ru-pit',
    canonical_url: 'https://www.opiq.ee/kit/269/chapter/15292',
    canonical_source_id: 'grade-6-science',
    book_id: '5k_loodusõpetus_koolibri_rus',
    title: 'Почвенный разрез',
    language: 'ru',
    programme_type: 'unknown',
    programme_type_evidence_status: 'ambiguous',
    default_course_eligibility: 'unverified',
    instructional_roles: ['practice_ru', 'data_interpretation'],
    relationship_to_pilot: 'soil_context_only_not_soil_organism_protocol',
    required_for_learner_completion: false,
  }),
]);

const EXPECTED_TERMS = Object.freeze([
  Object.freeze({ et: 'muld', ru: 'почва' }),
  Object.freeze({ et: 'mullaorganism', ru: 'почвенный организм' }),
  Object.freeze({ et: 'vaatlus', ru: 'наблюдение' }),
  Object.freeze({ et: 'elupaik', ru: 'место обитания' }),
  Object.freeze({ et: 'niiskus', ru: 'влажность' }),
  Object.freeze({ et: 'lagundaja', ru: 'разрушитель органических остатков / редуцент' }),
]);

const STUDENT_FACING_PATHS = new Set([
  `${PILOT_ROOT}/observation-table.md`,
  `${PILOT_ROOT}/student-worksheet.md`,
  `${PILOT_ROOT}/oral-support.md`,
]);

const INTERNAL_LEAK_PATTERNS = Object.freeze([
  /gap_id/iu,
  /mapping_id/iu,
  /programme_type/iu,
  /source_gap/iu,
  /curriculum-maps\//iu,
  /evaluations\//iu,
  /project-files\//iu,
  /teacher-work-plan-crosswalk/iu,
]);

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function compareBytewise(left, right) {
  return Buffer.from(String(left)).compare(Buffer.from(String(right)));
}

function exactJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function diagnostic(file, field, reason) {
  return { file, field: field || '/', reason };
}

function schemaReason(error) {
  if (error.keyword === 'additionalProperties') return `unknown field ${error.params.additionalProperty}`;
  if (error.keyword === 'required') return `missing required field ${error.params.missingProperty}`;
  return error.message ?? `failed ${error.keyword}`;
}

function safeRepositoryPath(rootDir, repositoryPath) {
  if (
    typeof repositoryPath !== 'string'
    || repositoryPath.length === 0
    || path.isAbsolute(repositoryPath)
    || repositoryPath.includes('\\')
    || repositoryPath.split('/').some((segment) => ['', '.', '..'].includes(segment))
  ) throw new Error(`unsafe repository path: ${repositoryPath}`);
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, repositoryPath);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error(`repository path escapes root: ${repositoryPath}`);
  return resolved;
}

function parseStrictYaml(text, file) {
  if (text.includes('\t')) throw new Error(`${file}: invalid YAML: tabs are forbidden`);
  const document = parseDocument(text, {
    strict: true,
    uniqueKeys: true,
    schema: 'core',
    customTags: [],
    prettyErrors: true,
  });
  if (document.errors.length > 0) {
    throw new Error(`${file}: invalid YAML: ${document.errors.map((error) => error.message).join('; ')}`);
  }
  if (document.anchors?.size > 0 || /(?:^|\s)[&*][A-Za-z0-9_-]+/mu.test(text)) {
    throw new Error(`${file}: YAML aliases and anchors are forbidden`);
  }
  return document.toJS({ maxAliasCount: 0 });
}

async function walkForIndexes(root, relative = '') {
  const directory = path.join(root, relative);
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const results = [];
  for (const entry of entries.sort((a, b) => compareBytewise(a.name, b.name))) {
    const next = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) results.push(...await walkForIndexes(root, next));
    else if (entry.isFile() && entry.name === 'artifact-index.yaml') results.push(next);
  }
  return results;
}

async function readJson(rootDir, repositoryPath) {
  return JSON.parse(await fs.readFile(safeRepositoryPath(rootDir, repositoryPath), 'utf8'));
}

async function readYaml(rootDir, repositoryPath) {
  const text = await fs.readFile(safeRepositoryPath(rootDir, repositoryPath), 'utf8');
  return parseStrictYaml(text, repositoryPath);
}

export function computeTeacherWorkPlanArtifactFingerprint(materials) {
  const chunks = materials.map(({ artifact_path, sha256: fileHash }) => (
    `${artifact_path}\0${String(fileHash).toLowerCase()}\n`
  ));
  return sha256(Buffer.from(chunks.join(''), 'utf8'));
}

export async function loadTeacherWorkPlanReusableArtifactRepository({
  rootDir = process.cwd(),
  gapReport = null,
  workPackages = null,
  artifactOverrides = new Map(),
  materialOverrides = new Map(),
} = {}) {
  const root = path.resolve(rootDir);
  const relativeIndexes = await walkForIndexes(path.join(root, REUSABLE_ARTIFACT_ROOT));
  const indexPaths = relativeIndexes.map((entry) => `${REUSABLE_ARTIFACT_ROOT}/${entry}`);
  const loadDiagnostics = [];
  const artifacts = [];
  for (const indexPath of indexPaths) {
    try {
      const text = artifactOverrides.has(indexPath)
        ? artifactOverrides.get(indexPath)
        : await fs.readFile(safeRepositoryPath(root, indexPath), 'utf8');
      const data = parseStrictYaml(text, indexPath);
      const materialBytes = new Map();
      for (const material of data.materials ?? []) {
        const bytes = materialOverrides.has(material.artifact_path)
          ? Buffer.from(materialOverrides.get(material.artifact_path))
          : await fs.readFile(safeRepositoryPath(root, material.artifact_path)).catch((error) => {
            if (error.code === 'ENOENT') return null;
            throw error;
          });
        materialBytes.set(material.artifact_path, bytes);
      }
      artifacts.push({ file: indexPath, text, data, materialBytes });
    } catch (error) {
      loadDiagnostics.push(diagnostic(indexPath, '/', error.message));
    }
  }

  let reviewRegistry = null;
  try {
    const reviewText = artifactOverrides.has(REVIEW_REGISTRY_PATH)
      ? artifactOverrides.get(REVIEW_REGISTRY_PATH)
      : await fs.readFile(safeRepositoryPath(root, REVIEW_REGISTRY_PATH), 'utf8');
    reviewRegistry = {
      file: REVIEW_REGISTRY_PATH,
      text: reviewText,
      data: parseStrictYaml(reviewText, REVIEW_REGISTRY_PATH),
    };
  } catch (error) {
    loadDiagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, '/', error.message));
  }

  const resolvedGapReport = gapReport ?? await readJson(root, GAP_REPORT_PATH);
  const workPackageRepository = workPackages
    ? { artifact: workPackages, gapReport: resolvedGapReport, schema: await readJson(root, 'schemas/teacher-work-plan-work-packages.schema.json') }
    : await loadTeacherWorkPlanWorkPackages({ rootDir: root, gapReport: resolvedGapReport, includeMarkdown: false });
  const [schema, topicInventory, bookInventory, crosswalk, manifest, extraction, languageProfiles, canonicalMarkdown, pilotDirectoryFiles] = await Promise.all([
    readJson(root, REUSABLE_ARTIFACT_SCHEMA_PATH),
    readYaml(root, TOPIC_INVENTORY_PATH),
    readYaml(root, BOOK_INVENTORY_PATH),
    readYaml(root, CROSSWALK_PATH),
    readJson(root, MANIFEST_PATH),
    readJson(root, EXTRACTION_PATH),
    readYaml(root, LANGUAGE_PROFILE_PATH),
    fs.readFile(safeRepositoryPath(root, CANONICAL_MARKDOWN_PATH), 'utf8'),
    fs.readdir(safeRepositoryPath(root, PILOT_ROOT)).catch((error) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    }),
  ]);
  return {
    rootDir: root,
    artifacts,
    loadDiagnostics,
    schema,
    gapReport: resolvedGapReport,
    workPackageRepository,
    topicInventory,
    bookInventory,
    crosswalk,
    manifest,
    extraction,
    languageProfiles,
    canonicalMarkdown,
    reviewRegistry,
    pilotDirectoryFiles: pilotDirectoryFiles.sort(compareBytewise),
  };
}

function validateExact(diagnostics, file, field, actual, expected, reason) {
  if (!exactJson(actual, expected)) diagnostics.push(diagnostic(file, field, reason));
}

function allTopicRecords(topic) {
  return ['selected_records', 'alternative_records', 'rejected_records'].flatMap((bucket) => (
    (topic?.[bucket] ?? []).map((record) => ({ bucket, record }))
  ));
}

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

function validateMaterialContent(diagnostics, entry) {
  const file = entry.file;
  for (const material of entry.data.materials ?? []) {
    const materialPath = material.artifact_path;
    const bytes = entry.materialBytes.get(materialPath);
    if (bytes === null || bytes === undefined) {
      diagnostics.push(diagnostic(file, `/materials/${material.material_id}`, `missing material ${materialPath}`));
      continue;
    }
    const text = bytes.toString('utf8');
    if (!Buffer.from(text, 'utf8').equals(bytes)) diagnostics.push(diagnostic(materialPath, '/', 'material must be valid UTF-8'));
    if (!text.endsWith('\n')) diagnostics.push(diagnostic(materialPath, '/', 'material must end with a newline'));
    if (text.includes('\t')) diagnostics.push(diagnostic(materialPath, '/', 'tabs are forbidden in material files'));
    if (!materialPath.endsWith('.md')) diagnostics.push(diagnostic(file, '/materials', 'material must be Markdown'));
    if (sha256(bytes) !== material.sha256) diagnostics.push(diagnostic(file, `/materials/${material.material_id}/sha256`, `stale hash for ${materialPath}`));

    const urls = text.match(/https?:\/\/[^\s)\]>]+/gu) ?? [];
    if (materialPath !== `${PILOT_ROOT}/teacher-guide.md` && urls.length > 0) {
      diagnostics.push(diagnostic(materialPath, '/', 'URLs are allowed only in teacher-guide.md'));
    }
    for (const url of urls) {
      if (!/^https:\/\/www\.opiq\.ee\/kit\/[0-9]+\/chapter\/[0-9]+$/iu.test(url)) {
        diagnostics.push(diagnostic(materialPath, '/', `non-Opiq external URL is forbidden: ${url}`));
      }
    }
    if (STUDENT_FACING_PATHS.has(materialPath)) {
      for (const pattern of INTERNAL_LEAK_PATTERNS) {
        if (pattern.test(text)) diagnostics.push(diagnostic(materialPath, '/', `student-facing internal analysis leakage matches ${pattern}`));
      }
    }
  }
}

function hasEvery(text, values) {
  return values.every((value) => text.includes(value));
}

export function validateTeacherWorkPlanReusableArtifactRepository(repository) {
  const diagnostics = [...(repository.loadDiagnostics ?? [])];
  const file = repository.artifacts[0]?.file ?? INDEX_PATH;
  if (!exactJson(repository.artifacts.map((entry) => entry.file), [INDEX_PATH])) {
    diagnostics.push(diagnostic(REUSABLE_ARTIFACT_ROOT, '/', `expected exactly one artifact index at ${INDEX_PATH}`));
  }
  if (!exactJson(repository.pilotDirectoryFiles, EXPECTED_FILES)) {
    diagnostics.push(diagnostic(PILOT_ROOT, '/', `pilot directory must contain exactly ${EXPECTED_FILES.join(', ')}`));
  }

  const workPackageValidation = validateTeacherWorkPlanWorkPackages(
    repository.workPackageRepository.artifact,
    { schema: repository.workPackageRepository.schema, gapReport: repository.gapReport },
  );
  for (const problem of workPackageValidation.diagnostics) {
    diagnostics.push(diagnostic(problem.file, problem.field, `work-package dependency: ${problem.reason}`));
  }

  const artifactEntry = repository.artifacts[0];
  if (!artifactEntry) {
    diagnostics.sort((a, b) => compareBytewise(`${a.file}\0${a.field}\0${a.reason}`, `${b.file}\0${b.field}\0${b.reason}`));
    return { diagnostics, summary: { artifacts: 0, source_gaps_supported: 0, materials: 0, opiq_context_records: 0 } };
  }
  const artifact = artifactEntry.data;
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  const validate = ajv.compile(repository.schema);
  if (!validate(artifact)) {
    for (const error of validate.errors ?? []) diagnostics.push(diagnostic(file, error.instancePath || '/', schemaReason(error)));
  }

  const sourceRoute = (repository.manifest.sources ?? []).find(({ id }) => id === 'grade-6-science');
  validateExact(diagnostics, file, '/canonical_route', artifact.canonical_route, sourceRoute && {
    source_id: sourceRoute.id,
    md_path: sourceRoute.md_path,
    source_archive: sourceRoute.source_archive,
    qa_path: sourceRoute.qa_path,
    record_count: sourceRoute.record_count,
    coverage_status: sourceRoute.coverage_status,
  }, 'canonical route must exactly match the source manifest');

  const pilotPackage = (repository.workPackageRepository.artifact.work_packages ?? [])
    .find(({ package_id }) => package_id === 'grade-6-science-soil-organisms');
  const expectedPackageLink = pilotPackage && {
    review_id: repository.workPackageRepository.artifact.review_id,
    review_path: 'evaluations/teacher-work-plans/grades-5-7-priority-work-packages.yaml',
    package_id: pilotPackage.package_id,
    authoring_status: pilotPackage.authoring_status,
    priority_tier: pilotPackage.priority_tier,
    selected_as_first_pilot: pilotPackage.selected_as_first_pilot,
    planned_root_path: pilotPackage.planned_root_path,
    proposed_deliverables: pilotPackage.proposed_deliverables,
  };
  validateExact(diagnostics, file, '/source_work_package', artifact.source_work_package, expectedPackageLink, 'source work-package linkage must match the selected P0 registry entry');

  const gapById = new Map((repository.gapReport.gap_items ?? []).map((gap) => [gap.gap_id, gap]));
  const gapSnapshots = EXPECTED_GAPS.map((expected) => {
    const gap = gapById.get(expected.gap_id);
    return gap && {
      gap_id: gap.gap_id,
      mapping_id: gap.mapping_id,
      source_record_kind: gap.source_record_kind,
      source_block_id: gap.source_block_id,
      lesson_span: gap.lesson_span,
      source_pages: gap.source_pages,
      source_topic_et: gap.source_topic_et,
      normalized_mapping_topic_et: gap.normalized_mapping_topic_et,
      coverage_status: gap.coverage_status,
      bridge_type: gap.bridge_type,
      topic_inventory_refs: gap.topic_inventory_refs,
    };
  });
  validateExact(diagnostics, file, '/source_gaps', artifact.source_gaps, gapSnapshots, 'source gap snapshots must match the two current missing gap-report entries');
  validateExact(diagnostics, file, '/source_gaps', gapSnapshots, EXPECTED_GAPS, 'production source gaps must remain exact lessons 8 and 9 with missing status');
  const crosswalkMappings = new Map((repository.crosswalk.lesson_range_mappings ?? []).map((mapping) => [mapping.mapping_id, mapping]));
  for (const expected of EXPECTED_GAPS) {
    const mapping = crosswalkMappings.get(expected.mapping_id);
    if (!mapping || mapping.coverage_status !== 'missing' || (mapping.opiq_matches ?? []).length !== 0) {
      diagnostics.push(diagnostic(CROSSWALK_PATH, `/lesson_range_mappings/${expected.mapping_id}`, 'pilot source gap must remain missing with no positive Opiq match in the production crosswalk'));
    }
  }

  const extraction = repository.extraction;
  validateExact(diagnostics, file, '/teacher_plan_source', artifact.teacher_plan_source, {
    extraction_path: EXTRACTION_PATH,
    source_pdf_path: extraction.source.repository_path,
    original_filename: extraction.source.original_filename,
    source_sha256: extraction.source.sha256,
    source_page_count: extraction.source.page_count,
    relevant_source_pages: [3, 4],
    provenance_kind: extraction.source.provenance_kind,
    canonical: extraction.source.canonical,
  }, 'teacher-plan provenance must match the exact Grade 6 extraction');

  const profile = (repository.languageProfiles.profiles ?? [])
    .find(({ profile_id }) => profile_id === 'grade-6-science-a2-default');
  if (!profile || profile.grade !== 6 || profile.subject !== 'science' || profile.learner_language_level !== 'A2') {
    diagnostics.push(diagnostic(file, '/learner_language_profile', 'Grade 6 science A2 profile is missing or inconsistent'));
  }
  validateExact(diagnostics, file, '/language_support/productive_terms', artifact.language_support?.productive_terms, EXPECTED_TERMS, 'productive language support must contain the exact six terms in order');

  const soilTopic = (repository.topicInventory.topics ?? [])
    .find(({ topic_id }) => topic_id === 'soil-formation-and-properties');
  const registered = new Map(allTopicRecords(soilTopic).map(({ bucket, record }) => [record.record_id, { bucket, record }]));
  for (const [index, context] of (artifact.opiq_context_records ?? []).entries()) {
    const inventory = registered.get(context.record_id);
    if (!inventory) diagnostics.push(diagnostic(file, `/opiq_context_records/${index}/record_id`, 'unknown topic-inventory record'));
    else {
      validateExact(diagnostics, file, `/opiq_context_records/${index}/inventory_bucket`, context.inventory_bucket, inventory.bucket, 'context record bucket differs from topic inventory');
      const expectedRecord = EXPECTED_CONTEXT[index];
      validateExact(diagnostics, file, `/opiq_context_records/${index}`, context, expectedRecord, 'optional context record differs from exact production contract');
      for (const fieldName of ['record_id', 'canonical_url', 'canonical_source_id', 'book_id', 'title', 'language', 'programme_type', 'instructional_roles']) {
        if (!exactJson(context[fieldName], inventory.record[fieldName])) diagnostics.push(diagnostic(file, `/opiq_context_records/${index}/${fieldName}`, `metadata differs from topic inventory for ${context.record_id}`));
      }
      if (inventory.bucket === 'rejected_records') diagnostics.push(diagnostic(file, `/opiq_context_records/${index}`, 'rejected record cannot be optional positive context'));
    }
    if (context.instructional_roles?.includes('oral_answer_et')) diagnostics.push(diagnostic(file, `/opiq_context_records/${index}/instructional_roles`, 'oral_answer_et is not available for pilot context'));
    if (countOccurrences(repository.canonicalMarkdown, context.canonical_url) !== 1) diagnostics.push(diagnostic(file, `/opiq_context_records/${index}/canonical_url`, 'context URL must occur exactly once in canonical Markdown'));
    const book = (repository.bookInventory.books ?? []).find(({ book_id }) => book_id === context.book_id);
    if (!book || book.programme_type !== context.programme_type || book.programme_type_evidence?.status !== context.programme_type_evidence_status || book.eligible_for_ordinary_course !== false) {
      diagnostics.push(diagnostic(file, `/opiq_context_records/${index}`, 'programme evidence or eligibility differs from exact book inventory'));
    }
  }
  validateExact(diagnostics, file, '/opiq_context_records', artifact.opiq_context_records, EXPECTED_CONTEXT, 'expected exact four optional context records in selected/alternative order');

  validateExact(diagnostics, file, '/materials/capability', (artifact.materials ?? []).map(({ capability }) => capability), EXPECTED_CAPABILITIES, 'material capabilities must match the exact seven-item order');
  validateExact(diagnostics, file, '/materials/artifact_path', (artifact.materials ?? []).map(({ artifact_path }) => artifact_path), EXPECTED_MATERIAL_PATHS, 'material paths must match the exact seven-item order');
  if (new Set((artifact.materials ?? []).map(({ capability }) => capability)).size !== artifact.materials?.length) diagnostics.push(diagnostic(file, '/materials', 'duplicate material capability'));
  for (const [index, material] of (artifact.materials ?? []).entries()) {
    try {
      const resolved = safeRepositoryPath(repository.rootDir, material.artifact_path);
      const pilot = safeRepositoryPath(repository.rootDir, PILOT_ROOT);
      if (!resolved.startsWith(`${pilot}${path.sep}`)) diagnostics.push(diagnostic(file, `/materials/${index}/artifact_path`, 'material path must stay inside the pilot root'));
    } catch (error) {
      diagnostics.push(diagnostic(file, `/materials/${index}/artifact_path`, error.message));
    }
    const shouldLinkAnswer = ['observation_table', 'student_worksheet'].includes(material.capability);
    const expectedAnswer = shouldLinkAnswer ? `${PILOT_ROOT}/answer-key.md` : undefined;
    if (material.answer_key_path !== expectedAnswer) diagnostics.push(diagnostic(file, `/materials/${index}/answer_key_path`, shouldLinkAnswer ? 'observation table and worksheet must point to answer-key.md' : 'answer-key path is allowed only on observation table and worksheet'));
  }
  validateMaterialContent(diagnostics, artifactEntry);
  const expectedFingerprint = computeTeacherWorkPlanArtifactFingerprint(artifact.materials ?? []);
  if (artifact.content_fingerprint?.value !== expectedFingerprint) diagnostics.push(diagnostic(file, '/content_fingerprint/value', 'aggregate content fingerprint is stale'));

  const expectedHumanReview = {
    registry_path: REVIEW_REGISTRY_PATH,
    teacher_review: { status: 'pending', completed_record_path: null },
    local_safety_review: { status: 'pending', completed_record_path: null },
    classroom_trial: { status: 'not_tested', completed_record_path: null },
    reviewed_content_fingerprint: null,
  };
  validateExact(diagnostics, file, '/human_review', artifact.human_review, expectedHumanReview, 'human review must link the exact pending registry without completed evidence');
  const reviewRegistry = repository.reviewRegistry?.data;
  if (!reviewRegistry) diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, '/', 'pending human-review registry is missing'));
  else {
    validateExact(diagnostics, REVIEW_REGISTRY_PATH, '/artifact_id', reviewRegistry.artifact_id, artifact.artifact_id, 'review registry must reference the reusable artifact');
    validateExact(diagnostics, REVIEW_REGISTRY_PATH, '/artifact_index_path', reviewRegistry.artifact_index_path, INDEX_PATH, 'review registry must reference the exact artifact index');
    validateExact(diagnostics, REVIEW_REGISTRY_PATH, '/content_fingerprint', reviewRegistry.content_fingerprint, artifact.content_fingerprint?.value, 'review registry must pin the current material fingerprint');
    if (reviewRegistry.teacher_review?.status !== 'pending'
      || reviewRegistry.local_safety_review?.status !== 'pending'
      || reviewRegistry.classroom_trial?.status !== 'not_tested'
      || (reviewRegistry.teacher_review?.completed_record_paths ?? []).length !== 0
      || (reviewRegistry.local_safety_review?.completed_record_paths ?? []).length !== 0
      || (reviewRegistry.classroom_trial?.completed_record_paths ?? []).length !== 0) {
      diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, '/', 'review registry must remain pending with no completed human evidence or classroom trial'));
    }
    for (const flag of ['review_complete', 'local_safety_review_complete', 'classroom_trial_complete', 'classroom_ready', 'publication_ready', 'customer_released', 'effectiveness_claimed']) {
      if (reviewRegistry.boundaries?.[flag] !== false) diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, `/boundaries/${flag}`, `${flag} cannot be promoted`));
    }
  }

  const materialText = new Map([...artifactEntry.materialBytes.entries()].map(([materialPath, bytes]) => [materialPath, bytes?.toString('utf8') ?? '']));
  const guideUrls = (materialText.get(`${PILOT_ROOT}/teacher-guide.md`) ?? '')
    .match(/https:\/\/www\.opiq\.ee\/kit\/[0-9]+\/chapter\/[0-9]+/gu) ?? [];
  validateExact(diagnostics, `${PILOT_ROOT}/teacher-guide.md`, '/urls', guideUrls, EXPECTED_CONTEXT.map(({ canonical_url }) => canonical_url), 'teacher guide must contain exactly the four registered optional Opiq context URLs in order');
  const protocol = materialText.get(`${PILOT_ROOT}/practical-protocol.md`) ?? '';
  const observation = materialText.get(`${PILOT_ROOT}/observation-table.md`) ?? '';
  const answer = materialText.get(`${PILOT_ROOT}/answer-key.md`) ?? '';
  const rubric = materialText.get(`${PILOT_ROOT}/assessment-rubric.md`) ?? '';
  const oral = materialText.get(`${PILOT_ROOT}/oral-support.md`) ?? '';
  if (!hasEvery(protocol, ['25 × 25', 'одинаковой площади', 'одинаковом времени', 'верхних 2 см', 'Indoor fallback', 'возвращает организмы', 'вымыть руки'])) diagnostics.push(diagnostic(`${PILOT_ROOT}/practical-protocol.md`, '/', 'protocol is missing an exact area/time, low-impact, fallback, return, or hygiene guard'));
  if (!hasEvery(observation, ['Определение до вида не требуется', 'Одинаковая площадь', 'Одинаковое время', 'не доказывает причину', 'вернули организмы'])) diagnostics.push(diagnostic(`${PILOT_ROOT}/observation-table.md`, '/', 'observation table is missing comparison or scientific-limit guards'));
  if (!hasEvery(answer, ['Полный модельный ответ по-русски', 'не оценивает всю популяцию или биоразнообразие', 'не доказывает причину', 'фиксированных «правильных» полевых чисел нет'])) diagnostics.push(diagnostic(`${PILOT_ROOT}/answer-key.md`, '/', 'answer key is missing full Russian answer or variable-count limitations'));
  if (!hasEvery(rubric, ['Safety gate', 'Предметное знание', 'Исследовательская процедура', 'Качество данных', 'Сравнение и заключение', 'Групповое сообщение', 'Эстонская языковая поддержка', 'не вычитается из предметного результата'])) diagnostics.push(diagnostic(`${PILOT_ROOT}/assessment-rubric.md`, '/', 'rubric does not separate required evidence dimensions'));
  if (!hasEvery(oral, EXPECTED_TERMS.map(({ et }) => et)) || !oral.includes('3–5')) diagnostics.push(diagnostic(`${PILOT_ROOT}/oral-support.md`, '/', 'oral support must include exact six terms and a 3–5 sentence output'));

  if (artifact.readiness?.teacher_review?.status !== 'pending' || artifact.readiness?.local_safety_review?.status !== 'pending' || artifact.readiness?.classroom_trial?.status !== 'not_tested') diagnostics.push(diagnostic(file, '/readiness', 'teacher and safety reviews must remain pending and classroom trial not tested'));
  for (const flag of ['classroom_ready', 'publication_ready', 'customer_released', 'effectiveness_claimed']) {
    if (artifact.readiness?.[flag] !== false) diagnostics.push(diagnostic(file, `/readiness/${flag}`, `${flag} cannot be promoted`));
  }
  if (artifact.source_gap_support?.source_gap_resolution_claimed !== false || artifact.source_gap_support?.canonical_opiq_gap_status_unchanged !== true) diagnostics.push(diagnostic(file, '/source_gap_support', 'independently authored support cannot change or resolve canonical Opiq gap status'));

  diagnostics.sort((a, b) => compareBytewise(`${a.file}\0${a.field}\0${a.reason}`, `${b.file}\0${b.field}\0${b.reason}`));
  return {
    diagnostics,
    summary: {
      artifacts: repository.artifacts.length,
      source_gaps_supported: artifact.source_gap_support?.supported_gap_ids?.length ?? 0,
      materials: artifact.materials?.length ?? 0,
      opiq_context_records: artifact.opiq_context_records?.length ?? 0,
      fingerprint: artifact.content_fingerprint?.value ?? null,
      canonical_gap_statuses_unchanged: artifact.source_gap_support?.canonical_opiq_gap_status_unchanged === true,
      review_registry: repository.reviewRegistry ? 1 : 0,
      completed_review_records: (repository.reviewRegistry?.data?.teacher_review?.completed_record_paths?.length ?? 0)
        + (repository.reviewRegistry?.data?.local_safety_review?.completed_record_paths?.length ?? 0),
    },
  };
}

export function formatTeacherWorkPlanReusableArtifactDiagnostic(problem) {
  return `${problem.file}: ${problem.field}: ${problem.reason}`;
}
