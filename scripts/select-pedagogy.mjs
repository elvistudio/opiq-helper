#!/usr/bin/env node
import fs from 'node:fs/promises';
import { selectPedagogy } from './lib/pedagogy-selection.mjs';
const fixtures = JSON.parse(await fs.readFile('knowledge/pedagogy/fixtures/pedagogical-selection-fixtures.json', 'utf8')).fixtures;
const out = [];
for (const fixture of fixtures) out.push({ id: fixture.id, result: await selectPedagogy({ id: fixture.id, ...fixture.request }) });
console.log(JSON.stringify({ schema_version: '1.0', fixture_count: fixtures.length, results: out }, null, 2));
