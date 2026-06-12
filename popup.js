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
      statusEl.textContent = '💾 Скачиваю Opiq-DB.zip...';
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

  // ── ZIP builder (no external library needed) ──────────────────────────────
  function buildAndDownloadZip(db) {
    const files = [];

    // index.json
    const index = {
      generatedAt: new Date().toISOString(),
      books: Object.values(db.books).map(b => ({
        id: b.id, title: b.title, publisher: b.publisher,
        grade: b.grade, language: b.language, subject: b.subject,
        chapterCount: db.chapters[b.id] ? Object.keys(db.chapters[b.id]).length : 0,
      }))
    };
    files.push({ path: 'Opiq-DB/index.json', content: JSON.stringify(index, null, 2) });

    // books/bookId.json
    Object.values(db.books).forEach(book => {
      files.push({
        path: `Opiq-DB/books/${book.id}.json`,
        content: JSON.stringify(book, null, 2)
      });
    });

    // chapters/bookId/chapterId.json
    Object.entries(db.chapters).forEach(([bookId, chapters]) => {
      Object.entries(chapters).forEach(([chapterId, chapter]) => {
        const safeId = chapterId.replace(/[^a-zA-Z0-9._-]/g, '_');
        files.push({
          path: `Opiq-DB/chapters/${bookId}/${safeId}.json`,
          content: JSON.stringify(chapter, null, 2)
        });
      });
    });

    const zip = createZip(files);
    const blob = new Blob([zip], { type: 'application/zip' });
    const url  = URL.createObjectURL(blob);
    chrome.downloads.download({ url, filename: 'Opiq-DB.zip', saveAs: false });
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
