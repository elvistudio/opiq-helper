import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  grade4RoutePolicy,
  multiGradeSupportPolicy,
} from './grade-4-canonical-sources.mjs';
import {
  archiveExpectations,
  bytewise,
  sha256,
  stableJson,
} from './grade-4-source-intake.mjs';

export const catalogueGapVersion = '1.0';
export const catalogueGapBaseCommit = '3b0ffc5d6ad7ff1d96be2e44e35fa45ffbc22b41';
export const catalogueGapVerificationDate = '2026-07-27';
export const catalogueSnapshotPath = 'external-sources/opiq/grade-4-live-catalogue-2026-07-27.json';
export const catalogueGapReportPath = 'evaluations/grade-4-source-gap-report.json';
export const catalogueGapAuditPath = 'docs/audits/grade-4-live-catalogue-gap-review.md';
export const catalogueSnapshotSchemaPath = 'schemas/grade-4-live-catalogue-snapshot.schema.json';
export const catalogueGapSchemaPath = 'schemas/grade-4-source-gap-report.schema.json';

const historicalHashes = Object.freeze({
  'docs/audits/grade-4-canonical-source-import.md': 'ad53966529a6b5a4927cc7e74bf1024488790659e61676376706f0cd895b21ea',
  'docs/audits/grade-4-source-intake.md': 'cbde4d4d7ebc8372b2b66a41ab7415752425738ce0891e2f0bb7df4cf8c0ab88',
  'evaluations/grade-4-kit-details-evidence.json': '3e82ea03d02f7a858165344884006cd041d6a4028ac1ab56f427480cf5bde0c1',
  'evaluations/grade-4-source-intake.json': '29972ee2df6ceaa08d76af71e345167a923db79c3c4379333ec8036843505b54',
  'source-manifest.json': '036e178a800f9462e90abfc6dfea7943b5392a11d896f0ea240d438d9bab3197',
});

const exactTeacherIds = new Set(['378', '487', '492', '493', '506', '566']);
const knownSharedIds = new Set(multiGradeSupportPolicy.map((entry) => entry.kit_id));
const supplementaryDiscoveryIds = new Set(['231', '348', '349', '350', '465']);
const simplifiedIds = new Set(['282', '287', '304', '318', '328']);
const mixedSubjectIds = new Set(['55', '82']);
const editionIds = new Set(['11', '27', '174', '480', '533', '536', '552', '588']);
const canonicalRouteByKit = new Map(
  grade4RoutePolicy.flatMap((route) => route.included_kit_ids.map((kitId) => [kitId, route])),
);

function classificationPolicy(snapshot) {
  return {
    teacherIds: new Set(
      snapshot.records
        .filter((record) => record.material_type === 'Õpetajaraamat')
        .map((record) => record.kit_id),
    ),
  };
}

function classifyKit(kitId, policy) {
  if (canonicalRouteByKit.has(kitId)) return 'canonical_student_source';
  if (policy.teacherIds.has(kitId)) return 'teacher_only';
  if (kitId === '161' || kitId === '476') return 'multi_grade_support';
  if (kitId === '200' || supplementaryDiscoveryIds.has(kitId)) return 'supplementary_shared';
  throw new Error(`Unclassified live kit ${kitId}`);
}

function secondaryRoles(kitId, policy) {
  const roles = [];
  if (simplifiedIds.has(kitId)) roles.push('simplified_curriculum');
  if (mixedSubjectIds.has(kitId)) roles.push('mixed_subject');
  if (editionIds.has(kitId) || exactTeacherIds.has(kitId)) roles.push('edition_or_replacement');
  if (policy.teacherIds.has(kitId)) roles.push('teacher_support');
  if (policy.teacherIds.has(kitId) && !exactTeacherIds.has(kitId)) roles.push('multi_grade_support');
  if (supplementaryDiscoveryIds.has(kitId) || kitId === '200') roles.push('supplementary_shared');
  return roles.sort(bytewise);
}

function roleFor(kitId, policy) {
  if (exactTeacherIds.has(kitId)) return 'exact_grade_4_teacher_or_e_tund';
  if (policy.teacherIds.has(kitId)) return 'grades_1_to_6_entrepreneurship_teacher_support';
  if (kitId === '161') return 'school_stage_ii_physical_education_support';
  if (kitId === '200') return 'shared_supplementary_arts_and_crafts';
  if (kitId === '476') return 'multi_grade_technology_instructional_support';
  if (supplementaryDiscoveryIds.has(kitId)) return 'multi_grade_supplementary_or_shared';
  if (simplifiedIds.has(kitId)) return 'simplified_curriculum_student_source';
  if (mixedSubjectIds.has(kitId)) return 'mixed_subject_student_source';
  return 'canonical_grade_4_student_source';
}

function ownershipFor(kitId, policy) {
  if (canonicalRouteByKit.has(kitId)) return 'retain_existing_grade_4_owner';
  if (kitId === '200') return 'retain_existing_non_grade_4_owner';
  if (policy.teacherIds.has(kitId)) return 'teacher_support_no_student_owner';
  return 'multi_grade_no_exclusive_owner';
}

function recaptureFor(kitId, policy) {
  if (exactTeacherIds.has(kitId)) return 'teacher_material_capture_internal_only';
  if (policy.teacherIds.has(kitId) || supplementaryDiscoveryIds.has(kitId)) return 'metadata_only';
  return 'none';
}

function nextActionFor(kitId, policy) {
  if (canonicalRouteByKit.has(kitId)) {
    return 'Retain the current route; any later task-body recapture is lesson-authoring evidence, not catalogue accounting.';
  }
  if (kitId === '200') return 'Retain grade-2-arts-and-crafts ownership and Grade 4 shared-support accounting.';
  if (kitId === '161' || kitId === '476') return 'Keep non-exclusive support accounting without a new Grade 4 route.';
  if (exactTeacherIds.has(kitId)) return 'Keep teacher-only; capture internally only if an authorised teacher workflow requires it.';
  if (policy.teacherIds.has(kitId)) return 'Keep teacher-only and multi-grade; catalogue metadata is sufficient for this audit.';
  return 'Keep as non-exclusive supplementary metadata; assess selected chapters only in a separate instructional need.';
}

export async function loadCatalogueSnapshot(rootDir) {
  return JSON.parse(await readFile(path.join(rootDir, catalogueSnapshotPath), 'utf8'));
}

export function catalogueFilterIdentity(snapshot) {
  return sha256(stableJson({
    catalogue_url: snapshot.catalogue_interface.url,
    filters: snapshot.catalogue_interface.selected_filters,
    displayed_result_count: snapshot.catalogue_interface.displayed_result_count,
    result_kit_ids: snapshot.records.map((record) => record.kit_id),
  }));
}

function metadataIdentityRecord(record) {
  return {
    kit_id: record.kit_id,
    kit_details_url: record.kit_details_url,
    verified_on: record.verified_on,
    capture_method: record.capture_method,
    evidence_status: record.evidence_status,
    title: record.title,
    material_type: record.material_type,
    subject: record.subject,
    grade_scope: record.grade_scope,
    languages: record.languages,
    publisher: record.publisher,
    authors: record.authors,
    edition_or_year: record.edition_or_year,
    programme_or_support_role: record.programme_or_support_role,
    curriculum_labels: record.curriculum_labels,
    package_or_access: record.package_or_access,
    chapter_count: record.chapter_count,
    task_count: record.task_count,
    textbook_task_count: record.textbook_task_count,
    task_collection_task_count: record.task_collection_task_count,
    catalogue_filters: record.catalogue_filters,
    source_evidence_refs: record.source_evidence_refs,
    evidence_limitations: record.evidence_limitations,
    primary_classification: record.primary_classification,
    secondary_roles: record.secondary_roles,
  };
}

export function catalogueMetadataIdentity(snapshot) {
  return sha256(stableJson(snapshot.records.map(metadataIdentityRecord)));
}

function effectiveGradeScope(record) {
  return record.grade_scope.normalized ?? record.grade_scope.observed;
}

function materialTypeBreakdown(snapshot) {
  return {
    learning_kits: snapshot.records.filter((record) => record.material_type === 'Õppekomplekt').length,
    teacher_books: snapshot.records.filter((record) => record.material_type === 'Õpetajaraamat').length,
  };
}

async function manifestOwnership(rootDir, liveKitIds) {
  const manifest = JSON.parse(await readFile(path.join(rootDir, 'source-manifest.json'), 'utf8'));
  const owners = Object.fromEntries(liveKitIds.map((kitId) => [kitId, []]));
  for (const source of manifest.sources) {
    const markdown = await readFile(path.join(rootDir, source.md_path), 'utf8');
    for (const kitId of liveKitIds) {
      if (new RegExp(`https://www[.]opiq[.]ee/kit/${kitId}/`, 'iu').test(markdown)) {
        owners[kitId].push(source.id);
      }
    }
  }
  for (const values of Object.values(owners)) values.sort(bytewise);
  return { manifest, owners };
}

function comparisonRow(record, manifestOwners, policy) {
  const kitId = record.kit_id;
  const route = canonicalRouteByKit.get(kitId);
  const captured = route || knownSharedIds.has(kitId);
  const owner = route?.id ?? (kitId === '200' ? 'grade-2-arts-and-crafts' : null);
  const primary = classifyKit(kitId, policy);
  return {
    kit_id: kitId,
    title: record.title,
    primary_classification: primary,
    secondary_roles: record.secondary_roles,
    repository_capture_status: route
      ? 'captured_canonical'
      : knownSharedIds.has(kitId)
        ? 'captured_noncanonical_support'
        : 'not_captured',
    canonical_owner: owner,
    canonical_route_id: route?.id ?? null,
    manifest_route_ids: manifestOwners,
    live_catalogue_status: 'listed_in_declared_grade_4_filter',
    capture_completeness: captured ? 'chapter_index_captured' : 'metadata_only_live',
    metadata_completeness: 'direct_kit_details_required_fields_captured',
    instructional_page_completeness: captured ? 'chapter_index_only' : 'not_captured',
    task_body_completeness: route ? 'partial' : knownSharedIds.has(kitId) ? 'not_assessed' : 'not_captured',
    ownership_decision: ownershipFor(kitId, policy),
    recapture_decision: recaptureFor(kitId, policy),
    next_action: nextActionFor(kitId, policy),
  };
}

function assertSnapshotPolicy(snapshot, policy) {
  for (const record of snapshot.records) {
    const expectedPrimary = classifyKit(record.kit_id, policy);
    const expectedSecondary = secondaryRoles(record.kit_id, policy);
    const expectedRole = roleFor(record.kit_id, policy);
    if (record.primary_classification !== expectedPrimary) {
      throw new Error(`Snapshot classification disagrees with route policy for kit ${record.kit_id}`);
    }
    if (stableJson(record.secondary_roles) !== stableJson(expectedSecondary)) {
      throw new Error(`Snapshot secondary roles disagree with route policy for kit ${record.kit_id}`);
    }
    if (record.programme_or_support_role !== expectedRole) {
      throw new Error(`Snapshot support role disagrees with route policy for kit ${record.kit_id}`);
    }
  }
}

export function buildCrossEvidenceReview(snapshot, historicalEvidence) {
  const policy = classificationPolicy(snapshot);
  const liveByKit = new Map(snapshot.records.map((record) => [record.kit_id, record]));
  return historicalEvidence.records
    .map((historicalRecord) => {
      const liveRecord = liveByKit.get(historicalRecord.kit_id);
      if (!liveRecord) throw new Error(`Historical evidence kit is absent from live snapshot: ${historicalRecord.kit_id}`);
      const liveObserved = liveRecord.grade_scope.observed;
      const normalized = effectiveGradeScope(liveRecord);
      const consistent = stableJson(historicalRecord.grade_scope) === stableJson(liveObserved);
      const resolved = !consistent
        && liveRecord.grade_scope.normalization?.status === 'human_reviewed'
        && stableJson(historicalRecord.grade_scope) === stableJson(normalized);
      return {
        kit_id: liveRecord.kit_id,
        historical_grade_scope: historicalRecord.grade_scope,
        live_observed_grade_scope: liveObserved,
        normalized_grade_scope: normalized,
        comparison_status: consistent
          ? 'consistent'
          : resolved
            ? 'resolved_by_human_review'
            : 'unresolved_discrepancy',
        routing_effect: ownershipFor(liveRecord.kit_id, policy),
        rationale: consistent
          ? 'Historical and current live grade scopes agree.'
          : liveRecord.grade_scope.normalization?.rationale
            ?? 'Historical and current live grade scopes differ without a recorded normalization.',
        supporting_evidence: consistent
          ? ['historical_post_audit_kit_details', 'direct-kit-details-all-55']
          : liveRecord.grade_scope.normalization?.supporting_evidence ?? [],
      };
    })
    .sort((left, right) => Number(left.kit_id) - Number(right.kit_id));
}

function summarize(reportRows) {
  const count = (predicate) => reportRows.filter(predicate).length;
  return {
    total_live_kits: reportRows.length,
    canonical_student_kits: count((row) => row.repository_capture_status === 'captured_canonical'),
    known_nonexclusive_captured_kits: count((row) => row.repository_capture_status === 'captured_noncanonical_support'),
    newly_accounted_live_kits: count((row) => row.repository_capture_status === 'not_captured'),
    teacher_only_kits: count((row) => row.primary_classification === 'teacher_only'),
    supplementary_or_multi_grade_kits: count((row) => ['multi_grade_support', 'supplementary_shared'].includes(row.primary_classification)),
    new_exact_grade_4_student_candidates: count((row) => (
      ['candidate_new_grade_4_route', 'candidate_add_to_existing_grade_4_route'].includes(row.ownership_decision)
    )),
  };
}

function editionRelationships() {
  return [
    { relationship_id: 'estonian-student-editions', kit_ids: ['71', '533'], disposition: 'preserve_separate_editions' },
    { relationship_id: 'estonian-teacher-editions', kit_ids: ['493', '566'], disposition: 'preserve_separate_teacher_editions' },
    { relationship_id: 'science-avita-estonian-editions', kit_ids: ['11', '480'], disposition: 'preserve_separate_editions' },
    { relationship_id: 'science-avita-russian-editions', kit_ids: ['27', '536'], disposition: 'preserve_separate_editions' },
    { relationship_id: 'science-teacher-editions', kit_ids: ['487', '492'], disposition: 'preserve_separate_teacher_editions' },
    { relationship_id: 'mathematics-avita-editions', kit_ids: ['70', '460'], disposition: 'preserve_separate_editions' },
    { relationship_id: 'mathematics-koolibri-editions', kit_ids: ['147', '588'], disposition: 'preserve_separate_editions' },
    { relationship_id: 'mathematics-teacher-editions', kit_ids: ['378', '506'], disposition: 'preserve_separate_teacher_editions' },
    { relationship_id: 'music-avita-editions', kit_ids: ['174', '552'], disposition: 'preserve_separate_editions' },
  ];
}

async function verifyHistoricalBoundaries(rootDir) {
  const results = [];
  for (const [artifactPath, expectedHash] of Object.entries(historicalHashes).sort(([left], [right]) => bytewise(left, right))) {
    const actualHash = sha256(await readFile(path.join(rootDir, artifactPath)));
    if (actualHash !== expectedHash) throw new Error(`Historical boundary changed: ${artifactPath}`);
    results.push({ artifact_path: artifactPath, sha256: actualHash, unchanged: true });
  }
  for (const archive of archiveExpectations) {
    const absolute = path.join(rootDir, archive.path);
    const stats = await lstat(absolute);
    if (!stats.isFile() || stats.isSymbolicLink()) throw new Error(`Immutable archive is not a regular file: ${archive.path}`);
    const bytes = await readFile(absolute);
    if (bytes.length !== archive.byte_size || sha256(bytes) !== archive.sha256) {
      throw new Error(`Immutable archive changed: ${archive.path}`);
    }
  }
  return results;
}

function markdownReport(report) {
  const summary = report.summary;
  const newRows = report.captured_vs_live.filter((row) => row.repository_capture_status === 'not_captured');
  const teacherRows = report.captured_vs_live.filter((row) => row.primary_classification === 'teacher_only');
  const supportRows = report.captured_vs_live.filter((row) => ['multi_grade_support', 'supplementary_shared'].includes(row.primary_classification));
  const lines = [
    '# Grade 4 live-catalogue and source-gap review',
    '',
    `Verified: ${report.verification_date}`,
    '',
    '## Executive summary',
    '',
    `The exact public Grade 4 Varamu filter returned **${summary.total_live_kits}** results on one page: **39 learning kits** and **16 teacher books**. The snapshot is \`${report.completeness_status}\` for that exact filter because the URL, every selected filter, result count, sort order, pagination state, all result IDs, verification date, capture method, filter identity, and complete metadata identity are recorded.`,
    '',
    `The inventory reconciles to **${summary.canonical_student_kits} canonical student kits**, **${summary.known_nonexclusive_captured_kits} known captured shared/support kits**, and **${summary.newly_accounted_live_kits} additional live kits**. The additional set contains 16 teacher-only books and five multi-grade/supplementary kits. There are **${summary.new_exact_grade_4_student_candidates} new exact Grade 4 student-source candidates**.`,
    '',
    'This is a catalogue-accounting result, not an official-curriculum completeness, content completeness, access-rights, or pedagogical-effectiveness claim.',
    '',
    '## Evidence methodology',
    '',
    `- Public filter: ${report.capture_methodology.catalogue_url}`,
    '- Filters: blank search; all curricula/programmes, material types, subjects, publishers, packages and languages; Grade 4; LanguageFirst sort.',
    '- The result list had one observed page and no pagination controls.',
    '- Every result was checked against its public Kit Details page for title, type, subject, grades, languages, publisher, byline, curriculum labels, access/package and counts.',
    '- Repository comparison covered all eleven current Grade 4 routes, the three captured shared/support kits, all ten immutable ZIPs, all manifest routes, and the post-intake Kit Details evidence.',
    '- The dated JSON snapshot is the authoritative evidence input. The generator reads it and writes only this derived report and audit.',
    '',
    '## Evidence identities and Grade 4 normalization',
    '',
    `The filter identity is \`${report.capture_methodology.stable_source_identity.filter_identity.value}\`; it covers the filter, displayed count, and ordered kit IDs. The metadata identity is \`${report.capture_methodology.stable_source_identity.metadata_identity.value}\`; it covers every normalized metadata field, classification, and normalization decision.`,
    '',
    'Kit 55 preserves the live observation `[4, 5]` and separately records the human-reviewed routing normalization `[4]`. The historical post-audit evidence and Russian parallel kit 82 both support retaining `grade-4-human-studies-and-society` ownership. The live Grade 5 value is treated as a probable catalogue metadata typo, not erased or represented as if it had never been observed.',
    '',
    'The machine report contains `cross_evidence_review` for every kit present in the immutable historical Kit Details evidence. Kit 55 is `resolved_by_human_review`; the other compared records are `consistent`.',
    '',
    '## Current canonical coverage',
    '',
    `All ${summary.canonical_student_kits} live canonical kits reconcile with the eleven current Grade 4 route allocations. No canonical route or manifest entry is changed by this review. \`eesti keel\` and \`eesti keel teise keelena\` remain separate routes; simplified and mixed-subject roles remain explicit secondary classifications.`,
    '',
    '## Newly discovered live kits',
    '',
    `Nine entries were supplied only as preliminary discovery seeds; the complete filter found twelve additional entries (${report.discovery_breakdown.additional_kit_ids_found_by_complete_filter.join(', ')}). The table below lists all 21 live kits absent from the immutable Grade 4 capture baseline.`,
    '',
    '| Kit | Type | Decision | Recapture |',
    '| --- | --- | --- | --- |',
    ...newRows.map((row) => `| ${row.kit_id} — ${row.title} | ${row.primary_classification} | ${row.ownership_decision} | ${row.recapture_decision} |`),
    '',
    '## Teacher-only and support materials',
    '',
    `The teacher-only inventory contains ${teacherRows.length} kits. Exact Grade 4 e-tund resources remain outside student routes and are eligible only for an authorised internal teacher-material workflow. The grades 1–6 entrepreneurship manuals remain multi-grade teacher support.`,
    '',
    `The shared/support inventory contains ${supportRows.length} kits. Kits 161 and 476 remain non-exclusive; kit 200 retains \`grade-2-arts-and-crafts\` ownership. The five newly found shared resources receive metadata-only accounting and no exclusive Grade 4 owner.`,
    '',
    '## Student-source gaps',
    '',
    'No additional exact Grade 4 student-facing kit was found outside the current canonical routes. This does not prove official-curriculum completeness. Curriculum mapping remains separate and depends on issue #37.',
    '',
    '## Edition and replacement relationships',
    '',
    'Older and newer student and teacher editions are preserved as distinct records. No edition is collapsed or declared obsolete without direct evidence.',
    '',
    '## Bounded recapture plan',
    '',
    '- Catalogue accounting is complete from metadata; task-body capture is not required for this purpose.',
    '- Exact-grade e-tund content, if needed later, must remain teacher-only and be captured only through an authorised internal workflow.',
    '- Multi-grade teacher manuals and supplementary resources require no full-kit recapture. A selected chapter or task may be captured only for a separately scoped instructional need.',
    '- Existing canonical task-body limitations remain a downstream lesson-authoring concern and do not invalidate catalogue ownership.',
    '',
    '## Blockers and next work',
    '',
    ...report.blockers.map((blocker) => `- \`${blocker.code}\`: ${blocker.message}`),
    '',
    'A separate PR is unnecessary for new exact-grade student imports because none were found. Optional future work may evaluate selected supplementary resources or authorised teacher support without changing student ownership.',
    '',
    '## Issue #41 closure status',
    '',
    'The catalogue-capture portion is ready to close after this PR is reviewed and merged: the declared-filter snapshot is defensibly complete, every discovered kit is classified, student gaps have decisions, teacher/support materials are separated, recapture is bounded, and current ownership remains valid. Issue #41 must not be closed automatically. Official curriculum completeness remains separate under #37.',
    '',
    '## Non-guarantees',
    '',
    ...report.non_guarantees.map((item) => `- ${item}`),
    '',
  ];
  return lines.join('\n');
}

export async function buildGrade4CatalogueGapArtifacts(rootDir) {
  const snapshot = await loadCatalogueSnapshot(rootDir);
  const snapshotDiagnostics = validateCatalogueSnapshotSemantics(snapshot);
  if (snapshotDiagnostics.length > 0) {
    throw new Error(`Grade 4 live-catalogue snapshot is semantically invalid: ${snapshotDiagnostics.join(', ')}`);
  }
  const policy = classificationPolicy(snapshot);
  assertSnapshotPolicy(snapshot, policy);
  const historicalArtifactHashes = await verifyHistoricalBoundaries(rootDir);
  const historicalEvidence = JSON.parse(await readFile(
    path.join(rootDir, 'evaluations/grade-4-kit-details-evidence.json'),
    'utf8',
  ));
  const crossEvidenceReview = buildCrossEvidenceReview(snapshot, historicalEvidence);
  const unresolvedCrossEvidence = crossEvidenceReview.filter(
    (entry) => entry.comparison_status === 'unresolved_discrepancy',
  );
  if (unresolvedCrossEvidence.length > 0) {
    throw new Error(
      `Unresolved cross-evidence grade scope discrepancy: ${unresolvedCrossEvidence.map((entry) => entry.kit_id).join(', ')}`,
    );
  }
  const { manifest, owners } = await manifestOwnership(rootDir, snapshot.records.map((record) => record.kit_id));
  const currentGrade4Routes = manifest.sources.filter((source) => source.grade === 4);
  const expectedRouteIds = grade4RoutePolicy.map((route) => route.id).sort(bytewise);
  const actualRouteIds = currentGrade4Routes.map((route) => route.id).sort(bytewise);
  if (stableJson(expectedRouteIds) !== stableJson(actualRouteIds)) {
    throw new Error('Current Grade 4 manifest routes do not match the canonical route policy');
  }
  const capturedVsLive = snapshot.records
    .map((record) => comparisonRow(record, owners[record.kit_id], policy))
    .sort((left, right) => Number(left.kit_id) - Number(right.kit_id));
  const summary = summarize(capturedVsLive);
  const report = {
    schema_version: catalogueGapVersion,
    artifact_type: 'grade-4-source-gap-report',
    report_id: 'grade-4-source-gap-review-2026-07-27',
    issue_ref: '#41',
    base_commit: catalogueGapBaseCommit,
    verification_date: catalogueGapVerificationDate,
    completeness_status: snapshot.completeness_status,
    snapshot_path: catalogueSnapshotPath,
    capture_methodology: {
      catalogue_url: snapshot.catalogue_interface.url,
      selected_filters: snapshot.catalogue_interface.selected_filters,
      displayed_result_count: snapshot.catalogue_interface.displayed_result_count,
      pages_observed: snapshot.catalogue_interface.pagination.pages_observed,
      all_result_pages_captured: snapshot.catalogue_interface.pagination.all_result_pages_captured,
      stable_source_identity: snapshot.catalogue_interface.stable_source_identity,
      direct_kit_details_reviewed: snapshot.records.length,
    },
    canonical_baseline: {
      route_count: 11,
      exclusively_allocated_kit_count: 31,
      canonical_instructional_record_count: 2212,
      supplied_zip_instructional_record_count: 2342,
      nonexclusive_instructional_record_count: 130,
      known_multi_grade_kit_ids: ['161', '200', '476'],
      manifest_coverage_status: 'partial_subject_bounded',
    },
    summary,
    discovery_breakdown: {
      preliminary_seed_kit_ids: ['359', '373', '377', '378', '471', '487', '492', '493', '566'],
      additional_kit_ids_found_by_complete_filter: ['231', '324', '348', '349', '350', '411', '416', '444', '445', '465', '474', '506'],
    },
    cross_evidence_review: crossEvidenceReview,
    live_kit_inventory: snapshot.records.map((record) => ({
      kit_id: record.kit_id,
      title: record.title,
      material_type: record.material_type,
      primary_classification: record.primary_classification,
      secondary_roles: record.secondary_roles,
    })),
    captured_vs_live: capturedVsLive,
    newly_discovered_kits: capturedVsLive
      .filter((row) => row.repository_capture_status === 'not_captured')
      .map((row) => row.kit_id),
    teacher_support_inventory: capturedVsLive
      .filter((row) => row.primary_classification === 'teacher_only')
      .map((row) => row.kit_id),
    student_source_gaps: [],
    multi_grade_shared_inventory: capturedVsLive
      .filter((row) => ['multi_grade_support', 'supplementary_shared'].includes(row.primary_classification))
      .map((row) => row.kit_id),
    edition_relationships: editionRelationships(),
    ownership_decisions: capturedVsLive.map((row) => ({
      kit_id: row.kit_id,
      decision: row.ownership_decision,
    })),
    recapture_decisions: capturedVsLive.map((row) => ({
      kit_id: row.kit_id,
      decision: row.recapture_decision,
      purpose: row.next_action,
    })),
    historical_artifact_hashes: historicalArtifactHashes,
    immutable_archive_verification: {
      archive_count: archiveExpectations.length,
      all_hashes_and_sizes_current: true,
    },
    blockers: [
      {
        code: 'official_curriculum_completeness_out_of_scope',
        message: 'Catalogue completeness does not establish official curriculum completeness; that remains dependent on #37.',
      },
      {
        code: 'canonical_task_bodies_partially_captured',
        message: 'Some canonical task bodies remain incomplete for lesson authoring, but no task-body recapture is required for catalogue accounting.',
      },
    ],
    issue_41_closure_recommendation: 'ready_after_review_and_merge_for_catalogue_capture_scope',
    non_guarantees: [
      'No claim of complete official curriculum coverage is made.',
      'No claim is made about authenticated, unpublished, withdrawn, hidden, or future Opiq catalogue entries.',
      'No complete chapter prose, task body, answer key, illustration, or interactive content was captured.',
      'Teacher materials were classified but not approved for student-facing use.',
      'No pedagogical effectiveness, legal access entitlement, or production readiness is claimed.',
    ],
  };
  return {
    snapshot,
    report,
    reportJson: stableJson(report),
    markdown: markdownReport(report),
  };
}

export function validateCatalogueSnapshotSemantics(snapshot) {
  const diagnostics = [];
  const complete = snapshot.completeness_status === 'complete_for_declared_filter';
  const requiredCompleteEvidence = [
    snapshot.catalogue_interface?.url,
    snapshot.catalogue_interface?.selected_filters?.grade,
    snapshot.catalogue_interface?.selected_filters?.subject,
    snapshot.catalogue_interface?.selected_filters?.language,
    snapshot.catalogue_interface?.selected_filters?.material_type,
    snapshot.catalogue_interface?.selected_filters?.curriculum_or_programme,
    snapshot.catalogue_interface?.selected_filters?.sort_order,
    snapshot.catalogue_interface?.pagination?.all_result_pages_captured,
    snapshot.catalogue_interface?.displayed_result_count,
    snapshot.catalogue_interface?.stable_source_identity?.filter_identity?.value,
    snapshot.catalogue_interface?.stable_source_identity?.metadata_identity?.value,
  ];
  if (complete && requiredCompleteEvidence.some((value) => value === null || value === undefined || value === false || value === '')) {
    diagnostics.push('complete_status_without_required_filter_evidence');
  }
  if (complete && snapshot.records.some((record) => record.evidence_status === 'search_discovery_only')) {
    diagnostics.push('search_discovery_cannot_prove_completeness');
  }
  if (new Set(snapshot.records.map((record) => record.kit_id)).size !== snapshot.records.length) {
    diagnostics.push('duplicate_live_kit_id');
  }
  if (snapshot.catalogue_interface?.displayed_result_count !== snapshot.records.length) {
    diagnostics.push('displayed_result_count_mismatch');
  }
  if (stableJson(snapshot.catalogue_interface?.material_type_breakdown) !== stableJson(materialTypeBreakdown(snapshot))) {
    diagnostics.push('material_type_breakdown_mismatch');
  }
  if (
    snapshot.catalogue_interface?.stable_source_identity?.filter_identity?.value
    !== catalogueFilterIdentity(snapshot)
  ) {
    diagnostics.push('filter_identity_mismatch');
  }
  if (
    snapshot.catalogue_interface?.stable_source_identity?.metadata_identity?.value
    !== catalogueMetadataIdentity(snapshot)
  ) {
    diagnostics.push('metadata_identity_mismatch');
  }
  const evidenceRefs = new Set(snapshot.evidence_sources.map((source) => source.evidence_ref));
  const kitIds = new Set(snapshot.records.map((record) => record.kit_id));
  for (const record of snapshot.records) {
    if (record.kit_details_url !== `https://www.opiq.ee/Kit/Details/${record.kit_id}`) {
      diagnostics.push(`kit_details_url_mismatch:${record.kit_id}`);
    }
    if (stableJson(record.catalogue_filters) !== stableJson(snapshot.catalogue_interface.selected_filters)) {
      diagnostics.push(`record_filter_mismatch:${record.kit_id}`);
    }
    if (record.source_evidence_refs.some((reference) => !evidenceRefs.has(reference))) {
      diagnostics.push(`unknown_record_evidence_ref:${record.kit_id}`);
    }
    const normalization = record.grade_scope.normalization;
    const normalized = record.grade_scope.normalized;
    if ((normalization && !normalized) || (normalized && !normalization)) {
      diagnostics.push(`incomplete_grade_scope_normalization:${record.kit_id}`);
    }
    if (
      normalized
      && normalized.some((grade) => !record.grade_scope.observed.includes(grade))
      && (!normalization?.rationale || !normalization.supporting_evidence?.length)
    ) {
      diagnostics.push(`unjustified_grade_scope_correction:${record.kit_id}`);
    }
    if (normalization?.supporting_evidence?.some((reference) => !evidenceRefs.has(reference))) {
      diagnostics.push(`unknown_normalization_evidence_ref:${record.kit_id}`);
    }
    if (normalization?.supporting_kit_ids?.some((kitId) => !kitIds.has(kitId))) {
      diagnostics.push(`unknown_normalization_supporting_kit:${record.kit_id}`);
    }
  }
  return diagnostics.sort(bytewise);
}

export function assertCommittedBytes(expected, actual, artifactPath) {
  const actualText = Buffer.isBuffer(actual) ? actual.toString('utf8') : String(actual);
  if (expected !== actualText) throw new Error(`Stale generated artifact: ${artifactPath}`);
}

export function evidenceContentGuard(value) {
  const text = JSON.stringify(value);
  const forbidden = [
    /answer[_ -]?key/iu,
    /full[_ -]?chapter/iu,
    /student[_ -]?(?:name|id)/iu,
    /authenticated[_ -]?session/iu,
  ];
  return forbidden.some((pattern) => pattern.test(text));
}

export function semanticHash(value) {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}
