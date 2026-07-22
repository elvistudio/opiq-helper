import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  containsUnprocessedPayload,
  expectedGrade2BookVariantCount,
  expectedGrade2Catalog,
  expectedGrade2PageCount,
  expectedGrade2RouteCount,
  mixedScriptWords,
  sanitizeCapturedTaskExample,
  sourceBookLanguageSuffix,
  textScriptProfile,
} from './lib/grade-2-content-quality.mjs';

test('catalogue invariant declares 11 routes, 42 variants, and 2535 pages', () => {
  assert.equal(Object.keys(expectedGrade2Catalog).length, expectedGrade2RouteCount);
  const variants = Object.values(expectedGrade2Catalog).flat();
  assert.equal(variants.length, expectedGrade2BookVariantCount);
  assert.equal(variants.reduce((total, variant) => total + variant[2], 0), expectedGrade2PageCount);
});

test('complete embedded data object is removed while decoded suffix remains', () => {
  const result = sanitizeCapturedTaskExample('Vali. {"data":"<p>üks kaks</p>"} üks kaks');
  assert.deepEqual(result, { text: 'Vali. üks kaks', removed_payloads: 1 });
});

test('truncated embedded data suffix is removed without inventing text', () => {
  const result = sanitizeCapturedTaskExample('Ühenda nimed. {"data":["EESTI","LÄTI"');
  assert.deepEqual(result, { text: 'Ühenda nimed.', removed_payloads: 1 });
});

test('multiple payloads and invisible spacing controls normalize deterministically', () => {
  const result = sanitizeCapturedTaskExample('A\u200bB {"data":["x"]} x {"d');
  assert.deepEqual(result, { text: 'A B x', removed_payloads: 2 });
});

test('payload detector rejects JSON and HTML extractor fragments', () => {
  assert.equal(containsUnprocessedPayload('{"data":["x"]}'), true);
  assert.equal(containsUnprocessedPayload('<p>x</p>'), true);
  assert.equal(containsUnprocessedPayload('ordinary pupil text'), false);
});

test('source Book ID language suffix is parsed independently from canonical language', () => {
  assert.equal(sourceBookLanguageSuffix('avita_математика_2_et__kit578'), 'et');
  assert.equal(sourceBookLanguageSuffix('avita_природовед_2_ru'), 'ru');
  assert.equal(sourceBookLanguageSuffix('source_without_suffix'), null);
});

test('mixed-script and script-profile helpers expose language-quality signals', () => {
  assert.deepEqual(mixedScriptWords(['KeeleabiНапиши', 'ordinary']), ['KeeleabiНапиши']);
  assert.deepEqual(textScriptProfile(['abc', 'абв']), { cyrillic: 3, latin: 3 });
});

test('committed production report contains no hard errors and classifies every warning', async () => {
  const report = JSON.parse(await readFile('project-files/outputs/grade-2-content-quality-report.json', 'utf8'));
  assert.equal(report.summary.routes_checked, expectedGrade2RouteCount);
  assert.equal(report.summary.book_variants_checked, expectedGrade2BookVariantCount);
  assert.equal(report.summary.page_records_checked, expectedGrade2PageCount);
  assert.equal(report.summary.hard_error_count, 0);
  assert.ok(report.warnings.length > 0);
  assert.ok(report.warnings.every((warning) => warning.classification && warning.blocking === false));
  assert.equal(report.targeted_recapture.full_kits.length, 0);
});
