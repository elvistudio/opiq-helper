import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  collectTeacherPackReviewableScope,
  computeContentFingerprintFromEntries,
  computeTeacherPackContentFingerprint,
} from './lib/teacher-pack-fingerprints.mjs';
import { loadTeacherPackRepository } from './lib/teacher-packs.mjs';

const temporaryRoots = [];

async function write(root, repositoryPath, content) {
  const absolute = path.join(root, ...repositoryPath.split('/'));
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, content);
}

function material(materialId, artifactPath, {
  answerKeyPath,
  audience = 'teacher',
  materialType = 'teacher_guide',
  required = true,
} = {}) {
  return {
    lesson_ids: [],
    required_for_pack: required,
    material: {
      material_id: materialId,
      material_type: materialType,
      artifact_path: artifactPath,
      audience,
      ...(answerKeyPath ? { answer_key_path: answerKeyPath } : {}),
    },
  };
}

async function createFixture() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opiq-fingerprint-'));
  temporaryRoots.push(rootDir);
  const files = {
    lesson: 'lesson-plans/test/lesson-01.yaml',
    thematic: 'lesson-plans/test/thematic-plan.yaml',
    index: 'teacher-packs/test/materials-index.yaml',
    overview: 'teacher-packs/test/README.md',
    teacherGuide: 'teacher-packs/test/teacher-guide.md',
    preparation: 'teacher-packs/test/preparation-checklist.md',
    rubric: 'teacher-packs/test/assessment-rubric.md',
    homeschool: 'teacher-packs/test/homeschool-guide.md',
    lessonGuide: 'teacher-packs/test/lessons/lesson-01.md',
    worksheet: 'teacher-packs/test/student/worksheet.md',
    answerKey: 'teacher-packs/test/answers/answer-key.md',
    parent: 'teacher-packs/test/parent/safety-card.md',
  };
  for (const [name, repositoryPath] of Object.entries(files)) await write(rootDir, repositoryPath, `${name}\n`);
  const indexArtifact = {
    file: files.index,
    data: {
      pack_id: 'test-pack',
      unit_ref: 'test-unit',
      pack_path: 'teacher-packs/test',
      lesson_ids: ['test-lesson'],
      reviewable_content: {
        specification_version: '1.0',
        explicit_paths: [files.lesson, files.thematic],
        directory_paths: [
          'teacher-packs/test/lessons',
          'teacher-packs/test/student',
          'teacher-packs/test/answers',
          'teacher-packs/test/parent',
        ],
        derived_material_paths: true,
      },
      pedagogical_review: { review_record_path: null, status: 'pending' },
      classroom_trial: { trial_record_paths: [], status: 'not_tested' },
      materials: [
        material('overview', files.overview, { audience: 'shared', materialType: 'pack_overview' }),
        material('teacher-guide', files.teacherGuide),
        material('preparation', files.preparation, { materialType: 'checklist' }),
        material('rubric', files.rubric, { materialType: 'rubric' }),
        material('homeschool', files.homeschool, { audience: 'parent', materialType: 'homeschool_guide' }),
        material('lesson-guide', files.lessonGuide, { materialType: 'lesson_guide' }),
        material('worksheet', files.worksheet, {
          answerKeyPath: files.answerKey,
          audience: 'student',
          materialType: 'worksheet',
        }),
        material('answer-key', files.answerKey, { materialType: 'answer_key' }),
        material('parent-card', files.parent, { audience: 'parent', materialType: 'parent_guide' }),
      ],
    },
  };
  return {
    rootDir,
    files,
    indexArtifact,
    thematicArtifact: { file: files.thematic, data: { unit_id: 'test-unit' } },
    lessonArtifacts: [{ file: files.lesson, data: { lesson_id: 'test-lesson' } }],
  };
}

async function fingerprint(fixture) {
  return computeTeacherPackContentFingerprint(fixture);
}

async function scope(fixture) {
  return collectTeacherPackReviewableScope(fixture);
}

async function expectRejects(fixture, pattern) {
  await assert.rejects(() => fingerprint(fixture), pattern);
}

after(async () => {
  await Promise.all(temporaryRoots.map((root) => fs.rm(root, { recursive: true, force: true })));
});

test('production water-use-cycle pack has a deterministic complete reviewable fingerprint', async () => {
  const repository = await loadTeacherPackRepository();
  const indexArtifact = repository.indexes.find((entry) => entry.data.pack_id === 'grade-5-science-water-use-cycle-teacher-pack');
  assert.ok(indexArtifact, 'missing water-use-cycle materials index');
  const thematicArtifact = repository.plans.artifacts.find((entry) => entry.data.artifact_type === 'bilingual_thematic_plan'
    && entry.data.unit_id === indexArtifact.data.unit_ref);
  const lessonIdSet = new Set(indexArtifact.data.lesson_ids);
  const lessonArtifacts = repository.plans.artifacts.filter((entry) => entry.data.artifact_type === 'bilingual_lesson'
    && lessonIdSet.has(entry.data.lesson_id));
  const input = { rootDir: repository.rootDir, indexArtifact, thematicArtifact, lessonArtifacts };
  const first = await computeTeacherPackContentFingerprint(input);
  const second = await computeTeacherPackContentFingerprint(input);
  assert.equal(first.value, second.value);
  assert.equal(first.file_count, 44);
  assert.equal(first.files.filter((file) => file.endsWith('.yaml')).length, 7);
  assert.ok(first.files.includes('teacher-packs/grade-5-science/water-use-cycle/student/lesson-04-safety-card.md'));
  assert.ok(first.files.includes('teacher-packs/grade-5-science/water-use-cycle/answers/lesson-06-answer-key.md'));
});

test('01 identical file sets always produce the same fingerprint', async () => {
  const fixture = await createFixture();
  assert.deepEqual(await fingerprint(fixture), await fingerprint(fixture));
});

test('02 traversal order does not change framed fingerprint', () => {
  const first = computeContentFingerprintFromEntries([{ path: 'b.md', bytes: 'b' }, { path: 'a.md', bytes: 'a' }]);
  const second = computeContentFingerprintFromEntries([{ path: 'a.md', bytes: 'a' }, { path: 'b.md', bytes: 'b' }]);
  assert.equal(first.value, second.value);
});

test('03 repeated repository runs are deterministic', async () => {
  const fixture = await createFixture();
  const values = await Promise.all([fingerprint(fixture), fingerprint(fixture), fingerprint(fixture)]);
  assert.equal(new Set(values.map((entry) => entry.value)).size, 1);
});

test('04 scope paths are repository-relative POSIX paths', async () => {
  const result = await fingerprint(await createFixture());
  assert.ok(result.files.every((file) => !path.isAbsolute(file) && !file.includes('\\')));
});

test('05 unrelated Git metadata changes do not change fingerprint', async () => {
  const fixture = await createFixture();
  const before = await fingerprint(fixture);
  await write(fixture.rootDir, '.git/refs/heads/main', 'first\n');
  await write(fixture.rootDir, '.git/refs/heads/main', 'second\n');
  assert.equal((await fingerprint(fixture)).value, before.value);
});

test('06 provenance commit values are outside fingerprint input', async () => {
  const fixture = await createFixture();
  const current = await fingerprint(fixture);
  const first = { commit_sha: 'a'.repeat(40), content_fingerprint: current };
  const second = { commit_sha: 'b'.repeat(40), content_fingerprint: current };
  assert.equal(first.content_fingerprint.value, second.content_fingerprint.value);
});

for (const [number, title, key] of [
  ['07', 'teacher guide', 'teacherGuide'],
  ['08', 'lesson YAML', 'lesson'],
  ['09', 'thematic plan', 'thematic'],
  ['10', 'worksheet', 'worksheet'],
  ['11', 'answer key', 'answerKey'],
  ['12', 'assessment rubric', 'rubric'],
  ['13', 'homeschool guide', 'homeschool'],
  ['14', 'parent material', 'parent'],
]) {
  test(`${number} changing ${title} changes fingerprint`, async () => {
    const fixture = await createFixture();
    const before = await fingerprint(fixture);
    await write(fixture.rootDir, fixture.files[key], `${title} changed\n`);
    assert.notEqual((await fingerprint(fixture)).value, before.value);
  });
}

test('15 adding a required material changes fingerprint', async () => {
  const fixture = await createFixture();
  const before = await fingerprint(fixture);
  const added = 'teacher-packs/test/new-required.md';
  await write(fixture.rootDir, added, 'new required material\n');
  fixture.indexArtifact.data.materials.push(material('new-required', added));
  assert.notEqual((await fingerprint(fixture)).value, before.value);
});

test('16 removing a directory-discovered file changes fingerprint', async () => {
  const fixture = await createFixture();
  const optional = 'teacher-packs/test/student/optional.md';
  await write(fixture.rootDir, optional, 'optional\n');
  const before = await fingerprint(fixture);
  await fs.unlink(path.join(fixture.rootDir, ...optional.split('/')));
  assert.notEqual((await fingerprint(fixture)).value, before.value);
});

test('17 renaming a directory-discovered file changes fingerprint', async () => {
  const fixture = await createFixture();
  const oldPath = 'teacher-packs/test/student/old-name.md';
  const newPath = 'teacher-packs/test/student/new-name.md';
  await write(fixture.rootDir, oldPath, 'same bytes\n');
  const before = await fingerprint(fixture);
  await fs.rename(path.join(fixture.rootDir, ...oldPath.split('/')), path.join(fixture.rootDir, ...newPath.split('/')));
  assert.notEqual((await fingerprint(fixture)).value, before.value);
});

test('18 whitespace-only content change changes fingerprint', async () => {
  const fixture = await createFixture();
  const before = await fingerprint(fixture);
  await write(fixture.rootDir, fixture.files.teacherGuide, 'teacherGuide  \n');
  assert.notEqual((await fingerprint(fixture)).value, before.value);
});

test('19 LF to CRLF change changes fingerprint', async () => {
  const fixture = await createFixture();
  await write(fixture.rootDir, fixture.files.teacherGuide, 'line one\nline two\n');
  const before = await fingerprint(fixture);
  await write(fixture.rootDir, fixture.files.teacherGuide, 'line one\r\nline two\r\n');
  assert.notEqual((await fingerprint(fixture)).value, before.value);
});

for (const [number, title, repositoryPath] of [
  ['20', 'teacher-review record modification', 'pedagogical-reviews/test/review.yaml'],
  ['21', 'classroom-trial record modification', 'pedagogical-reviews/test/trial.yaml'],
]) {
  test(`${number} ${title} does not change fingerprint`, async () => {
    const fixture = await createFixture();
    await write(fixture.rootDir, repositoryPath, 'first\n');
    const before = await fingerprint(fixture);
    await write(fixture.rootDir, repositoryPath, 'second\n');
    assert.equal((await fingerprint(fixture)).value, before.value);
  });
}

for (const [number, title, repositoryPath] of [
  ['22', 'adding review record', 'pedagogical-reviews/test/new-review.yaml'],
  ['23', 'adding trial record', 'pedagogical-reviews/test/new-trial.yaml'],
  ['25', 'changing GitHub issue form', '.github/ISSUE_TEMPLATE/review.yml'],
  ['26', 'changing validator script', 'scripts/check-review.mjs'],
]) {
  test(`${number} ${title} does not change fingerprint`, async () => {
    const fixture = await createFixture();
    const before = await fingerprint(fixture);
    await write(fixture.rootDir, repositoryPath, 'unrelated evidence infrastructure\n');
    assert.equal((await fingerprint(fixture)).value, before.value);
  });
}

test('24 changing evidence links in materials-index does not change fingerprint', async () => {
  const fixture = await createFixture();
  const before = await fingerprint(fixture);
  fixture.indexArtifact.data.pedagogical_review.review_record_path = 'pedagogical-reviews/test/review.yaml';
  fixture.indexArtifact.data.classroom_trial.trial_record_paths = ['pedagogical-reviews/test/trial.yaml'];
  await write(fixture.rootDir, fixture.files.index, 'evidence links changed\n');
  assert.equal((await fingerprint(fixture)).value, before.value);
});

test('27 missing required material path is rejected', async () => {
  const fixture = await createFixture();
  await fs.unlink(path.join(fixture.rootDir, ...fixture.files.teacherGuide.split('/')));
  await expectRejects(fixture, /derived material path does not exist/iu);
});

test('28 missing answer key is rejected', async () => {
  const fixture = await createFixture();
  await fs.unlink(path.join(fixture.rootDir, ...fixture.files.answerKey.split('/')));
  await expectRejects(fixture, /derived material path does not exist/iu);
});

test('29 missing linked lesson YAML is rejected', async () => {
  const fixture = await createFixture();
  await fs.unlink(path.join(fixture.rootDir, ...fixture.files.lesson.split('/')));
  await expectRejects(fixture, /explicit reviewable path does not exist/iu);
});

test('30 missing linked thematic plan is rejected', async () => {
  const fixture = await createFixture();
  await fs.unlink(path.join(fixture.rootDir, ...fixture.files.thematic.split('/')));
  await expectRejects(fixture, /explicit reviewable path does not exist/iu);
});

test('31 absolute reviewable path is rejected', async () => {
  const fixture = await createFixture();
  fixture.indexArtifact.data.reviewable_content.explicit_paths.push('/tmp/lesson.yaml');
  await expectRejects(fixture, /repository-relative path/iu);
});

test('32 path traversal is rejected', async () => {
  const fixture = await createFixture();
  fixture.indexArtifact.data.reviewable_content.explicit_paths.push('../lesson.yaml');
  await expectRejects(fixture, /repository-relative path/iu);
});

test('33 backslash path is rejected', async () => {
  const fixture = await createFixture();
  fixture.indexArtifact.data.reviewable_content.explicit_paths.push('lesson-plans\\test\\lesson-01.yaml');
  await expectRejects(fixture, /repository-relative path/iu);
});

test('34 symlink in reviewable directory is rejected', async () => {
  const fixture = await createFixture();
  const link = path.join(fixture.rootDir, 'teacher-packs/test/student/link.md');
  await fs.symlink('worksheet.md', link);
  await expectRejects(fixture, /forbidden symlink/iu);
});

test('35 duplicate manual path is rejected', async () => {
  const fixture = await createFixture();
  fixture.indexArtifact.data.reviewable_content.explicit_paths.push(fixture.files.lesson);
  await expectRejects(fixture, /duplicate explicit reviewable path/iu);
});

test('36 evidence record cannot enter reviewable scope', async () => {
  const fixture = await createFixture();
  const evidence = 'pedagogical-reviews/test/review.yaml';
  await write(fixture.rootDir, evidence, 'review\n');
  fixture.indexArtifact.data.reviewable_content.explicit_paths.push(evidence);
  await expectRejects(fixture, /must not include evidence files/iu);
});

test('37 materials-index cannot enter reviewable scope', async () => {
  const fixture = await createFixture();
  fixture.indexArtifact.data.reviewable_content.explicit_paths.push(fixture.files.index);
  await expectRejects(fixture, /must not include materials-index/iu);
});

test('38 manual exclusion mechanism is rejected', async () => {
  const fixture = await createFixture();
  fixture.indexArtifact.data.reviewable_content.excluded_paths = [fixture.files.teacherGuide];
  await expectRejects(fixture, /manual exclusions are forbidden/iu);
});

test('39 new required_for_pack material enters scope automatically', async () => {
  const fixture = await createFixture();
  const added = 'teacher-packs/test/new-required.md';
  await write(fixture.rootDir, added, 'new\n');
  fixture.indexArtifact.data.materials.push(material('new-required', added));
  assert.ok((await scope(fixture)).paths.includes(added));
});

test('40 every artifact_path and answer_key_path is in fingerprint scope', async () => {
  const fixture = await createFixture();
  const paths = new Set((await scope(fixture)).paths);
  for (const entry of fixture.indexArtifact.data.materials) {
    assert.ok(paths.has(entry.material.artifact_path), entry.material.artifact_path);
    if (entry.material.answer_key_path) assert.ok(paths.has(entry.material.answer_key_path), entry.material.answer_key_path);
  }
});
