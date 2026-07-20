import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { stringify } from 'yaml';

import {
  parseKnownTopicYaml,
  runKnownTopicRegressions,
} from './lib/known-topic-regressions.mjs';
import {
  findRegressionRecordsByUrl,
  parseOpiqRegressionMarkdown,
} from './lib/opiq-regression-markdown.mjs';

const alphaUrl = 'https://www.opiq.ee/kit/1/chapter/10';
const betaUrl = 'https://www.opiq.ee/kit/2/chapter/20';
const normalizedMarkdown = `# Summary

## Source Summary
- Class: 1

### 1. Alpha title
- URL: ${alphaUrl}
- Book ID: alpha-book
- Class: 1
- Language: et
- Subject ET: alpha et
- Subject RU: alpha ru
- Subject EN: alpha en
- Topics ET: alpha topic; extra
- Topics RU: альфа
- Topics EN: alpha
- Headings: Explicit heading; Secondary heading
- Task examples: Calculate the alpha value.
`;
const compactMarkdown = `# Summary

## Books
- Beta

## Beta title
URL: ${betaUrl}
Book ID: beta-book
Class: 2
Language: ru
Subject: beta en / beta et / beta ru
Topics ET: beta topic, extra
Topics RU: бета
Topics EN: beta
Headings: Beta heading; Another heading
Task examples: Calculate beta.; Explain beta.
`;

function manifestFixture() {
  return {
    sources: [
      {
        id: 'route-alpha', grade: 1, subject: 'alpha', md_path: 'records/alpha.md',
        coverage_status: 'available_not_curriculum_verified', quality_status: 'fixture',
      },
      {
        id: 'route-beta', grade: 2, subject: 'beta', md_path: 'records/beta.md',
        coverage_status: 'available_not_curriculum_verified', quality_status: 'fixture',
      },
    ],
    missing_coverage: [
      { grade: 4, coverage_status: 'missing', subjects: 'all' },
    ],
  };
}

function configFixture() {
  return {
    version: '2.0',
    scope: 'Fixture regression cases; not a curriculum map.',
    allowed_statuses: ['present', 'ambiguous', 'missing', 'not_verified'],
    cases: [
      {
        id: 'alpha-present', grade: 1, subject: 'alpha', topic: 'alpha', status: 'present',
        evidence: 'Alpha has an explicit canonical heading.',
        expected_source_id: 'route-alpha', expected_md_path: 'records/alpha.md',
        assertions: [
          {
            kind: 'record_present', source_id: 'route-alpha', url: alphaUrl,
            expected: { class: 1, title: 'Alpha title', book_id: 'alpha-book', headings_any: ['explicit heading'] },
          },
          { kind: 'url_absent', origin_source_id: 'route-alpha', source_id: 'route-beta', url: alphaUrl },
        ],
      },
      {
        id: 'beta-present', grade: 2, subject: 'beta', topic: 'beta', status: 'present',
        evidence: 'Beta has an explicit canonical task example.',
        expected_source_id: 'route-beta', expected_md_path: 'records/beta.md',
        assertions: [
          {
            kind: 'record_present', source_id: 'route-beta', url: betaUrl,
            expected: { class: 2, title: 'Beta title', task_examples_any: ['calculate beta'] },
          },
          { kind: 'url_absent', origin_source_id: 'route-beta', source_id: 'route-alpha', url: betaUrl },
        ],
      },
      {
        id: 'alpha-ambiguous', grade: 1, subject: 'alpha', topic: 'possible alpha', status: 'ambiguous',
        evidence: 'A generic heading exists but the explicit promotion phrase is absent.',
        expected_source_id: 'route-alpha', expected_md_path: 'records/alpha.md',
        assertions: [
          {
            kind: 'record_present', source_id: 'route-alpha', url: alphaUrl,
            expected: { headings_any: ['Explicit heading'] },
          },
          {
            kind: 'promotion_guard', source_id: 'route-alpha',
            fields: ['title', 'headings', 'task_examples'], absent_patterns: ['promote me'],
          },
        ],
      },
      {
        id: 'grade-4-missing', grade: 4, subject: 'all', topic: 'coverage', status: 'missing',
        evidence: 'Grade 4 is explicitly absent from the fixture manifest.',
        assertions: [{ kind: 'missing_coverage', grade: 4, subjects: 'all' }],
      },
      {
        id: 'beta-not-verified', grade: 2, subject: 'beta', topic: 'curriculum', status: 'not_verified',
        evidence: 'The route exists but curriculum completeness is not verified.',
        expected_source_id: 'route-beta', expected_md_path: 'records/beta.md',
        assertions: [
          {
            kind: 'manifest_equals', source_id: 'route-beta', field: 'coverage_status',
            value: 'available_not_curriculum_verified',
          },
        ],
      },
    ],
  };
}

async function createFixture(mutator = async () => {}) {
  const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), 'opiq-topic-regression-'));
  const fixture = {
    repositoryRoot,
    manifest: manifestFixture(),
    config: configFixture(),
    alphaMarkdown: normalizedMarkdown,
    betaMarkdown: compactMarkdown,
  };
  await mutator(fixture);
  await mkdir(path.join(repositoryRoot, 'evaluations'), { recursive: true });
  await mkdir(path.join(repositoryRoot, 'records'), { recursive: true });
  await writeFile(path.join(repositoryRoot, 'source-manifest.json'), `${JSON.stringify(fixture.manifest, null, 2)}\n`);
  await writeFile(path.join(repositoryRoot, 'evaluations/cases.yaml'), stringify(fixture.config));
  await writeFile(path.join(repositoryRoot, 'records/alpha.md'), fixture.alphaMarkdown);
  await writeFile(path.join(repositoryRoot, 'records/beta.md'), fixture.betaMarkdown);
  return fixture;
}

async function withFixture(mutator, callback) {
  const fixture = await createFixture(mutator);
  try {
    return await callback(fixture);
  } finally {
    await rm(fixture.repositoryRoot, { recursive: true, force: true });
  }
}

async function runFixture(fixture, caseId = null) {
  return runKnownTopicRegressions({
    repositoryRoot: fixture.repositoryRoot,
    casesPath: 'evaluations/cases.yaml',
    caseId,
  });
}

async function expectFixtureFailure(name, mutator, pattern, caseId = null) {
  await test(name, async () => {
    await withFixture(mutator, async (fixture) => {
      await assert.rejects(() => runFixture(fixture, caseId), pattern);
    });
  });
}

test('parses normalized Markdown and ignores summary headings', () => {
  const parsed = parseOpiqRegressionMarkdown(normalizedMarkdown, { sourceId: 'route-alpha', mdPath: 'alpha.md' });
  assert.equal(parsed.format, 'normalized');
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.records[0].title, 'Alpha title');
});

test('parses compact Markdown and ignores service headings', () => {
  const parsed = parseOpiqRegressionMarkdown(compactMarkdown, { sourceId: 'route-beta', mdPath: 'beta.md' });
  assert.equal(parsed.format, 'compact');
  assert.equal(parsed.records.length, 1);
  assert.deepEqual(parsed.records[0].headings, ['Beta heading', 'Another heading']);
});

test('looks up an exact record by URL', () => {
  const { records } = parseOpiqRegressionMarkdown(normalizedMarkdown, { sourceId: 'route-alpha' });
  assert.equal(findRegressionRecordsByUrl(records, alphaUrl).length, 1);
  assert.equal(findRegressionRecordsByUrl(records, `${alphaUrl}/extra`).length, 0);
});

test('normalizes combined Subject EN/ET/RU', () => {
  const { records } = parseOpiqRegressionMarkdown(compactMarkdown, { sourceId: 'route-beta' });
  assert.deepEqual(records[0].subject, { en: 'beta en', et: 'beta et', ru: 'beta ru' });
});

test('normalizes split Subject ET/RU/EN', () => {
  const { records } = parseOpiqRegressionMarkdown(normalizedMarkdown, { sourceId: 'route-alpha' });
  assert.deepEqual(records[0].subject, { en: 'alpha en', et: 'alpha et', ru: 'alpha ru' });
});

test('executes a present case', async () => {
  await withFixture(async () => {}, async (fixture) => {
    const result = await runFixture(fixture, 'alpha-present');
    assert.match(result.lines[0], /^PASS alpha-present \[present\]/u);
  });
});

test('executes an ambiguous case with a clear promotion guard', async () => {
  await withFixture(async () => {}, async (fixture) => {
    const result = await runFixture(fixture, 'alpha-ambiguous');
    assert.match(result.lines[0], /promotion_guard=clear/u);
  });
});

test('executes a missing coverage case', async () => {
  await withFixture(async () => {}, async (fixture) => {
    const result = await runFixture(fixture, 'grade-4-missing');
    assert.equal(result.statusCounts.missing, 1);
  });
});

test('executes a not_verified manifest case', async () => {
  await withFixture(async () => {}, async (fixture) => {
    const result = await runFixture(fixture, 'beta-not-verified');
    assert.equal(result.statusCounts.not_verified, 1);
  });
});

test('passes positive and negative coverage gates for every fixture route', async () => {
  await withFixture(async () => {}, async (fixture) => {
    const result = await runFixture(fixture);
    assert.deepEqual([...result.positiveCoverage].sort(), ['route-alpha', 'route-beta']);
    assert.deepEqual([...result.negativeCoverage].sort(), ['route-alpha', 'route-beta']);
  });
});

test('rejects malformed YAML with location context', () => {
  assert.throws(() => parseKnownTopicYaml('version: [\n', 'fixture.yaml'), /line \d+, column \d+/u);
});

test('rejects duplicate YAML mapping keys', () => {
  assert.throws(() => parseKnownTopicYaml('version: "2.0"\nversion: "2.0"\n', 'fixture.yaml'), /Map keys must be unique/u);
});

test('rejects arbitrary YAML custom tags', () => {
  assert.throws(() => parseKnownTopicYaml('version: !evil value\n', 'fixture.yaml'), /Unresolved tag: !evil/u);
});

await expectFixtureFailure('rejects duplicate case IDs', async (fixture) => {
  fixture.config.cases.push(structuredClone(fixture.config.cases[0]));
}, /duplicate case ID/u);

await expectFixtureFailure('rejects unsupported status', async (fixture) => {
  fixture.config.cases[0].status = 'unknown';
}, /status "unknown" is unsupported/u);

await expectFixtureFailure('rejects empty evidence', async (fixture) => {
  fixture.config.cases[0].evidence = ' ';
}, /evidence must be a non-empty string/u);

await expectFixtureFailure('rejects unknown source ID', async (fixture) => {
  fixture.config.cases[0].expected_source_id = 'route-unknown';
}, /unknown source ID/u);

await expectFixtureFailure('rejects case grade mismatch', async (fixture) => {
  fixture.config.cases[0].grade = 2;
}, /grade 2 does not match manifest grade 1/u);

await expectFixtureFailure('rejects case subject mismatch', async (fixture) => {
  fixture.config.cases[0].subject = 'beta';
}, /subject "beta" does not match/u);

await expectFixtureFailure('rejects expected path mismatch', async (fixture) => {
  fixture.config.cases[0].expected_md_path = 'records/wrong.md';
}, /does not match manifest md_path/u);

await expectFixtureFailure('rejects an absolute repository path', async (fixture) => {
  fixture.config.cases[0].expected_md_path = '/tmp/alpha.md';
}, /must be repository-relative/u);

await expectFixtureFailure('rejects path traversal', async (fixture) => {
  fixture.config.cases[0].expected_md_path = '../alpha.md';
}, /must not contain path traversal/u);

await expectFixtureFailure('rejects an absent required URL', async (fixture) => {
  fixture.config.cases[0].assertions[0].url = 'https://www.opiq.ee/kit/1/chapter/999';
}, /required URL is absent/u, 'alpha-present');

await expectFixtureFailure('rejects a URL duplicated in the target route', async (fixture) => {
  fixture.alphaMarkdown += normalizedMarkdown
    .replace('### 1. Alpha title', '### 2. Alpha title copy')
    .replace('# Summary\n\n## Source Summary\n- Class: 1\n\n', '');
}, /required URL is duplicated in target route/u, 'alpha-present');

await expectFixtureFailure('rejects a missing heading assertion', async (fixture) => {
  fixture.config.cases[0].assertions[0].expected.headings_any = ['not present'];
}, /headings_any did not match/u, 'alpha-present');

await expectFixtureFailure('rejects Topics-only evidence for present status', async (fixture) => {
  fixture.config.cases[0].assertions[0].expected = { topics_any: ['alpha topic'] };
}, /present status cannot be proved only by Topics/u);

await expectFixtureFailure('rejects a URL found in a forbidden route', async (fixture) => {
  fixture.betaMarkdown += `\n## Wrong-route copy\nURL: ${alphaUrl}\nBook ID: wrong\nClass: 2\nSubject: beta en / beta et / beta ru\n`;
}, /URL was found in forbidden route/u, 'alpha-present');

await expectFixtureFailure('rejects identical origin and target source IDs', async (fixture) => {
  fixture.config.cases[0].assertions[1].source_id = 'route-alpha';
}, /origin_source_id must differ from source_id/u);

await expectFixtureFailure('rejects a newly explicit ambiguous promotion pattern', async (fixture) => {
  fixture.alphaMarkdown = fixture.alphaMarkdown.replace('Secondary heading', 'Secondary heading; promote me');
}, /ambiguous case may now have explicit positive evidence; review its status/u, 'alpha-ambiguous');

await expectFixtureFailure('rejects disappearance of generic ambiguous evidence', async (fixture) => {
  fixture.alphaMarkdown = fixture.alphaMarkdown.replace('Explicit heading', 'Different heading');
}, /headings_any did not match/u, 'alpha-ambiguous');

await expectFixtureFailure('rejects missing status when the grade gains a source route', async (fixture) => {
  fixture.manifest.sources.push({ id: 'route-four', grade: 4, subject: 'delta', md_path: 'records/four.md' });
}, /missing grade unexpectedly has a source route/u, 'grade-4-missing');

await expectFixtureFailure('rejects removal of the missing_coverage declaration', async (fixture) => {
  fixture.manifest.missing_coverage = [];
}, /missing_coverage entry is absent/u, 'grade-4-missing');

await expectFixtureFailure('rejects a route without positive coverage', async (fixture) => {
  fixture.config.cases = fixture.config.cases.filter((entry) => entry.id !== 'beta-present');
  fixture.config.cases.find((entry) => entry.id === 'beta-not-verified').assertions.push(
    { kind: 'url_absent', origin_source_id: 'route-beta', source_id: 'route-alpha', url: betaUrl },
  );
}, /routes without positive coverage: route-beta/u);

await expectFixtureFailure('rejects a route without negative coverage', async (fixture) => {
  fixture.config.cases.find((entry) => entry.id === 'beta-present').assertions = [
    fixture.config.cases.find((entry) => entry.id === 'beta-present').assertions[0],
  ];
}, /routes without negative coverage: route-beta/u);

await expectFixtureFailure('rejects simultaneous singular and plural expected fields', async (fixture) => {
  fixture.config.cases[0].expected_source_ids = ['route-alpha', 'route-beta'];
  fixture.config.cases[0].expected_md_paths = ['records/alpha.md', 'records/beta.md'];
}, /cannot use singular and plural expected source fields together/u);

await expectFixtureFailure('rejects an unknown assertion kind', async (fixture) => {
  fixture.config.cases[0].assertions[0] = { kind: 'unknown_assertion' };
}, /unknown assertion kind/u);

await expectFixtureFailure('rejects an unknown case field', async (fixture) => {
  fixture.config.cases[0].typo_field = true;
}, /unknown field "typo_field"/u);

await expectFixtureFailure('rejects an unknown assertion field', async (fixture) => {
  fixture.config.cases[0].assertions[0].typo_field = true;
}, /unknown field "typo_field"/u);
