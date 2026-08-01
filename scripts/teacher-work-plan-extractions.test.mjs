import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  EXTRACTION_PATHS,
  collectTeacherWorkPlanChangedPaths,
  loadTeacherWorkPlanExtractionRepositories,
  requiresTeacherWorkPlanScopeValidation,
  serializeTeacherWorkPlanExtraction,
  validateTeacherWorkPlanChangedPaths,
  validateTeacherWorkPlanExtractionRepositories,
  validateTeacherWorkPlanExtractionRepository,
} from './lib/teacher-work-plan-extractions.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselineCollection = await loadTeacherWorkPlanExtractionRepositories({
  rootDir: repositoryRoot,
});
const grade5Baseline = baselineCollection.repositories.find(
  ({ artifact }) => artifact.source.grade === 5,
);
const grade6Baseline = baselineCollection.repositories.find(
  ({ artifact }) => artifact.source.grade === 6,
);
const grade7GeographyBaseline = baselineCollection.repositories.find(
  ({ artifact }) => artifact.source.grade === 7 && artifact.source.subject === 'geography',
);
const grade7ScienceBaseline = baselineCollection.repositories.find(
  ({ artifact }) => artifact.source.grade === 7 && artifact.source.subject === 'science',
);

function cloneRepository(repository) {
  return {
    ...repository,
    artifact: structuredClone(repository.artifact),
    schema: structuredClone(repository.schema),
    provenance: structuredClone(repository.provenance),
    manifest: structuredClone(repository.manifest),
    sourceBytes: Buffer.from(repository.sourceBytes),
  };
}

function validateMutation(baseline, mutate) {
  const repository = cloneRepository(baseline);
  mutate(repository);
  repository.artifactText = serializeTeacherWorkPlanExtraction(repository.artifact);
  return validateTeacherWorkPlanExtractionRepository(repository);
}

function renderDiagnostics(result) {
  return result.diagnostics.map(({ field, reason }) => `${field}: ${reason}`).join('\n');
}

function assertInvalid(baseline, mutate, pattern) {
  const result = validateMutation(baseline, mutate);
  assert.match(renderDiagnostics(result), pattern);
}

test('production collection discovers four registered extractions deterministically', () => {
  assert.deepEqual(baselineCollection.discoveredPaths, EXTRACTION_PATHS);
  assert.deepEqual(
    baselineCollection.repositories.map(({ extractionPath }) => extractionPath),
    EXTRACTION_PATHS,
  );
  const first = validateTeacherWorkPlanExtractionRepositories(baselineCollection);
  const second = validateTeacherWorkPlanExtractionRepositories(baselineCollection);
  assert.deepEqual(first, second);
  assert.deepEqual(first.diagnostics, []);
});

test('Grade 5 extraction changes only mapping_status from deferred to partial', async () => {
  const result = validateTeacherWorkPlanExtractionRepository(grade5Baseline);
  assert.deepEqual(result, {
    diagnostics: [],
    summary: {
      errors: 0,
      extraction_id: 'grade-5-science-teacher-work-plan-extraction',
      thematic_blocks: 5,
      lesson_ranges: 67,
      lessons_covered: 70,
      unresolved_items: 6,
      source_pages: 25,
      declared_hours: 70,
    },
  });
  assert.equal(grade5Baseline.artifact.route_context.mapping_status, 'partial');
  assert.equal(grade5Baseline.artifact.completeness.canonical_opiq_mapping_complete, false);
  const fromMain = spawnSync(
    'git',
    ['show', 'f48810bd913269b71961f73befff6a55dbdf89a5:evaluations/teacher-work-plans/grade-5-science-extraction.json'],
    { cwd: repositoryRoot, encoding: null },
  );
  assert.equal(fromMain.status, 0, String(fromMain.stderr));
  assert.equal(
    crypto.createHash('sha256').update(fromMain.stdout).digest('hex'),
    '32d78d9320ed911836c4d51707f651ff6416282273ad2d301e3f19718422131d',
  );
  const fromMainArtifact = JSON.parse(fromMain.stdout.toString('utf8'));
  const currentWithDeferredStatus = structuredClone(grade5Baseline.artifact);
  currentWithDeferredStatus.route_context.mapping_status = 'deferred';
  assert.deepEqual(currentWithDeferredStatus, fromMainArtifact);
});

test('Grade 6 extraction summary matches the visually verified source', () => {
  const result = validateTeacherWorkPlanExtractionRepository(grade6Baseline);
  assert.deepEqual(result, {
    diagnostics: [],
    summary: {
      errors: 0,
      extraction_id: 'grade-6-science-teacher-work-plan-extraction',
      thematic_blocks: 8,
      lesson_ranges: 101,
      lessons_covered: 105,
      unresolved_items: 12,
      source_pages: 31,
      declared_hours: { minimum: 104, maximum: 106 },
    },
  });
});

test('Grade 6 extraction changes only mapping_status from deferred to partial', () => {
  assert.equal(grade6Baseline.artifact.route_context.mapping_status, 'partial');
  assert.equal(grade6Baseline.artifact.completeness.canonical_opiq_mapping_complete, false);
  const fromMain = spawnSync(
    'git',
    ['show', 'origin/main:evaluations/teacher-work-plans/grade-6-science-extraction.json'],
    { cwd: repositoryRoot, encoding: null },
  );
  assert.equal(fromMain.status, 0, String(fromMain.stderr));
  assert.equal(
    crypto.createHash('sha256').update(fromMain.stdout).digest('hex'),
    '71cd69b85f20a50b0e847bb2bde9c2b8fd0c4744831d77991bb33bcbf663c033',
  );
  const fromMainArtifact = JSON.parse(fromMain.stdout.toString('utf8'));
  const currentWithDeferredStatus = structuredClone(grade6Baseline.artifact);
  currentWithDeferredStatus.route_context.mapping_status = 'deferred';
  assert.deepEqual(currentWithDeferredStatus, fromMainArtifact);
});

test('Grade 7 geography extraction matches the visually verified source', () => {
  const result = validateTeacherWorkPlanExtractionRepository(grade7GeographyBaseline);
  assert.deepEqual(result, {
    diagnostics: [],
    summary: {
      errors: 0,
      extraction_id: 'grade-7-geography-teacher-work-plan-extraction',
      thematic_blocks: 4,
      lesson_ranges: 35,
      lessons_covered: 35,
      unresolved_items: 7,
      source_pages: 17,
      derived_hours: 35,
    },
  });
});

test('Grade 7 geography extraction remains byte-identical to origin/main', () => {
  const expectedSha = 'e8260b9ad4f5810e60638efb8a4f0cfa26b3fb36e847fbf0555e6547210546f4';
  assert.equal(
    crypto.createHash('sha256').update(grade7GeographyBaseline.artifactText).digest('hex'),
    expectedSha,
  );
  const fromMain = spawnSync(
    'git',
    ['show', 'origin/main:evaluations/teacher-work-plans/grade-7-geography-extraction.json'],
    { cwd: repositoryRoot, encoding: null },
  );
  assert.equal(fromMain.status, 0, String(fromMain.stderr));
  assert.equal(crypto.createHash('sha256').update(fromMain.stdout).digest('hex'), expectedSha);
});

test('Grade 7 science extraction matches the visually verified source', () => {
  const result = validateTeacherWorkPlanExtractionRepository(grade7ScienceBaseline);
  assert.deepEqual(result, {
    diagnostics: [],
    summary: {
      errors: 0,
      extraction_id: 'grade-7-science-teacher-work-plan-extraction',
      thematic_blocks: 4,
      lesson_ranges: 58,
      lessons_covered: 70,
      unresolved_items: 10,
      source_pages: 17,
      derived_hours: 70,
    },
  });
});

test('all artifact serializations are deterministic', () => {
  for (const repository of baselineCollection.repositories) {
    assert.equal(
      serializeTeacherWorkPlanExtraction(repository.artifact),
      repository.artifactText,
    );
  }
});

test('all source PDFs are unchanged regular files with verified provenance', () => {
  assert.equal(grade5Baseline.sourceIsRegularFile, true);
  assert.equal(grade5Baseline.sourcePdfPageCount, 25);
  assert.equal(grade5Baseline.sourceBytes.byteLength, 506197);
  assert.equal(
    grade5Baseline.artifact.source.sha256,
    'fd7593800bbc0bada390e98f92f7c45dcf21c0e09a780d407f45fb7e921e9c90',
  );
  assert.equal(grade6Baseline.sourceIsRegularFile, true);
  assert.equal(grade6Baseline.sourcePdfPageCount, 31);
  assert.equal(grade6Baseline.sourceBytes.byteLength, 493983);
  assert.equal(
    grade6Baseline.artifact.source.sha256,
    '2b63ada1c2821e63a8aadda0bf93246499c2f8430cd305592a82a709a0160762',
  );
  assert.equal(grade7GeographyBaseline.sourceIsRegularFile, true);
  assert.equal(grade7GeographyBaseline.sourcePdfPageCount, 17);
  assert.equal(grade7GeographyBaseline.sourceBytes.byteLength, 366595);
  assert.equal(
    grade7GeographyBaseline.artifact.source.sha256,
    'd25874fcf0c211d1b1f1e0a22d2beb50cb4046eb05eaec31bfb1068bbbcf82aa',
  );
  assert.equal(grade7ScienceBaseline.sourceIsRegularFile, true);
  assert.equal(grade7ScienceBaseline.sourcePdfPageCount, 17);
  assert.equal(grade7ScienceBaseline.sourceBytes.byteLength, 325726);
  assert.equal(
    grade7ScienceBaseline.artifact.source.sha256,
    'fb883aaf6429af4b543def1eb18deca3909ec541b4eaa5eccc7efb880368f35f',
  );
});

test('Grade 7 geography preserves pages, single lessons and derived allocations', () => {
  const artifact = grade7GeographyBaseline.artifact;
  assert.deepEqual(
    artifact.extraction.verified_pages,
    Array.from({ length: 17 }, (_, index) => index + 1),
  );
  assert.equal(artifact.lesson_ranges.length, 35);
  assert.equal(
    artifact.lesson_ranges.every((range) => range.lesson_start === range.lesson_end),
    true,
  );
  assert.deepEqual(
    artifact.thematic_blocks.map((block) => block.derived_hours),
    [
      { minimum: 11, maximum: 11, basis: 'numbered_lesson_span', source_text: 'lessons 1-11' },
      { minimum: 9, maximum: 9, basis: 'numbered_lesson_span', source_text: 'lessons 12-20' },
      { minimum: 9, maximum: 9, basis: 'numbered_lesson_span', source_text: 'lessons 21-29' },
      { minimum: 6, maximum: 6, basis: 'numbered_lesson_span', source_text: 'lessons 30-35' },
    ],
  );
  assert.equal(
    artifact.thematic_blocks.every(
      (block) => !Object.hasOwn(block, 'declared_hours') && !Object.hasOwn(block, 'approximate_weeks'),
    ),
    true,
  );
});

test('Grade 7 geography retains required source ambiguities', () => {
  const artifact = grade7GeographyBaseline.artifact;
  const lesson6 = artifact.lesson_ranges[5];
  assert.equal(lesson6.topic_et, 'Orienteerumine kaardi ja kompassiga');
  assert.equal(lesson6.extraction_confidence, 'medium');
  assert.ok(lesson6.unresolved_fields.includes('lesson-6-missing-topic-cell'));
  for (const lessonNumber of [12, 21, 30]) {
    assert.ok(
      artifact.lesson_ranges[lessonNumber - 1].unresolved_fields
        .includes('analysis-rows-at-block-start'),
    );
  }
  assert.deepEqual(artifact.lesson_ranges[34].source_pages, [16, 17]);
  assert.equal(artifact.lesson_ranges.some((range) => range.lesson_start === 36), false);
  assert.ok(
    artifact.unresolved_items.some(({ item_id }) => item_id === 'lesson-week-header-switch'),
  );
});

test('Grade 7 science preserves page coverage, ranges and derived allocations', () => {
  const artifact = grade7ScienceBaseline.artifact;
  assert.deepEqual(
    artifact.extraction.verified_pages,
    Array.from({ length: 17 }, (_, index) => index + 1),
  );
  assert.equal(artifact.lesson_ranges.length, 58);
  assert.deepEqual(
    artifact.lesson_ranges
      .filter((range) => range.lesson_end > range.lesson_start)
      .map((range) => [range.lesson_start, range.lesson_end]),
    [[4, 5], [9, 10], [11, 12], [16, 17], [18, 19], [26, 27], [31, 32], [65, 70]],
  );
  assert.equal(
    artifact.lesson_ranges.every((range) => range.record_kind === 'source_table_row'),
    true,
  );
  assert.deepEqual(
    artifact.thematic_blocks.map((block) => block.derived_hours),
    [
      { minimum: 19, maximum: 19, basis: 'numbered_lesson_span', source_text: 'lessons 1-19' },
      { minimum: 15, maximum: 15, basis: 'numbered_lesson_span', source_text: 'lessons 20-34' },
      { minimum: 18, maximum: 18, basis: 'numbered_lesson_span', source_text: 'lessons 35-52' },
      { minimum: 18, maximum: 18, basis: 'numbered_lesson_span', source_text: 'lessons 53-70' },
    ],
  );
  assert.equal(
    artifact.thematic_blocks.every(
      (block) => !Object.hasOwn(block, 'declared_hours') && !Object.hasOwn(block, 'approximate_weeks'),
    ),
    true,
  );
  assert.deepEqual(
    artifact.completeness.lesson_number_coverage,
    { lesson_start: 1, lesson_end: 70, gaps: [], overlaps: [] },
  );
  assert.deepEqual(artifact.general_learning_outcomes.source_pages, [1]);
  assert.equal(artifact.general_learning_outcomes.values_and_attitudes.length, 5);
  assert.equal(artifact.general_learning_outcomes.inquiry_skills.length, 13);
});

test('Grade 7 science keeps the unnumbered wrap-up row outside numbered coverage', () => {
  const artifact = grade7ScienceBaseline.artifact;
  assert.deepEqual(artifact.unnumbered_rows, [
    {
      row_id: 'inimene-uurib-loodust-wrap-up',
      block_id: 'inimene-uurib-loodust',
      placement: { after_lesson: 19, before_lesson: 20 },
      topic_et: 'Kordamine, kinnistamine ja hindamine',
      methods_and_practical_work: ['Õpilased esitavad tööraamatu või tehtud tööde mapi.'],
      assessment: ['Tööraamatu või tehtud tööde mapi esitamine.'],
      source_pages: [6],
      extraction_confidence: 'high',
      unresolved_fields: ['unnumbered-wrap-up-row'],
    },
  ]);
  assert.equal(artifact.lesson_ranges.some((range) => range.lesson_start === 71), false);
});

test('Grade 7 science retains source ambiguities and page continuations', () => {
  const artifact = grade7ScienceBaseline.artifact;
  const findRange = (start, end = start) => artifact.lesson_ranges.find(
    (range) => range.lesson_start === start && range.lesson_end === end,
  );
  assert.deepEqual(findRange(14).source_pages, [5]);
  assert.equal(findRange(14).extraction_confidence, 'medium');
  assert.ok(findRange(14).unresolved_fields.includes('lesson-14-missing-topic-cell'));
  assert.deepEqual(findRange(33).source_pages, [9, 10]);
  assert.equal(findRange(33).extraction_confidence, 'medium');
  assert.ok(findRange(33).unresolved_fields.includes('lesson-33-missing-topic-cell'));
  assert.deepEqual(findRange(18, 19).source_pages, [5, 6]);
  assert.deepEqual(findRange(26, 27).source_pages, [8, 9]);
  assert.deepEqual(findRange(59).source_pages, [15, 16]);
  assert.equal(findRange(65, 70).topic_et, 'Õppekäigud, viktoriinid ja tööde lõpetamise varutunnid');
  const thirdBlock = artifact.thematic_blocks[2];
  assert.equal(thirdBlock.title_et, 'LOODUSNÄHTUSED');
  assert.equal(thirdBlock.extraction_confidence, 'medium');
  assert.ok(thirdBlock.unresolved_fields.includes('third-block-heading-not-printed'));
  for (const itemId of [
    'blank-final-page',
    'pdf-author-metadata-mismatch',
    'reserve-hours-note-vs-visible-range',
    'reserve-range-not-six-distinct-topics',
  ]) {
    assert.ok(artifact.unresolved_items.some((item) => item.item_id === itemId));
  }
});

test('Grade 6 covers all pages and lessons with source-preserved ranges', () => {
  assert.deepEqual(
    grade6Baseline.artifact.extraction.verified_pages,
    Array.from({ length: 31 }, (_, index) => index + 1),
  );
  assert.deepEqual(
    grade6Baseline.artifact.lesson_ranges
      .filter((range) => range.lesson_end > range.lesson_start)
      .map((range) => [range.lesson_start, range.lesson_end]),
    [[3, 4], [76, 77], [98, 99], [102, 103]],
  );
  assert.deepEqual(
    grade6Baseline.artifact.completeness.lesson_number_coverage,
    { lesson_start: 1, lesson_end: 105, gaps: [], overlaps: [] },
  );
});

test('Grade 6 flexible hours remain exact ranges around annual allocation 105', () => {
  const hours = grade6Baseline.artifact.thematic_blocks.map(
    ({ declared_hours }) => declared_hours,
  );
  assert.deepEqual(hours, [
    12,
    15,
    14,
    { minimum: 18, maximum: 19, source_text: '18-19 tundi' },
    { minimum: 13, maximum: 14, source_text: '13-14 tundi' },
    8,
    10,
    14,
  ]);
  const minimum = hours.reduce(
    (sum, value) => sum + (typeof value === 'number' ? value : value.minimum),
    0,
  );
  const maximum = hours.reduce(
    (sum, value) => sum + (typeof value === 'number' ? value : value.maximum),
    0,
  );
  assert.deepEqual({ minimum, maximum }, { minimum: 104, maximum: 106 });
  assert.ok(minimum <= 105 && 105 <= maximum);
});

test('Grade 6 lesson 105 is explicit, unresolved, and not assigned to a block', () => {
  const record = grade6Baseline.artifact.lesson_ranges.at(-1);
  assert.deepEqual(
    {
      lesson_start: record.lesson_start,
      lesson_end: record.lesson_end,
      record_kind: record.record_kind,
      extraction_confidence: record.extraction_confidence,
      unresolved_fields: record.unresolved_fields,
    },
    {
      lesson_start: 105,
      lesson_end: 105,
      record_kind: 'unassigned_annual_slot',
      extraction_confidence: 'low',
      unresolved_fields: ['annual-lesson-105-unassigned'],
    },
  );
  assert.equal(
    grade6Baseline.artifact.thematic_blocks.some(
      (block) => (
        block.main_numbered_lesson_span.lesson_start <= 105
        && block.main_numbered_lesson_span.lesson_end >= 105
      ),
    ),
    false,
  );
});

test('Grade 6 route context is exact and canonical mapping stays incomplete', () => {
  assert.deepEqual(grade6Baseline.artifact.route_context, {
    source_id: 'grade-6-science',
    md_path: 'project-files/outputs/opiq_6klass_loodusopetus.md',
    mapping_status: 'partial',
  });
  assert.equal(grade6Baseline.artifact.source.canonical, false);
  assert.equal(grade6Baseline.artifact.completeness.official_curriculum_complete, false);
  assert.equal(grade6Baseline.artifact.completeness.canonical_opiq_mapping_complete, false);
});

test('wrong Grade 6 SHA-256 is rejected', () => {
  assertInvalid(grade6Baseline, (repository) => {
    repository.artifact.source.sha256 = '0'.repeat(64);
  }, /source\/sha256/u);
});

test('wrong Grade 6 byte size is rejected', () => {
  assertInvalid(grade6Baseline, (repository) => {
    repository.artifact.source.byte_size = 493982;
  }, /source\/byte_size/u);
});

test('Grade 6 page count 30 or 32 is rejected', () => {
  for (const pageCount of [30, 32]) {
    assertInvalid(grade6Baseline, (repository) => {
      repository.artifact.source.page_count = pageCount;
    }, /source\/page_count/u);
  }
});

test('Grade 6 page evidence 0 or 32 is rejected', () => {
  for (const page of [0, 32]) {
    assertInvalid(grade6Baseline, (repository) => {
      repository.artifact.lesson_ranges[0].source_pages = [page];
    }, /source_pages|must be >= 1/u);
  }
});

test('missing Grade 6 lesson is rejected', () => {
  assertInvalid(grade6Baseline, (repository) => {
    repository.artifact.lesson_ranges[0].lesson_start = 2;
  }, /missing lesson numbers: 1/u);
});

test('overlapping Grade 6 lesson ranges are rejected', () => {
  assertInvalid(grade6Baseline, (repository) => {
    repository.artifact.lesson_ranges[1].lesson_start = 1;
  }, /overlapping lesson numbers/u);
});

test('Grade 6 lesson 106 is rejected', () => {
  assertInvalid(grade6Baseline, (repository) => {
    const record = repository.artifact.lesson_ranges.at(-1);
    record.lesson_start = 106;
    record.lesson_end = 106;
  }, /outside 1-105|missing lesson numbers: 105/u);
});

test('Grade 6 cannot use the Grade 5 route', () => {
  assertInvalid(grade6Baseline, (repository) => {
    repository.artifact.route_context.source_id = 'grade-5-science';
  }, /route context differs|route grade or subject differs/u);
});

test('Grade 6 cannot use a Grade 7 route', () => {
  assertInvalid(grade6Baseline, (repository) => {
    repository.artifact.route_context.source_id = 'grade-7-science';
  }, /route context differs|route grade or subject differs/u);
});

test('wrong Grade 6 md_path is rejected', () => {
  assertInvalid(grade6Baseline, (repository) => {
    repository.artifact.route_context.md_path = 'project-files/outputs/opiq_5klass_loodusopetus.md';
  }, /route_context\/md_path|route context differs/u);
});

test('Grade 6 metadata cannot point at the Grade 5 source PDF', () => {
  assertInvalid(grade6Baseline, (repository) => {
    repository.artifact.source = structuredClone(grade5Baseline.artifact.source);
  }, /source\/repository_path|grade or subject differs/u);
});

test('Grade 6 geography metadata is rejected', () => {
  assertInvalid(grade6Baseline, (repository) => {
    repository.artifact.source.subject = 'geography';
    repository.artifact.source.subject_et = 'geograafia';
  }, /grade or subject differs|source\/subject/u);
});

test('canonical teacher-plan claims are rejected for Grade 6', () => {
  assertInvalid(grade6Baseline, (repository) => {
    repository.artifact.source.canonical = true;
  }, /source\/canonical/u);
});

test('official curriculum completeness is rejected for Grade 6', () => {
  assertInvalid(grade6Baseline, (repository) => {
    repository.artifact.completeness.official_curriculum_complete = true;
  }, /official_curriculum_complete|official curriculum/u);
});

test('canonical Opiq completeness is rejected for Grade 6', () => {
  assertInvalid(grade6Baseline, (repository) => {
    repository.artifact.completeness.canonical_opiq_mapping_complete = true;
  }, /canonical_opiq_mapping_complete|canonical Opiq/u);
});

test('completed Opiq mapping status is rejected', () => {
  assertInvalid(grade6Baseline, (repository) => {
    repository.artifact.route_context.mapping_status = 'complete';
  }, /mapping_status|route context differs/u);
});

test('hour interval with minimum greater than maximum is rejected', () => {
  assertInvalid(grade6Baseline, (repository) => {
    repository.artifact.thematic_blocks[3].declared_hours = {
      minimum: 20,
      maximum: 19,
      source_text: '20-19 tundi',
    };
  }, /minimum less than or equal to maximum/u);
});

test('aggregate hour range that excludes 105 is rejected', () => {
  assertInvalid(grade6Baseline, (repository) => {
    repository.artifact.thematic_blocks[3].declared_hours = {
      minimum: 17,
      maximum: 17,
      source_text: '17 tundi',
    };
    repository.artifact.thematic_blocks[4].declared_hours = {
      minimum: 13,
      maximum: 13,
      source_text: '13 tundi',
    };
  }, /annual allocation 105 is outside aggregate block-hour range/u);
});

test('silently collapsed flexible allocations are rejected', () => {
  assertInvalid(grade6Baseline, (repository) => {
    repository.artifact.thematic_blocks[3].declared_hours = 18;
    repository.artifact.thematic_blocks[4].declared_hours = 13;
  }, /hour allocation differs from the registered source heading/u);
});

test('missing Grade 6 page-level evidence is rejected', () => {
  assertInvalid(grade6Baseline, (repository) => {
    repository.artifact.lesson_ranges[0].source_pages = [];
  }, /lesson_ranges\/0\/source_pages|page-level evidence/u);
});

test('duplicate extraction_id values are rejected across artifacts', () => {
  const collection = {
    discoveredPaths: [...baselineCollection.discoveredPaths],
    repositories: baselineCollection.repositories.map(cloneRepository),
  };
  collection.repositories[1].artifact.extraction_id =
    collection.repositories[0].artifact.extraction_id;
  collection.repositories[1].artifactText = serializeTeacherWorkPlanExtraction(
    collection.repositories[1].artifact,
  );
  assert.match(
    renderDiagnostics(validateTeacherWorkPlanExtractionRepositories(collection)),
    /extraction_id values must be unique/u,
  );
});

test('duplicate block and unresolved item IDs are rejected', () => {
  assertInvalid(grade6Baseline, (repository) => {
    repository.artifact.thematic_blocks[1].block_id =
      repository.artifact.thematic_blocks[0].block_id;
    repository.artifact.unresolved_items[1].item_id =
      repository.artifact.unresolved_items[0].item_id;
  }, /block_id values must be unique|item_id values must be unique/u);
});

test('unknown strict-schema field is rejected', () => {
  assertInvalid(grade6Baseline, (repository) => {
    repository.artifact.unreviewed = true;
  }, /unknown field unreviewed/u);
});

test('altered Grade 5 artifact still violates its original contract', () => {
  assertInvalid(grade5Baseline, (repository) => {
    repository.artifact.thematic_blocks[0].declared_hours = 25;
  }, /aggregate hour range is 69-69|hour allocation differs/u);
});

test('Grade 6 explicit ranges cannot be silently split', () => {
  assertInvalid(grade6Baseline, (repository) => {
    const index = repository.artifact.lesson_ranges.findIndex(
      (range) => range.lesson_start === 76,
    );
    const original = repository.artifact.lesson_ranges[index];
    repository.artifact.lesson_ranges.splice(
      index,
      1,
      { ...structuredClone(original), lesson_end: 76 },
      { ...structuredClone(original), lesson_start: 77, lesson_end: 77 },
    );
  }, /explicit multi-lesson ranges differ/u);
});

test('wrong Grade 7 geography SHA-256 is rejected', () => {
  assertInvalid(grade7GeographyBaseline, (repository) => {
    repository.artifact.source.sha256 = '0'.repeat(64);
  }, /source\/sha256/u);
});

test('wrong Grade 7 geography byte size is rejected', () => {
  assertInvalid(grade7GeographyBaseline, (repository) => {
    repository.artifact.source.byte_size = 366594;
  }, /source\/byte_size/u);
});

test('Grade 7 geography page count 16 or 18 is rejected', () => {
  for (const pageCount of [16, 18]) {
    assertInvalid(grade7GeographyBaseline, (repository) => {
      repository.artifact.source.page_count = pageCount;
    }, /source\/page_count/u);
  }
});

test('Grade 7 geography page reference 0 or 18 is rejected', () => {
  for (const page of [0, 18]) {
    assertInvalid(grade7GeographyBaseline, (repository) => {
      repository.artifact.lesson_ranges[0].source_pages = [page];
    }, /source_pages|must be >= 1/u);
  }
});

test('missing Grade 7 geography lesson 6 is rejected', () => {
  assertInvalid(grade7GeographyBaseline, (repository) => {
    repository.artifact.lesson_ranges.splice(5, 1);
  }, /lesson 6 is missing|missing lesson numbers: 6/u);
});

test('missing Grade 7 geography lesson 35 is rejected', () => {
  assertInvalid(grade7GeographyBaseline, (repository) => {
    repository.artifact.lesson_ranges.pop();
  }, /lesson 35 is missing|missing lesson numbers: 35/u);
});

test('overlap at Grade 7 geography lesson 21 is rejected', () => {
  assertInvalid(grade7GeographyBaseline, (repository) => {
    repository.artifact.lesson_ranges[20].lesson_start = 20;
  }, /overlapping lesson numbers: 20|explicit multi-lesson ranges differ/u);
});

test('Grade 7 geography lesson 36 is rejected', () => {
  assertInvalid(grade7GeographyBaseline, (repository) => {
    repository.artifact.lesson_ranges[34].lesson_start = 36;
    repository.artifact.lesson_ranges[34].lesson_end = 36;
  }, /outside 1-35|missing lesson numbers: 35/u);
});

test('Grade 7 geography cannot use a science route', () => {
  for (const sourceId of ['grade-7-science', 'grade-6-science']) {
    assertInvalid(grade7GeographyBaseline, (repository) => {
      repository.artifact.route_context.source_id = sourceId;
    }, /route context differs|route grade or subject differs/u);
  }
});

test('Grade 7 geography cannot become science or loodusõpetus', () => {
  assertInvalid(grade7GeographyBaseline, (repository) => {
    repository.artifact.source.subject = 'science';
    repository.artifact.source.subject_et = 'loodusõpetus';
  }, /grade or subject differs|source\/subject/u);
});

test('Grade 7 science PDF cannot back the geography extraction', () => {
  assertInvalid(grade7GeographyBaseline, (repository) => {
    repository.artifact.source.repository_path =
      'project-files/inputs/originals/teacher-work-plans/Opetaja-tookava-Loodusopetus-7-klass.pdf';
  }, /source path differs|source\/repository_path|provenance/u);
});

test('wrong Grade 7 geography md_path is rejected', () => {
  assertInvalid(grade7GeographyBaseline, (repository) => {
    repository.artifact.route_context.md_path =
      'project-files/outputs/opiq_7klass_loodusopetus.md';
  }, /route_context\/md_path|route context differs/u);
});

test('Grade 7 geography canonical and completeness claims are rejected', () => {
  for (const mutate of [
    (artifact) => { artifact.source.canonical = true; },
    (artifact) => { artifact.completeness.official_curriculum_complete = true; },
    (artifact) => { artifact.completeness.canonical_opiq_mapping_complete = true; },
    (artifact) => { artifact.route_context.mapping_status = 'complete'; },
  ]) {
    assertInvalid(grade7GeographyBaseline, (repository) => {
      mutate(repository.artifact);
    }, /canonical|completeness|mapping_status|mapping must remain deferred/u);
  }
});

test('Grade 7 geography derived block total must equal 35', () => {
  assertInvalid(grade7GeographyBaseline, (repository) => {
    repository.artifact.thematic_blocks[0].derived_hours.minimum = 10;
    repository.artifact.thematic_blocks[0].derived_hours.maximum = 10;
  }, /aggregate hour range is 34-34|derived allocation must equal/u);
});

test('Grade 7 geography cannot replace derived hours with false declared hours', () => {
  assertInvalid(grade7GeographyBaseline, (repository) => {
    delete repository.artifact.thematic_blocks[0].derived_hours;
    repository.artifact.thematic_blocks[0].declared_hours = 11;
  }, /must use derived_hours exclusively|derived_hours|hour allocation differs/u);
});

test('thematic blocks cannot contain declared and derived hours together', () => {
  assertInvalid(grade7GeographyBaseline, (repository) => {
    repository.artifact.thematic_blocks[0].declared_hours = 11;
  }, /must use derived_hours exclusively|must match exactly one schema/u);
});

test('derived hours require numbered lesson-span evidence', () => {
  assertInvalid(grade7GeographyBaseline, (repository) => {
    delete repository.artifact.thematic_blocks[0].main_numbered_lesson_span;
  }, /main_numbered_lesson_span|numbered lesson span/u);
});

test('Grade 7 geography cannot infer approximate weeks', () => {
  assertInvalid(grade7GeographyBaseline, (repository) => {
    repository.artifact.thematic_blocks[0].approximate_weeks = 11;
  }, /approximate weeks cannot be inferred/u);
});

test('lesson 6 and header-switch unresolved items are mandatory', () => {
  for (const itemId of ['lesson-6-missing-topic-cell', 'lesson-week-header-switch']) {
    assertInvalid(grade7GeographyBaseline, (repository) => {
      repository.artifact.unresolved_items = repository.artifact.unresolved_items
        .filter((item) => item.item_id !== itemId);
    }, new RegExp(`required source ambiguity ${itemId}|unknown unresolved item ID ${itemId}`, 'u'));
  }
});

test('lesson 35 requires page 17 continuation evidence', () => {
  assertInvalid(grade7GeographyBaseline, (repository) => {
    repository.artifact.lesson_ranges[34].source_pages = [16];
  }, /lesson 35 differs from required source evidence/u);
});

test('unknown Grade 7 geography fields are rejected by the strict schema', () => {
  assertInvalid(grade7GeographyBaseline, (repository) => {
    repository.artifact.thematic_blocks[0].invented_hours = 11;
  }, /unknown field invented_hours/u);
});

test('wrong Grade 7 science SHA-256 and byte size are rejected', () => {
  assertInvalid(grade7ScienceBaseline, (repository) => {
    repository.artifact.source.sha256 = '0'.repeat(64);
  }, /source\/sha256/u);
  assertInvalid(grade7ScienceBaseline, (repository) => {
    repository.artifact.source.byte_size = 325725;
  }, /source\/byte_size/u);
});

test('Grade 7 science page count 16 or 18 is rejected', () => {
  for (const pageCount of [16, 18]) {
    assertInvalid(grade7ScienceBaseline, (repository) => {
      repository.artifact.source.page_count = pageCount;
    }, /source\/page_count/u);
  }
});

test('Grade 7 science page reference 0 or 18 is rejected', () => {
  for (const page of [0, 18]) {
    assertInvalid(grade7ScienceBaseline, (repository) => {
      repository.artifact.lesson_ranges[0].source_pages = [page];
    }, /source_pages|must be >= 1/u);
  }
});

test('missing Grade 7 science lessons 14, 33 or 70 are rejected', () => {
  for (const lesson of [14, 33, 70]) {
    assertInvalid(grade7ScienceBaseline, (repository) => {
      const index = repository.artifact.lesson_ranges.findIndex(
        (range) => range.lesson_start <= lesson && range.lesson_end >= lesson,
      );
      repository.artifact.lesson_ranges.splice(index, 1);
    }, new RegExp(`missing lesson numbers:|source range|expected 58`, 'u'));
  }
});

test('Grade 7 science overlap at lesson 35 and lesson 71 are rejected', () => {
  assertInvalid(grade7ScienceBaseline, (repository) => {
    const range = repository.artifact.lesson_ranges.find((entry) => entry.lesson_start === 35);
    range.lesson_start = 34;
  }, /overlapping lesson numbers: 34|explicit multi-lesson ranges differ/u);
  assertInvalid(grade7ScienceBaseline, (repository) => {
    const range = repository.artifact.lesson_ranges.find((entry) => entry.lesson_start === 65);
    range.lesson_end = 71;
  }, /outside 1-70|explicit multi-lesson ranges differ/u);
});

test('Grade 7 science rejects geography and adjacent science routes', () => {
  for (const sourceId of ['grade-7-geography', 'grade-6-science']) {
    assertInvalid(grade7ScienceBaseline, (repository) => {
      repository.artifact.route_context.source_id = sourceId;
    }, /route context differs|route grade or subject differs/u);
  }
});

test('Grade 7 science cannot become geography or geograafia', () => {
  assertInvalid(grade7ScienceBaseline, (repository) => {
    repository.artifact.source.subject = 'geography';
    repository.artifact.source.subject_et = 'geograafia';
  }, /grade or subject differs|source\/subject/u);
});

test('Grade 7 geography PDF cannot back the science extraction', () => {
  assertInvalid(grade7ScienceBaseline, (repository) => {
    repository.artifact.source.repository_path =
      'project-files/inputs/originals/teacher-work-plans/Geo-tookava-7-klass-Reet-Tuisk.pdf';
  }, /source path differs|source\/repository_path|provenance/u);
});

test('wrong Grade 7 science md_path is rejected', () => {
  assertInvalid(grade7ScienceBaseline, (repository) => {
    repository.artifact.route_context.md_path =
      'project-files/outputs/opiq_7klass_geograafia.md';
  }, /route_context\/md_path|route context differs/u);
});

test('Grade 7 science canonical and completeness claims are rejected', () => {
  for (const mutate of [
    (artifact) => { artifact.source.canonical = true; },
    (artifact) => { artifact.completeness.official_curriculum_complete = true; },
    (artifact) => { artifact.completeness.canonical_opiq_mapping_complete = true; },
    (artifact) => { artifact.route_context.mapping_status = 'complete'; },
  ]) {
    assertInvalid(grade7ScienceBaseline, (repository) => {
      mutate(repository.artifact);
    }, /canonical|completeness|mapping_status|mapping must remain deferred/u);
  }
});

test('Grade 7 science requires derived hours matching block spans and total 70', () => {
  assertInvalid(grade7ScienceBaseline, (repository) => {
    repository.artifact.thematic_blocks[0].derived_hours.minimum = 18;
    repository.artifact.thematic_blocks[0].derived_hours.maximum = 18;
  }, /aggregate hour range is 69-69|derived allocation must equal/u);
  assertInvalid(grade7ScienceBaseline, (repository) => {
    repository.artifact.thematic_blocks[0].main_numbered_lesson_span.lesson_end = 18;
  }, /main numbered lesson span differs|derived allocation must equal/u);
  assertInvalid(grade7ScienceBaseline, (repository) => {
    delete repository.artifact.thematic_blocks[0].derived_hours;
    repository.artifact.thematic_blocks[0].declared_hours = 19;
  }, /must use derived_hours exclusively|derived_hours|hour allocation differs/u);
});

test('Grade 7 science cannot infer approximate weeks', () => {
  assertInvalid(grade7ScienceBaseline, (repository) => {
    repository.artifact.thematic_blocks[0].approximate_weeks = 9.5;
  }, /approximate weeks cannot be inferred/u);
});

test('Grade 7 science requires its separate unnumbered wrap-up row', () => {
  assertInvalid(grade7ScienceBaseline, (repository) => {
    delete repository.artifact.unnumbered_rows;
  }, /expected 1 registered unnumbered source row|unnumbered row/u);
  assertInvalid(grade7ScienceBaseline, (repository) => {
    repository.artifact.unnumbered_rows[0].lesson_start = 20;
  }, /unknown field lesson_start/u);
});

test('unnumbered wrap-up cannot enter lesson coverage or derived hours', () => {
  assertInvalid(grade7ScienceBaseline, (repository) => {
    const numbered = structuredClone(repository.artifact.lesson_ranges[14]);
    numbered.topic_et = repository.artifact.unnumbered_rows[0].topic_et;
    repository.artifact.lesson_ranges.splice(15, 0, numbered);
  }, /overlapping lesson numbers|expected 58 source-table/u);
  assertInvalid(grade7ScienceBaseline, (repository) => {
    repository.artifact.thematic_blocks[0].derived_hours.minimum = 20;
    repository.artifact.thematic_blocks[0].derived_hours.maximum = 20;
  }, /aggregate hour range is 71-71|derived allocation must equal/u);
});

test('Grade 7 science keeps range 65-70 as one source-table record', () => {
  assertInvalid(grade7ScienceBaseline, (repository) => {
    const index = repository.artifact.lesson_ranges.findIndex(
      (range) => range.lesson_start === 65,
    );
    const original = repository.artifact.lesson_ranges[index];
    const replacements = Array.from({ length: 6 }, (_, offset) => ({
      ...structuredClone(original),
      lesson_start: 65 + offset,
      lesson_end: 65 + offset,
      topic_et: `Väljamõeldud varuteema ${offset + 1}`,
    }));
    repository.artifact.lesson_ranges.splice(index, 1, ...replacements);
  }, /explicit multi-lesson ranges differ|expected 58 source-table/u);
});

test('Grade 7 science required ambiguity markers and page evidence cannot disappear', () => {
  assertInvalid(grade7ScienceBaseline, (repository) => {
    const range = repository.artifact.lesson_ranges.find((entry) => entry.lesson_start === 14);
    range.unresolved_fields = [];
  }, /source range 14-14 differs/u);
  assertInvalid(grade7ScienceBaseline, (repository) => {
    const range = repository.artifact.lesson_ranges.find((entry) => entry.lesson_start === 33);
    range.source_pages = [9];
  }, /source range 33-33 differs/u);
  assertInvalid(grade7ScienceBaseline, (repository) => {
    const range = repository.artifact.lesson_ranges.find((entry) => entry.lesson_start === 33);
    range.unresolved_fields = ['cross-page-table-continuations'];
  }, /source range 33-33 differs/u);
  for (const itemId of [
    'third-block-heading-not-printed',
    'blank-final-page',
    'pdf-author-metadata-mismatch',
  ]) {
    assertInvalid(grade7ScienceBaseline, (repository) => {
      repository.artifact.unresolved_items = repository.artifact.unresolved_items
        .filter((item) => item.item_id !== itemId);
    }, new RegExp(`required source ambiguity ${itemId}|unknown unresolved item ID ${itemId}`, 'u'));
  }
});

test('Grade 7 science retains course-wide page 1 learning outcomes', () => {
  assertInvalid(grade7ScienceBaseline, (repository) => {
    delete repository.artifact.general_learning_outcomes;
  }, /general_learning_outcomes|course-wide page 1 learning outcomes/u);
});

test('Grade 7 science unnumbered rows are strict and uniquely identified', () => {
  assertInvalid(grade7ScienceBaseline, (repository) => {
    repository.artifact.unnumbered_rows[0].invented_lesson = 20;
  }, /unknown field invented_lesson/u);
  assertInvalid(grade7ScienceBaseline, (repository) => {
    repository.artifact.unnumbered_rows.push(
      structuredClone(repository.artifact.unnumbered_rows[0]),
    );
  }, /row_id values must be unique|expected 1 registered unnumbered/u);
});

test('altered Grade 6 artifact still violates its registered contract', () => {
  assertInvalid(grade6Baseline, (repository) => {
    repository.artifact.thematic_blocks[0].declared_hours = 11;
  }, /aggregate hour range is 103-105|hour allocation differs/u);
});

test('production extraction file order is enforced', () => {
  const collection = {
    discoveredPaths: [...baselineCollection.discoveredPaths],
    repositories: baselineCollection.repositories.map(cloneRepository).reverse(),
  };
  assert.match(
    renderDiagnostics(validateTeacherWorkPlanExtractionRepositories(collection)),
    /deterministic bytewise order/u,
  );
});

test('unregistered production extraction files are rejected', () => {
  const collection = {
    discoveredPaths: [...baselineCollection.discoveredPaths, 'evaluations/teacher-work-plans/grade-8-science-extraction.json'],
    repositories: baselineCollection.repositories.map(cloneRepository),
  };
  assert.match(
    renderDiagnostics(validateTeacherWorkPlanExtractionRepositories(collection)),
    /discovered production extraction paths differ from registry/u,
  );
});

test('scope guard allows the registered Grade 5 and Grade 6 mapping-phase support files', () => {
  assert.deepEqual(validateTeacherWorkPlanChangedPaths([
    'evaluations/teacher-work-plans/grade-5-science-extraction.json',
    'schemas/teacher-work-plan-extraction.schema.json',
    'schemas/teacher-work-plan-curriculum-map.schema.json',
    'scripts/lib/teacher-work-plan-extractions.mjs',
    'scripts/lib/teacher-work-plan-curriculum-maps.mjs',
    'scripts/teacher-work-plan-extractions.test.mjs',
    'scripts/teacher-work-plan-curriculum-maps.test.mjs',
    'scripts/check-teacher-work-plan-extractions.mjs',
    'scripts/check-teacher-work-plan-curriculum-maps.mjs',
    'scripts/classify-source-validation-scope.mjs',
    'scripts/classify-source-validation-scope.test.mjs',
    'curriculum-maps/grade-5-science/teacher-work-plan-crosswalk.yaml',
    'curriculum-maps/grade-5-science/topic-inventory.yaml',
    'docs/audits/grade-5-science-teacher-work-plan-crosswalk.md',
    'evaluations/teacher-work-plans/grade-6-science-extraction.json',
    'curriculum-maps/grade-6-science/teacher-work-plan-crosswalk.yaml',
    'curriculum-maps/grade-6-science/topic-inventory.yaml',
    'docs/audits/grade-6-science-teacher-work-plan-crosswalk.md',
    'docs/audits/grade-6-science-teacher-work-plan-extraction.md',
    '.github/workflows/validate-source-manifest.yml',
  ]), []);
});

test('scope guard activates only for extraction content', () => {
  assert.equal(requiresTeacherWorkPlanScopeValidation([
    'docs/audits/grade-2-weather-water-safety-pilot-acceptance.md',
    'grade-programmes/grade-2/programme-architecture.yaml',
    'schemas/teacher-work-plan-extraction.schema.json',
    'scripts/check-teacher-work-plan-extractions.mjs',
    'scripts/lib/teacher-work-plan-extractions.mjs',
    'scripts/teacher-work-plan-extractions.test.mjs',
    'schemas/teacher-work-plan-curriculum-map.schema.json',
    'scripts/lib/teacher-work-plan-curriculum-maps.mjs',
    'scripts/teacher-work-plan-curriculum-maps.test.mjs',
    'scripts/check-teacher-work-plan-curriculum-maps.mjs',
    'curriculum-maps/grade-5-science/teacher-work-plan-crosswalk.yaml',
    'docs/audits/grade-5-science-teacher-work-plan-crosswalk.md',
  ]), false);

  for (const repositoryPath of [
    'evaluations/teacher-work-plans/grade-5-science-extraction.json',
    'evaluations/teacher-work-plans/grade-6-science-extraction.json',
    'evaluations/teacher-work-plans/grade-7-geography-extraction.json',
    'evaluations/teacher-work-plans/grade-7-science-extraction.json',
    'docs/audits/grade-5-science-teacher-work-plan-extraction.md',
    'docs/audits/grade-6-science-teacher-work-plan-extraction.md',
    'docs/audits/grade-7-geography-teacher-work-plan-extraction.md',
    'docs/audits/grade-7-science-teacher-work-plan-extraction.md',
    'project-files/inputs/originals/teacher-work-plans/source.pdf',
  ]) {
    assert.equal(requiresTeacherWorkPlanScopeValidation([repositoryPath]), true);
  }
});

test('scope guard rejects protected paths and both unmapped Grade 7 artifacts', () => {
  const diagnostics = validateTeacherWorkPlanChangedPaths([
    'source-manifest.json',
    'evaluations/teacher-work-plans/grade-7-geography-extraction.json',
    'evaluations/teacher-work-plans/grade-7-science-extraction.json',
    'docs/audits/grade-7-geography-teacher-work-plan-extraction.md',
    'curriculum-maps/grade-7-geography/coverage-matrix.yaml',
    'project-files/inputs/originals/teacher-work-plans/source.pdf',
    'project-files/outputs/opiq_7klass_geograafia.md',
    'annual-courses/grade-7-geography/annual-architecture.yaml',
    'lesson-plans/grade-7-geography/lesson-01.yaml',
    'teacher-packs/grade-7-geography/materials.yaml',
  ]);
  assert.equal(diagnostics.length, 10);
});

test('changed-path collector reports repository changes without duplicates', async () => {
  const temporaryDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'opiq-teacher-work-plan-paths-'),
  );
  const gitEnvironment = {
    ...process.env,
    GIT_AUTHOR_EMAIL: 'test@example.invalid',
    GIT_AUTHOR_NAME: 'Test Author',
    GIT_COMMITTER_EMAIL: 'test@example.invalid',
    GIT_COMMITTER_NAME: 'Test Committer',
  };
  const runGit = (argumentsList) => {
    const result = spawnSync('git', argumentsList, {
      cwd: temporaryDirectory,
      encoding: 'utf8',
      env: gitEnvironment,
    });
    assert.equal(result.status, 0, result.stderr);
  };

  try {
    runGit(['init']);
    await fs.writeFile(path.join(temporaryDirectory, 'staged.txt'), 'baseline\n', 'utf8');
    await fs.writeFile(path.join(temporaryDirectory, 'tracked.txt'), 'baseline\n', 'utf8');
    runGit(['add', 'staged.txt', 'tracked.txt']);
    runGit(['commit', '-m', 'baseline']);

    await fs.writeFile(path.join(temporaryDirectory, 'staged.txt'), 'staged\n', 'utf8');
    runGit(['add', 'staged.txt']);
    await fs.writeFile(path.join(temporaryDirectory, 'tracked.txt'), 'unstaged\n', 'utf8');
    await fs.writeFile(path.join(temporaryDirectory, 'untracked.txt'), 'untracked\n', 'utf8');

    assert.deepEqual(
      collectTeacherWorkPlanChangedPaths({
        rootDir: temporaryDirectory,
        baseRef: 'HEAD',
      }),
      ['staged.txt', 'tracked.txt', 'untracked.txt'],
    );
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('check command validates all four registered extractions together', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/check-teacher-work-plan-extractions.mjs'],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /grade-5-science-teacher-work-plan-extraction/u);
  assert.match(result.stdout, /grade-6-science-teacher-work-plan-extraction/u);
  assert.match(result.stdout, /grade-7-geography-teacher-work-plan-extraction/u);
  assert.match(result.stdout, /grade-7-science-teacher-work-plan-extraction/u);
  assert.match(result.stdout, /31 pages and 104-106 declared block hours verified/u);
  assert.match(result.stdout, /17 pages and 35 derived block hours verified/u);
  assert.match(result.stdout, /17 pages and 70 derived block hours verified/u);
  assert.match(result.stdout, /collection valid: 4 artifacts/u);
});
