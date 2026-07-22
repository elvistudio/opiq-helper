#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { readCompactZip, readZipText, requireZipMember } from './lib/compact-zip.mjs';
import {
  assertArchiveChecksum,
  assertCrossRouteUrlOwnership,
  assertDisjointPartition,
  assertExactKitScope,
  assertPublisherMatchesSource,
  assertRegisteredArchiveOwnership,
  assertUniqueCanonicalUrls,
  assertUrlPrefixesAbsent,
} from './lib/grade-2-catalog-integrity.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const manifestPath = path.join(repositoryRoot, 'source-manifest.json');
const generatorPath = 'scripts/generate-grade-2-source-indexes.mjs';
const generatorVersion = '3.0';
const checkOnly = process.argv.slice(2).includes('--check');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');
const expectedArchiveChecksums = new Map([
  ['project-files/inputs/final-zips/opiq_2klass_eesti_keele_opik_2_klassile_v2.zip', '44a048b881e36c4f28e46968f8fa1c04df1121edf8381aa45235d3173d694016'],
  ['project-files/inputs/final-zips/opiq_2klass_matemaatika_2_klassile_v2.zip', 'fa7bfc685bcb8190a215417f1e9a3977124cb1c9160d1654a75245647c085446'],
  ['project-files/inputs/final-zips/opiq_2klass_loodus_ja_inimeseopetus_2_klassile_v2.zip', '138b7836b71521c5a7ba00deab14542cb301b780836321ee3239f2991080c3f6'],
  ['project-files/inputs/final-zips/opiq_2klass_inimeseopetus_algklassidele_i_osa_2023_ok_v2.zip', '6468ad67870177c8a7428380e07cb9f4f6cc86c3c8d5ac35fe2aaab28c6cb705'],
  ['project-files/inputs/final-zips/opiq_2klass_vene_keel_v2.zip', '13e362d66437025722498e2389fe1fee41f6298133d8022b6ddd51cad055e088'],
  ['project-files/inputs/final-zips/opiq_2klass_minu_vaike_kallis_planeet_v2.zip', '6c281da5cbcee9c8f1905d52debf860fd17c1bdb46776cab26b8a3b3449c96f8'],
  ['project-files/inputs/final-zips/opiq_2klass_kasitootuba_opiq_v2.zip', '5de5260ab8b1973a4d5132dd248ec8198cf3062f9084f369442d9cf61ed110eb'],
  ['project-files/inputs/final-zips/opiq_2klass_muusikamaa_opiq_v2.zip', 'f165c57ec815a9f2b526d63557ee9c3c6f33bb66ab61bc5d2fc161d533408597'],
  ['project-files/inputs/final-zips/opiq_2klass_kodututarde_i_jark_2026_v2.zip', 'c74f484260d9e3a5504367cb89d42c456598015f3a4b40f2162b1888d8c5de5d'],
]);

const configurations = [
  {
    sourceId: 'grade-2-estonian',
    expectedSourceRecords: 454,
    expectedCanonicalRecords: 372,
    expectedCoverRecords: 9,
    expectedAdministrativeRecords: 1,
    expectedDuplicateGroups: 4,
    expectedDuplicateRecords: 5,
    expectedExcludedBookRecords: 72,
    expectedCanonicalBooks: 3,
    subject: { en: 'Estonian language', et: 'eesti keel', ru: 'эстонский язык' },
    title: '2. klass eesti keel',
    queryDescription: 'grade 2 first-language Estonian',
    pageLanguageNames: ['Estonian'],
    excludedBookIds: new Map([
      ['koolibri_koos_on_lõ_2_et', 'Koos on lõbus. Janno jutud belongs to Estonian as a second language.'],
    ]),
    bookVariants: new Map([
      ['avita_eesti_keel_2_et::232', { canonicalBookId: 'avita_eesti_keel_2_et', title: 'Eesti keele õpik 2. klassile', expectedCoverTitle: 'Eesti keele õpik 2. klassile', publisher: 'Avita', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
      ['koolibri_ilus_emake_2_et::118', { canonicalBookId: 'koolibri_ilus_emake_2_et', title: 'ILUS EMAKEEL', expectedCoverTitle: 'ILUS EMAKEEL', publisher: 'Koolibri', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
      ['koolibri_mina_loen__2_et::458', { canonicalBookId: 'koolibri_mina_loen__2_et', title: 'Mina loen ja kirjutan 2', expectedCoverTitle: 'Mina loen ja kirjutan 2', publisher: 'Koolibri', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
    ]),
    routePartition: {
      pairedSourceId: 'grade-2-estonian-second-language',
      expectedUnionRecords: 444,
    },
  },
  {
    sourceId: 'grade-2-estonian-second-language',
    expectedSourceRecords: 454,
    expectedCanonicalRecords: 72,
    expectedCoverRecords: 9,
    expectedAdministrativeRecords: 1,
    expectedDuplicateGroups: 4,
    expectedDuplicateRecords: 5,
    expectedExcludedBookRecords: 372,
    expectedCanonicalBooks: 1,
    subject: { en: 'Estonian as a second language', et: 'eesti keel teise keelena', ru: 'эстонский как второй язык' },
    title: '2. klass eesti keel teise keelena',
    queryDescription: 'grade 2 Estonian as a second language',
    pageLanguageNames: ['Estonian'],
    excludedBookIds: new Map([
      ['avita_eesti_keel_2_et', 'Eesti keele õpik 2. klassile belongs to first-language Estonian.'],
      ['koolibri_ilus_emake_2_et', 'This book belongs to first-language Estonian.'],
      ['koolibri_mina_loen__2_et', 'Mina loen ja kirjutan 2 belongs to first-language Estonian.'],
    ]),
    forbiddenTopicAliases: {
      et: ['emakeel'],
      ru: ['родной язык'],
      en: ['mother tongue'],
    },
    bookVariants: new Map([
      ['koolibri_koos_on_lõ_2_et::129', { canonicalBookId: 'koolibri_koos_on_lõ_2_et', title: 'Koos on lõbus. Janno jutud', expectedCoverTitle: 'KOOS ON LÕBUS. Janno jutud', publisher: 'Koolibri', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
    ]),
    routePartition: {
      pairedSourceId: 'grade-2-estonian',
      expectedUnionRecords: 444,
    },
  },
  {
    sourceId: 'grade-2-mathematics',
    expectedSourceRecords: 485,
    expectedCanonicalRecords: 464,
    expectedCoverRecords: 16,
    expectedAdministrativeRecords: 5,
    expectedDuplicateGroups: 8,
    expectedDuplicateRecords: 8,
    expectedExcludedBookRecords: 0,
    expectedCanonicalBooks: 8,
    subject: { en: 'mathematics', et: 'matemaatika', ru: 'математика' },
    title: '2. klass matemaatika',
    queryDescription: 'grade 2 mathematics',
    pageLanguageNames: ['Estonian', 'Russian'],
    excludedBookIds: new Map(),
    bookVariants: new Map([
      ['avita_matemaatik_2_et::95', { canonicalBookId: 'avita_matemaatik_2_et__kit95', title: 'Matemaatika 2. klassile', expectedCoverTitle: 'Matemaatika 2. klassile', publisher: 'Avita', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
      ['avita_математика_2_et::578', { canonicalBookId: 'avita_математика_2_et__kit578', title: 'Matemaatika 2. klassile', expectedCoverTitle: 'Matemaatika 2. klassile', publisher: 'Avita', language: 'ru', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail; bilingual headings retained' }],
      ['avita_математика_2_ru::165', { canonicalBookId: 'avita_математика_2_ru__kit165', title: 'Математика для 2 класса', expectedCoverTitle: 'Математика для 2 класса', publisher: 'Avita', language: 'ru', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
      ['harno_matemaatik_2_et::272', { canonicalBookId: 'harno_matemaatik_2_et__kit272', title: 'Matemaatika 2. klassile, I osa. Lihtsustatud õppekava', expectedCoverTitle: 'Matemaatika 2. klassile, I osa. Lihtsustatud õppekava', publisher: 'Harno', language: 'et', programmeType: 'simplified_curriculum', titleEvidence: 'cover_detail' }],
      ['harno_matemaatik_2_et::273', { canonicalBookId: 'harno_matemaatik_2_et__kit273', title: 'Matemaatika 2. klassile, II osa. Lihtsustatud õppekava', expectedCoverTitle: 'Matemaatika 2. klassile, II osa. Lihtsustatud õppekava', publisher: 'Harno', language: 'et', programmeType: 'simplified_curriculum', titleEvidence: 'cover_detail' }],
      ['harno_matemaatik_2_et::274', { canonicalBookId: 'harno_matemaatik_2_et__kit274', title: 'Matemaatika 2. klassile, III osa. Lihtsustatud õppekava', expectedCoverTitle: 'Matemaatika 2. klassile, III osa. Lihtsustatud õppekava', publisher: 'Harno', language: 'et', programmeType: 'simplified_curriculum', titleEvidence: 'cover_detail' }],
      ['koolibri_matemaatik_2_et::107', { canonicalBookId: 'koolibri_matemaatik_2_et__kit107', title: 'MATEMAATIKA 2. klassile', expectedCoverTitle: 'MATEMAATIKA 2. klassile', publisher: 'Koolibri', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
      ['koolibri_математика_2_et::361', { canonicalBookId: 'koolibri_математика_2_et__kit361', title: 'МАТЕМАТИКА 2 класс', expectedCoverTitle: 'МАТЕМАТИКА 2 класс', publisher: 'Koolibri', language: 'ru', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
    ]),
  },
  {
    sourceId: 'grade-2-science',
    expectedSourceRecords: 458,
    expectedCanonicalRecords: 313,
    expectedCoverRecords: 20,
    expectedAdministrativeRecords: 6,
    expectedDuplicateGroups: 10,
    expectedDuplicateRecords: 10,
    expectedExcludedBookRecords: 119,
    expectedCanonicalBooks: 8,
    additionalArchiveExpectations: new Map([
      ['project-files/inputs/final-zips/opiq_2klass_minu_vaike_kallis_planeet_v2.zip', {
        expectedSourceRecords: 30,
        expectedCanonicalRecords: 27,
        role: 'supplementary_book_capture',
        sourceBookIds: ['avita_minu_väike_2_et'],
      }],
    ]),
    subject: { en: 'science', et: 'loodusõpetus', ru: 'природоведение' },
    title: '2. klass loodusõpetus',
    queryDescription: 'grade 2 science',
    pageLanguageNames: ['Estonian', 'Russian'],
    excludedBookIds: new Map([
      ['avita_loodus-_ja_2_et', 'Mixed loodus- ja inimeseõpetus book; its Estonian pages are already routed through grade-2-human-studies.'],
      ['avita_природа_и__2_ru', 'Mixed nature-and-human-studies book; excluded to keep the science route subject-pure.'],
    ]),
    bookVariants: new Map([
      ['avita_loodusõpet_2_et::379', { canonicalBookId: 'avita_loodusõpet_2_et', title: 'Loodusõpetus 2. klassile (2022)', expectedCoverTitle: 'Loodusõpetus 2. klassile (2022)', publisher: 'Avita', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
      ['avita_minu_väike_2_et::330', { canonicalBookId: 'avita_minu_väike_2_et', title: 'Minu väike kallis planeet 2 klass', expectedCoverTitle: 'Minu väike kallis planeet', publisher: 'Avita', language: 'et', programmeType: 'supplementary', titleEvidence: 'index_json and cover_detail' }],
      ['avita_природовед_2_ru::570', { canonicalBookId: 'avita_природовед_2_ru', title: 'Природоведение для 2 класса', expectedCoverTitle: 'Loodusõpetus 2. klassile', publisher: 'Avita', language: 'ru', programmeType: 'ordinary_curriculum', titleEvidence: 'index_json; cover is Estonian' }],
      ['koolibri_loodusõpet_2_et::121', { canonicalBookId: 'koolibri_loodusõpet_2_et', title: 'Loodusõpetus 2. klassile', expectedCoverTitle: 'Loodusõpetus 2. klassile', publisher: 'Koolibri', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
      ['koolibri_природове_2_ru::132', { canonicalBookId: 'koolibri_природове_2_ru', title: 'Природоведение 2 класс', expectedCoverTitle: 'Природоведение 2 клacc', publisher: 'Koolibri', language: 'ru', programmeType: 'ordinary_curriculum', titleEvidence: 'confirmed Cyrillic/Latin typo correction' }],
      ['ministeerium_loodusõpet_2_et::501', { canonicalBookId: 'ministeerium_loodusõpet_2_et', title: 'Loodusõpetus 2. klassile. Lihtsustatud õppekava', expectedCoverTitle: 'Loodusõpetus 2. klassile. Lihtsustatud õppekava', publisher: 'Ministeerium', language: 'et', programmeType: 'simplified_curriculum', titleEvidence: 'cover_detail; publisher case normalized from index_json' }],
      ['skriibus_loodusõpet_2_et::387', { canonicalBookId: 'skriibus_loodusõpet_2_et', title: 'Loodusõpetuse tööraamat 2. klassile', expectedCoverTitle: 'Loodusõpetuse tööraamat 2. klassile', publisher: 'Skriibus', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
      ['star cloud_loodusõpet_2_et::384', { canonicalBookId: 'star cloud_loodusõpet_2_et', title: 'Loodusõpetuse õppevideod 1. kooliastmele', expectedCoverTitle: 'Loodusõpetuse õppevideod 1. kooliastmele', publisher: 'Star Cloud', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
    ]),
  },
  {
    sourceId: 'grade-2-human-studies',
    expectedSourceRecords: 262,
    expectedCanonicalRecords: 243,
    expectedCoverRecords: 14,
    expectedAdministrativeRecords: 5,
    expectedDuplicateGroups: 7,
    expectedDuplicateRecords: 7,
    expectedExcludedBookRecords: 0,
    expectedCanonicalBooks: 7,
    subject: { en: 'human studies', et: 'inimeseõpetus', ru: 'человековедение' },
    title: '2. klass inimeseõpetus',
    queryDescription: 'grade 2 human studies',
    pageLanguageNames: ['Estonian', 'Russian'],
    normalizeContentLists: true,
    excludedBookIds: new Map([
      ['avita_природа_и__2_ru', 'The Russian combined book is routed only through grade-2-nature-and-human-studies.'],
    ]),
    bookVariants: new Map([
      ['avita_inimeseõpe_2_et::449', { canonicalBookId: 'avita_inimeseõpe_2_et__kit449', title: 'Inimeseõpetus algklassidele, I osa. 2023 ÕK', expectedCoverTitle: 'Inimeseõpetus algklassidele, I osa. 2023 ÕK', publisher: 'Avita', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
      ['avita_inimeseõpe_2_et::494', { canonicalBookId: 'avita_inimeseõpe_2_et__kit494', title: 'Inimeseõpetus algklassidele, II osa. 2023 ÕK', expectedCoverTitle: 'Inimeseõpetus algklassidele, II osa. 2023 ÕK', publisher: 'Avita', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
      ['avita_inimeseõpe_2_ru::579', { canonicalBookId: 'avita_inimeseõpe_2_ru__kit579', title: 'Inimeseõpetus algklassidele. II osa', expectedCoverTitle: 'Inimeseõpetus algklassidele. II osa', publisher: 'Avita', language: 'ru', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
      ['avita_loodus-_ja_2_et::56', { canonicalBookId: 'avita_loodus-_ja_2_et__kit56', title: 'Loodus- ja inimeseõpetus 2. klassile', expectedCoverTitle: 'Loodus- ja inimeseõpetus 2. klassile', publisher: 'Avita', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
      ['harno_inimeseõpe_2_et::286', { canonicalBookId: 'harno_inimeseõpe_2_et__kit286', title: 'Inimeseõpetus 2. klassile. Lihtsustatud õppekava', expectedCoverTitle: 'Inimeseõpetus 2. klassile. Lihtsustatud õppekava', publisher: 'Harno', language: 'et', programmeType: 'simplified_curriculum', titleEvidence: 'cover_detail' }],
      ['koolibri_in2_2._kla_2_et::142', { canonicalBookId: 'koolibri_in2_2._kla_2_et__kit142', title: 'IN2. 2. klassi inimeseõpetus', expectedCoverTitle: 'IN2', publisher: 'Koolibri', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'index_json and cover_detail' }],
      ['koolibri_мой_мир._ч_2_ru::229', { canonicalBookId: 'koolibri_мой_мир._ч_2_ru__kit229', title: 'Мой мир. Человековедение 2 класс', expectedCoverTitle: 'Мой мир. Человековедение 2 класс', publisher: 'Koolibri', language: 'ru', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail; discretionary soft hyphen removed' }],
    ]),
  },
  {
    sourceId: 'grade-2-arts-and-crafts',
    expectedSourceRecords: 269,
    expectedCanonicalRecords: 263,
    expectedCoverRecords: 6,
    expectedAdministrativeRecords: 0,
    expectedDuplicateGroups: 3,
    expectedDuplicateRecords: 3,
    expectedExcludedBookRecords: 0,
    expectedOutOfScopeRecords: 0,
    expectedCanonicalBooks: 3,
    expectedDuplicateTitleGroups: undefined,
    subject: { en: 'arts and crafts', et: 'kunst ja tööõpetus', ru: 'трудовое обучение и искусство' },
    title: '2. klass kunst ja tööõpetus',
    queryDescription: 'grade 2 arts-and-crafts',
    pageLanguageNames: ['Estonian', 'Russian'],
    excludedBookIds: new Map(),
    bookVariants: new Map([
      ['kunsti-_ja_tööõpetus._2._osa::192', { canonicalBookId: 'kunsti-_ja_tööõpetus._2._osa', title: 'Kunsti- ja tööõpetus. 2. osa', expectedCoverTitle: 'Käsitöötuba', publisher: '', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail; publisher absent from archive' }],
      ['kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid::200', { canonicalBookId: 'kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid', title: 'Kunsti- ja tööõpetus. 4. osa. Tähtpäevakaardid', expectedCoverTitle: 'Käsitöötuba', publisher: '', language: 'et', programmeType: 'supplementary', titleEvidence: 'cover_detail; publisher absent from archive' }],
      ['трудовое_обучение_и_искусство._2_часть::371', { canonicalBookId: 'трудовое_обучение_и_искусство._2_часть', title: 'Трудовое обучение и искусство. 2 часть', expectedCoverTitle: 'Творческая мастерская', publisher: '', language: 'ru', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail; publisher absent from archive' }],
    ]),
    metadataLimitations: [
      'The export does not record publisher names.',
      'Raw per-book files misstate the two Estonian book languages; compact index and record-level language evidence are authoritative.',
      'The holiday-card collection is supplementary and must be labelled.',
    ],
  },
  {
    sourceId: 'grade-2-music',
    expectedSourceRecords: 329,
    expectedCanonicalRecords: 317,
    expectedCoverRecords: 10,
    expectedAdministrativeRecords: 2,
    expectedDuplicateGroups: 5,
    expectedDuplicateRecords: 5,
    expectedExcludedBookRecords: 0,
    expectedOutOfScopeRecords: 0,
    expectedCanonicalBooks: 5,
    expectedDuplicateTitleGroups: 31,
    expectedDuplicateTitleRecords: 65,
    subject: { en: 'music', et: 'muusika', ru: 'музыка' },
    title: '2. klass muusika',
    queryDescription: 'grade 2 music',
    pageLanguageNames: ['Estonian', 'Russian'],
    excludedBookIds: new Map(),
    bookVariants: new Map([
      ['2._klassi_muusikaõpetus::188', { canonicalBookId: '2._klassi_muusikaõpetus', title: 'Muusikamaa', expectedCoverTitle: 'Muusikamaa', publisher: '', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail; publisher absent from archive' }],
      ['eesti_pärimusmuusika_keskuse_õppevideod::465', { canonicalBookId: 'eesti_pärimusmuusika_keskuse_õppevideod', title: 'Eesti Pärimusmuusika Keskuse õppevideod', expectedCoverTitle: 'Eesti Pärimusmuusika Keskuse õppevideod', publisher: '', language: 'et', programmeType: 'supplementary', titleEvidence: 'cover_detail; publisher absent from archive' }],
      ['muusikaõpik_2._klassile::193', { canonicalBookId: 'muusikaõpik_2._klassile', title: 'Muusikaõpik 2. klassile', expectedCoverTitle: 'Muusikaõpik 2. klassile', publisher: '', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail; publisher absent from archive' }],
      ['muusikaõpik_2._klassile_2024::556', { canonicalBookId: 'muusikaõpik_2._klassile_2024', title: 'Muusikaõpik 2. klassile 2024', expectedCoverTitle: 'Muusikaõpik 2. klassile 2024', publisher: '', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail; publisher absent from archive' }],
      ['музыка_–_волшебная_страна._2_класс::238', { canonicalBookId: 'музыка_–_волшебная_страна._2_класс', title: 'Музыка – волшебная страна. 2 класс', expectedCoverTitle: 'Музыка – волшебная страна. 2 класс', publisher: '', language: 'ru', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail; publisher absent from archive' }],
    ]),
    metadataLimitations: [
      'The export does not record publisher names.',
      'Repeated page titles remain separate because distinct canonical URLs and instructional contexts are not duplicates.',
      'The heritage-music video collection is supplementary and must be labelled.',
    ],
  },
  {
    sourceId: 'grade-2-kodututarde-training',
    expectedSourceRecords: 155,
    expectedCanonicalRecords: 31,
    expectedCoverRecords: 12,
    expectedAdministrativeRecords: 0,
    expectedDuplicateGroups: 38,
    expectedDuplicateRecords: 42,
    expectedExcludedBookRecords: 0,
    expectedOutOfScopeRecords: 102,
    expectedCanonicalBooks: 1,
    subject: { en: 'Kodututred training', et: 'Kodutütarde väljaõpe', ru: 'подготовка Kodututred' },
    title: '2. klass Kodutütarde väljaõpe',
    queryDescription: 'grade 2 Kodututred training',
    pageLanguageNames: ['Estonian'],
    includedKitIds: new Set(['593']),
    deduplicateCanonicalUrls: true,
    allowInstructionalDuplicates: true,
    excludedBookIds: new Map(),
    bookVariants: new Map([
      ['kaitseliit_kodutütard_2_et::593', { canonicalBookId: 'kodutütarde_i_järk_(2026)', title: 'Kodutütarde I järk (2026)', expectedCoverTitle: 'Kodutütarde I järk (2026)', publisher: 'Kaitseliit', language: 'et', programmeType: 'supplementary', titleEvidence: 'cover_detail and duplicate content audit' }],
      ['kodutütarde_i_järk_(2026)::593', { canonicalBookId: 'kodutütarde_i_järk_(2026)', title: 'Kodutütarde I järk (2026)', expectedCoverTitle: 'Kodutütarde I järk (2026)', publisher: 'Kaitseliit', language: 'et', programmeType: 'supplementary', titleEvidence: 'cover_detail and duplicate content audit' }],
    ]),
    metadataLimitations: [
      'Ten instructional URLs are repeated under two source Book IDs; identical records are deduplicated by URL.',
      'Three Estonian pages are automatically labelled English and normalized from book and page evidence.',
      'This is supplementary youth-organisation training, not ordinary school curriculum.',
    ],
  },
  {
    sourceId: 'grade-2-noorte-kotkaste-training',
    expectedSourceRecords: 155,
    expectedCanonicalRecords: 27,
    expectedCoverRecords: 12,
    expectedAdministrativeRecords: 0,
    expectedDuplicateGroups: 38,
    expectedDuplicateRecords: 42,
    expectedExcludedBookRecords: 0,
    expectedOutOfScopeRecords: 116,
    expectedCanonicalBooks: 1,
    subject: { en: 'Young Eagles training', et: 'Noorte Kotkaste väljaõpe', ru: 'подготовка Noorte Kotkad' },
    title: '2. klass Noorte Kotkaste väljaõpe',
    queryDescription: 'grade 2 Young Eagles training',
    pageLanguageNames: ['Estonian'],
    includedKitIds: new Set(['594']),
    deduplicateCanonicalUrls: true,
    allowInstructionalDuplicates: true,
    excludedBookIds: new Map(),
    bookVariants: new Map([
      ['kaitseliit_noorte_kot_2_et::594', { canonicalBookId: 'kaitseliit_noorte_kot_2_et', title: 'Noorte Kotkaste I järk (2026)', expectedCoverTitle: 'Noorte Kotkaste I järk (2026)', publisher: 'Kaitseliit', language: 'et', programmeType: 'supplementary', titleEvidence: 'cover_detail' }],
    ]),
    metadataLimitations: [
      'Three Estonian pages are automatically labelled English and normalized from book and page evidence.',
      'This is supplementary youth-organisation training, not ordinary school curriculum.',
    ],
  },
  {
    sourceId: 'grade-2-nature-and-human-studies',
    expectedSourceRecords: 428,
    expectedCanonicalRecords: 60,
    expectedCoverRecords: 18,
    expectedAdministrativeRecords: 5,
    expectedDuplicateGroups: 9,
    expectedDuplicateRecords: 9,
    expectedExcludedBookRecords: 0,
    expectedOutOfScopeRecords: 345,
    expectedCanonicalBooks: 1,
    subject: { en: 'science and human studies', et: 'loodus- ja inimeseõpetus', ru: 'природа и человек' },
    title: '2. klass loodus- ja inimeseõpetus',
    queryDescription: 'grade 2 combined Russian nature-and-human-studies',
    pageLanguageNames: ['Russian'],
    includedKitIds: new Set(['86']),
    requireManifestSourceScope: true,
    excludedBookIds: new Map(),
    bookVariants: new Map([
      ['avita_природа_и__2_ru::86', { canonicalBookId: 'avita_природа_и__2_ru__kit86', title: 'Природа и человек для 2 класса', expectedCoverTitle: 'Природа и человек для 2 класса', publisher: 'Avita', language: 'ru', programmeType: 'mixed_subject', titleEvidence: 'cover_detail' }],
    ]),
    metadataLimitations: [
      'The archive does not provide reliable page-level evidence for splitting this combined book into subject-pure routes.',
      'The dedicated route is mixed-subject and does not claim official curriculum completeness.',
    ],
  },
];

const gradeOneRelocations = [
  {
    sourceId: 'grade-1-estonian',
    expectedRecordsBefore: 496,
    expectedRecordsAfter: 468,
    expectedRemovedRecords: 28,
  },
  {
    sourceId: 'grade-1-science',
    expectedRecordsBefore: 472,
    expectedRecordsAfter: 443,
    expectedRemovedRecords: 29,
  },
];
const relocatedKitUrlPrefixes = [
  'https://www.opiq.ee/kit/330/',
  'https://www.opiq.ee/Kit/Details/330',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function splitMarkdownDocument(markdown) {
  const numberedStarts = [...markdown.matchAll(/^###\s+\d+\.\s+.+$/gmu)];
  const compactStarts = [...markdown.matchAll(/^##\s+.+$/gmu)];
  const normalized = numberedStarts.length > 0;
  const starts = normalized ? numberedStarts : compactStarts;
  assert(starts.length > 0, 'Legacy Markdown has no recognizable records.');
  return {
    normalized,
    prefix: markdown.slice(0, starts[0].index).trimEnd(),
    blocks: starts.map((match, index) => markdown.slice(
      match.index,
      index + 1 < starts.length ? starts[index + 1].index : markdown.length,
    ).trim()),
  };
}

function markdownRecordUrl(block) {
  return block.match(/^(?:-\s+)?URL:\s+(https?:\/\/\S+)\s*$/miu)?.[1] ?? '';
}

function renderMarkdownDocument(document, blocks) {
  const renderedBlocks = blocks.map((block, index) => document.normalized
    ? block.replace(/^###\s+\d+\.\s+/u, `### ${index + 1}. `)
    : block);
  return `${document.prefix ? `${document.prefix}\n\n` : ''}${renderedBlocks.join('\n\n')}\n`;
}

async function updateGradeOneEstonianQa(manifest, markdown) {
  const source = manifest.sources.find((entry) => entry.id === 'grade-1-estonian');
  assert(source?.qa_path, 'grade-1-estonian QA path is required.');
  const qaPath = repositoryPath(source.qa_path, 'grade-1-estonian QA path');
  const qa = parseJson(await readFile(qaPath, 'utf8'), source.qa_path);
  qa.checksums.output_file_sha256 = sha256(Buffer.from(markdown, 'utf8'));
  qa.page_records_included = 468;
  qa.administrative_records_excluded = 2;
  qa.grade_boundary_records_excluded = 27;
  qa.grades = { 1: 468 };
  qa.languages = { et: 468 };
  delete qa.books['1k_minu_vaike_kallis_planeet_est'];
  qa.grade_boundary_audit = {
    report: 'docs/audits/grade-2-minu-vaike-kallis-planeet.md',
    source_book_id: '1k_minu_vaike_kallis_planeet_est',
    canonical_book_id: 'avita_minu_väike_2_et',
    source_kit: '330',
    records_removed: 28,
    instructional_records_reassigned: 27,
    administrative_records_removed: 1,
    canonical_destination: 'grade-2-science',
  };
  assert(
    qa.page_records_included
      + qa.cover_detail_records_excluded
      + qa.subject_boundary_records_excluded
      + qa.administrative_records_excluded
      + qa.grade_boundary_records_excluded === qa.source_records,
    'grade-1-estonian QA source record accounting is incomplete.',
  );
  const qaContents = `${JSON.stringify(qa, null, 2)}\n`;
  const currentQa = await readFile(qaPath, 'utf8');
  if (checkOnly) {
    assert(currentQa === qaContents, `${source.qa_path} is stale; run ${generatorPath} without --check.`);
  } else if (currentQa !== qaContents) {
    await writeFile(qaPath, qaContents, 'utf8');
  }
}

async function relocateLegacyGradeOneRecords(manifest) {
  for (const relocation of gradeOneRelocations) {
    const source = manifest.sources.find((entry) => entry.id === relocation.sourceId);
    assert(source, `Manifest source ${relocation.sourceId} was not found.`);
    assert(source.record_count === relocation.expectedRecordsAfter, `${relocation.sourceId}: manifest record_count must be ${relocation.expectedRecordsAfter}.`);
    assert(
      JSON.stringify(source.routing_boundary?.forbidden_url_prefixes) === JSON.stringify(relocatedKitUrlPrefixes),
      `${relocation.sourceId}: routing boundary must forbid both kit 330 URL forms.`,
    );
    const markdownPath = repositoryPath(source.md_path, `${relocation.sourceId} Markdown path`);
    const current = await readFile(markdownPath, 'utf8');
    const document = splitMarkdownDocument(current);
    assert(
      [relocation.expectedRecordsBefore, relocation.expectedRecordsAfter].includes(document.blocks.length),
      `${relocation.sourceId}: found ${document.blocks.length} legacy records; expected ${relocation.expectedRecordsBefore} before or ${relocation.expectedRecordsAfter} after relocation.`,
    );
    const removed = document.blocks.filter((block) => relocatedKitUrlPrefixes.some(
      (prefix) => markdownRecordUrl(block).startsWith(prefix),
    ));
    assert(
      removed.length === 0 || removed.length === relocation.expectedRemovedRecords,
      `${relocation.sourceId}: found ${removed.length} kit 330 records; expected 0 or ${relocation.expectedRemovedRecords}.`,
    );
    const retained = document.blocks.filter((block) => !removed.includes(block));
    assert(retained.length === relocation.expectedRecordsAfter, `${relocation.sourceId}: relocation leaves ${retained.length} records; expected ${relocation.expectedRecordsAfter}.`);
    assertUrlPrefixesAbsent(
      relocation.sourceId,
      retained.map((block) => ({ url: markdownRecordUrl(block) })),
      relocatedKitUrlPrefixes,
    );
    const rendered = renderMarkdownDocument(document, retained);
    if (checkOnly) {
      assert(current === rendered, `${source.md_path} still contains grade-2 kit 330 records or stale numbering.`);
    } else if (current !== rendered) {
      await writeFile(markdownPath, rendered, 'utf8');
    }
    if (relocation.sourceId === 'grade-1-estonian') {
      await updateGradeOneEstonianQa(manifest, rendered);
    }
    console.log(`${relocation.sourceId} relocation ${checkOnly ? 'check passed' : 'complete'}: ${relocation.expectedRecordsAfter} records, no kit 330 URLs.`);
  }
}

async function validateRelocatedUrlOwnership(manifest, scienceRecords) {
  const relocatedRecords = scienceRecords.filter((record) => record.source_book_id === 'avita_minu_väike_2_et');
  assert(relocatedRecords.length === 27, `grade-2-science: expected 27 relocated kit 330 instructional pages; found ${relocatedRecords.length}.`);
  const relocatedUrls = new Set(relocatedRecords.map((record) => record.url));
  for (const source of manifest.sources) {
    if (source.id === 'grade-2-science') continue;
    const markdown = await readFile(repositoryPath(source.md_path, `${source.id} Markdown path`), 'utf8');
    const routeUrls = new Set([...markdown.matchAll(/^(?:-\s+)?URL:\s+(https?:\/\/\S+)\s*$/gmiu)].map((match) => match[1]));
    const overlap = [...relocatedUrls].filter((url) => routeUrls.has(url));
    assert(overlap.length === 0, `${source.id}: relocated grade-2 kit 330 URL remains canonical in another route: ${overlap[0]}.`);
  }
  console.log('Grade 2 kit 330 ownership passed: 27 canonical pages, 0 URLs in other manifest routes.');
}

function repositoryPath(relativePath, label) {
  assert(typeof relativePath === 'string' && relativePath.trim(), `${label} must be a non-empty path.`);
  assert(!path.isAbsolute(relativePath), `${label} must be repository-relative.`);
  assert(!relativePath.includes('\\') && !relativePath.split('/').includes('..'), `${label} must be a safe POSIX path.`);
  const absolute = path.resolve(repositoryRoot, relativePath);
  assert(absolute !== repositoryRoot && absolute.startsWith(`${repositoryRoot}${path.sep}`), `${label} points outside the repository.`);
  return absolute;
}

async function requireFile(relativePath, label) {
  const absolute = repositoryPath(relativePath, label);
  const fileStat = await stat(absolute).catch(() => null);
  assert(fileStat?.isFile(), `${label} is missing: ${relativePath}`);
  return absolute;
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is invalid JSON: ${error.message}`);
  }
}

function parseJsonl(text, label) {
  return text.split(/\r?\n/u).filter((line) => line.trim()).map((line, index) => {
    const record = parseJson(line, `${label} line ${index + 1}`);
    assert(isPlainObject(record), `${label} line ${index + 1} must be an object.`);
    for (const field of [
      'title', 'url', 'book', 'book_id', 'chapter_id', 'grade', 'subject_et', 'subject_ru',
      'subject_en', 'language', 'publisher', 'topics_et', 'topics_ru', 'topics_en', 'headings',
      'task_examples',
    ]) assert(Object.hasOwn(record, field), `${label} line ${index + 1} is missing ${field}.`);
    assert(/^https:\/\/(?:www\.)?opiq\.ee\//iu.test(record.url), `${label} line ${index + 1} has an invalid Opiq URL.`);
    assert(record.grade === 2, `${label} line ${index + 1} has grade ${record.grade}; expected 2.`);
    assert(['et', 'ru', 'en'].includes(record.language), `${label} line ${index + 1} has unsupported page language ${record.language}.`);
    for (const field of ['topics_et', 'topics_ru', 'topics_en', 'headings', 'task_examples']) {
      assert(Array.isArray(record[field]), `${label} line ${index + 1} field ${field} must be an array.`);
    }
    return { ...record, source_position: index + 1 };
  });
}

async function loadRegisteredArchive(source, configuration, registration, expectedSourceRecords) {
  const archivePath = await requireFile(registration.path, `${configuration.sourceId} source archive`);
  const archiveBytes = await readFile(archivePath);
  const expectedChecksum = expectedArchiveChecksums.get(registration.path);
  assertArchiveChecksum(registration.path, archiveBytes, expectedChecksum);
  const archive = await readCompactZip(archivePath);
  for (const member of ['index.json', 'opiq_lookup.jsonl', 'opiq_lookup.md', 'topic_map.json']) {
    requireZipMember(archive, member);
  }
  const index = parseJson(
    readZipText(archive, 'index.json'),
    `${configuration.sourceId} ${registration.path} index.json`,
  );
  const records = parseJsonl(
    readZipText(archive, 'opiq_lookup.jsonl'),
    `${configuration.sourceId} ${registration.path} opiq_lookup.jsonl`,
  ).map((record) => ({ ...record, source_archive_path: registration.path }));
  assert(index.formatVersion === source.format_version, `${configuration.sourceId}: ${registration.path} format version differs from manifest.`);
  assert(index.recordCount === records.length, `${configuration.sourceId}: ${registration.path} index count differs from JSONL.`);
  assert(index.recordCount === expectedSourceRecords, `${configuration.sourceId}: ${registration.path} source record count changed.`);
  assert(index.rawArchiveIncluded === true, `${configuration.sourceId}: ${registration.path} must contain raw source data.`);
  assert(isPlainObject(parseJson(readZipText(archive, 'topic_map.json'), `${configuration.sourceId} ${registration.path} topic_map.json`)), `${configuration.sourceId}: ${registration.path} topic map root must be an object.`);
  assert(readZipText(archive, 'opiq_lookup.md').trim(), `${configuration.sourceId}: ${registration.path} compact Markdown is empty.`);
  assert(typeof index.generatedAt === 'string' && index.generatedAt, `${configuration.sourceId}: ${registration.path} index has no generatedAt value.`);

  const indexedBookIds = new Set((index.books ?? []).map((book) => normalizeText(book.id)));
  const recordBookIds = [...new Set(records.map((record) => normalizeText(record.book_id)))].sort();
  for (const bookId of recordBookIds) {
    assert(indexedBookIds.has(bookId), `${configuration.sourceId}: record Book ID ${bookId} is absent from ${registration.path} index.json.`);
  }
  if (registration.sourceBookIds) {
    assert(
      JSON.stringify(recordBookIds) === JSON.stringify([...registration.sourceBookIds].sort()),
      `${configuration.sourceId}: ${registration.path} contains source Book IDs ${recordBookIds.join(', ')}; expected ${registration.sourceBookIds.join(', ')}.`,
    );
  }

  return {
    ...registration,
    archivePath,
    archiveBytes,
    index,
    records,
    sourceBookIds: recordBookIds,
  };
}

function normalizeText(value) {
  return String(value ?? '').replaceAll('\u00ad', '').normalize('NFC').replace(/[\s\u00a0]+/gu, ' ').trim();
}

function normalizeTextList(values) {
  return [...new Set(values
    .map((value) => normalizeText(value).replace(/[\u200b-\u200d\u2060\ufeff]/gu, '').trim())
    .filter(Boolean))];
}

function sourceSubject(record) {
  return `${record.subject_en} / ${record.subject_et} / ${record.subject_ru}`;
}

function canonicalSubject(subject) {
  return `${subject.en} / ${subject.et} / ${subject.ru}`;
}

function markdownField(label, value) {
  const text = String(value ?? '');
  return `- ${label}:${text ? ` ${text}` : ''}`;
}

function kitId(url) {
  return url.match(/\/kit\/(\d+)/iu)?.[1] ?? url.match(/\/Kit\/Details\/(\d+)/u)?.[1] ?? '';
}

function bookVariantKey(record) {
  return `${normalizeText(record.book_id)}::${kitId(record.url)}`;
}

function coverTitle(record) {
  return normalizeText(record.title).replace(/\s+[–-]\s+Opiq$/iu, '');
}

function isCoverDetail(record) {
  return /\/Kit\/Details\//iu.test(record.url);
}

function isAdministrative(record) {
  return /impressum|импрессум/iu.test([record.title, ...record.headings].join(' '));
}

function countBy(records, selector) {
  const counts = new Map();
  for (const record of records) {
    const key = String(selector(record));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...counts].sort(([left], [right]) => left.localeCompare(right)));
}

function groupBy(records, selector) {
  const groups = new Map();
  for (const record of records) {
    const key = selector(record);
    const values = groups.get(key) ?? [];
    values.push(record);
    groups.set(key, values);
  }
  return groups;
}

function normalizeTopicList(values, forbiddenAliases, requiredAlias) {
  const forbidden = new Set(forbiddenAliases.map((value) => value.toLocaleLowerCase()));
  const retained = values.map(normalizeText).filter(Boolean).filter((value) => !forbidden.has(value.toLocaleLowerCase()));
  return [requiredAlias, ...retained.filter((value) => value.toLocaleLowerCase() !== requiredAlias.toLocaleLowerCase())];
}

function normalizeRecord(record, configuration) {
  const sourceBookId = normalizeText(record.book_id);
  const variant = configuration.bookVariants.get(bookVariantKey(record));
  assert(variant, `${configuration.sourceId}: no canonical book variant for ${bookVariantKey(record)} (${record.url}).`);
  const normalized = {
    ...record,
    title: normalizeText(record.title),
    url: normalizeText(record.url),
    book: variant.title,
    book_id: variant.canonicalBookId,
    source_book_id: sourceBookId,
    chapter_id: normalizeText(record.chapter_id),
    language: variant.language,
    publisher: variant.publisher,
    programme_type: variant.programmeType,
    headings: configuration.normalizeContentLists
      ? normalizeTextList(record.headings)
      : record.headings.map(normalizeText).filter(Boolean),
    task_examples: configuration.normalizeContentLists
      ? normalizeTextList(record.task_examples)
      : record.task_examples.map(normalizeText).filter(Boolean),
  };
  normalized.subject_en = configuration.subject.en;
  normalized.subject_et = configuration.subject.et;
  normalized.subject_ru = configuration.subject.ru;
  normalized.topics_et = normalizeTopicList(record.topics_et, [
    'matemaatika', 'loodusõpetus', 'inimeseõpetus', 'eesti keel', 'eesti keel teise keelena',
    ...(configuration.forbiddenTopicAliases?.et ?? []),
  ], configuration.subject.et);
  normalized.topics_ru = normalizeTopicList(record.topics_ru, [
    'математика', 'природоведение', 'человековедение', 'эстонский язык', 'эстонский как второй язык',
    ...(configuration.forbiddenTopicAliases?.ru ?? []),
  ], configuration.subject.ru);
  normalized.topics_en = normalizeTopicList(record.topics_en, [
    'mathematics', 'science', 'human studies', 'Estonian language', 'Estonian as a second language',
    ...(configuration.forbiddenTopicAliases?.en ?? []),
  ], configuration.subject.en);
  return normalized;
}

function validateBookVariantEvidence(records, configuration) {
  const coverRecords = records.filter(isCoverDetail);
  for (const [key, variant] of configuration.bookVariants) {
    const matches = coverRecords.filter((record) => bookVariantKey(record) === key);
    assert(matches.length > 0, `${configuration.sourceId}: canonical variant ${key} has no cover/detail evidence.`);
    const foundTitles = [...new Set(matches.map(coverTitle))];
    assert(
      foundTitles.length === 1 && foundTitles[0].toLocaleLowerCase() === variant.expectedCoverTitle.toLocaleLowerCase(),
      `${configuration.sourceId}: cover title for ${key} is ${JSON.stringify(foundTitles)}; expected ${JSON.stringify(variant.expectedCoverTitle)}.`,
    );
    assert(variant.canonicalBookId && variant.title && Object.hasOwn(variant, 'publisher') && variant.language && variant.programmeType,
      `${configuration.sourceId}: canonical variant ${key} is incomplete.`);
    const sourcePublishers = matches.map((record) => {
      const publisher = normalizeText(record.publisher);
      const normalizedPublishers = new Map([
        ['avita', 'Avita'],
        ['harno', 'Harno'],
        ['ministeerium', 'Ministeerium'],
      ]);
      return normalizedPublishers.get(publisher.toLocaleLowerCase()) ?? publisher;
    });
    assertPublisherMatchesSource(configuration.sourceId, key, variant.publisher, sourcePublishers);
  }
}

function auditDuplicateUrls(records, configuration) {
  const duplicateGroups = [...groupBy(records, (record) => record.url).entries()].filter(([, matches]) => matches.length > 1);
  assert(duplicateGroups.length === configuration.expectedDuplicateGroups, `${configuration.sourceId}: duplicate URL group count changed.`);
  const duplicateRecords = duplicateGroups.reduce((total, [, matches]) => total + matches.length - 1, 0);
  assert(duplicateRecords === configuration.expectedDuplicateRecords, `${configuration.sourceId}: duplicate record count changed.`);
  const entries = duplicateGroups.map(([url, matches]) => {
    const coverDetail = matches.every(isCoverDetail);
    if (!coverDetail) {
      assert(configuration.allowInstructionalDuplicates === true, `${configuration.sourceId}: non-cover duplicate requires manual review: ${url}`);
      assert(matches.every((record) => !isCoverDetail(record)), `${configuration.sourceId}: duplicate ${url} mixes cover and instructional records.`);
      const comparable = (record) => JSON.stringify({
        title: normalizeText(record.title),
        url: normalizeText(record.url),
        chapter_id: normalizeText(record.chapter_id),
        language: normalizeText(record.language),
        headings: record.headings.map(normalizeText),
        task_examples: record.task_examples.map(normalizeText),
      });
      assert(new Set(matches.map(comparable)).size === 1, `${configuration.sourceId}: duplicate instructional records differ in content: ${url}`);
    }
    return {
      url,
      source_positions: matches.map((record) => record.source_position),
      book_ids: [...new Set(matches.map((record) => normalizeText(record.book_id)))],
      chapter_ids: matches.map((record) => normalizeText(record.chapter_id)),
      decision: coverDetail ? 'exclude_all_cover_detail_records' : 'retain_one_identical_instructional_record',
      reason: coverDetail
        ? 'The repeated URL is a kit detail page, not a chapter-level instructional page.'
        : 'The same canonical chapter was exported under multiple source Book IDs; one normalized record is sufficient.',
    };
  });
  return { duplicateGroups, duplicateRecords, entries };
}

function auditDuplicateTitles(records, configuration) {
  if (configuration.expectedDuplicateTitleGroups === undefined) return null;
  const groups = [...groupBy(records, (record) => record.title).entries()]
    .filter(([, matches]) => matches.length > 1)
    .sort(([left], [right]) => left.localeCompare(right));
  const recordCount = groups.reduce((total, [, matches]) => total + matches.length, 0);
  assert(groups.length === configuration.expectedDuplicateTitleGroups, `${configuration.sourceId}: repeated canonical title group count changed.`);
  assert(recordCount === configuration.expectedDuplicateTitleRecords, `${configuration.sourceId}: repeated canonical title record count changed.`);
  return {
    groups: groups.length,
    records: recordCount,
    entries: groups.map(([title, matches]) => ({
      title,
      urls: matches.map((record) => record.url),
      book_ids: [...new Set(matches.map((record) => record.book_id))],
      languages: [...new Set(matches.map((record) => record.language))].sort(),
      decision: 'retain_distinct_canonical_chapters',
      reason: 'Equal titles do not prove duplicate instructional content; canonical URLs and chapter contexts differ.',
    })),
  };
}

function canonicalize(records, configuration) {
  const coverRecords = records.filter(isCoverDetail);
  const administrativeRecords = records.filter((record) => !isCoverDetail(record) && isAdministrative(record));
  const excludedBookRecords = records.filter((record) => !isCoverDetail(record)
    && !isAdministrative(record) && configuration.excludedBookIds.has(normalizeText(record.book_id)));
  const outOfScopeRecords = records.filter((record) => !isCoverDetail(record)
    && !isAdministrative(record)
    && !configuration.excludedBookIds.has(normalizeText(record.book_id))
    && configuration.includedKitIds
    && !configuration.includedKitIds.has(kitId(record.url)));
  const candidates = records.filter((record) => !isCoverDetail(record)
    && !isAdministrative(record)
    && !configuration.excludedBookIds.has(normalizeText(record.book_id))
    && (!configuration.includedKitIds || configuration.includedKitIds.has(kitId(record.url))));
  const subjectNormalizationAudit = [];
  const canonicalRecords = candidates.map((record) => {
    const normalized = normalizeRecord(record, configuration);
    if (sourceSubject(record) !== canonicalSubject(configuration.subject)) {
      subjectNormalizationAudit.push({
        source_position: record.source_position,
        url: record.url,
        book_id: normalizeText(record.book_id),
        source_subject: sourceSubject(record),
        canonical_subject: canonicalSubject(configuration.subject),
        decision: 'correct_automatic_subject_label',
      });
    }
    return normalized;
  });
  const deduplicatedRecords = configuration.deduplicateCanonicalUrls
    ? [...groupBy(canonicalRecords, (record) => record.url).values()].map((matches) => matches[0])
    : canonicalRecords;
  assertUniqueCanonicalUrls(configuration.sourceId, deduplicatedRecords);
  if (configuration.includedKitIds) {
    assertExactKitScope(configuration.sourceId, deduplicatedRecords, configuration.includedKitIds, (record) => kitId(record.url));
  }
  assert(deduplicatedRecords.length === configuration.expectedCanonicalRecords, `${configuration.sourceId}: canonical count is ${deduplicatedRecords.length}; expected ${configuration.expectedCanonicalRecords}.`);
  assert(coverRecords.length === configuration.expectedCoverRecords, `${configuration.sourceId}: cover count changed.`);
  assert(administrativeRecords.length === configuration.expectedAdministrativeRecords, `${configuration.sourceId}: administrative count changed.`);
  assert(excludedBookRecords.length === configuration.expectedExcludedBookRecords, `${configuration.sourceId}: subject-boundary exclusion count changed.`);
  assert(outOfScopeRecords.length === (configuration.expectedOutOfScopeRecords ?? 0), `${configuration.sourceId}: out-of-scope instructional count changed.`);
  assert(new Set(deduplicatedRecords.map((record) => record.book_id)).size === configuration.expectedCanonicalBooks, `${configuration.sourceId}: canonical book count changed.`);
  assert(canonicalRecords.length + coverRecords.length + administrativeRecords.length + excludedBookRecords.length + outOfScopeRecords.length === records.length,
    `${configuration.sourceId}: source record accounting is incomplete.`);
  assert(deduplicatedRecords.every((record) => sourceSubject(record) === canonicalSubject(configuration.subject)), `${configuration.sourceId}: canonical subject normalization failed.`);
  return { canonicalRecords: deduplicatedRecords, coverRecords, administrativeRecords, excludedBookRecords, outOfScopeRecords, subjectNormalizationAudit };
}

function renderMarkdown(configuration, source, archiveSources, state, duplicateAudit) {
  const { canonicalRecords, coverRecords, administrativeRecords, excludedBookRecords, outOfScopeRecords } = state;
  const sourceRecordCount = archiveSources.reduce((total, archiveSource) => total + archiveSource.records.length, 0);
  const bookGroups = [...groupBy(canonicalRecords, (record) => record.book_id).entries()]
    .sort(([left], [right]) => left.localeCompare(right));
  const lines = [
    `# Opiq lookup: ${configuration.title}`,
    '',
    `Use this file to answer ${configuration.queryDescription} requests only. Match queries against titles, topics, headings, task examples, books, and subject fields. Return direct Opiq page links.`,
    '',
    '## Source Summary',
    `- Source archive: \`${source.source_archive}\``,
    ...archiveSources.slice(1).map((archiveSource) => `- Additional source archive: \`${archiveSource.path}\` (${archiveSource.role})`),
    `- Format version: ${source.format_version}`,
    '- Class: 2',
    `- Subject ET: ${configuration.subject.et}`,
    `- Subject RU: ${configuration.subject.ru}`,
    `- Subject EN: ${configuration.subject.en}`,
    `- Page languages: ${configuration.pageLanguageNames.join(', ')}`,
    `- Source records: ${sourceRecordCount}`,
    `- Page records included: ${canonicalRecords.length}`,
    `- Cover/detail records excluded: ${coverRecords.length}`,
    `- Administrative records excluded: ${administrativeRecords.length}`,
    `- Duplicate source URL groups: ${duplicateAudit.duplicateGroups.length}; canonical duplicates are removed only after exact content checks`,
    `- Subject-boundary page records excluded: ${excludedBookRecords.length}`,
    `- Out-of-scope instructional records excluded: ${outOfScopeRecords.length}`,
    '- Curriculum coverage: not verified',
    '',
    '## Books',
  ];
  for (const [bookId, records] of bookGroups) {
    const first = records[0];
    const kits = [...new Set(records.map((record) => kitId(record.url)))].sort().join(', ');
    const programme = first.programme_type === 'simplified_curriculum'
      ? 'simplified curriculum; use only with explicit labelling'
      : first.programme_type === 'supplementary'
        ? 'supplementary material; do not treat as the ordinary core without explicit labelling'
        : first.programme_type === 'mixed_subject'
          ? 'mixed-subject source; use only through this dedicated route'
          : 'ordinary curriculum';
    lines.push(`- \`${bookId}\` — ${first.book}; Source Book ID \`${first.source_book_id}\`; ${first.publisher || 'publisher not recorded'}; language ${first.language}; kit ${kits}; ${records.length} pages; ${programme}.`);
  }
  if (configuration.excludedBookIds.size > 0) {
    lines.push('', '## Subject-boundary exclusions');
    for (const [bookId, reason] of configuration.excludedBookIds) {
      const count = excludedBookRecords.filter((record) => normalizeText(record.book_id) === bookId).length;
      lines.push(`- \`${bookId}\`: ${count} instructional pages excluded. ${reason}`);
    }
  }
  lines.push('', '## Pages', '');
  canonicalRecords.forEach((record, indexPosition) => {
    lines.push(
      `### ${indexPosition + 1}. ${record.title}`,
      `- URL: ${record.url}`,
      `- Book: ${record.book}`,
      `- Book ID: ${record.book_id}`,
      `- Source Book ID: ${record.source_book_id}`,
      `- Chapter ID: ${record.chapter_id}`,
      '- Class: 2',
      `- Language: ${record.language}`,
      markdownField('Publisher', record.publisher),
      `- Subject: ${sourceSubject(record)}`,
      `- Programme type: ${record.programme_type}`,
      markdownField('Topics ET', record.topics_et.join('; ')),
      markdownField('Topics RU', record.topics_ru.join('; ')),
      markdownField('Topics EN', record.topics_en.join('; ')),
      markdownField('Headings', record.headings.join('; ')),
      markdownField('Task examples', record.task_examples.join('; ')),
      '',
    );
  });
  return `${lines.join('\n').trimEnd()}\n`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function validateImmutableArchiveSet() {
  for (const [archivePath, expectedChecksum] of expectedArchiveChecksums) {
    const absolutePath = await requireFile(archivePath, 'grade 2 immutable source archive');
    assertArchiveChecksum(archivePath, await readFile(absolutePath), expectedChecksum);
  }
}

function bookMetadataAudit(records, configuration) {
  return Object.fromEntries([...groupBy(records, (record) => record.book_id).entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([bookId, matches]) => [bookId, {
      title: matches[0].book,
      source_book_id: matches[0].source_book_id,
      publisher: matches[0].publisher,
      language: matches[0].language,
      kits: [...new Set(matches.map((record) => kitId(record.url)))].sort(),
      page_records: matches.length,
      programme_type: matches[0].programme_type,
      title_evidence: configuration.bookVariants.get(`${matches[0].source_book_id}::${kitId(matches[0].url)}`).titleEvidence,
    }]));
}

async function generateSource(manifest, configuration) {
  const source = manifest.sources.find((entry) => entry.id === configuration.sourceId);
  assert(source, `Manifest source ${configuration.sourceId} was not found.`);
  assert(source.canonical_url_policy?.require_unique === true, `${configuration.sourceId}: unique URL policy is required.`);
  assert(JSON.stringify(source.canonical_subject_policy?.required_subject) === JSON.stringify(configuration.subject), `${configuration.sourceId}: canonical subject policy differs from generator configuration.`);
  if (configuration.requireManifestSourceScope) {
    assert(
      JSON.stringify(source.source_scope?.included_kit_ids) === JSON.stringify([...configuration.includedKitIds]),
      `${configuration.sourceId}: manifest exact kit scope differs from generator configuration.`,
    );
    assert(source.source_scope?.programme_type === 'mixed_subject', `${configuration.sourceId}: mixed source_scope programme type is required.`);
  }
  if (configuration.excludedBookIds.size > 0) {
    const manifestBoundary = [...(source.subject_boundary?.forbidden_book_ids ?? [])].sort();
    const expectedBoundary = [...configuration.excludedBookIds.keys()].sort();
    assert(JSON.stringify(manifestBoundary) === JSON.stringify(expectedBoundary), `${configuration.sourceId}: manifest subject boundary differs from generator configuration.`);
  }
  const markdownPath = repositoryPath(source.md_path, `${configuration.sourceId} Markdown path`);
  const qaPath = repositoryPath(source.qa_path, `${configuration.sourceId} QA path`);
  const expectedAdditional = configuration.additionalArchiveExpectations ?? new Map();
  const registeredAdditional = source.additional_source_archives ?? [];
  assert(Array.isArray(registeredAdditional), `${configuration.sourceId}: additional_source_archives must be an array.`);
  assert(registeredAdditional.length === expectedAdditional.size, `${configuration.sourceId}: additional source archive count differs from generator configuration.`);
  for (const entry of registeredAdditional) {
    const expectation = expectedAdditional.get(entry.path);
    assert(expectation, `${configuration.sourceId}: unexpected additional source archive ${entry.path}.`);
    assert(entry.role === expectation.role, `${configuration.sourceId}: additional archive ${entry.path} role differs from generator configuration.`);
    assert(JSON.stringify(entry.source_book_ids) === JSON.stringify(expectation.sourceBookIds), `${configuration.sourceId}: additional archive ${entry.path} source_book_ids differ from generator configuration.`);
  }
  const additionalExpectedSourceRecords = [...expectedAdditional.values()]
    .reduce((total, expectation) => total + expectation.expectedSourceRecords, 0);
  const archiveRegistrations = [
    {
      path: source.source_archive,
      role: 'primary',
      expectedSourceRecords: configuration.expectedSourceRecords - additionalExpectedSourceRecords,
    },
    ...registeredAdditional.map((entry) => ({
      path: entry.path,
      role: entry.role,
      sourceBookIds: entry.source_book_ids,
      expectedSourceRecords: expectedAdditional.get(entry.path).expectedSourceRecords,
    })),
  ];
  const archiveSources = [];
  for (const registration of archiveRegistrations) {
    archiveSources.push(await loadRegisteredArchive(
      source,
      configuration,
      registration,
      registration.expectedSourceRecords,
    ));
  }
  const records = archiveSources.flatMap((archiveSource) => archiveSource.records);
  assert(records.length === configuration.expectedSourceRecords, `${configuration.sourceId}: combined source record count changed.`);
  assertRegisteredArchiveOwnership(
    configuration.sourceId,
    records,
    archiveSources.map((archiveSource) => archiveSource.path),
  );
  validateBookVariantEvidence(records, configuration);
  const duplicateAudit = auditDuplicateUrls(records, configuration);
  const state = canonicalize(records, configuration);
  const markdown = renderMarkdown(configuration, source, archiveSources, state, duplicateAudit);
  const canonicalRecords = state.canonicalRecords;
  const duplicateTitleAudit = auditDuplicateTitles(canonicalRecords, configuration);
  for (const archiveSource of archiveSources.slice(1)) {
    const expectation = expectedAdditional.get(archiveSource.path);
    const included = canonicalRecords.filter((record) => record.source_archive_path === archiveSource.path).length;
    assert(included === expectation.expectedCanonicalRecords, `${configuration.sourceId}: ${archiveSource.path} contributes ${included} canonical pages; expected ${expectation.expectedCanonicalRecords}.`);
  }
  const primaryArchive = archiveSources[0];
  const generationTimestamp = archiveSources.map((archiveSource) => archiveSource.index.generatedAt).sort().at(-1);
  const canonicalSourceBookIds = [...new Set(canonicalRecords.map((record) => record.source_book_id))];
  const suffixAnomalies = canonicalSourceBookIds.filter((bookId) => bookId.endsWith('_et')
    && canonicalRecords.some((record) => record.source_book_id === bookId && record.language === 'ru'));
  const excludedBookAudit = [...configuration.excludedBookIds].map(([bookId, reason]) => ({
    book_id: bookId,
    source_records: records.filter((record) => normalizeText(record.book_id) === bookId).length,
    page_records_excluded: state.excludedBookRecords.filter((record) => normalizeText(record.book_id) === bookId).length,
    reason,
  }));
  const qa = {
    qa_schema_version: '1.0',
    source_id: source.id,
    source_archive: source.source_archive,
    output_file: source.md_path,
    format_version: source.format_version,
    generation: {
      status: 'generated',
      generated_at: generationTimestamp,
      generator: generatorPath,
      generator_version: generatorVersion,
      note: 'Generated deterministically from every archive registered for this route; cover/detail and administrative records are excluded from the canonical Markdown.',
    },
    checksums: {
      source_archive_sha256: sha256(primaryArchive.archiveBytes),
      output_file_sha256: sha256(Buffer.from(markdown, 'utf8')),
    },
    ...(archiveSources.length > 1 ? {
      source_archives: archiveSources.map((archiveSource) => ({
        path: archiveSource.path,
        role: archiveSource.role,
        source_book_ids: archiveSource.sourceBookIds,
        sha256: sha256(archiveSource.archiveBytes),
        source_records: archiveSource.records.length,
        page_records_included: canonicalRecords.filter(
          (record) => record.source_archive_path === archiveSource.path,
        ).length,
      })),
    } : {}),
    source_records: records.length,
    page_records_included: canonicalRecords.length,
    cover_detail_records_excluded: state.coverRecords.length,
    administrative_records_excluded: state.administrativeRecords.length,
    subject_boundary_page_records_excluded: state.excludedBookRecords.length,
    out_of_scope_records_excluded: state.outOfScopeRecords.length,
    grades: countBy(canonicalRecords, (record) => record.grade),
    languages: countBy(canonicalRecords, (record) => record.language),
    books: countBy(canonicalRecords, (record) => record.book_id),
    source_books: countBy(canonicalRecords, (record) => record.source_book_id),
    kits: countBy(canonicalRecords, (record) => kitId(record.url)),
    programme_types: countBy(canonicalRecords, (record) => record.programme_type),
    source_subject_counts: countBy(records, sourceSubject),
    canonical_subject_counts: countBy(canonicalRecords, sourceSubject),
    subject_normalization_records: state.subjectNormalizationAudit.length,
    subject_normalization_audit: state.subjectNormalizationAudit,
    duplicate_url_audit: {
      source_duplicate_groups: duplicateAudit.duplicateGroups.length,
      source_duplicate_records: duplicateAudit.duplicateRecords,
      canonical_duplicate_groups: 0,
      entries: duplicateAudit.entries,
    },
    ...(duplicateTitleAudit ? { duplicate_title_audit: duplicateTitleAudit } : {}),
    excluded_book_audit: excludedBookAudit,
    book_id_language_suffix_anomalies: suffixAnomalies,
    book_metadata_audit: bookMetadataAudit(canonicalRecords, configuration),
    metadata_limitations: configuration.metadataLimitations ?? [],
    ...(configuration.includedKitIds ? {
      source_scope: {
        included_kit_ids: [...configuration.includedKitIds].sort(),
        source_records_out_of_scope: state.outOfScopeRecords.length,
        decision: 'exact_kit_scope',
      },
    } : {}),
    ...(configuration.routePartition ? {
      route_partition: {
        paired_source_id: configuration.routePartition.pairedSourceId,
        expected_union_page_records: configuration.routePartition.expectedUnionRecords,
        canonical_overlap_urls: 0,
      },
    } : {}),
    records_without_headings: canonicalRecords.filter((record) => record.headings.length === 0).length,
    missing_urls: canonicalRecords.filter((record) => !record.url).length,
    archive_index: {
      generated_at: primaryArchive.index.generatedAt,
      raw_archive_included: primaryArchive.index.rawArchiveIncluded,
      declared_books: (primaryArchive.index.books ?? []).length,
    },
  };
  const qaContents = `${JSON.stringify(qa, null, 2)}\n`;
  const currentMarkdown = await readFile(markdownPath, 'utf8').catch(() => null);
  const currentQa = await readFile(qaPath, 'utf8').catch(() => null);
  if (checkOnly) {
    assert(currentMarkdown === markdown, `${source.md_path} is stale; run ${generatorPath} without --check.`);
    assert(currentQa === qaContents, `${source.qa_path} is stale; run ${generatorPath} without --check.`);
    console.log(`${configuration.sourceId} check passed: ${records.length} source records, ${canonicalRecords.length} canonical pages.`);
  } else {
    if (currentMarkdown !== markdown) await writeFile(markdownPath, markdown, 'utf8');
    if (currentQa !== qaContents) await writeFile(qaPath, qaContents, 'utf8');
    console.log(`${configuration.sourceId} generation complete: ${records.length} source records, ${canonicalRecords.length} canonical pages.`);
  }
  return { source, canonicalRecords };
}

if (unknownArguments.length > 0) {
  console.error(`Unknown argument(s): ${unknownArguments.join(', ')}`);
  console.error(`Usage: node ${generatorPath} [--check]`);
  process.exit(1);
} else {
  try {
    const manifest = parseJson(await readFile(manifestPath, 'utf8'), 'source-manifest.json');
    await validateImmutableArchiveSet();
    await relocateLegacyGradeOneRecords(manifest);
    const results = [];
    for (const configuration of configurations) results.push(await generateSource(manifest, configuration));
    const firstLanguage = results.find((result) => result.source.id === 'grade-2-estonian');
    const secondLanguage = results.find((result) => result.source.id === 'grade-2-estonian-second-language');
    assert(firstLanguage && secondLanguage, 'Both grade 2 Estonian subject routes are required.');
    assertDisjointPartition(
      firstLanguage.source.id,
      firstLanguage.canonicalRecords,
      secondLanguage.source.id,
      secondLanguage.canonicalRecords,
      444,
    );
    assertCrossRouteUrlOwnership(results.map((result) => ({
      routeId: result.source.id,
      records: result.canonicalRecords,
    })));
    console.log('Grade 2 Estonian route partition passed: 372 first-language pages, 72 second-language pages, 0 overlapping URLs.');
    const science = results.find((result) => result.source.id === 'grade-2-science');
    assert(science, 'grade-2-science generation result is required.');
    await validateRelocatedUrlOwnership(manifest, science.canonicalRecords);
  } catch (error) {
    console.error(`Grade 2 source generation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
