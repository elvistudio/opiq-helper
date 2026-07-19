#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { readCompactZip, readZipText, requireZipMember } from './lib/compact-zip.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const manifestPath = path.join(repositoryRoot, 'source-manifest.json');
const errors = [];
let checkedRecordCount = 0;
let checkedQaSnapshotCount = 0;

const legacyGenerationNote = 'Original generation metadata was not recorded.';
const sha256Pattern = /^[0-9a-f]{64}$/;
const isoUtcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const isoTimestampWithZonePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function fail(message) {
  errors.push(message);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeLanguage(value) {
  return value.replace(/\s+/g, '').toLowerCase();
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    fail(`Cannot parse ${path.relative(repositoryRoot, filePath)}: ${error.message}`);
    return null;
  }
}

async function requireFile(relativePath, label) {
  if (!isNonEmptyString(relativePath)) {
    fail(`${label} must be a non-empty repository-relative path.`);
    return null;
  }

  if (path.isAbsolute(relativePath)) {
    fail(`${label} must be repository-relative: ${relativePath}`);
    return null;
  }

  const absolutePath = path.resolve(repositoryRoot, relativePath);
  if (absolutePath !== repositoryRoot && !absolutePath.startsWith(`${repositoryRoot}${path.sep}`)) {
    fail(`${label} points outside the repository: ${relativePath}`);
    return null;
  }

  try {
    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile()) {
      fail(`${label} is not a file: ${relativePath}`);
      return null;
    }
    return absolutePath;
  } catch {
    fail(`${label} does not exist: ${relativePath}`);
    return null;
  }
}

async function readQaJson(filePath, label) {
  try {
    return {
      ok: true,
      value: JSON.parse(await readFile(filePath, 'utf8')),
    };
  } catch (error) {
    fail(`${label}: qa_path contains invalid JSON: ${error.message}`);
    return { ok: false, value: null };
  }
}

async function sha256(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

function validateQaRepositoryPath(value, sourceLabel, field) {
  if (!isNonEmptyString(value)) {
    fail(`${sourceLabel}: ${field} must be a non-empty repository-relative path.`);
    return;
  }
  if (path.isAbsolute(value)) {
    fail(`${sourceLabel}: ${field} must be repository-relative: ${value}`);
    return;
  }

  const absolutePath = path.resolve(repositoryRoot, value);
  if (absolutePath === repositoryRoot || !absolutePath.startsWith(`${repositoryRoot}${path.sep}`)) {
    fail(`${sourceLabel}: ${field} points outside the repository: ${value}`);
  }
}

function findAbsoluteFilePaths(value, field = '<root>', results = []) {
  if (typeof value === 'string') {
    const windowsAbsolutePath = /^[A-Za-z]:[\\/]/.test(value) || /^\\\\/.test(value);
    if (path.isAbsolute(value) || windowsAbsolutePath) {
      results.push({ field, value });
    }
    return results;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => findAbsoluteFilePaths(entry, `${field}[${index}]`, results));
    return results;
  }
  if (isPlainObject(value)) {
    Object.entries(value).forEach(([key, entry]) => {
      findAbsoluteFilePaths(entry, field === '<root>' ? key : `${field}.${key}`, results);
    });
  }
  return results;
}

function validateNumericCounters(value, sourceLabel, field = '<root>') {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0) {
      fail(`${sourceLabel}: ${field} must be a non-negative integer.`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateNumericCounters(entry, sourceLabel, `${field}[${index}]`));
    return;
  }
  if (isPlainObject(value)) {
    Object.entries(value).forEach(([key, entry]) => {
      validateNumericCounters(entry, sourceLabel, field === '<root>' ? key : `${field}.${key}`);
    });
  }
}

function validateCountMap(qa, sourceLabel, field, expectedCount) {
  const countMap = qa[field];
  if (!isPlainObject(countMap)) {
    fail(`${sourceLabel}: ${field} must be an object.`);
    return;
  }

  let total = 0;
  for (const [key, value] of Object.entries(countMap)) {
    if (!Number.isInteger(value) || value < 0) {
      fail(`${sourceLabel}: ${field}.${key} must be a non-negative integer.`);
      continue;
    }
    total += value;
  }

  if (Number.isInteger(expectedCount) && total !== expectedCount) {
    fail(`${sourceLabel}: sum of ${field} is ${total}, expected ${expectedCount}.`);
  }
}

async function validateQaSnapshot(
  source,
  qa,
  archivePath,
  outputPath,
  allowedLanguages,
  compactMetadata = null,
) {
  const sourceLabel = source.id;
  if (!isPlainObject(qa)) {
    fail(`${sourceLabel}: qa_path root must be a JSON object.`);
    return;
  }

  const requiredFields = [
    'qa_schema_version',
    'source_id',
    'source_archive',
    'output_file',
    'format_version',
    'generation',
    'checksums',
    'source_records',
    'page_records_included',
    'grades',
    'languages',
    'books',
  ];
  requiredFields.forEach((field) => {
    if (!Object.hasOwn(qa, field)) {
      fail(`${sourceLabel}: missing required field ${field}.`);
    }
  });

  if (qa.qa_schema_version !== '1.0') {
    fail(`${sourceLabel}: qa_schema_version must be "1.0".`);
  }
  if (qa.source_id !== source.id) {
    fail(`${sourceLabel}: source_id must equal manifest id "${source.id}".`);
  }
  if (qa.source_archive !== source.source_archive) {
    fail(`${sourceLabel}: source_archive must equal manifest source_archive "${source.source_archive}".`);
  }
  if (qa.output_file !== source.md_path) {
    fail(`${sourceLabel}: output_file must equal manifest md_path "${source.md_path}".`);
  }
  if (qa.format_version !== source.format_version) {
    fail(`${sourceLabel}: format_version must equal manifest format_version "${source.format_version}".`);
  }

  validateQaRepositoryPath(qa.source_archive, sourceLabel, 'source_archive');
  validateQaRepositoryPath(qa.output_file, sourceLabel, 'output_file');
  findAbsoluteFilePaths(qa).forEach(({ field, value }) => {
    fail(`${sourceLabel}: ${field} contains an absolute file path: ${value}`);
  });

  const generation = qa.generation;
  if (!isPlainObject(generation)) {
    fail(`${sourceLabel}: generation must be an object.`);
  } else if (!['legacy_migrated', 'generated'].includes(generation.status)) {
    fail(`${sourceLabel}: generation.status must be "legacy_migrated" or "generated".`);
  } else if (generation.status === 'legacy_migrated') {
    if (generation.generated_at !== null) {
      fail(`${sourceLabel}: generation.generated_at must be null for legacy_migrated snapshots.`);
    }
    if (generation.generator !== null) {
      fail(`${sourceLabel}: generation.generator must be null for legacy_migrated snapshots.`);
    }
    if (generation.generator_version !== null) {
      fail(`${sourceLabel}: generation.generator_version must be null for legacy_migrated snapshots.`);
    }
    if (generation.note !== legacyGenerationNote) {
      fail(`${sourceLabel}: generation.note must document missing original generation metadata.`);
    }
  } else {
    if (
      !isNonEmptyString(generation.generated_at)
      || !isoUtcPattern.test(generation.generated_at)
      || Number.isNaN(Date.parse(generation.generated_at))
    ) {
      fail(`${sourceLabel}: generation.generated_at must be a valid ISO 8601 UTC timestamp.`);
    }
    if (!isNonEmptyString(generation.generator)) {
      fail(`${sourceLabel}: generation.generator must be a non-empty string for generated snapshots.`);
    } else {
      await requireFile(generation.generator, `${sourceLabel} generation.generator`);
    }
    if (!isNonEmptyString(generation.generator_version)) {
      fail(`${sourceLabel}: generation.generator_version must be a non-empty string for generated snapshots.`);
    }
    if (!Object.hasOwn(generation, 'note') || (generation.note !== null && typeof generation.note !== 'string')) {
      fail(`${sourceLabel}: generation.note must be a string or null for generated snapshots.`);
    }
  }

  const checksums = qa.checksums;
  if (!isPlainObject(checksums)) {
    fail(`${sourceLabel}: checksums must be an object.`);
  } else {
    for (const field of ['source_archive_sha256', 'output_file_sha256']) {
      if (!sha256Pattern.test(checksums[field] || '')) {
        fail(`${sourceLabel}: checksums.${field} must be 64 lowercase hexadecimal characters.`);
      }
    }

    if (archivePath) {
      const actualArchiveChecksum = await sha256(archivePath);
      if (checksums.source_archive_sha256 !== actualArchiveChecksum) {
        fail(`${sourceLabel}: checksums.source_archive_sha256 does not match source_archive.`);
      }
    }
    if (outputPath) {
      const actualOutputChecksum = await sha256(outputPath);
      if (checksums.output_file_sha256 !== actualOutputChecksum) {
        fail(`${sourceLabel}: checksums.output_file_sha256 does not match output_file.`);
      }
    }
  }

  validateNumericCounters(qa, sourceLabel);

  for (const field of ['source_records', 'page_records_included']) {
    if (!Number.isInteger(qa[field]) || qa[field] < 0) {
      fail(`${sourceLabel}: ${field} must be a non-negative integer.`);
    }
  }

  if (qa.page_records_included !== source.record_count) {
    fail(
      `${sourceLabel}: page_records_included is ${qa.page_records_included}, expected manifest record_count ${source.record_count}.`,
    );
  }

  if (compactMetadata) {
    const derivedRequiredFields = [
      'cover_detail_records_excluded',
      'administrative_records_excluded',
      'duplicate_records_excluded',
      'duplicate_url_audit',
      'records_without_headings',
      'missing_urls',
      'source_provenance',
      'kits',
    ];
    if (source.id === 'grade-1-mathematics') derivedRequiredFields.push('topic_audit');
    if (source.id === 'grade-3-mathematics') {
      derivedRequiredFields.push(
        'subject_normalization_audit',
        'source_subject_counts',
        'canonical_subject_counts',
      );
    }
    derivedRequiredFields.forEach((field) => {
      if (!Object.hasOwn(qa, field)) fail(`${sourceLabel}: missing derived QA field ${field}.`);
    });
    if (qa.source_records !== compactMetadata.recordCount) {
      fail(
        `${sourceLabel}: source_records is ${qa.source_records}, expected compact index recordCount ${compactMetadata.recordCount}.`,
      );
    }
    if (JSON.stringify(qa.source_provenance) !== JSON.stringify(source.source_provenance)) {
      fail(`${sourceLabel}: source_provenance must exactly match the manifest declaration.`);
    }
    const accountedSourceRecords = qa.page_records_included
      + qa.cover_detail_records_excluded
      + qa.administrative_records_excluded
      + qa.duplicate_records_excluded;
    if (accountedSourceRecords !== qa.source_records) {
      fail(
        `${sourceLabel}: included and excluded QA counters account for ${accountedSourceRecords} source records, expected ${qa.source_records}.`,
      );
    }
    if (Object.hasOwn(qa, 'source_subject_counts')) {
      validateCountMap(qa, sourceLabel, 'source_subject_counts', qa.source_records);
    }
    if (Object.hasOwn(qa, 'canonical_subject_counts')) {
      validateCountMap(qa, sourceLabel, 'canonical_subject_counts', qa.page_records_included);
    }
  }

  validateCountMap(qa, sourceLabel, 'grades', qa.page_records_included);
  validateCountMap(qa, sourceLabel, 'languages', qa.page_records_included);
  validateCountMap(qa, sourceLabel, 'books', qa.page_records_included);
  if (Object.hasOwn(qa, 'kits')) validateCountMap(qa, sourceLabel, 'kits', qa.page_records_included);

  if (isPlainObject(qa.languages)) {
    Object.keys(qa.languages).forEach((language) => {
      const normalizedLanguage = normalizeLanguage(language);
      if (!allowedLanguages.includes(normalizedLanguage)) {
        fail(
          `${sourceLabel}: languages.${language} is not included in manifest languages (${allowedLanguages.join(', ')}).`,
        );
      }
    });
  }
}

function splitMarkdownRecords(markdown) {
  const lines = markdown.split(/\r?\n/);
  const numberedRecord = /^###\s+\d+\.\s+/;
  const plainRecord = /^##\s+/;
  const startPattern = lines.some((line) => numberedRecord.test(line))
    ? numberedRecord
    : plainRecord;
  const starts = [];

  lines.forEach((line, index) => {
    if (startPattern.test(line)) starts.push(index);
  });

  return starts.map((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1] : lines.length;
    return lines.slice(start, end).join('\n');
  });
}

async function validateSubjectBoundaryConfig(source, sourceLabel) {
  if (!Object.hasOwn(source, 'subject_boundary')) return;

  const boundary = source.subject_boundary;
  if (!isPlainObject(boundary)) {
    fail(`${sourceLabel}: subject_boundary must be an object.`);
    return;
  }

  if (!Array.isArray(boundary.forbidden_book_ids) || boundary.forbidden_book_ids.length === 0) {
    fail(`${sourceLabel}: subject_boundary.forbidden_book_ids must be a non-empty array.`);
  } else {
    const seenBookIds = new Set();
    boundary.forbidden_book_ids.forEach((bookId, index) => {
      if (!isNonEmptyString(bookId)) {
        fail(`${sourceLabel}: subject_boundary.forbidden_book_ids[${index}] must be a non-empty string.`);
      } else if (seenBookIds.has(bookId)) {
        fail(`${sourceLabel}: subject_boundary.forbidden_book_ids contains duplicate book ID "${bookId}".`);
      } else {
        seenBookIds.add(bookId);
      }
    });
  }

  if (!isNonEmptyString(boundary.reason)) {
    fail(`${sourceLabel}: subject_boundary.reason must be a non-empty string.`);
  }

  await requireFile(boundary.audit_path, `${sourceLabel} subject_boundary.audit_path`);
}

function validateCanonicalUrlPolicy(source, sourceLabel) {
  if (!Object.hasOwn(source, 'canonical_url_policy')) return;

  const policy = source.canonical_url_policy;
  if (!isPlainObject(policy)) {
    fail(`${sourceLabel}: canonical_url_policy must be an object.`);
    return;
  }
  if (typeof policy.require_unique !== 'boolean') {
    fail(`${sourceLabel}: canonical_url_policy.require_unique must be a boolean.`);
  }
}

function validateCanonicalSubjectPolicy(source, sourceLabel) {
  if (!Object.hasOwn(source, 'canonical_subject_policy')) return;

  const policy = source.canonical_subject_policy;
  if (!isPlainObject(policy)) {
    fail(`${sourceLabel}: canonical_subject_policy must be an object.`);
    return;
  }
  if (!isPlainObject(policy.required_subject)) {
    fail(`${sourceLabel}: canonical_subject_policy.required_subject must be an object.`);
    return;
  }
  for (const language of ['en', 'et', 'ru']) {
    if (!isNonEmptyString(policy.required_subject[language])) {
      fail(`${sourceLabel}: canonical_subject_policy.required_subject.${language} must be a non-empty string.`);
    }
  }
}

async function validateSourceProvenance(source, sourceLabel, archivePath, allowedLanguages) {
  if (!Object.hasOwn(source, 'source_provenance')) return null;

  const provenance = source.source_provenance;
  if (!isPlainObject(provenance)) {
    fail(`${sourceLabel}: source_provenance must be an object.`);
    return null;
  }
  findAbsoluteFilePaths(provenance).forEach(({ field, value }) => {
    fail(`${sourceLabel}: source_provenance.${field} contains an absolute file path: ${value}`);
  });

  if (provenance.kind !== 'derived_compact_snapshot') {
    fail(`${sourceLabel}: source_provenance.kind must be "derived_compact_snapshot".`);
  }
  validateQaRepositoryPath(provenance.archive_path, sourceLabel, 'source_provenance.archive_path');
  if (provenance.archive_path !== source.source_archive) {
    fail(`${sourceLabel}: source_provenance.archive_path must equal source_archive.`);
  }
  if (
    !isNonEmptyString(provenance.declared_original_archive)
    || path.basename(provenance.declared_original_archive) !== provenance.declared_original_archive
    || !provenance.declared_original_archive.toLowerCase().endsWith('.zip')
  ) {
    fail(`${sourceLabel}: source_provenance.declared_original_archive must be a ZIP base name.`);
  }
  if (
    !isNonEmptyString(provenance.compact_generated_at)
    || !isoTimestampWithZonePattern.test(provenance.compact_generated_at)
    || Number.isNaN(Date.parse(provenance.compact_generated_at))
  ) {
    fail(`${sourceLabel}: source_provenance.compact_generated_at must be an ISO 8601 timestamp with a time zone.`);
  }
  if (provenance.original_archive_available !== false) {
    fail(`${sourceLabel}: source_provenance.original_archive_available must be false for a derived compact snapshot.`);
  }
  if (!isNonEmptyString(provenance.limitations)) {
    fail(`${sourceLabel}: source_provenance.limitations must be a non-empty string.`);
  }

  const mandatoryMembers = ['index.json', 'opiq_lookup.jsonl', 'opiq_lookup.md', 'topic_map.json'];
  if (!Array.isArray(provenance.required_members) || provenance.required_members.length === 0) {
    fail(`${sourceLabel}: source_provenance.required_members must be a non-empty array.`);
    return null;
  }
  const requiredMembers = new Set();
  provenance.required_members.forEach((name, index) => {
    if (!isNonEmptyString(name)) {
      fail(`${sourceLabel}: source_provenance.required_members[${index}] must be a non-empty string.`);
    } else if (requiredMembers.has(name)) {
      fail(`${sourceLabel}: source_provenance.required_members contains duplicate member ${name}.`);
    } else {
      requiredMembers.add(name);
    }
  });
  mandatoryMembers.forEach((name) => {
    if (!requiredMembers.has(name)) {
      fail(`${sourceLabel}: source_provenance.required_members is missing ${name}.`);
    }
  });
  if (!archivePath) return null;

  try {
    const archive = await readCompactZip(archivePath);
    for (const name of requiredMembers) requireZipMember(archive, name);

    const index = JSON.parse(readZipText(archive, 'index.json'));
    if (!isPlainObject(index)) throw new Error('index.json root must be an object.');
    if (index.formatVersion !== source.format_version) {
      fail(`${sourceLabel}: compact index.json formatVersion must equal manifest format_version.`);
    }
    if (index.generatedAt !== provenance.compact_generated_at) {
      fail(`${sourceLabel}: compact index.json generatedAt must equal source_provenance.compact_generated_at.`);
    }
    if (index.sourceArchive !== provenance.declared_original_archive) {
      fail(`${sourceLabel}: compact index.json sourceArchive must equal source_provenance.declared_original_archive.`);
    }
    if (!Number.isInteger(index.recordCount) || index.recordCount < 1) {
      fail(`${sourceLabel}: compact index.json recordCount must be a positive integer.`);
    }
    if (!Array.isArray(index.files)) {
      fail(`${sourceLabel}: compact index.json files must be an array.`);
    } else {
      mandatoryMembers.forEach((name) => {
        if (!index.files.includes(name)) fail(`${sourceLabel}: compact index.json files is missing ${name}.`);
      });
      index.files.forEach((name) => {
        if (!archive.entries.has(name)) fail(`${sourceLabel}: compact index.json lists missing ZIP member ${name}.`);
      });
    }

    if (!Array.isArray(index.supportedQueryLanguages)) {
      fail(`${sourceLabel}: compact index.json supportedQueryLanguages must be an array.`);
    } else {
      const compactLanguages = [...new Set(index.supportedQueryLanguages.map(normalizeLanguage))].sort();
      if (JSON.stringify(compactLanguages) !== JSON.stringify([...allowedLanguages].sort())) {
        fail(`${sourceLabel}: compact index.json supportedQueryLanguages must match manifest languages.`);
      }
    }

    const jsonlLines = readZipText(archive, 'opiq_lookup.jsonl')
      .split(/\r?\n/)
      .filter((line) => line.trim());
    jsonlLines.forEach((line, index) => {
      let record;
      try {
        record = JSON.parse(line);
      } catch (error) {
        throw new Error(`opiq_lookup.jsonl line ${index + 1} is invalid JSON: ${error.message}`);
      }
      if (!isPlainObject(record)) throw new Error(`opiq_lookup.jsonl line ${index + 1} must be an object.`);
      if (!isNonEmptyString(record.url) || !/^https:\/\/(?:www\.)?opiq\.ee\//i.test(record.url)) {
        throw new Error(`opiq_lookup.jsonl line ${index + 1} has an invalid URL.`);
      }
    });
    if (jsonlLines.length !== index.recordCount) {
      fail(
        `${sourceLabel}: compact index.json recordCount is ${index.recordCount}, but opiq_lookup.jsonl contains ${jsonlLines.length} records.`,
      );
    }
    if (!readZipText(archive, 'opiq_lookup.md').trim()) {
      fail(`${sourceLabel}: compact opiq_lookup.md must not be empty.`);
    }
    const topicMap = JSON.parse(readZipText(archive, 'topic_map.json'));
    if (!isPlainObject(topicMap)) fail(`${sourceLabel}: compact topic_map.json root must be an object.`);

    return { recordCount: index.recordCount };
  } catch (error) {
    fail(`${sourceLabel}: source_provenance compact archive validation failed: ${error.message}`);
    return null;
  }
}

function validateMarkdown(source, markdown, allowedLanguages) {
  const records = splitMarkdownRecords(markdown);
  const forbiddenBookIds = new Set(source.subject_boundary?.forbidden_book_ids || []);
  const seenUrls = new Map();
  if (records.length !== source.record_count) {
    fail(
      `${source.id}: record_count is ${source.record_count}, but ${source.md_path} contains ${records.length} records.`,
    );
  }

  records.forEach((record, index) => {
    const headingRecordNumber = record.match(/^###\s+(\d+)\.\s+/m)?.[1];
    const recordNumber = headingRecordNumber || String(index + 1);
    const recordLabel = `${source.id} record ${recordNumber}`;
    const urlMatch = record.match(/^(?:-\s+)?URL:\s+(https?:\/\/(?:www\.)?opiq\.ee\/\S+)\s*$/mi);
    if (!urlMatch) {
      fail(`${recordLabel}: missing a direct Opiq URL.`);
    } else if (source.canonical_url_policy?.require_unique === true) {
      const previousRecordNumber = seenUrls.get(urlMatch[1]);
      if (previousRecordNumber) {
        fail(
          `${source.id}: duplicate canonical URL ${urlMatch[1]} appears in records ${previousRecordNumber} and ${recordNumber}.`,
        );
      } else {
        seenUrls.set(urlMatch[1], recordNumber);
      }
    }

    if (forbiddenBookIds.size > 0) {
      const bookIdMatch = record.match(/^(?:-\s+)?Book ID:\s*(.+?)\s*$/mi);
      const bookId = bookIdMatch?.[1].trim();
      if (!bookId) {
        fail(`${recordLabel}: missing Book ID required by subject_boundary.`);
      } else if (forbiddenBookIds.has(bookId)) {
        fail(
          `${recordLabel}: URL ${urlMatch?.[1] || '<missing>'} has forbidden Book ID "${bookId}" from subject_boundary.forbidden_book_ids.`,
        );
      }
    }

    const classMatch = record.match(/^(?:-\s+)?Class:\s*(.+?)\s*$/mi);
    if (!classMatch || !classMatch[1].trim()) {
      fail(`${recordLabel}: class is empty.`);
    }

    const subjectMatch = record.match(/^(?:-\s+)?Subject(?:\s+ET)?:\s*(.+?)\s*$/mi);
    if (!subjectMatch || !subjectMatch[1].trim()) {
      fail(`${recordLabel}: subject is empty.`);
    } else if (source.canonical_subject_policy?.required_subject) {
      const required = source.canonical_subject_policy.required_subject;
      const expectedSubject = `${required.en} / ${required.et} / ${required.ru}`;
      const actualSubject = subjectMatch[1].trim();
      if (actualSubject !== expectedSubject) {
        fail(
          `${recordLabel}: URL ${urlMatch?.[1] || '<missing>'} has Subject "${actualSubject}"; expected "${expectedSubject}" from canonical_subject_policy.`,
        );
      }
    }

    const languageMatch = record.match(/^(?:-\s+)?Language:\s*(.*?)\s*$/mi);
    const foundLanguage = languageMatch
      ? normalizeLanguage(languageMatch[1])
      : '';
    if (!foundLanguage || !allowedLanguages.includes(foundLanguage)) {
      fail(
        `${recordLabel}: found language "${foundLanguage || '<missing>'}"; allowed languages: ${allowedLanguages.join(', ') || '<none>'}.`,
      );
    }
  });

  return records.length;
}

const manifest = await readJson(manifestPath);
if (!manifest) {
  process.exitCode = 1;
} else {
  if (!Array.isArray(manifest.sources) || manifest.sources.length === 0) {
    fail('sources must be a non-empty array.');
  }

  const ids = new Set();
  const routes = new Set();
  const criticalQualityMarkers = new Map([
    ['grade-1-science', 'needs_review'],
  ]);

  for (const [index, source] of (manifest.sources || []).entries()) {
    const label = isNonEmptyString(source.id) ? source.id : `source ${index + 1}`;

    if (!isNonEmptyString(source.id)) {
      fail(`${label}: id is empty.`);
    } else if (ids.has(source.id)) {
      fail(`${label}: duplicate id.`);
    } else {
      ids.add(source.id);
    }

    if (!Number.isInteger(source.grade) || source.grade < 1) {
      fail(`${label}: grade must be a positive integer.`);
    }
    if (!isNonEmptyString(source.subject)) {
      fail(`${label}: subject is empty.`);
    }
    if (!isNonEmptyString(source.subject_et)) {
      fail(`${label}: subject_et is empty.`);
    }
    const normalizedSourceLanguages = [];
    const seenSourceLanguages = new Set();
    if (!Array.isArray(source.languages) || source.languages.length === 0) {
      fail(`${label}: languages must be a non-empty array.`);
    } else {
      source.languages.forEach((language, languageIndex) => {
        if (!isNonEmptyString(language)) {
          fail(`${label}: languages[${languageIndex}] must be a non-empty string.`);
          return;
        }

        const normalizedLanguage = normalizeLanguage(language);
        if (language !== language.toLowerCase()) {
          fail(`${label}: language "${language}" must be lowercase.`);
        }
        if (seenSourceLanguages.has(normalizedLanguage)) {
          fail(`${label}: duplicate language "${normalizedLanguage}".`);
          return;
        }

        seenSourceLanguages.add(normalizedLanguage);
        normalizedSourceLanguages.push(normalizedLanguage);
      });
    }
    if (!Number.isInteger(source.record_count) || source.record_count < 1) {
      fail(`${label}: record_count must be a positive integer.`);
    }
    if (!isNonEmptyString(source.quality_status)) {
      fail(`${label}: quality_status is empty.`);
    }

    await validateSubjectBoundaryConfig(source, label);
    validateCanonicalUrlPolicy(source, label);
    validateCanonicalSubjectPolicy(source, label);

    const route = `${source.grade}\u0000${source.subject}\u0000${source.md_path}`;
    if (routes.has(route)) {
      fail(`${label}: duplicate grade + subject + md_path route.`);
    } else {
      routes.add(route);
    }

    const expectedQuality = criticalQualityMarkers.get(source.id);
    if (expectedQuality && source.quality_status !== expectedQuality) {
      fail(`${label}: known problematic source must have quality_status ${expectedQuality}.`);
    }
    if (expectedQuality && (!Array.isArray(source.known_issues) || source.known_issues.length === 0)) {
      fail(`${label}: known problematic source must list known_issues.`);
    }

    const mdPath = await requireFile(source.md_path, `${label} md_path`);
    let archivePath = null;
    if (isNonEmptyString(source.source_archive)) {
      archivePath = await requireFile(source.source_archive, `${label} source_archive`);
    } else if (source.source_archive !== null) {
      fail(`${label}: source_archive must be a path or null.`);
    }
    const compactMetadata = await validateSourceProvenance(
      source,
      label,
      archivePath,
      normalizedSourceLanguages,
    );
    let qaPath = null;
    if (isNonEmptyString(source.qa_path)) {
      qaPath = await requireFile(source.qa_path, `${label} qa_path`);
    } else if (source.qa_path !== null) {
      fail(`${label}: qa_path must be a path or null.`);
    }

    if (mdPath) {
      checkedRecordCount += validateMarkdown(
        source,
        await readFile(mdPath, 'utf8'),
        normalizedSourceLanguages,
      );
    }

    if (qaPath) {
      const qaResult = await readQaJson(qaPath, label);
      if (qaResult.ok) {
        await validateQaSnapshot(
          source,
          qaResult.value,
          archivePath,
          mdPath,
          normalizedSourceLanguages,
          compactMetadata,
        );
        checkedQaSnapshotCount += 1;
      }
    }
  }

  const gradeFourMissing = Array.isArray(manifest.missing_coverage)
    && manifest.missing_coverage.some(
      (entry) => entry.grade === 4 && entry.coverage_status === 'missing',
    );
  if (!gradeFourMissing) {
    fail('missing_coverage must explicitly register grade 4 with coverage_status "missing".');
  }
}

if (errors.length > 0) {
  console.error(`Source manifest check failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(
    `Source manifest check passed: ${manifest.sources.length} routes and ${checkedRecordCount} Markdown records validated.`,
  );
  console.log(`QA snapshots validated: ${checkedQaSnapshotCount}.`);
}
