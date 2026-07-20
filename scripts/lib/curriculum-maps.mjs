import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { parseDocument } from 'yaml';
import { parseOpiqRegressionMarkdown } from './opiq-regression-markdown.mjs';
import { readCompactZip, readZipText } from './compact-zip.mjs';

const officialArtifactType = 'official_curriculum_map';
const courseArtifactTypes = new Set(['book_inventory', 'topic_inventory', 'thematic_unit']);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value) {
  return String(value ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim();
}

export function relativeDisplay(rootDir, filePath) {
  const relative = path.relative(rootDir, filePath);
  return relative && !relative.startsWith('..') ? relative.split(path.sep).join('/') : filePath;
}

export function safeRepositoryPath(rootDir, repositoryPath, label) {
  if (
    typeof repositoryPath !== 'string'
    || path.isAbsolute(repositoryPath)
    || repositoryPath.includes('\\')
    || repositoryPath.split('/').includes('..')
  ) {
    throw new Error(`${label} must be a repository-relative path.`);
  }
  const resolved = path.resolve(rootDir, repositoryPath);
  const root = path.resolve(rootDir);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`${label} points outside the repository.`);
  }
  return resolved;
}

export async function listYamlFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listYamlFiles(entryPath));
    else if (entry.isFile() && /\.ya?ml$/iu.test(entry.name)) files.push(entryPath);
  }
  return files;
}

export function parseStrictCurriculumYaml(text, file = '<memory>') {
  const document = parseDocument(text, {
    strict: true,
    uniqueKeys: true,
    schema: 'core',
    customTags: [],
    prettyErrors: true,
  });
  if (document.errors.length > 0) {
    const details = document.errors.map((error) => error.message).join('\n');
    throw new Error(`${file}: invalid YAML:\n${details}`);
  }
  const value = document.toJS({ maxAliasCount: 0 });
  if (!isPlainObject(value)) throw new Error(`${file}: YAML root must be an object.`);
  return value;
}

function parseJsonLines(text, file) {
  const records = [];
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line);
      if (!isPlainObject(value)) throw new Error('record must be an object');
      records.push(value);
    } catch (error) {
      throw new Error(`${file}:${index + 1}: invalid JSONL record: ${error.message}`);
    }
  }
  return records;
}

export async function loadCurriculumMapRepository({
  rootDir = process.cwd(),
  manifestPath = 'source-manifest.json',
  mapsPath = 'curriculum-maps',
  curriculumSchemaPath = 'schemas/curriculum-map.schema.json',
  courseSchemaPath = 'schemas/course-map.schema.json',
  additionalSourceIds = [],
} = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const manifestFile = safeRepositoryPath(absoluteRoot, manifestPath, 'manifest path');
  const mapsDirectory = safeRepositoryPath(absoluteRoot, mapsPath, 'curriculum maps path');
  const curriculumSchemaFile = safeRepositoryPath(absoluteRoot, curriculumSchemaPath, 'curriculum schema path');
  const courseSchemaFile = safeRepositoryPath(absoluteRoot, courseSchemaPath, 'course schema path');

  const [manifestText, curriculumSchemaText, courseSchemaText, yamlFiles] = await Promise.all([
    fs.readFile(manifestFile, 'utf8'),
    fs.readFile(curriculumSchemaFile, 'utf8'),
    fs.readFile(courseSchemaFile, 'utf8'),
    listYamlFiles(mapsDirectory),
  ]);
  const manifest = JSON.parse(manifestText);
  const artifacts = [];
  for (const yamlFile of yamlFiles) {
    const file = relativeDisplay(absoluteRoot, yamlFile);
    artifacts.push({ file, data: parseStrictCurriculumYaml(await fs.readFile(yamlFile, 'utf8'), file) });
  }

  const courseSourceIds = new Set([
    ...additionalSourceIds,
    ...artifacts
      .filter((artifact) => courseArtifactTypes.has(artifact.data.artifact_type))
      .map((artifact) => artifact.data.canonical_route?.source_id)
      .filter(Boolean),
  ]);
  const routes = {};
  for (const sourceId of [...courseSourceIds].sort()) {
    const source = manifest.sources?.find((candidate) => candidate.id === sourceId);
    if (!source) continue;
    const mdFile = safeRepositoryPath(absoluteRoot, source.md_path, `${sourceId} md_path`);
    const qaFile = safeRepositoryPath(absoluteRoot, source.qa_path, `${sourceId} qa_path`);
    const archiveFile = safeRepositoryPath(absoluteRoot, source.source_archive, `${sourceId} source_archive`);
    const [markdown, qaText, archive] = await Promise.all([
      fs.readFile(mdFile, 'utf8'),
      fs.readFile(qaFile, 'utf8'),
      readCompactZip(archiveFile),
    ]);
    const parsedMarkdown = parseOpiqRegressionMarkdown(markdown, {
      sourceId,
      mdPath: source.md_path,
    });
    const archiveIndex = JSON.parse(readZipText(archive, 'index.json'));
    const archiveRecords = parseJsonLines(
      readZipText(archive, 'opiq_lookup.jsonl'),
      `${source.source_archive}:opiq_lookup.jsonl`,
    );
    routes[sourceId] = {
      source,
      records: parsedMarkdown.records,
      qa: JSON.parse(qaText),
      archiveIndex,
      archiveRecords,
    };
  }

  return {
    rootDir: absoluteRoot,
    manifest,
    schemas: {
      curriculum: JSON.parse(curriculumSchemaText),
      course: JSON.parse(courseSchemaText),
    },
    artifacts,
    routes,
  };
}

function createSchemaValidators(schemas) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  return {
    curriculum: ajv.compile(schemas.curriculum),
    course: ajv.compile(schemas.course),
  };
}

function schemaReason(error) {
  if (error.keyword === 'additionalProperties') {
    return `unknown field ${error.params.additionalProperty}`;
  }
  if (error.keyword === 'required') return `missing required field ${error.params.missingProperty}`;
  return error.message ?? `failed ${error.keyword}`;
}

export function makeDiagnostic(severity, file, field, reason) {
  return { severity, file, field: field || '/', reason };
}

function addSchemaDiagnostics(diagnostics, artifact, validator) {
  if (validator(artifact.data)) return;
  for (const error of validator.errors ?? []) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      error.instancePath || '/',
      schemaReason(error),
    ));
  }
}

function addDuplicateDiagnostics(diagnostics, values, { file, field, label }) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) diagnostics.push(makeDiagnostic('error', file, field, `duplicate ${label}: ${value}`));
    seen.add(value);
  }
}

function findRouteForOfficialMap(manifest, map) {
  return manifest.sources?.filter((source) => source.grade === map.grade && source.subject === map.subject) ?? [];
}

function validateOfficialArtifact(diagnostics, artifact, context) {
  const map = artifact.data;
  const routes = findRouteForOfficialMap(context.manifest, map);
  if (routes.length !== 1) {
    diagnostics.push(makeDiagnostic(
      'error', artifact.file, '/grade',
      `expected exactly one manifest route for grade ${map.grade} subject ${map.subject}, found ${routes.length}`,
    ));
  } else if (routes[0].subject_et !== map.subject_et) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/subject_et', `expected ${routes[0].subject_et}`));
  }

  addDuplicateDiagnostics(diagnostics, (map.official_documents ?? []).map((entry) => entry.document_id), {
    file: artifact.file, field: '/official_documents', label: 'official document ID',
  });
  addDuplicateDiagnostics(diagnostics, (map.outcomes ?? []).map((entry) => entry.outcome_id), {
    file: artifact.file, field: '/outcomes', label: 'official outcome ID',
  });
  const documents = new Map((map.official_documents ?? []).map((entry) => [entry.document_id, entry]));
  for (const [index, outcome] of (map.outcomes ?? []).entries()) {
    const field = `/outcomes/${index}`;
    const document = documents.get(outcome.document_id);
    if (!document) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/document_id`, `unknown official document ${outcome.document_id}`));
    if (outcome.evidence_status === 'verified') {
      if (!document || document.evidence_status !== 'verified') {
        diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/evidence_status`, 'verified outcome requires a verified official document'));
      }
      if (!outcome.wording_et || !outcome.translation_ru || !outcome.verification?.verified_on) {
        diagnostics.push(makeDiagnostic('error', artifact.file, field, 'verified outcome requires Estonian wording, Russian translation, and verification metadata'));
      }
    }
    const scopeFields = map.official_scope?.kind === 'school_stage'
      ? ['kind', 'school_stage', 'terminal_grade', 'grade_allocation_basis', 'exact_grade_claimed']
      : ['kind', 'grade', 'grade_allocation_basis', 'exact_grade_claimed'];
    if (scopeFields.some((name) => outcome.official_scope?.[name] !== map.official_scope?.[name])) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/official_scope`, 'outcome scope must match the official map scope'));
    }
  }
  if (map.official_scope?.kind === 'school_stage' && map.official_scope.exact_grade_claimed !== false) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/official_scope', 'school-stage evidence cannot claim official exact-grade allocation'));
  }
  if (map.completeness?.declared_complete) {
    const unverified = (map.outcomes ?? []).filter((outcome) => outcome.evidence_status !== 'verified');
    if (map.completeness.status !== 'verified' || unverified.length > 0 || (map.completeness.known_gaps ?? []).length > 0) {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/completeness', 'complete official map requires verified outcomes and no known gaps'));
    }
  }
}

export function validateCanonicalRoute(diagnostics, artifact, context) {
  const data = artifact.data;
  const declared = data.canonical_route;
  const source = context.manifest.sources?.find((candidate) => candidate.id === declared?.source_id);
  if (!source) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/canonical_route/source_id', `unknown manifest source ${declared?.source_id ?? '<missing>'}`));
    return null;
  }
  const comparisons = [
    ['grade', data.grade, source.grade],
    ['subject', data.subject, source.subject],
    ['subject_et', data.subject_et, source.subject_et],
    ['canonical_route/md_path', declared.md_path, source.md_path],
    ['canonical_route/source_archive', declared.source_archive, source.source_archive],
    ['canonical_route/qa_path', declared.qa_path, source.qa_path],
  ];
  for (const [field, actual, expected] of comparisons) {
    if (actual !== expected) diagnostics.push(makeDiagnostic('error', artifact.file, `/${field}`, `expected ${expected}, found ${actual}`));
  }
  if (data.instruction_language !== 'ru' || data.subject_support_language !== 'et') {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/instruction_language', 'course must use Russian instruction with Estonian subject support'));
  }
  if (!source.languages?.includes('ru') || !source.languages?.includes('et')) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/canonical_route', 'pilot route must register both Russian and Estonian source languages'));
  }
  return context.routes[source.id] ?? null;
}

function extractKitId(url) {
  const match = /^https:\/\/www\.opiq\.ee\/kit\/(?:details\/)?(\d+)(?:\/|$)/iu.exec(url ?? '');
  return match ? Number(match[1]) : null;
}

function countBy(records, field) {
  const counts = new Map();
  for (const record of records) counts.set(record[field], (counts.get(record[field]) ?? 0) + 1);
  return counts;
}

function validateBookInventory(diagnostics, artifact, routeData) {
  if (!routeData) return;
  const inventory = artifact.data;
  const books = inventory.books ?? [];
  const booksById = new Map(books.map((book) => [book.book_id, book]));
  const archiveBooks = routeData.archiveIndex.books ?? [];
  const archiveById = new Map(archiveBooks.map((book) => [book.id, book]));
  const canonicalCounts = countBy(routeData.records, 'book_id');
  const sourceCounts = countBy(routeData.archiveRecords, 'book_id');
  addDuplicateDiagnostics(diagnostics, books.map((book) => book.book_id), {
    file: artifact.file, field: '/books', label: 'book ID',
  });
  for (const id of new Set([...booksById.keys(), ...archiveById.keys()])) {
    if (!booksById.has(id)) diagnostics.push(makeDiagnostic('error', artifact.file, '/books', `archive book ${id} is missing from the audit`));
    if (!archiveById.has(id)) diagnostics.push(makeDiagnostic('error', artifact.file, '/books', `audited book ${id} is absent from the registered archive`));
  }
  for (const [index, book] of books.entries()) {
    const field = `/books/${index}`;
    const archiveBook = archiveById.get(book.book_id);
    const sourceCount = sourceCounts.get(book.book_id) ?? 0;
    const canonicalCount = canonicalCounts.get(book.book_id) ?? 0;
    if (archiveBook && book.language !== archiveBook.language) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/language`, `expected archive language ${archiveBook.language}`));
    }
    if (book.source_record_count !== sourceCount || (archiveBook && sourceCount !== archiveBook.chapterCount)) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/source_record_count`, `expected ${sourceCount} source records`));
    }
    if (book.canonical_record_count !== canonicalCount) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/canonical_record_count`, `expected ${canonicalCount} canonical records`));
    }
    const expectedEvidence = canonicalCount === 0 ? 'cover_only' : 'page_records';
    if (book.page_evidence !== expectedEvidence) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/page_evidence`, `expected ${expectedEvidence}`));
    }
    const sourceKitIds = new Set(routeData.archiveRecords
      .filter((record) => record.book_id === book.book_id)
      .map((record) => extractKitId(record.url))
      .filter(Number.isInteger));
    if (sourceKitIds.size !== 1 || !sourceKitIds.has(book.kit_id) || extractKitId(book.kit_url) !== book.kit_id) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/kit_id`, `kit metadata does not match source URLs (${[...sourceKitIds].join(', ') || 'none'})`));
    }
    if (book.programme_type === 'simplified_curriculum') {
      if (book.provenance?.category !== 'opiq_simplified_curriculum' || book.eligible_for_ordinary_course !== false) {
        diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/programme_type`, 'simplified material must use explicit simplified provenance and be ineligible by default'));
      }
    }
    if (book.page_evidence === 'cover_only' && book.eligible_for_ordinary_course) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/eligible_for_ordinary_course`, 'cover-only book cannot provide page-level course evidence'));
    }
  }
  const audit = inventory.source_audit ?? {};
  const expectedAudit = [
    ['source_records', routeData.archiveRecords.length],
    ['canonical_records', routeData.records.length],
    ['cover_detail_records_excluded', routeData.qa.cover_detail_records_excluded],
    ['source_books', archiveBooks.length],
    ['books_with_page_records', [...canonicalCounts.values()].filter((count) => count > 0).length],
  ];
  for (const [field, expected] of expectedAudit) {
    if (audit[field] !== expected) diagnostics.push(makeDiagnostic('error', artifact.file, `/source_audit/${field}`, `expected ${expected}, found ${audit[field]}`));
  }
  if (routeData.archiveIndex.recordCount !== routeData.archiveRecords.length) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/source_audit/source_records', 'archive index recordCount does not match JSONL records'));
  }
  if (routeData.source.record_count !== routeData.records.length || routeData.qa.page_records_included !== routeData.records.length) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/source_audit/canonical_records', 'manifest, QA, and canonical Markdown record counts disagree'));
  }
}

function collectPageReferences(artifact) {
  const refs = [];
  if (artifact.data.artifact_type === 'topic_inventory') {
    for (const [topicIndex, topic] of (artifact.data.topics ?? []).entries()) {
      for (const [kind, selected] of [['selected_records', true], ['alternative_records', false], ['rejected_records', false]]) {
        for (const [recordIndex, record] of (topic[kind] ?? []).entries()) {
          refs.push({ record, field: `/topics/${topicIndex}/${kind}/${recordIndex}`, selected, rejected: kind === 'rejected_records' });
        }
      }
    }
  }
  if (artifact.data.artifact_type === 'thematic_unit') {
    for (const [kind, selected] of [['selected_records', true], ['rejected_duplicate_records', false]]) {
      for (const [recordIndex, record] of (artifact.data[kind] ?? []).entries()) {
        refs.push({ record, field: `/${kind}/${recordIndex}`, selected, rejected: kind === 'rejected_duplicate_records' });
      }
    }
  }
  return refs;
}

export function provenanceMatchesProgramme(programmeType, category) {
  const expected = {
    ordinary: 'opiq_textbook',
    simplified_curriculum: 'opiq_simplified_curriculum',
    supplementary: 'opiq_supplementary',
    teacher_support: 'opiq_teacher_support',
  };
  return programmeType === 'unknown' || expected[programmeType] === category;
}

export function validatePageReferences(
  diagnostics,
  artifact,
  routeData,
  bookInventory,
  references = collectPageReferences(artifact),
  { allowSimplifiedSelection = false } = {},
) {
  if (!routeData || !bookInventory) return;
  const booksById = new Map((bookInventory.books ?? []).map((book) => [book.book_id, book]));
  for (const ref of references) {
    const { record, field } = ref;
    const matches = routeData.records.filter((candidate) => candidate.url === record.canonical_url);
    if (record.canonical_source_id !== routeData.source.id) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/canonical_source_id`, `expected ${routeData.source.id}; cross-route records are forbidden`));
    }
    if (matches.length !== 1) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/canonical_url`, `URL must occur exactly once in ${routeData.source.md_path}; found ${matches.length}`));
    }
    const canonical = matches[0];
    if (canonical) {
      const comparisons = [
        ['book_id', record.book_id, canonical.book_id],
        ['title', normalizeText(record.title), normalizeText(canonical.title)],
        ['language', record.language, canonical.language],
        ['grade', routeData.source.grade, canonical.class],
        ['subject', routeData.source.subject, canonical.subject.en],
        ['subject_et', routeData.source.subject_et, canonical.subject.et],
      ];
      for (const [name, actual, expected] of comparisons) {
        if (actual !== expected) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/${name}`, `expected ${expected}, found ${actual}`));
      }
    }
    const book = booksById.get(record.book_id);
    if (!book) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/book_id`, `unknown audited book ID ${record.book_id}`));
    } else {
      if (record.programme_type !== book.programme_type) {
        diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/programme_type`, `expected ${book.programme_type} for ${book.book_id}`));
      }
      if (book.page_evidence === 'cover_only') {
        diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/book_id`, `cover-only book ${book.book_id} cannot be used as page evidence`));
      }
      if (ref.selected && book.programme_type_evidence?.status !== 'verified') {
        diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/programme_type`, `selected material requires verified programme-type evidence for ${book.book_id}`));
      }
    }
    if (!routeData.source.languages.includes(record.language)) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/language`, `language ${record.language} is not registered for ${routeData.source.id}`));
    }
    if (!provenanceMatchesProgramme(record.programme_type, record.provenance?.category)) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/provenance/category`, `provenance does not match programme type ${record.programme_type}`));
    }
    if (
      ref.selected
      && (
        record.programme_type === 'unknown'
        || (record.programme_type === 'simplified_curriculum' && !allowSimplifiedSelection)
      )
    ) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/programme_type`, 'default selected records cannot silently use simplified or unknown programme material'));
    }
    if (ref.rejected && !record.rejection_reason) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/rejection_reason`, 'rejected record requires an explicit reason'));
    }
  }
}

function validateTopicInventory(diagnostics, artifact, bookInventory) {
  const inventory = artifact.data;
  const books = new Set((bookInventory?.books ?? []).map((book) => book.book_id));
  addDuplicateDiagnostics(diagnostics, (inventory.topics ?? []).map((topic) => topic.topic_id), {
    file: artifact.file, field: '/topics', label: 'topic ID',
  });
  const allRecordIds = [];
  for (const [index, topic] of (inventory.topics ?? []).entries()) {
    const field = `/topics/${index}`;
    for (const bookId of topic.books_covering ?? []) {
      if (!books.has(bookId)) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/books_covering`, `unknown audited book ID ${bookId}`));
    }
    const records = [...(topic.selected_records ?? []), ...(topic.alternative_records ?? []), ...(topic.rejected_records ?? [])];
    allRecordIds.push(...records.map((record) => record.record_id));
    addDuplicateDiagnostics(diagnostics, records.map((record) => record.canonical_url), {
      file: artifact.file, field, label: 'topic canonical URL',
    });
    const usableIds = new Set([...(topic.selected_records ?? []), ...(topic.alternative_records ?? [])].map((record) => record.record_id));
    for (const [role, ids] of Object.entries(topic.source_recommendations ?? {})) {
      for (const id of ids) if (!usableIds.has(id)) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/source_recommendations/${role}`, `unknown selected or alternative record ID ${id}`));
    }
    const rejectedIds = new Set((topic.rejected_records ?? []).map((record) => record.record_id));
    const declaredRejected = new Set(topic.deduplication?.rejected_record_ids ?? []);
    if (
      rejectedIds.size !== declaredRejected.size
      || [...rejectedIds].some((id) => !declaredRejected.has(id))
    ) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/deduplication/rejected_record_ids`, 'must exactly match rejected_records'));
    }
  }
  addDuplicateDiagnostics(diagnostics, allRecordIds, {
    file: artifact.file, field: '/topics', label: 'topic record ID',
  });
  const allUrls = (inventory.topics ?? []).flatMap((topic) => [
    ...(topic.selected_records ?? []),
    ...(topic.alternative_records ?? []),
    ...(topic.rejected_records ?? []),
  ].map((record) => record.canonical_url));
  addDuplicateDiagnostics(diagnostics, allUrls, {
    file: artifact.file, field: '/topics', label: 'topic inventory canonical URL',
  });
}

function validateGradeAllocation(diagnostics, artifact) {
  const allocation = artifact.data.grade_allocation;
  if (!allocation) return;
  if (allocation.official_basis === 'official_school_stage') {
    if (!String(allocation.official_scope).startsWith('school_stage_') || allocation.exact_grade_official !== false) {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/grade_allocation', 'official school-stage allocation cannot be labelled as official exact-grade allocation'));
    }
  }
  if (allocation.official_basis === 'official_exact_grade') {
    if (allocation.official_scope !== 'exact_grade' || allocation.exact_grade_official !== true) {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/grade_allocation', 'official exact-grade basis requires explicit exact-grade evidence'));
    }
  }
  if (allocation.publisher_basis !== 'publisher_sequence') {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/grade_allocation/publisher_basis', 'publisher sequence must remain distinct from official allocation'));
  }
}

function validateThematicUnit(diagnostics, artifact, officialMap) {
  const unit = artifact.data;
  validateGradeAllocation(diagnostics, artifact);
  const selected = unit.selected_records ?? [];
  addDuplicateDiagnostics(diagnostics, selected.map((record) => record.record_id), {
    file: artifact.file, field: '/selected_records', label: 'selected record ID',
  });
  addDuplicateDiagnostics(diagnostics, selected.map((record) => record.canonical_url), {
    file: artifact.file, field: '/selected_records', label: 'selected canonical URL',
  });
  const allUnitRecords = [...selected, ...(unit.rejected_duplicate_records ?? [])];
  addDuplicateDiagnostics(diagnostics, allUnitRecords.map((record) => record.record_id), {
    file: artifact.file, field: '/', label: 'unit record ID',
  });
  addDuplicateDiagnostics(diagnostics, allUnitRecords.map((record) => record.canonical_url), {
    file: artifact.file, field: '/', label: 'unit canonical URL',
  });
  const selectedIds = new Set(selected.map((record) => record.record_id));
  const selectedBooks = new Set(selected.map((record) => record.book_id));
  const selectedLanguages = new Set(selected.map((record) => record.language));
  if (selectedBooks.size < 2) diagnostics.push(makeDiagnostic('error', artifact.file, '/selected_records', 'golden unit must demonstrate selection across multiple eligible books'));
  if (!selectedLanguages.has('ru') || !selectedLanguages.has('et')) diagnostics.push(makeDiagnostic('error', artifact.file, '/selected_records', 'golden unit requires both Russian and Estonian source records'));
  const roles = new Set(selected.flatMap((record) => record.instructional_roles ?? []));
  for (const requiredRole of ['core_explanation_ru', 'core_source_et', 'experiment', 'revision', 'assessment']) {
    if (!roles.has(requiredRole)) diagnostics.push(makeDiagnostic('error', artifact.file, '/selected_records', `golden unit is missing instructional role ${requiredRole}`));
  }
  const rejectedUrls = new Set((unit.rejected_duplicate_records ?? []).map((record) => record.canonical_url));
  for (const record of selected) if (rejectedUrls.has(record.canonical_url)) diagnostics.push(makeDiagnostic('error', artifact.file, '/rejected_duplicate_records', `selected URL is also rejected: ${record.canonical_url}`));

  if (!officialMap || officialMap.map_id !== unit.official_curriculum?.curriculum_map_id) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/official_curriculum/curriculum_map_id', `unknown official curriculum map ${unit.official_curriculum?.curriculum_map_id}`));
    return;
  }
  if (officialMap.grade !== unit.grade || officialMap.subject !== unit.subject || officialMap.subject_et !== unit.subject_et) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/official_curriculum/curriculum_map_id', 'official curriculum map grade and subject must match the thematic unit'));
  }
  const outcomes = new Map((officialMap.outcomes ?? []).map((outcome) => [outcome.outcome_id, outcome]));
  const mappings = unit.official_curriculum?.outcome_mappings ?? [];
  addDuplicateDiagnostics(diagnostics, mappings.map((mapping) => mapping.outcome_id), {
    file: artifact.file, field: '/official_curriculum/outcome_mappings', label: 'mapped outcome ID',
  });
  for (const [index, mapping] of mappings.entries()) {
    const outcome = outcomes.get(mapping.outcome_id);
    if (!outcome) diagnostics.push(makeDiagnostic('error', artifact.file, `/official_curriculum/outcome_mappings/${index}/outcome_id`, `unknown official outcome ${mapping.outcome_id}`));
    if (mapping.coverage_status === 'verified' && outcome?.evidence_status !== 'verified') {
      diagnostics.push(makeDiagnostic('error', artifact.file, `/official_curriculum/outcome_mappings/${index}/coverage_status`, 'verified mapping requires verified official curriculum evidence'));
    }
    for (const recordId of mapping.course_evidence_record_ids ?? []) {
      if (!selectedIds.has(recordId)) diagnostics.push(makeDiagnostic('error', artifact.file, `/official_curriculum/outcome_mappings/${index}/course_evidence_record_ids`, `unknown selected course evidence ${recordId}`));
    }
  }

  const completeness = unit.completeness ?? {};
  const buckets = {
    verified: completeness.verified_outcome_ids ?? [],
    partial: completeness.partial_outcome_ids ?? [],
    missing: completeness.missing_outcome_ids ?? [],
    ambiguous: completeness.ambiguous_outcome_ids ?? [],
  };
  const requiredIds = new Set(completeness.required_outcome_ids ?? []);
  const classified = new Map();
  for (const [status, ids] of Object.entries(buckets)) {
    for (const id of ids) {
      if (classified.has(id)) diagnostics.push(makeDiagnostic('error', artifact.file, '/completeness', `outcome ${id} is classified more than once`));
      classified.set(id, status);
    }
  }
  if (requiredIds.size !== classified.size || [...requiredIds].some((id) => !classified.has(id))) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/completeness', 'every required outcome must appear in exactly one coverage bucket'));
  }
  const mappingStatuses = new Map(mappings.map((mapping) => [mapping.outcome_id, mapping.coverage_status]));
  for (const [id, status] of classified) {
    if (mappingStatuses.get(id) !== status) diagnostics.push(makeDiagnostic('error', artifact.file, '/completeness', `outcome ${id} is ${status} but its mapping is ${mappingStatuses.get(id) ?? 'missing'}`));
  }
  const hasUnresolved = buckets.partial.length > 0 || buckets.missing.length > 0 || buckets.ambiguous.length > 0;
  if (completeness.declared_complete && (hasUnresolved || completeness.status !== 'complete' || unit.coverage_status !== 'verified')) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/completeness', 'course cannot be complete while outcomes are partial, missing, or ambiguous'));
  }
  if (unit.coverage_status === 'verified' && mappings.some((mapping) => mapping.coverage_status !== 'verified')) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/coverage_status', 'verified unit coverage requires every mapped outcome to be verified'));
  }
  for (const [section, activity] of [['practical_activity', unit.practical_activity], ['revision', unit.revision], ['assessment', unit.assessment]]) {
    for (const recordId of activity?.source_record_ids ?? []) {
      if (!selectedIds.has(recordId)) diagnostics.push(makeDiagnostic('error', artifact.file, `/${section}/source_record_ids`, `unknown selected record ID ${recordId}`));
    }
  }
}

export function validateCurriculumMapRepository(context) {
  const diagnostics = [];
  const validators = createSchemaValidators(context.schemas);
  const artifactTypes = new Map();
  addDuplicateDiagnostics(diagnostics, context.artifacts.map((artifact) => artifact.data.map_id).filter(Boolean), {
    file: 'curriculum-maps', field: '/', label: 'map ID',
  });
  for (const artifact of context.artifacts) {
    const type = artifact.data.artifact_type;
    artifactTypes.set(type, [...(artifactTypes.get(type) ?? []), artifact]);
    if (type === officialArtifactType) addSchemaDiagnostics(diagnostics, artifact, validators.curriculum);
    else if (courseArtifactTypes.has(type)) addSchemaDiagnostics(diagnostics, artifact, validators.course);
    else diagnostics.push(makeDiagnostic('error', artifact.file, '/artifact_type', `unknown artifact type ${type ?? '<missing>'}`));
  }
  for (const type of [officialArtifactType, 'book_inventory', 'topic_inventory', 'thematic_unit']) {
    const count = artifactTypes.get(type)?.length ?? 0;
    if (count === 0) diagnostics.push(makeDiagnostic('error', 'curriculum-maps', '/', `at least one ${type} artifact is required`));
  }
  const officialArtifacts = artifactTypes.get(officialArtifactType) ?? [];
  const bookArtifacts = artifactTypes.get('book_inventory') ?? [];
  const topicArtifacts = artifactTypes.get('topic_inventory') ?? [];
  const unitArtifacts = artifactTypes.get('thematic_unit') ?? [];
  for (const artifact of officialArtifacts) validateOfficialArtifact(diagnostics, artifact, context);
  const officialById = new Map(officialArtifacts.map((artifact) => [artifact.data.map_id, artifact.data]));

  const courseArtifacts = [...bookArtifacts, ...topicArtifacts, ...unitArtifacts];
  const courseSourceIds = new Set(courseArtifacts.map((artifact) => artifact.data.canonical_route?.source_id).filter(Boolean));
  const artifactsForSource = (artifacts, sourceId) => artifacts.filter((artifact) => artifact.data.canonical_route?.source_id === sourceId);
  for (const sourceId of courseSourceIds) {
    const sourceBooks = artifactsForSource(bookArtifacts, sourceId);
    const sourceTopics = artifactsForSource(topicArtifacts, sourceId);
    const sourceUnits = artifactsForSource(unitArtifacts, sourceId);
    if (sourceBooks.length !== 1) diagnostics.push(makeDiagnostic('error', 'curriculum-maps', '/', `source ${sourceId} requires exactly one book_inventory, found ${sourceBooks.length}`));
    if (sourceTopics.length !== 1) diagnostics.push(makeDiagnostic('error', 'curriculum-maps', '/', `source ${sourceId} requires exactly one topic_inventory, found ${sourceTopics.length}`));
    if (sourceUnits.length < 1) diagnostics.push(makeDiagnostic('error', 'curriculum-maps', '/', `source ${sourceId} requires at least one thematic_unit`));
  }

  const bookBySource = new Map(bookArtifacts.map((artifact) => [artifact.data.canonical_route?.source_id, artifact]));
  for (const artifact of courseArtifacts) {
    const routeData = validateCanonicalRoute(diagnostics, artifact, context);
    const sourceId = artifact.data.canonical_route?.source_id;
    const bookArtifact = bookBySource.get(sourceId);
    if (artifact.data.artifact_type === 'book_inventory') {
      validateBookInventory(diagnostics, artifact, routeData);
    } else {
      validatePageReferences(diagnostics, artifact, routeData, bookArtifact?.data);
    }
    if (artifact.data.artifact_type === 'topic_inventory') validateTopicInventory(diagnostics, artifact, bookArtifact?.data);
    if (artifact.data.artifact_type === 'thematic_unit') {
      validateThematicUnit(diagnostics, artifact, officialById.get(artifact.data.official_curriculum?.curriculum_map_id));
    }
  }

  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length;
  const pageReferences = context.artifacts.reduce((count, artifact) => count + collectPageReferences(artifact).length, 0);
  return {
    diagnostics,
    summary: {
      artifacts: context.artifacts.length,
      topics: topicArtifacts.reduce((count, artifact) => count + (artifact.data.topics?.length ?? 0), 0),
      selectedUnitRecords: unitArtifacts.reduce((count, artifact) => count + (artifact.data.selected_records?.length ?? 0), 0),
      pageReferences,
      errors,
      warnings,
    },
  };
}

export function formatCurriculumDiagnostic(diagnostic) {
  return `[${diagnostic.severity.toUpperCase()}] ${diagnostic.file} ${diagnostic.field}: ${diagnostic.reason}`;
}
