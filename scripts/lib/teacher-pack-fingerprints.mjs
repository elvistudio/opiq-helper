import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  relativeDisplay,
  safeRepositoryPath,
} from './curriculum-maps.mjs';

export const TEACHER_PACK_FINGERPRINT_ALGORITHM = 'sha256';
export const TEACHER_PACK_FINGERPRINT_SPECIFICATION_VERSION = '1.0';
const fingerprintMagic = Buffer.from('OPIQ-HELPER-TEACHER-PACK-FINGERPRINT', 'utf8');
const allowedReviewableContentFields = new Set([
  'specification_version',
  'explicit_paths',
  'directory_paths',
  'derived_material_paths',
]);

function bytewiseCompare(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function uint64(value, label) {
  const number = typeof value === 'bigint' ? value : BigInt(value);
  if (number < 0n || number > 0xffffffffffffffffn) throw new Error(`${label} is outside unsigned 64-bit range`);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(number);
  return buffer;
}

function assertUnique(values, label) {
  const seen = new Set();
  for (const value of values ?? []) {
    if (seen.has(value)) throw new Error(`duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

function canonicalRepositoryPath(rootDir, repositoryPath, label) {
  const absolute = safeRepositoryPath(rootDir, repositoryPath, label);
  const normalized = path.posix.normalize(repositoryPath);
  if (repositoryPath !== normalized || repositoryPath.startsWith('./') || repositoryPath.endsWith('/')) {
    throw new Error(`${label} must use canonical repository-relative POSIX form: ${repositoryPath}`);
  }
  return { absolute, repositoryPath };
}

async function assertNoSymlinkComponents(rootDir, repositoryPath, label) {
  const parts = repositoryPath.split('/');
  let current = rootDir;
  for (const part of parts) {
    current = path.join(current, part);
    let stat;
    try {
      stat = await fs.lstat(current);
    } catch (error) {
      if (error.code === 'ENOENT') throw new Error(`${label} does not exist: ${repositoryPath}`);
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`${label} contains a forbidden symlink: ${relativeDisplay(rootDir, current)}`);
  }
  return fs.lstat(current);
}

function assertAllowedScopePath(repositoryPath, { indexFile, packPath, linkedPlanPaths }) {
  if (repositoryPath === indexFile || repositoryPath === `${packPath}/materials-index.yaml`) {
    throw new Error(`reviewable scope must not include materials-index.yaml: ${repositoryPath}`);
  }
  if (repositoryPath.startsWith('pedagogical-reviews/')) {
    throw new Error(`reviewable scope must not include evidence files: ${repositoryPath}`);
  }
  const insidePack = repositoryPath.startsWith(`${packPath}/`);
  if (!insidePack && !linkedPlanPaths.has(repositoryPath)) {
    throw new Error(`reviewable scope path is outside linked teacher-pack content: ${repositoryPath}`);
  }
}

async function requireRegularFile(rootDir, repositoryPath, label, scopeBoundary) {
  canonicalRepositoryPath(rootDir, repositoryPath, label);
  assertAllowedScopePath(repositoryPath, scopeBoundary);
  const stat = await assertNoSymlinkComponents(rootDir, repositoryPath, label);
  if (!stat.isFile()) throw new Error(`${label} must be a regular file: ${repositoryPath}`);
  return repositoryPath;
}

async function listDirectoryFiles(rootDir, directoryPath, scopeBoundary) {
  canonicalRepositoryPath(rootDir, directoryPath, 'reviewable directory path');
  if (!directoryPath.startsWith(`${scopeBoundary.packPath}/`)) {
    throw new Error(`reviewable directory must stay inside pack_path: ${directoryPath}`);
  }
  assertAllowedScopePath(directoryPath, scopeBoundary);
  const stat = await assertNoSymlinkComponents(rootDir, directoryPath, 'reviewable directory path');
  if (!stat.isDirectory()) throw new Error(`reviewable directory path must be a directory: ${directoryPath}`);
  const files = [];
  async function visit(currentRepositoryPath) {
    const currentAbsolute = safeRepositoryPath(rootDir, currentRepositoryPath, 'reviewable directory path');
    const entries = (await fs.readdir(currentAbsolute, { withFileTypes: true }))
      .sort((left, right) => bytewiseCompare(left.name, right.name));
    for (const entry of entries) {
      const child = `${currentRepositoryPath}/${entry.name}`;
      const childStat = await fs.lstat(path.join(currentAbsolute, entry.name));
      if (childStat.isSymbolicLink()) throw new Error(`reviewable directory contains a forbidden symlink: ${child}`);
      if (childStat.isDirectory()) await visit(child);
      else if (childStat.isFile()) {
        assertAllowedScopePath(child, scopeBoundary);
        files.push(child);
      } else throw new Error(`reviewable directory contains a non-regular entry: ${child}`);
    }
  }
  await visit(directoryPath);
  return files;
}

function assertReviewableContentShape(reviewable) {
  if (!reviewable || typeof reviewable !== 'object' || Array.isArray(reviewable)) throw new Error('reviewable_content is required');
  for (const field of Object.keys(reviewable)) {
    if (!allowedReviewableContentFields.has(field)) throw new Error(`reviewable_content does not support ${field}; manual exclusions are forbidden`);
  }
  if (reviewable.specification_version !== TEACHER_PACK_FINGERPRINT_SPECIFICATION_VERSION) throw new Error(`unsupported reviewable_content specification version: ${reviewable.specification_version ?? '<missing>'}`);
  if (reviewable.derived_material_paths !== true) throw new Error('derived_material_paths must be true so required materials cannot be excluded');
  if (!Array.isArray(reviewable.explicit_paths) || reviewable.explicit_paths.length === 0) throw new Error('reviewable_content.explicit_paths must not be empty');
  if (!Array.isArray(reviewable.directory_paths) || reviewable.directory_paths.length === 0) throw new Error('reviewable_content.directory_paths must not be empty');
  assertUnique(reviewable.explicit_paths, 'explicit reviewable path');
  assertUnique(reviewable.directory_paths, 'reviewable directory path');
}

export async function collectTeacherPackReviewableScope({
  rootDir = process.cwd(),
  indexArtifact,
  thematicArtifact,
  lessonArtifacts,
} = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const index = indexArtifact?.data ?? {};
  const reviewable = index.reviewable_content;
  assertReviewableContentShape(reviewable);
  const linkedLessons = [];
  for (const lessonId of index.lesson_ids ?? []) {
    const matches = (lessonArtifacts ?? []).filter((artifact) => artifact.data?.lesson_id === lessonId);
    if (matches.length !== 1) throw new Error(`linked lesson YAML is missing or ambiguous for ${lessonId}`);
    linkedLessons.push(matches[0]);
  }
  if (!thematicArtifact || thematicArtifact.data?.unit_id !== index.unit_ref) {
    throw new Error(`linked thematic plan is missing for ${index.unit_ref ?? '<missing>'}`);
  }
  const linkedPlanPaths = new Set([
    thematicArtifact.file,
    ...linkedLessons.map((artifact) => artifact.file),
  ]);
  const scopeBoundary = {
    indexFile: indexArtifact.file,
    packPath: index.pack_path,
    linkedPlanPaths,
  };
  for (const lesson of linkedLessons) {
    if (!(reviewable.explicit_paths ?? []).includes(lesson.file)) throw new Error(`linked lesson YAML is absent from explicit_paths: ${lesson.file}`);
  }
  if (!(reviewable.explicit_paths ?? []).includes(thematicArtifact.file)) throw new Error(`linked thematic plan is absent from explicit_paths: ${thematicArtifact.file}`);

  const discoveredPaths = [];
  for (const repositoryPath of reviewable.explicit_paths) {
    discoveredPaths.push(await requireRegularFile(absoluteRoot, repositoryPath, 'explicit reviewable path', scopeBoundary));
  }
  for (const directoryPath of reviewable.directory_paths) {
    discoveredPaths.push(...await listDirectoryFiles(absoluteRoot, directoryPath, scopeBoundary));
  }

  const materialEntries = index.materials ?? [];
  const materials = materialEntries.map((entry) => entry.material ?? {});
  const audiences = new Set(materials.map((material) => material.audience));
  for (const audience of ['teacher', 'student', 'parent']) {
    if (!audiences.has(audience)) throw new Error(`reviewable scope requires at least one ${audience} material`);
  }
  for (const materialType of ['teacher_guide', 'lesson_guide', 'rubric', 'homeschool_guide', 'answer_key']) {
    if (!materials.some((material) => material.material_type === materialType)) throw new Error(`reviewable scope requires material type ${materialType}`);
  }
  const materialPaths = [];
  for (const [indexPosition, entry] of materialEntries.entries()) {
    const material = entry.material ?? {};
    if (!material.artifact_path) throw new Error(`material ${material.material_id ?? indexPosition} has no artifact_path`);
    materialPaths.push(material.artifact_path);
    if (material.answer_key_path) materialPaths.push(material.answer_key_path);
  }
  for (const repositoryPath of materialPaths) {
    discoveredPaths.push(await requireRegularFile(absoluteRoot, repositoryPath, 'derived material path', scopeBoundary));
  }

  const paths = [...new Set(discoveredPaths)].sort(bytewiseCompare);
  const scope = new Set(paths);
  for (const lesson of linkedLessons) {
    if (!scope.has(lesson.file)) throw new Error(`linked lesson YAML is absent from fingerprint scope: ${lesson.file}`);
  }
  if (!scope.has(thematicArtifact.file)) throw new Error(`linked thematic plan is absent from fingerprint scope: ${thematicArtifact.file}`);
  for (const [indexPosition, entry] of materialEntries.entries()) {
    const material = entry.material ?? {};
    if (!scope.has(material.artifact_path)) throw new Error(`mandatory artifact_path is absent from fingerprint scope: ${material.artifact_path ?? indexPosition}`);
    if (material.answer_key_path && !scope.has(material.answer_key_path)) throw new Error(`answer_key_path is absent from fingerprint scope: ${material.answer_key_path}`);
    if (entry.required_for_pack && !scope.has(material.artifact_path)) throw new Error(`required_for_pack material is absent from fingerprint scope: ${material.material_id ?? indexPosition}`);
  }
  return { paths, linkedPlanPaths: [...linkedPlanPaths].sort(bytewiseCompare) };
}

export function computeContentFingerprintFromEntries(entries) {
  const normalized = entries.map((entry) => {
    const repositoryPath = entry.path;
    if (typeof repositoryPath !== 'string' || repositoryPath.length === 0 || repositoryPath.includes('\\')
      || path.posix.isAbsolute(repositoryPath) || repositoryPath.split('/').includes('..')
      || path.posix.normalize(repositoryPath) !== repositoryPath) {
      throw new Error(`fingerprint entry path must be canonical repository-relative POSIX: ${repositoryPath}`);
    }
    return { path: repositoryPath, bytes: Buffer.isBuffer(entry.bytes) ? entry.bytes : Buffer.from(entry.bytes) };
  });
  assertUnique(normalized.map((entry) => entry.path), 'fingerprint entry path');
  normalized.sort((left, right) => bytewiseCompare(left.path, right.path));
  const hash = createHash(TEACHER_PACK_FINGERPRINT_ALGORITHM);
  hash.update(fingerprintMagic);
  const specificationBytes = Buffer.from(TEACHER_PACK_FINGERPRINT_SPECIFICATION_VERSION, 'utf8');
  hash.update(uint64(specificationBytes.length, 'specification version length'));
  hash.update(specificationBytes);
  hash.update(uint64(normalized.length, 'file count'));
  for (const entry of normalized) {
    const pathBytes = Buffer.from(entry.path, 'utf8');
    hash.update(uint64(pathBytes.length, 'path length'));
    hash.update(pathBytes);
    hash.update(uint64(entry.bytes.length, 'content length'));
    hash.update(entry.bytes);
  }
  return {
    algorithm: TEACHER_PACK_FINGERPRINT_ALGORITHM,
    specification_version: TEACHER_PACK_FINGERPRINT_SPECIFICATION_VERSION,
    value: hash.digest('hex'),
    file_count: normalized.length,
    files: normalized.map((entry) => entry.path),
  };
}

export async function computeTeacherPackContentFingerprint(options = {}) {
  const { rootDir = process.cwd() } = options;
  const scope = await collectTeacherPackReviewableScope(options);
  const entries = [];
  for (const repositoryPath of scope.paths) {
    const absolute = safeRepositoryPath(rootDir, repositoryPath, 'fingerprint file path');
    entries.push({ path: repositoryPath, bytes: await fs.readFile(absolute) });
  }
  return computeContentFingerprintFromEntries(entries);
}

export async function computeTeacherPackFingerprintFromRepository(repository, indexArtifact) {
  const thematicArtifact = repository.plans.artifacts.find((artifact) => artifact.data?.unit_id === indexArtifact.data.unit_ref);
  const linkedIds = new Set(indexArtifact.data.lesson_ids ?? []);
  const lessonArtifacts = repository.plans.artifacts.filter((artifact) => linkedIds.has(artifact.data?.lesson_id));
  return computeTeacherPackContentFingerprint({
    rootDir: repository.rootDir,
    indexArtifact,
    thematicArtifact,
    lessonArtifacts,
  });
}
