# Opiq Export Format v2

Use this format in the Chrome extension so future exports are compact, multilingual, and fast for ChatGPT Project retrieval.

## Archive Contents

Each exported archive should contain:

- `index.json`
- `opiq_lookup.md`
- `opiq_lookup.jsonl`
- `topic_map.json`

## `index.json`

```json
{
  "formatVersion": "2.0",
  "generatedAt": "2026-06-12T00:00:00.000Z",
  "source": "chrome-extension",
  "recordCount": 123,
  "supportedQueryLanguages": ["et", "ru", "en"],
  "files": ["opiq_lookup.md", "opiq_lookup.jsonl", "topic_map.json", "index.json"]
}
```

## Lookup Record Schema

Write one JSON object per Opiq page to `opiq_lookup.jsonl`.

```json
{
  "title": "Korrutamine ja jagamine arvuga 2 ja arvuga 4",
  "url": "https://www.opiq.ee/kit/54/chapter/2690",
  "book": "Arvutamise algus",
  "book_id": "3k_matem_avita_2_est",
  "chapter_id": "3.5",
  "grade": 3,
  "subject_et": "matemaatika",
  "subject_ru": "математика",
  "subject_en": "mathematics",
  "language": "et",
  "publisher": "Avita",
  "topics_et": ["matemaatika", "korrutamine", "jagamine"],
  "topics_ru": ["математика", "умножение", "деление"],
  "topics_en": ["mathematics", "multiplication", "division"],
  "headings": ["Korrutamine ja jagamine arvuga 4", "Arvude 2 ja 4 korrutised"],
  "task_examples": ["Arvuta ja vali, kas väide on õige."]
}
```

## Cleaning Rules

Remove these before export:

- image URLs
- duplicate headings
- empty task texts
- repeated Opiq UI labels
- `Õpetaja lisatud materjal`
- `Minu lisatud materjal`
- `Seotud sisu`
- answer-checking UI text such as `Kontrolli vastust`, `Näita õiget vastust`, `Õigesti vastatud`, `Valesti vastatud`

Keep:

- title
- Opiq URL
- book metadata
- grade/class
- subject
- language
- publisher
- cleaned headings
- cleaned original keywords
- short useful task examples
- multilingual topic aliases

## Multilingual Topic Aliases

The extension should add aliases in all supported languages. For example, if any page contains `korrutamine`, `умножение`, or `multiplication`, add:

```json
{
  "topics_et": ["korrutamine", "korruta", "korrutis"],
  "topics_ru": ["умножение", "умножь", "произведение"],
  "topics_en": ["multiplication", "multiply", "product"]
}
```

Do the same for common curriculum themes:

- addition: `liitmine`, `сложение`, `addition`
- subtraction: `lahutamine`, `вычитание`, `subtraction`
- multiplication: `korrutamine`, `умножение`, `multiplication`
- division: `jagamine`, `деление`, `division`
- numbers: `arvud`, `числа`, `numbers`
- comparison: `võrdlemine`, `сравнение`, `comparison`
- geometry: `geomeetria`, `геометрия`, `geometry`
- measurement: `mõõtmine`, `измерение`, `measurement`
- time: `aeg`, `время`, `time`
- money: `raha`, `деньги`, `money`
- nature/science: `loodusõpetus`, `природоведение`, `science`
- plants: `taimed`, `растения`, `plants`
- animals: `loomad`, `животные`, `animals`
- seasons: `aastaajad`, `времена года`, `seasons`
- water safety: `veeohutus`, `безопасность на воде`, `water safety`

## ChatGPT Project Instructions

Add this to the project:

```text
When the user asks for Opiq links by theme, search the uploaded Opiq lookup files.

The lookup supports Estonian, Russian, and English queries.
Match the user's theme against title, Topics ET, Topics RU, Topics EN, headings, book title, and subject.

If the user writes in Estonian, prefer Estonian-language pages.
If the user writes in Russian, prefer Russian-language pages.
If the user writes in English, return the best matching pages and mention the page language.

If the user explicitly asks for a language, obey that language preference.
If no matching page exists in the requested language, return the closest match in another language and clearly label it.

Prioritize exact topic/title matches, then synonym matches, then heading matches.
Return 5-10 relevant links with title, URL, class, subject, language, and a short match reason.
```
