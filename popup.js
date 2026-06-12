document.addEventListener('DOMContentLoaded', () => {
  const startBtn  = document.getElementById('startBtn');
  const importBtn = document.getElementById('importBtn');
  const stopBtn   = document.getElementById('stopBtn');
  const exportBtn = document.getElementById('exportBtn');
  const clearBtn  = document.getElementById('clearBtn');
  const statusEl  = document.getElementById('status');
  const statsEl   = document.getElementById('stats');

  // Restore settings
  chrome.storage.local.get(['selector','publisher','grade','language','subject','bookName'], s => {
    if (s.selector)  document.getElementById('selector').value  = s.selector;
    if (s.publisher) document.getElementById('publisher').value = s.publisher;
    if (s.grade)     document.getElementById('grade').value     = s.grade;
    if (s.language)  document.getElementById('language').value  = s.language;
    if (s.subject)   document.getElementById('subject').value   = s.subject;
    if (s.bookName)  document.getElementById('bookName').value  = s.bookName;
  });

  // Poll
  const poller = setInterval(refresh, 1000);
  window.addEventListener('unload', () => clearInterval(poller));
  refresh();

  function refresh() {
    chrome.storage.local.get(['running','statusText','db'], s => {
      statusEl.textContent = s.statusText || '';
      setRunningUI(!!s.running);
      renderStats(s.db || { books: {}, chapters: {} });
    });
  }

  function renderStats(db) {
    const books = Object.values(db.books || {});
    if (books.length === 0) { statsEl.textContent = 'Пусто.'; return; }
    statsEl.innerHTML = books.map(b => {
      const ch = db.chapters[b.id] ? Object.keys(db.chapters[b.id]).length : 0;
      const tk = db.chapters[b.id]
        ? Object.values(db.chapters[b.id]).reduce((n,c) => n + (c.tasks ? c.tasks.length : 0), 0)
        : 0;
      return `<div class="stats-book">📗 <b>${b.id}</b><br>
        Глав: ${ch} | Заданий: ${tk}</div>`;
    }).join('');
  }

  startBtn.addEventListener('click', () => {
    const cfg = {
      selector:  document.getElementById('selector').value.trim(),
      publisher: document.getElementById('publisher').value.trim(),
      grade:     parseInt(document.getElementById('grade').value) || null,
      language:  document.getElementById('language').value,
      subject:   document.getElementById('subject').value.trim(),
      bookName:  document.getElementById('bookName').value.trim(),
    };
    if (!cfg.selector) { statusEl.textContent = '⚠️ Укажи селектор'; return; }
    chrome.storage.local.set({
      selector: cfg.selector, publisher: cfg.publisher,
      grade: cfg.grade, language: cfg.language, subject: cfg.subject, bookName: cfg.bookName
    });
    statusEl.textContent = 'Запускаю...';
    chrome.runtime.sendMessage({ type: 'START', cfg }, resp => {
      if (chrome.runtime.lastError) {
        statusEl.textContent = '❌ ' + chrome.runtime.lastError.message;
        return;
      }
      setRunningUI(true);
      statusEl.textContent = 'Запускаю...';
    });
  });

  stopBtn.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'STOP' }));

  exportBtn.addEventListener('click', () => {
    chrome.storage.local.get(['db'], s => {
      const db = s.db || { books: {}, chapters: {} };
      if (Object.keys(db.books).length === 0) {
        statusEl.textContent = '⚠️ База пуста'; return;
      }
      buildAndDownloadZip(db);
      statusEl.textContent = '💾 Скачиваю compact v2 ZIP...';
    });
  });


  importBtn.addEventListener('click', () => {
    document.getElementById('importFile').click();
  });

  document.getElementById('importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    statusEl.textContent = '📂 Читаю архив...';
    e.target.value = ''; // reset so same file can be re-imported

    try {
      const buf = await file.arrayBuffer();
      const imported = parseZip(new Uint8Array(buf));
      if (!imported) { statusEl.textContent = '❌ Не удалось прочитать ZIP'; return; }

      chrome.storage.local.get(['db'], s => {
        const db = s.db || { books: {}, chapters: {} };
        let newBooks = 0, newChapters = 0;

        // Merge books
        Object.entries(imported.books || {}).forEach(([id, book]) => {
          if (!db.books[id]) { db.books[id] = book; newBooks++; }
        });

        // Merge chapters
        Object.entries(imported.chapters || {}).forEach(([bookId, chapters]) => {
          if (!db.chapters[bookId]) db.chapters[bookId] = {};
          Object.entries(chapters).forEach(([chapId, chap]) => {
            if (!db.chapters[bookId][chapId]) {
              db.chapters[bookId][chapId] = chap;
              newChapters++;
            }
          });
        });

        chrome.storage.local.set({ db }, () => {
          statusEl.textContent = `✅ Импорт: +${newBooks} книг, +${newChapters} глав`;
          refresh();
        });
      });
    } catch(err) {
      statusEl.textContent = '❌ Ошибка: ' + err.message;
    }
  });

  clearBtn.addEventListener('click', () => {
    if (!confirm('Очистить ВСЮ базу? Это удалит все книги.')) return;
    chrome.storage.local.set({ db: { books: {}, chapters: {} }, targetTabId: null, statusText: 'База очищена. Глав: 0' });
    statsEl.textContent = 'Пусто.';
  });

  function setRunningUI(running) {
    startBtn.style.display = running ? 'none' : 'block';
    stopBtn.style.display  = running ? 'block' : 'none';
  }

  const NOISE_PHRASES = [
    'Õpetaja lisatud materjal', 'Minu lisatud materjal', 'Seotud sisu',
    'Previous', 'Next', 'Kontrolli vastust', 'Alusta uuesti', 'Muuda vastust',
    'Näita õiget vastust', 'Näita minu vastust', 'Õpilaste statistika',
    'Õigesti vastatud', 'Valesti vastatud', 'Учитель добавил материал',
    'Мой добавленный материал', 'Связанное содержание', 'Проверить ответ',
    'Начать заново', 'Изменить ответ', 'Показать правильный ответ',
    'Показать мой ответ', 'Статистика учеников'
  ];

  const NOISE_KEYWORDS = new Set([
    'õpetaja', 'lisatud', 'materjal', 'minu', 'seotud', 'sisu',
    'ülesanne', 'ülesanded', 'задание', 'задания'
  ]);

  const ALIASES = [
    { et: ['liitmine', 'liida', 'summa', 'kokku'], ru: ['сложение', 'сложи', 'сумма'], en: ['addition', 'add', 'sum'] },
    { et: ['lahutamine', 'lahuta', 'vahe'], ru: ['вычитание', 'вычти', 'разность'], en: ['subtraction', 'subtract', 'difference'] },
    { et: ['korrutamine', 'korruta', 'korrutis', 'korda'], ru: ['умножение', 'умножь', 'произведение'], en: ['multiplication', 'multiply', 'product'] },
    { et: ['jagamine', 'jaga', 'jagatis', 'pool'], ru: ['деление', 'раздели', 'частное', 'половина'], en: ['division', 'divide', 'quotient', 'half'] },
    { et: ['arv', 'arvud', 'arvu', 'numbrid'], ru: ['число', 'числа', 'цифры'], en: ['number', 'numbers', 'digits'] },
    { et: ['võrdlemine', 'võrdle', 'suurem', 'väiksem'], ru: ['сравнение', 'сравни', 'больше', 'меньше'], en: ['comparison', 'compare', 'greater', 'less'] },
    { et: ['geomeetria', 'kujund', 'kujundid', 'sirge', 'lõik'], ru: ['геометрия', 'фигура', 'фигуры', 'прямая', 'отрезок'], en: ['geometry', 'shape', 'shapes', 'line', 'segment'] },
    { et: ['mõõtmine', 'mõõtühik', 'pikkus', 'mass', 'maht'], ru: ['измерение', 'единица измерения', 'длина', 'масса', 'объём'], en: ['measurement', 'unit', 'length', 'mass', 'volume'] },
    { et: ['aeg', 'kell', 'kalender'], ru: ['время', 'часы', 'календарь'], en: ['time', 'clock', 'calendar'] },
    { et: ['raha', 'euro', 'sent'], ru: ['деньги', 'евро', 'цент'], en: ['money', 'euro', 'cent'] },
    { et: ['kordamine', 'korda', 'harjutan'], ru: ['повторение', 'повтори', 'тренировка'], en: ['revision', 'review', 'practice'] },
    { et: ['loodus', 'loodusõpetus', 'keskkond'], ru: ['природа', 'природоведение', 'окружающая среда'], en: ['nature', 'science', 'environment'] },
    { et: ['taim', 'taimed', 'puu', 'lill'], ru: ['растение', 'растения', 'дерево', 'цветок'], en: ['plant', 'plants', 'tree', 'flower'] },
    { et: ['loom', 'loomad', 'linnud', 'putukad'], ru: ['животное', 'животные', 'птицы', 'насекомые'], en: ['animal', 'animals', 'birds', 'insects'] },
    { et: ['aastaajad', 'kevad', 'suvi', 'sügis', 'talv'], ru: ['времена года', 'весна', 'лето', 'осень', 'зима'], en: ['seasons', 'spring', 'summer', 'autumn', 'winter'] },
    { et: ['vesi', 'veeohutus', 'veekogu'], ru: ['вода', 'безопасность на воде', 'водоём'], en: ['water', 'water safety', 'body of water'] },
    { et: ['inimene', 'keha', 'meeled', 'tervis'], ru: ['человек', 'тело', 'чувства', 'здоровье'], en: ['human', 'body', 'senses', 'health'] }
  ];

  const ENGLISH_TOPIC_TERMS = new Set(ALIASES.flatMap(group => group.en).map(term => term.toLowerCase()));

  // ── ZIP builder (no external library needed) ──────────────────────────────
  function buildAndDownloadZip(db) {
    const files = [];
    const records = buildCompactRecords(db);
    const topicMap = buildTopicMap(records);
    const rawIndex = {
      generatedAt: new Date().toISOString(),
      books: Object.values(db.books).map(b => ({
        id: b.id, title: b.title, publisher: b.publisher,
        grade: b.grade, language: b.language, subject: b.subject,
        chapterCount: db.chapters[b.id] ? Object.keys(db.chapters[b.id]).length : 0,
      }))
    };

    // index.json
    const index = {
      formatVersion: '2.0',
      generatedAt: rawIndex.generatedAt,
      source: 'opiq-helper-extension',
      recordCount: records.length,
      supportedQueryLanguages: ['et', 'ru', 'en'],
      compactFiles: ['opiq_lookup.md', 'opiq_lookup.jsonl', 'topic_map.json', 'index.json'],
      rawArchiveIncluded: true,
      books: rawIndex.books
    };
    files.push({ path: 'index.json', content: JSON.stringify(index, null, 2) });
    files.push({ path: 'opiq_lookup.md', content: records.map(markdownRecord).join('\n\n') + '\n' });
    files.push({
      path: 'opiq_lookup.jsonl',
      content: records.map(record => JSON.stringify(record)).join('\n') + '\n'
    });
    files.push({ path: 'topic_map.json', content: JSON.stringify(topicMap, null, 2) });

    // Keep legacy raw data as fallback for AI/post-processing outside the extension.
    files.push({ path: 'raw/Opiq-DB/index.json', content: JSON.stringify(rawIndex, null, 2) });

    // books/bookId.json
    Object.values(db.books).forEach(book => {
      files.push({
        path: `raw/Opiq-DB/books/${book.id}.json`,
        content: JSON.stringify(book, null, 2)
      });
    });

    // chapters/bookId/chapterId.json
    Object.entries(db.chapters).forEach(([bookId, chapters]) => {
      Object.entries(chapters).forEach(([chapterId, chapter]) => {
        const safeId = chapterId.replace(/[^a-zA-Z0-9._-]/g, '_');
        files.push({
          path: `raw/Opiq-DB/chapters/${bookId}/${safeId}.json`,
          content: JSON.stringify(chapter, null, 2)
        });
      });
    });

    const zip = createZip(files);
    const blob = new Blob([zip], { type: 'application/zip' });
    const url  = URL.createObjectURL(blob);
    chrome.downloads.download({ url, filename: `${buildExportBaseName(db)}.zip`, saveAs: false });
  }

  function buildCompactRecords(db) {
    const records = [];
    Object.entries(db.chapters || {}).forEach(([bookId, chapters]) => {
      const book = (db.books || {})[bookId] || {};
      Object.values(chapters || {}).forEach(chapter => {
        const title = normalizeSpace(chapter.chapterTitle || '');
        const headings = unique((chapter.headings || [])
          .map(h => h.text || '')
          .filter(text => text && !isTaskHeading(normalizeSpace(text))));
        const sourceKeywords = unique((chapter.keywords || [])
          .filter(keyword => keyword && !NOISE_KEYWORDS.has(keyword.toLowerCase())));
        const subject = inferSubject(book, title);
        const topics = buildTopicAliases(sourceKeywords, title, headings, subject);
        const taskExamples = [];
        (chapter.tasks || []).forEach(task => {
          if (taskExamples.length >= 2) return;
          const text = normalizeSpace(task.text || '');
          if (text.length >= 20 && !/Õigesti vastatud|Valesti vastatud|Показать|Статистика/.test(text)) {
            taskExamples.push(text.slice(0, 220));
          }
        });

        records.push({
          title,
          url: chapter.url || '',
          book: book.title || bookId,
          book_id: bookId,
          chapter_id: chapter.chapterId || '',
          grade: book.grade || null,
          subject_et: subject.et,
          subject_ru: subject.ru,
          subject_en: subject.en,
          language: detectLanguage([title, book.title || '', ...headings, ...sourceKeywords].join(' ')),
          publisher: book.publisher || '',
          topics_et: topics.et,
          topics_ru: topics.ru,
          topics_en: topics.en,
          headings,
          task_examples: taskExamples
        });
      });
    });
    return records;
  }

  function buildTopicAliases(sourceTerms, title, headings, subject) {
    const text = [title, ...headings, ...sourceTerms].join(' ').toLowerCase();
    const topics = { et: [subject.et], ru: [subject.ru], en: [subject.en] };

    ALIASES.forEach(group => {
      const matched = [...group.et, ...group.ru, ...group.en].some(term => text.includes(term.toLowerCase()));
      if (!matched) return;
      topics.et.push(...group.et);
      topics.ru.push(...group.ru);
      topics.en.push(...group.en);
    });

    sourceTerms.forEach(term => {
      const clean = normalizeSpace(term);
      if (!clean || NOISE_KEYWORDS.has(clean.toLowerCase())) return;
      const lang = detectLanguage(clean);
      if (isValidTopicForLanguage(clean, lang)) topics[lang].push(clean);
    });

    return {
      et: unique(topics.et.filter(term => isValidTopicForLanguage(term, 'et'))).slice(0, 40),
      ru: unique(topics.ru.filter(term => isValidTopicForLanguage(term, 'ru'))).slice(0, 40),
      en: unique(topics.en.filter(term => isValidTopicForLanguage(term, 'en'))).slice(0, 40)
    };
  }

  function markdownRecord(record) {
    const lines = [
      `## ${record.title || 'Untitled page'}`,
      `URL: ${record.url}`,
      `Book: ${record.book}`,
      `Class: ${record.grade || ''}`,
      `Subject: ${record.subject_en} / ${record.subject_et} / ${record.subject_ru}`,
      `Language: ${record.language}`,
      `Publisher: ${record.publisher}`,
      `Book ID: ${record.book_id}`,
      `Chapter ID: ${record.chapter_id}`,
      `Topics ET: ${record.topics_et.join(', ')}`,
      `Topics RU: ${record.topics_ru.join(', ')}`,
      `Topics EN: ${record.topics_en.join(', ')}`
    ];
    if (record.headings.length) lines.push(`Headings: ${record.headings.join('; ')}`);
    if (record.task_examples.length) lines.push(`Task examples: ${record.task_examples.join('; ')}`);
    return lines.join('\n');
  }

  function buildTopicMap(records) {
    const map = {};
    records.forEach(record => {
      [...record.topics_et, ...record.topics_ru, ...record.topics_en, record.title].forEach(topic => {
        const key = normalizeSpace(topic).toLowerCase();
        if (key.length < 3) return;
        if (!map[key]) map[key] = [];
        const entry = {
          title: record.title,
          url: record.url,
          language: record.language,
          grade: record.grade,
          subject: record.subject_en
        };
        if (!map[key].some(existing => existing.url === entry.url)) map[key].push(entry);
      });
    });
    Object.keys(map).forEach(key => { map[key] = map[key].slice(0, 30); });
    return map;
  }

  function buildExportBaseName(db) {
    const books = Object.values(db.books || {});
    const first = books[0] || {};
    const grade = first.grade ? `${first.grade}klass` : 'opiq';
    const subject = slugify(first.subject || first.title || 'lookup');
    return `opiq_${grade}_${subject}_v2`;
  }

  function inferSubject(book, title) {
    const blob = `${book.subject || ''} ${book.id || ''} ${book.title || ''} ${title || ''}`.toLowerCase();
    if (blob.includes('loodus') || blob.includes('planeet') || blob.includes('veeohutus')) {
      return { et: 'loodusõpetus', ru: 'природоведение', en: 'science' };
    }
    return { et: 'matemaatika', ru: 'математика', en: 'mathematics' };
  }

  function normalizeSpace(value) {
    let text = value || '';
    NOISE_PHRASES.forEach(phrase => { text = text.split(phrase).join(' '); });
    return text.replace(/\s+/g, ' ').trim();
  }

  function unique(values) {
    const seen = new Set();
    const result = [];
    values.forEach(value => {
      const clean = normalizeSpace(value);
      const key = clean.toLowerCase();
      if (!clean || seen.has(key)) return;
      seen.add(key);
      result.push(clean);
    });
    return result;
  }

  function isTaskHeading(value) {
    return /^(Ülesanne|Задание)\s*[\wА-Яа-я-]*$/i.test(value || '');
  }

  function detectLanguage(text) {
    if (/[А-Яа-яЁё]/.test(text)) return 'ru';
    const lower = (text || '').toLowerCase();
    if (ENGLISH_TOPIC_TERMS.has(lower) || /\b(the|and|of|with|number|addition|multiplication)\b/i.test(text || '')) return 'en';
    return 'et';
  }

  function isValidTopicForLanguage(term, language) {
    if (language === 'ru') return !/[A-Za-zÕÄÖÜŠŽõäöüšž]/.test(term);
    if (language === 'en') return !/[А-Яа-яЁёÕÄÖÜŠŽõäöüšž]/.test(term);
    return !/[А-Яа-яЁё]/.test(term);
  }

  function slugify(value) {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'lookup';
  }

  // Minimal ZIP implementation (store, no compression)
  function createZip(files) {
    const enc = new TextEncoder();
    const parts = [];
    const centralDir = [];
    let offset = 0;

    files.forEach(({ path, content }) => {
      const pathBytes    = enc.encode(path);
      const contentBytes = enc.encode(content);
      const crc          = crc32(contentBytes);
      const size         = contentBytes.length;
      const now          = dosDateTime();

      // Local file header
      const lhSize = 30 + pathBytes.length;
      const lh = new DataView(new ArrayBuffer(lhSize));
      setUint32LE(lh, 0,  0x04034b50); // signature
      setUint16LE(lh, 4,  20);          // version needed
      setUint16LE(lh, 6,  0);           // flags
      setUint16LE(lh, 8,  0);           // compression (store)
      setUint16LE(lh, 10, now.time);
      setUint16LE(lh, 12, now.date);
      setUint32LE(lh, 14, crc);
      setUint32LE(lh, 18, size);
      setUint32LE(lh, 22, size);
      setUint16LE(lh, 26, pathBytes.length);
      setUint16LE(lh, 28, 0);
      new Uint8Array(lh.buffer).set(pathBytes, 30);

      parts.push(new Uint8Array(lh.buffer), contentBytes);

      // Central dir entry
      const cdSize = 46 + pathBytes.length;
      const cd = new DataView(new ArrayBuffer(cdSize));
      setUint32LE(cd, 0,  0x02014b50);
      setUint16LE(cd, 4,  20);
      setUint16LE(cd, 6,  20);
      setUint16LE(cd, 8,  0);
      setUint16LE(cd, 10, 0);
      setUint16LE(cd, 12, now.time);
      setUint16LE(cd, 14, now.date);
      setUint32LE(cd, 16, crc);
      setUint32LE(cd, 20, size);
      setUint32LE(cd, 24, size);
      setUint16LE(cd, 28, pathBytes.length);
      setUint16LE(cd, 30, 0);
      setUint16LE(cd, 32, 0);
      setUint16LE(cd, 34, 0);
      setUint16LE(cd, 36, 0);
      setUint32LE(cd, 38, 0);
      setUint32LE(cd, 42, offset);
      new Uint8Array(cd.buffer).set(pathBytes, 46);
      centralDir.push(new Uint8Array(cd.buffer));

      offset += lhSize + size;
    });

    const cdOffset = offset;
    const cdBytes  = concat(centralDir);
    const eocd     = new DataView(new ArrayBuffer(22));
    setUint32LE(eocd, 0,  0x06054b50);
    setUint16LE(eocd, 4,  0);
    setUint16LE(eocd, 6,  0);
    setUint16LE(eocd, 8,  files.length);
    setUint16LE(eocd, 10, files.length);
    setUint32LE(eocd, 12, cdBytes.length);
    setUint32LE(eocd, 16, cdOffset);
    setUint16LE(eocd, 20, 0);

    return concat([...parts, cdBytes, new Uint8Array(eocd.buffer)]);
  }

  function concat(arrays) {
    const total = arrays.reduce((n, a) => n + a.length, 0);
    const out = new Uint8Array(total);
    let i = 0;
    arrays.forEach(a => { out.set(a, i); i += a.length; });
    return out;
  }

  function setUint32LE(dv, o, v) { dv.setUint32(o, v, true); }
  function setUint16LE(dv, o, v) { dv.setUint16(o, v, true); }

  function dosDateTime() {
    const d = new Date();
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
    };
  }

  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      c ^= bytes[i];
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  // ── ZIP parser ────────────────────────────────────────────────────────────
  function parseZip(bytes) {
    const dec = new TextDecoder();
    const view = new DataView(bytes.buffer);
    const result = { books: {}, chapters: {} };

    let i = 0;
    while (i < bytes.length - 4) {
      if (view.getUint32(i, true) !== 0x04034b50) { i++; continue; }

      const fnLen   = view.getUint16(i + 26, true);
      const extraLen= view.getUint16(i + 28, true);
      const compSize= view.getUint32(i + 18, true);
      const path    = dec.decode(bytes.slice(i + 30, i + 30 + fnLen));
      const dataStart = i + 30 + fnLen + extraLen;
      const data    = bytes.slice(dataStart, dataStart + compSize);

      try {
        const json = JSON.parse(dec.decode(data));
        // Opiq-DB/books/bookId.json
        const bookMatch = path.match(/books\/([^/]+)\.json$/);
        if (bookMatch) result.books[bookMatch[1]] = json;

        // Opiq-DB/chapters/bookId/chapterId.json
        const chapMatch = path.match(/chapters\/([^/]+)\/([^/]+)\.json$/);
        if (chapMatch) {
          if (!result.chapters[chapMatch[1]]) result.chapters[chapMatch[1]] = {};
          result.chapters[chapMatch[1]][chapMatch[2]] = json;
        }
      } catch {}

      i = dataStart + compSize;
    }
    return result;
  }

});
