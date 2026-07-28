import assert from 'node:assert/strict';
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

test('projects preserve mastery and separate individual evidence', () => {
  assert.equal(baseline.programme.projects.projects.length, 6);
  assert.ok(baseline.programme.mastery.mastery_strands.length >= 5);
  assert.ok(baseline.programme.projects.projects.every((project) => project.individual_grade_4_evidence.length > 10));
  assert.deepEqual(
    [...new Set(baseline.programme.calendar.periods.flatMap((period) => period.project_ids))].sort(),
    baseline.programme.projects.projects.map((project) => project.project_id).sort(),
  );
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
    candidate.routes[0].coverage.rows[0].task_evidence_status = 'missing';
    candidate.routes[0].coverage.rows[0].assessment_evidence_status = 'partial';
  },
  'missing_tasks_marked_assessment_ready',
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
