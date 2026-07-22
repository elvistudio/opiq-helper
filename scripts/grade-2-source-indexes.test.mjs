import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertArchiveChecksum,
  assertCrossRouteUrlOwnership,
  assertDisjointPartition,
  assertExactKitScope,
  assertPublisherMatchesSource,
  assertRegisteredArchiveOwnership,
  assertUniqueCanonicalUrls,
  assertUrlPrefixesAbsent,
  assertVariantIdentity,
  sha256Bytes,
} from './lib/grade-2-catalog-integrity.mjs';

const record = (url, overrides = {}) => ({
  url,
  book_id: 'canonical-book',
  source_book_id: 'source-book',
  source_archive_path: 'capture.zip',
  ...overrides,
});
const kitOf = (value) => value.url.match(/\/kit\/(\d+)/)?.[1] ?? '';

test('accepts a complete disjoint Estonian subject partition', () => {
  assert.doesNotThrow(() => assertDisjointPartition(
    'first', [record('https://www.opiq.ee/kit/1/chapter/1')],
    'second', [record('https://www.opiq.ee/kit/2/chapter/2')],
    2,
  ));
});

test('rejects Estonian subject overlap', () => {
  const shared = record('https://www.opiq.ee/kit/129/chapter/1');
  assert.throws(() => assertDisjointPartition('first', [shared], 'second', [shared], 1), /overlap/);
});

test('rejects a missing route-partition record', () => {
  assert.throws(() => assertDisjointPartition(
    'first', [record('https://www.opiq.ee/kit/1/chapter/1')], 'second', [], 2,
  ), /expected 2/);
});

test('rejects duplicate canonical URLs', () => {
  const duplicate = record('https://www.opiq.ee/kit/95/chapter/1');
  assert.throws(() => assertUniqueCanonicalUrls('math', [duplicate, duplicate]), /duplicate canonical URL/);
});

test('rejects a wrong source-book-plus-kit identity', () => {
  assert.throws(() => assertVariantIdentity(
    'math', record('https://www.opiq.ee/kit/578/chapter/1', {
      source_book_id: 'avita_математика_2_et',
      book_id: 'avita_математика_2_et__kit578',
    }),
    'avita_математика_2_et', '165', 'avita_математика_2_et__kit578', kitOf,
  ), /wrong kit identity/);
});

test('rejects collapse of distinct canonical book variants', () => {
  assert.throws(() => assertVariantIdentity(
    'human', record('https://www.opiq.ee/kit/494/chapter/1', {
      source_book_id: 'avita_inimeseõpe_2_et',
      book_id: 'avita_inimeseõpe_2_et',
    }),
    'avita_inimeseõpe_2_et', '494', 'avita_inimeseõpe_2_et__kit494', kitOf,
  ), /canonical Book ID/);
});

test('rejects kit 330 remaining in a grade-1 route', () => {
  assert.throws(() => assertUrlPrefixesAbsent(
    'grade-1-science', [record('https://www.opiq.ee/kit/330/chapter/18523')],
    ['https://www.opiq.ee/kit/330/'],
  ), /forbidden URL/);
});

test('rejects kit 86 entering a subject-pure route', () => {
  const shared = record('https://www.opiq.ee/kit/86/chapter/4199');
  assert.throws(() => assertCrossRouteUrlOwnership([
    { routeId: 'grade-2-nature-and-human-studies', records: [shared] },
    { routeId: 'grade-2-science', records: [shared] },
  ]), /belongs to both/);
});

test('rejects a wrong kit in the mixed route', () => {
  assert.throws(() => assertExactKitScope(
    'mixed', [record('https://www.opiq.ee/kit/56/chapter/1')], ['86'], kitOf,
  ), /outside exact scope/);
});

test('rejects missing archive ownership', () => {
  assert.throws(() => assertRegisteredArchiveOwnership(
    'science', [record('https://www.opiq.ee/kit/330/chapter/1', { source_archive_path: 'unregistered.zip' })],
    ['primary.zip', 'supplementary.zip'],
  ), /no registered archive ownership/);
});

test('rejects invented publisher metadata', () => {
  assert.throws(() => assertPublisherMatchesSource(
    'arts', 'book::kit', 'Invented Publisher', [''],
  ), /not supported by source value/);
});

test('rejects source archive byte changes', () => {
  const original = Buffer.from('original archive bytes');
  const expected = sha256Bytes(original);
  assert.doesNotThrow(() => assertArchiveChecksum('capture.zip', original, expected));
  assert.throws(() => assertArchiveChecksum('capture.zip', Buffer.from('changed'), expected), /checksum changed/);
});
