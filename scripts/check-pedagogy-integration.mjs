#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  checkGeneratedFiles,
  generateWaterPilotArtifacts,
  WATER_PILOT_PACK,
} from './lib/pedagogy-generation-integration.mjs';

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
    const taskIds = new Set();
    for (const task of row.taskBindings) {
      if (taskIds.has(task.task_id)) {
        errors.push(`${lesson.lesson_id}: duplicate generated task ${task.task_id}`);
      }
      taskIds.add(task.task_id);
      if (task.lesson_id !== lesson.lesson_id) {
        errors.push(`${lesson.lesson_id}: generated task has wrong lesson identity`);
      }
      if (!row.lessonDna.phases.some((phase) => (
        phase.phase_id === task.phase_id
        && phase.target.target_id === task.target_id
      ))) {
        errors.push(`${lesson.lesson_id}: generated task ${task.task_id} is not bound to DNA`);
      }
      if (task.answer_access_policy !== 'after_first_attempt') {
        errors.push(`${lesson.lesson_id}: generated task ${task.task_id} exposes its key early`);
      }
      for (const artifactPath of [
        task.student_artifact_path,
        task.answer_key_artifact_path,
      ]) {
        if (!generated.materialsIndex.materials.some(
          (entry) => entry.material.artifact_path === artifactPath,
        )) {
          errors.push(`${lesson.lesson_id}: generated task has unregistered ${artifactPath}`);
        }
      }
    }
    if (taskIds.size !== row.lessonDna.phases.length) {
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
    const rendered = generated.files.get(
      lesson.pedagogical_integration.generated_artifacts.homeschool_rendered_path,
    );
    for (const term of forbiddenStudentTerms) {
      if (rendered.toLowerCase().includes(term)) {
        errors.push(`${lesson.lesson_id}: child-facing homeschool file exposes ${term}`);
      }
    }
  }
  const practical = generated.rows.get('grade-5-water-03-melting-condensation');
  if (!practical.lessonDna.phases.some((phase) => (
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
