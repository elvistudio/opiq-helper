import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { before, test } from 'node:test';

import {
  buildGrade2CourseArchitectureArtifacts,
  checkGrade2CourseArchitectureFiles,
  sourceFaithfulTitle,
  validateGrade2CourseArchitecture,
  validateGrade2CourseArchitectureSchemas,
} from './lib/grade-2-course-architecture.mjs';
import {
  expectedGrade2RecordCounts,
  grade2RouteIds,
} from './lib/grade-2-canonical-sources.mjs';

let baseline;

before(async () => {
  baseline = await buildGrade2CourseArchitectureArtifacts(process.cwd());
});

function copy() {
  const cloned = structuredClone({
    inputs: baseline.inputs,
    routes: baseline.routes,
    programme: baseline.programme,
  });
  return { ...cloned, files: new Map(baseline.files) };
}

function expectCode(mutator, code) {
  const candidate = copy();
  mutator(candidate);
  const codes = validateGrade2CourseArchitecture(candidate).map((entry) => entry.code);
  assert.ok(codes.includes(code), `expected ${code}; found ${codes.join(', ')}`);
}

function route(id, candidate = baseline) {
  return candidate.routes.find((entry) => entry.routeModel.definition.id === id);
}

test('generated architecture is strict-schema valid and semantically valid', async () => {
  assert.deepEqual(await validateGrade2CourseArchitectureSchemas(process.cwd(), baseline), []);
  assert.deepEqual(validateGrade2CourseArchitecture(baseline), []);
});

test('route set, route order and record counts match the manifest contract', () => {
  assert.deepEqual(baseline.routes.map((entry) => entry.routeModel.definition.id), grade2RouteIds);
  assert.deepEqual(
    Object.fromEntries(baseline.routes.map((entry) => [
      entry.routeModel.definition.id,
      entry.bookInventory.source_records.length,
    ])),
    expectedGrade2RecordCounts,
  );
});

test('source model accounts for 2,483 canonical records and 41 books', () => {
  assert.equal(baseline.inputs.model.record_count, 2483);
  assert.equal(baseline.inputs.model.canonical_owners.size, 2483);
  assert.equal(baseline.inputs.model.book_count, 41);
  assert.equal(baseline.programme.routeIndex.canonical_record_total, 2483);
  assert.equal(baseline.programme.routeIndex.book_variant_count, 41);
});

test('exactly 44 route artifacts and nine generated programme YAML artifacts are materialized', () => {
  const routeFiles = [...baseline.files.keys()].filter((name) => name.startsWith('curriculum-maps/grade-2-'));
  const programmeFiles = [...baseline.files.keys()].filter((name) => (
    name.startsWith('grade-programmes/grade-2/') && name.endsWith('.yaml')
  ));
  assert.equal(routeFiles.length, 44);
  assert.equal(programmeFiles.length, 9);
  assert.ok(!baseline.files.has('grade-programmes/grade-2/topic-alignment-policy.yaml'));
  assert.ok(!baseline.files.has('grade-programmes/grade-2/source-relationship-policy.yaml'));
});

test('the authored alignment policy remains an input rather than generated output', () => {
  assert.equal(baseline.inputs.alignmentPolicy.artifact_type, 'grade_2_topic_alignment_policy');
  assert.ok(baseline.inputs.alignmentPolicy.outcome_alignments.length > 0);
});

test('generator does not use positional topic selection or route-wide candidate assignment', async () => {
  const source = await readFile('scripts/lib/grade-2-course-architecture.mjs', 'utf8');
  assert.doesNotMatch(source, /topics\s*\[\s*0\s*\]/u);
  assert.doesNotMatch(source, /topics\.slice\s*\(/u);
  assert.doesNotMatch(source, /official_outcome_candidates:\s*routeOutcomeIds/u);
});

test('all official Grade 2 evidence remains stage I with terminal Grade 3', () => {
  const outcomes = baseline.routes.flatMap((entry) => entry.officialMap.outcomes);
  assert.ok(outcomes.length > 0);
  assert.ok(outcomes.every((outcome) => (
    outcome.official_scope.kind === 'school_stage'
    && outcome.official_scope.school_stage === 1
    && outcome.official_scope.terminal_grade === 3
    && outcome.official_scope.exact_grade_claimed === false
  )));
});

test('programme coverage contains the 15 Grade 2 relevant outcomes without exact-grade claims', () => {
  assert.equal(baseline.programme.coverage.rows.length, 15);
  assert.deepEqual(baseline.programme.coverage.summary, {
    official_outcome_count: 15,
    route_linked_outcomes: 9,
    programme_policy_outcomes: 4,
    missing_route_outcomes: 2,
    exact_grade_outcomes: 0,
    school_stage_outcomes: 15,
  });
});

test('programme coverage preserves one independent alignment for every declared route', () => {
  for (const row of baseline.programme.coverage.rows) {
    assert.deepEqual(row.route_ids, row.route_alignments.map((entry) => entry.route_id));
    assert.equal(new Set(row.route_alignments.map((entry) => entry.route_id)).size, row.route_alignments.length);
  }
  const science = baseline.programme.coverage.rows.find((row) => (
    row.outcome_id === 'ee-prk-2026-stage1-natural-science-guided-inquiry'
  ));
  assert.deepEqual(science.route_ids, ['grade-2-science', 'grade-2-nature-and-human-studies']);
  assert.deepEqual(science.route_alignments.map((entry) => entry.source_alignment.policy_alignment_id), [
    'grade-2-science-guided-inquiry',
    'grade-2-mixed-science-inquiry',
  ]);
  const human = baseline.programme.coverage.rows.find((row) => (
    row.outcome_id === 'ee-prk-2026-stage1-human-studies-rights-duties'
  ));
  assert.deepEqual(human.route_alignments.map((entry) => entry.source_alignment.policy_alignment_id), [
    'grade-2-human-rights-duties',
    'grade-2-mixed-human-rights',
  ]);
});

test('foreign language and physical education remain explicit route gaps', () => {
  assert.deepEqual(
    baseline.programme.architecture.official_field_gaps.map((gap) => gap.field_id),
    ['foreign_language', 'physical_education'],
  );
  assert.deepEqual(baseline.programme.routeIndex.missing_exclusive_route_fields, [
    'foreign_language',
    'physical_education',
  ]);
});

test('Estonian first-language and second-language routes remain separate', () => {
  assert.notEqual(route('grade-2-estonian'), route('grade-2-estonian-second-language'));
  assert.equal(baseline.programme.architecture.learner_profile.estonian_subject_route, 'grade-2-estonian-second-language');
  assert.equal(
    baseline.programme.architecture.route_strands.find((entry) => entry.route_id === 'grade-2-estonian').programme_role,
    'alternative_language_profile',
  );
});

test('Stories default profile uses Russian and Estonian second language only', () => {
  const project = baseline.programme.projects.projects.find((entry) => (
    entry.project_id === 'grade-2-project-stories-books-messages'
  ));
  assert.deepEqual(project.profile_scope.default_route_ids, [
    'grade-2-russian',
    'grade-2-estonian-second-language',
  ]);
  assert.ok(!project.linked_route_ids.includes('grade-2-estonian'));
  assert.deepEqual(project.profile_scope.alternative_profile_extensions, [{
    profile_id: 'first-language-estonian-alternative',
    activation: 'explicit_profile_selection',
    route_ids: ['grade-2-estonian'],
    outcome_ids: ['ee-prk-2026-stage1-estonian-conscious-reading'],
    source_alignment_ids: ['p-stories-estonian'],
    companion_candidate_ids: ['grade-2-estonian-kit-232'],
  }]);
  assert.ok(!project.opiq_companion_candidate_ids.includes('grade-2-estonian-kit-232'));
});

test('the learner profile is Russian-primary with A1 core and bounded A1–A2 stretch', () => {
  assert.deepEqual(baseline.programme.architecture.learner_profile, {
    primary_language: 'ru',
    subject_explanation_language: 'ru',
    subject_support_language: 'et',
    estonian_subject_route: 'grade-2-estonian-second-language',
    estonian_core_level: 'A1',
    estonian_stretch_level: 'A1-A2',
    first_language_estonian_route: 'grade-2-estonian',
    first_language_estonian_activation: 'explicit_profile_selection',
    foreign_language_status: 'mandatory_author_created_core_missing_route',
  });
});

test('mixed nature and human studies route keeps two independent official fields', () => {
  const mixed = route('grade-2-nature-and-human-studies');
  assert.equal(mixed.officialMap.outcomes.length, 2);
  assert.equal(new Set(mixed.officialMap.official_fields).size, 2);
  assert.notDeepEqual(
    mixed.officialMap.outcomes[0].source_alignment.topic_cluster_refs,
    mixed.officialMap.outcomes[1].source_alignment.topic_cluster_refs,
  );
});

test('youth-training routes are supplementary and have no core outcomes', () => {
  for (const id of ['grade-2-kodututarde-training', 'grade-2-noorte-kotkaste-training']) {
    assert.equal(route(id).officialMap.outcomes.length, 0);
    assert.equal(route(id).coverage.rows.length, 0);
    assert.equal(
      baseline.programme.architecture.route_strands.find((entry) => entry.route_id === id).programme_role,
      'supplementary_youth_training',
    );
  }
});

test('youth-training official mapping is explicitly not applicable', () => {
  for (const id of ['grade-2-kodututarde-training', 'grade-2-noorte-kotkaste-training']) {
    const official = route(id).officialMap;
    assert.equal(official.mapping_status, 'not_applicable_supplementary');
    assert.equal(official.official_scope, null);
    assert.deepEqual(official.official_fields, []);
    assert.deepEqual(official.outcomes, []);
    assert.equal(official.allocation_status.curated_grade_2_allocation, 'not_applicable');
  }
});

test('book programme types come from QA metadata and remain explicit', () => {
  const types = new Set(baseline.routes.flatMap((entry) => entry.bookInventory.books.map((book) => book.programme_type)));
  assert.deepEqual([...types].sort(), ['mixed_subject', 'ordinary_curriculum', 'simplified_curriculum', 'supplementary']);
  assert.ok(baseline.routes.flatMap((entry) => entry.bookInventory.books)
    .every((book) => book.programme_type_evidence.basis === 'qa_book_metadata'));
});

test('exact simplified kits are learner-specific opt-ins', () => {
  const expected = ['272', '273', '274', '286', '501'];
  const books = baseline.routes.flatMap((entry) => entry.bookInventory.books)
    .filter((book) => book.eligibility.learner_specific_simplified_use);
  assert.deepEqual(books.map((book) => book.kit_id).sort(), expected);
  assert.ok(books.every((book) => !book.eligibility.ordinary_default_use));
  assert.deepEqual(
    baseline.programme.architecture.learner_specific_book_profiles.map((entry) => entry.kit_id).sort(),
    expected,
  );
});

test('exact supplementary kits are never ordinary default', () => {
  const expected = ['200', '330', '465', '593', '594'];
  const books = baseline.routes.flatMap((entry) => entry.bookInventory.books)
    .filter((book) => book.eligibility.supplementary_use);
  assert.deepEqual(books.map((book) => book.kit_id).sort(), expected);
  assert.ok(books.every((book) => !book.eligibility.ordinary_default_use));
});

test('mixed source and youth sources have dedicated eligibility flags', () => {
  const mixed = route('grade-2-nature-and-human-studies').bookInventory.books[0];
  assert.equal(mixed.eligibility.mixed_subject_use, true);
  assert.equal(mixed.eligibility.ordinary_default_use, false);
  for (const id of ['grade-2-kodututarde-training', 'grade-2-noorte-kotkaste-training']) {
    assert.ok(route(id).bookInventory.books.every((book) => book.eligibility.youth_training_use));
  }
});

test('route-local topic clustering preserves all record identities', () => {
  const refs = baseline.routes.flatMap((entry) => entry.topicInventory.topics.flatMap((topic) => topic.source_record_ids));
  assert.equal(refs.length, 2483);
  assert.equal(new Set(refs).size, 2483);
  assert.equal(baseline.routes.reduce((sum, entry) => sum + entry.topicInventory.topics.length, 0), 2220);
});

test('topic titles are source-faithful rather than inferred from record language', () => {
  assert.deepEqual(sourceFaithfulTitle(['Русский заголовок']), {
    display_title_original: 'Русский заголовок',
    display_title_language: 'ru',
    title_ru: 'Русский заголовок',
    title_et: null,
  });
  assert.deepEqual(sourceFaithfulTitle(['Eestikeelne pealkiri']), {
    display_title_original: 'Eestikeelne pealkiri',
    display_title_language: 'et',
    title_ru: null,
    title_et: 'Eestikeelne pealkiri',
  });
  assert.deepEqual(sourceFaithfulTitle(['Eesti pealkiri', 'Русский заголовок']), {
    display_title_original: 'Eesti pealkiri',
    display_title_language: 'mixed',
    title_ru: 'Русский заголовок',
    title_et: 'Eesti pealkiri',
  });
  assert.deepEqual(sourceFaithfulTitle(['Water / Вода']), {
    display_title_original: 'Water / Вода',
    display_title_language: 'mixed',
    title_ru: null,
    title_et: null,
  });
  assert.deepEqual(sourceFaithfulTitle(['123 + 456']), {
    display_title_original: '123 + 456',
    display_title_language: 'unknown',
    title_ru: null,
    title_et: null,
  });
  const kit578 = route('grade-2-mathematics').topicInventory.topics.find((topic) => (
    topic.kit_ids.includes('578') && topic.original_heading_key === 'arvud ja järgarvud'
  ));
  assert.notEqual(kit578.title_ru, 'Arvud ja järgarvud');
});

test('book and record archive provenance resolves kit 330 to the additional archive', () => {
  const science = route('grade-2-science');
  const additionalPath = 'project-files/inputs/final-zips/opiq_2klass_minu_vaike_kallis_planeet_v2.zip';
  const primaryPath = science.routeModel.definition.source_archive;
  const planet = science.bookInventory.books.find((book) => book.kit_id === '330');
  assert.deepEqual(planet.source_archive_refs, [{
    path: additionalPath,
    role: 'supplementary_book_capture',
  }]);
  assert.ok(science.bookInventory.source_records.filter((record) => record.kit_id === '330')
    .every((record) => record.source_archive_ref.path === additionalPath));
  assert.ok(science.bookInventory.source_records.filter((record) => record.kit_id !== '330')
    .every((record) => record.source_archive_ref.path === primaryPath));
});

test('source relationship policy is authored and never inferred from title similarity', () => {
  assert.equal(baseline.inputs.relationshipPolicy.artifact_type, 'grade_2_source_relationship_policy');
  assert.equal(baseline.inputs.relationshipPolicy.claim_boundary.title_similarity_is_not_evidence, true);
  assert.ok(baseline.inputs.relationshipPolicy.relationships.some((entry) => (
    entry.relationship_id === 'koolibri-science-edition-status-unknown'
    && entry.relationship_type === 'unknown'
  )));
});

test('all seven authored source relationships are traceable to their exact books', () => {
  assert.equal(baseline.inputs.relationshipPolicy.relationships.length, 7);
  for (const relationship of baseline.inputs.relationshipPolicy.relationships) {
    for (const reference of relationship.book_refs) {
      const book = route(reference.route_id).bookInventory.books.find((entry) => (
        entry.kit_id === reference.kit_id
      ));
      assert.ok(book, `${relationship.relationship_id}: missing kit ${reference.kit_id}`);
      assert.ok(book.source_relationship_ids.includes(relationship.relationship_id));
      const reviewedEdition = relationship.relationship_type === 'parallel_language_edition'
        && relationship.evidence_basis.includes('reviewed_body_equivalence');
      assert.equal(book.edition_relationship_ids.includes(relationship.relationship_id), reviewedEdition);
      assert.ok(!Object.hasOwn(book, 'edition_relationships'));
    }
  }
});

test('kit 330 keeps supplementary project support only as a source relationship', () => {
  const planet = route('grade-2-science').bookInventory.books.find((book) => book.kit_id === '330');
  assert.ok(planet.source_relationship_ids.includes('supplementary-planet-project-source'));
  assert.deepEqual(planet.edition_relationship_ids, []);
});

test('Koolibri science unknown relationship is never represented as edition equivalence', () => {
  for (const kitId of ['121', '132']) {
    const book = route('grade-2-science').bookInventory.books.find((entry) => entry.kit_id === kitId);
    assert.ok(book.source_relationship_ids.includes('koolibri-science-edition-status-unknown'));
    assert.deepEqual(book.edition_relationship_ids, []);
  }
});

test('1,530 source records truthfully retain missing task examples', () => {
  const missing = baseline.inputs.model.routes.flatMap((entry) => entry.canonical_records)
    .filter((record) => record.task_examples.length === 0);
  assert.equal(missing.length, 1530);
});

test('topic outcome candidates are the exact reverse index of authored alignments', () => {
  for (const entry of baseline.routes) {
    const expected = new Map(entry.topicInventory.topics.map((topic) => [topic.topic_id, new Set()]));
    for (const outcome of entry.officialMap.outcomes) {
      for (const topicId of outcome.source_alignment.topic_cluster_refs) expected.get(topicId).add(outcome.outcome_id);
    }
    for (const topic of entry.topicInventory.topics) {
      assert.deepEqual(topic.official_outcome_candidates, [...expected.get(topic.topic_id)].sort(), topic.topic_id);
    }
  }
});

test('unaligned topics retain explicit empty candidate lists', () => {
  const unaligned = baseline.routes.flatMap((entry) => entry.topicInventory.topics)
    .filter((topic) => topic.official_outcome_candidates.length === 0);
  assert.equal(unaligned.length, 2203);
  assert.ok(unaligned.every((topic) => Array.isArray(topic.official_outcome_candidates)));
});

test('mixed-route weather and rights topics do not inherit each other outcomes', () => {
  const topics = new Map(route('grade-2-nature-and-human-studies').topicInventory.topics.map((topic) => [
    topic.original_heading_key,
    topic.official_outcome_candidates,
  ]));
  assert.deepEqual(topics.get('прогноз погоды'), ['ee-prk-2026-stage1-natural-science-guided-inquiry']);
  assert.deepEqual(topics.get('право'), ['ee-prk-2026-stage1-human-studies-rights-duties']);
  assert.deepEqual(topics.get('погода'), []);
});

test('every generated candidate is traceable to an exact policy alignment ID', () => {
  for (const entry of baseline.routes) {
    for (const topic of entry.topicInventory.topics) {
      for (const outcomeId of topic.official_outcome_candidates) {
        const outcome = entry.officialMap.outcomes.find((candidate) => candidate.outcome_id === outcomeId);
        assert.match(outcome.source_alignment.policy_alignment_id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        assert.ok(outcome.source_alignment.topic_cluster_refs.includes(topic.topic_id));
      }
    }
  }
});

test('captured task evidence is linked only to selected source records', () => {
  const linked = baseline.routes.flatMap((entry) => entry.officialMap.outcomes)
    .map((outcome) => outcome.source_alignment)
    .filter((alignment) => alignment.task_evidence_status === 'linked');
  assert.ok(linked.length >= 5);
  assert.ok(linked.every((alignment) => alignment.task_evidence_source_record_ids.every(
    (recordId) => alignment.source_record_ids.includes(recordId),
  )));
});

test('programme-policy outcomes do not claim source-topic evidence', () => {
  const policyRows = baseline.programme.coverage.rows.filter((row) => row.programme_policy_alignment !== null);
  assert.equal(policyRows.length, 4);
  assert.ok(policyRows.every((row) => row.topic_cluster_refs.length === 0 && row.route_alignments.length === 0));
});

test('eight projects have exact authored route-role alignments', () => {
  assert.equal(baseline.programme.projects.projects.length, 8);
  for (const project of baseline.programme.projects.projects) {
    assert.equal(project.source_alignments.length, project.linked_route_ids.length);
    assert.deepEqual(
      project.topic_cluster_refs,
      [...new Set(project.source_alignments.flatMap((alignment) => alignment.topic_cluster_refs))].sort(),
    );
  }
});

test('Weather, Water and Safety remains an architecture-only pilot', () => {
  const pilot = baseline.programme.projects.projects.find((project) => (
    project.project_id === 'grade-2-project-weather-water-safety'
  ));
  assert.ok(pilot);
  assert.deepEqual(pilot.linked_route_ids, [
    'grade-2-science',
    'grade-2-mathematics',
    'grade-2-human-studies',
    'grade-2-russian',
    'grade-2-estonian-second-language',
  ]);
  assert.ok(pilot.author_created_components_required.includes('clean-room instructions'));
  assert.deepEqual(pilot.pilot_candidate, { issue: 40, status: 'architecture_ready' });
  assert.deepEqual(pilot.school_specific_outcome_gaps, [{
    outcome_id: 'ee-prk-2026-stage1-physical-education-water-safety',
    source_status: 'missing_route',
    content_strategy: 'author_created_required',
    architecture_status: 'designed',
    lesson_authoring_status: 'not_started',
    replacement_by_human_studies_forbidden: true,
  }]);
});

test('English and physical education have designed author-created architectures', () => {
  const [english, physicalEducation] = baseline.programme.authorCreatedSubjects.subjects;
  assert.equal(english.subject_id, 'grade-2-author-created-english');
  assert.equal(english.target_level, 'beginner_A1');
  assert.equal(english.source_status, 'missing_route');
  assert.equal(english.content_strategy, 'author_created_required');
  assert.equal(english.opiq_companion_status, 'not_available');
  assert.ok(english.annual_progression.some((entry) => entry.includes('short phrases')));
  assert.equal(physicalEducation.subject_id, 'grade-2-author-created-physical-education');
  assert.equal(physicalEducation.mastery_cadence.pattern, 'daily_plus_two_to_three_complete_sessions_weekly');
  assert.equal(physicalEducation.conditional_swimming.status, 'conditional_not_assumed_available');
  assert.equal(physicalEducation.conditional_swimming.competent_adult_supervision_required, true);
  assert.equal(physicalEducation.conditional_swimming.universal_family_access_assumed, false);
});

test('English and physical education link only to natural projects', () => {
  const rolesBySubject = (subjectId) => baseline.programme.projects.projects
    .filter((project) => project.author_created_subject_roles.some((role) => role.subject_id === subjectId))
    .map((project) => project.project_id)
    .sort();
  assert.deepEqual(rolesBySubject('grade-2-author-created-english'), [
    'grade-2-project-home-neighbourhood',
    'grade-2-project-rhythm-sound-celebration',
    'grade-2-project-stories-books-messages',
  ]);
  assert.deepEqual(rolesBySubject('grade-2-author-created-physical-education'), [
    'grade-2-project-living-nature-nearby',
    'grade-2-project-rights-duties-team',
    'grade-2-project-weather-water-safety',
  ]);
  assert.ok(baseline.programme.projects.projects.every((project) => (
    project.author_created_subject_roles.every((role) => role.source_evidence_claimed === false)
  )));
});

test('projects preserve individual subject and Estonian evidence', () => {
  assert.ok(baseline.programme.projects.projects.every((project) => (
    project.individual_grade_2_evidence
    && project.russian_language_or_reading_evidence
    && project.estonian_language_evidence
  )));
});

test('projects never promote youth training to core project routes', () => {
  const routeIds = baseline.programme.projects.projects.flatMap((project) => project.linked_route_ids);
  assert.ok(!routeIds.includes('grade-2-kodututarde-training'));
  assert.ok(!routeIds.includes('grade-2-noorte-kotkaste-training'));
});

test('Russian language and reading remain distinct mastery evidence in one route', () => {
  const russian = baseline.programme.mastery.mastery_strands.filter((strand) => strand.route_id === 'grade-2-russian');
  assert.deepEqual(russian.map((strand) => strand.strand_id), [
    'grade-2-russian-language-mastery',
    'grade-2-russian-reading-mastery',
  ]);
  assert.ok(russian[0].core_skills.some((skill) => skill.includes('language')));
  assert.ok(russian[1].core_skills.some((skill) => skill.includes('reading')));
  assert.deepEqual(russian[0].source_kit_ids, ['186', '292']);
  assert.deepEqual(russian[1].source_kit_ids, ['454']);
});

test('supplementary kit 330 and mixed kit 86 stay outside mandatory mastery and project core', () => {
  const masteryKits = [
    ...baseline.programme.mastery.mastery_strands,
    ...baseline.programme.mastery.subject_strands,
  ].flatMap((strand) => strand.source_kit_ids);
  assert.ok(!masteryKits.includes('330'));
  assert.ok(!baseline.programme.projects.projects.flatMap((project) => project.linked_route_ids)
    .includes('grade-2-nature-and-human-studies'));
});

test('topic programme types are derived from their exact source records', () => {
  const simplified = route('grade-2-mathematics').topicInventory.topics.find((topic) => topic.kit_ids.includes('272'));
  const supplementary = route('grade-2-science').topicInventory.topics.find((topic) => topic.kit_ids.includes('330'));
  assert.ok(simplified.programme_types.includes('simplified_curriculum'));
  assert.ok(supplementary.programme_types.includes('supplementary'));
});

test('identical headings remain separate across ordinary, simplified and supplementary roles', () => {
  const mathematicsKordamine = route('grade-2-mathematics').topicInventory.topics
    .filter((topic) => topic.original_heading_key === 'kordamine');
  const scienceIntroductions = route('grade-2-science').topicInventory.topics
    .filter((topic) => topic.original_heading_key === 'sissejuhatus');
  assert.deepEqual(mathematicsKordamine.map((topic) => topic.programme_types[0]), [
    'ordinary_curriculum',
    'simplified_curriculum',
  ]);
  assert.deepEqual(scienceIntroductions.map((topic) => topic.programme_types[0]), [
    'ordinary_curriculum',
    'supplementary',
  ]);
});

test('Estonian second language and mathematics remain daily or near daily', () => {
  for (const id of ['grade-2-estonian-second-language', 'grade-2-mathematics']) {
    assert.equal(
      baseline.programme.mastery.mastery_strands.find((strand) => strand.route_id === id).cadence,
      'daily_or_near_daily',
    );
  }
});

test('science, human studies, arts and music remain regular subject strands', () => {
  assert.deepEqual(
    baseline.programme.mastery.subject_strands.map((strand) => strand.route_id),
    ['grade-2-science', 'grade-2-human-studies', 'grade-2-arts-and-crafts', 'grade-2-music'],
  );
  assert.ok(baseline.programme.mastery.subject_strands.every((strand) => strand.cadence === 'regular_weekly'));
});

test('English and physical education are mandatory author-created mastery strands', () => {
  assert.deepEqual(
    baseline.programme.mastery.author_created_strands.map((strand) => strand.subject_id),
    ['grade-2-author-created-english', 'grade-2-author-created-physical-education'],
  );
  assert.ok(baseline.programme.mastery.author_created_strands.every((strand) => (
    strand.content_strategy === 'author_created_required'
  )));
});

test('all projects are distributed across four planning periods', () => {
  const scheduled = baseline.programme.calendar.periods.flatMap((period) => period.project_ids);
  assert.deepEqual(scheduled, baseline.programme.projects.projects.map((project) => project.project_id));
  assert.ok(baseline.programme.calendar.periods.every((period) => period.project_ids.length === 2));
  assert.deepEqual(
    baseline.programme.calendar.author_created_required_subjects.map((entry) => entry.subject_id),
    ['grade-2-author-created-english', 'grade-2-author-created-physical-education'],
  );
});

test('Opiq remains internal, unverified, optional and replaceable by standalone content', () => {
  for (const candidate of baseline.programme.routeIndex.routes.flatMap((entry) => entry.companion_candidates)) {
    assert.equal(candidate.visibility, 'internal_only');
    assert.equal(candidate.access.mode, 'unverified');
    assert.equal(candidate.check_status, 'not_checked');
    assert.equal(candidate.customer_visible, false);
    assert.equal(candidate.standalone_fallback_required, true);
    assert.equal(typeof candidate.programme_type, 'string');
    assert.equal(typeof candidate.learner_specific_opt_in_required, 'boolean');
  }
});

test('completeness and release readiness remain blocked', () => {
  assert.equal(baseline.programme.architecture.completeness.status, 'partial');
  assert.equal(baseline.programme.architecture.completeness.declared_complete, false);
  assert.equal(baseline.programme.architecture.release_gate.status, 'blocked');
  assert.equal(baseline.programme.architecture.release_gate.publication_ready, false);
  assert.equal(baseline.programme.architecture.release_gate.classroom_ready, false);
  assert.equal(baseline.programme.architecture.release_gate.effectiveness_claimed, false);
});

test('required release blockers are exact and deterministic', () => {
  assert.deepEqual(baseline.programme.architecture.release_gate.blocker_codes, [
    'final_riigi_teataja_refresh_pending_under_37',
    'official_baseline_intentionally_non_exhaustive',
    'live_grade_2_opiq_catalogue_completeness_unverified',
    'full_instructional_prose_not_captured',
    'task_examples_missing_for_1530_records',
    'foreign_language_route_missing',
    'physical_education_route_missing',
    'standalone_commercial_core_not_implemented',
    'clean_room_task_bank_not_implemented',
    'originality_review_not_applicable_to_absent_materials',
    'customer_companion_access_not_verified',
    'pedagogical_effectiveness_not_established',
  ]);
});

test('canonical route paths exactly match source-manifest paths', () => {
  for (const entry of baseline.routes) {
    const manifest = baseline.inputs.manifest.sources.find((source) => source.id === entry.routeModel.definition.id);
    assert.equal(entry.bookInventory.canonical_route.md_path, manifest.md_path);
    assert.equal(entry.bookInventory.canonical_route.qa_path, manifest.qa_path);
    assert.equal(entry.bookInventory.canonical_route.primary_source_archive, manifest.source_archive);
    assert.deepEqual(
      entry.bookInventory.canonical_route.additional_source_archives,
      (manifest.additional_source_archives ?? []).map(({ path, role, source_book_ids: sourceBookIds }) => ({
        path,
        role,
        source_book_ids: [...sourceBookIds].sort(),
      })),
    );
  }
});

test('generated files are byte-current', async () => {
  assert.deepEqual(await checkGrade2CourseArchitectureFiles(process.cwd(), baseline), []);
});

test('generation is byte-deterministic', async () => {
  const second = await buildGrade2CourseArchitectureArtifacts(process.cwd());
  assert.deepEqual([...second.files.entries()], [...baseline.files.entries()]);
});

test('documentation states claim boundaries', async () => {
  const docs = await readFile('docs/grade-2-course-architecture.md', 'utf8');
  assert.match(docs, /stage-I scope/u);
  assert.match(docs, /Weather, Water and Safety/u);
  assert.match(docs, /commercial release gate is \*\*blocked\*\*/u);
});

test('rejects an unaligned topic outcome candidate', () => expectCode(
  (candidate) => {
    const topic = route('grade-2-nature-and-human-studies', candidate).topicInventory.topics
      .find((entry) => entry.original_heading_key === 'погода');
    topic.official_outcome_candidates = ['ee-prk-2026-stage1-human-studies-rights-duties'];
  },
  'topic_outcome_candidate_unaligned',
));

test('rejects a missing aligned topic outcome candidate', () => expectCode(
  (candidate) => {
    const mixed = route('grade-2-nature-and-human-studies', candidate);
    const topicId = mixed.officialMap.outcomes[0].source_alignment.topic_cluster_refs[0];
    mixed.topicInventory.topics.find((topic) => topic.topic_id === topicId).official_outcome_candidates = [];
  },
  'topic_outcome_candidate_missing',
));

test('rejects route-wide fallback topic candidates', () => expectCode(
  (candidate) => {
    const mixed = route('grade-2-nature-and-human-studies', candidate);
    const universe = mixed.officialMap.outcomes.map((outcome) => outcome.outcome_id).sort();
    for (const topic of mixed.topicInventory.topics) topic.official_outcome_candidates = universe;
  },
  'topic_outcome_candidates_route_fallback',
));

test('rejects collapsed mixed-route authored mappings', () => expectCode(
  (candidate) => {
    const mixed = route('grade-2-nature-and-human-studies', candidate);
    mixed.officialMap.outcomes[1].source_alignment.topic_cluster_refs = [
      ...mixed.officialMap.outcomes[0].source_alignment.topic_cluster_refs,
    ];
  },
  'mixed_route_alignment_collapsed',
));

test('rejects collapsed art and technology authored mappings', () => expectCode(
  (candidate) => {
    const arts = route('grade-2-arts-and-crafts', candidate);
    arts.officialMap.outcomes[1].source_alignment.topic_cluster_refs = [
      ...arts.officialMap.outcomes[0].source_alignment.topic_cluster_refs,
    ];
  },
  'arts_technology_alignment_collapsed',
));

test('rejects unknown authored topic selector', () => expectCode(
  (candidate) => {
    candidate.inputs.alignmentPolicy.outcome_alignments[0].topic_selectors = [
      { original_heading_key: 'not-a-real-heading' },
    ];
  },
  'topic_alignment_heading_unknown',
));

test('rejects task evidence that is not on an aligned captured-task record', () => expectCode(
  (candidate) => {
    const entry = candidate.inputs.alignmentPolicy.outcome_alignments.find((alignment) => (
      alignment.alignment_id === 'grade-2-estonian-conscious-reading'
    ));
    entry.task_evidence = {
      status: 'linked',
      source_record_ids: ['grade-2-estonian-record-232-https-www-opiq-ee-kit-232-chapter-15700-f131e1fe40'],
    };
  },
  'topic_alignment_task_evidence_unlinked',
));

test('rejects exact-grade claims for ordinary stage-I outcomes', () => expectCode(
  (candidate) => {
    route('grade-2-science', candidate).officialMap.outcomes[0].official_scope = {
      kind: 'exact_grade',
      grade: 2,
      exact_grade_claimed: true,
    };
  },
  'school_stage_marked_exact_grade',
));

test('rejects simplified book ordinary-default eligibility', () => expectCode(
  (candidate) => {
    route('grade-2-mathematics', candidate).bookInventory.books
      .find((book) => book.kit_id === '272').eligibility.ordinary_default_use = true;
  },
  'nonordinary_programme_marked_ordinary_default',
));

test('rejects simplified source in the default mathematics mastery strand', () => expectCode(
  (candidate) => {
    candidate.programme.mastery.mastery_strands
      .find((strand) => strand.route_id === 'grade-2-mathematics').source_kit_ids.push('272');
  },
  'mastery_nonordinary_source',
));

test('rejects supplementary book ordinary-default eligibility', () => expectCode(
  (candidate) => {
    route('grade-2-science', candidate).bookInventory.books
      .find((book) => book.kit_id === '330').eligibility.ordinary_default_use = true;
  },
  'nonordinary_programme_marked_ordinary_default',
));

test('rejects companion eligibility that hides simplified opt-in', () => expectCode(
  (candidate) => {
    const mathematics = candidate.programme.routeIndex.routes.find((entry) => entry.route_id === 'grade-2-mathematics');
    mathematics.companion_candidates.find((entry) => entry.kit_id === '272').learner_specific_opt_in_required = false;
  },
  'companion_programme_role_mismatch',
));

test('rejects youth-training route with core outcome coverage', () => expectCode(
  (candidate) => {
    const outcome = structuredClone(route('grade-2-human-studies', candidate).officialMap.outcomes[0]);
    outcome.source_alignment.topic_cluster_refs = [];
    outcome.source_alignment.source_record_ids = [];
    outcome.source_alignment.task_evidence_status = 'not_captured';
    outcome.source_alignment.task_evidence_source_record_ids = [];
    route('grade-2-kodututarde-training', candidate).officialMap.outcomes.push(outcome);
  },
  'supplementary_route_marked_core_curriculum',
));

test('rejects false completeness claim', () => expectCode(
  (candidate) => { candidate.programme.architecture.completeness.declared_complete = true; },
  'false_completeness_claim',
));

test('rejects publication readiness', () => expectCode(
  (candidate) => { candidate.programme.architecture.release_gate.publication_ready = true; },
  'publication_readiness_claim_forbidden',
));

test('rejects a missing Weather, Water and Safety pilot handoff', () => expectCode(
  (candidate) => {
    candidate.programme.projects.projects.find((project) => (
      project.project_id === 'grade-2-project-weather-water-safety'
    )).pilot_candidate = null;
  },
  'weather_water_safety_pilot_missing',
));

test('rejects customer-visible unverified companion', () => expectCode(
  (candidate) => { candidate.programme.routeIndex.routes[0].companion_candidates[0].customer_visible = true; },
  'unverified_companion_customer_visible',
));

test('rejects missing standalone companion fallback', () => expectCode(
  (candidate) => { candidate.programme.routeIndex.routes[0].companion_candidates[0].standalone_fallback_required = false; },
  'companion_fallback_missing',
));

test('rejects teacher-only source presented to the pupil', () => expectCode(
  (candidate) => { candidate.programme.routeIndex.routes[0].companion_candidates[0].teacher_only = true; },
  'teacher_only_source_presented_to_pupil',
));

test('rejects generated project evidence that drifts from authored policy', () => expectCode(
  (candidate) => {
    candidate.programme.projects.projects[0].source_alignments[0].topic_cluster_refs = [];
  },
  'project_alignment_generated_mismatch',
));

test('rejects missing route-outcome policy entry', () => expectCode(
  (candidate) => { candidate.inputs.alignmentPolicy.outcome_alignments.pop(); },
  'topic_alignment_policy_missing',
));

test('rejects duplicate policy alignment IDs', () => expectCode(
  (candidate) => {
    candidate.inputs.alignmentPolicy.project_alignments[0].alignment_id =
      candidate.inputs.alignmentPolicy.outcome_alignments[0].alignment_id;
  },
  'duplicate_topic_alignment_id',
));

test('rejects programme route ID without an independent alignment', () => expectCode(
  (candidate) => {
    const row = candidate.programme.coverage.rows.find((entry) => (
      entry.outcome_id === 'ee-prk-2026-stage1-natural-science-guided-inquiry'
    ));
    row.route_alignments.pop();
  },
  'programme_route_id_without_alignment',
));

test('rejects route alignment without a declared route ID', () => expectCode(
  (candidate) => {
    const row = candidate.programme.coverage.rows.find((entry) => (
      entry.outcome_id === 'ee-prk-2026-stage1-natural-science-guided-inquiry'
    ));
    row.route_ids.pop();
  },
  'programme_route_alignment_without_id',
));

test('rejects duplicate programme route alignment', () => expectCode(
  (candidate) => {
    const row = candidate.programme.coverage.rows.find((entry) => (
      entry.outcome_id === 'ee-prk-2026-stage1-natural-science-guided-inquiry'
    ));
    row.route_alignments.push(structuredClone(row.route_alignments[0]));
  },
  'programme_duplicate_route_alignment',
));

test('rejects copying pure-route alignment into the mixed route', () => expectCode(
  (candidate) => {
    const row = candidate.programme.coverage.rows.find((entry) => (
      entry.outcome_id === 'ee-prk-2026-stage1-natural-science-guided-inquiry'
    ));
    row.route_alignments[1].source_alignment = structuredClone(row.route_alignments[0].source_alignment);
  },
  'programme_coverage_alignment_mismatch',
));

test('rejects transferring task evidence between programme routes', () => expectCode(
  (candidate) => {
    const row = candidate.programme.coverage.rows.find((entry) => (
      entry.outcome_id === 'ee-prk-2026-stage1-natural-science-guided-inquiry'
    ));
    row.route_alignments[1].source_alignment.task_evidence_status = row.route_alignments[0].source_alignment.task_evidence_status;
    row.route_alignments[1].source_alignment.task_evidence_source_record_ids =
      structuredClone(row.route_alignments[0].source_alignment.task_evidence_source_record_ids);
  },
  'programme_coverage_alignment_mismatch',
));

test('rejects first-language Estonian in a default project closure', () => expectCode(
  (candidate) => {
    const project = candidate.programme.projects.projects.find((entry) => (
      entry.project_id === 'grade-2-project-stories-books-messages'
    ));
    project.profile_scope.default_route_ids.push('grade-2-estonian');
  },
  'first_language_estonian_in_default_closure',
));

test('rejects an alternative companion in the default project', () => expectCode(
  (candidate) => {
    const project = candidate.programme.projects.projects.find((entry) => (
      entry.project_id === 'grade-2-project-stories-books-messages'
    ));
    project.opiq_companion_candidate_ids.push('grade-2-estonian-kit-232');
  },
  'alternative_companion_in_default_project',
));

test('rejects an alternative project role without explicit profile activation', () => expectCode(
  (candidate) => {
    candidate.programme.projects.projects.find((entry) => (
      entry.project_id === 'grade-2-project-stories-books-messages'
    )).profile_scope.alternative_profile_extensions = [];
  },
  'project_profile_activation_missing',
));

test('rejects youth-training school-stage scope', () => expectCode(
  (candidate) => {
    const official = route('grade-2-kodututarde-training', candidate).officialMap;
    official.mapping_status = 'mapped_recommended_grade_2_allocation';
    official.official_scope = { kind: 'school_stage', school_stage: 1, terminal_grade: 3, exact_grade_claimed: false };
  },
  'supplementary_route_marked_core_curriculum',
));

test('rejects youth-training curated Grade 2 allocation', () => expectCode(
  (candidate) => {
    route('grade-2-noorte-kotkaste-training', candidate)
      .officialMap.allocation_status.curated_grade_2_allocation = 'opiq_helper_recommended_allocation';
  },
  'supplementary_route_marked_core_curriculum',
));

test('rejects youth-training route in annual project sequence', () => expectCode(
  (candidate) => {
    candidate.programme.projects.projects[0].linked_route_ids.push('grade-2-kodututarde-training');
  },
  'youth_training_used_as_core_project',
));

test('rejects language-specific title inferred only from record metadata', () => expectCode(
  (candidate) => {
    const topic = route('grade-2-estonian', candidate).topicInventory.topics.find((entry) => (
      entry.display_title_language === 'et'
    ));
    topic.title_ru = topic.display_title_original;
  },
  'topic_title_not_source_faithful',
));

test('rejects kit 578 Estonian heading marked as confirmed Russian title', () => expectCode(
  (candidate) => {
    const topic = route('grade-2-mathematics', candidate).topicInventory.topics.find((entry) => (
      entry.kit_ids.includes('578')
    ));
    topic.display_title_language = 'et';
    topic.title_ru = 'Arvud ja järgarvud';
  },
  'kit_578_estonian_heading_marked_russian',
));

test('rejects kit 330 without additional archive provenance', () => expectCode(
  (candidate) => {
    route('grade-2-science', candidate).bookInventory.books
      .find((book) => book.kit_id === '330').source_archive_refs = [];
  },
  'kit_330_additional_archive_provenance_missing',
));

test('rejects kit 330 linked to the primary science archive', () => expectCode(
  (candidate) => {
    const science = route('grade-2-science', candidate);
    science.bookInventory.books.find((book) => book.kit_id === '330').source_archive_refs = [{
      path: science.routeModel.definition.source_archive,
      role: 'primary_route_capture',
    }];
  },
  'kit_330_additional_archive_provenance_missing',
));

test('rejects an unregistered archive reference', () => expectCode(
  (candidate) => {
    route('grade-2-science', candidate).bookInventory.source_records[0].source_archive_ref = {
      path: 'project-files/inputs/final-zips/not-registered.zip',
      role: 'primary_route_capture',
    };
  },
  'record_archive_provenance_mismatch',
));

test('rejects edition equivalence inferred only from titles or metadata', () => expectCode(
  (candidate) => {
    candidate.inputs.relationshipPolicy.relationships
      .find((entry) => entry.relationship_id === 'koolibri-science-edition-status-unknown')
      .relationship_type = 'parallel_language_edition';
  },
  'parallel_edition_without_reviewed_evidence',
));

test('rejects a complementary relationship stored as an edition relationship', () => expectCode(
  (candidate) => {
    route('grade-2-science', candidate).bookInventory.books
      .find((book) => book.kit_id === '379').edition_relationship_ids
      .push('avita-science-complementary-editions');
  },
  'non_edition_relationship_misclassified',
));

test('rejects a supplementary project relationship stored as an edition relationship', () => expectCode(
  (candidate) => {
    route('grade-2-science', candidate).bookInventory.books
      .find((book) => book.kit_id === '330').edition_relationship_ids
      .push('supplementary-planet-project-source');
  },
  'non_edition_relationship_misclassified',
));

test('rejects a same-language alternative stored as an edition relationship', () => expectCode(
  (candidate) => {
    route('grade-2-russian', candidate).bookInventory.books
      .find((book) => book.kit_id === '186').edition_relationship_ids
      .push('russian-language-core-alternatives');
  },
  'non_edition_relationship_misclassified',
));

test('rejects an unknown relationship stored as an edition relationship', () => expectCode(
  (candidate) => {
    route('grade-2-science', candidate).bookInventory.books
      .find((book) => book.kit_id === '121').edition_relationship_ids
      .push('koolibri-science-edition-status-unknown');
  },
  'non_edition_relationship_misclassified',
));

test('rejects a mixed-support relationship stored as an edition relationship', () => expectCode(
  (candidate) => {
    route('grade-2-nature-and-human-studies', candidate).bookInventory.books
      .find((book) => book.kit_id === '86').edition_relationship_ids
      .push('mixed-human-science-manual-review');
  },
  'non_edition_relationship_misclassified',
));

test('rejects a relationship ID absent from the authored policy', () => expectCode(
  (candidate) => {
    route('grade-2-science', candidate).bookInventory.books
      .find((book) => book.kit_id === '330').source_relationship_ids
      .push('invented-source-relationship');
  },
  'source_relationship_id_unknown',
));

test('rejects stale generated source relationship IDs', () => expectCode(
  (candidate) => {
    route('grade-2-science', candidate).bookInventory.books
      .find((book) => book.kit_id === '330').source_relationship_ids = [];
  },
  'book_source_relationship_ids_stale',
));

test('rejects stale edition IDs after reviewed parallel-edition policy changes', () => expectCode(
  (candidate) => {
    const relationship = candidate.inputs.relationshipPolicy.relationships
      .find((entry) => entry.relationship_id === 'koolibri-science-edition-status-unknown');
    relationship.relationship_type = 'parallel_language_edition';
    relationship.evidence_basis.push('reviewed_body_equivalence');
  },
  'book_edition_relationship_ids_stale',
));

test('rejects an edition relationship ID absent from the authored policy', () => expectCode(
  (candidate) => {
    route('grade-2-science', candidate).bookInventory.books
      .find((book) => book.kit_id === '330').edition_relationship_ids
      .push('invented-edition-relationship');
  },
  'edition_relationship_id_unknown',
));

test('rejects supplementary kit 330 in mastery core', () => expectCode(
  (candidate) => {
    candidate.programme.mastery.subject_strands
      .find((strand) => strand.route_id === 'grade-2-science').source_kit_ids.push('330');
  },
  'mastery_nonordinary_source',
));

test('rejects mixed route in mandatory subject core', () => expectCode(
  (candidate) => {
    const strand = structuredClone(candidate.programme.mastery.subject_strands[0]);
    strand.strand_id = 'grade-2-mixed-mandatory-core';
    strand.route_id = 'grade-2-nature-and-human-studies';
    strand.source_kit_ids = ['86'];
    candidate.programme.mastery.subject_strands.push(strand);
  },
  'mastery_nonordinary_source',
));

test('rejects English or PE counted as a source-supported route outcome', () => expectCode(
  (candidate) => {
    const pe = candidate.programme.coverage.rows.find((row) => (
      row.outcome_id === 'ee-prk-2026-stage1-physical-education-water-safety'
    ));
    const human = candidate.programme.coverage.rows.find((row) => (
      row.outcome_id === 'ee-prk-2026-stage1-human-studies-rights-duties'
    ));
    pe.route_ids = ['grade-2-human-studies'];
    pe.route_alignments = [structuredClone(human.route_alignments[0])];
  },
  'programme_coverage_alignment_mismatch',
));

test('rejects English or PE without author-created-required semantics', () => expectCode(
  (candidate) => {
    candidate.programme.authorCreatedSubjects.subjects[0].content_strategy = 'source_supported';
  },
  'author_created_subject_contract_invalid',
));

test('rejects publication-ready English or PE architecture', () => expectCode(
  (candidate) => {
    candidate.programme.authorCreatedSubjects.subjects[1].release_status = 'ready';
  },
  'author_created_subject_contract_invalid',
));

test('rejects human studies as replacement for PE water safety', () => expectCode(
  (candidate) => {
    candidate.programme.projects.projects.find((entry) => (
      entry.project_id === 'grade-2-project-weather-water-safety'
    )).school_specific_outcome_gaps[0].replacement_by_human_studies_forbidden = false;
  },
  'water_safety_replacement_boundary_missing',
));

test('rejects swimming architecture without conditional access and supervision', () => expectCode(
  (candidate) => {
    candidate.programme.authorCreatedSubjects.subjects[1]
      .conditional_swimming.competent_adult_supervision_required = false;
  },
  'conditional_swimming_safety_invalid',
));

test('rejects any missing required annual project', () => expectCode(
  (candidate) => {
    candidate.programme.projects.projects.pop();
  },
  'required_project_sequence_incomplete',
));

test('rejects English or PE artificially attached to all projects', () => expectCode(
  (candidate) => {
    for (const project of candidate.programme.projects.projects) {
      if (!project.author_created_subject_roles.some((role) => (
        role.subject_id === 'grade-2-author-created-english'
      ))) {
        project.author_created_subject_roles.push({
          role_id: `${project.project_id}-english-role`,
          subject_id: 'grade-2-author-created-english',
          role: 'artificial English role',
          official_outcome_ids: [],
          source_evidence_claimed: false,
        });
      }
    }
  },
  'author_created_subject_forced_into_all_projects',
));

test('rejects fake Opiq companion for English or PE', () => expectCode(
  (candidate) => {
    candidate.programme.authorCreatedSubjects.subjects[0].opiq_companion_status = 'internal_candidate';
  },
  'author_created_subject_contract_invalid',
));

test('rejects Russian reading strand without kit 454', () => expectCode(
  (candidate) => {
    candidate.programme.mastery.mastery_strands
      .find((strand) => strand.strand_id === 'grade-2-russian-reading-mastery').source_kit_ids = ['292'];
  },
  'russian_kit_role_mismatch',
));

test('rejects kit 454 as Russian language or grammar core', () => expectCode(
  (candidate) => {
    candidate.programme.mastery.mastery_strands
      .find((strand) => strand.strand_id === 'grade-2-russian-language-mastery').source_kit_ids = ['186', '292', '454'];
  },
  'russian_kit_role_mismatch',
));

test('Grade 2 generation never emits or rewrites Grade 4 artifacts', () => {
  assert.ok([...baseline.files.keys()].every((file) => (
    !file.startsWith('curriculum-maps/grade-4-') && !file.startsWith('grade-programmes/grade-4/')
  )));
});

test('rejects route-set drift', () => expectCode(
  (candidate) => { candidate.routes.pop(); },
  'grade_2_route_set_mismatch',
));

test('rejects archive and QA path drift', () => {
  expectCode(
    (candidate) => { candidate.routes[0].bookInventory.canonical_route.primary_source_archive = 'project-files/inputs/not-the-route.zip'; },
    'route_archive_path_mismatch',
  );
  expectCode(
    (candidate) => { candidate.routes[0].bookInventory.canonical_route.qa_path = 'project-files/outputs/not-the-route.json'; },
    'route_qa_path_mismatch',
  );
});

test('rejects canonical record-total drift', () => expectCode(
  (candidate) => { candidate.routes[0].bookInventory.source_records.pop(); },
  'canonical_record_total_mismatch',
));

test('rejects release-blocker drift', () => expectCode(
  (candidate) => { candidate.programme.architecture.release_gate.blocker_codes.pop(); },
  'release_blocker_set_mismatch',
));
