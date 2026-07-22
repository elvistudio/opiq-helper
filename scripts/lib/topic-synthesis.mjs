import { makeDiagnostic } from './curriculum-maps.mjs';

function addDuplicateDiagnostics(diagnostics, values, { file, field, label }) {
  const seen = new Set();
  for (const value of values.filter((entry) => entry !== undefined && entry !== null)) {
    if (seen.has(value)) diagnostics.push(makeDiagnostic('error', file, field, `duplicate ${label}: ${value}`));
    seen.add(value);
  }
}

function transformationMatches(contribution, predicate) {
  return (contribution.transformations ?? []).some((transformation) => predicate(transformation, contribution));
}

function mainRussianContribution(contribution, synthesis) {
  return transformationMatches(contribution, (transformation) => (
    transformation.output_layer === 'main_explanation'
    && transformation.output_language === synthesis.output_language
  ));
}

function expectedOpiqSourceType(programmeType) {
  if (programmeType === 'ordinary') return 'ordinary_textbook';
  if (programmeType === 'simplified_curriculum') return 'simplified_curriculum';
  if (programmeType === 'supplementary') return 'supplementary';
  if (programmeType === 'teacher_support') return 'teacher_support';
  return null;
}

export function validateExternalSourceRegistry(diagnostics, artifact) {
  const registry = artifact?.data;
  if (!registry) return new Map();
  addDuplicateDiagnostics(diagnostics, (registry.sources ?? []).map((source) => source.source_id), {
    file: artifact.file,
    field: '/sources',
    label: 'external source ID',
  });
  addDuplicateDiagnostics(diagnostics, (registry.sources ?? []).map((source) => source.url), {
    file: artifact.file,
    field: '/sources',
    label: 'external source URL',
  });
  const byId = new Map();
  for (const [index, source] of (registry.sources ?? []).entries()) {
    byId.set(source.source_id, source);
    if (source.provenance?.source_type !== source.source_category) {
      diagnostics.push(makeDiagnostic(
        'error',
        artifact.file,
        `/sources/${index}/provenance/source_type`,
        `expected ${source.source_category}`,
      ));
    }
    const verified = new Date(`${source.verified_on}T00:00:00Z`);
    if (Number.isNaN(verified.valueOf()) || verified.toISOString().slice(0, 10) !== source.verified_on) {
      diagnostics.push(makeDiagnostic('error', artifact.file, `/sources/${index}/verified_on`, 'verification date is not a valid calendar date'));
    }
  }
  return byId;
}

export function validateCourseTopicSyntheses({
  diagnostics,
  courseArtifact,
  selectedById,
  externalRegistryArtifact,
  externalSourcesById,
}) {
  const course = courseArtifact.data;
  const file = courseArtifact.file;
  const registryRef = course.external_source_registry_ref;
  if (!externalRegistryArtifact) {
    diagnostics.push(makeDiagnostic('error', file, '/external_source_registry_ref', `unknown external source registry ${registryRef?.artifact_id ?? '<missing>'}`));
  } else {
    if (registryRef?.artifact_id !== externalRegistryArtifact.data.registry_id) {
      diagnostics.push(makeDiagnostic('error', file, '/external_source_registry_ref/artifact_id', `expected ${externalRegistryArtifact.data.registry_id}`));
    }
    if (registryRef?.path !== externalRegistryArtifact.file) {
      diagnostics.push(makeDiagnostic('error', file, '/external_source_registry_ref/path', `expected ${externalRegistryArtifact.file}`));
    }
  }

  const selectedOpiqIds = new Set(selectedById.keys());
  for (const [unitIndex, unit] of (course.ordered_units ?? []).entries()) {
    const field = `/ordered_units/${unitIndex}/topic_synthesis`;
    const synthesis = unit.topic_synthesis;
    if (!synthesis) continue;
    if (synthesis.output_language !== course.instruction_language) {
      diagnostics.push(makeDiagnostic('error', file, `${field}/output_language`, `must match course instruction language ${course.instruction_language}`));
    }
    addDuplicateDiagnostics(diagnostics, (synthesis.source_contributions ?? []).map((entry) => entry.contribution_id), {
      file,
      field: `${field}/source_contributions`,
      label: 'source contribution ID',
    });
    addDuplicateDiagnostics(
      diagnostics,
      (synthesis.source_contributions ?? []).map((entry) => `${entry.source_kind}|${entry.source_id}`),
      { file, field: `${field}/source_contributions`, label: 'source contribution' },
    );

    const contributionByOpiqId = new Map();
    const externalContributions = [];
    const authorContributions = [];
    for (const [contributionIndex, contribution] of (synthesis.source_contributions ?? []).entries()) {
      const contributionField = `${field}/source_contributions/${contributionIndex}`;
      addDuplicateDiagnostics(
        diagnostics,
        (contribution.transformations ?? []).map((entry) => `${entry.transformation}|${entry.output_language}|${entry.output_layer}`),
        { file, field: `${contributionField}/transformations`, label: 'transformation target' },
      );
      for (const [transformationIndex, transformation] of (contribution.transformations ?? []).entries()) {
        const transformationField = `${contributionField}/transformations/${transformationIndex}`;
        if (transformation.output_layer === 'main_explanation' && transformation.output_language !== synthesis.output_language) {
          diagnostics.push(makeDiagnostic('error', file, `${transformationField}/output_language`, `main explanation must use synthesis output language ${synthesis.output_language}`));
        }
        if (transformation.instructional_roles?.includes('core_explanation_ru')
          && (transformation.output_language !== 'ru' || transformation.output_layer !== 'main_explanation')) {
          diagnostics.push(makeDiagnostic('error', file, `${transformationField}/instructional_roles`, 'core_explanation_ru describes a Russian main-explanation contribution'));
        }
        if (['translation', 'pedagogical_adaptation'].includes(transformation.transformation)
          && contribution.source_language === transformation.output_language) {
          diagnostics.push(makeDiagnostic('error', file, transformationField, `${transformation.transformation} requires different source and output languages`));
        }
      }

      if (contribution.source_kind === 'opiq_record') {
        if (contribution.authoring) diagnostics.push(makeDiagnostic('error', file, `${contributionField}/authoring`, 'only author-created contributions may declare authoring justification'));
        const selected = selectedById.get(contribution.source_id);
        if (!selectedOpiqIds.has(contribution.source_id) && externalSourcesById.has(contribution.source_id)) {
          diagnostics.push(makeDiagnostic('error', file, `${contributionField}/source_kind`, `external source ${contribution.source_id} cannot be represented as an Opiq record`));
        } else if (!selected || selected.unitId !== unit.unit_id) {
          diagnostics.push(makeDiagnostic('error', file, `${contributionField}/source_id`, `unknown selected Opiq record ${contribution.source_id} for unit ${unit.unit_id}`));
        } else {
          contributionByOpiqId.set(contribution.source_id, contribution);
          if (contribution.source_language !== selected.record.language) {
            diagnostics.push(makeDiagnostic('error', file, `${contributionField}/source_language`, `expected ${selected.record.language}`));
          }
          if (contribution.provenance?.source_family !== 'opiq') {
            diagnostics.push(makeDiagnostic('error', file, `${contributionField}/provenance/source_family`, 'Opiq record requires source_family opiq'));
          }
          const expectedType = expectedOpiqSourceType(selected.record.programme_type);
          if (expectedType && contribution.provenance?.source_type !== expectedType) {
            diagnostics.push(makeDiagnostic('error', file, `${contributionField}/provenance/source_type`, `expected ${expectedType}`));
          }
          for (const transformation of contribution.transformations ?? []) {
            for (const role of transformation.instructional_roles ?? []) {
              if (!selected.record.instructional_roles?.includes(role)) {
                diagnostics.push(makeDiagnostic('error', file, `${contributionField}/transformations`, `${contribution.source_id} does not declare selected instructional role ${role}`));
              }
            }
          }
        }
      } else if (contribution.source_kind === 'external_source') {
        if (contribution.authoring) diagnostics.push(makeDiagnostic('error', file, `${contributionField}/authoring`, 'only author-created contributions may declare authoring justification'));
        externalContributions.push(contribution);
        if (selectedOpiqIds.has(contribution.source_id)) {
          diagnostics.push(makeDiagnostic('error', file, `${contributionField}/source_kind`, `Opiq record ${contribution.source_id} cannot be represented as external`));
        }
        const source = externalSourcesById.get(contribution.source_id);
        if (!source) {
          diagnostics.push(makeDiagnostic('error', file, `${contributionField}/source_id`, `external source ${contribution.source_id} is absent from the registry`));
        } else {
          if (contribution.source_language !== source.source_language) diagnostics.push(makeDiagnostic('error', file, `${contributionField}/source_language`, `expected ${source.source_language}`));
          if (contribution.provenance?.source_family !== 'external') diagnostics.push(makeDiagnostic('error', file, `${contributionField}/provenance/source_family`, 'external source requires source_family external'));
          if (contribution.provenance?.source_type !== source.source_category) diagnostics.push(makeDiagnostic('error', file, `${contributionField}/provenance/source_type`, `expected ${source.source_category}`));
          if (!(source.related_topic_or_unit_ids ?? []).some((id) => id === unit.unit_id || unit.topic_inventory_refs?.includes(id))) {
            diagnostics.push(makeDiagnostic('error', file, `${contributionField}/source_id`, `external source ${contribution.source_id} is not registered for ${unit.unit_id}`));
          }
        }
      } else if (contribution.source_kind === 'author_created') {
        authorContributions.push(contribution);
        if (contribution.provenance?.source_family !== 'author_created') diagnostics.push(makeDiagnostic('error', file, `${contributionField}/provenance/source_family`, 'author-created source requires source_family author_created'));
        if (!contribution.authoring) diagnostics.push(makeDiagnostic('error', file, `${contributionField}/authoring`, 'author-created explanation requires an explicit reason and uncovered concept or instructional need'));
        else if ((contribution.authoring.uncovered_concepts ?? []).length === 0 && !contribution.authoring.instructional_need) {
          diagnostics.push(makeDiagnostic('error', file, `${contributionField}/authoring`, 'author-created explanation requires uncovered concepts or an instructional need'));
        }
      }
    }

    for (const recordId of unit.selected_source_record_ids ?? []) {
      if (!contributionByOpiqId.has(recordId)) diagnostics.push(makeDiagnostic('error', file, `${field}/source_contributions`, `selected source ${recordId} has no declared transformation contribution`));
    }
    const strategies = new Set(synthesis.strategies ?? []);
    const opiqContributions = [...contributionByOpiqId.values()];
    const directRussian = opiqContributions.some((contribution) => contribution.source_language === 'ru'
      && transformationMatches(contribution, (transformation) => transformation.transformation === 'direct'
        && transformation.output_language === 'ru' && transformation.output_layer === 'main_explanation'));
    const translatedEstonian = opiqContributions.some((contribution) => contribution.source_language === 'et'
      && transformationMatches(contribution, (transformation) => transformation.transformation === 'translation'
        && transformation.output_language === 'ru' && transformation.output_layer === 'main_explanation'));
    const adaptedEstonian = opiqContributions.some((contribution) => contribution.source_language === 'et'
      && transformationMatches(contribution, (transformation) => transformation.transformation === 'pedagogical_adaptation'
        && transformation.output_language === 'ru' && transformation.output_layer === 'main_explanation'));
    const synthesisContributors = new Set(opiqContributions
      .filter((contribution) => mainRussianContribution(contribution, synthesis))
      .map((contribution) => contribution.source_id));
    const externalSupplement = externalContributions.some((contribution) => transformationMatches(
      contribution,
      (transformation) => transformation.transformation === 'supplement',
    ));
    const authorExplanation = authorContributions.some((contribution) => transformationMatches(
      contribution,
      (transformation) => transformation.transformation === 'original'
        && transformation.output_layer === 'main_explanation'
        && transformation.output_language === synthesis.output_language,
    ));
    const hasSynthesisInput = opiqContributions.some((contribution) => transformationMatches(
      contribution,
      (transformation) => transformation.transformation === 'synthesis_input'
        && transformation.output_layer === 'main_explanation',
    ));

    const requirements = [
      ['direct_opiq_ru', directRussian, 'requires a selected Russian Opiq record contributing directly to the Russian explanation'],
      ['translated_from_opiq_et', translatedEstonian, 'requires a selected Estonian Opiq record translated into Russian'],
      ['adapted_from_opiq_et', adaptedEstonian, 'requires a selected Estonian Opiq record pedagogically adapted into Russian'],
      ['synthesized_from_multiple_opiq_sources', synthesisContributors.size >= 2, 'requires at least two distinct Opiq contributors to the main explanation'],
      ['supplemented_by_external_source', externalSupplement, 'requires a verified external-source registry contribution'],
      ['author_created_explanation', authorExplanation, 'requires an explicit author-created main-explanation contribution'],
    ];
    for (const [strategy, satisfied, reason] of requirements) {
      if (strategies.has(strategy) && !satisfied) diagnostics.push(makeDiagnostic('error', file, `${field}/strategies`, `${strategy} ${reason}`));
    }
    if (directRussian && !strategies.has('direct_opiq_ru')) diagnostics.push(makeDiagnostic('error', file, `${field}/strategies`, 'direct Russian Opiq contribution must declare direct_opiq_ru'));
    if (translatedEstonian && !strategies.has('translated_from_opiq_et')) diagnostics.push(makeDiagnostic('error', file, `${field}/strategies`, 'translated Estonian contribution must declare translated_from_opiq_et'));
    if (adaptedEstonian && !strategies.has('adapted_from_opiq_et')) diagnostics.push(makeDiagnostic('error', file, `${field}/strategies`, 'adapted Estonian contribution must declare adapted_from_opiq_et'));
    if (externalSupplement && !strategies.has('supplemented_by_external_source')) diagnostics.push(makeDiagnostic('error', file, `${field}/strategies`, 'external supplement must declare supplemented_by_external_source'));
    if (externalContributions.length > 0 && !strategies.has('supplemented_by_external_source')) diagnostics.push(makeDiagnostic('error', file, `${field}/strategies`, 'external contribution must declare supplemented_by_external_source'));
    if (authorExplanation && !strategies.has('author_created_explanation')) diagnostics.push(makeDiagnostic('error', file, `${field}/strategies`, 'author-created explanation must declare author_created_explanation'));
    if (hasSynthesisInput && !strategies.has('synthesized_from_multiple_opiq_sources')) diagnostics.push(makeDiagnostic('error', file, `${field}/strategies`, 'synthesis_input contribution must declare synthesized_from_multiple_opiq_sources'));
    if (unit.mandatory_status === 'curated_core' && !(synthesis.source_contributions ?? []).some((contribution) => mainRussianContribution(contribution, synthesis))) {
      diagnostics.push(makeDiagnostic('error', file, `${field}/source_contributions`, 'mandatory topic requires a Russian-output main-explanation contribution'));
    }
    if (synthesis.readiness === 'ready') {
      if (synthesis.review_required && synthesis.review_status !== 'approved') diagnostics.push(makeDiagnostic('error', file, `${field}/readiness`, 'ready synthesis cannot have mandatory review pending'));
      if ((synthesis.missing_concepts ?? []).length > 0) diagnostics.push(makeDiagnostic('error', file, `${field}/missing_concepts`, 'ready synthesis cannot retain missing concepts'));
      if (unit.implementation_status !== 'validated_production_unit') diagnostics.push(makeDiagnostic('error', file, `${field}/readiness`, 'ready synthesis requires validated_production_unit implementation status'));
    }
    if (synthesis.readiness === 'needs_review' && !synthesis.review_required) {
      diagnostics.push(makeDiagnostic('error', file, `${field}/readiness`, 'needs_review synthesis requires review_required true'));
    }
    if (synthesis.review_required !== (unit.teacher_review_status !== 'not_required')) {
      diagnostics.push(makeDiagnostic('error', file, `${field}/review_required`, 'must agree with the annual unit teacher-review status'));
    }
    if (synthesis.review_required && synthesis.review_status !== unit.teacher_review_status) {
      diagnostics.push(makeDiagnostic('error', file, `${field}/review_status`, `expected ${unit.teacher_review_status}`));
    }
    if (synthesis.readiness === 'planned') {
      diagnostics.push(makeDiagnostic('warning', file, field, `topic synthesis ${unit.unit_id} is planned but has not yet been authored`));
    }
  }
}
