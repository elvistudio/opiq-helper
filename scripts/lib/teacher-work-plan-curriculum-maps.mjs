import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { parseDocument, stringify } from 'yaml';
import { parseOpiqRegressionMarkdown } from './opiq-regression-markdown.mjs';

export const TEACHER_WORK_PLAN_MAP_SCHEMA_PATH =
  'schemas/teacher-work-plan-curriculum-map.schema.json';

const PROVENANCE_PATH =
  'project-files/inputs/originals/teacher-work-plans/provenance.json';

const GRADE_5_PATH =
  'curriculum-maps/grade-5-science/teacher-work-plan-crosswalk.yaml';
const GRADE_6_PATH =
  'curriculum-maps/grade-6-science/teacher-work-plan-crosswalk.yaml';
export const TEACHER_WORK_PLAN_MAP_PATH = GRADE_5_PATH;

const GRADE_5_TOPIC_IDS = Object.freeze([
  'rivers-and-lakes',
  'freshwater-ecosystems',
  'water-properties-and-states',
  'water-use-protection-and-cycle',
  'air-properties-and-protection',
  'weather-and-climate',
  'baltic-sea',
  'settlements',
  'landforms-and-map-reading',
  'bog-ecosystem',
]);

const GRADE_6_TOPIC_IDS = Object.freeze([
  'landforms-and-earth-materials',
  'soil-formation-and-properties',
  'garden-and-field-ecosystems',
  'settlement-ecosystem',
  'forest-ecosystem',
  'bog-ecosystem',
  'air-properties-and-weather',
  'baltic-sea-ecosystem',
  'estonian-habitats',
  'estonian-natural-resources',
  'nature-and-environmental-protection',
]);

export const TEACHER_WORK_PLAN_MAP_CONTRACTS = Object.freeze({
  [GRADE_5_PATH]: Object.freeze({
    artifactPath: GRADE_5_PATH,
    mapId: 'grade-5-science-teacher-work-plan-crosswalk',
    grade: 5,
    subject: 'science',
    subjectEt: 'loodusõpetus',
    sourceId: 'grade-5-science',
    extractionPath: 'evaluations/teacher-work-plans/grade-5-science-extraction.json',
    topicIds: GRADE_5_TOPIC_IDS,
    existingArtifacts: Object.freeze({
      book_inventory: 'curriculum-maps/grade-5-science/book-inventory.yaml',
      topic_inventory: 'curriculum-maps/grade-5-science/topic-inventory.yaml',
      official_curriculum_map: 'curriculum-maps/grade-5-science/official-curriculum.yaml',
      annual_architecture: 'annual-courses/grade-5-science/annual-architecture.yaml',
    }),
    requireSourceRecordKind: false,
    requireUnassignedAnnualSlot: false,
    programmePolicy: 'verified_ordinary',
  }),
  [GRADE_6_PATH]: Object.freeze({
    artifactPath: GRADE_6_PATH,
    mapId: 'grade-6-science-teacher-work-plan-crosswalk',
    grade: 6,
    subject: 'science',
    subjectEt: 'loodusõpetus',
    sourceId: 'grade-6-science',
    extractionPath: 'evaluations/teacher-work-plans/grade-6-science-extraction.json',
    topicIds: GRADE_6_TOPIC_IDS,
    existingArtifacts: Object.freeze({
      book_inventory: 'curriculum-maps/grade-6-science/book-inventory.yaml',
      topic_inventory: 'curriculum-maps/grade-6-science/topic-inventory.yaml',
      official_curriculum_map: null,
      annual_architecture: null,
    }),
    requireSourceRecordKind: true,
    requireUnassignedAnnualSlot: true,
    programmePolicy: 'content_only_unknown',
  }),
});

export const TEACHER_WORK_PLAN_MAP_PATHS = Object.freeze(
  Object.keys(TEACHER_WORK_PLAN_MAP_CONTRACTS).sort(compareBytewise),
);

const EXTRACTION_STATUS_CONTRACTS = Object.freeze({
  'evaluations/teacher-work-plans/grade-5-science-extraction.json': 'partial',
  'evaluations/teacher-work-plans/grade-6-science-extraction.json': 'partial',
  'evaluations/teacher-work-plans/grade-7-geography-extraction.json': 'deferred',
  'evaluations/teacher-work-plans/grade-7-science-extraction.json': 'deferred',
});

const COVERAGE_STATUSES = Object.freeze([
  'matched', 'partial', 'missing', 'ambiguous', 'outside_route',
]);

function compareBytewise(left, right) {
  return Buffer.from(String(left)).compare(Buffer.from(String(right)));
}

function sameValues(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeText(value) {
  return String(value ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim();
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function safeRepositoryPath(rootDir, repositoryPath, label) {
  if (
    typeof repositoryPath !== 'string'
    || repositoryPath.length === 0
    || path.isAbsolute(repositoryPath)
    || repositoryPath.includes('\\')
    || repositoryPath.split('/').some((segment) => ['', '.', '..'].includes(segment))
  ) throw new Error(`${label} must be a safe repository-relative path`);
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, repositoryPath);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error(`${label} points outside the repository`);
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
  const value = document.toJS({ maxAliasCount: 0 });
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${file}: YAML root must be an object`);
  }
  return value;
}

export function parseStrictTeacherWorkPlanCurriculumMap(text, file = 'crosswalk.yaml') {
  return parseStrictYaml(text, file);
}

async function listCrosswalks(rootDir) {
  const directory = safeRepositoryPath(rootDir, 'curriculum-maps', 'curriculum maps path');
  const found = [];
  async function visit(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => compareBytewise(left.name, right.name))) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(entryPath);
      else if (entry.isFile() && entry.name === 'teacher-work-plan-crosswalk.yaml') {
        found.push(path.relative(rootDir, entryPath).split(path.sep).join('/'));
      }
    }
  }
  await visit(directory);
  return found.sort(compareBytewise);
}

function schemaReason(error) {
  if (error.keyword === 'additionalProperties') return `unknown field ${error.params.additionalProperty}`;
  if (error.keyword === 'required') return `missing required field ${error.params.missingProperty}`;
  return error.message ?? `failed ${error.keyword}`;
}

function diagnostic(file, field, reason) {
  return { file, field: field || '/', reason };
}

function addDuplicateDiagnostics(diagnostics, values, file, field, label) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) diagnostics.push(diagnostic(file, field, `duplicate ${label}: ${value}`));
    seen.add(value);
  }
}

export function serializeTeacherWorkPlanCurriculumMap(value) {
  return stringify(value, {
    aliasDuplicateObjects: false,
    lineWidth: 0,
    sortMapEntries: false,
  });
}

async function loadOneArtifact(root, contract, shared) {
  const artifactText = await fs.readFile(safeRepositoryPath(root, contract.artifactPath, 'crosswalk path'), 'utf8');
  const artifact = parseStrictYaml(artifactText, contract.artifactPath);
  const source = shared.manifest.sources?.find((candidate) => candidate.id === contract.sourceId);
  if (!source) throw new Error(`${contract.artifactPath}: ${contract.sourceId} is absent from source-manifest.json`);
  const extractionText = await fs.readFile(safeRepositoryPath(root, contract.extractionPath, 'extraction path'), 'utf8');
  const [markdownBytes, qaBytes, topicText, bookText, archiveStat] = await Promise.all([
    fs.readFile(safeRepositoryPath(root, source.md_path, 'canonical Markdown path')),
    fs.readFile(safeRepositoryPath(root, source.qa_path, 'QA path')),
    fs.readFile(safeRepositoryPath(root, contract.existingArtifacts.topic_inventory, 'topic inventory path'), 'utf8'),
    fs.readFile(safeRepositoryPath(root, contract.existingArtifacts.book_inventory, 'book inventory path'), 'utf8'),
    fs.stat(safeRepositoryPath(root, source.source_archive, 'source archive path')),
  ]);
  for (const repositoryPath of Object.values(contract.existingArtifacts).filter((value) => value !== null)) {
    const stat = await fs.stat(safeRepositoryPath(root, repositoryPath, 'existing artifact path'));
    if (!stat.isFile()) throw new Error(`${repositoryPath}: expected a regular file`);
  }
  if (!archiveStat.isFile()) throw new Error(`${source.source_archive}: expected a regular file`);
  const markdownText = markdownBytes.toString('utf8');
  return {
    artifactPath: contract.artifactPath,
    artifactText,
    artifact,
    contract,
    source,
    extractionPath: contract.extractionPath,
    extraction: JSON.parse(extractionText),
    routeRecords: parseOpiqRegressionMarkdown(markdownText, {
      sourceId: source.id,
      mdPath: source.md_path,
    }).records,
    markdownSha256: sha256(markdownBytes),
    archiveSha256: sha256(await fs.readFile(safeRepositoryPath(root, source.source_archive, 'source archive path'))),
    qa: JSON.parse(qaBytes.toString('utf8')),
    topicInventory: parseStrictYaml(topicText, contract.existingArtifacts.topic_inventory),
    bookInventory: parseStrictYaml(bookText, contract.existingArtifacts.book_inventory),
  };
}

export async function loadTeacherWorkPlanCurriculumMapRepository({
  rootDir = process.cwd(),
  schemaPath = TEACHER_WORK_PLAN_MAP_SCHEMA_PATH,
  manifestPath = 'source-manifest.json',
  provenancePath = PROVENANCE_PATH,
} = {}) {
  const root = path.resolve(rootDir);
  const discoveredPaths = await listCrosswalks(root);
  const [schemaText, manifestText, provenanceText, ...extractionTexts] = await Promise.all([
    fs.readFile(safeRepositoryPath(root, schemaPath, 'crosswalk schema path'), 'utf8'),
    fs.readFile(safeRepositoryPath(root, manifestPath, 'manifest path'), 'utf8'),
    fs.readFile(safeRepositoryPath(root, provenancePath, 'provenance path'), 'utf8'),
    ...Object.keys(EXTRACTION_STATUS_CONTRACTS).map((repositoryPath) => (
      fs.readFile(safeRepositoryPath(root, repositoryPath, 'registered extraction path'), 'utf8')
    )),
  ]);
  const shared = {
    schema: JSON.parse(schemaText),
    manifest: JSON.parse(manifestText),
    provenance: JSON.parse(provenanceText),
  };
  const artifacts = await Promise.all(
    TEACHER_WORK_PLAN_MAP_PATHS.map((artifactPath) => (
      loadOneArtifact(root, TEACHER_WORK_PLAN_MAP_CONTRACTS[artifactPath], shared)
    )),
  );
  return {
    rootDir: root,
    discoveredPaths,
    ...shared,
    artifacts,
    extractions: Object.keys(EXTRACTION_STATUS_CONTRACTS).map((repositoryPath, index) => ({
      path: repositoryPath,
      artifact: JSON.parse(extractionTexts[index]),
    })),
  };
}

function expectedSourceBlock(extraction, sourceRange) {
  if (sourceRange.record_kind === 'unassigned_annual_slot') return null;
  return extraction.thematic_blocks.find((block) => (
    block.main_numbered_lesson_span.lesson_start <= sourceRange.lesson_start
    && block.main_numbered_lesson_span.lesson_end >= sourceRange.lesson_end
  ))?.block_id ?? null;
}

function sourceRangeKey(range) {
  return `${range.lesson_start}-${range.lesson_end}`;
}

function collectTopicRecords(topicInventory) {
  const records = new Map();
  for (const topic of topicInventory.topics ?? []) {
    for (const bucket of ['selected_records', 'alternative_records', 'rejected_records']) {
      for (const record of topic[bucket] ?? []) records.set(record.record_id, { topic, record, bucket });
    }
  }
  return records;
}

function hasSourceActivity(sourceRange, kind) {
  const methods = normalizeText(sourceRange.methods_and_practical_work?.join(' ')).toLowerCase();
  if (kind === 'assessment') return (sourceRange.assessment?.length ?? 0) > 0;
  if (kind === 'fieldwork') return /(õppekäik|välitöö|välivaatlus|vaatlusretk|veekogu uurimine)/u.test(methods);
  return /(praktil|katse|mõõtm|mudel|uurimus|uurimistöö)/u.test(methods);
}

function validateRouteAndSources(diagnostics, repository, collection) {
  const { artifact, artifactPath, contract, source, extraction, qa } = repository;
  const comparisons = [
    ['/map_id', artifact.map_id, contract.mapId],
    ['/grade', artifact.grade, contract.grade],
    ['/subject', artifact.subject, contract.subject],
    ['/subject_et', artifact.subject_et, contract.subjectEt],
    ['/canonical_route/source_id', artifact.canonical_route?.source_id, source.id],
    ['/canonical_route/md_path', artifact.canonical_route?.md_path, source.md_path],
    ['/canonical_route/source_archive', artifact.canonical_route?.source_archive, source.source_archive],
    ['/canonical_route/qa_path', artifact.canonical_route?.qa_path, source.qa_path],
    ['/canonical_route/record_count', artifact.canonical_route?.record_count, source.record_count],
    ['/canonical_route/coverage_status', artifact.canonical_route?.coverage_status, source.coverage_status],
    ['/source_extraction/extraction_id', artifact.source_extraction?.extraction_id, extraction.extraction_id],
    ['/source_extraction/path', artifact.source_extraction?.path, contract.extractionPath],
    ['/source_extraction/source_pdf_path', artifact.source_extraction?.source_pdf_path, extraction.source.repository_path],
    ['/source_extraction/source_sha256', artifact.source_extraction?.source_sha256, extraction.source.sha256],
    ['/source_extraction/source_page_count', artifact.source_extraction?.source_page_count, extraction.source.page_count],
    ['/source_extraction/lesson_range_count', artifact.source_extraction?.lesson_range_count, extraction.lesson_ranges.length],
    ['/source_extraction/extracted_lesson_span', artifact.source_extraction?.extracted_lesson_span, extraction.annual_allocation.extracted_lesson_span],
  ];
  for (const [field, actual, expected] of comparisons) {
    if (!sameValues(actual, expected)) diagnostics.push(diagnostic(artifactPath, field, `expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`));
  }
  if (source.grade !== contract.grade || source.subject !== contract.subject || source.subject_et !== contract.subjectEt) {
    diagnostics.push(diagnostic(artifactPath, '/canonical_route', `crosswalk must resolve only the ${contract.sourceId} route`));
  }
  const provenanceEntry = collection.provenance.sources?.find((entry) => entry.repository_path === extraction.source.repository_path);
  for (const field of ['repository_path', 'sha256', 'page_count', 'grade', 'subject', 'subject_et', 'provenance_kind', 'canonical']) {
    if (!provenanceEntry || !sameValues(provenanceEntry[field], extraction.source[field])) {
      diagnostics.push(diagnostic(artifactPath, `/source_extraction/${field}`, 'extraction differs from provenance.json'));
    }
  }
  for (const [field, actual, expected] of [
    ['source_id', qa.source_id, source.id],
    ['source_archive', qa.source_archive, source.source_archive],
    ['output_file', qa.output_file, source.md_path],
    ['page_records_included', qa.page_records_included, source.record_count],
    ['normalized_grade', qa.normalized_grade, source.grade],
    ['source_archive_sha256', qa.checksums?.source_archive_sha256, repository.archiveSha256],
    ['output_file_sha256', qa.checksums?.output_file_sha256, repository.markdownSha256],
  ]) {
    if (!sameValues(actual, expected)) diagnostics.push(diagnostic(artifactPath, `/canonical_route/${field}`, `QA expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`));
  }
  if (repository.routeRecords.length !== source.record_count) {
    diagnostics.push(diagnostic(artifactPath, '/canonical_route/record_count', `canonical Markdown has ${repository.routeRecords.length} records`));
  }
  for (const [field, expected] of Object.entries(contract.existingArtifacts)) {
    if (!sameValues(artifact.existing_curriculum_artifacts?.[field], expected)) {
      diagnostics.push(diagnostic(artifactPath, `/existing_curriculum_artifacts/${field}`, `expected ${JSON.stringify(expected)}`));
    }
  }
}

function validateProgrammeMatch(diagnostics, repository, match, matchField, inventoryRecord, book) {
  const { artifactPath, contract } = repository;
  if (contract.programmePolicy === 'verified_ordinary') {
    if (match.programme_type === 'unknown') diagnostics.push(diagnostic(artifactPath, `${matchField}/programme_type`, 'unknown programme material cannot be positive Grade 5 evidence'));
    if (match.programme_type === 'simplified_curriculum') diagnostics.push(diagnostic(artifactPath, `${matchField}/programme_type`, 'simplified curriculum cannot be an ordinary default match'));
    if (['supplementary', 'teacher_support'].includes(match.programme_type) && match.match_scope?.includes('core_content')) {
      diagnostics.push(diagnostic(artifactPath, `${matchField}/programme_type`, 'supplementary or teacher-support material cannot replace ordinary core content'));
    }
    return;
  }
  for (const [name, expected] of [
    ['programme_type', 'unknown'],
    ['programme_type_evidence_status', 'ambiguous'],
    ['default_course_eligibility', 'unverified'],
  ]) {
    if (match[name] !== expected) diagnostics.push(diagnostic(artifactPath, `${matchField}/${name}`, `Grade 6 content evidence requires ${expected}`));
  }
  if (inventoryRecord.programme_type !== 'unknown') diagnostics.push(diagnostic(artifactPath, `${matchField}/programme_type`, 'Grade 6 topic inventory record must retain unknown programme type'));
  if (book?.programme_type_evidence?.status !== match.programme_type_evidence_status) {
    diagnostics.push(diagnostic(artifactPath, `${matchField}/programme_type_evidence_status`, 'value differs from book inventory programme-type evidence'));
  }
  if (book?.eligible_for_ordinary_course !== false || match.default_course_eligibility !== 'unverified') {
    diagnostics.push(diagnostic(artifactPath, `${matchField}/default_course_eligibility`, 'unresolved Grade 6 book eligibility must remain unverified'));
  }
}

function validateMappings(diagnostics, repository) {
  const { artifact, artifactPath, contract, extraction, topicInventory, bookInventory, routeRecords, qa } = repository;
  const mappings = artifact.lesson_range_mappings ?? [];
  const sourceRanges = extraction.lesson_ranges ?? [];
  addDuplicateDiagnostics(diagnostics, mappings.map((mapping) => mapping.mapping_id), artifactPath, '/lesson_range_mappings', 'mapping_id');
  addDuplicateDiagnostics(diagnostics, mappings.map(sourceRangeKey), artifactPath, '/lesson_range_mappings', 'source lesson range');
  const expectedByKey = new Map(sourceRanges.map((range) => [sourceRangeKey(range), range]));
  const actualKeys = mappings.map(sourceRangeKey);
  for (const expectedKey of expectedByKey.keys()) if (!actualKeys.includes(expectedKey)) diagnostics.push(diagnostic(artifactPath, '/lesson_range_mappings', `missing source range ${expectedKey}`));
  for (const actualKey of actualKeys) if (!expectedByKey.has(actualKey)) diagnostics.push(diagnostic(artifactPath, '/lesson_range_mappings', `invented or split source range ${actualKey}`));
  const topicsById = new Map((topicInventory.topics ?? []).map((topic) => [topic.topic_id, topic]));
  const recordsById = collectTopicRecords(topicInventory);
  const booksById = new Map((bookInventory.books ?? []).map((book) => [book.book_id, book]));
  const routeByUrl = new Map();
  for (const record of routeRecords) routeByUrl.set(record.url, [...(routeByUrl.get(record.url) ?? []), record]);

  for (const [index, mapping] of mappings.entries()) {
    const field = `/lesson_range_mappings/${index}`;
    const sourceRange = expectedByKey.get(sourceRangeKey(mapping));
    const expectedKind = sourceRange?.record_kind ?? 'lesson_range';
    if (contract.requireSourceRecordKind && mapping.source_record_kind !== expectedKind) {
      diagnostics.push(diagnostic(artifactPath, `${field}/source_record_kind`, `expected ${expectedKind}`));
    } else if (mapping.source_record_kind !== undefined && mapping.source_record_kind !== expectedKind) {
      diagnostics.push(diagnostic(artifactPath, `${field}/source_record_kind`, `expected ${expectedKind}`));
    }
    if (sourceRange) {
      for (const [name, expected] of [
        ['source_pages', sourceRange.source_pages],
        ['source_topic_et', sourceRange.topic_et],
        ['source_block_id', expectedSourceBlock(extraction, sourceRange)],
      ]) if (!sameValues(mapping[name], expected)) diagnostics.push(diagnostic(artifactPath, `${field}/${name}`, `expected ${JSON.stringify(expected)}, found ${JSON.stringify(mapping[name])}`));
    }
    const isUnassigned = expectedKind === 'unassigned_annual_slot';
    if (!isUnassigned && mapping.source_block_id === null) diagnostics.push(diagnostic(artifactPath, `${field}/source_block_id`, 'ordinary lesson range cannot have a null block'));
    if (isUnassigned) {
      if (mapping.source_block_id !== null) diagnostics.push(diagnostic(artifactPath, `${field}/source_block_id`, 'unassigned annual slot must have a null block'));
      if ((mapping.topic_inventory_refs ?? []).length > 0) diagnostics.push(diagnostic(artifactPath, `${field}/topic_inventory_refs`, 'unassigned annual slot cannot reference a topic'));
      if ((mapping.opiq_matches ?? []).length > 0) diagnostics.push(diagnostic(artifactPath, `${field}/opiq_matches`, 'unassigned annual slot cannot use an Opiq match'));
      if (mapping.coverage_status !== 'ambiguous') diagnostics.push(diagnostic(artifactPath, `${field}/coverage_status`, 'unassigned annual slot must remain ambiguous'));
      if (mapping.evidence_classification?.bridging_content !== 'teacher_review_required' || mapping.bridge_requirement?.required !== true) diagnostics.push(diagnostic(artifactPath, `${field}/bridge_requirement`, 'unassigned annual slot requires teacher review'));
      if (mapping.mapping_confidence !== 'low' || mapping.review_status !== 'mapping_review_pending') diagnostics.push(diagnostic(artifactPath, field, 'unassigned annual slot must remain low-confidence and pending review'));
      if (mapping.normalized_mapping_topic_et !== 'Aastaplaani jaotamata tund; õppeteemat ei määrata') diagnostics.push(diagnostic(artifactPath, `${field}/normalized_mapping_topic_et`, 'unassigned annual slot must not invent a teaching topic'));
    }
    for (const topicId of mapping.topic_inventory_refs ?? []) if (!topicsById.has(topicId)) diagnostics.push(diagnostic(artifactPath, `${field}/topic_inventory_refs`, `unknown topic inventory ID ${topicId}`));
    addDuplicateDiagnostics(diagnostics, (mapping.opiq_matches ?? []).map((match) => match.record_id), artifactPath, `${field}/opiq_matches`, 'Opiq record');
    addDuplicateDiagnostics(diagnostics, (mapping.opiq_matches ?? []).map((match) => match.canonical_url), artifactPath, `${field}/opiq_matches`, 'canonical URL');
    for (const [matchIndex, match] of (mapping.opiq_matches ?? []).entries()) {
      const matchField = `${field}/opiq_matches/${matchIndex}`;
      const inventoryEntry = recordsById.get(match.record_id);
      if (!inventoryEntry) {
        diagnostics.push(diagnostic(artifactPath, `${matchField}/record_id`, `unknown topic inventory record ${match.record_id}`));
        const unregisteredBook = booksById.get(match.book_id);
        if (unregisteredBook?.page_evidence === 'cover_only') diagnostics.push(diagnostic(artifactPath, matchField, `cover-only book ${match.book_id} cannot supply page evidence`));
        continue;
      }
      if (inventoryEntry.bucket === 'rejected_records') diagnostics.push(diagnostic(artifactPath, `${matchField}/record_id`, `rejected record cannot be positive evidence: ${match.record_id}`));
      if (inventoryEntry.topic.topic_id !== match.topic_inventory_ref) diagnostics.push(diagnostic(artifactPath, `${matchField}/topic_inventory_ref`, `record belongs to ${inventoryEntry.topic.topic_id}`));
      if (!(mapping.topic_inventory_refs ?? []).includes(match.topic_inventory_ref)) diagnostics.push(diagnostic(artifactPath, `${matchField}/topic_inventory_ref`, 'match topic must be declared in topic_inventory_refs'));
      const inventoryRecord = inventoryEntry.record;
      for (const name of ['canonical_url', 'canonical_source_id', 'book_id', 'title', 'language', 'programme_type']) {
        if (!sameValues(match[name], inventoryRecord[name])) diagnostics.push(diagnostic(artifactPath, `${matchField}/${name}`, `value differs from topic inventory record ${match.record_id}`));
      }
      if (!(match.instructional_roles ?? []).every((role) => inventoryRecord.instructional_roles?.includes(role))) diagnostics.push(diagnostic(artifactPath, `${matchField}/instructional_roles`, 'role is not declared by the topic inventory record'));
      const book = booksById.get(match.book_id);
      if (!book) diagnostics.push(diagnostic(artifactPath, `${matchField}/book_id`, `unknown audited book ID ${match.book_id}`));
      else {
        if (book.page_evidence === 'cover_only') diagnostics.push(diagnostic(artifactPath, matchField, `cover-only book ${match.book_id} cannot supply page evidence`));
        if (book.programme_type !== match.programme_type) diagnostics.push(diagnostic(artifactPath, `${matchField}/programme_type`, `expected ${book.programme_type}`));
        if (book.language !== match.language) diagnostics.push(diagnostic(artifactPath, `${matchField}/language`, `expected ${book.language}`));
      }
      validateProgrammeMatch(diagnostics, repository, match, matchField, inventoryRecord, book);
      const routeMatches = routeByUrl.get(match.canonical_url) ?? [];
      if (routeMatches.length !== 1) diagnostics.push(diagnostic(artifactPath, `${matchField}/canonical_url`, `URL must occur exactly once in ${repository.source.md_path}; found ${routeMatches.length}`));
      else {
        const routeRecord = routeMatches[0];
        for (const [name, actual, expected] of [
          ['title', match.title, routeRecord.title],
          ['book_id', match.book_id, routeRecord.book_id],
          ['language', match.language, routeRecord.language],
          ['grade', artifact.grade, routeRecord.class],
          ['subject', artifact.subject, routeRecord.subject?.en],
          ['subject_et', artifact.subject_et, routeRecord.subject?.et],
        ]) if (normalizeText(actual) !== normalizeText(expected)) diagnostics.push(diagnostic(artifactPath, `${matchField}/${name}`, `canonical Markdown expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`));
        if (!Object.hasOwn(qa.languages ?? {}, match.language)) diagnostics.push(diagnostic(artifactPath, `${matchField}/language`, 'language is absent from the QA snapshot'));
        if (!Object.hasOwn(qa.books ?? {}, match.book_id)) diagnostics.push(diagnostic(artifactPath, `${matchField}/book_id`, 'book is absent from the QA snapshot'));
      }
    }
    const expectedClassification = (mapping.opiq_matches ?? []).map(({ record_id, programme_type }) => ({ record_id, programme_type }));
    if (!sameValues(mapping.evidence_classification?.opiq_material ?? [], expectedClassification)) diagnostics.push(diagnostic(artifactPath, `${field}/evidence_classification/opiq_material`, 'must exactly classify every Opiq match in order'));
    const bridging = mapping.evidence_classification?.bridging_content;
    if (mapping.bridge_requirement?.required !== (bridging !== 'none')) diagnostics.push(diagnostic(artifactPath, `${field}/bridge_requirement`, 'required must agree with bridging_content'));
    const matches = mapping.opiq_matches ?? [];
    const gaps = mapping.gap_notes ?? [];
    if (mapping.coverage_status === 'matched') {
      if (matches.length === 0) diagnostics.push(diagnostic(artifactPath, `${field}/opiq_matches`, 'matched status requires positive Opiq evidence'));
      if (!matches.some((match) => ['exact', 'strong'].includes(match.match_strength))) diagnostics.push(diagnostic(artifactPath, `${field}/opiq_matches`, 'matched status cannot rely only on supporting or keyword evidence'));
      if (gaps.length > 0 || bridging !== 'none') diagnostics.push(diagnostic(artifactPath, field, 'matched status cannot declare gaps or required bridging'));
      for (const scope of ['fieldwork', 'practical_work', 'assessment']) {
        if (sourceRange && hasSourceActivity(sourceRange, scope) && !matches.some((match) => match.match_scope?.includes(scope))) diagnostics.push(diagnostic(artifactPath, `${field}/coverage_status`, `matched source activity requires ${scope} page evidence`));
      }
    } else if (mapping.coverage_status === 'partial') {
      if (matches.length === 0) diagnostics.push(diagnostic(artifactPath, `${field}/opiq_matches`, 'partial status requires limited positive Opiq evidence'));
      if (gaps.length === 0) diagnostics.push(diagnostic(artifactPath, `${field}/gap_notes`, 'partial status requires an explicit gap'));
    } else if (mapping.coverage_status === 'missing') {
      if (matches.length > 0) diagnostics.push(diagnostic(artifactPath, `${field}/opiq_matches`, 'missing status cannot have positive Opiq matches'));
      if (gaps.length === 0 || !mapping.bridge_requirement?.required) diagnostics.push(diagnostic(artifactPath, field, 'missing status requires a documented gap and bridge'));
    } else if (mapping.coverage_status === 'outside_route') {
      if (matches.length > 0) diagnostics.push(diagnostic(artifactPath, `${field}/opiq_matches`, 'outside_route cannot use exact-route matches'));
      if (!/other grade|other subject|adjacent-grade|foreign scope/iu.test(`${mapping.rationale} ${gaps.join(' ')}`)) diagnostics.push(diagnostic(artifactPath, field, 'outside_route requires an explicit foreign scope explanation'));
    } else if (mapping.coverage_status === 'ambiguous' && gaps.length === 0) diagnostics.push(diagnostic(artifactPath, `${field}/gap_notes`, 'ambiguous status requires an explicit uncertainty'));
  }
}

function validateTopicComparison(diagnostics, repository) {
  const { artifact, artifactPath, contract, topicInventory } = repository;
  const comparisons = artifact.topic_inventory_comparison ?? [];
  const inventoryIds = (topicInventory.topics ?? []).map((topic) => topic.topic_id);
  if (!sameValues(inventoryIds, contract.topicIds)) diagnostics.push(diagnostic(artifactPath, '/topic_inventory_comparison', `${contract.sourceId} topic inventory must retain the registered topic IDs`));
  addDuplicateDiagnostics(diagnostics, comparisons.map((entry) => entry.topic_id), artifactPath, '/topic_inventory_comparison', 'topic ID');
  if (!sameValues(comparisons.map((entry) => entry.topic_id), contract.topicIds)) diagnostics.push(diagnostic(artifactPath, '/topic_inventory_comparison', `must contain all ${contract.topicIds.length} topic IDs exactly once in inventory order`));
  const mappings = artifact.lesson_range_mappings ?? [];
  const mappingIds = new Set(mappings.map((mapping) => mapping.mapping_id));
  const unassignedIds = new Set(mappings.filter((mapping) => mapping.source_record_kind === 'unassigned_annual_slot').map((mapping) => mapping.mapping_id));
  for (const [index, comparison] of comparisons.entries()) {
    const field = `/topic_inventory_comparison/${index}`;
    const expectedRefs = mappings.filter((mapping) => mapping.topic_inventory_refs?.includes(comparison.topic_id)).map((mapping) => mapping.mapping_id);
    if (!sameValues(comparison.source_mapping_ids, expectedRefs)) diagnostics.push(diagnostic(artifactPath, `${field}/source_mapping_ids`, 'must exactly list source mappings that reference this topic'));
    if (!(comparison.source_mapping_ids ?? []).every((mappingId) => mappingIds.has(mappingId))) diagnostics.push(diagnostic(artifactPath, `${field}/source_mapping_ids`, 'contains an unknown source mapping ID'));
    if ((comparison.source_mapping_ids ?? []).some((mappingId) => unassignedIds.has(mappingId))) diagnostics.push(diagnostic(artifactPath, `${field}/source_mapping_ids`, 'unassigned annual slot cannot represent a topic'));
    if (comparison.representation_status === 'not_represented') {
      if (comparison.represented_in_teacher_plan !== false || comparison.source_mapping_ids.length !== 0) diagnostics.push(diagnostic(artifactPath, field, 'not_represented topic cannot have source mapping references'));
      if (!comparison.notes.includes('not represented in this supplementary teacher-plan sample')) diagnostics.push(diagnostic(artifactPath, `${field}/notes`, 'must use the supplementary sample wording'));
      if (/missing from (?:the )?Grade [0-9]+ curriculum/iu.test(comparison.notes)) diagnostics.push(diagnostic(artifactPath, `${field}/notes`, 'sample absence cannot be stated as missing official curriculum'));
    } else if (comparison.represented_in_teacher_plan !== true || comparison.source_mapping_ids.length === 0) diagnostics.push(diagnostic(artifactPath, field, 'represented topic requires at least one source mapping reference'));
  }
}

function computedSummary(artifact, contract) {
  const mappings = artifact.lesson_range_mappings ?? [];
  const comparisons = artifact.topic_inventory_comparison ?? [];
  const matches = mappings.flatMap((mapping) => mapping.opiq_matches ?? []);
  const summary = {
    total_source_lesson_ranges: mappings.length,
    ...Object.fromEntries(COVERAGE_STATUSES.map((status) => [`${status}_count`, mappings.filter((mapping) => mapping.coverage_status === status).length])),
    mappings_with_russian_opiq_evidence: mappings.filter((mapping) => mapping.opiq_matches?.some((match) => match.language === 'ru')).length,
    mappings_with_estonian_opiq_evidence: mappings.filter((mapping) => mapping.opiq_matches?.some((match) => match.language === 'et')).length,
    mappings_requiring_bridge: mappings.filter((mapping) => mapping.evidence_classification?.bridging_content !== 'none').length,
    represented_topic_inventory_count: comparisons.filter((entry) => ['represented', 'partially_represented'].includes(entry.representation_status)).length,
    not_represented_topic_inventory_count: comparisons.filter((entry) => entry.representation_status === 'not_represented').length,
  };
  if (contract.requireSourceRecordKind) Object.assign(summary, {
    ordinary_programme_verified_match_count: matches.filter((match) => match.programme_type === 'ordinary' && match.programme_type_evidence_status === 'verified' && match.default_course_eligibility === 'eligible').length,
    unknown_programme_match_count: matches.filter((match) => match.programme_type === 'unknown').length,
    unassigned_annual_slot_count: mappings.filter((mapping) => mapping.source_record_kind === 'unassigned_annual_slot').length,
  });
  return summary;
}

function validateSummaryAndCompleteness(diagnostics, repository) {
  const { artifact, artifactPath, contract } = repository;
  const expected = computedSummary(artifact, contract);
  for (const [field, value] of Object.entries(expected)) if (artifact.mapping_summary?.[field] !== value) diagnostics.push(diagnostic(artifactPath, `/mapping_summary/${field}`, `expected computed value ${value}`));
  if (expected.total_source_lesson_ranges !== repository.extraction.lesson_ranges.length) diagnostics.push(diagnostic(artifactPath, '/mapping_summary/total_source_lesson_ranges', `expected ${repository.extraction.lesson_ranges.length}`));
  const coverageTotal = COVERAGE_STATUSES.reduce((sum, status) => sum + expected[`${status}_count`], 0);
  if (coverageTotal !== expected.total_source_lesson_ranges) diagnostics.push(diagnostic(artifactPath, '/mapping_summary', 'five coverage counts must sum to all source lesson ranges'));
  if (contract.requireUnassignedAnnualSlot && expected.unassigned_annual_slot_count !== 1) diagnostics.push(diagnostic(artifactPath, '/mapping_summary/unassigned_annual_slot_count', 'Grade 6 requires exactly one unassigned annual slot'));
  if (contract.programmePolicy === 'content_only_unknown' && expected.ordinary_programme_verified_match_count !== 0) diagnostics.push(diagnostic(artifactPath, '/mapping_summary/ordinary_programme_verified_match_count', 'Grade 6 has no verified ordinary-programme matches'));
  for (const field of ['canonical_opiq_mapping_complete', 'official_curriculum_complete', 'exact_grade_official_allocation_claimed', 'live_opiq_catalogue_complete']) if (artifact.completeness?.[field] !== false) diagnostics.push(diagnostic(artifactPath, `/completeness/${field}`, 'unsupported completeness claim must remain false'));
  if (contract.programmePolicy === 'content_only_unknown') {
    for (const field of ['programme_type_verification_complete', 'default_course_selection_complete']) if (artifact.completeness?.[field] !== false) diagnostics.push(diagnostic(artifactPath, `/completeness/${field}`, 'unresolved Grade 6 programme claim must remain false'));
  }
  if (artifact.completeness?.all_extracted_lesson_ranges_classified !== true) diagnostics.push(diagnostic(artifactPath, '/completeness/all_extracted_lesson_ranges_classified', 'all extracted ranges must be classified'));
  if (artifact.completeness?.declared_complete_for_source_extraction !== true) diagnostics.push(diagnostic(artifactPath, '/completeness/declared_complete_for_source_extraction', 'crosswalk must be complete only for the source extraction'));
}

function validateExtractionStatuses(diagnostics, collection) {
  for (const entry of collection.extractions) {
    const expected = EXTRACTION_STATUS_CONTRACTS[entry.path];
    if (entry.artifact.route_context?.mapping_status !== expected) diagnostics.push(diagnostic(entry.path, '/route_context/mapping_status', `expected mapping_status ${expected}`));
    if (entry.artifact.completeness?.canonical_opiq_mapping_complete !== false) diagnostics.push(diagnostic(entry.path, '/completeness/canonical_opiq_mapping_complete', 'canonical Opiq mapping must remain incomplete'));
  }
}

export function validateTeacherWorkPlanCurriculumMapRepository(collection) {
  const diagnostics = [];
  if (!sameValues(collection.discoveredPaths, TEACHER_WORK_PLAN_MAP_PATHS)) diagnostics.push(diagnostic('curriculum-maps', '/', `expected exactly the registered production crosswalks: ${TEACHER_WORK_PLAN_MAP_PATHS.join(', ')}`));
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  const validateSchema = ajv.compile(collection.schema);
  for (const repository of collection.artifacts) {
    if (!validateSchema(repository.artifact)) for (const error of validateSchema.errors ?? []) diagnostics.push(diagnostic(repository.artifactPath, error.instancePath || '/', schemaReason(error)));
    validateRouteAndSources(diagnostics, repository, collection);
    validateMappings(diagnostics, repository);
    validateTopicComparison(diagnostics, repository);
    validateSummaryAndCompleteness(diagnostics, repository);
    if (serializeTeacherWorkPlanCurriculumMap(repository.artifact) !== repository.artifactText) diagnostics.push(diagnostic(repository.artifactPath, '/', 'YAML property order or serialization is not deterministic'));
  }
  validateExtractionStatuses(diagnostics, collection);
  diagnostics.sort((left, right) => compareBytewise(`${left.file}\0${left.field}\0${left.reason}`, `${right.file}\0${right.field}\0${right.reason}`));
  const perArtifact = Object.fromEntries(collection.artifacts.map((repository) => [repository.contract.sourceId, computedSummary(repository.artifact, repository.contract)]));
  return {
    diagnostics,
    summary: {
      errors: diagnostics.length,
      artifacts: collection.discoveredPaths.length,
      per_artifact: perArtifact,
      total_source_lesson_ranges: Object.values(perArtifact).reduce((sum, entry) => sum + entry.total_source_lesson_ranges, 0),
    },
  };
}

export function formatTeacherWorkPlanCurriculumMapDiagnostic(entry) {
  return `[ERROR] ${entry.file} ${entry.field}: ${entry.reason}`;
}
