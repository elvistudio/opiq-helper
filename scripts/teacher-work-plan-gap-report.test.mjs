import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  GAP_REPORT_JSON_PATH,
  GAP_REPORT_MARKDOWN_PATH,
  buildTeacherWorkPlanGapReport,
  loadCommittedTeacherWorkPlanGapReportArtifacts,
  renderTeacherWorkPlanGapReportMarkdown,
  serializeTeacherWorkPlanGapReport,
  validateTeacherWorkPlanGapReport,
} from './lib/teacher-work-plan-gap-report.mjs';
import {
  loadTeacherWorkPlanCurriculumMapRepository,
} from './lib/teacher-work-plan-curriculum-maps.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const crosswalkRepository = await loadTeacherWorkPlanCurriculumMapRepository({ rootDir: repositoryRoot });
const report = await buildTeacherWorkPlanGapReport({
  rootDir: repositoryRoot,
  repository: crosswalkRepository,
});
const committed = await loadCommittedTeacherWorkPlanGapReportArtifacts({ rootDir: repositoryRoot });
const schema = committed.schema;

const expectedCrosswalks = Object.freeze({
  'grade-5-science': Object.freeze({
    path: 'curriculum-maps/grade-5-science/teacher-work-plan-crosswalk.yaml',
    sha256: 'a54c9938ffdee22353921f8ccc1b1bec386a231c91d541dd67d2883042eb6792',
  }),
  'grade-6-science': Object.freeze({
    path: 'curriculum-maps/grade-6-science/teacher-work-plan-crosswalk.yaml',
    sha256: '42a5c44db048906ed209fbfe9d8ad929e20edac50b72d927e1e2adc0924d5836',
  }),
  'grade-7-geography': Object.freeze({
    path: 'curriculum-maps/grade-7-geography/teacher-work-plan-crosswalk.yaml',
    sha256: '8f610bc0547f2794ef698df49bb4809021432d0276bb1d094ce32177762e7c8f',
  }),
  'grade-7-science': Object.freeze({
    path: 'curriculum-maps/grade-7-science/teacher-work-plan-crosswalk.yaml',
    sha256: '09293bc1d00882b23c93fad66735bd75f668776adcde58a51c48ed7f414888c0',
  }),
});

function cloneReport() {
  return structuredClone(report);
}

function diagnostics(candidate) {
  return validateTeacherWorkPlanGapReport(candidate, {
    schema,
    repository: crosswalkRepository,
  }).diagnostics;
}

function renderedDiagnostics(candidate) {
  return diagnostics(candidate).map(({ field, reason }) => `${field}: ${reason}`).join('\n');
}

function assertInvalid(mutate, pattern = /./u) {
  const candidate = cloneReport();
  mutate(candidate);
  const output = renderedDiagnostics(candidate);
  assert.notEqual(output, '', 'expected gap report validation to fail');
  assert.match(output, pattern);
}

function routeSummary(sourceId) {
  return report.route_summaries.find((entry) => entry.source_id === sourceId);
}

function artifact(sourceId) {
  return crosswalkRepository.artifacts.find((entry) => entry.contract.sourceId === sourceId);
}

function allMappings(entry) {
  return [
    ...entry.artifact.lesson_range_mappings,
    ...(entry.artifact.unnumbered_source_mappings ?? []),
  ];
}

function sha256(text) {
  return crypto.createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

test('production report validates and uses four exact input routes in order', () => {
  const first = validateTeacherWorkPlanGapReport(cloneReport(), {
    schema,
    repository: crosswalkRepository,
  });
  const second = validateTeacherWorkPlanGapReport(cloneReport(), {
    schema,
    repository: crosswalkRepository,
  });
  assert.deepEqual(first, second);
  assert.deepEqual(first.diagnostics, []);
  assert.deepEqual(report.scope.routes, Object.keys(expectedCrosswalks));
  assert.deepEqual(report.inputs.map(({ source_id }) => source_id), Object.keys(expectedCrosswalks));
  assert.deepEqual(report.route_summaries.map(({ source_id }) => source_id), Object.keys(expectedCrosswalks));
});

test('semantic review and four internal-draft reusable implementations are exact', () => {
  assert.deepEqual(report.work_package_review, {
    review_id: 'grades-5-7-priority-work-packages',
    path: 'evaluations/teacher-work-plans/grades-5-7-priority-work-packages.yaml',
    priority_gap_count: 17,
    work_package_count: 16,
    ready_for_authoring_count: 13,
    blocked_teacher_review_count: 3,
    multi_gap_package_count: 1,
    selected_pilot_package_id: 'grade-6-science-soil-organisms',
    semantic_work_package_review_complete: true,
  });
  assert.equal(report.boundaries.semantic_work_package_review_complete, true);
  assert.deepEqual(report.reusable_artifact_implementation, {
    implemented_package_count: 4,
    implemented_source_gap_count: 5,
    delivered_capability_count: 19,
    human_review_workflow_count: 4,
    teacher_review_pending_count: 4,
    local_safety_review_pending_count: 4,
    completed_human_review_record_count: 0,
    classroom_trial_workflow_count: 4,
    completed_classroom_trial_record_count: 0,
    classroom_trial_not_tested_count: 4,
    artifacts: [
      {
        package_id: 'grade-6-science-soil-organisms',
        artifact_index_path: 'teacher-work-plan-artifacts/grade-6-science/soil-organisms/artifact-index.yaml',
        implementation_status: 'internal_draft_pending_teacher_review',
        delivered_capability_count: 7,
        supported_gap_ids: ['grade-6-science-lesson-008', 'grade-6-science-lesson-009'],
        opiq_context_record_count: 4,
        human_review: {
          registry_path: 'teacher-work-plan-artifacts/grade-6-science/soil-organisms/reviews/review-registry.yaml',
          workflow_created: true,
          content_fingerprint: '894cc83f54c158485f6d6ba699d8a1298c3e57056e315281b79d69e84f366613',
          teacher_review_status: 'pending', local_safety_review_status: 'pending',
          completed_teacher_review_count: 0, completed_safety_review_count: 0,
          classroom_trial_status: 'not_tested', review_decision_recorded: false,
          classroom_ready: false, publication_ready: false, effectiveness_claimed: false,
        },
        classroom_trial_workflow_created: true,
        classroom_trial_template_path: 'teacher-work-plan-artifacts/grade-6-science/soil-organisms/reviews/classroom-trial-template.yaml',
        completed_classroom_trial_record_count: 0, classroom_trial_status: 'not_tested',
        classroom_ready: false, publication_ready: false, customer_released: false,
        effectiveness_claimed: false, canonical_gap_status_unchanged: true,
        source_gap_resolution_claimed: false,
      },
      {
        package_id: 'grade-6-science-photosynthesis',
        artifact_index_path: 'teacher-work-plan-artifacts/grade-6-science/photosynthesis/artifact-index.yaml',
        implementation_status: 'internal_draft_pending_teacher_review',
        delivered_capability_count: 5,
        supported_gap_ids: ['grade-6-science-lesson-016'],
        opiq_context_record_count: 0,
        human_review: {
          registry_path: 'teacher-work-plan-artifacts/grade-6-science/photosynthesis/reviews/review-registry.yaml',
          workflow_created: true,
          content_fingerprint: '8df9cff3e19c325ba92f931f72c79cf2828a9b03a36fcf80ea19aff430d7db45',
          teacher_review_status: 'pending', local_safety_review_status: 'pending',
          completed_teacher_review_count: 0, completed_safety_review_count: 0,
          classroom_trial_status: 'not_tested', review_decision_recorded: false,
          classroom_ready: false, publication_ready: false, effectiveness_claimed: false,
        },
        classroom_trial_workflow_created: true,
        classroom_trial_template_path: 'teacher-work-plan-artifacts/grade-6-science/photosynthesis/reviews/classroom-trial-template.yaml',
        completed_classroom_trial_record_count: 0, classroom_trial_status: 'not_tested',
        classroom_ready: false, publication_ready: false, customer_released: false,
        effectiveness_claimed: false, canonical_gap_status_unchanged: true,
        source_gap_resolution_claimed: false,
      },
      {
        package_id: 'grade-6-science-garden-field-food-products',
        artifact_index_path: 'teacher-work-plan-artifacts/grade-6-science/garden-field-food-products/artifact-index.yaml',
        implementation_status: 'internal_draft_pending_teacher_review',
        delivered_capability_count: 4,
        supported_gap_ids: ['grade-6-science-lesson-022'],
        opiq_context_record_count: 0,
        human_review: {
          registry_path: 'teacher-work-plan-artifacts/grade-6-science/garden-field-food-products/reviews/review-registry.yaml',
          workflow_created: true,
          content_fingerprint: '999eb50584622bb35dd017a34d7b83536c4face4ebaccd98d12d7768518280ad',
          teacher_review_status: 'pending', local_safety_review_status: 'pending',
          completed_teacher_review_count: 0, completed_safety_review_count: 0,
          classroom_trial_status: 'not_tested', review_decision_recorded: false,
          classroom_ready: false, publication_ready: false, effectiveness_claimed: false,
        },
        classroom_trial_workflow_created: true,
        classroom_trial_template_path: 'teacher-work-plan-artifacts/grade-6-science/garden-field-food-products/reviews/classroom-trial-template.yaml',
        completed_classroom_trial_record_count: 0, classroom_trial_status: 'not_tested',
        classroom_ready: false, publication_ready: false, customer_released: false,
        effectiveness_claimed: false, canonical_gap_status_unchanged: true,
        source_gap_resolution_claimed: false,
      },
      {
        package_id: 'grade-6-science-wood-processing',
        artifact_index_path: 'teacher-work-plan-artifacts/grade-6-science/wood-processing/artifact-index.yaml',
        implementation_status: 'internal_draft_pending_teacher_review',
        delivered_capability_count: 3,
        supported_gap_ids: ['grade-6-science-lesson-038'],
        opiq_context_record_count: 2,
        human_review: {
          registry_path: 'teacher-work-plan-artifacts/grade-6-science/wood-processing/reviews/review-registry.yaml',
          workflow_created: true,
          content_fingerprint: '59689bce711416a1cab4c8df5c5d75113c8e4a1fdec1d5aafc5ed9ecb8981436',
          teacher_review_status: 'pending', local_safety_review_status: 'pending',
          completed_teacher_review_count: 0, completed_safety_review_count: 0,
          classroom_trial_status: 'not_tested', review_decision_recorded: false,
          classroom_ready: false, publication_ready: false, effectiveness_claimed: false,
        },
        classroom_trial_workflow_created: true,
        classroom_trial_template_path: 'teacher-work-plan-artifacts/grade-6-science/wood-processing/reviews/classroom-trial-template.yaml',
        completed_classroom_trial_record_count: 0, classroom_trial_status: 'not_tested',
        classroom_ready: false, publication_ready: false, customer_released: false,
        effectiveness_claimed: false, canonical_gap_status_unchanged: true,
        source_gap_resolution_claimed: false,
      },
    ],
    canonical_gap_status_unchanged: true,
    source_gap_resolution_claimed: false,
  });
  assert.deepEqual(report.authoring_queue, {
    selected_next_package_id: 'grade-6-science-air-composition',
    selected_next_package_status: 'selected_not_started',
    selected_next_gap_ids: ['grade-6-science-lesson-051'],
    selected_next_planned_root: 'teacher-work-plan-artifacts/grade-6-science/air-composition',
    selected_next_material_count: 0,
    selected_next_review_workflow_created: false,
    selected_next_trial_workflow_created: false,
    source_gap_resolution_claimed: false,
  });
  assert.equal(report.boundaries.reusable_teaching_artifacts_created, true);
  assert.equal(report.completeness.reusable_artifact_backlog_complete, false);
});

test('input crosswalk paths and SHA-256 values are exact and current', () => {
  for (const input of report.inputs) {
    const expected = expectedCrosswalks[input.source_id];
    const entry = artifact(input.source_id);
    assert.equal(input.crosswalk_path, expected.path);
    assert.equal(input.crosswalk_sha256, expected.sha256);
    assert.equal(sha256(entry.artifactText), expected.sha256);
    assert.equal(entry.artifactPath, expected.path);
  }
});

test('aggregate source, status, language and topic accounting is exact', () => {
  assert.deepEqual(report.aggregate_summary, {
    route_count: 4,
    lesson_range_mapping_count: 261,
    unnumbered_source_row_count: 1,
    total_source_record_count: 262,
    matched_count: 69,
    partial_count: 176,
    missing_count: 15,
    ambiguous_count: 2,
    outside_route_count: 0,
    gap_item_count: 193,
    mappings_requiring_bridge_or_review: 193,
    mappings_with_russian_evidence: 159,
    mappings_with_estonian_evidence: 200,
    route_local_topic_inventory_count: 55,
    represented_topic_inventory_count: 50,
    not_represented_topic_inventory_count: 5,
    positive_match_occurrence_count: 430,
    unique_positive_evidence_record_count: 223,
    positive_match_counts_by_programme_type: {
      ordinary: 131,
      supplementary: 0,
      teacher_support: 0,
      simplified_curriculum: 0,
      unknown: 299,
    },
    positive_match_counts_by_language: { et: 252, ru: 178 },
    bridge_type_counts: {
      independently_authored_bridge_required: 55,
      independently_authored_practical_required: 62,
      independently_authored_assessment_required: 68,
      teacher_review_required: 8,
    },
    mappings_with_oral_language_support_scope: 6,
    positive_matches_with_oral_answer_et_role: 19,
  });
  assert.equal(69 + 176 + 15 + 2, 262);
  assert.equal(176 + 15 + 2, 193);
  assert.equal(55 + 62 + 68 + 8, 193);
});

test('per-route summaries reproduce every production crosswalk baseline', () => {
  assert.deepEqual(
    report.route_summaries.map((entry) => ({
      source_id: entry.source_id,
      lesson_ranges: entry.lesson_range_mapping_count,
      unnumbered: entry.unnumbered_source_row_count,
      total: entry.total_source_record_count,
      coverage: entry.coverage_counts,
      ru: entry.mappings_with_russian_evidence,
      et: entry.mappings_with_estonian_evidence,
      gaps: entry.gap_item_count,
      matches: entry.positive_match_occurrence_count,
      topics: [entry.represented_topic_inventory_count, entry.not_represented_topic_inventory_count],
    })),
    [
      { source_id: 'grade-5-science', lesson_ranges: 67, unnumbered: 0, total: 67, coverage: { matched: 7, partial: 57, missing: 3, ambiguous: 0, outside_route: 0 }, ru: 30, et: 60, gaps: 60, matches: 131, topics: [7, 3] },
      { source_id: 'grade-6-science', lesson_ranges: 101, unnumbered: 0, total: 101, coverage: { matched: 41, partial: 49, missing: 10, ambiguous: 1, outside_route: 0 }, ru: 50, et: 59, gaps: 60, matches: 116, topics: [9, 2] },
      { source_id: 'grade-7-geography', lesson_ranges: 35, unnumbered: 0, total: 35, coverage: { matched: 9, partial: 26, missing: 0, ambiguous: 0, outside_route: 0 }, ru: 35, et: 32, gaps: 26, matches: 79, topics: [15, 0] },
      { source_id: 'grade-7-science', lesson_ranges: 58, unnumbered: 1, total: 59, coverage: { matched: 12, partial: 44, missing: 2, ambiguous: 1, outside_route: 0 }, ru: 44, et: 49, gaps: 47, matches: 104, topics: [19, 0] },
    ],
  );
});

test('every required-bridge mapping appears once and no matched mapping appears', () => {
  const sourceKeys = new Set();
  for (const gap of report.gap_items) {
    const key = `${gap.source_id}\0${gap.mapping_id}`;
    assert.equal(sourceKeys.has(key), false, `duplicate gap source key ${key}`);
    sourceKeys.add(key);
    assert.notEqual(gap.coverage_status, 'matched');
    assert.notEqual(gap.bridge_type, 'none');
  }
  for (const entry of crosswalkRepository.artifacts) {
    for (const mapping of allMappings(entry)) {
      const key = `${entry.contract.sourceId}\0${mapping.mapping_id}`;
      assert.equal(
        sourceKeys.has(key),
        mapping.bridge_requirement.required,
        `gap membership differs for ${key}`,
      );
      assert.equal(mapping.coverage_status === 'matched', !mapping.bridge_requirement.required);
    }
  }
  assert.equal(sourceKeys.size, 193);
});

test('gap source pages, topics, reasons, positive IDs and URLs exactly copy mappings', () => {
  for (const gap of report.gap_items) {
    const entry = artifact(gap.source_id);
    const mapping = allMappings(entry).find((candidate) => candidate.mapping_id === gap.mapping_id);
    assert.ok(mapping, `missing source mapping ${gap.gap_id}`);
    assert.deepEqual(gap.source_pages, mapping.source_pages);
    assert.equal(gap.source_topic_et, mapping.source_topic_et);
    assert.equal(gap.normalized_mapping_topic_et, mapping.normalized_mapping_topic_et);
    assert.equal(gap.bridge_reason, mapping.bridge_requirement.reason);
    assert.deepEqual(gap.gap_notes, mapping.gap_notes);
    assert.deepEqual(gap.topic_inventory_refs, mapping.topic_inventory_refs);
    assert.deepEqual(gap.positive_match_record_ids, mapping.opiq_matches.map(({ record_id }) => record_id));
    assert.deepEqual(gap.positive_match_urls, mapping.opiq_matches.map(({ canonical_url }) => canonical_url));
    assert.deepEqual(gap.positive_match_programme_types, mapping.opiq_matches.map(({ programme_type }) => programme_type));
  }
});

test('Grade 6 unassigned annual slot remains one source-backed gap item', () => {
  const gap = report.gap_items.find(({ gap_id }) => gap_id === 'grade-6-science-lesson-105-unassigned');
  assert.ok(gap);
  assert.equal(gap.source_record_kind, 'unassigned_annual_slot');
  assert.equal(gap.source_block_id, null);
  assert.deepEqual(gap.lesson_span, { lesson_start: 105, lesson_end: 105 });
  assert.equal(gap.placement, null);
  assert.equal(gap.coverage_status, 'ambiguous');
  assert.equal(gap.bridge_type, 'teacher_review_required');
  assert.equal(routeSummary('grade-6-science').source_record_kind_counts.unassigned_annual_slot, 1);
});

test('Grade 7 science unnumbered row and range 65-70 retain exact source boundaries', () => {
  const unnumbered = report.gap_items.find(({ gap_id }) => (
    gap_id === 'grade-7-science-unnumbered-inimene-uurib-loodust-wrap-up'
  ));
  assert.ok(unnumbered);
  assert.equal(unnumbered.source_record_kind, 'unnumbered_source_row');
  assert.equal(unnumbered.lesson_span, null);
  assert.deepEqual(unnumbered.placement, { after_lesson: 19, before_lesson: 20 });
  assert.deepEqual(unnumbered.source_pages, [6]);
  const reserve = report.gap_items.find(({ gap_id }) => (
    gap_id === 'grade-7-science-lessons-065-070'
  ));
  assert.ok(reserve);
  assert.equal(reserve.coverage_status, 'ambiguous');
  assert.deepEqual(reserve.lesson_span, { lesson_start: 65, lesson_end: 70 });
  assert.equal(report.gap_items.filter(({ mapping_id }) => mapping_id === 'lessons-065-070').length, 1);
});

test('programme occurrence distribution is evidence-derived and bounded', () => {
  const contentOnlyUnknown = ['grade-6-science', 'grade-7-geography', 'grade-7-science']
    .reduce((sum, sourceId) => (
      sum + routeSummary(sourceId).positive_match_counts_by_programme_type.unknown
    ), 0);
  assert.equal(contentOnlyUnknown, 299);
  assert.equal(report.aggregate_summary.positive_match_counts_by_programme_type.simplified_curriculum, 0);
  assert.equal(
    Object.values(report.aggregate_summary.positive_match_counts_by_programme_type)
      .reduce((sum, count) => sum + count, 0),
    report.aggregate_summary.positive_match_occurrence_count,
  );
});

test('sample-only topic absences are exact and separate from gap items', () => {
  assert.deepEqual(
    report.sample_topic_absences.map(({ source_id, topic_id }) => ({ source_id, topic_id })),
    [
      { source_id: 'grade-5-science', topic_id: 'air-properties-and-protection' },
      { source_id: 'grade-5-science', topic_id: 'weather-and-climate' },
      { source_id: 'grade-5-science', topic_id: 'baltic-sea' },
      { source_id: 'grade-6-science', topic_id: 'settlement-ecosystem' },
      { source_id: 'grade-6-science', topic_id: 'bog-ecosystem' },
    ],
  );
  assert.equal(report.sample_topic_absences.every(({ official_curriculum_gap_claimed }) => !official_curriculum_gap_claimed), true);
  assert.equal(report.gap_items.some(({ gap_id }) => gap_id.includes('air-properties-and-protection')), false);
});

test('oral evidence is counted only from explicit inventory roles and match scopes', () => {
  assert.deepEqual(report.oral_evidence_summary, [
    { source_id: 'grade-5-science', registered_topic_records_with_oral_answer_et_role: 6, positive_match_occurrences_with_oral_answer_et_role: 12, mappings_with_oral_language_support_scope: 6, explicit_oral_page_evidence_available: true },
    { source_id: 'grade-6-science', registered_topic_records_with_oral_answer_et_role: 1, positive_match_occurrences_with_oral_answer_et_role: 4, mappings_with_oral_language_support_scope: 0, explicit_oral_page_evidence_available: true },
    { source_id: 'grade-7-geography', registered_topic_records_with_oral_answer_et_role: 1, positive_match_occurrences_with_oral_answer_et_role: 3, mappings_with_oral_language_support_scope: 0, explicit_oral_page_evidence_available: true },
    { source_id: 'grade-7-science', registered_topic_records_with_oral_answer_et_role: 0, positive_match_occurrences_with_oral_answer_et_role: 0, mappings_with_oral_language_support_scope: 0, explicit_oral_page_evidence_available: false },
  ]);
});

test('JSON and Markdown serialization are deterministic and committed bytes are current', () => {
  const firstJson = serializeTeacherWorkPlanGapReport(report);
  const secondJson = serializeTeacherWorkPlanGapReport(structuredClone(report));
  const firstMarkdown = renderTeacherWorkPlanGapReportMarkdown(report);
  const secondMarkdown = renderTeacherWorkPlanGapReportMarkdown(structuredClone(report));
  assert.equal(firstJson, secondJson);
  assert.equal(firstMarkdown, secondMarkdown);
  assert.equal(committed.jsonText, firstJson);
  assert.equal(committed.markdownText, firstMarkdown);
  assert.equal((firstMarkdown.match(/<a id="gap-/gu) ?? []).length, 193);
  assert.notEqual(`${firstJson}\n`, committed.jsonText, 'stale JSON bytes must differ');
  assert.notEqual(`${firstMarkdown}\n`, committed.markdownText, 'stale Markdown bytes must differ');
});

test('missing, extra and reordered routes fail closed', () => {
  for (const mutate of [
    (candidate) => candidate.scope.routes.pop(),
    (candidate) => candidate.scope.routes.push('grade-5-science'),
    (candidate) => candidate.scope.routes.reverse(),
    (candidate) => candidate.inputs.pop(),
    (candidate) => candidate.route_summaries.reverse(),
  ]) assertInvalid(mutate, /route|routes|items/u);
});

test('crosswalk path, hash and route accounting drift fail closed', () => {
  for (const mutate of [
    (candidate) => { candidate.inputs[0].crosswalk_path = 'curriculum-maps/grade-6-science/teacher-work-plan-crosswalk.yaml'; },
    (candidate) => { candidate.inputs[0].crosswalk_sha256 = '0'.repeat(64); },
    (candidate) => { candidate.aggregate_summary.total_source_record_count = 261; },
    (candidate) => { candidate.aggregate_summary.partial_count = 175; },
    (candidate) => { candidate.aggregate_summary.mappings_with_russian_evidence = 158; },
    (candidate) => { candidate.aggregate_summary.route_local_topic_inventory_count = 54; },
  ]) assertInvalid(mutate, /differs|gap count|report/u);
});

test('duplicate, missing, invented and matched gap items fail closed', () => {
  assertInvalid((candidate) => { candidate.gap_items[1].gap_id = candidate.gap_items[0].gap_id; }, /duplicate gap ID|differs/u);
  assertInvalid((candidate) => { candidate.gap_items.pop(); }, /gap count|differs/u);
  assertInvalid((candidate) => {
    const invented = structuredClone(candidate.gap_items.at(-1));
    invented.gap_id = `${invented.source_id}-invented-gap`;
    invented.mapping_id = 'invented-gap';
    candidate.gap_items.push(invented);
  }, /gap count|differs/u);
  assertInvalid((candidate) => { candidate.gap_items[0].coverage_status = 'matched'; }, /allowed values|differs/u);
});

test('gap bridge, reason, topic, pages and lesson boundaries fail closed on drift', () => {
  const unnumberedIndex = report.gap_items.findIndex(({ source_record_kind }) => source_record_kind === 'unnumbered_source_row');
  const numberedIndex = report.gap_items.findIndex(({ source_record_kind }) => source_record_kind === 'lesson_range');
  for (const mutate of [
    (candidate) => { candidate.gap_items[0].bridge_type = 'none'; },
    (candidate) => { delete candidate.gap_items[0].bridge_reason; },
    (candidate) => { candidate.gap_items[0].source_topic_et = 'Invented source topic'; },
    (candidate) => { candidate.gap_items[0].source_pages = [999]; },
    (candidate) => { candidate.gap_items[numberedIndex].lesson_span.lesson_start += 1; },
    (candidate) => { candidate.gap_items[unnumberedIndex].lesson_span = { lesson_start: 19, lesson_end: 19 }; },
    (candidate) => { candidate.gap_items[numberedIndex].placement = { after_lesson: 1, before_lesson: 2 }; },
  ]) assertInvalid(mutate, /bridge|missing required|differs|lesson span|placement|allowed values/u);
});

test('unassigned slot removal and sample absence promotion fail closed', () => {
  assertInvalid((candidate) => {
    candidate.gap_items = candidate.gap_items.filter(({ gap_id }) => gap_id !== 'grade-6-science-lesson-105-unassigned');
  }, /gap count|differs/u);
  assertInvalid((candidate) => { candidate.sample_topic_absences[0].official_curriculum_gap_claimed = true; }, /must be equal to constant|differs/u);
});

test('oral and programme evidence cannot be fabricated or promoted', () => {
  assertInvalid((candidate) => {
    const oral = candidate.oral_evidence_summary.find(({ source_id }) => source_id === 'grade-7-science');
    oral.registered_topic_records_with_oral_answer_et_role = 1;
    oral.explicit_oral_page_evidence_available = true;
  }, /differs/u);
  assertInvalid((candidate) => {
    candidate.aggregate_summary.positive_match_counts_by_programme_type.ordinary += 1;
    candidate.aggregate_summary.positive_match_counts_by_programme_type.unknown -= 1;
  }, /differs/u);
  assertInvalid((candidate) => {
    candidate.aggregate_summary.positive_match_counts_by_programme_type.ordinary -= 1;
    candidate.aggregate_summary.positive_match_counts_by_programme_type.simplified_curriculum += 1;
  }, /differs/u);
});

test('completeness and implementation boundaries cannot be promoted or erased', () => {
  for (const mutate of [
    (candidate) => { candidate.boundaries.official_curriculum_complete = true; },
    (candidate) => { candidate.boundaries.live_opiq_catalogue_complete = true; },
    (candidate) => { candidate.boundaries.default_course_selection_complete = true; },
    (candidate) => { candidate.boundaries.reusable_teaching_artifacts_created = false; },
    (candidate) => { candidate.completeness.official_curriculum_complete = true; },
    (candidate) => { candidate.completeness.reusable_artifact_backlog_complete = true; },
    (candidate) => { candidate.boundaries.semantic_work_package_review_complete = false; },
    (candidate) => { candidate.reusable_artifact_implementation.source_gap_resolution_claimed = true; },
    (candidate) => { candidate.reusable_artifact_implementation.canonical_gap_status_unchanged = false; },
    (candidate) => { candidate.reusable_artifact_implementation.implemented_package_count = 1; },
    (candidate) => { candidate.reusable_artifact_implementation.artifacts[0].human_review.teacher_review_status = 'approved'; },
    (candidate) => { candidate.reusable_artifact_implementation.artifacts[0].human_review.classroom_ready = true; },
    (candidate) => { candidate.reusable_artifact_implementation.artifacts[0].human_review.review_decision_recorded = true; },
    (candidate) => { candidate.reusable_artifact_implementation.completed_classroom_trial_record_count = 1; },
    (candidate) => { candidate.reusable_artifact_implementation.artifacts[0].classroom_trial_status = 'successful'; },
    (candidate) => { candidate.reusable_artifact_implementation.artifacts[0].classroom_ready = true; },
    (candidate) => { candidate.reusable_artifact_implementation.artifacts[0].effectiveness_claimed = true; },
  ]) assertInvalid(mutate, /must be equal to constant|differs/u);
});

test('builder refuses stale or invalid semantic work-package review YAML', async () => {
  const workPackageText = await fs.readFile(
    path.join(repositoryRoot, 'evaluations/teacher-work-plans/grades-5-7-priority-work-packages.yaml'),
    'utf8',
  );
  await assert.rejects(
    buildTeacherWorkPlanGapReport({
      rootDir: repositoryRoot,
      repository: crosswalkRepository,
      workPackageArtifactText: workPackageText.replace(
        'grade-6-science-soil-organisms',
        'grade-6-science-invented-pilot',
      ),
    }),
    /semantic review failed|exact production order|selected pilot/u,
  );
  await assert.rejects(
    buildTeacherWorkPlanGapReport({
      rootDir: repositoryRoot,
      repository: crosswalkRepository,
      workPackageArtifactText: workPackageText.replace(
        'Mullaorganismide välivaatlus',
        'Invented source topic',
      ),
    }),
    /semantic review failed|source gap snapshot/u,
  );
});

test('builder refuses an invalid reusable artifact before generating implementation tracking', async () => {
  const indexPath = 'teacher-work-plan-artifacts/grade-6-science/soil-organisms/artifact-index.yaml';
  const indexText = await fs.readFile(path.join(repositoryRoot, indexPath), 'utf8');
  await assert.rejects(
    buildTeacherWorkPlanGapReport({
      rootDir: repositoryRoot,
      repository: crosswalkRepository,
      reusableArtifactOverrides: new Map([[
        indexPath,
        indexText.replace('source_gap_resolution_claimed: false', 'source_gap_resolution_claimed: true'),
      ]]),
    }),
    /reusable artifact validation failed|resolution/u,
  );
});

test('builder refuses an invalid classroom-trial workflow before generating tracking', async () => {
  const templatePath = 'teacher-work-plan-artifacts/grade-6-science/soil-organisms/reviews/classroom-trial-template.yaml';
  const templateText = await fs.readFile(path.join(repositoryRoot, templatePath), 'utf8');
  await assert.rejects(
    buildTeacherWorkPlanGapReport({
      rootDir: repositoryRoot,
      repository: crosswalkRepository,
      reusableArtifactOverrides: new Map([[
        templatePath,
        templateText.replace('status: draft', 'status: conducted'),
      ]]),
    }),
    /classroom-trial workflow validation failed|template lifecycle/u,
  );
});

test('unknown fields and nondeterministic property order are rejected', () => {
  assertInvalid((candidate) => { candidate.unknown_field = true; }, /unknown field unknown_field/u);
  const candidate = cloneReport();
  const reordered = {
    artifact_type: candidate.artifact_type,
    schema_version: candidate.schema_version,
    ...Object.fromEntries(Object.entries(candidate).filter(([key]) => !['artifact_type', 'schema_version'].includes(key))),
  };
  assert.match(renderedDiagnostics(reordered), /deterministic property order/u);
});

test('generator check mode passes and invalid CLI modes fail', () => {
  const check = spawnSync(process.execPath, ['scripts/generate-teacher-work-plan-gap-report.mjs', '--check'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  assert.equal(check.status, 0, check.stderr);
  assert.match(check.stdout, /4 routes, 262 source records, 193 gap items/u);
  for (const argumentsList of [[], ['--write', '--check'], ['--unknown']]) {
    const result = spawnSync(process.execPath, ['scripts/generate-teacher-work-plan-gap-report.mjs', ...argumentsList], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /choose exactly one mode/u);
  }
});

test('builder refuses to generate from an invalid crosswalk repository', async () => {
  const invalid = structuredClone(crosswalkRepository);
  invalid.artifacts[0].artifact.mapping_summary.matched_count += 1;
  await assert.rejects(
    buildTeacherWorkPlanGapReport({ rootDir: repositoryRoot, repository: invalid }),
    /crosswalk validation failed/u,
  );
});

test('committed artifact paths are exact and generated files are regular text artifacts', async () => {
  assert.equal(GAP_REPORT_JSON_PATH, 'evaluations/teacher-work-plans/grades-5-7-gap-report.json');
  assert.equal(GAP_REPORT_MARKDOWN_PATH, 'docs/audits/grades-5-7-teacher-work-plan-gap-report.md');
  for (const repositoryPath of [GAP_REPORT_JSON_PATH, GAP_REPORT_MARKDOWN_PATH]) {
    const stat = await fs.stat(path.join(repositoryRoot, repositoryPath));
    assert.equal(stat.isFile(), true);
  }
});
