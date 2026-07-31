import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import Ajv2020 from 'ajv/dist/2020.js';

export const EXTRACTION_PATH =
  'evaluations/teacher-work-plans/grade-5-science-extraction.json';
export const EXTRACTION_SCHEMA_PATH =
  'schemas/teacher-work-plan-extraction.schema.json';
export const PROVENANCE_PATH =
  'project-files/inputs/originals/teacher-work-plans/provenance.json';
export const EXPECTED_ROUTE = Object.freeze({
  source_id: 'grade-5-science',
  md_path: 'project-files/outputs/opiq_5klass_loodusopetus.md',
  mapping_status: 'deferred',
});

export const EXPECTED_SOURCE_PATH =
  'project-files/inputs/originals/teacher-work-plans/Loodusopetuse-tookava-naidis-5-klassile.pdf';

const EXPECTED_PAGES = Object.freeze(
  Array.from({ length: 25 }, (_, index) => index + 1),
);
const EXPECTED_LESSONS = Object.freeze(
  Array.from({ length: 70 }, (_, index) => index + 1),
);
const EXPECTED_BLOCK_SPANS = Object.freeze([
  [1, 25],
  [26, 43],
  [44, 50],
  [51, 60],
  [61, 70],
]);
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

function lessonCoverage(lessonRanges) {
  const counts = new Map(EXPECTED_LESSONS.map((lesson) => [lesson, 0]));
  const outside = [];
  for (const range of lessonRanges) {
    if (range.lesson_start > range.lesson_end) continue;
    for (let lesson = range.lesson_start; lesson <= range.lesson_end; lesson += 1) {
      if (!counts.has(lesson)) outside.push(lesson);
      else counts.set(lesson, counts.get(lesson) + 1);
    }
  }
  return {
    missing: EXPECTED_LESSONS.filter((lesson) => counts.get(lesson) === 0),
    overlaps: EXPECTED_LESSONS.filter((lesson) => counts.get(lesson) > 1),
    outside: uniqueSorted(outside),
  };
}

export function serializeTeacherWorkPlanExtraction(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function loadTeacherWorkPlanExtractionRepository({
  rootDir = process.cwd(),
  extractionPath = EXTRACTION_PATH,
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

export function validateTeacherWorkPlanExtractionRepository(repository) {
  const diagnostics = [];
  const { artifact } = repository;
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

  if (artifact.extraction_id !== 'grade-5-science-teacher-work-plan-extraction') {
    diagnostics.push(makeDiagnostic(
      '/extraction_id',
      'only the Grade 5 science extraction is in scope for this phase',
    ));
  }
  if (artifact.source.repository_path !== EXPECTED_SOURCE_PATH) {
    diagnostics.push(makeDiagnostic(
      '/source/repository_path',
      'only the committed Grade 5 science teacher work-plan PDF is in scope',
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
  if (repository.sourcePdfPageCount !== artifact.source.page_count) {
    diagnostics.push(makeDiagnostic(
      '/source/page_count',
      `actual PDF page count is ${repository.sourcePdfPageCount}`,
    ));
  }

  const route = repository.manifest.sources?.find(
    (source) => source.id === artifact.route_context.source_id,
  );
  if (!route) {
    diagnostics.push(makeDiagnostic('/route_context/source_id', 'route is absent from source-manifest.json'));
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
  if (!sameValues(artifact.route_context, EXPECTED_ROUTE)) {
    diagnostics.push(makeDiagnostic(
      '/route_context',
      'extraction must retain the deferred grade-5-science route context',
    ));
  }
  if (
    artifact.annual_allocation.weekly_hours !== 2
    || artifact.annual_allocation.declared_annual_hours !== 70
    || artifact.annual_allocation.extracted_lesson_span.lesson_start !== 1
    || artifact.annual_allocation.extracted_lesson_span.lesson_end !== 70
  ) {
    diagnostics.push(makeDiagnostic(
      '/annual_allocation',
      'Grade 5 extraction must retain the source allocation of 2 weekly and 70 annual hours',
    ));
  }

  addExactSequenceDiagnostic(
    diagnostics,
    '/extraction/verified_pages',
    artifact.extraction.verified_pages,
    EXPECTED_PAGES,
  );
  addExactSequenceDiagnostic(
    diagnostics,
    '/completeness/source_pages_extracted',
    artifact.completeness.source_pages_extracted,
    EXPECTED_PAGES,
  );
  addExactSequenceDiagnostic(
    diagnostics,
    '/completeness/source_pages_visually_verified',
    artifact.completeness.source_pages_visually_verified,
    EXPECTED_PAGES,
  );
  const invalidPage = referencedPages(artifact).find((page) => page < 1 || page > 25);
  if (invalidPage !== undefined) {
    diagnostics.push(makeDiagnostic('/source_pages', `page ${invalidPage} is outside 1-25`));
  }

  const blockIds = artifact.thematic_blocks.map((block) => block.block_id);
  if (new Set(blockIds).size !== blockIds.length) {
    diagnostics.push(makeDiagnostic('/thematic_blocks', 'block_id values must be unique'));
  }
  for (const [index, block] of artifact.thematic_blocks.entries()) {
    if (block.source_pages.length === 0) {
      diagnostics.push(makeDiagnostic(
        `/thematic_blocks/${index}/source_pages`,
        'page-level evidence is required',
      ));
    }
    const expectedSpan = EXPECTED_BLOCK_SPANS[index];
    if (
      !expectedSpan
      || block.main_numbered_lesson_span?.lesson_start !== expectedSpan[0]
      || block.main_numbered_lesson_span?.lesson_end !== expectedSpan[1]
    ) {
      diagnostics.push(makeDiagnostic(
        `/thematic_blocks/${index}/main_numbered_lesson_span`,
        'main numbered lesson span differs from the source table',
      ));
    }
  }
  const declaredHours = artifact.thematic_blocks.reduce(
    (sum, block) => sum + block.declared_hours,
    0,
  );
  if (declaredHours !== 70) {
    diagnostics.push(makeDiagnostic(
      '/thematic_blocks',
      `declared_hours sum is ${declaredHours}, expected 70`,
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
  const coverage = lessonCoverage(artifact.lesson_ranges);
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
      `lesson numbers outside 1-70: ${coverage.outside.join(', ')}`,
    ));
  }
  if (!sameValues(artifact.completeness.lesson_number_coverage, {
    lesson_start: 1,
    lesson_end: 70,
    gaps: [],
    overlaps: [],
  })) {
    diagnostics.push(makeDiagnostic(
      '/completeness/lesson_number_coverage',
      'declared coverage must match the verified complete 1-70 lesson sequence',
    ));
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
      thematic_blocks: artifact.thematic_blocks.length,
      lesson_ranges: artifact.lesson_ranges.length,
      lessons_covered: EXPECTED_LESSONS.length - coverage.missing.length,
      unresolved_items: artifact.unresolved_items.length,
      source_pages: EXPECTED_PAGES.length,
      declared_hours: declaredHours,
    },
  };
}

export function validateTeacherWorkPlanChangedPaths(changedPaths) {
  const diagnostics = [];
  for (const repositoryPath of uniqueSorted(changedPaths)) {
    if (repositoryPath === 'source-manifest.json') {
      diagnostics.push(makeDiagnostic(repositoryPath, 'source-manifest.json must remain unchanged'));
    } else if (repositoryPath.startsWith('curriculum-maps/grade-5-science/')) {
      diagnostics.push(makeDiagnostic(repositoryPath, 'Grade 5 curriculum maps must remain unchanged'));
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
    } else if (/grade-(?:[1-46-9]|[1-9][0-9])(?:-|\/)/u.test(repositoryPath)) {
      diagnostics.push(makeDiagnostic(repositoryPath, 'other grades are outside Grade 5 extraction scope'));
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
