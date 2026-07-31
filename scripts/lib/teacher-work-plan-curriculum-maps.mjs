import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { parseDocument, stringify } from 'yaml';
import { parseOpiqRegressionMarkdown } from './opiq-regression-markdown.mjs';

export const TEACHER_WORK_PLAN_MAP_SCHEMA_PATH =
  'schemas/teacher-work-plan-curriculum-map.schema.json';
export const TEACHER_WORK_PLAN_MAP_PATH =
  'curriculum-maps/grade-5-science/teacher-work-plan-crosswalk.yaml';

const PROVENANCE_PATH =
  'project-files/inputs/originals/teacher-work-plans/provenance.json';
const GRADE_5_EXTRACTION_PATH =
  'evaluations/teacher-work-plans/grade-5-science-extraction.json';
const OTHER_EXTRACTION_PATHS = Object.freeze([
  'evaluations/teacher-work-plans/grade-6-science-extraction.json',
  'evaluations/teacher-work-plans/grade-7-geography-extraction.json',
  'evaluations/teacher-work-plans/grade-7-science-extraction.json',
]);
const EXPECTED_EXISTING_ARTIFACTS = Object.freeze({
  book_inventory: 'curriculum-maps/grade-5-science/book-inventory.yaml',
  topic_inventory: 'curriculum-maps/grade-5-science/topic-inventory.yaml',
  official_curriculum_map: 'curriculum-maps/grade-5-science/official-curriculum.yaml',
  annual_architecture: 'annual-courses/grade-5-science/annual-architecture.yaml',
});
const EXPECTED_TOPIC_IDS = Object.freeze([
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

function safeRepositoryPath(rootDir, repositoryPath, label) {
  if (
    typeof repositoryPath !== 'string'
    || repositoryPath.length === 0
    || path.isAbsolute(repositoryPath)
    || repositoryPath.includes('\\')
    || repositoryPath.split('/').some((segment) => ['', '.', '..'].includes(segment))
  ) {
    throw new Error(`${label} must be a safe repository-relative path`);
  }
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, repositoryPath);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`${label} points outside the repository`);
  }
  return resolved;
}

function parseStrictYaml(text, file) {
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
  const value = document.toJS({ maxAliasCount: 0 });
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${file}: YAML root must be an object`);
  }
  return value;
}

async function listCrosswalks(rootDir) {
  const mapsDirectory = safeRepositoryPath(rootDir, 'curriculum-maps', 'curriculum maps path');
  const found = [];
  async function visit(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => compareBytewise(left.name, right.name))) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(entryPath);
      else if (entry.isFile() && entry.name === 'teacher-work-plan-crosswalk.yaml') {
        found.push(path.relative(rootDir, entryPath).split(path.sep).join('/'));
      }
    }
  }
  await visit(mapsDirectory);
  return found.sort(compareBytewise);
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

export async function loadTeacherWorkPlanCurriculumMapRepository({
  rootDir = process.cwd(),
  artifactPath = TEACHER_WORK_PLAN_MAP_PATH,
  schemaPath = TEACHER_WORK_PLAN_MAP_SCHEMA_PATH,
  manifestPath = 'source-manifest.json',
  provenancePath = PROVENANCE_PATH,
  grade5ExtractionPath = GRADE_5_EXTRACTION_PATH,
  otherExtractionPaths = OTHER_EXTRACTION_PATHS,
} = {}) {
  const root = path.resolve(rootDir);
  const discoveredPaths = await listCrosswalks(root);
  const artifactFile = safeRepositoryPath(root, artifactPath, 'crosswalk path');
  const schemaFile = safeRepositoryPath(root, schemaPath, 'crosswalk schema path');
  const manifestFile = safeRepositoryPath(root, manifestPath, 'manifest path');
  const provenanceFile = safeRepositoryPath(root, provenancePath, 'provenance path');
  const extractionFile = safeRepositoryPath(root, grade5ExtractionPath, 'Grade 5 extraction path');
  const otherFiles = otherExtractionPaths.map((repositoryPath) => (
    safeRepositoryPath(root, repositoryPath, 'other extraction path')
  ));
  const [
    artifactText,
    schemaText,
    manifestText,
    provenanceText,
    extractionText,
    ...otherExtractionTexts
  ] = await Promise.all([
    fs.readFile(artifactFile, 'utf8'),
    fs.readFile(schemaFile, 'utf8'),
    fs.readFile(manifestFile, 'utf8'),
    fs.readFile(provenanceFile, 'utf8'),
    fs.readFile(extractionFile, 'utf8'),
    ...otherFiles.map((file) => fs.readFile(file, 'utf8')),
  ]);
  const artifact = parseStrictYaml(artifactText, artifactPath);
  const manifest = JSON.parse(manifestText);
  // Fail closed on the one production registry entry. Artifact mutations must never
  // cause the validator to read an adjacent route or another grade's inventories.
  const source = manifest.sources?.find((candidate) => candidate.id === 'grade-5-science');
  if (!source) throw new Error(`${artifactPath}: grade-5-science is absent from source-manifest.json`);
  const topicInventoryPath = EXPECTED_EXISTING_ARTIFACTS.topic_inventory;
  const bookInventoryPath = EXPECTED_EXISTING_ARTIFACTS.book_inventory;
  const [markdownText, qaText, topicText, bookText] = await Promise.all([
    fs.readFile(safeRepositoryPath(root, source.md_path, 'canonical Markdown path'), 'utf8'),
    fs.readFile(safeRepositoryPath(root, source.qa_path, 'QA path'), 'utf8'),
    fs.readFile(safeRepositoryPath(root, topicInventoryPath, 'topic inventory path'), 'utf8'),
    fs.readFile(safeRepositoryPath(root, bookInventoryPath, 'book inventory path'), 'utf8'),
    fs.stat(safeRepositoryPath(root, source.source_archive, 'source archive path')),
  ]);
  for (const repositoryPath of Object.values(EXPECTED_EXISTING_ARTIFACTS)) {
    await fs.access(safeRepositoryPath(root, repositoryPath, 'existing artifact path'));
  }
  return {
    rootDir: root,
    artifactPath,
    artifactText,
    artifact,
    discoveredPaths,
    schema: JSON.parse(schemaText),
    manifest,
    provenance: JSON.parse(provenanceText),
    extractionPath: grade5ExtractionPath,
    extraction: JSON.parse(extractionText),
    otherExtractions: otherExtractionTexts.map((text, index) => ({
      path: otherExtractionPaths[index],
      artifact: JSON.parse(text),
    })),
    source,
    routeRecords: parseOpiqRegressionMarkdown(markdownText, {
      sourceId: source.id,
      mdPath: source.md_path,
    }).records,
    qa: JSON.parse(qaText),
    topicInventory: parseStrictYaml(topicText, topicInventoryPath),
    bookInventory: parseStrictYaml(bookText, bookInventoryPath),
  };
}

function expectedSourceBlock(extraction, sourceRange) {
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
      for (const record of topic[bucket] ?? []) {
        records.set(record.record_id, { topic, record, bucket });
      }
    }
  }
  return records;
}

function hasSourceActivity(sourceRange, kind) {
  const methods = normalizeText(sourceRange.methods_and_practical_work?.join(' ')).toLowerCase();
  if (kind === 'assessment') return (sourceRange.assessment?.length ?? 0) > 0;
  if (kind === 'fieldwork') return /(õppekäik|välitöö|vaatlusretk|veekogu uurimine)/u.test(methods);
  return /(praktil|katse|mõõtm|mudel|uurimistöö)/u.test(methods);
}

function validateRouteAndSources(diagnostics, repository) {
  const { artifact, artifactPath, source, extraction, provenance, qa } = repository;
  const declared = artifact.canonical_route ?? {};
  const comparisons = [
    ['/map_id', artifact.map_id, 'grade-5-science-teacher-work-plan-crosswalk'],
    ['/grade', artifact.grade, 5],
    ['/subject', artifact.subject, 'science'],
    ['/subject_et', artifact.subject_et, 'loodusõpetus'],
    ['/canonical_route/source_id', declared.source_id, source.id],
    ['/canonical_route/md_path', declared.md_path, source.md_path],
    ['/canonical_route/source_archive', declared.source_archive, source.source_archive],
    ['/canonical_route/qa_path', declared.qa_path, source.qa_path],
    ['/canonical_route/record_count', declared.record_count, source.record_count],
    ['/canonical_route/coverage_status', declared.coverage_status, source.coverage_status],
    ['/source_extraction/extraction_id', artifact.source_extraction?.extraction_id, extraction.extraction_id],
    ['/source_extraction/path', artifact.source_extraction?.path, repository.extractionPath],
    ['/source_extraction/source_pdf_path', artifact.source_extraction?.source_pdf_path, extraction.source.repository_path],
    ['/source_extraction/source_sha256', artifact.source_extraction?.source_sha256, extraction.source.sha256],
    ['/source_extraction/source_page_count', artifact.source_extraction?.source_page_count, extraction.source.page_count],
    ['/source_extraction/lesson_range_count', artifact.source_extraction?.lesson_range_count, extraction.lesson_ranges.length],
    ['/source_extraction/extracted_lesson_span', artifact.source_extraction?.extracted_lesson_span, extraction.annual_allocation.extracted_lesson_span],
  ];
  for (const [field, actual, expected] of comparisons) {
    if (!sameValues(actual, expected)) {
      diagnostics.push(diagnostic(artifactPath, field, `expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`));
    }
  }
  if (
    source.id !== 'grade-5-science'
    || source.grade !== 5
    || source.subject !== 'science'
    || source.subject_et !== 'loodusõpetus'
  ) {
    diagnostics.push(diagnostic(artifactPath, '/canonical_route', 'crosswalk must resolve only the Grade 5 science route'));
  }
  const provenanceEntry = provenance.sources?.find((entry) => (
    entry.repository_path === extraction.source.repository_path
  ));
  for (const field of ['repository_path', 'sha256', 'page_count', 'grade', 'subject', 'subject_et', 'provenance_kind', 'canonical']) {
    if (!provenanceEntry || !sameValues(provenanceEntry[field], extraction.source[field])) {
      diagnostics.push(diagnostic(artifactPath, `/source_extraction/${field}`, 'extraction differs from provenance.json'));
    }
  }
  const qaChecks = [
    ['source_id', qa.source_id, source.id],
    ['source_archive', qa.source_archive, source.source_archive],
    ['output_file', qa.output_file, source.md_path],
    ['page_records_included', qa.page_records_included, source.record_count],
    ['normalized_grade', qa.normalized_grade, source.grade],
  ];
  for (const [field, actual, expected] of qaChecks) {
    if (!sameValues(actual, expected)) {
      diagnostics.push(diagnostic(artifactPath, `/canonical_route/${field}`, `QA expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`));
    }
  }
  if (repository.routeRecords.length !== source.record_count) {
    diagnostics.push(diagnostic(artifactPath, '/canonical_route/record_count', `canonical Markdown has ${repository.routeRecords.length} records`));
  }
  for (const [field, expected] of Object.entries(EXPECTED_EXISTING_ARTIFACTS)) {
    if (artifact.existing_curriculum_artifacts?.[field] !== expected) {
      diagnostics.push(diagnostic(artifactPath, `/existing_curriculum_artifacts/${field}`, `expected ${expected}`));
    }
  }
}

function validateMappings(diagnostics, repository) {
  const { artifact, artifactPath, extraction, topicInventory, bookInventory, routeRecords, qa } = repository;
  const mappings = artifact.lesson_range_mappings ?? [];
  const sourceRanges = extraction.lesson_ranges ?? [];
  addDuplicateDiagnostics(diagnostics, mappings.map((mapping) => mapping.mapping_id), artifactPath, '/lesson_range_mappings', 'mapping_id');
  addDuplicateDiagnostics(diagnostics, mappings.map(sourceRangeKey), artifactPath, '/lesson_range_mappings', 'source lesson range');
  const expectedByKey = new Map(sourceRanges.map((range) => [sourceRangeKey(range), range]));
  const actualKeys = mappings.map(sourceRangeKey);
  for (const expectedKey of expectedByKey.keys()) {
    if (!actualKeys.includes(expectedKey)) diagnostics.push(diagnostic(artifactPath, '/lesson_range_mappings', `missing source range ${expectedKey}`));
  }
  for (const actualKey of actualKeys) {
    if (!expectedByKey.has(actualKey)) diagnostics.push(diagnostic(artifactPath, '/lesson_range_mappings', `invented or split source range ${actualKey}`));
  }
  const topicsById = new Map((topicInventory.topics ?? []).map((topic) => [topic.topic_id, topic]));
  const recordsById = collectTopicRecords(topicInventory);
  const booksById = new Map((bookInventory.books ?? []).map((book) => [book.book_id, book]));
  const routeByUrl = new Map();
  for (const record of routeRecords) routeByUrl.set(record.url, [...(routeByUrl.get(record.url) ?? []), record]);

  for (const [index, mapping] of mappings.entries()) {
    const field = `/lesson_range_mappings/${index}`;
    const sourceRange = expectedByKey.get(sourceRangeKey(mapping));
    if (sourceRange) {
      for (const [name, expected] of [
        ['source_pages', sourceRange.source_pages],
        ['source_topic_et', sourceRange.topic_et],
        ['source_block_id', expectedSourceBlock(extraction, sourceRange)],
      ]) {
        if (!sameValues(mapping[name], expected)) {
          diagnostics.push(diagnostic(artifactPath, `${field}/${name}`, `expected ${JSON.stringify(expected)}, found ${JSON.stringify(mapping[name])}`));
        }
      }
    }
    for (const topicId of mapping.topic_inventory_refs ?? []) {
      if (!topicsById.has(topicId)) diagnostics.push(diagnostic(artifactPath, `${field}/topic_inventory_refs`, `unknown topic inventory ID ${topicId}`));
    }
    addDuplicateDiagnostics(diagnostics, (mapping.opiq_matches ?? []).map((match) => match.record_id), artifactPath, `${field}/opiq_matches`, 'Opiq record');
    for (const [matchIndex, match] of (mapping.opiq_matches ?? []).entries()) {
      const matchField = `${field}/opiq_matches/${matchIndex}`;
      const inventoryEntry = recordsById.get(match.record_id);
      if (!inventoryEntry) {
        diagnostics.push(diagnostic(artifactPath, `${matchField}/record_id`, `unknown topic inventory record ${match.record_id}`));
        const unregisteredBook = booksById.get(match.book_id);
        if (unregisteredBook?.page_evidence === 'cover_only') {
          diagnostics.push(diagnostic(artifactPath, matchField, `cover-only book ${match.book_id} cannot supply page evidence`));
        }
        continue;
      }
      if (inventoryEntry.bucket === 'rejected_records') {
        diagnostics.push(diagnostic(artifactPath, `${matchField}/record_id`, `rejected record cannot be positive evidence: ${match.record_id}`));
      }
      if (inventoryEntry.topic.topic_id !== match.topic_inventory_ref) {
        diagnostics.push(diagnostic(artifactPath, `${matchField}/topic_inventory_ref`, `record belongs to ${inventoryEntry.topic.topic_id}`));
      }
      if (!(mapping.topic_inventory_refs ?? []).includes(match.topic_inventory_ref)) {
        diagnostics.push(diagnostic(artifactPath, `${matchField}/topic_inventory_ref`, 'match topic must be declared in topic_inventory_refs'));
      }
      const inventoryRecord = inventoryEntry.record;
      for (const name of ['canonical_url', 'canonical_source_id', 'book_id', 'title', 'language', 'programme_type']) {
        if (!sameValues(match[name], inventoryRecord[name])) {
          diagnostics.push(diagnostic(artifactPath, `${matchField}/${name}`, `value differs from topic inventory record ${match.record_id}`));
        }
      }
      if (!(match.instructional_roles ?? []).every((role) => inventoryRecord.instructional_roles?.includes(role))) {
        diagnostics.push(diagnostic(artifactPath, `${matchField}/instructional_roles`, 'role is not declared by the topic inventory record'));
      }
      const book = booksById.get(match.book_id);
      if (!book) diagnostics.push(diagnostic(artifactPath, `${matchField}/book_id`, `unknown audited book ID ${match.book_id}`));
      else {
        if (book.page_evidence === 'cover_only') diagnostics.push(diagnostic(artifactPath, matchField, `cover-only book ${match.book_id} cannot supply page evidence`));
        if (book.programme_type !== match.programme_type) diagnostics.push(diagnostic(artifactPath, `${matchField}/programme_type`, `expected ${book.programme_type}`));
        if (book.language !== match.language) diagnostics.push(diagnostic(artifactPath, `${matchField}/language`, `expected ${book.language}`));
      }
      if (match.programme_type === 'simplified_curriculum') {
        diagnostics.push(diagnostic(artifactPath, `${matchField}/programme_type`, 'simplified curriculum cannot be an ordinary default match'));
      }
      if (['supplementary', 'teacher_support'].includes(match.programme_type) && match.match_scope?.includes('core_content')) {
        diagnostics.push(diagnostic(artifactPath, `${matchField}/programme_type`, 'supplementary or teacher-support material cannot replace ordinary core content'));
      }
      if (match.programme_type === 'unknown') {
        diagnostics.push(diagnostic(artifactPath, `${matchField}/programme_type`, 'unknown programme material cannot be positive evidence'));
      }
      const routeMatches = routeByUrl.get(match.canonical_url) ?? [];
      if (routeMatches.length !== 1) {
        diagnostics.push(diagnostic(artifactPath, `${matchField}/canonical_url`, `URL must occur exactly once in ${repository.source.md_path}; found ${routeMatches.length}`));
      } else {
        const routeRecord = routeMatches[0];
        for (const [name, actual, expected] of [
          ['title', match.title, routeRecord.title],
          ['book_id', match.book_id, routeRecord.book_id],
          ['language', match.language, routeRecord.language],
          ['grade', artifact.grade, routeRecord.class],
          ['subject', artifact.subject, routeRecord.subject?.en],
          ['subject_et', artifact.subject_et, routeRecord.subject?.et],
        ]) {
          if (normalizeText(actual) !== normalizeText(expected)) {
            diagnostics.push(diagnostic(artifactPath, `${matchField}/${name}`, `canonical Markdown expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`));
          }
        }
        if (!Object.hasOwn(qa.languages ?? {}, match.language)) {
          diagnostics.push(diagnostic(artifactPath, `${matchField}/language`, 'language is absent from the QA snapshot'));
        }
        if (!Object.hasOwn(qa.books ?? {}, match.book_id)) {
          diagnostics.push(diagnostic(artifactPath, `${matchField}/book_id`, 'book is absent from the QA snapshot'));
        }
      }
    }
    const opiqClassification = mapping.evidence_classification?.opiq_material ?? [];
    const expectedClassification = (mapping.opiq_matches ?? []).map(({ record_id, programme_type }) => ({ record_id, programme_type }));
    if (!sameValues(opiqClassification, expectedClassification)) {
      diagnostics.push(diagnostic(artifactPath, `${field}/evidence_classification/opiq_material`, 'must exactly classify every Opiq match in order'));
    }
    const bridging = mapping.evidence_classification?.bridging_content;
    const bridgeRequired = mapping.bridge_requirement?.required;
    if (bridgeRequired !== (bridging !== 'none')) {
      diagnostics.push(diagnostic(artifactPath, `${field}/bridge_requirement`, 'required must agree with bridging_content'));
    }
    const matches = mapping.opiq_matches ?? [];
    const gaps = mapping.gap_notes ?? [];
    if (mapping.coverage_status === 'matched') {
      if (matches.length === 0) diagnostics.push(diagnostic(artifactPath, `${field}/opiq_matches`, 'matched status requires positive Opiq evidence'));
      if (!matches.some((match) => ['exact', 'strong'].includes(match.match_strength))) {
        diagnostics.push(diagnostic(artifactPath, `${field}/opiq_matches`, 'matched status cannot rely only on supporting or keyword evidence'));
      }
      if (gaps.length > 0 || bridging !== 'none') diagnostics.push(diagnostic(artifactPath, field, 'matched status cannot declare gaps or required bridging'));
      for (const scope of ['fieldwork', 'practical_work', 'assessment']) {
        if (sourceRange && hasSourceActivity(sourceRange, scope) && !matches.some((match) => match.match_scope?.includes(scope))) {
          diagnostics.push(diagnostic(artifactPath, `${field}/coverage_status`, `matched source activity requires ${scope} page evidence`));
        }
      }
    } else if (mapping.coverage_status === 'partial') {
      if (matches.length === 0) diagnostics.push(diagnostic(artifactPath, `${field}/opiq_matches`, 'partial status requires limited positive Opiq evidence'));
      if (gaps.length === 0) diagnostics.push(diagnostic(artifactPath, `${field}/gap_notes`, 'partial status requires an explicit gap'));
    } else if (mapping.coverage_status === 'missing') {
      if (matches.length > 0) diagnostics.push(diagnostic(artifactPath, `${field}/opiq_matches`, 'missing status cannot have positive Opiq matches'));
      if (gaps.length === 0 || !bridgeRequired) diagnostics.push(diagnostic(artifactPath, field, 'missing status requires a documented gap and bridge'));
    } else if (mapping.coverage_status === 'outside_route') {
      if (matches.length > 0) diagnostics.push(diagnostic(artifactPath, `${field}/opiq_matches`, 'outside_route cannot use exact-route matches'));
      if (!/other grade|other subject|adjacent-grade|foreign scope/iu.test(`${mapping.rationale} ${gaps.join(' ')}`)) {
        diagnostics.push(diagnostic(artifactPath, field, 'outside_route requires an explicit foreign scope explanation'));
      }
    } else if (mapping.coverage_status === 'ambiguous' && gaps.length === 0) {
      diagnostics.push(diagnostic(artifactPath, `${field}/gap_notes`, 'ambiguous status requires an explicit uncertainty'));
    }
  }
}

function validateTopicComparison(diagnostics, repository) {
  const { artifact, artifactPath, topicInventory } = repository;
  const comparisons = artifact.topic_inventory_comparison ?? [];
  const inventoryIds = (topicInventory.topics ?? []).map((topic) => topic.topic_id);
  if (!sameValues(inventoryIds, EXPECTED_TOPIC_IDS)) {
    diagnostics.push(diagnostic(artifactPath, '/topic_inventory_comparison', 'Grade 5 topic inventory must retain the ten registered topic IDs'));
  }
  addDuplicateDiagnostics(diagnostics, comparisons.map((entry) => entry.topic_id), artifactPath, '/topic_inventory_comparison', 'topic ID');
  if (!sameValues(comparisons.map((entry) => entry.topic_id), EXPECTED_TOPIC_IDS)) {
    diagnostics.push(diagnostic(artifactPath, '/topic_inventory_comparison', 'must contain all ten topic IDs exactly once in inventory order'));
  }
  const mappingIds = new Set((artifact.lesson_range_mappings ?? []).map((mapping) => mapping.mapping_id));
  for (const [index, comparison] of comparisons.entries()) {
    const field = `/topic_inventory_comparison/${index}`;
    const expectedRefs = (artifact.lesson_range_mappings ?? [])
      .filter((mapping) => mapping.topic_inventory_refs?.includes(comparison.topic_id))
      .map((mapping) => mapping.mapping_id);
    if (!sameValues(comparison.source_mapping_ids, expectedRefs)) {
      diagnostics.push(diagnostic(artifactPath, `${field}/source_mapping_ids`, 'must exactly list source mappings that reference this topic'));
    }
    if (!(comparison.source_mapping_ids ?? []).every((mappingId) => mappingIds.has(mappingId))) {
      diagnostics.push(diagnostic(artifactPath, `${field}/source_mapping_ids`, 'contains an unknown source mapping ID'));
    }
    if (comparison.representation_status === 'not_represented') {
      if (comparison.represented_in_teacher_plan !== false || comparison.source_mapping_ids.length !== 0) {
        diagnostics.push(diagnostic(artifactPath, field, 'not_represented topic cannot have source mapping references'));
      }
      if (!comparison.notes.includes('not represented in this supplementary teacher-plan sample')) {
        diagnostics.push(diagnostic(artifactPath, `${field}/notes`, 'must use the supplementary sample wording'));
      }
      if (/missing from Grade 5 curriculum/iu.test(comparison.notes)) {
        diagnostics.push(diagnostic(artifactPath, `${field}/notes`, 'sample absence cannot be stated as missing official curriculum'));
      }
    } else if (comparison.represented_in_teacher_plan !== true || comparison.source_mapping_ids.length === 0) {
      diagnostics.push(diagnostic(artifactPath, field, 'represented topic requires at least one source mapping reference'));
    }
  }
}

function computedSummary(artifact) {
  const mappings = artifact.lesson_range_mappings ?? [];
  const comparisons = artifact.topic_inventory_comparison ?? [];
  const statusCount = (status) => mappings.filter((mapping) => mapping.coverage_status === status).length;
  return {
    total_source_lesson_ranges: mappings.length,
    matched_count: statusCount('matched'),
    partial_count: statusCount('partial'),
    missing_count: statusCount('missing'),
    ambiguous_count: statusCount('ambiguous'),
    outside_route_count: statusCount('outside_route'),
    mappings_with_russian_opiq_evidence: mappings.filter((mapping) => mapping.opiq_matches?.some((match) => match.language === 'ru')).length,
    mappings_with_estonian_opiq_evidence: mappings.filter((mapping) => mapping.opiq_matches?.some((match) => match.language === 'et')).length,
    mappings_requiring_bridge: mappings.filter((mapping) => mapping.evidence_classification?.bridging_content !== 'none').length,
    represented_topic_inventory_count: comparisons.filter((entry) => ['represented', 'partially_represented'].includes(entry.representation_status)).length,
    not_represented_topic_inventory_count: comparisons.filter((entry) => entry.representation_status === 'not_represented').length,
  };
}

function validateSummaryAndCompleteness(diagnostics, repository) {
  const { artifact, artifactPath } = repository;
  const expected = computedSummary(artifact);
  for (const [field, value] of Object.entries(expected)) {
    if (artifact.mapping_summary?.[field] !== value) {
      diagnostics.push(diagnostic(artifactPath, `/mapping_summary/${field}`, `expected computed value ${value}`));
    }
  }
  if (expected.total_source_lesson_ranges !== repository.extraction.lesson_ranges.length) {
    diagnostics.push(diagnostic(artifactPath, '/mapping_summary/total_source_lesson_ranges', `expected ${repository.extraction.lesson_ranges.length}`));
  }
  const coverageTotal = COVERAGE_STATUSES.reduce((sum, status) => (
    sum + expected[`${status}_count`]
  ), 0);
  if (coverageTotal !== expected.total_source_lesson_ranges) {
    diagnostics.push(diagnostic(artifactPath, '/mapping_summary', 'five coverage counts must sum to all source lesson ranges'));
  }
  for (const field of [
    'canonical_opiq_mapping_complete',
    'official_curriculum_complete',
    'exact_grade_official_allocation_claimed',
    'live_opiq_catalogue_complete',
  ]) {
    if (artifact.completeness?.[field] !== false) {
      diagnostics.push(diagnostic(artifactPath, `/completeness/${field}`, 'unsupported completeness claim must remain false'));
    }
  }
  if (artifact.completeness?.all_extracted_lesson_ranges_classified !== true) {
    diagnostics.push(diagnostic(artifactPath, '/completeness/all_extracted_lesson_ranges_classified', 'all extracted ranges must be classified'));
  }
  if (artifact.completeness?.declared_complete_for_source_extraction !== true) {
    diagnostics.push(diagnostic(artifactPath, '/completeness/declared_complete_for_source_extraction', 'crosswalk must be complete only for the source extraction'));
  }
}

function validateExtractionStatuses(diagnostics, repository) {
  const { artifactPath, extraction, otherExtractions } = repository;
  if (extraction.route_context?.mapping_status !== 'partial') {
    diagnostics.push(diagnostic(artifactPath, '/source_extraction', 'Grade 5 extraction mapping_status must be partial when the production crosswalk exists'));
  }
  if (extraction.completeness?.canonical_opiq_mapping_complete !== false) {
    diagnostics.push(diagnostic(artifactPath, '/source_extraction', 'partial Grade 5 mapping requires canonical_opiq_mapping_complete false'));
  }
  for (const entry of otherExtractions) {
    if (entry.artifact.route_context?.mapping_status !== 'deferred') {
      diagnostics.push(diagnostic(entry.path, '/route_context/mapping_status', 'unmapped Grade 6/7 extraction must remain deferred'));
    }
    if (entry.artifact.completeness?.canonical_opiq_mapping_complete !== false) {
      diagnostics.push(diagnostic(entry.path, '/completeness/canonical_opiq_mapping_complete', 'unmapped Grade 6/7 extraction must remain incomplete'));
    }
  }
}

export function validateTeacherWorkPlanCurriculumMapRepository(repository) {
  const diagnostics = [];
  const { artifact, artifactPath } = repository;
  if (!sameValues(repository.discoveredPaths, [TEACHER_WORK_PLAN_MAP_PATH])) {
    diagnostics.push(diagnostic('curriculum-maps', '/', `expected exactly one registered production crosswalk at ${TEACHER_WORK_PLAN_MAP_PATH}`));
  }
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  const validateSchema = ajv.compile(repository.schema);
  if (!validateSchema(artifact)) {
    for (const error of validateSchema.errors ?? []) {
      diagnostics.push(diagnostic(artifactPath, error.instancePath || '/', schemaReason(error)));
    }
  }
  validateRouteAndSources(diagnostics, repository);
  validateMappings(diagnostics, repository);
  validateTopicComparison(diagnostics, repository);
  validateSummaryAndCompleteness(diagnostics, repository);
  validateExtractionStatuses(diagnostics, repository);
  if (serializeTeacherWorkPlanCurriculumMap(artifact) !== repository.artifactText) {
    diagnostics.push(diagnostic(artifactPath, '/', 'YAML property order or serialization is not deterministic'));
  }
  diagnostics.sort((left, right) => compareBytewise(
    `${left.file}\0${left.field}\0${left.reason}`,
    `${right.file}\0${right.field}\0${right.reason}`,
  ));
  return {
    diagnostics,
    summary: {
      errors: diagnostics.length,
      artifacts: repository.discoveredPaths.length,
      ...computedSummary(artifact),
    },
  };
}

export function formatTeacherWorkPlanCurriculumMapDiagnostic(entry) {
  return `[ERROR] ${entry.file} ${entry.field}: ${entry.reason}`;
}
