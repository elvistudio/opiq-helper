import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildLessonOriginalityReviewArtifacts,
  LESSON_ORIGINALITY_REVIEW_ROOT,
} from './lib/lesson-originality-review-bundles.mjs';

const rootDir = process.cwd();
const writeMode = process.argv.includes('--write');
const checkMode = process.argv.includes('--check');

if (writeMode && checkMode) {
  console.error('Choose either --write or --check, not both.');
  process.exit(1);
}

const artifacts = await buildLessonOriginalityReviewArtifacts(rootDir);

if (writeMode) {
  await fs.mkdir(path.join(rootDir, LESSON_ORIGINALITY_REVIEW_ROOT), { recursive: true });
  for (const [repositoryPath, content] of artifacts.files) {
    const absolute = path.join(rootDir, repositoryPath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content, 'utf8');
  }
}

if (checkMode) {
  const stale = [];
  for (const [repositoryPath, expected] of artifacts.files) {
    const absolute = path.join(rootDir, repositoryPath);
    let actual;
    try {
      actual = await fs.readFile(absolute, 'utf8');
    } catch {
      stale.push(`${repositoryPath} (missing)`);
      continue;
    }
    if (actual !== expected) stale.push(repositoryPath);
  }
  if (stale.length > 0) {
    console.error('Lesson originality review artifacts are not byte-current:');
    for (const repositoryPath of stale) console.error(`- ${repositoryPath}`);
    process.exit(1);
  }
}

console.log(`lesson originality review bundles: ${artifacts.built.length}`);
for (const { bundle } of artifacts.built) {
  console.log(`${bundle.lesson_id}: ${bundle.content_fingerprint.value} files=${bundle.content_fingerprint.file_count} approval_eligible=${bundle.approval_eligible}`);
}
console.log(`review completion: ${artifacts.index.review_completion_status}; approved=${artifacts.index.approved_count}; pending=${artifacts.index.pending_count}`);
