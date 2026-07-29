import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import Ajv2020 from 'ajv/dist/2020.js';
import YAML from 'yaml';

import {
  bytewise,
  grade2RouteIds,
  loadGrade2CanonicalSourceModel,
  validateGrade2Manifest,
} from './grade-2-canonical-sources.mjs';

export const architectureVersion = '1.0';
export const architectureVerificationDate = '2026-07-29';
export const programmeDirectory = 'grade-programmes/grade-2';
export const architectureSchemaPath = 'schemas/grade-2-programme.schema.json';
export const routeSchemaPath = 'schemas/grade-2-programme-route.schema.json';
export const coverageSchemaPath = 'schemas/grade-2-programme-coverage.schema.json';
export const topicAlignmentSchemaPath = 'schemas/grade-2-programme-topic-alignment.schema.json';
export const topicAlignmentPolicyPath = 'grade-programmes/grade-2/topic-alignment-policy.yaml';
export const architectureDocPath = 'docs/grade-2-course-architecture.md';
export const programmeId = 'grade-2-standalone-commercial-programme-2026-27';

const outcomeIndexPath = 'compliance/estonia/2026-27/outcome-index.yaml';
const frameworkPath = 'compliance/estonia/2026-27/curriculum-framework.yaml';
const sourceRegistryPath = 'external-sources/official/estonia/2026-27/source-registry.yaml';

const defaultRouteIds = Object.freeze([
  'grade-2-russian',
  'grade-2-estonian-second-language',
  'grade-2-mathematics',
  'grade-2-science',
  'grade-2-human-studies',
  'grade-2-arts-and-crafts',
  'grade-2-music',
]);
const alternativeRouteIds = Object.freeze(['grade-2-estonian']);
const mixedRouteIds = Object.freeze(['grade-2-nature-and-human-studies']);
const supplementaryRouteIds = Object.freeze([
  'grade-2-kodututarde-training',
  'grade-2-noorte-kotkaste-training',
]);
const simplifiedKitIds = Object.freeze(['272', '273', '274', '501', '286']);
const supplementaryKitIds = Object.freeze(['330', '200', '465', '593', '594']);
const missingFields = Object.freeze(['foreign_language', 'physical_education']);
const commonOutcomeIds = Object.freeze([
  'ee-prk-2026-stage1-assessment-formative',
  'ee-prk-2026-stage1-cross-curricular-learning',
  'ee-prk-2026-stage1-general-learning',
  'ee-prk-2026-stage1-school-curriculum-class-allocation',
]);
const ordinaryRouteIds = Object.freeze([...defaultRouteIds, ...alternativeRouteIds]);
const programmeOutcomeRouteIds = Object.freeze({
  'ee-prk-2026-stage1-assessment-formative': ordinaryRouteIds,
  'ee-prk-2026-stage1-cross-curricular-learning': ordinaryRouteIds,
  'ee-prk-2026-stage1-general-learning': ordinaryRouteIds,
  'ee-prk-2026-stage1-school-curriculum-class-allocation': ordinaryRouteIds,
});
const estonianTargetTermsByRoute = Object.freeze({
  'grade-2-russian': ['tekst', 'tegelane'],
  'grade-2-estonian-second-language': ['küsimus', 'vastus', 'juhis'],
  'grade-2-mathematics': ['arv', 'mõõt', 'tabel'],
  'grade-2-science': ['vaatlus', 'ilm', 'vesi'],
  'grade-2-human-studies': ['õigus', 'kohustus', 'turvalisus'],
  'grade-2-arts-and-crafts': ['värv', 'materjal', 'ohutu'],
  'grade-2-music': ['rütm', 'laul'],
});
const routeOutcomeIds = Object.freeze({
  'grade-2-estonian': ['ee-prk-2026-stage1-estonian-conscious-reading'],
  'grade-2-estonian-second-language': ['ee-prk-2026-stage1-estonian-second-language-instructions'],
  'grade-2-mathematics': ['ee-prk-2026-stage1-mathematics-real-life'],
  'grade-2-science': ['ee-prk-2026-stage1-natural-science-guided-inquiry'],
  'grade-2-human-studies': ['ee-prk-2026-stage1-human-studies-rights-duties'],
  'grade-2-nature-and-human-studies': [
    'ee-prk-2026-stage1-natural-science-guided-inquiry',
    'ee-prk-2026-stage1-human-studies-rights-duties',
  ],
  'grade-2-arts-and-crafts': [
    'ee-prk-2026-stage1-art-reflection',
    'ee-prk-2026-stage1-technology-safe-work',
  ],
  'grade-2-music': ['ee-prk-2026-stage1-music-active-participation'],
  'grade-2-kodututarde-training': [],
  'grade-2-noorte-kotkaste-training': [],
  'grade-2-russian': ['ee-prk-2026-stage1-russian-conscious-reading'],
});
const missingFieldOutcomes = Object.freeze({
  foreign_language: ['ee-prk-2026-stage1-foreign-language-a1'],
  physical_education: ['ee-prk-2026-stage1-physical-education-water-safety'],
});
const knownGaps = Object.freeze([
  'Final Riigi Teataja refresh remains tracked under issue #37.',
  'The official baseline is intentionally non-exhaustive outside its declared scope.',
  'Live Grade 2 Opiq catalogue completeness has not been verified.',
  'Complete Opiq instructional page prose was not captured.',
  'Task examples are missing for 1530 canonical records.',
  'An exclusive Grade 2 foreign-language route is missing.',
  'An exclusive Grade 2 physical-education route is missing.',
  'The independently authored standalone commercial core is not implemented.',
  'A clean-room task bank has not been implemented.',
  'Originality review is not yet applicable because production materials are absent.',
  'Customer companion access has not been verified.',
  'Pedagogical effectiveness has not been established.',
]);
const releaseBlockerCodes = Object.freeze([
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
const authoritativeInputs = Object.freeze([
  'source-manifest.json',
  'docs/audits/grade-2-complete-captured-catalog.md',
  'docs/audits/grade-2-content-quality.md',
  'docs/audits/grade-2-estonian-subject-separation.md',
  'docs/audits/grade-2-science-subject-separation.md',
  'docs/audits/grade-2-nature-and-human-studies-source-audit.md',
  'docs/audits/grade-2-arts-and-crafts-source-audit.md',
  'docs/audits/grade-2-music-source-audit.md',
  'docs/audits/grade-2-youth-training-source-audit.md',
  'docs/audits/grade-2-minu-vaike-kallis-planeet.md',
  'scripts/generate-grade-2-source-indexes.mjs',
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
  if (mixedRouteIds.includes(routeId)) return 'mixed_subject_support';
  return 'supplementary_youth_training';
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
    grade: 2,
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
      generated_by: 'scripts/generate-grade-2-course-architecture.mjs',
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
      allocation_basis: 'opiq_helper_recommended_allocation',
      grade_2_allocation_note: 'This is an Opiq Helper recommended Grade 2 allocation of a national stage-I endpoint; it is not an official exact-grade requirement.',
      source_alignment: resolveOutcomeAlignment(
        alignmentPolicy,
        routeModel,
        topicInventory,
        id,
      ),
    };
  });
  const officialFields = [...new Set(outcomes.map((outcome) => (
    routeModel.definition.id === 'grade-2-nature-and-human-studies'
      ? outcome.official_subject ?? outcome.subject_field
      : outcome.subject_field
  )))].sort(bytewise);
  return {
    ...routeCommon(routeModel, 'grade_programme_official_curriculum_map', 'official-curriculum'),
    regulatory_baseline_ref: outcomeIndexPath,
    official_scope: { kind: 'school_stage', school_stage: 1, terminal_grade: 3, exact_grade_claimed: false },
    official_fields: officialFields,
    outcomes,
    allocation_status: {
      national_exact_grade_claimed: false,
      curated_grade_2_allocation: 'opiq_helper_recommended_allocation',
      notes: 'National stage-I scope remains distinct from this recommended Grade 2 allocation.',
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
    const programmeType = first.programme_type;
    const simplified = programmeType === 'simplified_curriculum';
    const mixed = programmeType === 'mixed_subject';
    const supplementary = programmeType === 'supplementary';
    const ordinary = programmeType === 'ordinary_curriculum';
    const canonicalUrls = records.map((record) => record.url).sort(bytewise);
    const taskRecords = records.filter((record) => record.task_examples.length > 0);
    return {
      book_id: first.book_id,
      kit_id: first.kit_id,
      kit_url: `https://www.opiq.ee/Kit/Details/${first.kit_id}`,
      title: first.book,
      publisher: first.publisher || null,
      languages: [...new Set(records.map((record) => record.language))].sort(bytewise),
      programme_type: programmeType,
      programme_type_evidence: {
        status: 'verified',
        basis: simplified
          ? 'qa_book_metadata'
          : mixed
            ? 'qa_book_metadata'
            : supplementary
              ? 'qa_book_metadata'
              : 'qa_book_metadata',
        notes: simplified
          ? 'QA book metadata identifies this learner-specific simplified-curriculum source.'
          : mixed
            ? 'QA book metadata preserves this mixed nature/human-studies source without subject collapse.'
            : supplementary
              ? 'QA book metadata identifies this source as supplementary rather than ordinary core.'
              : 'QA book metadata identifies this book as an ordinary-curriculum source candidate.',
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
        curated_core_candidate: ordinary && defaultRouteIds.includes(routeModel.definition.id),
        ordinary_default_use: ordinary && defaultRouteIds.includes(routeModel.definition.id),
        programme_verification_required: false,
        learner_specific_simplified_use: simplified,
        supplementary_use: supplementary || supplementaryKitIds.includes(first.kit_id),
        mixed_subject_use: mixed,
        youth_training_use: supplementaryRouteIds.includes(routeModel.definition.id),
        customer_visibility: 'internal_only',
        access_verification_required: true,
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
  const headingKey = value.normalize('NFKC').toLocaleLowerCase('et').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
    || `source-${record.kit_id}-${record.url.split('/').at(-1)}`;
  return `${record.programme_type}\0${headingKey}`;
}

function buildTopicInventory(routeModel) {
  const groups = new Map();
  for (const record of routeModel.canonical_records) {
    const key = normalizedTopicKey(record) || `${record.kit_id}:${record.url}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  const topics = [...groups.entries()].sort(([a], [b]) => bytewise(a, b)).map(([key, records]) => {
    const first = records[0];
    const original = first.headings[0] || first.title;
    const originalHeadingKey = original.normalize('NFKC').toLocaleLowerCase('et').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
      || `source-${first.kit_id}-${first.url.split('/').at(-1)}`;
    const languages = [...new Set(records.map((record) => record.language))].sort(bytewise);
    const hasTasks = records.some((record) => record.task_examples.length > 0);
    const multipleKits = new Set(records.map((record) => record.kit_id)).size > 1;
    return {
      topic_id: stableId(`${routeModel.definition.id}-topic`, key),
      original_heading_key: originalHeadingKey,
      title_ru: languages.includes('ru') ? original : 'Русское название не подтверждено исходником',
      title_et: languages.includes('et') ? original : 'Eestikeelne pealkiri ei ole lähteandmetes kinnitatud',
      route_id: routeModel.definition.id,
      source_record_ids: records.map((record) => recordId(routeModel.definition.id, record)).sort(bytewise),
      canonical_urls: records.map((record) => record.url).sort(bytewise),
      kit_ids: [...new Set(records.map((record) => record.kit_id))].sort(bytewise),
      book_ids: [...new Set(records.map((record) => record.book_id))].sort(bytewise),
      source_languages: languages,
      source_headings: [...new Set(records.flatMap((record) => record.headings.length > 0 ? record.headings : [record.title]))].sort(bytewise),
      programme_types: [...new Set(records.map((record) => record.programme_type))].sort(bytewise),
      evidence_level: hasTasks ? 'heading_and_task_example' : 'heading_only',
      task_example_status: hasTasks ? 'partial_captured' : 'not_captured',
      full_prose_status: 'missing',
      edition_relationships: records.length === 1
        ? 'single_record_group'
        : multipleKits
          ? 'same_title_multiple_editions'
          : 'same_title_multiple_records',
      duplicate_group: stableId(`${routeModel.definition.id}-duplicate`, key),
      authoring_gap: hasTasks ? 'complete_prose_and_tasks_required' : 'complete_prose_and_tasks_required',
      automatic_translated_topics_used_as_source_prose: false,
      notes: 'Clustered only within this route from original headings; translated query metadata is not treated as source prose.',
    };
  });
  return {
    ...routeCommon(routeModel, 'grade_programme_topic_inventory', 'topic-inventory'),
    inventory_scope: 'route_bounded_original_headings_and_metadata',
    deduplication_policy: {
      normalization: 'nfc_casefold_whitespace_punctuation_programme_type',
      cross_route_deduplication: false,
      edition_policy: 'preserve_without_obsolescence_claim',
      source_record_preservation: 'all_records_retained',
    },
    topics,
  };
}

function buildTopicOutcomeCandidateIndex(topicInventory, officialMap) {
  const candidatesByTopicId = new Map(
    topicInventory.topics.map((topic) => [topic.topic_id, new Set()]),
  );
  for (const outcome of officialMap.outcomes) {
    for (const topicId of outcome.source_alignment.topic_cluster_refs) {
      const candidates = candidatesByTopicId.get(topicId);
      if (!candidates) {
        throw new Error(`${outcome.outcome_id}: resolved alignment references unknown topic ${topicId}.`);
      }
      candidates.add(outcome.outcome_id);
    }
  }
  return candidatesByTopicId;
}

function applyOfficialOutcomeCandidates(topicInventory, officialMap) {
  const candidatesByTopicId = buildTopicOutcomeCandidateIndex(topicInventory, officialMap);
  return {
    ...topicInventory,
    topics: topicInventory.topics.map((topic) => ({
      ...topic,
      official_outcome_candidates: [...candidatesByTopicId.get(topic.topic_id)].sort(bytewise),
    })),
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
  const topicsByHeadingKey = new Map();
  for (const topic of topicInventory.topics) {
    if (!topicsByHeadingKey.has(topic.original_heading_key)) topicsByHeadingKey.set(topic.original_heading_key, []);
    topicsByHeadingKey.get(topic.original_heading_key).push(topic);
  }
  const selectedTopics = [];
  const selectedRecordIds = new Set();
  for (const selector of entry.topic_selectors) {
    const topic = selector.source_record_id
      ? topicByRecordId.get(selector.source_record_id)
      : (() => {
        const matches = topicsByHeadingKey.get(selector.original_heading_key) ?? [];
        if (matches.length > 1) {
          throw new Error(`${entry.alignment_id}: heading selector ${selector.original_heading_key} is ambiguous across programme types; use source_record_id.`);
        }
        return matches[0];
      })();
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
    curated_grade_2_allocation: outcome.scope.kind === 'exact_grade'
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
      ? ['No exclusive Grade 2 manifest route exists for this official field.']
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
    grade: 2,
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
    generated_by: 'scripts/generate-grade-2-course-architecture.mjs',
    verification_date: architectureVerificationDate,
    claim_boundary: 'Recommended Grade 2 architecture; it is not a national exact-grade timetable, published course or effectiveness finding.',
  };
}

function commonProgramme(artifactType, artifactId) {
  return {
    schema_version: architectureVersion,
    artifact_type: artifactType,
    artifact_id: artifactId,
    programme_id: programmeId,
    grade: 2,
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

function buildRouteIndex(routeArtifacts) {
  return {
    ...commonProgramme('grade_programme_route_index', 'grade-2-route-index'),
    canonical_record_total: 2483,
    book_variant_count: routeArtifacts.reduce((sum, route) => sum + route.bookInventory.books.length, 0),
    simplified_route_count: 0,
    simplified_book_count: simplifiedKitIds.length,
    mixed_route_count: 1,
    supplementary_route_count: supplementaryRouteIds.length,
    routes: routeArtifacts.map(({ routeModel, bookInventory }) => ({
      route_id: routeModel.definition.id,
      record_count: routeModel.definition.expected_record_count,
      kit_ids: routeModel.definition.included_kit_ids,
      programme_type: routeModel.definition.programme_type,
      programme_role: roleFor(routeModel.definition.id),
      md_path: routeModel.definition.output_path,
      route_directory: routeDir(routeModel.definition.id),
      companion_candidates: routeModel.definition.included_kit_ids.map((kitId) => ({
        ...(() => {
          const book = bookInventory.books.find((candidate) => candidate.kit_id === kitId);
          return {
            programme_type: book.programme_type,
            ordinary_default_eligible: book.eligibility.ordinary_default_use,
            learner_specific_opt_in_required: book.eligibility.learner_specific_simplified_use,
            supplementary_only: book.eligibility.supplementary_use,
            mixed_subject: book.eligibility.mixed_subject_use,
            youth_training: book.eligibility.youth_training_use,
          };
        })(),
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

function strand(routeId, cadence, skills, min, max, sourceKitIds, strandId = `${routeId}-mastery`) {
  return {
    strand_id: strandId,
    route_id: routeId,
    cadence,
    planning_basis: 'opiq_helper_recommendation_not_national_timetable',
    core_skills: skills,
    source_kit_ids: sourceKitIds,
    estonian_language_functions: ['name', 'describe', 'compare', 'sequence'],
    assessment_evidence: ['individual first attempt', 'correction after feedback'],
    revision_cycle: 'Immediate correction plus spaced revisit in a later programme period.',
    estimated_lesson_range: estimate(min, max, 'Range reflects source clusters and reserved authoring, revision, assessment and language-support work.'),
  };
}

function buildMastery() {
  return {
    ...commonProgramme('grade_programme_mastery_strands', 'grade-2-mastery-strands'),
    mastery_strands: [
      strand('grade-2-russian', 'daily_or_near_daily', ['language structures', 'written expression'], 55, 80, ['186', '292'], 'grade-2-russian-language-mastery'),
      strand('grade-2-russian', 'daily_or_near_daily', ['conscious reading', 'individual reading response'], 40, 65, ['454'], 'grade-2-russian-reading-mastery'),
      strand('grade-2-estonian-second-language', 'daily_or_near_daily', ['A1 core interaction', 'supported A1–A2 stretch production'], 70, 105, ['129']),
      strand('grade-2-mathematics', 'daily_or_near_daily', ['real-life mathematics', 'reasoning and correction'], 90, 130, ['95', '107', '165', '361', '578']),
    ],
    subject_strands: [
      strand('grade-2-science', 'regular_weekly', ['guided inquiry', 'observation and evidence'], 30, 50, ['121', '132', '379', '384', '387', '570']),
      strand('grade-2-human-studies', 'regular_weekly', ['rights and duties', 'safe participation'], 25, 40, ['56', '142', '229', '449', '494', '579']),
      strand('grade-2-arts-and-crafts', 'regular_weekly', ['art reflection', 'safe practical work'], 30, 50, ['192', '371']),
      strand('grade-2-music', 'regular_weekly', ['active participation', 'listening and rhythm'], 25, 40, ['188', '193', '238', '556']),
    ],
    missing_route_strands: [
      { strand_id: 'grade-2-foreign-language-gap', field_id: 'foreign_language', source_status: 'missing_route', content_strategy: 'school_specific_resource_required', release_status: 'blocked' },
      { strand_id: 'grade-2-physical-education-gap', field_id: 'physical_education', source_status: 'missing_route', content_strategy: 'school_specific_resource_required', release_status: 'blocked' },
    ],
    provenance: provenance(),
  };
}

function buildProjects(routeArtifacts, alignmentPolicy) {
  const base = [
    ['weather-water-safety', 'Погода, вода и безопасность', 'Ilm, vesi ja ohutus', 'Как наблюдать погоду и воду и принимать безопасные решения?', ['grade-2-science', 'grade-2-mathematics', 'grade-2-human-studies', 'grade-2-russian', 'grade-2-estonian-second-language'], ['ee-prk-2026-stage1-natural-science-guided-inquiry', 'ee-prk-2026-stage1-mathematics-real-life', 'ee-prk-2026-stage1-human-studies-rights-duties']],
    ['home-neighbourhood', 'Дом и окрестности', 'Kodu ja naabruskond', 'Как описать обязанности, место и безопасный маршрут?', ['grade-2-human-studies', 'grade-2-russian', 'grade-2-estonian-second-language'], ['ee-prk-2026-stage1-human-studies-rights-duties', 'ee-prk-2026-stage1-russian-conscious-reading']],
    ['measure-useful-object', 'Измеряем и создаём полезную вещь', 'Mõõdame ja loome kasuliku eseme', 'Как измерение и безопасная работа помогают создать полезную вещь?', ['grade-2-mathematics', 'grade-2-arts-and-crafts'], ['ee-prk-2026-stage1-mathematics-real-life', 'ee-prk-2026-stage1-technology-safe-work']],
    ['living-nature-nearby', 'Живая природа рядом', 'Elusloodus meie ümber', 'Как наблюдение помогает узнавать живую природу?', ['grade-2-science', 'grade-2-russian', 'grade-2-estonian-second-language'], ['ee-prk-2026-stage1-natural-science-guided-inquiry', 'ee-prk-2026-stage1-russian-conscious-reading']],
    ['stories-books-messages', 'Истории, книги и сообщения', 'Lood, raamatud ja sõnumid', 'Как понять и передать основную мысль короткого текста?', ['grade-2-russian', 'grade-2-estonian', 'grade-2-estonian-second-language'], ['ee-prk-2026-stage1-russian-conscious-reading', 'ee-prk-2026-stage1-estonian-conscious-reading']],
    ['rhythm-sound-celebration', 'Ритм, звук и праздник', 'Rütm, heli ja tähtpäev', 'Как ритм, песня и визуальный образ создают общее событие?', ['grade-2-music', 'grade-2-arts-and-crafts', 'grade-2-russian'], ['ee-prk-2026-stage1-music-active-participation', 'ee-prk-2026-stage1-art-reflection']],
    ['rights-duties-team', 'Права, обязанности и команда', 'Õigused, kohustused ja meeskond', 'Как договориться о правилах и показать личный вклад?', ['grade-2-human-studies', 'grade-2-russian', 'grade-2-estonian-second-language'], ['ee-prk-2026-stage1-human-studies-rights-duties', 'ee-prk-2026-stage1-general-learning']],
    ['responsible-everyday-choice', 'Ответственный повседневный выбор', 'Vastutustundlik igapäevane valik', 'Как наблюдения, числа и материалы помогают сделать ответственный выбор?', ['grade-2-science', 'grade-2-mathematics', 'grade-2-arts-and-crafts'], ['ee-prk-2026-stage1-cross-curricular-learning', 'ee-prk-2026-stage1-mathematics-real-life']],
  ];
  return {
    ...commonProgramme('grade_programme_project_modules', 'grade-2-project-modules'),
    principle: 'projects_apply_but_do_not_replace_mastery_strands',
    projects: base.map(([id, ru, et, question, routes, outcomes], index) => {
      const projectId = `grade-2-project-${id}`;
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
        prerequisites: index === 0 ? [] : [`grade-2-project-${base[index - 1][0]}`],
        estimated_lesson_range: estimate(3, 6, 'Architecture estimate includes individual Grade 2 evidence, practical application and separate language checks.'),
        shared_product: 'A bounded shared product assembled from separately attributable learner contributions.',
        individual_grade_2_evidence: 'An individual first attempt, explanation or reflection is retained for Grade 2 assessment.',
        russian_language_or_reading_evidence: 'Russian language or reading evidence is individually attributable without lowering subject demand.',
        estonian_language_evidence: 'A separate short supported Estonian A1–A2 production sample is retained.',
        mathematics_or_data_evidence: 'A table, representation or explicit not-applicable note is retained for each learner.',
        practical_or_outdoor_component: 'A safe observation, outdoor inquiry or simulated community application is planned.',
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
        pilot_candidate: projectId === 'grade-2-project-weather-water-safety'
          ? { issue: 40, status: 'architecture_ready' }
          : null,
      };
    }),
    provenance: provenance(),
  };
}

function buildLanguage() {
  return {
    ...commonProgramme('grade_programme_language_progression', 'grade-2-language-progression'),
    profile: { primary_explanation_language: 'ru', support_language: 'et', target_level: 'A1_core_with_A1_A2_stretch' },
    progression_stages: [
      { stage_id: 'terminology-recognition', focus: 'Recognise subject terminology and familiar instructions.', support_level: 'full_scaffold' },
      { stage_id: 'supported-naming-description', focus: 'Name and describe with a visible word bank and sentence frame.', support_level: 'partial_scaffold' },
      { stage_id: 'supported-comparison-sequence', focus: 'Compare and sequence in short supported utterances.', support_level: 'reduced_scaffold' },
      { stage_id: 'independent-short-production', focus: 'Give a short A1 oral or written answer, with A1–A2 stretch only where evidence supports it.', support_level: 'independent_short_production' },
    ],
    subject_strands: defaultRouteIds.map((routeId, index) => ({
      route_id: routeId,
      target_terms: estonianTargetTermsByRoute[routeId],
      instruction_verbs: ['Vaata', 'Nimeta', 'Kirjelda', 'Võrdle'],
      sentence_frames: ['Ma näen ___.', '___ on ___ kui ___.'],
      oral_output: 'One short supported subject-relevant answer.',
      written_output: 'One short labelled or framed statement.',
      support_level: index < 4 ? 'full_scaffold' : 'partial_scaffold',
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
    ...commonProgramme('grade_programme_teaching_calendar', 'grade-2-teaching-calendar'),
    planning_status: 'recommended_not_national_timetable',
    periods: [0, 1, 2, 3].map((period) => ({
      period_id: `programme-period-${period + 1}`,
      mastery_continues: true,
      project_ids: projectIds.slice(period * 2, period * 2 + 2),
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
    school_specific_placeholders: [
      {
        field_id: 'foreign_language',
        source_status: 'missing_route',
        activation: 'school_curriculum_dependent',
        release_status: 'blocked',
      },
      {
        field_id: 'physical_education',
        source_status: 'missing_route',
        activation: 'school_curriculum_dependent',
        release_status: 'blocked',
      },
    ],
    national_weekly_hours_claimed: false,
    provenance: provenance(),
  };
}

function buildRoadmap() {
  return {
    ...commonProgramme('grade_programme_implementation_roadmap', 'grade-2-implementation-roadmap'),
    status: 'architecture_only',
    stages: [
      { stage_id: 'architecture-and-evidence', status: 'complete', deliverables: ['route maps', 'source inventories', 'coverage and programme architecture'], entry_gate: 'Authoritative inputs validate.' },
      { stage_id: 'clean-room-authoring', status: 'not_started', deliverables: ['standalone explanations', 'tasks', 'answer evidence'], entry_gate: 'Architecture review and source-gap decisions are accepted.' },
      { stage_id: 'production-validation', status: 'blocked', deliverables: ['originality review', 'teacher review', 'classroom and home trials'], entry_gate: 'Production materials exist and pass structural validation.' },
    ],
    future_material_ids: ['grade-2-foreign-language-school-specific-core', 'grade-2-physical-education-school-specific-core'],
    release_blocker_codes: releaseBlockerCodes,
    release_blockers: knownGaps,
    non_goals: ['No full lessons are authored in this change.', 'No textbook prose or task body is reconstructed.', 'No publication or effectiveness status is granted.'],
    provenance: provenance(),
  };
}

function buildProgrammeCoverage(frameworkOutcomesList, routeArtifacts, alignmentPolicy) {
  const routeByOutcome = new Map(commonOutcomeIds.map((outcomeId) => [
    outcomeId,
    programmeOutcomeRouteIds[outcomeId],
  ]));
  for (const [routeId, outcomeIds] of Object.entries(routeOutcomeIds)) {
    for (const outcomeId of outcomeIds) {
      routeByOutcome.set(outcomeId, [...(routeByOutcome.get(outcomeId) ?? []), routeId]);
    }
  }
  const grade2Outcomes = frameworkOutcomesList.filter((outcome) => outcome.downstream_relevance.grade_2);
  const rows = grade2Outcomes.map((outcome) => {
    const routeIds = routeByOutcome.get(outcome.outcome_or_requirement_id) ?? [];
    const routeOutcome = routeArtifacts.find((entry) => (
      !mixedRouteIds.includes(entry.routeModel.definition.id)
      && entry.officialMap.outcomes.some((candidate) => candidate.outcome_id === outcome.outcome_or_requirement_id)
    )) ?? routeArtifacts.find((entry) => (
      entry.officialMap.outcomes.some((candidate) => candidate.outcome_id === outcome.outcome_or_requirement_id)
    ));
    let sourceAlignment;
    if (routeOutcome) {
      sourceAlignment = routeOutcome.officialMap.outcomes.find((entry) => (
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
        'No exclusive Grade 2 manifest route exists for this official field.',
      );
    }
    return buildCoverageRow(outcome, routeIds, sourceAlignment);
  });
  return {
    schema_version: architectureVersion,
    artifact_type: 'grade_programme_coverage_matrix',
    artifact_id: 'grade-2-programme-coverage',
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
    ...commonProgramme('grade_programme_architecture', 'grade-2-programme-architecture'),
    learner_profile: {
      primary_language: 'ru',
      subject_explanation_language: 'ru',
      subject_support_language: 'et',
      estonian_subject_route: 'grade-2-estonian-second-language',
      estonian_core_level: 'A1',
      estonian_stretch_level: 'A1-A2',
      first_language_estonian_route: 'grade-2-estonian',
      first_language_estonian_activation: 'explicit_profile_selection',
      foreign_language_status: 'school_curriculum_dependent',
    },
    alternative_profiles: [
      { profile_id: 'first-language-estonian-alternative', route_id: 'grade-2-estonian', activation: 'explicit_language_profile_selection' },
    ],
    learner_specific_book_profiles: simplifiedKitIds.map((kitId) => ({
      profile_id: `simplified-kit-${kitId}-opt-in`,
      kit_id: kitId,
      activation: 'learner_specific_simplified_opt_in',
    })),
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
      content_strategy: 'school_specific_resource_required',
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
  const alignedTopics = artifacts.routes.flatMap((route) => route.topicInventory.topics)
    .filter((topic) => topic.official_outcome_candidates.length > 0).length;
  return `# Grade 2 course architecture

This deterministic architecture covers the ${routeIndex.routes.length} canonical Grade 2 routes and
${routeIndex.canonical_record_total} route-bounded source records. It is a planning and evidence layer, not
publication-ready teaching content.

## Learner profile

Russian is the primary explanation language. The default Estonian route is
\`grade-2-estonian-second-language\`, with A1 as the core and A1–A2 only as a supported stretch.
First-language Estonian is an explicit alternative profile. Simplified books in kits
${simplifiedKitIds.join(', ')} require learner-specific opt-in and are never default route content.

## Evidence inventory

* ${routeIndex.book_variant_count} route-bounded book/kit variants;
* ${bookCount} route-bounded book/edition entries;
* ${topicCount} route-local topic clusters preserving all source records and direct URLs;
* ${alignedTopics} topic clusters selected by authored official-outcome alignments; every other topic has an explicit empty candidate list;
* ${coverage.rows.length} Grade 2-relevant official outcome rows;
* ${projectCount} cross-subject project modules with separate individual evidence.

The authored policy at \`${topicAlignmentPolicyPath}\` selects source topics by stable record identity rather than
array position. Outcome mappings are ${outcomeCounts.verified} verified, ${outcomeCounts.partial} partial,
${outcomeCounts.ambiguous} ambiguous and ${outcomeCounts.missing} missing. Project-role mappings are
${projectCounts.verified} verified, ${projectCounts.partial} partial, ${projectCounts.ambiguous} ambiguous and
${projectCounts.missing} missing; ambiguous and missing roles remain explicit clean-room bridge requirements.

All official outcomes retain school-stage-I scope with terminal Grade 3 and
\`exact_grade_claimed: false\`. Grade 2 allocation is an Opiq Helper recommendation, not a national exact-grade
claim. Russian language and reading are separate mastery/evidence strands inside the Russian route. First-language
and second-language Estonian remain separate routes. The mixed nature/human-studies route has independently
authored science and human-studies alignments. Youth-training routes remain supplementary and never substitute
for the ordinary core or physical education.

## Delivery and companion boundary

The planned commercial core must work without Opiq. All companion candidates are internal-only,
access-unverified references with a mandatory standalone fallback. Supplementary, mixed and simplified books
have separate eligibility flags and are not silently promoted to ordinary default use.

## Gaps and release status

Foreign language and physical education have no exclusive Grade 2 manifest route. Complete page prose and
1,530 task-example records are missing, so lessons, clean-room tasks and assessment materials remain future work.
The Weather, Water and Safety module is an architecture-only pilot for issue #40, not a production lesson.
Completeness is **partial** and the commercial release gate is **blocked**. This architecture does not claim
official exact-grade outcomes, curriculum completeness, publication/classroom readiness, or pedagogical
effectiveness.
`;
}

export function renderGradeProgrammeTemplate() {
  return `# Grade programme template

Use the grade-specific strict programme, route, coverage and authored-alignment schemas. A programme must keep manifest routes, official scopes,
curated allocations, source evidence, delivery policy and release claims separate.

Required design order:

1. pin authoritative manifest and regulatory inputs;
2. generate route-bounded curriculum, book, topic and coverage artifacts;
3. author stable topic alignments by source record ID or original-heading key, never array position;
4. keep programme-policy outcomes separate from source-topic evidence;
5. declare default, alternative and learner-specific route roles;
6. keep ordinary, simplified, supplementary, mixed and youth-training eligibility explicit;
7. plan mastery strands before cross-subject projects;
8. preserve separate individual evidence and explicit missing source roles in every shared project;
9. label lesson ranges as recommendations rather than national timetable requirements;
10. keep optional companions internal and unverified until the standalone fallback and access contract are complete;
11. keep completeness partial and release blocked while source, authoring or validation gaps remain.
`;
}

export async function loadGrade2CourseArchitectureInputs(rootDir) {
  const [manifest, outcomeIndex, framework, sourceRegistry, alignmentPolicy, model] = await Promise.all([
    readFile(path.join(rootDir, 'source-manifest.json'), 'utf8').then(JSON.parse),
    readFile(path.join(rootDir, outcomeIndexPath), 'utf8').then((value) => YAML.parse(value, { uniqueKeys: true })),
    readFile(path.join(rootDir, frameworkPath), 'utf8').then((value) => YAML.parse(value, { uniqueKeys: true })),
    readFile(path.join(rootDir, sourceRegistryPath), 'utf8').then((value) => YAML.parse(value, { uniqueKeys: true })),
    readFile(path.join(rootDir, topicAlignmentPolicyPath), 'utf8').then((value) => YAML.parse(value, { uniqueKeys: true })),
    loadGrade2CanonicalSourceModel(rootDir),
  ]);
  const manifestDiagnostics = validateGrade2Manifest(model);
  if (manifestDiagnostics.length > 0) {
    throw new Error(manifestDiagnostics.map((entry) => `${entry.code}: ${entry.message}`).join('\n'));
  }
  return { rootDir, manifest, outcomeIndex, framework, sourceRegistry, alignmentPolicy, model };
}

export function buildGrade2CourseArchitecture(inputs) {
  const allFrameworkOutcomes = frameworkOutcomes(inputs.framework);
  const outcomeById = new Map(allFrameworkOutcomes.map((outcome) => [outcome.outcome_or_requirement_id, outcome]));
  const routeArtifacts = inputs.model.routes.map((routeModel) => {
    const bookInventory = buildBookInventory(routeModel);
    const topicInventoryWithoutCandidates = buildTopicInventory(routeModel);
    const officialMap = buildOfficialMap(
      routeModel,
      outcomeById,
      topicInventoryWithoutCandidates,
      inputs.alignmentPolicy,
    );
    const topicInventory = applyOfficialOutcomeCandidates(topicInventoryWithoutCandidates, officialMap);
    const coverage = buildRouteCoverage(routeModel, officialMap, outcomeById);
    return { routeModel, officialMap, bookInventory, topicInventory, coverage };
  });
  const routeIndex = buildRouteIndex(routeArtifacts);
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

export function validateGrade2CourseArchitecture(artifacts) {
  const diagnostics = [];
  const { inputs, routes, programme } = artifacts;
  const alignmentPolicy = inputs.alignmentPolicy;
  const expectedRoutes = grade2RouteIds;
  const actualRoutes = routes.map((route) => route.routeModel.definition.id);
  if (JSON.stringify(actualRoutes) !== JSON.stringify(expectedRoutes)) diagnostics.push(diagnostic('grade_2_route_set_mismatch', 'Route set differs from the Grade 2 manifest policy.'));
  if (routes.reduce((sum, route) => sum + route.bookInventory.source_records.length, 0) !== 2483) diagnostics.push(diagnostic('canonical_record_total_mismatch', 'Canonical record total must equal 2483.'));
  for (const route of routes) {
    const id = route.routeModel.definition.id;
    const manifestRoute = inputs.manifest.sources.find((source) => source.id === id);
    if (!manifestRoute) diagnostics.push(diagnostic('unknown_grade_2_route', `${id} is not a Grade 2 manifest route.`));
    if (route.routeModel.definition.grade !== 2 || route.bookInventory.source_records.some((record) => !record.record_id.startsWith('grade-2-'))) diagnostics.push(diagnostic('adjacent_grade_source_forbidden', `${id} includes an adjacent-grade source.`));
    if (manifestRoute && route.bookInventory.canonical_route.md_path !== manifestRoute.md_path) diagnostics.push(diagnostic('route_md_path_mismatch', `${id} uses the wrong md_path.`));
    if (manifestRoute && route.bookInventory.canonical_route.qa_path !== manifestRoute.qa_path) diagnostics.push(diagnostic('route_qa_path_mismatch', `${id} uses the wrong qa_path.`));
    if (manifestRoute && route.bookInventory.canonical_route.source_archive !== manifestRoute.source_archive) diagnostics.push(diagnostic('route_archive_path_mismatch', `${id} uses the wrong source archive.`));
    if (route.bookInventory.record_count !== route.bookInventory.source_records.length || route.bookInventory.record_count !== route.routeModel.definition.expected_record_count) diagnostics.push(diagnostic('route_record_count_mismatch', `${id} record count does not reconcile.`));
    if (route.bookInventory.books.some((book) => book.full_prose_available !== false)) diagnostics.push(diagnostic('missing_prose_marked_ready', `${id} cannot claim complete prose.`));
    if (route.coverage.rows.some((row) => row.full_prose_status === 'missing' && row.lesson_authoring_status !== 'not_started')) diagnostics.push(diagnostic('missing_prose_marked_lesson_ready', `${id} marks a missing-prose row lesson-ready.`));
    if (route.coverage.rows.some((row) => row.task_evidence_status !== 'linked' && row.assessment_evidence_status === 'partial')) diagnostics.push(diagnostic('missing_tasks_marked_assessment_ready', `${id} marks absent task evidence assessment-ready.`));
    if (route.topicInventory.topics.some((topic) => topic.automatic_translated_topics_used_as_source_prose)) diagnostics.push(diagnostic('translated_query_metadata_used_as_prose', `${id} uses translated query metadata as source prose.`));
    const canonicalRecordById = new Map(route.routeModel.canonical_records.map((record) => [
      recordId(id, record),
      record,
    ]));
    for (const topic of route.topicInventory.topics) {
      const sourceRecords = topic.source_record_ids.map((sourceRecordId) => canonicalRecordById.get(sourceRecordId));
      const expectedProgrammeTypes = [...new Set(sourceRecords.filter(Boolean).map((record) => record.programme_type))].sort(bytewise);
      if (!sameStableValue(topic.programme_types, expectedProgrammeTypes)) {
        diagnostics.push(diagnostic('topic_programme_type_mismatch', `${topic.topic_id} must preserve programme types from its exact source records.`, `${routeDir(id)}/topic-inventory.yaml`, topic.topic_id));
      }
    }
    for (const book of route.bookInventory.books) {
      if (['mixed_subject', 'simplified_curriculum', 'supplementary'].includes(book.programme_type) && book.eligibility.ordinary_default_use) {
        diagnostics.push(diagnostic('nonordinary_programme_marked_ordinary_default', `${id} kit ${book.kit_id} cannot be ordinary-default eligible.`));
      }
      if (simplifiedKitIds.includes(book.kit_id) !== book.eligibility.learner_specific_simplified_use) {
        diagnostics.push(diagnostic('simplified_book_eligibility_mismatch', `${id} kit ${book.kit_id} has inconsistent learner-specific simplified eligibility.`));
      }
      if (supplementaryKitIds.includes(book.kit_id) !== book.eligibility.supplementary_use) {
        diagnostics.push(diagnostic('supplementary_book_eligibility_mismatch', `${id} kit ${book.kit_id} has inconsistent supplementary eligibility.`));
      }
      if (supplementaryRouteIds.includes(id) !== book.eligibility.youth_training_use) {
        diagnostics.push(diagnostic('youth_training_eligibility_mismatch', `${id} kit ${book.kit_id} has inconsistent youth-training eligibility.`));
      }
    }
    for (const outcome of route.officialMap.outcomes) {
      const indexed = inputs.outcomeIndex.outcomes.find((entry) => entry.outcome_id === outcome.outcome_id);
      if (!indexed) diagnostics.push(diagnostic('unknown_official_outcome', `${id} references unknown outcome ${outcome.outcome_id}.`));
      if (outcome.official_scope.kind !== 'school_stage'
          || outcome.official_scope.school_stage !== 1
          || outcome.official_scope.terminal_grade !== 3
          || outcome.official_scope.exact_grade_claimed) {
        diagnostics.push(diagnostic('school_stage_marked_exact_grade', `${outcome.outcome_id} must remain a non-exact stage-I endpoint.`));
      }
    }
    if (id === 'grade-2-nature-and-human-studies' && route.officialMap.official_fields.length !== 2) diagnostics.push(diagnostic('mixed_official_fields_collapsed', 'Mixed nature/human-studies route must preserve two official fields.'));
    if (supplementaryRouteIds.includes(id) && route.officialMap.outcomes.length !== 0) {
      diagnostics.push(diagnostic('supplementary_route_marked_core_curriculum', `${id} cannot provide ordinary core outcome coverage.`));
    }
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
    const expectedCandidatesByTopicId = buildTopicOutcomeCandidateIndex(
      route.topicInventory,
      route.officialMap,
    );
    const routeOutcomeUniverse = [...(routeOutcomeIds[route.routeModel.definition.id] ?? [])].sort(bytewise);
    let routeWideFallbackUsed = route.topicInventory.topics.length > 0;
    for (const topic of route.topicInventory.topics) {
      const expectedCandidates = [...expectedCandidatesByTopicId.get(topic.topic_id)].sort(bytewise);
      const actualCandidates = [...topic.official_outcome_candidates].sort(bytewise);
      const unexpectedCandidates = actualCandidates.filter((outcomeId) => !expectedCandidates.includes(outcomeId));
      const missingCandidates = expectedCandidates.filter((outcomeId) => !actualCandidates.includes(outcomeId));
      if (unexpectedCandidates.length > 0) {
        diagnostics.push(diagnostic(
          'topic_outcome_candidate_unaligned',
          `${topic.topic_id} includes outcomes absent from its resolved authored alignment: ${unexpectedCandidates.join(', ')}.`,
          `${routeDir(route.routeModel.definition.id)}/topic-inventory.yaml`,
          topic.topic_id,
        ));
      }
      if (missingCandidates.length > 0) {
        diagnostics.push(diagnostic(
          'topic_outcome_candidate_missing',
          `${topic.topic_id} omits outcomes present in its resolved authored alignment: ${missingCandidates.join(', ')}.`,
          `${routeDir(route.routeModel.definition.id)}/topic-inventory.yaml`,
          topic.topic_id,
        ));
      }
      if (!sameStableValue(actualCandidates, routeOutcomeUniverse)) routeWideFallbackUsed = false;
    }
    if (routeWideFallbackUsed && route.topicInventory.topics.some((topic) => (
      !sameStableValue(
        [...expectedCandidatesByTopicId.get(topic.topic_id)].sort(bytewise),
        routeOutcomeUniverse,
      )
    ))) {
      diagnostics.push(diagnostic(
        'topic_outcome_candidates_route_fallback',
        `${route.routeModel.definition.id} assigns the route outcome universe to every topic instead of using authored alignments.`,
        `${routeDir(route.routeModel.definition.id)}/topic-inventory.yaml`,
        route.routeModel.definition.id,
      ));
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
  const mixedRoute = routes.find((route) => route.routeModel.definition.id === 'grade-2-nature-and-human-studies');
  if (mixedRoute) {
    const [science, human] = mixedRoute.officialMap.outcomes;
    if (science && human && sameStableValue(science.source_alignment.topic_cluster_refs, human.source_alignment.topic_cluster_refs)) {
      diagnostics.push(diagnostic('mixed_route_alignment_collapsed', 'Science and human-studies outcomes need separate authored topic evidence.', `${routeDir(mixedRoute.routeModel.definition.id)}/official-curriculum.yaml`, mixedRoute.routeModel.definition.id));
    }
    if (science && human && !sameStableValue(science.source_alignment.topic_cluster_refs, human.source_alignment.topic_cluster_refs)) {
      const alignedTopicIds = new Set([
        ...science.source_alignment.topic_cluster_refs,
        ...human.source_alignment.topic_cluster_refs,
      ]);
      const candidateSets = mixedRoute.topicInventory.topics
        .filter((topic) => alignedTopicIds.has(topic.topic_id))
        .map((topic) => JSON.stringify([...topic.official_outcome_candidates].sort(bytewise)));
      if (candidateSets.length > 1 && new Set(candidateSets).size === 1) {
        diagnostics.push(diagnostic(
          'mixed_route_topic_candidates_collapsed',
          'Mixed-route topics cannot share an identical outcome-candidate set when their authored alignments differ.',
          `${routeDir(mixedRoute.routeModel.definition.id)}/topic-inventory.yaml`,
          mixedRoute.routeModel.definition.id,
        ));
      }
    }
  }
  const artsRoute = routes.find((route) => route.routeModel.definition.id === 'grade-2-arts-and-crafts');
  if (artsRoute?.officialMap.outcomes.length === 2
      && sameStableValue(
        artsRoute.officialMap.outcomes[0].source_alignment.topic_cluster_refs,
        artsRoute.officialMap.outcomes[1].source_alignment.topic_cluster_refs,
      )) {
    diagnostics.push(diagnostic(
      'arts_technology_alignment_collapsed',
      'Art-reflection and technology-safe-work outcomes need separate authored topic evidence.',
      `${routeDir(artsRoute.routeModel.definition.id)}/official-curriculum.yaml`,
      artsRoute.routeModel.definition.id,
    ));
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
        'No exclusive Grade 2 manifest route exists for this official field.',
      );
    }
    if (!sameStableValue(row.source_alignment, expectedAlignment)
        || !sameStableValue(row.topic_cluster_refs, expectedAlignment.topic_cluster_refs)) {
      diagnostics.push(diagnostic('programme_coverage_alignment_mismatch', `${row.outcome_id} does not match its authored source or programme-policy alignment.`, `${programmeDirectory}/programme-coverage.yaml`, row.outcome_id));
    }
  }
  const architecture = programme.architecture;
  if (architecture.learner_profile.estonian_subject_route !== 'grade-2-estonian-second-language') diagnostics.push(diagnostic('wrong_default_estonian_route', 'First-language Estonian cannot replace the default second-language route.'));
  if (programme.mastery.mastery_strands.filter((strand) => strand.route_id === 'grade-2-russian').length !== 2
      || !programme.mastery.mastery_strands.some((strand) => strand.strand_id === 'grade-2-russian-language-mastery')
      || !programme.mastery.mastery_strands.some((strand) => (
        strand.strand_id === 'grade-2-russian-reading-mastery' && strand.source_kit_ids.includes('454')
      ))) {
    diagnostics.push(diagnostic('russian_language_reading_strand_missing', 'Russian language and reading must remain separate mastery strands inside the Russian route.'));
  }
  for (const strand of [...programme.mastery.mastery_strands, ...programme.mastery.subject_strands]) {
    const routeArtifact = routes.find((candidate) => candidate.routeModel.definition.id === strand.route_id);
    const books = strand.source_kit_ids.map((kitId) => (
      routeArtifact?.bookInventory.books.find((book) => book.kit_id === kitId)
    ));
    if (books.some((book) => !book || book.programme_type !== 'ordinary_curriculum')) {
      diagnostics.push(diagnostic('mastery_nonordinary_source', `${strand.strand_id} may use only exact ordinary-curriculum book evidence.`));
    }
  }
  if (architecture.learner_specific_book_profiles.length !== simplifiedKitIds.length) diagnostics.push(diagnostic('simplified_book_profile_missing', 'Every simplified book requires a learner-specific opt-in profile.'));
  if (programme.projects.principle !== 'projects_apply_but_do_not_replace_mastery_strands' || programme.mastery.mastery_strands.length < 3) diagnostics.push(diagnostic('project_replaces_mastery', 'Projects cannot replace required mastery strands.'));
  if (programme.projects.projects.some((project) => !project.individual_grade_2_evidence)) diagnostics.push(diagnostic('shared_product_replaces_individual_evidence', 'Every project requires individual Grade 2 evidence.'));
  if (programme.projects.projects.some((project) => project.linked_route_ids.some((routeId) => supplementaryRouteIds.includes(routeId)))) diagnostics.push(diagnostic('youth_training_used_as_core_project', 'Youth-training routes cannot fill ordinary projects or physical-education gaps.'));
  const pilots = programme.projects.projects.filter((project) => project.pilot_candidate !== null);
  if (pilots.length !== 1
      || pilots[0].project_id !== 'grade-2-project-weather-water-safety'
      || pilots[0].pilot_candidate.issue !== 40) {
    diagnostics.push(diagnostic('weather_water_safety_pilot_missing', 'Exactly one architecture-only Weather, Water and Safety handoff must target issue #40.'));
  }
  if (programme.routeIndex.routes.some((route) => route.companion_candidates.some((candidate) => candidate.customer_visible && candidate.access.mode === 'unverified'))) diagnostics.push(diagnostic('unverified_companion_customer_visible', 'Unverified Opiq companion cannot be customer-visible.'));
  if (programme.routeIndex.routes.some((route) => route.companion_candidates.some((candidate) => candidate.teacher_only))) diagnostics.push(diagnostic('teacher_only_source_presented_to_pupil', 'Teacher-only source cannot be a pupil companion.'));
  if (programme.routeIndex.routes.some((route) => route.companion_candidates.some((candidate) => !candidate.standalone_fallback_required))) diagnostics.push(diagnostic('companion_fallback_missing', 'Every optional companion requires a standalone fallback.'));
  for (const routeEntry of programme.routeIndex.routes) {
    const routeArtifact = routes.find((candidate) => candidate.routeModel.definition.id === routeEntry.route_id);
    for (const companion of routeEntry.companion_candidates) {
      const book = routeArtifact?.bookInventory.books.find((candidate) => candidate.kit_id === companion.kit_id);
      if (!book
          || companion.programme_type !== book.programme_type
          || companion.ordinary_default_eligible !== book.eligibility.ordinary_default_use
          || companion.learner_specific_opt_in_required !== book.eligibility.learner_specific_simplified_use
          || companion.supplementary_only !== book.eligibility.supplementary_use
          || companion.mixed_subject !== book.eligibility.mixed_subject_use
          || companion.youth_training !== book.eligibility.youth_training_use) {
        diagnostics.push(diagnostic('companion_programme_role_mismatch', `${routeEntry.route_id} kit ${companion.kit_id} companion eligibility must match the exact book evidence.`));
      }
    }
  }
  if (JSON.stringify(architecture.official_field_gaps.map((gap) => gap.field_id)) !== JSON.stringify(missingFields)) diagnostics.push(diagnostic('missing_official_field_gaps', 'Foreign-language and physical-education gaps must remain explicit.'));
  if (architecture.completeness.declared_complete || programme.coverage.completeness.declared_complete) diagnostics.push(diagnostic('false_completeness_claim', 'Grade 2 architecture must remain incomplete.'));
  if (architecture.release_gate.publication_ready || architecture.delivery_model.publication_status !== 'internal_review') diagnostics.push(diagnostic('publication_readiness_claim_forbidden', 'Architecture cannot claim publication readiness.'));
  if (!sameStableValue(architecture.release_gate.blocker_codes, releaseBlockerCodes)
      || !sameStableValue(programme.roadmap.release_blocker_codes, releaseBlockerCodes)) {
    diagnostics.push(diagnostic('release_blocker_set_mismatch', 'The required Grade 2 architecture blocker set must remain exact and deterministic.'));
  }
  if (programme.calendar.national_weekly_hours_claimed) diagnostics.push(diagnostic('unsupported_weekly_hours_claim', 'No national weekly-hour claim is supported.'));
  if (programme.routeIndex.book_variant_count !== 41) diagnostics.push(diagnostic('catalogue_reconciliation_mismatch', 'Grade 2 book/kit accounting changed.'));
  if (programme.routeIndex.simplified_route_count !== 0
      || programme.routeIndex.simplified_book_count !== 5
      || programme.routeIndex.mixed_route_count !== 1
      || programme.routeIndex.supplementary_route_count !== 2) {
    diagnostics.push(diagnostic('programme_route_classification_mismatch', 'Expected five simplified books, one mixed route and two supplementary youth routes.'));
  }
  if (programme.coverage.rows.length !== 15 || programme.coverage.rows.some((row) => row.official_scope.kind !== 'school_stage')) {
    diagnostics.push(diagnostic('grade_2_outcome_scope_mismatch', 'Exactly 15 Grade 2-relevant stage-I outcomes must be represented without exact-grade claims.'));
  }
  if (programme.coverage.rows.some((row) => ['heading_only', 'metadata_only', 'ambiguous'].includes(row.source_topic_presence) && row.coverage_status === 'verified')) diagnostics.push(diagnostic('heading_only_marked_full_coverage', 'Incomplete topic evidence cannot prove full coverage.'));
  return diagnostics.sort((left, right) => bytewise(`${left.artifact_path}\0${left.record_id}\0${left.code}`, `${right.artifact_path}\0${right.record_id}\0${right.code}`));
}

export async function validateGrade2CourseArchitectureSchemas(rootDir, artifacts) {
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

export async function buildGrade2CourseArchitectureArtifacts(rootDir) {
  const inputs = await loadGrade2CourseArchitectureInputs(rootDir);
  return buildGrade2CourseArchitecture(inputs);
}

export async function checkGrade2CourseArchitectureFiles(rootDir, artifacts) {
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

export async function writeGrade2CourseArchitectureFiles(rootDir, artifacts) {
  for (const [repositoryPath, contents] of artifacts.files) {
    const absolute = path.join(rootDir, repositoryPath);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, contents);
  }
}
