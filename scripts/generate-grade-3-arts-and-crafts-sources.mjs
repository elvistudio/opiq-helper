#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { readCompactZip, readZipText } from './lib/compact-zip.mjs';
import {
  assertCompactMarkdownMatches,
  assertGeneratedArtifact,
  assertGrade2ArtsArchiveIdentity,
  assertGrade3,
  assertGrade3ArtsArchiveIdentity,
  assertRequiredMembers,
  assertSafeMemberName,
  auditCanonicalContentQuality,
  auditGrade3ArtsZipMemberNames,
  buildGrade3ArtsCatalog,
  compareKit200Captures,
  countBy,
  grade2ArtsArchive,
  grade3ArtsArchive,
  grade3ArtsSubject,
  grade3ArtsVariants,
  isKitDetail,
  kitId,
  normalizeSourceBookId,
  parseGrade3Jsonl,
  parseGrade3Markdown,
  renderGrade3ArtsMarkdown,
  sha256Bytes,
  sourceIdentity,
  sourceSubject,
  validateManifestGrade3ArtsSource,
  validateRawArtsChapters,
} from './lib/grade-3-arts-and-crafts.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const sourceId = 'grade-3-arts-and-crafts';
const generatorPath = 'scripts/generate-grade-3-arts-and-crafts-sources.mjs';
const generatorVersion = '1.0';
const auditPath = 'docs/audits/grade-3-arts-and-crafts-source-import.md';
const checkOnly = process.argv.includes('--check');

function absolute(relativePath) {
  return path.join(repositoryRoot, relativePath);
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is invalid JSON: ${error.message}`);
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function loadRawKit200Map(archive) {
  const result = new Map();
  for (const member of archive.entries.keys()) {
    if (!member.startsWith('raw/Opiq-DB/chapters/') || !member.includes('tähtpäeva')) continue;
    const raw = parseJson(readZipText(archive, member), member);
    const identity = `${raw.bookId}\u0000${raw.chapterId}`;
    assertGrade3(!result.has(identity), `Duplicate grade-2 raw chapter identity ${identity}.`);
    result.set(identity, { member, raw });
  }
  assertGrade3(result.size === 87, `Grade-2 raw kit 200 record count is ${result.size}; expected 87.`);
  return result;
}

function validateIndex(index, rawIndex) {
  for (const [label, value] of [['index.json', index], ['raw/Opiq-DB/index.json', rawIndex]]) {
    assertGrade3(isPlainObject(value), `${label} root must be an object.`);
    assertGrade3(Array.isArray(value.books) && value.books.length === 2, `${label} must contain two books.`);
    assertGrade3(value.generatedAt === grade3ArtsArchive.capture_timestamp, `${label} timestamp differs.`);
  }
  assertGrade3(index.formatVersion === grade3ArtsArchive.format_version, 'index.json format version differs.');
  assertGrade3(index.recordCount === grade3ArtsArchive.source_records, 'index.json source count differs.');
  assertGrade3(index.rawArchiveIncluded === true, 'index.json must declare the raw archive.');
  assertGrade3(JSON.stringify(index.books) === JSON.stringify(rawIndex.books), 'Compact and raw book indexes differ.');
  const expected = [
    ['kunsti-_ja_tööõpetus._3._osa', 91],
    ['kunsti-_ja_tööõpetus._4._osa._tähtpäeva\u00adkaardid', 87],
  ];
  for (const [bookId, count] of expected) {
    const book = index.books.find((entry) => entry.id === bookId);
    assertGrade3(book, `index.json is missing ${bookId}.`);
    assertGrade3(
      book.title === 'Käsitöötuba – Opiq'
        && book.publisher === ''
        && book.grade === 3
        && book.language === 'et'
        && book.subject === ''
        && book.chapterCount === count,
      `index.json metadata differs for ${bookId}.`,
    );
  }
}

function validateRawBooks(archive) {
  const entries = [];
  for (const variant of Object.values(grade3ArtsVariants)) {
    const member = `raw/Opiq-DB/books/${variant.source_book_id}.json`;
    const raw = parseJson(readZipText(archive, member), member);
    assertGrade3(
      raw.id === variant.source_book_id
        && raw.title === variant.raw_title
        && raw.grade === variant.raw_grade
        && raw.language === variant.raw_book_language
        && raw.publisher === ''
        && raw.subject === '',
      `${member} metadata differs from audited evidence.`,
    );
    entries.push({
      source_book_id_raw: raw.id,
      source_book_id_canonical: variant.canonical_source_book_id,
      kit_id: variant.kit_id,
      raw_title: raw.title,
      canonical_title: variant.canonical_title,
      raw_grade: raw.grade,
      canonical_grade: variant.canonical_grade,
      index_language: variant.compact_language,
      raw_book_language: raw.language,
      canonical_language: variant.canonical_language,
      publisher: raw.publisher,
      programme_type: variant.programme_type,
      instructional_pages: variant.instructional_pages,
      canonical_owner: variant.canonical_owner,
    });
  }
  return entries;
}

function validateTopicMap(topicMap, sourceRecords) {
  assertGrade3(isPlainObject(topicMap), 'topic_map.json root must be an object.');
  const text = JSON.stringify(topicMap);
  for (const record of sourceRecords) {
    assertGrade3(
      text.includes(record.url) || record.topics_et.every((topic) => text.includes(topic)),
      `topic_map.json cannot be reconciled with ${record.url}.`,
    );
  }
}

function sourceTextAudit(sourceRecords, rawByIdentity) {
  const hardErrors = {
    zero_width: 0,
    replacement_character: 0,
    forbidden_control_character: 0,
    malformed_unicode: 0,
    html: 0,
    mathml: 0,
    raw_json_payload: 0,
    non_nfc: 0,
    malformed_instructional_url: 0,
    missing_instructional_title: 0,
    missing_instructional_headings: 0,
    media_player_controls: 0,
  };
  let sourceIdentitySoftHyphens = 0;
  let chapterContentSoftHyphens = 0;
  let shortSingleWordTitles = 0;
  const hasUnpairedSurrogate = (text) => {
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = text.charCodeAt(index + 1);
        if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
        index += 1;
      } else if (code >= 0xdc00 && code <= 0xdfff) return true;
    }
    return false;
  };
  for (const record of sourceRecords) {
    const raw = rawByIdentity.get(sourceIdentity(record))?.raw;
    const instructional = !record.url.includes('/Kit/Details/');
    const values = [
      record.title,
      record.book,
      record.book_id,
      ...record.headings,
      ...record.task_examples,
      ...(raw?.headings ?? []).map((entry) => entry.text),
      ...(raw?.tasks ?? []).map((entry) => entry.text),
    ];
    const text = values.join('\n');
    sourceIdentitySoftHyphens += [...String(record.book_id)].filter((character) => character === '\u00ad').length;
    chapterContentSoftHyphens += [...values.filter((value) => value !== record.book_id).join('\n')]
      .filter((character) => character === '\u00ad').length;
    if (/[\u200b-\u200d\u2060\ufeff]/u.test(text)) hardErrors.zero_width += 1;
    if (text.includes('\ufffd')) hardErrors.replacement_character += 1;
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(text)) hardErrors.forbidden_control_character += 1;
    if (hasUnpairedSurrogate(text)) hardErrors.malformed_unicode += 1;
    if (/<[a-z][^>]*>/iu.test(text)) hardErrors.html += 1;
    if (/<math(?:\s|>)/iu.test(text)) hardErrors.mathml += 1;
    if (/(?:^|\s)[[{]\s*"[A-Za-z_][^]*[}\]](?:\s|$)/u.test(text)) hardErrors.raw_json_payload += 1;
    if (text.normalize('NFC') !== text) hardErrors.non_nfc += 1;
    if (instructional && !/^https:\/\/www\.opiq\.ee\/kit\/(?:196|200)\/chapter\/\d+$/u.test(record.url)) {
      hardErrors.malformed_instructional_url += 1;
    }
    const normalizedTitle = String(record.title ?? '').trim();
    if (instructional && !normalizedTitle) hardErrors.missing_instructional_title += 1;
    if (instructional && record.headings.length === 0) hardErrors.missing_instructional_headings += 1;
    if (instructional && /\b(?:media player|audio player|video player|meediapleier)\b/iu.test(text)) {
      hardErrors.media_player_controls += 1;
    }
    if (instructional
      && normalizedTitle.length <= 4
      && !/\s/u.test(normalizedTitle)) {
      shortSingleWordTitles += 1;
    }
  }
  assertGrade3(Object.values(hardErrors).every((count) => count === 0), 'Raw source text contains hard quality errors.');
  assertGrade3(sourceIdentitySoftHyphens === 87, `Source Book ID soft-hyphen row count is ${sourceIdentitySoftHyphens}; expected 87.`);
  assertGrade3(chapterContentSoftHyphens === 0, 'Soft hyphen occurs outside audited Source Book ID metadata.');
  assertGrade3(shortSingleWordTitles === 6, `Short single-word title count is ${shortSingleWordTitles}; expected 6.`);
  return {
    hard_errors: hardErrors,
    source_book_id_soft_hyphen_rows: sourceIdentitySoftHyphens,
    chapter_content_soft_hyphens: chapterContentSoftHyphens,
    chapter_content_repairs: 0,
    classified_warnings: {
      short_single_word_titles: {
        total: shortSingleWordTitles,
        classification: 'valid_named_visual_activities_confirmed_in_compact_and_raw_headings',
      },
      unusually_short_or_truncated_headings: {
        total: 0,
        classification: 'none_detected',
      },
      anomalous_spacing_or_punctuation: {
        total: 0,
        classification: 'none_detected',
      },
    },
  };
}

async function crossRouteOwnership(manifest, canonicalRecords, kit200Records) {
  const canonicalUrls = new Set(canonicalRecords.map((record) => record.url));
  const kit200Urls = new Set(kit200Records.map((record) => record.url));
  const canonicalOverlaps = [];
  const kit200Owners = [];
  let checkedRoutes = 0;
  for (const route of manifest.sources) {
    if (route.id === sourceId) continue;
    checkedRoutes += 1;
    const markdown = await readFile(absolute(route.md_path), 'utf8');
    const urls = new Set(
      [...markdown.matchAll(/^(?:-\s+)?URL:\s+(https?:\/\/\S+)\s*$/gmi)].map((match) => match[1]),
    );
    const overlap = [...canonicalUrls].filter((url) => urls.has(url));
    if (overlap.length > 0) canonicalOverlaps.push({ source_id: route.id, urls: overlap });
    const shared = [...kit200Urls].filter((url) => urls.has(url));
    if (shared.length > 0) kit200Owners.push({ source_id: route.id, url_count: shared.length });
  }
  assertGrade3(canonicalOverlaps.length === 0, 'Kit 196 URLs overlap an existing manifest route.');
  assertGrade3(
    JSON.stringify(kit200Owners) === JSON.stringify([
      { source_id: 'grade-2-arts-and-crafts', url_count: 85 },
    ]),
    `Kit 200 ownership differs: ${JSON.stringify(kit200Owners)}`,
  );
  return {
    checked_routes: checkedRoutes,
    kit_196_overlap_count: 0,
    kit_200_owner_routes: kit200Owners,
    kit_200_owner_count: 1,
  };
}

function renderAudit(qa) {
  const repeated = qa.repeated_title_groups.entries.map(
    (entry) => `- \`${entry.title}\`: ${entry.urls.map((url) => `[${url}](${url})`).join(', ')}.`,
  ).join('\n');
  return `# Grade 3 arts-and-crafts source import audit

## Result

The immutable grade-3 capture contains 178 source rows across kits 196 and 200. The canonical \`grade-3-arts-and-crafts\` route contains the **89** ordinary-curriculum pages of kit 196. The **85** kit 200 instructional pages are byte-stable content equivalents of the supplementary source already owned by \`grade-2-arts-and-crafts\`; they are audited but not duplicated.

This is a supplied-source catalogue result, not proof of official-curriculum completeness or complete current live Opiq catalogue coverage.

## Archive identity

| SHA-256 | Bytes | Uncompressed bytes | Members | Capture |
| --- | ---: | ---: | ---: | --- |
| \`${qa.checksums.source_archive_sha256}\` | ${qa.archive.byte_size} | ${qa.archive.uncompressed_size} | ${qa.archive.member_count} | ${qa.generation.generated_at} |

Every member passes central-directory, local/central filename, size, CRC-32, safe-path, and stored-compression checks. The archive is committed byte-for-byte unchanged.

## Filename encoding

All ${qa.filename_encoding_audit.member_count} members omit the ZIP UTF-8 flag. ${qa.filename_encoding_audit.non_ascii_recoveries} non-ASCII stored names are recovered by the reversible transformation **CP437 display → original bytes → strict UTF-8**, while ${qa.filename_encoding_audit.ascii_only_names} names are ASCII-only. All names round-trip, map unambiguously to the two Source Book IDs where applicable, and produce zero decoded-name collisions. The ZIP itself is never rewritten.

## Complete source accounting

| Category | Count |
| --- | ---: |
| Kit 196 instructional pages | 89 |
| Kit 200 already-owned shared supplementary pages | 85 |
| Unique Kit Details | 2 |
| Duplicate Kit Details aliases | 2 |
| **Total source rows** | **178** |

There are no Impressum, search-result, or other administrative rows. Both Kit Details pairs are content-equivalent and differ only by synthetic chapter ID: kit 196 uses 88/178; kit 200 uses 1/87.

## Book and route decisions

| Kit | Source Book ID | Canonical Book ID | Canonical title | Pages | Type | Owner |
| ---: | --- | --- | --- | ---: | --- | --- |
| 196 | \`kunsti-_ja_tööõpetus._3._osa\` | \`kunsti-_ja_tööõpetus._3._osa__kit196\` | Kunsti- ja tööõpetus. 3. osa | 89 | ordinary | \`grade-3-arts-and-crafts\` |
| 200 | \`kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid\` | same | Kunsti- ja tööõpetus. 4. osa. Tähtpäevakaardid | 85 | supplementary | \`grade-2-arts-and-crafts\` |

Publisher metadata is empty in index, raw-book, and compact records, so no publisher is invented.

## Kit 200 cross-grade comparison

The current grade-2 archive, the new grade-3 archive, the grade-2 canonical Markdown, and both raw representations were compared for every instructional page:

- 85/85 direct URL, kit, chapter ID, Source Book ID, title, heading, topic, task, language, subject, publisher, and ordering matches;
- 85/85 raw chapter-title, heading, task, keyword, image-reference, and image-hash matches;
- compact records differ only in automatic export grade (2 versus 3);
- raw chapters differ only in capture timestamp;
- the grade-2 route owns all 85 pages as \`supplementary\`;
- zero URLs are lost and zero URLs are duplicated across canonical routes.

The capture grade is not intrinsic evidence that this shared card collection belongs specifically to grade 3. Existing grade-2 ownership therefore remains authoritative.

## Metadata normalization

All 178 compact rows carry the erroneous automatic subject \`mathematics / matemaatika / математика\`. The kit 196 canonical pages are normalized to \`arts and crafts / kunst ja tööõpetus / трудовое обучение и искусство\` using Source Book ID, kit identity, complete craft chapter sequence, headings, and image evidence. Mathematics topic aliases are removed; genuine mathematical vocabulary would be retained.

Both compact indexes and every page record say \`et\`, while both raw book objects say \`ru\`. Canonical language is \`et\`; the raw-book anomaly remains explicit in QA. The sole discretionary soft hyphen occurs in kit 200 identity metadata and is removed only from the canonical Source Book ID. Educational prose is unchanged.

## Content quality and limitations

All 174 instructional records have headings and direct URLs. The raw archive contains **491** image references: 364 for kit 196 and 127 for kit 200. No zero-width, replacement, control, malformed-Unicode, NFC, HTML, MathML, raw-JSON, media-player-control, malformed-URL, or Markdown damage was found. No chapter-content repair was required.

Six short single-word titles (\`Puu\`, \`Pits\`, \`Kask\`, \`Muna\`, \`Kala\`, and \`Pall\`) are identical in compact titles and raw headings and are classified as valid named visual activities, not truncation. No single-character heading, suspiciously truncated heading, or anomalous spacing/punctuation case remains unclassified.

All 174 compact and raw task arrays are empty. These image-heavy pages still describe practical craft activities, but the capture does not contain structured step-by-step task text. No instruction is reconstructed from filenames or images. A future **targeted task-body capture** may help lesson authoring; a full recapture is not required for canonical routing.

## Repeated titles

Title equality is not used for deduplication. These distinct URLs are retained:

${repeated}

## Ownership and completeness boundaries

Kit 196 has no URL overlap with another canonical route. Kit 200 has exactly one owner, \`grade-2-arts-and-crafts\`. Grade-2 pages are not used as substitutes for kit 196. The resulting route is searchable source evidence only; it is not a curriculum map and does not establish live-catalogue completeness.
`;
}

async function main() {
  const manifest = parseJson(await readFile(absolute('source-manifest.json'), 'utf8'), 'source-manifest.json');
  const source = manifest.sources.find((entry) => entry.id === sourceId);
  validateManifestGrade3ArtsSource(source);

  const archiveBytes = await readFile(absolute(grade3ArtsArchive.path));
  assertGrade3ArtsArchiveIdentity(archiveBytes);
  const archive = await readCompactZip(absolute(grade3ArtsArchive.path));
  assertGrade3(archive.entryCount === grade3ArtsArchive.member_count, 'Original ZIP member count differs.');
  assertGrade3(
    [...archive.memberMetadata.values()].reduce((total, entry) => total + entry.uncompressed_size, 0)
      === grade3ArtsArchive.uncompressed_size,
    'Original ZIP uncompressed size differs.',
  );
  assertGrade3(
    [...archive.memberMetadata.values()].every((entry) => entry.compression_method === 0),
    'Every original ZIP member must use stored compression.',
  );
  [...archive.entries.keys()].forEach(assertSafeMemberName);
  assertRequiredMembers(archive.entries.keys());
  const filenameAudit = auditGrade3ArtsZipMemberNames(archive.memberMetadata);

  const index = parseJson(readZipText(archive, 'index.json'), 'index.json');
  const rawIndex = parseJson(readZipText(archive, 'raw/Opiq-DB/index.json'), 'raw/Opiq-DB/index.json');
  validateIndex(index, rawIndex);
  const sourceRecords = parseGrade3Jsonl(readZipText(archive, 'opiq_lookup.jsonl'));
  assertCompactMarkdownMatches(sourceRecords, parseGrade3Markdown(readZipText(archive, 'opiq_lookup.md')));
  validateTopicMap(parseJson(readZipText(archive, 'topic_map.json'), 'topic_map.json'), sourceRecords);
  const rawValidation = validateRawArtsChapters(sourceRecords, archive, readZipText);
  const rawBooks = validateRawBooks(archive);
  const catalog = buildGrade3ArtsCatalog(sourceRecords);

  const grade2Bytes = await readFile(absolute(grade2ArtsArchive.path));
  assertGrade2ArtsArchiveIdentity(grade2Bytes);
  const grade2Archive = await readCompactZip(absolute(grade2ArtsArchive.path));
  const grade2Records = parseGrade3Jsonl(readZipText(grade2Archive, 'opiq_lookup.jsonl'));
  const grade2RawKit200 = loadRawKit200Map(grade2Archive);
  const grade2Canonical = parseGrade3Markdown(
    await readFile(absolute('project-files/outputs/opiq_2klass_kunst_ja_tooopetus.md'), 'utf8'),
  );
  const kit200Comparison = compareKit200Captures(
    sourceRecords,
    grade2Records,
    rawValidation.raw_by_identity,
    grade2RawKit200,
    grade2Canonical,
  );
  const crossRouteAudit = await crossRouteOwnership(
    manifest,
    catalog.canonical_records,
    catalog.shared_supplementary_records,
  );
  const sourceQuality = sourceTextAudit(sourceRecords, rawValidation.raw_by_identity);
  const contentQuality = auditCanonicalContentQuality(catalog.canonical_records);
  const markdown = renderGrade3ArtsMarkdown(catalog);

  const qa = {
    qa_schema_version: '1.0',
    source_id: sourceId,
    source_archive: source.source_archive,
    output_file: source.md_path,
    format_version: source.format_version,
    generation: {
      status: 'generated',
      generated_at: grade3ArtsArchive.capture_timestamp,
      generator: generatorPath,
      generator_version: generatorVersion,
      note: 'Generated deterministically from the immutable original archive. Kit 200 remains canonically owned by the grade-2 supplementary route after complete stable comparison.',
    },
    checksums: {
      source_archive_sha256: grade3ArtsArchive.sha256,
      output_file_sha256: sha256Bytes(Buffer.from(markdown)),
    },
    archive: {
      path: grade3ArtsArchive.path,
      sha256: grade3ArtsArchive.sha256,
      byte_size: grade3ArtsArchive.byte_size,
      uncompressed_size: grade3ArtsArchive.uncompressed_size,
      member_count: archive.entryCount,
      crc_verified_members: archive.entryCount,
      declared_and_actual_sizes_verified: archive.entryCount,
      unique_stored_member_names: archive.entryCount,
      safe_relative_member_names: archive.entryCount,
      local_central_filename_matches: archive.entryCount,
      compression_methods: { stored: archive.entryCount, deflate: 0 },
      capture_timestamp: grade3ArtsArchive.capture_timestamp,
    },
    filename_encoding_audit: filenameAudit,
    source_records: sourceRecords.length,
    page_records_included: catalog.canonical_records.length,
    cover_detail_records_excluded: catalog.exclusions.cover_details.length,
    administrative_records_excluded: 0,
    duplicate_records_excluded: catalog.exclusions.duplicate_aliases.length,
    subject_boundary_page_records_excluded: catalog.shared_supplementary_records.length,
    source_accounting: {
      kit_196_instructional_pages: 89,
      kit_200_already_owned_shared_supplementary_pages: 85,
      unique_kit_details: 2,
      duplicate_kit_detail_aliases: 2,
      unexplained_rows: 0,
      total: 178,
    },
    source_representation_audit: {
      compact_jsonl_vs_markdown: {
        compared_records: 178,
        unexplained_differences: 0,
      },
      compact_vs_raw: rawValidation.audit,
      index_vs_raw_index: {
        compared_books: 2,
        unexplained_differences: 0,
      },
      topic_map: {
        validated: true,
        unexplained_differences: 0,
      },
    },
    captured_book_inventory: rawBooks,
    raw_grade_counts: countBy(sourceRecords, (record) => record.grade),
    raw_subject_counts: countBy(sourceRecords, sourceSubject),
    canonical_subject_counts: {
      [`${grade3ArtsSubject.en} / ${grade3ArtsSubject.et} / ${grade3ArtsSubject.ru}`]: 89,
    },
    raw_language_counts: countBy(sourceRecords, (record) => record.language),
    canonical_language_counts: { et: 89 },
    subject_normalization_audit: {
      corrected_source_rows: 178,
      canonical_page_records: 89,
      source_subject: 'mathematics / matemaatika / математика',
      canonical_subject: `${grade3ArtsSubject.en} / ${grade3ArtsSubject.et} / ${grade3ArtsSubject.ru}`,
      generated_mathematics_aliases_removed: true,
      evidence: 'Source Book IDs, kits 196/200, complete craft chapter sequences, Estonian craft headings, and 491 raw image references.',
    },
    language_normalization_audit: {
      compact_page_language: { et: 178 },
      index_book_language: { et: 2 },
      raw_book_language: { ru: 2 },
      canonical_page_language: { et: 89 },
      decision: 'Use compact index and page-level Estonian evidence; retain the raw-book ru anomaly in QA.',
    },
    identity_normalization_audit: {
      source_book_id_raw: grade3ArtsVariants['kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid'].source_book_id,
      source_book_id_canonical: 'kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid',
      soft_hyphen_removed_from_identity_only: true,
      educational_content_changed: false,
    },
    duplicate_url_audit: catalog.duplicate_audit,
    kit_200_comparison: kit200Comparison,
    canonical_ownership: {
      kit_196: 'grade-3-arts-and-crafts',
      kit_200: 'grade-2-arts-and-crafts',
      lost_urls: 0,
      duplicate_canonical_ownership: 0,
    },
    image_audit: rawValidation.audit.images_by_kit,
    repeated_title_groups: {
      groups: catalog.repeated_title_groups.length,
      records: catalog.repeated_title_groups.reduce((total, entry) => total + entry.urls.length, 0),
      entries: catalog.repeated_title_groups,
    },
    content_repair_audit: {
      identity_soft_hyphen_normalization: 1,
      chapter_content_repairs: 0,
      invented_publishers: 0,
      invented_tasks: 0,
    },
    raw_content_quality_audit: sourceQuality,
    content_quality_audit: contentQuality,
    records_without_task_examples: 89,
    source_instructional_records_without_tasks: 174,
    publisher_limitations: {
      publisher_values_present: 0,
      canonical_publishers_invented: 0,
      decision: 'Publisher metadata is absent and remains empty.',
    },
    canonical_url_audit: {
      unique: true,
      duplicate_count: 0,
      direct_chapter_urls: 89,
      cross_route: crossRouteAudit,
      final_owner: sourceId,
    },
    grades: { 3: 89 },
    languages: { et: 89 },
    books: { 'kunsti-_ja_tööõpetus._3._osa__kit196': 89 },
    kits: { 196: 89 },
    known_limitations: [
      'All 174 instructional pages in the source archive lack structured task arrays; no image-based instructions are reconstructed.',
      'Publisher metadata is absent and is not invented.',
      'This import does not establish official-curriculum or live-catalogue completeness.',
    ],
  };
  const qaText = `${JSON.stringify(qa, null, 2)}\n`;
  const auditText = renderAudit(qa);

  if (checkOnly) {
    assertGeneratedArtifact(await readFile(absolute(source.md_path), 'utf8'), markdown, source.md_path);
    assertGeneratedArtifact(await readFile(absolute(source.qa_path), 'utf8'), qaText, source.qa_path);
    assertGeneratedArtifact(await readFile(absolute(auditPath), 'utf8'), auditText, auditPath);
    console.log(`Grade 3 arts-and-crafts artifacts are current: ${sourceRecords.length} rows, 89 canonical pages, kit 200 owner ${kit200Comparison.canonical_owner}.`);
    return;
  }

  await writeFile(absolute(source.md_path), markdown);
  await writeFile(absolute(source.qa_path), qaText);
  await writeFile(absolute(auditPath), auditText);
  console.log(`Generated ${source.md_path}, ${source.qa_path}, and ${auditPath}.`);
}

await main();
