import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { parseDocument } from 'yaml';

import {
  containsRegressionPattern,
  findRegressionRecordsByUrl,
  normalizeRegressionText,
  parseOpiqRegressionMarkdown,
} from './opiq-regression-markdown.mjs';

const schemaStatuses = ['present', 'ambiguous', 'missing', 'not_verified'];
const safeManifestFields = new Set(['coverage_status', 'quality_status', 'grade', 'subject', 'md_path']);
const topLevelFields = new Set(['version', 'scope', 'allowed_statuses', 'cases']);
const caseFields = new Set([
  'id', 'grade', 'subject', 'topic', 'status', 'evidence',
  'expected_source_id', 'expected_md_path', 'expected_source_ids', 'expected_md_paths', 'assertions',
]);
const assertionFields = {
  record_present: new Set(['kind', 'source_id', 'url', 'expected']),
  url_absent: new Set(['kind', 'origin_source_id', 'source_id', 'url']),
  book_id_absent: new Set(['kind', 'source_id', 'book_id']),
  promotion_guard: new Set(['kind', 'source_id', 'fields', 'absent_patterns']),
  missing_coverage: new Set(['kind', 'grade', 'subjects']),
  manifest_equals: new Set(['kind', 'source_id', 'field', 'value']),
};
const recordExpectedFields = new Set([
  'class', 'title', 'book_id', 'subject',
  'headings_any', 'headings_all', 'task_examples_any', 'task_examples_all',
  'topics_any', 'topics_all',
]);
const subjectFields = new Set(['en', 'et', 'ru']);
const promotionFields = new Set(['title', 'headings', 'task_examples']);
const directOpiqUrlPattern = /^https:\/\/(?:www\.)?opiq\.ee\/\S+$/i;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertKnownFields(object, allowed, context) {
  assert(isPlainObject(object), `${context} must be an object.`);
  for (const field of Object.keys(object)) {
    assert(allowed.has(field), `${context} has unknown field "${field}".`);
  }
}

function assertNonEmptyString(value, context) {
  assert(typeof value === 'string' && normalizeRegressionText(value), `${context} must be a non-empty string.`);
}

function assertStringArray(value, context) {
  assert(Array.isArray(value) && value.length > 0, `${context} must be a non-empty array.`);
  value.forEach((entry, index) => assertNonEmptyString(entry, `${context}[${index}]`));
}

export function validateRepositoryRelativePath(value, context) {
  assertNonEmptyString(value, context);
  assert(!path.isAbsolute(value) && !/^[A-Za-z]:[\\/]/u.test(value), `${context} must be repository-relative.`);
  assert(!value.includes('\\'), `${context} must use repository-relative POSIX separators.`);
  assert(!value.split('/').includes('..'), `${context} must not contain path traversal (..).`);
  const normalized = path.posix.normalize(value);
  assert(normalized !== '.' && !normalized.startsWith('../'), `${context} points outside the repository.`);
  return normalized;
}

function repositoryFile(repositoryRoot, relativePath, context) {
  const normalized = validateRepositoryRelativePath(relativePath, context);
  const absolute = path.resolve(repositoryRoot, normalized);
  assert(absolute.startsWith(`${path.resolve(repositoryRoot)}${path.sep}`), `${context} points outside the repository.`);
  return absolute;
}

export function parseKnownTopicYaml(text, label = 'known-topic checks') {
  let document;
  try {
    document = parseDocument(text, {
      customTags: [],
      prettyErrors: true,
      schema: 'core',
      strict: true,
      uniqueKeys: true,
      version: '1.2',
    });
  } catch (error) {
    throw new Error(`${label}: YAML parse failed: ${error.message}`);
  }
  if (document.errors.length > 0) {
    throw new Error(`${label}: YAML parse failed: ${document.errors.map((error) => error.message).join('; ')}`);
  }
  if (document.warnings.length > 0) {
    throw new Error(`${label}: YAML parse failed: ${document.warnings.map((warning) => warning.message).join('; ')}`);
  }
  try {
    return document.toJS({ maxAliasCount: 0 });
  } catch (error) {
    throw new Error(`${label}: YAML conversion failed: ${error.message}`);
  }
}

function validateExpectedRecord(expected, context) {
  assertKnownFields(expected, recordExpectedFields, context);
  if (Object.hasOwn(expected, 'class')) {
    assert(Number.isInteger(expected.class) && expected.class > 0, `${context}.class must be a positive integer.`);
  }
  for (const field of ['title', 'book_id']) {
    if (Object.hasOwn(expected, field)) assertNonEmptyString(expected[field], `${context}.${field}`);
  }
  if (Object.hasOwn(expected, 'subject')) {
    assertKnownFields(expected.subject, subjectFields, `${context}.subject`);
    assert(Object.keys(expected.subject).length > 0, `${context}.subject must not be empty.`);
    Object.entries(expected.subject).forEach(([language, value]) => {
      assertNonEmptyString(value, `${context}.subject.${language}`);
    });
  }
  for (const field of [
    'headings_any', 'headings_all', 'task_examples_any', 'task_examples_all', 'topics_any', 'topics_all',
  ]) {
    if (Object.hasOwn(expected, field)) assertStringArray(expected[field], `${context}.${field}`);
  }
}

function validateAssertion(assertion, context) {
  assert(isPlainObject(assertion), `${context} must be an object.`);
  assertNonEmptyString(assertion.kind, `${context}.kind`);
  const allowed = assertionFields[assertion.kind];
  assert(allowed, `${context} has unknown assertion kind "${assertion.kind}".`);
  assertKnownFields(assertion, allowed, context);

  if (assertion.kind === 'record_present') {
    assertNonEmptyString(assertion.source_id, `${context}.source_id`);
    assertNonEmptyString(assertion.url, `${context}.url`);
    assert(directOpiqUrlPattern.test(assertion.url), `${context}.url must be an exact direct Opiq URL.`);
    assert(Object.hasOwn(assertion, 'expected'), `${context}.expected is required for explicit evidence.`);
    validateExpectedRecord(assertion.expected, `${context}.expected`);
  } else if (assertion.kind === 'url_absent') {
    assertNonEmptyString(assertion.origin_source_id, `${context}.origin_source_id`);
    assertNonEmptyString(assertion.source_id, `${context}.source_id`);
    assert(assertion.origin_source_id !== assertion.source_id, `${context}: origin_source_id must differ from source_id.`);
    assertNonEmptyString(assertion.url, `${context}.url`);
    assert(directOpiqUrlPattern.test(assertion.url), `${context}.url must be an exact direct Opiq URL.`);
  } else if (assertion.kind === 'book_id_absent') {
    assertNonEmptyString(assertion.source_id, `${context}.source_id`);
    assertNonEmptyString(assertion.book_id, `${context}.book_id`);
  } else if (assertion.kind === 'promotion_guard') {
    assertNonEmptyString(assertion.source_id, `${context}.source_id`);
    assertStringArray(assertion.fields, `${context}.fields`);
    assertion.fields.forEach((field) => assert(promotionFields.has(field), `${context}.fields contains unsupported field "${field}".`));
    assertStringArray(assertion.absent_patterns, `${context}.absent_patterns`);
  } else if (assertion.kind === 'missing_coverage') {
    assert(Number.isInteger(assertion.grade) && assertion.grade > 0, `${context}.grade must be a positive integer.`);
    assert(
      assertion.subjects === 'all' || (Array.isArray(assertion.subjects) && assertion.subjects.length > 0),
      `${context}.subjects must be "all" or a non-empty array.`,
    );
    if (Array.isArray(assertion.subjects)) assertStringArray(assertion.subjects, `${context}.subjects`);
  } else if (assertion.kind === 'manifest_equals') {
    assertNonEmptyString(assertion.source_id, `${context}.source_id`);
    assert(safeManifestFields.has(assertion.field), `${context}.field is not an allowed manifest field.`);
    assert(Object.hasOwn(assertion, 'value'), `${context}.value is required.`);
    if (assertion.field === 'grade') {
      assert(Number.isInteger(assertion.value) && assertion.value > 0, `${context}.value must be a positive integer for grade.`);
    } else {
      assertNonEmptyString(assertion.value, `${context}.value`);
    }
  }
}

export function validateKnownTopicSchema(config, manifest) {
  assertKnownFields(config, topLevelFields, 'known-topic root');
  assert(config.version === '2.0', 'known-topic root.version must be "2.0".');
  assertNonEmptyString(config.scope, 'known-topic root.scope');
  assertStringArray(config.allowed_statuses, 'known-topic root.allowed_statuses');
  assert(
    JSON.stringify([...config.allowed_statuses].sort()) === JSON.stringify([...schemaStatuses].sort()),
    `known-topic root.allowed_statuses must contain exactly: ${schemaStatuses.join(', ')}.`,
  );
  assert(Array.isArray(config.cases) && config.cases.length > 0, 'known-topic root.cases must be a non-empty array.');
  assert(isPlainObject(manifest) && Array.isArray(manifest.sources), 'source-manifest.json must contain a sources array.');
  const sources = new Map(manifest.sources.map((source) => [source.id, source]));
  const ids = new Set();

  config.cases.forEach((regressionCase, index) => {
    const context = `case ${regressionCase?.id || index + 1}`;
    assertKnownFields(regressionCase, caseFields, context);
    for (const field of ['id', 'subject', 'topic', 'status', 'evidence']) {
      assertNonEmptyString(regressionCase[field], `${context}.${field}`);
    }
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(regressionCase.id), `${context}.id must be a slug.`);
    assert(!ids.has(regressionCase.id), `${context}: duplicate case ID "${regressionCase.id}".`);
    ids.add(regressionCase.id);
    assert(Number.isInteger(regressionCase.grade) && regressionCase.grade > 0, `${context}.grade must be a positive integer.`);
    assert(config.allowed_statuses.includes(regressionCase.status), `${context}.status "${regressionCase.status}" is unsupported.`);
    assert(normalizeRegressionText(regressionCase.evidence).length >= 10, `${context}.evidence must be a substantive non-empty string.`);
    assert(Array.isArray(regressionCase.assertions) && regressionCase.assertions.length > 0, `${context}.assertions must be a non-empty array.`);
    regressionCase.assertions.forEach((assertion, assertionIndex) => validateAssertion(assertion, `${context} assertion ${assertionIndex + 1}`));

    const hasSingularSource = Object.hasOwn(regressionCase, 'expected_source_id');
    const hasPluralSources = Object.hasOwn(regressionCase, 'expected_source_ids');
    const hasSingularPath = Object.hasOwn(regressionCase, 'expected_md_path');
    const hasPluralPaths = Object.hasOwn(regressionCase, 'expected_md_paths');
    assert(!(hasSingularSource && hasPluralSources), `${context} cannot use singular and plural expected source fields together.`);
    assert(!(hasSingularPath && hasPluralPaths), `${context} cannot use singular and plural expected path fields together.`);
    assert(hasSingularSource === hasSingularPath, `${context} must pair expected_source_id with expected_md_path.`);
    assert(hasPluralSources === hasPluralPaths, `${context} must pair expected_source_ids with expected_md_paths.`);

    if (regressionCase.status === 'missing') {
      assert(!hasSingularSource && !hasPluralSources, `${context}: missing cases must not declare a canonical source route.`);
    } else {
      assert(hasSingularSource || hasPluralSources, `${context}: non-missing cases must declare expected source route metadata.`);
    }

    const expectedIds = hasSingularSource ? [regressionCase.expected_source_id] : (regressionCase.expected_source_ids || []);
    const expectedPaths = hasSingularPath ? [regressionCase.expected_md_path] : (regressionCase.expected_md_paths || []);
    if (hasPluralSources) {
      assertStringArray(expectedIds, `${context}.expected_source_ids`);
      assertStringArray(expectedPaths, `${context}.expected_md_paths`);
      assert(expectedIds.length === expectedPaths.length, `${context}: plural expected source and path arrays must have equal length.`);
      assert(expectedIds.length >= 2, `${context}: plural route metadata requires at least two routes.`);
    }
    expectedIds.forEach((sourceId, routeIndex) => {
      assertNonEmptyString(sourceId, `${context} expected source`);
      const source = sources.get(sourceId);
      assert(source, `${context}: unknown source ID "${sourceId}".`);
      const expectedPath = validateRepositoryRelativePath(expectedPaths[routeIndex], `${context} expected path`);
      assert(expectedPath === source.md_path, `${context}: expected path "${expectedPath}" does not match manifest md_path "${source.md_path}" for ${sourceId}.`);
      assert(source.grade === regressionCase.grade, `${context}: grade ${regressionCase.grade} does not match manifest grade ${source.grade} for ${sourceId}.`);
    });
    if (expectedIds.length > 0) {
      assert(
        expectedIds.some((sourceId) => sources.get(sourceId).subject === regressionCase.subject),
        `${context}: subject "${regressionCase.subject}" does not match any declared manifest route.`,
      );
    }

    for (const [assertionIndex, assertion] of regressionCase.assertions.entries()) {
      const assertionContext = `${context} assertion ${assertionIndex + 1}`;
      if (['record_present', 'book_id_absent', 'promotion_guard', 'manifest_equals'].includes(assertion.kind)) {
        assert(sources.has(assertion.source_id), `${assertionContext}: unknown source ID "${assertion.source_id}".`);
        assert(
          expectedIds.includes(assertion.source_id),
          `${assertionContext}: source_id "${assertion.source_id}" is not declared in expected route metadata.`,
        );
      } else if (assertion.kind === 'url_absent') {
        assert(sources.has(assertion.origin_source_id), `${assertionContext}: unknown origin source ID "${assertion.origin_source_id}".`);
        assert(sources.has(assertion.source_id), `${assertionContext}: unknown source ID "${assertion.source_id}".`);
        assert(
          expectedIds.includes(assertion.origin_source_id),
          `${assertionContext}: origin_source_id "${assertion.origin_source_id}" is not declared in expected route metadata.`,
        );
      }
    }

    const recordPresent = regressionCase.assertions.filter((assertion) => assertion.kind === 'record_present');
    if (regressionCase.status === 'present') {
      assert(recordPresent.length > 0, `${context}: present status requires at least one record_present assertion.`);
      assert(
        recordPresent.some((assertion) => hasExplicitEvidence(assertion.expected)),
        `${context}: present status cannot be proved only by Topics or route metadata.`,
      );
    } else if (regressionCase.status === 'ambiguous') {
      assert(recordPresent.length > 0, `${context}: ambiguous status requires at least one record_present assertion for limited evidence.`);
      assert(
        regressionCase.assertions.some((assertion) => assertion.kind === 'promotion_guard'),
        `${context}: ambiguous status requires at least one promotion_guard assertion.`,
      );
    } else if (regressionCase.status === 'missing') {
      assert(
        regressionCase.assertions.some((assertion) => assertion.kind === 'missing_coverage'),
        `${context}: missing status requires a missing_coverage assertion.`,
      );
    } else if (regressionCase.status === 'not_verified') {
      assert(
        regressionCase.assertions.some((assertion) => assertion.kind === 'manifest_equals'),
        `${context}: not_verified status requires a manifest_equals assertion.`,
      );
    }
  });

  return { sources };
}

function hasExplicitEvidence(expected) {
  return Boolean(
    normalizeRegressionText(expected.title)
    || ['headings_any', 'headings_all', 'task_examples_any', 'task_examples_all']
      .some((field) => Array.isArray(expected[field]) && expected[field].length > 0),
  );
}

function contextError(regressionCase, assertion, source, details) {
  const values = {
    assertion: assertion.kind,
    source: source?.id || assertion.source_id || assertion.origin_source_id || '<manifest>',
    md_path: source?.md_path || '<none>',
    url: assertion.url || '<none>',
    expected: details.expected ?? '<none>',
    found: details.found ?? '<none>',
  };
  return new Error(
    `FAIL ${regressionCase.id} [${regressionCase.status}] evidence=${JSON.stringify(regressionCase.evidence)} `
    + `assertion=${values.assertion} source=${values.source} md_path=${values.md_path} url=${values.url} `
    + `expected=${JSON.stringify(values.expected)} found=${JSON.stringify(values.found)} message=${details.message}`,
  );
}

function exactText(actual, expected) {
  return normalizeRegressionText(actual) === normalizeRegressionText(expected);
}

function checkPatterns(actualValues, patterns, mode) {
  const results = patterns.map((pattern) => containsRegressionPattern(actualValues, pattern));
  return mode === 'all' ? results.every(Boolean) : results.some(Boolean);
}

function executeRecordPresent(regressionCase, assertion, source, records) {
  const matches = findRegressionRecordsByUrl(records, assertion.url);
  if (matches.length !== 1) {
    throw contextError(regressionCase, assertion, source, {
      expected: 'URL occurs exactly once',
      found: `${matches.length} occurrences`,
      message: matches.length === 0 ? 'required URL is absent' : 'required URL is duplicated in target route',
    });
  }
  const record = matches[0];
  const expected = assertion.expected;
  const exactChecks = [
    ['class', record.class],
    ['title', record.title],
    ['book_id', record.book_id],
  ];
  for (const [field, actual] of exactChecks) {
    if (Object.hasOwn(expected, field) && !exactText(actual, expected[field])) {
      throw contextError(regressionCase, assertion, source, {
        expected: expected[field], found: actual, message: `record ${record.position} ${field} mismatch`,
      });
    }
  }
  if (expected.subject) {
    for (const [language, value] of Object.entries(expected.subject)) {
      if (!exactText(record.subject[language], value)) {
        throw contextError(regressionCase, assertion, source, {
          expected: value, found: record.subject[language], message: `record ${record.position} Subject ${language} mismatch`,
        });
      }
    }
  }
  const patternChecks = [
    ['headings_any', record.headings, 'any'],
    ['headings_all', record.headings, 'all'],
    ['task_examples_any', record.task_examples, 'any'],
    ['task_examples_all', record.task_examples, 'all'],
    ['topics_any', Object.values(record.topics).flat(), 'any'],
    ['topics_all', Object.values(record.topics).flat(), 'all'],
  ];
  for (const [field, actual, mode] of patternChecks) {
    if (Object.hasOwn(expected, field) && !checkPatterns(actual, expected[field], mode)) {
      throw contextError(regressionCase, assertion, source, {
        expected: expected[field], found: actual, message: `record ${record.position} ${field} did not match`,
      });
    }
  }
  return record;
}

function executePromotionGuard(regressionCase, assertion, source, records) {
  const values = [];
  for (const record of records) {
    for (const field of assertion.fields) {
      if (field === 'title') values.push(record.title);
      else values.push(...record[field]);
    }
  }
  const foundPattern = assertion.absent_patterns.find((pattern) => containsRegressionPattern(values, pattern));
  if (foundPattern) {
    throw contextError(regressionCase, assertion, source, {
      expected: 'no explicit promotion pattern', found: foundPattern,
      message: 'ambiguous case may now have explicit positive evidence; review its status',
    });
  }
}

export async function runKnownTopicRegressions({
  repositoryRoot,
  manifestPath = 'source-manifest.json',
  casesPath = 'evaluations/known-topic-checks.yaml',
  caseId = null,
}) {
  const manifestFile = repositoryFile(repositoryRoot, manifestPath, '--manifest');
  const casesFile = repositoryFile(repositoryRoot, casesPath, '--cases');
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  const config = parseKnownTopicYaml(await readFile(casesFile, 'utf8'), casesPath);
  const { sources } = validateKnownTopicSchema(config, manifest);
  const selectedCases = caseId ? config.cases.filter((regressionCase) => regressionCase.id === caseId) : config.cases;
  if (caseId) assert(selectedCases.length === 1, `Unknown case ID "${caseId}".`);

  const markdownCache = new Map();
  const recordsFor = async (sourceId) => {
    const source = sources.get(sourceId);
    assert(source, `Unknown source ID "${sourceId}".`);
    if (!markdownCache.has(sourceId)) {
      const mdPath = repositoryFile(repositoryRoot, source.md_path, `${sourceId} md_path`);
      const parsed = parseOpiqRegressionMarkdown(await readFile(mdPath, 'utf8'), {
        sourceId,
        mdPath: source.md_path,
      });
      markdownCache.set(sourceId, parsed.records);
    }
    return markdownCache.get(sourceId);
  };

  const lines = [];
  const positiveCoverage = new Set();
  const negativeCoverage = new Set();
  for (const regressionCase of selectedCases) {
    let promotionGuardClear = false;
    for (const assertion of regressionCase.assertions) {
      if (assertion.kind === 'record_present') {
        const source = sources.get(assertion.source_id);
        assert(source, `${regressionCase.id}: unknown source ID "${assertion.source_id}".`);
        executeRecordPresent(regressionCase, assertion, source, await recordsFor(assertion.source_id));
        positiveCoverage.add(assertion.source_id);
      } else if (assertion.kind === 'url_absent') {
        const origin = sources.get(assertion.origin_source_id);
        const target = sources.get(assertion.source_id);
        assert(origin, `${regressionCase.id}: unknown origin source ID "${assertion.origin_source_id}".`);
        assert(target, `${regressionCase.id}: unknown source ID "${assertion.source_id}".`);
        const originMatches = findRegressionRecordsByUrl(await recordsFor(origin.id), assertion.url);
        const targetMatches = findRegressionRecordsByUrl(await recordsFor(target.id), assertion.url);
        if (originMatches.length !== 1 || targetMatches.length !== 0) {
          throw contextError(regressionCase, assertion, target, {
            expected: `origin occurrences=1, target occurrences=0`,
            found: `origin occurrences=${originMatches.length}, target occurrences=${targetMatches.length}`,
            message: targetMatches.length ? 'URL was found in forbidden route' : 'origin route does not uniquely own URL',
          });
        }
        negativeCoverage.add(origin.id);
      } else if (assertion.kind === 'book_id_absent') {
        const source = sources.get(assertion.source_id);
        assert(source, `${regressionCase.id}: unknown source ID "${assertion.source_id}".`);
        const matches = (await recordsFor(source.id)).filter((record) => record.book_id === assertion.book_id);
        if (matches.length > 0) {
          throw contextError(regressionCase, assertion, source, {
            expected: '0 records', found: `${matches.length} records`, message: 'forbidden Book ID is present',
          });
        }
      } else if (assertion.kind === 'promotion_guard') {
        const source = sources.get(assertion.source_id);
        assert(source, `${regressionCase.id}: unknown source ID "${assertion.source_id}".`);
        executePromotionGuard(regressionCase, assertion, source, await recordsFor(source.id));
        promotionGuardClear = true;
      } else if (assertion.kind === 'missing_coverage') {
        const routeCount = manifest.sources.filter((source) => source.grade === assertion.grade).length;
        const missing = (manifest.missing_coverage || []).find((entry) => (
          entry.grade === assertion.grade
          && entry.coverage_status === 'missing'
          && JSON.stringify(entry.subjects) === JSON.stringify(assertion.subjects)
        ));
        if (routeCount !== 0 || !missing || regressionCase.status !== 'missing') {
          throw contextError(regressionCase, assertion, null, {
            expected: 'no source route and matching missing_coverage entry',
            found: `source routes=${routeCount}, missing entry=${Boolean(missing)}`,
            message: routeCount ? 'missing grade unexpectedly has a source route' : 'missing_coverage entry is absent',
          });
        }
      } else if (assertion.kind === 'manifest_equals') {
        const source = sources.get(assertion.source_id);
        assert(source, `${regressionCase.id}: unknown source ID "${assertion.source_id}".`);
        if (source[assertion.field] !== assertion.value) {
          throw contextError(regressionCase, assertion, source, {
            expected: assertion.value, found: source[assertion.field], message: `manifest field ${assertion.field} mismatch`,
          });
        }
      }
    }

    const sourceIds = regressionCase.expected_source_id
      ? [regressionCase.expected_source_id]
      : (regressionCase.expected_source_ids || []);
    const extra = regressionCase.status === 'ambiguous' && promotionGuardClear ? ' promotion_guard=clear' : '';
    lines.push(
      `PASS ${regressionCase.id} [${regressionCase.status}] source=${sourceIds.join(',') || 'manifest'}${extra} evidence=${JSON.stringify(regressionCase.evidence)}`,
    );
  }

  if (!caseId) {
    const missingPositive = manifest.sources.map((source) => source.id).filter((id) => !positiveCoverage.has(id));
    const missingNegative = manifest.sources.map((source) => source.id).filter((id) => !negativeCoverage.has(id));
    assert(missingPositive.length === 0, `Route coverage gate failed: routes without positive coverage: ${missingPositive.join(', ')}.`);
    assert(missingNegative.length === 0, `Route coverage gate failed: routes without negative coverage: ${missingNegative.join(', ')}.`);
  }

  const statusCounts = Object.fromEntries(schemaStatuses.map((status) => [
    status,
    selectedCases.filter((regressionCase) => regressionCase.status === status).length,
  ]));
  const summary = [
    `Known-topic regression check passed: ${selectedCases.length} case${selectedCases.length === 1 ? '' : 's'} `
      + `(${schemaStatuses.map((status) => `${status}=${statusCounts[status]}`).join(', ')}).`,
    `Manifest routes: ${manifest.sources.length}.`,
    caseId
      ? 'Route coverage gate: skipped for --case selection.'
      : `${positiveCoverage.size}/${manifest.sources.length} routes have positive coverage.`,
    caseId
      ? 'Negative route coverage gate: skipped for --case selection.'
      : `${negativeCoverage.size}/${manifest.sources.length} routes have negative routing coverage.`,
  ];
  return { lines, summary, statusCounts, positiveCoverage, negativeCoverage, config, manifest };
}
