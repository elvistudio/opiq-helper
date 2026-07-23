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
const gradeThreeEstonianRouteIds = new Set([
  'grade-3-estonian',
  'grade-3-estonian-second-language',
]);
const gradeThreeArtsRouteId = 'grade-3-arts-and-crafts';
const gradeThreeEnglishRouteId = 'grade-3-english';

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
  additionalArchivePaths = [],
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

  if (additionalArchivePaths.length > 0) {
    if (!Array.isArray(qa.source_archives) || qa.source_archives.length !== additionalArchivePaths.length + 1) {
      fail(`${sourceLabel}: source_archives must contain the primary archive and every additional source archive.`);
    } else {
      const registered = [
        { entry: { path: source.source_archive, role: 'primary' }, archivePath },
        ...additionalArchivePaths,
      ];
      const seenPaths = new Set();
      let sourceRecordTotal = 0;
      let includedRecordTotal = 0;
      for (const [index, expected] of registered.entries()) {
        const actual = qa.source_archives[index];
        const itemLabel = `${sourceLabel}: source_archives[${index}]`;
        if (!isPlainObject(actual)) {
          fail(`${itemLabel} must be an object.`);
          continue;
        }
        const allowedFields = new Set([
          'path', 'role', 'source_book_ids', 'sha256', 'source_records', 'page_records_included',
        ]);
        for (const field of Object.keys(actual)) {
          if (!allowedFields.has(field)) fail(`${itemLabel} contains unknown field ${field}.`);
        }
        if (actual.path !== expected.entry.path) {
          fail(`${itemLabel}.path must equal ${expected.entry.path}.`);
        } else if (seenPaths.has(actual.path)) {
          fail(`${sourceLabel}: source_archives contains duplicate path ${actual.path}.`);
        } else {
          seenPaths.add(actual.path);
        }
        if (actual.role !== expected.entry.role) fail(`${itemLabel}.role must equal ${expected.entry.role}.`);
        if (!Array.isArray(actual.source_book_ids) || actual.source_book_ids.length === 0) {
          fail(`${itemLabel}.source_book_ids must be a non-empty array.`);
        } else if (index > 0 && JSON.stringify(actual.source_book_ids) !== JSON.stringify(expected.entry.source_book_ids)) {
          fail(`${itemLabel}.source_book_ids must match the manifest declaration.`);
        }
        if (!sha256Pattern.test(actual.sha256 || '')) {
          fail(`${itemLabel}.sha256 must be 64 lowercase hexadecimal characters.`);
        } else if (expected.archivePath && actual.sha256 !== await sha256(expected.archivePath)) {
          fail(`${itemLabel}.sha256 does not match the registered archive.`);
        }
        if (!Number.isInteger(actual.source_records) || actual.source_records < 1) {
          fail(`${itemLabel}.source_records must be a positive integer.`);
        } else sourceRecordTotal += actual.source_records;
        if (!Number.isInteger(actual.page_records_included) || actual.page_records_included < 0) {
          fail(`${itemLabel}.page_records_included must be a non-negative integer.`);
        } else includedRecordTotal += actual.page_records_included;
      }
      if (sourceRecordTotal !== qa.source_records) {
        fail(`${sourceLabel}: source_archives source_records total ${sourceRecordTotal}, expected ${qa.source_records}.`);
      }
      if (includedRecordTotal !== qa.page_records_included) {
        fail(`${sourceLabel}: source_archives page_records_included total ${includedRecordTotal}, expected ${qa.page_records_included}.`);
      }
    }
  } else if (Object.hasOwn(qa, 'source_archives')) {
    fail(`${sourceLabel}: source_archives is only allowed when additional_source_archives is registered.`);
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

  if (source.id === 'grade-3-mathematics' && !compactMetadata) {
    const originalRequiredFields = [
      'archive',
      'source_representation_audit',
      'cover_detail_records_excluded',
      'administrative_records_excluded',
      'duplicate_records_excluded',
      'duplicate_url_audit',
      'subject_normalization_audit',
      'language_normalization_audit',
      'content_repair_audit',
      'content_quality_audit',
      'historical_comparison',
      'historical_compact_disposition',
      'source_subject_counts',
      'canonical_subject_counts',
      'kits',
    ];
    originalRequiredFields.forEach((field) => {
      if (!Object.hasOwn(qa, field)) fail(`${sourceLabel}: missing original-archive QA field ${field}.`);
    });
    if (qa.source_records !== 643) fail(`${sourceLabel}: original archive must account for 643 source records.`);
    const accountedSourceRecords = qa.page_records_included
      + qa.cover_detail_records_excluded
      + qa.administrative_records_excluded
      + qa.duplicate_records_excluded;
    if (accountedSourceRecords !== qa.source_records) {
      fail(`${sourceLabel}: included and excluded QA counters account for ${accountedSourceRecords} source records, expected ${qa.source_records}.`);
    }
    if (qa.archive?.member_count !== 657 || qa.archive?.crc_verified_members !== 657) {
      fail(`${sourceLabel}: all 657 original ZIP members must be present and CRC-verified.`);
    }
    if (qa.source_representation_audit?.unexplained_differences !== 0) {
      fail(`${sourceLabel}: original archive representations contain unexplained differences.`);
    }
    if (qa.historical_comparison?.semantic_difference_summary?.unexplained_differences !== 0) {
      fail(`${sourceLabel}: historical/original comparison contains unexplained differences.`);
    }
    const qualityErrors = qa.content_quality_audit?.hard_errors;
    if (!isPlainObject(qualityErrors) || Object.values(qualityErrors).some((count) => count !== 0)) {
      fail(`${sourceLabel}: canonical content-quality audit must contain zero hard errors.`);
    }
    if (qa.historical_compact_disposition?.canonical !== false
      || qa.historical_compact_disposition?.used_for_canonical_generation !== false
      || qa.historical_compact_disposition?.used_for_historical_comparison !== true) {
      fail(`${sourceLabel}: historical compact must be noncanonical comparison evidence only.`);
    }
    validateCountMap(qa, sourceLabel, 'source_subject_counts', qa.source_records);
    validateCountMap(qa, sourceLabel, 'canonical_subject_counts', qa.page_records_included);
  }

  if (source.id === 'grade-3-russian' && !compactMetadata) {
    const originalRequiredFields = [
      'archive',
      'source_representation_audit',
      'cover_detail_records_excluded',
      'administrative_records_excluded',
      'search_records_excluded',
      'duplicate_records_excluded',
      'duplicate_url_audit',
      'grade_audit',
      'language_audit',
      'subject_normalization_audit',
      'content_repair_audit',
      'content_quality_audit',
      'kit_568_migration',
      'source_subject_counts',
      'canonical_subject_counts',
      'kits',
    ];
    originalRequiredFields.forEach((field) => {
      if (!Object.hasOwn(qa, field)) fail(`${sourceLabel}: missing original-archive QA field ${field}.`);
    });
    if (qa.source_records !== 488) fail(`${sourceLabel}: original archive must account for 488 source records.`);
    const accountedSourceRecords = qa.page_records_included
      + qa.cover_detail_records_excluded
      + qa.administrative_records_excluded
      + qa.search_records_excluded
      + qa.duplicate_records_excluded;
    if (accountedSourceRecords !== qa.source_records) {
      fail(`${sourceLabel}: included and excluded QA counters account for ${accountedSourceRecords} source records, expected ${qa.source_records}.`);
    }
    if (qa.archive?.member_count !== 497 || qa.archive?.crc_verified_members !== 497) {
      fail(`${sourceLabel}: all 497 original ZIP members must be present and CRC-verified.`);
    }
    if (qa.source_representation_audit?.unexplained_differences !== 0) {
      fail(`${sourceLabel}: original archive representations contain unexplained differences.`);
    }
    if (qa.kit_568_migration?.final_owner !== 'grade-3-russian'
      || qa.kit_568_migration?.url_count !== 52
      || qa.kit_568_migration?.cross_route_overlap !== 0) {
      fail(`${sourceLabel}: kit 568 migration evidence is incomplete.`);
    }
    const qualityErrors = qa.content_quality_audit?.hard_errors;
    if (!isPlainObject(qualityErrors) || Object.values(qualityErrors).some((count) => count !== 0)) {
      fail(`${sourceLabel}: canonical content-quality audit must contain zero hard errors.`);
    }
    validateCountMap(qa, sourceLabel, 'source_subject_counts', qa.source_records);
    validateCountMap(qa, sourceLabel, 'canonical_subject_counts', qa.page_records_included);
  }

  if (gradeThreeEstonianRouteIds.has(source.id) && !compactMetadata) {
    const requiredFields = [
      'archive',
      'source_accounting',
      'source_representation_audit',
      'cover_detail_records_excluded',
      'administrative_records_excluded',
      'duplicate_records_excluded',
      'subject_boundary_page_records_excluded',
      'duplicate_url_audit',
      'grade_normalization_audit',
      'subject_normalization_audit',
      'language_normalization_audit',
      'content_repair_audit',
      'content_quality_audit',
      'book_metadata_audit',
      'captured_book_inventory',
      'kit_590_completion_audit',
      'kit_590_content_quality_audit',
      'publisher_limitations',
      'raw_grade_counts',
      'raw_subject_counts',
      'canonical_subject_counts',
      'raw_language_counts',
      'canonical_language_counts',
      'route_partition',
      'kits',
    ];
    requiredFields.forEach((field) => {
      if (!Object.hasOwn(qa, field)) {
        fail(`${sourceLabel}: missing grade-3 Estonian original-archive QA field ${field}.`);
      }
    });
    const expectedSourceRows = source.id === 'grade-3-estonian' ? 470 : 426;
    if (qa.source_records !== expectedSourceRows) {
      fail(`${sourceLabel}: registered archives must account for ${expectedSourceRows} source records.`);
    }
    const accountedSourceRecords = qa.page_records_included
      + qa.cover_detail_records_excluded
      + qa.administrative_records_excluded
      + qa.duplicate_records_excluded
      + qa.subject_boundary_page_records_excluded;
    if (accountedSourceRecords !== qa.source_records) {
      fail(`${sourceLabel}: route partition and exclusions account for ${accountedSourceRecords} rows, expected ${qa.source_records}.`);
    }
    if (qa.archive?.member_count !== 435 || qa.archive?.crc_verified_members !== 435) {
      fail(`${sourceLabel}: all 435 primary ZIP members must be present and CRC-verified.`);
    }
    const representationAudits = Object.values(qa.source_representation_audit ?? {});
    const expectedRepresentationCount = source.id === 'grade-3-estonian' ? 2 : 1;
    if (representationAudits.length !== expectedRepresentationCount
      || representationAudits.some((audit) => audit?.unexplained_differences !== 0)) {
      fail(`${sourceLabel}: registered archive representations contain unexplained differences.`);
    }
    if (qa.route_partition?.expected_union_page_records !== 459
      || qa.route_partition?.canonical_overlap_urls !== 0) {
      fail(`${sourceLabel}: grade-3 Estonian route partition must contain 459 disjoint instructional URLs.`);
    }
    const completion = qa.kit_590_completion_audit;
    if (completion?.kit_id !== '590'
      || completion?.complete_capture?.canonical_instructional_pages !== 42
      || completion?.shared_capture?.canonical_instructional_pages !== 0
      || completion?.canonical_chapter_urls_unique !== 42
      || completion?.recapture_required !== false) {
      fail(`${sourceLabel}: kit 590 cover and complete-capture evidence is incomplete.`);
    }
    const kit590Quality = qa.kit_590_content_quality_audit;
    if (kit590Quality?.instructional_pages !== 42
      || kit590Quality?.pages_with_headings !== 42
      || kit590Quality?.pages_without_structured_task_examples !== 42
      || kit590Quality?.raw_pages_with_empty_task_arrays !== 42
      || !isPlainObject(kit590Quality?.raw_text_quality)
      || Object.values(kit590Quality.raw_text_quality).some((count) => count !== 0)) {
      fail(`${sourceLabel}: kit 590 content-quality findings differ from the audited capture.`);
    }
    const qualityErrors = qa.content_quality_audit?.hard_errors;
    if (!isPlainObject(qualityErrors) || Object.values(qualityErrors).some((count) => count !== 0)) {
      fail(`${sourceLabel}: canonical content-quality audit must contain zero hard errors.`);
    }
    if (qa.publisher_limitations?.canonical_publishers_invented !== 0) {
      fail(`${sourceLabel}: publisher metadata must not be invented.`);
    }
    validateCountMap(qa, sourceLabel, 'raw_grade_counts', expectedSourceRows);
    validateCountMap(qa, sourceLabel, 'raw_subject_counts', expectedSourceRows);
    validateCountMap(qa, sourceLabel, 'canonical_subject_counts', qa.page_records_included);
    validateCountMap(qa, sourceLabel, 'raw_language_counts', expectedSourceRows);
    validateCountMap(qa, sourceLabel, 'canonical_language_counts', qa.page_records_included);
  }

  if (source.id === gradeThreeArtsRouteId && !compactMetadata) {
    const requiredFields = [
      'archive',
      'filename_encoding_audit',
      'source_accounting',
      'source_representation_audit',
      'cover_detail_records_excluded',
      'administrative_records_excluded',
      'duplicate_records_excluded',
      'subject_boundary_page_records_excluded',
      'captured_book_inventory',
      'raw_grade_counts',
      'raw_subject_counts',
      'canonical_subject_counts',
      'raw_language_counts',
      'canonical_language_counts',
      'subject_normalization_audit',
      'language_normalization_audit',
      'identity_normalization_audit',
      'duplicate_url_audit',
      'kit_200_comparison',
      'canonical_ownership',
      'image_audit',
      'repeated_title_groups',
      'content_repair_audit',
      'raw_content_quality_audit',
      'content_quality_audit',
      'records_without_task_examples',
      'source_instructional_records_without_tasks',
      'publisher_limitations',
      'canonical_url_audit',
      'kits',
    ];
    requiredFields.forEach((field) => {
      if (!Object.hasOwn(qa, field)) {
        fail(`${sourceLabel}: missing grade-3 arts original-archive QA field ${field}.`);
      }
    });
    if (qa.source_records !== 178 || qa.page_records_included !== 89) {
      fail(`${sourceLabel}: original archive must account for 178 rows and 89 canonical pages.`);
    }
    const accountedSourceRecords = qa.page_records_included
      + qa.cover_detail_records_excluded
      + qa.administrative_records_excluded
      + qa.duplicate_records_excluded
      + qa.subject_boundary_page_records_excluded;
    if (accountedSourceRecords !== qa.source_records) {
      fail(`${sourceLabel}: route ownership and exclusions account for ${accountedSourceRecords} rows, expected 178.`);
    }
    if (qa.archive?.member_count !== 185
      || qa.archive?.crc_verified_members !== 185
      || qa.archive?.uncompressed_size !== 552718
      || qa.archive?.compression_methods?.stored !== 185) {
      fail(`${sourceLabel}: all 185 stored ZIP members must be size- and CRC-verified.`);
    }
    if (qa.filename_encoding_audit?.non_ascii_recoveries !== 180
      || qa.filename_encoding_audit?.ascii_only_names !== 5
      || qa.filename_encoding_audit?.decoded_name_collisions !== 0
      || qa.filename_encoding_audit?.round_trip_verified !== 185) {
      fail(`${sourceLabel}: ZIP filename recovery must cover 180 non-ASCII and five ASCII-only members without collisions.`);
    }
    if (qa.source_representation_audit?.compact_jsonl_vs_markdown?.unexplained_differences !== 0
      || qa.source_representation_audit?.compact_vs_raw?.unexplained_differences !== 0
      || qa.source_representation_audit?.index_vs_raw_index?.unexplained_differences !== 0
      || qa.source_representation_audit?.topic_map?.unexplained_differences !== 0) {
      fail(`${sourceLabel}: source representations contain unexplained differences.`);
    }
    const comparison = qa.kit_200_comparison;
    if (comparison?.instructional_pages_per_capture !== 85
      || comparison?.url_set_matches !== 85
      || comparison?.compact_stable_field_matches !== 85
      || comparison?.raw_stable_field_matches !== 85
      || comparison?.raw_image_reference_hash_matches !== 85
      || comparison?.canonical_owner !== 'grade-2-arts-and-crafts'
      || comparison?.grade3_classification !== 'already_owned_shared_supplementary'
      || comparison?.cross_route_overlap_after_import !== 0
      || comparison?.lost_urls !== 0) {
      fail(`${sourceLabel}: kit 200 existing-owner comparison is incomplete.`);
    }
    if (qa.canonical_ownership?.kit_196 !== gradeThreeArtsRouteId
      || qa.canonical_ownership?.kit_200 !== 'grade-2-arts-and-crafts'
      || qa.canonical_ownership?.lost_urls !== 0
      || qa.canonical_ownership?.duplicate_canonical_ownership !== 0) {
      fail(`${sourceLabel}: canonical kit ownership differs from the audited decision.`);
    }
    if (qa.image_audit?.['196'] !== 364 || qa.image_audit?.['200'] !== 127) {
      fail(`${sourceLabel}: raw image-reference counts differ from the audited archive.`);
    }
    if (qa.records_without_task_examples !== 89
      || qa.source_instructional_records_without_tasks !== 174
      || qa.content_repair_audit?.chapter_content_repairs !== 0
      || qa.content_repair_audit?.invented_publishers !== 0
      || qa.content_repair_audit?.invented_tasks !== 0) {
      fail(`${sourceLabel}: content limitation or repair counts differ from the audited source.`);
    }
    const rawQualityErrors = qa.raw_content_quality_audit?.hard_errors;
    const canonicalQualityErrors = qa.content_quality_audit?.hard_errors;
    if (!isPlainObject(rawQualityErrors)
      || Object.values(rawQualityErrors).some((count) => count !== 0)
      || !isPlainObject(canonicalQualityErrors)
      || Object.values(canonicalQualityErrors).some((count) => count !== 0)) {
      fail(`${sourceLabel}: source or canonical content-quality audit contains hard errors.`);
    }
    if (qa.publisher_limitations?.canonical_publishers_invented !== 0) {
      fail(`${sourceLabel}: publisher metadata must not be invented.`);
    }
    validateCountMap(qa, sourceLabel, 'raw_grade_counts', 178);
    validateCountMap(qa, sourceLabel, 'raw_subject_counts', 178);
    validateCountMap(qa, sourceLabel, 'canonical_subject_counts', 89);
    validateCountMap(qa, sourceLabel, 'raw_language_counts', 178);
    validateCountMap(qa, sourceLabel, 'canonical_language_counts', 89);
  }

  if (source.id === gradeThreeEnglishRouteId && !compactMetadata) {
    const requiredFields = [
      'archive',
      'filename_encoding_audit',
      'source_accounting',
      'source_representation_audit',
      'captured_book_inventory',
      'raw_grade_counts',
      'raw_subject_counts',
      'canonical_subject_counts',
      'raw_language_counts',
      'canonical_language_counts',
      'subject_normalization_audit',
      'language_normalization_audit',
      'duplicate_url_audit',
      'repeated_title_groups',
      'content_repair_audit',
      'content_quality_audit',
      'publisher_limitations',
      'programme_type_audit',
      'canonical_url_audit',
      'kits',
    ];
    requiredFields.forEach((field) => {
      if (!Object.hasOwn(qa, field)) {
        fail(`${sourceLabel}: missing grade-3 English original-archive QA field ${field}.`);
      }
    });
    if (qa.source_records !== 197
      || qa.page_records_included !== 193
      || qa.cover_detail_records_excluded !== 4
      || qa.administrative_records_excluded !== 0) {
      fail(`${sourceLabel}: original archive must account for 197 rows, four details exclusions, and 193 pages.`);
    }
    if (qa.page_records_included + qa.cover_detail_records_excluded !== qa.source_records) {
      fail(`${sourceLabel}: grade-3 English source accounting is incomplete.`);
    }
    if (qa.archive?.member_count !== 204
      || qa.archive?.crc_verified_members !== 204
      || qa.archive?.uncompressed_size !== 1898081
      || qa.archive?.compression_methods?.stored !== 204) {
      fail(`${sourceLabel}: all 204 stored ZIP members must be size- and CRC-verified.`);
    }
    if (qa.filename_encoding_audit?.ascii_only_names !== 204
      || qa.filename_encoding_audit?.utf8_flag_set !== 0
      || qa.filename_encoding_audit?.stored_name_collisions !== 0) {
      fail(`${sourceLabel}: ZIP filename audit differs from the 204 ASCII stored names.`);
    }
    if (qa.source_representation_audit?.compact_jsonl_vs_markdown?.unexplained_differences !== 0
      || qa.source_representation_audit?.compact_vs_raw?.unexplained_differences !== 0
      || qa.source_representation_audit?.index_vs_raw_index?.unexplained_differences !== 0
      || qa.source_representation_audit?.topic_map?.unexplained_differences !== 0) {
      fail(`${sourceLabel}: source representations contain unexplained differences.`);
    }
    if (qa.source_representation_audit?.compact_vs_raw?.raw_chapter_records !== 197
      || qa.source_representation_audit?.compact_vs_raw?.raw_task_rows !== 0
      || qa.source_representation_audit?.compact_vs_raw?.images_by_kit?.['452'] !== 289
      || qa.source_representation_audit?.compact_vs_raw?.images_by_kit?.['369'] !== 3731) {
      fail(`${sourceLabel}: raw chapter/task/image evidence differs from the audited capture.`);
    }
    if (qa.duplicate_url_audit?.length !== 2
      || qa.repeated_title_groups?.groups !== 2
      || qa.repeated_title_groups?.records !== 18) {
      fail(`${sourceLabel}: duplicate details or repeated-title classification differs.`);
    }
    const hardErrors = qa.content_quality_audit?.hard_errors;
    if (!isPlainObject(hardErrors) || Object.values(hardErrors).some((count) => count !== 0)) {
      fail(`${sourceLabel}: canonical content-quality audit contains hard errors.`);
    }
    if (qa.publisher_limitations?.canonical_publishers_invented !== 0
      || qa.programme_type_audit?.value !== 'unknown'
      || qa.programme_type_audit?.ordinary_curriculum_inferred !== false) {
      fail(`${sourceLabel}: publisher or programme type was inferred without evidence.`);
    }
    if (qa.content_repair_audit?.zero_width_space_removed !== 1
      || qa.content_repair_audit?.affected_url !== 'https://www.opiq.ee/kit/369/chapter/20964'
      || qa.content_repair_audit?.visible_educational_text_changed !== false
      || qa.content_repair_audit?.other_chapter_content_repairs !== 0) {
      fail(`${sourceLabel}: technical heading-repair audit differs from the supplied capture.`);
    }
    if (qa.canonical_url_audit?.duplicate_count !== 0
      || qa.canonical_url_audit?.cross_route?.overlap_count !== 0) {
      fail(`${sourceLabel}: canonical URLs are duplicated within or across routes.`);
    }
    if (JSON.stringify(qa.canonical_language_counts) !== JSON.stringify({ en: 122, et: 67, ru: 4 })) {
      fail(`${sourceLabel}: canonical page-language partition must be en 122, et 67, ru 4.`);
    }
    validateCountMap(qa, sourceLabel, 'raw_grade_counts', 197);
    validateCountMap(qa, sourceLabel, 'raw_subject_counts', 197);
    validateCountMap(qa, sourceLabel, 'canonical_subject_counts', 193);
    validateCountMap(qa, sourceLabel, 'raw_language_counts', 197);
    validateCountMap(qa, sourceLabel, 'canonical_language_counts', 193);
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

async function validateRoutingBoundaryConfig(source, sourceLabel) {
  if (!Object.hasOwn(source, 'routing_boundary')) return;
  const boundary = source.routing_boundary;
  if (!isPlainObject(boundary)) {
    fail(`${sourceLabel}: routing_boundary must be an object.`);
    return;
  }
  const forbiddenBookIds = boundary.forbidden_book_ids;
  const forbiddenUrlPrefixes = boundary.forbidden_url_prefixes;
  if (!Array.isArray(forbiddenBookIds) || forbiddenBookIds.length === 0) {
    fail(`${sourceLabel}: routing_boundary.forbidden_book_ids must be a non-empty array.`);
  } else {
    const seen = new Set();
    forbiddenBookIds.forEach((bookId, index) => {
      if (!isNonEmptyString(bookId)) fail(`${sourceLabel}: routing_boundary.forbidden_book_ids[${index}] must be a non-empty string.`);
      else if (seen.has(bookId)) fail(`${sourceLabel}: routing_boundary.forbidden_book_ids contains duplicate book ID "${bookId}".`);
      else seen.add(bookId);
    });
  }
  if (!Array.isArray(forbiddenUrlPrefixes) || forbiddenUrlPrefixes.length === 0) {
    fail(`${sourceLabel}: routing_boundary.forbidden_url_prefixes must be a non-empty array.`);
  } else {
    const seen = new Set();
    forbiddenUrlPrefixes.forEach((urlPrefix, index) => {
      if (!isNonEmptyString(urlPrefix) || !/^https:\/\/(?:www\.)?opiq\.ee\//i.test(urlPrefix)) {
        fail(`${sourceLabel}: routing_boundary.forbidden_url_prefixes[${index}] must be a direct Opiq URL prefix.`);
      } else if (seen.has(urlPrefix)) fail(`${sourceLabel}: routing_boundary.forbidden_url_prefixes contains duplicate prefix "${urlPrefix}".`);
      else seen.add(urlPrefix);
    });
  }
  if (!isNonEmptyString(boundary.reason)) fail(`${sourceLabel}: routing_boundary.reason must be a non-empty string.`);
  await requireFile(boundary.audit_path, `${sourceLabel} routing_boundary.audit_path`);
}

async function validateAdditionalSourceArchives(source, sourceLabel, primaryArchivePath) {
  if (!Object.hasOwn(source, 'additional_source_archives')) return [];
  if (!Array.isArray(source.additional_source_archives) || source.additional_source_archives.length === 0) {
    fail(`${sourceLabel}: additional_source_archives must be a non-empty array when present.`);
    return [];
  }
  const allowedFields = new Set(['path', 'role', 'source_book_ids', 'notes']);
  const seenPaths = new Set(isNonEmptyString(source.source_archive) ? [source.source_archive] : []);
  const validated = [];
  for (const [index, entry] of source.additional_source_archives.entries()) {
    const entryLabel = `${sourceLabel} additional_source_archives[${index}]`;
    if (!isPlainObject(entry)) {
      fail(`${entryLabel} must be an object.`);
      continue;
    }
    for (const field of Object.keys(entry)) if (!allowedFields.has(field)) fail(`${entryLabel} contains unknown field ${field}.`);
    if (!isNonEmptyString(entry.path)) {
      fail(`${entryLabel}.path must be a non-empty repository-relative path.`);
      continue;
    }
    if (seenPaths.has(entry.path)) {
      fail(`${entryLabel}.path duplicates another registered source archive: ${entry.path}`);
      continue;
    }
    seenPaths.add(entry.path);
    if (!isNonEmptyString(entry.role)) fail(`${entryLabel}.role must be a non-empty string.`);
    if (!isNonEmptyString(entry.notes)) fail(`${entryLabel}.notes must be a non-empty string.`);
    if (!Array.isArray(entry.source_book_ids) || entry.source_book_ids.length === 0) {
      fail(`${entryLabel}.source_book_ids must be a non-empty array.`);
    } else if (new Set(entry.source_book_ids).size !== entry.source_book_ids.length
      || entry.source_book_ids.some((bookId) => !isNonEmptyString(bookId))) {
      fail(`${entryLabel}.source_book_ids must contain unique non-empty strings.`);
    }
    const archivePath = await requireFile(entry.path, `${entryLabel}.path`);
    if (archivePath) validated.push({ entry, archivePath });
  }
  if (!primaryArchivePath) fail(`${sourceLabel}: additional_source_archives requires a primary source_archive.`);
  return validated;
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

async function validateSourceScopeConfig(source, sourceLabel) {
  if (!Object.hasOwn(source, 'source_scope')) return;
  const scope = source.source_scope;
  if (!isPlainObject(scope)) {
    fail(`${sourceLabel}: source_scope must be an object.`);
    return;
  }
  if (!Array.isArray(scope.included_kit_ids) || scope.included_kit_ids.length === 0
    || scope.included_kit_ids.some((kit) => !/^\d+$/.test(kit))
    || new Set(scope.included_kit_ids).size !== scope.included_kit_ids.length) {
    fail(`${sourceLabel}: source_scope.included_kit_ids must contain unique numeric strings.`);
  }
  if (!isNonEmptyString(scope.programme_type)) fail(`${sourceLabel}: source_scope.programme_type must be a non-empty string.`);
  if (Object.hasOwn(scope, 'excluded_existing_owner_kits')) {
    const excluded = scope.excluded_existing_owner_kits;
    if (!Array.isArray(excluded) || excluded.length === 0) {
      fail(`${sourceLabel}: source_scope.excluded_existing_owner_kits must be a non-empty array.`);
    } else {
      const included = new Set(scope.included_kit_ids ?? []);
      const seen = new Set();
      for (const [index, entry] of excluded.entries()) {
        const entryLabel = `${sourceLabel}: source_scope.excluded_existing_owner_kits[${index}]`;
        if (!isPlainObject(entry)) {
          fail(`${entryLabel} must be an object.`);
          continue;
        }
        const allowed = new Set(['kit_id', 'owner_source_id', 'role']);
        for (const field of Object.keys(entry)) {
          if (!allowed.has(field)) fail(`${entryLabel} contains unknown field ${field}.`);
        }
        if (!/^\d+$/u.test(entry.kit_id ?? '')) fail(`${entryLabel}.kit_id must be a numeric string.`);
        else if (included.has(entry.kit_id)) fail(`${entryLabel}.kit_id must not also appear in included_kit_ids.`);
        else if (seen.has(entry.kit_id)) fail(`${entryLabel}.kit_id is duplicated.`);
        else seen.add(entry.kit_id);
        if (!isNonEmptyString(entry.owner_source_id)) fail(`${entryLabel}.owner_source_id must be a non-empty string.`);
        if (!isNonEmptyString(entry.role)) fail(`${entryLabel}.role must be a non-empty string.`);
      }
    }
  }
  await requireFile(scope.audit_path, `${sourceLabel} source_scope.audit_path`);
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
  const routingForbiddenBookIds = new Set(source.routing_boundary?.forbidden_book_ids || []);
  const forbiddenUrlPrefixes = source.routing_boundary?.forbidden_url_prefixes || [];
  const includedKitIds = new Set(source.source_scope?.included_kit_ids || []);
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

    if (urlMatch && forbiddenUrlPrefixes.some((prefix) => urlMatch[1].startsWith(prefix))) {
      fail(`${recordLabel}: URL ${urlMatch[1]} is forbidden by routing_boundary.`);
    }
    if (urlMatch && includedKitIds.size > 0) {
      const kit = urlMatch[1].match(/\/kit\/(\d+)/i)?.[1] || urlMatch[1].match(/\/Kit\/Details\/(\d+)/)?.[1];
      if (!kit || !includedKitIds.has(kit)) fail(`${recordLabel}: URL ${urlMatch[1]} is outside source_scope.included_kit_ids.`);
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
    if (routingForbiddenBookIds.size > 0) {
      const bookIdMatch = record.match(/^(?:-\s+)?Book ID:\s*(.+?)\s*$/mi);
      const bookId = bookIdMatch?.[1].trim();
      if (!bookId) fail(`${recordLabel}: missing Book ID required by routing_boundary.`);
      else if (routingForbiddenBookIds.has(bookId)) {
        fail(`${recordLabel}: URL ${urlMatch?.[1] || '<missing>'} has forbidden Book ID "${bookId}" from routing_boundary.`);
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
    await validateRoutingBoundaryConfig(source, label);
    validateCanonicalUrlPolicy(source, label);
    validateCanonicalSubjectPolicy(source, label);
    await validateSourceScopeConfig(source, label);

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
    const additionalArchivePaths = await validateAdditionalSourceArchives(source, label, archivePath);
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
          additionalArchivePaths,
        );
        checkedQaSnapshotCount += 1;
      }
    }
  }

  const gradeTwoUrlOwners = new Map();
  for (const source of manifest.sources.filter((entry) => entry.grade === 2)) {
    const markdownPath = path.join(repositoryRoot, source.md_path);
    const markdown = await readFile(markdownPath, 'utf8');
    for (const record of splitMarkdownRecords(markdown)) {
      const url = record.match(/^(?:-\s+)?URL:\s+(https?:\/\/\S+)\s*$/mi)?.[1];
      if (!url) continue;
      const previous = gradeTwoUrlOwners.get(url);
      if (previous && previous !== source.id) {
        fail(`grade-2 cross-route canonical URL overlap: ${url} belongs to both ${previous} and ${source.id}.`);
      } else gradeTwoUrlOwners.set(url, source.id);
    }
  }

  const gradeThreeEstonianSources = manifest.sources.filter(
    (source) => gradeThreeEstonianRouteIds.has(source.id),
  );
  if (gradeThreeEstonianSources.length !== 2) {
    fail(`grade-3 Estonian routing requires exactly two subject routes; found ${gradeThreeEstonianSources.length}.`);
  } else {
    const targetOwners = new Map();
    for (const source of gradeThreeEstonianSources) {
      const markdown = await readFile(path.join(repositoryRoot, source.md_path), 'utf8');
      for (const record of splitMarkdownRecords(markdown)) {
        const url = record.match(/^(?:-\s+)?URL:\s+(https?:\/\/\S+)\s*$/mi)?.[1];
        if (!url) continue;
        const previous = targetOwners.get(url);
        if (previous) fail(`grade-3 Estonian route overlap: ${url} belongs to both ${previous} and ${source.id}.`);
        else targetOwners.set(url, source.id);
      }
    }
    if (targetOwners.size !== 459) {
      fail(`grade-3 Estonian route union contains ${targetOwners.size} URLs; expected 459.`);
    }
    for (const source of manifest.sources.filter((entry) => !gradeThreeEstonianRouteIds.has(entry.id))) {
      const markdown = await readFile(path.join(repositoryRoot, source.md_path), 'utf8');
      for (const record of splitMarkdownRecords(markdown)) {
        const url = record.match(/^(?:-\s+)?URL:\s+(https?:\/\/\S+)\s*$/mi)?.[1];
        if (url && targetOwners.has(url)) {
          fail(`grade-3 Estonian canonical URL overlap: ${url} also belongs to ${source.id}.`);
        }
      }
    }
  }

  const globallyExclusiveRoutes = manifest.sources.filter((source) => ['grade-3-mathematics', 'grade-3-russian'].includes(source.id));
  for (const exclusiveRoute of globallyExclusiveRoutes) {
    const targetMarkdown = await readFile(path.join(repositoryRoot, exclusiveRoute.md_path), 'utf8');
    const targetUrls = new Set(splitMarkdownRecords(targetMarkdown)
      .map((record) => record.match(/^(?:-\s+)?URL:\s+(https?:\/\/\S+)\s*$/mi)?.[1])
      .filter(Boolean));
    for (const source of manifest.sources.filter((entry) => entry.id !== exclusiveRoute.id)) {
      const markdown = await readFile(path.join(repositoryRoot, source.md_path), 'utf8');
      for (const record of splitMarkdownRecords(markdown)) {
        const url = record.match(/^(?:-\s+)?URL:\s+(https?:\/\/\S+)\s*$/mi)?.[1];
        if (url && targetUrls.has(url)) {
          fail(`${exclusiveRoute.id} canonical URL overlap: ${url} also belongs to ${source.id}.`);
        }
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
