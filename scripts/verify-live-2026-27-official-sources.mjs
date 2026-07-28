#!/usr/bin/env node

import crypto from 'node:crypto';
import {
  load2026ComplianceRepository,
  validate2026ComplianceRepository,
} from './lib/2026-27-compliance.mjs';

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

try {
  const repository = await load2026ComplianceRepository();
  const validation = await validate2026ComplianceRepository(repository, { registryOnly: true });
  if (validation.summary.errors > 0) {
    throw new Error('the committed official-source registry is invalid');
  }
  const sourceById = new Map(
    repository.artifacts.registry.data.sources.map((source) => [source.source_id, source]),
  );
  const sourceIds = repository.artifacts.registry.data.verification_classification
    .manual_live_xml_hash_verified;
  let failures = 0;
  for (const sourceId of sourceIds) {
    const source = sourceById.get(sourceId);
    const response = await fetch(source.text_or_xml_url);
    if (!response.ok) {
      console.error(`${sourceId}: HTTP ${response.status}`);
      failures += 1;
      continue;
    }
    const actual = sha256(Buffer.from(await response.arrayBuffer()));
    if (actual !== source.content_identity.value) {
      console.error(
        `${sourceId}: live XML SHA-256 mismatch; expected ${source.content_identity.value}, got ${actual}`,
      );
      failures += 1;
      continue;
    }
    console.log(`${sourceId}: live XML SHA-256 verified (${actual})`);
  }
  if (failures > 0) {
    process.exitCode = 1;
  } else {
    console.log(
      `Manual live XML verification passed for ${sourceIds.length} source(s); `
      + 'this command is not an ordinary CI assertion.',
    );
  }
} catch (error) {
  console.error(`Live official-source verification failed: ${error.message}`);
  process.exitCode = 1;
}
