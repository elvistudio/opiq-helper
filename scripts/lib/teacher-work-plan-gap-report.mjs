import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import Ajv2020 from 'ajv/dist/2020.js';

import {
  formatTeacherWorkPlanCurriculumMapDiagnostic,
  loadTeacherWorkPlanCurriculumMapRepository,
  validateTeacherWorkPlanCurriculumMapRepository,
} from './teacher-work-plan-curriculum-maps.mjs';
import {
  WORK_PACKAGE_REVIEW_SUMMARY,
  formatTeacherWorkPlanWorkPackageDiagnostic,
  loadTeacherWorkPlanWorkPackages,
  validateTeacherWorkPlanWorkPackages,
} from './teacher-work-plan-work-packages.mjs';
import {
  formatTeacherWorkPlanReusableArtifactDiagnostic,
  loadTeacherWorkPlanReusableArtifactRepository,
  validateTeacherWorkPlanReusableArtifactRepository,
} from './teacher-work-plan-reusable-artifacts.mjs';
import {
  formatTeacherWorkPlanArtifactClassroomTrialDiagnostic,
  loadTeacherWorkPlanArtifactClassroomTrialRepositories,
  validateTeacherWorkPlanArtifactClassroomTrialRepositories,
} from './teacher-work-plan-artifact-classroom-trials.mjs';

export const GAP_REPORT_JSON_PATH =
  'evaluations/teacher-work-plans/grades-5-7-gap-report.json';
export const GAP_REPORT_MARKDOWN_PATH =
  'docs/audits/grades-5-7-teacher-work-plan-gap-report.md';
export const GAP_REPORT_SCHEMA_PATH =
  'schemas/teacher-work-plan-gap-report.schema.json';

const ROUTE_ORDER = Object.freeze([
  'grade-5-science',
  'grade-6-science',
  'grade-7-geography',
  'grade-7-science',
]);

const COVERAGE_STATUSES = Object.freeze([
  'matched',
  'partial',
  'missing',
  'ambiguous',
  'outside_route',
]);

const GAP_COVERAGE_STATUSES = Object.freeze([
  'partial',
  'missing',
  'ambiguous',
  'outside_route',
]);

const BRIDGE_TYPES = Object.freeze([
  'independently_authored_bridge_required',
  'independently_authored_practical_required',
  'independently_authored_assessment_required',
  'teacher_review_required',
]);

const PROGRAMME_TYPES = Object.freeze([
  'ordinary',
  'supplementary',
  'teacher_support',
  'simplified_curriculum',
  'unknown',
]);

const EVIDENCE_LANGUAGES = Object.freeze(['et', 'ru']);

const SAMPLE_TOPIC_ABSENCES = Object.freeze([
  Object.freeze({ source_id: 'grade-5-science', topic_id: 'air-properties-and-protection' }),
  Object.freeze({ source_id: 'grade-5-science', topic_id: 'weather-and-climate' }),
  Object.freeze({ source_id: 'grade-5-science', topic_id: 'baltic-sea' }),
  Object.freeze({ source_id: 'grade-6-science', topic_id: 'settlement-ecosystem' }),
  Object.freeze({ source_id: 'grade-6-science', topic_id: 'bog-ecosystem' }),
]);

const AUTHORING_QUEUE_SUMMARY = Object.freeze({
  selected_next_package_id: 'grade-6-science-wood-processing',
  selected_next_package_status: 'selected_not_started',
  selected_next_gap_ids: ['grade-6-science-lesson-038'],
  selected_next_planned_root: 'teacher-work-plan-artifacts/grade-6-science/wood-processing',
  selected_next_material_count: 0,
  selected_next_review_workflow_created: false,
  selected_next_trial_workflow_created: false,
  source_gap_resolution_claimed: false,
});

function compareBytewise(left, right) {
  return Buffer.from(String(left)).compare(Buffer.from(String(right)));
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function exactCounts(keys, values) {
  return Object.fromEntries(keys.map((key) => [key, values.filter((value) => value === key).length]));
}

function sumField(records, field) {
  return records.reduce((sum, record) => sum + record[field], 0);
}

function diagnostic(field, reason) {
  return { file: GAP_REPORT_JSON_PATH, field: field || '/', reason };
}

function safeRepositoryPath(rootDir, repositoryPath) {
  if (
    typeof repositoryPath !== 'string'
    || repositoryPath.length === 0
    || path.isAbsolute(repositoryPath)
    || repositoryPath.includes('\\')
    || repositoryPath.split('/').some((segment) => ['', '.', '..'].includes(segment))
  ) throw new Error(`unsafe repository path: ${repositoryPath}`);
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, repositoryPath);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error(`repository path escapes root: ${repositoryPath}`);
  return resolved;
}

function schemaReason(error) {
  if (error.keyword === 'additionalProperties') return `unknown field ${error.params.additionalProperty}`;
  if (error.keyword === 'required') return `missing required field ${error.params.missingProperty}`;
  return error.message ?? `failed ${error.keyword}`;
}

function allTopicRecords(topicInventory) {
  return (topicInventory.topics ?? []).flatMap((topic) => (
    ['selected_records', 'alternative_records', 'rejected_records']
      .flatMap((bucket) => topic[bucket] ?? [])
  ));
}

function normalizedSourceRecordKind(mapping, unnumbered = false) {
  if (unnumbered) return 'unnumbered_source_row';
  if (mapping.source_record_kind === 'unassigned_annual_slot') return 'unassigned_annual_slot';
  return 'lesson_range';
}

function sourceOrderEntry(mapping, unnumbered, originalIndex) {
  if (unnumbered) {
    return {
      mapping,
      unnumbered,
      originalIndex,
      orderLesson: mapping.placement.after_lesson,
      orderKind: 1,
    };
  }
  return {
    mapping,
    unnumbered,
    originalIndex,
    orderLesson: mapping.lesson_start,
    orderKind: 0,
  };
}

function orderedMappings(artifact) {
  const entries = [
    ...(artifact.lesson_range_mappings ?? []).map((mapping, index) => (
      sourceOrderEntry(mapping, false, index)
    )),
    ...(artifact.unnumbered_source_mappings ?? []).map((mapping, index) => (
      sourceOrderEntry(mapping, true, index)
    )),
  ];
  return entries.sort((left, right) => (
    left.orderLesson - right.orderLesson
    || left.orderKind - right.orderKind
    || left.originalIndex - right.originalIndex
  ));
}

function countMappingsWithLanguage(entries, language) {
  return entries.filter(({ mapping }) => (
    (mapping.opiq_matches ?? []).some((match) => match.language === language)
  )).length;
}

function countMappingsWithOralScope(entries) {
  return entries.filter(({ mapping }) => (
    (mapping.opiq_matches ?? []).some((match) => (
      (match.match_scope ?? []).includes('oral_language_support')
    ))
  )).length;
}

function positiveProgrammeCounts(matches) {
  return exactCounts(PROGRAMME_TYPES, matches.map((match) => match.programme_type));
}

function positiveLanguageCounts(matches) {
  return exactCounts(EVIDENCE_LANGUAGES, matches.map((match) => match.language));
}

function bridgeTypeCounts(entries) {
  return exactCounts(
    BRIDGE_TYPES,
    entries.map(({ mapping }) => mapping.evidence_classification?.bridging_content),
  );
}

function coverageCounts(entries) {
  return exactCounts(COVERAGE_STATUSES, entries.map(({ mapping }) => mapping.coverage_status));
}

function sourceRecordKindCounts(entries) {
  const kinds = entries.map(({ mapping, unnumbered }) => (
    normalizedSourceRecordKind(mapping, unnumbered)
  ));
  return exactCounts(['lesson_range', 'unassigned_annual_slot', 'unnumbered_source_row'], kinds);
}

function buildGapItem(repository, entry) {
  const { mapping, unnumbered } = entry;
  const sourceId = repository.contract.sourceId;
  const sourceRecordKind = normalizedSourceRecordKind(mapping, unnumbered);
  const matches = mapping.opiq_matches ?? [];
  return {
    gap_id: `${sourceId}-${mapping.mapping_id}`,
    source_id: sourceId,
    grade: repository.artifact.grade,
    subject: repository.artifact.subject,
    subject_et: repository.artifact.subject_et,
    mapping_id: mapping.mapping_id,
    source_record_kind: sourceRecordKind,
    source_block_id: mapping.source_block_id,
    lesson_span: sourceRecordKind === 'unnumbered_source_row'
      ? null
      : { lesson_start: mapping.lesson_start, lesson_end: mapping.lesson_end },
    placement: sourceRecordKind === 'unnumbered_source_row' ? { ...mapping.placement } : null,
    source_pages: [...mapping.source_pages],
    source_topic_et: mapping.source_topic_et,
    normalized_mapping_topic_et: mapping.normalized_mapping_topic_et,
    coverage_status: mapping.coverage_status,
    bridge_type: mapping.evidence_classification.bridging_content,
    bridge_reason: mapping.bridge_requirement.reason,
    gap_notes: [...mapping.gap_notes],
    topic_inventory_refs: [...mapping.topic_inventory_refs],
    evidence_languages: EVIDENCE_LANGUAGES.filter((language) => (
      matches.some((match) => match.language === language)
    )),
    positive_match_record_ids: matches.map((match) => match.record_id),
    positive_match_urls: matches.map((match) => match.canonical_url),
    positive_match_programme_types: matches.map((match) => match.programme_type),
    mapping_confidence: mapping.mapping_confidence,
    review_status: mapping.review_status,
  };
}

function assertProductionGapInvariant(repository, entries) {
  for (const { mapping } of entries) {
    const bridgeType = mapping.evidence_classification?.bridging_content;
    const required = mapping.bridge_requirement?.required;
    if (required !== (bridgeType !== 'none')) {
      throw new Error(`${repository.artifactPath}: ${mapping.mapping_id} bridge requirement disagrees with bridging_content`);
    }
    if (mapping.coverage_status === 'matched' && required) {
      throw new Error(`${repository.artifactPath}: matched mapping ${mapping.mapping_id} cannot require a bridge`);
    }
    if (mapping.coverage_status !== 'matched' && !required) {
      throw new Error(`${repository.artifactPath}: non-matched mapping ${mapping.mapping_id} must require a bridge`);
    }
    if (mapping.coverage_status !== 'matched' && !BRIDGE_TYPES.includes(bridgeType)) {
      throw new Error(`${repository.artifactPath}: ${mapping.mapping_id} has unsupported gap bridge type ${bridgeType}`);
    }
  }
}

function buildRouteModel(repository) {
  const { artifact, artifactPath, artifactText, contract, extraction, topicInventory } = repository;
  const entries = orderedMappings(artifact);
  assertProductionGapInvariant(repository, entries);
  const matches = entries.flatMap(({ mapping }) => mapping.opiq_matches ?? []);
  const comparisons = artifact.topic_inventory_comparison ?? [];
  const represented = comparisons.filter((entry) => (
    ['represented', 'partially_represented'].includes(entry.representation_status)
  )).map((entry) => entry.topic_id);
  const notRepresented = comparisons.filter((entry) => (
    entry.representation_status === 'not_represented'
  )).map((entry) => entry.topic_id);
  const gapItems = entries.filter(({ mapping }) => mapping.bridge_requirement.required)
    .map((entry) => buildGapItem(repository, entry));
  const nonMatched = entries.filter(({ mapping }) => mapping.coverage_status !== 'matched');
  if (gapItems.length !== nonMatched.length) {
    throw new Error(`${artifactPath}: gap item count must equal non-matched mapping count`);
  }
  const oralRecords = allTopicRecords(topicInventory)
    .filter((record) => (record.instructional_roles ?? []).includes('oral_answer_et'));
  const oralPositiveOccurrences = matches.filter((match) => (
    (match.instructional_roles ?? []).includes('oral_answer_et')
  )).length;
  const oralMappings = countMappingsWithOralScope(entries);
  const common = {
    source_id: contract.sourceId,
    grade: artifact.grade,
    subject: artifact.subject,
    subject_et: artifact.subject_et,
  };
  return {
    input: {
      ...common,
      crosswalk_path: artifactPath,
      crosswalk_sha256: sha256(Buffer.from(artifactText, 'utf8')),
      extraction_path: contract.extractionPath,
      lesson_range_mapping_count: artifact.lesson_range_mappings.length,
      unnumbered_source_row_count: artifact.unnumbered_source_mappings?.length ?? 0,
      total_source_record_count: entries.length,
      mapping_status: extraction.route_context.mapping_status,
    },
    summary: {
      ...common,
      crosswalk_path: artifactPath,
      programme_policy: contract.programmePolicy,
      lesson_range_mapping_count: artifact.lesson_range_mappings.length,
      unnumbered_source_row_count: artifact.unnumbered_source_mappings?.length ?? 0,
      total_source_record_count: entries.length,
      source_record_kind_counts: sourceRecordKindCounts(entries),
      coverage_counts: coverageCounts(entries),
      gap_item_count: gapItems.length,
      bridge_type_counts: bridgeTypeCounts(entries),
      mappings_with_russian_evidence: countMappingsWithLanguage(entries, 'ru'),
      mappings_with_estonian_evidence: countMappingsWithLanguage(entries, 'et'),
      positive_match_occurrence_count: matches.length,
      unique_positive_evidence_record_count: new Set(matches.map((match) => match.record_id)).size,
      positive_match_counts_by_programme_type: positiveProgrammeCounts(matches),
      represented_topic_inventory_count: represented.length,
      not_represented_topic_inventory_count: notRepresented.length,
      represented_topic_ids: represented,
      not_represented_topic_ids: notRepresented,
      mappings_with_oral_language_support_scope: oralMappings,
      positive_matches_with_oral_answer_et_role: oralPositiveOccurrences,
      extraction_mapping_status: extraction.route_context.mapping_status,
      canonical_opiq_mapping_complete: artifact.completeness.canonical_opiq_mapping_complete,
      official_curriculum_complete: artifact.completeness.official_curriculum_complete,
      default_course_selection_complete: artifact.completeness.default_course_selection_complete === true,
    },
    gapItems,
    matches,
    comparisons,
    oral: {
      source_id: contract.sourceId,
      registered_topic_records_with_oral_answer_et_role: oralRecords.length,
      positive_match_occurrences_with_oral_answer_et_role: oralPositiveOccurrences,
      mappings_with_oral_language_support_scope: oralMappings,
      explicit_oral_page_evidence_available: oralRecords.length > 0,
    },
  };
}

function attachWorkPackageReview(report) {
  return {
    ...report,
    work_package_review: structuredClone(WORK_PACKAGE_REVIEW_SUMMARY),
    boundaries: {
      ...report.boundaries,
      semantic_work_package_review_complete: true,
    },
  };
}

function attachReusableArtifactImplementation(report, reusableRepository = null) {
  let authoringQueue = AUTHORING_QUEUE_SUMMARY;
  let reusableImplementation = null;
  if (reusableRepository) {
    const queue = reusableRepository.registryRepository.registry.data.authoring_queue;
    const workPackage = reusableRepository.workPackageRepository.artifact.work_packages
      .find(({ package_id }) => package_id === queue.next_package_id);
    authoringQueue = {
      selected_next_package_id: queue.next_package_id,
      selected_next_package_status: queue.status,
      selected_next_gap_ids: workPackage.source_gap_refs.map(({ gap_id }) => gap_id),
      selected_next_planned_root: queue.planned_root_path,
      selected_next_material_count: 0,
      selected_next_review_workflow_created: queue.human_review_workflow_created,
      selected_next_trial_workflow_created: queue.classroom_trial_workflow_created,
      source_gap_resolution_claimed: queue.source_gap_resolution_claimed,
    };
    const artifacts = reusableRepository.artifactContexts.map((context) => {
      const artifact = context.indexEntry.data;
      const reviewRegistry = context.dependencies.reviewRegistry.data;
      return {
        package_id: artifact.package_id,
        artifact_index_path: context.registryEntry.index_path,
        implementation_status: artifact.implementation_status,
        supported_gap_ids: artifact.source_gap_support.supported_gap_ids,
        delivered_capability_count: artifact.materials.length,
        opiq_context_record_count: artifact.opiq_context_records.length,
        human_review: {
          registry_path: context.registryEntry.review_registry_path,
          workflow_created: true,
          content_fingerprint: artifact.content_fingerprint.value,
          teacher_review_status: reviewRegistry.teacher_review.status,
          local_safety_review_status: reviewRegistry.local_safety_review.status,
          completed_teacher_review_count: reviewRegistry.teacher_review.completed_record_paths.length,
          completed_safety_review_count: reviewRegistry.local_safety_review.completed_record_paths.length,
          classroom_trial_status: reviewRegistry.classroom_trial.status,
          review_decision_recorded: false,
          classroom_ready: false,
          publication_ready: false,
          effectiveness_claimed: false,
        },
        classroom_trial_workflow_created: true,
        classroom_trial_template_path: context.registryEntry.classroom_trial_template_path,
        completed_classroom_trial_record_count: reviewRegistry.classroom_trial.completed_record_paths.length,
        classroom_trial_status: reviewRegistry.classroom_trial.status,
        classroom_ready: artifact.readiness.classroom_ready,
        publication_ready: artifact.readiness.publication_ready,
        customer_released: artifact.readiness.customer_released,
        effectiveness_claimed: artifact.readiness.effectiveness_claimed,
        canonical_gap_status_unchanged: artifact.source_gap_support.canonical_opiq_gap_status_unchanged,
        source_gap_resolution_claimed: artifact.source_gap_support.source_gap_resolution_claimed,
      };
    });
    reusableImplementation = {
      implemented_package_count: artifacts.length,
      implemented_source_gap_count: artifacts.reduce((total, artifact) => total + artifact.supported_gap_ids.length, 0),
      delivered_capability_count: artifacts.reduce((total, artifact) => total + artifact.delivered_capability_count, 0),
      human_review_workflow_count: artifacts.length,
      teacher_review_pending_count: artifacts.filter(({ human_review }) => human_review.teacher_review_status === 'pending').length,
      local_safety_review_pending_count: artifacts.filter(({ human_review }) => human_review.local_safety_review_status === 'pending').length,
      completed_human_review_record_count: artifacts.reduce((total, artifact) => total
        + artifact.human_review.completed_teacher_review_count
        + artifact.human_review.completed_safety_review_count, 0),
      classroom_trial_workflow_count: artifacts.filter(({ classroom_trial_workflow_created }) => classroom_trial_workflow_created).length,
      completed_classroom_trial_record_count: artifacts.reduce((total, artifact) => total + artifact.completed_classroom_trial_record_count, 0),
      classroom_trial_not_tested_count: artifacts.filter(({ classroom_trial_status }) => classroom_trial_status === 'not_tested').length,
      artifacts,
      canonical_gap_status_unchanged: artifacts.every(({ canonical_gap_status_unchanged }) => canonical_gap_status_unchanged),
      source_gap_resolution_claimed: artifacts.some(({ source_gap_resolution_claimed }) => source_gap_resolution_claimed),
    };
  }
  if (!reusableImplementation) throw new Error('validated reusable artifact repository is required');
  return {
    ...report,
    reusable_artifact_implementation: reusableImplementation,
    authoring_queue: structuredClone(authoringQueue),
    boundaries: {
      ...report.boundaries,
      reusable_teaching_artifacts_created: true,
    },
  };
}

function buildReportFromValidatedRepository(repository, { includeWorkPackageReview = true } = {}) {
  const bySourceId = new Map(repository.artifacts.map((entry) => [entry.contract.sourceId, entry]));
  const orderedRepositories = ROUTE_ORDER.map((sourceId) => bySourceId.get(sourceId));
  if (orderedRepositories.some((entry) => entry === undefined) || bySourceId.size !== ROUTE_ORDER.length) {
    throw new Error(`gap report requires exactly these routes in order: ${ROUTE_ORDER.join(', ')}`);
  }
  const routes = orderedRepositories.map(buildRouteModel);
  const routeSummaries = routes.map((route) => route.summary);
  const matches = routes.flatMap((route) => route.matches.map((match) => ({ sourceId: route.summary.source_id, match })));
  const gapItems = routes.flatMap((route) => route.gapItems);
  const comparisons = routes.flatMap((route) => route.comparisons);
  const aggregateCoverage = Object.fromEntries(COVERAGE_STATUSES.map((status) => [
    `${status}_count`,
    routeSummaries.reduce((sum, route) => sum + route.coverage_counts[status], 0),
  ]));
  const aggregateBridgeTypes = Object.fromEntries(BRIDGE_TYPES.map((bridgeType) => [
    bridgeType,
    routeSummaries.reduce((sum, route) => sum + route.bridge_type_counts[bridgeType], 0),
  ]));
  const programmeCounts = Object.fromEntries(PROGRAMME_TYPES.map((programmeType) => [
    programmeType,
    matches.filter(({ match }) => match.programme_type === programmeType).length,
  ]));
  const languageCounts = Object.fromEntries(EVIDENCE_LANGUAGES.map((language) => [
    language,
    matches.filter(({ match }) => match.language === language).length,
  ]));
  const sampleTopicAbsences = routes.flatMap((route) => (
    route.summary.not_represented_topic_ids.map((topicId) => ({
      source_id: route.summary.source_id,
      topic_id: topicId,
      classification: 'not_represented_in_supplementary_teacher_plan_sample',
      official_curriculum_gap_claimed: false,
      notes: 'This topic is not represented in this supplementary teacher-plan sample; this is not evidence that it is absent from the official curriculum.',
    }))
  ));
  const report = {
    schema_version: '1.0',
    artifact_type: 'teacher_work_plan_gap_report',
    report_id: 'grades-5-7-teacher-work-plan-gap-report',
    scope: {
      routes: [...ROUTE_ORDER],
      source_kind: 'supplementary_teacher_work_plan_crosswalks',
      gap_unit: 'source_mapping',
      deduplication_key: 'source_id_and_mapping_id',
      live_catalogue_checked: false,
      official_curriculum_completeness_claimed: false,
      default_course_selection_claimed: false,
    },
    inputs: routes.map((route) => route.input),
    aggregate_summary: {
      route_count: routes.length,
      lesson_range_mapping_count: sumField(routeSummaries, 'lesson_range_mapping_count'),
      unnumbered_source_row_count: sumField(routeSummaries, 'unnumbered_source_row_count'),
      total_source_record_count: sumField(routeSummaries, 'total_source_record_count'),
      ...aggregateCoverage,
      gap_item_count: gapItems.length,
      mappings_requiring_bridge_or_review: sumField(routeSummaries, 'gap_item_count'),
      mappings_with_russian_evidence: sumField(routeSummaries, 'mappings_with_russian_evidence'),
      mappings_with_estonian_evidence: sumField(routeSummaries, 'mappings_with_estonian_evidence'),
      route_local_topic_inventory_count: comparisons.length,
      represented_topic_inventory_count: sumField(routeSummaries, 'represented_topic_inventory_count'),
      not_represented_topic_inventory_count: sumField(routeSummaries, 'not_represented_topic_inventory_count'),
      positive_match_occurrence_count: matches.length,
      unique_positive_evidence_record_count: new Set(matches.map(({ sourceId, match }) => `${sourceId}\0${match.record_id}`)).size,
      positive_match_counts_by_programme_type: programmeCounts,
      positive_match_counts_by_language: languageCounts,
      bridge_type_counts: aggregateBridgeTypes,
      mappings_with_oral_language_support_scope: sumField(routeSummaries, 'mappings_with_oral_language_support_scope'),
      positive_matches_with_oral_answer_et_role: sumField(routeSummaries, 'positive_matches_with_oral_answer_et_role'),
    },
    route_summaries: routeSummaries,
    gap_items: gapItems,
    sample_topic_absences: sampleTopicAbsences,
    oral_evidence_summary: routes.map((route) => route.oral),
    boundaries: {
      official_curriculum_complete: false,
      exact_grade_official_allocation_verified: false,
      live_opiq_catalogue_complete: false,
      default_course_selection_complete: false,
      reusable_teaching_artifacts_created: false,
      semantic_work_package_review_complete: false,
      notes: [
        'The source plans are supplementary and noncanonical.',
        'The gap report covers only the four registered teacher-plan samples.',
        'A sample topic absence is not an official curriculum absence.',
        'Programme eligibility remains route-specific and is not promoted by this report.',
      ],
    },
    completeness: {
      all_registered_crosswalks_loaded: true,
      all_source_records_accounted_for: true,
      all_nonmatched_mappings_indexed: true,
      gap_index_complete_for_registered_crosswalks: true,
      official_curriculum_complete: false,
      reusable_artifact_backlog_complete: false,
      live_catalogue_complete: false,
    },
  };
  if (JSON.stringify(sampleTopicAbsences.map(({ source_id, topic_id }) => ({ source_id, topic_id }))) !== JSON.stringify(SAMPLE_TOPIC_ABSENCES)) {
    throw new Error('sample-only topic absences differ from the registered five-route-local expectation');
  }
  const nonMatchedCount = GAP_COVERAGE_STATUSES.reduce((sum, status) => (
    sum + report.aggregate_summary[`${status}_count`]
  ), 0);
  if (gapItems.length !== nonMatchedCount) throw new Error('aggregate gap count differs from non-matched mapping count');
  return includeWorkPackageReview ? attachWorkPackageReview(report) : report;
}

async function validatedRepository({ rootDir, repository }) {
  const loaded = repository ?? await loadTeacherWorkPlanCurriculumMapRepository({ rootDir });
  const validation = validateTeacherWorkPlanCurriculumMapRepository(loaded);
  if (validation.diagnostics.length > 0) {
    throw new Error([
      'teacher work-plan crosswalk validation failed before gap report generation',
      ...validation.diagnostics.map(formatTeacherWorkPlanCurriculumMapDiagnostic),
    ].join('\n'));
  }
  return loaded;
}

export async function buildTeacherWorkPlanGapReport({
  rootDir = process.cwd(),
  repository = null,
  workPackageArtifactText = null,
  reusableArtifactOverrides = new Map(),
  reusableMaterialOverrides = new Map(),
} = {}) {
  const loaded = await validatedRepository({ rootDir, repository });
  const baseReport = buildReportFromValidatedRepository(loaded, { includeWorkPackageReview: false });
  const workPackages = await loadTeacherWorkPlanWorkPackages({
    rootDir,
    gapReport: baseReport,
    artifactText: workPackageArtifactText,
    includeMarkdown: false,
  });
  const workPackageValidation = validateTeacherWorkPlanWorkPackages(workPackages.artifact, {
    schema: workPackages.schema,
    gapReport: baseReport,
  });
  if (workPackageValidation.diagnostics.length > 0) {
    throw new Error([
      'teacher work-plan semantic review failed before gap report generation',
      ...workPackageValidation.diagnostics.map(formatTeacherWorkPlanWorkPackageDiagnostic),
    ].join('\n'));
  }
  const reviewedReport = attachWorkPackageReview(baseReport);
  const reusableRepository = await loadTeacherWorkPlanReusableArtifactRepository({
    rootDir,
    gapReport: reviewedReport,
    workPackages: workPackages.artifact,
    artifactOverrides: reusableArtifactOverrides,
    materialOverrides: reusableMaterialOverrides,
  });
  const reusableValidation = validateTeacherWorkPlanReusableArtifactRepository(reusableRepository);
  if (reusableValidation.diagnostics.length > 0) {
    throw new Error([
      'teacher work-plan reusable artifact validation failed before gap report generation',
      ...reusableValidation.diagnostics.map(formatTeacherWorkPlanReusableArtifactDiagnostic),
    ].join('\n'));
  }
  const classroomTrialRepository = await loadTeacherWorkPlanArtifactClassroomTrialRepositories({
    rootDir,
    reusableRepository,
    fileOverrides: reusableArtifactOverrides,
  });
  const classroomTrialValidation = validateTeacherWorkPlanArtifactClassroomTrialRepositories(classroomTrialRepository);
  if (classroomTrialValidation.diagnostics.length > 0) {
    throw new Error([
      'teacher work-plan classroom-trial workflow validation failed before gap report generation',
      ...classroomTrialValidation.diagnostics.map(formatTeacherWorkPlanArtifactClassroomTrialDiagnostic),
    ].join('\n'));
  }
  return attachReusableArtifactImplementation(reviewedReport, reusableRepository);
}

export function serializeTeacherWorkPlanGapReport(report) {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function markdownCell(value) {
  return String(value).replace(/\s+/gu, ' ').trim().replaceAll('|', '\\|');
}

function compactCount(counts) {
  return Object.entries(counts).map(([key, value]) => `${key}: ${value}`).join('; ');
}

export function renderTeacherWorkPlanGapReportMarkdown(report) {
  const aggregate = report.aggregate_summary;
  const implementation = report.reusable_artifact_implementation;
  const lines = [
    '# Grades 5-7 teacher work-plan gap report',
    '',
    '## 1. Status and scope',
    '',
    `This generated report indexes source-backed gaps in four supplementary, noncanonical teacher work-plan crosswalks. ${implementation.implemented_package_count} independently authored internal-draft artifacts now support ${implementation.implemented_source_gap_count} gaps, but canonical coverage remains unchanged. The report does not establish official curriculum completeness, annual allocation, default-course eligibility, or live-catalogue completeness.`,
    '',
    '## 2. Source crosswalks',
    '',
    '| Route | Crosswalk | SHA-256 | Source records | Mapping status |',
    '|---|---|---|---:|---|',
    ...report.inputs.map((input) => (
      `| \`${input.source_id}\` | \`${input.crosswalk_path}\` | \`${input.crosswalk_sha256}\` | ${input.total_source_record_count} | \`${input.mapping_status}\` |`
    )),
    '',
    '## 3. Aggregate accounting',
    '',
    '| Measure | Count |',
    '|---|---:|',
    `| Routes | ${aggregate.route_count} |`,
    `| Lesson-range mappings | ${aggregate.lesson_range_mapping_count} |`,
    `| Unnumbered source rows | ${aggregate.unnumbered_source_row_count} |`,
    `| Total source records | ${aggregate.total_source_record_count} |`,
    `| Matched | ${aggregate.matched_count} |`,
    `| Partial | ${aggregate.partial_count} |`,
    `| Missing | ${aggregate.missing_count} |`,
    `| Ambiguous | ${aggregate.ambiguous_count} |`,
    `| Outside route | ${aggregate.outside_route_count} |`,
    `| Gap items | ${aggregate.gap_item_count} |`,
    `| Mappings with Russian evidence | ${aggregate.mappings_with_russian_evidence} |`,
    `| Mappings with Estonian evidence | ${aggregate.mappings_with_estonian_evidence} |`,
    `| Represented route-local topics | ${aggregate.represented_topic_inventory_count}/${aggregate.route_local_topic_inventory_count} |`,
    `| Positive match occurrences | ${aggregate.positive_match_occurrence_count} |`,
    `| Unique positive evidence records | ${aggregate.unique_positive_evidence_record_count} |`,
    '',
    '## 4. Per-route summary',
    '',
    '| Route | Records | Matched | Partial | Missing | Ambiguous | Gaps | RU mappings | ET mappings | Topics |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...report.route_summaries.map((route) => (
      `| \`${route.source_id}\` | ${route.total_source_record_count} | ${route.coverage_counts.matched} | ${route.coverage_counts.partial} | ${route.coverage_counts.missing} | ${route.coverage_counts.ambiguous} | ${route.gap_item_count} | ${route.mappings_with_russian_evidence} | ${route.mappings_with_estonian_evidence} | ${route.represented_topic_inventory_count}/${route.represented_topic_inventory_count + route.not_represented_topic_inventory_count} |`
    )),
    '',
    '## 5. Gap counts by bridge type',
    '',
    '| Bridge type | Count |',
    '|---|---:|',
    ...Object.entries(aggregate.bridge_type_counts).map(([bridgeType, count]) => (
      `| \`${bridgeType}\` | ${count} |`
    )),
    '',
    '## 6. Missing and ambiguous priority index',
    '',
    'These are gaps in the four registered supplementary samples, not claims about official curriculum omissions.',
    '',
    ...report.gap_items.filter((gap) => ['missing', 'ambiguous'].includes(gap.coverage_status)).map((gap) => (
      `- [\`${gap.gap_id}\`](#gap-${gap.gap_id}) — ${markdownCell(gap.source_topic_et)} — \`${gap.coverage_status}\``
    )),
    '',
    '## 7. Sample-only topic absences',
    '',
    '| Route | Topic | Classification |',
    '|---|---|---|',
    ...report.sample_topic_absences.map((absence) => (
      `| \`${absence.source_id}\` | \`${absence.topic_id}\` | \`${absence.classification}\` |`
    )),
    '',
    'These five entries are not gap items and do not state that a topic is missing from the official curriculum.',
    '',
    '## 8. Oral Estonian evidence boundary',
    '',
    '| Route | Registered oral-role records | Positive oral-role matches | Oral-support mappings | Explicit page evidence |',
    '|---|---:|---:|---:|---|',
    ...report.oral_evidence_summary.map((entry) => (
      `| \`${entry.source_id}\` | ${entry.registered_topic_records_with_oral_answer_et_role} | ${entry.positive_match_occurrences_with_oral_answer_et_role} | ${entry.mappings_with_oral_language_support_scope} | ${entry.explicit_oral_page_evidence_available ? 'yes' : 'no'} |`
    )),
    '',
    'Estonian-language content, presentation mentions, `Mõtle!`, practice roles, and bilingual visuals do not by themselves establish explicit oral page evidence. This report does not create oral scripts.',
    '',
    '## 9. Programme and default-course boundary',
    '',
    `Positive match occurrences by programme type: ${compactCount(aggregate.positive_match_counts_by_programme_type)}.`,
    '',
    `Positive match occurrences by language: ${compactCount(aggregate.positive_match_counts_by_language)}.`,
    '',
    'Programme eligibility remains route-specific. Unknown content evidence is not promoted to ordinary-programme or default-course eligibility, and simplified material has no positive occurrence in this report.',
    '',
    '## 10. Priority work-package review',
    '',
    `Semantic review is complete for ${report.work_package_review.priority_gap_count} missing or ambiguous gaps: ${report.work_package_review.work_package_count} work packages, ${report.work_package_review.ready_for_authoring_count} ready for authoring and ${report.work_package_review.blocked_teacher_review_count} blocked by teacher review.`,
    '',
    `Selected first pilot: \`${report.work_package_review.selected_pilot_package_id}\`.`,
    '',
    `Machine-readable review: [\`${report.work_package_review.path}\`](../../${report.work_package_review.path}). Generated audit: [\`docs/audits/grades-5-7-priority-work-packages.md\`](grades-5-7-priority-work-packages.md).`,
    '',
    '### Reusable artifact implementation',
    '',
    `${implementation.implemented_package_count} packages now have internal drafts with ${implementation.delivered_capability_count} material capabilities supporting ${implementation.implemented_source_gap_count} source gaps.`,
    '',
    ...implementation.artifacts.flatMap((artifact) => [
      `- \`${artifact.package_id}\`: [index](../../${artifact.artifact_index_path}); ${artifact.delivered_capability_count} materials, ${artifact.supported_gap_ids.length} supported source gaps, ${artifact.opiq_context_record_count} optional Opiq context records; fingerprint \`${artifact.human_review.content_fingerprint}\`. Teacher review and local safety review are \`pending\`; classroom trial is \`not_tested\`; completed review and trial records are zero.`,
    ]),
    '',
    'Both artifacts remain internal drafts. Their fail-closed human-review and classroom-trial workflows create no teacher approval, safety approval, classroom readiness, publication, customer release or effectiveness evidence.',
    '',
    `Next authoring selection: \`${report.authoring_queue.selected_next_package_id}\` for \`${report.authoring_queue.selected_next_gap_ids.join(', ')}\`, status \`${report.authoring_queue.selected_next_package_status}\`, planned root \`${report.authoring_queue.selected_next_planned_root}\`. No materials, artifact index, human-review workflow or classroom-trial workflow has been created for it, and no source-gap resolution is claimed.`,
    '',
    'This independently authored support does not change the three supported canonical Opiq gaps from `missing`. Teacher review and local safety review remain pending, classroom/publication readiness remains false, and no source-gap resolution is claimed.',
    '',
    '## 11. Complete gap registry grouped by route',
    '',
  ];
  for (const route of report.scope.routes) {
    lines.push(`### \`${route}\``, '');
    for (const gap of report.gap_items.filter((item) => item.source_id === route)) {
      lines.push(
        `- <a id="gap-${gap.gap_id}"></a>\`${gap.gap_id}\` — ${markdownCell(gap.source_topic_et)} — \`${gap.coverage_status}\` — \`${gap.bridge_type}\` — pages ${gap.source_pages.join(', ')}`,
      );
    }
    lines.push('');
  }
  lines.push(
    '## 12. Completeness limitations',
    '',
    '- All 262 registered source records are accounted for, and all 193 non-matched mappings are indexed once.',
    '- Gap-index completeness applies only to the four registered supplementary crosswalks.',
    '- Official curriculum completeness and exact-grade official allocation are not verified.',
    '- No annual architecture, default-course selection, or live-catalogue verification is created here.',
    '- Semantic work-package review is complete; three internal-draft reusable artifacts plus pending review and classroom-trial workflows exist, but no completed review or trial decision exists and the reusable-artifact backlog remains incomplete.',
  );
  return `${lines.join('\n')}\n`;
}

export function validateTeacherWorkPlanGapReport(report, {
  schema = null,
  repository = null,
} = {}) {
  const diagnostics = [];
  if (schema) {
    const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
    const validate = ajv.compile(schema);
    if (!validate(report)) {
      for (const error of validate.errors ?? []) {
        diagnostics.push(diagnostic(error.instancePath || '/', schemaReason(error)));
      }
    }
  }
  const routeLists = [
    ['/scope/routes', report.scope?.routes],
    ['/inputs', report.inputs?.map((entry) => entry.source_id)],
    ['/route_summaries', report.route_summaries?.map((entry) => entry.source_id)],
    ['/oral_evidence_summary', report.oral_evidence_summary?.map((entry) => entry.source_id)],
  ];
  for (const [field, actual] of routeLists) {
    if (JSON.stringify(actual) !== JSON.stringify(ROUTE_ORDER)) {
      diagnostics.push(diagnostic(field, `expected exact route order ${ROUTE_ORDER.join(', ')}`));
    }
  }
  const gapIds = report.gap_items?.map((gap) => gap.gap_id) ?? [];
  if (new Set(gapIds).size !== gapIds.length) diagnostics.push(diagnostic('/gap_items', 'duplicate gap ID'));
  const sourceKeys = report.gap_items?.map((gap) => `${gap.source_id}\0${gap.mapping_id}`) ?? [];
  if (new Set(sourceKeys).size !== sourceKeys.length) diagnostics.push(diagnostic('/gap_items', 'duplicate source mapping key'));
  for (const [index, gap] of (report.gap_items ?? []).entries()) {
    const field = `/gap_items/${index}`;
    if (gap.gap_id !== `${gap.source_id}-${gap.mapping_id}`) diagnostics.push(diagnostic(`${field}/gap_id`, 'gap ID must be source_id plus mapping_id'));
    if (gap.source_record_kind === 'unnumbered_source_row') {
      if (gap.lesson_span !== null) diagnostics.push(diagnostic(`${field}/lesson_span`, 'unnumbered row must have null lesson span'));
      if (gap.placement === null) diagnostics.push(diagnostic(`${field}/placement`, 'unnumbered row requires exact placement'));
    } else {
      if (gap.lesson_span === null) diagnostics.push(diagnostic(`${field}/lesson_span`, 'numbered mapping requires lesson span'));
      if (gap.placement !== null) diagnostics.push(diagnostic(`${field}/placement`, 'numbered mapping must have null placement'));
    }
  }
  const aggregate = report.aggregate_summary ?? {};
  const nonMatched = GAP_COVERAGE_STATUSES.reduce((sum, status) => sum + (aggregate[`${status}_count`] ?? 0), 0);
  if (aggregate.gap_item_count !== nonMatched || aggregate.gap_item_count !== report.gap_items?.length) {
    diagnostics.push(diagnostic('/aggregate_summary/gap_item_count', 'gap count must equal every non-matched mapping exactly once'));
  }
  if (aggregate.mappings_requiring_bridge_or_review !== aggregate.gap_item_count) diagnostics.push(diagnostic('/aggregate_summary/mappings_requiring_bridge_or_review', 'must equal gap item count'));
  const bridgeTotal = BRIDGE_TYPES.reduce((sum, type) => sum + (aggregate.bridge_type_counts?.[type] ?? 0), 0);
  if (bridgeTotal !== aggregate.gap_item_count) diagnostics.push(diagnostic('/aggregate_summary/bridge_type_counts', 'bridge type counts must sum to gap item count'));
  const programmeTotal = PROGRAMME_TYPES.reduce((sum, type) => sum + (aggregate.positive_match_counts_by_programme_type?.[type] ?? 0), 0);
  if (programmeTotal !== aggregate.positive_match_occurrence_count) diagnostics.push(diagnostic('/aggregate_summary/positive_match_counts_by_programme_type', 'programme counts must sum to positive match occurrences'));
  const absenceKeys = (report.sample_topic_absences ?? []).map(({ source_id, topic_id }) => ({ source_id, topic_id }));
  if (JSON.stringify(absenceKeys) !== JSON.stringify(SAMPLE_TOPIC_ABSENCES)) diagnostics.push(diagnostic('/sample_topic_absences', 'expected the exact five sample-only topic absences'));
  if (repository) {
    try {
      const expectedBase = attachWorkPackageReview(buildReportFromValidatedRepository(repository));
      const expected = {
        ...expectedBase,
        reusable_artifact_implementation: structuredClone(report.reusable_artifact_implementation),
        authoring_queue: structuredClone(report.authoring_queue),
        boundaries: {
          ...expectedBase.boundaries,
          reusable_teaching_artifacts_created: true,
        },
      };
      if (serializeTeacherWorkPlanGapReport(report) !== serializeTeacherWorkPlanGapReport(expected)) {
        diagnostics.push(diagnostic('/', 'report differs from validated crosswalk-derived model or deterministic property order'));
      }
    } catch (error) {
      diagnostics.push(diagnostic('/', `cannot derive expected report: ${error.message}`));
    }
  }
  diagnostics.sort((left, right) => compareBytewise(`${left.field}\0${left.reason}`, `${right.field}\0${right.reason}`));
  return {
    diagnostics,
    summary: {
      errors: diagnostics.length,
      routes: report.scope?.routes?.length ?? 0,
      source_records: aggregate.total_source_record_count ?? 0,
      gap_items: report.gap_items?.length ?? 0,
    },
  };
}

export async function loadCommittedTeacherWorkPlanGapReportArtifacts({
  rootDir = process.cwd(),
} = {}) {
  const root = path.resolve(rootDir);
  const [schemaText, jsonText, markdownText, repository] = await Promise.all([
    fs.readFile(safeRepositoryPath(root, GAP_REPORT_SCHEMA_PATH), 'utf8'),
    fs.readFile(safeRepositoryPath(root, GAP_REPORT_JSON_PATH), 'utf8'),
    fs.readFile(safeRepositoryPath(root, GAP_REPORT_MARKDOWN_PATH), 'utf8'),
    loadTeacherWorkPlanCurriculumMapRepository({ rootDir: root }),
  ]);
  return {
    rootDir: root,
    schema: JSON.parse(schemaText),
    report: JSON.parse(jsonText),
    jsonText,
    markdownText,
    repository,
  };
}

export function formatTeacherWorkPlanGapReportDiagnostic(entry) {
  return `[ERROR] ${entry.file} ${entry.field}: ${entry.reason}`;
}

export const teacherWorkPlanGapReportContracts = Object.freeze({
  routeOrder: ROUTE_ORDER,
  coverageStatuses: COVERAGE_STATUSES,
  gapCoverageStatuses: GAP_COVERAGE_STATUSES,
  bridgeTypes: BRIDGE_TYPES,
  programmeTypes: PROGRAMME_TYPES,
  evidenceLanguages: EVIDENCE_LANGUAGES,
  sampleTopicAbsences: SAMPLE_TOPIC_ABSENCES,
});
