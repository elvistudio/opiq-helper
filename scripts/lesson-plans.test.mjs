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

function sourceMatrix(repository) {
  const found = artifacts(repository, 'annual_source_selection_matrix')[0];
  assert.ok(found, 'missing annual source-selection matrix');
  return found.data;
}

function roadmap(repository) {
  const found = artifacts(repository, 'annual_implementation_roadmap')[0];
  assert.ok(found, 'missing annual implementation roadmap');
  return found.data;
}

function annualLanguage(repository) {
  const found = artifacts(repository, 'annual_language_progression')[0];
  assert.ok(found, 'missing annual language progression');
  return found.data;
}

function annualCalendars(repository) {
  const found = artifacts(repository, 'annual_teaching_calendars')[0];
  assert.ok(found, 'missing annual teaching calendars');
  return found.data;
}

function annualUnit(repository, unitId) {
  const found = annual(repository).ordered_units.find((unit) => unit.unit_id === unitId);
  assert.ok(found, `missing annual unit ${unitId}`);
  return found;
}

function sourceUnit(repository, unitId) {
  const found = sourceMatrix(repository).units.find((unit) => unit.unit_id === unitId);
  assert.ok(found, `missing source-matrix unit ${unitId}`);
  return found;
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

test('production repository passes with documented architecture and pedagogical warnings', () => {
  const result = validation(cloneRepository());
  const foundErrors = result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  const foundWarnings = result.diagnostics.filter((diagnostic) => diagnostic.severity === 'warning');
  assert.deepEqual(foundErrors, [], diagnosticText(foundErrors));
  assert.equal(foundWarnings.length, 12, diagnosticText(foundWarnings));
  for (const term of ['lahus', 'termomeeter', 'jäätumine', 'aurustumine', 'olekumuutus']) {
    assert.match(diagnosticText(foundWarnings), new RegExp(`term ${term} .* not recycled in a later lesson`, 'u'));
  }
  assert.equal(result.summary.lessons, 4);
  assert.equal(result.summary.annualCourses, 1);
  assert.equal(result.summary.annualComponents, 4);
  assert.equal(result.summary.annualUnits, 10);
  assert.equal(result.summary.annualSelectedPages, 32);
  assert.equal(result.summary.pageReferences, 51);
  assert.equal(result.summary.warnings, 12);
});

test('valid four-lesson thematic plan links order, count, duration, and glossary', () => {
  const repository = cloneRepository();
  const unit = thematic(repository);
  assert.equal(unit.lesson_count, 4);
  assert.equal(unit.expected_total_duration_minutes, 180);
  assert.equal(unit.cumulative_glossary.length, 14);
  assert.deepEqual(errors(repository), []);
});

test('complete annual architecture remains partially implemented and links the water production unit', () => {
  const repository = cloneRepository();
  const course = annual(repository);
  assert.equal(course.completeness.declared_complete, false);
  assert.equal(course.completeness.scope, 'complete_annual_architecture');
  assert.equal(course.completeness.architecture_complete, true);
  assert.equal(course.completeness.all_thematic_plans_authored, false);
  assert.equal(course.ordered_units.length, 10);
  assert.equal(course.ordered_units.filter((unit) => unit.thematic_plan_ref).length, 1);
  assert.equal(annualUnit(repository, 'grade-5-water-four-lesson-plan').implementation_status, 'validated_production_unit');
  assert.deepEqual(errors(repository), []);
});

test('all annual units map to the ten verified topic groups exactly once', () => {
  const repository = cloneRepository();
  const topicIds = annual(repository).ordered_units.flatMap((unit) => unit.topic_inventory_refs);
  assert.equal(new Set(topicIds).size, 10);
  assert.equal(topicIds.length, 10);
  assert.deepEqual(errors(repository), []);
});

test('multiple audited books contribute distinct annual source roles', () => {
  const repository = cloneRepository();
  const riverSources = sourceUnit(repository, 'grade-5-rivers-lakes').selected_sources;
  const topicInventory = repository.curriculum.artifacts
    .find((artifact) => artifact.data.artifact_type === 'topic_inventory').data;
  const recordsById = new Map(topicInventory.topics.flatMap((topic) => [
    ...topic.selected_records,
    ...topic.alternative_records,
    ...topic.rejected_records,
  ]).map((record) => [record.record_id, record]));
  assert.ok(new Set(riverSources.map((source) => recordsById.get(source.record_id).book_id)).size >= 3);
  assert.ok(riverSources.some((source) => source.instructional_roles.includes('core_explanation_ru')));
  assert.ok(riverSources.some((source) => source.instructional_roles.includes('terminology_et')));
  assert.ok(riverSources.some((source) => source.instructional_roles.includes('data_interpretation')));
  assert.deepEqual(errors(repository), []);
});

test('annual Russian coverage supports both direct pages and explicit author bridges', () => {
  const repository = cloneRepository();
  const coverage = new Map(annualLanguage(repository).russian_explanation_coverage.map((entry) => [entry.unit_id, entry]));
  assert.equal(coverage.get('grade-5-rivers-lakes').status, 'direct_opiq_ru');
  assert.ok(coverage.get('grade-5-rivers-lakes').available_record_ids.length > 0);
  assert.equal(coverage.get('grade-5-landforms-map').status, 'author_bridge_required');
  assert.deepEqual(coverage.get('grade-5-landforms-map').available_record_ids, []);
  assert.deepEqual(errors(repository), []);
});

test('annual cross-unit vocabulary recycling follows later units', () => {
  const repository = cloneRepository();
  const intervals = annualLanguage(repository).planned_vocabulary_recycling_intervals;
  for (const term of ['lahus', 'termomeeter', 'jäätumine', 'aurustumine', 'olekumuutus']) {
    assert.ok(intervals.some((interval) => interval.term_et === term), `missing interval for ${term}`);
  }
  assert.deepEqual(errors(repository), []);
});

test('annual lesson-budget baseline reconciles with explicit reserve', () => {
  const repository = cloneRepository();
  const budget = annual(repository).lesson_budget;
  const baselineScenario = budget.scenarios.find((scenario) => scenario.scenario_id === budget.recommended_baseline_scenario_id);
  assert.equal(budget.unit_estimate_total, 54);
  assert.equal(baselineScenario.available_lessons, 70);
  assert.equal(baselineScenario.reserve_lessons, 8);
  assert.equal(baselineScenario.school_specific_or_lost_lessons, 8);
  assert.equal(baselineScenario.architecture_fits, true);
  assert.deepEqual(errors(repository), []);
});

test('official annual evidence remains school-stage scope rather than exact grade 5', () => {
  const repository = cloneRepository();
  for (const reference of annual(repository).official_curriculum_references) {
    assert.equal(reference.official_scope, 'school_stage_2');
    assert.equal(reference.exact_grade_claimed, false);
  }
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
  assertFailsWith(repository, /unit without a full thematic plan must use null/u);
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

test('annual architecture incorrectly marked fully complete fails', () => {
  const repository = cloneRepository();
  annual(repository).completeness.declared_complete = true;
  assertFailsWith(repository, /complete architecture is not the same|declared_complete|cannot declare fully authored completion/u);
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

test('unknown annual topic ID fails', () => {
  const repository = cloneRepository();
  annualUnit(repository, 'grade-5-landforms-map').topic_inventory_refs = ['unknown-topic'];
  assertFailsWith(repository, /unknown verified topic inventory ID unknown-topic/u);
});

test('unknown annual canonical page fails', () => {
  const repository = cloneRepository();
  sourceUnit(repository, 'grade-5-rivers-lakes').selected_sources[0].canonical_url = 'https://www.opiq.ee/kit/999/chapter/1';
  assertFailsWith(repository, /expected https:\/\/www\.opiq\.ee\/kit\/17\/chapter\/755/u);
});

test('wrong annual canonical route fails', () => {
  const repository = cloneRepository();
  annual(repository).canonical_route.source_id = 'grade-6-science';
  assertFailsWith(repository, /route|topic inventory|annual course/u);
});

test('wrong annual book ID fails', () => {
  const repository = cloneRepository();
  annualUnit(repository, 'grade-5-rivers-lakes').source_book_ids[0] = 'unknown-grade-5-book';
  assertFailsWith(repository, /unknown audited book unknown-grade-5-book/u);
});

test('cover-only book cannot be annual page evidence', () => {
  const repository = cloneRepository();
  annualUnit(repository, 'grade-5-rivers-lakes').source_book_ids[0] = '5k_loodusõpetus_koolibri_rus';
  assertFailsWith(repository, /not eligible ordinary page evidence/u);
});

test('simplified-curriculum book cannot be an ordinary annual default', () => {
  const repository = cloneRepository();
  annualUnit(repository, 'grade-5-rivers-lakes').source_book_ids[0] = '5k_loodusõpetus_harno_est';
  assertFailsWith(repository, /not eligible ordinary page evidence/u);
});

test('duplicate annual unit ID fails', () => {
  const repository = cloneRepository();
  annual(repository).ordered_units[1].unit_id = annual(repository).ordered_units[0].unit_id;
  assertFailsWith(repository, /duplicate annual unit ID/u);
});

test('broken annual order fails', () => {
  const repository = cloneRepository();
  annual(repository).ordered_units[1].order = 8;
  assertFailsWith(repository, /expected order 2/u);
});

test('prerequisite after dependent unit fails', () => {
  const repository = cloneRepository();
  annualUnit(repository, 'grade-5-landforms-map').prerequisite_unit_ids = ['grade-5-rivers-lakes'];
  assertFailsWith(repository, /prerequisite unit grade-5-rivers-lakes must occur earlier/u);
});

test('cross-unit recycling into an earlier unit fails', () => {
  const repository = cloneRepository();
  const interval = annualLanguage(repository).planned_vocabulary_recycling_intervals
    .find((entry) => entry.term_et === 'termomeeter');
  interval.recycled_in_unit = 'grade-5-rivers-lakes';
  interval.interval_units = 1;
  assertFailsWith(repository, /recycling unit must follow introduction/u);
});

test('annual selected source without an instructional role fails', () => {
  const repository = cloneRepository();
  sourceUnit(repository, 'grade-5-rivers-lakes').selected_sources[0].instructional_roles = [];
  assertFailsWith(repository, /instructional_roles/u);
});

test('annual selected source without provenance fails', () => {
  const repository = cloneRepository();
  delete sourceUnit(repository, 'grade-5-rivers-lakes').selected_sources[0].provenance;
  assertFailsWith(repository, /missing required field provenance/u);
});

test('annual best-source decision must match the selected instructional role', () => {
  const repository = cloneRepository();
  sourceUnit(repository, 'grade-5-rivers-lakes').role_matrix.assessment.record_ids = ['rivers-ru-avita'];
  assertFailsWith(repository, /rivers-ru-avita has no instructional role supporting assessment/u);
});

test('mandatory unit without Russian explanation status fails', () => {
  const repository = cloneRepository();
  delete annualUnit(repository, 'grade-5-rivers-lakes').russian_explanation_status;
  assertFailsWith(repository, /missing required field russian_explanation_status/u);
});

test('mandatory unit without Estonian terminology fails', () => {
  const repository = cloneRepository();
  annualLanguage(repository).estonian_language_progression
    .find((entry) => entry.unit_id === 'grade-5-rivers-lakes').new_terms_et = [];
  assertFailsWith(repository, /new_terms_et/u);
});

test('mandatory unit without a short Estonian oral-answer target fails', () => {
  const repository = cloneRepository();
  annualLanguage(repository).estonian_language_progression
    .find((entry) => entry.unit_id === 'grade-5-rivers-lakes').short_oral_answer_target_et = '';
  assertFailsWith(repository, /short_oral_answer_target_et/u);
});

test('annual lesson totals must reconcile', () => {
  const repository = cloneRepository();
  annual(repository).lesson_budget.unit_estimate_total += 1;
  assertFailsWith(repository, /expected 54/u);
});

test('architecture cannot be marked fully authored while thematic plans are missing', () => {
  const repository = cloneRepository();
  const completeness = annual(repository).completeness;
  completeness.scope = 'fully_authored_annual_course';
  completeness.official_curriculum_coverage_complete = true;
  completeness.all_thematic_plans_authored = true;
  completeness.all_lessons_authored = true;
  completeness.implementation_status = 'fully_authored';
  completeness.declared_complete = true;
  completeness.deferred_to_issue = null;
  assertFailsWith(repository, /expected false|cannot declare fully authored completion/u);
});

test('unknown practical-work unit fails', () => {
  const repository = cloneRepository();
  annualCalendars(repository).practical_work_calendar[0].unit_id = 'unknown-unit';
  assertFailsWith(repository, /unknown unit unknown-unit/u);
});

test('unknown assessment unit fails', () => {
  const repository = cloneRepository();
  annualCalendars(repository).subject_assessment_calendar[0].unit_id = 'unknown-unit';
  assertFailsWith(repository, /unknown unit unknown-unit/u);
});

test('rejected duplicate must resolve to a canonical page', () => {
  const repository = cloneRepository();
  sourceUnit(repository, 'grade-5-rivers-lakes').rejected_duplicates[0].canonical_url = 'https://www.opiq.ee/kit/999/chapter/1';
  assertFailsWith(repository, /rejected candidate URL must occur exactly once/u);
});

test('unknown roadmap unit reference fails', () => {
  const repository = cloneRepository();
  roadmap(repository).units[0].dependencies = ['unknown-unit'];
  assertFailsWith(repository, /unknown unit unknown-unit/u);
});

test('unknown annual component reference fails', () => {
  const repository = cloneRepository();
  annual(repository).language_progression_ref.artifact_id = 'unknown-language-progression';
  assertFailsWith(repository, /unknown annual_language_progression unknown-language-progression/u);
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

test('annual unit without direct Russian page evidence emits a warning', () => {
  const repository = cloneRepository();
  assertWarnsWithoutErrors(repository, /unit grade-5-landforms-map has no direct Russian Opiq explanation/u);
});

test('mandatory annual unit without practical work emits a warning', () => {
  const repository = cloneRepository();
  annualCalendars(repository).practical_work_calendar = annualCalendars(repository).practical_work_calendar
    .filter((entry) => entry.unit_id !== 'grade-5-rivers-lakes');
  assertWarnsWithoutErrors(repository, /mandatory unit grade-5-rivers-lakes has no planned practical activity/u);
});

test('important annual term without later-unit recycling emits a warning', () => {
  const repository = cloneRepository();
  annualLanguage(repository).planned_vocabulary_recycling_intervals = annualLanguage(repository).planned_vocabulary_recycling_intervals
    .filter((entry) => entry.term_et !== 'termomeeter');
  assertWarnsWithoutErrors(repository, /important water-unit term termomeeter has no later thematic-unit recycling plan/u);
});

test('recommended annual budget with insufficient reserve emits a warning', () => {
  const repository = cloneRepository();
  const budget = annual(repository).lesson_budget;
  const baselineScenario = budget.scenarios.find((scenario) => scenario.scenario_id === budget.recommended_baseline_scenario_id);
  baselineScenario.reserve_lessons = 6;
  baselineScenario.school_specific_or_lost_lessons = 10;
  assertWarnsWithoutErrors(repository, /recommended baseline reserves less than 10%/u);
});

test('ambiguous official annual coverage emits a warning', () => {
  const repository = cloneRepository();
  const coverage = annual(repository).outcome_coverage[0];
  coverage.coverage_status = 'ambiguous';
  for (const unitId of coverage.unit_ids) {
    annualUnit(repository, unitId).linked_official_outcomes
      .find((entry) => entry.outcome_id === coverage.outcome_id).coverage_status = 'ambiguous';
  }
  assertWarnsWithoutErrors(repository, /official outcome .* remains ambiguous/u);
});

test('pending annual teacher review emits a warning', () => {
  const repository = cloneRepository();
  assertWarnsWithoutErrors(repository, /teacher review review-landforms-russian-bridge is pending/u);
});
