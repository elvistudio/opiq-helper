import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import {
  loadLessonPlanRepository,
  validateLessonPlanRepository,
} from './lib/lesson-plans.mjs';

let baseline;

before(async () => {
  baseline = await loadLessonPlanRepository();
});

function cloneRepository() {
  return structuredClone(baseline);
}

function artifacts(repository, type) {
  return repository.artifacts.filter((artifact) => artifact.data.artifact_type === type);
}

function lesson(repository, position = 1) {
  const found = artifacts(repository, 'bilingual_lesson')
    .find((artifact) => artifact.data.position_in_unit === position);
  assert.ok(found, `missing lesson ${position}`);
  return found.data;
}

function thematic(repository) {
  const found = artifacts(repository, 'bilingual_thematic_plan')[0];
  assert.ok(found, 'missing thematic plan');
  return found.data;
}

function annual(repository) {
  const found = artifacts(repository, 'annual_course_plan')[0];
  assert.ok(found, 'missing annual course');
  return found.data;
}

function profiles(repository) {
  const found = artifacts(repository, 'learner_language_profiles')[0];
  assert.ok(found, 'missing language profiles');
  return found.data;
}

function validation(repository) {
  return validateLessonPlanRepository(repository);
}

function errors(repository) {
  return validation(repository).diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
}

function warnings(repository) {
  return validation(repository).diagnostics.filter((diagnostic) => diagnostic.severity === 'warning');
}

function diagnosticText(diagnostics) {
  return diagnostics.map((diagnostic) => `${diagnostic.file} ${diagnostic.field} ${diagnostic.reason}`).join('\n');
}

function assertFailsWith(repository, pattern) {
  const found = errors(repository);
  assert.ok(found.length > 0, 'expected validation to fail');
  assert.match(diagnosticText(found), pattern);
}

function assertWarnsWithoutErrors(repository, pattern) {
  const foundErrors = errors(repository);
  assert.deepEqual(foundErrors, [], diagnosticText(foundErrors));
  const foundWarnings = warnings(repository);
  assert.ok(foundWarnings.length > 0, 'expected validation warning');
  assert.match(diagnosticText(foundWarnings), pattern);
}

test('valid complete golden lesson and production repository pass with documented recycling warnings', () => {
  const result = validation(cloneRepository());
  const foundErrors = result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  const foundWarnings = result.diagnostics.filter((diagnostic) => diagnostic.severity === 'warning');
  assert.deepEqual(foundErrors, [], diagnosticText(foundErrors));
  assert.equal(foundWarnings.length, 5, diagnosticText(foundWarnings));
  for (const term of ['lahus', 'termomeeter', 'jäätumine', 'aurustumine', 'olekumuutus']) {
    assert.match(diagnosticText(foundWarnings), new RegExp(`term ${term} .* not recycled in a later lesson`, 'u'));
  }
  assert.equal(result.summary.lessons, 4);
  assert.equal(result.summary.pageReferences, 19);
  assert.equal(result.summary.warnings, 5);
});

test('valid four-lesson thematic plan links order, count, duration, and glossary', () => {
  const repository = cloneRepository();
  const unit = thematic(repository);
  assert.equal(unit.lesson_count, 4);
  assert.equal(unit.expected_total_duration_minutes, 180);
  assert.equal(unit.cumulative_glossary.length, 14);
  assert.deepEqual(errors(repository), []);
});

test('valid annual excerpt is explicitly incomplete and links the water unit', () => {
  const repository = cloneRepository();
  const course = annual(repository);
  assert.equal(course.completeness.declared_complete, false);
  assert.equal(course.completeness.scope, 'small_annual_course_excerpt');
  assert.equal(course.ordered_units.filter((unit) => unit.thematic_plan_ref).length, 1);
  assert.deepEqual(errors(repository), []);
});

test('multiple ordinary Opiq books support one thematic plan', () => {
  const repository = cloneRepository();
  const bookIds = new Set(thematic(repository).selected_opiq_sources.map((record) => record.book_id));
  assert.ok(bookIds.size >= 3);
  assert.deepEqual(errors(repository), []);
});

test('content and language assessment are separate in every lesson', () => {
  const repository = cloneRepository();
  for (const artifact of artifacts(repository, 'bilingual_lesson')) {
    assert.ok(artifact.data.assessment.some((criterion) => criterion.affects === 'subject_assessment'));
    assert.ok(artifact.data.assessment.some((criterion) => criterion.affects === 'language_assessment'));
  }
  assert.deepEqual(errors(repository), []);
});

test('new and recycled vocabulary are structurally distinct', () => {
  const repository = cloneRepository();
  for (const artifact of artifacts(repository, 'bilingual_lesson')) {
    const fresh = new Set(artifact.data.language_load.new_terms_et.map((term) => term.term_et));
    const recycled = new Set(artifact.data.language_load.recycled_terms_et.map((term) => term.term_et));
    assert.equal([...fresh].some((term) => recycled.has(term)), false);
  }
  assert.deepEqual(errors(repository), []);
});

test('a cumulative term recycled in a strictly later lesson passes', () => {
  const repository = cloneRepository();
  const entry = thematic(repository).cumulative_glossary.find((item) => item.term_et === 'temperatuur');
  assert.deepEqual(entry.recycled_in_lessons, ['grade-5-water-04-changes-review']);
  assert.ok(lesson(repository, 4).language_load.recycled_terms_et
    .some((item) => item.term_et === 'temperatuur'));
  assert.deepEqual(errors(repository), []);
});

test('same-lesson thematic recycling is rejected', () => {
  const repository = cloneRepository();
  const entry = thematic(repository).cumulative_glossary.find((item) => item.term_et === 'lahus');
  entry.recycled_in_lessons = [entry.introduced_in_lesson];
  assertFailsWith(repository, /term lahus cannot be recycled in its introduction lesson grade-5-water-01-properties/u);
});

test('earlier-lesson thematic recycling is rejected', () => {
  const repository = cloneRepository();
  const entry = thematic(repository).cumulative_glossary.find((item) => item.term_et === 'temperatuur');
  entry.recycled_in_lessons = ['grade-5-water-02-states'];
  assertFailsWith(repository, /recycling lesson grade-5-water-02-states must follow introduction lesson grade-5-water-03-melting-condensation/u);
});

test('an explicit empty thematic recycling list is structurally valid', () => {
  const repository = cloneRepository();
  const entry = thematic(repository).cumulative_glossary.find((item) => item.term_et === 'lahus');
  assert.deepEqual(entry.recycled_in_lessons, []);
  assert.deepEqual(errors(repository), []);
});

test('an explicit empty thematic recycling list produces a pedagogical warning', () => {
  const repository = cloneRepository();
  assertWarnsWithoutErrors(
    repository,
    /term lahus is introduced in lesson 1 but is not recycled in a later lesson of the unit/u,
  );
});

test('claimed thematic recycling must use recycled_terms_et in the later lesson', () => {
  const repository = cloneRepository();
  const entry = thematic(repository).cumulative_glossary.find((item) => item.term_et === 'termomeeter');
  entry.recycled_in_lessons = ['grade-5-water-04-changes-review'];
  assertFailsWith(repository, /recycling lesson grade-5-water-04-changes-review does not list term termomeeter in recycled_terms_et/u);
});

test('a later new_terms_et occurrence does not satisfy thematic recycling', () => {
  const repository = cloneRepository();
  const target = lesson(repository, 4);
  const repeatedTerm = structuredClone(lesson(repository, 3).language_load.new_terms_et
    .find((item) => item.term_et === 'termomeeter'));
  repeatedTerm.first_use_stage = 'add-final-terms-et';
  repeatedTerm.reuse_stage_refs = ['revision-stations', 'separate-unit-assessment'];
  target.language_load.new_terms_et.push(repeatedTerm);
  target.cognitive_load.new_estonian_terms += 1;
  target.stages.find((stage) => stage.stage_id === 'add-final-terms-et')
    .new_language_items.push('termomeeter');
  thematic(repository).vocabulary_by_lesson
    .find((entry) => entry.lesson_id === target.lesson_id)
    .introduced.push('termomeeter');
  thematic(repository).cumulative_glossary
    .find((entry) => entry.term_et === 'termomeeter')
    .recycled_in_lessons = [target.lesson_id];
  const found = errors(repository);
  assert.match(diagnosticText(found), /term termomeeter is introduced by multiple linked lessons/u);
  assert.match(diagnosticText(found), /does not list term termomeeter in recycled_terms_et/u);
});

test('every production lesson has explicit scaffold release', () => {
  const repository = cloneRepository();
  for (const artifact of artifacts(repository, 'bilingual_lesson')) {
    assert.deepEqual(artifact.data.methodology.scaffold_release, {
      introduction: 'full_support',
      guided_practice: 'partial_support',
      final_output: 'short_independent_output',
    });
  }
  assert.deepEqual(errors(repository), []);
});

test('a justified learner-profile override is valid', () => {
  const repository = cloneRepository();
  const profileUse = lesson(repository, 3).learner_language_profile;
  profileUse.uses_default = false;
  profileUse.learner_language_level = 'A2';
  profileUse.overrides = [{
    field: 'learner_language_level',
    value: 'A2',
    reason: 'Teacher observation justifies this explicit learner-specific planning override.',
  }];
  assert.deepEqual(errors(repository), []);
});

test('author-created bridge with explicit provenance is valid', () => {
  const repository = cloneRepository();
  const bridge = lesson(repository, 3).evidence_linkage.author_materials
    .find((material) => material.provenance.category === 'author_created_bridge');
  assert.ok(bridge);
  assert.match(bridge.provenance.source_reference, /lesson 03/u);
  assert.deepEqual(errors(repository), []);
});

test('missing methodology profile fails', () => {
  const repository = cloneRepository();
  delete lesson(repository, 1).methodology;
  assertFailsWith(repository, /methodology/u);
});

test('wrong methodology model fails', () => {
  const repository = cloneRepository();
  lesson(repository, 1).methodology.model = 'estonian_immersion';
  assertFailsWith(repository, /russian_primary_estonian_supported/u);
});

test('missing content objective fails', () => {
  const repository = cloneRepository();
  lesson(repository, 1).objectives.content_objectives = [];
  assertFailsWith(repository, /content_objectives/u);
});

test('missing language objective fails', () => {
  const repository = cloneRepository();
  lesson(repository, 1).objectives.estonian_language_objectives = [];
  assertFailsWith(repository, /estonian_language_objectives/u);
});

test('vague language objective without observable output fails', () => {
  const repository = cloneRepository();
  const objective = lesson(repository, 1).objectives.estonian_language_objectives[0];
  objective.text_ru = 'Улучшить эстонский язык.';
  objective.text_et = 'Parandada eesti keelt.';
  delete objective.observable_output;
  assertFailsWith(repository, /observable_output|vague/u);
});

test('missing full Russian explanation target fails', () => {
  const repository = cloneRepository();
  lesson(repository, 1).language_load.full_expected_answer_ru = '';
  assertFailsWith(repository, /full_expected_answer_ru|full Russian subject answer/u);
});

test('missing Estonian terminology fails', () => {
  const repository = cloneRepository();
  const target = lesson(repository, 1);
  target.language_load.new_terms_et = [];
  target.language_load.recycled_terms_et = [];
  target.cognitive_load.new_estonian_terms = 0;
  assertFailsWith(repository, /requires Estonian subject terminology/u);
});

test('missing Estonian oral output fails', () => {
  const repository = cloneRepository();
  lesson(repository, 1).language_load.short_expected_oral_answer_et = '';
  assertFailsWith(repository, /short_expected_oral_answer_et|short Estonian oral output/u);
});

test('stage missing content purpose fails', () => {
  const repository = cloneRepository();
  delete lesson(repository, 1).stages[0].content_purpose_ru;
  assertFailsWith(repository, /content_purpose_ru/u);
});

test('stage missing language purpose fails', () => {
  const repository = cloneRepository();
  delete lesson(repository, 1).stages[0].language_purpose_et;
  assertFailsWith(repository, /language_purpose_et/u);
});

test('new-language stage without a scaffold fails', () => {
  const repository = cloneRepository();
  const stage = lesson(repository, 3).stages.find((candidate) => candidate.stage_id === 'bridge-process-terms-et');
  stage.scaffold_refs = [];
  assertFailsWith(repository, /introducing new language requires a linked scaffold/u);
});

test('stage-duration mismatch fails', () => {
  const repository = cloneRepository();
  lesson(repository, 1).stages[0].duration_minutes += 2;
  assertFailsWith(repository, /does not reconcile with lesson duration/u);
});

test('unknown lesson reference fails', () => {
  const repository = cloneRepository();
  thematic(repository).recommended_lesson_sequence[0].lesson_id = 'unknown-lesson';
  assertFailsWith(repository, /unknown lesson reference unknown-lesson/u);
});

test('unknown unit reference fails', () => {
  const repository = cloneRepository();
  annual(repository).ordered_units[1].thematic_plan_ref = 'unknown-unit';
  assertFailsWith(repository, /unknown unit reference unknown-unit/u);
});

test('unknown curriculum outcome fails', () => {
  const repository = cloneRepository();
  lesson(repository, 1).evidence_linkage.official_outcome_refs[0] = 'unknown-outcome';
  assertFailsWith(repository, /unknown official outcome unknown-outcome/u);
});

test('Opiq URL outside canonical route fails', () => {
  const repository = cloneRepository();
  lesson(repository, 1).evidence_linkage.opiq_records[0].canonical_url = 'https://www.opiq.ee/kit/999/chapter/1';
  assertFailsWith(repository, /URL must occur exactly once/u);
});

test('wrong Opiq book ID fails', () => {
  const repository = cloneRepository();
  lesson(repository, 1).evidence_linkage.opiq_records[0].book_id = 'unknown-grade-5-book';
  assertFailsWith(repository, /unknown audited book ID/u);
});

test('missing Opiq provenance fails', () => {
  const repository = cloneRepository();
  delete lesson(repository, 1).evidence_linkage.opiq_records[0].provenance;
  assertFailsWith(repository, /missing required field provenance/u);
});

test('missing instructional role fails', () => {
  const repository = cloneRepository();
  lesson(repository, 1).evidence_linkage.opiq_records[0].instructional_roles = [];
  assertFailsWith(repository, /instructional_roles/u);
});

test('silent simplified-curriculum selection fails', () => {
  const repository = cloneRepository();
  const mergedUnit = repository.curriculum.artifacts
    .find((artifact) => artifact.data.artifact_type === 'thematic_unit').data;
  const simplified = structuredClone(mergedUnit.rejected_duplicate_records
    .find((record) => record.programme_type === 'simplified_curriculum'));
  simplified.record_id = 'selected-simplified-fixture';
  lesson(repository, 1).evidence_linkage.opiq_records[0] = simplified;
  assertFailsWith(repository, /cannot silently use simplified or unknown programme material/u);
});

test('oral-answer term never introduced or recycled fails', () => {
  const repository = cloneRepository();
  lesson(repository, 1).language_load.oral_output_terms_et.push('unknown-term');
  assertFailsWith(repository, /oral-output term was not introduced or recycled/u);
});

test('unused glossary term fails', () => {
  const repository = cloneRepository();
  thematic(repository).cumulative_glossary.push({
    term_et: 'kasutamata',
    equivalent_ru: 'неиспользованный',
    introduced_in_lesson: 'grade-5-water-01-properties',
    recycled_in_lessons: [],
  });
  assertFailsWith(repository, /glossary term is not introduced by a linked lesson/u);
});

test('conflated content and language assessment fails', () => {
  const repository = cloneRepository();
  for (const criterion of lesson(repository, 1).assessment) criterion.affects = 'both';
  assertFailsWith(repository, /content and Estonian-language assessment must have separate criteria/u);
});

test('annual excerpt incorrectly marked complete fails', () => {
  const repository = cloneRepository();
  annual(repository).completeness.declared_complete = true;
  assertFailsWith(repository, /incomplete excerpt|declared_complete/u);
});

test('school-stage outcome falsely labelled exact grade 5 fails', () => {
  const repository = cloneRepository();
  annual(repository).official_curriculum_references[0].exact_grade_claimed = true;
  assertFailsWith(repository, /school-stage outcome cannot be represented as exact grade 5/u);
});

test('duplicate artifact IDs fail', () => {
  const repository = cloneRepository();
  annual(repository).course_id = lesson(repository, 1).lesson_id;
  assertFailsWith(repository, /duplicate artifact ID/u);
});

test('excessive new vocabulary emits a configurable warning', () => {
  const repository = cloneRepository();
  profiles(repository).profiles[0].warning_thresholds.max_new_terms_per_lesson = 2;
  assertWarnsWithoutErrors(repository, /new Estonian terms 3 exceed profile threshold 2/u);
});

test('missing vocabulary recycling emits a warning', () => {
  const repository = cloneRepository();
  const target = lesson(repository, 2);
  target.language_load.recycled_terms_et = [];
  target.language_load.model_sentences[0].terms_et = ['tahke', 'vedel', 'gaasiline'];
  target.language_load.oral_output_terms_et = ['tahke', 'vedel', 'gaasiline'];
  const progression = thematic(repository).vocabulary_by_lesson
    .find((entry) => entry.lesson_id === target.lesson_id);
  progression.recycled = [];
  const aine = thematic(repository).cumulative_glossary.find((entry) => entry.term_et === 'aine');
  aine.recycled_in_lessons = [];
  assertWarnsWithoutErrors(repository, /has no recycled Estonian term/u);
});

test('missing scaffold release emits a warning', () => {
  const repository = cloneRepository();
  const target = lesson(repository, 1);
  target.methodology.scaffold_release.guided_practice = 'full_support';
  target.methodology.scaffold_release.final_output = 'full_support';
  const progression = thematic(repository).scaffolding_progression
    .find((entry) => entry.lesson_id === target.lesson_id);
  progression.guided_practice = 'full_support';
  progression.final_output = 'full_support';
  assertWarnsWithoutErrors(repository, /does not reduce scaffold level/u);
});
