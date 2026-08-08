import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';

export const LESSON_ORIGINALITY_REVIEW_ROOT =
  'teacher-packs/grade-2/weather-water-safety/originality-reviews';
export const LESSON_ORIGINALITY_REVIEW_SCHEMA_PATH =
  'schemas/lesson-originality-review-bundle.schema.json';
export const LESSON_ORIGINALITY_REVIEW_INDEX_PATH =
  `${LESSON_ORIGINALITY_REVIEW_ROOT}/review-index.yaml`;
export const LESSON_ORIGINALITY_REVIEW_GUIDE_PATH =
  `${LESSON_ORIGINALITY_REVIEW_ROOT}/review-guide.md`;

const MODULE_ID = 'grade-2-weather-water-safety-pilot';
const SECOND_LANGUAGE_ROUTE_ID = 'grade-2-estonian-second-language';
const FIRST_LANGUAGE_ROUTE_ID = 'grade-2-estonian';

const LESSON_SPECS = Object.freeze([
  Object.freeze({
    lessonId: 'grade-2-weather-water-safety-01-observation',
    lessonPath: 'lesson-plans/grade-2/weather-water-safety/lesson-01-weather-observation.yaml',
    bundleName: 'lesson-01-weather-observation',
    taskReviewPaths: [],
    concerns: [
      'Compare the Russian weather-observation explanation and observation sequence with source context without reconstructing source prose.',
      'Check the observation sheet, weather vocabulary, Täna on ___ ilm. frame, exit evidence, and supervised observation procedure for independent wording and scaffolding.',
      'Confirm that no source observation table, screenshot, illustration, answer key, or interaction sequence has been reproduced.',
    ],
  }),
  Object.freeze({
    lessonId: 'grade-2-weather-water-safety-02-data-time',
    lessonPath: 'lesson-plans/grade-2/weather-water-safety/lesson-02-weather-data-time.yaml',
    bundleName: 'lesson-02-weather-data-time',
    taskReviewPaths: [
      'task-bank/reviews/grade-2/weather-water-safety/03-weather-data-comparison.yaml',
      'task-bank/reviews/grade-2/weather-water-safety/04-time-measurement-problem.yaml',
    ],
    concerns: [
      'Check the precipitation dataset, rain-gauge interpretation, maximum/minimum/difference scaffolding, duration addition, and 60 minutes = 1 hour explanation.',
      'Confirm that teacher worked solutions remain independently authored and separate from learner materials.',
      'Task reviews 03 and 04 are separate approved evidence; lesson-level originality still requires an independent human decision.',
    ],
  }),
  Object.freeze({
    lessonId: 'grade-2-weather-water-safety-03-safe-decisions',
    lessonPath: 'lesson-plans/grade-2/weather-water-safety/lesson-03-safe-decisions.yaml',
    bundleName: 'lesson-03-safe-decisions',
    taskReviewPaths: [
      'task-bank/reviews/grade-2/weather-water-safety/09-water-edge-safe-decision.yaml',
      'task-bank/reviews/grade-2/weather-water-safety/10-pe-water-safety-decision.yaml',
    ],
    concerns: [
      'Check the dry classroom simulation, safety boundary, adult-help procedure, and prohibition on child rescue behavior.',
      'Keep human-studies evidence separate from the physical-education outcome: the PE role must remain missing_route and cannot be replaced by human-studies source evidence.',
      'Check Ma kutsun täiskasvanu. as a bounded author-created language bridge; task reviews 09 and 10 remain pending and block approval eligibility.',
    ],
  }),
  Object.freeze({
    lessonId: 'grade-2-weather-water-safety-04-weather-report',
    lessonPath: 'lesson-plans/grade-2/weather-water-safety/lesson-04-weather-report.yaml',
    bundleName: 'lesson-04-weather-report',
    taskReviewPaths: [
      'task-bank/reviews/grade-2/weather-water-safety/11-shared-weather-report-contribution.yaml',
      'task-bank/reviews/grade-2/weather-water-safety/12-weather-exit-ticket.yaml',
    ],
    concerns: [
      'Check the four-point temperature dataset, personal attribution code, individual contribution, shared report, and corrected exit-ticket evidence.',
      'Confirm that group assembly never replaces individual evidence and that Kell 13 on ____. remains a separate bounded Estonian-language check.',
      'Task reviews 11 and 12 remain pending and block lesson approval eligibility.',
    ],
  }),
]);

function compareBytewise(left, right) {
  return Buffer.from(String(left)).compare(Buffer.from(String(right)));
}

function uniqueSorted(values) {
  return [...new Set(values)].sort(compareBytewise);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort(compareBytewise).map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value) {
  return JSON.stringify(stableValue(value));
}

function normalizeText(value) {
  return value.replace(/\r\n?/gu, '\n');
}

function repositoryPath(rootDir, value, label = 'repository path') {
  if (
    typeof value !== 'string'
    || value.length === 0
    || path.isAbsolute(value)
    || value.includes('\\')
    || value.split('/').includes('..')
  ) {
    throw new Error(`${label} must be a safe repository-relative path: ${value}`);
  }
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, value);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`${label} points outside the repository: ${value}`);
  }
  return resolved;
}

async function readYaml(rootDir, repositoryPathValue) {
  const absolute = repositoryPath(rootDir, repositoryPathValue);
  return YAML.parse(await fs.readFile(absolute, 'utf8'));
}

async function readJson(rootDir, repositoryPathValue) {
  const absolute = repositoryPath(rootDir, repositoryPathValue);
  return JSON.parse(await fs.readFile(absolute, 'utf8'));
}

function materialProjection(material) {
  const projected = {
    material_id: material.material_id,
    title: material.title,
    material_type: material.material_type,
    artifact_path: material.artifact_path,
    audience: material.audience,
    languages: material.languages,
    printable: material.printable,
  };
  if (material.answer_key_path) projected.answer_key_path = material.answer_key_path;
  if (material.answer_key_exemption) projected.answer_key_exemption = material.answer_key_exemption;
  return projected;
}

export function lessonOriginalityProjection(lesson) {
  const coveredIds = new Set(lesson.originality_review?.covered_author_material_ids ?? []);
  const authorMaterials = (lesson.evidence_linkage?.author_materials ?? [])
    .filter((material) => coveredIds.has(material.material_id))
    .map(materialProjection);
  return {
    lesson_id: lesson.lesson_id,
    grade: lesson.grade,
    subject: lesson.subject,
    subject_et: lesson.subject_et,
    title_ru: lesson.title_ru,
    title_et: lesson.title_et,
    duration_minutes: lesson.duration_minutes,
    position_in_unit: lesson.position_in_unit,
    instruction_language: lesson.instruction_language,
    subject_support_language: lesson.subject_support_language,
    author_created_subject_roles: lesson.author_created_subject_roles ?? [],
    methodology: lesson.methodology,
    objectives: lesson.objectives,
    language_load: lesson.language_load,
    cognitive_load: lesson.cognitive_load,
    scaffolds: lesson.scaffolds,
    multimodal_support: lesson.multimodal_support,
    stages: lesson.stages,
    questions: lesson.questions,
    practical_work: lesson.practical_work,
    assessment: lesson.assessment,
    differentiation: lesson.differentiation,
    homework: lesson.homework,
    commercial_core: lesson.commercial_core,
    family_overlay_hooks: lesson.family_overlay_hooks,
    author_materials: authorMaterials,
  };
}

function audienceFor(entries) {
  const audiences = uniqueSorted(entries.map((entry) => entry.audience));
  return audiences.length === 1 ? audiences[0] : 'shared';
}

async function coveredFiles(rootDir, lesson) {
  const coveredIds = lesson.originality_review?.covered_author_material_ids ?? [];
  const materials = lesson.evidence_linkage?.author_materials ?? [];
  const byId = new Map(materials.map((material) => [material.material_id, material]));
  const grouped = new Map();

  for (const materialId of coveredIds) {
    const material = byId.get(materialId);
    if (!material) throw new Error(`${lesson.lesson_id}: unknown covered material ${materialId}`);
    const refs = [
      { path: material.artifact_path, audience: material.audience, role: material.material_type },
      ...(material.answer_key_path
        ? [{ path: material.answer_key_path, audience: 'teacher', role: 'answer_key_reference' }]
        : []),
    ];
    for (const ref of refs) {
      const current = grouped.get(ref.path) ?? [];
      current.push({ material_id: materialId, audience: ref.audience, role: ref.role });
      grouped.set(ref.path, current);
    }
  }

  const result = [];
  for (const repositoryPathValue of [...grouped.keys()].sort(compareBytewise)) {
    const absolute = repositoryPath(rootDir, repositoryPathValue, 'covered file path');
    const stat = await fs.lstat(absolute);
    if (stat.isSymbolicLink()) throw new Error(`covered file must not be a symlink: ${repositoryPathValue}`);
    if (!stat.isFile()) throw new Error(`covered path must be a file: ${repositoryPathValue}`);
    const entries = grouped.get(repositoryPathValue);
    const text = normalizeText(await fs.readFile(absolute, 'utf8'));
    result.push({
      path: repositoryPathValue,
      material_ids: uniqueSorted(entries.map((entry) => entry.material_id)),
      audience: audienceFor(entries),
      content_roles: uniqueSorted(entries.map((entry) => entry.role)),
      sha256: sha256(text),
    });
  }
  return result;
}

async function taskDependencies(rootDir, paths) {
  const dependencies = [];
  for (const reviewPath of paths) {
    const review = await readYaml(rootDir, reviewPath);
    const fingerprint = review.reviewed_version?.content_fingerprint?.value;
    if (!/^[0-9a-f]{64}$/u.test(fingerprint ?? '')) {
      throw new Error(`${reviewPath}: task review fingerprint is missing`);
    }
    dependencies.push({
      task_id: review.task_id,
      review_id: review.review_id,
      review_path: reviewPath,
      status: review.status,
      content_fingerprint: fingerprint,
    });
  }
  return dependencies.sort((left, right) => compareBytewise(left.review_id, right.review_id));
}

function routeEntry(manifest, routeId) {
  const entry = manifest.sources?.find((source) => source.id === routeId);
  if (!entry) throw new Error(`source-manifest is missing route ${routeId}`);
  return entry;
}

function sourceContext(manifest, lesson) {
  const routeIds = uniqueSorted([lesson.canonical_route?.source_id, SECOND_LANGUAGE_ROUTE_ID]);
  if (routeIds.includes(FIRST_LANGUAGE_ROUTE_ID)) {
    throw new Error(`${lesson.lesson_id}: first-language Estonian route cannot satisfy the second-language role`);
  }
  const routeMdPaths = routeIds.map((routeId) => routeEntry(manifest, routeId).md_path);
  const companions = lesson.opiq_companions ?? [];
  const limitations = [
    'Registered Grade 2 Opiq routes are available indexes and do not establish complete official-curriculum or live-catalogue coverage.',
    'Captured indexes do not include complete publisher prose, answer payloads, screenshots, illustrations, or every interactive sequence; absence of a discovered match cannot prove originality.',
  ];
  if (lesson.lesson_id === 'grade-2-weather-water-safety-03-safe-decisions') {
    limitations.push('Physical education has no exact Grade 2 source route in this repository; human-studies evidence must not be substituted for the PE water-safety outcome.');
  }
  return {
    route_ids: routeIds,
    route_md_paths: uniqueSorted(routeMdPaths),
    canonical_record_ids: uniqueSorted(companions.map((entry) => entry.source_record?.record_id).filter(Boolean)),
    canonical_urls: uniqueSorted(companions.map((entry) => entry.source_record?.canonical_url).filter(Boolean)),
    source_limitations: limitations,
  };
}

function reviewDimensions() {
  return {
    wording_independence: 'needs_human_decision',
    context_independence: 'needs_human_decision',
    data_independence: 'needs_human_decision',
    sequence_and_scaffolding_independence: 'needs_human_decision',
    options_and_distractors_independence: 'needs_human_decision',
    answer_and_solution_independence: 'needs_human_decision',
    language_bridge_independence: 'needs_human_decision',
    visual_and_interaction_independence: 'needs_human_decision',
  };
}

function bundlePath(spec) {
  return `${LESSON_ORIGINALITY_REVIEW_ROOT}/${spec.bundleName}.yaml`;
}

function packetPath(spec) {
  return `${LESSON_ORIGINALITY_REVIEW_ROOT}/${spec.bundleName}.md`;
}

function withoutBundleFingerprint(bundle) {
  const clone = structuredClone(bundle);
  delete clone.bundle_fingerprint;
  return clone;
}

async function buildBundle(rootDir, manifest, spec) {
  const lesson = await readYaml(rootDir, spec.lessonPath);
  if (lesson.lesson_id !== spec.lessonId) {
    throw new Error(`${spec.lessonPath}: expected lesson ${spec.lessonId}, got ${lesson.lesson_id}`);
  }
  const existingReview = lesson.originality_review ?? {};
  if (
    existingReview.status !== 'pending'
    || existingReview.reviewer !== null
    || existingReview.reviewer_role !== null
    || existingReview.reviewed_on !== null
    || existingReview.reviewed_version?.commit_sha !== null
  ) {
    throw new Error(`${spec.lessonId}: lesson originality review must remain pending with no reviewer identity`);
  }

  const files = await coveredFiles(rootDir, lesson);
  const projection = lessonOriginalityProjection(lesson);
  const projectionCanonical = canonicalJson({
    canonicalization: 'lesson-originality-review-v1',
    lesson: projection,
  });
  const lessonProjectionSha = sha256(projectionCanonical);
  const contentFingerprintValue = sha256(canonicalJson({
    canonicalization: 'lesson-originality-review-v1',
    lesson_projection_sha256: lessonProjectionSha,
    files: files.map(({ path: filePath, sha256: fileSha }) => ({ path: filePath, sha256: fileSha })),
  }));
  const dependencies = await taskDependencies(rootDir, spec.taskReviewPaths);
  const blocking = dependencies.filter((entry) => entry.status !== 'approved').map((entry) => entry.review_id);
  const bundle = {
    schema_version: '1.0',
    artifact_type: 'lesson_originality_review_bundle',
    review_id: existingReview.review_id,
    lesson_id: lesson.lesson_id,
    module_id: MODULE_ID,
    lesson_path: spec.lessonPath,
    review_status: 'pending',
    reviewer: null,
    reviewer_role: null,
    reviewed_on: null,
    reviewed_version: { commit_sha: null },
    content_fingerprint: {
      algorithm: 'sha256',
      canonicalization: 'lesson-originality-review-v1',
      value: contentFingerprintValue,
      file_count: files.length,
      lesson_projection_sha256: lessonProjectionSha,
    },
    bundle_fingerprint: {
      algorithm: 'sha256',
      canonicalization: 'lesson-review-bundle-v1',
      value: '0'.repeat(64),
    },
    approval_eligible: blocking.length === 0,
    blocking_review_ids: uniqueSorted(blocking),
    covered_files: files,
    covered_material_ids: [...(existingReview.covered_author_material_ids ?? [])],
    source_context: sourceContext(manifest, lesson),
    task_dependencies: dependencies,
    review_dimensions: reviewDimensions(),
    human_review_required: true,
    publication_unlocks: false,
    customer_visibility_unlocks: false,
    notes: 'Prepared deterministic review bundle only. Automated checks verify structure, coverage and freshness; a human reviewer must compare source context with the authored lesson before recording any originality decision.',
  };
  bundle.bundle_fingerprint.value = sha256(canonicalJson(withoutBundleFingerprint(bundle)));
  return { bundle, lesson, spec };
}

export function serializeLessonOriginalityYaml(value) {
  return YAML.stringify(value, { lineWidth: 0 });
}

function bulletList(values, emptyText = 'None.') {
  if (values.length === 0) return emptyText;
  return values.map((value) => `- ${value}`).join('\n');
}

export function renderLessonOriginalityPacket({ bundle, lesson, spec }) {
  const dependencies = bundle.task_dependencies.length === 0
    ? 'No integrated task-review dependency is registered for this lesson bundle.'
    : bundle.task_dependencies.map((entry) => (
      `- \`${entry.task_id}\` — review \`${entry.review_id}\`: **${entry.status}**; ${entry.review_path}`
    )).join('\n');
  const files = bundle.covered_files.map((entry) => (
    `- \`${entry.path}\` — ${entry.sha256}; materials: ${entry.material_ids.map((id) => `\`${id}\``).join(', ')}`
  )).join('\n');
  const dimensions = Object.keys(bundle.review_dimensions)
    .map((key) => `- [ ] ${key.replaceAll('_', ' ')}`)
    .join('\n');
  return `# Lesson originality review packet: ${lesson.title_ru}\n\n`
    + `Status: **pending human review**. This packet does not approve the lesson and does not establish plagiarism absence, publication readiness, classroom readiness, or pedagogical effectiveness.\n\n`
    + `## Identity\n\n- Lesson: \`${bundle.lesson_id}\`\n- Review: \`${bundle.review_id}\`\n- Content fingerprint: \`${bundle.content_fingerprint.value}\`\n- Bundle fingerprint: \`${bundle.bundle_fingerprint.value}\`\n- Approval eligible after task dependencies: **${bundle.approval_eligible}**\n\n`
    + `## Exact source context\n\nRoutes:\n${bulletList(bundle.source_context.route_ids.map((id, index) => `\`${id}\` — \`${bundle.source_context.route_md_paths[index] ?? ''}\``))}\n\nCanonical Opiq records:\n${bulletList(bundle.source_context.canonical_urls.map((url, index) => `\`${bundle.source_context.canonical_record_ids[index] ?? ''}\` — ${url}`))}\n\nLimitations:\n${bulletList(bundle.source_context.source_limitations)}\n\n`
    + `## Covered authored files\n\n${files}\n\n`
    + `## Task-review dependencies\n\n${dependencies}\n\n`
    + `## Lesson-specific review concerns\n\n${bulletList(spec.concerns)}\n\n`
    + `## Human reviewer checklist\n\n${dimensions}\n\n`
    + `The reviewer must inspect source context and the authored commercial content directly. Automated validation only verifies deterministic structure, coverage, route boundaries, dependency state, and fingerprint freshness. It cannot conclusively detect plagiarism or establish originality.\n\n`
    + `## Decision\n\nReviewer: ____________________  Role: ____________________  Date: __________\n\nDecision: [ ] approved  [ ] changes requested  [ ] rejected\n\nNotes:\n`;
}

export function renderLessonOriginalityGuide() {
  return `# Grade 2 lesson originality review guide\n\n`
    + `This directory contains deterministic internal review bundles for the four Grade 2 weather, water and safety pilot lessons. The bundles prepare evidence for a human originality decision; they do not make that decision.\n\n`
    + `## Required reviewer behavior\n\n`
    + `1. Compare the exact authored lesson and covered files with the exact source routes and records named by the packet.\n`
    + `2. Evaluate wording, context, data, sequence/scaffolding, answer/solution, language-bridge, distractor and visual/interaction independence.\n`
    + `3. Do not infer originality from a missing search match. Captured Opiq indexes are incomplete representations of publisher content.\n`
    + `4. Do not approve a lesson while a listed blocking task review remains pending.\n`
    + `5. Record a real reviewer identity, role, review date, reviewed commit and the current fingerprint only in a later human-decision change.\n`
    + `6. A review decision does not by itself unlock publication, customer visibility, teacher approval, access verification, classroom/home trial status, or effectiveness claims.\n\n`
    + `## Route boundary\n\nGrade 2 first-language Estonian (\`grade-2-estonian\`) and Estonian as a second language (\`grade-2-estonian-second-language\`) are distinct subjects. The second-language role in these lessons must use only the latter route. Lesson 3 retains a separate PE missing-route boundary; human-studies source evidence cannot satisfy that PE role.\n`;
}

export async function buildLessonOriginalityReviewArtifacts(rootDir = process.cwd()) {
  const manifest = await readJson(rootDir, 'source-manifest.json');
  const built = [];
  for (const spec of LESSON_SPECS) built.push(await buildBundle(rootDir, manifest, spec));
  const index = {
    schema_version: '1.0',
    artifact_type: 'lesson_originality_review_index',
    module_id: MODULE_ID,
    review_completion_status: 'pending_human_review',
    approved_count: 0,
    pending_count: 4,
    bundles: built.map(({ bundle, spec }) => ({
      lesson_id: bundle.lesson_id,
      review_id: bundle.review_id,
      bundle_path: bundlePath(spec),
      packet_path: packetPath(spec),
      content_fingerprint: bundle.content_fingerprint.value,
      bundle_fingerprint: bundle.bundle_fingerprint.value,
      review_status: bundle.review_status,
      approval_eligible: bundle.approval_eligible,
      blocking_review_ids: bundle.blocking_review_ids,
    })),
    shared_content_scope_note: 'Shared pack-level overview, rubric and parent/homeschool support are not silently treated as lesson-specific originality decisions. Their existence remains covered by the separate teacher-pack and release-review gates.',
  };
  const files = new Map([
    [LESSON_ORIGINALITY_REVIEW_INDEX_PATH, serializeLessonOriginalityYaml(index)],
    [LESSON_ORIGINALITY_REVIEW_GUIDE_PATH, renderLessonOriginalityGuide()],
  ]);
  for (const entry of built) {
    files.set(bundlePath(entry.spec), serializeLessonOriginalityYaml(entry.bundle));
    files.set(packetPath(entry.spec), renderLessonOriginalityPacket(entry));
  }
  return { built, index, files };
}

export function lessonOriginalityBundlePaths() {
  return LESSON_SPECS.map((spec) => bundlePath(spec));
}

export function lessonOriginalityPacketPaths() {
  return LESSON_SPECS.map((spec) => packetPath(spec));
}

export async function validateLessonOriginalityReviewArtifacts(rootDir = process.cwd()) {
  const diagnostics = [];
  let expected;
  try {
    expected = await buildLessonOriginalityReviewArtifacts(rootDir);
  } catch (error) {
    return [{ code: 'bundle_build_failed', message: error.message }];
  }
  const exactLessonIds = LESSON_SPECS.map((spec) => spec.lessonId).sort(compareBytewise);
  const actualLessonIds = expected.index.bundles.map((entry) => entry.lesson_id).sort(compareBytewise);
  if (canonicalJson(actualLessonIds) !== canonicalJson(exactLessonIds)) {
    diagnostics.push({ code: 'lesson_bundle_set_mismatch', message: 'review index must contain exactly the four Grade 2 pilot lessons' });
  }
  for (const { bundle, lesson } of expected.built) {
    const existing = lesson.originality_review;
    if (bundle.review_id !== existing.review_id) {
      diagnostics.push({ code: 'review_id_mismatch', message: `${bundle.lesson_id}: bundle review_id must equal lesson originality_review.review_id` });
    }
    if (canonicalJson(bundle.covered_material_ids) !== canonicalJson(existing.covered_author_material_ids)) {
      diagnostics.push({ code: 'covered_material_mismatch', message: `${bundle.lesson_id}: bundle must cover the lesson originality-review material list exactly` });
    }
    if (bundle.review_status !== 'pending' || bundle.reviewer !== null || bundle.reviewer_role !== null || bundle.reviewed_on !== null || bundle.reviewed_version.commit_sha !== null) {
      diagnostics.push({ code: 'fabricated_human_decision', message: `${bundle.lesson_id}: prepared bundle must remain pending with null human-review fields` });
    }
    if (bundle.publication_unlocks !== false || bundle.customer_visibility_unlocks !== false) {
      diagnostics.push({ code: 'review_unlocks_release', message: `${bundle.lesson_id}: pending review cannot unlock publication or customer visibility` });
    }
    if (!bundle.source_context.route_ids.includes(SECOND_LANGUAGE_ROUTE_ID) || bundle.source_context.route_ids.includes(FIRST_LANGUAGE_ROUTE_ID)) {
      diagnostics.push({ code: 'estonian_subject_boundary', message: `${bundle.lesson_id}: second-language role must use grade-2-estonian-second-language and never grade-2-estonian` });
    }
    const expectedBlocking = bundle.task_dependencies.filter((entry) => entry.status !== 'approved').map((entry) => entry.review_id).sort(compareBytewise);
    if (canonicalJson(bundle.blocking_review_ids.slice().sort(compareBytewise)) !== canonicalJson(expectedBlocking)) {
      diagnostics.push({ code: 'task_dependency_mismatch', message: `${bundle.lesson_id}: blocking task-review IDs are stale` });
    }
    if (bundle.approval_eligible !== (expectedBlocking.length === 0)) {
      diagnostics.push({ code: 'approval_eligibility_mismatch', message: `${bundle.lesson_id}: approval eligibility must fail closed on pending task reviews` });
    }
    if (bundle.lesson_id === 'grade-2-weather-water-safety-03-safe-decisions') {
      const peRole = (lesson.author_created_subject_roles ?? []).find((entry) => entry.subject === 'physical_education');
      if (
        peRole?.source_status !== 'missing_route'
        || (peRole?.route_ids ?? []).length !== 0
        || peRole?.source_evidence_claimed !== false
        || peRole?.content_strategy !== 'author_created_required'
        || peRole?.replacement_by_human_studies_forbidden !== true
      ) {
        diagnostics.push({ code: 'pe_route_substitution', message: 'lesson 3 must preserve the physical-education missing-route boundary' });
      }
    }
  }
  return diagnostics;
}
