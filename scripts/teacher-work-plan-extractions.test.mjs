import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  EXTRACTION_PATHS,
  collectTeacherWorkPlanChangedPaths,
  loadTeacherWorkPlanExtractionRepositories,
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

test('production collection discovers three registered extractions deterministically', () => {
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

test('Grade 5 extraction retains all previous guarantees and byte identity', async () => {
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
  assert.equal(
    crypto.createHash('sha256').update(grade5Baseline.artifactText).digest('hex'),
    '32d78d9320ed911836c4d51707f651ff6416282273ad2d301e3f19718422131d',
  );
  const fromMain = spawnSync(
    'git',
    ['show', 'origin/main:evaluations/teacher-work-plans/grade-5-science-extraction.json'],
    { cwd: repositoryRoot, encoding: null },
  );
  assert.equal(fromMain.status, 0, String(fromMain.stderr));
  assert.equal(
    crypto.createHash('sha256').update(fromMain.stdout).digest('hex'),
    '32d78d9320ed911836c4d51707f651ff6416282273ad2d301e3f19718422131d',
  );
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

test('Grade 6 extraction remains byte-identical to origin/main', () => {
  const expectedSha = '71cd69b85f20a50b0e847bb2bde9c2b8fd0c4744831d77991bb33bcbf663c033';
  assert.equal(
    crypto.createHash('sha256').update(grade6Baseline.artifactText).digest('hex'),
    expectedSha,
  );
  const fromMain = spawnSync(
    'git',
    ['show', 'origin/main:evaluations/teacher-work-plans/grade-6-science-extraction.json'],
    { cwd: repositoryRoot, encoding: null },
  );
  assert.equal(fromMain.status, 0, String(fromMain.stderr));
  assert.equal(crypto.createHash('sha256').update(fromMain.stdout).digest('hex'), expectedSha);
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

test('Grade 6 route context is exact and canonical mapping stays deferred', () => {
  assert.deepEqual(grade6Baseline.artifact.route_context, {
    source_id: 'grade-6-science',
    md_path: 'project-files/outputs/opiq_6klass_loodusopetus.md',
    mapping_status: 'deferred',
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
    discoveredPaths: [...baselineCollection.discoveredPaths, 'evaluations/teacher-work-plans/grade-7-science-extraction.json'],
    repositories: baselineCollection.repositories.map(cloneRepository),
  };
  assert.match(
    renderDiagnostics(validateTeacherWorkPlanExtractionRepositories(collection)),
    /discovered production extraction paths differ from registry/u,
  );
});

test('scope guard allows only Grade 7 geography extraction-phase support files', () => {
  assert.deepEqual(validateTeacherWorkPlanChangedPaths([
    'evaluations/teacher-work-plans/grade-7-geography-extraction.json',
    'schemas/teacher-work-plan-extraction.schema.json',
    'scripts/lib/teacher-work-plan-extractions.mjs',
    'scripts/teacher-work-plan-extractions.test.mjs',
    'scripts/check-teacher-work-plan-extractions.mjs',
    'scripts/classify-source-validation-scope.mjs',
    'scripts/classify-source-validation-scope.test.mjs',
    'docs/audits/grade-7-geography-teacher-work-plan-extraction.md',
    '.github/workflows/validate-source-manifest.yml',
  ]), []);
});

test('scope guard rejects protected paths, prior artifacts, and Grade 7 science', () => {
  const diagnostics = validateTeacherWorkPlanChangedPaths([
    'source-manifest.json',
    'evaluations/teacher-work-plans/grade-5-science-extraction.json',
    'evaluations/teacher-work-plans/grade-6-science-extraction.json',
    'curriculum-maps/grade-7-geography/coverage-matrix.yaml',
    'project-files/inputs/originals/teacher-work-plans/source.pdf',
    'project-files/outputs/opiq_7klass_geograafia.md',
    'annual-courses/grade-7-geography/annual-architecture.yaml',
    'lesson-plans/grade-7-geography/lesson-01.yaml',
    'teacher-packs/grade-7-geography/materials.yaml',
    'evaluations/teacher-work-plans/grade-7-science-extraction.json',
  ]);
  assert.equal(diagnostics.length, 10);
});

test('changed-path collector reports repository changes without duplicates', () => {
  const paths = collectTeacherWorkPlanChangedPaths({ rootDir: repositoryRoot });
  assert.deepEqual(
    paths,
    [...new Set(paths)].sort((left, right) => Buffer.from(left).compare(Buffer.from(right))),
  );
  assert.ok(paths.includes('evaluations/teacher-work-plans/grade-7-geography-extraction.json'));
});

test('check command validates all three registered extractions together', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/check-teacher-work-plan-extractions.mjs'],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /grade-5-science-teacher-work-plan-extraction/u);
  assert.match(result.stdout, /grade-6-science-teacher-work-plan-extraction/u);
  assert.match(result.stdout, /grade-7-geography-teacher-work-plan-extraction/u);
  assert.match(result.stdout, /31 pages and 104-106 declared block hours verified/u);
  assert.match(result.stdout, /17 pages and 35 derived block hours verified/u);
  assert.match(result.stdout, /collection valid: 3 artifacts/u);
});
