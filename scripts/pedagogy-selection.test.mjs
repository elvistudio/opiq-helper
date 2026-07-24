import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSelectionRequest, selectPedagogy, loadPedagogyCatalogs, digest, loadSelectionSchemas, createAjv } from './lib/pedagogy-selection.mjs';

const baseSupport = { enabled: false, language: 'et', learner_level: 'not_applicable', allowed_roles: [], subject_explanation_language: 'ru', sentence_frames_required: false, word_bank_required: false, assessment_requested: false };
const enabledSupport = { enabled: true, language: 'et', learner_level: 'A1-A2', allowed_roles: ['terminology', 'labels', 'familiar_instruction', 'sentence_frame', 'short_oral_response'], subject_explanation_language: 'ru', sentence_frames_required: true, word_bank_required: true, assessment_requested: true };
const request = (support = baseSupport, demand = 'medium') => ({ schema_version: '1.0', learner_context: { grade: 5, subject: 'science', delivery_mode: 'classroom', group_size: 28, lesson_duration_minutes: 45 }, lesson_context: { purpose: 'concept_introduction' }, language_profile: { primary_instruction_language: 'ru', maximum_total_productive_language_demand: demand, estonian_support: support } });

test('estonian support schema and semantic modes', async () => {
  for (const patch of [ { learner_level: 'A1-A2' }, { allowed_roles: ['short_oral_response'] }, { sentence_frames_required: true }, { word_bank_required: true }, { assessment_requested: true } ]) assert.equal((await validateSelectionRequest(request({ ...baseSupport, ...patch }))).valid, false);
  assert.equal((await validateSelectionRequest(request({ ...enabledSupport, learner_level: 'not_applicable' }))).valid, false);
  assert.equal((await validateSelectionRequest(request(baseSupport))).valid, true);
  assert.equal((await validateSelectionRequest(request(enabledSupport))).valid, true);
});

test('disabled support suppresses A1-A2 scoring and compatibility filtering', async () => {
  const repo = await loadPedagogyCatalogs();
  const disabled = await selectPedagogy(request(baseSupport), repo);
  assert.equal(disabled.ok, true);
  assert.equal(disabled.scores.flatMap((s) => s.components).some((c) => c.id === 'a1_a2_fit'), false);
  assert.equal(disabled.scores.flatMap((s) => s.components).some((c) => c.id === 'limited_a1_a2'), false);
  const mutated = structuredClone(repo);
  for (const activity of mutated.activities) if (activity.learner_demands) activity.learner_demands.estonian_a1_a2_compatibility = activity.learner_demands.estonian_a1_a2_compatibility === 'directly_supported' ? 'not_recommended' : 'directly_supported';
  const disabledMutated = await selectPedagogy(request(baseSupport), mutated);
  assert.equal(disabled.digest, disabledMutated.digest);
  const enabled = await selectPedagogy(request(enabledSupport), repo);
  const enabledMutated = await selectPedagogy(request(enabledSupport), mutated);
  assert.notEqual(enabled.digest, enabledMutated.digest);
  assert.equal((await selectPedagogy(request(baseSupport, 'low'), repo)).ok, true);
});

test('disabled support lesson DNA is Russian-only and deterministic', async () => {
  const result = await selectPedagogy({ id: 'grade5-russian-only-concept-introduction', ...request(baseSupport) });
  assert.equal(result.ok, true);
  assert.equal(result.lesson_dna.context.language_policy.primary_instruction_language, 'ru');
  assert.equal(result.lesson_dna.context.language_policy.estonian_support.learner_level, 'not_applicable');
  assert.equal(result.lesson_dna.assessment.estonian_language_assessment.enabled, false);
  assert.deepEqual(result.lesson_dna.assessment.estonian_language_assessment.target_phase_ids, []);
  assert.deepEqual(result.lesson_dna.scaffolds.filter((s) => s.language === 'et'), []);
  for (const phase of result.lesson_dna.phases) assert.deepEqual(phase.language_role.estonian_roles, []);
  const repeated = await selectPedagogy({ id: 'grade5-russian-only-concept-introduction', ...request({ ...baseSupport, allowed_roles: [] }) });
  assert.equal(result.digest, repeated.digest);
  assert.equal(digest(result.lesson_dna), digest(repeated.lesson_dna));
  const ajv = createAjv();
  const schemas = await loadSelectionSchemas();
  assert.equal(ajv.compile(schemas.dna)(result.lesson_dna), true);
});
