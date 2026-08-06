import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  loadCommittedTeacherWorkPlanGapReportArtifacts,
} from './lib/teacher-work-plan-gap-report.mjs';
import {
  WORK_PACKAGE_AUDIT_PATH,
  loadTeacherWorkPlanWorkPackages,
  renderTeacherWorkPlanWorkPackagesMarkdown,
  serializeTeacherWorkPlanWorkPackages,
  teacherWorkPlanWorkPackageContracts,
  validateTeacherWorkPlanWorkPackages,
} from './lib/teacher-work-plan-work-packages.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gapArtifacts = await loadCommittedTeacherWorkPlanGapReportArtifacts({ rootDir: repositoryRoot });
const gapReport = gapArtifacts.report;
const loaded = await loadTeacherWorkPlanWorkPackages({ rootDir: repositoryRoot, gapReport });
const artifact = loaded.artifact;

function cloneArtifact() {
  return structuredClone(artifact);
}

function diagnostics(candidate) {
  return validateTeacherWorkPlanWorkPackages(candidate, {
    schema: loaded.schema,
    gapReport,
  }).diagnostics;
}

function assertInvalid(mutate, pattern = /./u) {
  const candidate = cloneArtifact();
  mutate(candidate);
  const output = diagnostics(candidate).map(({ field, reason }) => `${field}: ${reason}`).join('\n');
  assert.notEqual(output, '', 'expected work-package validation to fail');
  assert.match(output, pattern);
}

function packageById(packageId, candidate = artifact) {
  return candidate.work_packages.find((entry) => entry.package_id === packageId);
}

const expectedPackageIds = teacherWorkPlanWorkPackageContracts.packageContracts
  .map(({ packageId }) => packageId);
const expectedGapIds = teacherWorkPlanWorkPackageContracts.priorityGapIds;

test('production review validates with exact 17 priority gaps and 16 ordered packages', () => {
  const first = validateTeacherWorkPlanWorkPackages(cloneArtifact(), {
    schema: loaded.schema,
    gapReport,
  });
  const second = validateTeacherWorkPlanWorkPackages(cloneArtifact(), {
    schema: loaded.schema,
    gapReport,
  });
  assert.deepEqual(first, second);
  assert.deepEqual(first.diagnostics, []);
  assert.deepEqual(artifact.work_packages.map(({ package_id }) => package_id), expectedPackageIds);
  assert.deepEqual(
    artifact.work_packages.flatMap(({ source_gap_refs }) => source_gap_refs.map(({ gap_id }) => gap_id)),
    expectedGapIds,
  );
});

test('package membership preserves each source gap exactly once', () => {
  for (const [index, contract] of teacherWorkPlanWorkPackageContracts.packageContracts.entries()) {
    assert.equal(artifact.work_packages[index].package_id, contract.packageId);
    assert.deepEqual(
      artifact.work_packages[index].source_gap_refs.map(({ gap_id }) => gap_id),
      contract.gaps,
    );
  }
  const assigned = artifact.work_packages.flatMap(({ source_gap_refs }) => source_gap_refs.map(({ gap_id }) => gap_id));
  assert.equal(new Set(assigned).size, 17);
  assert.equal(assigned.length, 17);
});

test('ready, blocked and multi-gap accounting is exact', () => {
  assert.deepEqual(artifact.summary, {
    priority_gap_count: 17,
    work_package_count: 16,
    ready_for_authoring_count: 13,
    blocked_teacher_review_count: 3,
    multi_gap_package_count: 1,
    selected_pilot_package_id: 'grade-6-science-soil-organisms',
    next_authoring_package_id: 'grade-6-science-air-composition',
  });
  assert.deepEqual(artifact.authoring_queue, teacherWorkPlanWorkPackageContracts.authoringQueue);
  assert.deepEqual(
    artifact.work_packages.filter(({ authoring_status }) => authoring_status === 'blocked_teacher_review')
      .map(({ package_id }) => package_id),
    teacherWorkPlanWorkPackageContracts.blockedPackageIds,
  );
  const grouped = artifact.work_packages.filter(({ source_gap_refs }) => source_gap_refs.length > 1);
  assert.deepEqual(grouped.map(({ package_id }) => package_id), ['grade-6-science-soil-organisms']);
  assert.deepEqual(grouped[0].source_gap_refs.map(({ gap_id }) => gap_id), [
    'grade-6-science-lesson-008',
    'grade-6-science-lesson-009',
  ]);
});

test('review includes no geography, partial, matched or sample-only item', () => {
  assert.equal(artifact.work_packages.some(({ source_id }) => source_id === 'grade-7-geography'), false);
  const refs = artifact.work_packages.flatMap(({ source_gap_refs }) => source_gap_refs);
  assert.equal(refs.every(({ coverage_status }) => ['missing', 'ambiguous'].includes(coverage_status)), true);
  assert.equal(refs.some(({ gap_id }) => gap_id.includes('air-properties-and-protection')), false);
});

test('source snapshots and route metadata exactly match the current gap report', () => {
  const gaps = new Map(gapReport.gap_items.map((gap) => [gap.gap_id, gap]));
  for (const workPackage of artifact.work_packages) {
    for (const ref of workPackage.source_gap_refs) {
      const gap = gaps.get(ref.gap_id);
      assert.ok(gap);
      for (const field of [
        'mapping_id', 'source_record_kind', 'coverage_status', 'bridge_type', 'lesson_span',
        'placement', 'source_pages', 'source_topic_et', 'normalized_mapping_topic_et',
        'topic_inventory_refs',
      ]) assert.deepEqual(ref[field], gap[field]);
      assert.equal(workPackage.source_id, gap.source_id);
      assert.equal(workPackage.grade, gap.grade);
      assert.equal(workPackage.subject, gap.subject);
      assert.equal(workPackage.subject_et, gap.subject_et);
    }
  }
});

test('capability rules and blocked-package restrictions hold', () => {
  for (const workPackage of artifact.work_packages) {
    const types = new Set(workPackage.required_bridge_types);
    const deliverables = new Set(workPackage.proposed_deliverables);
    if (types.has('independently_authored_practical_required')) {
      assert.equal(deliverables.has('practical_protocol'), true);
      assert.equal(deliverables.has('observation_table'), true);
    }
    if (types.has('independently_authored_bridge_required')) {
      assert.equal(deliverables.has('author_created_bridge') || deliverables.has('student_worksheet'), true);
    }
    if (types.has('independently_authored_assessment_required')) {
      assert.equal(deliverables.has('assessment_rubric'), true);
      assert.equal(deliverables.has('answer_key'), true);
    }
    if (workPackage.authoring_status === 'blocked_teacher_review') {
      assert.deepEqual(workPackage.proposed_deliverables, ['teacher_decision_record']);
      assert.notEqual(workPackage.blocking_questions.length, 0);
    }
  }
});

test('selected Grade 6 soil-organisms pilot has exact root and seven deliverables', () => {
  const selected = artifact.work_packages.filter(({ selected_as_first_pilot }) => selected_as_first_pilot);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].package_id, teacherWorkPlanWorkPackageContracts.selectedPilotPackageId);
  assert.equal(selected[0].planned_root_path, teacherWorkPlanWorkPackageContracts.selectedPilotRoot);
  assert.deepEqual(selected[0].proposed_deliverables, teacherWorkPlanWorkPackageContracts.selectedPilotDeliverables);
  assert.deepEqual(selected[0].implementation, teacherWorkPlanWorkPackageContracts.pilotImplementation);
  assert.deepEqual(artifact.implementation_summary, teacherWorkPlanWorkPackageContracts.implementationSummary);
  assert.equal(selected[0].implementation.human_review.teacher_review_status, 'pending');
  assert.equal(selected[0].implementation.human_review.local_safety_review_status, 'pending');
  assert.equal(selected[0].implementation.human_review.completed_teacher_review_count, 0);
  assert.equal(selected[0].implementation.human_review.completed_safety_review_count, 0);
  assert.equal(selected[0].implementation.human_review.review_decision_recorded, false);
  assert.equal(selected[0].implementation.human_review.classroom_trial_status, 'not_tested');
  assert.deepEqual(selected[0].implementation.classroom_trial, {
    workflow_created: true,
    template_path: 'teacher-work-plan-artifacts/grade-6-science/soil-organisms/reviews/classroom-trial-template.yaml',
    completed_record_count: 0,
    status: 'not_tested',
    classroom_ready: false,
    effectiveness_claimed: false,
  });
  const photosynthesis = packageById('grade-6-science-photosynthesis');
  assert.equal(photosynthesis.implementation.status, 'internal_draft_pending_teacher_review');
  assert.equal(photosynthesis.implementation.human_review.content_fingerprint, '8df9cff3e19c325ba92f931f72c79cf2828a9b03a36fcf80ea19aff430d7db45');
  assert.deepEqual(photosynthesis.implementation.supported_gap_ids, ['grade-6-science-lesson-016']);
  assert.equal(photosynthesis.implementation.human_review.teacher_review_status, 'pending');
  assert.equal(photosynthesis.implementation.human_review.local_safety_review_status, 'pending');
  assert.equal(photosynthesis.implementation.classroom_trial.status, 'not_tested');
  const gardenField = packageById('grade-6-science-garden-field-food-products');
  assert.deepEqual(gardenField.implementation, teacherWorkPlanWorkPackageContracts.gardenFieldImplementation);
  assert.equal(gardenField.implementation.human_review.content_fingerprint, '999eb50584622bb35dd017a34d7b83536c4face4ebaccd98d12d7768518280ad');
  assert.deepEqual(gardenField.implementation.supported_gap_ids, ['grade-6-science-lesson-022']);
  assert.equal(gardenField.implementation.human_review.teacher_review_status, 'pending');
  assert.equal(gardenField.implementation.human_review.local_safety_review_status, 'pending');
  assert.equal(gardenField.implementation.classroom_trial.status, 'not_tested');
  const woodProcessing = packageById('grade-6-science-wood-processing');
  assert.deepEqual(woodProcessing.implementation, teacherWorkPlanWorkPackageContracts.woodProcessingImplementation);
  assert.equal(woodProcessing.implementation.human_review.content_fingerprint, '59689bce711416a1cab4c8df5c5d75113c8e4a1fdec1d5aafc5ed9ecb8981436');
  assert.deepEqual(woodProcessing.implementation.supported_gap_ids, ['grade-6-science-lesson-038']);
  assert.equal(woodProcessing.implementation.human_review.teacher_review_status, 'pending');
  assert.equal(woodProcessing.implementation.human_review.local_safety_review_status, 'pending');
  assert.equal(woodProcessing.implementation.classroom_trial.status, 'not_tested');
  assert.equal(artifact.work_packages.filter(({ implementation }) => implementation !== undefined).length, 4);
});

test('review records four internal drafts without resolution, backlog completion or official claims', () => {
  assert.equal(artifact.work_packages.every(({ resolution_claimed }) => resolution_claimed === false), true);
  assert.equal(artifact.scope.reusable_teaching_artifacts_created, true);
  assert.equal(artifact.completeness.reusable_teaching_artifacts_created, true);
  assert.equal(artifact.completeness.reusable_artifact_backlog_complete, false);
  assert.equal(artifact.implementation_summary.source_gap_resolution_claimed, false);
  assert.equal(artifact.implementation_summary.implemented_internal_draft_count, 4);
  assert.equal(artifact.implementation_summary.implemented_source_gap_count, 5);
  assert.equal(artifact.implementation_summary.delivered_capability_count, 19);
  assert.equal(artifact.implementation_summary.not_started_ready_package_count, 9);
  assert.equal(artifact.implementation_summary.human_review_workflow_count, 4);
  assert.equal(artifact.implementation_summary.completed_human_review_record_count, 0);
  assert.equal(artifact.implementation_summary.teacher_review_pending_count, 4);
  assert.equal(artifact.implementation_summary.local_safety_review_pending_count, 4);
  assert.equal(artifact.implementation_summary.classroom_trial_workflow_count, 4);
  assert.equal(artifact.implementation_summary.classroom_trial_template_count, 4);
  assert.equal(artifact.implementation_summary.completed_classroom_trial_record_count, 0);
  assert.equal(artifact.implementation_summary.classroom_trial_not_tested_count, 4);
  assert.equal(artifact.completeness.official_curriculum_complete, false);
  assert.equal(artifact.completeness.live_catalogue_complete, false);
});

test('YAML serialization and Markdown rendering are deterministic and committed audit is current', () => {
  assert.equal(serializeTeacherWorkPlanWorkPackages(artifact), serializeTeacherWorkPlanWorkPackages(artifact));
  const first = renderTeacherWorkPlanWorkPackagesMarkdown(artifact);
  const second = renderTeacherWorkPlanWorkPackagesMarkdown(artifact);
  assert.equal(first, second);
  assert.equal(first, loaded.markdownText);
  assert.match(first, /17 missing or ambiguous/u);
  assert.match(first, /grade-6-science-soil-organisms/u);
});

test('missing, extra, duplicate and reordered packages fail closed', () => {
  assertInvalid((candidate) => { candidate.work_packages.pop(); }, /exact production order|summary/u);
  assertInvalid((candidate) => { candidate.work_packages.push(structuredClone(candidate.work_packages[0])); }, /exact production order|duplicate/u);
  assertInvalid((candidate) => { candidate.work_packages[1].package_id = candidate.work_packages[0].package_id; }, /duplicate package ID/u);
  assertInvalid((candidate) => { [candidate.work_packages[0], candidate.work_packages[1]] = [candidate.work_packages[1], candidate.work_packages[0]]; }, /exact production order/u);
});

test('omitted, duplicate, invented and non-priority gaps fail closed', () => {
  assertInvalid((candidate) => { candidate.work_packages[0].source_gap_refs = []; }, /source gap|membership|assigned/u);
  assertInvalid((candidate) => { candidate.work_packages[1].source_gap_refs[0] = structuredClone(candidate.work_packages[0].source_gap_refs[0]); }, /assigned more than once|membership/u);
  assertInvalid((candidate) => { candidate.work_packages[0].source_gap_refs[0].gap_id = 'grade-5-science-invented'; }, /unknown, non-priority/u);
  assertInvalid((candidate) => { candidate.work_packages[0].source_gap_refs[0].gap_id = 'grade-5-science-lesson-002'; }, /unknown, non-priority/u);
  assertInvalid((candidate) => { candidate.work_packages[0].source_gap_refs[0].gap_id = 'grade-5-science-air-properties-and-protection'; }, /unknown, non-priority/u);
});

test('source snapshot, route, grade, subject, page, topic and bridge drift fail closed', () => {
  const mutations = [
    (candidate) => { candidate.work_packages[4].source_id = 'grade-5-science'; },
    (candidate) => { candidate.work_packages[4].grade = 5; },
    (candidate) => { candidate.work_packages[4].subject = 'geography'; },
    (candidate) => { candidate.work_packages[4].source_gap_refs[0].source_pages = [99]; },
    (candidate) => { candidate.work_packages[4].source_gap_refs[0].source_topic_et = 'Invented'; },
    (candidate) => { candidate.work_packages[4].source_gap_refs[0].bridge_type = 'teacher_review_required'; },
  ];
  for (const mutate of mutations) assertInvalid(mutate, /expected|differs|exact|match/u);
});

test('unsupported multi-gap and cross-route grouping fail closed', () => {
  assertInvalid((candidate) => {
    candidate.work_packages[0].source_gap_refs.push(structuredClone(candidate.work_packages[1].source_gap_refs[0]));
  }, /membership|assigned/u);
  assertInvalid((candidate) => {
    candidate.work_packages[0].source_gap_refs.push(structuredClone(candidate.work_packages[4].source_gap_refs[0]));
  }, /cross-route|membership/u);
});

test('blocked and ambiguous packages cannot be promoted or expanded', () => {
  assertInvalid((candidate) => { candidate.work_packages[12].authoring_status = 'ready_for_authoring'; }, /blocked|ambiguous|expected/u);
  assertInvalid((candidate) => { candidate.work_packages[15].authoring_status = 'ready_for_authoring'; }, /blocked|ambiguous|expected/u);
  assertInvalid((candidate) => { candidate.work_packages[0].proposed_deliverables.push('student_worksheet'); }, /teacher-review package|must NOT|items/u);
  assertInvalid((candidate) => { candidate.work_packages[0].blocking_questions = []; }, /blocking/u);
});

test('ready and capability-specific packages reject missing deliverables', () => {
  assertInvalid((candidate) => { candidate.work_packages[1].proposed_deliverables = []; }, /deliverable|minItems/u);
  assertInvalid((candidate) => {
    packageById('grade-6-science-soil-organisms', candidate).proposed_deliverables =
      packageById('grade-6-science-soil-organisms', candidate).proposed_deliverables.filter((item) => item !== 'practical_protocol');
  }, /practical_protocol|seven-item/u);
  assertInvalid((candidate) => {
    packageById('grade-7-science-quadrat-fieldwork', candidate).proposed_deliverables =
      packageById('grade-7-science-quadrat-fieldwork', candidate).proposed_deliverables.filter((item) => item !== 'observation_table');
  }, /observation_table/u);
  assertInvalid((candidate) => {
    packageById('grade-7-science-mixture-separation-review', candidate).proposed_deliverables =
      packageById('grade-7-science-mixture-separation-review', candidate).proposed_deliverables.filter((item) => item !== 'assessment_rubric');
  }, /assessment_rubric/u);
});

test('pilot, planned root and completion-boundary mutation fail closed', () => {
  assertInvalid((candidate) => { candidate.work_packages[4].selected_as_first_pilot = false; }, /selected/u);
  assertInvalid((candidate) => { candidate.work_packages[4].planned_root_path = 'lesson-plans/grade-6-science/soil-organisms'; }, /planned root|pattern/u);
  assertInvalid((candidate) => { candidate.work_packages[4].resolution_claimed = true; }, /resolution/u);
  assertInvalid((candidate) => { candidate.completeness.reusable_teaching_artifacts_created = false; }, /must be equal to constant|artifact/u);
  assertInvalid((candidate) => { candidate.implementation_summary.implemented_internal_draft_count = 1; }, /implementation summary|must be equal/u);
  assertInvalid((candidate) => { delete candidate.work_packages[4].implementation; }, /implementation/u);
  assertInvalid((candidate) => { candidate.work_packages[6].implementation = structuredClone(candidate.work_packages[4].implementation); }, /implemented package must link|implementation/u);
  assertInvalid((candidate) => { candidate.completeness.official_curriculum_complete = true; }, /must be equal to constant|curriculum/u);
  assertInvalid((candidate) => { candidate.completeness.live_catalogue_complete = true; }, /must be equal to constant|catalogue/u);
});

test('strict YAML rejects aliases, anchors, duplicate keys, tabs and unknown fields', async () => {
  const cases = [
    `${loaded.artifactText}\ncopy: *shared\n`,
    `${loaded.artifactText}\nshared: &shared value\n`,
    loaded.artifactText.replace('schema_version: "1.0"', 'schema_version: "1.0"\nschema_version: "1.0"'),
    loaded.artifactText.replace('artifact_type:', '\tartifact_type:'),
  ];
  for (const artifactText of cases) {
    await assert.rejects(
      loadTeacherWorkPlanWorkPackages({ rootDir: repositoryRoot, gapReport, artifactText, includeMarkdown: false }),
      /YAML|tabs|aliases|anchors|Map keys must be unique/u,
    );
  }
  assertInvalid((candidate) => { candidate.unexpected = true; }, /unknown field/u);
});

test('generator checker succeeds and a stale Markdown rendering differs', async () => {
  const result = spawnSync(process.execPath, ['scripts/generate-teacher-work-plan-work-packages.mjs', '--check'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const stale = cloneArtifact();
  stale.work_packages[0].planned_root_path = 'teacher-work-plan-artifacts/grade-5-science/stale-path';
  assert.notEqual(renderTeacherWorkPlanWorkPackagesMarkdown(stale), loaded.markdownText);
  assert.equal(await fs.readFile(path.join(repositoryRoot, WORK_PACKAGE_AUDIT_PATH), 'utf8'), loaded.markdownText);
});
