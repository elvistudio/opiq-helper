# Grade 3 music source import audit

## Result

The original archive is registered as the dedicated canonical `grade-3-music` route. It contains **315 source rows** and **305 instructional pages** across three Estonian and one Russian ordinary-curriculum book/kit variants.

- archive: `project-files/inputs/final-zips/opiq_3klass_muusikamaa_opiq_v2.zip`
- SHA-256: `03968d5ab0b931dafc0431f17fac146eaead6be6de0629f6fe7f163a2f67aa70`
- size: 1543267 bytes
- ZIP members: 324; all use stored compression and pass CRC/size checks
- capture: 2026-07-23T09:30:34.058Z
- languages: 183 Estonian and 122 Russian instructional pages
- publisher: absent for all four variants; not invented

This is a source catalogue, not a verified curriculum map and not proof of the complete current live Opiq catalogue.

## Complete source accounting

| Category | Count |
| --- | ---: |
| Canonical instructional chapters | 305 |
| Unique Kit Details | 4 |
| Duplicate Kit Details aliases | 4 |
| Impressum | 2 |
| Total | 315 |

All four exact duplicate URL groups are Kit Details pairs. Each pair has identical title, URL, book, Source Book ID, grade, subject, language, headings, and tasks; only its synthetic chapter ID differs. Both the first detail row and its repeated alias are excluded. The two explicit Impressum URLs are also excluded.

## Books and kits

| Kit | Canonical Book ID | Source Book ID | Canonical title | Language | Pages |
| ---: | --- | --- | --- | --- | ---: |
| 195 | `muusikamaa__kit195` | `muusikamaa` | Muusikamaa | et | 121 |
| 163 | `muusikaõpik_3._klassile__kit163` | `muusikaõpik_3._klassile` | Muusikaõpik 3. klassile | et | 31 |
| 592 | `muusikaõpik_3._klassile_2025__kit592` | `muusikaõpik_3._klassile_2025` | Muusikaõpik 3. klassile 2025 | et | 31 |
| 239 | `музыка_–_волшебная_страна._3_класс__kit239` | `музыка_–_волшебная_страна._3_класс` | Музыка – волшебная страна. 3 класс | ru | 122 |

All four raw book records, all 315 compact rows, every raw chapter, and every topic-map reference are accounted for. Book identity is `Source Book ID + kit`; editions and language versions are not collapsed.

## Subject, grade, and language

Every source row is automatically labelled `mathematics / matemaatika / математика`, while raw book subjects are empty. Source Book IDs, Kit Details titles, grade-3 titles, music chapter sequences, song names, notation, rhythm, melody, singing headings, and pupil music tasks jointly prove the music classification. Canonical pages therefore use `music / muusika / музыка`, and generated mathematics topic aliases are removed.

All raw records and all four books report grade 3. The three Estonian raw book objects carry an erroneous `ru` language value, while `index.json` and all 183 page rows for those books consistently report `et`. Canonical language therefore follows the compact book inventory and unanimous page-level evidence: Estonian for kits 195, 163, and 592; Russian for kit 239. The raw-book anomaly remains explicit in QA. Multilingual song titles inside a book do not change its page-language route.

## ZIP filename encoding

All 324 members omit the ZIP UTF-8 filename flag. 195 non-ASCII paths contain valid UTF-8 bytes that standard CP437 display renders as mojibake. The generator:

1. preserves the exact stored bytes and CP437 display in QA;
2. re-encodes the CP437 display byte-for-byte;
3. decodes those bytes as strict UTF-8;
4. requires exactly one captured Source Book ID match;
5. verifies both round trips and rejects logical-name collisions.

The ZIP is never rewritten or recompressed.

## Raw task recovery and content quality

The raw archive provides richer structured task evidence on **40 pages**: 34 raw supersets, 5 compact-missing task arrays, and 1 demonstrably truncated compact task. Every repair is linked to the same raw chapter member and recorded with source/canonical hashes. No task, song title, exercise, translation, or educational prose is invented.

The supplied missing-task expectation contains an arithmetic inconsistency: 54 + 9 + 9 + 62 equals **134**, not 136. After the 40 raw-supported repairs, **129** canonical pages remain without structured task examples:

| Kit | Remaining pages without structured task examples |
| ---: | ---: |
| 163 | 9 |
| 195 | 52 |
| 239 | 59 |
| 592 | 9 |

That is a capture limitation, not proof that a page has no activity. Post-repair hard errors: **0**. The audit also classifies 52 repeated-title groups covering 108 distinct URLs, 134 short but structurally valid compact records, and 3 source-typography observations.

## Edition boundaries

Kits 163 and 592 each contain 31 corresponding chapter IDs. Thirty pages are compact-equivalent; chapter `1.15` differs because kit 163 includes the heading `Muusika piltides` and kit 592 does not. They remain distinct editions.

Kits 195 and 239 share 22 normalized song titles but have different kits, URLs, book identities, languages, and instructional contexts. They remain distinct language editions. No page is removed by title or content hash; only canonical URL duplication can trigger duplicate review.

## Routing and recapture

No canonical URL overlaps any other manifest route, including grade-2 music, grade-3 mathematics, grade-3 Russian, and grade-3 Russian reading. There is currently no grade-3 Estonian-language route to absorb the three Estonian-language music books; language of a source does not change its subject.

No additional Opiq capture is required for canonical routing. A future **targeted task-body capture** may be useful only for selected pages when exact exercises are required for lesson authoring. The missing structured tasks do not justify a full recapture.
