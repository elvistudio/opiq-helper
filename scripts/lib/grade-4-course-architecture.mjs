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
  'Pedagogical effectiveness has not been established.',
]);
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

function buildOfficialMap(routeModel, outcomeById) {
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
      source_topic_evidence: routeModel.canonical_records.some((record) => record.task_examples.length > 0)
        ? 'heading_and_task_example'
        : 'heading_only',
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
        ordinary_default_use: !simplified && roleFor(routeModel.definition.id) === 'default_ordinary_core',
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

function buildCoverageRow(outcome, routeIds, topicRefs = []) {
  const missingRoute = routeIds.length === 0;
  return {
    outcome_id: outcome.outcome_or_requirement_id,
    official_scope: outcome.scope,
    curated_grade_4_allocation: outcome.scope.kind === 'exact_grade'
      ? 'official_exact_grade'
      : missingRoute
        ? 'local_school_allocation_candidate'
        : 'opiq_helper_recommended_allocation',
    curriculum_alignment_status: outcome.evidence_status,
    source_topic_presence: missingRoute ? 'missing' : 'heading_only',
    task_evidence_status: missingRoute ? 'missing' : 'partial',
    full_prose_status: 'missing',
    lesson_authoring_status: 'not_started',
    assessment_evidence_status: missingRoute ? 'missing' : 'partial',
    coverage_status: missingRoute ? 'missing' : 'partial',
    route_ids: routeIds,
    topic_cluster_refs: topicRefs,
    blocking_gaps: missingRoute
      ? ['No exclusive Grade 4 manifest route exists for this official field.']
      : ['Headings do not prove full outcome coverage; prose and assessment authoring remain incomplete.'],
  };
}

function buildRouteCoverage(routeModel, officialMap, topicInventory, frameworkById) {
  const rows = officialMap.outcomes.map((outcome) => buildCoverageRow(
    frameworkById.get(outcome.outcome_id),
    [routeModel.definition.id],
    topicInventory.topics.slice(0, 3).map((topic) => topic.topic_id),
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

function buildProjects(routeArtifacts) {
  const topicRef = (routeId) => routeArtifacts.find((entry) => entry.routeModel.definition.id === routeId).topicInventory.topics[0].topic_id;
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
    projects: base.map(([id, ru, et, question, routes, outcomes], index) => ({
      project_id: `grade-4-project-${id}`,
      title_ru: ru,
      title_et: et,
      driving_question_ru: question,
      linked_route_ids: routes,
      linked_outcome_ids: outcomes,
      topic_cluster_refs: routes.map(topicRef),
      prerequisites: index === 0 ? [] : [`grade-4-project-${base[index - 1][0]}`],
      estimated_lesson_range: estimate(4, 8, 'Architecture estimate includes individual evidence, practical application and separate language checks.'),
      shared_product: 'A bounded shared product assembled from separately attributable learner contributions.',
      individual_grade_4_evidence: 'An individual first attempt, explanation or reflection is retained for Grade 4 assessment.',
      russian_subject_evidence: 'Subject understanding and reasoning are evidenced in Russian without lowering content demand.',
      estonian_language_evidence: 'A separate short supported Estonian A1–A2 production sample is retained.',
      mathematics_or_data_evidence: 'A table, representation or explicit not-applicable note is retained for each learner.',
      practical_or_community_component: 'A safe observation, local inquiry or simulated community application is planned.',
      source_gaps: ['Complete prose and task bodies are not present in captured source evidence.'],
      author_created_components_required: ['clean-room instructions', 'individual evidence prompt', 'assessment criterion'],
      opiq_companion_candidate_ids: routes.map((routeId) => `${routeId}-kit-${routeArtifacts.find((entry) => entry.routeModel.definition.id === routeId).routeModel.definition.included_kit_ids[0]}`),
    })),
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
    release_blockers: knownGaps,
    non_goals: ['No full lessons are authored in this change.', 'No textbook prose or task body is reconstructed.', 'No publication or effectiveness status is granted.'],
    provenance: provenance(),
  };
}

function buildProgrammeCoverage(frameworkOutcomesList, routeArtifacts) {
  const routeByOutcome = new Map([
    ...Object.entries(routeOutcomeIds).flatMap(([routeId, ids]) => ids.map((id) => [id, [routeId]])),
    ...commonOutcomeIds.map((outcomeId) => [outcomeId, programmeOutcomeRouteIds[outcomeId]]),
  ]);
  const grade4Outcomes = frameworkOutcomesList.filter((outcome) => outcome.downstream_relevance.grade_4);
  const rows = grade4Outcomes.map((outcome) => {
    const routeIds = routeByOutcome.get(outcome.outcome_or_requirement_id) ?? [];
    const topicRefs = routeIds.flatMap((routeId) => (
      routeArtifacts.find((entry) => entry.routeModel.definition.id === routeId).topicInventory.topics.slice(0, 2).map((topic) => topic.topic_id)
    ));
    return buildCoverageRow(outcome, routeIds, topicRefs);
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

Ordinary outcomes retain school-stage-II scope and are only recommended Grade 4 allocations. Only the two
simplified-curriculum outcomes retain verified exact Grade 4 scope. Russian and Russian reading, first-language
and second-language Estonian, ordinary and simplified routes remain separate.

## Delivery and companion boundary

The planned commercial core must work without Opiq. Companion candidates are internal-only, access-unverified
references with a mandatory standalone fallback. Teacher-only resources are excluded.

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
\`schemas/grade-programme-coverage.schema.json\`. A programme must keep manifest routes, official scopes,
curated allocations, source evidence, delivery policy and release claims separate.

Required design order:

1. pin authoritative manifest and regulatory inputs;
2. generate route-bounded curriculum, book, topic and coverage artifacts;
3. declare default, alternative and learner-specific route roles;
4. plan mastery strands before cross-subject projects;
5. preserve separate individual evidence in every shared project;
6. label lesson ranges as recommendations rather than national timetable requirements;
7. keep optional companions internal and unverified until the standalone fallback and access contract are complete;
8. keep completeness partial and release blocked while source, authoring or validation gaps remain.
`;
}

export async function loadGrade4CourseArchitectureInputs(rootDir) {
  const [manifest, outcomeIndex, framework, sourceRegistry, contentQuality, sourceGap, model] = await Promise.all([
    readFile(path.join(rootDir, 'source-manifest.json'), 'utf8').then(JSON.parse),
    readFile(path.join(rootDir, outcomeIndexPath), 'utf8').then(YAML.parse),
    readFile(path.join(rootDir, frameworkPath), 'utf8').then(YAML.parse),
    readFile(path.join(rootDir, sourceRegistryPath), 'utf8').then(YAML.parse),
    readFile(path.join(rootDir, contentQualityPath), 'utf8').then(JSON.parse),
    readFile(path.join(rootDir, sourceGapPath), 'utf8').then(JSON.parse),
    loadGrade4CanonicalSourceModel(rootDir),
  ]);
  validateGrade4Manifest(manifest);
  return { rootDir, manifest, outcomeIndex, framework, sourceRegistry, contentQuality, sourceGap, model };
}

export function buildGrade4CourseArchitecture(inputs) {
  const allFrameworkOutcomes = frameworkOutcomes(inputs.framework);
  const outcomeById = new Map(allFrameworkOutcomes.map((outcome) => [outcome.outcome_or_requirement_id, outcome]));
  const routeArtifacts = inputs.model.routes.map((routeModel) => {
    const officialMap = buildOfficialMap(routeModel, outcomeById);
    const bookInventory = buildBookInventory(routeModel);
    const topicInventory = buildTopicInventory(routeModel);
    const coverage = buildRouteCoverage(routeModel, officialMap, topicInventory, outcomeById);
    return { routeModel, officialMap, bookInventory, topicInventory, coverage };
  });
  const routeIndex = buildRouteIndex(routeArtifacts, inputs.sourceGap);
  const mastery = buildMastery();
  const projects = buildProjects(routeArtifacts);
  const language = buildLanguage();
  const calendar = buildCalendar(projects);
  const roadmap = buildRoadmap();
  const coverage = buildProgrammeCoverage(allFrameworkOutcomes, routeArtifacts);
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

export function validateGrade4CourseArchitecture(artifacts) {
  const diagnostics = [];
  const { inputs, routes, programme } = artifacts;
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
    if (route.coverage.rows.some((row) => row.task_evidence_status === 'missing' && row.assessment_evidence_status !== 'missing')) diagnostics.push(diagnostic('missing_tasks_marked_assessment_ready', `${id} marks missing tasks assessment-ready.`));
    if (route.topicInventory.topics.some((topic) => topic.automatic_translated_topics_used_as_source_prose)) diagnostics.push(diagnostic('translated_query_metadata_used_as_prose', `${id} uses translated query metadata as source prose.`));
    for (const outcome of route.officialMap.outcomes) {
      const indexed = inputs.outcomeIndex.outcomes.find((entry) => entry.outcome_id === outcome.outcome_id);
      if (!indexed) diagnostics.push(diagnostic('unknown_official_outcome', `${id} references unknown outcome ${outcome.outcome_id}.`));
      if (outcome.official_scope.kind === 'school_stage' && outcome.official_scope.exact_grade_claimed) diagnostics.push(diagnostic('school_stage_marked_exact_grade', `${outcome.outcome_id} falsely claims exact Grade 4 scope.`));
      if (outcome.official_scope.kind === 'exact_grade' && outcome.curriculum !== 'simplified') diagnostics.push(diagnostic('exact_simplified_outcome_marked_ordinary', `${outcome.outcome_id} is exact-grade but not simplified.`));
    }
    if (id === 'grade-4-human-studies-and-society' && JSON.stringify(route.officialMap.official_fields) !== JSON.stringify(['inimeseõpetus', 'ühiskonnaõpetus'])) diagnostics.push(diagnostic('mixed_official_fields_collapsed', 'Mixed human/society route must preserve two official fields.'));
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
  if (programme.calendar.national_weekly_hours_claimed) diagnostics.push(diagnostic('unsupported_weekly_hours_claim', 'No national weekly-hour claim is supported.'));
  if (inputs.sourceGap.summary.canonical_student_kits !== 31 || inputs.sourceGap.summary.new_exact_grade_4_student_candidates !== 0) diagnostics.push(diagnostic('catalogue_reconciliation_mismatch', 'Live Grade 4 kit accounting changed.'));
  if (programme.routeIndex.simplified_route_count !== 2 || programme.routeIndex.mixed_route_count !== 1) diagnostics.push(diagnostic('programme_route_classification_mismatch', 'Expected two simplified routes and one mixed route.'));
  if (programme.coverage.rows.some((row) => row.source_topic_presence === 'heading_only' && row.coverage_status === 'verified')) diagnostics.push(diagnostic('heading_only_marked_full_coverage', 'Heading-only evidence cannot prove full coverage.'));
  return diagnostics.sort((left, right) => bytewise(`${left.artifact_path}\0${left.record_id}\0${left.code}`, `${right.artifact_path}\0${right.record_id}\0${right.code}`));
}

export async function validateGrade4CourseArchitectureSchemas(rootDir, artifacts) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  const [programmeSchema, routeSchema, coverageSchema] = await Promise.all(
    [architectureSchemaPath, routeSchemaPath, coverageSchemaPath].map((schemaPath) => (
      readFile(path.join(rootDir, schemaPath), 'utf8').then(JSON.parse)
    )),
  );
  const validateProgramme = ajv.compile(programmeSchema);
  const validateRoute = ajv.compile(routeSchema);
  const validateCoverage = ajv.compile(coverageSchema);
  const failures = [];
  for (const [label, value, validate] of [
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
