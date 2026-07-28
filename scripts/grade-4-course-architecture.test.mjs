import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { before, test } from 'node:test';

import {
  buildGrade4CourseArchitectureArtifacts,
  checkGrade4CourseArchitectureFiles,
  validateGrade4CourseArchitecture,
  validateGrade4CourseArchitectureSchemas,
} from './lib/grade-4-course-architecture.mjs';

let baseline;

before(async () => {
  baseline = await buildGrade4CourseArchitectureArtifacts(process.cwd());
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
  const codes = validateGrade4CourseArchitecture(candidate).map((entry) => entry.code);
  assert.ok(codes.includes(code), `expected ${code}; found ${codes.join(', ')}`);
}

test('generated architecture is strict-schema valid and semantically valid', async () => {
  assert.deepEqual(await validateGrade4CourseArchitectureSchemas(process.cwd(), baseline), []);
  assert.deepEqual(validateGrade4CourseArchitecture(baseline), []);
});

test('exact Grade 4 route, record, catalogue and programme classifications reconcile', () => {
  assert.equal(baseline.routes.length, 11);
  assert.equal(baseline.routes.reduce((sum, route) => sum + route.bookInventory.source_records.length, 0), 2212);
  assert.equal(baseline.programme.routeIndex.live_student_kit_count, 31);
  assert.equal(baseline.programme.routeIndex.new_exact_grade_4_student_candidates, 0);
  assert.equal(baseline.programme.routeIndex.simplified_route_count, 2);
  assert.equal(baseline.programme.routeIndex.mixed_route_count, 1);
  assert.equal(baseline.programme.architecture.official_field_gaps.length, 3);
});

test('route identities that must remain separate remain separate', () => {
  const ids = new Set(baseline.programme.routeIndex.routes.map((route) => route.route_id));
  for (const [left, right] of [
    ['grade-4-estonian', 'grade-4-estonian-second-language'],
    ['grade-4-russian', 'grade-4-russian-reading'],
    ['grade-4-mathematics', 'grade-4-mathematics-simplified'],
    ['grade-4-human-studies-and-society', 'grade-4-human-studies-simplified'],
  ]) {
    assert.ok(ids.has(left));
    assert.ok(ids.has(right));
    assert.notEqual(left, right);
  }
});

test('default learner profile is Russian-primary and second-language Estonian', () => {
  assert.deepEqual(baseline.programme.architecture.learner_profile, {
    primary_language: 'ru',
    estonian_subject_route: 'grade-4-estonian-second-language',
    estonian_subject_level: 'A1-A2',
    subject_explanation_language: 'ru',
    subject_support_language: 'et',
    english_role: 'foreign_language',
  });
  const firstLanguage = baseline.programme.architecture.route_strands.find((route) => route.route_id === 'grade-4-estonian');
  assert.equal(firstLanguage.programme_role, 'alternative_language_profile');
});

test('ordinary outcomes stay school-stage II and only simplified outcomes are exact Grade 4', () => {
  const all = baseline.routes.flatMap((route) => route.officialMap.outcomes);
  const exact = all.filter((outcome) => outcome.official_scope.kind === 'exact_grade');
  assert.deepEqual(exact.map((outcome) => outcome.outcome_id).sort(), [
    'ee-plrk-2026-grade4-human-studies-safe-behaviour',
    'ee-plrk-2026-grade4-mathematics-number-range',
  ]);
  assert.ok(all.filter((outcome) => outcome.curriculum === 'ordinary').every((outcome) => (
    outcome.official_scope.kind === 'school_stage'
    && outcome.official_scope.school_stage === 2
    && outcome.official_scope.exact_grade_claimed === false
  )));
});

test('official subject fields and subjects come from the versioned outcome sets', () => {
  const english = baseline.routes.find((route) => (
    route.routeModel.definition.id === 'grade-4-english'
  )).officialMap.outcomes[0];
  assert.equal(english.subject_field, 'võõrkeeled');
  assert.equal(english.official_subject, 'A-võõrkeel');

  const mixed = baseline.routes.find((route) => (
    route.routeModel.definition.id === 'grade-4-human-studies-and-society'
  )).officialMap;
  assert.deepEqual(mixed.official_fields, ['inimeseõpetus', 'ühiskonnaõpetus']);
  assert.ok(mixed.outcomes.every((outcome) => outcome.subject_field === 'sotsiaalained'));
});

test('book inventory accounts for every kit and preserves unknown programme type', () => {
  for (const route of baseline.routes) {
    assert.deepEqual(
      [...new Set(route.bookInventory.books.map((book) => book.kit_id))].sort(),
      [...route.routeModel.definition.included_kit_ids].sort(),
    );
    assert.equal(route.bookInventory.source_audit.computed_record_count, route.routeModel.definition.expected_record_count);
  }
  assert.ok(baseline.routes
    .filter((route) => route.routeModel.definition.programme_type === 'unknown')
    .every((route) => route.bookInventory.books.every((book) => book.programme_type === 'unknown')));
});

test('unknown programme types remain ineligible for ordinary default use', () => {
  const unknownBooks = baseline.routes.flatMap((route) => route.bookInventory.books)
    .filter((book) => book.programme_type === 'unknown');
  assert.equal(unknownBooks.length, 24);
  assert.ok(unknownBooks.every((book) => (
    book.eligibility.internal_source_analysis
    && book.eligibility.curated_core_candidate
    && !book.eligibility.ordinary_default_use
    && book.eligibility.programme_verification_required
  )));
  assert.deepEqual(
    baseline.programme.architecture.release_gate.blocker_codes,
    ['default_core_programme_type_unverified'],
  );
  assert.deepEqual(
    baseline.programme.roadmap.release_blocker_codes,
    ['default_core_programme_type_unverified'],
  );
});

test('topic deduplication is route-bounded and preserves all 2212 record identities', () => {
  let records = 0;
  for (const route of baseline.routes) {
    const refs = route.topicInventory.topics.flatMap((topic) => topic.source_record_ids);
    assert.equal(new Set(refs).size, route.routeModel.definition.expected_record_count);
    assert.ok(route.topicInventory.topics.every((topic) => (
      topic.route_id === route.routeModel.definition.id
      && topic.automatic_translated_topics_used_as_source_prose === false
    )));
    records += refs.length;
  }
  assert.equal(records, 2212);
});

test('authored outcome policy gives every route outcome stable source evidence', () => {
  const alignments = baseline.routes.flatMap((route) => route.officialMap.outcomes.map((outcome) => outcome.source_alignment));
  assert.equal(alignments.length, 12);
  assert.equal(alignments.filter((alignment) => alignment.status === 'verified').length, 2);
  assert.equal(alignments.filter((alignment) => alignment.status === 'partial').length, 10);
  assert.equal(alignments.filter((alignment) => alignment.status === 'ambiguous').length, 0);
  assert.equal(alignments.filter((alignment) => alignment.status === 'missing').length, 0);
  assert.ok(alignments.every((alignment) => alignment.policy_alignment_id && alignment.topic_cluster_refs.length > 0));
});

test('captured task evidence is linked only to exact aligned source records', () => {
  const linked = baseline.routes.flatMap((route) => route.officialMap.outcomes)
    .map((outcome) => outcome.source_alignment)
    .filter((alignment) => alignment.task_evidence_status === 'linked');
  assert.ok(linked.length > 0);
  for (const alignment of linked) {
    assert.ok(alignment.task_evidence_source_record_ids.length > 0);
    assert.ok(alignment.task_evidence_source_record_ids.every((recordId) => alignment.source_record_ids.includes(recordId)));
  }
});

test('programme-policy outcomes do not inherit arbitrary source topics', () => {
  const policyRows = baseline.programme.coverage.rows.filter((row) => (
    row.source_alignment.evidence_layer === 'programme_policy'
  ));
  assert.equal(policyRows.length, 4);
  assert.ok(policyRows.every((row) => (
    row.source_topic_presence === 'not_applicable'
    && row.topic_cluster_refs.length === 0
    && row.source_alignment.source_record_ids.length === 0
    && row.task_evidence_status === 'not_applicable'
  )));
});

test('projects preserve mastery and separate individual evidence', () => {
  assert.equal(baseline.programme.projects.projects.length, 6);
  assert.ok(baseline.programme.mastery.mastery_strands.length >= 5);
  assert.ok(baseline.programme.projects.projects.every((project) => project.individual_grade_4_evidence.length > 10));
  assert.deepEqual(
    [...new Set(baseline.programme.calendar.periods.flatMap((period) => period.project_ids))].sort(),
    baseline.programme.projects.projects.map((project) => project.project_id).sort(),
  );
});

test('project source mappings preserve explicit partial and missing roles', () => {
  const alignments = baseline.programme.projects.projects.flatMap((project) => project.source_alignments);
  assert.equal(alignments.length, 18);
  assert.equal(alignments.filter((alignment) => alignment.status === 'partial').length, 11);
  assert.equal(alignments.filter((alignment) => alignment.status === 'missing').length, 7);
  assert.ok(baseline.programme.projects.projects.every((project) => (
    project.topic_cluster_refs.length
      === new Set(project.source_alignments.flatMap((alignment) => alignment.topic_cluster_refs)).size
  )));
});

test('corrected projects no longer use arbitrary first-sorted topic evidence', () => {
  const byId = new Map(baseline.programme.projects.projects.map((project) => [project.project_id, project]));
  const weather = byId.get('grade-4-project-nature-weather');
  const safeRoute = byId.get('grade-4-project-safe-school-route');
  const environment = byId.get('grade-4-project-responsible-environment');
  assert.ok(weather.source_alignments.some((alignment) => (
    alignment.task_evidence_source_record_ids.includes('grade-4-mathematics-record-70-https-www-opiq-ee-kit-70-chapter-3354-ab6f6300ab')
  )));
  assert.equal(safeRoute.source_alignments.find((alignment) => alignment.route_id === 'grade-4-mathematics').status, 'missing');
  assert.ok(environment.source_alignments.every((alignment) => (
    !alignment.source_record_ids.some((recordId) => recordId.includes('unicellular'))
  )));
});

test('generator contains no positional topic-selection fallback', async () => {
  const source = await readFile('scripts/lib/grade-4-course-architecture.mjs', 'utf8');
  assert.doesNotMatch(source, /topics\s*\[\s*0\s*\]/);
  assert.doesNotMatch(source, /topics\.slice\s*\(/);
});

test('programme-wide outcomes are allocated without hiding the three real route gaps', () => {
  assert.equal(baseline.programme.coverage.summary.missing_route_outcomes, 3);
  for (const outcomeId of [
    'ee-prk-2026-stage2-assessment-formative',
    'ee-prk-2026-stage2-cross-curricular-environment',
    'ee-prk-2026-stage2-general-self-correction',
    'ee-prk-2026-stage2-school-curriculum-class-allocation',
  ]) {
    const row = baseline.programme.coverage.rows.find((candidate) => candidate.outcome_id === outcomeId);
    assert.ok(row.route_ids.length > 0, outcomeId);
    assert.equal(row.coverage_status, 'partial');
  }
  assert.deepEqual(
    baseline.programme.coverage.rows
      .filter((row) => row.coverage_status === 'missing')
      .map((row) => row.outcome_id)
      .sort(),
    [
      'ee-prk-2026-stage2-art-design-process',
      'ee-prk-2026-stage2-physical-education-safe-movement',
      'ee-prk-2026-stage2-technology-sustainable-safe-work',
    ],
  );
});

test('Estonian A1-A2 progression uses bounded subject-term seeds and separate subject evidence', () => {
  assert.ok(baseline.programme.language.subject_strands.every((strand) => strand.target_terms.length >= 2));
  assert.equal(baseline.programme.language.guardrails.subject_understanding_language, 'ru');
  assert.equal(baseline.programme.language.guardrails.estonian_production_separate, true);
  assert.equal(baseline.programme.language.guardrails.translated_query_topics_are_terminology_evidence, false);
});

test('companions are internal, unverified, non-teacher and have standalone fallback', () => {
  const companions = baseline.programme.routeIndex.routes.flatMap((route) => route.companion_candidates);
  assert.equal(companions.length, 31);
  assert.ok(companions.every((candidate) => (
    candidate.visibility === 'internal_only'
    && candidate.access.mode === 'unverified'
    && candidate.check_status === 'not_checked'
    && candidate.standalone_fallback_required
    && !candidate.customer_visible
    && !candidate.teacher_only
  )));
});

test('completeness and release remain honestly blocked', () => {
  const architecture = baseline.programme.architecture;
  assert.equal(architecture.completeness.status, 'partial');
  assert.equal(architecture.completeness.declared_complete, false);
  assert.equal(architecture.release_gate.status, 'blocked');
  assert.equal(architecture.release_gate.publication_ready, false);
  assert.equal(architecture.release_gate.classroom_ready, false);
  assert.equal(architecture.release_gate.effectiveness_claimed, false);
});

test('authored topic-alignment policy is an authoritative generated-input dependency', () => {
  assert.equal(baseline.inputs.alignmentPolicy.artifact_type, 'grade_4_topic_alignment_policy');
  assert.ok(baseline.programme.architecture.provenance.authoritative_inputs.includes(
    'grade-programmes/grade-4/topic-alignment-policy.yaml',
  ));
});

test('rejects unknown Grade 4 route', () => expectCode(
  (candidate) => { candidate.routes[0].routeModel.definition.id = 'grade-4-unknown'; },
  'grade_4_route_set_mismatch',
));

test('rejects adjacent Grade 3 or Grade 5 source', () => expectCode(
  (candidate) => { candidate.routes[0].routeModel.definition.grade = 5; },
  'adjacent_grade_source_forbidden',
));

test('rejects wrong route md_path', () => expectCode(
  (candidate) => { candidate.routes[0].bookInventory.canonical_route.md_path = 'project-files/outputs/wrong.md'; },
  'route_md_path_mismatch',
));

test('rejects route record-count mismatch', () => expectCode(
  (candidate) => { candidate.routes[0].bookInventory.record_count -= 1; },
  'route_record_count_mismatch',
));

test('rejects first-language Estonian as default second-language route', () => expectCode(
  (candidate) => { candidate.programme.architecture.learner_profile.estonian_subject_route = 'grade-4-estonian'; },
  'wrong_default_estonian_route',
));

test('rejects merging Russian and Russian-reading route strands', () => expectCode(
  (candidate) => {
    candidate.programme.architecture.route_strands = candidate.programme.architecture.route_strands
      .filter((route) => route.route_id !== 'grade-4-russian-reading');
  },
  'russian_routes_merged',
));

test('rejects ordinary and simplified route classification merge', () => expectCode(
  (candidate) => { candidate.programme.routeIndex.simplified_route_count = 1; },
  'programme_route_classification_mismatch',
));

test('rejects simplified material in ordinary default', () => expectCode(
  (candidate) => {
    candidate.programme.architecture.route_strands
      .find((route) => route.route_id === 'grade-4-mathematics-simplified').programme_role = 'default_ordinary_core';
  },
  'simplified_route_in_default_core',
));

test('rejects school-stage outcome marked exact Grade 4', () => expectCode(
  (candidate) => {
    candidate.routes[0].officialMap.outcomes[0].official_scope.exact_grade_claimed = true;
  },
  'school_stage_marked_exact_grade',
));

test('rejects exact simplified outcome marked ordinary', () => expectCode(
  (candidate) => {
    candidate.routes.find((route) => route.routeModel.definition.id === 'grade-4-mathematics-simplified')
      .officialMap.outcomes[0].curriculum = 'ordinary';
  },
  'exact_simplified_outcome_marked_ordinary',
));

test('rejects mixed human/society route collapsed to invented field', () => expectCode(
  (candidate) => {
    candidate.routes.find((route) => route.routeModel.definition.id === 'grade-4-human-studies-and-society')
      .officialMap.official_fields = ['human_studies_and_society'];
  },
  'mixed_official_fields_collapsed',
));

test('rejects official outcome absent from 2026/27 index', () => expectCode(
  (candidate) => { candidate.routes[0].officialMap.outcomes[0].outcome_id = 'unknown-outcome'; },
  'unknown_official_outcome',
));

test('rejects heading-only evidence marked verified coverage', () => expectCode(
  (candidate) => {
    candidate.programme.coverage.rows[0].source_topic_presence = 'heading_only';
    candidate.programme.coverage.rows[0].coverage_status = 'verified';
  },
  'heading_only_marked_full_coverage',
));

test('rejects missing prose marked lesson-ready', () => expectCode(
  (candidate) => { candidate.routes[0].coverage.rows[0].lesson_authoring_status = 'ready'; },
  'missing_prose_marked_lesson_ready',
));

test('rejects missing task body marked assessment-ready', () => expectCode(
  (candidate) => {
    candidate.routes[0].coverage.rows[0].task_evidence_status = 'not_captured';
    candidate.routes[0].coverage.rows[0].assessment_evidence_status = 'partial';
  },
  'missing_tasks_marked_assessment_ready',
));

test('rejects missing authored outcome alignment', () => expectCode(
  (candidate) => { candidate.inputs.alignmentPolicy.outcome_alignments.shift(); },
  'topic_alignment_policy_missing',
));

test('rejects alignment source record outside its route', () => expectCode(
  (candidate) => {
    candidate.inputs.alignmentPolicy.outcome_alignments[0].topic_selectors[0].source_record_id = 'grade-4-science-record-unknown';
  },
  'topic_alignment_source_record_unknown',
));

test('rejects task evidence not attached to the selected topic', () => expectCode(
  (candidate) => {
    const alignment = candidate.inputs.alignmentPolicy.outcome_alignments
      .find((entry) => entry.task_evidence.status === 'linked');
    alignment.task_evidence.source_record_ids = [
      candidate.routes.find((route) => route.routeModel.definition.id === alignment.route_id)
        .bookInventory.source_records.at(-1).record_id,
    ];
  },
  'topic_alignment_task_evidence_unlinked',
));

test('rejects generated outcome mapping that differs from authored policy', () => expectCode(
  (candidate) => { candidate.routes[0].officialMap.outcomes[0].source_alignment.topic_cluster_refs = []; },
  'topic_alignment_generated_mismatch',
));

test('rejects arbitrary source topic on a programme-policy outcome', () => expectCode(
  (candidate) => {
    const row = candidate.programme.coverage.rows.find((entry) => (
      entry.source_alignment.evidence_layer === 'programme_policy'
    ));
    row.topic_cluster_refs = [candidate.routes[0].topicInventory.topics[0].topic_id];
  },
  'programme_coverage_alignment_mismatch',
));

test('rejects project route role without authored alignment', () => expectCode(
  (candidate) => { candidate.inputs.alignmentPolicy.project_alignments.shift(); },
  'project_alignment_missing',
));

test('rejects positional or otherwise untraceable project topic ref', () => expectCode(
  (candidate) => {
    candidate.programme.projects.projects[0].topic_cluster_refs.push(
      candidate.routes[0].topicInventory.topics.at(-1).topic_id,
    );
  },
  'project_topic_refs_untraceable',
));

test('rejects ambiguous policy promoted with linked task evidence', () => expectCode(
  (candidate) => {
    candidate.inputs.alignmentPolicy.outcome_alignments
      .find((entry) => entry.task_evidence.status === 'linked').confidence = 'ambiguous';
  },
  'ambiguous_alignment_marked_verified',
));

test('rejects collapsing mixed human and society outcome evidence', () => expectCode(
  (candidate) => {
    const mixed = candidate.routes.find((route) => route.routeModel.definition.id === 'grade-4-human-studies-and-society');
    mixed.officialMap.outcomes[1].source_alignment.topic_cluster_refs = [
      ...mixed.officialMap.outcomes[0].source_alignment.topic_cluster_refs,
    ];
  },
  'mixed_route_alignment_collapsed',
));

test('rejects unknown programme type as ordinary-default eligible', () => expectCode(
  (candidate) => {
    candidate.routes.find((route) => route.routeModel.definition.programme_type === 'unknown')
      .bookInventory.books[0].eligibility.ordinary_default_use = true;
  },
  'unknown_programme_type_marked_ordinary_default',
));

test('rejects route role as proof of unknown programme eligibility', () => expectCode(
  (candidate) => {
    const route = candidate.routes.find((entry) => (
      entry.routeModel.definition.programme_type === 'unknown'
      && entry.routeModel.definition.id === 'grade-4-russian'
    ));
    assert.equal(route.bookInventory.programme_role, 'default_ordinary_core');
    route.bookInventory.books[0].eligibility.ordinary_default_use = true;
  },
  'unknown_programme_type_marked_ordinary_default',
));

test('rejects simplified book marked ordinary default', () => expectCode(
  (candidate) => {
    candidate.routes.find((route) => route.routeModel.definition.programme_type === 'simplified_curriculum')
      .bookInventory.books[0].eligibility.ordinary_default_use = true;
  },
  'nonordinary_programme_marked_ordinary_default',
));

test('rejects mixed-subject book represented as ordinary default', () => expectCode(
  (candidate) => {
    candidate.routes.find((route) => route.routeModel.definition.programme_type === 'mixed_subject')
      .bookInventory.books[0].eligibility.ordinary_default_use = true;
  },
  'nonordinary_programme_marked_ordinary_default',
));

test('rejects unknown programme type without verification gate', () => expectCode(
  (candidate) => {
    candidate.routes.find((route) => route.routeModel.definition.programme_type === 'unknown')
      .bookInventory.books[0].eligibility.programme_verification_required = false;
  },
  'unknown_programme_type_verification_not_required',
));

test('rejects ambiguous programme evidence marked release-ready', () => expectCode(
  (candidate) => { candidate.programme.architecture.release_gate.status = 'ready'; },
  'ambiguous_programme_evidence_marked_release_ready',
));

test('rejects missing programme-type release blocker', () => expectCode(
  (candidate) => {
    candidate.programme.architecture.release_gate.blocker_codes = [];
    candidate.programme.roadmap.release_blocker_codes = [];
  },
  'default_core_programme_type_blocker_missing',
));

test('rejects shared project evidence replacing individual evidence', () => expectCode(
  (candidate) => { candidate.programme.projects.projects[0].individual_grade_4_evidence = ''; },
  'shared_product_replaces_individual_evidence',
));

test('rejects project architecture replacing mastery strands', () => expectCode(
  (candidate) => { candidate.programme.mastery.mastery_strands = []; },
  'project_replaces_mastery',
));

test('rejects customer-visible unverified companion', () => expectCode(
  (candidate) => { candidate.programme.routeIndex.routes[0].companion_candidates[0].customer_visible = true; },
  'unverified_companion_customer_visible',
));

test('rejects teacher-only source presented to pupil', () => expectCode(
  (candidate) => { candidate.programme.routeIndex.routes[0].companion_candidates[0].teacher_only = true; },
  'teacher_only_source_presented_to_pupil',
));

test('rejects optional companion without standalone fallback', () => expectCode(
  (candidate) => { candidate.programme.routeIndex.routes[0].companion_candidates[0].standalone_fallback_required = false; },
  'companion_fallback_missing',
));

test('rejects absent art, technology or PE gap', () => expectCode(
  (candidate) => { candidate.programme.architecture.official_field_gaps.pop(); },
  'missing_official_field_gaps',
));

test('rejects declared completeness', () => expectCode(
  (candidate) => { candidate.programme.architecture.completeness.declared_complete = true; },
  'false_completeness_claim',
));

test('rejects publication-ready or customer-released status', () => expectCode(
  (candidate) => { candidate.programme.architecture.release_gate.publication_ready = true; },
  'publication_readiness_claim_forbidden',
));

test('rejects unsupported national weekly-hours claim', () => expectCode(
  (candidate) => { candidate.programme.calendar.national_weekly_hours_claimed = true; },
  'unsupported_weekly_hours_claim',
));

test('rejects translated query topics used as source prose', () => expectCode(
  (candidate) => { candidate.routes[0].topicInventory.topics[0].automatic_translated_topics_used_as_source_prose = true; },
  'translated_query_metadata_used_as_prose',
));

test('generated artifact bytes are deterministic and current', async () => {
  const rebuilt = await buildGrade4CourseArchitectureArtifacts(process.cwd());
  assert.deepEqual([...rebuilt.files], [...baseline.files]);
  assert.deepEqual(await checkGrade4CourseArchitectureFiles(process.cwd(), baseline), []);
});

test('stale generated artifact is rejected', async () => {
  const candidate = copy();
  const firstPath = candidate.files.keys().next().value;
  candidate.files.set(firstPath, `${candidate.files.get(firstPath)}# mutation\n`);
  const diagnostics = await checkGrade4CourseArchitectureFiles(process.cwd(), candidate);
  assert.ok(diagnostics.some((entry) => entry.code === 'stale_generated_artifact'));
});
