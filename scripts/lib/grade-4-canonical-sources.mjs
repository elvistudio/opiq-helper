import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { readCompactZip, readZipText } from './compact-zip.mjs';
import {
  archiveExpectations,
  classifyRows,
  sha256,
  stableJson,
} from './grade-4-source-intake.mjs';
import {
  containsUnprocessedPayload,
  normalizeQualityText,
} from './grade-2-content-quality.mjs';

export const generatorVersion = '1.0';
export const qaSchemaVersion = '1.0';
export const evidenceSchemaVersion = '1.0';
export const contentQualitySchemaVersion = '1.0';
export const verificationDate = '2026-07-27';
export const importBaseCommit = '29b8955a7f01b0d7fac0a6ff08c1d320f036fb1f';
export const issueEvidenceCommentUrl = 'https://github.com/elvistudio/opiq-helper/issues/41#issuecomment-5093283851';
export const sourceGeneratorPath = 'scripts/generate-grade-4-sources.mjs';
export const sourceImportAuditPath = 'docs/audits/grade-4-canonical-source-import.md';
export const evidencePath = 'evaluations/grade-4-kit-details-evidence.json';
export const evidenceAuditPath = 'docs/audits/grade-4-kit-details-evidence.md';
export const evidenceSchemaPath = 'schemas/grade-4-kit-details-evidence.schema.json';
export const qaSchemaPath = 'schemas/grade-4-source-qa.schema.json';
export const contentQualityReportPath = 'evaluations/grade-4-content-quality-report.json';
export const contentQualityAuditPath = 'docs/audits/grade-4-content-quality.md';
export const contentQualitySchemaPath = 'schemas/grade-4-content-quality-report.schema.json';

const archivesByName = Object.freeze(Object.fromEntries(
  archiveExpectations.map((archive) => [path.posix.basename(archive.path), archive]),
));

const archivePaths = Object.freeze({
  russian: archivesByName['opiq_4klass_4_opiq_v2.zip'].path,
  estonian: archivesByName['opiq_4klass_eesti_keel_4_klassile_opiq_v2.zip'].path,
  english: archivesByName['opiq_4klass_english_step_by_step_2_opiq_v2.zip'].path,
  human: archivesByName['opiq_4klass_inimene_ja_uhiskond_opik_ii_kooliastmele_i_osa_o_v2.zip'].path,
  arts: archivesByName['opiq_4klass_kasitootuba_opiq_v2.zip'].path,
  physicalEducation: archivesByName['opiq_4klass_kehalise_kasvatuse_tooraamat_teisele_kooliastmel_v2.zip'].path,
  science: archivesByName['opiq_4klass_loodusopetus_4_klassile_opiq_v2.zip'].path,
  mathematics: archivesByName['opiq_4klass_matemaatika_4_klassile_opiq_v2.zip'].path,
  music: archivesByName['opiq_4klass_muusika_v2.zip'].path,
  technology: archivesByName['opiq_4klass_tehnologia_v2.zip'].path,
});

function route({
  id,
  title,
  subjectCode,
  subject,
  kits,
  archive,
  output,
  expectedRecords,
  programmeType = 'unknown',
  notes = [],
  editionDistinctions = [],
}) {
  return Object.freeze({
    id,
    title,
    grade: 4,
    grade_group: '1-4',
    subject,
    subject_code: subjectCode,
    subject_et: subject.et,
    included_kit_ids: Object.freeze(kits),
    source_archive: archive,
    output_path: `project-files/outputs/${output}.md`,
    qa_path: `project-files/outputs/${output}_qa.json`,
    expected_record_count: expectedRecords,
    programme_type: programmeType,
    notes: Object.freeze(notes),
    edition_distinctions: Object.freeze(editionDistinctions),
  });
}

export const grade4RoutePolicy = Object.freeze([
  route({
    id: 'grade-4-russian',
    title: '4. klass vene keel',
    subjectCode: 'russian',
    subject: { en: 'Russian language', et: 'vene keel', ru: 'русский язык' },
    kits: ['243', '295'],
    archive: archivePaths.russian,
    output: 'opiq_4klass_vene_keel',
    expectedRecords: 167,
  }),
  route({
    id: 'grade-4-russian-reading',
    title: '4. klass vene keele lugemine',
    subjectCode: 'russian_reading',
    subject: { en: 'Russian reading', et: 'vene keele lugemine', ru: 'русское чтение' },
    kits: ['415'],
    archive: archivePaths.russian,
    output: 'opiq_4klass_vene_lugemine',
    expectedRecords: 34,
  }),
  route({
    id: 'grade-4-estonian',
    title: '4. klass eesti keel',
    subjectCode: 'estonian',
    subject: { en: 'Estonian language', et: 'eesti keel', ru: 'эстонский язык' },
    kits: ['71', '154', '533'],
    archive: archivePaths.estonian,
    output: 'opiq_4klass_eesti_keel',
    expectedRecords: 398,
    notes: ['Kit 154 exact-grade ownership is supported by the separate post-audit Kit Details evidence.'],
  }),
  route({
    id: 'grade-4-estonian-second-language',
    title: '4. klass eesti keel teise keelena',
    subjectCode: 'estonian_second_language',
    subject: {
      en: 'Estonian as a second language',
      et: 'eesti keel teise keelena',
      ru: 'эстонский язык как второй',
    },
    kits: ['150'],
    archive: archivePaths.estonian,
    output: 'opiq_4klass_eesti_keel_teise_keelena',
    expectedRecords: 117,
  }),
  route({
    id: 'grade-4-english',
    title: '4. klass inglise keel',
    subjectCode: 'english',
    subject: { en: 'English', et: 'inglise keel', ru: 'английский язык' },
    kits: ['332', '451'],
    archive: archivePaths.english,
    output: 'opiq_4klass_inglise_keel',
    expectedRecords: 163,
    notes: ['Kit 332 exact-grade ownership is supported by the separate post-audit Kit Details evidence.'],
  }),
  route({
    id: 'grade-4-human-studies-and-society',
    title: '4. klass inimese- ja ühiskonnaõpetus',
    subjectCode: 'human_studies_and_society',
    subject: {
      en: 'human studies and society',
      et: 'inimese- ja ühiskonnaõpetus',
      ru: 'человек и общество',
    },
    kits: ['55', '82'],
    archive: archivePaths.human,
    output: 'opiq_4klass_inimene_ja_uhiskond',
    expectedRecords: 63,
    programmeType: 'mixed_subject',
    notes: ['This mixed human/society route is not normalized to subject-pure human studies.'],
  }),
  route({
    id: 'grade-4-human-studies-simplified',
    title: '4. klass inimeseõpetus — lihtsustatud õppekava',
    subjectCode: 'human_studies',
    subject: { en: 'human studies', et: 'inimeseõpetus', ru: 'человековедение' },
    kits: ['287'],
    archive: archivePaths.human,
    output: 'opiq_4klass_inimeseopetus_lihtsustatud',
    expectedRecords: 55,
    programmeType: 'simplified_curriculum',
  }),
  route({
    id: 'grade-4-science',
    title: '4. klass loodusõpetus',
    subjectCode: 'science',
    subject: { en: 'science', et: 'loodusõpetus', ru: 'природоведение' },
    kits: ['11', '27', '108', '228', '480', '536'],
    archive: archivePaths.science,
    output: 'opiq_4klass_loodusopetus',
    expectedRecords: 338,
    editionDistinctions: [
      ['11', '480', 'Separate Estonian editions; kit 480 explicitly identifies 2023.'],
      ['27', '536', 'Separate Russian editions; kit 536 explicitly identifies 2023.'],
    ],
  }),
  route({
    id: 'grade-4-mathematics',
    title: '4. klass matemaatika',
    subjectCode: 'mathematics',
    subject: { en: 'mathematics', et: 'matemaatika', ru: 'математика' },
    kits: ['70', '147', '157', '293', '460', '588'],
    archive: archivePaths.mathematics,
    output: 'opiq_4klass_matemaatika',
    expectedRecords: 567,
  }),
  route({
    id: 'grade-4-mathematics-simplified',
    title: '4. klass matemaatika — lihtsustatud õppekava',
    subjectCode: 'mathematics',
    subject: { en: 'mathematics', et: 'matemaatika', ru: 'математика' },
    kits: ['282', '304', '318', '328'],
    archive: archivePaths.mathematics,
    output: 'opiq_4klass_matemaatika_lihtsustatud',
    expectedRecords: 138,
    programmeType: 'simplified_curriculum',
  }),
  route({
    id: 'grade-4-music',
    title: '4. klass muusika',
    subjectCode: 'music',
    subject: { en: 'music', et: 'muusika', ru: 'музыка' },
    kits: ['174', '206', '552'],
    archive: archivePaths.music,
    output: 'opiq_4klass_muusika',
    expectedRecords: 172,
    notes: ['Kit 206 exact-grade ownership is supported by the separate post-audit Kit Details evidence.'],
    editionDistinctions: [
      ['174', '552', 'Separate editions; kit 552 explicitly identifies 2024.'],
    ],
  }),
]);

export const multiGradeSupportPolicy = Object.freeze([
  Object.freeze({
    kit_id: '161',
    source_archive: archivePaths.physicalEducation,
    grade_scope: Object.freeze([4, 5, 6]),
    subject: 'physical_education',
    programme_or_support_role: 'school_stage_ii_physical_education_support',
    grade_4_eligible: true,
    exclusive_grade_4_owner: false,
    canonical_owner: null,
    instructional_record_count: 22,
    disposition: 'catalogue_evidence_only',
  }),
  Object.freeze({
    kit_id: '200',
    source_archive: archivePaths.arts,
    grade_scope: Object.freeze([1, 2, 3, 4]),
    subject: 'arts_and_crafts',
    programme_or_support_role: 'shared_supplementary_arts_and_crafts',
    grade_4_eligible: true,
    exclusive_grade_4_owner: false,
    canonical_owner: 'grade-2-arts-and-crafts',
    instructional_record_count: 85,
    disposition: 'retain_existing_canonical_owner',
  }),
  Object.freeze({
    kit_id: '476',
    source_archive: archivePaths.technology,
    grade_scope: Object.freeze([4, 5, 6, 7, 8, 9]),
    subject: 'technology',
    programme_or_support_role: 'multi_grade_technology_instructional_support',
    grade_4_eligible: true,
    exclusive_grade_4_owner: false,
    canonical_owner: null,
    instructional_record_count: 23,
    disposition: 'catalogue_evidence_only',
  }),
]);

const manualEvidenceRows = Object.freeze([
  ['55', [4], true, 'unknown'],
  ['82', [4], true, 'unknown'],
  ['154', [4], true, 'unknown'],
  ['161', [4, 5, 6], false, 'school_stage_ii_physical_education_support'],
  ['200', [1, 2, 3, 4], false, 'shared_supplementary_arts_and_crafts'],
  ['206', [4], true, 'unknown'],
  ['332', [4], true, 'unknown'],
  ['476', [4, 5, 6, 7, 8, 9], false, 'multi_grade_technology_instructional_support'],
]);

export function bytewise(left, right) {
  return String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0;
}

export function countBy(values) {
  const counts = new Map();
  for (const value of values) counts.set(String(value), (counts.get(String(value)) ?? 0) + 1);
  return Object.fromEntries([...counts].sort(([left], [right]) => bytewise(left, right)));
}

export function kitId(value) {
  const url = typeof value === 'string' ? value : value?.url;
  return String(url ?? '').match(/\/kit\/(\d+)\//iu)?.[1]
    ?? String(url ?? '').match(/\/Kit\/Details\/(\d+)$/u)?.[1]
    ?? '';
}

export function canonicalSubject(routeDefinition) {
  const { en, et, ru } = routeDefinition.subject;
  return `${en} / ${et} / ${ru}`;
}

function normalizeList(values) {
  return (Array.isArray(values) ? values : []).map(normalizeQualityText).filter(Boolean);
}

function normalizeTopics(values, field, routeDefinition, rawSubject) {
  const fieldLanguage = { topics_en: 'en', topics_et: 'et', topics_ru: 'ru' }[field];
  const canonical = routeDefinition.subject[fieldLanguage];
  const rawAlias = rawSubject[fieldLanguage];
  const retained = normalizeList(values).filter((value) => (
    value.toLocaleLowerCase() !== rawAlias.toLocaleLowerCase()
    || rawAlias.toLocaleLowerCase() === canonical.toLocaleLowerCase()
  ));
  return [
    canonical,
    ...retained.filter((value) => value.toLocaleLowerCase() !== canonical.toLocaleLowerCase()),
  ];
}

function stripOpiqSuffix(value) {
  return normalizeQualityText(value).replace(/\s+[–-]\s+Opiq$/u, '').trim();
}

function canonicalBookId(record, recordKitId) {
  return `${normalizeQualityText(record.book_id)}__kit${recordKitId}`;
}

function sortCanonicalRecords(records, routeDefinition) {
  const kitOrder = new Map(routeDefinition.included_kit_ids.map((id, index) => [id, index]));
  return records.sort((left, right) => (
    (kitOrder.get(left.kit_id) - kitOrder.get(right.kit_id))
    || left.source_sequence - right.source_sequence
    || bytewise(left.url, right.url)
  ));
}

function normalizeCanonicalRecord(record, routeDefinition, detailTitleByKit) {
  const recordKitId = kitId(record);
  const rawSubject = {
    en: normalizeQualityText(record.subject_en),
    et: normalizeQualityText(record.subject_et),
    ru: normalizeQualityText(record.subject_ru),
  };
  const canonical = {
    title: normalizeQualityText(record.title),
    url: record.url,
    book: stripOpiqSuffix(detailTitleByKit.get(recordKitId) ?? record.book),
    book_id: canonicalBookId(record, recordKitId),
    source_book_id: normalizeQualityText(record.book_id),
    kit_id: recordKitId,
    chapter_id: String(record.chapter_id),
    grade: 4,
    subject_en: routeDefinition.subject.en,
    subject_et: routeDefinition.subject.et,
    subject_ru: routeDefinition.subject.ru,
    language: normalizeQualityText(record.language).toLowerCase(),
    publisher: normalizeQualityText(record.publisher),
    programme_type: routeDefinition.programme_type,
    topics_et: normalizeTopics(record.topics_et, 'topics_et', routeDefinition, rawSubject),
    topics_ru: normalizeTopics(record.topics_ru, 'topics_ru', routeDefinition, rawSubject),
    topics_en: normalizeTopics(record.topics_en, 'topics_en', routeDefinition, rawSubject),
    headings: normalizeList(record.headings),
    task_examples: normalizeList(record.task_examples),
    source_sequence: record.source_sequence,
  };
  if (!/^https:\/\/www\.opiq\.ee\/kit\/\d+\/chapter\/\d+$/u.test(canonical.url)) {
    throw new Error(`${routeDefinition.id}: noncanonical instructional URL ${canonical.url}.`);
  }
  if (!canonical.title || !canonical.book || !canonical.source_book_id) {
    throw new Error(`${routeDefinition.id}: empty canonical identity for ${canonical.url}.`);
  }
  return canonical;
}

function accountingFor(rows) {
  const counts = countBy(rows.map((row) => row.classification));
  const accounting = {
    total_source_records: rows.length,
    instructional_chapter_or_page: counts.instructional_chapter_or_page ?? 0,
    kit_or_book_detail: counts.kit_or_book_detail ?? 0,
    administrative_or_imprint: counts.administrative_or_imprint ?? 0,
    duplicate_detail_alias: counts.duplicate_detail_alias ?? 0,
    duplicate_instructional_url: counts.duplicate_instructional_url ?? 0,
    malformed_or_ambiguous: (counts.malformed_or_ambiguous ?? 0) + (counts.unsupported_or_ambiguous ?? 0),
  };
  accounting.accounted_source_records = [
    'instructional_chapter_or_page',
    'kit_or_book_detail',
    'administrative_or_imprint',
    'duplicate_detail_alias',
    'duplicate_instructional_url',
    'malformed_or_ambiguous',
  ].reduce((sum, field) => sum + accounting[field], 0);
  accounting.balanced = accounting.accounted_source_records === accounting.total_source_records;
  return accounting;
}

async function loadArchive(rootDir, expectation) {
  const absolutePath = path.join(rootDir, expectation.path);
  const bytes = await readFile(absolutePath);
  if (bytes.length !== expectation.byte_size || sha256(bytes) !== expectation.sha256) {
    throw new Error(`${expectation.path}: immutable archive identity changed.`);
  }
  const archive = await readCompactZip(absolutePath);
  const index = JSON.parse(readZipText(archive, 'index.json'));
  const records = readZipText(archive, 'opiq_lookup.jsonl')
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line, indexNumber) => ({ ...JSON.parse(line), source_sequence: indexNumber + 1 }));
  const classified = classifyRows(records, []);
  const classificationBySequence = new Map(classified.map((row) => [row.source_sequence, row.classification]));
  const enriched = records.map((record) => ({
    ...record,
    source_archive: expectation.path,
    kit_id: kitId(record),
    classification: classificationBySequence.get(record.source_sequence),
  }));
  return {
    path: expectation.path,
    sha256: expectation.sha256,
    byte_size: expectation.byte_size,
    capture_timestamp: index.generatedAt,
    declared_query_languages: index.supportedQueryLanguages,
    records: enriched,
    accounting: accountingFor(enriched),
  };
}

export async function loadGrade4CanonicalSourceModel(rootDir) {
  const archives = await Promise.all(archiveExpectations.map((entry) => loadArchive(rootDir, entry)));
  const archiveByPath = new Map(archives.map((archive) => [archive.path, archive]));
  const allRows = archives.flatMap((archive) => archive.records);
  const globalAccounting = accountingFor(allRows);
  const expectedAccounting = {
    total_source_records: 2425,
    instructional_chapter_or_page: 2342,
    kit_or_book_detail: 34,
    administrative_or_imprint: 17,
    duplicate_detail_alias: 32,
    duplicate_instructional_url: 0,
    malformed_or_ambiguous: 0,
    accounted_source_records: 2425,
    balanced: true,
  };
  if (JSON.stringify(globalAccounting) !== JSON.stringify(expectedAccounting)) {
    throw new Error(`Grade 4 source accounting changed: ${JSON.stringify(globalAccounting)}.`);
  }

  const routes = grade4RoutePolicy.map((routeDefinition) => {
    const archive = archiveByPath.get(routeDefinition.source_archive);
    if (!archive) throw new Error(`${routeDefinition.id}: source archive is not registered.`);
    const includedKits = new Set(routeDefinition.included_kit_ids);
    const routeRows = archive.records.filter((record) => includedKits.has(record.kit_id));
    const detailTitleByKit = new Map(routeRows
      .filter((record) => record.classification === 'kit_or_book_detail')
      .map((record) => [record.kit_id, record.title]));
    const canonicalRecords = sortCanonicalRecords(
      routeRows
        .filter((record) => record.classification === 'instructional_chapter_or_page')
        .map((record) => normalizeCanonicalRecord(record, routeDefinition, detailTitleByKit)),
      routeDefinition,
    );
    if (canonicalRecords.length !== routeDefinition.expected_record_count) {
      throw new Error(
        `${routeDefinition.id}: computed ${canonicalRecords.length} canonical records; expected ${routeDefinition.expected_record_count}.`,
      );
    }
    if (new Set(canonicalRecords.map((record) => record.url)).size !== canonicalRecords.length) {
      throw new Error(`${routeDefinition.id}: duplicate canonical URL.`);
    }
    const routeAccounting = accountingFor(routeRows);
    if (!routeAccounting.balanced || routeAccounting.malformed_or_ambiguous !== 0) {
      throw new Error(`${routeDefinition.id}: route accounting is incomplete.`);
    }
    return {
      definition: routeDefinition,
      archive,
      source_rows: routeRows,
      accounting: routeAccounting,
      canonical_records: canonicalRecords,
    };
  });

  const canonicalOwners = new Map();
  for (const routeModel of routes) {
    for (const record of routeModel.canonical_records) {
      if (canonicalOwners.has(record.url)) {
        throw new Error(`${record.url} belongs to both ${canonicalOwners.get(record.url)} and ${routeModel.definition.id}.`);
      }
      canonicalOwners.set(record.url, routeModel.definition.id);
    }
  }
  if (canonicalOwners.size !== 2212) {
    throw new Error(`Grade 4 canonical route union contains ${canonicalOwners.size} URLs; expected 2212.`);
  }
  let supportInstructionalCount = 0;
  for (const support of multiGradeSupportPolicy) {
    const archive = archiveByPath.get(support.source_archive);
    if (!archive) throw new Error(`Kit ${support.kit_id}: support source archive is not registered.`);
    const supportRecords = archive.records.filter((record) => (
      record.kit_id === support.kit_id
      && record.classification === 'instructional_chapter_or_page'
    ));
    if (supportRecords.length !== support.instructional_record_count) {
      throw new Error(
        `Kit ${support.kit_id}: computed ${supportRecords.length} support records; expected ${support.instructional_record_count}.`,
      );
    }
    if (supportRecords.some((record) => canonicalOwners.has(record.url))) {
      throw new Error(`Kit ${support.kit_id}: multi-grade/shared support URL entered an exclusive Grade 4 route.`);
    }
    supportInstructionalCount += supportRecords.length;
  }
  if (canonicalOwners.size + supportInstructionalCount !== globalAccounting.instructional_chapter_or_page) {
    throw new Error(
      `Grade 4 instructional accounting does not reconcile: ${canonicalOwners.size} canonical + `
      + `${supportInstructionalCount} support != ${globalAccounting.instructional_chapter_or_page}.`,
    );
  }

  return {
    archives,
    all_rows: allRows,
    global_accounting: globalAccounting,
    routes,
    canonical_owners: canonicalOwners,
  };
}

export function buildKitDetailsEvidence() {
  return {
    schema_version: evidenceSchemaVersion,
    artifact_type: 'grade-4-kit-details-evidence',
    evidence_id: 'grade-4-post-intake-kit-details-2026-07-27',
    issue_ref: '#41',
    issue_comment_url: issueEvidenceCommentUrl,
    historical_intake_report: 'evaluations/grade-4-source-intake.json',
    records: manualEvidenceRows.map(([id, gradeScope, exactGrade4Confirmed, role]) => ({
      kit_id: id,
      kit_details_url: `https://www.opiq.ee/Kit/Details/${id}`,
      verified_on: verificationDate,
      verification_method: 'manual_kit_details_review',
      verified_by: 'astzhalkouski',
      grade_scope: gradeScope,
      exact_grade_4_confirmed: exactGrade4Confirmed,
      subject: id === '476' ? 'Tehnoloogiaõpetus' : null,
      language: id === '476' ? 'et' : null,
      programme_or_support_role: role,
      publisher: id === '476' ? 'Merkuur' : null,
      curriculum: id === '476' ? 'Riiklik õppekava 2011' : null,
      access_mode: id === '476' ? 'free' : null,
      evidence_source: {
        kind: 'direct_opiq_kit_details_manual_review',
        kit_details_url: `https://www.opiq.ee/Kit/Details/${id}`,
        project_provenance_url: issueEvidenceCommentUrl,
      },
      evidence_limitations: [
        'The verification was performed after the immutable ZIP intake and is not evidence contained in those ZIP captures.',
        'No screenshot or structured Kit Details export is committed in this repository.',
        'Only explicitly supplied values are preserved; other metadata remains null or unknown.',
      ],
      verified_metadata: id === '476' ? {
        title: 'Arvjuhitavad seadmed (CNC)',
        chapters: 23,
        total_tasks: 1,
        textbook_tasks: 1,
        task_collection_tasks: 0,
        authors: ['Snapmaker Technology Co., Ltd'],
        task_collection_author: 'Lauri Soosaar',
      } : null,
    })),
    non_guarantees: [
      'This evidence does not prove current live-catalogue completeness.',
      'This evidence does not prove official curriculum alignment beyond the captured label.',
      'This evidence does not establish pedagogical effectiveness or commercial readiness.',
    ],
  };
}

function markdownValue(values) {
  return values.length > 0 ? values.join('; ') : '';
}

export function renderGrade4CanonicalMarkdown(routeModel) {
  const { definition, archive, canonical_records: records } = routeModel;
  const languages = Object.keys(countBy(records.map((record) => record.language)));
  const books = [...new Map(records.map((record) => [record.book_id, record])).values()];
  const bookCounts = countBy(records.map((record) => record.book_id));
  const lines = [
    `# Opiq lookup: ${definition.title}`,
    '',
    `Use this file only for ${definition.title}. Do not substitute adjacent grades or different subject/programme routes.`,
    '',
    '## Source Summary',
    `- Original source archive: \`${definition.source_archive}\``,
    `- Archive SHA-256: \`${archive.sha256}\``,
    `- Capture timestamp: ${archive.capture_timestamp}`,
    '- Class: 4',
    `- Subject: ${canonicalSubject(definition)}`,
    `- Languages: ${languages.join(', ')} (page-level values preserved)`,
    `- Canonical pages: ${records.length}`,
    `- Included kits: ${definition.included_kit_ids.join(', ')}`,
    `- Programme type: ${definition.programme_type}`,
    '- Curriculum coverage: not verified',
    '- Complete live Opiq catalogue coverage: not verified',
    '',
    '## Books',
    ...books.map((record) => (
      `- \`${record.book_id}\` — ${record.book}; Source Book ID \`${record.source_book_id}\`; kit ${record.kit_id}; ${bookCounts[record.book_id]} pages.`
    )),
    '',
    '## Pages',
    '',
  ];
  records.forEach((record, index) => {
    lines.push(
      `### ${index + 1}. ${record.title}`,
      `- URL: ${record.url}`,
      `- Book: ${record.book}`,
      `- Book ID: ${record.book_id}`,
      `- Source Book ID: ${record.source_book_id}`,
      `- Kit ID: ${record.kit_id}`,
      `- Chapter ID: ${record.chapter_id}`,
      '- Class: 4',
      `- Language: ${record.language}`,
      `- Publisher: ${record.publisher}`,
      `- Subject: ${canonicalSubject(definition)}`,
      `- Programme type: ${record.programme_type}`,
      `- Topics ET: ${markdownValue(record.topics_et)}`,
      `- Topics RU: ${markdownValue(record.topics_ru)}`,
      `- Topics EN: ${markdownValue(record.topics_en)}`,
      `- Headings: ${markdownValue(record.headings)}`,
      `- Task examples: ${markdownValue(record.task_examples)}`,
      '',
    );
  });
  return `${lines.map((line) => line.trimEnd()).join('\n').trimEnd()}\n`;
}

function routeEvidenceRefs(routeDefinition) {
  return routeDefinition.included_kit_ids.map((id) => (
    manualEvidenceRows.some(([manualId]) => manualId === id)
      ? `${evidencePath}#kit:${id}`
      : `evaluations/grade-4-source-intake.json#kit:${id}`
  ));
}

function rawSubjectLabel(record) {
  return `${record.subject_en ?? ''} / ${record.subject_et ?? ''} / ${record.subject_ru ?? ''}`;
}

export function buildGrade4RouteQa(routeModel, markdown) {
  const { definition, archive, source_rows: sourceRows, accounting, canonical_records: records } = routeModel;
  const allArchiveKits = [...new Set(archive.records.map((record) => record.kit_id).filter(Boolean))].sort(bytewise);
  const recordsWithTasks = records.filter((record) => record.task_examples.length > 0).length;
  const rawSubjects = countBy(sourceRows.map(rawSubjectLabel));
  const canonicalSubjectValue = canonicalSubject(definition);
  const mathAliasesRemoved = definition.subject.en.toLowerCase() !== 'mathematics'
    ? sourceRows.filter((record) => rawSubjectLabel(record) === 'mathematics / matemaatika / математика').length
    : 0;
  const metadataContradictions = [];
  if (mathAliasesRemoved > 0) {
    metadataContradictions.push(
      `${mathAliasesRemoved} route-scoped source rows carry the exporter-generated mathematics subject and are normalized from kit/book evidence.`,
    );
  }
  const outputHash = createHash('sha256').update(markdown).digest('hex');
  return {
    qa_schema_version: qaSchemaVersion,
    artifact_type: 'grade-4-canonical-source-qa',
    source_id: definition.id,
    source_archive: definition.source_archive,
    output_file: definition.output_path,
    format_version: '2.0',
    generation: {
      status: 'generated',
      generated_at: archive.capture_timestamp,
      generator: sourceGeneratorPath,
      generator_version: generatorVersion,
      note: 'Generated deterministically from immutable ZIP rows classified as instructional; post-audit Kit Details evidence is referenced separately.',
    },
    checksums: {
      source_archive_sha256: archive.sha256,
      output_file_sha256: outputHash,
    },
    included_zip_archives: [{
      path: archive.path,
      sha256: archive.sha256,
      byte_size: archive.byte_size,
    }],
    included_kit_ids: [...definition.included_kit_ids],
    excluded_kit_ids: allArchiveKits.filter((id) => !definition.included_kit_ids.includes(id)),
    source_book_ids: [...new Set(records.map((record) => record.source_book_id))].sort(bytewise),
    source_records: sourceRows.length,
    page_records_included: records.length,
    administrative_records_excluded: accounting.administrative_or_imprint,
    kit_details_records_excluded: accounting.kit_or_book_detail,
    duplicate_detail_aliases_excluded: accounting.duplicate_detail_alias,
    duplicate_instructional_urls_excluded: accounting.duplicate_instructional_url,
    malformed_or_ambiguous_records_excluded: accounting.malformed_or_ambiguous,
    source_accounting: accounting,
    grades: { 4: records.length },
    languages: countBy(records.map((record) => record.language)),
    books: countBy(records.map((record) => record.book_id)),
    kits: countBy(records.map((record) => record.kit_id)),
    raw_grade_labels: countBy(sourceRows.map((record) => record.grade)),
    evidence_supported_grade_scope: [4],
    raw_subject_labels: rawSubjects,
    canonical_subject: { ...definition.subject },
    subject_normalization: {
      source_rows_with_exporter_mathematics_alias: mathAliasesRemoved,
      canonical_subject: canonicalSubjectValue,
      visible_instructional_text_changed: false,
    },
    programme_type: definition.programme_type,
    programme_evidence: definition.programme_type === 'simplified_curriculum'
      ? ['Captured title and Source Book identity explicitly state lihtsustatud õppekava.']
      : definition.programme_type === 'mixed_subject'
        ? ['Route identity is intentionally mixed human studies and society; it is not subject-pure human studies.']
        : ['Programme type is not established by the supplied evidence and remains unknown.'],
    edition_distinctions: definition.edition_distinctions.map(([left, right, evidence]) => ({
      kit_ids: [left, right],
      disposition: 'retain_separate_editions',
      evidence,
    })),
    metadata_contradictions: metadataContradictions,
    kit_details_evidence_refs: routeEvidenceRefs(definition),
    url_ownership: {
      require_unique: true,
      canonical_url_count: records.length,
      duplicate_within_route_count: 0,
      cross_grade4_route_overlap_count: 0,
    },
    task_availability: {
      records_with_captured_task_examples: recordsWithTasks,
      records_without_captured_task_examples: records.length - recordsWithTasks,
      task_level_complete: false,
      task_bodies_synthesized: false,
    },
    page_prose_availability: {
      complete_page_prose_captured: false,
      records_with_complete_page_prose: 0,
    },
    captured_markup: {
      records_with_html_or_mathml_fragments: records.filter((record) => (
        record.task_examples.some(containsUnprocessedPayload)
      )).length,
      markup_preserved_as_source_evidence: true,
    },
    known_limitations: [
      'Complete instructional page prose is not present in the raw chapter objects.',
      'Task examples are incomplete for some or all books; no task content is synthesized.',
      'Exporter-generated translated topics are query metadata, not proof of page-language prose.',
      'Current live-catalogue and official-curriculum completeness are not established.',
      ...definition.notes,
    ],
  };
}

export function buildGrade4ContentQualityReport(model, routeArtifacts) {
  const routeResults = routeArtifacts.map(({ model: routeModel, qa }) => ({
    route_id: routeModel.definition.id,
    status: qa.task_availability.records_without_captured_task_examples > 0 ? 'pass_with_warnings' : 'pass',
    canonical_record_count: qa.page_records_included,
    included_kit_ids: qa.included_kit_ids,
    languages: qa.languages,
    programme_type: qa.programme_type,
    source_integrity: 'pass',
    grade_evidence: 'pass',
    subject_evidence: 'pass',
    language_evidence: 'pass_with_warnings',
    task_availability: qa.task_availability.task_level_complete ? 'pass' : 'pass_with_warnings',
    page_prose_availability: 'blocked',
    warnings: qa.known_limitations,
  }));
  const totalWithTasks = routeArtifacts.reduce(
    (sum, artifact) => sum + artifact.qa.task_availability.records_with_captured_task_examples,
    0,
  );
  return {
    schema_version: contentQualitySchemaVersion,
    artifact_type: 'grade-4-content-quality-report',
    report_id: 'grade-4-canonical-source-content-quality',
    generated_from: {
      immutable_intake_report: 'evaluations/grade-4-source-intake.json',
      kit_details_evidence: evidencePath,
      routing_policy_module: 'scripts/lib/grade-4-canonical-sources.mjs',
    },
    scope: {
      canonical_route_ids: grade4RoutePolicy.map((entry) => entry.id),
      canonical_record_count: model.canonical_owners.size,
      multi_grade_support_kit_ids: multiGradeSupportPolicy.map((entry) => entry.kit_id),
      supplied_archive_count: model.archives.length,
    },
    canonical_import_status: 'pass_with_warnings',
    downstream_course_building_status: 'blocked',
    checks: [
      {
        check_id: 'canonical_route_readiness',
        status: 'pass',
        summary: 'All 11 evidence-supported Grade 4 canonical routes are deterministic and URL-exclusive.',
      },
      {
        check_id: 'source_integrity',
        status: 'pass',
        summary: 'All ten immutable ZIP identities and the 2,425-row accounting remain verified.',
      },
      {
        check_id: 'grade_subject_programme_boundaries',
        status: 'pass_with_warnings',
        summary: 'Exact Grade 4 and simplified/mixed boundaries are enforced; unknown programme types remain unknown.',
      },
      {
        check_id: 'instructional_page_availability',
        status: 'pass',
        summary: `${model.canonical_owners.size} canonical instructional chapter URLs are available.`,
      },
      {
        check_id: 'task_availability',
        status: 'pass_with_warnings',
        summary: `${totalWithTasks} canonical records contain captured task examples; task-level completeness is not established.`,
      },
      {
        check_id: 'complete_page_prose',
        status: 'blocked',
        summary: 'The supplied raw chapter objects do not contain complete instructional page prose.',
      },
      {
        check_id: 'live_catalogue_completeness',
        status: 'blocked',
        summary: 'No current live-catalogue snapshot establishes complete Grade 4 Opiq coverage.',
      },
      {
        check_id: 'multi_grade_shared_sources',
        status: 'pass',
        summary: 'Kits 161, 200, and 476 retain non-exclusive multi-grade/shared dispositions.',
      },
    ],
    route_results: routeResults,
    multi_grade_shared_sources: multiGradeSupportPolicy.map((entry) => ({ ...entry })),
    downstream_blockers: [
      {
        code: 'complete_page_prose_not_captured',
        message: 'Full page prose must be recaptured before prose-level course generation.',
        affected_kit_ids: grade4RoutePolicy.flatMap((entry) => entry.included_kit_ids).sort(bytewise),
      },
      {
        code: 'task_body_recapture_required',
        message: 'Capture task bodies before task-level lesson use for books whose structured task examples are absent.',
        affected_kit_ids: routeArtifacts
          .flatMap(({ model: routeModel, qa }) => (
            qa.task_availability.records_without_captured_task_examples > 0
              ? routeModel.definition.included_kit_ids
              : []
          ))
          .filter((value, index, values) => values.indexOf(value) === index)
          .sort(bytewise),
      },
      {
        code: 'live_catalogue_completeness_unverified',
        message: 'A current live-catalogue snapshot is required before claiming complete Grade 4 catalogue coverage.',
        affected_kit_ids: [],
      },
    ],
    non_blocking_limitations: [
      'Publisher metadata remains null/empty unless explicitly verified.',
      'Unknown programme types are not promoted to ordinary curriculum.',
      'Captured MathML/HTML fragments in task examples remain source evidence rather than reconstructed prose.',
      'Parallel translated topic arrays are not treated as multilingual instructional content.',
    ],
    non_guarantees: [
      'This report does not establish complete current Opiq Grade 4 catalogue coverage.',
      'This report does not establish complete official Grade 4 curriculum coverage.',
      'This report does not establish pedagogical effectiveness or commercial course readiness.',
    ],
  };
}

export function renderKitDetailsEvidenceMarkdown(evidence) {
  const lines = [
    '# Grade 4 post-intake Kit Details evidence',
    '',
    `Verified on ${verificationDate} by manual Kit Details review. Project provenance: ${issueEvidenceCommentUrl}.`,
    '',
    'This evidence was obtained after the immutable ZIP intake. It does not rewrite the historical intake findings.',
    '',
    '## Records',
    '',
  ];
  for (const record of evidence.records) {
    lines.push(
      `### Kit ${record.kit_id}`,
      '',
      `- Kit Details: ${record.kit_details_url}`,
      `- Grade scope: ${record.grade_scope.join(', ')}`,
      `- Exact Grade 4 confirmed: ${record.exact_grade_4_confirmed}`,
      `- Subject: ${record.subject ?? 'unknown'}`,
      `- Language: ${record.language ?? 'unknown'}`,
      `- Programme/support role: ${record.programme_or_support_role}`,
      `- Publisher: ${record.publisher ?? 'unknown'}`,
      `- Curriculum: ${record.curriculum ?? 'unknown'}`,
      `- Access: ${record.access_mode ?? 'unknown'}`,
      '',
    );
  }
  lines.push(
    '## Limitations',
    '',
    ...evidence.non_guarantees.map((entry) => `- ${entry}`),
    '',
  );
  return lines.join('\n');
}

export function renderGrade4SourceImportAudit(model, routeArtifacts) {
  const lines = [
    '# Grade 4 canonical source import',
    '',
    `Base commit: \`${importBaseCommit}\`.`,
    '',
    '## Imported routes',
    '',
    '| Route | Kits | Canonical pages | Programme |',
    '| --- | --- | ---: | --- |',
    ...routeArtifacts.map(({ model: routeModel }) => {
      const definition = routeModel.definition;
      return `| \`${definition.id}\` | ${definition.included_kit_ids.join(', ')} | ${routeModel.canonical_records.length} | ${definition.programme_type} |`;
    }),
    '',
    `Canonical URL union: ${model.canonical_owners.size}; cross-route overlaps: 0.`,
    '',
    '## Multi-grade and shared sources',
    '',
    ...multiGradeSupportPolicy.map((entry) => (
      `- Kit ${entry.kit_id}: grades ${entry.grade_scope.join('–')}; ${entry.programme_or_support_role}; exclusive Grade 4 owner: no; disposition: ${entry.disposition}.`
    )),
    '',
    '## Accounting',
    '',
    `- Supplied rows: ${model.global_accounting.total_source_records}`,
    `- Instructional rows: ${model.global_accounting.instructional_chapter_or_page}`,
    `- Canonical Grade 4 route rows: ${model.canonical_owners.size}`,
    `- Multi-grade/shared instructional rows not assigned an exclusive Grade 4 owner: ${multiGradeSupportPolicy.reduce((sum, entry) => sum + entry.instructional_record_count, 0)}`,
    `- Administrative/imprint rows excluded: ${model.global_accounting.administrative_or_imprint}`,
    `- Unique Kit Details excluded: ${model.global_accounting.kit_or_book_detail}`,
    `- Duplicate detail aliases excluded: ${model.global_accounting.duplicate_detail_alias}`,
    '',
    '## Claim boundaries',
    '',
    '- The generated routes account for the evidence-supported supplied Grade 4 route decisions.',
    '- Current live Opiq Grade 4 catalogue completeness is not established.',
    '- Official curriculum completeness and pedagogical effectiveness are not established.',
    '- Missing full page prose and task bodies are not synthesized.',
    '',
  ];
  return lines.join('\n');
}

export function renderGrade4ContentQualityMarkdown(report) {
  const lines = [
    '# Grade 4 content-quality audit',
    '',
    `Canonical import status: **${report.canonical_import_status}**.`,
    '',
    `Downstream course-building status: **${report.downstream_course_building_status}**.`,
    '',
    '## Checks',
    '',
    '| Check | Status | Summary |',
    '| --- | --- | --- |',
    ...report.checks.map((check) => `| ${check.check_id} | ${check.status} | ${check.summary} |`),
    '',
    '## Routes',
    '',
    ...report.route_results.map((entry) => (
      `- \`${entry.route_id}\`: ${entry.canonical_record_count} pages; ${entry.status}; programme ${entry.programme_type}.`
    )),
    '',
    '## Downstream blockers',
    '',
    ...report.downstream_blockers.map((entry) => `- **${entry.code}:** ${entry.message}`),
    '',
    '## Non-guarantees',
    '',
    ...report.non_guarantees.map((entry) => `- ${entry}`),
    '',
  ];
  return lines.join('\n');
}

export async function buildGrade4SourceArtifacts(rootDir) {
  const model = await loadGrade4CanonicalSourceModel(rootDir);
  const routeArtifacts = model.routes.map((routeModel) => {
    const markdown = renderGrade4CanonicalMarkdown(routeModel);
    return {
      model: routeModel,
      markdown,
      qa: buildGrade4RouteQa(routeModel, markdown),
    };
  });
  const evidence = buildKitDetailsEvidence();
  return {
    model,
    route_artifacts: routeArtifacts,
    evidence,
    files: new Map([
      [evidencePath, stableJson(evidence)],
      [evidenceAuditPath, renderKitDetailsEvidenceMarkdown(evidence)],
      [sourceImportAuditPath, renderGrade4SourceImportAudit(model, routeArtifacts)],
      ...routeArtifacts.flatMap((artifact) => [
        [artifact.model.definition.output_path, artifact.markdown],
        [artifact.model.definition.qa_path, stableJson(artifact.qa)],
      ]),
    ]),
  };
}

export async function buildGrade4ContentQualityArtifacts(rootDir) {
  const sourceArtifacts = await buildGrade4SourceArtifacts(rootDir);
  const report = buildGrade4ContentQualityReport(
    sourceArtifacts.model,
    sourceArtifacts.route_artifacts,
  );
  return {
    report,
    json: stableJson(report),
    markdown: renderGrade4ContentQualityMarkdown(report),
  };
}

export function assertCommittedBytes(expected, actual, label) {
  const expectedBytes = Buffer.isBuffer(expected) ? expected : Buffer.from(expected);
  const actualBytes = Buffer.isBuffer(actual) ? actual : Buffer.from(actual);
  if (!expectedBytes.equals(actualBytes)) throw new Error(`${label} is stale; regenerate Grade 4 sources.`);
}

export function validateGrade4Manifest(manifest) {
  const sources = Array.isArray(manifest?.sources) ? manifest.sources : [];
  const grade4Sources = sources.filter((source) => source.grade === 4);
  const expectedIds = grade4RoutePolicy.map((entry) => entry.id);
  const actualIds = grade4Sources.map((entry) => entry.id);
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    throw new Error(`Grade 4 manifest route order/identity differs: ${actualIds.join(', ')}.`);
  }
  for (const definition of grade4RoutePolicy) {
    const source = grade4Sources.find((entry) => entry.id === definition.id);
    if (!source
      || source.grade_group !== '1-4'
      || source.subject !== definition.subject_code
      || source.subject_et !== definition.subject_et
      || source.md_path !== definition.output_path
      || source.source_archive !== definition.source_archive
      || source.qa_path !== definition.qa_path
      || source.record_count !== definition.expected_record_count
      || source.format_version !== '2.0'
      || source.coverage_status !== 'available_not_curriculum_verified'
      || source.quality_status !== 'original_archive_audited'
      || JSON.stringify(source.source_scope?.included_kit_ids) !== JSON.stringify(definition.included_kit_ids)
      || source.source_scope?.programme_type !== definition.programme_type
      || source.source_scope?.audit_path !== sourceImportAuditPath
      || source.canonical_url_policy?.require_unique !== true
      || JSON.stringify(source.canonical_subject_policy?.required_subject) !== JSON.stringify(definition.subject)
      || !Array.isArray(source.languages)
      || source.languages.length === 0) {
      throw new Error(`${definition.id}: manifest declaration differs from the Grade 4 routing policy.`);
    }
  }
  const coverage = Array.isArray(manifest.missing_coverage)
    ? manifest.missing_coverage.find((entry) => entry.grade === 4)
    : null;
  if (!coverage
    || coverage.coverage_status !== 'partial_subject_bounded'
    || coverage.subjects !== 'verified_routes_only'
    || JSON.stringify(coverage.verified_route_ids) !== JSON.stringify(expectedIds)
    || !Array.isArray(coverage.unverified_or_absent_catalogue_areas)
    || coverage.unverified_or_absent_catalogue_areas.length === 0) {
    throw new Error('Grade 4 coverage gap must remain explicit and subject-bounded.');
  }
  return true;
}
