import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  TEACHER_WORK_PLAN_MAP_PATHS,
  loadTeacherWorkPlanCurriculumMapRepository,
  parseStrictTeacherWorkPlanCurriculumMap,
  serializeTeacherWorkPlanCurriculumMap,
  validateTeacherWorkPlanCurriculumMapRepository,
} from './lib/teacher-work-plan-curriculum-maps.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = await loadTeacherWorkPlanCurriculumMapRepository({ rootDir: repositoryRoot });

function cloneRepository() {
  return structuredClone(baseline);
}

function artifact(repository, sourceId) {
  return repository.artifacts.find((entry) => entry.contract.sourceId === sourceId);
}

function diagnostics(repository) {
  return validateTeacherWorkPlanCurriculumMapRepository(repository).diagnostics;
}

function render(repository) {
  return diagnostics(repository).map(({ file, field, reason }) => `${file} ${field}: ${reason}`).join('\n');
}

function serializeArtifacts(repository) {
  for (const entry of repository.artifacts) {
    entry.artifactText = serializeTeacherWorkPlanCurriculumMap(entry.artifact);
  }
}

function assertInvalid(mutate, pattern) {
  const repository = cloneRepository();
  mutate(repository);
  serializeArtifacts(repository);
  const output = render(repository);
  assert.notEqual(output, '', 'expected validation to fail');
  assert.match(output, pattern);
}

function firstMatch(repository, sourceId = 'grade-6-science') {
  return artifact(repository, sourceId).artifact.lesson_range_mappings
    .find((mapping) => mapping.opiq_matches.length > 0).opiq_matches[0];
}

function mapping(repository, lessonStart) {
  return artifact(repository, 'grade-6-science').artifact.lesson_range_mappings
    .find((entry) => entry.lesson_start === lessonStart);
}

function unassigned(repository) {
  return artifact(repository, 'grade-6-science').artifact.lesson_range_mappings
    .find((entry) => entry.source_record_kind === 'unassigned_annual_slot');
}

function inventoryRecord(repository, sourceId, recordId) {
  const entry = artifact(repository, sourceId);
  for (const topic of entry.topicInventory.topics) {
    for (const bucket of ['selected_records', 'alternative_records', 'rejected_records']) {
      const record = topic[bucket].find((candidate) => candidate.record_id === recordId);
      if (record) return { topic, record, bucket };
    }
  }
  throw new Error(`missing fixture record ${recordId}`);
}

test('two production crosswalks pass deterministically with exact summaries', () => {
  const first = validateTeacherWorkPlanCurriculumMapRepository(cloneRepository());
  const second = validateTeacherWorkPlanCurriculumMapRepository(cloneRepository());
  assert.deepEqual(first, second);
  assert.deepEqual(first.diagnostics, []);
  assert.equal(first.summary.errors, 0);
  assert.equal(first.summary.artifacts, 2);
  assert.equal(first.summary.total_source_lesson_ranges, 168);
  assert.deepEqual(first.summary.per_artifact['grade-5-science'], {
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
  assert.deepEqual(first.summary.per_artifact['grade-6-science'], {
    total_source_lesson_ranges: 101,
    matched_count: 41,
    partial_count: 49,
    missing_count: 10,
    ambiguous_count: 1,
    outside_route_count: 0,
    mappings_with_russian_opiq_evidence: 50,
    mappings_with_estonian_opiq_evidence: 59,
    mappings_requiring_bridge: 60,
    represented_topic_inventory_count: 9,
    not_represented_topic_inventory_count: 2,
    ordinary_programme_verified_match_count: 0,
    unknown_programme_match_count: 116,
    unassigned_annual_slot_count: 1,
  });
});

test('Grade 6 lesson 104 remains a partial annual review with section-level supporting evidence', () => {
  const lesson104 = mapping(baseline, 104);
  assert.equal(lesson104.coverage_status, 'partial');
  assert.deepEqual(lesson104.topic_inventory_refs, ['nature-and-environmental-protection']);
  assert.equal(lesson104.opiq_matches.length, 1);
  assert.equal(lesson104.opiq_matches[0].record_id, 'protection-et-review-legacy');
  assert.equal(lesson104.opiq_matches[0].canonical_url, 'https://www.opiq.ee/kit/98/chapter/4803');
  assert.equal(lesson104.opiq_matches[0].match_strength, 'supporting');
  assert.deepEqual(lesson104.opiq_matches[0].match_scope, ['revision', 'assessment']);
  assert.equal(lesson104.evidence_classification.bridging_content, 'independently_authored_assessment_required');
  assert.equal(lesson104.bridge_requirement.required, true);
  assert.ok(lesson104.gap_notes.length > 0);
  assert.equal(lesson104.opiq_matches.some((match) => match.canonical_url === 'https://www.opiq.ee/kit/580/chapter/33076'), false);

  assertInvalid((repository) => {
    mapping(repository, 104).coverage_status = 'matched';
  }, /matched status cannot declare gaps or required bridging/u);
});

test('production registry requires Grade 5 and Grade 6 and rejects a third crosswalk', () => {
  assert.deepEqual(baseline.discoveredPaths, TEACHER_WORK_PLAN_MAP_PATHS);
  for (const missing of TEACHER_WORK_PLAN_MAP_PATHS) {
    assertInvalid((repository) => {
      repository.discoveredPaths = repository.discoveredPaths.filter((entry) => entry !== missing);
    }, /expected exactly the registered production crosswalks/u);
  }
  assertInvalid((repository) => {
    repository.discoveredPaths.push('curriculum-maps/grade-7-science/teacher-work-plan-crosswalk.yaml');
  }, /expected exactly the registered production crosswalks/u);
});

test('artifact path contract rejects a Grade 5 artifact in the Grade 6 slot', () => {
  assertInvalid((repository) => {
    artifact(repository, 'grade-6-science').artifact = structuredClone(artifact(repository, 'grade-5-science').artifact);
  }, /grade-6-science-teacher-work-plan-crosswalk|expected 6|grade-6-science/u);
});

test('Grade 6 route rejects Grade 5, both Grade 7 routes, and exact metadata drift', () => {
  for (const sourceId of ['grade-5-science', 'grade-7-science', 'grade-7-geography']) {
    assertInvalid((repository) => {
      artifact(repository, 'grade-6-science').artifact.canonical_route.source_id = sourceId;
    }, /canonical_route\/source_id/u);
  }
  for (const [field, value] of [
    ['md_path', 'project-files/outputs/opiq_5klass_loodusopetus.md'],
    ['source_archive', 'project-files/inputs/final-zips/foreign.zip'],
    ['qa_path', 'project-files/outputs/opiq_5klass_loodusopetus_qa.json'],
    ['record_count', 435],
  ]) assertInvalid((repository) => {
    artifact(repository, 'grade-6-science').artifact.canonical_route[field] = value;
  }, new RegExp(`canonical_route/${field}`, 'u'));
});

test('Grade 6 extraction path, SHA, page count, and record accounting are exact', () => {
  for (const [field, value] of [
    ['path', 'evaluations/teacher-work-plans/grade-5-science-extraction.json'],
    ['source_sha256', '0'.repeat(64)],
    ['source_page_count', 30],
    ['lesson_range_count', 100],
    ['extracted_lesson_span', { lesson_start: 1, lesson_end: 104 }],
  ]) assertInvalid((repository) => {
    artifact(repository, 'grade-6-science').artifact.source_extraction[field] = value;
  }, new RegExp(`source_extraction/${field}`, 'u'));
});

test('provenance, QA metadata, and checksums remain linked to committed evidence', () => {
  assertInvalid((repository) => {
    repository.provenance.sources.find((source) => source.grade === 6).sha256 = '0'.repeat(64);
  }, /differs from provenance/u);
  assertInvalid((repository) => {
    artifact(repository, 'grade-6-science').qa.page_records_included = 435;
  }, /page_records_included|QA expected/u);
  assertInvalid((repository) => {
    artifact(repository, 'grade-6-science').qa.checksums.output_file_sha256 = '0'.repeat(64);
  }, /output_file_sha256/u);
});

test('nullable existing artifacts are route-specific and fail closed', () => {
  for (const field of ['official_curriculum_map', 'annual_architecture']) {
    assertInvalid((repository) => {
      artifact(repository, 'grade-6-science').artifact.existing_curriculum_artifacts[field] = 'curriculum-maps/grade-6-science/placeholder.yaml';
    }, new RegExp(`existing_curriculum_artifacts/${field}`, 'u'));
    assertInvalid((repository) => {
      artifact(repository, 'grade-5-science').artifact.existing_curriculum_artifacts[field] = null;
    }, new RegExp(`existing_curriculum_artifacts/${field}`, 'u'));
  }
  for (const [field, value] of [
    ['book_inventory', 'curriculum-maps/grade-5-science/book-inventory.yaml'],
    ['topic_inventory', 'curriculum-maps/grade-5-science/topic-inventory.yaml'],
  ]) assertInvalid((repository) => {
    artifact(repository, 'grade-6-science').artifact.existing_curriculum_artifacts[field] = value;
  }, new RegExp(`existing_curriculum_artifacts/${field}`, 'u'));
});

test('all 101 source records are mapped once without missing, duplicate, invented, or split ranges', () => {
  assertInvalid((repository) => {
    artifact(repository, 'grade-6-science').artifact.lesson_range_mappings.pop();
  }, /missing source range 105-105|unassigned annual slot/u);
  assertInvalid((repository) => {
    const mappings = artifact(repository, 'grade-6-science').artifact.lesson_range_mappings;
    mappings.push(structuredClone(mappings[0]));
  }, /duplicate mapping_id|duplicate source lesson range/u);
  assertInvalid((repository) => {
    mapping(repository, 2).lesson_start = 106;
    mapping(repository, 106).lesson_end = 106;
  }, /invented or split source range|missing source range/u);
  assertInvalid((repository) => {
    mapping(repository, 3).lesson_end = 3;
  }, /invented or split source range|missing source range/u);
});

test('source pages, topic, block, and record kind must equal extraction data', () => {
  for (const [field, value] of [
    ['source_pages', [31]],
    ['source_topic_et', 'Invented topic'],
    ['source_block_id', 'ohk'],
    ['source_record_kind', 'unassigned_annual_slot'],
  ]) assertInvalid((repository) => {
    mapping(repository, 2)[field] = value;
  }, new RegExp(field, 'u'));
  assertInvalid((repository) => {
    mapping(repository, 2).source_block_id = null;
  }, /ordinary lesson range cannot have a null block|source_block_id/u);
});

test('lesson 105 remains the sole unassigned annual slot without invented placement', () => {
  assert.equal(unassigned(baseline).lesson_start, 105);
  assert.equal(unassigned(baseline).source_block_id, null);
  for (const mutate of [
    (entry) => { entry.source_block_id = 'ohk'; },
    (entry) => { entry.source_block_id = 'laanemeri-elukeskkonnana'; },
    (entry) => { entry.topic_inventory_refs = ['air-properties-and-weather']; },
    (entry) => { entry.opiq_matches = structuredClone(mapping(baseline, 50).opiq_matches); },
    (entry) => { entry.coverage_status = 'matched'; },
    (entry) => { entry.source_record_kind = 'lesson_range'; },
    (entry) => { entry.normalized_mapping_topic_et = 'Õhk'; },
  ]) assertInvalid((repository) => mutate(unassigned(repository)), /unassigned|source_block_id|source_record_kind|normalized_mapping_topic_et/u);
  assertInvalid((repository) => {
    mapping(repository, 104).source_record_kind = 'unassigned_annual_slot';
  }, /source_record_kind|unassigned annual slot/u);
});

test('mapping summary recomputes total and all five coverage counts', () => {
  assertInvalid((repository) => {
    artifact(repository, 'grade-6-science').artifact.mapping_summary.total_source_lesson_ranges = 100;
  }, /mapping_summary\/total_source_lesson_ranges/u);
  assertInvalid((repository) => {
    artifact(repository, 'grade-6-science').artifact.mapping_summary.partial_count -= 1;
  }, /mapping_summary\/partial_count/u);
});

test('unknown, foreign, invented, duplicate, and cover/detail URLs fail', () => {
  for (const url of [
    'https://www.opiq.ee/kit/580/chapter/999999',
    'https://www.opiq.ee/kit/525/chapter/29222',
    'https://www.opiq.ee/kit/488/chapter/26999',
    'https://www.opiq.ee/Kit/Details/580',
  ]) assertInvalid((repository) => {
    firstMatch(repository).canonical_url = url;
  }, /canonical_url|URL must occur exactly once/u);
  assertInvalid((repository) => {
    const entry = artifact(repository, 'grade-6-science');
    const match = firstMatch(repository);
    entry.routeRecords.push(structuredClone(entry.routeRecords.find((record) => record.url === match.canonical_url)));
  }, /URL must occur exactly once.*found 2/u);
});

test('canonical record metadata and topic registry links are exact', () => {
  for (const [field, value] of [
    ['book_id', '5k_loodusõpetus_avita_est'],
    ['title', 'Wrong title'],
    ['language', 'ru'],
    ['canonical_source_id', 'grade-5-science'],
  ]) assertInvalid((repository) => {
    firstMatch(repository)[field] = value;
  }, new RegExp(field, 'u'));
  assertInvalid((repository) => {
    firstMatch(repository).record_id = 'unknown-record';
  }, /unknown topic inventory record/u);
  assertInvalid((repository) => {
    const match = firstMatch(repository);
    match.topic_inventory_ref = 'bog-ecosystem';
  }, /record belongs to|match topic/u);
  assertInvalid((repository) => {
    firstMatch(repository).instructional_roles.push('invented_role');
  }, /role is not declared by the topic inventory record/u);
});

test('rejected inventory records cannot become positive evidence', () => {
  assertInvalid((repository) => {
    const target = mapping(repository, 5);
    const { topic, record } = inventoryRecord(repository, 'grade-6-science', 'soil-et-composition-legacy');
    target.opiq_matches[0] = {
      topic_inventory_ref: topic.topic_id,
      record_id: record.record_id,
      canonical_url: record.canonical_url,
      canonical_source_id: record.canonical_source_id,
      book_id: record.book_id,
      title: record.title,
      language: record.language,
      programme_type: record.programme_type,
      programme_type_evidence_status: 'ambiguous',
      default_course_eligibility: 'unverified',
      instructional_roles: record.instructional_roles,
      match_strength: 'strong',
      match_scope: ['core_content'],
      selection_rationale: 'Negative regression fixture.',
    };
    target.evidence_classification.opiq_material[0] = { record_id: record.record_id, programme_type: record.programme_type };
  }, /rejected record/u);
});

test('duplicate record IDs and duplicate canonical URLs in one mapping fail', () => {
  assertInvalid((repository) => {
    const target = mapping(repository, 50);
    target.opiq_matches.push(structuredClone(target.opiq_matches[0]));
    target.evidence_classification.opiq_material.push(structuredClone(target.evidence_classification.opiq_material[0]));
  }, /duplicate Opiq record|duplicate canonical URL/u);
});

test('Grade 6 programme ambiguity fields are mandatory and cannot be promoted', () => {
  for (const [field, value] of [
    ['programme_type', 'ordinary'],
    ['programme_type_evidence_status', 'verified'],
    ['default_course_eligibility', 'eligible'],
  ]) assertInvalid((repository) => {
    firstMatch(repository)[field] = value;
  }, new RegExp(field, 'u'));
  for (const field of ['programme_type_evidence_status', 'default_course_eligibility']) assertInvalid((repository) => {
    delete firstMatch(repository)[field];
  }, new RegExp(field, 'u'));
  assertInvalid((repository) => {
    const entry = artifact(repository, 'grade-6-science');
    entry.bookInventory.books.find((book) => book.book_id === firstMatch(repository).book_id).programme_type_evidence.status = 'verified';
  }, /programme_type_evidence_status|book inventory/u);
});

test('Grade 5 continues to reject unknown positive programme evidence', () => {
  assertInvalid((repository) => {
    const match = firstMatch(repository, 'grade-5-science');
    const entry = artifact(repository, 'grade-5-science');
    match.programme_type = 'unknown';
    entry.topicInventory.topics.flatMap((topic) => [...topic.selected_records, ...topic.alternative_records, ...topic.rejected_records]).find((record) => record.record_id === match.record_id).programme_type = 'unknown';
    entry.bookInventory.books.find((book) => book.book_id === match.book_id).programme_type = 'unknown';
  }, /unknown programme material cannot be positive Grade 5 evidence/u);
});

test('Grade 6 programme summaries and completeness cannot fabricate readiness', () => {
  assertInvalid((repository) => {
    artifact(repository, 'grade-6-science').artifact.mapping_summary.ordinary_programme_verified_match_count = 1;
  }, /ordinary_programme_verified_match_count/u);
  for (const field of ['programme_type_verification_complete', 'default_course_selection_complete']) assertInvalid((repository) => {
    artifact(repository, 'grade-6-science').artifact.completeness[field] = true;
  }, new RegExp(field, 'u'));
});

test('matched, partial, missing, ambiguous, and outside-route semantics fail contradictory mutations', () => {
  assertInvalid((repository) => {
    const target = mapping(repository, 44);
    target.opiq_matches = [];
    target.evidence_classification.opiq_material = [];
  }, /matched status requires positive/u);
  assertInvalid((repository) => {
    for (const match of mapping(repository, 44).opiq_matches) match.match_strength = 'supporting';
  }, /cannot rely only on supporting/u);
  assertInvalid((repository) => {
    mapping(repository, 44).gap_notes = ['Invented gap.'];
  }, /matched status cannot declare gaps/u);
  assertInvalid((repository) => {
    const target = mapping(repository, 43);
    target.opiq_matches = [];
    target.evidence_classification.opiq_material = [];
  }, /partial status requires limited positive/u);
  assertInvalid((repository) => {
    mapping(repository, 43).gap_notes = [];
  }, /partial status requires an explicit gap/u);
  assertInvalid((repository) => {
    const target = mapping(repository, 51);
    target.opiq_matches = structuredClone(mapping(repository, 50).opiq_matches);
    target.evidence_classification.opiq_material = target.opiq_matches.map(({ record_id, programme_type }) => ({ record_id, programme_type }));
  }, /missing status cannot have positive/u);
  assertInvalid((repository) => {
    unassigned(repository).gap_notes = [];
  }, /ambiguous status requires/u);
  assertInvalid((repository) => {
    unassigned(repository).rationale = '';
  }, /must NOT have fewer than 1 characters/u);
  assertInvalid((repository) => {
    const target = mapping(repository, 51);
    target.coverage_status = 'outside_route';
    target.rationale = 'No exact match.';
  }, /explicit foreign scope/u);
  assertInvalid((repository) => {
    mapping(repository, 43).evidence_classification.bridging_content = 'none';
  }, /required must agree/u);
});

test('matched practical, fieldwork, and assessment rows require role-specific evidence', () => {
  for (const [lesson, scope] of [[44, 'practical_work'], [3, 'fieldwork'], [12, 'assessment']]) {
    assertInvalid((repository) => {
      for (const match of mapping(repository, lesson).opiq_matches) match.match_scope = match.match_scope.filter((entry) => entry !== scope);
    }, new RegExp(`requires ${scope} page evidence`, 'u'));
  }
});

test('topic comparison contains exactly eleven Grade 6 IDs and excludes lesson 105', () => {
  assertInvalid((repository) => {
    artifact(repository, 'grade-6-science').artifact.topic_inventory_comparison.pop();
  }, /must contain all 11 topic IDs/u);
  assertInvalid((repository) => {
    const comparisons = artifact(repository, 'grade-6-science').artifact.topic_inventory_comparison;
    comparisons[1].topic_id = comparisons[0].topic_id;
  }, /duplicate topic ID|all 11 topic IDs/u);
  assertInvalid((repository) => {
    artifact(repository, 'grade-6-science').artifact.topic_inventory_comparison[0].topic_id = 'unknown-topic';
  }, /all 11 topic IDs/u);
  assertInvalid((repository) => {
    const comparison = artifact(repository, 'grade-6-science').artifact.topic_inventory_comparison.find((entry) => entry.representation_status === 'not_represented');
    comparison.source_mapping_ids = [unassigned(repository).mapping_id];
    comparison.represented_in_teacher_plan = true;
    comparison.representation_status = 'represented';
  }, /unassigned annual slot|must exactly list/u);
});

test('topic representation references and supplementary-sample wording are strict', () => {
  assertInvalid((repository) => {
    const comparison = artifact(repository, 'grade-6-science').artifact.topic_inventory_comparison.find((entry) => entry.representation_status === 'represented');
    comparison.source_mapping_ids = [];
  }, /must exactly list|represented topic requires/u);
  assertInvalid((repository) => {
    const comparison = artifact(repository, 'grade-6-science').artifact.topic_inventory_comparison.find((entry) => entry.representation_status === 'not_represented');
    comparison.source_mapping_ids = ['unknown-mapping'];
  }, /must exactly list|unknown source mapping/u);
  assertInvalid((repository) => {
    const comparison = artifact(repository, 'grade-6-science').artifact.topic_inventory_comparison.find((entry) => entry.representation_status === 'not_represented');
    comparison.notes = 'Missing from the Grade 6 curriculum.';
  }, /supplementary sample wording|missing official curriculum/u);
});

test('unsupported completeness claims remain false for both routes', () => {
  for (const sourceId of ['grade-5-science', 'grade-6-science']) for (const field of [
    'canonical_opiq_mapping_complete',
    'official_curriculum_complete',
    'exact_grade_official_allocation_claimed',
    'live_opiq_catalogue_complete',
  ]) assertInvalid((repository) => {
    artifact(repository, sourceId).artifact.completeness[field] = true;
  }, new RegExp(field, 'u'));
});

test('extraction statuses require Grade 5 and 6 partial and both Grade 7 deferred', () => {
  for (const [source, status] of [
    ['grade-5-science', 'deferred'],
    ['grade-6-science', 'deferred'],
    ['grade-6-science', 'complete'],
    ['grade-7-geography', 'partial'],
    ['grade-7-science', 'partial'],
  ]) assertInvalid((repository) => {
    repository.extractions.find((entry) => entry.artifact.route_context.source_id === source).artifact.route_context.mapping_status = status;
  }, /expected mapping_status/u);
  assertInvalid((repository) => {
    repository.extractions.find((entry) => entry.artifact.route_context.source_id === 'grade-6-science').artifact.completeness.canonical_opiq_mapping_complete = true;
  }, /canonical Opiq mapping must remain incomplete/u);
});

test('duplicate mapping IDs, unknown fields, and nondeterministic bytes fail', () => {
  assertInvalid((repository) => {
    mapping(repository, 2).mapping_id = mapping(repository, 1).mapping_id;
  }, /duplicate mapping_id/u);
  assertInvalid((repository) => {
    artifact(repository, 'grade-6-science').artifact.unreviewed = true;
  }, /unknown field unreviewed/u);
  const repository = cloneRepository();
  artifact(repository, 'grade-6-science').artifactText += '\n';
  assert.match(render(repository), /serialization is not deterministic/u);
});

test('strict YAML rejects duplicate keys, aliases, and tabs', () => {
  assert.throws(() => parseStrictTeacherWorkPlanCurriculumMap('map_id: one\nmap_id: two\n'), /invalid YAML/u);
  assert.throws(() => parseStrictTeacherWorkPlanCurriculumMap('map_id: &id one\ncopy: *id\n'), /aliases and anchors/u);
  assert.throws(() => parseStrictTeacherWorkPlanCurriculumMap('map_id:\tbad\n'), /tabs are forbidden/u);
});

test('artifact collection order does not change semantic validation', () => {
  const repository = cloneRepository();
  repository.artifacts.reverse();
  assert.deepEqual(validateTeacherWorkPlanCurriculumMapRepository(repository).diagnostics, []);
});

test('check command reports both route counts and the total', () => {
  const result = spawnSync(process.execPath, ['scripts/check-teacher-work-plan-curriculum-maps.mjs'], { cwd: repositoryRoot, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /2 artifacts/u);
  assert.match(result.stdout, /Grade 5 classified 67 source ranges/u);
  assert.match(result.stdout, /Grade 6 classified 101 source ranges/u);
  assert.match(result.stdout, /168 total classified ranges/u);
});
