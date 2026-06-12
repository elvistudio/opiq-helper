# Current State

This is the current snapshot of the Chrome extension from:

`/Users/astzhalkouski/Downloads/screenshot-extension/`

## Purpose

The extension scrapes structured Opiq book/chapter data from the active browser tab, walks through chapters using a configured "next chapter" selector, stores collected data in `chrome.storage.local`, and exports/imports a ZIP archive.

## Files

- `manifest.json`: Chrome Manifest V3 configuration.
- `background.js`: service worker, scraping loop, injected page extraction, chapter upsert, navigation to next chapter.
- `popup.html`: extension popup UI.
- `popup.js`: popup behavior, local settings, stats, import/export, minimal ZIP writer/parser.

## Current Export Format

The extension now exports compact v2 archives for ChatGPT Project usage:

- `index.json`
- `opiq_lookup.md`
- `opiq_lookup.jsonl`
- `topic_map.json`
- `raw/Opiq-DB/index.json`
- `raw/Opiq-DB/books/<bookId>.json`
- `raw/Opiq-DB/chapters/<bookId>/<chapterId>.json`

The root lookup files are intended for fast ChatGPT retrieval. The `raw/` folder is kept as fallback material for later AI-assisted cleanup, debugging, or reprocessing.

The previous legacy raw archive format was:

- `Opiq-DB/index.json`
- `Opiq-DB/books/<bookId>.json`
- `Opiq-DB/chapters/<bookId>/<chapterId>.json`

## Compact v2 Rules

The compact v2 format keeps multilingual topic fields separate:

- `topics_et`: Estonian-only topics
- `topics_ru`: Russian-only topics
- `topics_en`: English-only topics

It keeps full cleaned headings for every page and avoids exporting image URLs, repeated Opiq UI text, empty task text, and other noisy content in the root lookup files.

The extension deliberately does not generate AI summaries. If summaries or deeper semantic enrichment are needed later, the exported files can be provided to an AI workflow outside the extension.

## Security Check

No obvious API keys, GitHub tokens, bearer tokens, passwords, or client secrets were found in the extension source at snapshot time.
