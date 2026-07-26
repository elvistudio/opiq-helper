import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildPedagogicalReadinessReport,
  createPedagogicalReadinessReportValidator,
  evaluatePedagogicalReadiness,
  serializePedagogicalReadinessReport,
} from './lib/pedagogical-readiness.mjs';

function index() {
  return {
    file: 'teacher-packs/example/materials-index.yaml',
    data: {
      pack_id: 'example-teacher-pack',
      pedagogical_review: {
        status: 'pending',
        review_record_paths: [],
      },
      classroom_trial: {
        status: 'not_tested',
        trial_record_paths: [],
      },
      home_trial: {
        status: 'not_started',
        trial_record_paths: [],
      },
      pedagogical_integration: {
        status: { effectiveness_claimed: false },
      },
    },
  };
}

function evidence(overrides = {}) {
  return {
    effective_teacher_review: false,
    effective_classroom_review: false,
    effective_homeschool_review: false,
    effective_classroom_trial: false,
    effective_home_trial: false,
    effective_teacher_review_count: 0,
    effective_classroom_review_count: 0,
    effective_homeschool_review_count: 0,
    effective_classroom_trial_count: 0,
    effective_home_trial_count: 0,
    effective_classroom_trial_record_count: 0,
    effective_home_trial_record_count: 0,
    classroom_trial_coverage: {
      required_lesson_ids: [],
      covered_lesson_ids: [],
      missing_lesson_ids: [],
      contributing_record_ids: [],
      contributing_evidence_paths: [],
      complete: false,
    },
    home_trial_coverage: {
      required_lesson_ids: [],
      covered_lesson_ids: [],
      missing_lesson_ids: [],
      contributing_record_ids: [],
      contributing_evidence_paths: [],
      complete: false,
    },
    stale_teacher_review_count: 0,
    stale_classroom_trial_count: 0,
    stale_home_trial_count: 0,
    parent_role_bounded: true,
    unresolved_required_changes: [],
    teacher_review_paths: [],
    classroom_trial_paths: [],
    home_trial_paths: [],
    ...overrides,
  };
}

function structural(overrides = {}) {
  return {
    pedagogy_schema_valid: true,
    structurally_complete: true,
    errors: 0,
    warnings: 0,
    materials_resolved: true,
    pack_materials_resolved: true,
    pack_print_ready: true,
    ...overrides,
  };
}

function evaluate({
  evidenceOverrides = {},
  structuralOverrides = {},
  homeClosure = true,
  findings = [],
  stale = [],
} = {}) {
  return evaluatePedagogicalReadiness({
    index: index(),
    evidenceSummary: evidence(evidenceOverrides),
    structuralQuality: structural(structuralOverrides),
    homeschoolClosureResolved: homeClosure,
    openFindings: findings,
    staleEvidence: stale,
  });
}

test('no evidence keeps both readiness states false', () => {
  const result = evaluate();
  assert.equal(result.classroom_ready, false);
  assert.equal(result.homeschool_ready, false);
});

test('approved current classroom review alone is insufficient', () => {
  const result = evaluate({
    evidenceOverrides: {
      effective_teacher_review: true,
      effective_classroom_review: true,
      effective_teacher_review_count: 1,
      effective_classroom_review_count: 1,
    },
  });
  assert.equal(result.classroom_ready, false);
});

test('successful classroom trial without classroom review is insufficient', () => {
  const result = evaluate({
    evidenceOverrides: {
      effective_classroom_trial: true,
      effective_classroom_trial_count: 1,
    },
  });
  assert.equal(result.classroom_ready, false);
});

test('partial classroom trial coverage produces a deterministic missing-lessons blocker', () => {
  const result = evaluate({
    evidenceOverrides: {
      effective_classroom_review: true,
      effective_classroom_trial: false,
      effective_classroom_trial_record_count: 1,
      classroom_trial_coverage: {
        required_lesson_ids: ['lesson-01', 'lesson-02'],
        covered_lesson_ids: ['lesson-01'],
        missing_lesson_ids: ['lesson-02'],
        contributing_record_ids: ['trial-one'],
        contributing_evidence_paths: ['pedagogical-reviews/x/records/trial-one.yaml'],
        complete: false,
      },
    },
  });
  assert.equal(result.classroom_ready, false);
  assert.ok(result.blockers.some((entry) => (
    entry.code === 'classroom_trial_lesson_coverage_incomplete'
    && entry.message.includes('lesson-02')
  )));
  assert.deepEqual(
    result.classroom_trial_coverage.missing_lesson_ids,
    ['lesson-02'],
  );
});

test('current classroom review plus classroom trial yields classroom readiness', () => {
  const result = evaluate({
    evidenceOverrides: {
      effective_teacher_review: true,
      effective_classroom_review: true,
      effective_classroom_trial: true,
      effective_teacher_review_count: 1,
      effective_classroom_review_count: 1,
      effective_classroom_trial_count: 1,
    },
  });
  assert.equal(result.classroom_ready, true);
  assert.equal(result.homeschool_ready, false);
});

test('approved homeschool review alone is insufficient', () => {
  const result = evaluate({
    evidenceOverrides: {
      effective_teacher_review: true,
      effective_homeschool_review: true,
      effective_teacher_review_count: 1,
      effective_homeschool_review_count: 1,
    },
  });
  assert.equal(result.homeschool_ready, false);
});

test('successful home trial without homeschool review is insufficient', () => {
  const result = evaluate({
    evidenceOverrides: {
      effective_home_trial: true,
      effective_home_trial_count: 1,
    },
  });
  assert.equal(result.homeschool_ready, false);
});

test('current homeschool review plus home trial yields homeschool readiness', () => {
  const result = evaluate({
    evidenceOverrides: {
      effective_teacher_review: true,
      effective_homeschool_review: true,
      effective_home_trial: true,
      effective_teacher_review_count: 1,
      effective_homeschool_review_count: 1,
      effective_home_trial_count: 1,
    },
  });
  assert.equal(result.homeschool_ready, true);
  assert.equal(result.classroom_ready, false);
});

test('classroom trial cannot satisfy home readiness', () => {
  const result = evaluate({
    evidenceOverrides: {
      effective_teacher_review: true,
      effective_homeschool_review: true,
      effective_classroom_trial: true,
    },
  });
  assert.equal(result.homeschool_ready, false);
});

test('home trial cannot satisfy classroom readiness', () => {
  const result = evaluate({
    evidenceOverrides: {
      effective_teacher_review: true,
      effective_classroom_review: true,
      effective_home_trial: true,
    },
  });
  assert.equal(result.classroom_ready, false);
});

test('stale classroom evidence blocks classroom readiness', () => {
  const result = evaluate({
    evidenceOverrides: {
      effective_teacher_review: true,
      effective_classroom_review: true,
      effective_classroom_trial: true,
    },
    stale: [{
      kind: 'classroom_trial',
      evidence_path: 'pedagogical-reviews/x/records/trial.yaml',
    }],
  });
  assert.equal(result.classroom_ready, false);
});

test('stale home evidence blocks homeschool readiness', () => {
  const result = evaluate({
    evidenceOverrides: {
      effective_teacher_review: true,
      effective_homeschool_review: true,
      effective_home_trial: true,
    },
    stale: [{
      kind: 'home_trial',
      evidence_path: 'pedagogical-reviews/x/records/home.yaml',
    }],
  });
  assert.equal(result.homeschool_ready, false);
});

test('open blocking classroom finding blocks classroom only', () => {
  const result = evaluate({
    evidenceOverrides: {
      effective_teacher_review: true,
      effective_classroom_review: true,
      effective_classroom_trial: true,
      effective_homeschool_review: true,
      effective_home_trial: true,
    },
    findings: [{
      finding_id: 'blocking-classroom',
      severity: 'blocking',
      category: 'timing',
      delivery_modes: ['classroom'],
      evidence_path: 'pedagogical-reviews/x/records/review.yaml',
    }],
  });
  assert.equal(result.classroom_ready, false);
  assert.equal(result.homeschool_ready, true);
});

test('open major homeschool finding blocks homeschool only', () => {
  const result = evaluate({
    evidenceOverrides: {
      effective_teacher_review: true,
      effective_classroom_review: true,
      effective_classroom_trial: true,
      effective_homeschool_review: true,
      effective_home_trial: true,
    },
    findings: [{
      finding_id: 'major-home',
      severity: 'major',
      category: 'parent_role',
      delivery_modes: ['homeschool'],
      evidence_path: 'pedagogical-reviews/x/records/review.yaml',
    }],
  });
  assert.equal(result.classroom_ready, true);
  assert.equal(result.homeschool_ready, false);
});

test('open safety finding is a named safety blocker', () => {
  const result = evaluate({
    findings: [{
      finding_id: 'safety-home',
      severity: 'blocking',
      category: 'safety',
      delivery_modes: ['homeschool'],
      evidence_path: 'pedagogical-reviews/x/records/home.yaml',
    }],
  });
  assert.ok(result.blockers.some((entry) => entry.code === 'open_safety_finding'));
});

test('unresolved required change blocks both modes', () => {
  const result = evaluate({
    evidenceOverrides: {
      effective_classroom_review: true,
      effective_homeschool_review: true,
      effective_classroom_trial: true,
      effective_home_trial: true,
      unresolved_required_changes: [{ change_id: 'change-one' }],
    },
  });
  assert.equal(result.classroom_ready, false);
  assert.equal(result.homeschool_ready, false);
});

test('unbounded parent role blocks homeschool readiness', () => {
  const result = evaluate({
    evidenceOverrides: {
      effective_homeschool_review: true,
      effective_home_trial: true,
      parent_role_bounded: false,
    },
  });
  assert.equal(result.homeschool_ready, false);
  assert.ok(result.blockers.some((entry) => entry.code === 'parent_role_not_bounded'));
});

test('structural completeness is necessary but never sufficient alone', () => {
  const result = evaluate();
  assert.equal(result.classroom_ready, false);
  assert.equal(result.homeschool_ready, false);
});

test('failed structural quality blocks both modes even with evidence', () => {
  const result = evaluate({
    evidenceOverrides: {
      effective_classroom_review: true,
      effective_homeschool_review: true,
      effective_classroom_trial: true,
      effective_home_trial: true,
    },
    structuralOverrides: { structurally_complete: false, errors: 1 },
  });
  assert.equal(result.classroom_ready, false);
  assert.equal(result.homeschool_ready, false);
});

test('classroom print failure does not masquerade as home trial evidence', () => {
  const result = evaluate({
    evidenceOverrides: {
      effective_classroom_review: true,
      effective_homeschool_review: true,
      effective_classroom_trial: true,
      effective_home_trial: true,
    },
    structuralOverrides: { pack_print_ready: false },
  });
  assert.equal(result.classroom_ready, false);
  assert.equal(result.homeschool_ready, true);
});

test('home material closure is a separate homeschool prerequisite', () => {
  const result = evaluate({
    evidenceOverrides: {
      effective_homeschool_review: true,
      effective_home_trial: true,
    },
    homeClosure: false,
  });
  assert.equal(result.homeschool_ready, false);
});

test('readiness never claims pedagogical effectiveness', () => {
  const result = evaluate({
    evidenceOverrides: {
      effective_classroom_review: true,
      effective_homeschool_review: true,
      effective_classroom_trial: true,
      effective_home_trial: true,
    },
  });
  assert.equal(result.effectiveness_claimed, false);
});

test('production readiness report remains pending and deterministic', async () => {
  const first = await buildPedagogicalReadinessReport();
  const second = await buildPedagogicalReadinessReport();
  assert.equal(
    serializePedagogicalReadinessReport(first),
    serializePedagogicalReadinessReport(second),
  );
  assert.equal(first.teacher_review.status, 'pending');
  assert.equal(first.teacher_review.effective, false);
  assert.equal(first.classroom_trial.status, 'not_tested');
  assert.equal(first.classroom_trial.effective, false);
  assert.equal(first.home_trial.status, 'not_started');
  assert.equal(first.home_trial.effective, false);
  assert.equal(first.classroom_ready, false);
  assert.equal(first.homeschool_ready, false);
  assert.equal(first.effectiveness_claimed, false);
  assert.equal(first.evidence_paths.length, 0);
  assert.equal(
    first.checked_artifacts.some((repositoryPath) => (
      repositoryPath.includes('/water-use-cycle/')
    )),
    false,
  );
  assert.equal(
    first.checked_artifacts.includes(
      'teacher-packs/grade-5-science/water/materials-index.yaml',
    ),
    true,
  );
  assert.equal(
    first.checked_artifacts.includes(
      'pedagogical-reviews/grade-5-science/water/teacher-review-template.yaml',
    ),
    true,
  );
  assert.deepEqual(
    first.checked_artifacts,
    [...new Set(first.checked_artifacts)].sort((left, right) => (
      Buffer.from(left).compare(Buffer.from(right))
    )),
  );
});

test('production readiness report passes strict schema validation', async () => {
  const report = await buildPedagogicalReadinessReport();
  const validate = await createPedagogicalReadinessReportValidator();
  assert.equal(validate(report), true, JSON.stringify(validate.errors));
  const invalid = structuredClone(report);
  invalid.teacher_review.status = 'not_tested';
  assert.equal(validate(invalid), false);
});
