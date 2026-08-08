import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import YAML from 'yaml';
import {
  buildLessonOriginalityReviewArtifacts,
  lessonOriginalityBundlePaths,
  LESSON_ORIGINALITY_REVIEW_INDEX_PATH,
  LESSON_ORIGINALITY_REVIEW_SCHEMA_PATH,
  validateLessonOriginalityReviewArtifacts,
} from './lib/lesson-originality-review-bundles.mjs';

const rootDir = process.cwd();
const schema = JSON.parse(await fs.readFile(path.join(rootDir, LESSON_ORIGINALITY_REVIEW_SCHEMA_PATH), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateSchema = ajv.compile(schema);
const errors = [];

for (const repositoryPath of [LESSON_ORIGINALITY_REVIEW_INDEX_PATH, ...lessonOriginalityBundlePaths()]) {
  let data;
  try {
    data = YAML.parse(await fs.readFile(path.join(rootDir, repositoryPath), 'utf8'));
  } catch (error) {
    errors.push(`${repositoryPath}: cannot read/parse: ${error.message}`);
    continue;
  }
  if (!validateSchema(data)) {
    for (const error of validateSchema.errors ?? []) {
      errors.push(`${repositoryPath}${error.instancePath || '/'}: ${error.message}`);
    }
  }
}

for (const diagnostic of await validateLessonOriginalityReviewArtifacts(rootDir)) {
  errors.push(`${diagnostic.code}: ${diagnostic.message}`);
}

const expected = await buildLessonOriginalityReviewArtifacts(rootDir);
for (const [repositoryPath, expectedContent] of expected.files) {
  let actualContent;
  try {
    actualContent = await fs.readFile(path.join(rootDir, repositoryPath), 'utf8');
  } catch {
    errors.push(`artifact_not_committed: ${repositoryPath}`);
    continue;
  }
  if (actualContent !== expectedContent) errors.push(`artifact_stale: ${repositoryPath}`);
}

if (errors.length > 0) {
  console.error(`lesson originality review validation failed with ${errors.length} diagnostic(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`lesson originality review validation passed: ${expected.built.length} pending bundles, ${expected.index.approved_count} approved, ${expected.index.pending_count} pending`);
