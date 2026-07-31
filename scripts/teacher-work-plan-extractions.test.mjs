import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  collectTeacherWorkPlanChangedPaths,
  loadTeacherWorkPlanExtractionRepository,
  serializeTeacherWorkPlanExtraction,
  validateTeacherWorkPlanChangedPaths,
  validateTeacherWorkPlanExtractionRepository,
} from './lib/teacher-work-plan-extractions.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = await loadTeacherWorkPlanExtractionRepository({ rootDir: repositoryRoot });

function cloneRepository() {
  return {
    ...baseline,
    artifact: structuredClone(baseline.artifact),
    schema: structuredClone(baseline.schema),
    provenance: structuredClone(baseline.provenance),
    manifest: structuredClone(baseline.manifest),
    sourceBytes: Buffer.from(baseline.sourceBytes),
  };
}

function validateMutation(mutate) {
  const repository = cloneRepository();
  mutate(repository);
  repository.artifactText = serializeTeacherWorkPlanExtraction(repository.artifact);
  return validateTeacherWorkPlanExtractionRepository(repository);
}

function assertInvalid(mutate, pattern) {
  const result = validateMutation(mutate);
  const rendered = result.diagnostics.map(({ field, reason }) => `${field}: ${reason}`).join('\n');
  assert.match(rendered, pattern);
}

test('committed Grade 5 extraction passes every invariant', () => {
  const first = validateTeacherWorkPlanExtractionRepository(baseline);
  const second = validateTeacherWorkPlanExtractionRepository(baseline);
  assert.deepEqual(first, second);
  assert.deepEqual(first, {
    diagnostics: [],
    summary: {
      errors: 0,
      thematic_blocks: 5,
      lesson_ranges: 67,
      lessons_covered: 70,
      unresolved_items: 6,
      source_pages: 25,
      declared_hours: 70,
    },
  });
});

test('artifact serialization is deterministic', () => {
  assert.equal(serializeTeacherWorkPlanExtraction(baseline.artifact), baseline.artifactText);
});

test('source PDF is an unchanged regular file with verified provenance', () => {
  assert.equal(baseline.sourceIsRegularFile, true);
  assert.equal(baseline.sourcePdfPageCount, 25);
  assert.equal(baseline.sourceBytes.byteLength, 506197);
  assert.equal(
    baseline.artifact.source.sha256,
    'fd7593800bbc0bada390e98f92f7c45dcf21c0e09a780d407f45fb7e921e9c90',
  );
});

test('all source pages and lessons are covered exactly and hours total 70', () => {
  assert.deepEqual(baseline.artifact.extraction.verified_pages, Array.from({ length: 25 }, (_, i) => i + 1));
  assert.deepEqual(baseline.artifact.completeness.lesson_number_coverage.gaps, []);
  assert.deepEqual(baseline.artifact.completeness.lesson_number_coverage.overlaps, []);
  assert.equal(
    baseline.artifact.thematic_blocks.reduce((sum, block) => sum + block.declared_hours, 0),
    70,
  );
});

test('route context is exact and canonical mapping stays deferred', () => {
  assert.deepEqual(baseline.artifact.route_context, {
    source_id: 'grade-5-science',
    md_path: 'project-files/outputs/opiq_5klass_loodusopetus.md',
    mapping_status: 'deferred',
  });
  assert.equal(baseline.artifact.completeness.canonical_opiq_mapping_complete, false);
  assert.equal(baseline.artifact.completeness.official_curriculum_complete, false);
});

test('wrong SHA-256 is rejected', () => {
  assertInvalid((repository) => {
    repository.artifact.source.sha256 = '0'.repeat(64);
  }, /source\/sha256/u);
});

test('wrong PDF page count is rejected', () => {
  assertInvalid((repository) => {
    repository.artifact.source.page_count = 24;
  }, /source\/page_count/u);
});

test('page evidence below and above the PDF bounds is rejected', () => {
  for (const page of [0, 26]) {
    assertInvalid((repository) => {
      repository.artifact.lesson_ranges[0].source_pages = [page];
    }, /source_pages|must be >= 1|must be <= 25/u);
  }
});

test('missing lesson coverage is rejected', () => {
  assertInvalid((repository) => {
    repository.artifact.lesson_ranges[0].lesson_start = 2;
  }, /missing lesson numbers: 1/u);
});

test('overlapping lesson coverage is rejected', () => {
  assertInvalid((repository) => {
    repository.artifact.lesson_ranges[1].lesson_start = 1;
  }, /overlapping lesson numbers/u);
});

test('declared hours other than 70 are rejected', () => {
  assertInvalid((repository) => {
    repository.artifact.thematic_blocks[0].declared_hours = 25;
  }, /declared_hours sum is 69, expected 70/u);
});

test('thematic block lesson spans must match the source table', () => {
  assertInvalid((repository) => {
    repository.artifact.thematic_blocks[2].main_numbered_lesson_span.lesson_end = 51;
  }, /main numbered lesson span differs from the source table/u);
});

test('wrong grade route is rejected', () => {
  assertInvalid((repository) => {
    repository.artifact.route_context.source_id = 'grade-6-science';
  }, /route_context\/source_id|route_context:/u);
});

test('wrong subject is rejected', () => {
  assertInvalid((repository) => {
    repository.artifact.source.subject = 'geography';
  }, /source\/subject/u);
});

test('canonical teacher-plan claims are rejected', () => {
  assertInvalid((repository) => {
    repository.artifact.source.canonical = true;
  }, /source\/canonical/u);
});

test('official-curriculum completeness claims are rejected', () => {
  assertInvalid((repository) => {
    repository.artifact.completeness.official_curriculum_complete = true;
  }, /official_curriculum_complete|official curriculum/u);
});

test('canonical Opiq completeness claims are rejected', () => {
  assertInvalid((repository) => {
    repository.artifact.completeness.canonical_opiq_mapping_complete = true;
  }, /canonical_opiq_mapping_complete|canonical Opiq/u);
});

test('missing page-level evidence is rejected', () => {
  assertInvalid((repository) => {
    repository.artifact.lesson_ranges[0].source_pages = [];
  }, /lesson_ranges\/0\/source_pages|page-level evidence/u);
});

test('unknown fields are rejected', () => {
  assertInvalid((repository) => {
    repository.artifact.unreviewed = true;
  }, /unknown field unreviewed/u);
});

test('scope guard allows only extraction-phase support files', () => {
  assert.deepEqual(validateTeacherWorkPlanChangedPaths([
    'evaluations/teacher-work-plans/grade-5-science-extraction.json',
    'schemas/teacher-work-plan-extraction.schema.json',
    'scripts/lib/teacher-work-plan-extractions.mjs',
    'scripts/teacher-work-plan-extractions.test.mjs',
    'scripts/check-teacher-work-plan-extractions.mjs',
    'docs/audits/grade-5-science-teacher-work-plan-extraction.md',
    '.github/workflows/validate-source-manifest.yml',
    'package.json',
  ]), []);
});

test('scope guard rejects manifest, canonical, original, production, and other-grade changes', () => {
  const diagnostics = validateTeacherWorkPlanChangedPaths([
    'source-manifest.json',
    'curriculum-maps/grade-5-science/coverage-matrix.yaml',
    'project-files/inputs/originals/teacher-work-plans/source.pdf',
    'project-files/outputs/opiq_5klass_loodusopetus.md',
    'lesson-plans/grade-5-science/water/lesson-01.yaml',
    'teacher-packs/grade-5-science/water/materials.yaml',
    'evaluations/teacher-work-plans/grade-6-science-extraction.json',
  ]);
  assert.equal(diagnostics.length, 7);
});

test('changed-path collector reports repository changes without duplicates', () => {
  const paths = collectTeacherWorkPlanChangedPaths({ rootDir: repositoryRoot });
  assert.deepEqual(paths, [...new Set(paths)].sort((a, b) => Buffer.from(a).compare(Buffer.from(b))));
  assert.ok(paths.includes('evaluations/teacher-work-plans/grade-5-science-extraction.json'));
});

test('check command succeeds for the extraction worktree', () => {
  const result = spawnSync(process.execPath, ['scripts/check-teacher-work-plan-extractions.mjs'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /25 pages and 70 declared hours verified/u);
});
