import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import YAML from 'yaml';

const demandRank = { none: 0, very_low: 1, low: 2, medium: 3, high: 4, very_high: 5, unknown: 6 };

export async function loadSelectionSchemas() {
  const [request, dna] = await Promise.all([
    fs.readFile('knowledge/pedagogy/schemas/pedagogical-selection-request.schema.json', 'utf8'),
    fs.readFile('knowledge/pedagogy/schemas/lesson-dna.schema.json', 'utf8'),
  ]);
  return { request: JSON.parse(request), dna: JSON.parse(dna) };
}

export async function loadPedagogyCatalogs() {
  const [activitiesText, patternsText] = await Promise.all([
    fs.readFile('knowledge/pedagogy/activities/activity-catalog.yaml', 'utf8'),
    fs.readFile('knowledge/pedagogy/patterns/classroom-patterns.yaml', 'utf8'),
  ]);
  return { activities: YAML.parse(activitiesText).activities, patterns: YAML.parse(patternsText).patterns };
}

export function createAjv() { return new Ajv2020({ allErrors: true, strict: true }); }

export async function validateSelectionRequest(request) {
  const schemas = await loadSelectionSchemas();
  const ajv = createAjv();
  const validate = ajv.compile(schemas.request);
  const diagnostics = [];
  if (!validate(request)) for (const error of validate.errors ?? []) diagnostics.push(`${error.instancePath || '/'} ${error.message}`);
  diagnostics.push(...semanticDiagnostics(request));
  diagnostics.sort((a, b) => Buffer.from(a).compare(Buffer.from(b)));
  return { valid: diagnostics.length === 0, diagnostics };
}

export function semanticDiagnostics(request) {
  const diagnostics = [];
  const support = request?.language_profile?.estonian_support;
  if (!support) return diagnostics;
  if (support.enabled === false) {
    if (support.learner_level !== 'not_applicable') diagnostics.push('estonian_support is disabled but learner_level is not not_applicable');
    if ((support.allowed_roles ?? []).length > 0) diagnostics.push('estonian_support is disabled but allowed_roles is not empty');
    if (support.sentence_frames_required === true) diagnostics.push('estonian_support is disabled but sentence_frames_required is true');
    if (support.word_bank_required === true) diagnostics.push('estonian_support is disabled but word_bank_required is true');
    if (support.assessment_requested === true) diagnostics.push('estonian_support is disabled but assessment_requested is true');
  }
  if (support.enabled === true) {
    if (support.learner_level !== 'A1-A2') diagnostics.push('estonian_support is enabled but learner_level is not A1-A2');
    if (support.language !== 'et') diagnostics.push('estonian_support is enabled but language is not et');
    if (support.subject_explanation_language !== 'ru') diagnostics.push('estonian_support is enabled but grade-5 science subject explanation language is not ru');
  }
  return diagnostics.sort((a, b) => Buffer.from(a).compare(Buffer.from(b)));
}

function supported(pattern, request) {
  const c = request.learner_context;
  return pattern.delivery_modes.includes(c.delivery_mode) && (pattern.subjects.includes(c.subject) || pattern.subjects.includes('cross_curricular')) && pattern.suitable_grades.min <= c.grade && pattern.suitable_grades.max >= c.grade;
}

function activityAllowed(activity, request) {
  const c = request.learner_context;
  const operational = activity;
  if (!(activity.subjects.includes(c.subject) || activity.subjects.includes('cross_curricular'))) return false;
  if (activity.suitable_grades.min > c.grade || activity.suitable_grades.max < c.grade) return false;
  if (!activity.delivery_constraints.delivery_modes.includes(c.delivery_mode)) return false;
  if (c.group_size < activity.delivery_constraints.group_size.min) return false;
  const demand = operational.learner_demands.productive_language;
  if (demandRank[demand] > demandRank[request.language_profile.maximum_total_productive_language_demand]) return false;
  const support = request.language_profile.estonian_support;
  if (support.enabled && ['not_recommended', 'unknown'].includes(operational.learner_demands.estonian_a1_a2_compatibility)) return false;
  return true;
}

function scoreActivity(activity, request) {
  const components = [];
  const add = (id, value) => components.push({ id, value });
  add('base_fit', 1);
  const support = request.language_profile.estonian_support;
  if (support.enabled) {
    const compatibility = activity.learner_demands.estonian_a1_a2_compatibility;
    if (compatibility === 'directly_supported') add('a1_a2_fit', 2);
    if (compatibility === 'supported_with_scaffold') add('a1_a2_fit', 1);
    if (compatibility === 'limited') add('limited_a1_a2', -2);
  }
  return { total: components.reduce((sum, c) => sum + c.value, 0), components };
}

export async function selectPedagogy(request, catalogs = null) {
  const validation = await validateSelectionRequest(request);
  if (!validation.valid) return { ok: false, diagnostics: validation.diagnostics };
  const repo = catalogs ?? await loadPedagogyCatalogs();
  const pattern = repo.patterns.filter((candidate) => supported(candidate, request)).find((candidate) => candidate.pattern_id === 'concept-introduction-classroom') ?? repo.patterns.find((candidate) => supported(candidate, request));
  const phases = [];
  const scores = [];
  for (const component of pattern.recommended_components) {
    const candidates = component.activity_options.map((id) => repo.activities.find((a) => a.activity_id === id)).filter(Boolean).filter((a) => activityAllowed(a, request));
    candidates.sort((a, b) => {
      const sa = scoreActivity(a, request).total; const sb = scoreActivity(b, request).total;
      return sb - sa || Buffer.from(a.activity_id).compare(Buffer.from(b.activity_id));
    });
    const selected = candidates[0];
    if (selected) { phases.push({ phase: component.phase, activity: selected }); scores.push({ phase: component.phase, activity_id: selected.activity_id, ...scoreActivity(selected, request) }); }
  }
  const lessonDna = buildLessonDna(request, pattern, phases);
  return { ok: true, selected_pattern_id: pattern.pattern_id, scores, lesson_dna: lessonDna, digest: digest({ selected_pattern_id: pattern.pattern_id, scores, lesson_dna: lessonDna }) };
}

export function buildLessonDna(request, pattern, phaseActivities) {
  const support = request.language_profile.estonian_support;
  const enabled = support.enabled;
  const estonianAssessmentEnabled = enabled && support.assessment_requested;
  const roles = enabled ? [...support.allowed_roles].sort() : [];
  const scaffolds = [];
  if (enabled && support.sentence_frames_required) scaffolds.push({ scaffold_id: 'estonian-sentence-frames', language: 'et', type: 'sentence_frame' });
  if (enabled && support.word_bank_required) scaffolds.push({ scaffold_id: 'estonian-word-bank', language: 'et', type: 'word_bank' });
  const phases = phaseActivities.map(({ phase, activity }) => ({ phase_id: phase, activity_id: activity.activity_id, language_role: { primary_language: request.language_profile.primary_instruction_language, estonian_roles: roles } }));
  const target_phase_ids = estonianAssessmentEnabled ? phases.filter((p) => p.language_role.estonian_roles.includes('short_oral_response') || p.language_role.estonian_roles.includes('short_written_response')).map((p) => p.phase_id) : [];
  return { schema_version: '1.0', request_id: request.id ?? 'ad-hoc', selected_pattern_id: pattern.pattern_id, phases, context: { language_policy: request.language_profile, known_limits: enabled ? ['per_language_productive_demand_not_modelled'] : [] }, scaffolds, assessment: { estonian_language_assessment: { enabled: estonianAssessmentEnabled, target_phase_ids } } };
}

export function digest(value) { return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }
function stable(value) { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((k) => [k, stable(value[k])])); return value; }
