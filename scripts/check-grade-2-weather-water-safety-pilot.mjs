#!/usr/bin/env node

import {
  formatGrade2WeatherWaterSafetyDiagnostic,
  loadGrade2WeatherWaterSafetyPilot,
  validateGrade2WeatherWaterSafetyPilot,
} from './lib/grade-2-weather-water-safety-pilot.mjs';

try {
  const repository = await loadGrade2WeatherWaterSafetyPilot();
  const result = await validateGrade2WeatherWaterSafetyPilot(repository);
  for (const entry of result.diagnostics) {
    console.error(formatGrade2WeatherWaterSafetyDiagnostic(entry));
  }
  if (result.summary.errors > 0) {
    console.error(`Grade 2 weather/water pilot check failed: ${result.summary.errors} error(s).`);
    process.exitCode = 1;
  } else {
    console.log(
      `Grade 2 weather/water pilot check passed: ${result.summary.authoredLessons} authored lessons, `
      + `${result.summary.plannedLessons} planned lessons, ${result.summary.packMaterials} indexed materials, `
      + `${result.summary.approvedTasks} approved task integrations.`,
    );
  }
} catch (error) {
  console.error(`Grade 2 weather/water pilot check failed: ${error.message}`);
  process.exitCode = 1;
}
