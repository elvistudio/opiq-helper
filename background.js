// Keep service worker alive
const keepAlive = () => setInterval(chrome.runtime.getPlatformInfo, 20000);
chrome.runtime.onStartup.addListener(keepAlive);
keepAlive();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START') {
    // Remember the tab we started from
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0] ? tabs[0].id : null;
      chrome.storage.local.set({ running: true, cfg: msg.cfg, statusText: 'Запускаю...', targetTabId: tabId }, processPage);
    });
    sendResponse({ ok: true });
  }
  if (msg.type === 'STOP') {
    chrome.storage.local.set({ running: false, statusText: '⏹ Остановлено.' });
    sendResponse({ ok: true });
  }
  return true;
});

function setStatus(text) { chrome.storage.local.set({ statusText: text }); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function processPage() {
  const s = await chrome.storage.local.get(['running','cfg','db']);
  if (!s.running) { setStatus('⏹ Остановлено.'); return; }

  const cfg = s.cfg;
  // db = { books: {}, chapters: {bookId: {chapterId: {...}}}, index: {...} }
  const db = s.db || { books: {}, chapters: {} };

  let tab;
  try {
    const stored = await chrome.storage.local.get(['targetTabId']);
    if (stored.targetTabId) {
      tab = await chrome.tabs.get(stored.targetTabId);
    } else {
      [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    }
    if (!tab) throw new Error('Нет активной вкладки');
  } catch (e) {
    setStatus(`❌ ${e.message}`);
    chrome.storage.local.set({ running: false });
    return;
  }

  const url = tab.url;
  const totalChapters = Object.values(db.chapters).reduce((n, b) => n + Object.keys(b).length, 0);
  setStatus(`📖 Читаю главу ${totalChapters + 1}: ${url.split('/').slice(-1)[0]}`);

  // Extract
  let pageData;
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractStructured,
    });
    pageData = result;
  } catch (e) {
    setStatus(`❌ Ошибка извлечения: ${e.message}`);
    chrome.storage.local.set({ running: false });
    return;
  }

  // Build bookId
  const bookId = cfg.bookName
    ? cfg.bookName.toLowerCase().replace(/\s+/g, '_')
    : buildBookId(cfg, pageData);

  // Ensure book exists
  if (!db.books[bookId]) {
    db.books[bookId] = {
      id:        bookId,
      title:     cfg.subject ? `${cfg.subject}${cfg.grade ? ' ' + cfg.grade + ' klass' : ''}` : pageData.bookTitle,
      publisher: cfg.publisher || pageData.publisher || '',
      grade:     cfg.grade     || pageData.grade     || null,
      language:  cfg.language  || 'et',
      subject:   cfg.subject   || '',
      createdAt: new Date().toISOString(),
    };
  }

  if (!db.chapters[bookId]) db.chapters[bookId] = {};

  const chapterId = pageData.chapterId || String(totalChapters + 1);

  // Chapter data
  const chapterData = {
    bookId,
    chapterId,
    chapterTitle: pageData.chapterTitle || '',
    url,
    headings:     pageData.headings,
    keywords:     buildKeywords(pageData),
    tasks:        pageData.tasks,
    images:       pageData.images,
    scrapedAt:    new Date().toISOString(),
  };

  // Upsert (add or update)
  db.chapters[bookId][chapterId] = chapterData;

  const totalNow = Object.values(db.chapters).reduce((n, b) => n + Object.keys(b).length, 0);
  const taskCount = Object.values(db.chapters).reduce((n, b) =>
    n + Object.values(b).reduce((m, c) => m + (c.tasks ? c.tasks.length : 0), 0), 0);

  await chrome.storage.local.set({ db });
  setStatus(`✅ Глав: ${totalNow} | Заданий: ${taskCount} | Ищу «Далее»...`);

  // Check next button
  const [{ result: btnCheck }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel) => {
      const btn = document.querySelector(sel);
      if (!btn) return { found: false };
      if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return { found: true, disabled: true };
      return { found: true, disabled: false };
    },
    args: [cfg.selector],
  });

  if (!btnCheck.found || btnCheck.disabled) {
    // Re-read db to get fresh counts
    const fresh = await chrome.storage.local.get(['db']);
    const freshDb = fresh.db || { books: {}, chapters: {} };
    const freshChapters = Object.values(freshDb.chapters).reduce((n, b) => n + Object.keys(b).length, 0);
    const freshTasks = Object.values(freshDb.chapters).reduce((n, b) =>
      n + Object.values(b).reduce((m, c) => m + (c.tasks ? c.tasks.length : 0), 0), 0);
    setStatus(`🏁 Готово! Глав: ${freshChapters} | Заданий: ${freshTasks}`);
    chrome.storage.local.set({ running: false });
    return;
  }

  // Click next
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel) => document.querySelector(sel)?.click(),
    args: [cfg.selector],
  });

  const delay = Math.floor(Math.random() * 5000 + 5000);
  setStatus(`⏳ Жду ${(delay/1000).toFixed(1)}с... (глав: ${totalNow})`);
  await waitForTabLoad(tab.id);
  await sleep(delay);

  processPage();
}

// ── Page extraction (injected) ─────────────────────────────────────────────
function extractStructured() {
  const articles = [...document.querySelectorAll('[role="article"]')];
  if (articles.length === 0) return empty();

  const titleEl      = document.querySelector('h1');
  const chapterTitle = titleEl ? titleEl.textContent.trim() : '';

  // Chapter ID like "1.3" from page text
  let chapterId = '';
  const m = document.body.innerText.match(/Peatükk\s+([\d.]+)/i)
         || document.title.match(/([\d]+\.[\d]+)/);
  if (m) chapterId = m[1];

  // Book title
  const bookTitleEl = document.querySelector('[class*="kit-title"],[class*="book-title"]');
  const bookTitle   = bookTitleEl
    ? bookTitleEl.textContent.trim()
    : document.title.replace(/\s*[–-].*$/, '').trim();

  // Publisher
  let publisher = '';
  const pub = document.body.innerText.match(/\b(Avita|Koolibri|Maurus|Studium)\b/i);
  if (pub) publisher = pub[1];

  // Grade
  let grade = null;
  const gr = document.body.innerText.match(/(\d+)\.\s*(?:klassi|klass)\b/i)
          || document.title.match(/(\d+)\.\s*klass/i);
  if (gr) grade = parseInt(gr[1]);

  // Headings
  const headings = [];
  articles.forEach(a => {
    a.querySelectorAll('h1,h2,h3').forEach(h => {
      const t = h.textContent.trim();
      if (t.length > 1) headings.push({ level: h.tagName, text: t });
    });
  });

  // Images
  const images = [];
  articles.forEach(a => {
    a.querySelectorAll('img').forEach(img => {
      if (img.src && !img.src.startsWith('data:') && !img.src.includes('logo'))
        images.push({ src: img.src, alt: img.alt || '' });
    });
  });

  // Tasks
  const NOISE = new Set(['Kontrolli vastust','Alusta uuesti','Muuda vastust',
    'Näita õiget vastust','Näita minu vastust','Õpilaste statistika',
    'Õigesti vastatud: 0','Valesti vastatud: 0','Salvesta']);
  const taskRe = /^(Ülesanne|ÜLESANNE|Задание|ЗАДАНИЕ)\s+(\w+)/i;

  const tasks = [];
  articles.forEach(article => {
    [...article.querySelectorAll('h2,h3,h4,h5')].filter(el => taskRe.test(el.textContent.trim()))
    .forEach(taskEl => {
      const titleText = taskEl.textContent.trim();
      const tm = titleText.match(taskRe);
      if (!tm) return;
      let text = '';
      let node = taskEl.nextElementSibling;
      while (node && !taskRe.test(node.textContent.trim())) {
        const t = node.textContent.replace(/\s+/g, ' ').trim();
        if (t && !NOISE.has(t)) text += (text ? ' ' : '') + t;
        node = node.nextElementSibling;
      }
      tasks.push({ id: tm[2], title: titleText, text: text.trim() });
    });
  });

  return { bookTitle, chapterId, chapterTitle, publisher, grade, headings, images, tasks };

  function empty() {
    return { bookTitle: document.title, chapterId: '', chapterTitle: document.title,
             publisher: '', grade: null, headings: [], images: [], tasks: [] };
  }
}

function buildBookId(cfg, pageData) {
  const pub  = (cfg.publisher || pageData.publisher || 'unknown').toLowerCase();
  const subj = (cfg.subject   || 'book').toLowerCase().replace(/\s+/g, '_').slice(0, 10);
  const lang = cfg.language || 'et';
  const gr   = cfg.grade || pageData.grade;
  return gr ? `${pub}_${subj}_${gr}_${lang}` : `${pub}_${subj}_${lang}`;
}

function buildKeywords(pageData) {
  const words = new Set();
  const add = str => str && str.toLowerCase()
    .replace(/[^a-zа-яõäöüšž\s]/gi, ' ')
    .split(/\s+/).filter(w => w.length > 3).forEach(w => words.add(w));
  add(pageData.chapterTitle);
  pageData.headings.forEach(h => add(h.text));
  return [...words].slice(0, 15);
}

function waitForTabLoad(tabId) {
  return new Promise(resolve => {
    const check = setInterval(async () => {
      try {
        const t = await chrome.tabs.get(tabId);
        if (t.status === 'complete') { clearInterval(check); resolve(); }
      } catch { clearInterval(check); resolve(); }
    }, 400);
    setTimeout(() => { clearInterval(check); resolve(); }, 30000);
  });
}
