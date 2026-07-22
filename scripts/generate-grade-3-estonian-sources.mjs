#!/usr/bin/env node

import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { readCompactZip, readZipText } from './lib/compact-zip.mjs';
import {
  assertCompactMarkdownMatches,
  parseGrade3Jsonl,
  parseGrade3Markdown,
} from './lib/grade-3-mathematics.mjs';
import {
  assertGeneratedArtifact,
  assertGrade3Estonian,
  assertGrade3EstonianArchiveIdentity,
  assertRequiredGrade3EstonianMembers,
  assertSafeMemberName,
  buildGrade3EstonianCatalog,
  buildGrade3EstonianContentQualityAudit,
  countBy,
  grade3EstonianArchive,
  grade3EstonianLanguageNormalizations,
  grade3EstonianRoutes,
  grade3EstonianVariants,
  renderGrade3EstonianMarkdown,
  sha256Bytes,
  sourceSubject,
  validateManifestGrade3EstonianRoutes,
} from './lib/grade-3-estonian.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const manifestPath = path.join(repositoryRoot, 'source-manifest.json');
const generatorPath = 'scripts/generate-grade-3-estonian-sources.mjs';
const generatorVersion = '1.0';
const auditPath = 'docs/audits/grade-3-estonian-source-separation.md';
const checkOnly = process.argv.includes('--check');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');
assertGrade3Estonian(unknownArguments.length === 0, `Unknown arguments: ${unknownArguments.join(' ')}`);

const absolute = (relativePath) => path.join(repositoryRoot, relativePath);
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is invalid JSON: ${error.message}`);
  }
}

function normalizeRepresentationText(value) {
  return String(value ?? '').normalize('NFC').replace(/[\s\u00a0]+/gu, ' ').trim();
}

function validateIndex(index, rawIndex, sourceRecords, archive) {
  assertGrade3Estonian(index?.formatVersion === grade3EstonianArchive.format_version, 'index.json formatVersion is not 2.0.');
  assertGrade3Estonian(index.generatedAt === grade3EstonianArchive.capture_timestamp, 'index.json capture timestamp changed.');
  assertGrade3Estonian(index.source === 'opiq-helper-extension', 'index.json source is not opiq-helper-extension.');
  assertGrade3Estonian(index.recordCount === sourceRecords.length, 'index.json recordCount differs from JSONL.');
  assertGrade3Estonian(JSON.stringify(index.supportedQueryLanguages) === JSON.stringify(['et', 'ru', 'en']), 'index.json query languages changed.');
  assertGrade3Estonian(JSON.stringify(index.compactFiles) === JSON.stringify(['opiq_lookup.md', 'opiq_lookup.jsonl', 'topic_map.json', 'index.json']), 'index.json compactFiles changed.');
  assertGrade3Estonian(index.rawArchiveIncluded === true, 'index.json must declare raw source data.');
  assertGrade3Estonian(rawIndex.generatedAt === index.generatedAt, 'Raw and compact capture timestamps differ.');
  assertGrade3Estonian(JSON.stringify(rawIndex.books) === JSON.stringify(index.books), 'Raw and compact book inventories differ.');
  assertGrade3Estonian(index.books.length === 4, `index.json has ${index.books.length} books; expected 4.`);

  const sourceCounts = countBy(sourceRecords, (record) => record.book_id);
  for (const book of index.books) {
    const variant = grade3EstonianVariants[book.id];
    assertGrade3Estonian(variant, `index.json contains unknown book ${book.id}.`);
    assertGrade3Estonian(book.title.replace(/\s+[–-]\s+Opiq$/u, '') === variant.title, `Captured title differs for ${book.id}.`);
    assertGrade3Estonian(book.grade === variant.source_grade, `${book.id} compact grade differs from audited evidence.`);
    assertGrade3Estonian(book.language === 'et', `${book.id} compact book language must be et.`);
    assertGrade3Estonian(book.publisher === '', `${book.id} unexpectedly contains publisher metadata.`);
    assertGrade3Estonian(book.chapterCount === sourceCounts[book.id], `${book.id} chapterCount differs from JSONL.`);
    const member = `raw/Opiq-DB/books/${book.id}.json`;
    assertGrade3Estonian(archive.entries.has(member), `Original archive is missing ${member}.`);
    const rawBook = parseJson(readZipText(archive, member), member);
    assertGrade3Estonian(rawBook.id === book.id && rawBook.title === book.title, `${member} identity differs from index.json.`);
    assertGrade3Estonian(rawBook.grade === variant.source_grade, `${member} grade differs from compact book metadata.`);
    assertGrade3Estonian(rawBook.language === 'ru', `${member} no longer exposes the audited raw-book language anomaly ru.`);
    assertGrade3Estonian(rawBook.publisher === '', `${member} unexpectedly contains publisher metadata.`);
  }
}

function validateRawChapters(sourceRecords, archive) {
  const chapterMembers = [...archive.entries.keys()].filter((name) => name.startsWith('raw/Opiq-DB/chapters/'));
  assertGrade3Estonian(chapterMembers.length === sourceRecords.length, `Raw chapter count is ${chapterMembers.length}; expected ${sourceRecords.length}.`);
  const expectedMembers = new Set();
  let titleWhitespaceNormalizations = 0;
  let taskRepresentationDifferences = 0;
  for (const record of sourceRecords) {
    const member = `raw/Opiq-DB/chapters/${record.book_id}/${record.chapter_id}.json`;
    assertGrade3Estonian(!expectedMembers.has(member), `Multiple source rows resolve to ${member}.`);
    expectedMembers.add(member);
    assertGrade3Estonian(archive.entries.has(member), `Original archive is missing ${member}.`);
    const raw = parseJson(readZipText(archive, member), member);
    assertGrade3Estonian(raw.bookId === record.book_id, `${member} bookId differs from JSONL.`);
    assertGrade3Estonian(String(raw.chapterId) === String(record.chapter_id), `${member} chapterId differs from JSONL.`);
    assertGrade3Estonian(normalizeRepresentationText(raw.chapterTitle) === record.title, `${member} title differs beyond audited whitespace normalization.`);
    if (raw.chapterTitle !== record.title) titleWhitespaceNormalizations += 1;
    assertGrade3Estonian(raw.url === record.url, `${member} URL differs from JSONL.`);
    assertGrade3Estonian(Array.isArray(raw.headings) && Array.isArray(raw.tasks) && Array.isArray(raw.images), `${member} is missing raw page arrays.`);
    const rawHeadings = new Set(raw.headings.map((heading) => normalizeRepresentationText(heading.text)));
    assertGrade3Estonian(record.headings.every((heading) => rawHeadings.has(normalizeRepresentationText(heading))), `${member} compact headings are not represented in raw headings.`);
    if (JSON.stringify(record.task_examples) !== JSON.stringify(raw.tasks.map((task) => task.text))) taskRepresentationDifferences += 1;
    assertGrade3Estonian(typeof raw.scrapedAt === 'string' && !Number.isNaN(Date.parse(raw.scrapedAt)), `${member} scrapedAt is invalid.`);
  }
  chapterMembers.forEach((name) => assertGrade3Estonian(expectedMembers.has(name), `Unreferenced raw chapter member: ${name}`));
  assertGrade3Estonian(titleWhitespaceNormalizations === 5, `Raw/compact title whitespace normalization count is ${titleWhitespaceNormalizations}; expected 5.`);
  assertGrade3Estonian(taskRepresentationDifferences === 0, `Raw/compact task difference count is ${taskRepresentationDifferences}; expected 0.`);
  return {
    raw_chapter_members: chapterMembers.length,
    title_whitespace_normalizations: titleWhitespaceNormalizations,
    task_representation_differences: taskRepresentationDifferences,
  };
}

function validateTopicMap(topicMap, sourceRecords) {
  assertGrade3Estonian(topicMap && typeof topicMap === 'object' && !Array.isArray(topicMap), 'topic_map.json root must be an object.');
  const byUrl = new Map();
  for (const record of sourceRecords) {
    const group = byUrl.get(record.url) ?? [];
    group.push(record);
    byUrl.set(record.url, group);
  }
  let references = 0;
  for (const [topic, entries] of Object.entries(topicMap)) {
    assertGrade3Estonian(topic.trim() && Array.isArray(entries), `topic_map.json topic ${topic || '<empty>'} is invalid.`);
    for (const entry of entries) {
      references += 1;
      const candidates = byUrl.get(entry.url) ?? [];
      assertGrade3Estonian(candidates.some((record) => record.title === entry.title
        && record.language === entry.language
        && record.grade === entry.grade
        && record.subject_en === entry.subject), `topic_map.json entry ${entry.url} differs from JSONL.`);
    }
  }
  assertGrade3Estonian(Object.keys(topicMap).length === 1751, `topic_map.json has ${Object.keys(topicMap).length} topics; expected 1751.`);
  assertGrade3Estonian(references === 3161, `topic_map.json has ${references} references; expected 3161.`);
  return { topic_count: Object.keys(topicMap).length, reference_count: references };
}

function bookMetadataAudit(sourceRecords, catalog, routeId) {
  const route = grade3EstonianRoutes[routeId];
  return Object.fromEntries(route.included_source_book_ids.map((sourceBookId) => {
    const variant = grade3EstonianVariants[sourceBookId];
    const source = sourceRecords.filter((record) => record.book_id === sourceBookId);
    const canonical = catalog.route_records[routeId].filter((record) => record.source_book_id === sourceBookId);
    return [variant.canonical_book_id, {
      source_book_id: sourceBookId,
      kit_id: variant.kit_id,
      canonical_title: variant.title,
      publisher: null,
      publisher_evidence: 'not captured; not invented',
      source_languages: countBy(source, (record) => record.language),
      canonical_language: 'et',
      programme_type: variant.programme_type,
      source_records: source.length,
      canonical_instructional_pages: canonical.length,
      title_evidence: variant.title_evidence,
    }];
  }));
}

function capturedBookInventory(sourceRecords) {
  return Object.fromEntries(Object.values(grade3EstonianVariants).map((variant) => [variant.source_book_id, {
    kit_id: variant.kit_id,
    title: variant.title,
    source_records: sourceRecords.filter((record) => record.book_id === variant.source_book_id).length,
    instructional_pages: variant.canonical_records,
    route_id: variant.route_id,
    cover_only: variant.cover_only,
    publisher: null,
  }]));
}

function buildQa({ routeId, source, sourceRecords, catalog, archiveBytes, archive, representationAudit, topicAudit, markdown }) {
  const route = grade3EstonianRoutes[routeId];
  const records = catalog.route_records[routeId];
  const routeSourceRecords = sourceRecords.filter((record) => route.included_source_book_ids.includes(record.book_id));
  const routeRepairs = catalog.content_repairs.filter((repair) => route.included_source_book_ids.includes(repair.source_book_id));
  const languageAudit = Object.entries(grade3EstonianLanguageNormalizations)
    .filter(([url]) => records.some((record) => record.url === url))
    .map(([url, decision]) => {
      const record = sourceRecords.find((candidate) => candidate.url === url);
      return {
        url,
        source_book_id: record.book_id,
        kit_id: record.url.match(/\/kit\/(\d+)/u)?.[1],
        source_language: decision.source_language,
        canonical_language: decision.canonical_language,
        headings: record.headings,
        task_examples: record.task_examples,
        decision: 'normalize_to_et',
        evidence: decision.evidence,
      };
    });
  const excludedOtherSubject = routeId === 'grade-3-estonian'
    ? grade3EstonianArchive.second_language_records
    : grade3EstonianArchive.first_language_records;
  const gradeNormalizations = route.included_source_book_ids.map((sourceBookId) => {
    const variant = grade3EstonianVariants[sourceBookId];
    return {
      source_book_id: sourceBookId,
      kit_id: variant.kit_id,
      source_grade: variant.source_grade,
      canonical_grade: 3,
      records: records.filter((record) => record.source_book_id === sourceBookId).length,
      decision: variant.source_grade === 3 ? 'retain_grade_3' : 'normalize_grade_2_to_3',
      evidence: 'Captured Kit Details title, Source Book ID, kit identity, raw book title, and chapter context all identify a grade-3 book.',
    };
  });
  return {
    qa_schema_version: '1.0',
    source_id: source.id,
    source_archive: source.source_archive,
    output_file: source.md_path,
    format_version: source.format_version,
    generation: {
      status: 'generated',
      generated_at: grade3EstonianArchive.capture_timestamp,
      generator: generatorPath,
      generator_version: generatorVersion,
      note: 'Generated deterministically from the original shared grade-3 Estonian capture; routes are split by audited book and kit identity.',
    },
    checksums: {
      source_archive_sha256: sha256Bytes(archiveBytes),
      output_file_sha256: sha256Bytes(Buffer.from(markdown, 'utf8')),
    },
    archive: {
      byte_size: archiveBytes.length,
      member_count: archive.entryCount,
      crc_verified_members: archive.entryCount,
      unsafe_member_paths: 0,
    },
    source_records: sourceRecords.length,
    page_records_included: records.length,
    cover_detail_records_excluded: catalog.exclusions.cover_details.length,
    duplicate_records_excluded: catalog.exclusions.duplicate_aliases.length,
    administrative_records_excluded: catalog.exclusions.administrative.length,
    subject_boundary_page_records_excluded: excludedOtherSubject,
    source_accounting: {
      first_language_instructional_pages: grade3EstonianArchive.first_language_records,
      second_language_instructional_pages: grade3EstonianArchive.second_language_records,
      unique_kit_details: catalog.exclusions.cover_details.length,
      duplicate_kit_detail_aliases: catalog.exclusions.duplicate_aliases.length,
      administrative_impressum: catalog.exclusions.administrative.length,
      total: sourceRecords.length,
    },
    grades: countBy(records, (record) => record.grade),
    languages: countBy(records, (record) => record.language),
    books: countBy(records, (record) => record.book_id),
    kits: countBy(records, (record) => record.kit_id),
    programme_types: countBy(records, (record) => record.programme_type),
    raw_grade_counts: countBy(sourceRecords, (record) => record.grade),
    route_source_grade_counts: countBy(routeSourceRecords, (record) => record.grade),
    canonical_grade_counts: countBy(records, (record) => record.grade),
    raw_subject_counts: countBy(sourceRecords, sourceSubject),
    canonical_subject_counts: countBy(records, sourceSubject),
    raw_language_counts: countBy(sourceRecords, (record) => record.language),
    route_source_language_counts: countBy(routeSourceRecords, (record) => record.language),
    canonical_language_counts: countBy(records, (record) => record.language),
    route_partition: {
      paired_source_id: route.paired_source_id,
      expected_union_page_records: 417,
      canonical_overlap_urls: 0,
      included_source_book_ids: route.included_source_book_ids,
      forbidden_book_ids: route.forbidden_book_ids,
    },
    source_representation_audit: {
      compact_jsonl_records: sourceRecords.length,
      compact_markdown_records: sourceRecords.length,
      raw_chapter_records: representationAudit.raw_chapter_members,
      raw_compact_title_whitespace_normalizations: representationAudit.title_whitespace_normalizations,
      raw_compact_task_representation_differences: representationAudit.task_representation_differences,
      topic_map: topicAudit,
      unexplained_differences: 0,
    },
    duplicate_url_audit: {
      source_duplicate_groups: catalog.duplicate_audit.length,
      source_duplicate_records: catalog.exclusions.duplicate_aliases.length,
      canonical_duplicate_groups: 0,
      entries: catalog.duplicate_audit,
    },
    grade_normalization_audit: gradeNormalizations,
    subject_normalization_audit: {
      records: records.length,
      source_subject: sourceSubject(sourceRecords[0]),
      canonical_subject: sourceSubject(records[0]),
      decision: 'replace automatic mathematics subject with the audited Estonian subject route',
      evidence: 'Book identities, Kit Details titles, headings, and instructional context consistently identify Estonian-language study rather than mathematics.',
    },
    language_normalization_audit: languageAudit,
    content_repair_audit: {
      changed_records: routeRepairs.length,
      entries: routeRepairs,
      policy: 'Only deterministic technical normalization from the same captured record is allowed; educational prose is not rewritten.',
    },
    content_quality_audit: buildGrade3EstonianContentQualityAudit(records),
    book_metadata_audit: bookMetadataAudit(sourceRecords, catalog, routeId),
    captured_book_inventory: capturedBookInventory(sourceRecords),
    cover_only_sources: [{
      source_book_id: 'mina_loen_ja_kirjutan_3',
      canonical_book_id: 'mina_loen_ja_kirjutan_3__kit590',
      kit_id: '590',
      title: 'Mina loen ja kirjutan 3',
      source_records: 2,
      canonical_instructional_pages: 0,
      status: 'captured_cover_only',
      eligibility: 'not_eligible_for_page_level_evidence',
      recapture_required: 'Capture the instructional chapter pages for kit 590; a new full-catalogue capture is not required.',
    }],
    publisher_limitations: {
      archive_publishers_present: 0,
      canonical_publishers_invented: 0,
      note: 'Publisher metadata is absent from this archive and is left empty.',
    },
    known_limitations: [
      'The compact exporter labels every source record as mathematics; canonical subjects are evidence-backed by book/kit identity and page content.',
      'The compact index says et for all four books while raw per-book metadata says ru; page-level compact language and instructional text are used for the two audited corrections.',
      'The capture contains no task examples in compact or raw chapter representations; no exercises are invented.',
      'Kit 590 contains only two duplicate Kit Details records and cannot support page-level instructional retrieval.',
      'The route catalogue does not establish complete official-curriculum coverage.',
    ],
    records_without_headings: records.filter((record) => record.headings.length === 0).length,
    records_without_task_examples: records.filter((record) => record.task_examples.length === 0).length,
    missing_urls: records.filter((record) => !record.url).length,
  };
}

function renderAudit(firstQa, secondQa) {
  const allRepairs = [...firstQa.content_repair_audit.entries, ...secondQa.content_repair_audit.entries];
  const repairCategories = countBy(allRepairs.flatMap((entry) => entry.categories.map((category) => ({ category }))), (entry) => entry.category);
  return `# Grade 3 Estonian source and subject-separation audit

## Result

The original shared Opiq capture \`${grade3EstonianArchive.path}\` is split into two canonical subjects: **363** first-language Estonian pages and **54** Estonian-as-a-second-language pages. Their 417 direct chapter URLs are disjoint. This is a source-catalogue boundary, not proof of complete official-curriculum coverage.

Archive identity:

- SHA-256: \`${grade3EstonianArchive.sha256}\`
- size: ${grade3EstonianArchive.byte_size} bytes
- ZIP members: ${grade3EstonianArchive.member_count}, all CRC-verified
- format: ${grade3EstonianArchive.format_version}
- capture: ${grade3EstonianArchive.capture_timestamp}

## Source accounting

| Category | Count |
| --- | ---: |
| First-language instructional pages | 363 |
| Second-language instructional pages | 54 |
| Unique Kit Details excluded | 4 |
| Duplicate Kit Details aliases excluded | 4 |
| Administrative Impressum excluded | 1 |
| Total source rows | 426 |

Each duplicate pair is the same non-instructional Kit Details URL and differs only by its synthetic chapter ID. No conflicting instructional duplicate exists, and no Kit Details or Impressum URL is canonical.

## Complete kit inventory

| Kit | Source Book ID | Canonical Book ID | Title | Canonical route | Source rows | Pages | Status |
| ---: | --- | --- | --- | --- | ---: | ---: | --- |
${Object.values(grade3EstonianVariants).map((variant) => `| ${variant.kit_id} | \`${variant.source_book_id}\` | \`${variant.canonical_book_id}\` | ${variant.title} | ${variant.route_id ? `\`${variant.route_id}\`` : 'none'} | ${variant.source_records} | ${variant.canonical_records} | ${variant.cover_only ? 'captured cover-only' : 'ordinary curriculum'} |`).join('\n')}

Publisher metadata is absent from the capture and is not invented.

## Grade and subject normalization

Kits 135 and 179 are exported as grade 2. Their Kit Details titles, Source Book IDs, kit identities, raw book titles, and chapter context all identify grade 3, so their 363 instructional pages are normalized to grade 3. Kit 140 already has grade 3. Raw and canonical grade counts and every decision remain in both QA snapshots.

All 426 source rows carry the automatic subject \`mathematics / matemaatika / математика\`. First-language pages are normalized to \`Estonian language / eesti keel / эстонский язык\`; kit 140 is normalized to \`Estonian as a second language / eesti keel teise keelena / эстонский язык как второй\`. Generated mathematics aliases are removed from topic arrays while genuine page-specific terms are retained.

## Language decisions

The compact source distribution is et 424, en 1, ru 1. Both anomalous instructional records are normalized to et from page-level evidence:

- https://www.opiq.ee/kit/135/chapter/7352 — raw \`en\`; title and every captured heading are Estonian, with no English instructional text.
- https://www.opiq.ee/kit/140/chapter/7788 — raw \`ru\`; the page is Estonian-language instruction with one retained Russian vocabulary gloss, \`tigu – улитка\`.

The archive's per-book raw JSON says \`ru\` for all books while the compact index says \`et\`. This conflict is recorded as source metadata, not silently erased; canonical page language follows the page-level evidence.

## Technical content repairs

${allRepairs.length} pages receive deterministic text-only normalization supported by the same archive record. Repair categories: ${Object.entries(repairCategories).map(([key, count]) => `${key}=${count}`).join(', ') || 'none'}. The generator removes discretionary soft hyphens, replaces zero-width spacing controls with spaces, applies NFC, and collapses whitespace. It does not rewrite educational prose or invent headings or tasks. Exact URLs, fields, source values, and canonical values are stored in the QA snapshots.

Every canonical page has a title and at least one heading. The capture contains no task examples in either compact or raw chapter representation, so all ${grade3EstonianArchive.first_language_records + grade3EstonianArchive.second_language_records} pages carry an explicit classified warning rather than synthesized exercises.

## Cover-only limitation and targeted recapture

Kit 590, \`Mina loen ja kirjutan 3\`, contains only two duplicate Kit Details records and zero instructional chapters. It is recorded as captured cover-only and is not eligible for page-level evidence.

The exact remaining recapture is **only the instructional chapter pages for kit 590** (plus their normal export metadata). The other three books do not require recapture for canonical routing. A full repeat capture of the whole four-book archive is unnecessary.

## Limitations

- The source capture proves the supplied book/page inventory, not live Opiq catalogue completeness.
- It does not establish official curriculum completeness or teaching readiness.
- Publisher metadata is absent.
- Task examples are absent throughout the capture.
- Kit 590 cannot be used as an instructional source until its chapters are captured.
`;
}

async function validateCrossRouteOwnership(manifest, catalog) {
  const targetUrls = new Set(catalog.canonical_records.map((record) => record.url));
  for (const source of manifest.sources.filter((entry) => !Object.hasOwn(grade3EstonianRoutes, entry.id))) {
    const markdown = await readFile(absolute(source.md_path), 'utf8');
    const urls = [...markdown.matchAll(/^(?:-\s+)?URL:\s+(https?:\/\/\S+)\s*$/gmiu)].map((match) => match[1]);
    const overlap = urls.find((url) => targetUrls.has(url));
    assertGrade3Estonian(!overlap, `Canonical grade-3 Estonian URL ${overlap} also belongs to ${source.id}.`);
  }
}

async function generate() {
  const manifest = parseJson(await readFile(manifestPath, 'utf8'), 'source-manifest.json');
  const firstSource = manifest.sources.find((source) => source.id === 'grade-3-estonian');
  const secondSource = manifest.sources.find((source) => source.id === 'grade-3-estonian-second-language');
  validateManifestGrade3EstonianRoutes(firstSource, secondSource);

  const archivePath = absolute(grade3EstonianArchive.path);
  const archiveStat = await stat(archivePath);
  assertGrade3Estonian(archiveStat.isFile(), 'Original grade-3 Estonian archive is not a file.');
  const archiveBytes = await readFile(archivePath);
  assertGrade3EstonianArchiveIdentity(archiveBytes);
  const archive = await readCompactZip(archivePath);
  assertGrade3Estonian(archive.entryCount === grade3EstonianArchive.member_count, `ZIP has ${archive.entryCount} members; expected ${grade3EstonianArchive.member_count}.`);
  [...archive.entries.keys()].forEach(assertSafeMemberName);
  assertRequiredGrade3EstonianMembers(archive.entries.keys());

  const index = parseJson(readZipText(archive, 'index.json'), 'index.json');
  const rawIndex = parseJson(readZipText(archive, 'raw/Opiq-DB/index.json'), 'raw/Opiq-DB/index.json');
  const sourceRecords = parseGrade3Jsonl(readZipText(archive, 'opiq_lookup.jsonl'), 'opiq_lookup.jsonl');
  const sourceMarkdownRecords = parseGrade3Markdown(readZipText(archive, 'opiq_lookup.md'));
  assertCompactMarkdownMatches(sourceRecords, sourceMarkdownRecords);
  validateIndex(index, rawIndex, sourceRecords, archive);
  const representationAudit = validateRawChapters(sourceRecords, archive);
  const topicAudit = validateTopicMap(parseJson(readZipText(archive, 'topic_map.json'), 'topic_map.json'), sourceRecords);
  const catalog = buildGrade3EstonianCatalog(sourceRecords);

  const outputs = [];
  for (const source of [firstSource, secondSource]) {
    const markdown = renderGrade3EstonianMarkdown(source.id, catalog);
    const qa = buildQa({
      routeId: source.id,
      source,
      sourceRecords,
      catalog,
      archiveBytes,
      archive,
      representationAudit,
      topicAudit,
      markdown,
    });
    outputs.push({
      source,
      markdown,
      qa,
      markdownPath: absolute(source.md_path),
      qaPath: absolute(source.qa_path),
    });
  }

  const audit = renderAudit(outputs[0].qa, outputs[1].qa);
  for (const output of outputs) {
    const qaText = stableJson(output.qa);
    const currentMarkdown = await readFile(output.markdownPath, 'utf8').catch(() => null);
    const currentQa = await readFile(output.qaPath, 'utf8').catch(() => null);
    if (checkOnly) {
      assertGeneratedArtifact(currentMarkdown, output.markdown, sourceLabel(output.source, 'Markdown'));
      assertGeneratedArtifact(currentQa, qaText, sourceLabel(output.source, 'QA snapshot'));
    } else {
      if (currentMarkdown !== output.markdown) await writeFile(output.markdownPath, output.markdown, 'utf8');
      if (currentQa !== qaText) await writeFile(output.qaPath, qaText, 'utf8');
    }
  }
  const currentAudit = await readFile(absolute(auditPath), 'utf8').catch(() => null);
  if (checkOnly) assertGeneratedArtifact(currentAudit, audit, 'grade-3 Estonian audit');
  else if (currentAudit !== audit) await writeFile(absolute(auditPath), audit, 'utf8');

  await validateCrossRouteOwnership(manifest, catalog);
  const firstUrls = new Set(catalog.route_records['grade-3-estonian'].map((record) => record.url));
  assertGrade3Estonian(
    catalog.route_records['grade-3-estonian-second-language'].every((record) => !firstUrls.has(record.url)),
    'The grade-3 Estonian routes overlap by URL.',
  );
  const verb = checkOnly ? 'check passed' : 'generation complete';
  console.log(`Grade 3 Estonian ${verb}: 426 source rows, 363 first-language pages, 54 second-language pages, 0 route overlaps.`);
}

function sourceLabel(source, suffix) {
  return `${source.id} ${suffix}`;
}

try {
  await generate();
} catch (error) {
  console.error(`Grade 3 Estonian generation failed: ${error.message}`);
  process.exitCode = 1;
}
