#!/usr/bin/env node
import fs from 'node:fs/promises';
import { selectPedagogy, loadSelectionSchemas, createAjv } from './lib/pedagogy-selection.mjs';
const fixtures = JSON.parse(await fs.readFile('knowledge/pedagogy/fixtures/pedagogical-selection-fixtures.json', 'utf8')).fixtures;
const ajv = createAjv();
const schemas = await loadSelectionSchemas();
const validateDna = ajv.compile(schemas.dna);
let errors = 0;
for (const fixture of fixtures) {
  const result = await selectPedagogy({ id: fixture.id, ...fixture.request });
  if (!result.ok) { console.error(`${fixture.id}: ${result.diagnostics.join('; ')}`); errors++; continue; }
  if (result.selected_pattern_id !== fixture.expected.selected_pattern_id) { console.error(`${fixture.id}: selection changed`); errors++; }
  if (!validateDna(result.lesson_dna)) { console.error(`${fixture.id}: DNA schema invalid ${JSON.stringify(validateDna.errors)}`); errors++; }
}
if (errors) process.exitCode = 1; else console.log(`Pedagogy selection valid: ${fixtures.length} fixtures.`);
