#!/usr/bin/env node

import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const manifestPath = path.join(repositoryRoot, 'source-manifest.json');
const errors = [];

function fail(message) {
  errors.push(message);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
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

function validateMarkdown(source, markdown) {
  const records = splitMarkdownRecords(markdown);
  if (records.length !== source.record_count) {
    fail(
      `${source.id}: record_count is ${source.record_count}, but ${source.md_path} contains ${records.length} records.`,
    );
  }

  records.forEach((record, index) => {
    const recordLabel = `${source.id} record ${index + 1}`;
    const urlMatch = record.match(/^(?:-\s+)?URL:\s+(https?:\/\/(?:www\.)?opiq\.ee\/\S+)\s*$/mi);
    if (!urlMatch) {
      fail(`${recordLabel}: missing a direct Opiq URL.`);
    }

    const classMatch = record.match(/^(?:-\s+)?Class:\s*(.+?)\s*$/mi);
    if (!classMatch || !classMatch[1].trim()) {
      fail(`${recordLabel}: class is empty.`);
    }

    const subjectMatch = record.match(/^(?:-\s+)?Subject(?:\s+ET)?:\s*(.+?)\s*$/mi);
    if (!subjectMatch || !subjectMatch[1].trim()) {
      fail(`${recordLabel}: subject is empty.`);
    }
  });
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
    ['grade-1-estonian', 'needs_review'],
    ['grade-1-mathematics', 'needs_review'],
    ['grade-1-science', 'needs_review'],
    ['grade-3-mathematics', 'needs_review'],
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
    if (!Array.isArray(source.languages) || source.languages.length === 0) {
      fail(`${label}: languages must be a non-empty array.`);
    }
    if (!Number.isInteger(source.record_count) || source.record_count < 1) {
      fail(`${label}: record_count must be a positive integer.`);
    }
    if (!isNonEmptyString(source.quality_status)) {
      fail(`${label}: quality_status is empty.`);
    }

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
    if (isNonEmptyString(source.source_archive)) {
      await requireFile(source.source_archive, `${label} source_archive`);
    } else if (source.source_archive !== null) {
      fail(`${label}: source_archive must be a path or null.`);
    }
    if (isNonEmptyString(source.qa_path)) {
      await requireFile(source.qa_path, `${label} qa_path`);
    } else if (source.qa_path !== null) {
      fail(`${label}: qa_path must be a path or null.`);
    }

    if (mdPath) {
      validateMarkdown(source, await readFile(mdPath, 'utf8'));
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
  console.log(`Source manifest check passed: ${manifest.sources.length} routes validated.`);
}
