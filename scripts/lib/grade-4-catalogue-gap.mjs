import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  grade4RoutePolicy,
  multiGradeSupportPolicy,
} from './grade-4-canonical-sources.mjs';
import {
  archiveExpectations,
  bytewise,
  sha256,
  stableJson,
} from './grade-4-source-intake.mjs';

export const catalogueGapVersion = '1.0';
export const catalogueGapBaseCommit = '3b0ffc5d6ad7ff1d96be2e44e35fa45ffbc22b41';
export const catalogueGapVerificationDate = '2026-07-27';
export const catalogueSnapshotPath = 'external-sources/opiq/grade-4-live-catalogue-2026-07-27.json';
export const catalogueGapReportPath = 'evaluations/grade-4-source-gap-report.json';
export const catalogueGapAuditPath = 'docs/audits/grade-4-live-catalogue-gap-review.md';
export const catalogueSnapshotSchemaPath = 'schemas/grade-4-live-catalogue-snapshot.schema.json';
export const catalogueGapSchemaPath = 'schemas/grade-4-source-gap-report.schema.json';

const catalogueUrl = 'https://www.opiq.ee/Search/Kits?searchPhrase=&curriculumGroups=*&selectedkittype=*&classcourse=4&subject=&publishinghouse=&package=&language=&sortingorder=LanguageFirst';
const filters = Object.freeze({
  search_phrase: '',
  curriculum_or_programme: 'all',
  material_type: 'all',
  grade: '4. klass',
  subject: 'all',
  publisher: 'all',
  package_or_access: 'all',
  language: 'all',
  sort_order: 'LanguageFirst',
});

const historicalHashes = Object.freeze({
  'docs/audits/grade-4-canonical-source-import.md': 'ad53966529a6b5a4927cc7e74bf1024488790659e61676376706f0cd895b21ea',
  'docs/audits/grade-4-source-intake.md': 'cbde4d4d7ebc8372b2b66a41ab7415752425738ce0891e2f0bb7df4cf8c0ab88',
  'evaluations/grade-4-kit-details-evidence.json': '3e82ea03d02f7a858165344884006cd041d6a4028ac1ab56f427480cf5bde0c1',
  'evaluations/grade-4-source-intake.json': '29972ee2df6ceaa08d76af71e345167a923db79c3c4379333ec8036843505b54',
  'source-manifest.json': '036e178a800f9462e90abfc6dfea7943b5392a11d896f0ea240d438d9bab3197',
});

// Direct public Kit Details fields captured on 2026-07-27. Authors are kept as
// one exact catalogue byline rather than being heuristically split.
// [id, title, authors, subject, grades, language, publisher, curriculum, package, chapters, tasks, textbookTasks, collectionTasks]
const liveRows = Object.freeze([
  ['71', 'Eesti keel 4. klassile', 'Kaja Sarapuu, Liisi Piits, Kristiina Orgla, Kati Lepp, Jaak Urmet, Lauri Vanamölder', 'Eesti keel', [4], 'Eesti keel', 'Avita', ['Riiklik õppekava 2011', 'Riiklik õppekava 2023'], null, 135, 813, 390, 423],
  ['533', 'Eesti keel 4. klassile 2024', 'Kaja Sarapuu, Liisi Piits, Kristiina Orgla, Kati Lepp, Jaak Urmet, Lauri Vanamölder, Kärt Normann', 'Eesti keel', [4], 'Eesti keel', 'Avita', ['Riiklik õppekava 2023'], null, 129, 835, 488, 347],
  ['493', 'Eesti keel 4. klassile, e-tund', 'Maire Aher, Terje Varul, Katrin Puik', 'Eesti keel', [4], 'Eesti keel', 'Avita', ['Riiklik õppekava 2011', 'Riiklik õppekava 2023'], '—', 177, 0, 0, 0],
  ['566', 'Eesti keel 4. klassile, e-tund (2026)', 'Maire Aher, Terje Varul, Katrin Puik, Kärt Normann, Inga Kirs, Madli Kütt', 'Eesti keel', [4], 'Eesti keel', 'Avita', ['Riiklik õppekava 2023'], '—', 178, 1, 1, 0],
  ['154', 'SINASÕPRUS KEELEGA', 'Helin Puksand, Reet Bobõlski', 'Eesti keel', [4], 'Eesti keel', 'Koolibri', ['Riiklik õppekava 2011', 'Riiklik õppekava 2023'], null, 137, 512, 29, 483],
  ['150', 'TEELE. Eesti keel teise keelena 4. klassile', 'Pille Pipar', 'Eesti keel', [4], 'Eesti keel', 'Koolibri', ['Riiklik õppekava 2011', 'Riiklik õppekava 2023'], null, 117, 405, 56, 349],
  ['451', 'High Five! 4', 'Mari Kalaja, Niina Korpela, Raija Kuja-Kyyny-Pajula, Jamie Mäkinen, Päivi Pelli-Kouvo', 'Inglise keel', [4], 'Eesti keel', 'Avita', ['Riiklik õppekava 2011', 'Riiklik õppekava 2023'], null, 95, 1151, 958, 193],
  ['287', 'Inimeseõpetus 4. klassile. Lihtsustatud õppekava', 'Merit Nukka, Siiri Jõgi', 'Inimeseõpetus', [4], 'Eesti keel', 'SA Innove, HARNO', ['Põhikooli lihtsustatud riiklik õppekava 2010'], 'Tasuta', 56, 403, 388, 15],
  ['161', 'Kehalise kasvatuse tööraamat teisele kooliastmele', 'Karin Kütt, Ulvi Sarapuu', 'Kehaline kasvatus', [4, 5, 6], 'Eesti keel', 'Avita', ['Riiklik õppekava 2011'], null, 22, 97, 61, 36],
  ['200', 'Käsitöötuba', 'Tiiu Kivirähk', 'Kunstiõpetus, tööõpetus', [1, 2, 3, 4], 'Eesti keel', 'Koolibri', ['Riiklik õppekava 2011'], null, 85, 0, 0, 0],
  ['348', "Luudusoppus noorõmbalõ kooliiäle (kakkõhelü '-ga)", 'Hergi Karik, Aivo Saar, Kalle Sirel', 'Loodusõpetus', [1, 2, 3, 4, 5, 6], 'Eesti keel', 'Koolibri', ['Riiklik õppekava 2011', 'Riiklik õppekava 2023'], 'Tasuta', 78, 472, 232, 240],
  ['349', 'Luudusoppus noorõmbalõ kooliiäle (kakkõhelü märkmäldä)', 'Hergi Karik, Aivo Saar, Kalle Sirel', 'Loodusõpetus', [1, 2, 3, 4, 5, 6], 'Eesti keel', 'Koolibri', ['Riiklik õppekava 2011', 'Riiklik õppekava 2023'], 'Tasuta', 78, 472, 232, 240],
  ['350', 'Luudusoppus noorõmbalõ kooliiäle (kakkõhelü q-ga)', 'Hergi Karik, Aivo Saar, Kalle Sirel', 'Loodusõpetus', [1, 2, 3, 4, 5, 6], 'Eesti keel', 'Koolibri', ['Riiklik õppekava 2011', 'Riiklik õppekava 2023'], 'Tasuta', 78, 472, 232, 240],
  ['11', 'Loodusõpetus 4. klassile', 'Tiina Elvisto, Vahur Laug, Mart Kuurme, Alar Läänelaid, Tiina Stamm', 'Loodusõpetus', [4], 'Eesti keel', 'Avita', ['Riiklik õppekava 2011'], null, 54, 449, 226, 223],
  ['108', 'Loodusõpetus 4. klassile', 'Sirje Kaljula, Aivo Saar, Kalle Sirel', 'Loodusõpetus', [4], 'Eesti keel', 'Koolibri', ['Riiklik õppekava 2011', 'Riiklik õppekava 2023'], null, 66, 646, 287, 359],
  ['480', 'Loodusõpetus 4. klassile (2023)', 'Tiina Elvisto, Mart Kuurme, Vahur Laug, Alar Läänelaid, Tiina Stamm', 'Loodusõpetus', [4], 'Eesti keel', 'Avita', ['Riiklik õppekava 2023'], null, 50, 365, 243, 122],
  ['487', 'Loodusõpetus 4. klassile, e-tund', 'Kristjan Rea, Brit Peensoo. (Õpiku ja töövihiku autorid Mart Kuurme, Vahur Laug, Tiina Elvisto, Alar Läänelaid, Tiina Stamm, Marina Meleško)', 'Loodusõpetus', [4], 'Eesti keel', 'Avita', ['Riiklik õppekava 2011'], '—', 72, 0, 0, 0],
  ['492', 'Loodusõpetus 4. klassile, e-tund (2023)', 'Kristjan Rea, Brit Peensoo, Helen Hiiemaa (Õpiku ja töövihiku autorid Tiina Elvisto, Mart Kuurme, Vahur Laug, Alar Läänelaid, Tiina Stamm, Helen Hiiemaa)', 'Loodusõpetus', [4], 'Eesti keel', 'Avita', ['Riiklik õppekava 2023'], '—', 74, 0, 0, 0],
  ['324', 'Meie ise. Õpetaja käsiraamat', 'Silja Enok, Margit Luts, Elbe Metsatalu, Janno Siimar', 'Majandus- ja ettevõtlusõpe', [1, 2, 3, 4, 5, 6], 'Eesti keel', 'Junior Achievement Eesti SA', ['Riiklik õppekava 2011'], '„7 sammu“ käsiraamatud õpetajale, „7 sammu“ käsiraamatud õpilasele', 14, 5, 0, 5],
  ['373', 'Meie kodukoht. Õpetaja käsiraamat', 'Silja Enok, Margit Luts, Elbe Metsatalu, Janno Siimar, Gunnar Hunt', 'Majandus- ja ettevõtlusõpe', [1, 2, 3, 4, 5, 6], 'Eesti keel', 'Junior Achievement Eesti SA', ['Riiklik õppekava 2011'], '„7 sammu“ käsiraamatud õpetajale, „7 sammu“ käsiraamatud õpilasele', 18, 0, 0, 0],
  ['377', 'Meie linn ja vald. Õpetaja käsiraamat', 'Silja Enok, Margit Luts, Elbe Metsatalu, Janno Siimar', 'Majandus- ja ettevõtlusõpe', [1, 2, 3, 4, 5, 6], 'Eesti keel', 'Junior Achievement Eesti SA', ['Riiklik õppekava 2011'], '„7 sammu“ käsiraamatud õpetajale, „7 sammu“ käsiraamatud õpilasele', 25, 0, 0, 0],
  ['445', 'Meie maakond ja riik. Õpetaja käsiraamat', 'Silja Enok, Margit Luts, Elbe Metsatalu, Janno Siimar', 'Majandus- ja ettevõtlusõpe', [1, 2, 3, 4, 5, 6], 'Eesti keel', 'Junior Achievement Eesti SA', ['Riiklik õppekava 2011'], '„7 sammu“ käsiraamatud õpetajale, „7 sammu“ käsiraamatud õpilasele', 23, 0, 0, 0],
  ['471', 'Meie mini-minifirma. Õpetaja käsiraamat', 'Silja Enok, Margit Luts, Elbe Metsatalu, Janno Siimar', 'Majandus- ja ettevõtlusõpe', [1, 2, 3, 4, 5, 6], 'Eesti keel', 'Junior Achievement Eesti SA', ['Riiklik õppekava 2011'], '„7 sammu“ käsiraamatud õpetajale, „7 sammu“ käsiraamatud õpilasele', 16, 6, 1, 5],
  ['359', 'Meie perekond. Õpetaja käsiraamat', 'Silja Enok, Margit Luts, Elbe Metsatalu, Janno Siimar', 'Majandus- ja ettevõtlusõpe', [1, 2, 3, 4, 5, 6], 'Eesti keel', 'Junior Achievement Eesti SA', ['Riiklik õppekava 2011'], '„7 sammu“ käsiraamatud õpetajale, „7 sammu“ käsiraamatud õpilasele', 22, 0, 0, 0],
  ['70', 'Matemaatika 4. klassile', 'Kalju Kaasik, Malle Saks', 'Matemaatika', [4], 'Eesti keel', 'Avita', ['Riiklik õppekava 2011'], null, 132, 2623, 2020, 603],
  ['147', 'MATEMAATIKA 4. klassile', 'Endel Noor, Enn Nurk, Aksel Telgmaa', 'Matemaatika', [4], 'Eesti keel', 'Koolibri', ['Riiklik õppekava 2011', 'Riiklik õppekava 2023'], null, 62, 5051, 2501, 2550],
  ['588', 'MATEMAATIKA 4. klassile (2025)', 'Tiiu Kaljas, Endel Noor, Enn Nurk, Aksel Telgmaa', 'Matemaatika', [4], 'Eesti keel', 'Koolibri', ['Riiklik õppekava 2023'], null, 60, 1969, 1443, 526],
  ['460', 'Matemaatika 4. klassile 2023 ÕK', 'Kalju Kaasik, Malle Saks', 'Matemaatika', [4], 'Eesti keel', 'Avita', ['Riiklik õppekava 2023'], null, 129, 2632, 1817, 815],
  ['378', 'Matemaatika 4. klassile, e-tund', 'Malle Saks, Ülle Liivaoja, Pirgit Palm, Madli Rööp, Ann-Mari Koppel, Jelena Pjatkova, Liile Jõgi', 'Matemaatika', [4], 'Eesti keel', 'Avita', ['Riiklik õppekava 2011'], '—', 148, 31, 0, 31],
  ['506', 'Matemaatika 4. klassile, e-tund (2023 ÕK)', 'Malle Saks, Ülle Liivaoja, Pirgit Palm, Madli Rööp, Ann-Mari Koppel, Jelena Pjatkova', 'Matemaatika', [4], 'Eesti keel', 'Avita', ['Riiklik õppekava 2023'], '—', 152, 38, 4, 34],
  ['282', 'Matemaatika 4. klassile. I osa. Lihtsustatud õppekava', 'Kadri Männiksaar, Lii Helmet', 'Matemaatika', [4], 'Eesti keel', 'SA Innove, HARNO', ['Põhikooli lihtsustatud riiklik õppekava 2010'], 'Tasuta', 41, 377, 377, 0],
  ['304', 'Matemaatika 4. klassile. II osa. Lihtsustatud õppekava', 'Kadri Männiksaar, Lii Helmet', 'Matemaatika', [4], 'Eesti keel', 'SA Innove, HARNO', ['Põhikooli lihtsustatud riiklik õppekava 2010'], 'Tasuta', 32, 343, 343, 0],
  ['318', 'Matemaatika 4. klassile. III osa. Lihtsustatud õppekava', 'Kadri Männiksaar, Lii Helmet', 'Matemaatika', [4], 'Eesti keel', 'SA Innove, HARNO', ['Põhikooli lihtsustatud riiklik õppekava 2010'], 'Tasuta', 40, 613, 613, 0],
  ['328', 'Matemaatika 4. klassile. IV osa. Lihtsustatud õppekava', 'Kadri Männiksaar, Lii Helmet', 'Matemaatika', [4], 'Eesti keel', 'SA Innove, HARNO', ['Põhikooli lihtsustatud riiklik õppekava 2010'], 'Tasuta', 29, 331, 331, 0],
  ['206', 'Muusikamaa lood', 'Kai Anier, Maia Muldma', 'Muusikaõpetus', [4], 'Eesti keel', 'Koolibri', ['Riiklik õppekava 2011', 'Riiklik õppekava 2023'], null, 96, 66, 18, 48],
  ['174', 'Muusikaõpik 4. klassile', 'Monika Pullerits, Liivi Urbel', 'Muusikaõpetus', [4], 'Eesti keel', 'Avita', ['Riiklik õppekava 2011'], null, 39, 192, 153, 39],
  ['552', 'Muusikaõpik 4. klassile 2024', 'Monika Pullerits, Liivi Urbel', 'Muusikaõpetus', [4], 'Eesti keel', 'Avita', ['Riiklik õppekava 2023'], null, 39, 192, 153, 39],
  ['476', 'Arvjuhitavad seadmed (CNC)', 'Snapmaker Technology Co., Ltd', 'Tehnoloogiaõpetus', [4, 5, 6, 7, 8, 9], 'Eesti keel', 'Merkuur', ['Riiklik õppekava 2011'], 'Tasuta', 23, 1, 1, 0],
  ['231', 'Koduõpe', 'Avita', 'Varia', [1, 2, 3, 4, 5, 6, 7, 8, 9], 'Eesti keel', 'Avita', ['Riiklik õppekava 2011'], 'Tasuta', 27, 26, 13, 13],
  ['465', 'Eesti Pärimusmuusika Keskuse õppevideod', 'Kaja Kaus, Cätlin Mägi', 'Ühiskonnaõpetus, eesti keel, geograafia, ajalugu, inimese- ja ühiskonnaõpetus, kirjandus, muusikaõpetus, varia', [1, 2, 3, 4, 5, 6, 7, 8, 9], 'Eesti keel', 'Eesti Pärimusmuusika Keskus MTÜ', ['Riiklik õppekava 2011'], 'Tasuta', 33, 46, 24, 22],
  ['55', 'Inimene ja ühiskond. Õpik II kooliastmele, I osa', 'Anu Aavik, Toivo Aavik, Jüri Allik, Lembit Andresen, Mari-Liis Auler, Igor Gräzin, Kenn Konstabel, Marika Paaver, Mihkel Zilmer', 'Ühiskonnaõpetus, inimese- ja ühiskonnaõpetus, inimeseõpetus', [4, 5], 'Eesti keel', 'Avita', ['Riiklik õppekava 2011', 'Riiklik õppekava 2023'], null, 32, 192, 64, 128],
  ['415', 'РУССКОЕ СЛОВО. Чтение для 4 клacca', 'Айме Матсина, Надежда Пароль', 'Kirjandus', [4], 'Vene keel', 'Koolibri', ['Riiklik õppekava 2011', 'Riiklik õppekava 2023'], null, 34, 34, 18, 16],
  ['228', 'Природоведение 4 класс', 'Сирье Кальюла, Айво Саар', 'Loodusõpetus', [4], 'Vene keel', 'Koolibri', ['Riiklik õppekava 2011', 'Riiklik õppekava 2023'], null, 66, 624, 286, 338],
  ['27', 'Природоведение для 4 класса', 'Тийна Элвисто, Вахур Лауг, Март Куурме, Алар Ляэнелайд, Тийна Стамм', 'Loodusõpetus', [4], 'Vene keel', 'Avita', ['Riiklik õppekava 2011'], null, 55, 448, 225, 223],
  ['536', 'Природоведение для 4 класса (2023)', 'Tiina Elvisto, Mart Kuurme, Vahur Laug, Alar Läänelaid, Tiina Stamm', 'Loodusõpetus', [4], 'Vene keel', 'Avita', ['Riiklik õppekava 2023'], null, 50, 365, 243, 122],
  ['411', 'Мы сами. Пособие для учителя', 'Silja Enok, Margit Luts, Elbe Metsatalu, Janno Siimar', 'Majandus- ja ettevõtlusõpe', [1, 2, 3, 4, 5, 6], 'Vene keel', 'Junior Achievement Eesti SA', ['Riiklik õppekava 2011'], '„7 sammu“ käsiraamatud õpetajale, „7 sammu“ käsiraamatud õpilasele', 14, 5, 0, 5],
  ['444', 'Наш район. Пособие для учителя', 'Silja Enok, Margit Luts, Elbe Metsatalu, Janno Siimar, Gunnar Hunt', 'Majandus- ja ettevõtlusõpe', [1, 2, 3, 4, 5, 6], 'Vene keel', 'Junior Achievement Eesti SA', ['Riiklik õppekava 2011'], '„7 sammu“ käsiraamatud õpetajale, „7 sammu“ käsiraamatud õpilasele', 18, 0, 0, 0],
  ['474', 'Наша мини-минифирма. Пособие для учителя', 'Silja Enok, Margit Luts, Elbe Metsatalu, Janno Siimar', 'Majandus- ja ettevõtlusõpe', [1, 2, 3, 4, 5, 6], 'Vene keel', 'Junior Achievement Eesti SA', ['Riiklik õppekava 2011'], '„7 sammu“ käsiraamatud õpetajale, „7 sammu“ käsiraamatud õpilasele', 16, 6, 1, 5],
  ['416', 'Наша семья. Пособие для учителя', 'Silja Enok, Margit Luts, Elbe Metsatalu, Janno Siimar', 'Majandus- ja ettevõtlusõpe', [1, 2, 3, 4, 5, 6], 'Vene keel', 'Junior Achievement Eesti SA', ['Riiklik õppekava 2011'], '„7 sammu“ käsiraamatud õpetajale, „7 sammu“ käsiraamatud õpilasele', 22, 0, 0, 0],
  ['293', 'МАТЕМАТИКА 4 класс', 'Аксель Тельгмаа, Эндель Ноор, Энн Нурк', 'Matemaatika', [4], 'Vene keel', 'Koolibri', ['Riiklik õppekava 2011', 'Riiklik õppekava 2023'], null, 63, 5048, 2500, 2548],
  ['157', 'Математика для 4 класса', 'Калью Каасик', 'Matemaatika', [4], 'Vene keel', 'Avita', ['Riiklik õppekava 2011'], null, 123, 2425, 1865, 560],
  ['243', 'РУССКИЙ ЯЗЫК 4 класс', 'Ирина Логвина, Светлана Минакова', 'Vene keel', [4], 'Vene keel', 'Koolibri', ['Riiklik õppekava 2011', 'Riiklik õppekava 2023'], null, 91, 340, 140, 200],
  ['295', 'Русский язык для 4 класса', 'Елена Тимофеева, Карина Росс', 'Vene keel', [4], 'Vene keel', 'Avita', ['Riiklik õppekava 2011'], null, 76, 725, 525, 200],
  ['82', 'Человек и общество. Учебник для II ступени обучения, Часть I', 'Ану Аавик, Тойво Аавик, Юри Аллик, Лембит Андресен, Мари-Лийс Аулер, Игорь Грязин, Кенн Констабель, Марика Паавер, Михкель Зильмер', 'Ühiskonnaõpetus, inimese- ja ühiskonnaõpetus', [4], 'Vene keel', 'Avita', ['Riiklik õppekava 2011'], null, 32, 138, 44, 94],
  ['332', 'English step by step 2', 'Mari Peets, Kristi Tork-Sarapuu, Maris Niine', 'Inglise keel', [4], 'Inglise keel', 'Koolibri', ['Riiklik õppekava 2011', 'Riiklik õppekava 2023'], null, 69, 260, 0, 260],
]);

const teacherIds = new Set(['324', '359', '373', '377', '378', '411', '416', '444', '471', '474', '487', '492', '493', '506', '566']);
teacherIds.add('445');
const exactTeacherIds = new Set(['378', '487', '492', '493', '506', '566']);
const knownSharedIds = new Set(multiGradeSupportPolicy.map((entry) => entry.kit_id));
const supplementaryDiscoveryIds = new Set(['231', '348', '349', '350', '465']);
const simplifiedIds = new Set(['282', '287', '304', '318', '328']);
const mixedSubjectIds = new Set(['55', '82']);
const editionIds = new Set(['11', '27', '174', '480', '533', '536', '552', '588']);
const canonicalRouteByKit = new Map(
  grade4RoutePolicy.flatMap((route) => route.included_kit_ids.map((kitId) => [kitId, route])),
);

function explicitYear(title) {
  return title.match(/\b20(?:1[0-9]|2[0-9])\b/u)?.[0] ?? null;
}

function classifyKit(kitId) {
  if (canonicalRouteByKit.has(kitId)) return 'canonical_student_source';
  if (teacherIds.has(kitId)) return 'teacher_only';
  if (kitId === '161' || kitId === '476') return 'multi_grade_support';
  if (kitId === '200' || supplementaryDiscoveryIds.has(kitId)) return 'supplementary_shared';
  throw new Error(`Unclassified live kit ${kitId}`);
}

function secondaryRoles(kitId) {
  const roles = [];
  if (simplifiedIds.has(kitId)) roles.push('simplified_curriculum');
  if (mixedSubjectIds.has(kitId)) roles.push('mixed_subject');
  if (editionIds.has(kitId) || exactTeacherIds.has(kitId)) roles.push('edition_or_replacement');
  if (teacherIds.has(kitId)) roles.push('teacher_support');
  if (teacherIds.has(kitId) && !exactTeacherIds.has(kitId)) roles.push('multi_grade_support');
  if (supplementaryDiscoveryIds.has(kitId) || kitId === '200') roles.push('supplementary_shared');
  return roles.sort(bytewise);
}

function roleFor(kitId) {
  if (exactTeacherIds.has(kitId)) return 'exact_grade_4_teacher_or_e_tund';
  if (teacherIds.has(kitId)) return 'grades_1_to_6_entrepreneurship_teacher_support';
  if (kitId === '161') return 'school_stage_ii_physical_education_support';
  if (kitId === '200') return 'shared_supplementary_arts_and_crafts';
  if (kitId === '476') return 'multi_grade_technology_instructional_support';
  if (supplementaryDiscoveryIds.has(kitId)) return 'multi_grade_supplementary_or_shared';
  if (simplifiedIds.has(kitId)) return 'simplified_curriculum_student_source';
  if (mixedSubjectIds.has(kitId)) return 'mixed_subject_student_source';
  return 'canonical_grade_4_student_source';
}

function ownershipFor(kitId) {
  if (canonicalRouteByKit.has(kitId)) return 'retain_existing_grade_4_owner';
  if (kitId === '200') return 'retain_existing_non_grade_4_owner';
  if (teacherIds.has(kitId)) return 'teacher_support_no_student_owner';
  return 'multi_grade_no_exclusive_owner';
}

function recaptureFor(kitId) {
  if (exactTeacherIds.has(kitId)) return 'teacher_material_capture_internal_only';
  if (teacherIds.has(kitId) || supplementaryDiscoveryIds.has(kitId)) return 'metadata_only';
  return 'none';
}

function nextActionFor(kitId) {
  if (canonicalRouteByKit.has(kitId)) {
    return 'Retain the current route; any later task-body recapture is lesson-authoring evidence, not catalogue accounting.';
  }
  if (kitId === '200') return 'Retain grade-2-arts-and-crafts ownership and Grade 4 shared-support accounting.';
  if (kitId === '161' || kitId === '476') return 'Keep non-exclusive support accounting without a new Grade 4 route.';
  if (exactTeacherIds.has(kitId)) return 'Keep teacher-only; capture internally only if an authorised teacher workflow requires it.';
  if (teacherIds.has(kitId)) return 'Keep teacher-only and multi-grade; catalogue metadata is sufficient for this audit.';
  return 'Keep as non-exclusive supplementary metadata; assess selected chapters only in a separate instructional need.';
}

function makeLiveRecord(row) {
  const [
    kitId, title, authors, subject, gradeScope, language, publisher, curriculumLabels,
    packageOrAccess, chapterCount, taskCount, textbookTaskCount, taskCollectionTaskCount,
  ] = row;
  return {
    kit_id: kitId,
    kit_details_url: `https://www.opiq.ee/Kit/Details/${kitId}`,
    verified_on: catalogueGapVerificationDate,
    capture_method: 'direct_public_kit_details_and_catalogue_filter_review',
    evidence_status: 'direct_live_evidence',
    title,
    material_type: teacherIds.has(kitId) ? 'Õpetajaraamat' : 'Õppekomplekt',
    subject,
    grade_scope: gradeScope,
    languages: [language],
    publisher,
    authors: [authors],
    edition_or_year: explicitYear(title),
    programme_or_support_role: roleFor(kitId),
    curriculum_labels: curriculumLabels,
    package_or_access: packageOrAccess,
    chapter_count: chapterCount,
    task_count: taskCount,
    textbook_task_count: textbookTaskCount,
    task_collection_task_count: taskCollectionTaskCount,
    catalogue_filters: filters,
    source_evidence_refs: [
      'catalogue-filter-grade-4-all',
      'direct-kit-details-all-55',
    ],
    evidence_limitations: [
      'Public catalogue metadata and counts only; no chapter prose, task bodies, illustrations, answer keys, or authenticated content were captured.',
    ],
    primary_classification: classifyKit(kitId),
    secondary_roles: secondaryRoles(kitId),
  };
}

function catalogueIdentity(records) {
  return sha256(stableJson({
    catalogue_url: catalogueUrl,
    filters,
    displayed_result_count: records.length,
    result_kit_ids: records.map((record) => record.kit_id),
  }));
}

export function buildCatalogueSnapshot() {
  const records = liveRows.map(makeLiveRecord);
  return {
    schema_version: catalogueGapVersion,
    artifact_type: 'grade-4-live-catalogue-snapshot',
    snapshot_id: 'grade-4-live-catalogue-2026-07-27',
    verified_on: catalogueGapVerificationDate,
    completeness_status: 'complete_for_declared_filter',
    catalogue_interface: {
      url: catalogueUrl,
      capture_method: 'public_varamu_filter_and_direct_kit_details_review',
      selected_filters: filters,
      pagination: {
        pages_observed: 1,
        all_result_pages_captured: true,
        pagination_controls_present: false,
      },
      displayed_result_count: 55,
      material_type_breakdown: {
        learning_kits: 39,
        teacher_books: 16,
      },
      stable_source_identity: {
        algorithm: 'sha256',
        value: catalogueIdentity(records),
        identity_input: 'canonical filter fields, displayed count, and ordered kit IDs',
      },
    },
    evidence_sources: [
      {
        evidence_ref: 'catalogue-filter-grade-4-all',
        evidence_type: 'catalogue_filter_evidence',
        url: catalogueUrl,
        verified_on: catalogueGapVerificationDate,
        note: 'The public Grade 4 filter displayed 55 results on one page with no pagination controls.',
      },
      {
        evidence_ref: 'direct-kit-details-all-55',
        evidence_type: 'direct_live_evidence',
        url: 'https://www.opiq.ee/Kit/Details/{kit_id}',
        verified_on: catalogueGapVerificationDate,
        note: 'All 55 public Kit Details pages were reviewed for structured metadata and counts.',
      },
      {
        evidence_ref: 'repository-grade-4-capture',
        evidence_type: 'repository_capture_evidence',
        url: null,
        verified_on: catalogueGapVerificationDate,
        note: 'The immutable ten-ZIP intake, post-intake evidence, canonical route policy, and source manifest were compared locally.',
      },
    ],
    records,
    limitations: [
      'Completeness applies only to the exact public Grade 4 filter and verification date.',
      'No claim is made about authenticated, unpublished, hidden, withdrawn, or future catalogue material.',
      'Catalogue inclusion is not proof of official curriculum completeness, source quality, or pedagogical effectiveness.',
    ],
  };
}

async function manifestOwnership(rootDir, liveKitIds) {
  const manifest = JSON.parse(await readFile(path.join(rootDir, 'source-manifest.json'), 'utf8'));
  const owners = Object.fromEntries(liveKitIds.map((kitId) => [kitId, []]));
  for (const source of manifest.sources) {
    const markdown = await readFile(path.join(rootDir, source.md_path), 'utf8');
    for (const kitId of liveKitIds) {
      if (new RegExp(`https://www[.]opiq[.]ee/kit/${kitId}/`, 'iu').test(markdown)) {
        owners[kitId].push(source.id);
      }
    }
  }
  for (const values of Object.values(owners)) values.sort(bytewise);
  return { manifest, owners };
}

function comparisonRow(record, manifestOwners) {
  const kitId = record.kit_id;
  const route = canonicalRouteByKit.get(kitId);
  const captured = route || knownSharedIds.has(kitId);
  const owner = route?.id ?? (kitId === '200' ? 'grade-2-arts-and-crafts' : null);
  const primary = record.primary_classification;
  return {
    kit_id: kitId,
    title: record.title,
    primary_classification: primary,
    secondary_roles: record.secondary_roles,
    repository_capture_status: route
      ? 'captured_canonical'
      : knownSharedIds.has(kitId)
        ? 'captured_noncanonical_support'
        : 'not_captured',
    canonical_owner: owner,
    canonical_route_id: route?.id ?? null,
    manifest_route_ids: manifestOwners,
    live_catalogue_status: 'listed_in_declared_grade_4_filter',
    capture_completeness: captured ? 'chapter_index_captured' : 'metadata_only_live',
    metadata_completeness: 'direct_kit_details_required_fields_captured',
    instructional_page_completeness: captured ? 'chapter_index_only' : 'not_captured',
    task_body_completeness: route ? 'partial' : knownSharedIds.has(kitId) ? 'not_assessed' : 'not_captured',
    ownership_decision: ownershipFor(kitId),
    recapture_decision: recaptureFor(kitId),
    next_action: nextActionFor(kitId),
  };
}

function summarize(reportRows) {
  const count = (predicate) => reportRows.filter(predicate).length;
  return {
    total_live_kits: reportRows.length,
    canonical_student_kits: count((row) => row.repository_capture_status === 'captured_canonical'),
    known_nonexclusive_captured_kits: count((row) => row.repository_capture_status === 'captured_noncanonical_support'),
    newly_accounted_live_kits: count((row) => row.repository_capture_status === 'not_captured'),
    teacher_only_kits: count((row) => row.primary_classification === 'teacher_only'),
    supplementary_or_multi_grade_kits: count((row) => ['multi_grade_support', 'supplementary_shared'].includes(row.primary_classification)),
    new_exact_grade_4_student_candidates: count((row) => (
      ['candidate_new_grade_4_route', 'candidate_add_to_existing_grade_4_route'].includes(row.ownership_decision)
    )),
  };
}

function editionRelationships() {
  return [
    { relationship_id: 'estonian-student-editions', kit_ids: ['71', '533'], disposition: 'preserve_separate_editions' },
    { relationship_id: 'estonian-teacher-editions', kit_ids: ['493', '566'], disposition: 'preserve_separate_teacher_editions' },
    { relationship_id: 'science-avita-estonian-editions', kit_ids: ['11', '480'], disposition: 'preserve_separate_editions' },
    { relationship_id: 'science-avita-russian-editions', kit_ids: ['27', '536'], disposition: 'preserve_separate_editions' },
    { relationship_id: 'science-teacher-editions', kit_ids: ['487', '492'], disposition: 'preserve_separate_teacher_editions' },
    { relationship_id: 'mathematics-avita-editions', kit_ids: ['70', '460'], disposition: 'preserve_separate_editions' },
    { relationship_id: 'mathematics-koolibri-editions', kit_ids: ['147', '588'], disposition: 'preserve_separate_editions' },
    { relationship_id: 'mathematics-teacher-editions', kit_ids: ['378', '506'], disposition: 'preserve_separate_teacher_editions' },
    { relationship_id: 'music-avita-editions', kit_ids: ['174', '552'], disposition: 'preserve_separate_editions' },
  ];
}

async function verifyHistoricalBoundaries(rootDir) {
  const results = [];
  for (const [artifactPath, expectedHash] of Object.entries(historicalHashes).sort(([left], [right]) => bytewise(left, right))) {
    const actualHash = sha256(await readFile(path.join(rootDir, artifactPath)));
    if (actualHash !== expectedHash) throw new Error(`Historical boundary changed: ${artifactPath}`);
    results.push({ artifact_path: artifactPath, sha256: actualHash, unchanged: true });
  }
  for (const archive of archiveExpectations) {
    const absolute = path.join(rootDir, archive.path);
    const stats = await lstat(absolute);
    if (!stats.isFile() || stats.isSymbolicLink()) throw new Error(`Immutable archive is not a regular file: ${archive.path}`);
    const bytes = await readFile(absolute);
    if (bytes.length !== archive.byte_size || sha256(bytes) !== archive.sha256) {
      throw new Error(`Immutable archive changed: ${archive.path}`);
    }
  }
  return results;
}

function markdownReport(report) {
  const summary = report.summary;
  const newRows = report.captured_vs_live.filter((row) => row.repository_capture_status === 'not_captured');
  const teacherRows = report.captured_vs_live.filter((row) => row.primary_classification === 'teacher_only');
  const supportRows = report.captured_vs_live.filter((row) => ['multi_grade_support', 'supplementary_shared'].includes(row.primary_classification));
  const lines = [
    '# Grade 4 live-catalogue and source-gap review',
    '',
    `Verified: ${report.verification_date}`,
    '',
    '## Executive summary',
    '',
    `The exact public Grade 4 Varamu filter returned **${summary.total_live_kits}** results on one page: **39 learning kits** and **16 teacher books**. The snapshot is \`${report.completeness_status}\` for that exact filter because the URL, every selected filter, result count, sort order, pagination state, all result IDs, verification date, capture method, and a stable evidence identity are recorded.`,
    '',
    `The inventory reconciles to **${summary.canonical_student_kits} canonical student kits**, **${summary.known_nonexclusive_captured_kits} known captured shared/support kits**, and **${summary.newly_accounted_live_kits} additional live kits**. The additional set contains 16 teacher-only books and five multi-grade/supplementary kits. There are **${summary.new_exact_grade_4_student_candidates} new exact Grade 4 student-source candidates**.`,
    '',
    'This is a catalogue-accounting result, not an official-curriculum completeness, content completeness, access-rights, or pedagogical-effectiveness claim.',
    '',
    '## Evidence methodology',
    '',
    `- Public filter: ${report.capture_methodology.catalogue_url}`,
    '- Filters: blank search; all curricula/programmes, material types, subjects, publishers, packages and languages; Grade 4; LanguageFirst sort.',
    '- The result list had one observed page and no pagination controls.',
    '- Every result was checked against its public Kit Details page for title, type, subject, grades, languages, publisher, byline, curriculum labels, access/package and counts.',
    '- Repository comparison covered all eleven current Grade 4 routes, the three captured shared/support kits, all ten immutable ZIPs, all manifest routes, and the post-intake Kit Details evidence.',
    '',
    '## Current canonical coverage',
    '',
    `All ${summary.canonical_student_kits} live canonical kits reconcile with the eleven current Grade 4 route allocations. No canonical route or manifest entry is changed by this review. \`eesti keel\` and \`eesti keel teise keelena\` remain separate routes; simplified and mixed-subject roles remain explicit secondary classifications.`,
    '',
    '## Newly discovered live kits',
    '',
    `Nine entries were supplied only as preliminary discovery seeds; the complete filter found twelve additional entries (${report.discovery_breakdown.additional_kit_ids_found_by_complete_filter.join(', ')}). The table below lists all 21 live kits absent from the immutable Grade 4 capture baseline.`,
    '',
    '| Kit | Type | Decision | Recapture |',
    '| --- | --- | --- | --- |',
    ...newRows.map((row) => `| ${row.kit_id} — ${row.title} | ${row.primary_classification} | ${row.ownership_decision} | ${row.recapture_decision} |`),
    '',
    '## Teacher-only and support materials',
    '',
    `The teacher-only inventory contains ${teacherRows.length} kits. Exact Grade 4 e-tund resources remain outside student routes and are eligible only for an authorised internal teacher-material workflow. The grades 1–6 entrepreneurship manuals remain multi-grade teacher support.`,
    '',
    `The shared/support inventory contains ${supportRows.length} kits. Kits 161 and 476 remain non-exclusive; kit 200 retains \`grade-2-arts-and-crafts\` ownership. The five newly found shared resources receive metadata-only accounting and no exclusive Grade 4 owner.`,
    '',
    '## Student-source gaps',
    '',
    'No additional exact Grade 4 student-facing kit was found outside the current canonical routes. This does not prove official-curriculum completeness. Curriculum mapping remains separate and depends on issue #37.',
    '',
    '## Edition and replacement relationships',
    '',
    'Older and newer student and teacher editions are preserved as distinct records. No edition is collapsed or declared obsolete without direct evidence.',
    '',
    '## Bounded recapture plan',
    '',
    '- Catalogue accounting is complete from metadata; task-body capture is not required for this purpose.',
    '- Exact-grade e-tund content, if needed later, must remain teacher-only and be captured only through an authorised internal workflow.',
    '- Multi-grade teacher manuals and supplementary resources require no full-kit recapture. A selected chapter or task may be captured only for a separately scoped instructional need.',
    '- Existing canonical task-body limitations remain a downstream lesson-authoring concern and do not invalidate catalogue ownership.',
    '',
    '## Blockers and next work',
    '',
    ...report.blockers.map((blocker) => `- \`${blocker.code}\`: ${blocker.message}`),
    '',
    'A separate PR is unnecessary for new exact-grade student imports because none were found. Optional future work may evaluate selected supplementary resources or authorised teacher support without changing student ownership.',
    '',
    '## Issue #41 closure status',
    '',
    'The catalogue-capture portion is ready to close after this PR is reviewed and merged: the declared-filter snapshot is defensibly complete, every discovered kit is classified, student gaps have decisions, teacher/support materials are separated, recapture is bounded, and current ownership remains valid. Issue #41 must not be closed automatically. Official curriculum completeness remains separate under #37.',
    '',
    '## Non-guarantees',
    '',
    ...report.non_guarantees.map((item) => `- ${item}`),
    '',
  ];
  return lines.join('\n');
}

export async function buildGrade4CatalogueGapArtifacts(rootDir) {
  const snapshot = buildCatalogueSnapshot();
  const historicalArtifactHashes = await verifyHistoricalBoundaries(rootDir);
  const { manifest, owners } = await manifestOwnership(rootDir, snapshot.records.map((record) => record.kit_id));
  const currentGrade4Routes = manifest.sources.filter((source) => source.grade === 4);
  const expectedRouteIds = grade4RoutePolicy.map((route) => route.id).sort(bytewise);
  const actualRouteIds = currentGrade4Routes.map((route) => route.id).sort(bytewise);
  if (stableJson(expectedRouteIds) !== stableJson(actualRouteIds)) {
    throw new Error('Current Grade 4 manifest routes do not match the canonical route policy');
  }
  const capturedVsLive = snapshot.records
    .map((record) => comparisonRow(record, owners[record.kit_id]))
    .sort((left, right) => Number(left.kit_id) - Number(right.kit_id));
  const summary = summarize(capturedVsLive);
  const report = {
    schema_version: catalogueGapVersion,
    artifact_type: 'grade-4-source-gap-report',
    report_id: 'grade-4-source-gap-review-2026-07-27',
    issue_ref: '#41',
    base_commit: catalogueGapBaseCommit,
    verification_date: catalogueGapVerificationDate,
    completeness_status: snapshot.completeness_status,
    snapshot_path: catalogueSnapshotPath,
    capture_methodology: {
      catalogue_url: catalogueUrl,
      selected_filters: filters,
      displayed_result_count: snapshot.catalogue_interface.displayed_result_count,
      pages_observed: snapshot.catalogue_interface.pagination.pages_observed,
      all_result_pages_captured: snapshot.catalogue_interface.pagination.all_result_pages_captured,
      stable_source_identity: snapshot.catalogue_interface.stable_source_identity,
      direct_kit_details_reviewed: 55,
    },
    canonical_baseline: {
      route_count: 11,
      exclusively_allocated_kit_count: 31,
      canonical_instructional_record_count: 2212,
      supplied_zip_instructional_record_count: 2342,
      nonexclusive_instructional_record_count: 130,
      known_multi_grade_kit_ids: ['161', '200', '476'],
      manifest_coverage_status: 'partial_subject_bounded',
    },
    summary,
    discovery_breakdown: {
      preliminary_seed_kit_ids: ['359', '373', '377', '378', '471', '487', '492', '493', '566'],
      additional_kit_ids_found_by_complete_filter: ['231', '324', '348', '349', '350', '411', '416', '444', '445', '465', '474', '506'],
    },
    live_kit_inventory: snapshot.records.map((record) => ({
      kit_id: record.kit_id,
      title: record.title,
      material_type: record.material_type,
      primary_classification: record.primary_classification,
      secondary_roles: record.secondary_roles,
    })),
    captured_vs_live: capturedVsLive,
    newly_discovered_kits: capturedVsLive
      .filter((row) => row.repository_capture_status === 'not_captured')
      .map((row) => row.kit_id),
    teacher_support_inventory: capturedVsLive
      .filter((row) => row.primary_classification === 'teacher_only')
      .map((row) => row.kit_id),
    student_source_gaps: [],
    multi_grade_shared_inventory: capturedVsLive
      .filter((row) => ['multi_grade_support', 'supplementary_shared'].includes(row.primary_classification))
      .map((row) => row.kit_id),
    edition_relationships: editionRelationships(),
    ownership_decisions: capturedVsLive.map((row) => ({
      kit_id: row.kit_id,
      decision: row.ownership_decision,
    })),
    recapture_decisions: capturedVsLive.map((row) => ({
      kit_id: row.kit_id,
      decision: row.recapture_decision,
      purpose: row.next_action,
    })),
    historical_artifact_hashes: historicalArtifactHashes,
    immutable_archive_verification: {
      archive_count: archiveExpectations.length,
      all_hashes_and_sizes_current: true,
    },
    blockers: [
      {
        code: 'official_curriculum_completeness_out_of_scope',
        message: 'Catalogue completeness does not establish official curriculum completeness; that remains dependent on #37.',
      },
      {
        code: 'canonical_task_bodies_partially_captured',
        message: 'Some canonical task bodies remain incomplete for lesson authoring, but no task-body recapture is required for catalogue accounting.',
      },
    ],
    issue_41_closure_recommendation: 'ready_after_review_and_merge_for_catalogue_capture_scope',
    non_guarantees: [
      'No claim of complete official curriculum coverage is made.',
      'No claim is made about authenticated, unpublished, withdrawn, hidden, or future Opiq catalogue entries.',
      'No complete chapter prose, task body, answer key, illustration, or interactive content was captured.',
      'Teacher materials were classified but not approved for student-facing use.',
      'No pedagogical effectiveness, legal access entitlement, or production readiness is claimed.',
    ],
  };
  return {
    snapshot,
    report,
    snapshotJson: stableJson(snapshot),
    reportJson: stableJson(report),
    markdown: markdownReport(report),
  };
}

export function validateCatalogueSnapshotSemantics(snapshot) {
  const diagnostics = [];
  const complete = snapshot.completeness_status === 'complete_for_declared_filter';
  const requiredCompleteEvidence = [
    snapshot.catalogue_interface?.url,
    snapshot.catalogue_interface?.selected_filters?.grade,
    snapshot.catalogue_interface?.selected_filters?.subject,
    snapshot.catalogue_interface?.selected_filters?.language,
    snapshot.catalogue_interface?.selected_filters?.material_type,
    snapshot.catalogue_interface?.selected_filters?.curriculum_or_programme,
    snapshot.catalogue_interface?.selected_filters?.sort_order,
    snapshot.catalogue_interface?.pagination?.all_result_pages_captured,
    snapshot.catalogue_interface?.displayed_result_count,
    snapshot.catalogue_interface?.stable_source_identity?.value,
  ];
  if (complete && requiredCompleteEvidence.some((value) => value === null || value === undefined || value === false || value === '')) {
    diagnostics.push('complete_status_without_required_filter_evidence');
  }
  if (complete && snapshot.records.some((record) => record.evidence_status === 'search_discovery_only')) {
    diagnostics.push('search_discovery_cannot_prove_completeness');
  }
  if (new Set(snapshot.records.map((record) => record.kit_id)).size !== snapshot.records.length) {
    diagnostics.push('duplicate_live_kit_id');
  }
  return diagnostics.sort(bytewise);
}

export function assertCommittedBytes(expected, actual, artifactPath) {
  const actualText = Buffer.isBuffer(actual) ? actual.toString('utf8') : String(actual);
  if (expected !== actualText) throw new Error(`Stale generated artifact: ${artifactPath}`);
}

export function evidenceContentGuard(value) {
  const text = JSON.stringify(value);
  const forbidden = [
    /answer[_ -]?key/iu,
    /full[_ -]?chapter/iu,
    /student[_ -]?(?:name|id)/iu,
    /authenticated[_ -]?session/iu,
  ];
  return forbidden.some((pattern) => pattern.test(text));
}

export function semanticHash(value) {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}
