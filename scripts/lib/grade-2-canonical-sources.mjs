import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { parseOpiqRegressionMarkdown } from './opiq-regression-markdown.mjs';

export const grade2RouteIds = Object.freeze([
  'grade-2-estonian',
  'grade-2-estonian-second-language',
  'grade-2-mathematics',
  'grade-2-science',
  'grade-2-human-studies',
  'grade-2-nature-and-human-studies',
  'grade-2-arts-and-crafts',
  'grade-2-music',
  'grade-2-kodututarde-training',
  'grade-2-noorte-kotkaste-training',
  'grade-2-russian',
]);

export const expectedGrade2RecordCounts = Object.freeze({
  'grade-2-estonian': 372,
  'grade-2-estonian-second-language': 72,
  'grade-2-mathematics': 464,
  'grade-2-science': 313,
  'grade-2-human-studies': 243,
  'grade-2-nature-and-human-studies': 60,
  'grade-2-arts-and-crafts': 263,
  'grade-2-music': 317,
  'grade-2-kodututarde-training': 31,
  'grade-2-noorte-kotkaste-training': 27,
  'grade-2-russian': 321,
});

export function bytewise(left, right) {
  return String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0;
}

function kitId(url) {
  return String(url).match(/\/kit\/([0-9]+)\//u)?.[1] ?? '';
}

function routeProgrammeType(routeId) {
  if (routeId === 'grade-2-nature-and-human-studies') return 'mixed_subject';
  if (routeId.endsWith('-training')) return 'supplementary';
  return 'multiple_book_programme_types';
}

function subjectNames(manifestRoute) {
  const required = manifestRoute.canonical_subject_policy?.required_subject;
  if (!required) throw new Error(`${manifestRoute.id}: canonical subject policy is required.`);
  return required;
}

function auditEntries(qa, routeId) {
  if (!qa.book_metadata_audit || typeof qa.book_metadata_audit !== 'object') {
    throw new Error(`${routeId}: QA book_metadata_audit is required.`);
  }
  return Object.entries(qa.book_metadata_audit);
}

function validateRouteModel(routeModel) {
  const { definition, canonical_records: records, book_metadata: books } = routeModel;
  const expected = expectedGrade2RecordCounts[definition.id];
  if (records.length !== expected || definition.expected_record_count !== expected) {
    throw new Error(`${definition.id}: expected ${expected} records, found ${records.length}.`);
  }
  if (records.some((record) => record.class !== 2)) {
    throw new Error(`${definition.id}: adjacent-grade record found.`);
  }
  if (new Set(records.map((record) => record.url)).size !== records.length) {
    throw new Error(`${definition.id}: canonical URLs must be unique inside the route.`);
  }
  const bookCounts = new Map();
  for (const record of records) {
    if (!books.has(record.book_id)) throw new Error(`${definition.id}: ${record.book_id} is absent from QA metadata.`);
    bookCounts.set(record.book_id, (bookCounts.get(record.book_id) ?? 0) + 1);
  }
  for (const [bookId, metadata] of books) {
    if (bookCounts.get(bookId) !== metadata.page_records) {
      throw new Error(`${definition.id}: ${bookId} has ${bookCounts.get(bookId) ?? 0} records; QA declares ${metadata.page_records}.`);
    }
  }
}

export async function loadGrade2CanonicalSourceModel(rootDir) {
  const manifest = JSON.parse(await readFile(path.join(rootDir, 'source-manifest.json'), 'utf8'));
  const manifestRoutes = new Map(
    manifest.sources
      .filter((entry) => grade2RouteIds.includes(entry.id))
      .map((entry) => [entry.id, entry]),
  );
  if (manifestRoutes.size !== grade2RouteIds.length) {
    throw new Error(`Grade 2 source model requires exactly ${grade2RouteIds.length} manifest routes.`);
  }

  const routes = [];
  const globalUrls = new Set();
  for (const routeId of grade2RouteIds) {
    const manifestRoute = manifestRoutes.get(routeId);
    const [markdown, qaText] = await Promise.all([
      readFile(path.join(rootDir, manifestRoute.md_path), 'utf8'),
      readFile(path.join(rootDir, manifestRoute.qa_path), 'utf8'),
    ]);
    const qa = JSON.parse(qaText);
    const parsed = parseOpiqRegressionMarkdown(markdown, {
      sourceId: routeId,
      mdPath: manifestRoute.md_path,
    });
    const books = new Map(auditEntries(qa, routeId));
    const canonicalRecords = parsed.records.map((record, index) => {
      const recordKitId = kitId(record.url);
      const book = books.get(record.book_id);
      if (!recordKitId || !book || !book.kits.includes(recordKitId)) {
        throw new Error(`${routeId}: ${record.url} does not reconcile with ${record.book_id} QA metadata.`);
      }
      if (globalUrls.has(record.url)) throw new Error(`${routeId}: canonical URL is owned by another Grade 2 route: ${record.url}.`);
      globalUrls.add(record.url);
      return {
        ...record,
        kit_id: recordKitId,
        book: book.title,
        publisher: book.publisher || null,
        programme_type: book.programme_type,
        source_sequence: index + 1,
      };
    });
    const names = subjectNames(manifestRoute);
    const definition = {
      id: routeId,
      title: `${routeId} architecture source`,
      grade: 2,
      grade_group: manifestRoute.grade_group,
      subject: names,
      subject_code: manifestRoute.subject,
      subject_et: manifestRoute.subject_et,
      included_kit_ids: [...new Set([...books.values()].flatMap((book) => book.kits))].sort(bytewise),
      source_archive: manifestRoute.source_archive,
      additional_source_archives: manifestRoute.additional_source_archives ?? [],
      output_path: manifestRoute.md_path,
      qa_path: manifestRoute.qa_path,
      expected_record_count: manifestRoute.record_count,
      programme_type: routeProgrammeType(routeId),
      coverage_status: manifestRoute.coverage_status,
      notes: manifestRoute.known_issues ?? [],
      edition_distinctions: [],
    };
    const routeModel = { definition, canonical_records: canonicalRecords, book_metadata: books, qa };
    validateRouteModel(routeModel);
    routes.push(routeModel);
  }
  const total = routes.reduce((sum, route) => sum + route.canonical_records.length, 0);
  const bookCount = routes.reduce((sum, route) => sum + route.book_metadata.size, 0);
  if (total !== 2483 || bookCount !== 41) {
    throw new Error(`Grade 2 source model expected 2483 records and 41 books; found ${total} and ${bookCount}.`);
  }
  return {
    routes,
    canonical_owners: globalUrls,
    record_count: total,
    book_count: bookCount,
  };
}

export function validateGrade2Manifest(model) {
  const diagnostics = [];
  const ids = model.routes.map((route) => route.definition.id);
  if (JSON.stringify(ids) !== JSON.stringify(grade2RouteIds)) {
    diagnostics.push({
      code: 'grade_2_route_set_mismatch',
      message: 'Grade 2 routes must match the declared manifest policy in deterministic order.',
    });
  }
  if (model.canonical_owners.size !== 2483) {
    diagnostics.push({
      code: 'grade_2_record_total_mismatch',
      message: `Expected 2483 unique Grade 2 canonical records; found ${model.canonical_owners.size}.`,
    });
  }
  if (model.book_count !== 41) {
    diagnostics.push({
      code: 'grade_2_book_total_mismatch',
      message: `Expected 41 Grade 2 book variants; found ${model.book_count}.`,
    });
  }
  return diagnostics;
}
