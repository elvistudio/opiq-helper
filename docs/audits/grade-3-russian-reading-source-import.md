# Grade 3 Russian-reading source import audit

## Result

The archive contains one grade-3 Russian reading book, not mathematics and not a translation of another subject. The dedicated canonical route `grade-3-russian-reading` contains **55 instructional pages** from Kit 504. It remains separate from the grammar-oriented `grade-3-russian` route and from mathematics.

- archive: `project-files/inputs/final-zips/opiq_3klass_3_acca_opiq_v2.zip`
- SHA-256: `3e1fbd8a209ca151111b0754811c293b9f6bbc796965d2db542cbd02fe13dcca`
- size: 369819 bytes
- ZIP members: 63
- capture: 2026-07-23T06:08:40.176Z
- format: 2.0
- publisher: not captured; not invented

This source index is not an official curriculum map and is not proof of complete current live Opiq coverage.

## Source accounting

| Category | Count |
| --- | ---: |
| Canonical instructional chapters | 55 |
| Unique Kit Details | 1 |
| Duplicate Kit Details alias | 1 |
| Administrative, search, malformed, wrong-grade, or unrelated rows | 0 |
| Total | 57 |

Every source row is classified. The sole duplicate URL is the repeated Kit Details page `https://www.opiq.ee/Kit/Details/504`; the two rows differ only by synthetic chapter ID and neither is instructional.

## Book and subject decision

| Kit | Canonical Book ID | Source Book ID | Canonical title | Language | Programme | Pages |
| ---: | --- | --- | --- | --- | --- | ---: |
| 504 | `русское_слово._чтение_для_3_класса__kit504` | `русское_слово._чтение_для_3_клacca` | РУССКОЕ СЛОВО. Чтение для 3 класса | ru | ordinary_curriculum | 55 |

The Source Book ID, Kit Details title, and the complete 55-chapter sequence consist of Russian literary texts, discussion headings, and assignments. That evidence supports the source-specific subject `Russian reading / vene keele lugemine / чтение на русском языке`. The automatic `mathematics / matemaatika / математика` label is replaced, and generated mathematics topic aliases are removed.

The archive does not expose a reliable Opiq subject-filter label. The separate reading route therefore describes the captured source type; it does not claim that Russian reading is independently allocated as an official exact-grade subject.

## Metadata and technical repairs

- Raw grade 3 and language `ru` are retained for all instructional pages.
- The mixed Latin-lookalike spelling `клacca` is deterministically repaired to `класса` in the canonical book title and Book ID; the raw Source Book ID and raw title remain in QA.
- Publisher stays blank because no archive representation provides one.
- One zero-width character is removed from a decorative heading on [chapter 27675](https://www.opiq.ee/kit/504/chapter/27675).
- Every canonical subject/book/topic transformation is recorded by URL with raw and canonical field hashes.

No educational prose, chapter title, literary heading, translation, task, or explanation is invented.

## Quality and limitations

Post-repair hard errors: **0**.

- All 55 compact records lack structured task examples, although many pages expose a `Задания` heading. This is a capture limitation, not proof that the pages have no exercises.
- 12 compact summaries are short but retain a valid title and headings:
  - [ИВАН БУНИН. Листопад](https://www.opiq.ee/kit/504/chapter/27658)
  - [АПОЛЛОН МАЙКОВ. Осень](https://www.opiq.ee/kit/504/chapter/27659)
  - [МИХАИЛ ПРИШВИН. Листопад](https://www.opiq.ee/kit/504/chapter/27662)
  - [ИРИНА ПИВОВАРОВА. Сочинение](https://www.opiq.ee/kit/504/chapter/27668)
  - [ЮННА МОРИЦ. Сто фантазий](https://www.opiq.ee/kit/504/chapter/27671)
  - [ТАТЬЯНА ПОНОМАРЁВА. Автобус](https://www.opiq.ee/kit/504/chapter/27673)
  - [САША ЧЁРНЫЙ. Снежная баба](https://www.opiq.ee/kit/504/chapter/27685)
  - [Весна, весна красная!](https://www.opiq.ee/kit/504/chapter/27701)
  - [ФЁДОР ТЮТЧЕВ. Весенняя гроза](https://www.opiq.ee/kit/504/chapter/27703)
  - [НИКОЛАЙ СЛАДКОВ. Родник](https://www.opiq.ee/kit/504/chapter/27709)
  - [ВИКТОР АСТАФЬЕВ. Капалуха](https://www.opiq.ee/kit/504/chapter/27710)
  - [САША ЧЁРНЫЙ. Мамина песня](https://www.opiq.ee/kit/504/chapter/27712)
- Repeated-title groups: 0; mixed-script page-title/heading observations after repair: 0.
- The generated topic token `рный` loses the beginning of `ЧЁРНЫЙ` on 3 records; the correct author name remains intact in title and heading, so no topic text is guessed:
  - [САША ЧЁРНЫЙ. Снежная баба](https://www.opiq.ee/kit/504/chapter/27685)
  - [САША ЧЁРНЫЙ. Невероятная история](https://www.opiq.ee/kit/504/chapter/27706)
  - [САША ЧЁРНЫЙ. Мамина песня](https://www.opiq.ee/kit/504/chapter/27712)

No additional Opiq recapture is required for canonical routing. A future targeted capture of task bodies may be useful only when those exact exercises are needed for lesson authoring; a full recapture is not justified.
