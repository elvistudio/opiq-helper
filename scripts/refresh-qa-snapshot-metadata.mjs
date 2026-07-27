#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const manifestPath = path.join(repositoryRoot, 'source-manifest.json');
const checkOnly = process.argv.slice(2).includes('--check');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');

const legacyGeneration = {
  status: 'legacy_migrated',
  generated_at: null,
  generator: null,
  generator_version: null,
  note: 'Original generation metadata was not recorded.',
};

const controlledFields = new Set([
  'qa_schema_version',
  'artifact_type',
  'source_id',
  'source_archive',
  'output_file',
  'format_version',
  'generation',
  'checksums',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function repositoryPath(relativePath, label) {
  if (typeof relativePath !== 'string' || relativePath.trim().length === 0) {
    throw new Error(`${label} must be a non-empty repository-relative path.`);
  }
  if (path.isAbsolute(relativePath)) {
    throw new Error(`${label} must be repository-relative: ${relativePath}`);
  }

  const absolutePath = path.resolve(repositoryRoot, relativePath);
  if (absolutePath === repositoryRoot || !absolutePath.startsWith(`${repositoryRoot}${path.sep}`)) {
    throw new Error(`${label} points outside the repository: ${relativePath}`);
  }
  return absolutePath;
}

async function requireFile(relativePath, label) {
  const absolutePath = repositoryPath(relativePath, label);
  const fileStat = await stat(absolutePath).catch(() => null);
  if (!fileStat?.isFile()) {
    throw new Error(`${label} does not exist or is not a file: ${relativePath}`);
  }
  return absolutePath;
}

async function readJson(filePath, label) {
  let contents;
  try {
    contents = await readFile(filePath, 'utf8');
  } catch (error) {
    throw new Error(`${label} cannot be read: ${error.message}`);
  }

  try {
    return JSON.parse(contents);
  } catch (error) {
    throw new Error(`${label} contains invalid JSON: ${error.message}`);
  }
}

async function sha256(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

if (unknownArguments.length > 0) {
  console.error(`Unknown argument(s): ${unknownArguments.join(', ')}`);
  console.error('Usage: node scripts/refresh-qa-snapshot-metadata.mjs [--check]');
  process.exit(1);
}

const errors = [];
const snapshots = [];
let manifest;

try {
  manifest = await readJson(manifestPath, 'source-manifest.json');
  if (!isPlainObject(manifest) || !Array.isArray(manifest.sources)) {
    throw new Error('source-manifest.json must contain a sources array.');
  }
} catch (error) {
  errors.push(error.message);
}

for (const source of manifest?.sources || []) {
  if (source.qa_path === null) continue;

  const sourceLabel = typeof source.id === 'string' && source.id.length > 0
    ? source.id
    : '<unknown source>';

  try {
    if (source.source_archive === null) {
      throw new Error(`${sourceLabel}: source_archive is required when qa_path is registered.`);
    }

    const qaPath = await requireFile(source.qa_path, `${sourceLabel}: qa_path`);
    const archivePath = await requireFile(source.source_archive, `${sourceLabel}: source_archive`);
    const outputPath = await requireFile(source.md_path, `${sourceLabel}: md_path`);
    const existing = await readJson(qaPath, `${sourceLabel}: qa_path`);

    if (!isPlainObject(existing)) {
      throw new Error(`${sourceLabel}: qa_path root must be a JSON object.`);
    }

    const routeSpecificFields = Object.fromEntries(
      Object.entries(existing).filter(([field]) => !controlledFields.has(field)),
    );
    const generation = Object.hasOwn(existing, 'generation')
      ? existing.generation
      : legacyGeneration;
    const updated = {
      qa_schema_version: '1.0',
      ...(Object.hasOwn(existing, 'artifact_type')
        ? { artifact_type: existing.artifact_type }
        : {}),
      source_id: source.id,
      source_archive: source.source_archive,
      output_file: source.md_path,
      format_version: source.format_version,
      generation,
      checksums: {
        source_archive_sha256: await sha256(archivePath),
        output_file_sha256: await sha256(outputPath),
      },
      ...routeSpecificFields,
    };
    const expectedContents = `${JSON.stringify(updated, null, 2)}\n`;
    const currentContents = await readFile(qaPath, 'utf8');

    snapshots.push({
      qaPath,
      relativePath: source.qa_path,
      expectedContents,
      changed: currentContents !== expectedContents,
    });
  } catch (error) {
    errors.push(error.message);
  }
}

if (errors.length > 0) {
  console.error(`QA snapshot metadata refresh failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

const staleSnapshots = snapshots.filter(({ changed }) => changed);

if (checkOnly) {
  if (staleSnapshots.length > 0) {
    console.error(
      `QA snapshot metadata check failed: ${staleSnapshots.length} of ${snapshots.length} snapshot(s) are stale.`,
    );
    staleSnapshots.forEach(({ relativePath }) => console.error(`- ${relativePath}`));
    process.exit(1);
  }

  console.log(`QA snapshot metadata check passed: ${snapshots.length} snapshot(s) are current.`);
} else {
  for (const snapshot of staleSnapshots) {
    await writeFile(snapshot.qaPath, snapshot.expectedContents, 'utf8');
  }

  console.log(
    `QA snapshot metadata refresh complete: ${snapshots.length} snapshot(s) processed, ${staleSnapshots.length} updated.`,
  );
}
