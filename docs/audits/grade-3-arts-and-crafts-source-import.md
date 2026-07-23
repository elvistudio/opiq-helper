# Grade 3 arts-and-crafts source import audit

## Result

The immutable grade-3 capture contains 178 source rows across kits 196 and 200. The canonical `grade-3-arts-and-crafts` route contains the **89** ordinary-curriculum pages of kit 196. The **85** kit 200 instructional pages are byte-stable content equivalents of the supplementary source already owned by `grade-2-arts-and-crafts`; they are audited but not duplicated.

This is a supplied-source catalogue result, not proof of official-curriculum completeness or complete current live Opiq catalogue coverage.

## Archive identity

| SHA-256 | Bytes | Uncompressed bytes | Members | Capture |
| --- | ---: | ---: | ---: | --- |
| `8f4ef248fd74db31d3239b793644c9e2e97404d080d22d8fa75b1e22bd637997` | 592932 | 552718 | 185 | 2026-07-23T07:15:58.130Z |

Every member passes central-directory, local/central filename, size, CRC-32, safe-path, and stored-compression checks. The archive is committed byte-for-byte unchanged.

## Filename encoding

All 185 members omit the ZIP UTF-8 flag. 180 non-ASCII stored names are recovered by the reversible transformation **CP437 display → original bytes → strict UTF-8**, while 5 names are ASCII-only. All names round-trip, map unambiguously to the two Source Book IDs where applicable, and produce zero decoded-name collisions. The ZIP itself is never rewritten.

## Complete source accounting

| Category | Count |
| --- | ---: |
| Kit 196 instructional pages | 89 |
| Kit 200 already-owned shared supplementary pages | 85 |
| Unique Kit Details | 2 |
| Duplicate Kit Details aliases | 2 |
| **Total source rows** | **178** |

There are no Impressum, search-result, or other administrative rows. Both Kit Details pairs are content-equivalent and differ only by synthetic chapter ID: kit 196 uses 88/178; kit 200 uses 1/87.

## Book and route decisions

| Kit | Source Book ID | Canonical Book ID | Canonical title | Pages | Type | Owner |
| ---: | --- | --- | --- | ---: | --- | --- |
| 196 | `kunsti-_ja_tööõpetus._3._osa` | `kunsti-_ja_tööõpetus._3._osa__kit196` | Kunsti- ja tööõpetus. 3. osa | 89 | ordinary | `grade-3-arts-and-crafts` |
| 200 | `kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid` | same | Kunsti- ja tööõpetus. 4. osa. Tähtpäevakaardid | 85 | supplementary | `grade-2-arts-and-crafts` |

Publisher metadata is empty in index, raw-book, and compact records, so no publisher is invented.

## Kit 200 cross-grade comparison

The current grade-2 archive, the new grade-3 archive, the grade-2 canonical Markdown, and both raw representations were compared for every instructional page:

- 85/85 direct URL, kit, chapter ID, Source Book ID, title, heading, topic, task, language, subject, publisher, and ordering matches;
- 85/85 raw chapter-title, heading, task, keyword, image-reference, and image-hash matches;
- compact records differ only in automatic export grade (2 versus 3);
- raw chapters differ only in capture timestamp;
- the grade-2 route owns all 85 pages as `supplementary`;
- zero URLs are lost and zero URLs are duplicated across canonical routes.

The capture grade is not intrinsic evidence that this shared card collection belongs specifically to grade 3. Existing grade-2 ownership therefore remains authoritative.

## Metadata normalization

All 178 compact rows carry the erroneous automatic subject `mathematics / matemaatika / математика`. The kit 196 canonical pages are normalized to `arts and crafts / kunst ja tööõpetus / трудовое обучение и искусство` using Source Book ID, kit identity, complete craft chapter sequence, headings, and image evidence. Mathematics topic aliases are removed; genuine mathematical vocabulary would be retained.

Both compact indexes and every page record say `et`, while both raw book objects say `ru`. Canonical language is `et`; the raw-book anomaly remains explicit in QA. The sole discretionary soft hyphen occurs in kit 200 identity metadata and is removed only from the canonical Source Book ID. Educational prose is unchanged.

## Content quality and limitations

All 174 instructional records have headings and direct URLs. The raw archive contains **491** image references: 364 for kit 196 and 127 for kit 200. No zero-width, replacement, control, malformed-Unicode, NFC, HTML, MathML, raw-JSON, media-player-control, malformed-URL, or Markdown damage was found. No chapter-content repair was required.

Six short single-word titles (`Puu`, `Pits`, `Kask`, `Muna`, `Kala`, and `Pall`) are identical in compact titles and raw headings and are classified as valid named visual activities, not truncation. No single-character heading, suspiciously truncated heading, or anomalous spacing/punctuation case remains unclassified.

All 174 compact and raw task arrays are empty. These image-heavy pages still describe practical craft activities, but the capture does not contain structured step-by-step task text. No instruction is reconstructed from filenames or images. A future **targeted task-body capture** may help lesson authoring; a full recapture is not required for canonical routing.

## Repeated titles

Title equality is not used for deduplication. These distinct URLs are retained:

- `Liblikas`: [https://www.opiq.ee/kit/196/chapter/11215](https://www.opiq.ee/kit/196/chapter/11215), [https://www.opiq.ee/kit/196/chapter/11244](https://www.opiq.ee/kit/196/chapter/11244).
- `Pop-up-tehnikas kaart`: [https://www.opiq.ee/kit/200/chapter/11399](https://www.opiq.ee/kit/200/chapter/11399), [https://www.opiq.ee/kit/200/chapter/11429](https://www.opiq.ee/kit/200/chapter/11429).
- `Volditud lill`: [https://www.opiq.ee/kit/200/chapter/11445](https://www.opiq.ee/kit/200/chapter/11445), [https://www.opiq.ee/kit/200/chapter/11446](https://www.opiq.ee/kit/200/chapter/11446).

## Ownership and completeness boundaries

Kit 196 has no URL overlap with another canonical route. Kit 200 has exactly one owner, `grade-2-arts-and-crafts`. Grade-2 pages are not used as substitutes for kit 196. The resulting route is searchable source evidence only; it is not a curriculum map and does not establish live-catalogue completeness.
