import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import {
  loadCurriculumMapRepository,
  parseStrictCurriculumYaml,
  validateCurriculumMapRepository,
} from './lib/curriculum-maps.mjs';

let baseline;

before(async () => {
  baseline = await loadCurriculumMapRepository();
});

function cloneRepository() {
  return structuredClone(baseline);
}

function artifact(repository, type) {
  const found = repository.artifacts.find((candidate) => candidate.data.artifact_type === type);
  assert.ok(found, `missing ${type} fixture`);
  return found.data;
}

function routeArtifact(repository, type, sourceId = 'grade-6-science') {
  const found = repository.artifacts.find((candidate) => (
    candidate.data.artifact_type === type
    && candidate.data.canonical_route?.source_id === sourceId
  ));
  assert.ok(found, `missing ${sourceId} ${type} fixture`);
  return found;
}

function grade6Topic(repository, topicId = 'soil-formation-and-properties') {
  const topic = routeArtifact(repository, 'topic_inventory').data.topics.find(
    (candidate) => candidate.topic_id === topicId,
  );
  assert.ok(topic, `missing Grade 6 topic ${topicId}`);
  return topic;
}

function grade7GeographyTopic(repository, topicId = 'geography-introduction-and-research-methods') {
  const topic = routeArtifact(repository, 'topic_inventory', 'grade-7-geography').data.topics.find(
    (candidate) => candidate.topic_id === topicId,
  );
  assert.ok(topic, `missing Grade 7 geography topic ${topicId}`);
  return topic;
}

function errors(repository) {
  return validateCurriculumMapRepository(repository).diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
}

function assertFailsWith(repository, pattern) {
  const found = errors(repository);
  assert.ok(found.length > 0, 'expected validation to fail');
  assert.match(found.map((diagnostic) => `${diagnostic.field} ${diagnostic.reason}`).join('\n'), pattern);
}

test('valid golden bilingual unit and production pilot pass', () => {
  assert.deepEqual(errors(cloneRepository()), []);
});

test('teacher work-plan crosswalk is explicitly delegated to its strict validator', () => {
  const repository = cloneRepository();
  const crosswalk = repository.artifacts.find(
    (candidate) => candidate.data.artifact_type === 'teacher_work_plan_curriculum_map',
  );
  assert.ok(crosswalk);
  assert.deepEqual(errors(repository), []);
});

test('multiple eligible books can contribute to one topic and unit', () => {
  const repository = cloneRepository();
  const unit = artifact(repository, 'thematic_unit');
  const books = new Set(unit.selected_records.map((record) => record.book_id));
  const topic = artifact(repository, 'topic_inventory').topics.find((candidate) => candidate.topic_id === 'water-properties-and-states');
  assert.ok(books.size >= 3);
  assert.ok(new Set(topic.selected_records.map((record) => record.book_id)).size >= 3);
  assert.deepEqual(errors(repository), []);
});

test('one route can grow to multiple thematic units without changing the framework', () => {
  const repository = cloneRepository();
  const original = repository.artifacts.find((candidate) => candidate.data.artifact_type === 'thematic_unit');
  const second = structuredClone(original);
  second.file = 'curriculum-maps/grade-5-science/second-unit-fixture.yaml';
  second.data.map_id = 'grade-5-science-second-unit-fixture';
  second.data.unit_id = 'water-properties-and-states-second-fixture';
  repository.artifacts.push(second);
  assert.deepEqual(errors(repository), []);
});

test('Russian-primary and Estonian-support fields are required by the valid pilot', () => {
  const repository = cloneRepository();
  for (const type of ['book_inventory', 'topic_inventory', 'thematic_unit']) {
    const data = artifact(repository, type);
    assert.equal(data.instruction_language, 'ru');
    assert.equal(data.subject_support_language, 'et');
  }
  assert.deepEqual(errors(repository), []);
});

test('missing Estonian terminology fails', () => {
  const repository = cloneRepository();
  artifact(repository, 'thematic_unit').bilingual_learning.estonian_terminology = [];
  assertFailsWith(repository, /estonian_terminology/u);
});

test('missing Russian explanation target fails', () => {
  const repository = cloneRepository();
  delete artifact(repository, 'thematic_unit').bilingual_learning.primary_subject_explanation_target_ru;
  assertFailsWith(repository, /primary_subject_explanation_target_ru/u);
});

test('URL outside the canonical route fails', () => {
  const repository = cloneRepository();
  artifact(repository, 'thematic_unit').selected_records[0].canonical_url = 'https://www.opiq.ee/kit/999/chapter/1';
  assertFailsWith(repository, /URL must occur exactly once/u);
});

test('wrong grade fails', () => {
  const repository = cloneRepository();
  artifact(repository, 'thematic_unit').grade = 6;
  assertFailsWith(repository, /expected 5, found 6/u);
});

test('wrong subject fails', () => {
  const repository = cloneRepository();
  artifact(repository, 'thematic_unit').subject = 'geography';
  assertFailsWith(repository, /expected science, found geography/u);
});

test('unknown book ID fails', () => {
  const repository = cloneRepository();
  artifact(repository, 'thematic_unit').selected_records[0].book_id = 'unknown-grade-5-book';
  assertFailsWith(repository, /unknown audited book ID/u);
});

test('missing provenance fails', () => {
  const repository = cloneRepository();
  delete artifact(repository, 'thematic_unit').selected_records[0].provenance;
  assertFailsWith(repository, /missing required field provenance/u);
});

test('missing instructional role fails', () => {
  const repository = cloneRepository();
  artifact(repository, 'thematic_unit').selected_records[0].instructional_roles = [];
  assertFailsWith(repository, /instructional_roles/u);
});

test('silent simplified-curriculum selection fails', () => {
  const repository = cloneRepository();
  const unit = artifact(repository, 'thematic_unit');
  const simplified = structuredClone(unit.rejected_duplicate_records.find((record) => record.programme_type === 'simplified_curriculum'));
  simplified.record_id = 'selected-simplified-page';
  delete simplified.rejection_reason;
  unit.selected_records[0] = simplified;
  assertFailsWith(repository, /cannot silently use simplified or unknown programme material/u);
});

test('publisher sequence falsely marked official fails', () => {
  const repository = cloneRepository();
  artifact(repository, 'thematic_unit').grade_allocation.publisher_basis = 'official_exact_grade';
  assertFailsWith(repository, /publisher sequence must remain distinct from official allocation/u);
});

test('verified mapping without course evidence fails', () => {
  const repository = cloneRepository();
  const mapping = artifact(repository, 'thematic_unit').official_curriculum.outcome_mappings[0];
  mapping.coverage_status = 'verified';
  mapping.course_evidence_record_ids = [];
  assertFailsWith(repository, /course_evidence_record_ids/u);
});

test('complete declaration with a missing outcome fails', () => {
  const repository = cloneRepository();
  const unit = artifact(repository, 'thematic_unit');
  const missingId = unit.official_curriculum.outcome_mappings[1].outcome_id;
  unit.official_curriculum.outcome_mappings[1].coverage_status = 'missing';
  unit.coverage_status = 'verified';
  unit.completeness.status = 'complete';
  unit.completeness.declared_complete = true;
  unit.completeness.partial_outcome_ids = [unit.official_curriculum.outcome_mappings[0].outcome_id];
  unit.completeness.missing_outcome_ids = [missingId];
  assertFailsWith(repository, /course cannot be complete while outcomes are partial, missing, or ambiguous/u);
});

test('duplicate topic IDs fail', () => {
  const repository = cloneRepository();
  const topics = artifact(repository, 'topic_inventory').topics;
  topics[1].topic_id = topics[0].topic_id;
  assertFailsWith(repository, /duplicate topic ID/u);
});

test('cover-only book cannot be used as page evidence', () => {
  const repository = cloneRepository();
  const record = artifact(repository, 'thematic_unit').selected_records[0];
  record.record_id = 'cover-only-page';
  record.canonical_url = 'https://www.opiq.ee/Kit/Details/172';
  record.book_id = '5k_loodusõpetus_koolibri_rus';
  record.title = 'Природо­ведение. 5 класс – Opiq';
  record.language = 'ru';
  assertFailsWith(repository, /cover-only book .* cannot be used as page evidence/u);
});

test('Grade 6 route evidence inventory passes with exact accounting', () => {
  const repository = cloneRepository();
  const books = routeArtifact(repository, 'book_inventory').data;
  const topics = routeArtifact(repository, 'topic_inventory').data;
  assert.deepEqual(books.source_audit, {
    source_records: 442,
    canonical_records: 436,
    cover_detail_records_excluded: 6,
    source_books: 6,
    books_with_page_records: 6,
    notes: books.source_audit.notes,
  });
  assert.equal(books.books.reduce((sum, book) => sum + book.canonical_record_count, 0), 436);
  assert.equal(topics.topics.length, 11);
  assert.equal(topics.scope, 'deduplicated_inventory_not_final_annual_sequence');
  assert.deepEqual(errors(repository), []);
});

test('Grade 6 course artifacts are fixed to registered route-scoped paths', () => {
  for (const [field, value, pattern] of [
    ['source_id', 'grade-5-science', /expected topic_inventory at curriculum-maps\/grade-5-science/u],
    ['source_id', 'grade-7-science', /course artifacts are not registered for route grade-7-science/u],
    ['md_path', 'project-files/outputs/opiq_5klass_loodusopetus.md', /canonical_route\/md_path.*expected project-files\/outputs\/opiq_6klass/u],
    ['source_archive', 'project-files/inputs/final-zips/wrong.zip', /canonical_route\/source_archive.*expected project-files\/inputs\/final-zips\/opiq_6klass/u],
    ['qa_path', 'project-files/outputs/wrong-qa.json', /canonical_route\/qa_path.*expected project-files\/outputs\/opiq_6klass/u],
  ]) {
    const repository = cloneRepository();
    routeArtifact(repository, 'topic_inventory').data.canonical_route[field] = value;
    assertFailsWith(repository, pattern);
  }
});

test('Grade 6 manifest record counts and coverage status fail closed', () => {
  for (const count of [435, 437]) {
    const repository = cloneRepository();
    repository.routes['grade-6-science'].source.record_count = count;
    assertFailsWith(repository, new RegExp(`record_count expected 436, found ${count}`, 'u'));
  }
  const repository = cloneRepository();
  repository.routes['grade-6-science'].source.coverage_status = 'verified';
  assertFailsWith(repository, /coverage_status expected available_not_curriculum_verified, found verified/u);
});

test('Grade 6 QA checksum metadata and regular-file evidence are enforced', () => {
  const checksumRepository = cloneRepository();
  checksumRepository.routes['grade-6-science'].qa.checksums.source_archive_sha256 = '0'.repeat(64);
  assertFailsWith(checksumRepository, /source_archive_sha256/u);

  const fileRepository = cloneRepository();
  fileRepository.routes['grade-6-science'].archiveIsRegularFile = false;
  assertFailsWith(fileRepository, /source archive must be a regular file/u);
});

test('Grade 6 book set rejects missing, duplicate, and unknown IDs', () => {
  const missing = cloneRepository();
  routeArtifact(missing, 'book_inventory').data.books.pop();
  assertFailsWith(missing, /archive book .* is missing from the audit/u);

  const duplicate = cloneRepository();
  const duplicateBooks = routeArtifact(duplicate, 'book_inventory').data.books;
  duplicateBooks[1].book_id = duplicateBooks[0].book_id;
  assertFailsWith(duplicate, /duplicate book ID/u);

  const unknown = cloneRepository();
  routeArtifact(unknown, 'book_inventory').data.books[0].book_id = 'unknown-grade-6-book';
  assertFailsWith(unknown, /audited book unknown-grade-6-book is absent/u);
});

test('Grade 6 exact kit ID, language, and per-book counts are enforced', () => {
  const mutations = [
    ['kit_id', 999, /kit metadata does not match source URLs/u],
    ['kit_url', 'https://www.opiq.ee/Kit/Details/8', /kit metadata does not match source URLs/u],
    ['language', 'ru', /expected archive language et/u],
    ['canonical_record_count', 55, /expected 56 canonical records/u],
    ['source_record_count', 56, /expected 57 source records/u],
  ];
  for (const [field, value, pattern] of mutations) {
    const repository = cloneRepository();
    routeArtifact(repository, 'book_inventory').data.books[0][field] = value;
    assertFailsWith(repository, pattern);
  }
});

test('Grade 6 programme-type evidence is exact and remains ambiguous', () => {
  const sourceRepository = cloneRepository();
  routeArtifact(sourceRepository, 'book_inventory').data.books[0].programme_type_evidence.source = 'captured elsewhere';
  assertFailsWith(sourceRepository, /programme_type_evidence\/source expected project-files\/inputs\/final-zips/u);

  const statusRepository = cloneRepository();
  routeArtifact(statusRepository, 'book_inventory').data.books[0].programme_type_evidence.status = 'verified';
  assertFailsWith(statusRepository, /programme_type_evidence\/status expected ambiguous/u);
});

test('Grade 6 book totals, language totals, and source audit totals are enforced', () => {
  const sumRepository = cloneRepository();
  routeArtifact(sumRepository, 'book_inventory').data.books[5].canonical_record_count = 85;
  assertFailsWith(sumRepository, /expected 86 canonical records/u);

  const languageRepository = cloneRepository();
  languageRepository.routes['grade-6-science'].qa.languages.et = 282;
  assertFailsWith(languageRepository, /languages\/et expected 283/u);

  const booksRepository = cloneRepository();
  routeArtifact(booksRepository, 'book_inventory').data.source_audit.books_with_page_records = 5;
  assertFailsWith(booksRepository, /books_with_page_records expected 6/u);

  const coversRepository = cloneRepository();
  routeArtifact(coversRepository, 'book_inventory').data.source_audit.cover_detail_records_excluded = 5;
  assertFailsWith(coversRepository, /cover_detail_records_excluded expected 6/u);
});

test('Grade 6 archive-to-canonical URL and book ownership are enforced', () => {
  const urlRepository = cloneRepository();
  urlRepository.routes['grade-6-science'].archiveRecords[1].url = urlRepository.routes['grade-6-science'].archiveRecords[2].url;
  assertFailsWith(urlRepository, /duplicate source URL/u);

  const ownershipRepository = cloneRepository();
  ownershipRepository.routes['grade-6-science'].records[0].book_id = '5k_loodusõpetus_avita_est';
  assertFailsWith(ownershipRepository, /book_id: expected 5k_loodusõpetus_avita_2025_est, found 5k_loodusõpetus_avita_est/u);
});

test('Grade 6 unknown and foreign-route topic URLs fail', () => {
  const unknown = cloneRepository();
  grade6Topic(unknown).selected_records[0].canonical_url = 'https://www.opiq.ee/kit/269/chapter/999999';
  assertFailsWith(unknown, /URL must occur exactly once/u);

  const foreign = cloneRepository();
  grade6Topic(foreign).selected_records[0].canonical_url = 'https://www.opiq.ee/kit/17/chapter/755';
  assertFailsWith(foreign, /URL must occur exactly once/u);
});

test('Grade 6 topic record IDs and canonical URLs are globally unique', () => {
  const ids = cloneRepository();
  const idTopics = routeArtifact(ids, 'topic_inventory').data.topics;
  idTopics[1].selected_records[0].record_id = idTopics[0].selected_records[0].record_id;
  assertFailsWith(ids, /duplicate topic record ID/u);

  const urls = cloneRepository();
  const topic = grade6Topic(urls);
  topic.alternative_records[0].canonical_url = topic.selected_records[0].canonical_url;
  assertFailsWith(urls, /duplicate topic canonical URL/u);
});

test('Grade 6 topic record metadata must equal canonical evidence', () => {
  for (const [field, value, pattern] of [
    ['title', 'Wrong title', /title expected/u],
    ['book_id', '5k_loodusõpetus_avita_rus', /book_id expected/u],
    ['language', 'et', /language expected/u],
    ['programme_type', 'ordinary', /programme_type expected unknown/u],
  ]) {
    const repository = cloneRepository();
    grade6Topic(repository).selected_records[0][field] = value;
    assertFailsWith(repository, pattern);
  }
});

test('Grade 6 source recommendations resolve only selected or alternative records', () => {
  const repository = cloneRepository();
  grade6Topic(repository).source_recommendations.practice.push('unknown-record');
  assertFailsWith(repository, /unknown selected or alternative record ID unknown-record/u);
});

test('Grade 6 rejected records cannot be selected and require a rejection reason', () => {
  const selectedRepository = cloneRepository();
  const selectedTopic = grade6Topic(selectedRepository);
  selectedTopic.deduplication.rejected_record_ids.push(selectedTopic.selected_records[0].record_id);
  assertFailsWith(selectedRepository, /selected record cannot also be rejected/u);

  const reasonRepository = cloneRepository();
  delete grade6Topic(reasonRepository).rejected_records[0].rejection_reason;
  assertFailsWith(reasonRepository, /missing required field rejection_reason|requires an explicit reason/u);
});

test('Grade 6 selected simplified material remains forbidden', () => {
  const repository = cloneRepository();
  grade6Topic(repository).selected_records[0].programme_type = 'simplified_curriculum';
  assertFailsWith(repository, /cannot silently use simplified or unknown programme material/u);
});

test('Grade 6 topic schema rejects unknown roles, empty selections, and unknown fields', () => {
  const roleRepository = cloneRepository();
  grade6Topic(roleRepository).selected_records[0].instructional_roles = ['invented_role'];
  assertFailsWith(roleRepository, /instructional_roles/u);

  const emptyRepository = cloneRepository();
  grade6Topic(emptyRepository).selected_records = [];
  assertFailsWith(emptyRepository, /selected_records/u);

  const fieldRepository = cloneRepository();
  grade6Topic(fieldRepository).unsupported_claim = true;
  assertFailsWith(fieldRepository, /unknown field unsupported_claim/u);
});

test('Grade 6 duplicate topic IDs fail', () => {
  const repository = cloneRepository();
  const topics = routeArtifact(repository, 'topic_inventory').data.topics;
  topics[1].topic_id = topics[0].topic_id;
  assertFailsWith(repository, /duplicate topic ID/u);
});

test('Grade 6 deterministic YAML serialization is enforced', () => {
  const repository = cloneRepository();
  routeArtifact(repository, 'topic_inventory').text += '\n';
  assertFailsWith(repository, /must use deterministic serialization/u);
});

test('Grade 6 inventory cannot claim official or live-catalogue completeness', () => {
  for (const field of ['official_curriculum_complete', 'live_catalogue_complete']) {
    const repository = cloneRepository();
    routeArtifact(repository, 'topic_inventory').data[field] = true;
    assertFailsWith(repository, new RegExp(`unknown field ${field}`, 'u'));
  }
});

test('Grade 6 teacher plan and publisher sequence cannot be relabelled canonical or official', () => {
  const planRepository = cloneRepository();
  routeArtifact(planRepository, 'topic_inventory').data.teacher_plan_is_canonical = true;
  assertFailsWith(planRepository, /unknown field teacher_plan_is_canonical/u);

  const publisherRepository = cloneRepository();
  routeArtifact(publisherRepository, 'book_inventory').data.books[0].publisher_sequence.official_allocation = true;
  assertFailsWith(publisherRepository, /unknown field official_allocation/u);

  const allocationRepository = cloneRepository();
  grade6Topic(allocationRepository).grade_allocation_basis = 'official_exact_grade';
  assertFailsWith(allocationRepository, /grade_allocation_basis/u);
});

const grade7GeographyTopicIds = [
  'geography-introduction-and-research-methods',
  'earth-shape-size-continents-and-oceans',
  'map-types-atlases-legends-and-generalization',
  'scale-distance-directions-and-orientation',
  'geographic-coordinates',
  'digital-maps-gis-and-satellite-imagery',
  'time-zones-and-date-line',
  'earth-interior-and-plate-tectonics',
  'earthquakes-volcanoes-and-tsunamis',
  'rocks-sediments-and-rock-cycle',
  'relief-landforms-and-elevation-mapping',
  'mountains-plains-and-ocean-floor-relief',
  'landform-change-weathering-erosion-and-human-impact',
  'countries-peoples-and-cultural-diversity',
  'population-distribution-change-migration-and-urbanization',
];

test('Grade 7 geography route evidence inventory passes exact source, language, book, and topic accounting', () => {
  const repository = cloneRepository();
  const route = repository.routes['grade-7-geography'];
  const books = routeArtifact(repository, 'book_inventory', 'grade-7-geography').data;
  const topics = routeArtifact(repository, 'topic_inventory', 'grade-7-geography').data;
  assert.deepEqual(books.source_audit, {
    source_records: 186,
    canonical_records: 178,
    cover_detail_records_excluded: 7,
    administrative_records_excluded: 1,
    source_books: 5,
    books_with_page_records: 5,
    notes: books.source_audit.notes,
  });
  assert.equal(186, 178 + 7 + 1);
  assert.equal(route.records.length, 178);
  assert.deepEqual(route.qa.languages, { et: 102, ru: 76 });
  assert.equal(102 + 76, 178);
  assert.deepEqual(route.qa.checksums, {
    source_archive_sha256: '21d7d516cae1bf756827c6feb1a64a71b0ca85f0deabb6aac6a4732c363acd03',
    output_file_sha256: 'f25b994c32493388ef1f9179e798e0173e9326f13669db9d5a4aa45d3d0d868d',
  });
  assert.deepEqual(books.books.map((book) => ({
    book_id: book.book_id,
    kit_id: book.kit_id,
    title: book.title,
    publisher: book.publisher,
    language: book.language,
    source_record_count: book.source_record_count,
    canonical_record_count: book.canonical_record_count,
  })), [
    { book_id: '7k__geograafia_avita_est', kit_id: 543, title: 'Geograafia 7. klassile', publisher: 'Avita', language: 'et', source_record_count: 29, canonical_record_count: 28 },
    { book_id: '7k__geograafia_koolibri_est', kit_id: 96, title: 'Geograafia 7. klassile', publisher: 'unknown', language: 'et', source_record_count: 38, canonical_record_count: 36 },
    { book_id: '7k__geograafia_loodus_avita_est', kit_id: 2, title: 'Loodusgeograafia 7. klassile', publisher: 'Avita', language: 'et', source_record_count: 39, canonical_record_count: 38 },
    { book_id: '7k__geograafia_koolibri_rus', kit_id: 301, title: 'География 7 класс', publisher: 'Koolibri', language: 'ru', source_record_count: 39, canonical_record_count: 37 },
    { book_id: '7k__geograafia_avita_rus', kit_id: 19, title: 'География для 7 класса', publisher: 'Avita', language: 'ru', source_record_count: 41, canonical_record_count: 39 },
  ]);
  assert.equal(books.books.reduce((sum, book) => sum + book.canonical_record_count, 0), 178);
  assert.deepEqual(topics.topics.map((topic) => topic.topic_id), grade7GeographyTopicIds);
  assert.equal(topics.scope, 'deduplicated_inventory_not_final_annual_sequence');
  assert.deepEqual(errors(repository), []);
});

test('Grade 7 geography topic records are globally unique and equal exact canonical metadata', () => {
  const repository = cloneRepository();
  const inventory = routeArtifact(repository, 'topic_inventory', 'grade-7-geography').data;
  const route = repository.routes['grade-7-geography'];
  const canonicalByUrl = new Map(route.records.map((record) => [record.url, record]));
  const records = inventory.topics.flatMap((topic) => [
    ...topic.selected_records,
    ...topic.alternative_records,
    ...topic.rejected_records,
  ]);
  assert.deepEqual({
    selected: inventory.topics.reduce((sum, topic) => sum + topic.selected_records.length, 0),
    alternative: inventory.topics.reduce((sum, topic) => sum + topic.alternative_records.length, 0),
    rejected: inventory.topics.reduce((sum, topic) => sum + topic.rejected_records.length, 0),
  }, { selected: 64, alternative: 15, rejected: 15 });
  assert.equal(new Set(records.map((record) => record.record_id)).size, records.length);
  assert.equal(new Set(records.map((record) => record.canonical_url)).size, records.length);
  for (const record of records) {
    const canonical = canonicalByUrl.get(record.canonical_url);
    assert.ok(canonical, record.canonical_url);
    assert.equal(record.canonical_source_id, 'grade-7-geography');
    assert.equal(record.book_id, canonical.book_id);
    assert.equal(record.title, canonical.title);
    assert.equal(record.language, canonical.language);
    assert.equal(record.programme_type, 'unknown');
    assert.equal(canonical.class, 7);
    assert.equal(canonical.subject.en, 'geography');
    assert.equal(canonical.subject.et, 'geograafia');
  }
  assert.ok(inventory.topics.every((topic) => topic.selected_records.length > 0));
  assert.deepEqual(errors(repository), []);
});

test('Grade 7 geography inventory registry requires exactly its two route-scoped artifacts', () => {
  for (const type of ['book_inventory', 'topic_inventory']) {
    const repository = cloneRepository();
    repository.artifacts = repository.artifacts.filter((artifact) => !(
      artifact.data.artifact_type === type
      && artifact.data.canonical_route?.source_id === 'grade-7-geography'
    ));
    assertFailsWith(repository, new RegExp(`grade-7-geography requires exactly one ${type}|registered grade-7-geography route evidence was not loaded`, 'u'));
  }

  const extra = cloneRepository();
  const duplicate = structuredClone(routeArtifact(extra, 'topic_inventory', 'grade-7-geography'));
  duplicate.file = 'curriculum-maps/grade-7-geography/extra-topic-inventory.yaml';
  duplicate.data.map_id = 'grade-7-geography-extra-topic-inventory';
  extra.artifacts.push(duplicate);
  assertFailsWith(extra, /requires exactly one topic_inventory, found 2|expected topic_inventory at curriculum-maps\/grade-7-geography/u);
});

test('Grade 7 geography route metadata, checksums, and status fail closed', () => {
  for (const [field, value, pattern] of [
    ['source_id', 'grade-7-science', /course artifacts are not registered for route grade-7-science|expected topic_inventory/u],
    ['md_path', 'project-files/outputs/opiq_7klass_loodusopetus.md', /canonical_route\/md_path.*expected project-files\/outputs\/opiq_7klass_geograafia/u],
    ['source_archive', 'project-files/inputs/final-zips/wrong.zip', /canonical_route\/source_archive.*expected project-files\/inputs\/final-zips\/opiq_7klass/u],
    ['qa_path', 'project-files/outputs/wrong-qa.json', /canonical_route\/qa_path.*expected project-files\/outputs\/opiq_7klass_geograafia_qa/u],
  ]) {
    const repository = cloneRepository();
    routeArtifact(repository, 'topic_inventory', 'grade-7-geography').data.canonical_route[field] = value;
    assertFailsWith(repository, pattern);
  }
  const countRepository = cloneRepository();
  countRepository.routes['grade-7-geography'].source.record_count = 177;
  assertFailsWith(countRepository, /record_count expected 178, found 177/u);

  const statusRepository = cloneRepository();
  statusRepository.routes['grade-7-geography'].source.coverage_status = 'verified';
  assertFailsWith(statusRepository, /coverage_status expected available_not_curriculum_verified, found verified/u);

  for (const field of ['source_archive_sha256', 'output_file_sha256']) {
    const repository = cloneRepository();
    repository.routes['grade-7-geography'].qa.checksums[field] = '0'.repeat(64);
    assertFailsWith(repository, new RegExp(field, 'u'));
  }
});

test('Grade 7 geography source accounting rejects every requested count mutation', () => {
  for (const [field, value, pattern] of [
    ['source_records', 185, /source_records.*expected 186/u],
    ['administrative_records_excluded', 0, /administrative_records_excluded.*expected 1/u],
    ['canonical_records', 177, /canonical_records.*expected 178/u],
    ['cover_detail_records_excluded', 6, /cover_detail_records_excluded.*expected 7/u],
    ['source_books', 4, /source_books.*expected 5/u],
    ['books_with_page_records', 4, /books_with_page_records.*expected 5/u],
  ]) {
    const repository = cloneRepository();
    routeArtifact(repository, 'book_inventory', 'grade-7-geography').data.source_audit[field] = value;
    assertFailsWith(repository, pattern);
  }
  for (const [language, value] of [['et', 101], ['ru', 75]]) {
    const repository = cloneRepository();
    repository.routes['grade-7-geography'].qa.languages[language] = value;
    assertFailsWith(repository, new RegExp(`languages/${language} expected`, 'u'));
  }
});

test('Grade 7 geography book set and exact metadata reject missing, invented, and altered books', () => {
  const missing = cloneRepository();
  routeArtifact(missing, 'book_inventory', 'grade-7-geography').data.books.pop();
  assertFailsWith(missing, /archive book .* is missing from the audit|expected 5, found 4/u);

  const invented = cloneRepository();
  const inventedBooks = routeArtifact(invented, 'book_inventory', 'grade-7-geography').data.books;
  const sixth = structuredClone(inventedBooks[0]);
  sixth.book_id = 'invented-grade-7-geography-book';
  sixth.kit_id = 999;
  sixth.kit_url = 'https://www.opiq.ee/Kit/Details/999';
  inventedBooks.push(sixth);
  assertFailsWith(invented, /audited book invented-grade-7-geography-book is absent|expected 5, found 6/u);

  for (const [index, field, value, pattern] of [
    [0, 'kit_id', 999, /kit metadata does not match source URLs|expected 543/u],
    [0, 'title', 'Wrong title', /title.*expected Geograafia 7\. klassile/u],
    [1, 'publisher', 'Koolibri', /publisher.*expected unknown/u],
    [0, 'language', 'ru', /expected archive language et|language.*expected et/u],
    [0, 'canonical_record_count', 27, /expected 28 canonical records|canonical_record_count.*expected 28/u],
    [0, 'source_record_count', 28, /expected 29 source records|source_record_count.*expected 29/u],
  ]) {
    const repository = cloneRepository();
    routeArtifact(repository, 'book_inventory', 'grade-7-geography').data.books[index][field] = value;
    assertFailsWith(repository, pattern);
  }
});

test('Grade 7 geography programme ambiguity and default eligibility cannot be promoted', () => {
  for (const [field, value, pattern] of [
    ['programme_type', 'ordinary', /programme_type.*expected unknown/u],
    ['eligible_for_ordinary_course', true, /eligible_for_ordinary_course.*expected false/u],
  ]) {
    const repository = cloneRepository();
    routeArtifact(repository, 'book_inventory', 'grade-7-geography').data.books[0][field] = value;
    assertFailsWith(repository, pattern);
  }
  const evidence = cloneRepository();
  routeArtifact(evidence, 'book_inventory', 'grade-7-geography').data.books[0].programme_type_evidence.status = 'verified';
  assertFailsWith(evidence, /programme_type_evidence\/status.*expected ambiguous/u);

  const topicPromotion = cloneRepository();
  grade7GeographyTopic(topicPromotion).selected_records[0].programme_type = 'ordinary';
  assertFailsWith(topicPromotion, /programme_type expected unknown/u);
});

test('Grade 7 geography topic evidence rejects foreign, unknown, duplicate, and altered records', () => {
  for (const [url, pattern] of [
    ['https://www.opiq.ee/kit/546/chapter/30107', /URL must occur exactly once/u],
    ['https://www.opiq.ee/kit/572/chapter/31885', /URL must occur exactly once/u],
    ['https://www.opiq.ee/kit/301/chapter/999999', /URL must occur exactly once/u],
  ]) {
    const repository = cloneRepository();
    grade7GeographyTopic(repository).selected_records[0].canonical_url = url;
    assertFailsWith(repository, pattern);
  }
  for (const [field, value, pattern] of [
    ['title', 'Wrong title', /title expected/u],
    ['language', 'et', /language expected/u],
    ['book_id', '7k__geograafia_avita_rus', /book_id expected/u],
  ]) {
    const repository = cloneRepository();
    grade7GeographyTopic(repository).selected_records[0][field] = value;
    assertFailsWith(repository, pattern);
  }

  const duplicateUrl = cloneRepository();
  const firstTopic = grade7GeographyTopic(duplicateUrl);
  const secondTopic = grade7GeographyTopic(duplicateUrl, grade7GeographyTopicIds[1]);
  secondTopic.alternative_records[0].canonical_url = firstTopic.selected_records[0].canonical_url;
  assertFailsWith(duplicateUrl, /duplicate topic inventory canonical URL/u);

  const duplicateId = cloneRepository();
  grade7GeographyTopic(duplicateId, grade7GeographyTopicIds[1]).selected_records[0].record_id = grade7GeographyTopic(duplicateId).selected_records[0].record_id;
  assertFailsWith(duplicateId, /duplicate topic record ID/u);

  const rejectedSelected = cloneRepository();
  const rejectedTopic = grade7GeographyTopic(rejectedSelected);
  rejectedTopic.selected_records[0] = structuredClone(rejectedTopic.rejected_records[0]);
  assertFailsWith(rejectedSelected, /duplicate topic canonical URL|duplicate topic record ID/u);
});

test('Grade 7 geography stable topic registry rejects missing, duplicate, and unknown IDs', () => {
  const missing = cloneRepository();
  routeArtifact(missing, 'topic_inventory', 'grade-7-geography').data.topics.pop();
  assertFailsWith(missing, /expected stable topic IDs in order|expected 15, found 14/u);

  const duplicate = cloneRepository();
  const duplicateTopics = routeArtifact(duplicate, 'topic_inventory', 'grade-7-geography').data.topics;
  duplicateTopics[1].topic_id = duplicateTopics[0].topic_id;
  assertFailsWith(duplicate, /duplicate topic ID|expected stable topic IDs/u);

  const unknown = cloneRepository();
  routeArtifact(unknown, 'topic_inventory', 'grade-7-geography').data.topics[0].topic_id = 'unknown-geography-topic';
  assertFailsWith(unknown, /expected stable topic IDs/u);
});

test('Grade 7 geography rejects thematic units, completeness claims, and serialization drift', () => {
  const thematic = cloneRepository();
  const unit = structuredClone(thematic.artifacts.find((artifact) => artifact.data.artifact_type === 'thematic_unit'));
  unit.file = 'curriculum-maps/grade-7-geography/unexpected-unit.yaml';
  unit.data.grade = 7;
  unit.data.subject = 'geography';
  unit.data.subject_et = 'geograafia';
  unit.data.canonical_route = structuredClone(routeArtifact(thematic, 'topic_inventory', 'grade-7-geography').data.canonical_route);
  thematic.artifacts.push(unit);
  assertFailsWith(thematic, /thematic units are not registered at this path for grade-7-geography|does not yet permit thematic_unit/u);

  for (const field of ['official_curriculum_complete', 'live_catalogue_complete']) {
    const repository = cloneRepository();
    routeArtifact(repository, 'topic_inventory', 'grade-7-geography').data[field] = true;
    assertFailsWith(repository, new RegExp(`unknown field ${field}`, 'u'));
  }

  const serialization = cloneRepository();
  routeArtifact(serialization, 'topic_inventory', 'grade-7-geography').text += '\n';
  assertFailsWith(serialization, /Grade 7 geography inventory YAML must use deterministic serialization/u);
});

test('course YAML rejects duplicate keys and aliases', () => {
  assert.throws(
    () => parseStrictCurriculumYaml('schema_version: "1.0"\nschema_version: "1.0"\n'),
    /invalid YAML/u,
  );
  assert.throws(
    () => parseStrictCurriculumYaml('schema_version: &version "1.0"\ncopy: *version\n'),
    /[Aa]lias|Excessive/u,
  );
});
