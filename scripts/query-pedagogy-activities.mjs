#!/usr/bin/env node

import {
  createPedagogySchemaValidators,
  loadPedagogyKnowledge,
  validatePedagogyKnowledge,
} from './lib/pedagogy-knowledge.mjs';
import { filterPedagogyActivities } from './lib/pedagogy-query.mjs';

function addValue(target, name, value) {
  if (!target[name]) target[name] = [];
  target[name].push(value);
}

function parseArguments(argv) {
  const filters = {};
  let debug = false;
  let fixtureId = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === '--debug') debug = true;
    else if (argument === '--offline') filters.offline = true;
    else if (argument === '--no-printer') filters.no_printer = true;
    else if (argument === '--adult-safety-supervision') filters.adult_safety_supervision_required = true;
    else if (argument === '--grade') {
      filters.grade = Number(value);
      index += 1;
    } else if (argument === '--subject') {
      filters.subject = value;
      index += 1;
    } else if (argument === '--lesson-phase') {
      filters.lesson_phase = value;
      index += 1;
    } else if (argument === '--delivery-mode') {
      filters.delivery_mode = value;
      index += 1;
    } else if (argument === '--group-size') {
      filters.group_size = Number(value);
      index += 1;
    }
    else if (argument === '--group-size-min') {
      filters.group_size_range ??= {};
      filters.group_size_range.min = Number(value);
      index += 1;
    } else if (argument === '--group-size-max') {
      filters.group_size_range ??= {};
      filters.group_size_range.max = Number(value);
      index += 1;
    }
    else if (argument === '--group-format') {
      addValue(filters, 'group_formats_any', value);
      index += 1;
    } else if (argument === '--capability') {
      addValue(filters, 'required_capabilities_all', value);
      index += 1;
    } else if (argument === '--any-capability') {
      addValue(filters, 'required_capabilities_any', value);
      index += 1;
    } else if (argument === '--minimum-capability-level') {
      filters.minimum_capability_level = value;
      index += 1;
    } else if (argument === '--max-parent-effort') {
      filters.max_parent_effort = value;
      index += 1;
    } else if (argument === '--max-teacher-preparation') {
      filters.max_teacher_preparation = value;
      index += 1;
    } else if (argument === '--max-productive-language') {
      filters.max_productive_language = value;
      index += 1;
    } else if (argument === '--estonian-a1-a2') {
      addValue(filters, 'estonian_a1_a2_compatibility', value);
      index += 1;
    } else if (argument === '--max-duration') {
      filters.max_duration_minutes = Number(value);
      index += 1;
    } else if (argument === '--source-access') {
      filters.source_access_during_first_attempt = value;
      index += 1;
    } else if (argument === '--fixture') {
      fixtureId = value;
      index += 1;
    }
    else throw new Error(`unknown or incomplete argument ${argument}`);
  }
  return { filters, debug, fixtureId };
}

try {
  const repository = await loadPedagogyKnowledge();
  const validation = validatePedagogyKnowledge(repository);
  if (!validation.valid) {
    throw new Error(`pedagogical knowledge is invalid (${validation.errors.length} errors)`);
  }
  const parsed = parseArguments(process.argv.slice(2));
  let filters = parsed.filters;
  if (parsed.fixtureId) {
    const fixture = repository.queries.data.fixtures
      .find((candidate) => candidate.query_id === parsed.fixtureId);
    if (!fixture) throw new Error(`unknown query fixture ${parsed.fixtureId}`);
    filters = fixture.filters;
  } else {
    const validators = createPedagogySchemaValidators(repository.schemas);
    const probe = {
      schema_version: '1.0',
      artifact_type: 'pedagogical_query_fixtures',
      taxonomy_version: repository.taxonomy.data.taxonomy_version,
      selection_mode: 'deterministic_filtering_without_ranking',
      fixtures: [{
        query_id: 'cli-query',
        description_ru: 'Проверка параметров командной строки.',
        filters,
        expected_include_ids: [repository.activities.data.activities[0].activity_id],
        expected_exclude_ids: [repository.activities.data.activities[1].activity_id],
        ordering: 'activity_id_bytewise',
      }],
    };
    if (!validators.query(probe)) {
      throw new Error(`invalid query filters: ${validators.query.errors.map((item) => item.message).join('; ')}`);
    }
    if (
      filters.group_size_range
      && filters.group_size_range.min > filters.group_size_range.max
    ) {
      throw new Error('invalid query filters: group-size minimum must not exceed maximum');
    }
    const capabilityIds = new Set(
      repository.taxonomy.data.capabilities.map((item) => item.capability_id),
    );
    for (const capabilityId of [
      ...(filters.required_capabilities_all ?? []),
      ...(filters.required_capabilities_any ?? []),
    ]) {
      if (!capabilityIds.has(capabilityId)) {
        throw new Error(`invalid query filters: unknown capability ${capabilityId}`);
      }
    }
  }
  const output = filterPedagogyActivities(
    repository.activities.data.activities,
    filters,
    { debug: parsed.debug },
  );
  console.log(`${JSON.stringify({ filters, ...output }, null, 2)}\n`);
} catch (error) {
  console.error(`Pedagogical activity query failed: ${error.message}`);
  process.exitCode = 1;
}
