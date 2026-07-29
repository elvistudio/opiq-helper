import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { before, test } from 'node:test';

import {
  buildGrade2CourseArchitectureArtifacts,
  checkGrade2CourseArchitectureFiles,
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

test('exactly 44 route artifacts and eight generated programme YAML artifacts are materialized', () => {
  const routeFiles = [...baseline.files.keys()].filter((name) => name.startsWith('curriculum-maps/grade-2-'));
  const programmeFiles = [...baseline.files.keys()].filter((name) => (
    name.startsWith('grade-programmes/grade-2/') && name.endsWith('.yaml')
  ));
  assert.equal(routeFiles.length, 44);
  assert.equal(programmeFiles.length, 8);
  assert.ok(!baseline.files.has('grade-programmes/grade-2/topic-alignment-policy.yaml'));
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
    route_linked_outcomes: 13,
    missing_route_outcomes: 2,
    exact_grade_outcomes: 0,
    school_stage_outcomes: 15,
  });
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
    foreign_language_status: 'school_curriculum_dependent',
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
  const policyRows = baseline.programme.coverage.rows.filter((row) => row.source_alignment.evidence_layer === 'programme_policy');
  assert.equal(policyRows.length, 4);
  assert.ok(policyRows.every((row) => row.topic_cluster_refs.length === 0));
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
  assert.deepEqual(russian[1].source_kit_ids, ['454']);
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

test('foreign language and physical education remain missing mastery strands', () => {
  assert.deepEqual(
    baseline.programme.mastery.missing_route_strands.map((strand) => strand.field_id),
    ['foreign_language', 'physical_education'],
  );
});

test('all projects are distributed across four planning periods', () => {
  const scheduled = baseline.programme.calendar.periods.flatMap((period) => period.project_ids);
  assert.deepEqual(scheduled, baseline.programme.projects.projects.map((project) => project.project_id));
  assert.ok(baseline.programme.calendar.periods.every((period) => period.project_ids.length === 2));
  assert.deepEqual(
    baseline.programme.calendar.school_specific_placeholders.map((entry) => entry.field_id),
    ['foreign_language', 'physical_education'],
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
    assert.equal(entry.bookInventory.canonical_route.source_archive, manifest.source_archive);
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

test('rejects route-set drift', () => expectCode(
  (candidate) => { candidate.routes.pop(); },
  'grade_2_route_set_mismatch',
));

test('rejects archive and QA path drift', () => {
  expectCode(
    (candidate) => { candidate.routes[0].bookInventory.canonical_route.source_archive = 'project-files/inputs/not-the-route.zip'; },
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
