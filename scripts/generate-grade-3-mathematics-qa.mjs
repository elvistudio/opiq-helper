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
const sourceId = 'grade-3-mathematics';
const generatorPath = 'scripts/generate-grade-3-mathematics-qa.mjs';
const generatorVersion = '1.0';
const checkOnly = process.argv.slice(2).includes('--check');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');

const duplicateDecisions = new Map([
  ['https://www.opiq.ee/Kit/Details/497', { positions: [561, 562], chapterIds: ['265', '291'] }],
  ['https://www.opiq.ee/Kit/Details/498', { positions: [584, 585], chapterIds: ['248', '264'] }],
  ['https://www.opiq.ee/Kit/Details/500', { positions: [625, 626], chapterIds: ['200', '223'] }],
]);

const subjectDecisions = new Map([
  ['https://www.opiq.ee/kit/531/chapter/29334', {
    sourcePosition: 59,
    bookId: '3k_matem_avita_2023_est',
    kitId: '531',
    chapterId: '3.16',
  }],
  ['https://www.opiq.ee/kit/54/chapter/2701', {
    sourcePosition: 201,
    bookId: '3k_matem_avita_2_est',
    kitId: '54',
    chapterId: '3.16',
  }],
]);

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
    assert(Number.isInteger(value.grade) && value.grade === 3, `Source record ${index + 1} has an invalid grade.`);
    for (const field of ['topics_et', 'topics_ru', 'topics_en', 'headings', 'task_examples']) {
      assert(Array.isArray(value[field]), `Source record ${index + 1} field ${field} must be an array.`);
    }
    return { ...value, source_position: index + 1 };
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

function sourceSubject(record) {
  return `${record.subject_en} / ${record.subject_et} / ${record.subject_ru}`;
}

function verifyCanonicalRecords(sourceRecords, markdownRecords, label) {
  assert(
    sourceRecords.length === markdownRecords.length,
    `${label} has ${markdownRecords.length} records; expected ${sourceRecords.length}.`,
  );

  const comparisons = [
    ['title', (record) => record.title],
    ['url', (record) => record.url],
    ['book', (record) => record.book],
    ['grade', (record) => String(record.grade)],
    ['subject', sourceSubject],
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
      assert(
        markdownRecord[field] === expectedValue(sourceRecord),
        `${label} record ${index + 1} field ${field} differs from the compact source normalization.`,
      );
    });
  });
}

function groupByUrl(records) {
  const byUrl = new Map();
  records.forEach((record) => {
    const matches = byUrl.get(record.url) || [];
    matches.push(record);
    byUrl.set(record.url, matches);
  });
  return byUrl;
}

function differingSourceFields(matches) {
  const fields = [
    'title', 'url', 'book', 'book_id', 'chapter_id', 'grade', 'subject_et', 'subject_ru',
    'subject_en', 'language', 'publisher', 'topics_et', 'topics_ru', 'topics_en', 'headings',
    'task_examples',
  ];
  return fields.filter((field) => matches.some(
    (record) => JSON.stringify(record[field]) !== JSON.stringify(matches[0][field]),
  ));
}

function auditDuplicates(records) {
  const duplicateGroups = [...groupByUrl(records).entries()].filter(([, matches]) => matches.length > 1);
  assert(duplicateGroups.length === duplicateDecisions.size, 'Compact duplicate URL group count changed; review all decisions.');

  const entries = duplicateGroups.map(([url, matches]) => {
    const decision = duplicateDecisions.get(url);
    assert(decision, `Unexpected duplicate URL requires audit: ${url}`);
    assert(matches.length === 2, `Duplicate URL ${url} no longer has exactly two source rows.`);
    assert(
      JSON.stringify(matches.map((record) => record.source_position)) === JSON.stringify(decision.positions),
      `Duplicate URL ${url} source positions changed.`,
    );
    assert(
      JSON.stringify(matches.map((record) => String(record.chapter_id))) === JSON.stringify(decision.chapterIds),
      `Duplicate URL ${url} chapter IDs changed.`,
    );
    const differingFields = differingSourceFields(matches);
    assert(
      JSON.stringify(differingFields) === JSON.stringify(['chapter_id']),
      `Duplicate source rows for ${url} differ in fields other than chapter_id.`,
    );
    return {
      url,
      kit_id: kitId(url),
      source_positions: matches.map((record) => record.source_position),
      title: matches[0].title,
      book_id: matches[0].book_id,
      chapter_ids: matches.map((record) => String(record.chapter_id)),
      language: matches[0].language,
      headings: matches[0].headings,
      task_examples: matches[0].task_examples,
      differing_fields: differingFields,
      decision: 'remove_duplicate',
      retained_source_position: matches[0].source_position,
      excluded_source_positions: [matches[1].source_position],
      reason: 'The source rows are the same kit detail page and differ only in synthetic chapter_id; the stable first occurrence is retained.',
    };
  });

  for (const expectedUrl of duplicateDecisions.keys()) {
    assert(entries.some((entry) => entry.url === expectedUrl), `Audited duplicate URL is missing: ${expectedUrl}`);
  }
  const canonicalRecords = [...groupByUrl(records).values()].map(([first]) => first);
  return { canonicalRecords, duplicateGroups, entries };
}

function replaceSubjectAlias(values, forbiddenAlias, requiredAlias) {
  const normalizedForbidden = forbiddenAlias.toLocaleLowerCase();
  const retained = values.filter((value) => value.toLocaleLowerCase() !== normalizedForbidden);
  return [requiredAlias, ...retained.filter((value) => value.toLocaleLowerCase() !== requiredAlias.toLocaleLowerCase())];
}

function validateAuditedSourceSubjects(records) {
  const scienceRecords = records.filter((record) => sourceSubject(record) === 'science / loodusõpetus / природоведение');
  assert(scienceRecords.length === subjectDecisions.size, 'Expected exactly two audited science-labelled source records.');
  for (const record of scienceRecords) {
    const decision = subjectDecisions.get(record.url);
    assert(decision, `Unexpected science-labelled source record: ${record.url}`);
    assert(record.source_position === decision.sourcePosition, `Subject normalization source position changed for ${record.url}.`);
    assert(record.book_id === decision.bookId, `Subject normalization Book ID changed for ${record.url}.`);
    assert(kitId(record.url) === decision.kitId, `Subject normalization kit ID changed for ${record.url}.`);
    assert(String(record.chapter_id) === decision.chapterId, `Subject normalization Chapter ID changed for ${record.url}.`);
  }
  for (const expectedUrl of subjectDecisions.keys()) {
    assert(scienceRecords.some((record) => record.url === expectedUrl), `Audited subject-normalization URL is missing: ${expectedUrl}`);
  }
}

function normalizeSubjects(records) {
  const scienceRecords = records.filter((record) => sourceSubject(record) === 'science / loodusõpetus / природоведение');
  assert(scienceRecords.length === subjectDecisions.size, 'Expected exactly two audited science-labelled source records.');

  const audit = [];
  const normalized = records.map((record) => {
    const decision = subjectDecisions.get(record.url);
    if (!decision) {
      assert(sourceSubject(record) !== 'science / loodusõpetus / природоведение', `Unexpected science-labelled source record: ${record.url}`);
      return record;
    }
    assert(record.source_position === decision.sourcePosition, `Subject normalization source position changed for ${record.url}.`);
    assert(record.book_id === decision.bookId, `Subject normalization Book ID changed for ${record.url}.`);
    assert(kitId(record.url) === decision.kitId, `Subject normalization kit ID changed for ${record.url}.`);
    assert(String(record.chapter_id) === decision.chapterId, `Subject normalization Chapter ID changed for ${record.url}.`);
    assert(sourceSubject(record) === 'science / loodusõpetus / природоведение', `Expected audited source Subject for ${record.url}.`);

    const canonical = {
      ...record,
      subject_en: 'mathematics',
      subject_et: 'matemaatika',
      subject_ru: 'математика',
      topics_et: replaceSubjectAlias(record.topics_et, 'loodusõpetus', 'matemaatika'),
      topics_ru: replaceSubjectAlias(record.topics_ru, 'природоведение', 'математика'),
      topics_en: replaceSubjectAlias(record.topics_en, 'science', 'mathematics'),
    };
    for (const keyword of ['loodus', 'keskkond']) assert(canonical.topics_et.includes(keyword), `${record.url} lost environmental topic ${keyword}.`);
    for (const keyword of ['природа', 'окружающая среда']) assert(canonical.topics_ru.includes(keyword), `${record.url} lost environmental topic ${keyword}.`);
    for (const keyword of ['nature', 'environment']) assert(canonical.topics_en.includes(keyword), `${record.url} lost environmental topic ${keyword}.`);

    audit.push({
      url: record.url,
      source_position: record.source_position,
      book_id: record.book_id,
      kit_id: kitId(record.url),
      chapter_id: String(record.chapter_id),
      source_subject: sourceSubject(record),
      canonical_subject: sourceSubject(canonical),
      decision: 'correct_to_mathematics',
      evidence_summary: 'The page is chapter 3.16 inside a mathematics book and asks pupils to read a response diagram, calculate gift costs, and calculate electricity hours; environmental protection is the task context.',
    });
    return canonical;
  });

  for (const expectedUrl of subjectDecisions.keys()) {
    assert(audit.some((entry) => entry.url === expectedUrl), `Audited subject-normalization URL is missing: ${expectedUrl}`);
  }
  return { normalized, audit };
}

function bookMetadataAudit(sourceRecords, canonicalRecords) {
  const bookIds = [...new Set(sourceRecords.map((record) => record.book_id))].sort();
  return Object.fromEntries(bookIds.map((bookId) => {
    const sourceBook = sourceRecords.filter((record) => record.book_id === bookId);
    const canonicalBook = canonicalRecords.filter((record) => record.book_id === bookId);
    const detailTitles = sourceBook.filter((record) => /\/Kit\/Details\//i.test(record.url)).map((record) => record.title);
    return [bookId, {
      titles: [...new Set(sourceBook.map((record) => record.book))],
      detail_titles: [...new Set(detailTitles)],
      publishers: [...new Set(sourceBook.map((record) => record.publisher))],
      kit_ids: [...new Set(sourceBook.map((record) => kitId(record.url)))],
      languages: [...new Set(sourceBook.map((record) => record.language))].sort(),
      source_records: sourceBook.length,
      canonical_records: canonicalBook.length,
      curriculum: detailTitles.some((title) => /lihtsustatud õppekava/i.test(title)) ? 'simplified' : 'standard',
      cover_detail_records_present: canonicalBook.filter((record) => /\/Kit\/Details\//i.test(record.url)).length,
      administrative_records_present: canonicalBook.filter((record) => /impressum|импрессум/i.test([record.title, ...record.headings].join(' '))).length,
      metadata_anomalies: sourceBook.every((record) => record.publisher === '') ? ['publisher is empty'] : [],
    }];
  }));
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
  assert(source.canonical_subject_policy?.required_subject?.en === 'mathematics', 'Canonical subject policy is required.');

  const archivePath = await requireFile(source.source_archive, `${sourceId} source_archive`);
  const markdownPath = await requireFile(source.md_path, `${sourceId} md_path`);
  const qaPath = repositoryPath(source.qa_path, `${sourceId} qa_path`);
  const archive = await readCompactZip(archivePath);
  const requiredMembers = source.source_provenance.required_members;
  assert(Array.isArray(requiredMembers) && requiredMembers.length > 0, 'Provenance required_members is missing.');
  requiredMembers.forEach((name) => requireZipMember(archive, name));
  assert(archive.entries.size === requiredMembers.length, 'Compact ZIP contains undeclared members.');

  const index = parseJson(readZipText(archive, 'index.json'), 'compact index.json');
  const sourceRecords = parseJsonl(readZipText(archive, 'opiq_lookup.jsonl'));
  const topicMap = parseJson(readZipText(archive, 'topic_map.json'), 'compact topic_map.json');
  assert(isPlainObject(topicMap), 'Compact topic_map.json root must be an object.');
  const compactMarkdown = readZipText(archive, 'opiq_lookup.md');
  assert(compactMarkdown.trim(), 'Compact opiq_lookup.md must not be empty.');
  assert(index.formatVersion === source.format_version, 'Compact formatVersion does not match manifest.');
  assert(index.generatedAt === source.source_provenance.compact_generated_at, 'Compact generatedAt does not match provenance.');
  assert(index.sourceArchive === source.source_provenance.declared_original_archive, 'Compact sourceArchive does not match provenance.');
  assert(index.recordCount === 637, 'Compact recordCount is no longer the audited 637 source records.');
  assert(index.recordCount === sourceRecords.length, 'Compact recordCount does not match JSONL records.');
  assert(
    JSON.stringify([...index.files].sort()) === JSON.stringify([...archive.entries.keys()].sort()),
    'Compact index.json files does not exactly match ZIP members.',
  );
  assert(
    JSON.stringify([...index.supportedQueryLanguages].sort()) === JSON.stringify([...source.languages].sort()),
    'Compact supportedQueryLanguages does not match manifest languages.',
  );
  verifyCanonicalRecords(sourceRecords, parseMarkdownRecords(compactMarkdown), 'Compact Markdown');

  validateAuditedSourceSubjects(sourceRecords);
  const { canonicalRecords: deduplicated, duplicateGroups, entries: duplicateEntries } = auditDuplicates(sourceRecords);
  const { normalized: canonicalRecords, audit: subjectNormalizationAudit } = normalizeSubjects(deduplicated);
  const markdownRecords = parseMarkdownRecords(await readFile(markdownPath, 'utf8'));
  verifyCanonicalRecords(canonicalRecords, markdownRecords, 'Canonical Markdown');
  assert(markdownRecords.length === source.record_count, 'Canonical count does not match manifest record_count.');
  assert(new Set(markdownRecords.map((record) => record.url)).size === markdownRecords.length, 'Canonical Markdown contains duplicate URLs.');
  assert(markdownRecords.every((record) => record.subject === 'mathematics / matemaatika / математика'), 'Canonical Markdown contains a non-mathematics Subject.');

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
  const administrative = canonicalRecords.filter((record) => /impressum|импрессум/i.test([record.title, ...record.headings].join(' ')));
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
      note: 'Generated from the committed derived compact snapshot; the declared original export 3klass-matem.zip was not available.',
    },
    checksums: {
      source_archive_sha256: await sha256(archivePath),
      output_file_sha256: await sha256(markdownPath),
    },
    source_records: sourceRecords.length,
    page_records_included: canonicalRecords.length,
    grades: countBy(canonicalRecords, (record) => record.grade),
    languages: countBy(canonicalRecords, (record) => record.language),
    books: countBy(canonicalRecords, (record) => record.book_id),
    kits: countBy(canonicalRecords, (record) => kitId(record.url)),
    source_provenance: source.source_provenance,
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
    subject_normalization_audit: subjectNormalizationAudit,
    source_subject_counts: countBy(sourceRecords, sourceSubject),
    canonical_subject_counts: countBy(canonicalRecords, sourceSubject),
    records_without_headings: canonicalRecords.filter((record) => record.headings.length === 0).length,
    missing_urls: canonicalRecords.filter((record) => !record.url).length,
    book_metadata_audit: bookMetadataAudit(sourceRecords, canonicalRecords),
  };
  const expectedContents = `${JSON.stringify(qa, null, 2)}\n`;
  const currentContents = await readFile(qaPath, 'utf8').catch(() => null);

  if (checkOnly) {
    assert(currentContents === expectedContents, `${source.qa_path} is stale; run the generator without --check.`);
    console.log(`Grade 3 mathematics QA check passed: ${sourceRecords.length} source records and ${canonicalRecords.length} canonical records verified.`);
  } else if (currentContents === expectedContents) {
    console.log(`Grade 3 mathematics QA generation complete: ${source.qa_path} is already current.`);
  } else {
    await writeFile(qaPath, expectedContents, 'utf8');
    console.log(`Grade 3 mathematics QA generation complete: wrote ${source.qa_path}.`);
  }
} catch (error) {
  console.error(`Grade 3 mathematics QA generation failed: ${error.message}`);
  process.exitCode = 1;
}
