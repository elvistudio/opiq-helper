import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import Ajv2020 from 'ajv/dist/2020.js';
import { parseDocument } from 'yaml';

import {
  TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH,
  loadTeacherWorkPlanArtifactRegistry,
  validateTeacherWorkPlanArtifactRegistry,
} from './teacher-work-plan-artifact-registry.mjs';
import {
  validateTeacherWorkPlanWorkPackages,
} from './teacher-work-plan-work-packages.mjs';

export const REUSABLE_ARTIFACT_ROOT = 'teacher-work-plan-artifacts';
export const REUSABLE_ARTIFACT_SCHEMA_PATH =
  'schemas/teacher-work-plan-reusable-artifact.schema.json';

const GAP_REPORT_PATH = 'evaluations/teacher-work-plans/grades-5-7-gap-report.json';
const WORK_PACKAGE_SCHEMA_PATH = 'schemas/teacher-work-plan-work-packages.schema.json';
const LANGUAGE_PROFILE_PATH = 'lesson-plans/language-profiles.yaml';
const MANIFEST_PATH = 'source-manifest.json';

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function compareBytewise(left, right) {
  return Buffer.from(String(left)).compare(Buffer.from(String(right)));
}

function exactJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function diagnostic(file, field, reason) {
  return { file, field: field || '/', reason };
}

function schemaReason(error) {
  if (error.keyword === 'additionalProperties') return `unknown field ${error.params.additionalProperty}`;
  if (error.keyword === 'required') return `missing required field ${error.params.missingProperty}`;
  return error.message ?? `failed ${error.keyword}`;
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

function insideRoot(rootDir, repositoryPath, repositoryRoot) {
  const resolved = safeRepositoryPath(rootDir, repositoryPath);
  const expectedRoot = safeRepositoryPath(rootDir, repositoryRoot);
  return resolved.startsWith(`${expectedRoot}${path.sep}`);
}

function parseStrictYaml(text, file) {
  if (text.includes('\t')) throw new Error(`${file}: invalid YAML: tabs are forbidden`);
  const document = parseDocument(text, {
    strict: true,
    uniqueKeys: true,
    schema: 'core',
    customTags: [],
    prettyErrors: true,
  });
  if (document.errors.length > 0) {
    throw new Error(`${file}: invalid YAML: ${document.errors.map((error) => error.message).join('; ')}`);
  }
  if (document.anchors?.size > 0 || /(?:^|\s)[&*][A-Za-z0-9_-]+/mu.test(text)) {
    throw new Error(`${file}: YAML aliases and anchors are forbidden`);
  }
  return document.toJS({ maxAliasCount: 0 });
}

async function readJson(rootDir, repositoryPath) {
  return JSON.parse(await fs.readFile(safeRepositoryPath(rootDir, repositoryPath), 'utf8'));
}

async function readYaml(rootDir, repositoryPath) {
  const text = await fs.readFile(safeRepositoryPath(rootDir, repositoryPath), 'utf8');
  return parseStrictYaml(text, repositoryPath);
}

async function readYamlEntry(rootDir, repositoryPath, overrides, loadDiagnostics) {
  try {
    const text = overrides.has(repositoryPath)
      ? overrides.get(repositoryPath)
      : await fs.readFile(safeRepositoryPath(rootDir, repositoryPath), 'utf8');
    return { file: repositoryPath, text, data: parseStrictYaml(text, repositoryPath) };
  } catch (error) {
    loadDiagnostics.push(diagnostic(repositoryPath, '/', error.message));
    return null;
  }
}

export function computeTeacherWorkPlanArtifactFingerprint(materials) {
  const chunks = materials.map(({ artifact_path, sha256: fileHash }) => (
    `${artifact_path}\0${String(fileHash).toLowerCase()}\n`
  ));
  return sha256(Buffer.from(chunks.join(''), 'utf8'));
}

export async function loadTeacherWorkPlanReusableArtifactRepository({
  rootDir = process.cwd(),
  gapReport = null,
  workPackages = null,
  artifactOverrides = new Map(),
  materialOverrides = new Map(),
  registryText = null,
  discoveredIndexPaths = null,
  profiles = null,
} = {}) {
  const root = path.resolve(rootDir);
  const resolvedGapReport = gapReport ?? await readJson(root, GAP_REPORT_PATH);
  const registryRepository = await loadTeacherWorkPlanArtifactRegistry({
    rootDir: root,
    registryText: registryText ?? artifactOverrides.get(TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH) ?? null,
    indexOverrides: artifactOverrides,
    discoveredIndexPaths,
    ...(profiles ? { profiles } : {}),
    workPackages,
    gapReport: resolvedGapReport,
  });
  const loadDiagnostics = [...registryRepository.loadDiagnostics];
  const [schema, manifest, languageProfiles] = await Promise.all([
    readJson(root, REUSABLE_ARTIFACT_SCHEMA_PATH),
    readJson(root, MANIFEST_PATH),
    readYaml(root, LANGUAGE_PROFILE_PATH),
  ]);
  const workPackageRepository = registryRepository.workPackageRepository;
  if (workPackages && !workPackageRepository.schema) {
    workPackageRepository.schema = await readJson(root, WORK_PACKAGE_SCHEMA_PATH);
  }
  const indexByPath = new Map(registryRepository.indexes.map((entry) => [entry.file, entry]));
  const artifactContexts = [];
  for (const registryEntry of registryRepository.registry?.data?.artifacts ?? []) {
    const indexEntry = indexByPath.get(registryEntry.index_path) ?? null;
    const profile = registryRepository.profiles?.[registryEntry.validation_profile_id] ?? null;
    const route = (manifest.sources ?? []).find(({ id }) => id === registryEntry.route) ?? null;
    if (!indexEntry || !profile || !route) {
      artifactContexts.push({ registryEntry, profile, indexEntry, route });
      continue;
    }
    const routeBase = `curriculum-maps/${registryEntry.route}`;
    const paths = {
      topicInventory: `${routeBase}/topic-inventory.yaml`,
      bookInventory: `${routeBase}/book-inventory.yaml`,
      crosswalk: `${routeBase}/teacher-work-plan-crosswalk.yaml`,
      extraction: `evaluations/teacher-work-plans/${registryEntry.route}-extraction.json`,
      canonicalMarkdown: route.md_path,
      qa: route.qa_path,
      reviewRegistry: registryEntry.review_registry_path,
    };
    let dependencies = null;
    try {
      const [topicInventory, bookInventory, crosswalk, extraction, canonicalMarkdown, qa, rootDirectoryFiles, reviewRegistry] = await Promise.all([
        readYaml(root, paths.topicInventory),
        readYaml(root, paths.bookInventory),
        readYaml(root, paths.crosswalk),
        readJson(root, paths.extraction),
        fs.readFile(safeRepositoryPath(root, paths.canonicalMarkdown), 'utf8'),
        paths.qa ? readJson(root, paths.qa) : Promise.resolve(null),
        fs.readdir(safeRepositoryPath(root, registryEntry.root_path)).catch((error) => {
          if (error.code === 'ENOENT') return [];
          throw error;
        }),
        readYamlEntry(root, paths.reviewRegistry, artifactOverrides, loadDiagnostics),
      ]);
      dependencies = {
        paths,
        topicInventory,
        bookInventory,
        crosswalk,
        extraction,
        canonicalMarkdown,
        qa,
        rootDirectoryFiles: rootDirectoryFiles.sort(compareBytewise),
        reviewRegistry,
      };
    } catch (error) {
      loadDiagnostics.push(diagnostic(registryEntry.index_path, '/', error.message));
    }
    const materialBytes = new Map();
    for (const material of indexEntry.data.materials ?? []) {
      const bytes = materialOverrides.has(material.artifact_path)
        ? Buffer.from(materialOverrides.get(material.artifact_path))
        : await fs.readFile(safeRepositoryPath(root, material.artifact_path)).catch((error) => {
          if (error.code === 'ENOENT') return null;
          throw error;
        });
      materialBytes.set(material.artifact_path, bytes);
    }
    const artifactEntry = { ...indexEntry, materialBytes };
    artifactContexts.push({ registryEntry, profile, indexEntry: artifactEntry, route, dependencies });
  }
  const artifacts = artifactContexts.filter(({ indexEntry }) => indexEntry).map(({ indexEntry }) => indexEntry);
  return {
    rootDir: root,
    registryRepository,
    registry: registryRepository.registry,
    schema,
    gapReport: resolvedGapReport,
    workPackageRepository,
    manifest,
    languageProfiles,
    artifactContexts,
    artifacts,
    artifactById: new Map(artifactContexts.map((context) => [context.registryEntry.artifact_id, context])),
    loadDiagnostics,
  };
}

function validateExact(diagnostics, file, field, actual, expected, reason) {
  if (!exactJson(actual, expected)) diagnostics.push(diagnostic(file, field, reason));
}

function allTopicRecords(topicInventory) {
  return (topicInventory.topics ?? []).flatMap((topic) => (
    ['selected_records', 'alternative_records', 'rejected_records'].flatMap((bucket) => (
      (topic?.[bucket] ?? []).map((record) => ({ topicId: topic.topic_id, bucket, record }))
    ))
  ));
}

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

function deriveDefaultCourseEligibility(book) {
  if (book?.eligible_for_ordinary_course === true) return 'eligible';
  if (book?.programme_type === 'unknown') return 'unverified';
  return 'ineligible';
}

function validateSafetyApplicability(diagnostics, file, artifact, profile) {
  const safety = artifact.safety_and_ethics ?? {};
  const applicability = profile.safetyApplicability;
  if (!applicability) {
    diagnostics.push(diagnostic(file, '/safety_and_ethics', 'selected validation profile must declare safety applicability'));
    return;
  }
  const fields = {
    fieldwork_applicable: applicability.fieldworkApplicable,
    local_risk_assessment_applicable: applicability.localRiskAssessmentApplicable,
    protected_area_permission_applicable: applicability.protectedAreaPermissionApplicable,
    indoor_fallback_applicable: applicability.indoorFallbackApplicable,
  };
  if (applicability.requiresApplicabilityDeclaration) {
    for (const [field, expected] of Object.entries(fields)) {
      if (safety[field] !== expected) diagnostics.push(diagnostic(
        file,
        `/safety_and_ethics/${field}`,
        'safety applicability differs from the selected validation profile',
      ));
    }
  } else {
    for (const [field, expected] of Object.entries(fields)) {
      if (safety[field] !== undefined && safety[field] !== expected) diagnostics.push(diagnostic(
        file,
        `/safety_and_ethics/${field}`,
        'legacy safety applicability, when declared, must match the selected validation profile',
      ));
    }
  }
  for (const [field, expected] of Object.entries(applicability.expectedRules ?? {})) {
    if (safety[field] !== expected) diagnostics.push(diagnostic(
      file,
      `/safety_and_ethics/${field}`,
      'safety rule differs from the selected validation profile',
    ));
  }
  if (!applicability.localRiskAssessmentApplicable && safety.local_teacher_risk_assessment_required) diagnostics.push(diagnostic(
    file,
    '/safety_and_ethics/local_teacher_risk_assessment_required',
    'local risk-assessment requirement cannot be claimed when it is not applicable',
  ));
  if (!applicability.protectedAreaPermissionApplicable && safety.protected_area_permission_is_teacher_responsibility) diagnostics.push(diagnostic(
    file,
    '/safety_and_ethics/protected_area_permission_is_teacher_responsibility',
    'protected-area responsibility cannot be claimed when it is not applicable',
  ));
  if (!applicability.indoorFallbackApplicable && safety.indoor_fallback_available) diagnostics.push(diagnostic(
    file,
    '/safety_and_ethics/indoor_fallback_available',
    'indoor fallback cannot be claimed when it is not applicable',
  ));
}

function validateMaterialContent(diagnostics, context) {
  const { indexEntry: entry, profile } = context;
  const file = entry.file;
  const studentPaths = new Set(profile.studentFacingPaths);
  const allowedUrlPaths = new Set(profile.urlAllowedPaths);
  for (const [index, material] of (entry.data.materials ?? []).entries()) {
    const materialPath = material.artifact_path;
    const bytes = entry.materialBytes.get(materialPath);
    if (bytes === null || bytes === undefined) {
      diagnostics.push(diagnostic(file, `/materials/${index}`, `missing material ${materialPath}`));
      continue;
    }
    const text = bytes.toString('utf8');
    if (!Buffer.from(text, 'utf8').equals(bytes)) diagnostics.push(diagnostic(materialPath, '/', 'material must be valid UTF-8'));
    if (!text.endsWith('\n')) diagnostics.push(diagnostic(materialPath, '/', 'material must end with a newline'));
    if (text.includes('\t')) diagnostics.push(diagnostic(materialPath, '/', 'tabs are forbidden in material files'));
    if (!materialPath.endsWith('.md')) diagnostics.push(diagnostic(file, `/materials/${index}/artifact_path`, 'material must be Markdown'));
    if (sha256(bytes) !== material.sha256) diagnostics.push(diagnostic(file, `/materials/${index}/sha256`, `stale hash for ${materialPath}`));
    const urls = text.match(/https?:\/\/[^\s)\]>]+/gu) ?? [];
    if (!allowedUrlPaths.has(materialPath) && urls.length > 0) diagnostics.push(diagnostic(materialPath, '/', 'URLs are forbidden by the selected artifact profile'));
    for (const url of urls) {
      if (!/^https:\/\/www\.opiq\.ee\/kit\/[0-9]+\/chapter\/[0-9]+$/iu.test(url)) diagnostics.push(diagnostic(materialPath, '/', `non-Opiq external URL is forbidden: ${url}`));
    }
    if (studentPaths.has(materialPath)) {
      for (const needle of profile.internalLeakPatterns) {
        if (text.toLocaleLowerCase('en').includes(needle.toLocaleLowerCase('en'))) diagnostics.push(diagnostic(materialPath, '/', `student-facing internal analysis leakage matches ${needle}`));
      }
    }
  }
  const materialText = new Map([...entry.materialBytes.entries()].map(([materialPath, bytes]) => [materialPath, bytes?.toString('utf8') ?? '']));
  for (const rule of profile.materialContentRules) {
    const text = materialText.get(rule.path) ?? '';
    if (!rule.requiredStrings.every((value) => text.includes(value))) diagnostics.push(diagnostic(rule.path, '/', rule.description));
  }
  if (profile.urlAllowedPaths.length > 0) {
    const registeredUrls = profile.urlAllowedPaths.flatMap((materialPath) => {
      const text = materialText.get(materialPath) ?? '';
      return text.match(/https:\/\/www\.opiq\.ee\/kit\/[0-9]+\/chapter\/[0-9]+/gu) ?? [];
    });
    validateExact(
      diagnostics,
      profile.urlAllowedPaths.join(', '),
      '/urls',
      registeredUrls,
      profile.contextRecords.map(({ canonical_url }) => canonical_url),
      'profile URL-bearing materials must contain exactly the registered context URLs in order',
    );
  }
}

function validateArtifactContext(diagnostics, repository, context, schemaValidate) {
  const { registryEntry, profile, indexEntry, route, dependencies } = context;
  const file = indexEntry?.file ?? registryEntry.index_path;
  if (!indexEntry) diagnostics.push(diagnostic(file, '/', 'registered artifact index is missing'));
  if (!profile) diagnostics.push(diagnostic(file, '/', `registered validation profile is missing for ${registryEntry.artifact_id}`));
  if (!route) diagnostics.push(diagnostic(file, '/canonical_route/source_id', `registered source route ${registryEntry.route} is missing from source manifest`));
  if (!dependencies) diagnostics.push(diagnostic(file, '/', 'registered route-local artifact dependencies could not be loaded'));
  if (!indexEntry || !profile || !route || !dependencies) return;
  const artifact = indexEntry.data;
  if (!schemaValidate(artifact)) {
    for (const error of schemaValidate.errors ?? []) diagnostics.push(diagnostic(file, error.instancePath || '/', schemaReason(error)));
  }
  validateExact(diagnostics, profile.rootPath, '/', dependencies.rootDirectoryFiles, profile.expectedRootEntries, 'artifact root contents differ from the selected validation profile');
  validateExact(diagnostics, file, '/artifact_id', artifact.artifact_id, registryEntry.artifact_id, 'artifact ID differs from central registry');
  validateExact(diagnostics, file, '/package_id', artifact.package_id, registryEntry.package_id, 'package ID differs from central registry');
  validateExact(diagnostics, file, '/identity', {
    grade: artifact.identity?.grade,
    subject: artifact.identity?.subject,
    subjectEt: artifact.identity?.subject_et,
  }, profile.identity, 'artifact identity differs from selected profile');
  validateExact(diagnostics, file, '/canonical_route', artifact.canonical_route, {
    source_id: route.id,
    md_path: route.md_path,
    source_archive: route.source_archive,
    qa_path: route.qa_path,
    record_count: route.record_count,
    coverage_status: route.coverage_status,
  }, 'canonical route must exactly match source manifest');

  const workPackage = (repository.workPackageRepository.artifact.work_packages ?? [])
    .find(({ package_id }) => package_id === registryEntry.package_id);
  const expectedPackageLink = workPackage && {
    review_id: repository.workPackageRepository.artifact.review_id,
    review_path: 'evaluations/teacher-work-plans/grades-5-7-priority-work-packages.yaml',
    package_id: workPackage.package_id,
    authoring_status: workPackage.authoring_status,
    priority_tier: workPackage.priority_tier,
    selected_as_first_pilot: workPackage.selected_as_first_pilot,
    planned_root_path: workPackage.planned_root_path,
    proposed_deliverables: workPackage.proposed_deliverables,
  };
  validateExact(diagnostics, file, '/source_work_package', artifact.source_work_package, expectedPackageLink, 'source work-package linkage must match the registered package');

  const gapById = new Map((repository.gapReport.gap_items ?? []).map((gap) => [gap.gap_id, gap]));
  const gapSnapshots = profile.sourceGaps.map(({ gap_id }) => {
    const gap = gapById.get(gap_id);
    return gap && {
      gap_id: gap.gap_id,
      mapping_id: gap.mapping_id,
      source_record_kind: gap.source_record_kind,
      source_block_id: gap.source_block_id,
      lesson_span: gap.lesson_span,
      source_pages: gap.source_pages,
      source_topic_et: gap.source_topic_et,
      normalized_mapping_topic_et: gap.normalized_mapping_topic_et,
      coverage_status: gap.coverage_status,
      bridge_type: gap.bridge_type,
      topic_inventory_refs: gap.topic_inventory_refs,
    };
  });
  validateExact(diagnostics, file, '/source_gaps', artifact.source_gaps, gapSnapshots, 'source-gap snapshots must match the current gap report');
  validateExact(diagnostics, file, '/source_gaps', gapSnapshots, profile.sourceGaps, 'source gaps differ from the selected validation profile');
  const mappings = new Map([
    ...(dependencies.crosswalk.lesson_range_mappings ?? []),
    ...(dependencies.crosswalk.unnumbered_source_mappings ?? []),
  ].map((mapping) => [mapping.mapping_id, mapping]));
  for (const expected of profile.sourceGaps) {
    const mapping = mappings.get(expected.mapping_id);
    if (!mapping || mapping.coverage_status !== expected.coverage_status || (mapping.opiq_matches ?? []).length !== 0) diagnostics.push(diagnostic(
      dependencies.paths.crosswalk,
      `/mappings/${expected.mapping_id}`,
      'artifact source gap must retain its registered status and positive Opiq-match boundary',
    ));
  }

  const extraction = dependencies.extraction;
  validateExact(diagnostics, file, '/teacher_plan_source', artifact.teacher_plan_source, {
    extraction_path: dependencies.paths.extraction,
    source_pdf_path: extraction.source.repository_path,
    original_filename: extraction.source.original_filename,
    source_sha256: extraction.source.sha256,
    source_page_count: extraction.source.page_count,
    relevant_source_pages: profile.teacherPlanRelevantPages,
    provenance_kind: extraction.source.provenance_kind,
    canonical: extraction.source.canonical,
  }, 'teacher-plan provenance must match the exact route extraction and profile pages');
  const languageProfile = (repository.languageProfiles.profiles ?? [])
    .find(({ profile_id }) => profile_id === artifact.learner_language_profile?.profile_id);
  if (!languageProfile
    || languageProfile.profile_id !== profile.languageProfile.profileId
    || languageProfile.grade !== profile.languageProfile.grade
    || languageProfile.subject !== profile.languageProfile.subject
    || languageProfile.learner_language_level !== profile.languageProfile.learnerLanguageLevel) diagnostics.push(diagnostic(file, '/learner_language_profile', 'language profile is missing or differs from the selected validation profile'));
  validateExact(diagnostics, file, '/language_support/productive_terms', artifact.language_support?.productive_terms, profile.productiveTerms, 'productive terms differ from the selected validation profile');
  validateSafetyApplicability(diagnostics, file, artifact, profile);

  const registeredRecords = new Map(allTopicRecords(dependencies.topicInventory).map((entry) => [entry.record.record_id, entry]));
  for (const [index, contextRecord] of (artifact.opiq_context_records ?? []).entries()) {
    const inventory = registeredRecords.get(contextRecord.record_id);
    if (!inventory) diagnostics.push(diagnostic(file, `/opiq_context_records/${index}/record_id`, 'unknown route-local topic-inventory record'));
    else {
      if (inventory.bucket === 'rejected_records') diagnostics.push(diagnostic(file, `/opiq_context_records/${index}`, 'rejected record cannot be optional context evidence'));
      if (inventory.topicId !== contextRecord.topic_inventory_ref) diagnostics.push(diagnostic(file, `/opiq_context_records/${index}/topic_inventory_ref`, 'context topic differs from route-local inventory'));
      if (inventory.bucket !== contextRecord.inventory_bucket) diagnostics.push(diagnostic(file, `/opiq_context_records/${index}/inventory_bucket`, 'context bucket differs from route-local inventory'));
      for (const fieldName of ['record_id', 'canonical_url', 'canonical_source_id', 'book_id', 'title', 'language', 'programme_type', 'instructional_roles']) {
        if (!exactJson(contextRecord[fieldName], inventory.record[fieldName])) diagnostics.push(diagnostic(file, `/opiq_context_records/${index}/${fieldName}`, `metadata differs from route-local inventory for ${contextRecord.record_id}`));
      }
    }
    if (countOccurrences(dependencies.canonicalMarkdown, contextRecord.canonical_url) !== 1) diagnostics.push(diagnostic(file, `/opiq_context_records/${index}/canonical_url`, 'context URL must occur exactly once in route canonical Markdown'));
    const book = (dependencies.bookInventory.books ?? []).find(({ book_id }) => book_id === contextRecord.book_id);
    if (!book
      || book.programme_type !== contextRecord.programme_type
      || book.programme_type_evidence?.status !== contextRecord.programme_type_evidence_status
      || deriveDefaultCourseEligibility(book) !== contextRecord.default_course_eligibility) diagnostics.push(diagnostic(file, `/opiq_context_records/${index}`, 'programme evidence or eligibility differs from route-local book inventory'));
    if (contextRecord.programme_type === 'simplified_curriculum'
      && contextRecord.default_course_eligibility === 'eligible') diagnostics.push(diagnostic(file, `/opiq_context_records/${index}/default_course_eligibility`, 'simplified-curriculum context cannot be ordinary-course eligible'));
    if (contextRecord.required_for_learner_completion !== false) diagnostics.push(diagnostic(file, `/opiq_context_records/${index}/required_for_learner_completion`, 'Opiq context cannot be required for learner completion'));
  }
  validateExact(diagnostics, file, '/opiq_context_records', artifact.opiq_context_records, profile.contextRecords, 'context records differ from selected validation profile');

  const capabilities = (artifact.materials ?? []).map(({ capability }) => capability);
  const materialPaths = (artifact.materials ?? []).map(({ artifact_path }) => artifact_path);
  validateExact(diagnostics, file, '/materials/capability', capabilities, profile.capabilities, 'material capabilities differ from selected validation profile');
  validateExact(diagnostics, file, '/materials/artifact_path', materialPaths, profile.materialPaths, 'material paths differ from selected validation profile');
  if (workPackage && !exactJson(capabilities, workPackage.proposed_deliverables)) diagnostics.push(diagnostic(file, '/materials/capability', 'material capabilities differ from work-package deliverables'));
  if (new Set(capabilities).size !== capabilities.length) diagnostics.push(diagnostic(file, '/materials', 'duplicate material capability'));
  for (const [index, material] of (artifact.materials ?? []).entries()) {
    try {
      if (!insideRoot(repository.rootDir, material.artifact_path, registryEntry.root_path)) diagnostics.push(diagnostic(file, `/materials/${index}/artifact_path`, 'material path must stay inside the registered artifact root'));
    } catch (error) {
      diagnostics.push(diagnostic(file, `/materials/${index}/artifact_path`, error.message));
    }
    const expectedAnswer = profile.answerKeyLinks[material.capability];
    if (material.answer_key_path !== expectedAnswer) diagnostics.push(diagnostic(file, `/materials/${index}/answer_key_path`, expectedAnswer ? 'material must point to its profile-declared answer key' : 'answer-key path is not declared for this capability'));
  }
  validateMaterialContent(diagnostics, context);
  const expectedFingerprint = computeTeacherWorkPlanArtifactFingerprint(artifact.materials ?? []);
  if (artifact.content_fingerprint?.value !== expectedFingerprint) diagnostics.push(diagnostic(file, '/content_fingerprint/value', 'aggregate content fingerprint is stale'));
  if (artifact.content_fingerprint?.value !== registryEntry.content_fingerprint) diagnostics.push(diagnostic(file, '/content_fingerprint/value', 'aggregate fingerprint differs from central registry'));

  const expectedHumanReview = {
    registry_path: registryEntry.review_registry_path,
    teacher_review: { status: 'pending', completed_record_path: null },
    local_safety_review: { status: 'pending', completed_record_path: null },
    classroom_trial: {
      workflow_created: true,
      template_path: registryEntry.classroom_trial_template_path,
      status: 'not_tested',
      completed_record_path: null,
    },
    reviewed_content_fingerprint: null,
  };
  validateExact(diagnostics, file, '/human_review', artifact.human_review, expectedHumanReview, 'human-review linkage differs from registry or pending evidence state');
  const reviewRegistry = dependencies.reviewRegistry?.data;
  if (!reviewRegistry) diagnostics.push(diagnostic(registryEntry.review_registry_path, '/', 'registered review registry is missing'));
  else {
    if (reviewRegistry.artifact_id !== artifact.artifact_id) diagnostics.push(diagnostic(registryEntry.review_registry_path, '/artifact_id', 'review registry references another artifact'));
    if (reviewRegistry.artifact_index_path !== registryEntry.index_path) diagnostics.push(diagnostic(registryEntry.review_registry_path, '/artifact_index_path', 'review registry references another index'));
    if (reviewRegistry.content_fingerprint !== artifact.content_fingerprint?.value) diagnostics.push(diagnostic(registryEntry.review_registry_path, '/content_fingerprint', 'review registry fingerprint is stale'));
    if (reviewRegistry.classroom_trial?.template_path !== registryEntry.classroom_trial_template_path) diagnostics.push(diagnostic(registryEntry.review_registry_path, '/classroom_trial/template_path', 'review registry trial template differs from central registry'));
    if (reviewRegistry.teacher_review?.status !== 'pending'
      || reviewRegistry.local_safety_review?.status !== 'pending'
      || reviewRegistry.classroom_trial?.status !== 'not_tested'
      || (reviewRegistry.teacher_review?.completed_record_paths ?? []).length !== 0
      || (reviewRegistry.local_safety_review?.completed_record_paths ?? []).length !== 0
      || (reviewRegistry.classroom_trial?.completed_record_paths ?? []).length !== 0) diagnostics.push(diagnostic(registryEntry.review_registry_path, '/', 'production review workflow must remain pending with zero completed evidence records'));
  }
  if (artifact.readiness?.teacher_review?.status !== 'pending'
    || artifact.readiness?.local_safety_review?.status !== 'pending'
    || artifact.readiness?.classroom_trial?.status !== 'not_tested') diagnostics.push(diagnostic(file, '/readiness', 'review states must remain pending and classroom trial not tested'));
  for (const flag of ['classroom_ready', 'publication_ready', 'customer_released', 'effectiveness_claimed']) {
    if (artifact.readiness?.[flag] !== false) diagnostics.push(diagnostic(file, `/readiness/${flag}`, `${flag} cannot be promoted`));
  }
  if (artifact.source_gap_support?.source_gap_resolution_claimed !== false
    || artifact.source_gap_support?.canonical_opiq_gap_status_unchanged !== true
    || artifact.source_gap_support?.official_curriculum_complete !== false
    || artifact.source_gap_support?.annual_architecture_created !== false
    || artifact.source_gap_support?.default_course_selection_complete !== false
    || artifact.source_gap_support?.live_catalogue_complete !== false) diagnostics.push(diagnostic(file, '/source_gap_support', 'reusable support cannot promote canonical gaps, curriculum, annual architecture, default-course selection or live catalogue completeness'));
}

export function validateTeacherWorkPlanReusableArtifactRepository(repository) {
  const diagnostics = [...(repository.loadDiagnostics ?? [])];
  const registryValidation = validateTeacherWorkPlanArtifactRegistry(repository.registryRepository);
  for (const problem of registryValidation.diagnostics) diagnostics.push(diagnostic(problem.file, problem.field, `artifact-registry dependency: ${problem.reason}`));
  const workPackageValidation = validateTeacherWorkPlanWorkPackages(
    repository.workPackageRepository.artifact,
    { schema: repository.workPackageRepository.schema, gapReport: repository.gapReport },
  );
  for (const problem of workPackageValidation.diagnostics) diagnostics.push(diagnostic(problem.file, problem.field, `work-package dependency: ${problem.reason}`));
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  const validate = ajv.compile(repository.schema);
  for (const context of repository.artifactContexts) validateArtifactContext(diagnostics, repository, context, validate);
  diagnostics.sort((a, b) => compareBytewise(`${a.file}\0${a.field}\0${a.reason}`, `${b.file}\0${b.field}\0${b.reason}`));
  const artifacts = repository.artifactContexts.map(({ indexEntry }) => indexEntry?.data).filter(Boolean);
  return {
    diagnostics,
    summary: {
      artifacts: artifacts.length,
      source_gaps_supported: artifacts.reduce((total, artifact) => total + (artifact.source_gap_support?.supported_gap_ids?.length ?? 0), 0),
      materials: artifacts.reduce((total, artifact) => total + (artifact.materials?.length ?? 0), 0),
      opiq_context_records: artifacts.reduce((total, artifact) => total + (artifact.opiq_context_records?.length ?? 0), 0),
      fingerprints: Object.fromEntries(artifacts.map((artifact) => [artifact.artifact_id, artifact.content_fingerprint?.value ?? null])),
      canonical_gap_statuses_unchanged: artifacts.every((artifact) => artifact.source_gap_support?.canonical_opiq_gap_status_unchanged === true),
      review_registries: repository.artifactContexts.filter(({ dependencies }) => dependencies?.reviewRegistry).length,
      completed_review_records: repository.artifactContexts.reduce((total, { dependencies }) => total
        + (dependencies?.reviewRegistry?.data?.teacher_review?.completed_record_paths?.length ?? 0)
        + (dependencies?.reviewRegistry?.data?.local_safety_review?.completed_record_paths?.length ?? 0), 0),
    },
  };
}

export function formatTeacherWorkPlanReusableArtifactDiagnostic(problem) {
  return `${problem.file}: ${problem.field}: ${problem.reason}`;
}
