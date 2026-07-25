#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  checkGeneratedFiles,
  generateWaterPilotArtifacts,
  WATER_PILOT_PACK,
} from './lib/pedagogy-generation-integration.mjs';
import { sha256PedagogyValue, stablePedagogyJson } from './lib/pedagogy-selection.mjs';

const forbiddenStudentTerms = [
  'taxonomy',
  'selection score',
  'teacher override',
  'weighted ranking',
];

async function validateIntegration() {
  const generated = await generateWaterPilotArtifacts();
  const errors = [];
  const warnings = [];
  const materialIds = new Set(
    generated.materialsIndex.materials.map((entry) => entry.material.material_id),
  );
  const route = {
    source_id: 'grade-5-science',
    md_path: 'project-files/outputs/opiq_5klass_loodusopetus.md',
    source_archive:
      'project-files/inputs/final-zips/opiq_opiq_loodusopetus_5_klassile_2024_opiq_v2.zip',
    qa_path: 'project-files/outputs/opiq_5klass_loodusopetus_qa.json',
  };
  for (const lesson of generated.lessons) {
    if (JSON.stringify(lesson.canonical_route) !== JSON.stringify(route)) {
      errors.push(`${lesson.lesson_id}: canonical route is not the exact grade-5-science route`);
    }
    if (lesson.duration_minutes !== 45) errors.push(`${lesson.lesson_id}: duration is not 45`);
    if (lesson.schema_version !== '1.2') errors.push(`${lesson.lesson_id}: not schema 1.2`);
    for (const source of lesson.evidence_linkage.opiq_records) {
      if (!['ru', 'et'].includes(source.language)) {
        errors.push(`${lesson.lesson_id}: source language ${source.language} is outside ru/et`);
      }
      if (source.programme_type !== 'ordinary') {
        errors.push(`${lesson.lesson_id}: non-ordinary source ${source.record_id}`);
      }
      if (source.canonical_source_id !== 'grade-5-science') {
        errors.push(`${lesson.lesson_id}: wrong source route ${source.record_id}`);
      }
    }
    for (const binding of lesson.pedagogical_integration.phase_bindings) {
      for (const materialId of [
        ...binding.teacher_material_ids,
        ...binding.student_material_ids,
        ...binding.answer_key_material_ids,
      ]) {
        if (!materialIds.has(materialId)) {
          errors.push(`${lesson.lesson_id}: unknown bound material ${materialId}`);
        }
      }
      if (
        ['retrieval', 'correction', 'conclusion', 'evidence-check', 'formative-check']
          .includes(binding.dna_phase_id)
        && binding.answer_key_material_ids.length === 0
      ) {
        errors.push(`${lesson.lesson_id}: ${binding.dna_phase_id} lacks answer-key binding`);
      }
    }
    const row = generated.rows.get(lesson.lesson_id);
    const canonicalDigest = sha256PedagogyValue(row.canonicalLessonDna);
    if (
      stablePedagogyJson(row.canonicalLessonDna)
        !== stablePedagogyJson(row.homeschoolRequest.source.lesson_dna)
      || row.homeschool.decision.source_identity.source_lesson_dna_digest
        !== canonicalDigest
      || row.homeschool.package.source_identity.source_lesson_dna_digest
        !== canonicalDigest
    ) {
      errors.push(`${lesson.lesson_id}: canonical lesson-DNA identity chain differs`);
    }
    if (row.reconciliation.status !== 'reconciled') {
      errors.push(`${lesson.lesson_id}: timing is not reconciled`);
    }
    if (
      row.reconciliation.dna_total_planned_minutes
        + row.reconciliation.non_dna_minutes
      !== lesson.duration_minutes
    ) {
      errors.push(`${lesson.lesson_id}: 45-minute partition is incomplete`);
    }
    for (const stage of row.reconciliation.stage_partitions) {
      if (stage.allocated_minutes !== stage.duration_minutes) {
        errors.push(`${lesson.lesson_id}: stage ${stage.lesson_stage_id} is not exact`);
      }
    }
    if (!row.assessmentIntegration.estonian_language_assessment.enabled) {
      errors.push(`${lesson.lesson_id}: Estonian assessment is disabled`);
    }
    if (!row.homeschool.package.assessment.estonian_language_assessment) {
      errors.push(`${lesson.lesson_id}: homeschool Estonian assessment is disabled`);
    }
    const taskIds = new Set();
    for (const task of row.taskBindings) {
      if (taskIds.has(task.task_id)) {
        errors.push(`${lesson.lesson_id}: duplicate generated task ${task.task_id}`);
      }
      taskIds.add(task.task_id);
      if (task.lesson_id !== lesson.lesson_id) {
        errors.push(`${lesson.lesson_id}: generated task has wrong lesson identity`);
      }
      if (!row.canonicalLessonDna.phases.some((phase) => (
        phase.phase_id === task.phase_id
        && phase.target.target_id === task.target_id
      ))) {
        errors.push(`${lesson.lesson_id}: generated task ${task.task_id} is not bound to DNA`);
      }
      if (
        task.answer_key_artifact_path
        && task.answer_access_policy !== 'after_first_attempt'
      ) {
        errors.push(`${lesson.lesson_id}: generated task ${task.task_id} exposes its key early`);
      }
      if (
        !task.answer_key_artifact_path
        && task.answer_access_policy !== 'not_applicable'
      ) {
        errors.push(`${lesson.lesson_id}: no-key task ${task.task_id} has key access`);
      }
      for (const artifactPath of [
        ...task.student_artifact_paths,
        task.answer_key_artifact_path,
      ].filter(Boolean)) {
        if (!generated.materialsIndex.materials.some(
          (entry) => entry.material.artifact_path === artifactPath,
        )) {
          errors.push(`${lesson.lesson_id}: generated task has unregistered ${artifactPath}`);
        }
      }
      if (!task.student_artifact_paths.some((artifactPath) => (
        generated.files.get(artifactPath)?.includes(task.task_id)
      ))) {
        errors.push(`${lesson.lesson_id}: student regions miss ${task.task_id}`);
      }
    }
    if (taskIds.size !== row.canonicalLessonDna.phases.length) {
      errors.push(`${lesson.lesson_id}: generated tasks do not cover every DNA phase`);
    }
    if (row.homeschool.package.status.teacher_review !== 'pending') {
      errors.push(`${lesson.lesson_id}: homeschool teacher review is not pending`);
    }
    if (row.homeschool.package.status.home_trial !== 'not_started') {
      errors.push(`${lesson.lesson_id}: home trial is not not_started`);
    }
    if (row.homeschool.package.status.homeschool_ready !== false) {
      errors.push(`${lesson.lesson_id}: homeschool_ready is not false`);
    }
    const resolution = row.homeschoolRenderResolution;
    if (![
      resolution.content_refs_resolved,
      resolution.task_refs_resolved,
      resolution.answer_refs_resolved,
      resolution.procedure_refs_resolved,
      resolution.safety_refs_resolved,
      resolution.machine_rendered_equivalent,
      resolution.home_material_validation?.delivery_scope_valid,
      resolution.home_material_validation?.classroom_task_markers_absent,
      resolution.home_material_validation?.classroom_instructions_absent,
      resolution.home_material_validation?.practical_key_leak_absent,
      resolution.home_material_validation?.policy_semantics_valid,
    ].every(Boolean)) {
      errors.push(`${lesson.lesson_id}: homeschool refs are unresolved`);
    }
    const rendered = generated.files.get(
      lesson.pedagogical_integration.generated_artifacts.homeschool_rendered_path,
    );
    for (const term of forbiddenStudentTerms) {
      if (rendered.toLowerCase().includes(term)) {
        errors.push(`${lesson.lesson_id}: child-facing homeschool file exposes ${term}`);
      }
    }
    if (/указанный материал/iu.test(rendered)) {
      errors.push(`${lesson.lesson_id}: child rendering contains an opaque material phrase`);
    }
  }
  const practical = generated.rows.get('grade-5-water-03-melting-condensation');
  if (!practical.canonicalLessonDna.phases.some((phase) => (
    phase.phase_id === 'practical-work'
    && phase.safety.requires_adult_supervision
  ))) {
    errors.push('lesson 3 practical DNA does not require adult supervision');
  }
  if (!practical.homeschool.parentGuidance.safety.teacher_authorization_required) {
    errors.push('lesson 3 homeschool safety lacks teacher authorization');
  }
  if (practical.homeschool.package.context.variant !== 'parent_child') {
    errors.push('lesson 3 does not use parent_child adaptation');
  }
  if (!practical.homePracticalPolicy) {
    errors.push('lesson 3 lacks a machine-readable home practical policy');
  } else {
    if (!practical.homePracticalPolicy.teacher_authorization_required) {
      errors.push('lesson 3 policy lacks teacher authorization');
    }
    if (!practical.homePracticalPolicy.adult_supervision_required) {
      errors.push('lesson 3 policy lacks adult supervision');
    }
    if (
      JSON.stringify(practical.homeschool.package.safety.controls_ru)
      !== JSON.stringify(practical.homePracticalPolicy.safety_controls_ru)
    ) {
      errors.push('lesson 3 package safety differs from policy');
    }
  }
  const practicalStep = practical.homeschoolRenderResolution.steps
    .find((step) => step.phase_id === 'practical-work');
  const safetyStep = practical.homeschoolRenderResolution.steps
    .find((step) => step.phase_id === 'safety-orientation');
  const practicalTask = practicalStep?.resolved_tasks[0];
  const safetyTask = safetyStep?.resolved_tasks[0];
  if (
    !practicalTask
    || practicalTask.evaluation_mode !== 'teacher_observation'
    || practicalTask.answer_access_policy !== 'not_applicable'
    || practicalTask.answer_key_artifact_path !== null
    || practicalStep.resolved_materials.some(
      (material) => [
        'melting-condensation-table',
        'practical-safety-card',
      ].includes(material.material_id),
    )
  ) {
    errors.push('lesson 3 home practical task leaks classroom evaluation or materials');
  }
  if (
    !safetyTask
    || safetyTask.task_id
      !== 'grade-5-water-03-melting-condensation/safety-orientation-task--home-safety-orientation'
    || safetyTask.answer_access_policy !== 'not_applicable'
    || safetyTask.answer_key_artifact_path !== null
    || safetyStep.resolved_materials.length !== 1
    || safetyStep.resolved_materials[0].material_id !== 'lesson-03-home-safety-card'
  ) {
    errors.push('lesson 3 home safety orientation leaks its classroom task contract');
  }
  const classroomPractical = practical.taskBindings.find(
    (task) => task.phase_id === 'practical-work',
  );
  if (
    !classroomPractical?.student_materials.some(
      (material) => material.material_id === 'practical-safety-card',
    )
    || classroomPractical.student_materials.some(
      (material) => material.material_id === 'lesson-03-home-safety-card',
    )
  ) {
    errors.push('lesson 3 classroom practical lost its classroom-only safety material');
  }
  const dirs = new Set(generated.materialsIndex.reviewable_content.directory_paths);
  for (const required of [
    `${WATER_PILOT_PACK}/pedagogy`,
    `${WATER_PILOT_PACK}/homeschool`,
  ]) {
    if (!dirs.has(required)) errors.push(`reviewable content misses ${required}`);
  }
  const staleFiles = await checkGeneratedFiles(generated);
  errors.push(...staleFiles.map((row) => `generated file ${row}`));
  const thematicStatus = generated.thematic.pedagogical_integration.status;
  if (thematicStatus.teacher_review !== 'pending') errors.push('unit review is not pending');
  if (thematicStatus.classroom_trial !== 'not_tested') errors.push('unit trial is not not_tested');
  if (thematicStatus.classroom_ready || thematicStatus.homeschool_ready) {
    errors.push('unit is falsely marked ready');
  }
  const links = generated.thematic.pedagogical_integration.delayed_retrieval_links;
  const positions = new Map(generated.lessons.map((lesson) => [
    lesson.lesson_id,
    lesson.position_in_unit,
  ]));
  for (const link of links) {
    if (link.target_lesson_id !== 'next_unit'
      && positions.get(link.target_lesson_id) <= positions.get(link.source_lesson_id)) {
      errors.push(`delayed retrieval is not forward: ${link.source_lesson_id}`);
    }
  }
  warnings.push('teacher_review_pending');
  warnings.push('classroom_trial_not_tested');
  warnings.push('homeschool_trial_not_started');
  return { generated, errors: errors.sort(), warnings: warnings.sort() };
}

try {
  const result = await validateIntegration();
  for (const warning of result.warnings) console.warn(`[WARNING] ${warning}`);
  if (result.errors.length) {
    for (const error of result.errors) console.error(`[ERROR] ${error}`);
    process.exit(1);
  }
  const machineArtifacts = [...result.generated.files.keys()]
    .filter((file) => file.endsWith('.yaml')).length;
  console.log(
    `Pedagogy integration valid: ${result.generated.lessons.length} lessons, `
    + `${machineArtifacts} generated YAML artifacts, ${result.generated.files.size} `
    + `checked rendered/generated files; ${result.warnings.length} readiness warning(s).`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
