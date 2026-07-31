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
const GRADE_7_GEOGRAPHY_PATH =
  'evaluations/teacher-work-plans/grade-7-geography-extraction.json';
const GRADE_7_SCIENCE_PATH =
  'evaluations/teacher-work-plans/grade-7-science-extraction.json';
const GRADE_7_SCIENCE_AUDIT_PATH =
  'docs/audits/grade-7-science-teacher-work-plan-extraction.md';

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
    blockIds: Object.freeze([
      'jogi-ja-jarv-vesi-kui-elukeskkond',
      'vesi-kui-aine-vee-kasutamine',
      'asula-elukeskkonnana',
      'pinnavormid-ja-pinnamood',
      'soo-elukeskkonnana',
    ]),
    blockSpans: Object.freeze([[1, 25], [26, 43], [44, 50], [51, 60], [61, 70]]),
    allocationField: 'declared_hours',
    blockHours: Object.freeze([26, 14, 10, 10, 10]),
    aggregateHours: Object.freeze({ minimum: 70, maximum: 70 }),
    requireApproximateWeeks: true,
    explicitRanges: null,
    unassignedAnnualLesson: null,
    requiredUnresolvedIds: Object.freeze([]),
    lessonRequirements: null,
    lessonRangeCount: 67,
    rangeRequirements: Object.freeze([]),
    blockRequirements: Object.freeze([]),
    unnumberedRows: null,
    requireSourceTableRecordKind: false,
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
    blockIds: Object.freeze([
      'muld',
      'aed-ja-pold-elukeskkonnana',
      'mets-elukeskkonnana',
      'ohk',
      'laanemeri-elukeskkonnana',
      'elukeskkonnad-eestis',
      'eesti-loodusvarad',
      'loodus-ja-keskkonnakaitse-eestis',
    ]),
    blockSpans: Object.freeze([
      [1, 12], [13, 27], [28, 41], [42, 61],
      [62, 74], [75, 82], [83, 92], [93, 104],
    ]),
    allocationField: 'declared_hours',
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
    requireApproximateWeeks: true,
    explicitRanges: Object.freeze([[3, 4], [76, 77], [98, 99], [102, 103]]),
    unassignedAnnualLesson: 105,
    requiredUnresolvedIds: Object.freeze([]),
    lessonRequirements: null,
    lessonRangeCount: 101,
    rangeRequirements: Object.freeze([]),
    blockRequirements: Object.freeze([]),
    unnumberedRows: null,
    requireSourceTableRecordKind: false,
  }),
  'grade-7-geography-teacher-work-plan-extraction': Object.freeze({
    extractionPath: GRADE_7_GEOGRAPHY_PATH,
    sourcePath: 'project-files/inputs/originals/teacher-work-plans/Geo-tookava-7-klass-Reet-Tuisk.pdf',
    grade: 7,
    subject: 'geography',
    subjectEt: 'geograafia',
    route: Object.freeze({
      source_id: 'grade-7-geography',
      md_path: 'project-files/outputs/opiq_7klass_geograafia.md',
      mapping_status: 'deferred',
    }),
    pageCount: 17,
    lessonStart: 1,
    lessonEnd: 35,
    weeklyHours: 1,
    annualHours: 35,
    blockIds: Object.freeze(['kaardiopetus', 'geoloogia', 'pinnamood', 'rahvastik']),
    blockSpans: Object.freeze([[1, 11], [12, 20], [21, 29], [30, 35]]),
    allocationField: 'derived_hours',
    blockHours: Object.freeze([
      Object.freeze({
        minimum: 11,
        maximum: 11,
        basis: 'numbered_lesson_span',
        source_text: 'lessons 1-11',
      }),
      Object.freeze({
        minimum: 9,
        maximum: 9,
        basis: 'numbered_lesson_span',
        source_text: 'lessons 12-20',
      }),
      Object.freeze({
        minimum: 9,
        maximum: 9,
        basis: 'numbered_lesson_span',
        source_text: 'lessons 21-29',
      }),
      Object.freeze({
        minimum: 6,
        maximum: 6,
        basis: 'numbered_lesson_span',
        source_text: 'lessons 30-35',
      }),
    ]),
    aggregateHours: Object.freeze({ minimum: 35, maximum: 35 }),
    requireApproximateWeeks: false,
    explicitRanges: Object.freeze([]),
    unassignedAnnualLesson: null,
    requiredUnresolvedIds: Object.freeze([
      'lesson-6-missing-topic-cell',
      'analysis-rows-at-block-start',
      'lesson-week-header-switch',
      'lesson-35-page-continuation',
      'previous-grade-prerequisite-references',
      'pdf-author-metadata-mismatch',
      'cross-page-table-continuations',
    ]),
    lessonRequirements: Object.freeze({
      6: Object.freeze({
        topic_et: 'Orienteerumine kaardi ja kompassiga',
        source_pages: Object.freeze([4]),
        extraction_confidence: 'medium',
        unresolved_fields: Object.freeze(['lesson-6-missing-topic-cell']),
      }),
      12: Object.freeze({
        unresolved_fields: Object.freeze(['analysis-rows-at-block-start']),
      }),
      21: Object.freeze({
        unresolved_fields: Object.freeze(['analysis-rows-at-block-start']),
      }),
      30: Object.freeze({
        unresolved_fields: Object.freeze(['analysis-rows-at-block-start']),
      }),
      35: Object.freeze({
        source_pages: Object.freeze([16, 17]),
        unresolved_fields: Object.freeze([
          'cross-page-table-continuations',
          'lesson-35-page-continuation',
        ]),
      }),
    }),
    lessonRangeCount: 35,
    rangeRequirements: Object.freeze([]),
    blockRequirements: Object.freeze([]),
    unnumberedRows: null,
    requireSourceTableRecordKind: false,
  }),
  'grade-7-science-teacher-work-plan-extraction': Object.freeze({
    extractionPath: GRADE_7_SCIENCE_PATH,
    sourcePath:
      'project-files/inputs/originals/teacher-work-plans/Opetaja-tookava-Loodusopetus-7-klass.pdf',
    grade: 7,
    subject: 'science',
    subjectEt: 'loodusõpetus',
    route: Object.freeze({
      source_id: 'grade-7-science',
      md_path: 'project-files/outputs/opiq_7klass_loodusopetus.md',
      mapping_status: 'deferred',
    }),
    pageCount: 17,
    lessonStart: 1,
    lessonEnd: 70,
    weeklyHours: 2,
    annualHours: 70,
    blockIds: Object.freeze([
      'inimene-uurib-loodust',
      'ainete-ja-kehade-mitmekesisus',
      'loodusnahtused',
      'elusa-ja-eluta-looduse-seosed',
    ]),
    blockSpans: Object.freeze([[1, 19], [20, 34], [35, 52], [53, 70]]),
    allocationField: 'derived_hours',
    blockHours: Object.freeze([
      Object.freeze({
        minimum: 19,
        maximum: 19,
        basis: 'numbered_lesson_span',
        source_text: 'lessons 1-19',
      }),
      Object.freeze({
        minimum: 15,
        maximum: 15,
        basis: 'numbered_lesson_span',
        source_text: 'lessons 20-34',
      }),
      Object.freeze({
        minimum: 18,
        maximum: 18,
        basis: 'numbered_lesson_span',
        source_text: 'lessons 35-52',
      }),
      Object.freeze({
        minimum: 18,
        maximum: 18,
        basis: 'numbered_lesson_span',
        source_text: 'lessons 53-70',
      }),
    ]),
    aggregateHours: Object.freeze({ minimum: 70, maximum: 70 }),
    requireApproximateWeeks: false,
    explicitRanges: Object.freeze([
      [4, 5], [9, 10], [11, 12], [16, 17], [18, 19], [26, 27], [31, 32], [65, 70],
    ]),
    unassignedAnnualLesson: null,
    requiredUnresolvedIds: Object.freeze([
      'unnumbered-wrap-up-row',
      'lesson-14-missing-topic-cell',
      'lesson-33-missing-topic-cell',
      'third-block-heading-not-printed',
      'reserve-hours-note-vs-visible-range',
      'cross-page-table-continuations',
      'previous-grade-prerequisite-references',
      'blank-final-page',
      'pdf-author-metadata-mismatch',
      'reserve-range-not-six-distinct-topics',
    ]),
    lessonRequirements: null,
    lessonRangeCount: 58,
    rangeRequirements: Object.freeze([
      Object.freeze({
        lesson_start: 14,
        lesson_end: 14,
        topic_et: 'Ühikute teisendamise kontroll ja kordamine',
        source_pages: Object.freeze([5]),
        extraction_confidence: 'medium',
        unresolved_fields: Object.freeze(['lesson-14-missing-topic-cell']),
      }),
      Object.freeze({
        lesson_start: 18,
        lesson_end: 19,
        source_pages: Object.freeze([5, 6]),
        unresolved_fields: Object.freeze(['cross-page-table-continuations']),
      }),
      Object.freeze({
        lesson_start: 26,
        lesson_end: 27,
        source_pages: Object.freeze([8, 9]),
        unresolved_fields: Object.freeze(['cross-page-table-continuations']),
      }),
      Object.freeze({
        lesson_start: 33,
        lesson_end: 33,
        topic_et: 'Veepuhastusjaama õppekäik või kromatograafia',
        source_pages: Object.freeze([9, 10]),
        extraction_confidence: 'medium',
        unresolved_fields: Object.freeze([
          'lesson-33-missing-topic-cell',
          'cross-page-table-continuations',
        ]),
      }),
      Object.freeze({
        lesson_start: 59,
        lesson_end: 59,
        source_pages: Object.freeze([15, 16]),
        unresolved_fields: Object.freeze(['cross-page-table-continuations']),
      }),
      Object.freeze({
        lesson_start: 65,
        lesson_end: 70,
        topic_et: 'Õppekäigud, viktoriinid ja tööde lõpetamise varutunnid',
        source_pages: Object.freeze([16]),
        unresolved_fields: Object.freeze([
          'reserve-hours-note-vs-visible-range',
          'reserve-range-not-six-distinct-topics',
        ]),
      }),
    ]),
    blockRequirements: Object.freeze([
      Object.freeze({
        block_id: 'loodusnahtused',
        extraction_confidence: 'medium',
        unresolved_fields: Object.freeze(['third-block-heading-not-printed']),
      }),
    ]),
    unnumberedRows: Object.freeze([
      Object.freeze({
        row_id: 'inimene-uurib-loodust-wrap-up',
        block_id: 'inimene-uurib-loodust',
        placement: Object.freeze({ after_lesson: 19, before_lesson: 20 }),
        topic_et: 'Kordamine, kinnistamine ja hindamine',
        source_pages: Object.freeze([6]),
        unresolved_fields: Object.freeze(['unnumbered-wrap-up-row']),
      }),
    ]),
    requireSourceTableRecordKind: true,
    generalLearningOutcomes: Object.freeze({
      source_pages: Object.freeze([1]),
      values_and_attitudes: 5,
      inquiry_skills: 13,
    }),
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
    ...(Array.isArray(artifact.unnumbered_rows) ? artifact.unnumbered_rows : [])
      .flatMap((row) => row.source_pages),
    ...(artifact.general_learning_outcomes?.source_pages ?? []),
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

function aggregateHourAllocations(blocks, allocationField) {
  return blocks.reduce((sum, block) => {
    const bounds = allocationBounds(block[allocationField]);
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

function recordMeetsRequirements(record, requirements) {
  return Object.entries(requirements).every(([field, expected]) => (
    field === 'unresolved_fields'
      ? expected.every((itemId) => record?.[field]?.includes(itemId))
      : sameValues(record?.[field], expected)
  ));
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
  if (contract.generalLearningOutcomes) {
    const outcomes = artifact.general_learning_outcomes;
    if (
      !outcomes
      || !sameValues(outcomes.source_pages, contract.generalLearningOutcomes.source_pages)
      || outcomes.values_and_attitudes?.length !== contract.generalLearningOutcomes.values_and_attitudes
      || outcomes.inquiry_skills?.length !== contract.generalLearningOutcomes.inquiry_skills
    ) {
      diagnostics.push(makeDiagnostic(
        '/general_learning_outcomes',
        'course-wide page 1 learning outcomes differ from the registered source contract',
      ));
    }
  } else if ('general_learning_outcomes' in artifact) {
    diagnostics.push(makeDiagnostic(
      '/general_learning_outcomes',
      'registered extraction does not define course-wide learning outcomes',
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
  if (!sameValues(blockIds, contract.blockIds)) {
    diagnostics.push(makeDiagnostic(
      '/thematic_blocks',
      'block_id order differs from the registered source-table contract',
    ));
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
    const allocation = block[contract.allocationField];
    const oppositeField = contract.allocationField === 'declared_hours'
      ? 'derived_hours'
      : 'declared_hours';
    const bounds = allocationBounds(allocation);
    if (
      !Number.isFinite(bounds.minimum)
      || !Number.isFinite(bounds.maximum)
      || bounds.minimum > bounds.maximum
    ) {
      diagnostics.push(makeDiagnostic(
        `/thematic_blocks/${index}/${contract.allocationField}`,
        'hour allocation must have minimum less than or equal to maximum',
      ));
    }
    if (oppositeField in block) {
      diagnostics.push(makeDiagnostic(
        `/thematic_blocks/${index}/${oppositeField}`,
        `registered extraction must use ${contract.allocationField} exclusively`,
      ));
    }
    if (!sameValues(allocation, contract.blockHours[index])) {
      diagnostics.push(makeDiagnostic(
        `/thematic_blocks/${index}/${contract.allocationField}`,
        contract.allocationField === 'declared_hours'
          ? 'hour allocation differs from the registered source heading'
          : 'hour allocation differs from the registered source contract',
      ));
    }
    if (contract.allocationField === 'derived_hours' && expectedSpan) {
      const spanLength = expectedSpan[1] - expectedSpan[0] + 1;
      if (
        bounds.minimum !== spanLength
        || bounds.maximum !== spanLength
        || allocation?.basis !== 'numbered_lesson_span'
      ) {
        diagnostics.push(makeDiagnostic(
          `/thematic_blocks/${index}/derived_hours`,
          'derived allocation must equal the numbered lesson span',
        ));
      }
    }
    if (contract.requireApproximateWeeks && !('approximate_weeks' in block)) {
      diagnostics.push(makeDiagnostic(
        `/thematic_blocks/${index}/approximate_weeks`,
        'registered source contract requires approximate week evidence',
      ));
    }
    if (!contract.requireApproximateWeeks && 'approximate_weeks' in block) {
      diagnostics.push(makeDiagnostic(
        `/thematic_blocks/${index}/approximate_weeks`,
        'approximate weeks cannot be inferred when the source does not state them',
      ));
    }
  }
  for (const requirements of contract.blockRequirements) {
    const block = artifact.thematic_blocks.find(
      (candidate) => candidate.block_id === requirements.block_id,
    );
    if (!block || !recordMeetsRequirements(block, requirements)) {
      diagnostics.push(makeDiagnostic(
        '/thematic_blocks',
        `block ${requirements.block_id} differs from required source evidence`,
      ));
    }
  }

  const allocatedHours = aggregateHourAllocations(
    artifact.thematic_blocks,
    contract.allocationField,
  );
  if (!sameValues(allocatedHours, contract.aggregateHours)) {
    diagnostics.push(makeDiagnostic(
      '/thematic_blocks',
      `aggregate hour range is ${allocatedHours.minimum}-${allocatedHours.maximum}, expected ${contract.aggregateHours.minimum}-${contract.aggregateHours.maximum}`,
    ));
  }
  if (
    contract.annualHours < allocatedHours.minimum
    || contract.annualHours > allocatedHours.maximum
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
  if (artifact.lesson_ranges.length !== contract.lessonRangeCount) {
    diagnostics.push(makeDiagnostic(
      '/lesson_ranges',
      `expected ${contract.lessonRangeCount} source-table lesson-range records`,
    ));
  }
  if (
    contract.requireSourceTableRecordKind
    && artifact.lesson_ranges.some((range) => range.record_kind !== 'source_table_row')
  ) {
    diagnostics.push(makeDiagnostic(
      '/lesson_ranges',
      'every registered Grade 7 science lesson range must be a source_table_row',
    ));
  }
  if (contract.lessonRequirements) {
    for (const [lessonText, requirements] of Object.entries(contract.lessonRequirements)) {
      const lesson = Number.parseInt(lessonText, 10);
      const range = artifact.lesson_ranges.find(
        (candidate) => candidate.lesson_start === lesson && candidate.lesson_end === lesson,
      );
      if (!range) {
        diagnostics.push(makeDiagnostic(
          '/lesson_ranges',
          `registered source row for lesson ${lesson} is missing`,
        ));
        continue;
      }
      if (!recordMeetsRequirements(range, requirements)) {
        diagnostics.push(makeDiagnostic(
          `/lesson_ranges/${lesson - contract.lessonStart}`,
          `lesson ${lesson} differs from required source evidence`,
        ));
      }
    }
  }
  for (const requirements of contract.rangeRequirements) {
    const range = artifact.lesson_ranges.find((candidate) => (
      candidate.lesson_start === requirements.lesson_start
      && candidate.lesson_end === requirements.lesson_end
    ));
    if (!range || !recordMeetsRequirements(range, requirements)) {
      diagnostics.push(makeDiagnostic(
        '/lesson_ranges',
        `source range ${requirements.lesson_start}-${requirements.lesson_end} differs from required evidence`,
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
        'explicit multi-lesson ranges differ from the registered source table',
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
        'registered extraction cannot contain an unassigned annual slot',
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

  const unnumberedRows = Array.isArray(artifact.unnumbered_rows)
    ? artifact.unnumbered_rows
    : [];
  const unnumberedRowIds = unnumberedRows.map((row) => row.row_id);
  if (new Set(unnumberedRowIds).size !== unnumberedRowIds.length) {
    diagnostics.push(makeDiagnostic(
      '/unnumbered_rows',
      'row_id values must be unique within an extraction',
    ));
  }
  for (const [index, row] of unnumberedRows.entries()) {
    if (row.source_pages.length === 0) {
      diagnostics.push(makeDiagnostic(
        `/unnumbered_rows/${index}/source_pages`,
        'page-level evidence is required',
      ));
    }
    if (!blockIds.includes(row.block_id)) {
      diagnostics.push(makeDiagnostic(
        `/unnumbered_rows/${index}/block_id`,
        'unnumbered row must reference a thematic block in the same extraction',
      ));
    }
  }
  if (contract.unnumberedRows === null) {
    if (unnumberedRows.length > 0) {
      diagnostics.push(makeDiagnostic(
        '/unnumbered_rows',
        'registered extraction does not contain unnumbered source rows',
      ));
    }
  } else {
    if (unnumberedRows.length !== contract.unnumberedRows.length) {
      diagnostics.push(makeDiagnostic(
        '/unnumbered_rows',
        `expected ${contract.unnumberedRows.length} registered unnumbered source row`,
      ));
    }
    for (const requirements of contract.unnumberedRows) {
      const row = unnumberedRows.find((candidate) => candidate.row_id === requirements.row_id);
      if (!row || !recordMeetsRequirements(row, requirements)) {
        diagnostics.push(makeDiagnostic(
          '/unnumbered_rows',
          `unnumbered row ${requirements.row_id} differs from required source evidence`,
        ));
      }
    }
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
  for (const requiredId of contract.requiredUnresolvedIds) {
    if (!unresolvedIds.includes(requiredId)) {
      diagnostics.push(makeDiagnostic(
        '/unresolved_items',
        `required source ambiguity ${requiredId} is missing`,
      ));
    }
  }
  const unresolvedIdSet = new Set(unresolvedIds);
  for (const [groupName, records] of [
    ['thematic_blocks', artifact.thematic_blocks],
    ['lesson_ranges', artifact.lesson_ranges],
    ['unnumbered_rows', unnumberedRows],
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
      [contract.allocationField]: allocatedHours.minimum === allocatedHours.maximum
        ? allocatedHours.minimum
        : allocatedHours,
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
    } else if (
      repositoryPath === GRADE_5_PATH
      || repositoryPath === GRADE_6_PATH
      || repositoryPath === GRADE_7_GEOGRAPHY_PATH
    ) {
      diagnostics.push(makeDiagnostic(
        repositoryPath,
        'previously committed extractions must remain byte-identical',
      ));
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
      const registeredGrade7Path = repositoryPath === GRADE_7_SCIENCE_PATH
        || repositoryPath === GRADE_7_SCIENCE_AUDIT_PATH;
      if (grade === 7 && !registeredGrade7Path) {
        diagnostics.push(makeDiagnostic(
          repositoryPath,
          'only the registered Grade 7 science extraction and audit are in scope',
        ));
      } else if (grade !== null && ![5, 6, 7].includes(grade)) {
        diagnostics.push(makeDiagnostic(
          repositoryPath,
          'other grades are outside the registered Grade 5-7 extraction scope',
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
