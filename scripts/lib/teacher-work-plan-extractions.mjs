import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import Ajv2020 from 'ajv/dist/2020.js';

export const EXTRACTION_SCHEMA_PATH =
  'schemas/teacher-work-plan-extraction.schema.json';
export const PROVENANCE_PATH =
  'project-files/inputs/originals/teacher-work-plans/provenance.json';

const GRADE_5_PATH = 'evaluations/teacher-work-plans/grade-5-science-extraction.json';
const GRADE_6_PATH = 'evaluations/teacher-work-plans/grade-6-science-extraction.json';

export const EXTRACTION_CONTRACTS = Object.freeze({
  'grade-5-science-teacher-work-plan-extraction': Object.freeze({
    extractionPath: GRADE_5_PATH,
    sourcePath: 'project-files/inputs/originals/teacher-work-plans/Loodusopetuse-tookava-naidis-5-klassile.pdf',
    grade: 5,
    subject: 'science',
    subjectEt: 'loodusõpetus',
    route: Object.freeze({
      source_id: 'grade-5-science',
      md_path: 'project-files/outputs/opiq_5klass_loodusopetus.md',
      mapping_status: 'deferred',
    }),
    pageCount: 25,
    lessonStart: 1,
    lessonEnd: 70,
    weeklyHours: 2,
    annualHours: 70,
    blockSpans: Object.freeze([[1, 25], [26, 43], [44, 50], [51, 60], [61, 70]]),
    blockHours: Object.freeze([26, 14, 10, 10, 10]),
    aggregateHours: Object.freeze({ minimum: 70, maximum: 70 }),
    explicitRanges: null,
    unassignedAnnualLesson: null,
  }),
  'grade-6-science-teacher-work-plan-extraction': Object.freeze({
    extractionPath: GRADE_6_PATH,
    sourcePath: 'project-files/inputs/originals/teacher-work-plans/Loodusopetuse-tookava-naidis-6-klassile.pdf',
    grade: 6,
    subject: 'science',
    subjectEt: 'loodusõpetus',
    route: Object.freeze({
      source_id: 'grade-6-science',
      md_path: 'project-files/outputs/opiq_6klass_loodusopetus.md',
      mapping_status: 'deferred',
    }),
    pageCount: 31,
    lessonStart: 1,
    lessonEnd: 105,
    weeklyHours: 3,
    annualHours: 105,
    blockSpans: Object.freeze([
      [1, 12], [13, 27], [28, 41], [42, 61],
      [62, 74], [75, 82], [83, 92], [93, 104],
    ]),
    blockHours: Object.freeze([
      12,
      15,
      14,
      Object.freeze({ minimum: 18, maximum: 19, source_text: '18-19 tundi' }),
      Object.freeze({ minimum: 13, maximum: 14, source_text: '13-14 tundi' }),
      8,
      10,
      14,
    ]),
    aggregateHours: Object.freeze({ minimum: 104, maximum: 106 }),
    explicitRanges: Object.freeze([[3, 4], [76, 77], [98, 99], [102, 103]]),
    unassignedAnnualLesson: 105,
  }),
});

export const EXTRACTION_PATHS = Object.freeze(
  Object.values(EXTRACTION_CONTRACTS)
    .map((contract) => contract.extractionPath)
    .sort(compareBytewise),
);

const SOURCE_FIELDS = Object.freeze([
  'repository_path',
  'original_filename',
  'sha256',
  'byte_size',
  'page_count',
  'displayed_title',
  'author',
  'grade',
  'subject',
  'subject_et',
  'language',
  'provenance_kind',
  'canonical',
]);

function compareBytewise(left, right) {
  return Buffer.from(String(left)).compare(Buffer.from(String(right)));
}

function uniqueSorted(values) {
  return [...new Set(values)].sort(compareBytewise);
}

function safeRepositoryPath(rootDir, repositoryPath, label) {
  if (
    typeof repositoryPath !== 'string'
    || path.isAbsolute(repositoryPath)
    || repositoryPath.includes('\\')
    || repositoryPath.split('/').includes('..')
  ) {
    throw new Error(`${label} must be a repository-relative path`);
  }
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, repositoryPath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`${label} points outside the repository`);
  }
  return resolved;
}

function pageObjectCount(pdfBytes) {
  return pdfBytes.toString('latin1').match(/\/Type\s*\/Page\b/gu)?.length ?? 0;
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function makeDiagnostic(field, reason) {
  return { field, reason };
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

function sameValues(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function addExactSequenceDiagnostic(diagnostics, field, actual, expected) {
  if (!sameValues(actual, expected)) {
    diagnostics.push(makeDiagnostic(
      field,
      `expected complete ordered coverage ${expected[0]}-${expected.at(-1)}`,
    ));
  }
}

function referencedPages(artifact) {
  return [
    ...artifact.extraction.verified_pages,
    ...artifact.thematic_blocks.flatMap((block) => block.source_pages),
    ...artifact.lesson_ranges.flatMap((range) => range.source_pages),
    ...artifact.unresolved_items.flatMap((item) => item.source_pages),
    ...artifact.completeness.source_pages_extracted,
    ...artifact.completeness.source_pages_visually_verified,
  ];
}

function expectedSequence(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function lessonCoverage(lessonRanges, contract) {
  const expected = expectedSequence(contract.lessonStart, contract.lessonEnd);
  const counts = new Map(expected.map((lesson) => [lesson, 0]));
  const outside = [];
  for (const range of lessonRanges) {
    if (range.lesson_start > range.lesson_end) continue;
    for (let lesson = range.lesson_start; lesson <= range.lesson_end; lesson += 1) {
      if (!counts.has(lesson)) outside.push(lesson);
      else counts.set(lesson, counts.get(lesson) + 1);
    }
  }
  return {
    expected,
    missing: expected.filter((lesson) => counts.get(lesson) === 0),
    overlaps: expected.filter((lesson) => counts.get(lesson) > 1),
    outside: uniqueSorted(outside),
  };
}

function allocationBounds(value) {
  if (Number.isInteger(value)) return { minimum: value, maximum: value };
  if (
    value
    && typeof value === 'object'
    && typeof value.minimum === 'number'
    && typeof value.maximum === 'number'
  ) {
    return { minimum: value.minimum, maximum: value.maximum };
  }
  return { minimum: Number.NaN, maximum: Number.NaN };
}

function aggregateHourAllocations(blocks) {
  return blocks.reduce((sum, block) => {
    const bounds = allocationBounds(block.declared_hours);
    return {
      minimum: sum.minimum + bounds.minimum,
      maximum: sum.maximum + bounds.maximum,
    };
  }, { minimum: 0, maximum: 0 });
}

function orderedLessonRanges(lessonRanges) {
  return lessonRanges.every((range, index) => {
    if (index === 0) return true;
    const previous = lessonRanges[index - 1];
    return (
      range.lesson_start > previous.lesson_start
      || (
        range.lesson_start === previous.lesson_start
        && range.lesson_end >= previous.lesson_end
      )
    );
  });
}

export function serializeTeacherWorkPlanExtraction(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function loadTeacherWorkPlanExtractionRepository({
  rootDir = process.cwd(),
  extractionPath = EXTRACTION_PATHS[0],
  schemaPath = EXTRACTION_SCHEMA_PATH,
  provenancePath = PROVENANCE_PATH,
  manifestPath = 'source-manifest.json',
} = {}) {
  const root = path.resolve(rootDir);
  const extractionFile = safeRepositoryPath(root, extractionPath, 'extraction path');
  const schemaFile = safeRepositoryPath(root, schemaPath, 'schema path');
  const provenanceFile = safeRepositoryPath(root, provenancePath, 'provenance path');
  const manifestFile = safeRepositoryPath(root, manifestPath, 'manifest path');
  const [artifactText, schemaText, provenanceText, manifestText] = await Promise.all([
    fs.readFile(extractionFile, 'utf8'),
    fs.readFile(schemaFile, 'utf8'),
    fs.readFile(provenanceFile, 'utf8'),
    fs.readFile(manifestFile, 'utf8'),
  ]);
  const artifact = JSON.parse(artifactText);
  const sourceFile = safeRepositoryPath(
    root,
    artifact.source.repository_path,
    'source repository_path',
  );
  const [sourceBytes, sourceStat] = await Promise.all([
    fs.readFile(sourceFile),
    fs.lstat(sourceFile),
  ]);
  return {
    rootDir: root,
    extractionPath,
    artifactText,
    artifact,
    schema: JSON.parse(schemaText),
    provenance: JSON.parse(provenanceText),
    manifest: JSON.parse(manifestText),
    sourceBytes,
    sourceIsRegularFile: sourceStat.isFile() && !sourceStat.isSymbolicLink(),
    sourcePdfPageCount: pageObjectCount(sourceBytes),
  };
}

export async function loadTeacherWorkPlanExtractionRepositories({
  rootDir = process.cwd(),
  ...options
} = {}) {
  const root = path.resolve(rootDir);
  const extractionDirectory = safeRepositoryPath(
    root,
    'evaluations/teacher-work-plans',
    'extraction directory',
  );
  const discoveredPaths = (await fs.readdir(extractionDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('-extraction.json'))
    .map((entry) => `evaluations/teacher-work-plans/${entry.name}`)
    .sort(compareBytewise);
  const repositories = await Promise.all(EXTRACTION_PATHS.map((extractionPath) => (
    loadTeacherWorkPlanExtractionRepository({ rootDir: root, extractionPath, ...options })
  )));
  return { repositories, discoveredPaths };
}

export function validateTeacherWorkPlanExtractionRepository(repository) {
  const diagnostics = [];
  const { artifact } = repository;
  const contract = EXTRACTION_CONTRACTS[artifact.extraction_id] ?? null;
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    validateFormats: false,
  });
  const validateSchema = ajv.compile(repository.schema);
  if (!validateSchema(artifact)) {
    for (const error of validateSchema.errors ?? []) {
      diagnostics.push(makeDiagnostic(
        error.instancePath || '/',
        schemaReason(error),
      ));
    }
  }

  if (!contract) {
    diagnostics.push(makeDiagnostic(
      '/extraction_id',
      'production extraction_id has no registered strict contract',
    ));
    return {
      diagnostics,
      summary: {
        errors: diagnostics.length,
        extraction_id: artifact.extraction_id,
        thematic_blocks: artifact.thematic_blocks?.length ?? 0,
        lesson_ranges: artifact.lesson_ranges?.length ?? 0,
        lessons_covered: 0,
        unresolved_items: artifact.unresolved_items?.length ?? 0,
        source_pages: 0,
        declared_hours: null,
      },
    };
  }

  if (repository.extractionPath !== contract.extractionPath) {
    diagnostics.push(makeDiagnostic(
      '/extraction_id',
      `registered extraction must be stored at ${contract.extractionPath}`,
    ));
  }

  const provenance = repository.provenance.sources?.find(
    (source) => source.repository_path === artifact.source.repository_path,
  );
  if (!provenance) {
    diagnostics.push(makeDiagnostic('/source', 'source is absent from provenance.json'));
  } else {
    for (const field of SOURCE_FIELDS) {
      if (!sameValues(artifact.source[field], provenance[field])) {
        diagnostics.push(makeDiagnostic(
          `/source/${field}`,
          'value differs from provenance.json',
        ));
      }
    }
  }

  if (artifact.source.repository_path !== contract.sourcePath) {
    diagnostics.push(makeDiagnostic(
      '/source/repository_path',
      `source path differs from the registered ${artifact.extraction_id} contract`,
    ));
  }
  if (
    artifact.source.grade !== contract.grade
    || artifact.source.subject !== contract.subject
    || artifact.source.subject_et !== contract.subjectEt
  ) {
    diagnostics.push(makeDiagnostic(
      '/source',
      'grade or subject differs from the registered extraction contract',
    ));
  }
  if (
    artifact.extraction.method !== 'embedded_text_plus_visual_page_verification'
    || artifact.extraction.embedded_text_used !== true
    || artifact.extraction.visual_verification !== 'all_pages_rendered_and_reviewed'
    || artifact.extraction.ocr_used !== false
  ) {
    diagnostics.push(makeDiagnostic(
      '/extraction',
      'embedded text and all-page visual verification are required; OCR must remain unused',
    ));
  }

  if (!repository.sourceIsRegularFile) {
    diagnostics.push(makeDiagnostic(
      '/source/repository_path',
      'source must be a regular non-symlink file',
    ));
  }
  if (!artifact.source.repository_path.toLowerCase().endsWith('.pdf')) {
    diagnostics.push(makeDiagnostic('/source/repository_path', 'source must be a PDF'));
  }
  const actualSha256 = sha256(repository.sourceBytes);
  if (actualSha256 !== artifact.source.sha256) {
    diagnostics.push(makeDiagnostic('/source/sha256', `actual SHA-256 is ${actualSha256}`));
  }
  if (repository.sourceBytes.byteLength !== artifact.source.byte_size) {
    diagnostics.push(makeDiagnostic(
      '/source/byte_size',
      `actual byte size is ${repository.sourceBytes.byteLength}`,
    ));
  }
  if (
    repository.sourcePdfPageCount !== artifact.source.page_count
    || artifact.source.page_count !== contract.pageCount
  ) {
    diagnostics.push(makeDiagnostic(
      '/source/page_count',
      `actual PDF page count is ${repository.sourcePdfPageCount}; contract expects ${contract.pageCount}`,
    ));
  }

  const route = repository.manifest.sources?.find(
    (source) => source.id === artifact.route_context.source_id,
  );
  if (!route) {
    diagnostics.push(makeDiagnostic(
      '/route_context/source_id',
      'route is absent from source-manifest.json',
    ));
  } else {
    if (route.grade !== artifact.source.grade || route.subject !== artifact.source.subject) {
      diagnostics.push(makeDiagnostic(
        '/route_context/source_id',
        'route grade or subject differs from the extraction source',
      ));
    }
    if (route.md_path !== artifact.route_context.md_path) {
      diagnostics.push(makeDiagnostic(
        '/route_context/md_path',
        'route md_path differs from source-manifest.json',
      ));
    }
  }
  if (!sameValues(artifact.route_context, contract.route)) {
    diagnostics.push(makeDiagnostic(
      '/route_context',
      'route context differs from the registered extraction contract',
    ));
  }

  if (
    artifact.annual_allocation.weekly_hours !== contract.weeklyHours
    || artifact.annual_allocation.declared_annual_hours !== contract.annualHours
    || artifact.annual_allocation.extracted_lesson_span.lesson_start !== contract.lessonStart
    || artifact.annual_allocation.extracted_lesson_span.lesson_end !== contract.lessonEnd
  ) {
    diagnostics.push(makeDiagnostic(
      '/annual_allocation',
      'annual allocation differs from the registered extraction contract',
    ));
  }

  const expectedPages = expectedSequence(1, contract.pageCount);
  addExactSequenceDiagnostic(
    diagnostics,
    '/extraction/verified_pages',
    artifact.extraction.verified_pages,
    expectedPages,
  );
  addExactSequenceDiagnostic(
    diagnostics,
    '/completeness/source_pages_extracted',
    artifact.completeness.source_pages_extracted,
    expectedPages,
  );
  addExactSequenceDiagnostic(
    diagnostics,
    '/completeness/source_pages_visually_verified',
    artifact.completeness.source_pages_visually_verified,
    expectedPages,
  );
  const invalidPage = referencedPages(artifact)
    .find((page) => page < 1 || page > contract.pageCount);
  if (invalidPage !== undefined) {
    diagnostics.push(makeDiagnostic(
      '/source_pages',
      `page ${invalidPage} is outside 1-${contract.pageCount}`,
    ));
  }

  const blockIds = artifact.thematic_blocks.map((block) => block.block_id);
  if (new Set(blockIds).size !== blockIds.length) {
    diagnostics.push(makeDiagnostic('/thematic_blocks', 'block_id values must be unique'));
  }
  if (artifact.thematic_blocks.length !== contract.blockSpans.length) {
    diagnostics.push(makeDiagnostic(
      '/thematic_blocks',
      `expected ${contract.blockSpans.length} thematic blocks`,
    ));
  }
  for (const [index, block] of artifact.thematic_blocks.entries()) {
    if (block.source_pages.length === 0) {
      diagnostics.push(makeDiagnostic(
        `/thematic_blocks/${index}/source_pages`,
        'page-level evidence is required',
      ));
    }
    const expectedSpan = contract.blockSpans[index];
    if (
      !expectedSpan
      || block.main_numbered_lesson_span?.lesson_start !== expectedSpan[0]
      || block.main_numbered_lesson_span?.lesson_end !== expectedSpan[1]
    ) {
      diagnostics.push(makeDiagnostic(
        `/thematic_blocks/${index}/main_numbered_lesson_span`,
        'main numbered lesson span differs from the registered source-table contract',
      ));
    }
    const bounds = allocationBounds(block.declared_hours);
    if (
      !Number.isFinite(bounds.minimum)
      || !Number.isFinite(bounds.maximum)
      || bounds.minimum > bounds.maximum
    ) {
      diagnostics.push(makeDiagnostic(
        `/thematic_blocks/${index}/declared_hours`,
        'hour allocation must have minimum less than or equal to maximum',
      ));
    }
    if (!sameValues(block.declared_hours, contract.blockHours[index])) {
      diagnostics.push(makeDiagnostic(
        `/thematic_blocks/${index}/declared_hours`,
        'hour allocation differs from the registered source heading',
      ));
    }
  }

  const declaredHours = aggregateHourAllocations(artifact.thematic_blocks);
  if (!sameValues(declaredHours, contract.aggregateHours)) {
    diagnostics.push(makeDiagnostic(
      '/thematic_blocks',
      `aggregate hour range is ${declaredHours.minimum}-${declaredHours.maximum}, expected ${contract.aggregateHours.minimum}-${contract.aggregateHours.maximum}`,
    ));
  }
  if (
    contract.annualHours < declaredHours.minimum
    || contract.annualHours > declaredHours.maximum
  ) {
    diagnostics.push(makeDiagnostic(
      '/annual_allocation/declared_annual_hours',
      `annual allocation ${contract.annualHours} is outside aggregate block-hour range`,
    ));
  }

  for (const [index, range] of artifact.lesson_ranges.entries()) {
    if (range.lesson_start > range.lesson_end) {
      diagnostics.push(makeDiagnostic(
        `/lesson_ranges/${index}`,
        'lesson_start must not exceed lesson_end',
      ));
    }
    if (range.source_pages.length === 0) {
      diagnostics.push(makeDiagnostic(
        `/lesson_ranges/${index}/source_pages`,
        'page-level evidence is required',
      ));
    }
  }
  if (!orderedLessonRanges(artifact.lesson_ranges)) {
    diagnostics.push(makeDiagnostic(
      '/lesson_ranges',
      'lesson ranges must be ordered by lesson_start and lesson_end',
    ));
  }
  const coverage = lessonCoverage(artifact.lesson_ranges, contract);
  if (coverage.missing.length > 0) {
    diagnostics.push(makeDiagnostic(
      '/lesson_ranges',
      `missing lesson numbers: ${coverage.missing.join(', ')}`,
    ));
  }
  if (coverage.overlaps.length > 0) {
    diagnostics.push(makeDiagnostic(
      '/lesson_ranges',
      `overlapping lesson numbers: ${coverage.overlaps.join(', ')}`,
    ));
  }
  if (coverage.outside.length > 0) {
    diagnostics.push(makeDiagnostic(
      '/lesson_ranges',
      `lesson numbers outside ${contract.lessonStart}-${contract.lessonEnd}: ${coverage.outside.join(', ')}`,
    ));
  }

  if (contract.explicitRanges) {
    const actualRanges = artifact.lesson_ranges
      .filter((range) => range.lesson_end > range.lesson_start)
      .map((range) => [range.lesson_start, range.lesson_end]);
    if (!sameValues(actualRanges, contract.explicitRanges)) {
      diagnostics.push(makeDiagnostic(
        '/lesson_ranges',
        'explicit multi-lesson ranges differ from the Grade 6 source table',
      ));
    }
  }

  const unassigned = artifact.lesson_ranges.filter(
    (range) => range.record_kind === 'unassigned_annual_slot',
  );
  if (contract.unassignedAnnualLesson === null) {
    if (unassigned.length > 0) {
      diagnostics.push(makeDiagnostic(
        '/lesson_ranges',
        'Grade 5 extraction cannot contain an unassigned annual slot',
      ));
    }
  } else if (
    unassigned.length !== 1
    || unassigned[0].lesson_start !== contract.unassignedAnnualLesson
    || unassigned[0].lesson_end !== contract.unassignedAnnualLesson
    || unassigned[0].extraction_confidence !== 'low'
    || !unassigned[0].unresolved_fields.includes('annual-lesson-105-unassigned')
  ) {
    diagnostics.push(makeDiagnostic(
      '/lesson_ranges',
      'Grade 6 lesson 105 must remain one low-confidence unassigned annual slot',
    ));
  }

  if (!sameValues(artifact.completeness.lesson_number_coverage, {
    lesson_start: contract.lessonStart,
    lesson_end: contract.lessonEnd,
    gaps: [],
    overlaps: [],
  })) {
    diagnostics.push(makeDiagnostic(
      '/completeness/lesson_number_coverage',
      `declared coverage must match verified ${contract.lessonStart}-${contract.lessonEnd} coverage`,
    ));
  }

  const unresolvedIds = artifact.unresolved_items.map((item) => item.item_id);
  if (new Set(unresolvedIds).size !== unresolvedIds.length) {
    diagnostics.push(makeDiagnostic(
      '/unresolved_items',
      'item_id values must be unique within an extraction',
    ));
  }
  const unresolvedIdSet = new Set(unresolvedIds);
  for (const [groupName, records] of [
    ['thematic_blocks', artifact.thematic_blocks],
    ['lesson_ranges', artifact.lesson_ranges],
  ]) {
    for (const [index, record] of records.entries()) {
      for (const itemId of record.unresolved_fields) {
        const looksLikeItemId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(itemId);
        if (looksLikeItemId && !unresolvedIdSet.has(itemId)) {
          diagnostics.push(makeDiagnostic(
            `/${groupName}/${index}/unresolved_fields`,
            `unknown unresolved item ID ${itemId}`,
          ));
        }
      }
    }
  }

  if (
    artifact.completeness.official_curriculum_complete !== false
    || artifact.completeness.canonical_opiq_mapping_complete !== false
  ) {
    diagnostics.push(makeDiagnostic(
      '/completeness',
      'official curriculum and canonical Opiq mapping completeness must remain false',
    ));
  }
  if (artifact.route_context.mapping_status !== 'deferred') {
    diagnostics.push(makeDiagnostic(
      '/route_context/mapping_status',
      'canonical Opiq mapping must remain deferred in the extraction-only phase',
    ));
  }
  if (artifact.source.canonical !== false) {
    diagnostics.push(makeDiagnostic('/source/canonical', 'teacher work plan cannot be canonical'));
  }
  if (serializeTeacherWorkPlanExtraction(artifact) !== repository.artifactText) {
    diagnostics.push(makeDiagnostic(
      '/',
      'JSON property order or formatting is not deterministic',
    ));
  }

  diagnostics.sort((left, right) => compareBytewise(
    `${left.field}\0${left.reason}`,
    `${right.field}\0${right.reason}`,
  ));
  return {
    diagnostics,
    summary: {
      errors: diagnostics.length,
      extraction_id: artifact.extraction_id,
      thematic_blocks: artifact.thematic_blocks.length,
      lesson_ranges: artifact.lesson_ranges.length,
      lessons_covered: coverage.expected.length - coverage.missing.length,
      unresolved_items: artifact.unresolved_items.length,
      source_pages: expectedPages.length,
      declared_hours: declaredHours.minimum === declaredHours.maximum
        ? declaredHours.minimum
        : declaredHours,
    },
  };
}

export function validateTeacherWorkPlanExtractionRepositories(collection) {
  const diagnostics = [];
  const { repositories, discoveredPaths } = collection;
  if (!sameValues(discoveredPaths, EXTRACTION_PATHS)) {
    diagnostics.push(makeDiagnostic(
      '/extractions',
      `discovered production extraction paths differ from registry: ${discoveredPaths.join(', ')}`,
    ));
  }
  const extractionIds = repositories.map(({ artifact }) => artifact.extraction_id);
  if (new Set(extractionIds).size !== extractionIds.length) {
    diagnostics.push(makeDiagnostic(
      '/extractions',
      'extraction_id values must be unique across production artifacts',
    ));
  }
  const actualOrder = repositories.map(({ extractionPath }) => extractionPath);
  if (!sameValues(actualOrder, [...actualOrder].sort(compareBytewise))) {
    diagnostics.push(makeDiagnostic(
      '/extractions',
      'production extraction files must be loaded in deterministic bytewise order',
    ));
  }

  const summaries = [];
  for (const repository of repositories) {
    const validation = validateTeacherWorkPlanExtractionRepository(repository);
    summaries.push(validation.summary);
    for (const diagnostic of validation.diagnostics) {
      diagnostics.push(makeDiagnostic(
        `${repository.extractionPath}${diagnostic.field === '/' ? '' : diagnostic.field}`,
        diagnostic.reason,
      ));
    }
  }
  diagnostics.sort((left, right) => compareBytewise(
    `${left.field}\0${left.reason}`,
    `${right.field}\0${right.reason}`,
  ));
  return { diagnostics, summaries };
}

export function validateTeacherWorkPlanChangedPaths(changedPaths) {
  const diagnostics = [];
  for (const repositoryPath of uniqueSorted(changedPaths)) {
    if (repositoryPath === 'source-manifest.json') {
      diagnostics.push(makeDiagnostic(repositoryPath, 'source-manifest.json must remain unchanged'));
    } else if (repositoryPath === GRADE_5_PATH) {
      diagnostics.push(makeDiagnostic(repositoryPath, 'committed Grade 5 extraction must remain byte-identical'));
    } else if (repositoryPath.startsWith('curriculum-maps/')) {
      diagnostics.push(makeDiagnostic(repositoryPath, 'curriculum maps are outside extraction scope'));
    } else if (repositoryPath.startsWith('project-files/inputs/originals/')) {
      diagnostics.push(makeDiagnostic(repositoryPath, 'committed original sources must remain unchanged'));
    } else if (repositoryPath.startsWith('project-files/outputs/')) {
      diagnostics.push(makeDiagnostic(repositoryPath, 'canonical Opiq outputs must remain unchanged'));
    } else if (
      repositoryPath.startsWith('lesson-plans/')
      || repositoryPath.startsWith('teacher-packs/')
      || repositoryPath.startsWith('annual-courses/')
    ) {
      diagnostics.push(makeDiagnostic(repositoryPath, 'production teaching content is outside extraction scope'));
    } else {
      const gradeMatch = repositoryPath.match(/(?:^|\/)grade-(\d+)(?=$|[-/])/u);
      const grade = gradeMatch ? Number.parseInt(gradeMatch[1], 10) : null;
      if (grade !== null && ![5, 6].includes(grade)) {
        diagnostics.push(makeDiagnostic(
          repositoryPath,
          'other grades are outside the registered Grade 5-6 extraction scope',
        ));
      }
    }
  }
  return diagnostics.sort((left, right) => compareBytewise(left.field, right.field));
}

function gitNameOnly(rootDir, argumentsList) {
  const result = spawnSync('git', argumentsList, { cwd: rootDir, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${argumentsList.join(' ')} failed: ${result.stderr.trim()}`);
  }
  return result.stdout.split(/\r?\n/u).filter(Boolean);
}

export function collectTeacherWorkPlanChangedPaths({
  rootDir = process.cwd(),
  baseRef = 'origin/main',
} = {}) {
  return uniqueSorted([
    ...gitNameOnly(rootDir, ['diff', '--name-only', '--no-renames', `${baseRef}...HEAD`]),
    ...gitNameOnly(rootDir, ['diff', '--name-only', '--no-renames']),
    ...gitNameOnly(rootDir, ['diff', '--cached', '--name-only', '--no-renames']),
    ...gitNameOnly(rootDir, ['ls-files', '--others', '--exclude-standard']),
  ]);
}

export function formatTeacherWorkPlanDiagnostic(diagnostic) {
  return `[ERROR] ${diagnostic.field}: ${diagnostic.reason}`;
}
