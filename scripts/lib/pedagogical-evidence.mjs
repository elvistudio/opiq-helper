import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import Ajv2020 from 'ajv/dist/2020.js';
import { parseDocument, stringify as stringifyYaml } from 'yaml';
import {
  safeRepositoryPath,
} from './curriculum-maps.mjs';
import {
  computeActivityCatalogSelectionDigest,
  loadPedagogySelectionRepository,
  sha256PedagogyValue,
  stablePedagogyJson,
} from './pedagogy-selection.mjs';
import {
  loadPedagogyHomeschoolRepository,
} from './pedagogy-homeschool.mjs';
import {
  loadPedagogyQualityConfiguration,
  PEDAGOGY_QUALITY_ENGINE_VERSION,
} from './pedagogy-quality-gates.mjs';
import {
  computeTeacherPackFingerprintFromRepository,
} from './teacher-pack-fingerprints.mjs';
import {
  loadTeacherPackRepository,
} from './teacher-packs.mjs';

const execFileAsync = promisify(execFile);

export const PEDAGOGICAL_SNAPSHOT_VERSION = '1.1';
export const PEDAGOGICAL_EVIDENCE_SCHEMA_PATHS = Object.freeze({
  common: 'schemas/pedagogical-evidence-common.schema.json',
  teacherReview: 'schemas/teacher-review.schema.json',
  classroomTrial: 'schemas/classroom-trial.schema.json',
  homeTrial: 'schemas/home-trial.schema.json',
});

const PRIVACY_PATTERNS = Object.freeze([
  {
    code: 'email_address',
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu,
  },
  {
    code: 'phone_number',
    pattern: /\+\d(?:[\s().-]*\d){7,}/u,
  },
  {
    code: 'personal_identification_code',
    pattern: /\b[1-6]\d{10}\b/u,
  },
  {
    code: 'postal_address',
    pattern: /\b(?:(?:улица|ул\.|проспект|пр-т|переулок|tee|tänav|tn)\s+[\p{L}\d .'-]+\s+\d+[A-Za-zА-Яа-я]?|[\p{L} .'-]+\s+(?:tee|tänav|tn)\s+\d+[A-Za-z]?)\b/iu,
  },
  {
    code: 'private_media_url',
    pattern: /https?:\/\/(?:drive\.google\.com|photos\.app\.goo\.gl|dropbox\.com|icloud\.com|onedrive\.live\.com|sharepoint\.com)\S*/iu,
  },
  {
    code: 'recording_reference',
    pattern: /\b(?:audio|video|recording|аудиозапись|видеозапись|фотография ученика|õpilase foto)\b/iu,
  },
]);

function compareBytewise(left, right) {
  return Buffer.from(String(left)).compare(Buffer.from(String(right)));
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort(compareBytewise);
}

export function parseStrictPedagogicalEvidenceJson(text, file = '<memory>') {
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(`${file}: invalid JSON: ${error.message}`);
  }
  const document = parseDocument(text, {
    strict: true,
    uniqueKeys: true,
    schema: 'json',
    customTags: [],
    prettyErrors: true,
  });
  if (document.errors.length > 0) {
    throw new Error(
      `${file}: invalid JSON:\n`
      + document.errors.map((error) => error.message).join('\n'),
    );
  }
  return value;
}

async function readJson(rootDir, repositoryPath) {
  return parseStrictPedagogicalEvidenceJson(
    await fs.readFile(
      safeRepositoryPath(rootDir, repositoryPath, repositoryPath),
      'utf8',
    ),
    repositoryPath,
  );
}

async function readYaml(rootDir, repositoryPath) {
  const document = parseDocument(
    await fs.readFile(safeRepositoryPath(rootDir, repositoryPath, repositoryPath), 'utf8'),
    {
      strict: true,
      uniqueKeys: true,
      schema: 'core',
      customTags: [],
      prettyErrors: true,
    },
  );
  if (document.errors.length > 0) {
    throw new Error(
      `${repositoryPath}: invalid YAML:\n`
      + document.errors.map((error) => error.message).join('\n'),
    );
  }
  const value = document.toJS({ maxAliasCount: 1000 });
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${repositoryPath}: YAML root must be an object`);
  }
  return value;
}

export async function resolveCurrentCommitSha(rootDir = process.cwd()) {
  const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
    cwd: path.resolve(rootDir),
    encoding: 'utf8',
  });
  const value = stdout.trim();
  if (!/^[0-9a-f]{40}$/u.test(value)) throw new Error(`invalid Git HEAD SHA: ${value}`);
  return value;
}

export function pedagogicalSnapshotsMatch(recorded, current) {
  return stablePedagogyJson(recorded) === stablePedagogyJson(current);
}

export function pedagogicalEvidenceIdentityMatches(recorded, current) {
  return recorded?.content_fingerprint?.algorithm === current?.content_fingerprint?.algorithm
    && recorded?.content_fingerprint?.specification_version
      === current?.content_fingerprint?.specification_version
    && recorded?.content_fingerprint?.value === current?.content_fingerprint?.value
    && recorded?.content_fingerprint?.file_count === current?.content_fingerprint?.file_count
    && pedagogicalSnapshotsMatch(
      recorded?.pedagogical_snapshot,
      current?.pedagogical_snapshot,
    );
}

export function pedagogicalEvidenceIdentityMismatches(recorded, current) {
  const mismatches = [];
  const pairs = [
    ['content_fingerprint.algorithm', recorded?.content_fingerprint?.algorithm, current?.content_fingerprint?.algorithm],
    ['content_fingerprint.specification_version', recorded?.content_fingerprint?.specification_version, current?.content_fingerprint?.specification_version],
    ['content_fingerprint.value', recorded?.content_fingerprint?.value, current?.content_fingerprint?.value],
    ['content_fingerprint.file_count', recorded?.content_fingerprint?.file_count, current?.content_fingerprint?.file_count],
  ];
  for (const [field, actual, expected] of pairs) {
    if (actual !== expected) mismatches.push({ field, expected, actual });
  }
  const recordedSnapshot = recorded?.pedagogical_snapshot ?? {};
  const currentSnapshot = current?.pedagogical_snapshot ?? {};
  for (const field of Object.keys(currentSnapshot).sort(compareBytewise)) {
    if (stablePedagogyJson(recordedSnapshot[field]) !== stablePedagogyJson(currentSnapshot[field])) {
      mismatches.push({
        field: `pedagogical_snapshot.${field}`,
        expected: currentSnapshot[field],
        actual: recordedSnapshot[field] ?? null,
      });
    }
  }
  return mismatches;
}

export async function buildPedagogicalEvidenceIdentity({
  rootDir = process.cwd(),
  packPath = 'teacher-packs/grade-5-science/water/materials-index.yaml',
  commitSha = null,
  teacherPackRepository = null,
} = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const [
    packs,
    selection,
    homeschool,
    quality,
  ] = await Promise.all([
    teacherPackRepository ?? loadTeacherPackRepository({ rootDir: absoluteRoot }),
    loadPedagogySelectionRepository({ rootDir: absoluteRoot }),
    loadPedagogyHomeschoolRepository({
      rootDir: absoluteRoot,
      examplesOptional: true,
      skipExamples: true,
    }),
    loadPedagogyQualityConfiguration({ rootDir: absoluteRoot }),
  ]);
  const index = packs.indexes.find((artifact) => artifact.file === packPath);
  if (!index) throw new Error(`teacher pack is not registered: ${packPath}`);
  const integrationPath = index.data.pedagogical_integration?.integration_index_path;
  if (!integrationPath) {
    const error = new Error(`teacher pack ${index.data.pack_id} has no integrated pedagogy identity`);
    error.code = 'pedagogical_snapshot_not_available';
    throw error;
  }
  const integration = await readYaml(absoluteRoot, integrationPath);
  const rules = selection.rules.data;
  const homeschoolRules = homeschool.rules.data;
  const fingerprint = await computeTeacherPackFingerprintFromRepository(packs, index);
  const lessonDnaDigests = (integration.lessons ?? []).map((lesson) => ({
    lesson_id: lesson.lesson_id,
    digest: lesson.lesson_dna_digest,
  })).sort((left, right) => compareBytewise(left.lesson_id, right.lesson_id));
  if (lessonDnaDigests.length === 0) {
    throw new Error(`integration index ${integrationPath} has no lesson DNA digests`);
  }
  const identity = {
    commit_sha: commitSha ?? await resolveCurrentCommitSha(absoluteRoot),
    content_fingerprint: {
      algorithm: fingerprint.algorithm,
      specification_version: fingerprint.specification_version,
      value: fingerprint.value,
      file_count: fingerprint.file_count,
    },
    pedagogical_snapshot: {
      snapshot_version: PEDAGOGICAL_SNAPSHOT_VERSION,
      taxonomy_version: rules.taxonomy_version,
      taxonomy_digest: sha256PedagogyValue(selection.knowledge.taxonomy.data),
      selection_rules_version: rules.selection_rules_version,
      selection_rules_digest: sha256PedagogyValue(rules),
      selection_engine_version: rules.engine_version,
      lesson_dna_schema_version: rules.lesson_dna_schema_version,
      activity_catalog_digest: computeActivityCatalogSelectionDigest(
        selection.knowledge.activities.data.activities,
      ),
      homeschool_rules_version: homeschoolRules.versions.homeschool_rules_version,
      homeschool_rules_digest: sha256PedagogyValue(homeschoolRules),
      homeschool_engine_version: homeschoolRules.versions.homeschool_engine_version,
      quality_engine_version: PEDAGOGY_QUALITY_ENGINE_VERSION,
      quality_catalogue_version: quality.catalogue.catalogue_version,
      quality_catalogue_digest: sha256PedagogyValue(quality.catalogue),
      integration_version: integration.integration_version,
      unit_content_identity: integration.unit_content_identity.value,
      lesson_dna_digests: lessonDnaDigests,
    },
  };
  return {
    identity,
    index,
    fingerprint,
    checked_artifacts: uniqueSorted([
      packPath,
      integrationPath,
      selection.rules.file,
      selection.knowledge.taxonomy.file,
      selection.knowledge.activities.file,
      homeschool.rules.file,
      quality.cataloguePath,
      ...fingerprint.files,
      ...(integration.lessons ?? []).flatMap((lesson) => [
        lesson.lesson_dna_path,
        lesson.selection_request_path,
        lesson.selection_decision_path,
      ]),
    ]),
  };
}

function collectStrings(value, pointer = '', output = []) {
  if (typeof value === 'string') output.push({ pointer: pointer || '/', value });
  else if (Array.isArray(value)) {
    value.forEach((entry, index) => collectStrings(entry, `${pointer}/${index}`, output));
  } else if (value && typeof value === 'object') {
    for (const key of Object.keys(value).sort(compareBytewise)) {
      collectStrings(value[key], `${pointer}/${key}`, output);
    }
  }
  return output;
}

export function findPedagogicalEvidencePrivacyRisks(record) {
  const ignoredPointers = [
    '/evidence_identity/',
    '/artifact_paths/',
    '/pack_ref',
    '/review_id',
    '/trial_id',
    '/reviewed_at',
    '/conducted_at',
  ];
  const risks = [];
  for (const entry of collectStrings(record)) {
    if (ignoredPointers.some((prefix) => entry.pointer.startsWith(prefix))) continue;
    for (const rule of PRIVACY_PATTERNS) {
      if (rule.pattern.test(entry.value)) {
        risks.push({
          code: rule.code,
          pointer: entry.pointer,
          value: entry.value,
        });
      }
    }
  }
  return risks.sort((left, right) => (
    compareBytewise(left.pointer, right.pointer)
    || compareBytewise(left.code, right.code)
  ));
}

export function assertPedagogicalEvidencePrivacy(record) {
  const privacy = record?.privacy;
  const requiredFalse = [
    'contains_student_names',
    'contains_birth_dates',
    'contains_personal_identifiers',
    'contains_addresses',
    'contains_contact_information',
    'contains_parent_contacts',
    'contains_photographs',
    'contains_recordings',
    'contains_health_data',
    'contains_special_category_data',
    'contains_identifiable_grades',
    'contains_identifiable_profiles',
    'contains_identifiable_free_text',
  ];
  const declarationValid = requiredFalse.every((field) => privacy?.[field] === false)
    && privacy?.observations_are_aggregated === true
    && privacy?.identity_storage === 'external'
    && privacy?.free_text_checked_for_identifiers === true;
  const risks = findPedagogicalEvidencePrivacyRisks(record);
  if (!declarationValid || risks.length > 0) {
    const error = new Error(
      !declarationValid
        ? 'pedagogical evidence privacy declaration is incomplete'
        : `pedagogical evidence contains privacy-risk text at ${risks.map((risk) => risk.pointer).join(', ')}`,
    );
    error.code = 'pedagogical_evidence_privacy_invalid';
    error.risks = risks;
    throw error;
  }
  return true;
}

export async function createPedagogicalEvidenceValidators(rootDir = process.cwd()) {
  const absoluteRoot = path.resolve(rootDir);
  const schemas = {
    common: await readJson(absoluteRoot, PEDAGOGICAL_EVIDENCE_SCHEMA_PATHS.common),
    teacherReview: await readJson(
      absoluteRoot,
      PEDAGOGICAL_EVIDENCE_SCHEMA_PATHS.teacherReview,
    ),
    classroomTrial: await readJson(
      absoluteRoot,
      PEDAGOGICAL_EVIDENCE_SCHEMA_PATHS.classroomTrial,
    ),
    homeTrial: await readJson(absoluteRoot, PEDAGOGICAL_EVIDENCE_SCHEMA_PATHS.homeTrial),
  };
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  ajv.addSchema(schemas.common);
  return {
    schemas,
    validators: {
      'teacher-review': ajv.compile(schemas.teacherReview),
      'classroom-trial': ajv.compile(schemas.classroomTrial),
      'home-trial': ajv.compile(schemas.homeTrial),
    },
  };
}

export function schemaValidationMessages(validator) {
  return (validator.errors ?? []).map((error) => {
    const reason = error.keyword === 'additionalProperties'
      ? `unknown field ${error.params.additionalProperty}`
      : error.keyword === 'required'
        ? `missing required field ${error.params.missingProperty}`
        : error.message ?? `failed ${error.keyword}`;
    return `${error.instancePath || '/'}: ${reason}`;
  });
}

export function serializeCanonicalEvidenceYaml(record) {
  return stringifyYaml(record, {
    aliasDuplicateObjects: false,
    lineWidth: 100,
    sortMapEntries: (left, right) => compareBytewise(left.key?.value, right.key?.value),
  });
}
