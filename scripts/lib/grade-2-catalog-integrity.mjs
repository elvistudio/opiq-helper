import { createHash } from 'node:crypto';

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function assertArchiveChecksum(path, bytes, expected) {
  invariant(typeof expected === 'string' && /^[0-9a-f]{64}$/.test(expected), `No immutable SHA-256 is registered for ${path}.`);
  invariant(sha256Bytes(bytes) === expected, `Source archive checksum changed for ${path}.`);
}

export function assertUniqueCanonicalUrls(routeId, records) {
  const seen = new Set();
  for (const record of records) {
    invariant(!seen.has(record.url), `${routeId}: duplicate canonical URL ${record.url}.`);
    seen.add(record.url);
  }
}

export function assertExactKitScope(routeId, records, includedKitIds, getKit) {
  const allowed = new Set(includedKitIds);
  invariant(allowed.size > 0, `${routeId}: exact kit scope is empty.`);
  for (const record of records) {
    const kit = getKit(record);
    invariant(allowed.has(kit), `${routeId}: record ${record.url} uses kit ${kit || '<missing>'}, outside exact scope.`);
  }
}

export function assertDisjointPartition(leftId, leftRecords, rightId, rightRecords, expectedUnionCount) {
  const left = new Set(leftRecords.map((record) => record.url));
  const right = new Set(rightRecords.map((record) => record.url));
  const overlap = [...left].find((url) => right.has(url));
  invariant(!overlap, `${leftId} and ${rightId} overlap on canonical URL ${overlap}.`);
  invariant(left.size + right.size === expectedUnionCount,
    `${leftId} and ${rightId} partition ${left.size + right.size} URLs; expected ${expectedUnionCount}.`);
}

export function assertCrossRouteUrlOwnership(routeRecords) {
  const owners = new Map();
  for (const { routeId, records } of routeRecords) {
    for (const record of records) {
      const previous = owners.get(record.url);
      invariant(!previous || previous === routeId,
        `Canonical URL ${record.url} belongs to both ${previous} and ${routeId}.`);
      owners.set(record.url, routeId);
    }
  }
}

export function assertUrlPrefixesAbsent(routeId, records, forbiddenPrefixes) {
  for (const record of records) {
    const prefix = forbiddenPrefixes.find((candidate) => record.url.startsWith(candidate));
    invariant(!prefix, `${routeId}: forbidden URL ${record.url} matches ${prefix}.`);
  }
}

export function assertVariantIdentity(routeId, record, expectedSourceBookId, expectedKit, expectedCanonicalBookId, getKit) {
  invariant(record.source_book_id === expectedSourceBookId,
    `${routeId}: source Book ID ${record.source_book_id} does not match ${expectedSourceBookId}.`);
  invariant(getKit(record) === expectedKit, `${routeId}: wrong kit identity for ${record.url}.`);
  invariant(record.book_id === expectedCanonicalBookId,
    `${routeId}: canonical Book ID ${record.book_id} does not match ${expectedCanonicalBookId}.`);
}

export function assertRegisteredArchiveOwnership(routeId, records, registeredPaths) {
  const allowed = new Set(registeredPaths);
  for (const record of records) {
    invariant(allowed.has(record.source_archive_path),
      `${routeId}: record ${record.url} has no registered archive ownership.`);
  }
}

export function assertPublisherMatchesSource(routeId, variantKey, canonicalPublisher, sourcePublishers) {
  const found = [...new Set(sourcePublishers)];
  invariant(found.length === 1, `${routeId}: publisher evidence for ${variantKey} is ambiguous.`);
  invariant(canonicalPublisher === found[0],
    `${routeId}: publisher ${JSON.stringify(canonicalPublisher)} is not supported by source value ${JSON.stringify(found[0])} for ${variantKey}.`);
}
