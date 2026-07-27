import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import YAML from 'yaml';
import {
  parseStrictCurriculumYaml,
  safeRepositoryPath,
} from './curriculum-maps.mjs';

export const TARGET_SCHOOL_YEAR = Object.freeze({
  schoolYear: '2026/27',
  startsOn: '2026-09-01',
  endsOn: '2027-08-31',
});

export const COMPLIANCE_PATHS = Object.freeze({
  registry: 'external-sources/official/estonia/2026-27/source-registry.yaml',
  framework: 'compliance/estonia/2026-27/curriculum-framework.yaml',
  home: 'compliance/estonia/2026-27/home-learning-baseline.yaml',
  checklist: 'compliance/estonia/2026-27/commercial-release-checklist.yaml',
  changeNote: 'compliance/estonia/2026-27/change-note.yaml',
  outcomeIndex: 'compliance/estonia/2026-27/outcome-index.yaml',
  requirementIndex: 'compliance/estonia/2026-27/requirement-index.yaml',
  familyBrief: 'docs/compliance/2026-27-home-learning-family-brief-ru.md',
  changeNoteMarkdown: 'docs/compliance/2026-27-curriculum-change-note.md',
  manifest: 'source-manifest.json',
});

const schemaPaths = Object.freeze({
  registry: 'schemas/official-source-registry.schema.json',
  framework: 'schemas/official-curriculum-framework.schema.json',
  home: 'schemas/home-learning-compliance-baseline.schema.json',
  checklist: 'schemas/commercial-release-checklist.schema.json',
  changeNote: 'schemas/curriculum-change-note.schema.json',
  index: 'schemas/compliance-index.schema.json',
});

const bytewise = (left, right) => Buffer.from(String(left)).compare(Buffer.from(String(right)));
const stableSort = (values, selector = (value) => value) => [...values]
  .sort((left, right) => bytewise(selector(left), selector(right)));
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const deepEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const normalizeText = (value) => (
  String(value ?? '').normalize('NFC').toLocaleLowerCase('et').match(/[\p{L}\p{N}]+/gu) ?? []
).join(' ');

function schemaReason(error) {
  if (error.keyword === 'additionalProperties') return `unknown field ${error.params.additionalProperty}`;
  if (error.keyword === 'required') return `missing required field ${error.params.missingProperty}`;
  return error.message ?? `failed ${error.keyword}`;
}

export function makeComplianceDiagnostic(severity, file, field, code, reason, relatedPaths = []) {
  return {
    severity,
    code,
    file,
    field: field || '/',
    reason,
    related_paths: stableSort([...new Set(relatedPaths)]),
  };
}

function add(diagnostics, file, field, code, reason, relatedPaths = []) {
  diagnostics.push(makeComplianceDiagnostic('error', file, field, code, reason, relatedPaths));
}

async function readYaml(rootDir, repositoryPath) {
  const absolute = safeRepositoryPath(rootDir, repositoryPath, repositoryPath);
  return {
    file: repositoryPath,
    data: parseStrictCurriculumYaml(await fs.readFile(absolute, 'utf8'), repositoryPath),
  };
}

async function readJson(rootDir, repositoryPath) {
  const absolute = safeRepositoryPath(rootDir, repositoryPath, repositoryPath);
  return JSON.parse(await fs.readFile(absolute, 'utf8'));
}

export async function load2026ComplianceRepository({ rootDir = process.cwd() } = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const [registry, framework, home, checklist, changeNote, manifest, schemas] = await Promise.all([
    readYaml(absoluteRoot, COMPLIANCE_PATHS.registry),
    readYaml(absoluteRoot, COMPLIANCE_PATHS.framework),
    readYaml(absoluteRoot, COMPLIANCE_PATHS.home),
    readYaml(absoluteRoot, COMPLIANCE_PATHS.checklist),
    readYaml(absoluteRoot, COMPLIANCE_PATHS.changeNote),
    readJson(absoluteRoot, COMPLIANCE_PATHS.manifest),
    Promise.all(Object.entries(schemaPaths).map(async ([key, repositoryPath]) => [
      key,
      await readJson(absoluteRoot, repositoryPath),
    ])).then(Object.fromEntries),
  ]);
  return {
    rootDir: absoluteRoot,
    artifacts: { registry, framework, home, checklist, changeNote },
    manifest,
    schemas,
  };
}

function compileValidators(schemas) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  return Object.fromEntries(Object.entries(schemas).map(([key, schema]) => [key, ajv.compile(schema)]));
}

function addSchemaDiagnostics(diagnostics, artifact, validator) {
  if (validator(artifact.data)) return;
  for (const error of validator.errors ?? []) {
    add(
      diagnostics,
      artifact.file,
      error.instancePath || '/',
      'compliance_schema_invalid',
      schemaReason(error),
    );
  }
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return stableSort(duplicates);
}

function dateCoversTarget(source) {
  return source.version_effective_from <= TARGET_SCHOOL_YEAR.startsOn
    && (source.version_effective_to === null || source.version_effective_to >= TARGET_SCHOOL_YEAR.startsOn);
}

function sourceSupportsClaim(source) {
  return source
    && source.evidence_status === 'verified'
    && source.target_school_year_applicability.status === 'applicable'
    && dateCoversTarget(source);
}

async function validateSourceRegistry(repository, diagnostics) {
  const { registry } = repository.artifacts;
  const sources = registry.data.sources;
  const sourceById = new Map(sources.map((source) => [source.source_id, source]));
  for (const duplicate of duplicateValues(sources.map((source) => source.source_id))) {
    add(diagnostics, registry.file, '/sources', 'duplicate_source_id', `duplicate source_id: ${duplicate}`);
  }
  if (registry.data.target_school_year.starts_on !== TARGET_SCHOOL_YEAR.startsOn) {
    add(
      diagnostics,
      registry.file,
      '/target_school_year/starts_on',
      'target_school_year_start_mismatch',
      `expected ${TARGET_SCHOOL_YEAR.startsOn}`,
    );
  }
  for (const [index, source] of sources.entries()) {
    const base = `/sources/${index}`;
    const actIdentifier = source.official_url.split('/').at(-1);
    if (actIdentifier !== source.consolidated_act_identifier) {
      add(
        diagnostics,
        registry.file,
        `${base}/official_url`,
        'official_url_identifier_mismatch',
        'Legal act URL must match consolidated_act_identifier.',
      );
    }
    if (!source.official_url.startsWith('https://www.riigiteataja.ee/akt/')) {
      add(diagnostics, registry.file, `${base}/official_url`, 'official_domain_invalid', 'official source must use Riigi Teataja.');
    }
    if (source.act_type === 'määruse_lisa') {
      const parent = sourceById.get(source.parent_source_id);
      if (!parent) {
        add(diagnostics, registry.file, `${base}/parent_source_id`, 'appendix_parent_missing', `unknown parent ${source.parent_source_id}`);
      } else if (
        parent.consolidated_act_identifier !== source.consolidated_act_identifier
        || parent.official_url !== source.official_url
      ) {
        add(
          diagnostics,
          registry.file,
          base,
          'appendix_parent_identity_mismatch',
          `appendix ${source.source_id} does not match parent regulation identity`,
        );
      }
    }
    for (const relatedId of source.supersedes_or_compares_to) {
      if (!sourceById.has(relatedId)) {
        add(diagnostics, registry.file, `${base}/supersedes_or_compares_to`, 'source_comparison_unknown', `unknown source ${relatedId}`);
      }
    }
    if (source.target_school_year_applicability.status === 'applicable' && !dateCoversTarget(source)) {
      add(
        diagnostics,
        registry.file,
        `${base}/target_school_year_applicability`,
        'source_not_effective_for_target_year',
        `${source.source_id} does not cover ${TARGET_SCHOOL_YEAR.startsOn}`,
      );
    }
    if (
      source.target_school_year_applicability.status === 'not_applicable'
      && dateCoversTarget(source)
    ) {
      add(
        diagnostics,
        registry.file,
        `${base}/target_school_year_applicability`,
        'source_applicability_inconsistent',
        `${source.source_id} covers the target start but is marked not_applicable`,
      );
    }
    if (source.archived_excerpt) {
      const excerptPath = source.archived_excerpt.path;
      let stats;
      try {
        const absolute = safeRepositoryPath(repository.rootDir, excerptPath, 'archived excerpt path');
        stats = await fs.lstat(absolute);
        if (stats.isSymbolicLink() || !stats.isFile()) throw new Error('must be a regular non-symlink file');
        const excerptBytes = await fs.readFile(absolute);
        const actual = sha256(excerptBytes);
        if (!repository.sourceExcerptTexts) repository.sourceExcerptTexts = new Map();
        repository.sourceExcerptTexts.set(source.source_id, excerptBytes.toString('utf8'));
        if (actual !== source.archived_excerpt.content_identity.value) {
          add(
            diagnostics,
            registry.file,
            `${base}/archived_excerpt/content_identity/value`,
            'archived_source_identity_stale',
            `expected ${actual}`,
            [excerptPath],
          );
        }
      } catch (error) {
        add(
          diagnostics,
          registry.file,
          `${base}/archived_excerpt/path`,
          'archived_source_unresolved',
          error.message,
          [excerptPath],
        );
      }
    }
  }
  const prokAppendices = sources.filter((source) => source.parent_source_id === 'ee-prok-2026-09-01');
  const plrokAppendices = sources.filter((source) => source.parent_source_id === 'ee-plrok-2026-09-01');
  if (prokAppendices.length !== 14) {
    add(diagnostics, registry.file, '/sources', 'prok_appendix_inventory_incomplete', `expected 14 PRÕK appendices, found ${prokAppendices.length}`);
  }
  if (plrokAppendices.length !== 3) {
    add(diagnostics, registry.file, '/sources', 'plrok_appendix_inventory_incomplete', `expected 3 PLRÕK appendices, found ${plrokAppendices.length}`);
  }
}

function validateCompleteness(artifact, diagnostics) {
  const completeness = artifact.data.completeness;
  if (
    completeness.declared_complete
    && (
      completeness.status !== 'verified'
      || completeness.known_gaps.length > 0
      || completeness.checked_documents.length === 0
    )
  ) {
    add(
      diagnostics,
      artifact.file,
      '/completeness',
      'false_completeness_claim',
      'declared_complete requires verified status, checked documents and no known gaps.',
    );
  }
}

function validateFramework(repository, diagnostics) {
  const { framework, registry } = repository.artifacts;
  const sourceById = new Map(registry.data.sources.map((source) => [source.source_id, source]));
  const routeIds = new Set(repository.manifest.sources.map((source) => source.id));
  const outcomeIds = framework.data.outcome_sets.flatMap((set) => set.outcomes.map((outcome) => outcome.outcome_or_requirement_id));
  for (const duplicate of duplicateValues(outcomeIds)) {
    add(diagnostics, framework.file, '/outcome_sets', 'duplicate_outcome_id', `duplicate outcome ID: ${duplicate}`);
  }
  const routeFields = new Map();
  for (const [setIndex, set] of framework.data.outcome_sets.entries()) {
    const setBase = `/outcome_sets/${setIndex}`;
    for (const sourceId of set.source_ids) {
      if (!sourceById.has(sourceId)) {
        add(diagnostics, framework.file, `${setBase}/source_ids`, 'outcome_set_source_unknown', `unknown source ${sourceId}`);
      }
    }
    for (const [outcomeIndex, outcome] of set.outcomes.entries()) {
      const base = `${setBase}/outcomes/${outcomeIndex}`;
      if (!deepEqual(outcome.scope, set.scope)) {
        add(diagnostics, framework.file, `${base}/scope`, 'outcome_scope_mismatch', 'outcome scope must match its outcome set.');
      }
      if (!sourceSupportsClaim(sourceById.get(outcome.source_id)) && outcome.evidence_status === 'verified') {
        add(
          diagnostics,
          framework.file,
          `${base}/source_id`,
          'verified_claim_source_inapplicable',
          `verified outcome cannot use ${outcome.source_id}`,
        );
      }
      const excerptText = repository.sourceExcerptTexts?.get(outcome.source_id);
      if (
        excerptText
        && !normalizeText(excerptText).includes(normalizeText(outcome.official_wording_et))
      ) {
        add(
          diagnostics,
          framework.file,
          `${base}/official_wording_et`,
          'official_wording_not_in_archived_source',
          `wording does not occur in the archived excerpt for ${outcome.source_id}`,
          [sourceById.get(outcome.source_id)?.archived_excerpt?.path].filter(Boolean),
        );
      }
      if (outcome.effective_from > TARGET_SCHOOL_YEAR.startsOn) {
        add(diagnostics, framework.file, `${base}/effective_from`, 'outcome_not_effective_at_year_start', 'outcome starts after the target school year.');
      }
      if (outcome.scope.kind === 'school_stage' && outcome.scope.exact_grade_claimed !== false) {
        add(diagnostics, framework.file, `${base}/scope`, 'school_stage_claimed_as_exact_grade', 'school-stage evidence cannot claim an exact grade.');
      }
      if (
        outcome.requirement_kind === 'school_curriculum_allocation'
        && outcome.scope.kind !== 'school_stage'
      ) {
        add(
          diagnostics,
          framework.file,
          `${base}/scope`,
          'school_allocation_claimed_as_national_exact_grade',
          'school/local allocation cannot be labelled as a national exact-grade outcome.',
        );
      }
      if (outcome.scope.kind === 'exact_grade' && set.curriculum === 'ordinary') {
        add(
          diagnostics,
          framework.file,
          `${base}/scope`,
          'unsupported_ordinary_exact_grade_claim',
          'ordinary exact-grade outcome requires explicit national exact-grade evidence.',
        );
      }
      for (const routeId of outcome.downstream_relevance.route_ids) {
        if (!routeIds.has(routeId)) {
          add(diagnostics, framework.file, `${base}/downstream_relevance/route_ids`, 'downstream_route_unknown', `unknown manifest route ${routeId}`);
        }
        if (set.curriculum === 'simplified' && !routeId.endsWith('-simplified')) {
          add(diagnostics, framework.file, `${base}/downstream_relevance/route_ids`, 'simplified_outcome_route_mismatch', `${routeId} is not a simplified route.`);
        }
        if (set.curriculum === 'ordinary' && routeId.endsWith('-simplified')) {
          add(diagnostics, framework.file, `${base}/downstream_relevance/route_ids`, 'ordinary_outcome_route_mismatch', `${routeId} cannot consume ordinary outcomes.`);
        }
        if (!routeFields.has(routeId)) routeFields.set(routeId, new Set());
        routeFields.get(routeId).add(set.official_subject ?? set.subject_field);
      }
      if (
        outcome.downstream_relevance.grade_2
        && set.curriculum === 'ordinary'
        && (outcome.scope.kind !== 'school_stage' || outcome.scope.school_stage !== 1)
      ) {
        add(diagnostics, framework.file, base, 'grade_2_scope_invalid', 'ordinary Grade 2 relevance must use school-stage I evidence.');
      }
      if (
        outcome.downstream_relevance.grade_4
        && set.curriculum === 'ordinary'
        && (outcome.scope.kind !== 'school_stage' || outcome.scope.school_stage !== 2)
      ) {
        add(diagnostics, framework.file, base, 'grade_4_scope_invalid', 'ordinary Grade 4 relevance must use school-stage II evidence.');
      }
    }
  }
  const mixedFields = routeFields.get('grade-4-human-studies-and-society');
  if (!mixedFields || mixedFields.size < 2) {
    add(
      diagnostics,
      framework.file,
      '/outcome_sets',
      'mixed_route_official_fields_missing',
      'the mixed instructional route must reference multiple explicit official fields.',
    );
  }
  if (framework.data.outcome_sets.some((set) => set.official_subject === 'human_studies_and_society')) {
    add(
      diagnostics,
      framework.file,
      '/outcome_sets',
      'invented_official_subject',
      'human_studies_and_society is a repository route, not an official curriculum subject.',
    );
  }
  validateCompleteness(framework, diagnostics);
}

function validateHomeBaseline(repository, diagnostics) {
  const { home, registry } = repository.artifacts;
  const sourceById = new Map(registry.data.sources.map((source) => [source.source_id, source]));
  const requirements = home.data.requirements;
  for (const duplicate of duplicateValues(requirements.map((requirement) => requirement.requirement_id))) {
    add(diagnostics, home.file, '/requirements', 'duplicate_requirement_id', `duplicate requirement ID: ${duplicate}`);
  }
  for (const [index, requirement] of requirements.entries()) {
    const base = `/requirements/${index}`;
    if (!sourceSupportsClaim(sourceById.get(requirement.source_id)) && requirement.evidence_status === 'verified') {
      add(
        diagnostics,
        home.file,
        `${base}/source_id`,
        'verified_claim_source_inapplicable',
        `verified requirement cannot use ${requirement.source_id}`,
      );
    }
    if (requirement.effective_from > TARGET_SCHOOL_YEAR.startsOn) {
      add(diagnostics, home.file, `${base}/effective_from`, 'requirement_not_effective_at_year_start', 'requirement starts after the target school year.');
    }
    if (requirement.target_school_year_applicability.status !== 'applicable' && requirement.evidence_status === 'verified') {
      add(diagnostics, home.file, `${base}/target_school_year_applicability`, 'verified_requirement_not_applicable', 'verified requirement must be applicable.');
    }
    const excerptText = repository.sourceExcerptTexts?.get(requirement.source_id);
    if (
      excerptText
      && !normalizeText(excerptText).includes(normalizeText(requirement.official_wording_et))
    ) {
      add(
        diagnostics,
        home.file,
        `${base}/official_wording_et`,
        'official_wording_not_in_archived_source',
        `wording does not occur in the archived excerpt for ${requirement.source_id}`,
        [sourceById.get(requirement.source_id)?.archived_excerpt?.path].filter(Boolean),
      );
    }
  }
  const monthly = requirements.find((requirement) => requirement.requirement_id === 'ee-home-reg-2025-monthly-control');
  if (
    !monthly
    || monthly.source_id !== 'ee-home-reg-2025-09-19'
    || !monthly.official_wording_et.includes('vähemalt üks kord kuus')
    || monthly.requirement_level !== 'mandatory'
    || monthly.obligation_holder !== 'school'
  ) {
    add(
      diagnostics,
      home.file,
      '/requirements',
      'monthly_control_requirement_invalid',
      'applicable regulation must require school control at least monthly.',
    );
  }
  const individual = home.data.family_evidence_practices.find((practice) => practice.practice_id === 'individual-curriculum');
  if (!individual || individual.classification !== 'nationally_required') {
    add(diagnostics, home.file, '/family_evidence_practices', 'individual_curriculum_not_required', 'individual curriculum must be nationally_required.');
  }
  for (const [index, practice] of home.data.family_evidence_practices.entries()) {
    if (
      /portfolio|daily-log|weekly-report|timesheet|specific-digital-platform/u.test(practice.practice_id)
      && practice.classification === 'nationally_required'
      && !practice.legal_basis
    ) {
      add(
        diagnostics,
        home.file,
        `/family_evidence_practices/${index}`,
        'unsupported_national_family_evidence_claim',
        `${practice.practice_id} lacks an explicit national legal basis.`,
      );
    }
  }
  validateCompleteness(home, diagnostics);
}

function validateChecklist(repository, diagnostics) {
  const { checklist } = repository.artifacts;
  for (const duplicate of duplicateValues(checklist.data.checks.map((check) => check.check_id))) {
    add(diagnostics, checklist.file, '/checks', 'duplicate_release_check_id', `duplicate check ID: ${duplicate}`);
  }
  const blockingIncomplete = checklist.data.checks.some(
    (check) => check.release_blocking && check.status !== 'passed' && check.status !== 'not_applicable',
  );
  if (checklist.data.release_status === 'ready' && blockingIncomplete) {
    add(diagnostics, checklist.file, '/release_status', 'release_status_false_positive', 'ready is forbidden while a release-blocking check is incomplete.');
  }
}

function validateChangeNote(repository, diagnostics) {
  const { changeNote, registry } = repository.artifacts;
  const sourceIds = new Set(registry.data.sources.map((source) => source.source_id));
  for (const duplicate of duplicateValues(changeNote.data.comparisons.map((comparison) => comparison.comparison_id))) {
    add(diagnostics, changeNote.file, '/comparisons', 'duplicate_change_comparison_id', `duplicate comparison ID: ${duplicate}`);
  }
  for (const [index, comparison] of changeNote.data.comparisons.entries()) {
    for (const sourceId of [comparison.previous_source_id, comparison.target_source_id].filter(Boolean)) {
      if (!sourceIds.has(sourceId)) {
        add(
          diagnostics,
          changeNote.file,
          `/comparisons/${index}`,
          'change_note_source_unknown',
          `unknown source ${sourceId}`,
        );
      }
    }
    if (
      comparison.comparison_identity
      && (
        comparison.comparison_identity.identities_match
          !== (comparison.comparison_identity.previous_value === comparison.comparison_identity.target_value)
        || (comparison.status === 'unchanged' && !comparison.comparison_identity.identities_match)
      )
    ) {
      add(
        diagnostics,
        changeNote.file,
        `/comparisons/${index}/comparison_identity`,
        'change_comparison_identity_inconsistent',
        'comparison status and deterministic attachment identities disagree.',
      );
    }
  }
}

export async function validate2026ComplianceRepository(repository, { registryOnly = false } = {}) {
  const diagnostics = [];
  let validators;
  try {
    validators = compileValidators(repository.schemas);
  } catch (error) {
    add(diagnostics, '<configuration>', '/', 'compliance_schema_compile_failed', error.message);
    return summarize(repository, diagnostics, 0, 0);
  }
  addSchemaDiagnostics(diagnostics, repository.artifacts.registry, validators.registry);
  if (!registryOnly) {
    addSchemaDiagnostics(diagnostics, repository.artifacts.framework, validators.framework);
    addSchemaDiagnostics(diagnostics, repository.artifacts.home, validators.home);
    addSchemaDiagnostics(diagnostics, repository.artifacts.checklist, validators.checklist);
    addSchemaDiagnostics(diagnostics, repository.artifacts.changeNote, validators.changeNote);
  }
  if (diagnostics.length === 0) {
    await validateSourceRegistry(repository, diagnostics);
    if (!registryOnly) {
      validateFramework(repository, diagnostics);
      validateHomeBaseline(repository, diagnostics);
      validateChecklist(repository, diagnostics);
      validateChangeNote(repository, diagnostics);
    }
  }
  return summarize(
    repository,
    diagnostics,
    registryOnly ? 0 : repository.artifacts.framework.data.outcome_sets.flatMap((set) => set.outcomes).length,
    registryOnly ? 0 : repository.artifacts.home.data.requirements.length,
  );
}

function summarize(repository, diagnostics, outcomeCount, requirementCount) {
  const sorted = stableSort(diagnostics, (diagnostic) => [
    diagnostic.file,
    diagnostic.field,
    diagnostic.code,
    diagnostic.reason,
  ].join('\u0000'));
  return {
    diagnostics: sorted,
    summary: {
      errors: sorted.filter((diagnostic) => diagnostic.severity === 'error').length,
      warnings: sorted.filter((diagnostic) => diagnostic.severity === 'warning').length,
      sources: repository.artifacts.registry.data.sources.length,
      outcomes: outcomeCount,
      requirements: requirementCount,
    },
  };
}

function serializeYaml(value) {
  return YAML.stringify(value, {
    aliasDuplicateObjects: false,
    lineWidth: 100,
    sortMapEntries: false,
  });
}

function buildOutcomeIndex(framework) {
  const outcomes = framework.outcome_sets.flatMap((set) => set.outcomes.map((outcome) => ({
    outcome_id: outcome.outcome_or_requirement_id,
    source_id: outcome.source_id,
    official_reference: outcome.official_reference,
    effective_from: outcome.effective_from,
    effective_to: outcome.effective_to,
    scope: outcome.scope,
    subject_field: set.subject_field,
    official_subject: set.official_subject,
    curriculum: set.curriculum,
    evidence_status: outcome.evidence_status,
    grade_2_relevant: outcome.downstream_relevance.grade_2,
    grade_4_relevant: outcome.downstream_relevance.grade_4,
    route_ids: stableSort(outcome.downstream_relevance.route_ids),
    home_learning_relevant: true,
  })));
  return {
    schema_version: '1.0',
    artifact_type: 'official_curriculum_outcome_index',
    index_id: 'ee-2026-27-outcome-index',
    target_school_year: TARGET_SCHOOL_YEAR.schoolYear,
    generated_from: [COMPLIANCE_PATHS.framework, COMPLIANCE_PATHS.registry],
    outcomes: stableSort(outcomes, (outcome) => outcome.outcome_id),
  };
}

function buildRequirementIndex(home) {
  return {
    schema_version: '1.0',
    artifact_type: 'home_learning_requirement_index',
    index_id: 'ee-2026-27-requirement-index',
    target_school_year: TARGET_SCHOOL_YEAR.schoolYear,
    generated_from: [COMPLIANCE_PATHS.home, COMPLIANCE_PATHS.registry],
    requirements: stableSort(home.requirements.map((requirement) => ({
      requirement_id: requirement.requirement_id,
      source_id: requirement.source_id,
      official_reference: requirement.official_reference,
      effective_from: requirement.effective_from,
      effective_to: requirement.effective_to,
      scope: requirement.scope,
      obligation_holder: requirement.obligation_holder,
      requirement_level: requirement.requirement_level,
      evidence_status: requirement.evidence_status,
      grade_2_relevant: true,
      grade_4_relevant: true,
      home_learning_relevant: true,
    })), (requirement) => requirement.requirement_id),
  };
}

const scopeHeadings = Object.freeze({
  eligibility_and_decision: 'Право, заявление и решение',
  responsibility_and_financing: 'Ответственность, финансирование и обязанности школы',
  individual_curriculum: 'Индивидуальный учебный план',
  oversight_and_assessment: 'Контроль и оценивание',
  school_records: 'Школьные записи',
  interruption: 'Прекращение домашнего обучения',
});

function buildFamilyBrief(home, registry) {
  const lines = [
    '# Домашнее обучение в Эстонии в 2026/27: краткая памятка для семьи',
    '',
    '> **Это информационная сводка по проверенным официальным источникам, а не индивидуальная юридическая консультация.**',
    '',
    'Нормативная дата baseline — **1 сентября 2026 года**. Эстонский текст Riigi Teataja является',
    'авторитетным; русские формулировки ниже — пояснение Opiq Helper.',
    '',
  ];
  for (const scope of Object.keys(scopeHeadings)) {
    lines.push(`## ${scopeHeadings[scope]}`, '');
    for (const requirement of home.requirements.filter((candidate) => candidate.scope === scope)) {
      lines.push(
        `- **${requirement.title_ru}.** ${requirement.plain_language_ru} `
        + `Обязанность: \`${requirement.obligation_holder}\`; уровень: \`${requirement.requirement_level}\`. `
        + `Источник: ${requirement.official_reference}.`,
      );
    }
    lines.push('');
  }
  lines.push(
    '## Что зависит от школы или индивидуального плана',
    '',
    '- Директор оценивает наилучшие интересы ребёнка и возможность достижения результатов.',
    '- Индивидуальный учебный план фиксирует ответственных учителей, частоту и форму контроля.',
    '- Национальный минимум проверки — не реже одного раза в месяц; конкретный формат согласуется со школой.',
    '- Школьная программа распределяет национальные school-stage outcomes по классам.',
    '',
    '## Что Opiq Helper не называет законом',
    '',
  );
  for (const practice of home.family_evidence_practices.filter(
    (candidate) => candidate.classification !== 'nationally_required',
  )) {
    lines.push(`- **${practice.title_ru}:** \`${practice.classification}\`. ${practice.notes}`);
  }
  lines.push(
    '',
    '## Проверенные официальные источники',
    '',
    ...registry.sources
      .filter((candidate) => [
        'ee-pgs-2026-09-01',
        'ee-home-reg-2025-09-19',
        'ee-school-records-2025-09-01',
      ].includes(candidate.source_id))
      .map((candidate) => `- [${candidate.short_title}](${candidate.official_url}) — ${candidate.publication_reference}.`),
    '',
    'Opiq Helper, издательские материалы и семейные чек-листы могут поддерживать выполнение плана,',
    'но не заменяют решение директора, школьную программу, индивидуальный план или официальную оценку.',
    '',
  );
  return `${lines.join('\n').trimEnd()}\n`;
}

function buildChangeNoteMarkdown(changeNote) {
  const lines = [
    '# Изменения curriculum/compliance baseline: 2025/26 → 2026/27',
    '',
    `Проверено: ${changeNote.verified_on}. Сравнение привязано к датам действия правовых редакций,`,
    'а не только к заголовкам или URL.',
    '',
  ];
  for (const comparison of changeNote.comparisons) {
    lines.push(
      `## ${comparison.title_ru}`,
      '',
      `Статус: \`${comparison.status}\`. Действует с: ${comparison.effective_from}.`,
      '',
      comparison.summary_ru,
      '',
      `Источники: ${comparison.official_references.join('; ')}.`,
      '',
    );
  }
  lines.push('## Известные границы', '', ...changeNote.known_gaps.map((gap) => `- ${gap}`), '');
  return `${lines.join('\n').trimEnd()}\n`;
}

export function build2026ComplianceDerivedArtifacts(repository) {
  const outcomeIndex = buildOutcomeIndex(repository.artifacts.framework.data);
  const requirementIndex = buildRequirementIndex(repository.artifacts.home.data);
  return new Map([
    [COMPLIANCE_PATHS.outcomeIndex, serializeYaml(outcomeIndex)],
    [COMPLIANCE_PATHS.requirementIndex, serializeYaml(requirementIndex)],
    [COMPLIANCE_PATHS.familyBrief, buildFamilyBrief(
      repository.artifacts.home.data,
      repository.artifacts.registry.data,
    )],
    [COMPLIANCE_PATHS.changeNoteMarkdown, buildChangeNoteMarkdown(repository.artifacts.changeNote.data)],
  ]);
}

export async function validate2026ComplianceDerivedArtifacts(repository, expectedArtifacts) {
  const diagnostics = [];
  const validators = compileValidators(repository.schemas);
  for (const indexPath of [COMPLIANCE_PATHS.outcomeIndex, COMPLIANCE_PATHS.requirementIndex]) {
    const expected = expectedArtifacts.get(indexPath);
    const parsed = parseStrictCurriculumYaml(expected, indexPath);
    if (!validators.index(parsed)) {
      for (const error of validators.index.errors ?? []) {
        add(diagnostics, indexPath, error.instancePath || '/', 'compliance_index_schema_invalid', schemaReason(error));
      }
    }
  }
  for (const [repositoryPath, expected] of expectedArtifacts) {
    try {
      const absolute = safeRepositoryPath(repository.rootDir, repositoryPath, 'derived artifact path');
      const stats = await fs.lstat(absolute);
      if (stats.isSymbolicLink() || !stats.isFile()) throw new Error('must be a regular non-symlink file');
      const actual = await fs.readFile(absolute, 'utf8');
      if (actual !== expected) {
        add(diagnostics, repositoryPath, '/', 'generated_compliance_artifact_stale', 'regenerate with npm run generate:2026-27-compliance');
      }
    } catch (error) {
      add(diagnostics, repositoryPath, '/', 'generated_compliance_artifact_missing', error.message);
    }
  }
  return stableSort(diagnostics, (diagnostic) => `${diagnostic.file}\u0000${diagnostic.code}`);
}

export async function write2026ComplianceDerivedArtifacts(repository, artifacts) {
  for (const [repositoryPath, bytes] of artifacts) {
    const absolute = safeRepositoryPath(repository.rootDir, repositoryPath, 'derived artifact path');
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, bytes);
  }
}

export function formatComplianceDiagnostic(diagnostic) {
  return `${diagnostic.severity.toUpperCase()} ${diagnostic.code} ${diagnostic.file}${diagnostic.field}: ${diagnostic.reason}`;
}
