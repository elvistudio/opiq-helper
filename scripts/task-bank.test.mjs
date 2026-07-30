import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { before, test } from 'node:test';
import { parseStrictCurriculumYaml } from './lib/curriculum-maps.mjs';
import {
  computeTaskFingerprint,
  extractCustomerVisibleProjection,
  loadTaskBankRepository,
  stableTaskBankJson,
  validateTaskBankRepository,
} from './lib/task-bank.mjs';

let baseline;
let sourceDependentFixture;
let tooSimilarFixture;
let syntheticApprovalFixture;
let unsafePathFixture;
let validationWorkflow;

async function loadFixture(name) {
  const file = `test-fixtures/task-bank/${name}`;
  return parseStrictCurriculumYaml(await fs.readFile(file, 'utf8'), file);
}

before(async () => {
  [
    baseline,
    sourceDependentFixture,
    tooSimilarFixture,
    syntheticApprovalFixture,
    unsafePathFixture,
    validationWorkflow,
  ] = await Promise.all([
    loadTaskBankRepository(),
    loadFixture('source-dependent-specification.yaml'),
    loadFixture('too-similar.yaml'),
    loadFixture('synthetic-approved-review.yaml'),
    loadFixture('unsafe-index-path.yaml'),
    fs.readFile('.github/workflows/validate-source-manifest.yml', 'utf8')
      .then((text) => parseStrictCurriculumYaml(
        text,
        '.github/workflows/validate-source-manifest.yml',
      )),
  ]);
});

function cloneRepository() {
  return {
    ...baseline,
    specifications: baseline.specifications.map((artifact) => ({
      ...artifact,
      data: structuredClone(artifact.data),
    })),
    tasks: baseline.tasks.map((artifact) => ({
      ...artifact,
      data: structuredClone(artifact.data),
    })),
    reviews: baseline.reviews.map((artifact) => ({
      ...artifact,
      data: structuredClone(artifact.data),
    })),
    index: {
      ...baseline.index,
      data: structuredClone(baseline.index.data),
    },
  };
}

function specification(repository, index = 0) {
  return repository.specifications[index].data;
}

function taskArtifact(repository, index = 0) {
  return repository.tasks[index];
}

function taskData(repository, index = 0) {
  return taskArtifact(repository, index).data;
}

function reviewData(repository, index = 0) {
  return repository.reviews[index].data;
}

function validation(repository) {
  return validateTaskBankRepository(repository);
}

function diagnosticCodes(repository) {
  return validation(repository).diagnostics.map((entry) => entry.code);
}

function diagnosticText(repository) {
  return validation(repository).diagnostics
    .map((entry) => `${entry.code} ${entry.file} ${entry.field} ${entry.reason}`)
    .join('\n');
}

function assertCode(repository, code) {
  assert.ok(
    diagnosticCodes(repository).includes(code),
    `expected ${code}\n${diagnosticText(repository)}`,
  );
}

function applySyntheticApproval(review) {
  review.status = syntheticApprovalFixture.status;
  review.reviewer = syntheticApprovalFixture.reviewer;
  review.reviewer_role = syntheticApprovalFixture.reviewer_role;
  review.reviewed_on = syntheticApprovalFixture.reviewed_on;
  review.reviewed_version.commit_sha = syntheticApprovalFixture.commit_sha;
  review.dimensions = structuredClone(syntheticApprovalFixture.dimensions);
  review.similarity_flags = [];
}

function indexEntryForTask(repository, task) {
  return repository.index.data.entries.find((entry) => entry.task_id === task.task_id);
}

function applyCurrentSyntheticApproval(repository, index = 0) {
  const task = taskData(repository, index);
  const review = reviewData(repository, index);
  applySyntheticApproval(review);
  indexEntryForTask(repository, task).current_fingerprint_status = 'current_approved';
  return { task, review };
}

function setPublicationState(repository, {
  index = 0,
  publicationStatus,
  customerVisibility,
}) {
  const task = taskData(repository, index);
  task.standalone_contract.publication_status = publicationStatus;
  task.standalone_contract.customer_visibility = customerVisibility;
  indexEntryForTask(repository, task).publication_status = publicationStatus;
  return task;
}

function setRoute(spec, routeId, role = 'neutral_skill_analysis') {
  const route = baseline.routesById.get(routeId);
  spec.source_analysis.source_status = 'available_route';
  spec.source_analysis.route_ids = [routeId];
  spec.source_analysis.source_roles = [{
    route_id: routeId,
    role,
    manual_topic_review_required: role === 'mixed_subject_support',
  }];
  spec.source_analysis.canonical_record_refs = [];
  spec.source_analysis.evidence_basis = [
    'source-manifest.json',
    route?.md_path ?? 'project-files/outputs/missing.md',
    route?.qa_path ?? 'project-files/outputs/missing_qa.json',
    'compliance/estonia/2026-27/outcome-index.yaml',
  ];
  spec.source_analysis.content_strategy = 'neutral_source_analysis';
  spec.source_analysis.manual_topic_review_required = role === 'mixed_subject_support';
}

test('valid task bank contains exactly twelve specifications, tasks, reviews, and index entries', () => {
  const result = validation(cloneRepository());
  assert.deepEqual(result.summary, {
    specifications: 12,
    tasks: 12,
    reviews: 12,
    indexed: 12,
    errors: 0,
  }, diagnosticText(cloneRepository()));
});

test('task-bank paths are present in both executable workflow trigger filters', () => {
  for (const triggerName of ['pull_request', 'push']) {
    const paths = validationWorkflow.on?.[triggerName]?.paths;
    assert.ok(Array.isArray(paths), `${triggerName}.paths must be an array`);
    for (const expectedPath of ['task-bank/**', 'test-fixtures/task-bank/**']) {
      assert.equal(
        paths.filter((entry) => entry === expectedPath).length,
        1,
        `${expectedPath} must occur exactly once in ${triggerName}.paths`,
      );
    }
  }
});

test('core workflow job executes both task-bank validation commands', () => {
  const commands = validationWorkflow.jobs?.core?.steps
    ?.map((step) => step.run)
    .filter((run) => typeof run === 'string') ?? [];
  for (const expectedCommand of [
    'npm run test:task-bank',
    'npm run check:task-bank',
  ]) {
    assert.equal(
      commands.filter((command) => command.trim() === expectedCommand).length,
      1,
      `${expectedCommand} must occur exactly once as an executable core-job step`,
    );
  }
});

test('seed inventory has the requested subject distribution', () => {
  const counts = Object.fromEntries([...new Set(baseline.tasks.map(
    (artifact) => artifact.data.subject,
  ))].sort().map((subject) => [
    subject,
    baseline.tasks.filter((artifact) => artifact.data.subject === subject).length,
  ]));
  assert.deepEqual(counts, {
    estonian_second_language: 2,
    human_studies: 1,
    mathematics: 2,
    physical_education: 1,
    russian: 2,
    science: 4,
  });
});

test('real seed tasks remain internal-only and under internal review', () => {
  assert.ok(baseline.tasks.every((artifact) => (
    artifact.data.standalone_contract.customer_visibility === 'internal_only'
    && artifact.data.standalone_contract.publication_status === 'internal_review'
  )));
});

test('real seed reviews remain pending with no invented reviewer identity', () => {
  assert.ok(baseline.reviews.every((artifact) => (
    artifact.data.status === 'pending'
    && artifact.data.reviewer === null
    && artifact.data.reviewer_role === null
    && artifact.data.reviewed_on === null
  )));
});

test('Grade 2 source analysis uses only authorized routes and never first-language Estonian', () => {
  const allowed = new Set([
    'grade-2-science',
    'grade-2-mathematics',
    'grade-2-human-studies',
    'grade-2-russian',
    'grade-2-estonian-second-language',
  ]);
  const used = baseline.specifications.flatMap(
    (artifact) => artifact.data.source_analysis.route_ids,
  );
  assert.ok(used.every((routeId) => allowed.has(routeId)));
  assert.ok(!used.includes('grade-2-estonian'));
});

test('Russian-language task analysis uses kit 454 only as an internal canonical reference', () => {
  const russian = baseline.specifications.filter(
    (artifact) => artifact.data.subject === 'russian',
  );
  assert.ok(russian.every((artifact) => artifact.data.source_analysis.canonical_record_refs
    .every((reference) => reference.canonical_url.includes('/kit/454/'))));
});

test('PE water safety uses the explicit missing-route author-created contract', () => {
  const pe = baseline.specifications.find(
    (artifact) => artifact.data.subject === 'physical_education',
  ).data.source_analysis;
  assert.equal(pe.source_status, 'missing_route');
  assert.deepEqual(pe.route_ids, []);
  assert.equal(pe.content_strategy, 'author_created_required');
  assert.equal(pe.replacement_by_human_studies_forbidden, true);
});

test('Estonian output is assessed separately from the subject result', () => {
  const bilingualOutputs = baseline.tasks.filter(
    (artifact) => artifact.data.customer_content.estonian_output_requirement.required,
  );
  assert.equal(bilingualOutputs.length, 3);
  for (const artifact of bilingualOutputs) {
    const dimensions = artifact.data.answer_contract.success_criteria.map(
      (criterion) => criterion.dimension,
    );
    assert.ok(dimensions.includes('subject_result'));
    assert.ok(dimensions.includes('estonian_language'));
  }
});

test('customer projection is exact and excludes internal links and provenance', () => {
  const projection = extractCustomerVisibleProjection(baseline.tasks[0].data);
  assert.equal(projection.task_id, baseline.tasks[0].data.task_id);
  assert.ok(!Object.hasOwn(projection, 'specification_id'));
  assert.ok(!Object.hasOwn(projection, 'authoring_provenance'));
  assert.ok(!Object.hasOwn(projection, 'originality_review_ref'));
  assert.ok(Object.hasOwn(projection, 'answer_contract'));
});

test('canonical serialization and fingerprints ignore object insertion order', () => {
  const original = baseline.tasks[0].data;
  const reordered = Object.fromEntries(Object.entries(structuredClone(original)).reverse());
  assert.equal(stableTaskBankJson(original), stableTaskBankJson(reordered));
  assert.deepEqual(computeTaskFingerprint(original), computeTaskFingerprint(reordered));
});

test('neutral specification rejects copied source task wording fixture', () => {
  const repository = cloneRepository();
  specification(repository).source_analysis.neutral_findings[0]
    = sourceDependentFixture.neutral_finding_override;
  assertCode(repository, sourceDependentFixture.expected_diagnostic_code);
});

test('customer content rejects an Opiq URL', () => {
  const repository = cloneRepository();
  taskData(repository).customer_content.prompt += ' https://www.opiq.ee/kit/132/chapter/7104';
  assertCode(repository, 'TB_CUSTOMER_OPIQ_URL');
});

test('customer content rejects an internal canonical record ID', () => {
  const repository = cloneRepository();
  taskData(repository).customer_content.prompt += ' canonical-record:weather-7104';
  assertCode(repository, 'TB_CUSTOMER_INTERNAL_RECORD');
});

test('customer answer rejects copied source wording', () => {
  const repository = cloneRepository();
  taskData(repository).answer_contract.answer = baseline.sourceSnippets[0].text;
  assertCode(repository, 'TB_CUSTOMER_SOURCE_EXCERPT');
});

test('copied source answer provenance cannot be represented as author-created', () => {
  const repository = cloneRepository();
  taskData(repository).authoring_provenance.used_source_answer_text = true;
  assertCode(repository, 'TB_SCHEMA_INVALID');
});

test('screenshot provenance cannot be represented as author-created', () => {
  const repository = cloneRepository();
  taskData(repository).authoring_provenance.used_source_screenshot = true;
  assertCode(repository, 'TB_SCHEMA_INVALID');
});

test('illustration provenance cannot be represented as author-created', () => {
  const repository = cloneRepository();
  taskData(repository).authoring_provenance.used_source_illustration = true;
  assertCode(repository, 'TB_SCHEMA_INVALID');
});

test('task rejects a missing specification reference', () => {
  const repository = cloneRepository();
  taskData(repository).specification_id = 'missing-task-specification';
  assertCode(repository, 'TB_MISSING_SPECIFICATION_REF');
});

test('review rejects a missing task reference', () => {
  const repository = cloneRepository();
  reviewData(repository).task_id = 'missing-authored-task';
  assertCode(repository, 'TB_MISSING_TASK_REF');
});

test('task rejects a missing originality review reference', () => {
  const repository = cloneRepository();
  taskData(repository).originality_review_ref = 'missing-originality-review';
  assertCode(repository, 'TB_TASK_REVIEW_LINK');
});

test('review rejects a task linked to the wrong specification', () => {
  const repository = cloneRepository();
  taskData(repository).specification_id = specification(repository, 1).specification_id;
  taskData(repository).authoring_provenance.specification_ref
    = specification(repository, 1).specification_id;
  assertCode(repository, 'TB_REVIEW_CROSS_LINK');
});

test('specification rejects an unknown outcome ID', () => {
  const repository = cloneRepository();
  specification(repository).official_outcome_ids = ['unknown-official-outcome'];
  assertCode(repository, 'TB_UNKNOWN_OUTCOME');
});

test('specification rejects an outcome not relevant to Grade 2', () => {
  const repository = cloneRepository();
  const grade4 = baseline.outcomeIndex.outcomes.find(
    (outcome) => outcome.grade_4_relevant && !outcome.grade_2_relevant,
  );
  specification(repository).official_outcome_ids = [grade4.outcome_id];
  assertCode(repository, 'TB_OUTCOME_GRADE_MISMATCH');
});

test('Grade 2 specification rejects an exact-grade national claim', () => {
  const repository = cloneRepository();
  specification(repository).official_scope.exact_grade_claimed = true;
  assertCode(repository, 'TB_EXACT_GRADE_CLAIM');
});

test('specification rejects an unknown manifest route', () => {
  const repository = cloneRepository();
  setRoute(specification(repository), 'grade-2-invented-route');
  assertCode(repository, 'TB_UNKNOWN_ROUTE');
});

test('specification rejects an adjacent-grade route', () => {
  const repository = cloneRepository();
  const adjacent = [...baseline.routesById.values()].find((route) => route.grade === 3);
  assert.ok(adjacent, 'expected at least one Grade 3 route fixture');
  setRoute(specification(repository), adjacent.id);
  assertCode(repository, 'TB_ADJACENT_GRADE_ROUTE');
});

test('default Grade 2 profile rejects first-language Estonian route evidence', () => {
  const repository = cloneRepository();
  setRoute(specification(repository), 'grade-2-estonian');
  assertCode(repository, 'TB_FIRST_LANGUAGE_ESTONIAN_ROUTE');
});

test('mixed route cannot be represented as subject-pure coverage', () => {
  const repository = cloneRepository();
  setRoute(specification(repository), 'grade-2-nature-and-human-studies');
  assertCode(repository, 'TB_MIXED_ROUTE_BOUNDARY');
});

test('mixed route support requires its manual-review role', () => {
  const repository = cloneRepository();
  setRoute(
    specification(repository),
    'grade-2-nature-and-human-studies',
    'mixed_subject_support',
  );
  const result = diagnosticCodes(repository);
  assert.ok(!result.includes('TB_MIXED_ROUTE_BOUNDARY'), diagnosticText(repository));
});

test('ordinary seed specification rejects simplified-curriculum record evidence', () => {
  const repository = cloneRepository();
  const record = [...baseline.sourceRecordsByRoute.get('grade-2-science').values()]
    .find((entry) => entry.programmeType === 'simplified_curriculum');
  assert.ok(record, 'expected simplified science record fixture');
  specification(repository).source_analysis.canonical_record_refs = [{
    route_id: 'grade-2-science',
    canonical_url: record.canonicalUrl,
    programme_type: 'simplified_curriculum',
    evidence_role: 'neutral_skill_analysis',
  }];
  assertCode(repository, 'TB_SIMPLIFIED_DEFAULT_SOURCE');
});

test('supplementary record cannot silently become mastery-core evidence', () => {
  const repository = cloneRepository();
  const record = [...baseline.sourceRecordsByRoute.get('grade-2-science').values()]
    .find((entry) => ['supplementary', 'supplementary_material'].includes(entry.programmeType));
  assert.ok(record, 'expected supplementary science record fixture');
  specification(repository).source_analysis.canonical_record_refs = [{
    route_id: 'grade-2-science',
    canonical_url: record.canonicalUrl,
    programme_type: record.programmeType,
    evidence_role: 'neutral_skill_analysis',
  }];
  assertCode(repository, 'TB_SUPPLEMENTARY_MASTERY_SOURCE');
});

test('kit 330 is restricted to optional project support', () => {
  const repository = cloneRepository();
  const record = [...baseline.sourceRecordsByRoute.get('grade-2-science').values()]
    .find((entry) => entry.canonicalUrl.includes('/kit/330/'));
  assert.ok(record, 'expected kit 330 record fixture');
  specification(repository).source_analysis.canonical_record_refs = [{
    route_id: 'grade-2-science',
    canonical_url: record.canonicalUrl,
    programme_type: record.programmeType,
    evidence_role: 'neutral_skill_analysis',
  }];
  assertCode(repository, 'TB_KIT330_BOUNDARY');
});

test('youth-training route cannot be used as school-curriculum evidence', () => {
  const repository = cloneRepository();
  setRoute(specification(repository), 'grade-2-kodututarde-training');
  assertCode(repository, 'TB_YOUTH_TRAINING_ROUTE');
});

test('PE water safety cannot be replaced by human-studies source evidence', () => {
  const repository = cloneRepository();
  const pe = repository.specifications.find(
    (artifact) => artifact.data.subject === 'physical_education',
  ).data;
  setRoute(pe, 'grade-2-human-studies');
  pe.source_analysis.replacement_by_human_studies_forbidden = false;
  assertCode(repository, 'TB_PE_MISSING_ROUTE');
});

test('PE water safety rejects a fake Opiq route', () => {
  const repository = cloneRepository();
  const pe = repository.specifications.find(
    (artifact) => artifact.data.subject === 'physical_education',
  ).data;
  setRoute(pe, 'grade-2-physical-education-fake');
  assertCode(repository, 'TB_UNKNOWN_ROUTE');
  assertCode(repository, 'TB_PE_MISSING_ROUTE');
});

test('closed task requires an answer', () => {
  const repository = cloneRepository();
  taskData(repository).answer_contract.answer = null;
  assertCode(repository, 'TB_CLOSED_TASK_ANSWER');
});

test('procedural task requires a worked solution', () => {
  const repository = cloneRepository();
  taskData(repository, 1).answer_contract.worked_solution = null;
  assertCode(repository, 'TB_WORKED_SOLUTION_REQUIRED');
});

test('computational task requires a worked solution', () => {
  const repository = cloneRepository();
  taskData(repository, 2).answer_contract.worked_solution = null;
  assertCode(repository, 'TB_WORKED_SOLUTION_REQUIRED');
});

test('open-ended task requires explicit justification', () => {
  const repository = cloneRepository();
  delete taskData(repository, 10).answer_contract.open_ended_justification;
  assertCode(repository, 'TB_OPEN_ENDED_JUSTIFICATION');
});

test('customer task cannot require Opiq or external access', () => {
  const repository = cloneRepository();
  taskData(repository).standalone_contract.works_without_opiq = false;
  taskData(repository).standalone_contract.external_access_required = true;
  assertCode(repository, 'TB_STANDALONE_REQUIRED');
});

test('publication-ready task rejects a pending review', () => {
  const repository = cloneRepository();
  taskData(repository).standalone_contract.publication_status = 'publication_ready';
  assertCode(repository, 'TB_PUBLICATION_REVIEW_GATE');
});

test('customer-visible internal-review task rejects a pending review', () => {
  const repository = cloneRepository();
  setPublicationState(repository, {
    publicationStatus: 'internal_review',
    customerVisibility: 'customer_visible',
  });
  assertCode(repository, 'TB_CUSTOMER_VISIBILITY_REVIEW_GATE');
});

test('customer-visible internal-draft task is rejected', () => {
  const repository = cloneRepository();
  setPublicationState(repository, {
    publicationStatus: 'internal_draft',
    customerVisibility: 'customer_visible',
  });
  assertCode(repository, 'TB_CUSTOMER_VISIBILITY_REVIEW_GATE');
});

test('customer-visible publication-ready task rejects a pending review', () => {
  const repository = cloneRepository();
  setPublicationState(repository, {
    publicationStatus: 'publication_ready',
    customerVisibility: 'customer_visible',
  });
  assertCode(repository, 'TB_CUSTOMER_VISIBILITY_REVIEW_GATE');
  assertCode(repository, 'TB_PUBLICATION_REVIEW_GATE');
});

test('customer-visible task rejects changes-requested and rejected reviews', () => {
  for (const reviewStatus of ['changes_requested', 'rejected']) {
    const repository = cloneRepository();
    const { task, review } = applyCurrentSyntheticApproval(repository);
    review.status = reviewStatus;
    indexEntryForTask(repository, task).current_fingerprint_status = 'current_pending_review';
    setPublicationState(repository, {
      publicationStatus: 'publication_ready',
      customerVisibility: 'customer_visible',
    });
    assertCode(repository, 'TB_CUSTOMER_VISIBILITY_REVIEW_GATE');
    assertCode(repository, 'TB_PUBLICATION_REVIEW_GATE');
  }
});

test('customer-visible task rejects a missing review', () => {
  const repository = cloneRepository();
  repository.reviews.splice(0, 1);
  setPublicationState(repository, {
    publicationStatus: 'publication_ready',
    customerVisibility: 'customer_visible',
  });
  assertCode(repository, 'TB_CUSTOMER_VISIBILITY_REVIEW_GATE');
  assertCode(repository, 'TB_PUBLICATION_REVIEW_GATE');
});

test('customer-released task cannot remain internal-only', () => {
  const repository = cloneRepository();
  applyCurrentSyntheticApproval(repository);
  setPublicationState(repository, {
    publicationStatus: 'customer_released',
    customerVisibility: 'internal_only',
  });
  assertCode(repository, 'TB_CUSTOMER_VISIBILITY_REVIEW_GATE');
  assert.ok(
    !diagnosticCodes(repository).includes('TB_PUBLICATION_REVIEW_GATE'),
    diagnosticText(repository),
  );
});

test('customer-visible task rejects a stale approved review', () => {
  const repository = cloneRepository();
  const { review } = applyCurrentSyntheticApproval(repository);
  setPublicationState(repository, {
    publicationStatus: 'publication_ready',
    customerVisibility: 'customer_visible',
  });
  review.reviewed_version.content_fingerprint.value = '0'.repeat(64);
  assertCode(repository, 'TB_STALE_REVIEW_FINGERPRINT');
  assertCode(repository, 'TB_CUSTOMER_VISIBILITY_REVIEW_GATE');
  assertCode(repository, 'TB_PUBLICATION_REVIEW_GATE');
});

test('customer-visible task rejects an approved review with incomplete dimensions', () => {
  const repository = cloneRepository();
  const { review } = applyCurrentSyntheticApproval(repository);
  review.dimensions.wording_independence = 'pending';
  setPublicationState(repository, {
    publicationStatus: 'publication_ready',
    customerVisibility: 'customer_visible',
  });
  assertCode(repository, 'TB_CUSTOMER_VISIBILITY_REVIEW_GATE');
  assertCode(repository, 'TB_PUBLICATION_REVIEW_GATE');
});

test('customer-visible task rejects an approved review with similarity flags', () => {
  const repository = cloneRepository();
  const { review } = applyCurrentSyntheticApproval(repository);
  review.similarity_flags = structuredClone(tooSimilarFixture.similarity_flags);
  setPublicationState(repository, {
    publicationStatus: 'publication_ready',
    customerVisibility: 'customer_visible',
  });
  assertCode(repository, 'TB_CUSTOMER_VISIBILITY_REVIEW_GATE');
  assertCode(repository, 'TB_PUBLICATION_REVIEW_GATE');
});

test('publication-ready task may remain internal-only with a current approved review', () => {
  const repository = cloneRepository();
  applyCurrentSyntheticApproval(repository);
  setPublicationState(repository, {
    publicationStatus: 'publication_ready',
    customerVisibility: 'internal_only',
  });
  assert.deepEqual(validation(repository).diagnostics, []);
});

test('customer-released task may be customer-visible with a current approved review', () => {
  const repository = cloneRepository();
  applyCurrentSyntheticApproval(repository);
  setPublicationState(repository, {
    publicationStatus: 'customer_released',
    customerVisibility: 'customer_visible',
  });
  assert.deepEqual(validation(repository).diagnostics, []);
});

test('approved review rejects a stale fingerprint', () => {
  const repository = cloneRepository();
  applySyntheticApproval(reviewData(repository));
  reviewData(repository).reviewed_version.content_fingerprint.value = '0'.repeat(64);
  taskData(repository).standalone_contract.publication_status = 'publication_ready';
  assertCode(repository, 'TB_STALE_REVIEW_FINGERPRINT');
  assertCode(repository, 'TB_PUBLICATION_REVIEW_GATE');
});

test('approved review accepts a valid leap-year ISO date', () => {
  const repository = cloneRepository();
  const { review } = applyCurrentSyntheticApproval(repository);
  review.reviewed_on = '2024-02-29';
  assert.deepEqual(validation(repository).diagnostics, []);
});

test('approved review rejects an invalid leap-day date', () => {
  const repository = cloneRepository();
  const { review } = applyCurrentSyntheticApproval(repository);
  review.reviewed_on = '2026-02-29';
  assertCode(repository, 'TB_APPROVED_REVIEW_DATE');
});

test('approved review rejects an impossible February date', () => {
  const repository = cloneRepository();
  const { review } = applyCurrentSyntheticApproval(repository);
  review.reviewed_on = '2026-02-30';
  assertCode(repository, 'TB_APPROVED_REVIEW_DATE');
});

test('approved review rejects a non-date string', () => {
  const repository = cloneRepository();
  const { review } = applyCurrentSyntheticApproval(repository);
  review.reviewed_on = 'yesterday';
  assertCode(repository, 'TB_APPROVED_REVIEW_DATE');
});

test('approved review accepts a valid ordinary ISO date', () => {
  const repository = cloneRepository();
  const { review } = applyCurrentSyntheticApproval(repository);
  review.reviewed_on = '2026-07-30';
  assert.deepEqual(validation(repository).diagnostics, []);
});

test('approved review rejects unresolved structural similarity fixture flags', () => {
  const repository = cloneRepository();
  applySyntheticApproval(reviewData(repository));
  reviewData(repository).similarity_flags = structuredClone(tooSimilarFixture.similarity_flags);
  assertCode(repository, tooSimilarFixture.expected_diagnostic_code);
});

test('approved review requires all independence dimensions', () => {
  const repository = cloneRepository();
  applySyntheticApproval(reviewData(repository));
  reviewData(repository).dimensions.wording_independence = 'pending';
  assertCode(repository, 'TB_APPROVED_REVIEW_DIMENSIONS');
});

test('multiple distinctive similarity flags always require human review', () => {
  const repository = cloneRepository();
  reviewData(repository).similarity_flags = structuredClone(tooSimilarFixture.similarity_flags);
  reviewData(repository).human_review_required = false;
  assertCode(repository, 'TB_SIMILARITY_HUMAN_REVIEW');
});

test('duplicate artifact IDs are rejected', () => {
  const repository = cloneRepository();
  taskData(repository, 1).task_id = taskData(repository).task_id;
  assertCode(repository, 'TB_DUPLICATE_ID');
});

test('duplicate task-bank index IDs are rejected', () => {
  const repository = cloneRepository();
  repository.index.data.entries[1].task_id = repository.index.data.entries[0].task_id;
  assertCode(repository, 'TB_INDEX_DUPLICATE');
});

test('stale task-bank index path is rejected', () => {
  const repository = cloneRepository();
  repository.index.data.entries[0].task_path
    = 'task-bank/tasks/grade-2/weather-water-safety/missing.yaml';
  assertCode(repository, 'TB_STALE_INDEX_REFERENCE');
});

test('unsafe repository path fixture is rejected', () => {
  const repository = cloneRepository();
  repository.index.data.entries[0].task_path = unsafePathFixture.path_override;
  assertCode(repository, unsafePathFixture.expected_diagnostic_code);
});

test('changed customer content makes review and index fingerprints stale', () => {
  const repository = cloneRepository();
  taskData(repository).customer_content.prompt += ' Дополнительное новое предложение.';
  assertCode(repository, 'TB_STALE_REVIEW_FINGERPRINT');
  assertCode(repository, 'TB_STALE_INDEX_FINGERPRINT');
});

test('duplicate YAML keys are rejected by strict parsing', async () => {
  const file = 'test-fixtures/task-bank/duplicate-key.yaml';
  const text = await fs.readFile(file, 'utf8');
  assert.throws(
    () => parseStrictCurriculumYaml(text, file),
    /Map keys must be unique|duplicate/iu,
  );
});
