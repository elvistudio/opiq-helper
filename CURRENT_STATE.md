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

The current extension exports the legacy raw archive format:

- `Opiq-DB/index.json`
- `Opiq-DB/books/<bookId>.json`
- `Opiq-DB/chapters/<bookId>/<chapterId>.json`

This is the format used by the current source archives.

## Notes For Next Version

The next extension version should export compact v2 lookup files directly:

- `opiq_lookup.md`
- `opiq_lookup.jsonl`
- `topic_map.json`
- `index.json`

The compact v2 format should keep multilingual topic fields separate:

- `topics_et`: Estonian-only topics
- `topics_ru`: Russian-only topics
- `topics_en`: English-only topics

It should also keep full cleaned headings for every page and avoid exporting image URLs, repeated Opiq UI text, empty task text, and other noisy content.

## Security Check

No obvious API keys, GitHub tokens, bearer tokens, passwords, or client secrets were found in the extension source at snapshot time.
