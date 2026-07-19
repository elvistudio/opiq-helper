#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { readCompactZip, readZipText, requireZipMember } from './lib/compact-zip.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const manifestPath = path.join(repositoryRoot, 'source-manifest.json');
const sourceId = 'grade-1-mathematics';
const generatorPath = 'scripts/generate-grade-1-mathematics-qa.mjs';
const generatorVersion = '1.0';
const checkOnly = process.argv.slice(2).includes('--check');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function repositoryPath(relativePath, label) {
  assert(typeof relativePath === 'string' && relativePath.trim(), `${label} must be a non-empty path.`);
  assert(!path.isAbsolute(relativePath), `${label} must be repository-relative.`);
  const absolutePath = path.resolve(repositoryRoot, relativePath);
  assert(
    absolutePath !== repositoryRoot && absolutePath.startsWith(`${repositoryRoot}${path.sep}`),
    `${label} points outside the repository.`,
  );
  return absolutePath;
}

async function requireFile(relativePath, label) {
  const absolutePath = repositoryPath(relativePath, label);
  const fileStat = await stat(absolutePath).catch(() => null);
  assert(fileStat?.isFile(), `${label} is missing: ${relativePath}`);
  return absolutePath;
}

async function sha256(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is invalid JSON: ${error.message}`);
  }
}

function parseJsonl(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  return lines.map((line, index) => {
    const value = parseJson(line, `opiq_lookup.jsonl line ${index + 1}`);
    assert(isPlainObject(value), `opiq_lookup.jsonl line ${index + 1} must be an object.`);
    for (const field of [
      'title', 'url', 'book', 'book_id', 'chapter_id', 'grade', 'subject_et', 'subject_ru',
      'subject_en', 'language', 'publisher', 'topics_et', 'topics_ru', 'topics_en', 'headings',
      'task_examples',
    ]) {
      assert(Object.hasOwn(value, field), `opiq_lookup.jsonl line ${index + 1} is missing ${field}.`);
    }
    assert(/^https:\/\/(?:www\.)?opiq\.ee\//i.test(value.url), `Source record ${index + 1} has an invalid Opiq URL.`);
    assert(Number.isInteger(value.grade) && value.grade > 0, `Source record ${index + 1} has an invalid grade.`);
    for (const field of ['topics_et', 'topics_ru', 'topics_en', 'headings', 'task_examples']) {
      assert(Array.isArray(value[field]), `Source record ${index + 1} field ${field} must be an array.`);
    }
    return value;
  });
}

function parseMarkdownRecords(markdown) {
  const starts = [...markdown.matchAll(/^##\s+(.+)$/gm)];
  return starts.map((match, index) => {
    const text = markdown.slice(
      match.index,
      index + 1 < starts.length ? starts[index + 1].index : markdown.length,
    );
    const field = (name) => text.match(new RegExp(`^${name}:[ \\t]*(.*)$`, 'm'))?.[1] ?? '';
    return {
      position: index + 1,
      title: match[1],
      url: field('URL'),
      book: field('Book'),
      grade: field('Class'),
      subject: field('Subject'),
      language: field('Language'),
      publisher: field('Publisher'),
      bookId: field('Book ID'),
      chapterId: field('Chapter ID'),
      topicsEt: field('Topics ET'),
      topicsRu: field('Topics RU'),
      topicsEn: field('Topics EN'),
      headings: field('Headings'),
      taskExamples: field('Task examples'),
    };
  });
}

function kitId(url) {
  return url.match(/\/kit\/(\d+)/i)?.[1] || url.match(/\/Kit\/Details\/(\d+)/)?.[1] || '';
}

function countBy(records, selector) {
  const counts = new Map();
  for (const record of records) {
    const key = String(selector(record));
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries([...counts].sort(([left], [right]) => left.localeCompare(right)));
}

function deduplicateSourceRecords(records) {
  const byUrl = new Map();
  records.forEach((record, index) => {
    const entry = { record, position: index + 1 };
    const matches = byUrl.get(record.url) || [];
    matches.push(entry);
    byUrl.set(record.url, matches);
  });

  const duplicateGroups = [...byUrl.entries()].filter(([, matches]) => matches.length > 1);
  return {
    canonicalRecords: [...byUrl.values()].map(([first]) => first.record),
    duplicateGroups,
  };
}

function differingSourceFields(matches) {
  const fields = [
    'title', 'url', 'book', 'book_id', 'chapter_id', 'grade', 'subject_et', 'subject_ru',
    'subject_en', 'language', 'publisher', 'topics_et', 'topics_ru', 'topics_en', 'headings',
    'task_examples',
  ];
  return fields.filter((field) => {
    const values = matches.map(({ record }) => JSON.stringify(record[field]));
    return values.some((value) => value !== values[0]);
  });
}

function verifyCanonicalRecords(sourceRecords, markdownRecords) {
  assert(
    sourceRecords.length === markdownRecords.length,
    `Canonical Markdown has ${markdownRecords.length} records; expected ${sourceRecords.length}.`,
  );

  const comparisons = [
    ['title', (record) => record.title],
    ['url', (record) => record.url],
    ['book', (record) => record.book],
    ['grade', (record) => String(record.grade)],
    ['subject', (record) => `${record.subject_en} / ${record.subject_et} / ${record.subject_ru}`],
    ['language', (record) => record.language],
    ['publisher', (record) => record.publisher],
    ['bookId', (record) => record.book_id],
    ['chapterId', (record) => String(record.chapter_id)],
    ['topicsEt', (record) => record.topics_et.join(', ')],
    ['topicsRu', (record) => record.topics_ru.join(', ')],
    ['topicsEn', (record) => record.topics_en.join(', ')],
    ['headings', (record) => record.headings.join('; ')],
    ['taskExamples', (record) => record.task_examples.join('; ')],
  ];

  sourceRecords.forEach((sourceRecord, index) => {
    const markdownRecord = markdownRecords[index];
    comparisons.forEach(([field, expectedValue]) => {
      const expected = expectedValue(sourceRecord);
      assert(
        markdownRecord[field] === expected,
        `Canonical record ${index + 1} field ${field} differs from the compact source.`,
      );
    });
  });
}

function topicAudit(records) {
  const exactPatterns = [
    /võrra\s+rohkem/i,
    /mitme\s+võrra\s+rohkem/i,
    /võrra\s+vähem/i,
    /mitme\s+võrra\s+vähem/i,
    /на\s+сколько\s+больше/i,
    /на\s+сколько\s+меньше/i,
    /на\s+\d+\s+больше/i,
    /на\s+\d+\s+меньше/i,
  ];
  const searchable = (record) => [record.title, ...record.headings, ...record.task_examples].join(' | ');
  const exactMatches = records.filter((record) => exactPatterns.some((pattern) => pattern.test(searchable(record))));
  const genericUrls = [
    'https://www.opiq.ee/kit/539/chapter/29819',
    'https://www.opiq.ee/kit/539/chapter/29821',
    'https://www.opiq.ee/kit/112/chapter/5424',
    'https://www.opiq.ee/kit/112/chapter/5426',
    'https://www.opiq.ee/kit/266/chapter/15145',
    'https://www.opiq.ee/kit/158/chapter/8915',
  ];
  const differenceUrls = [
    'https://www.opiq.ee/kit/539/chapter/29907',
    'https://www.opiq.ee/kit/112/chapter/6527',
  ];
  const evidence = (url) => {
    const record = records.find((entry) => entry.url === url);
    assert(record, `Topic-audit evidence URL is absent from the compact source: ${url}`);
    return {
      url,
      kit_id: kitId(url),
      chapter_id: String(record.chapter_id),
      title: record.title,
    };
  };

  assert(exactMatches.length === 0, 'Exact võrra rohkem/vähem evidence changed; review regression status.');
  const common = {
    status: 'ambiguous',
    searched_fields: ['title', 'headings', 'task_examples'],
    exact_non_topic_matches: exactMatches.length,
    topics_used_as_evidence: false,
    external_grades_used: false,
    generic_comparison_material: genericUrls.map(evidence),
    difference_task_evidence: differenceUrls.map(evidence),
  };
  return {
    vorra_rohkem: {
      ...common,
      conclusion: 'Generic greater/less comparison pages and one depth-difference task exist, but no explicit more-by learning objective is present.',
    },
    vorra_vahem: {
      ...common,
      conclusion: 'Generic greater/less comparison pages and one depth-difference task exist, but no explicit less-by learning objective is present.',
    },
  };
}

if (unknownArguments.length > 0) {
  console.error(`Unknown argument(s): ${unknownArguments.join(', ')}`);
  console.error(`Usage: node ${generatorPath} [--check]`);
  process.exit(1);
}

try {
  const manifest = parseJson(await readFile(manifestPath, 'utf8'), 'source-manifest.json');
  const source = manifest.sources?.find((entry) => entry.id === sourceId);
  assert(source, `Manifest source ${sourceId} was not found.`);
  assert(source.source_provenance?.kind === 'derived_compact_snapshot', 'Expected derived compact provenance.');
  assert(source.source_provenance.archive_path === source.source_archive, 'Provenance archive_path must match source_archive.');
  assert(source.canonical_url_policy?.require_unique === true, 'Unique canonical URL policy is required.');

  const archivePath = await requireFile(source.source_archive, `${sourceId} source_archive`);
  const markdownPath = await requireFile(source.md_path, `${sourceId} md_path`);
  const qaPath = repositoryPath(source.qa_path, `${sourceId} qa_path`);
  const archive = await readCompactZip(archivePath);
  const requiredMembers = source.source_provenance.required_members;
  assert(Array.isArray(requiredMembers) && requiredMembers.length > 0, 'Provenance required_members is missing.');
  requiredMembers.forEach((name) => requireZipMember(archive, name));

  const index = parseJson(readZipText(archive, 'index.json'), 'compact index.json');
  const sourceRecords = parseJsonl(readZipText(archive, 'opiq_lookup.jsonl'));
  parseJson(readZipText(archive, 'topic_map.json'), 'compact topic_map.json');
  const compactMarkdown = readZipText(archive, 'opiq_lookup.md');
  assert(compactMarkdown.trim(), 'Compact opiq_lookup.md must not be empty.');
  assert(index.formatVersion === source.format_version, 'Compact formatVersion does not match manifest.');
  assert(index.generatedAt === source.source_provenance.compact_generated_at, 'Compact generatedAt does not match provenance.');
  assert(index.sourceArchive === source.source_provenance.declared_original_archive, 'Compact sourceArchive does not match provenance.');
  assert(index.recordCount === sourceRecords.length, 'Compact recordCount does not match JSONL records.');
  assert(index.files?.every((name) => archive.entries.has(name)), 'Compact index.json lists a missing ZIP member.');
  verifyCanonicalRecords(sourceRecords, parseMarkdownRecords(compactMarkdown));

  const { canonicalRecords, duplicateGroups } = deduplicateSourceRecords(sourceRecords);
  const markdownRecords = parseMarkdownRecords(await readFile(markdownPath, 'utf8'));
  verifyCanonicalRecords(canonicalRecords, markdownRecords);
  assert(markdownRecords.length === source.record_count, 'Canonical count does not match manifest record_count.');
  assert(duplicateGroups.length === 1, 'Expected exactly one compact duplicate URL group.');
  assert(
    duplicateGroups[0][0] === 'https://www.opiq.ee/Kit/Details/266',
    'The audited duplicate URL changed; review the canonical resolution.',
  );

  const duplicateEntries = duplicateGroups.map(([url, matches]) => {
    const differingFields = differingSourceFields(matches);
    assert(
      JSON.stringify(differingFields) === JSON.stringify(['chapter_id']),
      `Duplicate source rows for ${url} differ in fields other than chapter_id.`,
    );
    return {
      url,
      kit_id: kitId(url),
      source_positions: matches.map(({ position }) => position),
      titles: [...new Set(matches.map(({ record }) => record.title))],
      book_ids: [...new Set(matches.map(({ record }) => record.book_id))],
      chapter_ids: matches.map(({ record }) => String(record.chapter_id)),
      languages: [...new Set(matches.map(({ record }) => record.language))],
      differing_fields: differingFields,
      decision: 'remove_duplicate',
      retained_source_position: matches[0].position,
      excluded_source_positions: matches.slice(1).map(({ position }) => position),
      reason: 'The source rows are the same kit detail page and differ only in synthetic chapter_id; the first occurrence is retained.',
    };
  });

  const existingQa = await readFile(qaPath, 'utf8').then(
    (contents) => parseJson(contents, source.qa_path),
    () => null,
  );
  if (checkOnly) assert(existingQa, `${source.qa_path} does not exist; run the generator without --check.`);
  const existingGeneratedAt = existingQa?.generation?.status === 'generated'
    ? existingQa.generation.generated_at
    : null;
  const generatedAt = existingGeneratedAt || new Date().toISOString();

  const details = canonicalRecords.filter((record) => /\/Kit\/Details\//i.test(record.url));
  const administrative = canonicalRecords.filter((record) => (
    /impressum|импрессум/i.test(`${record.title} ${record.headings.join(' ')}`)
  ));
  const qa = {
    qa_schema_version: '1.0',
    source_id: source.id,
    source_archive: source.source_archive,
    output_file: source.md_path,
    format_version: source.format_version,
    generation: {
      status: 'generated',
      generated_at: generatedAt,
      generator: generatorPath,
      generator_version: generatorVersion,
      note: 'Generated from the committed derived compact snapshot; the declared original export 1klass-matem.zip was not available.',
    },
    checksums: {
      source_archive_sha256: await sha256(archivePath),
      output_file_sha256: await sha256(markdownPath),
    },
    source_records: sourceRecords.length,
    page_records_included: canonicalRecords.length,
    cover_detail_records_present: details.length,
    cover_detail_records_excluded: 0,
    administrative_records_present: administrative.length,
    administrative_records_excluded: 0,
    duplicate_records_excluded: sourceRecords.length - canonicalRecords.length,
    duplicate_url_audit: {
      source_duplicate_groups: duplicateGroups.length,
      source_duplicate_records: sourceRecords.length - canonicalRecords.length,
      canonical_duplicate_groups: 0,
      entries: duplicateEntries,
    },
    grades: countBy(canonicalRecords, (record) => record.grade),
    languages: countBy(canonicalRecords, (record) => record.language),
    books: countBy(canonicalRecords, (record) => record.book_id),
    kits: countBy(canonicalRecords, (record) => kitId(record.url)),
    records_without_headings: canonicalRecords.filter((record) => record.headings.length === 0).length,
    missing_urls: canonicalRecords.filter((record) => !record.url).length,
    source_provenance: source.source_provenance,
    topic_audit: topicAudit(sourceRecords),
  };
  const expectedContents = `${JSON.stringify(qa, null, 2)}\n`;
  const currentContents = await readFile(qaPath, 'utf8').catch(() => null);

  if (checkOnly) {
    assert(currentContents === expectedContents, `${source.qa_path} is stale; run the generator without --check.`);
    console.log(`Grade 1 mathematics QA check passed: ${sourceRecords.length} source records and ${canonicalRecords.length} canonical records verified.`);
  } else if (currentContents === expectedContents) {
    console.log(`Grade 1 mathematics QA generation complete: ${source.qa_path} is already current.`);
  } else {
    await writeFile(qaPath, expectedContents, 'utf8');
    console.log(`Grade 1 mathematics QA generation complete: wrote ${source.qa_path}.`);
  }
} catch (error) {
  console.error(`Grade 1 mathematics QA generation failed: ${error.message}`);
  process.exitCode = 1;
}
