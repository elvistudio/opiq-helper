import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import Ajv2020 from 'ajv/dist/2020.js';
import YAML from 'yaml';

import {
  bytewise,
  grade4RoutePolicy,
  loadGrade4CanonicalSourceModel,
  validateGrade4Manifest,
} from './grade-4-canonical-sources.mjs';

export const architectureVersion = '1.0';
export const architectureVerificationDate = '2026-07-28';
export const programmeDirectory = 'grade-programmes/grade-4';
export const architectureSchemaPath = 'schemas/grade-programme.schema.json';
export const routeSchemaPath = 'schemas/grade-programme-route.schema.json';
export const coverageSchemaPath = 'schemas/grade-programme-coverage.schema.json';
export const topicAlignmentSchemaPath = 'schemas/grade-programme-topic-alignment.schema.json';
export const topicAlignmentPolicyPath = 'grade-programmes/grade-4/topic-alignment-policy.yaml';
export const architectureDocPath = 'docs/grade-4-course-architecture.md';
export const programmeTemplatePath = 'docs/templates/grade-programme.md';
export const programmeId = 'grade-4-standalone-commercial-programme-2026-27';

const outcomeIndexPath = 'compliance/estonia/2026-27/outcome-index.yaml';
const frameworkPath = 'compliance/estonia/2026-27/curriculum-framework.yaml';
const sourceRegistryPath = 'external-sources/official/estonia/2026-27/source-registry.yaml';
const contentQualityPath = 'evaluations/grade-4-content-quality-report.json';
const sourceGapPath = 'evaluations/grade-4-source-gap-report.json';

const defaultRouteIds = Object.freeze([
  'grade-4-russian',
  'grade-4-russian-reading',
  'grade-4-estonian-second-language',
  'grade-4-english',
  'grade-4-human-studies-and-society',
  'grade-4-science',
  'grade-4-mathematics',
  'grade-4-music',
]);
const alternativeRouteIds = Object.freeze(['grade-4-estonian']);
const simplifiedRouteIds = Object.freeze([
  'grade-4-human-studies-simplified',
  'grade-4-mathematics-simplified',
]);
const missingFields = Object.freeze(['art', 'technology_craft_home_economics', 'physical_education']);
const commonOutcomeIds = Object.freeze([
  'ee-prk-2026-stage2-general-self-correction',
  'ee-prk-2026-stage2-assessment-formative',
  'ee-prk-2026-stage2-cross-curricular-environment',
  'ee-prk-2026-stage2-school-curriculum-class-allocation',
]);
const ordinaryRouteIds = Object.freeze([...defaultRouteIds, ...alternativeRouteIds]);
const programmeOutcomeRouteIds = Object.freeze({
  'ee-prk-2026-stage2-general-self-correction': ordinaryRouteIds,
  'ee-prk-2026-stage2-assessment-formative': ordinaryRouteIds,
  'ee-prk-2026-stage2-cross-curricular-environment': [
    'grade-4-human-studies-and-society',
    'grade-4-science',
  ],
  'ee-prk-2026-stage2-school-curriculum-class-allocation': ordinaryRouteIds,
});
const estonianTargetTermsByRoute = Object.freeze({
  'grade-4-russian': ['põhiidee', 'tekst'],
  'grade-4-russian-reading': ['tegelane', 'sündmus'],
  'grade-4-estonian-second-language': ['küsimus', 'vastus'],
  'grade-4-english': ['sõna', 'lause'],
  'grade-4-human-studies-and-society': ['otsus', 'fakt', 'arvamus'],
  'grade-4-science': ['vaatlus', 'uurimus'],
  'grade-4-mathematics': ['arv', 'tabel', 'diagramm'],
  'grade-4-music': ['rütm', 'laul'],
});
const routeOutcomeIds = Object.freeze({
  'grade-4-russian': ['ee-prk-2026-stage2-russian-main-idea'],
  'grade-4-russian-reading': ['ee-prk-2026-stage2-literature-reading-response'],
  'grade-4-estonian': ['ee-prk-2026-stage2-estonian-source-comparison'],
  'grade-4-estonian-second-language': ['ee-prk-2026-stage2-estonian-second-language-daily-communication'],
  'grade-4-english': ['ee-prk-2026-stage2-foreign-language-a2'],
  'grade-4-human-studies-and-society': [
    'ee-prk-2026-stage2-human-studies-decisions',
    'ee-prk-2026-stage2-social-information-fact-opinion',
  ],
  'grade-4-human-studies-simplified': ['ee-plrk-2026-grade4-human-studies-safe-behaviour'],
  'grade-4-science': ['ee-prk-2026-stage2-natural-science-inquiry'],
  'grade-4-mathematics': ['ee-prk-2026-stage2-mathematics-representations'],
  'grade-4-mathematics-simplified': ['ee-plrk-2026-grade4-mathematics-number-range'],
  'grade-4-music': ['ee-prk-2026-stage2-music-cultural-participation'],
});
const missingFieldOutcomes = Object.freeze({
  art: ['ee-prk-2026-stage2-art-design-process'],
  technology_craft_home_economics: ['ee-prk-2026-stage2-technology-sustainable-safe-work'],
  physical_education: ['ee-prk-2026-stage2-physical-education-safe-movement'],
});
const knownGaps = Object.freeze([
  'Final Riigi Teataja refresh remains tracked under issue #37.',
  'The official baseline is intentionally non-exhaustive outside its declared scope.',
  'Complete Opiq instructional page prose was not captured.',
  'Task bodies were only partially captured.',
  'An exclusive Grade 4 art route is missing.',
  'An exclusive Grade 4 technology, craft and home-economics route is missing.',
  'An exclusive Grade 4 physical-education route is missing.',
  'The independently authored standalone commercial core is not implemented.',
  'Originality review is not yet applicable because production materials are absent.',
  'Customer companion access has not been verified.',
  'Default-core source programme types remain unverified.',
  'Pedagogical effectiveness has not been established.',
]);
const releaseBlockerCodes = Object.freeze(['default_core_programme_type_unverified']);
const authoritativeInputs = Object.freeze([
  'source-manifest.json',
  'docs/audits/grade-4-canonical-source-import.md',
  'docs/audits/grade-4-content-quality.md',
  'docs/audits/grade-4-live-catalogue-gap-review.md',
  contentQualityPath,
  sourceGapPath,
  outcomeIndexPath,
  frameworkPath,
  sourceRegistryPath,
  topicAlignmentPolicyPath,
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort(bytewise).map((key) => [key, stableClone(value[key])]));
  }
  return value;
}

export function stableYaml(value) {
  return YAML.stringify(stableClone(value), { lineWidth: 120 });
}

function slug(value) {
  const normalized = String(value)
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 56)
    .replace(/-$/g, '');
  return normalized || 'record';
}

function stableId(prefix, value) {
  return `${prefix}-${slug(value)}-${sha256(String(value)).slice(0, 10)}`;
}

function roleFor(routeId) {
  if (defaultRouteIds.includes(routeId)) return 'default_ordinary_core';
  if (alternativeRouteIds.includes(routeId)) return 'alternative_language_profile';
  return 'learner_specific_simplified';
}

function routeDir(routeId) {
  return `curriculum-maps/${routeId}`;
}

function routeCommon(routeModel, artifactType, suffix) {
  const { definition } = routeModel;
  return {
    schema_version: architectureVersion,
    artifact_type: artifactType,
    artifact_id: `${definition.id}-${suffix}`,
    grade: 4,
    route_id: definition.id,
    subject: definition.subject.en,
    subject_et: definition.subject.et,
    record_count: definition.expected_record_count,
    canonical_route: {
      source_id: definition.id,
      md_path: definition.output_path,
      source_archive: definition.source_archive,
      qa_path: definition.qa_path,
    },
    programme_role: roleFor(definition.id),
    provenance: {
      generated_from: authoritativeInputs,
      generated_by: 'scripts/generate-grade-4-course-architecture.mjs',
      verification_date: architectureVerificationDate,
      claim_boundary: 'Architecture and source metadata only; no textbook prose, task bodies, publication readiness or effectiveness claim.',
    },
    completeness: {
      status: 'partial',
      declared_complete: false,
      known_gaps: [
        'Complete instructional prose is unavailable for this route.',
        'Captured task examples do not establish complete assessment evidence.',
      ],
    },
  };
}

function frameworkOutcomes(framework) {
  return framework.outcome_sets.flatMap((set) => set.outcomes.map((outcome) => ({
    ...outcome,
    curriculum: set.curriculum,
    subject_field: set.subject_field,
    official_subject: set.official_subject,
  })));
}

function buildOfficialMap(routeModel, outcomeById, topicInventory, alignmentPolicy) {
  const ids = routeOutcomeIds[routeModel.definition.id];
  const simplified = simplifiedRouteIds.includes(routeModel.definition.id);
  const outcomes = ids.map((id) => {
    const source = outcomeById.get(id);
    if (!source) throw new Error(`${routeModel.definition.id}: unknown outcome ${id}.`);
    return {
      outcome_id: id,
      source_id: source.source_id,
      official_reference: source.official_reference,
      official_wording_et: source.official_wording_et,
      translation_ru: source.translation_ru,
      translation_provenance: source.translation_provenance,
      official_scope: source.scope,
      subject_field: source.subject_field,
      official_subject: source.official_subject ?? null,
      curriculum: source.curriculum,
      evidence_status: source.evidence_status,
      allocation_basis: simplified ? 'official_exact_grade' : 'opiq_helper_recommended_allocation',
      grade_4_allocation_note: simplified
        ? 'This outcome is explicitly assigned to Grade 4 by the simplified curriculum source.'
        : id === 'ee-prk-2026-stage2-foreign-language-a2'
          ? 'Grade 4 work is a curated progression toward the terminal stage-II A2 target, not completion of A2.'
          : 'This is an Opiq Helper recommended Grade 4 allocation of a national stage-II endpoint.',
      source_alignment: resolveOutcomeAlignment(
        alignmentPolicy,
        routeModel,
        topicInventory,
        id,
      ),
    };
  });
  const officialFields = routeModel.definition.id === 'grade-4-human-studies-and-society'
    ? outcomes.map((outcome) => outcome.official_subject).filter(Boolean).sort(bytewise)
    : [...new Set(outcomes.map((outcome) => outcome.subject_field))].sort(bytewise);
  return {
    ...routeCommon(routeModel, 'grade_programme_official_curriculum_map', 'official-curriculum'),
    regulatory_baseline_ref: outcomeIndexPath,
    official_scope: simplified
      ? { kind: 'exact_grade', grade: 4, exact_grade_claimed: true }
      : { kind: 'school_stage', school_stage: 2, terminal_grade: 6, exact_grade_claimed: false },
    official_fields: officialFields,
    outcomes,
    allocation_status: {
      national_exact_grade_claimed: simplified,
      curated_grade_4_allocation: simplified ? 'official_exact_grade' : 'opiq_helper_recommended_allocation',
      notes: simplified
        ? 'Exact-grade status comes only from the verified simplified-curriculum appendix.'
        : 'National stage-II scope remains distinct from this recommended Grade 4 allocation.',
    },
  };
}

function recordId(routeId, record) {
  return stableId(`${routeId}-record`, `${record.kit_id}:${record.url}`);
}

function buildBookInventory(routeModel) {
  const groups = new Map();
  for (const record of routeModel.canonical_records) {
    const key = `${record.kit_id}:${record.book_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  const books = [...groups.entries()].sort(([a], [b]) => bytewise(a, b)).map(([, records]) => {
    const first = records[0];
    const simplified = routeModel.definition.programme_type === 'simplified_curriculum';
    const mixed = routeModel.definition.programme_type === 'mixed_subject';
    const canonicalUrls = records.map((record) => record.url).sort(bytewise);
    const taskRecords = records.filter((record) => record.task_examples.length > 0);
    return {
      book_id: first.book_id,
      kit_id: first.kit_id,
      kit_url: `https://www.opiq.ee/Kit/Details/${first.kit_id}`,
      title: first.book,
      publisher: first.publisher || null,
      languages: [...new Set(records.map((record) => record.language))].sort(bytewise),
      programme_type: routeModel.definition.programme_type,
      programme_type_evidence: {
        status: simplified || mixed ? 'verified' : 'ambiguous',
        basis: simplified
          ? 'verified_simplified_route'
          : mixed
            ? 'verified_mixed_route'
            : 'manifest_route_policy',
        notes: simplified
          ? 'The manifest and source policy identify this learner-specific simplified route.'
          : mixed
            ? 'The manifest and source policy preserve this mixed human/society route.'
            : 'Programme type remains unknown; it is not silently normalized to ordinary curriculum.',
      },
      canonical_record_count: records.length,
      task_example_record_count: taskRecords.length,
      task_example_count: taskRecords.reduce((sum, record) => sum + record.task_examples.length, 0),
      full_prose_available: false,
      canonical_urls: canonicalUrls,
      record_ids: records.map((record) => recordId(routeModel.definition.id, record)).sort(bytewise),
      eligibility: {
        internal_source_analysis: true,
        optional_companion_candidate: true,
        curated_core_candidate: !simplified,
        ordinary_default_use: false,
        programme_verification_required: routeModel.definition.programme_type === 'unknown',
        simplified_learner_specific_use: simplified,
        teacher_only_use: false,
      },
      edition_relationships: routeModel.definition.edition_distinctions
        .filter(([left, right]) => left === first.kit_id || right === first.kit_id)
        .map(([left, right, note]) => `Kits ${left} and ${right}: ${note}`),
      source_limitations: [
        'Complete instructional page prose is not present in the canonical record model.',
        'Customer access to Opiq chapters has not been checked.',
      ],
    };
  });
  return {
    ...routeCommon(routeModel, 'grade_programme_book_inventory', 'book-inventory'),
    source_audit: {
      manifest_record_count: routeModel.definition.expected_record_count,
      computed_record_count: routeModel.canonical_records.length,
      kit_count: routeModel.definition.included_kit_ids.length,
      task_example_record_count: routeModel.canonical_records.filter((record) => record.task_examples.length > 0).length,
      full_prose_record_count: 0,
    },
    books,
    source_records: routeModel.canonical_records.map((record) => ({
      record_id: recordId(routeModel.definition.id, record),
      canonical_url: record.url,
      kit_id: record.kit_id,
      chapter_id: record.url.split('/').at(-1),
      book_id: record.book_id,
      title: record.title,
      language: record.language,
      source_sequence: record.source_sequence,
    })),
  };
}

function normalizedTopicKey(record) {
  const value = record.headings[0] || record.title;
  return value.normalize('NFKC').toLocaleLowerCase('et').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function buildTopicInventory(routeModel) {
  const groups = new Map();
  for (const record of routeModel.canonical_records) {
    const key = normalizedTopicKey(record) || `${record.kit_id}:${record.url}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  const outcomeCandidates = routeOutcomeIds[routeModel.definition.id];
  const topics = [...groups.entries()].sort(([a], [b]) => bytewise(a, b)).map(([key, records]) => {
    const first = records[0];
    const original = first.headings[0] || first.title;
    const languages = [...new Set(records.map((record) => record.language))].sort(bytewise);
    const hasTasks = records.some((record) => record.task_examples.length > 0);
    const multipleKits = new Set(records.map((record) => record.kit_id)).size > 1;
    return {
      topic_id: stableId(`${routeModel.definition.id}-topic`, key),
      original_heading_key: key,
      title_ru: languages.includes('ru') ? original : 'Русское название не подтверждено исходником',
      title_et: languages.includes('et') ? original : 'Eestikeelne pealkiri ei ole lähteandmetes kinnitatud',
      route_id: routeModel.definition.id,
      source_record_ids: records.map((record) => recordId(routeModel.definition.id, record)).sort(bytewise),
      canonical_urls: records.map((record) => record.url).sort(bytewise),
      kit_ids: [...new Set(records.map((record) => record.kit_id))].sort(bytewise),
      book_ids: [...new Set(records.map((record) => record.book_id))].sort(bytewise),
      source_languages: languages,
      source_headings: [...new Set(records.flatMap((record) => record.headings.length > 0 ? record.headings : [record.title]))].sort(bytewise),
      evidence_level: hasTasks ? 'heading_and_task_example' : 'heading_only',
      task_example_status: hasTasks ? 'partial_captured' : 'not_captured',
      full_prose_status: 'missing',
      edition_relationships: records.length === 1
        ? 'single_record_group'
        : multipleKits
          ? 'same_title_multiple_editions'
          : 'same_title_multiple_records',
      duplicate_group: stableId(`${routeModel.definition.id}-duplicate`, key),
      official_outcome_candidates: outcomeCandidates,
      authoring_gap: hasTasks ? 'complete_prose_and_tasks_required' : 'complete_prose_and_tasks_required',
      automatic_translated_topics_used_as_source_prose: false,
      notes: 'Clustered only within this route from original headings; translated query metadata is not treated as source prose.',
    };
  });
  return {
    ...routeCommon(routeModel, 'grade_programme_topic_inventory', 'topic-inventory'),
    inventory_scope: 'route_bounded_original_headings_and_metadata',
    deduplication_policy: {
      normalization: 'nfc_casefold_whitespace_punctuation',
      cross_route_deduplication: false,
      edition_policy: 'preserve_without_obsolescence_claim',
      source_record_preservation: 'all_records_retained',
    },
    topics,
  };
}

function missingSourceAlignment(alignmentId, evidenceLayer, notes) {
  return {
    policy_alignment_id: alignmentId,
    status: 'missing',
    evidence_layer: evidenceLayer,
    topic_cluster_refs: [],
    source_record_ids: [],
    match_basis: [evidenceLayer],
    task_evidence_status: 'not_applicable',
    task_evidence_source_record_ids: [],
    notes,
  };
}

function resolvePolicySourceAlignment(entry, routeModel, topicInventory) {
  if (!entry) {
    return missingSourceAlignment(
      `missing-${routeModel.definition.id}`,
      'missing_route',
      'No authored topic-alignment policy entry exists for this route and outcome.',
    );
  }
  const topicByRecordId = new Map(topicInventory.topics.flatMap((topic) => (
    topic.source_record_ids.map((sourceRecordId) => [sourceRecordId, topic])
  )));
  const topicByHeadingKey = new Map(topicInventory.topics.map((topic) => [topic.original_heading_key, topic]));
  const selectedTopics = [];
  const selectedRecordIds = new Set();
  for (const selector of entry.topic_selectors) {
    const topic = selector.source_record_id
      ? topicByRecordId.get(selector.source_record_id)
      : topicByHeadingKey.get(selector.original_heading_key);
    if (!topic) continue;
    selectedTopics.push(topic);
    if (selector.source_record_id) selectedRecordIds.add(selector.source_record_id);
    else for (const sourceRecordId of topic.source_record_ids) selectedRecordIds.add(sourceRecordId);
  }
  return {
    policy_alignment_id: entry.alignment_id,
    status: entry.confidence,
    evidence_layer: 'source_topic',
    topic_cluster_refs: [...new Set(selectedTopics.map((topic) => topic.topic_id))].sort(bytewise),
    source_record_ids: [...selectedRecordIds].sort(bytewise),
    match_basis: [...entry.match_basis].sort(bytewise),
    task_evidence_status: entry.task_evidence.status,
    task_evidence_source_record_ids: [...entry.task_evidence.source_record_ids].sort(bytewise),
    notes: entry.notes,
  };
}

function resolveOutcomeAlignment(alignmentPolicy, routeModel, topicInventory, outcomeId) {
  const entry = alignmentPolicy.outcome_alignments.find((candidate) => (
    candidate.route_id === routeModel.definition.id && candidate.outcome_id === outcomeId
  ));
  return resolvePolicySourceAlignment(entry, routeModel, topicInventory);
}

function programmePolicySourceAlignment(entry) {
  if (!entry) {
    return missingSourceAlignment(
      'missing-programme-policy',
      'missing_route',
      'No authored programme-policy alignment exists for this official outcome.',
    );
  }
  return {
    policy_alignment_id: entry.alignment_id,
    status: entry.confidence,
    evidence_layer: 'programme_policy',
    topic_cluster_refs: [],
    source_record_ids: [],
    match_basis: ['programme_policy'],
    task_evidence_status: 'not_applicable',
    task_evidence_source_record_ids: [],
    notes: entry.notes,
  };
}

function buildCoverageRow(outcome, routeIds, sourceAlignment) {
  const missingRoute = routeIds.length === 0;
  const sourceMissing = sourceAlignment.status === 'missing';
  const sourceAmbiguous = sourceAlignment.status === 'ambiguous';
  const hasTaskEvidence = sourceAlignment.task_evidence_status === 'linked';
  const sourceTopicPresence = sourceAlignment.evidence_layer === 'programme_policy'
    ? 'not_applicable'
    : sourceMissing
      ? 'missing'
      : sourceAmbiguous
        ? 'ambiguous'
        : sourceAlignment.match_basis.includes('book_or_kit_metadata')
          && !sourceAlignment.match_basis.includes('original_heading')
          ? 'metadata_only'
          : hasTaskEvidence
            ? 'heading_and_task_example'
            : 'heading_only';
  return {
    outcome_id: outcome.outcome_or_requirement_id,
    official_scope: outcome.scope,
    curated_grade_4_allocation: outcome.scope.kind === 'exact_grade'
      ? 'official_exact_grade'
      : missingRoute
        ? 'local_school_allocation_candidate'
        : 'opiq_helper_recommended_allocation',
    curriculum_alignment_status: outcome.evidence_status,
    source_topic_presence: sourceTopicPresence,
    task_evidence_status: sourceAlignment.task_evidence_status,
    full_prose_status: 'missing',
    lesson_authoring_status: 'not_started',
    assessment_evidence_status: sourceMissing ? 'missing' : sourceAmbiguous ? 'ambiguous' : hasTaskEvidence ? 'partial' : 'missing',
    coverage_status: sourceMissing ? 'missing' : sourceAmbiguous ? 'ambiguous' : 'partial',
    route_ids: routeIds,
    topic_cluster_refs: sourceAlignment.topic_cluster_refs,
    source_alignment: sourceAlignment,
    blocking_gaps: missingRoute
      ? ['No exclusive Grade 4 manifest route exists for this official field.']
      : sourceMissing
        ? ['No relevant source topic was verified for this outcome within its declared route.']
      : sourceAlignment.evidence_layer === 'programme_policy'
        ? ['Programme policy supports the allocation, but complete authored lessons and assessment evidence remain unavailable.']
        : ['Authored topic alignment does not prove full outcome coverage; prose and assessment authoring remain incomplete.'],
  };
}

function buildRouteCoverage(routeModel, officialMap, frameworkById) {
  const rows = officialMap.outcomes.map((outcome) => buildCoverageRow(
    frameworkById.get(outcome.outcome_id),
    [routeModel.definition.id],
    outcome.source_alignment,
  ));
  return {
    schema_version: architectureVersion,
    artifact_type: 'grade_programme_route_coverage',
    artifact_id: `${routeModel.definition.id}-coverage`,
    grade: 4,
    route_id: routeModel.definition.id,
    official_curriculum_ref: `${routeDir(routeModel.definition.id)}/official-curriculum.yaml`,
    topic_inventory_ref: `${routeDir(routeModel.definition.id)}/topic-inventory.yaml`,
    rows,
    summary: {
      outcome_count: rows.length,
      partial: rows.filter((row) => row.coverage_status === 'partial').length,
      missing: rows.filter((row) => row.coverage_status === 'missing').length,
      ambiguous: rows.filter((row) => row.coverage_status === 'ambiguous').length,
      verified_full_coverage: 0,
    },
    completeness: {
      status: 'partial',
      declared_complete: false,
      known_gaps: ['Full prose, complete task bodies, authored lessons and assessment evidence remain unavailable.'],
    },
  };
}

function provenance() {
  return {
    authoritative_inputs: authoritativeInputs,
    generated_by: 'scripts/generate-grade-4-course-architecture.mjs',
    verification_date: architectureVerificationDate,
    claim_boundary: 'Recommended Grade 4 architecture; it is not a national exact-grade timetable, published course or effectiveness finding.',
  };
}

function commonProgramme(artifactType, artifactId) {
  return {
    schema_version: architectureVersion,
    artifact_type: artifactType,
    artifact_id: artifactId,
    programme_id: programmeId,
    grade: 4,
    target_school_year: '2026/27',
  };
}

function estimate(minimum, maximum, notes, confidence = 'low') {
  return {
    minimum,
    maximum,
    estimate_basis: ['topic_cluster_count', 'revision', 'assessment', 'language_support', 'source_readiness'],
    confidence,
    notes,
  };
}

function buildRouteIndex(routeArtifacts, sourceGap) {
  return {
    ...commonProgramme('grade_programme_route_index', 'grade-4-route-index'),
    canonical_record_total: 2212,
    live_student_kit_count: sourceGap.summary.canonical_student_kits,
    new_exact_grade_4_student_candidates: sourceGap.summary.new_exact_grade_4_student_candidates,
    simplified_route_count: simplifiedRouteIds.length,
    mixed_route_count: 1,
    routes: routeArtifacts.map(({ routeModel, bookInventory }) => ({
      route_id: routeModel.definition.id,
      record_count: routeModel.definition.expected_record_count,
      kit_ids: routeModel.definition.included_kit_ids,
      programme_type: routeModel.definition.programme_type,
      programme_role: roleFor(routeModel.definition.id),
      md_path: routeModel.definition.output_path,
      route_directory: routeDir(routeModel.definition.id),
      companion_candidates: routeModel.definition.included_kit_ids.map((kitId) => ({
        candidate_id: `${routeModel.definition.id}-kit-${kitId}`,
        kit_id: kitId,
        canonical_urls: bookInventory.books
          .filter((book) => book.kit_id === kitId)
          .flatMap((book) => book.canonical_urls)
          .sort(bytewise),
        visibility: 'internal_only',
        access: { mode: 'unverified' },
        check_status: 'not_checked',
        standalone_fallback_required: true,
        customer_visible: false,
        teacher_only: false,
      })),
    })),
    missing_exclusive_route_fields: missingFields,
    provenance: provenance(),
  };
}

function strand(routeId, cadence, skills, min, max) {
  return {
    strand_id: `${routeId}-mastery`,
    route_id: routeId,
    cadence,
    planning_basis: 'opiq_helper_recommendation_not_national_timetable',
    core_skills: skills,
    estonian_language_functions: ['name', 'describe', 'compare', 'sequence'],
    assessment_evidence: ['individual first attempt', 'correction after feedback'],
    revision_cycle: 'Immediate correction plus spaced revisit in a later programme period.',
    estimated_lesson_range: estimate(min, max, 'Range reflects source clusters and reserved authoring, revision, assessment and language-support work.'),
  };
}

function buildMastery() {
  return {
    ...commonProgramme('grade_programme_mastery_strands', 'grade-4-mastery-strands'),
    mastery_strands: [
      strand('grade-4-russian', 'daily_or_near_daily', ['language structures', 'written expression'], 70, 110),
      strand('grade-4-russian-reading', 'three_to_four_times_weekly', ['meaningful reading', 'individual response'], 45, 75),
      strand('grade-4-estonian-second-language', 'daily_or_near_daily', ['A1–A2 interaction', 'supported production'], 70, 110),
      strand('grade-4-mathematics', 'daily_or_near_daily', ['representations', 'reasoning and correction'], 90, 130),
      strand('grade-4-english', 'three_to_four_times_weekly', ['progress toward stage-II A2', 'familiar communication'], 55, 85),
    ],
    subject_strands: [
      strand('grade-4-science', 'weekly', ['inquiry', 'observation and evidence'], 35, 55),
      strand('grade-4-human-studies-and-society', 'weekly', ['decisions', 'fact and opinion'], 25, 40),
      strand('grade-4-music', 'weekly', ['listening', 'cultural participation'], 25, 40),
    ],
    missing_route_strands: [
      { strand_id: 'grade-4-art-gap', field_id: 'art', source_status: 'missing_route', content_strategy: 'author_created_required', release_status: 'blocked' },
      { strand_id: 'grade-4-technology-gap', field_id: 'technology_craft_home_economics', source_status: 'missing_route', content_strategy: 'additional_source_capture_required', release_status: 'blocked' },
      { strand_id: 'grade-4-physical-education-gap', field_id: 'physical_education', source_status: 'missing_route', content_strategy: 'school_specific_resource_required', release_status: 'blocked' },
    ],
    provenance: provenance(),
  };
}

function buildProjects(routeArtifacts, alignmentPolicy) {
  const base = [
    ['my-place-community', 'Моё место и сообщество', 'Minu koht ja kogukond', 'Как описать своё место и принимать обоснованные решения?', ['grade-4-russian', 'grade-4-estonian-second-language', 'grade-4-human-studies-and-society'], ['ee-prk-2026-stage2-russian-main-idea', 'ee-prk-2026-stage2-human-studies-decisions']],
    ['nature-weather', 'Природа и наблюдение за погодой', 'Loodus ja ilmavaatlus', 'Как наблюдения помогают объяснять изменения вокруг нас?', ['grade-4-science', 'grade-4-mathematics', 'grade-4-estonian-second-language'], ['ee-prk-2026-stage2-natural-science-inquiry', 'ee-prk-2026-stage2-mathematics-representations']],
    ['safe-school-route', 'Безопасная школа и дорога', 'Turvaline kool ja koolitee', 'Как составить обоснованное правило безопасного поведения?', ['grade-4-human-studies-and-society', 'grade-4-russian', 'grade-4-mathematics'], ['ee-prk-2026-stage2-human-studies-decisions', 'ee-prk-2026-stage2-general-self-correction']],
    ['culture-stories-music', 'Культура, истории и музыка', 'Kultuur, lood ja muusika', 'Как текст и музыка помогают понять культурный опыт?', ['grade-4-russian-reading', 'grade-4-music', 'grade-4-estonian-second-language'], ['ee-prk-2026-stage2-literature-reading-response', 'ee-prk-2026-stage2-music-cultural-participation']],
    ['everyday-mathematics', 'Математика в повседневной жизни', 'Matemaatika igapäevaelus', 'Как представить повседневную задачу разными математическими способами?', ['grade-4-mathematics', 'grade-4-russian', 'grade-4-english'], ['ee-prk-2026-stage2-mathematics-representations', 'ee-prk-2026-stage2-foreign-language-a2']],
    ['responsible-environment', 'Среда и ответственный выбор', 'Keskkond ja vastutustundlik valik', 'Как наблюдения и источники помогают сделать ответственный выбор?', ['grade-4-science', 'grade-4-human-studies-and-society', 'grade-4-estonian-second-language'], ['ee-prk-2026-stage2-cross-curricular-environment', 'ee-prk-2026-stage2-social-information-fact-opinion']],
  ];
  return {
    ...commonProgramme('grade_programme_project_modules', 'grade-4-project-modules'),
    principle: 'projects_apply_but_do_not_replace_mastery_strands',
    projects: base.map(([id, ru, et, question, routes, outcomes], index) => {
      const projectId = `grade-4-project-${id}`;
      const sourceAlignments = routes.map((routeId) => {
        const routeArtifact = routeArtifacts.find((entry) => entry.routeModel.definition.id === routeId);
        const policyEntry = alignmentPolicy.project_alignments.find((entry) => (
          entry.project_id === projectId && entry.route_id === routeId
        ));
        const {
          evidence_layer: unusedEvidenceLayer,
          ...resolved
        } = resolvePolicySourceAlignment(policyEntry, routeArtifact.routeModel, routeArtifact.topicInventory);
        return { route_id: routeId, ...resolved };
      });
      const unresolved = sourceAlignments.filter((alignment) => ['missing', 'ambiguous'].includes(alignment.status));
      const linkedRoutes = sourceAlignments.filter((alignment) => alignment.topic_cluster_refs.length > 0);
      return {
        project_id: projectId,
        title_ru: ru,
        title_et: et,
        driving_question_ru: question,
        linked_route_ids: routes,
        linked_outcome_ids: outcomes,
        source_alignments: sourceAlignments,
        topic_cluster_refs: [...new Set(sourceAlignments.flatMap((alignment) => alignment.topic_cluster_refs))].sort(bytewise),
        prerequisites: index === 0 ? [] : [`grade-4-project-${base[index - 1][0]}`],
        estimated_lesson_range: estimate(4, 8, 'Architecture estimate includes individual evidence, practical application and separate language checks.'),
        shared_product: 'A bounded shared product assembled from separately attributable learner contributions.',
        individual_grade_4_evidence: 'An individual first attempt, explanation or reflection is retained for Grade 4 assessment.',
        russian_subject_evidence: 'Subject understanding and reasoning are evidenced in Russian without lowering content demand.',
        estonian_language_evidence: 'A separate short supported Estonian A1–A2 production sample is retained.',
        mathematics_or_data_evidence: 'A table, representation or explicit not-applicable note is retained for each learner.',
        practical_or_community_component: 'A safe observation, local inquiry or simulated community application is planned.',
        source_gaps: [
          'Complete prose and task bodies are not present in captured source evidence.',
          ...unresolved.map((alignment) => `No relevant route topic was verified for this project role: ${alignment.route_id}.`),
        ],
        author_created_components_required: [
          'clean-room instructions',
          'individual evidence prompt',
          'assessment criterion',
          ...(unresolved.length > 0 ? ['clean-room bridge for each unresolved route role'] : []),
        ],
        opiq_companion_candidate_ids: linkedRoutes.map((alignment) => {
          const routeArtifact = routeArtifacts.find((entry) => entry.routeModel.definition.id === alignment.route_id);
          const sourceRecordIds = new Set(alignment.source_record_ids);
          const book = routeArtifact.bookInventory.books.find((candidate) => (
            candidate.record_ids.some((recordIdValue) => sourceRecordIds.has(recordIdValue))
          ));
          return `${alignment.route_id}-kit-${book.kit_id}`;
        }),
      };
    }),
    provenance: provenance(),
  };
}

function buildLanguage() {
  return {
    ...commonProgramme('grade_programme_language_progression', 'grade-4-language-progression'),
    profile: { primary_explanation_language: 'ru', support_language: 'et', target_level: 'A1-A2' },
    progression_stages: [
      { stage_id: 'terminology-recognition', focus: 'Recognise subject terminology and familiar instructions.', support_level: 'full_scaffold' },
      { stage_id: 'supported-naming-description', focus: 'Name and describe with a visible word bank and sentence frame.', support_level: 'partial_scaffold' },
      { stage_id: 'supported-comparison-sequence', focus: 'Compare and sequence in short supported utterances.', support_level: 'reduced_scaffold' },
      { stage_id: 'independent-short-production', focus: 'Give a short oral or written answer with reduced support.', support_level: 'independent_short_production' },
    ],
    subject_strands: defaultRouteIds.map((routeId, index) => ({
      route_id: routeId,
      target_terms: estonianTargetTermsByRoute[routeId],
      instruction_verbs: ['Vaata', 'Nimeta', 'Kirjelda', 'Võrdle'],
      sentence_frames: ['Ma näen ___.', '___ on ___ kui ___.'],
      oral_output: 'One short supported subject-relevant answer.',
      written_output: 'One short labelled or framed statement.',
      support_level: index < 3 ? 'full_scaffold' : 'partial_scaffold',
      later_reuse: 'Terms and frames recur in a later mastery or project window.',
    })),
    guardrails: {
      subject_understanding_language: 'ru',
      estonian_production_separate: true,
      content_reduction_for_language_limit: false,
      translated_query_topics_are_terminology_evidence: false,
    },
    provenance: provenance(),
  };
}

function buildCalendar(projects) {
  const projectIds = projects.projects.map((project) => project.project_id);
  return {
    ...commonProgramme('grade_programme_teaching_calendar', 'grade-4-teaching-calendar'),
    planning_status: 'recommended_not_national_timetable',
    periods: [0, 1, 2, 3].map((period) => ({
      period_id: `programme-period-${period + 1}`,
      mastery_continues: true,
      project_ids: projectIds.slice(period === 3 ? 3 : period, period === 3 ? 6 : period + 1),
      practical_focus: period % 2 === 0 ? 'Bounded observation and local application.' : 'Community or cultural application.',
      revision_focus: 'Spaced retrieval of prior subject concepts with correction after the first attempt.',
      assessment_evidence: 'Separate subject evidence and Estonian production check.',
      prerequisites: period === 0 ? [] : [`programme-period-${period}`],
    })),
    monthly_evidence_checkpoints: {
      classification: 'recommended_good_practice',
      purpose: 'Support school oversight with compact current evidence; no portfolio, weekly log or platform is claimed as nationally mandatory.',
      portfolio_nationally_mandatory: false,
    },
    national_weekly_hours_claimed: false,
    provenance: provenance(),
  };
}

function buildRoadmap() {
  return {
    ...commonProgramme('grade_programme_implementation_roadmap', 'grade-4-implementation-roadmap'),
    status: 'architecture_only',
    stages: [
      { stage_id: 'architecture-and-evidence', status: 'complete', deliverables: ['route maps', 'source inventories', 'coverage and programme architecture'], entry_gate: 'Authoritative inputs validate.' },
      { stage_id: 'clean-room-authoring', status: 'not_started', deliverables: ['standalone explanations', 'tasks', 'answer evidence'], entry_gate: 'Architecture review and source-gap decisions are accepted.' },
      { stage_id: 'production-validation', status: 'blocked', deliverables: ['originality review', 'teacher review', 'classroom and home trials'], entry_gate: 'Production materials exist and pass structural validation.' },
    ],
    future_material_ids: ['grade-4-art-author-created-core', 'grade-4-technology-author-created-core', 'grade-4-physical-education-school-specific-core'],
    release_blocker_codes: releaseBlockerCodes,
    release_blockers: knownGaps,
    non_goals: ['No full lessons are authored in this change.', 'No textbook prose or task body is reconstructed.', 'No publication or effectiveness status is granted.'],
    provenance: provenance(),
  };
}

function buildProgrammeCoverage(frameworkOutcomesList, routeArtifacts, alignmentPolicy) {
  const routeByOutcome = new Map([
    ...Object.entries(routeOutcomeIds).flatMap(([routeId, ids]) => ids.map((id) => [id, [routeId]])),
    ...commonOutcomeIds.map((outcomeId) => [outcomeId, programmeOutcomeRouteIds[outcomeId]]),
  ]);
  const grade4Outcomes = frameworkOutcomesList.filter((outcome) => outcome.downstream_relevance.grade_4);
  const rows = grade4Outcomes.map((outcome) => {
    const routeIds = routeByOutcome.get(outcome.outcome_or_requirement_id) ?? [];
    const routeOutcome = Object.entries(routeOutcomeIds).find(([, outcomeIds]) => (
      outcomeIds.includes(outcome.outcome_or_requirement_id)
    ));
    let sourceAlignment;
    if (routeOutcome) {
      const routeArtifact = routeArtifacts.find((entry) => entry.routeModel.definition.id === routeOutcome[0]);
      sourceAlignment = routeArtifact.officialMap.outcomes.find((entry) => (
        entry.outcome_id === outcome.outcome_or_requirement_id
      )).source_alignment;
    } else if (commonOutcomeIds.includes(outcome.outcome_or_requirement_id)) {
      sourceAlignment = programmePolicySourceAlignment(
        alignmentPolicy.programme_policy_alignments.find((entry) => (
          entry.outcome_id === outcome.outcome_or_requirement_id
        )),
      );
    } else {
      sourceAlignment = missingSourceAlignment(
        `missing-${outcome.outcome_or_requirement_id}`,
        'missing_route',
        'No exclusive Grade 4 manifest route exists for this official field.',
      );
    }
    return buildCoverageRow(outcome, routeIds, sourceAlignment);
  });
  return {
    schema_version: architectureVersion,
    artifact_type: 'grade_programme_coverage_matrix',
    artifact_id: 'grade-4-programme-coverage',
    programme_id: programmeId,
    target_school_year: '2026/27',
    outcome_index_ref: outcomeIndexPath,
    rows,
    missing_exclusive_route_fields: missingFields,
    summary: {
      official_outcome_count: rows.length,
      route_linked_outcomes: rows.filter((row) => row.route_ids.length > 0).length,
      missing_route_outcomes: rows.filter((row) => row.route_ids.length === 0).length,
      exact_grade_outcomes: rows.filter((row) => row.official_scope.kind === 'exact_grade').length,
      school_stage_outcomes: rows.filter((row) => row.official_scope.kind === 'school_stage').length,
    },
    completeness: { status: 'partial', declared_complete: false, known_gaps: knownGaps },
  };
}

function buildArchitecture(routeArtifacts) {
  return {
    ...commonProgramme('grade_programme_architecture', 'grade-4-programme-architecture'),
    learner_profile: {
      primary_language: 'ru',
      estonian_subject_route: 'grade-4-estonian-second-language',
      estonian_subject_level: 'A1-A2',
      subject_explanation_language: 'ru',
      subject_support_language: 'et',
      english_role: 'foreign_language',
    },
    alternative_profiles: [
      { profile_id: 'first-language-estonian-alternative', route_id: 'grade-4-estonian', activation: 'explicit_language_profile_selection' },
      ...simplifiedRouteIds.map((routeId) => ({ profile_id: `${routeId}-opt-in`, route_id: routeId, activation: 'learner_specific_simplified_opt_in' })),
    ],
    regulatory_baseline_ref: outcomeIndexPath,
    delivery_model: {
      core_mode: 'standalone_commercial_core',
      opiq_required: false,
      opiq_companion_policy: 'optional',
      customer_can_complete_without_opiq: true,
      publication_status: 'internal_review',
    },
    route_strands: routeArtifacts.map(({ routeModel }) => ({
      route_id: routeModel.definition.id,
      programme_role: roleFor(routeModel.definition.id),
      official_curriculum_ref: `${routeDir(routeModel.definition.id)}/official-curriculum.yaml`,
      book_inventory_ref: `${routeDir(routeModel.definition.id)}/book-inventory.yaml`,
      topic_inventory_ref: `${routeDir(routeModel.definition.id)}/topic-inventory.yaml`,
      coverage_ref: `${routeDir(routeModel.definition.id)}/coverage-matrix.yaml`,
    })),
    official_field_gaps: missingFields.map((fieldId) => ({
      field_id: fieldId,
      outcome_ids: missingFieldOutcomes[fieldId],
      source_status: 'missing_route',
      content_strategy: fieldId === 'art'
        ? 'author_created_required'
        : fieldId === 'technology_craft_home_economics'
          ? 'additional_source_capture_required'
          : 'school_specific_resource_required',
      release_status: 'blocked',
    })),
    mastery_strands: `${programmeDirectory}/mastery-strands.yaml`,
    project_modules: `${programmeDirectory}/project-modules.yaml`,
    annual_sequence: `${programmeDirectory}/teaching-calendar.yaml`,
    practical_and_community_learning: {
      classification: 'recommended_good_practice',
      principle: 'Use safe age-appropriate application while retaining individual evidence and explicit source gaps.',
    },
    revision_and_assessment_calendar: `${programmeDirectory}/teaching-calendar.yaml`,
    estonian_language_progression: `${programmeDirectory}/language-progression.yaml`,
    opiq_companion_policy: {
      default_visibility: 'internal_only',
      access_mode: 'unverified',
      check_status: 'not_checked',
      standalone_fallback_required: true,
      teacher_only_allowed: false,
    },
    implementation_roadmap: `${programmeDirectory}/implementation-roadmap.yaml`,
    completeness: { status: 'partial', declared_complete: false, known_gaps: knownGaps },
    release_gate: {
      status: 'blocked',
      publication_ready: false,
      classroom_ready: false,
      effectiveness_claimed: false,
      blocker_codes: releaseBlockerCodes,
      blockers: knownGaps,
    },
    known_gaps: knownGaps,
    provenance: provenance(),
  };
}

function buildDocs(artifacts) {
  const routeIndex = artifacts.programme.routeIndex;
  const coverage = artifacts.programme.coverage;
  const projectCount = artifacts.programme.projects.projects.length;
  const topicCount = artifacts.routes.reduce((sum, route) => sum + route.topicInventory.topics.length, 0);
  const bookCount = artifacts.routes.reduce((sum, route) => sum + route.bookInventory.books.length, 0);
  const outcomeAlignments = artifacts.routes.flatMap((route) => route.officialMap.outcomes.map((outcome) => outcome.source_alignment));
  const projectAlignments = artifacts.programme.projects.projects.flatMap((project) => project.source_alignments);
  const alignmentCounts = (alignments) => Object.fromEntries(
    ['verified', 'partial', 'ambiguous', 'missing'].map((status) => [
      status,
      alignments.filter((alignment) => alignment.status === status).length,
    ]),
  );
  const outcomeCounts = alignmentCounts(outcomeAlignments);
  const projectCounts = alignmentCounts(projectAlignments);
  const unverifiedProgrammeBooks = artifacts.routes.flatMap((route) => route.bookInventory.books)
    .filter((book) => book.programme_type === 'unknown').length;
  return `# Grade 4 course architecture

This deterministic architecture covers the ${routeIndex.routes.length} canonical Grade 4 routes and
${routeIndex.canonical_record_total} route-bounded source records. It is a planning and evidence layer, not
publication-ready teaching content.

## Learner profile

Russian is the primary explanation language. The default Estonian route is
\`grade-4-estonian-second-language\` at approximately A1–A2. First-language Estonian is an explicit alternative;
the two simplified routes require learner-specific opt-in.

## Evidence inventory

* ${routeIndex.live_student_kit_count} reconciled canonical student kits;
* ${bookCount} route-bounded book/edition entries;
* ${topicCount} route-local topic clusters preserving all source records and direct URLs;
* ${coverage.rows.length} Grade 4-relevant official outcome rows;
* ${projectCount} cross-subject project modules with separate individual evidence.

The authored policy at \`${topicAlignmentPolicyPath}\` selects source topics by stable record identity rather than
array position. Outcome mappings are ${outcomeCounts.verified} verified, ${outcomeCounts.partial} partial,
${outcomeCounts.ambiguous} ambiguous and ${outcomeCounts.missing} missing. Project-role mappings are
${projectCounts.verified} verified, ${projectCounts.partial} partial, ${projectCounts.ambiguous} ambiguous and
${projectCounts.missing} missing; each missing role is an explicit clean-room bridge requirement.

Ordinary outcomes retain school-stage-II scope and are only recommended Grade 4 allocations. Only the two
simplified-curriculum outcomes retain verified exact Grade 4 scope. Russian and Russian reading, first-language
and second-language Estonian, ordinary and simplified routes remain separate.

## Delivery and companion boundary

The planned commercial core must work without Opiq. Companion candidates are internal-only, access-unverified
references with a mandatory standalone fallback. Teacher-only resources are excluded.

${unverifiedProgrammeBooks} book/edition records have an unknown programme type. They remain usable for internal
source analysis and as curated companion candidates, but \`ordinary_default_use\` is false until programme
membership is verified. The machine-readable release blocker is
\`default_core_programme_type_unverified\`.

## Gaps and release status

Art, technology/craft/home economics and physical education have no exclusive Grade 4 manifest route. Complete
page prose and task bodies were not captured, so authored lessons and assessment materials remain future clean-room
work. Completeness is **partial** and the commercial release gate is **blocked**. This architecture does not claim
official exact-grade ordinary outcomes, curriculum completeness, publication/classroom readiness, or pedagogical
effectiveness.
`;
}

export function renderGradeProgrammeTemplate() {
  return `# Grade programme template

Use \`schemas/grade-programme.schema.json\`, \`schemas/grade-programme-route.schema.json\`, and
\`schemas/grade-programme-coverage.schema.json\`. Source-topic mappings must also use the authored policy contract
in \`schemas/grade-programme-topic-alignment.schema.json\`. A programme must keep manifest routes, official scopes,
curated allocations, source evidence, delivery policy and release claims separate.

Required design order:

1. pin authoritative manifest and regulatory inputs;
2. generate route-bounded curriculum, book, topic and coverage artifacts;
3. author stable topic alignments by source record ID or original-heading key, never array position;
4. keep programme-policy outcomes separate from source-topic evidence;
5. declare default, alternative and learner-specific route roles;
6. block ordinary-default source eligibility while programme type is unknown;
7. plan mastery strands before cross-subject projects;
8. preserve separate individual evidence and explicit missing source roles in every shared project;
9. label lesson ranges as recommendations rather than national timetable requirements;
10. keep optional companions internal and unverified until the standalone fallback and access contract are complete;
11. keep completeness partial and release blocked while source, authoring or validation gaps remain.
`;
}

export async function loadGrade4CourseArchitectureInputs(rootDir) {
  const [manifest, outcomeIndex, framework, sourceRegistry, contentQuality, sourceGap, alignmentPolicy, model] = await Promise.all([
    readFile(path.join(rootDir, 'source-manifest.json'), 'utf8').then(JSON.parse),
    readFile(path.join(rootDir, outcomeIndexPath), 'utf8').then((value) => YAML.parse(value, { uniqueKeys: true })),
    readFile(path.join(rootDir, frameworkPath), 'utf8').then((value) => YAML.parse(value, { uniqueKeys: true })),
    readFile(path.join(rootDir, sourceRegistryPath), 'utf8').then((value) => YAML.parse(value, { uniqueKeys: true })),
    readFile(path.join(rootDir, contentQualityPath), 'utf8').then(JSON.parse),
    readFile(path.join(rootDir, sourceGapPath), 'utf8').then(JSON.parse),
    readFile(path.join(rootDir, topicAlignmentPolicyPath), 'utf8').then((value) => YAML.parse(value, { uniqueKeys: true })),
    loadGrade4CanonicalSourceModel(rootDir),
  ]);
  validateGrade4Manifest(manifest);
  return { rootDir, manifest, outcomeIndex, framework, sourceRegistry, contentQuality, sourceGap, alignmentPolicy, model };
}

export function buildGrade4CourseArchitecture(inputs) {
  const allFrameworkOutcomes = frameworkOutcomes(inputs.framework);
  const outcomeById = new Map(allFrameworkOutcomes.map((outcome) => [outcome.outcome_or_requirement_id, outcome]));
  const routeArtifacts = inputs.model.routes.map((routeModel) => {
    const bookInventory = buildBookInventory(routeModel);
    const topicInventory = buildTopicInventory(routeModel);
    const officialMap = buildOfficialMap(routeModel, outcomeById, topicInventory, inputs.alignmentPolicy);
    const coverage = buildRouteCoverage(routeModel, officialMap, outcomeById);
    return { routeModel, officialMap, bookInventory, topicInventory, coverage };
  });
  const routeIndex = buildRouteIndex(routeArtifacts, inputs.sourceGap);
  const mastery = buildMastery();
  const projects = buildProjects(routeArtifacts, inputs.alignmentPolicy);
  const language = buildLanguage();
  const calendar = buildCalendar(projects);
  const roadmap = buildRoadmap();
  const coverage = buildProgrammeCoverage(allFrameworkOutcomes, routeArtifacts, inputs.alignmentPolicy);
  const architecture = buildArchitecture(routeArtifacts);
  const programme = { architecture, routeIndex, coverage, projects, mastery, language, calendar, roadmap };
  const artifacts = { inputs, routes: routeArtifacts, programme };
  const files = new Map();
  for (const route of routeArtifacts) {
    const directory = routeDir(route.routeModel.definition.id);
    files.set(`${directory}/official-curriculum.yaml`, stableYaml(route.officialMap));
    files.set(`${directory}/book-inventory.yaml`, stableYaml(route.bookInventory));
    files.set(`${directory}/topic-inventory.yaml`, stableYaml(route.topicInventory));
    files.set(`${directory}/coverage-matrix.yaml`, stableYaml(route.coverage));
  }
  files.set(`${programmeDirectory}/programme-architecture.yaml`, stableYaml(architecture));
  files.set(`${programmeDirectory}/route-index.yaml`, stableYaml(routeIndex));
  files.set(`${programmeDirectory}/programme-coverage.yaml`, stableYaml(coverage));
  files.set(`${programmeDirectory}/project-modules.yaml`, stableYaml(projects));
  files.set(`${programmeDirectory}/mastery-strands.yaml`, stableYaml(mastery));
  files.set(`${programmeDirectory}/language-progression.yaml`, stableYaml(language));
  files.set(`${programmeDirectory}/teaching-calendar.yaml`, stableYaml(calendar));
  files.set(`${programmeDirectory}/implementation-roadmap.yaml`, stableYaml(roadmap));
  files.set(architectureDocPath, buildDocs(artifacts));
  files.set(programmeTemplatePath, renderGradeProgrammeTemplate());
  return { ...artifacts, files };
}

function diagnostic(code, message, artifactPath = `${programmeDirectory}/programme-architecture.yaml`, recordId = programmeId) {
  return { code, message, artifact_path: artifactPath, record_id: recordId };
}

function sameStableValue(left, right) {
  return JSON.stringify(stableClone(left)) === JSON.stringify(stableClone(right));
}

function policyEntryKeys(entries, fields) {
  return entries.map((entry) => fields.map((field) => entry[field]).join('\0')).sort(bytewise);
}

export function validateGrade4CourseArchitecture(artifacts) {
  const diagnostics = [];
  const { inputs, routes, programme } = artifacts;
  const alignmentPolicy = inputs.alignmentPolicy;
  const expectedRoutes = grade4RoutePolicy.map((route) => route.id);
  const actualRoutes = routes.map((route) => route.routeModel.definition.id);
  if (JSON.stringify(actualRoutes) !== JSON.stringify(expectedRoutes)) diagnostics.push(diagnostic('grade_4_route_set_mismatch', 'Route set differs from the Grade 4 manifest policy.'));
  if (routes.reduce((sum, route) => sum + route.bookInventory.source_records.length, 0) !== 2212) diagnostics.push(diagnostic('canonical_record_total_mismatch', 'Canonical record total must equal 2212.'));
  for (const route of routes) {
    const id = route.routeModel.definition.id;
    const manifestRoute = inputs.manifest.sources.find((source) => source.id === id);
    if (!manifestRoute) diagnostics.push(diagnostic('unknown_grade_4_route', `${id} is not a Grade 4 manifest route.`));
    if (route.routeModel.definition.grade !== 4 || route.bookInventory.source_records.some((record) => !record.record_id.startsWith('grade-4-'))) diagnostics.push(diagnostic('adjacent_grade_source_forbidden', `${id} includes an adjacent-grade source.`));
    if (manifestRoute && route.bookInventory.canonical_route.md_path !== manifestRoute.md_path) diagnostics.push(diagnostic('route_md_path_mismatch', `${id} uses the wrong md_path.`));
    if (route.bookInventory.record_count !== route.bookInventory.source_records.length || route.bookInventory.record_count !== route.routeModel.definition.expected_record_count) diagnostics.push(diagnostic('route_record_count_mismatch', `${id} record count does not reconcile.`));
    if (route.bookInventory.books.some((book) => book.full_prose_available !== false)) diagnostics.push(diagnostic('missing_prose_marked_ready', `${id} cannot claim complete prose.`));
    if (route.coverage.rows.some((row) => row.full_prose_status === 'missing' && row.lesson_authoring_status !== 'not_started')) diagnostics.push(diagnostic('missing_prose_marked_lesson_ready', `${id} marks a missing-prose row lesson-ready.`));
    if (route.coverage.rows.some((row) => row.task_evidence_status !== 'linked' && row.assessment_evidence_status === 'partial')) diagnostics.push(diagnostic('missing_tasks_marked_assessment_ready', `${id} marks absent task evidence assessment-ready.`));
    if (route.topicInventory.topics.some((topic) => topic.automatic_translated_topics_used_as_source_prose)) diagnostics.push(diagnostic('translated_query_metadata_used_as_prose', `${id} uses translated query metadata as source prose.`));
    for (const book of route.bookInventory.books) {
      if (book.programme_type === 'unknown' && book.eligibility.ordinary_default_use) {
        diagnostics.push(diagnostic('unknown_programme_type_marked_ordinary_default', `${id} kit ${book.kit_id} has unknown programme type and cannot be ordinary-default eligible.`));
      }
      if (book.programme_type === 'unknown' && !book.eligibility.programme_verification_required) {
        diagnostics.push(diagnostic('unknown_programme_type_verification_not_required', `${id} kit ${book.kit_id} must require programme verification.`));
      }
      if (book.programme_type === 'unknown' && book.programme_type_evidence.status !== 'ambiguous') {
        diagnostics.push(diagnostic('unknown_programme_type_evidence_mismatch', `${id} kit ${book.kit_id} cannot convert unknown programme type into verified evidence.`));
      }
      if (['mixed_subject', 'simplified_curriculum'].includes(book.programme_type) && book.eligibility.ordinary_default_use) {
        diagnostics.push(diagnostic('nonordinary_programme_marked_ordinary_default', `${id} kit ${book.kit_id} cannot be ordinary-default eligible.`));
      }
    }
    for (const outcome of route.officialMap.outcomes) {
      const indexed = inputs.outcomeIndex.outcomes.find((entry) => entry.outcome_id === outcome.outcome_id);
      if (!indexed) diagnostics.push(diagnostic('unknown_official_outcome', `${id} references unknown outcome ${outcome.outcome_id}.`));
      if (outcome.official_scope.kind === 'school_stage' && outcome.official_scope.exact_grade_claimed) diagnostics.push(diagnostic('school_stage_marked_exact_grade', `${outcome.outcome_id} falsely claims exact Grade 4 scope.`));
      if (outcome.official_scope.kind === 'exact_grade' && outcome.curriculum !== 'simplified') diagnostics.push(diagnostic('exact_simplified_outcome_marked_ordinary', `${outcome.outcome_id} is exact-grade but not simplified.`));
    }
    if (id === 'grade-4-human-studies-and-society' && JSON.stringify(route.officialMap.official_fields) !== JSON.stringify(['inimeseõpetus', 'ühiskonnaõpetus'])) diagnostics.push(diagnostic('mixed_official_fields_collapsed', 'Mixed human/society route must preserve two official fields.'));
  }
  const expectedOutcomeAlignmentKeys = Object.entries(routeOutcomeIds)
    .flatMap(([routeId, outcomeIds]) => outcomeIds.map((outcomeId) => `${routeId}\0${outcomeId}`))
    .sort(bytewise);
  const actualOutcomeAlignmentKeys = policyEntryKeys(alignmentPolicy.outcome_alignments, ['route_id', 'outcome_id']);
  if (!sameStableValue(actualOutcomeAlignmentKeys, expectedOutcomeAlignmentKeys)) {
    diagnostics.push(diagnostic('topic_alignment_policy_missing', 'The authored policy must contain exactly one alignment for every route outcome.', topicAlignmentPolicyPath, 'outcome-alignments'));
  }
  const expectedProgrammeAlignmentKeys = [...commonOutcomeIds].sort(bytewise);
  const actualProgrammeAlignmentKeys = policyEntryKeys(alignmentPolicy.programme_policy_alignments, ['outcome_id']);
  if (!sameStableValue(actualProgrammeAlignmentKeys, expectedProgrammeAlignmentKeys)) {
    diagnostics.push(diagnostic('programme_policy_alignment_missing', 'The authored policy must contain exactly one programme-policy alignment for every common outcome.', topicAlignmentPolicyPath, 'programme-policy-alignments'));
  }
  const projectIdsAndRoutes = programme.projects.projects.flatMap((project) => (
    project.linked_route_ids.map((routeId) => `${project.project_id}\0${routeId}`)
  )).sort(bytewise);
  const policyProjectKeys = policyEntryKeys(alignmentPolicy.project_alignments, ['project_id', 'route_id']);
  if (!sameStableValue(projectIdsAndRoutes, policyProjectKeys)) {
    diagnostics.push(diagnostic('project_alignment_missing', 'Every project route role must have exactly one authored source alignment.', topicAlignmentPolicyPath, 'project-alignments'));
  }
  const policyIds = [
    ...alignmentPolicy.outcome_alignments,
    ...alignmentPolicy.programme_policy_alignments,
    ...alignmentPolicy.project_alignments,
  ].map((entry) => entry.alignment_id);
  if (new Set(policyIds).size !== policyIds.length) {
    diagnostics.push(diagnostic('duplicate_topic_alignment_id', 'Topic-alignment policy IDs must be globally unique.', topicAlignmentPolicyPath, 'topic-alignment-policy'));
  }
  for (const entry of [...alignmentPolicy.outcome_alignments, ...alignmentPolicy.project_alignments]) {
    const route = routes.find((candidate) => candidate.routeModel.definition.id === entry.route_id);
    if (!route) {
      diagnostics.push(diagnostic('topic_alignment_route_unknown', `${entry.alignment_id} references unknown route ${entry.route_id}.`, topicAlignmentPolicyPath, entry.alignment_id));
      continue;
    }
    const availableRecordIds = new Set(route.bookInventory.source_records.map((record) => record.record_id));
    const topicRecordIds = new Set(route.topicInventory.topics.flatMap((topic) => topic.source_record_ids));
    const selectedRecordIds = new Set();
    for (const selector of entry.topic_selectors) {
      if (selector.source_record_id) {
        if (!availableRecordIds.has(selector.source_record_id) || !topicRecordIds.has(selector.source_record_id)) {
          diagnostics.push(diagnostic('topic_alignment_source_record_unknown', `${entry.alignment_id} references a source record outside ${entry.route_id}.`, topicAlignmentPolicyPath, entry.alignment_id));
        } else selectedRecordIds.add(selector.source_record_id);
      } else {
        const topic = route.topicInventory.topics.find((candidate) => candidate.original_heading_key === selector.original_heading_key);
        if (!topic) diagnostics.push(diagnostic('topic_alignment_heading_unknown', `${entry.alignment_id} references an unknown original heading key.`, topicAlignmentPolicyPath, entry.alignment_id));
        else for (const sourceRecordId of topic.source_record_ids) selectedRecordIds.add(sourceRecordId);
      }
    }
    if (entry.confidence === 'ambiguous' && entry.topic_selectors.length > 0 && entry.task_evidence.status === 'linked') {
      diagnostics.push(diagnostic('ambiguous_alignment_marked_verified', `${entry.alignment_id} cannot use linked task evidence as verified coverage while confidence is ambiguous.`, topicAlignmentPolicyPath, entry.alignment_id));
    }
    for (const taskRecordId of entry.task_evidence.source_record_ids) {
      const canonicalRecord = route.routeModel.canonical_records.find((record) => recordId(entry.route_id, record) === taskRecordId);
      if (!selectedRecordIds.has(taskRecordId) || !canonicalRecord || canonicalRecord.task_examples.length === 0) {
        diagnostics.push(diagnostic('topic_alignment_task_evidence_unlinked', `${entry.alignment_id} task evidence must be captured on an explicitly aligned source record.`, topicAlignmentPolicyPath, entry.alignment_id));
      }
    }
  }
  for (const route of routes) {
    for (const outcome of route.officialMap.outcomes) {
      const expected = resolveOutcomeAlignment(
        alignmentPolicy,
        route.routeModel,
        route.topicInventory,
        outcome.outcome_id,
      );
      if (!sameStableValue(outcome.source_alignment, expected)) {
        diagnostics.push(diagnostic('topic_alignment_generated_mismatch', `${outcome.outcome_id} does not match its authored alignment policy.`, `${routeDir(route.routeModel.definition.id)}/official-curriculum.yaml`, outcome.outcome_id));
      }
      const coverageRow = route.coverage.rows.find((row) => row.outcome_id === outcome.outcome_id);
      if (!coverageRow || !sameStableValue(coverageRow.source_alignment, expected) || !sameStableValue(coverageRow.topic_cluster_refs, expected.topic_cluster_refs)) {
        diagnostics.push(diagnostic('coverage_alignment_generated_mismatch', `${outcome.outcome_id} coverage does not match its authored alignment policy.`, `${routeDir(route.routeModel.definition.id)}/coverage-matrix.yaml`, outcome.outcome_id));
      }
    }
  }
  for (const project of programme.projects.projects) {
    for (const routeId of project.linked_route_ids) {
      const route = routes.find((candidate) => candidate.routeModel.definition.id === routeId);
      const entry = alignmentPolicy.project_alignments.find((candidate) => candidate.project_id === project.project_id && candidate.route_id === routeId);
      if (!route) continue;
      const resolved = resolvePolicySourceAlignment(entry, route.routeModel, route.topicInventory);
      const { evidence_layer: unusedEvidenceLayer, ...expected } = resolved;
      const actual = project.source_alignments.find((alignment) => alignment.route_id === routeId);
      if (!actual || !sameStableValue(actual, { route_id: routeId, ...expected })) {
        diagnostics.push(diagnostic('project_alignment_generated_mismatch', `${project.project_id} route ${routeId} does not match its authored policy.`, `${programmeDirectory}/project-modules.yaml`, `${project.project_id}-${routeId}`));
      }
    }
    const expectedTopicRefs = [...new Set(project.source_alignments.flatMap((alignment) => alignment.topic_cluster_refs))].sort(bytewise);
    if (!sameStableValue(project.topic_cluster_refs, expectedTopicRefs)) {
      diagnostics.push(diagnostic('project_topic_refs_untraceable', `${project.project_id} topic refs must be the closure of its source alignments.`, `${programmeDirectory}/project-modules.yaml`, project.project_id));
    }
  }
  const mixedRoute = routes.find((route) => route.routeModel.definition.id === 'grade-4-human-studies-and-society');
  if (mixedRoute) {
    const [human, social] = mixedRoute.officialMap.outcomes;
    if (human && social && sameStableValue(human.source_alignment.topic_cluster_refs, social.source_alignment.topic_cluster_refs)) {
      diagnostics.push(diagnostic('mixed_route_alignment_collapsed', 'Human-studies and social-studies outcomes need separate authored topic evidence.', `${routeDir(mixedRoute.routeModel.definition.id)}/official-curriculum.yaml`, mixedRoute.routeModel.definition.id));
    }
  }
  for (const row of programme.coverage.rows) {
    let expectedAlignment;
    const route = routes.find((candidate) => candidate.officialMap.outcomes.some((outcome) => outcome.outcome_id === row.outcome_id));
    if (route) {
      expectedAlignment = route.officialMap.outcomes.find((outcome) => outcome.outcome_id === row.outcome_id).source_alignment;
    } else if (commonOutcomeIds.includes(row.outcome_id)) {
      expectedAlignment = programmePolicySourceAlignment(
        alignmentPolicy.programme_policy_alignments.find((entry) => entry.outcome_id === row.outcome_id),
      );
    } else {
      expectedAlignment = missingSourceAlignment(
        `missing-${row.outcome_id}`,
        'missing_route',
        'No exclusive Grade 4 manifest route exists for this official field.',
      );
    }
    if (!sameStableValue(row.source_alignment, expectedAlignment)
        || !sameStableValue(row.topic_cluster_refs, expectedAlignment.topic_cluster_refs)) {
      diagnostics.push(diagnostic('programme_coverage_alignment_mismatch', `${row.outcome_id} does not match its authored source or programme-policy alignment.`, `${programmeDirectory}/programme-coverage.yaml`, row.outcome_id));
    }
  }
  const architecture = programme.architecture;
  if (architecture.learner_profile.estonian_subject_route !== 'grade-4-estonian-second-language') diagnostics.push(diagnostic('wrong_default_estonian_route', 'First-language Estonian cannot replace the default second-language route.'));
  if (!architecture.route_strands.some((route) => route.route_id === 'grade-4-russian') || !architecture.route_strands.some((route) => route.route_id === 'grade-4-russian-reading')) diagnostics.push(diagnostic('russian_routes_merged', 'Russian and Russian reading must remain separate.'));
  if (architecture.route_strands.filter((route) => simplifiedRouteIds.includes(route.route_id)).some((route) => route.programme_role !== 'learner_specific_simplified')) diagnostics.push(diagnostic('simplified_route_in_default_core', 'Simplified routes require learner-specific opt-in.'));
  if (programme.projects.principle !== 'projects_apply_but_do_not_replace_mastery_strands' || programme.mastery.mastery_strands.length < 5) diagnostics.push(diagnostic('project_replaces_mastery', 'Projects cannot replace required mastery strands.'));
  if (programme.projects.projects.some((project) => !project.individual_grade_4_evidence)) diagnostics.push(diagnostic('shared_product_replaces_individual_evidence', 'Every project requires individual Grade 4 evidence.'));
  if (programme.routeIndex.routes.some((route) => route.companion_candidates.some((candidate) => candidate.customer_visible && candidate.access.mode === 'unverified'))) diagnostics.push(diagnostic('unverified_companion_customer_visible', 'Unverified Opiq companion cannot be customer-visible.'));
  if (programme.routeIndex.routes.some((route) => route.companion_candidates.some((candidate) => candidate.teacher_only))) diagnostics.push(diagnostic('teacher_only_source_presented_to_pupil', 'Teacher-only source cannot be a pupil companion.'));
  if (programme.routeIndex.routes.some((route) => route.companion_candidates.some((candidate) => !candidate.standalone_fallback_required))) diagnostics.push(diagnostic('companion_fallback_missing', 'Every optional companion requires a standalone fallback.'));
  if (JSON.stringify(architecture.official_field_gaps.map((gap) => gap.field_id)) !== JSON.stringify(missingFields)) diagnostics.push(diagnostic('missing_official_field_gaps', 'Art, technology and physical-education gaps must remain explicit.'));
  if (architecture.completeness.declared_complete || programme.coverage.completeness.declared_complete) diagnostics.push(diagnostic('false_completeness_claim', 'Grade 4 architecture must remain incomplete.'));
  if (architecture.release_gate.publication_ready || architecture.delivery_model.publication_status !== 'internal_review') diagnostics.push(diagnostic('publication_readiness_claim_forbidden', 'Architecture cannot claim publication readiness.'));
  if (routes.some((route) => route.bookInventory.books.some((book) => book.programme_type === 'unknown'))
      && architecture.release_gate.status !== 'blocked') {
    diagnostics.push(diagnostic('ambiguous_programme_evidence_marked_release_ready', 'Unknown programme-type evidence requires a blocked release gate.'));
  }
  if (!architecture.release_gate.blocker_codes.includes('default_core_programme_type_unverified')
      || !programme.roadmap.release_blocker_codes.includes('default_core_programme_type_unverified')) {
    diagnostics.push(diagnostic('default_core_programme_type_blocker_missing', 'Release must remain blocked while default-core programme types are unverified.'));
  }
  if (programme.calendar.national_weekly_hours_claimed) diagnostics.push(diagnostic('unsupported_weekly_hours_claim', 'No national weekly-hour claim is supported.'));
  if (inputs.sourceGap.summary.canonical_student_kits !== 31 || inputs.sourceGap.summary.new_exact_grade_4_student_candidates !== 0) diagnostics.push(diagnostic('catalogue_reconciliation_mismatch', 'Live Grade 4 kit accounting changed.'));
  if (programme.routeIndex.simplified_route_count !== 2 || programme.routeIndex.mixed_route_count !== 1) diagnostics.push(diagnostic('programme_route_classification_mismatch', 'Expected two simplified routes and one mixed route.'));
  if (programme.coverage.rows.some((row) => ['heading_only', 'metadata_only', 'ambiguous'].includes(row.source_topic_presence) && row.coverage_status === 'verified')) diagnostics.push(diagnostic('heading_only_marked_full_coverage', 'Incomplete topic evidence cannot prove full coverage.'));
  return diagnostics.sort((left, right) => bytewise(`${left.artifact_path}\0${left.record_id}\0${left.code}`, `${right.artifact_path}\0${right.record_id}\0${right.code}`));
}

export async function validateGrade4CourseArchitectureSchemas(rootDir, artifacts) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  const [programmeSchema, routeSchema, coverageSchema, topicAlignmentSchema] = await Promise.all(
    [architectureSchemaPath, routeSchemaPath, coverageSchemaPath, topicAlignmentSchemaPath].map((schemaPath) => (
      readFile(path.join(rootDir, schemaPath), 'utf8').then(JSON.parse)
    )),
  );
  const validateProgramme = ajv.compile(programmeSchema);
  const validateRoute = ajv.compile(routeSchema);
  const validateCoverage = ajv.compile(coverageSchema);
  const validateTopicAlignment = ajv.compile(topicAlignmentSchema);
  const failures = [];
  for (const [label, value, validate] of [
    ['inputs/topic-alignment-policy', artifacts.inputs.alignmentPolicy, validateTopicAlignment],
    ...artifacts.routes.flatMap((route) => [
      [`${route.routeModel.definition.id}/official`, route.officialMap, validateRoute],
      [`${route.routeModel.definition.id}/books`, route.bookInventory, validateRoute],
      [`${route.routeModel.definition.id}/topics`, route.topicInventory, validateRoute],
      [`${route.routeModel.definition.id}/coverage`, route.coverage, validateCoverage],
    ]),
    ['programme/architecture', artifacts.programme.architecture, validateProgramme],
    ['programme/route-index', artifacts.programme.routeIndex, validateProgramme],
    ['programme/coverage', artifacts.programme.coverage, validateCoverage],
    ['programme/projects', artifacts.programme.projects, validateProgramme],
    ['programme/mastery', artifacts.programme.mastery, validateProgramme],
    ['programme/language', artifacts.programme.language, validateProgramme],
    ['programme/calendar', artifacts.programme.calendar, validateProgramme],
    ['programme/roadmap', artifacts.programme.roadmap, validateProgramme],
  ]) {
    if (!validate(value)) failures.push(`${label}: ${ajv.errorsText(validate.errors, { separator: '; ' })}`);
  }
  return failures;
}

export async function buildGrade4CourseArchitectureArtifacts(rootDir) {
  const inputs = await loadGrade4CourseArchitectureInputs(rootDir);
  return buildGrade4CourseArchitecture(inputs);
}

export async function checkGrade4CourseArchitectureFiles(rootDir, artifacts) {
  const diagnostics = [];
  for (const [repositoryPath, expected] of artifacts.files) {
    const absolute = path.join(rootDir, repositoryPath);
    try {
      const stats = await lstat(absolute);
      if (stats.isSymbolicLink() || !stats.isFile()) {
        diagnostics.push(diagnostic('generated_artifact_not_regular_file', `${repositoryPath} must be a regular file.`, repositoryPath, repositoryPath));
        continue;
      }
      const actual = await readFile(absolute, 'utf8');
      if (actual !== expected) diagnostics.push(diagnostic('stale_generated_artifact', `${repositoryPath} is stale.`, repositoryPath, repositoryPath));
    } catch (error) {
      if (error.code === 'ENOENT') diagnostics.push(diagnostic('generated_artifact_missing', `${repositoryPath} is missing.`, repositoryPath, repositoryPath));
      else throw error;
    }
  }
  return diagnostics;
}

export async function writeGrade4CourseArchitectureFiles(rootDir, artifacts) {
  for (const [repositoryPath, contents] of artifacts.files) {
    const absolute = path.join(rootDir, repositoryPath);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, contents);
  }
}
