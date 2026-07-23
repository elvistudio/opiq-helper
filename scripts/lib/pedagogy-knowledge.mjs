import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { parseDocument } from 'yaml';

const KNOWLEDGE_ROOT = 'knowledge/pedagogy';
const REFERENCE_FILE = `${KNOWLEDGE_ROOT}/references/references.yaml`;
const ACTIVITY_FILE = `${KNOWLEDGE_ROOT}/activities/activity-catalog.yaml`;
const PRINCIPLE_DIRECTORY = `${KNOWLEDGE_ROOT}/principles`;
const PATTERN_DIRECTORY = `${KNOWLEDGE_ROOT}/patterns`;
const SCHEMA_DIRECTORY = `${KNOWLEDGE_ROOT}/schemas`;

const SCHEMA_FILES = {
  common: `${SCHEMA_DIRECTORY}/pedagogical-common.schema.json`,
  reference: `${SCHEMA_DIRECTORY}/pedagogical-reference.schema.json`,
  principle: `${SCHEMA_DIRECTORY}/pedagogical-principle.schema.json`,
  activity: `${SCHEMA_DIRECTORY}/pedagogical-activity.schema.json`,
  pattern: `${SCHEMA_DIRECTORY}/pedagogical-pattern.schema.json`,
};

const DISCUSSION_HEAVY_ACTIVITIES = new Set([
  'back-to-back-description',
  'brainstorming',
  'gallery-walk',
  'jigsaw',
  'peer-teaching',
  'question-circle',
  'reciprocal-teaching',
  'silent-discussion',
]);

const CATEGORY_PHASES = {
  activation: new Set(['activation', 'orientation']),
  reading_and_comprehension: new Set(['explanation', 'guided_practice', 'independent_practice']),
  retrieval_and_consolidation: new Set(['retrieval', 'formative_assessment', 'consolidation', 'homework', 'delayed_review']),
  concept_organization: new Set(['explanation', 'guided_practice', 'independent_practice', 'formative_assessment', 'consolidation']),
  collaborative_learning: new Set(['activation', 'guided_practice', 'collaborative_practice', 'reflection']),
  reflection_and_assessment: new Set(['formative_assessment', 'reflection', 'consolidation', 'homework']),
  error_analysis: new Set(['guided_practice', 'formative_assessment', 'reflection', 'consolidation']),
  visual_and_multimodal: new Set(['explanation', 'guided_practice', 'independent_practice', 'consolidation']),
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeIdentifierList(values) {
  return Array.isArray(values) ? values.filter((value) => typeof value === 'string') : [];
}

function compareBytewise(left, right) {
  return Buffer.from(left).compare(Buffer.from(right));
}

function sorted(values) {
  return [...values].sort(compareBytewise);
}

function normalizeName(value) {
  return String(value ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim().toLowerCase();
}

function displayPath(rootDir, filePath) {
  const relative = path.relative(rootDir, filePath);
  return relative && !relative.startsWith('..')
    ? relative.split(path.sep).join('/')
    : filePath;
}

function diagnostic(severity, file, field, reason) {
  return { severity, file, field, reason };
}

function addSchemaDiagnostics(errors, validate, file, data) {
  if (validate(data)) return true;
  for (const error of validate.errors ?? []) {
    errors.push(diagnostic(
      'error',
      file,
      error.instancePath || '/',
      `${error.message}${error.params?.additionalProperty ? `: ${error.params.additionalProperty}` : ''}`,
    ));
  }
  return false;
}

function addDuplicateDiagnostics(errors, values, file, field, label) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      errors.push(diagnostic('error', file, field, `duplicate ${label} ${value}`));
    }
    seen.add(value);
  }
}

function checkSorted(errors, values, file, field, label) {
  const expected = sorted(values);
  if (JSON.stringify(values) !== JSON.stringify(expected)) {
    errors.push(diagnostic(
      'error',
      file,
      field,
      `${label} must be sorted bytewise by stable ID; expected ${expected.join(', ')}`,
    ));
  }
}

function checkGradeRange(errors, gradeRange, file, field) {
  if (
    isPlainObject(gradeRange)
    && Number.isInteger(gradeRange.min)
    && Number.isInteger(gradeRange.max)
    && gradeRange.min > gradeRange.max
  ) {
    errors.push(diagnostic('error', file, field, 'grade minimum must not exceed grade maximum'));
  }
}

function checkClaims(errors, claims, referenceIds, file, field, { requireSourceSupported = false } = {}) {
  if (!Array.isArray(claims)) return;
  const claimIds = claims.map((claim) => claim?.claim_id).filter(Boolean);
  addDuplicateDiagnostics(errors, claimIds, file, field, 'claim ID');
  if (requireSourceSupported && !claims.some((claim) => claim?.claim_origin === 'source_supported')) {
    errors.push(diagnostic('error', file, field, 'at least one source_supported claim is required'));
  }
  for (const [index, claim] of claims.entries()) {
    const claimField = `${field}/${index}`;
    const ids = normalizeIdentifierList(claim?.reference_ids);
    for (const referenceId of ids) {
      if (!referenceIds.has(referenceId)) {
        errors.push(diagnostic('error', file, `${claimField}/reference_ids`, `unknown pedagogical reference ${referenceId}`));
      }
    }
    if (claim?.claim_origin === 'source_supported' && ids.length === 0) {
      errors.push(diagnostic('error', file, claimField, 'source_supported claim must name a reference'));
    }
    if (claim?.claim_origin === 'project_authored_design' && ids.length > 0) {
      errors.push(diagnostic(
        'error',
        file,
        claimField,
        'project_authored_design must not be attributed to a source reference',
      ));
    }
  }
}

async function listFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  const symlinks = [];
  for (const entry of entries.sort((left, right) => compareBytewise(left.name, right.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      symlinks.push(entryPath);
    } else if (entry.isDirectory()) {
      const nested = await listFiles(entryPath);
      files.push(...nested.files);
      symlinks.push(...nested.symlinks);
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return { files, symlinks };
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function readYamlArtifact(rootDir, filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const file = displayPath(rootDir, filePath);
  return { file, raw, data: parseStrictPedagogyYaml(raw, file) };
}

export function parseStrictPedagogyYaml(text, file = '<memory>') {
  if (text.includes('\t')) {
    throw new Error(`${file}: tabs are not allowed in pedagogical knowledge YAML`);
  }
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
  if (!isPlainObject(value)) throw new Error(`${file}: YAML root must be an object`);
  return value;
}

export async function loadPedagogyKnowledge({
  rootDir = process.cwd(),
  knowledgeRoot = KNOWLEDGE_ROOT,
} = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const absoluteKnowledgeRoot = path.resolve(absoluteRoot, knowledgeRoot);
  if (
    absoluteKnowledgeRoot !== absoluteRoot
    && !absoluteKnowledgeRoot.startsWith(`${absoluteRoot}${path.sep}`)
  ) {
    throw new Error('pedagogical knowledge root must be inside the repository');
  }

  const principleDirectory = path.join(absoluteRoot, PRINCIPLE_DIRECTORY);
  const patternDirectory = path.join(absoluteRoot, PATTERN_DIRECTORY);
  const [tree, principleTree, patternTree] = await Promise.all([
    listFiles(absoluteKnowledgeRoot),
    listFiles(principleDirectory),
    listFiles(patternDirectory),
  ]);
  const principleFiles = principleTree.files
    .filter((file) => /\.ya?ml$/u.test(file))
    .sort((left, right) => compareBytewise(displayPath(absoluteRoot, left), displayPath(absoluteRoot, right)));
  const patternFiles = patternTree.files
    .filter((file) => /\.ya?ml$/u.test(file))
    .sort((left, right) => compareBytewise(displayPath(absoluteRoot, left), displayPath(absoluteRoot, right)));

  const schemaEntries = await Promise.all(
    Object.entries(SCHEMA_FILES).map(async ([name, repositoryPath]) => [
      name,
      await readJson(path.join(absoluteRoot, repositoryPath)),
    ]),
  );
  const [references, activities, principles, patterns] = await Promise.all([
    readYamlArtifact(absoluteRoot, path.join(absoluteRoot, REFERENCE_FILE)),
    readYamlArtifact(absoluteRoot, path.join(absoluteRoot, ACTIVITY_FILE)),
    Promise.all(principleFiles.map((file) => readYamlArtifact(absoluteRoot, file))),
    Promise.all(patternFiles.map((file) => readYamlArtifact(absoluteRoot, file))),
  ]);

  return {
    rootDir: absoluteRoot,
    knowledgeRoot: displayPath(absoluteRoot, absoluteKnowledgeRoot),
    schemas: Object.fromEntries(schemaEntries),
    references,
    activities,
    principles,
    patterns,
    allFiles: tree.files.map((file) => displayPath(absoluteRoot, file)).sort(compareBytewise),
    symlinks: tree.symlinks.map((file) => displayPath(absoluteRoot, file)).sort(compareBytewise),
  };
}

export function createPedagogySchemaValidators(schemas) {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    validateFormats: false,
  });
  ajv.addSchema(schemas.common);
  return {
    reference: ajv.compile(schemas.reference),
    principle: ajv.compile(schemas.principle),
    activity: ajv.compile(schemas.activity),
    pattern: ajv.compile(schemas.pattern),
  };
}

export function validatePedagogyKnowledge(repository, {
  enforceMinimumProductionCounts = true,
} = {}) {
  const errors = [];
  const warnings = [];
  let validators;
  try {
    validators = createPedagogySchemaValidators(repository.schemas);
  } catch (error) {
    errors.push(diagnostic('error', SCHEMA_DIRECTORY, '/', `schema compilation failed: ${error.message}`));
    return {
      valid: false,
      errors,
      warnings,
      counts: { references: 0, principles: 0, activities: 0, patterns: 0 },
    };
  }

  const referencesValid = addSchemaDiagnostics(
    errors,
    validators.reference,
    repository.references.file,
    repository.references.data,
  );
  const activityCatalogValid = addSchemaDiagnostics(
    errors,
    validators.activity,
    repository.activities.file,
    repository.activities.data,
  );
  const validPrinciples = repository.principles.map((artifact) => addSchemaDiagnostics(
    errors,
    validators.principle,
    artifact.file,
    artifact.data,
  ));
  const validPatterns = repository.patterns.map((artifact) => addSchemaDiagnostics(
    errors,
    validators.pattern,
    artifact.file,
    artifact.data,
  ));

  const references = Array.isArray(repository.references.data?.references)
    ? repository.references.data.references
    : [];
  const principles = repository.principles.map((artifact) => artifact.data);
  const activities = Array.isArray(repository.activities.data?.activities)
    ? repository.activities.data.activities
    : [];
  const patterns = repository.patterns.flatMap((artifact) => (
    Array.isArray(artifact.data?.patterns) ? artifact.data.patterns : []
  ));

  const counts = {
    references: references.length,
    principles: principles.length,
    activities: activities.length,
    patterns: patterns.length,
  };

  for (const symlink of repository.symlinks ?? []) {
    errors.push(diagnostic('error', symlink, '/', 'symlinks are not allowed in pedagogical knowledge'));
  }
  for (const file of repository.allFiles ?? []) {
    if (/\.pdf$/iu.test(file)) {
      errors.push(diagnostic('error', file, '/', 'original PDF documents must not be committed to pedagogical knowledge'));
    }
  }

  const referenceIdsList = references.map((reference) => reference?.reference_id).filter(Boolean);
  const principleIdsList = principles.map((principle) => principle?.principle_id).filter(Boolean);
  const activityIdsList = activities.map((activity) => activity?.activity_id).filter(Boolean);
  const patternIdsList = patterns.map((pattern) => pattern?.pattern_id).filter(Boolean);
  const referenceIds = new Set(referenceIdsList);
  const principleIds = new Set(principleIdsList);
  const activityIds = new Set(activityIdsList);

  addDuplicateDiagnostics(errors, referenceIdsList, repository.references.file, '/references', 'reference ID');
  addDuplicateDiagnostics(errors, principleIdsList, PRINCIPLE_DIRECTORY, '/', 'principle ID');
  addDuplicateDiagnostics(errors, activityIdsList, repository.activities.file, '/activities', 'activity ID');
  addDuplicateDiagnostics(errors, patternIdsList, PATTERN_DIRECTORY, '/', 'pattern ID');
  checkSorted(errors, referenceIdsList, repository.references.file, '/references', 'references');
  checkSorted(errors, principleIdsList, PRINCIPLE_DIRECTORY, '/', 'principle files');
  checkSorted(errors, activityIdsList, repository.activities.file, '/activities', 'activities');
  for (const artifact of repository.patterns) {
    const ids = Array.isArray(artifact.data?.patterns)
      ? artifact.data.patterns.map((pattern) => pattern?.pattern_id).filter(Boolean)
      : [];
    checkSorted(errors, ids, artifact.file, '/patterns', 'patterns');
  }

  if (referencesValid) {
    for (const [index, reference] of references.entries()) {
      if (
        reference.redistribution_status === 'not_verified'
        && (reference.original_file_committed || reference.quotation_policy !== 'summaries_only')
      ) {
        errors.push(diagnostic(
          'error',
          repository.references.file,
          `/references/${index}`,
          'unverified redistribution requires original_file_committed false and summaries_only',
        ));
      }
      if (reference.official_curriculum_authority !== false) {
        errors.push(diagnostic(
          'error',
          repository.references.file,
          `/references/${index}/official_curriculum_authority`,
          'pedagogical references must not be represented as official curriculum authority',
        ));
      }
    }
  }

  for (const [index, artifact] of repository.principles.entries()) {
    if (!validPrinciples[index]) continue;
    const principle = artifact.data;
    const expectedFile = `${PRINCIPLE_DIRECTORY}/${principle.principle_id}.yaml`;
    if (artifact.file !== expectedFile) {
      errors.push(diagnostic(
        'error',
        artifact.file,
        '/principle_id',
        `principle file must be named ${expectedFile}`,
      ));
    }
    checkGradeRange(errors, principle.suitable_grades, artifact.file, '/suitable_grades');
    checkClaims(
      errors,
      principle.provenance_claims,
      referenceIds,
      artifact.file,
      '/provenance_claims',
      { requireSourceSupported: true },
    );
    const grade5Modes = new Set(principle.grade5_science_applicability.delivery_modes);
    for (const mode of ['classroom', 'homeschool']) {
      if (!grade5Modes.has(mode)) {
        errors.push(diagnostic(
          'error',
          artifact.file,
          '/grade5_science_applicability/delivery_modes',
          `grade 5 science applicability must include ${mode}`,
        ));
      }
    }
  }

  if (activityCatalogValid) {
    const namesByLanguage = { en: new Map(), et: new Map(), ru: new Map() };
    for (const [index, activity] of activities.entries()) {
      const field = `/activities/${index}`;
      checkGradeRange(errors, activity.suitable_grades, repository.activities.file, `${field}/suitable_grades`);
      for (const principleId of activity.linked_principle_ids) {
        if (!principleIds.has(principleId)) {
          errors.push(diagnostic(
            'error',
            repository.activities.file,
            `${field}/linked_principle_ids`,
            `unknown pedagogical principle ${principleId}`,
          ));
        }
      }
      if (activity.duration.min_minutes > activity.duration.max_minutes) {
        errors.push(diagnostic(
          'error',
          repository.activities.file,
          `${field}/duration`,
          'duration minimum must not exceed duration maximum',
        ));
      }
      const compatiblePhases = CATEGORY_PHASES[activity.category];
      if (
        compatiblePhases
        && !activity.suitable_lesson_phases.some((phase) => compatiblePhases.has(phase))
      ) {
        errors.push(diagnostic(
          'error',
          repository.activities.file,
          `${field}/suitable_lesson_phases`,
          `activity category ${activity.category} has no compatible lesson phase`,
        ));
      }
      if (
        DISCUSSION_HEAVY_ACTIVITIES.has(activity.activity_id)
        && ['none', 'low'].includes(activity.language_demand.interaction)
      ) {
        errors.push(diagnostic(
          'error',
          repository.activities.file,
          `${field}/language_demand/interaction`,
          `${activity.activity_id} is interaction-heavy and cannot have ${activity.language_demand.interaction} interaction demand`,
        ));
      }
      const homeschoolStatus = activity.homeschool_adaptation.status;
      if (
        homeschoolStatus !== 'not_recommended'
        && !activity.delivery_modes.some((mode) => mode === 'homeschool' || mode === 'parent_supported')
      ) {
        errors.push(diagnostic(
          'error',
          repository.activities.file,
          `${field}/delivery_modes`,
          `homeschool adaptation status ${homeschoolStatus} requires a compatible delivery mode`,
        ));
      }
      if (
        activity.safety.risk_level !== 'none'
        && !activity.safety.requires_adult_supervision
      ) {
        errors.push(diagnostic(
          'error',
          repository.activities.file,
          `${field}/safety`,
          'an activity with safety risk must require adult supervision',
        ));
      }
      if (
        activity.safety.requires_adult_supervision
        && !String(activity.homeschool_adaptation.adult_safety_supervision_ru ?? '').trim()
      ) {
        errors.push(diagnostic(
          'error',
          repository.activities.file,
          `${field}/homeschool_adaptation/adult_safety_supervision_ru`,
          'supervised activity requires explicit homeschool adult safety metadata',
        ));
      }
      if (
        activity.assessment_roles.includes('none')
        && activity.assessment_roles.length > 1
      ) {
        errors.push(diagnostic(
          'error',
          repository.activities.file,
          `${field}/assessment_roles`,
          'assessment role none cannot be combined with another role',
        ));
      }
      checkClaims(
        errors,
        activity.source_provenance,
        referenceIds,
        repository.activities.file,
        `${field}/source_provenance`,
        { requireSourceSupported: true },
      );
      const grade5Modes = new Set(activity.grade5_science_applicability.delivery_modes);
      for (const mode of ['classroom', 'homeschool']) {
        if (!grade5Modes.has(mode)) {
          errors.push(diagnostic(
            'error',
            repository.activities.file,
            `${field}/grade5_science_applicability/delivery_modes`,
            `grade 5 science applicability must include ${mode}`,
          ));
        }
      }
      for (const language of ['en', 'et', 'ru']) {
        const normalized = normalizeName(activity.names[language]);
        const previous = namesByLanguage[language].get(normalized);
        if (previous) {
          errors.push(diagnostic(
            'error',
            repository.activities.file,
            `${field}/names/${language}`,
            `duplicate ${language} activity name also used by ${previous}`,
          ));
        } else {
          namesByLanguage[language].set(normalized, activity.activity_id);
        }
      }
    }
  }

  for (const [artifactIndex, artifact] of repository.patterns.entries()) {
    if (!validPatterns[artifactIndex]) continue;
    for (const [patternIndex, pattern] of artifact.data.patterns.entries()) {
      const field = `/patterns/${patternIndex}`;
      checkGradeRange(errors, pattern.suitable_grades, artifact.file, `${field}/suitable_grades`);
      const sequences = pattern.recommended_components.map((component) => component.sequence);
      const expectedSequences = Array.from({ length: sequences.length }, (_, index) => index + 1);
      if (JSON.stringify(sequences) !== JSON.stringify(expectedSequences)) {
        errors.push(diagnostic(
          'error',
          artifact.file,
          `${field}/recommended_components`,
          `component sequence must be contiguous from 1; expected ${expectedSequences.join(', ')}`,
        ));
      }
      let hasActivityChoice = false;
      for (const [componentIndex, component] of pattern.recommended_components.entries()) {
        if (component.activity_options.length > 1) hasActivityChoice = true;
        for (const principleId of component.linked_principle_ids) {
          if (!principleIds.has(principleId)) {
            errors.push(diagnostic(
              'error',
              artifact.file,
              `${field}/recommended_components/${componentIndex}/linked_principle_ids`,
              `unknown pedagogical principle ${principleId}`,
            ));
          }
        }
        for (const activityId of component.activity_options) {
          if (!activityIds.has(activityId)) {
            errors.push(diagnostic(
              'error',
              artifact.file,
              `${field}/recommended_components/${componentIndex}/activity_options`,
              `unknown pedagogical activity ${activityId}`,
            ));
          }
        }
      }
      if (!hasActivityChoice) {
        errors.push(diagnostic(
          'error',
          artifact.file,
          `${field}/recommended_components`,
          'a flexible pattern must offer more than one activity in at least one component',
        ));
      }
      checkClaims(
        errors,
        pattern.source_provenance,
        referenceIds,
        artifact.file,
        `${field}/source_provenance`,
      );
    }
  }

  if (enforceMinimumProductionCounts) {
    const minimums = { references: 2, principles: 15, activities: 20, patterns: 4 };
    for (const [name, minimum] of Object.entries(minimums)) {
      if (counts[name] < minimum) {
        errors.push(diagnostic(
          'error',
          KNOWLEDGE_ROOT,
          '/',
          `production knowledge requires at least ${minimum} ${name}; found ${counts[name]}`,
        ));
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    counts,
  };
}

export function formatPedagogyDiagnostic(item) {
  return `${item.severity.toUpperCase()} ${item.file} ${item.field}: ${item.reason}`;
}

export function clonePedagogyKnowledge(repository) {
  return structuredClone(repository);
}

export const pedagogyKnowledgePaths = {
  root: KNOWLEDGE_ROOT,
  referenceFile: REFERENCE_FILE,
  activityFile: ACTIVITY_FILE,
  principleDirectory: PRINCIPLE_DIRECTORY,
  patternDirectory: PATTERN_DIRECTORY,
  schemaDirectory: SCHEMA_DIRECTORY,
  schemaFiles: SCHEMA_FILES,
};
