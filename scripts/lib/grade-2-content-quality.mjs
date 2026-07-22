export const expectedGrade2Catalog = Object.freeze({
  'grade-2-estonian': [
    ['avita_eesti_keel_2_et', '232', 149, 'et', 'ordinary_curriculum', 'Avita'],
    ['koolibri_ilus_emake_2_et', '118', 182, 'et', 'ordinary_curriculum', 'Koolibri'],
    ['koolibri_mina_loen__2_et', '458', 41, 'et', 'ordinary_curriculum', 'Koolibri'],
  ],
  'grade-2-estonian-second-language': [
    ['koolibri_koos_on_lõ_2_et', '129', 72, 'et', 'ordinary_curriculum', 'Koolibri'],
  ],
  'grade-2-mathematics': [
    ['avita_matemaatik_2_et__kit95', '95', 108, 'et', 'ordinary_curriculum', 'Avita'],
    ['avita_математика_2_et__kit578', '578', 85, 'ru', 'ordinary_curriculum', 'Avita'],
    ['avita_математика_2_ru__kit165', '165', 108, 'ru', 'ordinary_curriculum', 'Avita'],
    ['harno_matemaatik_2_et__kit272', '272', 8, 'et', 'simplified_curriculum', 'Harno'],
    ['harno_matemaatik_2_et__kit273', '273', 10, 'et', 'simplified_curriculum', 'Harno'],
    ['harno_matemaatik_2_et__kit274', '274', 33, 'et', 'simplified_curriculum', 'Harno'],
    ['koolibri_matemaatik_2_et__kit107', '107', 56, 'et', 'ordinary_curriculum', 'Koolibri'],
    ['koolibri_математика_2_et__kit361', '361', 56, 'ru', 'ordinary_curriculum', 'Koolibri'],
  ],
  'grade-2-science': [
    ['avita_loodusõpet_2_et', '379', 27, 'et', 'ordinary_curriculum', 'Avita'],
    ['avita_minu_väike_2_et', '330', 27, 'et', 'supplementary', 'Avita'],
    ['avita_природовед_2_ru', '570', 23, 'ru', 'ordinary_curriculum', 'Avita'],
    ['koolibri_loodusõpet_2_et', '121', 64, 'et', 'ordinary_curriculum', 'Koolibri'],
    ['koolibri_природове_2_ru', '132', 67, 'ru', 'ordinary_curriculum', 'Koolibri'],
    ['ministeerium_loodusõpet_2_et', '501', 36, 'et', 'simplified_curriculum', 'Ministeerium'],
    ['skriibus_loodusõpet_2_et', '387', 28, 'et', 'ordinary_curriculum', 'Skriibus'],
    ['star cloud_loodusõpet_2_et', '384', 41, 'et', 'ordinary_curriculum', 'Star Cloud'],
  ],
  'grade-2-human-studies': [
    ['avita_inimeseõpe_2_et__kit449', '449', 13, 'et', 'ordinary_curriculum', 'Avita'],
    ['avita_inimeseõpe_2_et__kit494', '494', 35, 'et', 'ordinary_curriculum', 'Avita'],
    ['avita_inimeseõpe_2_ru__kit579', '579', 23, 'ru', 'ordinary_curriculum', 'Avita'],
    ['avita_loodus-_ja_2_et__kit56', '56', 59, 'et', 'ordinary_curriculum', 'Avita'],
    ['harno_inimeseõpe_2_et__kit286', '286', 37, 'et', 'simplified_curriculum', 'Harno'],
    ['koolibri_in2_2._kla_2_et__kit142', '142', 38, 'et', 'ordinary_curriculum', 'Koolibri'],
    ['koolibri_мой_мир._ч_2_ru__kit229', '229', 38, 'ru', 'ordinary_curriculum', 'Koolibri'],
  ],
  'grade-2-nature-and-human-studies': [
    ['avita_природа_и__2_ru__kit86', '86', 60, 'ru', 'mixed_subject', 'Avita'],
  ],
  'grade-2-arts-and-crafts': [
    ['kunsti-_ja_tööõpetus._2._osa', '192', 89, 'et', 'ordinary_curriculum', ''],
    ['kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid', '200', 85, 'et', 'supplementary', ''],
    ['трудовое_обучение_и_искусство._2_часть', '371', 89, 'ru', 'ordinary_curriculum', ''],
  ],
  'grade-2-music': [
    ['2._klassi_muusikaõpetus', '188', 116, 'et', 'ordinary_curriculum', ''],
    ['eesti_pärimusmuusika_keskuse_õppevideod', '465', 33, 'et', 'supplementary', ''],
    ['muusikaõpik_2._klassile', '193', 29, 'et', 'ordinary_curriculum', ''],
    ['muusikaõpik_2._klassile_2024', '556', 28, 'et', 'ordinary_curriculum', ''],
    ['музыка_–_волшебная_страна._2_класс', '238', 111, 'ru', 'ordinary_curriculum', ''],
  ],
  'grade-2-kodututarde-training': [
    ['kodutütarde_i_järk_(2026)', '593', 31, 'et', 'supplementary', 'Kaitseliit'],
  ],
  'grade-2-noorte-kotkaste-training': [
    ['kaitseliit_noorte_kot_2_et', '594', 27, 'et', 'supplementary', 'Kaitseliit'],
  ],
  'grade-2-russian': [
    ['avita_русский_язык_2_класс_kit292', '292', 192, 'ru', 'ordinary_curriculum', 'Avita'],
    ['avita_русский_язык_i_ступень_часть_3_kit568', '568', 52, 'ru', 'ordinary_curriculum', 'Avita'],
    ['koolibri_русский_яз_2_ru', '186', 30, 'ru', 'ordinary_curriculum', 'Koolibri'],
    ['koolibri_светлячок._2_ru', '454', 99, 'ru', 'ordinary_curriculum', 'Koolibri'],
  ],
});

export const expectedGrade2RouteCount = 11;
export const expectedGrade2BookVariantCount = 42;
export const expectedGrade2PageCount = 2535;

export function normalizeQualityText(value) {
  return String(value ?? '')
    .replaceAll('\u00ad', '')
    .replace(/[\u200b-\u200d\u2060\ufeff]/gu, ' ')
    .normalize('NFC')
    .replace(/[\s\u00a0]+/gu, ' ')
    .trim();
}

function findFramedObjectEnd(value, start) {
  let curlyDepth = 0;
  let squareDepth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const character = value[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{') curlyDepth += 1;
    else if (character === '}') curlyDepth -= 1;
    else if (character === '[') squareDepth += 1;
    else if (character === ']') squareDepth -= 1;
    if (curlyDepth === 0 && squareDepth === 0) return index + 1;
  }
  return -1;
}

export function sanitizeCapturedTaskExample(value) {
  let remaining = String(value ?? '');
  let output = '';
  let removedPayloads = 0;
  while (remaining) {
    const marker = remaining.indexOf('{"d');
    if (marker === -1) {
      output += remaining;
      break;
    }
    output += remaining.slice(0, marker);
    const end = findFramedObjectEnd(remaining, marker);
    removedPayloads += 1;
    if (end === -1) break;
    remaining = remaining.slice(end);
  }
  return {
    text: normalizeQualityText(output),
    removed_payloads: removedPayloads,
  };
}

export function containsUnprocessedPayload(value) {
  return /\{"d|<\/?[A-Za-z][^>]*>/u.test(String(value ?? ''));
}

export function sourceBookLanguageSuffix(sourceBookId) {
  const match = String(sourceBookId ?? '').match(/_(et|ru)(?:__kit\d+)?$/u);
  return match?.[1] ?? null;
}

export function textScriptProfile(values) {
  const text = values.flat().join(' ');
  return {
    cyrillic: (text.match(/\p{Script=Cyrillic}/gu) ?? []).length,
    latin: (text.match(/\p{Script=Latin}/gu) ?? []).length,
  };
}

export function mixedScriptWords(values) {
  const found = new Set();
  for (const value of values.flat()) {
    for (const word of String(value ?? '').match(/\p{L}+/gu) ?? []) {
      if (/\p{Script=Cyrillic}/u.test(word) && /\p{Script=Latin}/u.test(word)) found.add(word);
    }
  }
  return [...found].sort((left, right) => left.localeCompare(right));
}
