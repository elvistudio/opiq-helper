#!/usr/bin/env node

import path from 'node:path';
import {
  loadTeacherPackRepository,
  validateTeacherPackRepository,
} from './lib/teacher-packs.mjs';
import { computeTeacherPackFingerprintFromRepository } from './lib/teacher-pack-fingerprints.mjs';

function usageError(message) {
  throw new Error(`${message}\nUsage: node scripts/compute-teacher-pack-fingerprint.mjs [materials-index.yaml] [--list-files] [--check <sha256>]`);
}

const argumentsList = process.argv.slice(2);
let requestedIndex = null;
let listFiles = false;
let expected = null;
for (let index = 0; index < argumentsList.length; index += 1) {
  const argument = argumentsList[index];
  if (argument === '--list-files') listFiles = true;
  else if (argument === '--check') {
    expected = argumentsList[index + 1];
    if (!expected) usageError('--check requires an expected fingerprint');
    index += 1;
  } else if (argument.startsWith('-')) usageError(`unknown option ${argument}`);
  else if (requestedIndex) usageError('only one materials-index path may be supplied');
  else requestedIndex = argument;
}
if (expected && !/^[0-9a-f]{64}$/u.test(expected)) usageError('--check expects 64 lowercase hexadecimal characters');

try {
  const repository = await loadTeacherPackRepository();
  const validation = validateTeacherPackRepository(repository);
  const errors = validation.diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  if (errors.length > 0) throw new Error(`teacher-pack validation has ${errors.length} error(s): ${errors[0].reason}`);
  let indexes = repository.indexes;
  if (requestedIndex) {
    const normalized = path.posix.normalize(requestedIndex.replaceAll('\\', '/'));
    indexes = indexes.filter((artifact) => artifact.file === normalized);
    if (indexes.length !== 1) throw new Error(`teacher-pack materials index is not registered: ${requestedIndex}`);
  }
  if (expected && indexes.length !== 1) usageError('--check requires exactly one selected teacher pack');
  for (const indexArtifact of indexes) {
    const result = await computeTeacherPackFingerprintFromRepository(repository, indexArtifact);
    console.log(`pack_id: ${indexArtifact.data.pack_id}`);
    console.log(`algorithm: ${result.algorithm}`);
    console.log(`specification_version: ${result.specification_version}`);
    console.log(`fingerprint: ${result.value}`);
    console.log(`file_count: ${result.file_count}`);
    if (listFiles) {
      console.log('files:');
      for (const file of result.files) console.log(`  ${file}`);
    }
    if (expected && result.value !== expected) throw new Error(`fingerprint mismatch: expected ${expected}, found ${result.value}`);
  }
} catch (error) {
  console.error(`Teacher-pack fingerprint failed: ${error.message}`);
  process.exitCode = 1;
}
