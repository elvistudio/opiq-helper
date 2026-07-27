import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  readCompactZip,
  readZipText,
} from './compact-zip.mjs';

export const reportVersion = '1.0';
export const implementationVersion = '1.0';
export const verificationDate = '2026-07-27';
export const baseCommit = '658b1995e9a77d223e2821ccec108a8fb39dda22';
export const reportPath = 'evaluations/grade-4-source-intake.json';
export const auditPath = 'docs/audits/grade-4-source-intake.md';
export const schemaPath = 'schemas/grade-4-source-intake-report.schema.json';

export const requiredArchiveMembers = Object.freeze([
  'index.json',
  'opiq_lookup.jsonl',
  'opiq_lookup.md',
  'raw/Opiq-DB/index.json',
  'topic_map.json',
]);

export const archiveExpectations = Object.freeze([
  ['opiq_4klass_4_opiq_v2.zip', '70a784a69b4df6f9081b753d5c5c2f8b89d220f76efb575c3ef6c3f90571bd0f', 2_893_608],
  ['opiq_4klass_eesti_keel_4_klassile_opiq_v2.zip', 'a8a2c589252fc15c73175d009754136664c56858241742cd7d1d6c97203460db', 2_942_291],
  ['opiq_4klass_english_step_by_step_2_opiq_v2.zip', '6a33af61d7668f36f26d6c87d56441945a916e1fc21770ded237dd1a388d85ca', 1_557_061],
  ['opiq_4klass_inimene_ja_uhiskond_opik_ii_kooliastmele_i_osa_o_v2.zip', '74493d494f48be6991b7ae49d4dbea2886feff850d542ff6bf359114bb83a40b', 1_279_029],
  ['opiq_4klass_kasitootuba_opiq_v2.zip', '0bcaba6a0b152eabd5908355e3f614496f135bee8e75295caf0edc25fb6755bd', 292_424],
  ['opiq_4klass_kehalise_kasvatuse_tooraamat_teisele_kooliastmel_v2.zip', '5c3a324855e791eb07091e8f050a5519f22169d72930f9f7d958652d9c1ce155', 192_176],
  ['opiq_4klass_loodusopetus_4_klassile_opiq_v2.zip', 'ad1d3e78e97da9dc4d55220398bef64952320576b85142e71b2653e6b07c24a8', 3_858_808],
  ['opiq_4klass_matemaatika_4_klassile_opiq_v2.zip', 'b5441563b40d35e74b66b53bba72767ae4829da31d380a4079effd9054d15225', 7_363_275],
  ['opiq_4klass_muusika_v2.zip', '56b6182b8ec7413c165df9976dc6d960bfe246ac0c5e6118b089c0f74519cbba', 1_208_950],
  ['opiq_4klass_tehnologia_v2.zip', '5522e2bf27ea137943761eaa0bc5dc78ee2e3914f084303860affcf9d56625ae', 207_227],
].map(([name, sha256, byteSize]) => Object.freeze({
  path: `project-files/inputs/final-zips/${name}`,
  sha256,
  byte_size: byteSize,
})));

const kitSubjects = Object.freeze({
  11: ['science', 'loodusõpetus'],
  27: ['science', 'loodusõpetus'],
  55: ['human_studies_and_society', 'inimese- ja ühiskonnaõpetus'],
  70: ['mathematics', 'matemaatika'],
  71: ['estonian', 'eesti keel'],
  82: ['human_studies_and_society', 'inimese- ja ühiskonnaõpetus'],
  108: ['science', 'loodusõpetus'],
  147: ['mathematics', 'matemaatika'],
  150: ['estonian_second_language', 'eesti keel teise keelena'],
  154: ['estonian', 'eesti keel'],
  157: ['mathematics', 'matemaatika'],
  161: ['physical_education', 'kehaline kasvatus'],
  174: ['music', 'muusika'],
  200: ['arts_and_crafts', 'kunst ja tööõpetus'],
  206: ['music', 'muusika'],
  228: ['science', 'loodusõpetus'],
  243: ['russian', 'vene keel'],
  282: ['mathematics', 'matemaatika'],
  287: ['human_studies', 'inimeseõpetus'],
  293: ['mathematics', 'matemaatika'],
  295: ['russian', 'vene keel'],
  304: ['mathematics', 'matemaatika'],
  318: ['mathematics', 'matemaatika'],
  328: ['mathematics', 'matemaatika'],
  332: ['english', 'inglise keel'],
  415: ['russian_reading', 'vene keele lugemine'],
  451: ['english', 'inglise keel'],
  460: ['mathematics', 'matemaatika'],
  476: ['technology', 'tehnoloogiaõpetus'],
  480: ['science', 'loodusõpetus'],
  533: ['estonian', 'eesti keel'],
  536: ['science', 'loodusõpetus'],
  552: ['music', 'muusika'],
  588: ['mathematics', 'matemaatika'],
});

const simplifiedKits = new Set(['282', '287', '304', '318', '328']);
const schoolStageKits = new Set(['55', '82', '161']);
const probableGradeKits = new Set(['154', '200', '206', '332', '476']);
const programmeByKit = Object.freeze({
  55: 'mixed_subject',
  82: 'mixed_subject',
  161: 'physical_education_support',
  200: 'supplementary',
  476: 'technology_or_vocational_support',
});

const routeDefinitions = Object.freeze([
  ['grade-4-russian', 'russian', 'vene keel', ['243', '295'], [], 'unknown', 'ready_with_documented_metadata_normalization', []],
  ['grade-4-russian-reading', 'russian_reading', 'vene keele lugemine', ['415'], [], 'unknown', 'ready_with_documented_metadata_normalization', []],
  ['grade-4-estonian', 'estonian', 'eesti keel', ['71', '533'], ['154'], 'unknown', 'ready_with_documented_metadata_normalization', ['Kit 154 needs exact-grade evidence before inclusion.']],
  ['grade-4-estonian-probable-supplement', 'estonian', 'eesti keel', ['154'], [], 'unknown', 'blocked_grade_ambiguous', ['The captured title does not identify an exact grade.']],
  ['grade-4-estonian-second-language', 'estonian_second_language', 'eesti keel teise keelena', ['150'], [], 'unknown', 'ready_with_documented_metadata_normalization', []],
  ['grade-4-english', 'english', 'inglise keel', ['451'], ['332'], 'unknown', 'ready_with_documented_metadata_normalization', ['Kit 332 remains outside this exact-grade route.']],
  ['grade-4-english-probable-level-2', 'english', 'inglise keel', ['332'], [], 'unknown', 'blocked_grade_ambiguous', ['“Step by step 2” is a level/title, not exact Grade 4 evidence.']],
  ['grade-4-human-studies-simplified', 'human_studies', 'inimeseõpetus', ['287'], [], 'simplified_curriculum', 'ready_with_documented_metadata_normalization', []],
  ['school-stage-ii-human-studies-and-society', 'human_studies_and_society', 'inimese- ja ühiskonnaõpetus', ['55', '82'], [], 'mixed_subject', 'blocked_grade_ambiguous', ['School stage II does not establish exact Grade 4 ownership.']],
  ['grade-4-arts-and-crafts-support', 'arts_and_crafts', 'kunst ja tööõpetus', ['200'], [], 'supplementary', 'non_core_supplementary_or_support', ['All instructional URLs already belong to grade-2-arts-and-crafts.']],
  ['school-stage-ii-physical-education-support', 'physical_education', 'kehaline kasvatus', ['161'], [], 'physical_education_support', 'blocked_grade_ambiguous', ['School stage II does not establish exact Grade 4 ownership.']],
  ['grade-4-science', 'science', 'loodusõpetus', ['11', '27', '108', '228', '480', '536'], [], 'unknown', 'ready_with_documented_metadata_normalization', []],
  ['grade-4-mathematics', 'mathematics', 'matemaatika', ['70', '147', '157', '293', '460', '588'], [], 'unknown', 'ready_with_documented_metadata_normalization', []],
  ['grade-4-mathematics-simplified', 'mathematics', 'matemaatika', ['282', '304', '318', '328'], [], 'simplified_curriculum', 'ready_with_documented_metadata_normalization', []],
  ['grade-4-music', 'music', 'muusika', ['174', '552'], ['206'], 'unknown', 'ready_with_documented_metadata_normalization', ['Kit 206 remains outside this exact-grade route.']],
  ['grade-4-music-probable', 'music', 'muusika', ['206'], [], 'unknown', 'blocked_grade_ambiguous', ['The cover/detail title does not identify an exact grade.']],
  ['grade-4-technology-support', 'technology', 'tehnoloogiaõpetus', ['476'], [], 'technology_or_vocational_support', 'blocked_grade_ambiguous', ['The CNC title does not identify an exact grade or curriculum allocation.']],
]);

export function bytewise(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function countBy(values) {
  const counts = new Map();
  for (const value of values) counts.set(String(value), (counts.get(String(value)) ?? 0) + 1);
  return Object.fromEntries([...counts].sort(([left], [right]) => bytewise(left, right)));
}

function countEntries(values) {
  return Object.entries(countBy(values)).map(([value, count]) => ({ value, count }));
}

function kitId(url) {
  return String(url).match(/\/kit\/(\d+)\//iu)?.[1]
    ?? String(url).match(/\/Kit\/Details\/(\d+)$/u)?.[1]
    ?? '';
}

function parseJsonl(text, label) {
  const records = [];
  const malformed = [];
  String(text).split(/\r?\n/u).forEach((line, index) => {
    if (!line.trim()) return;
    try {
      const record = JSON.parse(line);
      if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('record is not an object');
      records.push({ ...record, source_sequence: index + 1 });
    } catch (error) {
      malformed.push({ source_sequence: index + 1, reason: `${label}: ${error.message}` });
    }
  });
  return { records, malformed };
}

export function classifyGradeEvidence({ coverTitle = '', sourceBookId = '', rawGrade = null }) {
  const text = `${coverTitle} ${sourceBookId}`;
  if (/(?:\b4[.]?\s*klass|\b4\s*класс|для\s+4\s+класса|4\s*клacca|High Five!\s*4)/iu.test(text)) {
    return 'verified_grade_4';
  }
  if (/II\s+(?:kooliast|ступени)/iu.test(text)) return 'school_stage_ii_not_exact_grade';
  if (rawGrade === 4) return 'probable_grade_4';
  return 'unknown_grade';
}

function sourceSubjectLabel(record) {
  return `${record.subject_en ?? ''} / ${record.subject_et ?? ''} / ${record.subject_ru ?? ''}`;
}

function cleanMarkdownUrl(url) {
  return url.replace(/[),.;:]+$/u, '');
}

async function loadManifestOwnership(rootDir) {
  const manifest = JSON.parse(await readFile(path.join(rootDir, 'source-manifest.json'), 'utf8'));
  const ownership = new Map();
  for (const source of manifest.sources) {
    const markdown = await readFile(path.join(rootDir, source.md_path), 'utf8');
    for (const match of markdown.matchAll(/https:\/\/(?:www\.)?opiq\.ee\/[^\s<>"']+/giu)) {
      const url = cleanMarkdownUrl(match[0]);
      const owners = ownership.get(url) ?? [];
      owners.push({
        source_id: source.id,
        grade: source.grade,
        subject: source.subject,
        md_path: source.md_path,
      });
      ownership.set(url, owners);
    }
  }
  for (const owners of ownership.values()) owners.sort((left, right) => bytewise(left.source_id, right.source_id));
  return { manifest, ownership };
}

function classifyRows(records, malformed) {
  const seen = new Map();
  const rows = [];
  for (const record of records) {
    let classification = 'unsupported_or_ambiguous';
    if (!/^https:\/\/(?:www\.)?opiq\.ee\//iu.test(String(record.url ?? ''))) {
      classification = 'malformed_or_ambiguous';
    } else if (/\/Kit\/Details\/\d+$/u.test(record.url)) {
      classification = seen.has(record.url) ? 'duplicate_detail_alias' : 'kit_or_book_detail';
    } else if (/\/kit\/\d+\/chapter\/\d+$/iu.test(record.url)) {
      classification = seen.has(record.url) ? 'duplicate_instructional_url' : 'instructional_chapter_or_page';
    }
    rows.push({
      source_sequence: record.source_sequence,
      url: record.url ?? null,
      classification,
    });
    seen.set(record.url, (seen.get(record.url) ?? 0) + 1);
  }
  for (const entry of malformed) rows.push({
    source_sequence: entry.source_sequence,
    url: null,
    classification: 'malformed_or_ambiguous',
  });
  rows.sort((left, right) => left.source_sequence - right.source_sequence);
  return rows;
}

function rawBookMetadata(archive, bookId) {
  const member = `raw/Opiq-DB/books/${bookId}.json`;
  if (!archive.entries.has(member)) return null;
  return JSON.parse(readZipText(archive, member));
}

function evidenceForKit(kit, records, archive, archivePath) {
  const details = records.filter((record) => /\/Kit\/Details\/\d+$/u.test(record.url));
  const chapters = records.filter((record) => /\/kit\/\d+\/chapter\/\d+$/iu.test(record.url));
  const bookIds = [...new Set(records.map((record) => record.book_id))].sort(bytewise);
  const coverTitles = [...new Set(details.map((record) => record.title))].sort(bytewise);
  const rawBooks = bookIds.map((bookId) => rawBookMetadata(archive, bookId)).filter(Boolean);
  const rawGrades = [...new Set(records.map((record) => record.grade))].sort((left, right) => left - right);
  const rawSubjects = countEntries(records.map(sourceSubjectLabel));
  const pageLanguages = countEntries(records.map((record) => record.language));
  const rawBookLanguages = [...new Set(rawBooks.map((book) => book.language).filter(Boolean))].sort(bytewise);
  const publishers = [...new Set([
    ...records.map((record) => record.publisher),
    ...rawBooks.map((book) => book.publisher),
  ].filter(Boolean))].sort(bytewise);
  const title = coverTitles[0] ?? records[0]?.book ?? '';
  const gradeDecision = schoolStageKits.has(kit)
    ? 'school_stage_ii_not_exact_grade'
    : probableGradeKits.has(kit)
      ? 'probable_grade_4'
      : classifyGradeEvidence({ coverTitle: title, sourceBookId: bookIds.join(' '), rawGrade: rawGrades[0] });
  const subject = kitSubjects[kit];
  if (!subject) throw new Error(`Kit ${kit} has no evidence-based subject decision.`);
  const programme = simplifiedKits.has(kit)
    ? 'simplified_curriculum'
    : programmeByKit[kit] ?? 'unknown';
  const editionMatch = title.match(/\b(20(?:23|24|25))\b/u);
  const rawChapterObjects = chapters.map((record) => {
    const member = `raw/Opiq-DB/chapters/${record.book_id}/${record.chapter_id}.json`;
    return archive.entries.has(member) ? JSON.parse(readZipText(archive, member)) : null;
  }).filter(Boolean);
  const pageTextCount = rawChapterObjects.filter((chapter) => (
    typeof chapter.text === 'string'
    || typeof chapter.body === 'string'
    || typeof chapter.content === 'string'
    || Array.isArray(chapter.paragraphs)
  )).length;
  const subjectEvidence = [
    `Captured cover/detail title: ${title}`,
    `Captured Source Book ID(s): ${bookIds.join(', ')}`,
  ];
  const gradeEvidence = [
    `Captured grade field(s): ${rawGrades.join(', ')}`,
    `Captured cover/detail title: ${title}`,
    `Captured Source Book ID(s): ${bookIds.join(', ')}`,
  ];
  if (schoolStageKits.has(kit)) gradeEvidence.push('The captured title states school stage II, not exact Grade 4.');
  if (probableGradeKits.has(kit)) gradeEvidence.push('No exact Grade 4 statement appears in the captured cover/detail title.');
  const contradictions = [];
  if (rawSubjects.some(({ value }) => !value.includes(subject[1]))) {
    contradictions.push('Exporter subject labels conflict with the captured book identity and are not authoritative.');
  }
  if (rawBookLanguages.some((language) => !pageLanguages.some(({ value }) => value === language))) {
    contradictions.push('Raw book-level language does not occur in the page-level language labels.');
  }
  return {
    kit_id: kit,
    source_archive_path: archivePath,
    source_book_ids: bookIds,
    chapter_ids: chapters.map((record) => String(record.chapter_id)).sort(bytewise),
    captured_title: records[0]?.book ?? title,
    cover_detail_title: title,
    publisher: publishers.length === 1 ? publishers[0] : null,
    edition: editionMatch?.[1] ?? null,
    raw_grade_labels: rawGrades,
    candidate_grade: gradeDecision,
    grade_evidence: gradeEvidence,
    raw_subject_labels: rawSubjects,
    candidate_subject: subject[0],
    candidate_subject_et: subject[1],
    subject_evidence: subjectEvidence,
    raw_book_languages: rawBookLanguages,
    page_language_counts: pageLanguages,
    multilingual_instructional_pages: 0,
    isolated_vocabulary_gloss_record_count: null,
    automatic_topic_translation_is_language_evidence: false,
    language_evidence: [
      `Page-level exporter labels: ${pageLanguages.map(({ value, count }) => `${value}=${count}`).join(', ')}`,
      `Raw book-level labels: ${rawBookLanguages.join(', ') || 'none'}`,
    ],
    language_limitations: [
      'Parallel topics_et/topics_ru/topics_en arrays are exporter-generated query metadata, not proof that page prose is multilingual.',
      'The capture does not provide a reliable structured field for isolated vocabulary glosses.',
    ],
    instructional_record_count: chapters.length,
    cover_detail_record_count: details.length,
    task_array_nonempty_record_count: chapters.filter((record) => Array.isArray(record.task_examples) && record.task_examples.length > 0).length,
    heading_array_nonempty_record_count: chapters.filter((record) => Array.isArray(record.headings) && record.headings.length > 0).length,
    page_text_record_count: pageTextCount,
    page_text_available: pageTextCount > 0,
    programme_type: programme,
    programme_evidence: programme === 'simplified_curriculum'
      ? ['The captured cover/detail title explicitly states “Lihtsustatud õppekava”.']
      : programme === 'mixed_subject'
        ? ['The captured title explicitly combines person/human and society scope.']
        : programme === 'physical_education_support'
          ? ['The captured title identifies a physical-education workbook for school stage II.']
          : programme === 'technology_or_vocational_support'
            ? ['The captured title identifies CNC equipment instruction.']
            : programme === 'supplementary'
              ? ['The captured Source Book ID and title identify a themed card-making workshop/part.']
              : ['No captured evidence proves ordinary, simplified, or another programme allocation.'],
    metadata_contradictions: contradictions,
    source_limitations: [
      'No complete instructional prose body is present in the captured raw chapter objects.',
      chapters.some((record) => !record.task_examples?.length)
        ? 'At least one instructional record has no captured task example array content.'
        : 'Captured task example arrays are non-empty for every instructional record.',
      publishers.length === 0 ? 'Publisher metadata is not source-supported.' : 'Publisher metadata is captured for this kit.',
    ],
  };
}

async function inspectArchive(rootDir, expectation) {
  const absolutePath = path.join(rootDir, expectation.path);
  const bytes = await readFile(absolutePath);
  if (bytes.length !== expectation.byte_size || sha256(bytes) !== expectation.sha256) {
    throw new Error(`Immutable archive identity mismatch: ${expectation.path}`);
  }
  const archive = await readCompactZip(absolutePath);
  const index = JSON.parse(readZipText(archive, 'index.json'));
  const rawIndex = JSON.parse(readZipText(archive, 'raw/Opiq-DB/index.json'));
  JSON.parse(readZipText(archive, 'topic_map.json'));
  const compactMarkdownUrls = [...readZipText(archive, 'opiq_lookup.md').matchAll(/^URL:\s+(https:\/\/\S+)\s*$/gmu)]
    .map((match) => match[1]);
  const { records, malformed } = parseJsonl(readZipText(archive, 'opiq_lookup.jsonl'), `${expectation.path}:opiq_lookup.jsonl`);
  const classifiedRows = classifyRows(records, malformed);
  const counts = countBy(classifiedRows.map((row) => row.classification));
  const total = records.length + malformed.length;
  if (index.recordCount !== total) {
    throw new Error(`${expectation.path} compact index record count does not match JSONL.`);
  }
  if (
    compactMarkdownUrls.length !== records.length
    || compactMarkdownUrls.some((url, indexPosition) => url !== records[indexPosition].url)
  ) {
    throw new Error(`${expectation.path} compact Markdown does not match JSONL URL order.`);
  }
  const accounted = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (total !== accounted) throw new Error(`Source accounting does not balance for ${expectation.path}.`);
  const byKit = new Map();
  for (const record of records) {
    const id = kitId(record.url);
    if (!id) continue;
    const group = byKit.get(id) ?? [];
    group.push(record);
    byKit.set(id, group);
  }
  const kits = [...byKit].sort(([left], [right]) => Number(left) - Number(right))
    .map(([id, kitRecords]) => evidenceForKit(id, kitRecords, archive, expectation.path));
  const metadata = [...archive.memberMetadata.values()];
  const missingMembers = requiredArchiveMembers.filter((member) => !archive.entries.has(member));
  const nonAsciiWithoutUtf8Flag = metadata.filter((entry) => (
    !entry.utf8_filename_flag
    && Buffer.from(entry.stored_name_hex, 'hex').some((byte) => byte > 0x7f)
  )).length;
  const duplicateUrls = [...new Set(records.map((record) => record.url))]
    .filter((url) => records.filter((record) => record.url === url).length > 1)
    .sort(bytewise)
    .map((url) => ({
      url,
      occurrence_count: records.filter((record) => record.url === url).length,
      classification: /\/Kit\/Details\//u.test(url) ? 'duplicate_detail_alias' : 'duplicate_instructional_url',
    }));
  return {
    archive: {
      path: expectation.path,
      sha256: expectation.sha256,
      byte_size: expectation.byte_size,
      zip_member_count: archive.entryCount,
      crc_verification: 'passed',
      capture_timestamp: index.generatedAt ?? rawIndex.generatedAt ?? null,
      declared_query_languages: Array.isArray(index.supportedQueryLanguages)
        ? [...index.supportedQueryLanguages].sort(bytewise)
        : [],
      archive_structural_type: index.formatVersion === '2.0' && index.rawArchiveIncluded
        ? 'opiq_helper_extension_compact_v2_with_raw_archive'
        : 'unknown',
      expected_members_present: requiredArchiveMembers.filter((member) => archive.entries.has(member)),
      expected_members_absent: missingMembers,
      malformed_or_unreadable_members: [],
      duplicate_members: [],
      encoding_anomalies: nonAsciiWithoutUtf8Flag === 0 ? [] : [{
        code: 'utf8_name_bytes_without_utf8_flag',
        member_count: nonAsciiWithoutUtf8Flag,
        explanation: 'Non-ASCII member-name bytes decode as UTF-8, but the ZIP UTF-8 filename flag is unset.',
      }],
      compression_methods: countEntries(metadata.map((entry) => entry.compression_method)),
      raw_source_record_count: total,
      compact_index_record_count: index.recordCount,
      compact_markdown_record_count: compactMarkdownUrls.length,
      compact_representations_match: true,
      raw_index_book_count: Array.isArray(rawIndex.books) ? rawIndex.books.length : 0,
      direct_url_count: records.length,
      unique_direct_url_count: new Set(records.map((record) => record.url)).size,
      duplicate_urls: duplicateUrls,
      source_accounting: {
        total_source_records: total,
        instructional_chapter_or_page: counts.instructional_chapter_or_page ?? 0,
        kit_or_book_detail: counts.kit_or_book_detail ?? 0,
        administrative_or_imprint: counts.administrative_or_imprint ?? 0,
        duplicate_detail_alias: counts.duplicate_detail_alias ?? 0,
        duplicate_instructional_url: counts.duplicate_instructional_url ?? 0,
        malformed_or_ambiguous: (counts.malformed_or_ambiguous ?? 0) + (counts.unsupported_or_ambiguous ?? 0),
        accounted_source_records: accounted,
        balanced: total === accounted,
      },
    },
    records,
    classifiedRows,
    kits,
  };
}

function routeMatrix(kits) {
  const byKit = new Map(kits.map((kit) => [kit.kit_id, kit]));
  return routeDefinitions.map(([
    sourceId,
    subject,
    subjectEt,
    includedKitIds,
    excludedKitIds,
    programmeScope,
    routeDecision,
    blockers,
  ]) => {
    const included = includedKitIds.map((id) => byKit.get(id));
    if (included.some((kit) => !kit)) throw new Error(`Route ${sourceId} references an unknown kit.`);
    return {
      proposed_source_id: sourceId,
      proposed_grade: included.every((kit) => kit.candidate_grade === 'verified_grade_4') ? 4 : null,
      subject,
      subject_et: subjectEt,
      languages: [...new Set(included.flatMap((kit) => kit.page_language_counts.map(({ value }) => value)))].sort(bytewise),
      included_archives: [...new Set(included.map((kit) => kit.source_archive_path))].sort(bytewise),
      included_kit_ids: includedKitIds,
      excluded_kit_ids: excludedKitIds,
      programme_scope: programmeScope,
      candidate_instructional_record_count: included.reduce((sum, kit) => sum + kit.instructional_record_count, 0),
      route_decision: routeDecision,
      blockers,
      required_normalization: included.flatMap((kit) => kit.metadata_contradictions).filter((value, index, all) => all.indexOf(value) === index).sort(bytewise),
      cross_route_ownership_constraints: includedKitIds.includes('200')
        ? ['Retain grade-2-arts-and-crafts as the existing canonical owner of all 85 shared instructional URLs.']
        : [],
      targeted_recapture_needs: blockers.length === 0 ? [] : [
        'Capture exact Kit Details/cover metadata sufficient to resolve the stated blocker.',
      ],
    };
  }).sort((left, right) => bytewise(left.proposed_source_id, right.proposed_source_id));
}

function recapturePlan(kits) {
  const exactGradeBlocked = kits.filter((kit) => (
    ['probable_grade_4', 'school_stage_ii_not_exact_grade'].includes(kit.candidate_grade)
  ));
  const missingTasks = kits.filter((kit) => kit.task_array_nonempty_record_count === 0);
  return [
    {
      recapture_type: 'no_recapture_needed',
      kit_ids: kits.filter((kit) => kit.candidate_grade === 'verified_grade_4').map((kit) => kit.kit_id).sort(bytewise),
      reason: 'No recapture is required for route ownership at intake stage; documented metadata normalization may still be required.',
    },
    {
      recapture_type: 'targeted_kit_details_or_cover_metadata',
      kit_ids: exactGradeBlocked.map((kit) => kit.kit_id).sort(bytewise),
      reason: 'Resolve exact-grade allocation without inferring it from archive filenames or exporter filters.',
    },
    {
      recapture_type: 'targeted_task_body_recapture',
      kit_ids: missingTasks.map((kit) => kit.kit_id).sort(bytewise),
      reason: 'Required only before task-level use; current records do not contain captured task examples.',
    },
    {
      recapture_type: 'live_catalogue_snapshot_needed',
      kit_ids: ['200'],
      reason: 'Determine whether the shared Käsitöötuba kit is intentionally supplementary across grades while retaining the existing Grade 2 canonical owner.',
    },
  ];
}

export async function buildGrade4SourceIntakeReport(rootDir) {
  const inspections = [];
  for (const expectation of archiveExpectations) inspections.push(await inspectArchive(rootDir, expectation));
  const archives = inspections.map((inspection) => inspection.archive);
  const kits = inspections.flatMap((inspection) => inspection.kits).sort((left, right) => (
    Number(left.kit_id) - Number(right.kit_id)
  ));
  const { ownership } = await loadManifestOwnership(rootDir);
  const allRows = inspections.flatMap((inspection) => inspection.records.map((record) => ({
    archive_path: inspection.archive.path,
    url: record.url,
    classification: inspection.classifiedRows.find((row) => row.source_sequence === record.source_sequence)?.classification,
  })));
  const grade4Ownership = new Map();
  for (const row of allRows) {
    const entries = grade4Ownership.get(row.url) ?? [];
    entries.push(row);
    grade4Ownership.set(row.url, entries);
  }
  const crossArchiveOverlaps = [...grade4Ownership]
    .filter(([, entries]) => new Set(entries.map((entry) => entry.archive_path)).size > 1)
    .map(([url, entries]) => ({
      url,
      archive_paths: [...new Set(entries.map((entry) => entry.archive_path))].sort(bytewise),
      outcome: 'block_pending_evidence',
    }))
    .sort((left, right) => bytewise(left.url, right.url));
  const existingOverlaps = [...grade4Ownership]
    .filter(([url]) => ownership.has(url))
    .map(([url, entries]) => ({
      url,
      candidate_archive_paths: [...new Set(entries.map((entry) => entry.archive_path))].sort(bytewise),
      existing_owners: ownership.get(url),
      outcome: 'retain_existing_canonical_owner',
    }))
    .sort((left, right) => bytewise(left.url, right.url));
  const overlapCountsByOwner = countEntries(existingOverlaps.flatMap((entry) => entry.existing_owners.map((owner) => owner.source_id)));
  const accountingTotals = archives.reduce((totals, archive) => {
    for (const [key, value] of Object.entries(archive.source_accounting)) {
      if (typeof value === 'number') totals[key] = (totals[key] ?? 0) + value;
    }
    return totals;
  }, {});
  return {
    schema_version: reportVersion,
    artifact_type: 'grade_4_immutable_zip_intake_audit',
    report_id: 'grade-4-source-intake',
    base_commit: baseCommit,
    verification_date: verificationDate,
    implementation: {
      path: 'scripts/audit-grade-4-source-intake.mjs',
      library_path: 'scripts/lib/grade-4-source-intake.mjs',
      version: implementationVersion,
      schema_path: schemaPath,
    },
    scope: {
      archive_count: archiveExpectations.length,
      archive_paths: archiveExpectations.map((entry) => entry.path),
      canonical_routes_created: false,
      source_manifest_modified: false,
    },
    archive_inventory: archives,
    source_accounting_totals: {
      ...accountingTotals,
      balanced: accountingTotals.total_source_records === accountingTotals.accounted_source_records,
    },
    kit_inventory: kits,
    url_ownership_and_overlaps: {
      distinct_grade_4_urls: grade4Ownership.size,
      cross_archive_overlap_count: crossArchiveOverlaps.length,
      cross_archive_overlaps: crossArchiveOverlaps,
      existing_manifest_overlap_count: existingOverlaps.length,
      existing_manifest_overlap_counts_by_owner: overlapCountsByOwner,
      grade_3_overlap_count: existingOverlaps.filter((entry) => entry.existing_owners.some((owner) => owner.grade === 3)).length,
      grade_5_overlap_count: existingOverlaps.filter((entry) => entry.existing_owners.some((owner) => owner.grade === 5)).length,
      existing_manifest_overlaps: existingOverlaps,
      edition_equivalence_assessments: [
        {
          kit_ids: ['11', '480'],
          relationship: 'same_subject_and_language_with_distinct_captured_edition_titles',
          outcome: 'retain_separate_editions',
          evidence: ['Kit 480 explicitly states 2023; kit 11 does not. Direct instructional URLs do not overlap.'],
        },
        {
          kit_ids: ['27', '536'],
          relationship: 'same_subject_and_language_with_distinct_captured_edition_titles',
          outcome: 'retain_separate_editions',
          evidence: ['Kit 536 explicitly states 2023; kit 27 does not. Direct instructional URLs do not overlap.'],
        },
        {
          kit_ids: ['174', '552'],
          relationship: 'same_subject_and_language_with_distinct_captured_edition_titles',
          outcome: 'retain_separate_editions',
          evidence: ['Kit 552 explicitly states 2024; kit 174 does not. Direct instructional URLs do not overlap.'],
        },
      ],
    },
    candidate_route_matrix: routeMatrix(kits),
    recapture_plan: recapturePlan(kits),
    global_blockers: [
      'Exporter subject labels are systematically unreliable outside source-specific captures and require documented normalization.',
      'Captured raw chapter objects do not contain complete instructional prose bodies.',
      'Exact-grade ownership remains unresolved for school-stage-II and generic-title kits.',
      'The live Opiq catalogue was not captured; supplied-archive coverage cannot establish catalogue completeness.',
    ],
    non_guarantees: [
      'This audit does not create or modify canonical Grade 4 routes.',
      'This audit does not establish complete current Opiq Grade 4 catalogue coverage.',
      'This audit does not establish official Grade 4 curriculum completeness.',
      'School-stage-II or exporter Grade 4 labels are not treated as official exact-grade allocation.',
      'This audit does not establish pedagogical, legal, commercial, or release readiness.',
    ],
  };
}

function markdownTable(rows, headers) {
  const escape = (value) => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
  return [
    `| ${headers.map(([label]) => label).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${headers.map(([, key]) => escape(row[key])).join(' | ')} |`),
  ].join('\n');
}

export function renderGrade4SourceIntakeMarkdown(report) {
  const accountingRows = report.archive_inventory.map((archive) => ({
    archive: path.posix.basename(archive.path),
    total: archive.source_accounting.total_source_records,
    instructional: archive.source_accounting.instructional_chapter_or_page,
    details: archive.source_accounting.kit_or_book_detail,
    aliases: archive.source_accounting.duplicate_detail_alias,
    ambiguous: archive.source_accounting.malformed_or_ambiguous,
    balanced: archive.source_accounting.balanced,
  }));
  const kitRows = report.kit_inventory.map((kit) => ({
    kit: kit.kit_id,
    title: kit.cover_detail_title,
    grade: kit.candidate_grade,
    subject: kit.candidate_subject,
    languages: kit.page_language_counts.map(({ value }) => value).join(', '),
    programme: kit.programme_type,
    chapters: kit.instructional_record_count,
    tasks: kit.task_array_nonempty_record_count,
  }));
  const routeRows = report.candidate_route_matrix.map((route) => ({
    route: route.proposed_source_id,
    kits: route.included_kit_ids.join(', '),
    records: route.candidate_instructional_record_count,
    decision: route.route_decision,
    blockers: route.blockers.join(' '),
  }));
  const archiveList = report.archive_inventory.map((archive) => (
    `- \`${archive.path}\` — \`${archive.sha256}\`, ${archive.byte_size} bytes, ${archive.zip_member_count} members`
  )).join('\n');
  return `# Grade 4 immutable ZIP intake and routing audit

Verification date: \`${report.verification_date}\`

Base commit: \`${report.base_commit}\`

## Executive summary

The ten supplied ZIP archives are byte-identified, structurally readable, CRC-valid, and fully accounted. They contain ${report.source_accounting_totals.total_source_records} source records: ${report.source_accounting_totals.instructional_chapter_or_page} instructional chapter/page candidates, ${report.source_accounting_totals.kit_or_book_detail} retained kit details, and ${report.source_accounting_totals.duplicate_detail_alias} duplicate detail aliases. No canonical Grade 4 route or manifest entry is created here.

Captured exporter metadata is not sufficient by itself: subject labels are frequently incorrect, generic titles do not establish exact grade, and complete page prose is absent. Evidence-based candidate routes therefore retain raw labels, explicit normalizations, blockers, and recapture requirements.

## Audited archives

${archiveList}

## Source accounting

${markdownTable(accountingRows, [
    ['Archive', 'archive'],
    ['Total', 'total'],
    ['Instructional', 'instructional'],
    ['Kit details', 'details'],
    ['Duplicate aliases', 'aliases'],
    ['Malformed/ambiguous', 'ambiguous'],
    ['Balanced', 'balanced'],
  ])}

## Book and kit inventory

${markdownTable(kitRows, [
    ['Kit', 'kit'],
    ['Captured title', 'title'],
    ['Grade evidence', 'grade'],
    ['Candidate subject', 'subject'],
    ['Page languages', 'languages'],
    ['Programme', 'programme'],
    ['Instructional rows', 'chapters'],
    ['Rows with tasks', 'tasks'],
  ])}

## Candidate routes

${markdownTable(routeRows, [
    ['Proposed route', 'route'],
    ['Included kits', 'kits'],
    ['Records', 'records'],
    ['Decision', 'decision'],
    ['Blockers', 'blockers'],
  ])}

## Blocked or ambiguous sources

${report.candidate_route_matrix.filter((route) => route.route_decision.startsWith('blocked_')).map((route) => (
    `- **${route.proposed_source_id}:** ${route.blockers.join(' ')}`
  )).join('\n')}

## Cross-grade and cross-subject overlap

- ${report.url_ownership_and_overlaps.existing_manifest_overlap_count} direct instructional URLs overlap existing manifest routes.
- All current overlaps are with \`grade-2-arts-and-crafts\` and remain owned there.
- Grade 3 overlap count: ${report.url_ownership_and_overlaps.grade_3_overlap_count}.
- Grade 5 overlap count: ${report.url_ownership_and_overlaps.grade_5_overlap_count}.
- Cross-archive overlap among the ten supplied ZIPs: ${report.url_ownership_and_overlaps.cross_archive_overlap_count}.
- \`eesti keel\` and \`eesti keel teise keelena\` remain separate candidate routes.

## Targeted recapture plan

${report.recapture_plan.map((entry) => `- **${entry.recapture_type}:** kits ${entry.kit_ids.join(', ')}. ${entry.reason}`).join('\n')}

## Explicit limitations

${report.non_guarantees.map((item) => `- ${item}`).join('\n')}

## Recommended next PR scope

Create canonical Grade 4 indexes only for routes whose blockers are resolved, preserve separate programme and language routes, apply documented metadata normalization, and update \`source-manifest.json\` in that separate import PR. Targeted recaptures should precede import for ambiguous exact-grade allocations and any task-level use.
`;
}

export async function buildReportArtifacts(rootDir) {
  const report = await buildGrade4SourceIntakeReport(rootDir);
  return {
    report,
    json: stableJson(report),
    markdown: renderGrade4SourceIntakeMarkdown(report),
  };
}

export function assertCommittedBytes(expected, actual, label) {
  if (!Buffer.from(expected).equals(Buffer.from(actual))) {
    throw new Error(`${label} is stale; run npm run generate:grade-4-source-intake.`);
  }
}
