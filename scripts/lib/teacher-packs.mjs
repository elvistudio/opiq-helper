import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  makeDiagnostic,
  parseStrictCurriculumYaml,
  relativeDisplay,
  safeRepositoryPath,
} from './curriculum-maps.mjs';
import {
  loadLessonPlanRepository,
  validateLessonPlanRepository,
} from './lesson-plans.mjs';

const hiddenAnswerPattern = /<!--[\s\S]{0,120}(?:answer|ответ|vastus)\s*:/iu;

function schemaReason(error) {
  if (error.keyword === 'additionalProperties') return `unknown field ${error.params.additionalProperty}`;
  if (error.keyword === 'required') return `missing required field ${error.params.missingProperty}`;
  return error.message ?? `failed ${error.keyword}`;
}

function normalize(value) {
  return String(value ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim();
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sameSet(left, right) {
  const a = new Set(left ?? []);
  const b = new Set(right ?? []);
  return a.size === b.size && [...a].every((value) => b.has(value));
}

function addDuplicates(diagnostics, values, file, field, label) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) diagnostics.push(makeDiagnostic('error', file, field, `duplicate ${label}: ${value}`));
    seen.add(value);
  }
}

function resolvePathDiagnostic(diagnostics, context, file, field, repositoryPath) {
  try {
    const resolved = safeRepositoryPath(context.rootDir, repositoryPath, field);
    return { resolved, display: relativeDisplay(context.rootDir, resolved) };
  } catch (error) {
    diagnostics.push(makeDiagnostic('error', file, field, error.message));
    return null;
  }
}

export async function loadTeacherPackRepository({
  rootDir = process.cwd(),
  teacherPackSchemaPath = 'schemas/teacher-pack.schema.json',
} = {}) {
  const plans = await loadLessonPlanRepository({ rootDir });
  const absoluteRoot = plans.rootDir;
  const schemaFile = safeRepositoryPath(absoluteRoot, teacherPackSchemaPath, 'teacher-pack schema path');
  const schema = JSON.parse(await fs.readFile(schemaFile, 'utf8'));
  const thematicArtifacts = plans.artifacts.filter((artifact) => artifact.data.artifact_type === 'bilingual_thematic_plan');
  const indexes = [];
  for (const thematic of thematicArtifacts) {
    if (!thematic.data.teacher_pack?.path) continue;
    const indexPath = `${thematic.data.teacher_pack.path}/materials-index.yaml`;
    const indexFile = safeRepositoryPath(absoluteRoot, indexPath, 'teacher-pack materials index path');
    const file = relativeDisplay(absoluteRoot, indexFile);
    indexes.push({ file, data: parseStrictCurriculumYaml(await fs.readFile(indexFile, 'utf8'), file) });
  }
  const fileContents = new Map();
  for (const index of indexes) {
    for (const entry of index.data.materials ?? []) {
      for (const repositoryPath of [entry.material?.artifact_path, entry.material?.answer_key_path].filter(Boolean)) {
        try {
          const filePath = safeRepositoryPath(absoluteRoot, repositoryPath, 'teacher-pack material path');
          if (!fileContents.has(repositoryPath)) fileContents.set(repositoryPath, await fs.readFile(filePath, 'utf8'));
        } catch {
          // Invalid or missing paths are reported deterministically by validation.
        }
      }
    }
  }
  return { rootDir: absoluteRoot, plans, schema, indexes, fileContents };
}

function validateIndexSchema(diagnostics, context) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  ajv.addSchema(context.plans.curriculum.schemas.course);
  ajv.addSchema(context.plans.schemas.common);
  const validator = ajv.compile(context.schema);
  for (const artifact of context.indexes) {
    if (validator(artifact.data)) continue;
    for (const error of validator.errors ?? []) {
      diagnostics.push(makeDiagnostic('error', artifact.file, error.instancePath || '/', schemaReason(error)));
    }
  }
}

function validateIndexedMaterial(diagnostics, context, artifact, entry, index, linkedLessonIds, answerKeyPaths) {
  const material = entry.material ?? {};
  const field = `/materials/${index}`;
  for (const lessonId of entry.lesson_ids ?? []) {
    if (!linkedLessonIds.has(lessonId)) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/lesson_ids`, `unknown linked lesson ${lessonId}`));
  }
  const resolved = resolvePathDiagnostic(diagnostics, context, artifact.file, `${field}/material/artifact_path`, material.artifact_path);
  const withinPack = typeof material.artifact_path === 'string'
    && (material.artifact_path === artifact.data.pack_path || material.artifact_path.startsWith(`${artifact.data.pack_path}/`));
  if (!withinPack) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/material/artifact_path`, 'teacher-pack material must stay inside pack_path'));
  const exists = resolved && context.fileContents.has(material.artifact_path);
  if (!exists) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/material/artifact_path`, `material file does not exist: ${material.artifact_path ?? '<missing>'}`));
  if (material.printable && !/\.(?:md|html)$/iu.test(material.artifact_path ?? '')) {
    diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/material/printable`, 'printable material must be Markdown or HTML'));
  }
  if (material.audience === 'student' && /\.ya?ml$/iu.test(material.artifact_path ?? '')) {
    diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/material/artifact_path`, 'student material cannot point to a YAML plan'));
  }
  if (material.answer_key_path) {
    const answerResolved = resolvePathDiagnostic(diagnostics, context, artifact.file, `${field}/material/answer_key_path`, material.answer_key_path);
    if (!answerResolved || !context.fileContents.has(material.answer_key_path)) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/material/answer_key_path`, `answer key file does not exist: ${material.answer_key_path}`));
    }
    if (!answerKeyPaths.has(material.answer_key_path)) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/material/answer_key_path`, 'answer key path must be registered as a teacher answer_key material'));
    }
  }
  if (['worksheet', 'assessment'].includes(material.material_type)
    && !material.answer_key_path
    && !material.answer_key_exemption?.open_ended) {
    diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/material/answer_key_path`, `${material.material_type} requires an answer key or open-ended exemption`));
  }
  if (material.audience === 'student') {
    const content = context.fileContents.get(material.artifact_path) ?? '';
    if (hiddenAnswerPattern.test(content)) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/material/artifact_path`, `student material contains a prohibited hidden answer marker: ${material.material_id}`));
    }
    if (/answer[-_ ]?key|ключ[-_ ]?ответ/iu.test(path.basename(material.artifact_path ?? ''))) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/material/artifact_path`, 'student material cannot be an answer-key file'));
    }
  }
  return {
    exists: Boolean(exists),
    requiredStudentPrintable: !(entry.required_for_pack && material.audience === 'student')
      || (material.printable === true && /\.(?:md|html)$/iu.test(material.artifact_path ?? '')),
  };
}

function validatePackIndex(diagnostics, context, artifact, thematic, lessonsById) {
  const data = artifact.data;
  const unit = thematic.data;
  const linkedLessonIds = new Set(unit.lesson_ids ?? []);
  if (data.unit_ref !== unit.unit_id) diagnostics.push(makeDiagnostic('error', artifact.file, '/unit_ref', `expected ${unit.unit_id}`));
  if (data.pack_path !== unit.teacher_pack?.path) diagnostics.push(makeDiagnostic('error', artifact.file, '/pack_path', `expected ${unit.teacher_pack?.path}`));
  for (const field of ['grade', 'subject', 'subject_et', 'instruction_language', 'subject_support_language']) {
    if (data[field] !== unit[field]) diagnostics.push(makeDiagnostic('error', artifact.file, `/${field}`, `must match thematic plan ${unit.unit_id}`));
  }
  if (canonicalJson(data.canonical_route) !== canonicalJson(unit.canonical_route)) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/canonical_route', 'must exactly match the thematic-plan canonical route'));
  }
  if (!sameSet(data.lesson_ids, unit.lesson_ids)) diagnostics.push(makeDiagnostic('error', artifact.file, '/lesson_ids', 'must exactly match linked thematic-plan lessons'));

  const materialEntries = data.materials ?? [];
  const materials = materialEntries.map((entry) => entry.material ?? {});
  addDuplicates(diagnostics, materials.map((material) => material.material_id), artifact.file, '/materials', 'material ID');
  const answerKeyPaths = new Set(materials
    .filter((material) => material.material_type === 'answer_key' && material.audience === 'teacher')
    .map((material) => material.artifact_path));
  let allRequiredResolved = true;
  let allRequiredStudentPrintable = true;
  for (const [index, entry] of materialEntries.entries()) {
    const state = validateIndexedMaterial(diagnostics, context, artifact, entry, index, linkedLessonIds, answerKeyPaths);
    if (entry.required_for_pack && !state.exists) allRequiredResolved = false;
    if (!state.requiredStudentPrintable) allRequiredStudentPrintable = false;
  }

  const audiences = new Set(materials.map((material) => material.audience));
  for (const audience of ['teacher', 'student', 'parent']) {
    if (!audiences.has(audience)) diagnostics.push(makeDiagnostic('error', artifact.file, '/materials', `teacher pack requires at least one ${audience} document`));
  }
  for (const materialType of ['teacher_guide', 'lesson_guide', 'rubric', 'homeschool_guide', 'answer_key']) {
    if (!materials.some((material) => material.material_type === materialType)) {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/materials', `teacher pack requires material type ${materialType}`));
    }
  }

  const indexedById = new Map(materialEntries.map((entry) => [entry.material?.material_id, entry]));
  for (const lessonId of linkedLessonIds) {
    const lesson = lessonsById.get(lessonId)?.data;
    if (!lesson) continue;
    for (const [index, material] of (lesson.evidence_linkage?.author_materials ?? []).entries()) {
      const indexed = indexedById.get(material.material_id);
      const field = `/evidence_linkage/author_materials/${index}`;
      if (!indexed) {
        diagnostics.push(makeDiagnostic('error', lessonsById.get(lessonId).file, field, `material ${material.material_id} is not registered in materials-index.yaml`));
      } else {
        if (!(indexed.lesson_ids ?? []).includes(lessonId)) diagnostics.push(makeDiagnostic('error', artifact.file, '/materials', `material ${material.material_id} does not link lesson ${lessonId}`));
        if (canonicalJson(indexed.material) !== canonicalJson(material)) {
          diagnostics.push(makeDiagnostic('error', artifact.file, '/materials', `material ${material.material_id} does not match its lesson YAML definition`));
        }
      }
    }
  }

  const lessonRecords = new Map();
  for (const lessonId of linkedLessonIds) {
    const lesson = lessonsById.get(lessonId)?.data;
    for (const record of lesson?.evidence_linkage?.opiq_records ?? []) {
      const existing = lessonRecords.get(record.record_id) ?? { canonical_url: record.canonical_url, lesson_ids: new Set() };
      if (existing.canonical_url !== record.canonical_url) diagnostics.push(makeDiagnostic('error', artifact.file, '/opiq_sources', `record ${record.record_id} has inconsistent canonical URLs across lessons`));
      existing.lesson_ids.add(lessonId);
      lessonRecords.set(record.record_id, existing);
    }
  }
  addDuplicates(diagnostics, (data.opiq_sources ?? []).map((source) => source.record_id), artifact.file, '/opiq_sources', 'Opiq record ID');
  if (!sameSet((data.opiq_sources ?? []).map((source) => source.record_id), [...lessonRecords.keys()])) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/opiq_sources', 'must exactly index the Opiq records used by linked lessons'));
  }
  for (const [index, source] of (data.opiq_sources ?? []).entries()) {
    const expected = lessonRecords.get(source.record_id);
    if (!expected) continue;
    if (source.canonical_url !== expected.canonical_url) diagnostics.push(makeDiagnostic('error', artifact.file, `/opiq_sources/${index}/canonical_url`, `expected ${expected.canonical_url}`));
    if (!sameSet(source.lesson_ids, [...expected.lesson_ids])) diagnostics.push(makeDiagnostic('error', artifact.file, `/opiq_sources/${index}/lesson_ids`, 'must match lessons that use this canonical Opiq record'));
  }

  for (const lessonId of linkedLessonIds) {
    const guide = materialEntries.find((entry) => entry.material?.material_type === 'lesson_guide' && (entry.lesson_ids ?? []).includes(lessonId));
    if (!guide) {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/materials', `missing teacher lesson guide for ${lessonId}`));
      continue;
    }
    const guideContent = context.fileContents.get(guide.material.artifact_path) ?? '';
    for (const source of (data.opiq_sources ?? []).filter((entry) => entry.lesson_ids.includes(lessonId))) {
      if (!guideContent.includes(source.canonical_url)) diagnostics.push(makeDiagnostic('error', artifact.file, '/opiq_sources', `lesson guide ${lessonId} is missing direct Opiq URL ${source.canonical_url}`));
    }
  }

  const pack = unit.teacher_pack ?? {};
  if (pack.materials_resolved && !allRequiredResolved) diagnostics.push(makeDiagnostic('error', thematic.file, '/teacher_pack/materials_resolved', 'materials_resolved cannot be true while a required indexed file is missing'));
  if (pack.print_ready && !allRequiredStudentPrintable) diagnostics.push(makeDiagnostic('error', thematic.file, '/teacher_pack/print_ready', 'print_ready cannot be true while a required student material is not printable'));
  const readiness = [...linkedLessonIds].map((id) => lessonsById.get(id)?.data.artifact_readiness).filter(Boolean);
  if (pack.teacher_review_status === 'pending' || readiness.some((entry) => entry.teacher_review?.status === 'pending')) {
    diagnostics.push(makeDiagnostic('warning', thematic.file, '/teacher_pack/teacher_review_status', 'teacher pack is complete but independent primary-science teacher review is pending'));
  }
  if (readiness.some((entry) => entry.classroom_trial?.status === 'not_tested')) {
    diagnostics.push(makeDiagnostic('warning', thematic.file, '/teacher_pack/classroom_ready', 'teacher pack has not been tested in a classroom; classroom_ready remains false'));
  }
  if (pack.classroom_ready) {
    const readinessWarnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning' && diagnostic.field.startsWith('/teacher_pack/'));
    if (readinessWarnings.length > 0) diagnostics.push(makeDiagnostic('error', thematic.file, '/teacher_pack/classroom_ready', 'classroom_ready cannot be true while readiness warnings remain unresolved'));
  }
  return {
    materials: materials.length,
    studentDocuments: new Set(materials
      .filter((material) => material.audience === 'student')
      .map((material) => material.artifact_path)).size,
  };
}

export function validateTeacherPackRepository(context) {
  const diagnostics = [];
  validateIndexSchema(diagnostics, context);
  const planResult = validateLessonPlanRepository(context.plans);
  diagnostics.push(...planResult.diagnostics.filter((diagnostic) => diagnostic.severity === 'error'));
  if (context.indexes.length === 0) diagnostics.push(makeDiagnostic('error', 'teacher-packs', '/', 'at least one teacher-pack materials index is required'));
  const lessonsById = new Map(context.plans.artifacts
    .filter((artifact) => artifact.data.artifact_type === 'bilingual_lesson')
    .map((artifact) => [artifact.data.lesson_id, artifact]));
  const thematicById = new Map(context.plans.artifacts
    .filter((artifact) => artifact.data.artifact_type === 'bilingual_thematic_plan')
    .map((artifact) => [artifact.data.unit_id, artifact]));
  let materials = 0;
  let studentDocuments = 0;
  for (const index of context.indexes) {
    const thematic = thematicById.get(index.data.unit_ref);
    if (!thematic) {
      diagnostics.push(makeDiagnostic('error', index.file, '/unit_ref', `unknown thematic plan ${index.data.unit_ref ?? '<missing>'}`));
      continue;
    }
    const summary = validatePackIndex(diagnostics, context, index, thematic, lessonsById);
    materials += summary.materials;
    studentDocuments += summary.studentDocuments;
  }
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length;
  return {
    diagnostics,
    summary: {
      packs: context.indexes.length,
      lessons: lessonsById.size,
      materials,
      studentDocuments,
      errors,
      warnings,
    },
  };
}

export function formatTeacherPackDiagnostic(diagnostic) {
  return `[${diagnostic.severity.toUpperCase()}] ${diagnostic.file} ${diagnostic.field}: ${diagnostic.reason}`;
}
