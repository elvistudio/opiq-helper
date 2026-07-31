import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  TEACHER_WORK_PLAN_MAP_PATH,
  loadTeacherWorkPlanCurriculumMapRepository,
  serializeTeacherWorkPlanCurriculumMap,
  validateTeacherWorkPlanCurriculumMapRepository,
} from './lib/teacher-work-plan-curriculum-maps.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = await loadTeacherWorkPlanCurriculumMapRepository({ rootDir: repositoryRoot });

function cloneRepository() {
  return structuredClone(baseline);
}

function diagnostics(repository) {
  return validateTeacherWorkPlanCurriculumMapRepository(repository).diagnostics;
}

function render(repository) {
  return diagnostics(repository).map(({ file, field, reason }) => `${file} ${field}: ${reason}`).join('\n');
}

function assertInvalid(mutate, pattern) {
  const repository = cloneRepository();
  mutate(repository);
  repository.artifactText = serializeTeacherWorkPlanCurriculumMap(repository.artifact);
  const output = render(repository);
  assert.notEqual(output, '', 'expected validation to fail');
  assert.match(output, pattern);
}

function firstMatch(repository) {
  return repository.artifact.lesson_range_mappings.find((mapping) => mapping.opiq_matches.length > 0).opiq_matches[0];
}

function findInventoryRecord(repository, recordId) {
  for (const topic of repository.topicInventory.topics) {
    for (const bucket of ['selected_records', 'alternative_records', 'rejected_records']) {
      const record = topic[bucket].find((candidate) => candidate.record_id === recordId);
      if (record) return { topic, record, bucket };
    }
  }
  throw new Error(`missing fixture record ${recordId}`);
}

test('production Grade 5 crosswalk passes deterministically', () => {
  const first = validateTeacherWorkPlanCurriculumMapRepository(cloneRepository());
  const second = validateTeacherWorkPlanCurriculumMapRepository(cloneRepository());
  assert.deepEqual(first, second);
  assert.deepEqual(first.diagnostics, []);
  assert.deepEqual(first.summary, {
    errors: 0,
    artifacts: 1,
    total_source_lesson_ranges: 67,
    matched_count: 7,
    partial_count: 57,
    missing_count: 3,
    ambiguous_count: 0,
    outside_route_count: 0,
    mappings_with_russian_opiq_evidence: 30,
    mappings_with_estonian_opiq_evidence: 60,
    mappings_requiring_bridge: 60,
    represented_topic_inventory_count: 7,
    not_represented_topic_inventory_count: 3,
  });
  assert.equal(
    serializeTeacherWorkPlanCurriculumMap(baseline.artifact),
    baseline.artifactText,
  );
});

test('production discovery expects exactly the one registered crosswalk', () => {
  assert.deepEqual(baseline.discoveredPaths, [TEACHER_WORK_PLAN_MAP_PATH]);
  assertInvalid((repository) => {
    repository.discoveredPaths.push('curriculum-maps/grade-6-science/teacher-work-plan-crosswalk.yaml');
  }, /expected exactly one registered production crosswalk/u);
});

test('route boundaries reject Grade 6 and both Grade 7 routes', () => {
  for (const sourceId of ['grade-6-science', 'grade-7-science', 'grade-7-geography']) {
    assertInvalid((repository) => {
      repository.artifact.canonical_route.source_id = sourceId;
    }, /canonical_route\/source_id|Grade 5 science route/u);
  }
});

test('exact route metadata mutations are rejected', () => {
  for (const [field, value] of [
    ['md_path', 'project-files/outputs/opiq_6klass_loodusopetus.md'],
    ['source_archive', 'project-files/inputs/final-zips/foreign.zip'],
    ['qa_path', 'project-files/outputs/opiq_6klass_loodusopetus_qa.json'],
    ['record_count', 315],
  ]) {
    assertInvalid((repository) => {
      repository.artifact.canonical_route[field] = value;
    }, new RegExp(`canonical_route/${field}`, 'u'));
  }
});

test('source extraction path, SHA and page-count boundaries are rejected', () => {
  for (const [field, value] of [
    ['path', 'evaluations/teacher-work-plans/grade-6-science-extraction.json'],
    ['source_sha256', '0'.repeat(64)],
    ['source_page_count', 24],
    ['lesson_range_count', 66],
    ['extracted_lesson_span', { lesson_start: 1, lesson_end: 69 }],
  ]) {
    assertInvalid((repository) => {
      repository.artifact.source_extraction[field] = value;
    }, new RegExp(`source_extraction/${field}`, 'u'));
  }
});

test('provenance and QA mismatches are rejected', () => {
  assertInvalid((repository) => {
    repository.provenance.sources.find((source) => source.grade === 5).sha256 = '0'.repeat(64);
  }, /differs from provenance/u);
  assertInvalid((repository) => {
    repository.qa.page_records_included = 315;
  }, /page_records_included|QA expected/u);
});

test('missing, duplicate, invented, and split source ranges are rejected', () => {
  assertInvalid((repository) => {
    repository.artifact.lesson_range_mappings.pop();
  }, /missing source range 70-70/u);
  assertInvalid((repository) => {
    repository.artifact.lesson_range_mappings.push(
      structuredClone(repository.artifact.lesson_range_mappings[0]),
    );
  }, /duplicate mapping_id|duplicate source lesson range/u);
  assertInvalid((repository) => {
    const mapping = repository.artifact.lesson_range_mappings[0];
    mapping.lesson_start = 71;
    mapping.lesson_end = 71;
  }, /invented or split source range 71-71/u);
  assertInvalid((repository) => {
    const mapping = repository.artifact.lesson_range_mappings[1];
    mapping.lesson_end = mapping.lesson_start;
  }, /invented or split source range|missing source range/u);
});

test('source page, block, and topic mutations are rejected', () => {
  for (const [field, value] of [
    ['source_pages', [25]],
    ['source_block_id', 'soo-elukeskkonnana'],
    ['source_topic_et', 'Invented topic'],
  ]) {
    assertInvalid((repository) => {
      repository.artifact.lesson_range_mappings[0][field] = value;
    }, new RegExp(field, 'u'));
  }
});

test('summary total and coverage counts are recomputed', () => {
  assertInvalid((repository) => {
    repository.artifact.mapping_summary.total_source_lesson_ranges = 66;
  }, /mapping_summary\/total_source_lesson_ranges/u);
  assertInvalid((repository) => {
    repository.artifact.mapping_summary.partial_count -= 1;
  }, /mapping_summary\/partial_count/u);
});

test('foreign and invented canonical URLs are rejected', () => {
  for (const url of [
    'https://www.opiq.ee/kit/572/chapter/31885',
    'https://www.opiq.ee/kit/488/chapter/26999',
    'https://www.opiq.ee/kit/490/chapter/27000',
    'https://www.opiq.ee/kit/17/chapter/999999',
  ]) {
    assertInvalid((repository) => {
      firstMatch(repository).canonical_url = url;
    }, /canonical_url|URL must occur exactly once/u);
  }
});

test('canonical URL uniqueness is enforced inside the exact Markdown route', () => {
  assertInvalid((repository) => {
    const match = firstMatch(repository);
    repository.routeRecords.push(structuredClone(
      repository.routeRecords.find((record) => record.url === match.canonical_url),
    ));
  }, /URL must occur exactly once.*found 2/u);
});

test('canonical record metadata mutations are rejected', () => {
  for (const [field, value] of [
    ['book_id', '5k_loodusõpetus_avita_est'],
    ['title', 'Wrong title'],
    ['language', 'ru'],
    ['programme_type', 'teacher_support'],
    ['canonical_source_id', 'grade-6-science'],
  ]) {
    assertInvalid((repository) => {
      firstMatch(repository)[field] = value;
    }, new RegExp(field, 'u'));
  }
});

test('unknown and wrong-topic record IDs are rejected', () => {
  assertInvalid((repository) => {
    firstMatch(repository).record_id = 'unknown-record';
  }, /unknown topic inventory record/u);
  assertInvalid((repository) => {
    firstMatch(repository).record_id = 'bog-conditions-et-koolibri';
  }, /record belongs to bog-ecosystem|differs from topic inventory/u);
});

test('rejected and simplified records cannot become positive evidence', () => {
  assertInvalid((repository) => {
    const mapping = repository.artifact.lesson_range_mappings.find((entry) => (
      entry.topic_inventory_refs.includes('water-properties-and-states')
      && entry.opiq_matches.length > 0
    ));
    const { topic, record } = findInventoryRecord(repository, 'water-solid-liquid-simplified');
    mapping.opiq_matches[0] = {
      topic_inventory_ref: topic.topic_id,
      record_id: record.record_id,
      canonical_url: record.canonical_url,
      canonical_source_id: record.canonical_source_id,
      book_id: record.book_id,
      title: record.title,
      language: record.language,
      programme_type: record.programme_type,
      instructional_roles: record.instructional_roles,
      match_strength: 'exact',
      match_scope: ['core_content'],
      selection_rationale: 'Invalid simplified fixture selected for a negative regression.',
    };
    mapping.evidence_classification.opiq_material[0] = {
      record_id: record.record_id,
      programme_type: record.programme_type,
    };
  }, /rejected record|simplified curriculum/u);
});

test('cover-only books cannot provide page-level evidence', () => {
  assertInvalid((repository) => {
    const match = firstMatch(repository);
    match.record_id = 'cover-only-book-page';
    match.canonical_url = 'https://www.opiq.ee/kit/172/chapter/1';
    match.book_id = '5k_loodusõpetus_koolibri_rus';
    match.title = 'Природоведение. 5 класс';
    match.language = 'ru';
    match.programme_type = 'ordinary';
  }, /cover-only book 5k_loodusõpetus_koolibri_rus cannot supply page evidence/u);
});

test('matched status requires substantive positive evidence', () => {
  assertInvalid((repository) => {
    const mapping = repository.artifact.lesson_range_mappings.find((entry) => entry.coverage_status === 'matched');
    mapping.opiq_matches = [];
    mapping.evidence_classification.opiq_material = [];
  }, /matched status requires positive Opiq evidence/u);
  assertInvalid((repository) => {
    const mapping = repository.artifact.lesson_range_mappings.find((entry) => entry.coverage_status === 'matched');
    for (const match of mapping.opiq_matches) match.match_strength = 'supporting';
  }, /cannot rely only on supporting or keyword evidence/u);
});

test('coverage status semantics reject contradictory evidence and gaps', () => {
  assertInvalid((repository) => {
    const mapping = repository.artifact.lesson_range_mappings.find((entry) => entry.coverage_status === 'missing');
    mapping.opiq_matches = structuredClone(repository.artifact.lesson_range_mappings[1].opiq_matches);
    mapping.evidence_classification.opiq_material = mapping.opiq_matches.map(
      ({ record_id, programme_type }) => ({ record_id, programme_type }),
    );
  }, /missing status cannot have positive Opiq matches/u);
  assertInvalid((repository) => {
    const mapping = repository.artifact.lesson_range_mappings.find((entry) => entry.coverage_status === 'partial');
    mapping.gap_notes = [];
  }, /partial status requires an explicit gap/u);
  assertInvalid((repository) => {
    const mapping = repository.artifact.lesson_range_mappings.find((entry) => entry.coverage_status === 'partial');
    mapping.evidence_classification.bridging_content = 'none';
  }, /required must agree with bridging_content/u);
});

test('outside-route status requires an explicit foreign scope', () => {
  assertInvalid((repository) => {
    const mapping = repository.artifact.lesson_range_mappings.find((entry) => entry.coverage_status === 'missing');
    mapping.coverage_status = 'outside_route';
    mapping.rationale = 'No match was selected.';
    mapping.gap_notes = ['No match was selected.'];
  }, /explicit foreign scope explanation/u);
});

test('fieldwork cannot be falsely marked matched by general theory', () => {
  assertInvalid((repository) => {
    const mapping = repository.artifact.lesson_range_mappings[1];
    mapping.coverage_status = 'matched';
    mapping.gap_notes = [];
    mapping.evidence_classification.bridging_content = 'none';
    mapping.bridge_requirement.required = false;
    mapping.bridge_requirement.reason = 'Invalid fixture claims full coverage.';
    mapping.opiq_matches[0].match_strength = 'exact';
  }, /requires fieldwork page evidence/u);
});

test('topic comparison requires all ten unique inventory IDs', () => {
  assertInvalid((repository) => {
    repository.artifact.topic_inventory_comparison.pop();
  }, /all ten topic IDs exactly once/u);
  assertInvalid((repository) => {
    repository.artifact.topic_inventory_comparison[1].topic_id =
      repository.artifact.topic_inventory_comparison[0].topic_id;
  }, /duplicate topic ID/u);
  assertInvalid((repository) => {
    repository.artifact.topic_inventory_comparison[0].topic_id = 'unknown-topic';
  }, /all ten topic IDs exactly once/u);
});

test('topic representation status and source references stay consistent', () => {
  assertInvalid((repository) => {
    const comparison = repository.artifact.topic_inventory_comparison.find(
      (entry) => entry.representation_status === 'represented',
    );
    comparison.source_mapping_ids = [];
  }, /must exactly list source mappings|represented topic requires/u);
  assertInvalid((repository) => {
    const comparison = repository.artifact.topic_inventory_comparison.find(
      (entry) => entry.representation_status === 'not_represented',
    );
    comparison.source_mapping_ids = [repository.artifact.lesson_range_mappings[0].mapping_id];
  }, /not_represented topic cannot have source mapping references|must exactly list/u);
  assertInvalid((repository) => {
    const comparison = repository.artifact.topic_inventory_comparison.find(
      (entry) => entry.representation_status === 'not_represented',
    );
    comparison.notes = 'Missing from Grade 5 curriculum.';
  }, /supplementary sample wording|missing official curriculum/u);
});

test('unsupported completeness claims are rejected', () => {
  for (const field of [
    'canonical_opiq_mapping_complete',
    'official_curriculum_complete',
    'exact_grade_official_allocation_claimed',
    'live_opiq_catalogue_complete',
  ]) {
    assertInvalid((repository) => {
      repository.artifact.completeness[field] = true;
    }, new RegExp(field, 'u'));
  }
});

test('Grade 5 extraction must be partial and cannot be complete or deferred', () => {
  for (const status of ['complete', 'deferred']) {
    assertInvalid((repository) => {
      repository.extraction.route_context.mapping_status = status;
    }, /Grade 5 extraction mapping_status must be partial/u);
  }
});

test('Grade 6 and Grade 7 extraction statuses remain deferred', () => {
  for (let index = 0; index < baseline.otherExtractions.length; index += 1) {
    assertInvalid((repository) => {
      repository.otherExtractions[index].artifact.route_context.mapping_status = 'partial';
    }, /unmapped Grade 6\/7 extraction must remain deferred/u);
  }
});

test('duplicate mapping IDs, unknown fields, and nondeterministic serialization fail', () => {
  assertInvalid((repository) => {
    repository.artifact.lesson_range_mappings[1].mapping_id =
      repository.artifact.lesson_range_mappings[0].mapping_id;
  }, /duplicate mapping_id/u);
  assertInvalid((repository) => {
    repository.artifact.unreviewed = true;
  }, /unknown field unreviewed/u);
  const repository = cloneRepository();
  repository.artifactText = `${repository.artifactText}\n`;
  assert.match(render(repository), /serialization is not deterministic/u);
});

test('check command validates the production crosswalk', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/check-teacher-work-plan-curriculum-maps.mjs'],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /67 source ranges classified/u);
  assert.match(result.stdout, /7 matched, 57 partial, 3 missing/u);
});
