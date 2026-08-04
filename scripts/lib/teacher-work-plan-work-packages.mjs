import fs from 'node:fs/promises';
import path from 'node:path';

import Ajv2020 from 'ajv/dist/2020.js';
import { parseDocument, stringify } from 'yaml';

export const WORK_PACKAGE_PATH =
  'evaluations/teacher-work-plans/grades-5-7-priority-work-packages.yaml';
export const WORK_PACKAGE_AUDIT_PATH =
  'docs/audits/grades-5-7-priority-work-packages.md';
export const WORK_PACKAGE_SCHEMA_PATH =
  'schemas/teacher-work-plan-work-packages.schema.json';

const GAP_REPORT_PATH = 'evaluations/teacher-work-plans/grades-5-7-gap-report.json';
const GAP_REPORT_SCHEMA_PATH = 'schemas/teacher-work-plan-gap-report.schema.json';

const ROUTE_ORDER = Object.freeze([
  'grade-5-science',
  'grade-6-science',
  'grade-7-geography',
  'grade-7-science',
]);

const PRIORITY_GAP_IDS = Object.freeze([
  'grade-5-science-lesson-001',
  'grade-5-science-lesson-022',
  'grade-5-science-lesson-055',
  'grade-6-science-lesson-001',
  'grade-6-science-lesson-008',
  'grade-6-science-lesson-009',
  'grade-6-science-lesson-016',
  'grade-6-science-lesson-022',
  'grade-6-science-lesson-038',
  'grade-6-science-lesson-051',
  'grade-6-science-lesson-055',
  'grade-6-science-lesson-058',
  'grade-6-science-lesson-069',
  'grade-6-science-lesson-105-unassigned',
  'grade-7-science-lesson-034',
  'grade-7-science-lesson-054',
  'grade-7-science-lessons-065-070',
]);

const PACKAGE_CONTRACTS = Object.freeze([
  Object.freeze({ packageId: 'grade-5-science-year-start-workflow', gaps: ['grade-5-science-lesson-001'] }),
  Object.freeze({ packageId: 'grade-5-science-local-water-events', gaps: ['grade-5-science-lesson-022'] }),
  Object.freeze({ packageId: 'grade-5-science-north-estonia-cliff-coast', gaps: ['grade-5-science-lesson-055'] }),
  Object.freeze({ packageId: 'grade-6-science-year-start-workflow', gaps: ['grade-6-science-lesson-001'] }),
  Object.freeze({ packageId: 'grade-6-science-soil-organisms', gaps: ['grade-6-science-lesson-008', 'grade-6-science-lesson-009'] }),
  Object.freeze({ packageId: 'grade-6-science-photosynthesis', gaps: ['grade-6-science-lesson-016'] }),
  Object.freeze({ packageId: 'grade-6-science-garden-field-food-products', gaps: ['grade-6-science-lesson-022'] }),
  Object.freeze({ packageId: 'grade-6-science-wood-processing', gaps: ['grade-6-science-lesson-038'] }),
  Object.freeze({ packageId: 'grade-6-science-air-composition', gaps: ['grade-6-science-lesson-051'] }),
  Object.freeze({ packageId: 'grade-6-science-water-cycle', gaps: ['grade-6-science-lesson-055'] }),
  Object.freeze({ packageId: 'grade-6-science-water-air-habitat-comparison', gaps: ['grade-6-science-lesson-058'] }),
  Object.freeze({ packageId: 'grade-6-science-baltic-fish-coastal-birds', gaps: ['grade-6-science-lesson-069'] }),
  Object.freeze({ packageId: 'grade-6-science-unassigned-lesson-105', gaps: ['grade-6-science-lesson-105-unassigned'] }),
  Object.freeze({ packageId: 'grade-7-science-mixture-separation-review', gaps: ['grade-7-science-lesson-034'] }),
  Object.freeze({ packageId: 'grade-7-science-quadrat-fieldwork', gaps: ['grade-7-science-lesson-054'] }),
  Object.freeze({ packageId: 'grade-7-science-reserve-lessons-65-70', gaps: ['grade-7-science-lessons-065-070'] }),
]);

const BLOCKED_PACKAGE_IDS = Object.freeze([
  'grade-5-science-year-start-workflow',
  'grade-6-science-unassigned-lesson-105',
  'grade-7-science-reserve-lessons-65-70',
]);

const SELECTED_PILOT_PACKAGE_ID = 'grade-6-science-soil-organisms';
const SELECTED_PILOT_ROOT = 'teacher-work-plan-artifacts/grade-6-science/soil-organisms';
const SELECTED_PILOT_DELIVERABLES = Object.freeze([
  'teacher_guide',
  'practical_protocol',
  'observation_table',
  'student_worksheet',
  'answer_key',
  'assessment_rubric',
  'oral_support',
]);

const FORBIDDEN_PLANNED_PATH_PREFIXES = Object.freeze([
  'lesson-plans/',
  'teacher-packs/',
  'annual-courses/',
  'curriculum-maps/',
  'project-files/',
  'external-sources/',
]);

const SNAPSHOT_FIELDS = Object.freeze([
  'gap_id',
  'mapping_id',
  'source_record_kind',
  'coverage_status',
  'bridge_type',
  'lesson_span',
  'placement',
  'source_pages',
  'source_topic_et',
  'normalized_mapping_topic_et',
  'topic_inventory_refs',
]);

export const WORK_PACKAGE_REVIEW_SUMMARY = Object.freeze({
  review_id: 'grades-5-7-priority-work-packages',
  path: WORK_PACKAGE_PATH,
  priority_gap_count: 17,
  work_package_count: 16,
  ready_for_authoring_count: 13,
  blocked_teacher_review_count: 3,
  multi_gap_package_count: 1,
  selected_pilot_package_id: SELECTED_PILOT_PACKAGE_ID,
  semantic_work_package_review_complete: true,
});

function compareBytewise(left, right) {
  return Buffer.from(String(left)).compare(Buffer.from(String(right)));
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

function parseStrictYaml(text, file = WORK_PACKAGE_PATH) {
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
  const value = document.toJS({ maxAliasCount: 0 });
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${file}: YAML root must be an object`);
  }
  return value;
}

function schemaReason(error) {
  if (error.keyword === 'additionalProperties') return `unknown field ${error.params.additionalProperty}`;
  if (error.keyword === 'required') return `missing required field ${error.params.missingProperty}`;
  return error.message ?? `failed ${error.keyword}`;
}

function diagnostic(field, reason) {
  return { file: WORK_PACKAGE_PATH, field: field || '/', reason };
}

function uniqueInOrder(values) {
  return [...new Set(values)];
}

function exactJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function gapSnapshot(gap) {
  return Object.fromEntries(SNAPSHOT_FIELDS.map((field) => [field, structuredClone(gap[field])]));
}

function priorityGaps(gapReport) {
  return (gapReport?.gap_items ?? []).filter(({ coverage_status }) => (
    coverage_status === 'missing' || coverage_status === 'ambiguous'
  ));
}

function expectedPackageSummary(packages) {
  return {
    priority_gap_count: packages.flatMap((entry) => entry.source_gap_refs ?? []).length,
    work_package_count: packages.length,
    ready_for_authoring_count: packages.filter(({ authoring_status }) => authoring_status === 'ready_for_authoring').length,
    blocked_teacher_review_count: packages.filter(({ authoring_status }) => authoring_status === 'blocked_teacher_review').length,
    multi_gap_package_count: packages.filter(({ source_gap_refs }) => (source_gap_refs ?? []).length > 1).length,
    selected_pilot_package_id: packages.find(({ selected_as_first_pilot }) => selected_as_first_pilot)?.package_id ?? null,
  };
}

function addExactDiagnostic(diagnostics, field, actual, expected, reason) {
  if (!exactJson(actual, expected)) diagnostics.push(diagnostic(field, reason));
}

function validateSchema(artifact, schema, diagnostics) {
  if (!schema) return;
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  const validate = ajv.compile(schema);
  if (!validate(artifact)) {
    for (const error of validate.errors ?? []) {
      diagnostics.push(diagnostic(error.instancePath || '/', schemaReason(error)));
    }
  }
}

function validateGapReportSchema(gapReport, gapSchema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  const validate = ajv.compile(gapSchema);
  if (!validate(gapReport)) {
    throw new Error(`current gap report is schema-invalid: ${(validate.errors ?? []).map(schemaReason).join('; ')}`);
  }
}

export function validateTeacherWorkPlanWorkPackages(artifact, {
  schema = null,
  gapReport,
} = {}) {
  const diagnostics = [];
  validateSchema(artifact, schema, diagnostics);

  const gaps = priorityGaps(gapReport);
  addExactDiagnostic(
    diagnostics,
    '/source_gap_report/report_id',
    gapReport?.report_id,
    'grades-5-7-teacher-work-plan-gap-report',
    'source gap report ID must match the validated current report',
  );
  addExactDiagnostic(
    diagnostics,
    '/scope/routes',
    artifact?.scope?.routes,
    ROUTE_ORDER,
    `expected exact route order ${ROUTE_ORDER.join(', ')}`,
  );
  addExactDiagnostic(
    diagnostics,
    '/scope/included_coverage_statuses',
    artifact?.scope?.included_coverage_statuses,
    ['missing', 'ambiguous'],
    'priority review must include exactly missing and ambiguous statuses in order',
  );
  addExactDiagnostic(
    diagnostics,
    '/priority_gaps',
    gaps.map(({ gap_id }) => gap_id),
    PRIORITY_GAP_IDS,
    'current gap report priority set differs from the exact 17-gap contract',
  );

  const packages = artifact?.work_packages ?? [];
  addExactDiagnostic(
    diagnostics,
    '/work_packages',
    packages.map(({ package_id }) => package_id),
    PACKAGE_CONTRACTS.map(({ packageId }) => packageId),
    'work-package IDs must match the exact production order',
  );
  const gapById = new Map(gaps.map((gap) => [gap.gap_id, gap]));
  const packageIdSet = new Set();
  const assignedGapIds = [];

  for (const [packageIndex, workPackage] of packages.entries()) {
    const field = `/work_packages/${packageIndex}`;
    if (packageIdSet.has(workPackage.package_id)) {
      diagnostics.push(diagnostic(`${field}/package_id`, `duplicate package ID ${workPackage.package_id}`));
    }
    packageIdSet.add(workPackage.package_id);
    const contract = PACKAGE_CONTRACTS[packageIndex];
    const actualGapIds = (workPackage.source_gap_refs ?? []).map(({ gap_id }) => gap_id);
    if (contract) {
      addExactDiagnostic(
        diagnostics,
        `${field}/source_gap_refs`,
        actualGapIds,
        contract.gaps,
        `expected exact gap membership for ${contract.packageId}`,
      );
    }
    assignedGapIds.push(...actualGapIds);
    const resolvedGaps = actualGapIds.map((gapId) => gapById.get(gapId));
    for (const [gapIndex, sourceGapRef] of (workPackage.source_gap_refs ?? []).entries()) {
      const gapField = `${field}/source_gap_refs/${gapIndex}`;
      const gap = gapById.get(sourceGapRef.gap_id);
      if (!gap) {
        diagnostics.push(diagnostic(`${gapField}/gap_id`, `unknown, non-priority, or sample-only gap ${sourceGapRef.gap_id}`));
        continue;
      }
      addExactDiagnostic(
        diagnostics,
        gapField,
        sourceGapRef,
        gapSnapshot(gap),
        `source gap snapshot differs from current report for ${gap.gap_id}`,
      );
    }
    const knownGaps = resolvedGaps.filter(Boolean);
    if (knownGaps.length === 0) continue;
    const sourceIds = uniqueInOrder(knownGaps.map(({ source_id }) => source_id));
    if (sourceIds.length !== 1) diagnostics.push(diagnostic(`${field}/source_gap_refs`, 'cross-route grouping is forbidden'));
    const first = knownGaps[0];
    for (const [key, expected] of [
      ['source_id', first.source_id],
      ['grade', first.grade],
      ['subject', first.subject],
      ['subject_et', first.subject_et],
    ]) {
      if (workPackage[key] !== expected) diagnostics.push(diagnostic(`${field}/${key}`, `expected ${expected} from source gaps`));
    }
    addExactDiagnostic(
      diagnostics,
      `${field}/source_block_ids`,
      workPackage.source_block_ids,
      uniqueInOrder(knownGaps.map(({ source_block_id }) => source_block_id).filter(Boolean)),
      'source block IDs must exactly match current gaps',
    );
    addExactDiagnostic(
      diagnostics,
      `${field}/source_pages`,
      workPackage.source_pages,
      uniqueInOrder(knownGaps.flatMap(({ source_pages }) => source_pages)),
      'source pages must exactly match current gaps',
    );
    addExactDiagnostic(
      diagnostics,
      `${field}/source_topics_et`,
      workPackage.source_topics_et,
      uniqueInOrder(knownGaps.map(({ source_topic_et }) => source_topic_et)),
      'source topics must exactly match current gaps',
    );
    addExactDiagnostic(
      diagnostics,
      `${field}/topic_inventory_refs`,
      workPackage.topic_inventory_refs,
      uniqueInOrder(knownGaps.flatMap(({ topic_inventory_refs }) => topic_inventory_refs)),
      'topic inventory references must exactly match current gaps',
    );
    addExactDiagnostic(
      diagnostics,
      `${field}/required_bridge_types`,
      workPackage.required_bridge_types,
      uniqueInOrder(knownGaps.map(({ bridge_type }) => bridge_type)),
      'required bridge types must exactly match current gaps',
    );

    const shouldBeBlocked = BLOCKED_PACKAGE_IDS.includes(workPackage.package_id);
    const expectedStatus = shouldBeBlocked ? 'blocked_teacher_review' : 'ready_for_authoring';
    if (workPackage.authoring_status !== expectedStatus) {
      diagnostics.push(diagnostic(`${field}/authoring_status`, `expected ${expectedStatus}`));
    }
    const expectedKind = shouldBeBlocked
      ? 'teacher_review_decision'
      : actualGapIds.length > 1 ? 'grouped_consecutive_gaps' : 'single_gap';
    if (workPackage.package_kind !== expectedKind) {
      diagnostics.push(diagnostic(`${field}/package_kind`, `expected ${expectedKind}`));
    }
    const expectedPriority = workPackage.package_id === SELECTED_PILOT_PACKAGE_ID
      ? 'p0'
      : shouldBeBlocked ? 'p2' : 'p1';
    if (workPackage.priority_tier !== expectedPriority) {
      diagnostics.push(diagnostic(`${field}/priority_tier`, `expected ${expectedPriority}`));
    }
    const capabilities = workPackage.proposed_artifact_capabilities ?? [];
    const deliverables = workPackage.proposed_deliverables ?? [];
    for (const deliverable of deliverables) {
      if (!capabilities.includes(deliverable)) {
        diagnostics.push(diagnostic(`${field}/proposed_deliverables`, `deliverable ${deliverable} is not declared as a capability`));
      }
    }
    const bridgeTypes = new Set(workPackage.required_bridge_types ?? []);
    if (bridgeTypes.has('teacher_review_required')) {
      addExactDiagnostic(diagnostics, `${field}/proposed_artifact_capabilities`, capabilities, ['teacher_decision_record'], 'teacher-review package may propose only a teacher decision record');
      addExactDiagnostic(diagnostics, `${field}/proposed_deliverables`, deliverables, ['teacher_decision_record'], 'teacher-review package may deliver only a teacher decision record');
      if ((workPackage.blocking_questions ?? []).length === 0) diagnostics.push(diagnostic(`${field}/blocking_questions`, 'teacher-review package requires blocking questions'));
    } else {
      if ((workPackage.blocking_questions ?? []).length > 0) diagnostics.push(diagnostic(`${field}/blocking_questions`, 'ready package cannot retain blocking questions'));
      if (deliverables.length === 0) diagnostics.push(diagnostic(`${field}/proposed_deliverables`, 'ready package requires a concrete proposed deliverable'));
      if (deliverables.length === 1 && deliverables[0] === 'teacher_decision_record') diagnostics.push(diagnostic(`${field}/proposed_deliverables`, 'ready package cannot consist only of a teacher decision record'));
      if (deliverables.includes('teacher_decision_record')) diagnostics.push(diagnostic(`${field}/proposed_deliverables`, 'ready package cannot propose a teacher decision record'));
    }
    if (knownGaps.some(({ coverage_status }) => coverage_status === 'ambiguous') && !shouldBeBlocked) {
      diagnostics.push(diagnostic(`${field}/authoring_status`, 'ambiguous gap must be blocked for teacher review'));
    }
    if (bridgeTypes.has('independently_authored_practical_required')) {
      for (const capability of ['practical_protocol', 'observation_table']) {
        if (!deliverables.includes(capability)) diagnostics.push(diagnostic(`${field}/proposed_deliverables`, `practical package requires ${capability}`));
      }
    }
    if (bridgeTypes.has('independently_authored_bridge_required') && !deliverables.some((value) => (
      value === 'author_created_bridge' || value === 'student_worksheet'
    ))) diagnostics.push(diagnostic(`${field}/proposed_deliverables`, 'bridge package requires an author-created bridge or student worksheet'));
    if (bridgeTypes.has('independently_authored_assessment_required')) {
      for (const capability of ['assessment_rubric', 'answer_key']) {
        if (!deliverables.includes(capability)) diagnostics.push(diagnostic(`${field}/proposed_deliverables`, `assessment package requires ${capability}`));
      }
    }
    if (FORBIDDEN_PLANNED_PATH_PREFIXES.some((prefix) => workPackage.planned_root_path?.startsWith(prefix))) {
      diagnostics.push(diagnostic(`${field}/planned_root_path`, 'planned root points into a protected production artifact area'));
    }
    if (!workPackage.planned_root_path?.startsWith(`teacher-work-plan-artifacts/${workPackage.source_id}/`)) {
      diagnostics.push(diagnostic(`${field}/planned_root_path`, 'planned root must remain in the route-local teacher-work-plan-artifacts area'));
    }
    const selected = workPackage.package_id === SELECTED_PILOT_PACKAGE_ID;
    if (workPackage.selected_as_first_pilot !== selected) diagnostics.push(diagnostic(`${field}/selected_as_first_pilot`, `expected ${selected}`));
    if (selected) {
      if (workPackage.planned_root_path !== SELECTED_PILOT_ROOT) diagnostics.push(diagnostic(`${field}/planned_root_path`, `selected pilot root must be ${SELECTED_PILOT_ROOT}`));
      addExactDiagnostic(diagnostics, `${field}/proposed_deliverables`, deliverables, SELECTED_PILOT_DELIVERABLES, 'selected pilot deliverables must match the exact seven-item contract');
    }
    if (workPackage.resolution_claimed !== false) diagnostics.push(diagnostic(`${field}/resolution_claimed`, 'work-package review cannot claim gap resolution'));
  }

  const duplicates = assignedGapIds.filter((gapId, index) => assignedGapIds.indexOf(gapId) !== index);
  if (duplicates.length > 0) diagnostics.push(diagnostic('/work_packages', `priority gap assigned more than once: ${uniqueInOrder(duplicates).join(', ')}`));
  addExactDiagnostic(
    diagnostics,
    '/work_packages/source_gap_refs',
    assignedGapIds,
    PRIORITY_GAP_IDS,
    'every exact priority gap must be assigned once in source order',
  );
  const computedSummary = expectedPackageSummary(packages);
  addExactDiagnostic(diagnostics, '/summary', artifact?.summary, computedSummary, 'summary must be computed from work packages');
  addExactDiagnostic(
    diagnostics,
    '/summary',
    computedSummary,
    {
      priority_gap_count: 17,
      work_package_count: 16,
      ready_for_authoring_count: 13,
      blocked_teacher_review_count: 3,
      multi_gap_package_count: 1,
      selected_pilot_package_id: SELECTED_PILOT_PACKAGE_ID,
    },
    'production summary must remain 17 gaps, 16 packages, 13 ready, 3 blocked and one pilot',
  );
  diagnostics.sort((left, right) => compareBytewise(`${left.field}\0${left.reason}`, `${right.field}\0${right.reason}`));
  return {
    diagnostics,
    summary: {
      errors: diagnostics.length,
      priority_gaps: gaps.length,
      work_packages: packages.length,
      ready: computedSummary.ready_for_authoring_count,
      blocked: computedSummary.blocked_teacher_review_count,
    },
  };
}

export async function loadTeacherWorkPlanWorkPackages({
  rootDir = process.cwd(),
  gapReport = null,
  artifactText = null,
  schema = null,
  includeMarkdown = true,
} = {}) {
  const root = path.resolve(rootDir);
  const [resolvedArtifactText, resolvedSchema, resolvedGapReport, markdownText] = await Promise.all([
    artifactText ?? fs.readFile(safeRepositoryPath(root, WORK_PACKAGE_PATH), 'utf8'),
    schema ?? fs.readFile(safeRepositoryPath(root, WORK_PACKAGE_SCHEMA_PATH), 'utf8').then(JSON.parse),
    gapReport ?? Promise.all([
      fs.readFile(safeRepositoryPath(root, GAP_REPORT_PATH), 'utf8').then(JSON.parse),
      fs.readFile(safeRepositoryPath(root, GAP_REPORT_SCHEMA_PATH), 'utf8').then(JSON.parse),
    ]).then(([report, gapSchema]) => {
      validateGapReportSchema(report, gapSchema);
      return report;
    }),
    includeMarkdown
      ? fs.readFile(safeRepositoryPath(root, WORK_PACKAGE_AUDIT_PATH), 'utf8').catch((error) => {
        if (error.code === 'ENOENT') return null;
        throw error;
      })
      : null,
  ]);
  return {
    rootDir: root,
    artifactText: resolvedArtifactText,
    artifact: parseStrictYaml(resolvedArtifactText),
    schema: resolvedSchema,
    gapReport: resolvedGapReport,
    markdownText,
  };
}

export function serializeTeacherWorkPlanWorkPackages(artifact) {
  return stringify(artifact, {
    aliasDuplicateObjects: false,
    lineWidth: 100,
    minContentWidth: 0,
  });
}

function markdownCell(value) {
  return String(value).replace(/\s+/gu, ' ').trim().replaceAll('|', '\\|');
}

export function renderTeacherWorkPlanWorkPackagesMarkdown(artifact) {
  const packages = artifact.work_packages;
  const priorityGaps = packages.flatMap((entry) => entry.source_gap_refs.map((gap) => ({
    package_id: entry.package_id,
    source_id: entry.source_id,
    ...gap,
  })));
  const blocked = packages.filter(({ authoring_status }) => authoring_status === 'blocked_teacher_review');
  const ready = packages.filter(({ authoring_status }) => authoring_status === 'ready_for_authoring');
  const pilot = packages.find(({ selected_as_first_pilot }) => selected_as_first_pilot);
  const lines = [
    '# Grades 5-7 priority teacher work-plan packages',
    '',
    '## 1. Status and scope',
    '',
    'This generated audit records the completed semantic review of the 17 missing or ambiguous source-backed gaps in the four registered supplementary teacher-plan crosswalks. The review defines 16 proposed work packages: 13 are ready for a later authoring PR and 3 remain blocked by explicit teacher decisions.',
    '',
    'No teaching artifact is created and no source gap is resolved by this review.',
    '',
    '## 2. Why semantic review precedes authoring',
    '',
    'The 193-item gap index is an evidence registry, not a request to generate 193 files mechanically. This review preserves every priority source gap, forbids cross-route, cross-grade, cross-subject and fuzzy merging, and permits only one explicitly justified consecutive same-route grouping.',
    '',
    '## 3. Exact 17 priority gaps',
    '',
    '| Gap | Route | Source topic | Status | Bridge type | Package |',
    '|---|---|---|---|---|---|',
    ...priorityGaps.map((gap) => `| \`${gap.gap_id}\` | \`${gap.source_id}\` | ${markdownCell(gap.source_topic_et)} | \`${gap.coverage_status}\` | \`${gap.bridge_type}\` | \`${gap.package_id}\` |`),
    '',
    'Grade 7 geography has no missing or ambiguous priority gap and therefore has no work package.',
    '',
    '## 4. Sixteen work packages',
    '',
    '| Package | Route | Gaps | Status | Tier | Planned root |',
    '|---|---|---:|---|---|---|',
    ...packages.map((entry) => `| \`${entry.package_id}\` | \`${entry.source_id}\` | ${entry.source_gap_refs.length} | \`${entry.authoring_status}\` | \`${entry.priority_tier}\` | \`${entry.planned_root_path}\` |`),
    '',
    '## 5. Ready versus blocked accounting',
    '',
    `- Ready for later authoring: ${ready.length}.`,
    `- Blocked by teacher review: ${blocked.length}.`,
    ...blocked.map((entry) => `- \`${entry.package_id}\`: ${markdownCell(entry.blocking_questions.join(' '))}`),
    '',
    'Blocked packages propose only a `teacher_decision_record`; they do not propose worksheets, practical protocols or gap resolution.',
    '',
    '## 6. Grouping decisions',
    '',
    'The only multi-gap package is `grade-6-science-soil-organisms`, combining `grade-6-science-lesson-008` and `grade-6-science-lesson-009`. They are consecutive records in the same Grade 6 science route and `muld` block: lesson 8 requires a field-observation practical, while lesson 9 requires a soil-organism content bridge and presentation support. All other priority gaps remain single source-backed packages.',
    '',
    '## 7. Selected first pilot',
    '',
    `Selected package: \`${pilot.package_id}\`.`,
    '',
    `Planned root for the next PR: \`${pilot.planned_root_path}\`.`,
    '',
    'The pilot covers two consecutive missing gaps and combines a practical protocol with a content bridge. Exact-route Grade 6 soil records provide soil context but do not supply direct page-level evidence for soil organisms. The supplementary source requires field observation, documentation, group work, information synthesis and presentation. The registered Grade 6 language profile is A2; future oral support will be independently authored rather than represented as Opiq oral-page evidence.',
    '',
    '## 8. Proposed deliverables for the pilot',
    '',
    ...pilot.proposed_deliverables.map((deliverable) => `- \`${deliverable}\``),
    '',
    'These are proposals for a separate next PR. None of the seven files or capabilities exists as a result of this review.',
    '',
    '## 9. Existing lesson/teacher-pack architecture boundary',
    '',
    'The production lesson schema and validators require a verified official curriculum map and a registered course map. The current Grade 6 and Grade 7 crosswalk routes have neither verified official curriculum maps nor annual architectures. The next pilot therefore requires a separate lightweight teacher-work-plan reusable-artifact contract. That decision does not bypass or weaken the existing lesson-plan or teacher-pack validators.',
    '',
    '## 10. Route and programme boundaries',
    '',
    '- All packages remain inside their exact route, grade and subject.',
    '- Canonical evidence remains restricted to the route-local committed Markdown; no live catalogue or adjacent route was used.',
    '- Grade 6 and Grade 7 content evidence retains unresolved programme type and does not establish default-course eligibility.',
    '- The teacher plans remain supplementary and noncanonical.',
    '- No official curriculum completeness, exact-grade allocation or annual architecture is claimed.',
    '',
    '## 11. What remains pending',
    '',
    '- Reusable teaching artifacts have not been created.',
    '- The reusable-artifact backlog is not complete.',
    '- Three packages require teacher decisions before authoring.',
    '- The lightweight reusable-artifact contract and the selected pilot content belong to a separate next PR.',
    '- Phase 5 remains incomplete; no gap is marked resolved.',
  ];
  return `${lines.join('\n')}\n`;
}

export function formatTeacherWorkPlanWorkPackageDiagnostic(entry) {
  return `[ERROR] ${entry.file} ${entry.field}: ${entry.reason}`;
}

export const teacherWorkPlanWorkPackageContracts = Object.freeze({
  routeOrder: ROUTE_ORDER,
  priorityGapIds: PRIORITY_GAP_IDS,
  packageContracts: PACKAGE_CONTRACTS,
  blockedPackageIds: BLOCKED_PACKAGE_IDS,
  selectedPilotPackageId: SELECTED_PILOT_PACKAGE_ID,
  selectedPilotRoot: SELECTED_PILOT_ROOT,
  selectedPilotDeliverables: SELECTED_PILOT_DELIVERABLES,
});
