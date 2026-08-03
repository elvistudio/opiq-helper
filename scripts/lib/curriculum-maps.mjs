import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import { parseDocument, stringify } from 'yaml';
import { parseOpiqRegressionMarkdown } from './opiq-regression-markdown.mjs';
import { readCompactZip, readZipText } from './compact-zip.mjs';

const officialArtifactType = 'official_curriculum_map';
const courseArtifactTypes = new Set(['book_inventory', 'topic_inventory', 'thematic_unit']);
const gradeProgrammeRouteTypes = new Set([
  'grade_programme_official_curriculum_map',
  'grade_programme_book_inventory',
  'grade_programme_topic_inventory',
]);
const gradeProgrammeCoverageType = 'grade_programme_route_coverage';
const delegatedTeacherWorkPlanMapType = 'teacher_work_plan_curriculum_map';

const courseRouteContracts = new Map([
  ['grade-5-science', {
    artifactPaths: {
      book_inventory: 'curriculum-maps/grade-5-science/book-inventory.yaml',
      topic_inventory: 'curriculum-maps/grade-5-science/topic-inventory.yaml',
    },
    thematicUnitPrefix: 'curriculum-maps/grade-5-science/',
    requireThematicUnit: true,
    allowAmbiguousTopicSelection: false,
  }],
  ['grade-6-science', {
    artifactPaths: {
      book_inventory: 'curriculum-maps/grade-6-science/book-inventory.yaml',
      topic_inventory: 'curriculum-maps/grade-6-science/topic-inventory.yaml',
    },
    requireThematicUnit: false,
    allowAmbiguousTopicSelection: true,
    route: {
      grade: 6,
      subject: 'science',
      subject_et: 'loodusõpetus',
      md_path: 'project-files/outputs/opiq_6klass_loodusopetus.md',
      source_archive: 'project-files/inputs/final-zips/opiq_6klass_elutingimused_soos_v2.zip',
      qa_path: 'project-files/outputs/opiq_6klass_loodusopetus_qa.json',
      record_count: 436,
      coverage_status: 'available_not_curriculum_verified',
    },
    sourceAudit: {
      source_records: 442,
      canonical_records: 436,
      cover_detail_records_excluded: 6,
      source_books: 6,
      books_with_page_records: 6,
    },
    languageCounts: { et: 283, ru: 153 },
    checksums: {
      source_archive_sha256: 'aa028590adc19ae5c1823a4b9bbb5eeaaba092f596a400c646972d99c398ed72',
      output_file_sha256: '14c26e7227079f4d3af38f1b7d01b95fad708821a14c75deeb7d6e3eaf97f0a5',
    },
    books: [
      {
        book_id: '5k_loodusõpetus_avita_2025_est', kit_id: 572,
        kit_url: 'https://www.opiq.ee/Kit/Details/572', title: 'Loodusõpetus 6. klassile (2025)',
        publisher: 'Avita', language: 'et', source_record_count: 57, canonical_record_count: 56,
      },
      {
        book_id: '5k_loodusõpetus_avita_est', kit_id: 8,
        kit_url: 'https://www.opiq.ee/Kit/Details/8', title: 'Loodusõpetus 6. klassile',
        publisher: 'Avita', language: 'et', source_record_count: 70, canonical_record_count: 69,
      },
      {
        book_id: '5k_loodusõpetus_koolibri_2025_est', kit_id: 580,
        kit_url: 'https://www.opiq.ee/Kit/Details/580', title: 'Loodusõpetus 6. klassile 2025',
        publisher: 'Koolibri', language: 'et', source_record_count: 74, canonical_record_count: 73,
      },
      {
        book_id: '5k_loodusõpetus_koolibri_est', kit_id: 98,
        kit_url: 'https://www.opiq.ee/Kit/Details/98', title: 'Loodusõpetus 6. klassile',
        publisher: 'Koolibri', language: 'et', source_record_count: 86, canonical_record_count: 85,
      },
      {
        book_id: '5k_loodusõpetus_avita_rus', kit_id: 18,
        kit_url: 'https://www.opiq.ee/Kit/Details/18', title: 'Природоведение для 6 класса',
        publisher: 'Avita', language: 'ru', source_record_count: 68, canonical_record_count: 67,
      },
      {
        book_id: '5k_loodusõpetus_koolibri_rus', kit_id: 269,
        kit_url: 'https://www.opiq.ee/Kit/Details/269', title: 'Природо­ведение 6 класс',
        publisher: 'Koolibri', language: 'ru', source_record_count: 87, canonical_record_count: 86,
      },
    ],
  }],
  ['grade-7-geography', {
    artifactPaths: {
      book_inventory: 'curriculum-maps/grade-7-geography/book-inventory.yaml',
      topic_inventory: 'curriculum-maps/grade-7-geography/topic-inventory.yaml',
    },
    requireThematicUnit: false,
    allowAmbiguousTopicSelection: true,
    route: {
      grade: 7,
      subject: 'geography',
      subject_et: 'geograafia',
      md_path: 'project-files/outputs/opiq_7klass_geograafia.md',
      source_archive: 'project-files/inputs/final-zips/opiq_7klass_sissejuhatus_geograafiasse_v2.zip',
      qa_path: 'project-files/outputs/opiq_7klass_geograafia_qa.json',
      record_count: 178,
      coverage_status: 'available_not_curriculum_verified',
    },
    sourceAudit: {
      source_records: 186,
      canonical_records: 178,
      cover_detail_records_excluded: 7,
      administrative_records_excluded: 1,
      source_books: 5,
      books_with_page_records: 5,
    },
    languageCounts: { et: 102, ru: 76 },
    checksums: {
      source_archive_sha256: '21d7d516cae1bf756827c6feb1a64a71b0ca85f0deabb6aac6a4732c363acd03',
      output_file_sha256: 'f25b994c32493388ef1f9179e798e0173e9326f13669db9d5a4aa45d3d0d868d',
    },
    validateArchiveSubject: false,
    verifiedOn: '2026-08-02',
    mapIds: {
      book_inventory: 'grade-7-geography-book-inventory',
      topic_inventory: 'grade-7-geography-topic-inventory',
    },
    administrativeUrls: ['https://www.opiq.ee/kit/19/chapter/903'],
    coverDetailCounts: {
      '7k__geograafia_avita_est': 1,
      '7k__geograafia_koolibri_est': 2,
      '7k__geograafia_loodus_avita_est': 1,
      '7k__geograafia_koolibri_rus': 2,
      '7k__geograafia_avita_rus': 1,
    },
    topicIds: [
      'geography-introduction-and-research-methods',
      'earth-shape-size-continents-and-oceans',
      'map-types-atlases-legends-and-generalization',
      'scale-distance-directions-and-orientation',
      'geographic-coordinates',
      'digital-maps-gis-and-satellite-imagery',
      'time-zones-and-date-line',
      'earth-interior-and-plate-tectonics',
      'earthquakes-volcanoes-and-tsunamis',
      'rocks-sediments-and-rock-cycle',
      'relief-landforms-and-elevation-mapping',
      'mountains-plains-and-ocean-floor-relief',
      'landform-change-weathering-erosion-and-human-impact',
      'countries-peoples-and-cultural-diversity',
      'population-distribution-change-migration-and-urbanization',
    ],
    books: [
      {
        book_id: '7k__geograafia_avita_est', kit_id: 543,
        kit_url: 'https://www.opiq.ee/Kit/Details/543', title: 'Geograafia 7. klassile',
        publisher: 'Avita', language: 'et', source_record_count: 29, canonical_record_count: 28,
      },
      {
        book_id: '7k__geograafia_koolibri_est', kit_id: 96,
        kit_url: 'https://www.opiq.ee/Kit/Details/96', title: 'Geograafia 7. klassile',
        publisher: 'unknown', language: 'et', source_record_count: 38, canonical_record_count: 36,
      },
      {
        book_id: '7k__geograafia_loodus_avita_est', kit_id: 2,
        kit_url: 'https://www.opiq.ee/Kit/Details/2', title: 'Loodusgeograafia 7. klassile',
        publisher: 'Avita', language: 'et', source_record_count: 39, canonical_record_count: 38,
      },
      {
        book_id: '7k__geograafia_koolibri_rus', kit_id: 301,
        kit_url: 'https://www.opiq.ee/Kit/Details/301', title: 'География 7 класс',
        publisher: 'Koolibri', language: 'ru', source_record_count: 39, canonical_record_count: 37,
      },
      {
        book_id: '7k__geograafia_avita_rus', kit_id: 19,
        kit_url: 'https://www.opiq.ee/Kit/Details/19', title: 'География для 7 класса',
        publisher: 'Avita', language: 'ru', source_record_count: 41, canonical_record_count: 39,
      },
    ],
  }],
  ['grade-7-science', {
    artifactPaths: {
      book_inventory: 'curriculum-maps/grade-7-science/book-inventory.yaml',
      topic_inventory: 'curriculum-maps/grade-7-science/topic-inventory.yaml',
    },
    requireThematicUnit: false,
    allowAmbiguousTopicSelection: true,
    route: {
      grade: 7,
      subject: 'science',
      subject_et: 'loodusõpetus',
      md_path: 'project-files/outputs/opiq_7klass_loodusopetus.md',
      source_archive: 'project-files/inputs/final-zips/opiq_7klass_loodusteadused_v2.zip',
      qa_path: 'project-files/outputs/opiq_7klass_loodusopetus_qa.json',
      record_count: 314,
      coverage_status: 'available_not_curriculum_verified',
    },
    sourceAudit: {
      source_records: 325,
      canonical_records: 314,
      cover_detail_records_excluded: 7,
      administrative_records_excluded: 4,
      source_books: 5,
      books_with_page_records: 5,
    },
    languageCounts: { et: 179, ru: 135 },
    checksums: {
      source_archive_sha256: '693b231023bdf9fe4ff083f09b363798476c76619151f65cedf3ae5067f2fc8e',
      output_file_sha256: '4f9be8d91fe5a44711d991c2ac8ac4a3e3910d14a5b75d52c4526cc7d8687373',
    },
    verifiedOn: '2026-08-03',
    mapIds: {
      book_inventory: 'grade-7-science-book-inventory',
      topic_inventory: 'grade-7-science-topic-inventory',
    },
    administrativeUrls: [
      'https://www.opiq.ee/kit/546/chapter/32440',
      'https://www.opiq.ee/kit/44/chapter/2118',
      'https://www.opiq.ee/kit/64/chapter/3110',
      'https://www.opiq.ee/kit/64/chapter/3111',
    ],
    coverDetailCounts: {
      '7k_loodusõpetus_avita_2024_est': 1,
      '7k_loodusõpetus_avita_est': 2,
      '7k_loodusõpetus_koolibri_est': 1,
      '7k_loodusõpetus_koolibri_rus': 2,
      '7k_loodusõpetus_avita_rus': 1,
    },
    recommendationRoles: {
      russian_explanation: ['core_explanation_ru'],
      estonian_terminology_or_visuals: ['core_source_et', 'terminology_et', 'definition_et', 'bilingual_visual'],
      practice: ['practice_ru', 'practice_et', 'experiment', 'data_interpretation', 'revision', 'assessment'],
      practical_or_assessment: ['practice_ru', 'practice_et', 'experiment', 'fieldwork', 'revision', 'assessment'],
    },
    topicIds: [
      'natural-sciences-technology-and-information',
      'scientific-method-observation-and-experiment',
      'measurement-instruments-units-and-reliability',
      'length-area-volume-mass-and-plan',
      'data-tables-graphs-and-variables',
      'models-bodies-and-natural-phenomena',
      'atoms-elements-and-periodic-table',
      'molecules-cells-ions-and-chemical-bonds',
      'states-of-matter-and-phase-changes',
      'density-material-properties-and-earth-materials',
      'pure-substances-mixtures-solutions-and-separation',
      'motion-speed-and-force',
      'work-energy-and-transformations',
      'temperature-and-heat-transfer',
      'chemical-reactions-combustion-and-experiments',
      'photosynthesis-respiration-and-carbon-cycle',
      'ecosystems-adaptation-growth-and-natural-balance',
      'greenhouse-effect-and-climate-change',
      'sustainable-consumption-footprint-and-recycling',
    ],
    books: [
      {
        book_id: '7k_loodusõpetus_avita_2024_est', kit_id: 546,
        kit_url: 'https://www.opiq.ee/Kit/Details/546', title: 'Loodusõpetus 7. klassile (2024)',
        publisher: 'Avita', language: 'et', source_record_count: 36, canonical_record_count: 34,
      },
      {
        book_id: '7k_loodusõpetus_avita_est', kit_id: 44,
        kit_url: 'https://www.opiq.ee/Kit/Details/44', title: 'Loodusõpetus 7. klassile',
        publisher: 'unknown', language: 'et', source_record_count: 62, canonical_record_count: 59,
      },
      {
        book_id: '7k_loodusõpetus_koolibri_est', kit_id: 100,
        kit_url: 'https://www.opiq.ee/Kit/Details/100', title: 'Loodusõpetus 7. klassile',
        publisher: 'Koolibri', language: 'et', source_record_count: 87, canonical_record_count: 86,
      },
      {
        book_id: '7k_loodusõpetus_koolibri_rus', kit_id: 336,
        kit_url: 'https://www.opiq.ee/Kit/Details/336', title: 'Естествознание 7 класс',
        publisher: 'unknown', language: 'ru', source_record_count: 78, canonical_record_count: 76,
      },
      {
        book_id: '7k_loodusõpetus_avita_rus', kit_id: 64,
        kit_url: 'https://www.opiq.ee/Kit/Details/64', title: 'Природоведение для 7 класса',
        publisher: 'Avita', language: 'ru', source_record_count: 62, canonical_record_count: 59,
      },
    ],
  }],
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value) {
  return String(value ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim();
}

export function relativeDisplay(rootDir, filePath) {
  const relative = path.relative(rootDir, filePath);
  return relative && !relative.startsWith('..') ? relative.split(path.sep).join('/') : filePath;
}

export function safeRepositoryPath(rootDir, repositoryPath, label) {
  if (
    typeof repositoryPath !== 'string'
    || path.isAbsolute(repositoryPath)
    || repositoryPath.includes('\\')
    || repositoryPath.split('/').includes('..')
  ) {
    throw new Error(`${label} must be a repository-relative path.`);
  }
  const resolved = path.resolve(rootDir, repositoryPath);
  const root = path.resolve(rootDir);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`${label} points outside the repository.`);
  }
  return resolved;
}

export async function listYamlFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listYamlFiles(entryPath));
    else if (entry.isFile() && /\.ya?ml$/iu.test(entry.name)) files.push(entryPath);
  }
  return files;
}

export function parseStrictCurriculumYaml(text, file = '<memory>') {
  const document = parseDocument(text, {
    strict: true,
    uniqueKeys: true,
    schema: 'core',
    customTags: [],
    prettyErrors: true,
  });
  if (document.errors.length > 0) {
    const details = document.errors.map((error) => error.message).join('\n');
    throw new Error(`${file}: invalid YAML:\n${details}`);
  }
  const value = document.toJS({ maxAliasCount: 0 });
  if (!isPlainObject(value)) throw new Error(`${file}: YAML root must be an object.`);
  return value;
}

export function serializeCurriculumYaml(value) {
  return stringify(value, {
    aliasDuplicateObjects: false,
    lineWidth: 0,
  });
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function parseJsonLines(text, file) {
  const records = [];
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line);
      if (!isPlainObject(value)) throw new Error('record must be an object');
      records.push(value);
    } catch (error) {
      throw new Error(`${file}:${index + 1}: invalid JSONL record: ${error.message}`);
    }
  }
  return records;
}

export async function loadCurriculumMapRepository({
  rootDir = process.cwd(),
  manifestPath = 'source-manifest.json',
  mapsPath = 'curriculum-maps',
  curriculumSchemaPath = 'schemas/curriculum-map.schema.json',
  courseSchemaPath = 'schemas/course-map.schema.json',
  gradeProgrammeRouteSchemaPath = 'schemas/grade-programme-route.schema.json',
  gradeProgrammeCoverageSchemaPath = 'schemas/grade-programme-coverage.schema.json',
  grade2ProgrammeRouteSchemaPath = 'schemas/grade-2-programme-route.schema.json',
  grade2ProgrammeCoverageSchemaPath = 'schemas/grade-2-programme-coverage.schema.json',
  additionalSourceIds = [],
} = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const manifestFile = safeRepositoryPath(absoluteRoot, manifestPath, 'manifest path');
  const mapsDirectory = safeRepositoryPath(absoluteRoot, mapsPath, 'curriculum maps path');
  const curriculumSchemaFile = safeRepositoryPath(absoluteRoot, curriculumSchemaPath, 'curriculum schema path');
  const courseSchemaFile = safeRepositoryPath(absoluteRoot, courseSchemaPath, 'course schema path');
  const gradeProgrammeRouteSchemaFile = safeRepositoryPath(absoluteRoot, gradeProgrammeRouteSchemaPath, 'grade programme route schema path');
  const gradeProgrammeCoverageSchemaFile = safeRepositoryPath(absoluteRoot, gradeProgrammeCoverageSchemaPath, 'grade programme coverage schema path');
  const grade2ProgrammeRouteSchemaFile = safeRepositoryPath(absoluteRoot, grade2ProgrammeRouteSchemaPath, 'Grade 2 programme route schema path');
  const grade2ProgrammeCoverageSchemaFile = safeRepositoryPath(absoluteRoot, grade2ProgrammeCoverageSchemaPath, 'Grade 2 programme coverage schema path');

  const [
    manifestText,
    curriculumSchemaText,
    courseSchemaText,
    gradeProgrammeRouteSchemaText,
    gradeProgrammeCoverageSchemaText,
    grade2ProgrammeRouteSchemaText,
    grade2ProgrammeCoverageSchemaText,
    yamlFiles,
  ] = await Promise.all([
    fs.readFile(manifestFile, 'utf8'),
    fs.readFile(curriculumSchemaFile, 'utf8'),
    fs.readFile(courseSchemaFile, 'utf8'),
    fs.readFile(gradeProgrammeRouteSchemaFile, 'utf8'),
    fs.readFile(gradeProgrammeCoverageSchemaFile, 'utf8'),
    fs.readFile(grade2ProgrammeRouteSchemaFile, 'utf8'),
    fs.readFile(grade2ProgrammeCoverageSchemaFile, 'utf8'),
    listYamlFiles(mapsDirectory),
  ]);
  const manifest = JSON.parse(manifestText);
  const artifacts = [];
  for (const yamlFile of yamlFiles) {
    const file = relativeDisplay(absoluteRoot, yamlFile);
    const text = await fs.readFile(yamlFile, 'utf8');
    artifacts.push({ file, text, data: parseStrictCurriculumYaml(text, file) });
  }

  const courseSourceIds = new Set([
    ...additionalSourceIds,
    ...artifacts
      .filter((artifact) => courseArtifactTypes.has(artifact.data.artifact_type))
      .map((artifact) => artifact.data.canonical_route?.source_id)
      .filter(Boolean),
    ...artifacts
      .filter((artifact) => gradeProgrammeRouteTypes.has(artifact.data.artifact_type))
      .map((artifact) => artifact.data.canonical_route?.source_id)
      .filter(Boolean),
  ]);
  const routes = {};
  for (const sourceId of [...courseSourceIds].sort()) {
    const source = manifest.sources?.find((candidate) => candidate.id === sourceId);
    if (!source) continue;
    const mdFile = safeRepositoryPath(absoluteRoot, source.md_path, `${sourceId} md_path`);
    const qaFile = safeRepositoryPath(absoluteRoot, source.qa_path, `${sourceId} qa_path`);
    const archiveFile = safeRepositoryPath(absoluteRoot, source.source_archive, `${sourceId} source_archive`);
    const [markdownBuffer, qaText, archiveBuffer, archive, archiveStat] = await Promise.all([
      fs.readFile(mdFile),
      fs.readFile(qaFile, 'utf8'),
      fs.readFile(archiveFile),
      readCompactZip(archiveFile),
      fs.lstat(archiveFile),
    ]);
    const markdown = markdownBuffer.toString('utf8');
    const parsedMarkdown = parseOpiqRegressionMarkdown(markdown, {
      sourceId,
      mdPath: source.md_path,
    });
    const archiveIndex = JSON.parse(readZipText(archive, 'index.json'));
    const archiveRecords = parseJsonLines(
      readZipText(archive, 'opiq_lookup.jsonl'),
      `${source.source_archive}:opiq_lookup.jsonl`,
    );
    routes[sourceId] = {
      source,
      records: parsedMarkdown.records,
      qa: JSON.parse(qaText),
      archiveIndex,
      archiveRecords,
      archiveIsRegularFile: archiveStat.isFile(),
      archiveSha256: sha256(archiveBuffer),
      markdownSha256: sha256(markdownBuffer),
    };
  }

  return {
    rootDir: absoluteRoot,
    manifest,
    schemas: {
      curriculum: JSON.parse(curriculumSchemaText),
      course: JSON.parse(courseSchemaText),
      gradeProgrammeRoute: JSON.parse(gradeProgrammeRouteSchemaText),
      gradeProgrammeCoverage: JSON.parse(gradeProgrammeCoverageSchemaText),
      grade2ProgrammeRoute: JSON.parse(grade2ProgrammeRouteSchemaText),
      grade2ProgrammeCoverage: JSON.parse(grade2ProgrammeCoverageSchemaText),
    },
    artifacts,
    routes,
    loadedArtifactPaths: [...new Set([
      manifestPath,
      curriculumSchemaPath,
      courseSchemaPath,
      gradeProgrammeRouteSchemaPath,
      gradeProgrammeCoverageSchemaPath,
      grade2ProgrammeRouteSchemaPath,
      grade2ProgrammeCoverageSchemaPath,
      ...artifacts.map((artifact) => artifact.file),
      ...Object.values(routes).flatMap(({ source }) => [
        source.md_path,
        source.qa_path,
        source.source_archive,
      ]),
    ])].sort((left, right) => Buffer.from(left).compare(Buffer.from(right))),
  };
}

function createSchemaValidators(schemas) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  return {
    curriculum: ajv.compile(schemas.curriculum),
    course: ajv.compile(schemas.course),
    gradeProgrammeRoute: ajv.compile(schemas.gradeProgrammeRoute),
    gradeProgrammeCoverage: ajv.compile(schemas.gradeProgrammeCoverage),
    grade2ProgrammeRoute: ajv.compile(schemas.grade2ProgrammeRoute),
    grade2ProgrammeCoverage: ajv.compile(schemas.grade2ProgrammeCoverage),
  };
}

function schemaReason(error) {
  if (error.keyword === 'additionalProperties') {
    return `unknown field ${error.params.additionalProperty}`;
  }
  if (error.keyword === 'required') return `missing required field ${error.params.missingProperty}`;
  return error.message ?? `failed ${error.keyword}`;
}

export function makeDiagnostic(severity, file, field, reason) {
  return { severity, file, field: field || '/', reason };
}

function addSchemaDiagnostics(diagnostics, artifact, validator) {
  if (validator(artifact.data)) return;
  for (const error of validator.errors ?? []) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      error.instancePath || '/',
      schemaReason(error),
    ));
  }
}

function addDuplicateDiagnostics(diagnostics, values, { file, field, label }) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) diagnostics.push(makeDiagnostic('error', file, field, `duplicate ${label}: ${value}`));
    seen.add(value);
  }
}

function findRouteForOfficialMap(manifest, map) {
  return manifest.sources?.filter((source) => source.grade === map.grade && source.subject === map.subject) ?? [];
}

function validateOfficialArtifact(diagnostics, artifact, context) {
  const map = artifact.data;
  const routes = findRouteForOfficialMap(context.manifest, map);
  if (routes.length !== 1) {
    diagnostics.push(makeDiagnostic(
      'error', artifact.file, '/grade',
      `expected exactly one manifest route for grade ${map.grade} subject ${map.subject}, found ${routes.length}`,
    ));
  } else if (routes[0].subject_et !== map.subject_et) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/subject_et', `expected ${routes[0].subject_et}`));
  }

  addDuplicateDiagnostics(diagnostics, (map.official_documents ?? []).map((entry) => entry.document_id), {
    file: artifact.file, field: '/official_documents', label: 'official document ID',
  });
  addDuplicateDiagnostics(diagnostics, (map.outcomes ?? []).map((entry) => entry.outcome_id), {
    file: artifact.file, field: '/outcomes', label: 'official outcome ID',
  });
  const documents = new Map((map.official_documents ?? []).map((entry) => [entry.document_id, entry]));
  for (const [index, outcome] of (map.outcomes ?? []).entries()) {
    const field = `/outcomes/${index}`;
    const document = documents.get(outcome.document_id);
    if (!document) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/document_id`, `unknown official document ${outcome.document_id}`));
    if (outcome.evidence_status === 'verified') {
      if (!document || document.evidence_status !== 'verified') {
        diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/evidence_status`, 'verified outcome requires a verified official document'));
      }
      if (!outcome.wording_et || !outcome.translation_ru || !outcome.verification?.verified_on) {
        diagnostics.push(makeDiagnostic('error', artifact.file, field, 'verified outcome requires Estonian wording, Russian translation, and verification metadata'));
      }
    }
    const scopeFields = map.official_scope?.kind === 'school_stage'
      ? ['kind', 'school_stage', 'terminal_grade', 'grade_allocation_basis', 'exact_grade_claimed']
      : ['kind', 'grade', 'grade_allocation_basis', 'exact_grade_claimed'];
    if (scopeFields.some((name) => outcome.official_scope?.[name] !== map.official_scope?.[name])) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/official_scope`, 'outcome scope must match the official map scope'));
    }
  }
  if (map.official_scope?.kind === 'school_stage' && map.official_scope.exact_grade_claimed !== false) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/official_scope', 'school-stage evidence cannot claim official exact-grade allocation'));
  }
  if (map.completeness?.declared_complete) {
    const unverified = (map.outcomes ?? []).filter((outcome) => outcome.evidence_status !== 'verified');
    if (map.completeness.status !== 'verified' || unverified.length > 0 || (map.completeness.known_gaps ?? []).length > 0) {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/completeness', 'complete official map requires verified outcomes and no known gaps'));
    }
  }
}

function validateGradeProgrammeRouteArtifact(diagnostics, artifact, context) {
  const data = artifact.data;
  const source = context.manifest.sources?.find((candidate) => candidate.id === data.route_id);
  if (!source || source.grade !== data.grade || ![2, 4].includes(data.grade)) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/route_id', `unknown Grade ${data.grade ?? '<missing>'} manifest route ${data.route_id ?? '<missing>'}`));
    return;
  }
  const comparisons = [
    ['route_id', data.canonical_route?.source_id, source.id],
    ['canonical_route/md_path', data.canonical_route?.md_path, source.md_path],
    [
      data.grade === 2 ? 'canonical_route/primary_source_archive' : 'canonical_route/source_archive',
      data.grade === 2 ? data.canonical_route?.primary_source_archive : data.canonical_route?.source_archive,
      source.source_archive,
    ],
    ['canonical_route/qa_path', data.canonical_route?.qa_path, source.qa_path],
    ['record_count', data.record_count, source.record_count],
  ];
  for (const [field, actual, expected] of comparisons) {
    if (actual !== expected) diagnostics.push(makeDiagnostic('error', artifact.file, `/${field}`, `expected ${expected}, found ${actual}`));
  }
  const routeData = context.routes[source.id];
  if (!routeData || routeData.records.length !== source.record_count) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/record_count', 'manifest, canonical Markdown and route artifact record counts must agree'));
  }
  if (data.artifact_type === 'grade_programme_book_inventory') {
    if (data.source_records?.length !== source.record_count) {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/source_records', `expected ${source.record_count} source records`));
    }
    const urls = data.source_records?.map((record) => record.canonical_url) ?? [];
    addDuplicateDiagnostics(diagnostics, urls, { file: artifact.file, field: '/source_records', label: 'canonical URL' });
    const routeUrls = new Set(routeData?.records.map((record) => record.url) ?? []);
    for (const url of urls) {
      if (!routeUrls.has(url)) diagnostics.push(makeDiagnostic('error', artifact.file, '/source_records', `URL is not registered in ${source.md_path}: ${url}`));
    }
  }
  if (data.artifact_type === 'grade_programme_topic_inventory') {
    const recordIds = data.topics?.flatMap((topic) => topic.source_record_ids) ?? [];
    if (new Set(recordIds).size !== source.record_count) {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/topics', `topic inventory must preserve exactly ${source.record_count} source record identities`));
    }
  }
  if (data.artifact_type === 'grade_programme_official_curriculum_map') {
    if (data.completeness?.declared_complete) diagnostics.push(makeDiagnostic('error', artifact.file, '/completeness', `Grade ${data.grade} route map must remain incomplete`));
    if (data.official_scope?.kind === 'school_stage' && data.official_scope.exact_grade_claimed !== false) {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/official_scope', `school-stage evidence cannot claim exact Grade ${data.grade} scope`));
    }
  }
}

function validateGradeProgrammeCoverageArtifact(diagnostics, artifact, context) {
  const data = artifact.data;
  const source = context.manifest.sources?.find((candidate) => candidate.id === data.route_id);
  if (!source || source.grade !== data.grade || ![2, 4].includes(data.grade)) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/route_id', `unknown Grade ${data.grade ?? '<missing>'} manifest route ${data.route_id ?? '<missing>'}`));
  }
  if (data.completeness?.declared_complete) diagnostics.push(makeDiagnostic('error', artifact.file, '/completeness', `Grade ${data.grade} route coverage must remain incomplete`));
  if ((data.rows ?? []).some((row) => (
    row.source_topic_presence === 'heading_only' && row.coverage_status === 'verified'
  ))) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/rows', 'heading-only evidence cannot prove verified curriculum coverage'));
  }
}

export function validateCanonicalRoute(diagnostics, artifact, context) {
  const data = artifact.data;
  const declared = data.canonical_route;
  const source = context.manifest.sources?.find((candidate) => candidate.id === declared?.source_id);
  if (!source) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/canonical_route/source_id', `unknown manifest source ${declared?.source_id ?? '<missing>'}`));
    return null;
  }
  const comparisons = [
    ['grade', data.grade, source.grade],
    ['subject', data.subject, source.subject],
    ['subject_et', data.subject_et, source.subject_et],
    ['canonical_route/md_path', declared.md_path, source.md_path],
    ['canonical_route/source_archive', declared.source_archive, source.source_archive],
    ['canonical_route/qa_path', declared.qa_path, source.qa_path],
  ];
  for (const [field, actual, expected] of comparisons) {
    if (actual !== expected) diagnostics.push(makeDiagnostic('error', artifact.file, `/${field}`, `expected ${expected}, found ${actual}`));
  }
  if (data.instruction_language !== 'ru' || data.subject_support_language !== 'et') {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/instruction_language', 'course must use Russian instruction with Estonian subject support'));
  }
  if (!source.languages?.includes('ru') || !source.languages?.includes('et')) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/canonical_route', 'pilot route must register both Russian and Estonian source languages'));
  }
  return context.routes[source.id] ?? null;
}

function extractKitId(url) {
  const match = /^https:\/\/www\.opiq\.ee\/kit\/(?:details\/)?(\d+)(?:\/|$)/iu.exec(url ?? '');
  return match ? Number(match[1]) : null;
}

function countBy(records, field) {
  const counts = new Map();
  for (const record of records) counts.set(record[field], (counts.get(record[field]) ?? 0) + 1);
  return counts;
}

function validateCourseArtifactContract(diagnostics, artifact) {
  const sourceId = artifact.data.canonical_route?.source_id;
  const contract = courseRouteContracts.get(sourceId);
  if (!contract) {
    diagnostics.push(makeDiagnostic(
      'error', artifact.file, '/canonical_route/source_id',
      `course artifacts are not registered for route ${sourceId ?? '<missing>'}`,
    ));
    return null;
  }
  const type = artifact.data.artifact_type;
  if (type === 'thematic_unit') {
    if (!contract.thematicUnitPrefix || !artifact.file.startsWith(contract.thematicUnitPrefix)) {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/', `thematic units are not registered at this path for ${sourceId}`));
    }
  } else {
    const expectedPath = contract.artifactPaths[type];
    if (artifact.file !== expectedPath) {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/', `expected ${type} at ${expectedPath ?? '<no registered path>'}`));
    }
  }
  return contract;
}

function compareContractField(diagnostics, file, field, actual, expected) {
  if (actual !== expected) diagnostics.push(makeDiagnostic('error', file, field, `expected ${expected}, found ${actual}`));
}

function validateRegisteredRouteEvidence(diagnostics, artifacts, routeData, contract, sourceId) {
  if (!routeData) {
    diagnostics.push(makeDiagnostic('error', `curriculum-maps/${sourceId}`, '/', `registered ${sourceId} route evidence was not loaded`));
    return;
  }
  const source = routeData.source;
  for (const [field, expected] of Object.entries(contract.route)) {
    compareContractField(diagnostics, 'source-manifest.json', `/${field}`, source[field], expected);
  }
  if (!routeData.archiveIsRegularFile) {
    diagnostics.push(makeDiagnostic('error', source.source_archive, '/', 'source archive must be a regular file'));
  }
  compareContractField(
    diagnostics, source.qa_path, '/checksums/source_archive_sha256',
    routeData.qa.checksums?.source_archive_sha256, contract.checksums.source_archive_sha256,
  );
  compareContractField(
    diagnostics, source.qa_path, '/checksums/output_file_sha256',
    routeData.qa.checksums?.output_file_sha256, contract.checksums.output_file_sha256,
  );
  compareContractField(
    diagnostics, source.source_archive, '/sha256', routeData.archiveSha256,
    routeData.qa.checksums?.source_archive_sha256,
  );
  compareContractField(
    diagnostics, source.md_path, '/sha256', routeData.markdownSha256,
    routeData.qa.checksums?.output_file_sha256,
  );
  const qaComparisons = [
    ['source_id', routeData.qa.source_id, sourceId],
    ['source_archive', routeData.qa.source_archive, source.source_archive],
    ['output_file', routeData.qa.output_file, source.md_path],
    ['source_records', routeData.qa.source_records, contract.sourceAudit.source_records],
    ['page_records_included', routeData.qa.page_records_included, contract.sourceAudit.canonical_records],
    ['cover_detail_records_excluded', routeData.qa.cover_detail_records_excluded, contract.sourceAudit.cover_detail_records_excluded],
    ['normalized_grade', routeData.qa.normalized_grade, contract.route.grade],
    ['normalized_subject/en', routeData.qa.normalized_subject?.en, contract.route.subject],
    ['normalized_subject/et', routeData.qa.normalized_subject?.et, contract.route.subject_et],
  ];
  if (Object.hasOwn(contract.sourceAudit, 'administrative_records_excluded')) {
    qaComparisons.push([
      'administrative_records_excluded',
      routeData.qa.administrative_records_excluded,
      contract.sourceAudit.administrative_records_excluded,
    ]);
  }
  for (const [field, actual, expected] of qaComparisons) {
    compareContractField(diagnostics, source.qa_path, `/${field}`, actual, expected);
  }
  for (const [language, expected] of Object.entries(contract.languageCounts)) {
    compareContractField(diagnostics, source.qa_path, `/languages/${language}`, routeData.qa.languages?.[language], expected);
  }
  compareContractField(diagnostics, source.qa_path, '/languages', Object.keys(routeData.qa.languages ?? {}).length, 2);
  compareContractField(diagnostics, source.qa_path, `/grades/${contract.route.grade}`, routeData.qa.grades?.[String(contract.route.grade)], contract.sourceAudit.canonical_records);
  compareContractField(diagnostics, source.qa_path, '/grades', Object.keys(routeData.qa.grades ?? {}).length, 1);

  const expectedBooks = new Map(contract.books.map((book) => [book.book_id, book]));
  const archiveBooks = new Map((routeData.archiveIndex.books ?? []).map((book) => [book.id, book]));
  const archiveBookIds = routeData.archiveRecords.map((record) => record.book_id);
  const canonicalBookIds = routeData.records.map((record) => record.book_id);
  for (const bookId of new Set([...archiveBookIds, ...canonicalBookIds])) {
    if (!expectedBooks.has(bookId)) diagnostics.push(makeDiagnostic('error', source.source_archive, '/books', `foreign or unknown book ID ${bookId}`));
  }
  for (const [index, record] of routeData.archiveRecords.entries()) {
    const expectedBook = expectedBooks.get(record.book_id);
    if (!expectedBook) continue;
    const expectedArchiveGrade = sourceId === 'grade-6-science' && expectedBook.language === 'ru'
      ? 5
      : contract.route.grade;
    const comparisons = [
      ['grade', record.grade, expectedArchiveGrade],
      ['language', record.language, expectedBook.language],
      ['publisher', record.publisher || 'unknown', expectedBook.publisher],
    ];
    if (contract.validateArchiveSubject !== false) {
      comparisons.push(
        ['subject_en', record.subject_en, contract.route.subject],
        ['subject_et', record.subject_et, contract.route.subject_et],
      );
    }
    for (const [field, actual, expected] of comparisons) {
      if (actual !== expected) diagnostics.push(makeDiagnostic('error', source.source_archive, `/opiq_lookup.jsonl/${index}/${field}`, `expected ${expected}, found ${actual}`));
    }
  }
  compareContractField(diagnostics, source.source_archive, '/recordCount', routeData.archiveIndex.recordCount, contract.sourceAudit.source_records);
  compareContractField(diagnostics, source.source_archive, '/books', archiveBooks.size, contract.sourceAudit.source_books);
  compareContractField(diagnostics, source.md_path, '/records', routeData.records.length, contract.sourceAudit.canonical_records);

  const canonicalUrls = routeData.records.map((record) => record.url);
  addDuplicateDiagnostics(diagnostics, canonicalUrls, { file: source.md_path, field: '/', label: 'canonical URL' });
  const coverRecords = routeData.archiveRecords.filter((record) => /^https:\/\/www\.opiq\.ee\/Kit\/Details\//u.test(record.url));
  const administrativeUrls = new Set(contract.administrativeUrls ?? []);
  const administrativeRecords = routeData.archiveRecords.filter((record) => administrativeUrls.has(record.url));
  const pageRecords = routeData.archiveRecords.filter((record) => (
    !/^https:\/\/www\.opiq\.ee\/Kit\/Details\//u.test(record.url)
    && !administrativeUrls.has(record.url)
  ));
  addDuplicateDiagnostics(diagnostics, pageRecords.map((record) => record.url), {
    file: source.source_archive, field: '/opiq_lookup.jsonl', label: 'source URL',
  });
  compareContractField(diagnostics, source.source_archive, '/cover_records', coverRecords.length, contract.sourceAudit.cover_detail_records_excluded);
  compareContractField(
    diagnostics,
    source.source_archive,
    '/administrative_records',
    administrativeRecords.length,
    contract.sourceAudit.administrative_records_excluded ?? 0,
  );
  compareContractField(diagnostics, source.source_archive, '/page_records', pageRecords.length, contract.sourceAudit.canonical_records);
  const canonicalByUrl = new Map(routeData.records.map((record) => [record.url, record]));
  const sourcePageByUrl = new Map(pageRecords.map((record) => [record.url, record]));
  for (const url of new Set([...canonicalByUrl.keys(), ...sourcePageByUrl.keys()])) {
    const canonical = canonicalByUrl.get(url);
    const archiveRecord = sourcePageByUrl.get(url);
    if (!canonical || !archiveRecord) {
      diagnostics.push(makeDiagnostic('error', source.md_path, '/', `archive and canonical URL sets disagree for ${url}`));
      continue;
    }
    const comparisons = [
      ['book_id', canonical.book_id, archiveRecord.book_id],
      ['title', normalizeText(canonical.title), normalizeText(archiveRecord.title)],
      ['language', canonical.language, archiveRecord.language],
      ['grade', canonical.class, contract.route.grade],
      ['subject', canonical.subject.en, contract.route.subject],
      ['subject_et', canonical.subject.et, contract.route.subject_et],
    ];
    for (const [field, actual, expected] of comparisons) {
      if (actual !== expected) diagnostics.push(makeDiagnostic('error', source.md_path, url, `${field}: expected ${expected}, found ${actual}`));
    }
  }

  const canonicalCounts = countBy(routeData.records, 'book_id');
  const sourceCounts = countBy(routeData.archiveRecords, 'book_id');
  const canonicalLanguageCounts = countBy(routeData.records, 'language');
  for (const [language, expected] of Object.entries(contract.languageCounts)) {
    compareContractField(diagnostics, source.md_path, `/languages/${language}`, canonicalLanguageCounts.get(language) ?? 0, expected);
  }
  compareContractField(diagnostics, source.qa_path, '/books', Object.keys(routeData.qa.books ?? {}).length, contract.books.length);
  for (const expected of contract.books) {
    compareContractField(diagnostics, source.qa_path, `/books/${expected.book_id}`, routeData.qa.books?.[expected.book_id], expected.canonical_record_count);
    compareContractField(diagnostics, source.source_archive, `/books/${expected.book_id}/source_records`, sourceCounts.get(expected.book_id) ?? 0, expected.source_record_count);
    compareContractField(diagnostics, source.md_path, `/books/${expected.book_id}/canonical_records`, canonicalCounts.get(expected.book_id) ?? 0, expected.canonical_record_count);
    const archiveBook = archiveBooks.get(expected.book_id);
    compareContractField(diagnostics, source.source_archive, `/books/${expected.book_id}/language`, archiveBook?.language, expected.language);
    compareContractField(diagnostics, source.source_archive, `/books/${expected.book_id}/publisher`, archiveBook?.publisher || 'unknown', expected.publisher);
    if (routeData.qa.normalized_book_titles) {
      compareContractField(
        diagnostics,
        source.qa_path,
        `/normalized_book_titles/${expected.book_id}`,
        normalizeText(routeData.qa.normalized_book_titles[expected.book_id]),
        normalizeText(expected.title),
      );
    }
    const covers = coverRecords.filter((record) => record.book_id === expected.book_id);
    compareContractField(
      diagnostics,
      source.source_archive,
      `/books/${expected.book_id}/cover_records`,
      covers.length,
      contract.coverDetailCounts?.[expected.book_id] ?? 1,
    );
    if (covers[0]) {
      compareContractField(diagnostics, source.source_archive, `/books/${expected.book_id}/kit_url`, covers[0].url, expected.kit_url);
      compareContractField(
        diagnostics, source.source_archive, `/books/${expected.book_id}/title`,
        normalizeText(covers[0].title).replace(/\u00ad/giu, '').replace(/\s+– Opiq$/u, ''),
        normalizeText(expected.title).replace(/\u00ad/giu, ''),
      );
    }
  }

  for (const artifact of artifacts) {
    if (artifact.text !== serializeCurriculumYaml(artifact.data)) {
      const routeLabel = `Grade ${contract.route.grade} ${contract.route.subject}`;
      diagnostics.push(makeDiagnostic('error', artifact.file, '/', `${routeLabel} inventory YAML must use deterministic serialization`));
    }
    if (artifact.data.artifact_type === 'book_inventory') {
      if (contract.mapIds?.book_inventory) {
        compareContractField(diagnostics, artifact.file, '/map_id', artifact.data.map_id, contract.mapIds.book_inventory);
      }
      for (const [field, expected] of Object.entries(contract.sourceAudit)) {
        compareContractField(diagnostics, artifact.file, `/source_audit/${field}`, artifact.data.source_audit?.[field], expected);
      }
      const books = artifact.data.books ?? [];
      compareContractField(diagnostics, artifact.file, '/books', books.length, contract.books.length);
      const booksById = new Map(books.map((book) => [book.book_id, book]));
      for (const expected of contract.books) {
        const book = booksById.get(expected.book_id);
        if (!book) continue;
        for (const [field, expectedValue] of Object.entries(expected)) {
          compareContractField(diagnostics, artifact.file, `/books/${expected.book_id}/${field}`, book[field], expectedValue);
        }
        compareContractField(diagnostics, artifact.file, `/books/${expected.book_id}/programme_type`, book.programme_type, 'unknown');
        compareContractField(diagnostics, artifact.file, `/books/${expected.book_id}/programme_type_evidence/status`, book.programme_type_evidence?.status, 'ambiguous');
        compareContractField(
          diagnostics, artifact.file, `/books/${expected.book_id}/programme_type_evidence/source`,
          book.programme_type_evidence?.source,
          `${contract.route.source_archive}#opiq_lookup.jsonl (captured ${expected.kit_url})`,
        );
        compareContractField(
          diagnostics,
          artifact.file,
          `/books/${expected.book_id}/programme_type_evidence/verified_on`,
          book.programme_type_evidence?.verified_on,
          contract.verifiedOn ?? '2026-08-01',
        );
        compareContractField(diagnostics, artifact.file, `/books/${expected.book_id}/page_evidence`, book.page_evidence, 'page_records');
        compareContractField(diagnostics, artifact.file, `/books/${expected.book_id}/publisher_sequence/grade`, book.publisher_sequence?.grade, contract.route.grade);
        compareContractField(diagnostics, artifact.file, `/books/${expected.book_id}/publisher_sequence/grade_allocation_basis`, book.publisher_sequence?.grade_allocation_basis, 'publisher_sequence');
        compareContractField(diagnostics, artifact.file, `/books/${expected.book_id}/eligible_for_ordinary_course`, book.eligible_for_ordinary_course, false);
      }
    }
    if (artifact.data.artifact_type === 'topic_inventory') {
      compareContractField(
        diagnostics,
        artifact.file,
        '/map_id',
        artifact.data.map_id,
        contract.mapIds?.topic_inventory ?? 'grade-6-science-topic-inventory',
      );
      compareContractField(diagnostics, artifact.file, '/scope', artifact.data.scope, 'deduplicated_inventory_not_final_annual_sequence');
      compareContractField(diagnostics, artifact.file, '/coverage_status', artifact.data.coverage_status, 'partial');
      compareContractField(diagnostics, artifact.file, '/grade_allocation_basis', artifact.data.grade_allocation_basis, 'curated_course_sequence');
      compareContractField(diagnostics, artifact.file, '/unavailable_page_evidence_book_ids', artifact.data.unavailable_page_evidence_book_ids?.length, 0);
      if (contract.topicIds) {
        const actualTopicIds = (artifact.data.topics ?? []).map((topic) => topic.topic_id);
        compareContractField(diagnostics, artifact.file, '/topics', actualTopicIds.length, contract.topicIds.length);
        if (
          actualTopicIds.length !== contract.topicIds.length
          || actualTopicIds.some((topicId, index) => topicId !== contract.topicIds[index])
        ) {
          diagnostics.push(makeDiagnostic(
            'error', artifact.file, '/topics',
            `expected stable topic IDs in order: ${contract.topicIds.join(', ')}`,
          ));
        }
      }
    }
  }
}

function validateBookInventory(diagnostics, artifact, routeData) {
  if (!routeData) return;
  const inventory = artifact.data;
  const books = inventory.books ?? [];
  const booksById = new Map(books.map((book) => [book.book_id, book]));
  const archiveBooks = routeData.archiveIndex.books ?? [];
  const archiveById = new Map(archiveBooks.map((book) => [book.id, book]));
  const canonicalCounts = countBy(routeData.records, 'book_id');
  const sourceCounts = countBy(routeData.archiveRecords, 'book_id');
  addDuplicateDiagnostics(diagnostics, books.map((book) => book.book_id), {
    file: artifact.file, field: '/books', label: 'book ID',
  });
  for (const id of new Set([...booksById.keys(), ...archiveById.keys()])) {
    if (!booksById.has(id)) diagnostics.push(makeDiagnostic('error', artifact.file, '/books', `archive book ${id} is missing from the audit`));
    if (!archiveById.has(id)) diagnostics.push(makeDiagnostic('error', artifact.file, '/books', `audited book ${id} is absent from the registered archive`));
  }
  for (const [index, book] of books.entries()) {
    const field = `/books/${index}`;
    const archiveBook = archiveById.get(book.book_id);
    const sourceCount = sourceCounts.get(book.book_id) ?? 0;
    const canonicalCount = canonicalCounts.get(book.book_id) ?? 0;
    if (archiveBook && book.language !== archiveBook.language) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/language`, `expected archive language ${archiveBook.language}`));
    }
    if (book.source_record_count !== sourceCount || (archiveBook && sourceCount !== archiveBook.chapterCount)) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/source_record_count`, `expected ${sourceCount} source records`));
    }
    if (book.canonical_record_count !== canonicalCount) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/canonical_record_count`, `expected ${canonicalCount} canonical records`));
    }
    const expectedEvidence = canonicalCount === 0 ? 'cover_only' : 'page_records';
    if (book.page_evidence !== expectedEvidence) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/page_evidence`, `expected ${expectedEvidence}`));
    }
    const sourceKitIds = new Set(routeData.archiveRecords
      .filter((record) => record.book_id === book.book_id)
      .map((record) => extractKitId(record.url))
      .filter(Number.isInteger));
    if (sourceKitIds.size !== 1 || !sourceKitIds.has(book.kit_id) || extractKitId(book.kit_url) !== book.kit_id) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/kit_id`, `kit metadata does not match source URLs (${[...sourceKitIds].join(', ') || 'none'})`));
    }
    if (book.programme_type === 'simplified_curriculum') {
      if (book.provenance?.category !== 'opiq_simplified_curriculum' || book.eligible_for_ordinary_course !== false) {
        diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/programme_type`, 'simplified material must use explicit simplified provenance and be ineligible by default'));
      }
    }
    if (book.page_evidence === 'cover_only' && book.eligible_for_ordinary_course) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/eligible_for_ordinary_course`, 'cover-only book cannot provide page-level course evidence'));
    }
  }
  const audit = inventory.source_audit ?? {};
  const expectedAudit = [
    ['source_records', routeData.archiveRecords.length],
    ['canonical_records', routeData.records.length],
    ['cover_detail_records_excluded', routeData.qa.cover_detail_records_excluded],
    ['source_books', archiveBooks.length],
    ['books_with_page_records', [...canonicalCounts.values()].filter((count) => count > 0).length],
  ];
  for (const [field, expected] of expectedAudit) {
    if (audit[field] !== expected) diagnostics.push(makeDiagnostic('error', artifact.file, `/source_audit/${field}`, `expected ${expected}, found ${audit[field]}`));
  }
  if (routeData.archiveIndex.recordCount !== routeData.archiveRecords.length) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/source_audit/source_records', 'archive index recordCount does not match JSONL records'));
  }
  if (routeData.source.record_count !== routeData.records.length || routeData.qa.page_records_included !== routeData.records.length) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/source_audit/canonical_records', 'manifest, QA, and canonical Markdown record counts disagree'));
  }
}

function collectPageReferences(artifact) {
  const refs = [];
  if (artifact.data.artifact_type === 'topic_inventory') {
    for (const [topicIndex, topic] of (artifact.data.topics ?? []).entries()) {
      for (const [kind, selected] of [['selected_records', true], ['alternative_records', false], ['rejected_records', false]]) {
        for (const [recordIndex, record] of (topic[kind] ?? []).entries()) {
          refs.push({ record, field: `/topics/${topicIndex}/${kind}/${recordIndex}`, selected, rejected: kind === 'rejected_records' });
        }
      }
    }
  }
  if (artifact.data.artifact_type === 'thematic_unit') {
    for (const [kind, selected] of [['selected_records', true], ['rejected_duplicate_records', false]]) {
      for (const [recordIndex, record] of (artifact.data[kind] ?? []).entries()) {
        refs.push({ record, field: `/${kind}/${recordIndex}`, selected, rejected: kind === 'rejected_duplicate_records' });
      }
    }
  }
  return refs;
}

export function provenanceMatchesProgramme(programmeType, category) {
  const expected = {
    ordinary: 'opiq_textbook',
    simplified_curriculum: 'opiq_simplified_curriculum',
    supplementary: 'opiq_supplementary',
    teacher_support: 'opiq_teacher_support',
  };
  return programmeType === 'unknown' || expected[programmeType] === category;
}

export function validatePageReferences(
  diagnostics,
  artifact,
  routeData,
  bookInventory,
  references = collectPageReferences(artifact),
  { allowSimplifiedSelection = false, allowAmbiguousProgrammeSelection = false } = {},
) {
  if (!routeData || !bookInventory) return;
  const booksById = new Map((bookInventory.books ?? []).map((book) => [book.book_id, book]));
  for (const ref of references) {
    const { record, field } = ref;
    const matches = routeData.records.filter((candidate) => candidate.url === record.canonical_url);
    if (record.canonical_source_id !== routeData.source.id) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/canonical_source_id`, `expected ${routeData.source.id}; cross-route records are forbidden`));
    }
    if (matches.length !== 1) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/canonical_url`, `URL must occur exactly once in ${routeData.source.md_path}; found ${matches.length}`));
    }
    const canonical = matches[0];
    if (canonical) {
      const comparisons = [
        ['book_id', record.book_id, canonical.book_id],
        ['title', normalizeText(record.title), normalizeText(canonical.title)],
        ['language', record.language, canonical.language],
        ['grade', routeData.source.grade, canonical.class],
        ['subject', routeData.source.subject, canonical.subject.en],
        ['subject_et', routeData.source.subject_et, canonical.subject.et],
      ];
      for (const [name, actual, expected] of comparisons) {
        if (actual !== expected) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/${name}`, `expected ${expected}, found ${actual}`));
      }
    }
    const book = booksById.get(record.book_id);
    if (!book) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/book_id`, `unknown audited book ID ${record.book_id}`));
    } else {
      if (record.programme_type !== book.programme_type) {
        diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/programme_type`, `expected ${book.programme_type} for ${book.book_id}`));
      }
      if (book.page_evidence === 'cover_only') {
        diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/book_id`, `cover-only book ${book.book_id} cannot be used as page evidence`));
      }
      if (
        ref.selected
        && book.programme_type_evidence?.status !== 'verified'
        && !allowAmbiguousProgrammeSelection
      ) {
        diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/programme_type`, `selected material requires verified programme-type evidence for ${book.book_id}`));
      }
    }
    if (!routeData.source.languages.includes(record.language)) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/language`, `language ${record.language} is not registered for ${routeData.source.id}`));
    }
    if (!provenanceMatchesProgramme(record.programme_type, record.provenance?.category)) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/provenance/category`, `provenance does not match programme type ${record.programme_type}`));
    }
    if (
      ref.selected
      && (
        (record.programme_type === 'unknown' && !allowAmbiguousProgrammeSelection)
        || (record.programme_type === 'simplified_curriculum' && !allowSimplifiedSelection)
      )
    ) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/programme_type`, 'default selected records cannot silently use simplified or unknown programme material'));
    }
    if (ref.rejected && !record.rejection_reason) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/rejection_reason`, 'rejected record requires an explicit reason'));
    }
  }
}

function validateTopicInventory(diagnostics, artifact, bookInventory, contract) {
  const inventory = artifact.data;
  const books = new Set((bookInventory?.books ?? []).map((book) => book.book_id));
  addDuplicateDiagnostics(diagnostics, (inventory.topics ?? []).map((topic) => topic.topic_id), {
    file: artifact.file, field: '/topics', label: 'topic ID',
  });
  const allRecordIds = [];
  for (const [index, topic] of (inventory.topics ?? []).entries()) {
    const field = `/topics/${index}`;
    for (const bookId of topic.books_covering ?? []) {
      if (!books.has(bookId)) diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/books_covering`, `unknown audited book ID ${bookId}`));
    }
    const records = [...(topic.selected_records ?? []), ...(topic.alternative_records ?? []), ...(topic.rejected_records ?? [])];
    allRecordIds.push(...records.map((record) => record.record_id));
    addDuplicateDiagnostics(diagnostics, records.map((record) => record.canonical_url), {
      file: artifact.file, field, label: 'topic canonical URL',
    });
    const usableRecords = [...(topic.selected_records ?? []), ...(topic.alternative_records ?? [])];
    const usableIds = new Set(usableRecords.map((record) => record.record_id));
    const usableById = new Map(usableRecords.map((record) => [record.record_id, record]));
    for (const [role, ids] of Object.entries(topic.source_recommendations ?? {})) {
      for (const id of ids) {
        if (!usableIds.has(id)) {
          diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/source_recommendations/${role}`, `unknown selected or alternative record ID ${id}`));
          continue;
        }
        const allowedRoles = contract?.recommendationRoles?.[role];
        if (
          allowedRoles
          && !usableById.get(id)?.instructional_roles?.some((recordRole) => allowedRoles.includes(recordRole))
        ) {
          diagnostics.push(makeDiagnostic(
            'error',
            artifact.file,
            `${field}/source_recommendations/${role}`,
            `recommended record ${id} does not declare a role allowed for ${role}`,
          ));
        }
      }
    }
    const rejectedIds = new Set((topic.rejected_records ?? []).map((record) => record.record_id));
    const declaredRejected = new Set(topic.deduplication?.rejected_record_ids ?? []);
    for (const record of topic.selected_records ?? []) {
      if (declaredRejected.has(record.record_id)) {
        diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/selected_records`, `selected record cannot also be rejected: ${record.record_id}`));
      }
    }
    if (
      rejectedIds.size !== declaredRejected.size
      || [...rejectedIds].some((id) => !declaredRejected.has(id))
    ) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `${field}/deduplication/rejected_record_ids`, 'must exactly match rejected_records'));
    }
  }
  addDuplicateDiagnostics(diagnostics, allRecordIds, {
    file: artifact.file, field: '/topics', label: 'topic record ID',
  });
  const allUrls = (inventory.topics ?? []).flatMap((topic) => [
    ...(topic.selected_records ?? []),
    ...(topic.alternative_records ?? []),
    ...(topic.rejected_records ?? []),
  ].map((record) => record.canonical_url));
  addDuplicateDiagnostics(diagnostics, allUrls, {
    file: artifact.file, field: '/topics', label: 'topic inventory canonical URL',
  });
}

function validateGradeAllocation(diagnostics, artifact) {
  const allocation = artifact.data.grade_allocation;
  if (!allocation) return;
  if (allocation.official_basis === 'official_school_stage') {
    if (!String(allocation.official_scope).startsWith('school_stage_') || allocation.exact_grade_official !== false) {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/grade_allocation', 'official school-stage allocation cannot be labelled as official exact-grade allocation'));
    }
  }
  if (allocation.official_basis === 'official_exact_grade') {
    if (allocation.official_scope !== 'exact_grade' || allocation.exact_grade_official !== true) {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/grade_allocation', 'official exact-grade basis requires explicit exact-grade evidence'));
    }
  }
  if (allocation.publisher_basis !== 'publisher_sequence') {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/grade_allocation/publisher_basis', 'publisher sequence must remain distinct from official allocation'));
  }
}

function validateThematicUnit(diagnostics, artifact, officialMap) {
  const unit = artifact.data;
  validateGradeAllocation(diagnostics, artifact);
  const selected = unit.selected_records ?? [];
  addDuplicateDiagnostics(diagnostics, selected.map((record) => record.record_id), {
    file: artifact.file, field: '/selected_records', label: 'selected record ID',
  });
  addDuplicateDiagnostics(diagnostics, selected.map((record) => record.canonical_url), {
    file: artifact.file, field: '/selected_records', label: 'selected canonical URL',
  });
  const allUnitRecords = [...selected, ...(unit.rejected_duplicate_records ?? [])];
  addDuplicateDiagnostics(diagnostics, allUnitRecords.map((record) => record.record_id), {
    file: artifact.file, field: '/', label: 'unit record ID',
  });
  addDuplicateDiagnostics(diagnostics, allUnitRecords.map((record) => record.canonical_url), {
    file: artifact.file, field: '/', label: 'unit canonical URL',
  });
  const selectedIds = new Set(selected.map((record) => record.record_id));
  const selectedBooks = new Set(selected.map((record) => record.book_id));
  const selectedLanguages = new Set(selected.map((record) => record.language));
  if (selectedBooks.size < 2) diagnostics.push(makeDiagnostic('error', artifact.file, '/selected_records', 'golden unit must demonstrate selection across multiple eligible books'));
  if (!selectedLanguages.has('ru') || !selectedLanguages.has('et')) diagnostics.push(makeDiagnostic('error', artifact.file, '/selected_records', 'golden unit requires both Russian and Estonian source records'));
  const roles = new Set(selected.flatMap((record) => record.instructional_roles ?? []));
  for (const requiredRole of ['core_explanation_ru', 'core_source_et', 'experiment', 'revision', 'assessment']) {
    if (!roles.has(requiredRole)) diagnostics.push(makeDiagnostic('error', artifact.file, '/selected_records', `golden unit is missing instructional role ${requiredRole}`));
  }
  const rejectedUrls = new Set((unit.rejected_duplicate_records ?? []).map((record) => record.canonical_url));
  for (const record of selected) if (rejectedUrls.has(record.canonical_url)) diagnostics.push(makeDiagnostic('error', artifact.file, '/rejected_duplicate_records', `selected URL is also rejected: ${record.canonical_url}`));

  if (!officialMap || officialMap.map_id !== unit.official_curriculum?.curriculum_map_id) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/official_curriculum/curriculum_map_id', `unknown official curriculum map ${unit.official_curriculum?.curriculum_map_id}`));
    return;
  }
  if (officialMap.grade !== unit.grade || officialMap.subject !== unit.subject || officialMap.subject_et !== unit.subject_et) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/official_curriculum/curriculum_map_id', 'official curriculum map grade and subject must match the thematic unit'));
  }
  const outcomes = new Map((officialMap.outcomes ?? []).map((outcome) => [outcome.outcome_id, outcome]));
  const mappings = unit.official_curriculum?.outcome_mappings ?? [];
  addDuplicateDiagnostics(diagnostics, mappings.map((mapping) => mapping.outcome_id), {
    file: artifact.file, field: '/official_curriculum/outcome_mappings', label: 'mapped outcome ID',
  });
  for (const [index, mapping] of mappings.entries()) {
    const outcome = outcomes.get(mapping.outcome_id);
    if (!outcome) diagnostics.push(makeDiagnostic('error', artifact.file, `/official_curriculum/outcome_mappings/${index}/outcome_id`, `unknown official outcome ${mapping.outcome_id}`));
    if (mapping.coverage_status === 'verified' && outcome?.evidence_status !== 'verified') {
      diagnostics.push(makeDiagnostic('error', artifact.file, `/official_curriculum/outcome_mappings/${index}/coverage_status`, 'verified mapping requires verified official curriculum evidence'));
    }
    for (const recordId of mapping.course_evidence_record_ids ?? []) {
      if (!selectedIds.has(recordId)) diagnostics.push(makeDiagnostic('error', artifact.file, `/official_curriculum/outcome_mappings/${index}/course_evidence_record_ids`, `unknown selected course evidence ${recordId}`));
    }
  }

  const completeness = unit.completeness ?? {};
  const buckets = {
    verified: completeness.verified_outcome_ids ?? [],
    partial: completeness.partial_outcome_ids ?? [],
    missing: completeness.missing_outcome_ids ?? [],
    ambiguous: completeness.ambiguous_outcome_ids ?? [],
  };
  const requiredIds = new Set(completeness.required_outcome_ids ?? []);
  const classified = new Map();
  for (const [status, ids] of Object.entries(buckets)) {
    for (const id of ids) {
      if (classified.has(id)) diagnostics.push(makeDiagnostic('error', artifact.file, '/completeness', `outcome ${id} is classified more than once`));
      classified.set(id, status);
    }
  }
  if (requiredIds.size !== classified.size || [...requiredIds].some((id) => !classified.has(id))) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/completeness', 'every required outcome must appear in exactly one coverage bucket'));
  }
  const mappingStatuses = new Map(mappings.map((mapping) => [mapping.outcome_id, mapping.coverage_status]));
  for (const [id, status] of classified) {
    if (mappingStatuses.get(id) !== status) diagnostics.push(makeDiagnostic('error', artifact.file, '/completeness', `outcome ${id} is ${status} but its mapping is ${mappingStatuses.get(id) ?? 'missing'}`));
  }
  const hasUnresolved = buckets.partial.length > 0 || buckets.missing.length > 0 || buckets.ambiguous.length > 0;
  if (completeness.declared_complete && (hasUnresolved || completeness.status !== 'complete' || unit.coverage_status !== 'verified')) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/completeness', 'course cannot be complete while outcomes are partial, missing, or ambiguous'));
  }
  if (unit.coverage_status === 'verified' && mappings.some((mapping) => mapping.coverage_status !== 'verified')) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/coverage_status', 'verified unit coverage requires every mapped outcome to be verified'));
  }
  for (const [section, activity] of [['practical_activity', unit.practical_activity], ['revision', unit.revision], ['assessment', unit.assessment]]) {
    for (const recordId of activity?.source_record_ids ?? []) {
      if (!selectedIds.has(recordId)) diagnostics.push(makeDiagnostic('error', artifact.file, `/${section}/source_record_ids`, `unknown selected record ID ${recordId}`));
    }
  }
}

export function validateCurriculumMapRepository(context) {
  const diagnostics = [];
  const validators = createSchemaValidators(context.schemas);
  const artifactTypes = new Map();
  addDuplicateDiagnostics(diagnostics, context.artifacts.map((artifact) => artifact.data.map_id).filter(Boolean), {
    file: 'curriculum-maps', field: '/', label: 'map ID',
  });
  for (const artifact of context.artifacts) {
    const type = artifact.data.artifact_type;
    artifactTypes.set(type, [...(artifactTypes.get(type) ?? []), artifact]);
    if (type === officialArtifactType) addSchemaDiagnostics(diagnostics, artifact, validators.curriculum);
    else if (courseArtifactTypes.has(type)) addSchemaDiagnostics(diagnostics, artifact, validators.course);
    else if (gradeProgrammeRouteTypes.has(type)) {
      addSchemaDiagnostics(
        diagnostics,
        artifact,
        artifact.data.grade === 2 ? validators.grade2ProgrammeRoute : validators.gradeProgrammeRoute,
      );
    } else if (type === gradeProgrammeCoverageType) {
      addSchemaDiagnostics(
        diagnostics,
        artifact,
        artifact.data.grade === 2 ? validators.grade2ProgrammeCoverage : validators.gradeProgrammeCoverage,
      );
    } else if (type === delegatedTeacherWorkPlanMapType) {
      // Strict validation is delegated to teacher-work-plan-curriculum-maps.mjs.
    } else {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/artifact_type', `unknown artifact type ${type ?? '<missing>'}`));
    }
  }
  for (const type of [officialArtifactType, 'book_inventory', 'topic_inventory', 'thematic_unit']) {
    const count = artifactTypes.get(type)?.length ?? 0;
    if (count === 0) diagnostics.push(makeDiagnostic('error', 'curriculum-maps', '/', `at least one ${type} artifact is required`));
  }
  const officialArtifacts = artifactTypes.get(officialArtifactType) ?? [];
  const bookArtifacts = artifactTypes.get('book_inventory') ?? [];
  const topicArtifacts = artifactTypes.get('topic_inventory') ?? [];
  const unitArtifacts = artifactTypes.get('thematic_unit') ?? [];
  for (const artifact of officialArtifacts) validateOfficialArtifact(diagnostics, artifact, context);
  const gradeProgrammeArtifacts = context.artifacts.filter((artifact) => gradeProgrammeRouteTypes.has(artifact.data.artifact_type));
  const gradeProgrammeCoverageArtifacts = context.artifacts.filter((artifact) => artifact.data.artifact_type === gradeProgrammeCoverageType);
  for (const artifact of gradeProgrammeArtifacts) validateGradeProgrammeRouteArtifact(diagnostics, artifact, context);
  for (const artifact of gradeProgrammeCoverageArtifacts) validateGradeProgrammeCoverageArtifact(diagnostics, artifact, context);
  if (gradeProgrammeArtifacts.length > 0 || gradeProgrammeCoverageArtifacts.length > 0) {
    const programmeGrades = new Set([
      ...gradeProgrammeArtifacts,
      ...gradeProgrammeCoverageArtifacts,
    ].map((artifact) => artifact.data.grade));
    for (const grade of [...programmeGrades].sort((left, right) => left - right)) {
      const gradeRoutes = context.manifest.sources?.filter((source) => source.grade === grade) ?? [];
      for (const source of gradeRoutes) {
        for (const type of [...gradeProgrammeRouteTypes, gradeProgrammeCoverageType]) {
          const count = context.artifacts.filter((artifact) => (
            artifact.data.artifact_type === type
            && artifact.data.grade === grade
            && artifact.data.route_id === source.id
          )).length;
          if (count !== 1) diagnostics.push(makeDiagnostic('error', 'curriculum-maps', '/', `${source.id} requires exactly one ${type}, found ${count}`));
        }
      }
    }
  }
  const officialById = new Map(officialArtifacts.map((artifact) => [artifact.data.map_id, artifact.data]));

  const courseArtifacts = [...bookArtifacts, ...topicArtifacts, ...unitArtifacts];
  const courseSourceIds = new Set(courseArtifacts.map((artifact) => artifact.data.canonical_route?.source_id).filter(Boolean));
  const artifactsForSource = (artifacts, sourceId) => artifacts.filter((artifact) => artifact.data.canonical_route?.source_id === sourceId);
  const contractsByArtifact = new Map(courseArtifacts.map((artifact) => [artifact, validateCourseArtifactContract(diagnostics, artifact)]));
  for (const sourceId of courseSourceIds) {
    const sourceBooks = artifactsForSource(bookArtifacts, sourceId);
    const sourceTopics = artifactsForSource(topicArtifacts, sourceId);
    const sourceUnits = artifactsForSource(unitArtifacts, sourceId);
    if (sourceBooks.length !== 1) diagnostics.push(makeDiagnostic('error', 'curriculum-maps', '/', `source ${sourceId} requires exactly one book_inventory, found ${sourceBooks.length}`));
    if (sourceTopics.length !== 1) diagnostics.push(makeDiagnostic('error', 'curriculum-maps', '/', `source ${sourceId} requires exactly one topic_inventory, found ${sourceTopics.length}`));
    const contract = courseRouteContracts.get(sourceId);
    if (contract?.requireThematicUnit && sourceUnits.length < 1) {
      diagnostics.push(makeDiagnostic('error', 'curriculum-maps', '/', `source ${sourceId} requires at least one thematic_unit`));
    }
    if (!contract?.thematicUnitPrefix && sourceUnits.length > 0) {
      diagnostics.push(makeDiagnostic('error', 'curriculum-maps', '/', `source ${sourceId} does not yet permit thematic_unit artifacts`));
    }
  }

  const bookBySource = new Map(bookArtifacts.map((artifact) => [artifact.data.canonical_route?.source_id, artifact]));
  for (const artifact of courseArtifacts) {
    const routeData = validateCanonicalRoute(diagnostics, artifact, context);
    const sourceId = artifact.data.canonical_route?.source_id;
    const bookArtifact = bookBySource.get(sourceId);
    if (artifact.data.artifact_type === 'book_inventory') {
      validateBookInventory(diagnostics, artifact, routeData);
    } else {
      const contract = contractsByArtifact.get(artifact);
      validatePageReferences(diagnostics, artifact, routeData, bookArtifact?.data, undefined, {
        allowAmbiguousProgrammeSelection: (
          artifact.data.artifact_type === 'topic_inventory'
          && contract?.allowAmbiguousTopicSelection === true
        ),
      });
    }
    if (artifact.data.artifact_type === 'topic_inventory') {
      validateTopicInventory(diagnostics, artifact, bookArtifact?.data, contractsByArtifact.get(artifact));
    }
    if (artifact.data.artifact_type === 'thematic_unit') {
      validateThematicUnit(diagnostics, artifact, officialById.get(artifact.data.official_curriculum?.curriculum_map_id));
    }
  }

  for (const sourceId of ['grade-6-science', 'grade-7-geography', 'grade-7-science']) {
    const registeredArtifacts = courseArtifacts.filter((artifact) => artifact.data.canonical_route?.source_id === sourceId);
    validateRegisteredRouteEvidence(
      diagnostics,
      registeredArtifacts,
      context.routes[sourceId],
      courseRouteContracts.get(sourceId),
      sourceId,
    );
  }

  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length;
  const pageReferences = context.artifacts.reduce((count, artifact) => count + collectPageReferences(artifact).length, 0);
  return {
    diagnostics,
    summary: {
      artifacts: context.artifacts.length,
      topics: topicArtifacts.reduce((count, artifact) => count + (artifact.data.topics?.length ?? 0), 0),
      selectedUnitRecords: unitArtifacts.reduce((count, artifact) => count + (artifact.data.selected_records?.length ?? 0), 0),
      pageReferences,
      errors,
      warnings,
    },
  };
}

export function formatCurriculumDiagnostic(diagnostic) {
  return `[${diagnostic.severity.toUpperCase()}] ${diagnostic.file} ${diagnostic.field}: ${diagnostic.reason}`;
}
