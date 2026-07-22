#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { readCompactZip, readZipText, requireZipMember } from './lib/compact-zip.mjs';
import {
  containsUnprocessedPayload,
  expectedGrade2BookVariantCount,
  expectedGrade2Catalog,
  expectedGrade2PageCount,
  expectedGrade2RouteCount,
  mixedScriptWords,
  normalizeQualityText,
  sanitizeCapturedTaskExample,
  sourceBookLanguageSuffix,
  textScriptProfile,
} from './lib/grade-2-content-quality.mjs';
import { parseOpiqRegressionMarkdown } from './lib/opiq-regression-markdown.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const manifestPath = path.join(repositoryRoot, 'source-manifest.json');
const jsonReportPath = path.join(repositoryRoot, 'project-files/outputs/grade-2-content-quality-report.json');
const markdownReportPath = path.join(repositoryRoot, 'docs/audits/grade-2-content-quality.md');
const argumentsList = process.argv.slice(2);
const writeReports = argumentsList.includes('--write');
const checkReports = argumentsList.includes('--check') || !writeReports;
const unknownArguments = argumentsList.filter((argument) => !['--write', '--check'].includes(argument));
const canonicalUrlPattern = /^https:\/\/www\.opiq\.ee\/kit\/\d+\/chapter\/\d+$/u;
const forbiddenControlPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;
const expectedRouteIds = Object.keys(expectedGrade2Catalog).sort();

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sortedUnique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function groupBy(values, selector) {
  const groups = new Map();
  for (const value of values) {
    const key = selector(value);
    const group = groups.get(key) ?? [];
    group.push(value);
    groups.set(key, group);
  }
  return groups;
}

function parseFields(block) {
  const fields = new Map();
  for (const line of block.split(/\r?\n/u)) {
    const match = line.match(/^- ([A-Za-z][A-Za-z ]*):\s*(.*)$/u);
    if (match) fields.set(match[1].toLowerCase(), match[2]);
  }
  return fields;
}

function splitRecords(markdown, source) {
  const parsed = parseOpiqRegressionMarkdown(markdown, { sourceId: source.id, mdPath: source.md_path });
  const starts = [...markdown.matchAll(/^###\s+(\d+)\.\s+(.+)$/gmu)];
  if (starts.length !== parsed.records.length) {
    throw new Error(`${source.id}: Markdown record boundary count differs from parsed record count.`);
  }
  return parsed.records.map((record, index) => {
    const blockEnd = index + 1 < starts.length ? starts[index + 1].index : markdown.length;
    const block = markdown.slice(starts[index].index, blockEnd);
    const fields = parseFields(block);
    const programmeType = normalizeQualityText(fields.get('programme type'))
      || (source.id === 'grade-2-russian' ? 'ordinary_curriculum' : '');
    return {
      ...record,
      route_id: source.id,
      md_path: source.md_path,
      block,
      book: normalizeQualityText(fields.get('book')),
      source_book_id: normalizeQualityText(fields.get('source book id')) || record.book_id,
      publisher: normalizeQualityText(fields.get('publisher')),
      programme_type: programmeType,
      kit_id: record.url.match(/\/kit\/(\d+)\//u)?.[1] ?? '',
      visible_length: normalizeQualityText([
        record.title,
        ...record.headings,
        ...record.task_examples,
      ].join(' ')).length,
    };
  });
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repositoryRoot, relativePath), 'utf8'));
}

async function loadRawArchives(routes) {
  const paths = sortedUnique(routes.flatMap((route) => [
    route.source_archive,
    ...(route.additional_source_archives ?? []).map((entry) => entry.path),
  ]));
  const archives = [];
  for (const archivePath of paths) {
    const absolutePath = path.join(repositoryRoot, archivePath);
    const bytes = await readFile(absolutePath);
    const archive = await readCompactZip(absolutePath);
    requireZipMember(archive, 'opiq_lookup.jsonl');
    const records = readZipText(archive, 'opiq_lookup.jsonl')
      .split(/\r?\n/u)
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
    archives.push({
      path: archivePath,
      sha256: sha256(bytes),
      records,
    });
  }
  return archives;
}

function warningBase(code, classification, records, message, action, observations = []) {
  return {
    code,
    classification,
    blocking: false,
    route_ids: sortedUnique(records.map((record) => record.route_id)),
    book_ids: sortedUnique(records.map((record) => record.book_id)),
    kit_ids: sortedUnique(records.map((record) => record.kit_id)),
    message,
    action,
    observations,
    urls: sortedUnique(records.map((record) => record.url)),
  };
}

function warningSortKey(warning) {
  return [
    warning.code,
    warning.route_ids.join(','),
    warning.book_ids.join(','),
    warning.urls[0] ?? '',
    warning.message,
  ].join('|');
}

function buildWarnings(records, rawByUrl) {
  const warnings = [];

  for (const group of groupBy(records.filter((record) => record.task_examples.length === 0), (record) => `${record.route_id}\0${record.book_id}`).values()) {
    warnings.push(warningBase(
      'missing_task_examples',
      'acceptable_source_structure',
      group,
      `${group.length} canonical records have no extracted task examples.`,
      'Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.',
      group.map((record) => ({ url: record.url, title: record.title })),
    ));
  }

  for (const group of groupBy(records.filter((record) => [...record.title].length <= 3), (record) => `${record.route_id}\0${record.book_id}`).values()) {
    const punctuationOnly = group.some((record) => !/\p{L}|\p{N}/u.test(record.title));
    warnings.push(warningBase(
      'very_short_title',
      punctuationOnly ? 'targeted_recapture_recommended' : 'source_supported_short_title',
      group,
      `${group.length} records have titles of three characters or fewer.`,
      punctuationOnly
        ? 'Recapture only the punctuation-only page if it will be selected for teaching; letter, phonics, and one-word concept titles are valid book structure.'
        : 'No repair: archive title and first heading agree, and the short title is meaningful in the source structure.',
      group.map((record) => ({ url: record.url, title: record.title })),
    ));
  }

  const singleSymbolRecords = records.filter((record) => {
    const letters = record.title.match(/\p{L}/gu) ?? [];
    return letters.length <= 1 && [...record.title].length <= 3;
  });
  for (const group of groupBy(singleSymbolRecords, (record) => `${record.route_id}\0${record.book_id}`).values()) {
    warnings.push(warningBase(
      'single_symbol_title',
      group.some((record) => !/\p{L}|\p{N}/u.test(record.title))
        ? 'targeted_recapture_recommended'
        : 'acceptable_book_structure',
      group,
      `${group.length} records use one letter or punctuation-only text as the page title.`,
      'Retain source-supported phonics, pronoun, or concept titles. Verify the punctuation-only page with one targeted page capture before relying on it.',
      group.map((record) => ({ url: record.url, title: record.title })),
    ));
  }

  for (const group of groupBy(records.filter((record) => record.visible_length < 10), (record) => `${record.route_id}\0${record.book_id}`).values()) {
    warnings.push(warningBase(
      'unusually_short_record',
      'source_supported_short_summary',
      group,
      `${group.length} compact records contain fewer than 10 visible title/heading/task characters.`,
      'The compact record is a lookup summary, not a full page copy. Retain when title and heading agree; inspect the direct Opiq page when selecting it for a lesson.',
      group.map((record) => ({ url: record.url, title: record.title, visible_length: record.visible_length })),
    ));
  }

  for (const group of groupBy(records.filter((record) => mixedScriptWords([
    record.title,
    record.headings,
    record.task_examples,
  ]).length > 0), (record) => `${record.route_id}\0${record.book_id}`).values()) {
    const kit578Only = group.every((record) => record.kit_id === '578');
    warnings.push(warningBase(
      'mixed_script_word',
      kit578Only ? 'known_bilingual_extraction_boundary' : 'targeted_recapture_recommended',
      group,
      `${group.length} records contain a word token combining Cyrillic and Latin characters.`,
      kit578Only
        ? 'Keep the bilingual language-support content; missing spaces between the Estonian Keeleabi label and Russian text are an extraction limitation, not a language reassignment.'
        : 'Do not auto-correct look-alike letters. Recapture only the listed page when exact task wording is required.',
      group.map((record) => ({
        url: record.url,
        title: record.title,
        mixed_words: mixedScriptWords([record.title, record.headings, record.task_examples]),
      })),
    ));
  }

  const languageMismatches = records.filter((record) => {
    const profile = textScriptProfile([record.title, record.headings, record.task_examples]);
    const total = profile.cyrillic + profile.latin;
    if (total < 20) return false;
    return record.language === 'ru'
      ? profile.latin / total > 0.8
      : profile.cyrillic / total > 0.8;
  });
  for (const group of groupBy(languageMismatches, (record) => `${record.route_id}\0${record.book_id}`).values()) {
    const kitId = group[0].kit_id;
    const isKnownMetadataAnomaly = ['570', '578'].includes(kitId);
    const isExpectedBilingualContent = kitId === '238'
      || group.every((record) => record.route_id === 'grade-2-russian' && record.title === 'Sõnaseletused');
    warnings.push(warningBase(
      'text_language_mismatch',
      isKnownMetadataAnomaly
        ? 'known_source_metadata_anomaly'
        : isExpectedBilingualContent
          ? 'acceptable_bilingual_source_content'
          : 'source_language_requires_targeted_review',
      group,
      `${group.length} records are dominated by a script that differs from canonical Language.`,
      isKnownMetadataAnomaly
        ? 'Retain source Language ru pending a fresh Kit Details language check; the capture is Estonian-primary or bilingual despite the Russian source identity.'
        : isExpectedBilingualContent
          ? 'Retain as a source-supported Estonian song title or bilingual glossary inside a Russian-language book; this does not reclassify the whole book.'
          : 'Do not change language automatically. Review the listed page and current Kit Details before any metadata repair.',
      group.map((record) => ({
        url: record.url,
        title: record.title,
        canonical_language: record.language,
        script_profile: textScriptProfile([record.title, record.headings, record.task_examples]),
      })),
    ));
  }

  const sourceLanguageMismatches = records.filter((record) => {
    const rawLanguages = sortedUnique((rawByUrl.get(record.url) ?? []).map((raw) => raw.language));
    return rawLanguages.length > 0 && !rawLanguages.includes(record.language);
  });
  for (const group of groupBy(sourceLanguageMismatches, (record) => `${record.route_id}\0${record.book_id}`).values()) {
    warnings.push(warningBase(
      'source_canonical_language_mismatch',
      'proven_canonical_normalization',
      group,
      `${group.length} records have canonical Language different from every raw compact-record language value.`,
      'Keep the canonical language only where book identity and page text prove the automatic source label wrong; preserve the raw values in this audit.',
      group.map((record) => ({
        url: record.url,
        title: record.title,
        canonical_language: record.language,
        source_languages: sortedUnique((rawByUrl.get(record.url) ?? []).map((raw) => raw.language)),
      })),
    ));
  }

  for (const group of groupBy(records.filter((record) => !record.publisher), (record) => `${record.route_id}\0${record.book_id}`).values()) {
    warnings.push(warningBase(
      'missing_publisher',
      'source_supported_metadata_limitation',
      group,
      `Publisher is absent for ${group[0].book_id} (kit ${group[0].kit_id}).`,
      'Do not invent a publisher. A current Kit Details or cover-only capture may fill this optional metadata later.',
    ));
  }

  for (const group of groupBy(records.filter((record) => {
    const suffix = sourceBookLanguageSuffix(record.source_book_id);
    return suffix && suffix !== record.language;
  }), (record) => `${record.route_id}\0${record.book_id}`).values()) {
    warnings.push(warningBase(
      'source_book_id_language_suffix_mismatch',
      'source_identifier_anomaly',
      group,
      `Source Book ID language suffix conflicts with canonical Language for ${group[0].book_id}.`,
      'Preserve the immutable source identifier. Do not infer a language correction from the suffix alone.',
      [{
        source_book_id: group[0].source_book_id,
        canonical_language: group[0].language,
        page_count: group.length,
      }],
    ));
  }

  for (const [title, group] of groupBy(records, (record) => record.title).entries()) {
    if (group.length < 2) continue;
    warnings.push(warningBase(
      'duplicate_title',
      'distinct_canonical_context',
      group,
      `Title “${title}” occurs at ${group.length} distinct canonical URLs.`,
      'Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.',
      group.map((record) => ({ url: record.url, route_id: record.route_id, book_id: record.book_id })),
    ));
  }

  for (const group of groupBy(records, (record) => JSON.stringify([
    record.title,
    record.headings,
    record.task_examples,
  ])).values()) {
    if (group.length < 2) continue;
    warnings.push(warningBase(
      'duplicate_compact_content',
      'distinct_canonical_context',
      group,
      `${group.length} distinct URLs have equal compact title, headings, and task examples.`,
      'Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.',
      group.map((record) => ({ url: record.url, title: record.title, route_id: record.route_id, book_id: record.book_id })),
    ));
  }

  const punctuationRecords = records.filter((record) => /^\p{P}+$/u.test(record.title));
  if (punctuationRecords.length > 0) {
    warnings.push(warningBase(
      'anomalous_punctuation',
      'targeted_recapture_recommended',
      punctuationRecords,
      `${punctuationRecords.length} page titles contain punctuation only.`,
      'Retain the captured value but do not rely on it for routing until the individual page is checked.',
      punctuationRecords.map((record) => ({ url: record.url, title: record.title })),
    ));
  }

  return warnings.sort((left, right) => warningSortKey(left).localeCompare(warningSortKey(right)))
    .map((warning, index) => ({ id: `g2q-${String(index + 1).padStart(4, '0')}`, ...warning }));
}

function targetedRecapturePlan() {
  return {
    kit_details_or_cover_only: [
      { kit_id: '578', title: 'Matemaatika 2. klassile', capture: 'Current Kit Details with cover and visible language metadata', uncertainty: 'Source Language is ru while cover and most headings are Estonian or bilingual.', programme_can_start_without: true },
      { kit_id: '570', title: 'Природоведение для 2 класса', capture: 'Current Kit Details and cover', uncertainty: 'Russian indexed book is paired with an Estonian cover title.', programme_can_start_without: true },
      { kit_id: '579', title: 'Inimeseõpetus algklassidele. II osa', capture: 'Current Kit Details and cover with language metadata', uncertainty: 'Four source records are marked et inside the otherwise Russian-routed source.', programme_can_start_without: true },
      ...[
        ['192', 'Kunsti- ja tööõpetus. 2. osa'],
        ['200', 'Kunsti- ja tööõpetus. 4. osa. Tähtpäevakaardid'],
        ['371', 'Трудовое обучение и искусство. 2 часть'],
        ['188', 'Muusikamaa'],
        ['193', 'Muusikaõpik 2. klassile'],
        ['238', 'Музыка – волшебная страна. 2 класс'],
        ['465', 'Eesti Pärimusmuusika Keskuse õppevideod'],
        ['556', 'Muusikaõpik 2. klassile 2024'],
      ].map(([kitId, title]) => ({
        kit_id: kitId,
        title,
        capture: 'Current Kit Details or cover showing publisher metadata',
        uncertainty: 'The supplied capture contains no publisher value.',
        programme_can_start_without: true,
      })),
    ],
    individual_pages: [
      { kit_id: '118', title: 'ILUS EMAKEEL — punctuation-only page', url: 'https://www.opiq.ee/kit/118/chapter/5990', capture: 'Page title and first visible instructional heading', uncertainty: 'Canonical title and heading are only “...”.', programme_can_start_without: true },
      { kit_id: '579', title: 'RAHVAKOMBED SÜGISEL II. MARDIPÄEV JA KADRIPÄEV', url: 'https://www.opiq.ee/kit/579/chapter/32445', capture: 'Page language indicator and visible content', uncertainty: 'The instructional source record is marked et inside a Russian-routed kit.', programme_can_start_without: true },
      { kit_id: '570', title: 'Ilm', url: 'https://www.opiq.ee/kit/570/chapter/32084', capture: 'Heading containing the word currently extracted as Cпутники', uncertainty: 'Latin C and Cyrillic letters are mixed in one word.', programme_can_start_without: true },
      { kit_id: '132', title: 'Деревья', url: 'https://www.opiq.ee/kit/132/chapter/7072', capture: 'Heading containing the word currently extracted as Pабочая', uncertainty: 'Latin P and Cyrillic letters are mixed in one word.', programme_can_start_without: true },
      { kit_id: '229', title: 'Мои увлечения', url: 'https://www.opiq.ee/kit/229/chapter/13076', capture: 'Task label currently extracted as Заданиe', uncertainty: 'Latin e and Cyrillic letters are mixed in one word.', programme_can_start_without: true },
      { kit_id: '292', title: 'Звуки и буквы', url: 'https://www.opiq.ee/kit/292/chapter/16123', capture: 'Words with the currently mixed-script stressed vowels', uncertainty: 'Precomposed Latin accented letters occur inside Cyrillic words.', programme_can_start_without: true },
      { kit_id: '292', title: 'Повторение (1)', url: 'https://www.opiq.ee/kit/292/chapter/17761', capture: 'Word currently extracted as словá', uncertainty: 'A precomposed Latin accented letter occurs inside a Cyrillic word.', programme_can_start_without: true },
      { kit_id: '568', title: 'Татьяна Александрова. Домовёнок ______', url: 'https://www.opiq.ee/kit/568/chapter/31778', capture: 'Word currently extracted as свóриться', uncertainty: 'A precomposed Latin accented letter occurs inside a Cyrillic word.', programme_can_start_without: true },
      { kit_id: '568', title: 'Где поставить ударение?', url: 'https://www.opiq.ee/kit/568/chapter/31793', capture: 'Stressed words and the рекиPausEsita extraction boundary', uncertainty: 'Mixed-script stressed vowels and a media-control label are concatenated with lesson text.', programme_can_start_without: true },
      { kit_id: '454', title: 'СУМАCШЕДШАЯ ПТИЦА', url: 'https://www.opiq.ee/kit/454/chapter/24744', capture: 'Page title and first heading', uncertainty: 'Latin C occurs inside a Cyrillic word.', programme_can_start_without: true },
    ],
    full_kits: [],
  };
}

function knownAnomalies() {
  return [
    { kit_id: '578', status: 'unresolved_metadata', finding: 'Source language is ru; cover is Estonian; headings are Estonian-primary or bilingual.', disposition: 'Retain ru and request only current Kit Details language evidence.' },
    { kit_id: '570', status: 'unresolved_metadata', finding: 'Russian indexed record is associated with an Estonian cover.', disposition: 'Retain the Russian route; request only current Kit Details/cover evidence.' },
    { kit_id: '192, 200, 371', status: 'acceptable_missing_metadata', finding: 'Arts-and-crafts archive has no publisher values.', disposition: 'Publishers remain blank.' },
    { kit_id: '188, 193, 238, 465, 556', status: 'acceptable_missing_metadata', finding: 'Music archive has no publisher values.', disposition: 'Publishers remain blank.' },
    { kit_id: '579', status: 'source_language_anomaly', finding: 'Four raw source records are marked et: two repeated Kit Details records, one instructional page, and one excluded Impressum.', disposition: 'Canonical instructional route remains Russian; retain raw evidence and target only the one instructional page plus Kit Details.' },
    { kit_id: '86', status: 'acceptable_mixed_subject_source', finding: 'The archive does not support a reliable page-level science/human-studies split.', disposition: 'Keep all 60 pages in the dedicated mixed-subject route.' },
    { kit_id: '578, 361', status: 'source_identifier_anomaly', finding: 'Source Book IDs end in _et while canonical Language is ru.', disposition: 'Preserve immutable Source Book IDs; do not infer language from the suffix.' },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Grade 2 canonical content-quality audit',
    '',
    '## Scope and readiness conclusion',
    '',
    report.scope_claim,
    '',
    `The audit checked **${report.summary.routes_checked} routes**, **${report.summary.book_variants_checked} canonical book/kit variants**, and **${report.summary.page_records_checked.toLocaleString('en-US')} canonical instructional pages**. It found **${report.summary.hard_error_count} unexplained hard errors** and ${report.summary.warning_count} classified warning groups. The captured sources are structurally suitable for beginning home-course architecture, subject to the non-blocking targeted checks below. This is not proof of live Opiq catalogue completeness or official curriculum completeness.`,
    '',
    'Programme boundaries remain explicit: ordinary, simplified, supplementary, mixed-subject, and youth-training records are not interchangeable defaults.',
    '',
    '## Hard errors',
    '',
  ];
  if (report.hard_errors.length === 0) lines.push('- None.');
  else report.hard_errors.forEach((error) => lines.push(`- **${error.code}:** ${error.message}`));

  lines.push('', '## Warning summary', '', '| Code | Groups | URLs | Classifications |', '| --- | ---: | ---: | --- |');
  for (const summary of report.warning_summary) {
    lines.push(`| \`${summary.code}\` | ${summary.groups} | ${summary.urls} | ${summary.classifications.join(', ')} |`);
  }

  lines.push('', '## Route and book coverage', '', '| Route | Books | Pages | Warnings |', '| --- | ---: | ---: | ---: |');
  for (const route of report.route_summary) {
    lines.push(`| \`${route.route_id}\` | ${route.book_variants} | ${route.pages} | ${route.warning_groups} |`);
  }

  lines.push('', '## Archive-proven repairs', '');
  lines.push(`- ${report.repairs.embedded_payloads.length} pages had raw JSON/HTML task payloads removed. The human-readable instruction already present in the same archived task record was retained; titles, URLs, headings, and author wording were not rewritten.`);
  report.repairs.embedded_payloads.forEach((repair) => lines.push(`  - [${repair.route_id} / ${repair.title}](${repair.url})`));
  lines.push(`- ${report.repairs.invisible_spacing_controls.length} pages had invisible zero-width spacing controls removed from extracted task summaries.`);
  report.repairs.invisible_spacing_controls.forEach((repair) => lines.push(`  - [${repair.route_id} / ${repair.title}](${repair.url})`));
  lines.push('- Existing source-supported catalogue corrections remain in force: the kit 132 Cyrillic title correction, Ministry publisher casing, soft-hyphen removal from canonical identifiers, and exact URL deduplication.');

  lines.push('', '## Known metadata anomalies', '', '| Kit | Status | Finding | Disposition |', '| --- | --- | --- | --- |');
  report.known_anomalies.forEach((entry) => lines.push(`| ${entry.kit_id} | \`${entry.status}\` | ${entry.finding} | ${entry.disposition} |`));

  lines.push('', '## Minimal targeted recapture plan', '', '### Kit Details or cover only', '');
  report.targeted_recapture.kit_details_or_cover_only.forEach((entry) => lines.push(`- **Kit ${entry.kit_id} — ${entry.title}:** ${entry.capture}. Resolves: ${entry.uncertainty} Programme architecture can continue without it: **${entry.programme_can_start_without ? 'yes' : 'no'}**.`));
  lines.push('', '### Individual pages', '');
  report.targeted_recapture.individual_pages.forEach((entry) => lines.push(`- **Kit ${entry.kit_id} — [${entry.title}](${entry.url}):** ${entry.capture}. Resolves: ${entry.uncertainty} Programme architecture can continue without it: **${entry.programme_can_start_without ? 'yes' : 'no'}**.`));
  lines.push('', '### Full kits', '', '- None. No supplied archive shows systematic corruption that justifies a full recapture.');

  lines.push('', '## Detailed classified warning inventory', '');
  for (const warning of report.warnings) {
    lines.push(
      `<details><summary><code>${warning.id}</code> — <code>${warning.code}</code> — ${warning.message}</summary>`,
      '',
      `- Classification: \`${warning.classification}\``,
      `- Routes: ${warning.route_ids.map((value) => `\`${value}\``).join(', ') || 'none'}`,
      `- Books: ${warning.book_ids.map((value) => `\`${value}\``).join(', ') || 'none'}`,
      `- Kits: ${warning.kit_ids.join(', ') || 'none'}`,
      `- Action: ${warning.action}`,
      '- Exact URLs:',
      ...warning.urls.map((url) => `  - ${url}`),
      '',
      '</details>',
      '',
    );
  }

  lines.push(
    '## Known limits of this automated audit',
    '',
    '- Script ratios can identify likely language anomalies but cannot establish a pedagogical language policy or reliably classify every bilingual passage.',
    '- Empty `task_examples` means only that the compact capture has no extracted example; it does not prove that the Opiq page contains no exercises.',
    '- Equal compact fields do not prove page duplication because the full copyrighted page body is intentionally not stored.',
    '- The audit validates supplied registered captures only. It does not compare them with the current live Opiq catalogue.',
    '- It does not prove official-curriculum completeness; a separate curriculum map is required.',
    '',
    'The machine-readable report with complete warning observations and archive fingerprints is `project-files/outputs/grade-2-content-quality-report.json`.',
  );
  return `${lines.join('\n').trimEnd()}\n`;
}

async function buildReport() {
  const manifestBytes = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const routes = manifest.sources.filter((source) => source.grade === 2).sort((left, right) => left.id.localeCompare(right.id));
  const hardErrors = [];
  const fail = (code, message, context = {}) => hardErrors.push({ code, message, ...context });
  if (routes.length !== expectedGrade2RouteCount) fail('route_count', `Found ${routes.length} grade-2 routes; expected ${expectedGrade2RouteCount}.`);
  const actualRouteIds = routes.map((route) => route.id).sort();
  if (JSON.stringify(actualRouteIds) !== JSON.stringify(expectedRouteIds)) {
    fail('route_inventory', `Grade-2 route IDs differ: ${actualRouteIds.join(', ')}.`);
  }

  const archives = await loadRawArchives(routes);
  const rawByUrl = groupBy(archives.flatMap((archive) => archive.records), (record) => normalizeQualityText(record.url));
  const allRecords = [];
  const qaByRoute = new Map();
  for (const route of routes) {
    let records = [];
    try {
      const markdown = await readFile(path.join(repositoryRoot, route.md_path), 'utf8');
      records = splitRecords(markdown, route);
      allRecords.push(...records);
    } catch (error) {
      fail('damaged_markdown', error.message, { route_id: route.id });
    }
    let qa = null;
    try {
      qa = await readJson(route.qa_path);
      qaByRoute.set(route.id, qa);
    } catch (error) {
      fail('invalid_qa', `${route.id}: ${error.message}`, { route_id: route.id });
    }
    if (records.length !== route.record_count) fail('manifest_markdown_count_mismatch', `${route.id}: manifest ${route.record_count}, Markdown ${records.length}.`, { route_id: route.id });
    if (qa && qa.page_records_included !== route.record_count) fail('manifest_qa_count_mismatch', `${route.id}: manifest ${route.record_count}, QA ${qa.page_records_included}.`, { route_id: route.id });

    const expectedSubject = route.canonical_subject_policy?.required_subject;
    for (const record of records) {
      if (!canonicalUrlPattern.test(record.url)) fail('invalid_url', `${route.id}: invalid canonical URL ${record.url}.`, { route_id: route.id, url: record.url });
      if (record.class !== 2) fail('wrong_grade', `${route.id}: ${record.url} has class ${record.class}.`, { route_id: route.id, url: record.url });
      if (!record.title) fail('empty_title', `${route.id}: ${record.url} has an empty title.`, { route_id: route.id, url: record.url });
      if (record.headings.length === 0) fail('missing_headings', `${route.id}: ${record.url} has no headings.`, { route_id: route.id, url: record.url });
      if (expectedSubject && JSON.stringify(record.subject) !== JSON.stringify(expectedSubject)) fail('subject_boundary', `${route.id}: ${record.url} subject differs from the canonical route policy.`, { route_id: route.id, url: record.url });
      const forbiddenIds = new Set(route.subject_boundary?.forbidden_book_ids ?? []);
      if (forbiddenIds.has(record.book_id) || forbiddenIds.has(record.source_book_id)) fail('forbidden_book_id', `${route.id}: ${record.url} uses forbidden Book ID ${record.book_id}.`, { route_id: route.id, url: record.url });
      if (record.block.includes('\ufffd')) fail('replacement_character', `${route.id}: ${record.url} contains Unicode replacement character.`, { route_id: route.id, url: record.url });
      if (forbiddenControlPattern.test(record.block)) fail('forbidden_control_character', `${route.id}: ${record.url} contains NUL or a forbidden control character.`, { route_id: route.id, url: record.url });
      if (containsUnprocessedPayload(record.block)) fail('unprocessed_json_or_html', `${route.id}: ${record.url} contains unprocessed JSON/HTML payload text.`, { route_id: route.id, url: record.url });
    }
  }

  if (allRecords.length !== expectedGrade2PageCount) fail('page_count', `Found ${allRecords.length} pages; expected ${expectedGrade2PageCount}.`);
  const urlGroups = groupBy(allRecords, (record) => record.url);
  for (const [url, records] of urlGroups) {
    if (records.length > 1) fail('duplicate_canonical_url', `${url} appears in ${records.map((record) => record.route_id).join(', ')}.`, { url, route_ids: records.map((record) => record.route_id) });
  }

  let actualBookVariantCount = 0;
  for (const route of routes) {
    const routeRecords = allRecords.filter((record) => record.route_id === route.id);
    const expectedVariants = expectedGrade2Catalog[route.id] ?? [];
    actualBookVariantCount += new Set(routeRecords.map((record) => record.book_id)).size;
    for (const [bookId, kitId, pageCount, language, programmeType, publisher] of expectedVariants) {
      const records = routeRecords.filter((record) => record.book_id === bookId);
      if (records.length !== pageCount) fail('book_variant_page_count', `${route.id}/${bookId}: ${records.length} pages; expected ${pageCount}.`, { route_id: route.id, book_id: bookId });
      if (records.some((record) => record.kit_id !== kitId)) fail('wrong_kit_identity', `${route.id}/${bookId}: expected only kit ${kitId}.`, { route_id: route.id, book_id: bookId });
      if (records.some((record) => record.language !== language)) fail('wrong_canonical_language', `${route.id}/${bookId}: expected language ${language}.`, { route_id: route.id, book_id: bookId });
      if (records.some((record) => record.programme_type !== programmeType)) fail('wrong_programme_type', `${route.id}/${bookId}: expected programme type ${programmeType}.`, { route_id: route.id, book_id: bookId });
      if (publisher && records.some((record) => record.publisher !== publisher)) fail('publisher_mismatch', `${route.id}/${bookId}: publisher differs from source-supported ${publisher}.`, { route_id: route.id, book_id: bookId });
      if (!publisher && records.some((record) => record.publisher)) fail('invented_publisher', `${route.id}/${bookId}: archive has no publisher, but canonical records contain one.`, { route_id: route.id, book_id: bookId });
    }
    const expectedBookIds = expectedVariants.map(([bookId]) => bookId).sort();
    const actualBookIds = sortedUnique(routeRecords.map((record) => record.book_id));
    if (JSON.stringify(actualBookIds) !== JSON.stringify(expectedBookIds)) fail('book_variant_inventory', `${route.id}: book inventory differs from the expected captured catalogue.`, { route_id: route.id });
    const qa = qaByRoute.get(route.id);
    const qaBookIds = qa
      ? Object.keys(qa.books ?? qa.normalized_books ?? {}).sort()
      : [];
    if (qa && JSON.stringify(qaBookIds) !== JSON.stringify(expectedBookIds)) fail('qa_book_inventory', `${route.id}: QA book inventory differs from the 42-variant catalogue.`, { route_id: route.id });
  }
  if (actualBookVariantCount !== expectedGrade2BookVariantCount) fail('book_variant_count', `Found ${actualBookVariantCount} book/kit variants; expected ${expectedGrade2BookVariantCount}.`);

  const warnings = buildWarnings(allRecords, rawByUrl);
  const warningSummary = [...groupBy(warnings, (warning) => warning.code).entries()]
    .map(([code, entries]) => ({
      code,
      groups: entries.length,
      urls: new Set(entries.flatMap((entry) => entry.urls)).size,
      classifications: sortedUnique(entries.map((entry) => entry.classification)),
    }))
    .sort((left, right) => left.code.localeCompare(right.code));

  const embeddedPayloadUrls = sortedUnique(archives.flatMap((archive) => archive.records)
    .filter((record) => record.task_examples?.some((value) => value.includes('{"d')))
    .map((record) => normalizeQualityText(record.url)))
    .filter((url) => urlGroups.has(url));
  const invisibleSpacingUrls = sortedUnique(archives.flatMap((archive) => archive.records)
    .filter((record) => record.task_examples?.some((value) => /[\u200b-\u200d\u2060\ufeff]/u.test(value)))
    .map((record) => normalizeQualityText(record.url)))
    .filter((url) => urlGroups.has(url));
  const repairRecord = (url) => {
    const record = urlGroups.get(url)?.[0];
    return { route_id: record.route_id, book_id: record.book_id, kit_id: record.kit_id, title: record.title, url };
  };

  const routeSummary = routes.map((route) => ({
    route_id: route.id,
    book_variants: expectedGrade2Catalog[route.id].length,
    pages: allRecords.filter((record) => record.route_id === route.id).length,
    warning_groups: warnings.filter((warning) => warning.route_ids.includes(route.id)).length,
  }));

  return {
    schema_version: '1.0',
    artifact_type: 'grade_2_content_quality_audit',
    scope_claim: 'Complete canonical content-quality audit of the supplied and registered grade-2 captures currently available in the repository. It is not an independently verified live Opiq catalogue or an official-curriculum completeness audit.',
    audit_basis: {
      manifest_path: 'source-manifest.json',
      manifest_sha256: sha256(manifestBytes),
      grade: 2,
      routes: routes.map((route) => ({ id: route.id, md_path: route.md_path, qa_path: route.qa_path })),
      source_archives: archives.map((archive) => ({ path: archive.path, sha256: archive.sha256 })),
      thresholds: {
        very_short_title_characters: 3,
        unusually_short_compact_record_characters: 10,
        language_script_minimum_letters: 20,
        language_script_mismatch_ratio: 0.8,
      },
    },
    summary: {
      status: hardErrors.length === 0 ? 'pass_with_classified_warnings' : 'failed',
      routes_checked: routes.length,
      book_variants_checked: actualBookVariantCount,
      page_records_checked: allRecords.length,
      qa_snapshots_checked: qaByRoute.size,
      hard_error_count: hardErrors.length,
      warning_count: warnings.length,
      suspicious_url_count: new Set(warnings.flatMap((warning) => warning.urls)).size,
      targeted_recapture_kit_detail_count: targetedRecapturePlan().kit_details_or_cover_only.length,
      targeted_recapture_page_count: targetedRecapturePlan().individual_pages.length,
      targeted_recapture_full_kit_count: 0,
    },
    route_summary: routeSummary,
    hard_errors: hardErrors,
    warning_summary: warningSummary,
    warnings,
    repairs: {
      embedded_payloads: embeddedPayloadUrls.map(repairRecord),
      invisible_spacing_controls: invisibleSpacingUrls.map(repairRecord),
      method: 'Only extractor payload suffixes and invisible spacing controls were removed. The repaired task summaries are regenerated from the same registered archive records.',
    },
    known_anomalies: knownAnomalies(),
    targeted_recapture: targetedRecapturePlan(),
    limitations: [
      'Language-script heuristics cannot prove the intended pedagogical language of bilingual pages.',
      'Missing task examples in the compact record do not prove that the Opiq page contains no tasks.',
      'Equal compact title/headings/task fields do not prove duplicate full page content.',
      'The audit covers registered supplied captures, not the current live Opiq catalogue.',
      'The audit does not establish official curriculum completeness.',
    ],
  };
}

async function main() {
  if (unknownArguments.length > 0 || (writeReports && argumentsList.includes('--check'))) {
    throw new Error('Usage: node scripts/audit-grade-2-content-quality.mjs [--write|--check]');
  }
  const report = await buildReport();
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const markdown = renderMarkdown(report);
  if (writeReports) {
    await writeFile(jsonReportPath, json, 'utf8');
    await writeFile(markdownReportPath, markdown, 'utf8');
  }
  if (checkReports) {
    const currentJson = await readFile(jsonReportPath, 'utf8').catch(() => null);
    const currentMarkdown = await readFile(markdownReportPath, 'utf8').catch(() => null);
    if (currentJson !== json) throw new Error('project-files/outputs/grade-2-content-quality-report.json is stale; run with --write.');
    if (currentMarkdown !== markdown) throw new Error('docs/audits/grade-2-content-quality.md is stale; run with --write.');
  }
  console.log(`Grade 2 quality audit ${report.summary.status}: ${report.summary.routes_checked} routes, ${report.summary.book_variants_checked} books, ${report.summary.page_records_checked} pages, ${report.summary.hard_error_count} hard errors, ${report.summary.warning_count} classified warning groups.`);
  if (report.hard_errors.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Grade 2 content-quality audit failed: ${error.message}`);
  process.exitCode = 1;
});
