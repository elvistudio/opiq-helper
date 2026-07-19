const directOpiqUrlPattern = /^https:\/\/(?:www\.)?opiq\.ee\/\S+$/i;

export function normalizeRegressionText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[\s\u00a0]+/gu, ' ')
    .trim();
}

function splitList(value) {
  const normalized = normalizeRegressionText(value);
  if (!normalized) return [];
  const separator = normalized.includes(';') ? ';' : ',';
  return normalized
    .split(separator)
    .map(normalizeRegressionText)
    .filter(Boolean);
}

function parseFields(block, context) {
  const fields = new Map();
  for (const line of block.split(/\r?\n/u)) {
    const match = line.match(/^\s*(?:-\s*)?([A-Za-z][A-Za-z ]*):\s*(.*?)\s*$/u);
    if (!match) continue;
    const key = normalizeRegressionText(match[1]).toLowerCase();
    if (fields.has(key)) {
      throw new Error(`${context}: duplicate Markdown field "${match[1]}".`);
    }
    fields.set(key, match[2]);
  }
  return fields;
}

function normalizedSubject(fields, context) {
  const combined = normalizeRegressionText(fields.get('subject'));
  const split = {
    en: normalizeRegressionText(fields.get('subject en')),
    et: normalizeRegressionText(fields.get('subject et')),
    ru: normalizeRegressionText(fields.get('subject ru')),
  };

  if (combined) {
    const values = combined.split(/\s*\/\s*/u).map(normalizeRegressionText);
    if (values.length !== 3 || values.some((value) => !value)) {
      throw new Error(`${context}: combined Subject must contain EN / ET / RU values; found "${combined}".`);
    }
    const subject = { en: values[0], et: values[1], ru: values[2] };
    if (Object.values(split).some(Boolean)) {
      throw new Error(`${context}: combined and split Subject fields cannot be used together.`);
    }
    return subject;
  }
  return split;
}

function parseRecord(candidate, sourceId, mdPath, position) {
  const preliminaryContext = `${sourceId} record ${position}`;
  const fields = parseFields(candidate.block, preliminaryContext);
  const hasRecordMetadata = [
    'url', 'book id', 'class', 'subject', 'subject et', 'subject ru', 'subject en',
  ].some((field) => fields.has(field));
  if (!hasRecordMetadata) return null;

  const url = normalizeRegressionText(fields.get('url'));
  const context = `${sourceId} record ${position} URL ${url || '<missing>'}`;
  if (!directOpiqUrlPattern.test(url)) {
    throw new Error(`${context}: record must contain a direct Opiq URL in ${mdPath}.`);
  }

  const classText = normalizeRegressionText(fields.get('class'));
  const classNumber = Number(classText);
  if (!Number.isInteger(classNumber) || classNumber < 1) {
    throw new Error(`${context}: Class must be a positive integer; found "${classText || '<missing>'}".`);
  }

  return {
    position,
    title: normalizeRegressionText(candidate.title),
    url,
    book_id: normalizeRegressionText(fields.get('book id')),
    class: classNumber,
    subject: normalizedSubject(fields, context),
    language: normalizeRegressionText(fields.get('language')),
    headings: splitList(fields.get('headings')),
    task_examples: splitList(fields.get('task examples')),
    topics: {
      et: splitList(fields.get('topics et')),
      ru: splitList(fields.get('topics ru')),
      en: splitList(fields.get('topics en')),
    },
  };
}

export function parseOpiqRegressionMarkdown(markdown, { sourceId, mdPath = '<memory>' }) {
  if (typeof markdown !== 'string') throw new TypeError(`${sourceId}: Markdown input must be a string.`);
  if (typeof sourceId !== 'string' || !sourceId.trim()) throw new TypeError('sourceId must be a non-empty string.');

  const numberedStarts = [...markdown.matchAll(/^###\s+(\d+)\.\s+(.+)$/gmu)];
  const compactStarts = [...markdown.matchAll(/^##\s+(.+)$/gmu)];
  const format = numberedStarts.length > 0 ? 'normalized' : 'compact';
  const starts = format === 'normalized' ? numberedStarts : compactStarts;
  const candidates = starts.map((match, index) => ({
    declaredPosition: format === 'normalized' ? Number(match[1]) : null,
    title: format === 'normalized' ? match[2] : match[1],
    block: markdown.slice(match.index, index + 1 < starts.length ? starts[index + 1].index : markdown.length),
  }));

  const records = [];
  for (const candidate of candidates) {
    const position = records.length + 1;
    if (format === 'normalized' && candidate.declaredPosition !== position) {
      throw new Error(
        `${sourceId} record ${position}: normalized heading number is ${candidate.declaredPosition}; expected ${position} in ${mdPath}.`,
      );
    }
    const record = parseRecord(candidate, sourceId, mdPath, position);
    if (record) records.push(record);
  }

  if (records.length === 0) throw new Error(`${sourceId}: no canonical Markdown records found in ${mdPath}.`);
  return { format, records };
}

export function findRegressionRecordsByUrl(records, url) {
  return records.filter((record) => record.url === url);
}

export function containsRegressionPattern(values, pattern) {
  const needle = normalizeRegressionText(pattern).toLowerCase();
  return values.some((value) => normalizeRegressionText(value).toLowerCase().includes(needle));
}
