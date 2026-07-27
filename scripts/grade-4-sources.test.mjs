import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test, { before } from 'node:test';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';

import {
  assertCommittedBytes,
  buildGrade4SourceArtifacts,
  buildKitDetailsEvidence,
  evidencePath,
  grade4RoutePolicy,
  multiGradeSupportPolicy,
  validateGrade4Manifest,
} from './lib/grade-4-canonical-sources.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const urlPattern = /^- URL: (https:\/\/www\.opiq\.ee\/kit\/\d+\/chapter\/\d+)$/gmu;
const markdownUrls = (markdown) => [...markdown.matchAll(urlPattern)].map((match) => match[1]);

let artifacts;
let manifest;
let evidenceValidate;
let qaValidate;

before(async () => {
  artifacts = await buildGrade4SourceArtifacts(rootDir);
  manifest = JSON.parse(await readFile(path.join(rootDir, 'source-manifest.json'), 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  evidenceValidate = ajv.compile(JSON.parse(
    await readFile(path.join(rootDir, 'schemas/grade-4-kit-details-evidence.schema.json'), 'utf8'),
  ));
  qaValidate = ajv.compile(JSON.parse(
    await readFile(path.join(rootDir, 'schemas/grade-4-source-qa.schema.json'), 'utf8'),
  ));
});

test('routing policy declares exactly the eleven requested Grade 4 routes', () => {
  assert.deepEqual(grade4RoutePolicy.map((entry) => entry.id), [
    'grade-4-russian',
    'grade-4-russian-reading',
    'grade-4-estonian',
    'grade-4-estonian-second-language',
    'grade-4-english',
    'grade-4-human-studies-and-society',
    'grade-4-human-studies-simplified',
    'grade-4-science',
    'grade-4-mathematics',
    'grade-4-mathematics-simplified',
    'grade-4-music',
  ]);
});

test('route-to-kit ownership matrix is exact', () => {
  assert.deepEqual(Object.fromEntries(grade4RoutePolicy.map((entry) => [
    entry.id,
    entry.included_kit_ids,
  ])), {
    'grade-4-russian': ['243', '295'],
    'grade-4-russian-reading': ['415'],
    'grade-4-estonian': ['71', '154', '533'],
    'grade-4-estonian-second-language': ['150'],
    'grade-4-english': ['332', '451'],
    'grade-4-human-studies-and-society': ['55', '82'],
    'grade-4-human-studies-simplified': ['287'],
    'grade-4-science': ['11', '27', '108', '228', '480', '536'],
    'grade-4-mathematics': ['70', '147', '157', '293', '460', '588'],
    'grade-4-mathematics-simplified': ['282', '304', '318', '328'],
    'grade-4-music': ['174', '206', '552'],
  });
});

test('computed route counts match the declarative expectations', () => {
  assert.deepEqual(
    artifacts.route_artifacts.map(({ model }) => [
      model.definition.id,
      model.canonical_records.length,
    ]),
    grade4RoutePolicy.map((entry) => [entry.id, entry.expected_record_count]),
  );
});

test('canonical union contains 2212 unique instructional URLs', () => {
  assert.equal(artifacts.model.canonical_owners.size, 2212);
  assert.equal(
    artifacts.route_artifacts.reduce((sum, entry) => sum + entry.model.canonical_records.length, 0),
    2212,
  );
});

test('canonical and multi-grade support records reconcile all 2342 instructional rows', () => {
  const supportCounts = Object.fromEntries(multiGradeSupportPolicy.map((support) => {
    const archive = artifacts.model.archives.find((entry) => entry.path === support.source_archive);
    const count = archive.records.filter((record) => (
      record.kit_id === support.kit_id
      && record.classification === 'instructional_chapter_or_page'
    )).length;
    return [support.kit_id, count];
  }));
  assert.deepEqual(supportCounts, { 161: 22, 200: 85, 476: 23 });
  assert.equal(2212 + Object.values(supportCounts).reduce((sum, count) => sum + count, 0), 2342);
  assert.equal(artifacts.model.global_accounting.instructional_chapter_or_page, 2342);
});

test('every Markdown record has one direct Opiq chapter URL', () => {
  for (const artifact of artifacts.route_artifacts) {
    const urls = markdownUrls(artifact.markdown);
    assert.equal(urls.length, artifact.model.canonical_records.length);
    assert.ok(urls.every((url) => /^https:\/\/www\.opiq\.ee\/kit\/\d+\/chapter\/\d+$/u.test(url)));
  }
});

test('no canonical URL occurs twice within a route', () => {
  for (const artifact of artifacts.route_artifacts) {
    const urls = markdownUrls(artifact.markdown);
    assert.equal(new Set(urls).size, urls.length);
  }
});

test('no canonical URL is owned by multiple Grade 4 routes', () => {
  const urls = artifacts.route_artifacts.flatMap((artifact) => markdownUrls(artifact.markdown));
  assert.equal(new Set(urls).size, urls.length);
});

test('Grade 3 and Grade 5 URLs do not enter the Grade 4 route union', async () => {
  const grade4Urls = artifacts.model.canonical_owners;
  for (const source of manifest.sources.filter((entry) => [3, 5].includes(entry.grade))) {
    const markdown = await readFile(path.join(rootDir, source.md_path), 'utf8');
    assert.ok(markdownUrls(markdown).every((url) => !grade4Urls.has(url)), source.id);
  }
});

test('Grade 4 URLs do not overlap any non-Grade-4 manifest owner', async () => {
  const grade4Urls = artifacts.model.canonical_owners;
  for (const source of manifest.sources.filter((entry) => entry.grade !== 4)) {
    const markdown = await readFile(path.join(rootDir, source.md_path), 'utf8');
    assert.ok(markdownUrls(markdown).every((url) => !grade4Urls.has(url)), source.id);
  }
});

test('first-language and second-language Estonian remain disjoint', () => {
  const first = artifacts.route_artifacts.find(({ model }) => model.definition.id === 'grade-4-estonian');
  const second = artifacts.route_artifacts.find(({ model }) => model.definition.id === 'grade-4-estonian-second-language');
  assert.deepEqual(first.model.definition.included_kit_ids, ['71', '154', '533']);
  assert.deepEqual(second.model.definition.included_kit_ids, ['150']);
  const firstUrls = new Set(markdownUrls(first.markdown));
  assert.ok(markdownUrls(second.markdown).every((url) => !firstUrls.has(url)));
});

test('Russian language and Russian reading remain disjoint', () => {
  const language = artifacts.route_artifacts.find(({ model }) => model.definition.id === 'grade-4-russian');
  const reading = artifacts.route_artifacts.find(({ model }) => model.definition.id === 'grade-4-russian-reading');
  assert.deepEqual(language.model.definition.included_kit_ids, ['243', '295']);
  assert.deepEqual(reading.model.definition.included_kit_ids, ['415']);
});

test('mixed human and society is not normalized to subject-pure human studies', () => {
  const mixed = grade4RoutePolicy.find((entry) => entry.id === 'grade-4-human-studies-and-society');
  const simplified = grade4RoutePolicy.find((entry) => entry.id === 'grade-4-human-studies-simplified');
  assert.equal(mixed.subject_code, 'human_studies_and_society');
  assert.equal(mixed.programme_type, 'mixed_subject');
  assert.equal(simplified.subject_code, 'human_studies');
  assert.equal(simplified.programme_type, 'simplified_curriculum');
});

test('simplified curricula cannot become default unknown-programme routes', () => {
  const coreMath = grade4RoutePolicy.find((entry) => entry.id === 'grade-4-mathematics');
  const simplifiedMath = grade4RoutePolicy.find((entry) => entry.id === 'grade-4-mathematics-simplified');
  assert.equal(coreMath.programme_type, 'unknown');
  assert.equal(simplifiedMath.programme_type, 'simplified_curriculum');
  assert.ok(simplifiedMath.included_kit_ids.every((kit) => !coreMath.included_kit_ids.includes(kit)));
});

test('administrative and imprint pages never enter canonical Markdown', () => {
  assert.equal(artifacts.model.global_accounting.administrative_or_imprint, 17);
  for (const artifact of artifacts.route_artifacts) {
    const canonicalUrls = new Set(markdownUrls(artifact.markdown));
    const administrative = artifact.model.source_rows.filter(
      (row) => row.classification === 'administrative_or_imprint',
    );
    assert.ok(administrative.every((row) => !canonicalUrls.has(row.url)));
  }
});

test('Kit Details and duplicate aliases never become instructional records', () => {
  for (const artifact of artifacts.route_artifacts) {
    assert.doesNotMatch(artifact.markdown, /\/Kit\/Details\//u);
    const accounting = artifact.qa.source_accounting;
    assert.equal(
      accounting.accounted_source_records,
      accounting.total_source_records,
    );
  }
});

test('kit 200 retains the existing Grade 2 owner and is absent from Grade 4 Markdown', () => {
  const support = multiGradeSupportPolicy.find((entry) => entry.kit_id === '200');
  assert.equal(support.canonical_owner, 'grade-2-arts-and-crafts');
  assert.equal(support.disposition, 'retain_existing_canonical_owner');
  assert.ok(artifacts.route_artifacts.every(
    ({ markdown }) => !markdown.includes('https://www.opiq.ee/kit/200/'),
  ));
});

test('kits 161 and 476 remain non-exclusive multi-grade support', () => {
  for (const id of ['161', '476']) {
    const support = multiGradeSupportPolicy.find((entry) => entry.kit_id === id);
    assert.equal(support.exclusive_grade_4_owner, false);
    assert.equal(support.disposition, 'catalogue_evidence_only');
    assert.ok(artifacts.route_artifacts.every(
      ({ markdown }) => !markdown.includes(`https://www.opiq.ee/kit/${id}/`),
    ));
  }
});

test('manual evidence has strict URL, date, method, and provenance', () => {
  const evidence = buildKitDetailsEvidence();
  assert.equal(evidenceValidate(evidence), true, JSON.stringify(evidenceValidate.errors));
  assert.ok(evidence.records.every((record) => (
    record.kit_details_url === `https://www.opiq.ee/Kit/Details/${record.kit_id}`
    && record.verified_on === '2026-07-27'
    && record.verification_method === 'manual_kit_details_review'
    && record.evidence_source.project_provenance_url.includes('issuecomment-5093283851')
  )));
});

test('manual evidence rejects missing provenance', () => {
  const evidence = buildKitDetailsEvidence();
  delete evidence.records[0].evidence_source.project_provenance_url;
  assert.equal(evidenceValidate(evidence), false);
});

test('unknown manual metadata remains null or unknown outside kit 476', () => {
  const evidence = buildKitDetailsEvidence();
  for (const record of evidence.records.filter((entry) => entry.kit_id !== '476')) {
    assert.equal(record.subject, null);
    assert.equal(record.language, null);
    assert.equal(record.publisher, null);
    assert.equal(record.curriculum, null);
    assert.equal(record.access_mode, null);
    assert.equal(record.verified_metadata, null);
  }
});

test('kit 476 preserves every supplied verified metadata field', () => {
  const record = buildKitDetailsEvidence().records.find((entry) => entry.kit_id === '476');
  assert.deepEqual(record.grade_scope, [4, 5, 6, 7, 8, 9]);
  assert.equal(record.subject, 'Tehnoloogiaõpetus');
  assert.equal(record.language, 'et');
  assert.equal(record.publisher, 'Merkuur');
  assert.equal(record.curriculum, 'Riiklik õppekava 2011');
  assert.equal(record.access_mode, 'free');
  assert.deepEqual(record.verified_metadata, {
    title: 'Arvjuhitavad seadmed (CNC)',
    chapters: 23,
    total_tasks: 1,
    textbook_tasks: 1,
    task_collection_tasks: 0,
    authors: ['Snapmaker Technology Co., Ltd'],
    task_collection_author: 'Lauri Soosaar',
  });
});

test('every generated QA snapshot is strict-schema-valid', () => {
  for (const artifact of artifacts.route_artifacts) {
    assert.equal(qaValidate(artifact.qa), true, `${artifact.model.definition.id}: ${JSON.stringify(qaValidate.errors)}`);
  }
});

test('QA route counts equal the included instructional kit records', () => {
  for (const artifact of artifacts.route_artifacts) {
    assert.equal(
      artifact.qa.page_records_included,
      artifact.qa.source_accounting.instructional_chapter_or_page,
    );
    assert.equal(
      artifact.qa.url_ownership.canonical_url_count,
      artifact.qa.page_records_included,
    );
  }
});

test('edition distinctions stay visible in QA inventory', () => {
  const science = artifacts.route_artifacts.find(({ model }) => model.definition.id === 'grade-4-science');
  const music = artifacts.route_artifacts.find(({ model }) => model.definition.id === 'grade-4-music');
  assert.deepEqual(science.qa.edition_distinctions.map((entry) => entry.kit_ids), [
    ['11', '480'],
    ['27', '536'],
  ]);
  assert.deepEqual(music.qa.edition_distinctions.map((entry) => entry.kit_ids), [['174', '552']]);
});

test('exporter-generated mathematics subject aliases are normalized declaratively', () => {
  for (const artifact of artifacts.route_artifacts.filter(
    ({ model }) => model.definition.subject_code !== 'mathematics',
  )) {
    assert.ok(artifact.qa.subject_normalization.source_rows_with_exporter_mathematics_alias > 0);
    assert.equal(artifact.qa.subject_normalization.visible_instructional_text_changed, false);
    for (const record of artifact.model.canonical_records) {
      assert.notEqual(record.subject_en.toLowerCase(), 'mathematics');
      assert.notEqual(record.topics_en[0].toLowerCase(), 'mathematics');
    }
  }
});

test('captured task arrays are preserved and missing tasks are not synthesized', () => {
  for (const artifact of artifacts.route_artifacts) {
    const sourceByUrl = new Map(artifact.model.source_rows.map((record) => [record.url, record]));
    for (const record of artifact.model.canonical_records) {
      assert.equal(record.task_examples.length, sourceByUrl.get(record.url).task_examples.length);
    }
    assert.equal(artifact.qa.task_availability.task_bodies_synthesized, false);
  }
});

test('QA reports absent complete page prose instead of inventing it', () => {
  assert.ok(artifacts.route_artifacts.every(({ qa }) => (
    qa.page_prose_availability.complete_page_prose_captured === false
    && qa.page_prose_availability.records_with_complete_page_prose === 0
  )));
});

test('manifest resolves all routes and preserves partial coverage gaps', () => {
  assert.equal(validateGrade4Manifest(manifest), true);
  const coverage = manifest.missing_coverage.find((entry) => entry.grade === 4);
  assert.equal(coverage.coverage_status, 'partial_subject_bounded');
  assert.ok(coverage.unverified_or_absent_catalogue_areas.length > 0);
});

test('manifest validation rejects blanket-complete Grade 4 coverage', () => {
  const invalid = structuredClone(manifest);
  invalid.missing_coverage.find((entry) => entry.grade === 4).coverage_status = 'complete';
  assert.throws(() => validateGrade4Manifest(invalid), /coverage gap/u);
});

test('source generation is byte-identical across two builds', async () => {
  const repeated = await buildGrade4SourceArtifacts(rootDir);
  assert.deepEqual([...repeated.files], [...artifacts.files]);
});

test('stale generated bytes fail the check helper', () => {
  assert.throws(
    () => assertCommittedBytes('expected\n', 'stale\n', 'fixture.md'),
    /stale/u,
  );
});

test('historical intake artifacts retain their merged semantic bytes', async () => {
  const intakeJson = await readFile(path.join(rootDir, 'evaluations/grade-4-source-intake.json'));
  const intakeMarkdown = await readFile(path.join(rootDir, 'docs/audits/grade-4-source-intake.md'));
  assert.equal(sha256(intakeJson), '29972ee2df6ceaa08d76af71e345167a923db79c3c4379333ec8036843505b54');
  assert.equal(sha256(intakeMarkdown), 'cbde4d4d7ebc8372b2b66a41ab7415752425738ce0891e2f0bb7df4cf8c0ab88');
});

test('all committed generated source artifacts match regenerated bytes', async () => {
  for (const [relativePath, expected] of artifacts.files) {
    assertCommittedBytes(expected, await readFile(path.join(rootDir, relativePath)), relativePath);
  }
  assert.equal(await readFile(path.join(rootDir, evidencePath), 'utf8'), artifacts.files.get(evidencePath));
});
