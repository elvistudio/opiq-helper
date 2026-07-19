# Grade 1 Estonian subject-separation audit

## Problem

The canonical first-language route previously ended with 26 records (records 497–522) from book ID `1k_eesti_teise_keelena_avita_est`, Opiq kit 537, book `TÄHT A`. The identifier alone was not treated as sufficient evidence. This audit compares every affected Markdown record with the repository archives and classifies the content using book metadata, kit identity, chapter metadata, language signals, headings, and the character of the exercises.

This audit separates `eesti keel` from `eesti keel teise keelena`; it does not establish curriculum completeness or pedagogical readiness.

## Repository evidence used

- `project-files/outputs/opiq_1klass_eesti_keel.md`: the 26 canonical records before separation.
- `project-files/outputs/opiq_1klass_eesti_teise_keelena.md`: exact-URL comparison against the second-language route.
- `project-files/inputs/final-zips/opiq_1klass_eesti_keel.zip`: compact lookup, archive indexes, raw book metadata, and raw chapters for kit 537.
- `project-files/inputs/final-zips/opiq_eesti_teise_keelena.zip`: compact lookup and archive metadata for the registered second-language source.
- `source-manifest.json` and the two registered QA snapshots: route and provenance boundaries.

## Evidence and classification rules

The following evidence was considered together rather than relying on a substring in `book_id`:

- **E1 — source identity:** all 26 records map exactly to kit 537 and book ID `1k_eesti_teise_keelena_avita_est`, title `TÄHT A`, publisher Avita. The raw per-book metadata records language `ru`, while both archive indexes record `et`; the raw book subject is empty and the compact lookup's automatic subject is incorrectly `matemaatika`. These conflicts make the automatic subject and isolated language values unsuitable as sole classifiers.
- **E2 — exercise character:** the 25 instructional chapters form one ordered beginner sequence: letters, sound segmentation, picture-to-word matching, short-word construction, reading, repetition, and simple question/answer activities. Together with E1, this supports `eesti keel teise keelena`, not the first-language route.
- **E3 — provenance boundary:** `opiq_eesti_teise_keelena.zip`, the single archive registered for the second-language route, contains only book IDs `1k_eesti_keel_esiopetus_avita_est` and `1k_eesti_keel_esiopetus_tooraamat_avita_est`, kits 554 and 538. It contains neither kit 537 nor any of the 26 exact URLs. Moving kit 537 into that route under the current one-archive QA schema would misstate provenance.
- **E4 — administrative content:** a page with no instructional task and only the heading `Impressum` is not a canonical learning record.

Decisions were applied as follows:

- `move_to_second_language`: content is second-language and the target route can represent its provenance truthfully.
- `exclude_from_canonical_indexes`: the page is administrative, or it belongs to the second-language subject but cannot be added to the registered target route without false provenance.
- `keep_in_first_language`: strong source and content evidence confirms first-language Estonian despite the conflicting identifier.

Language values in the table are shown as `canonical Markdown / compact lookup / raw book`. The raw book value is `ru` for the entire book; the canonical record value is `et` for all 26 pages. Compact page values of `en` are detector noise in otherwise Estonian headings and do not change the decision.

## Record-by-record decisions

| Original record | URL | Chapter ID | Title | Language | Decision | Evidence | Final route or exclusion reason |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 497 | https://www.opiq.ee/kit/537/chapter/29760 | 1.1 | TÄHT A | et / et / ru | `exclude_from_canonical_indexes` | E1–E3; headings require writing, typing, sound segmentation, and finding A in picture words. | Second-language content; excluded until kit 537 can be registered with truthful multi-archive provenance. |
| 498 | https://www.opiq.ee/kit/537/chapter/29769 | 1.10 | TÄHT K | et / et / ru | `exclude_from_canonical_indexes` | E1–E3; learners type `KOKK`, order letters, read words, answer `Kes? Mis?`, and solve a crossword. | Second-language content; excluded pending truthful provenance support. |
| 499 | https://www.opiq.ee/kit/537/chapter/29770 | 1.11 | TÄHT P | et / et / ru | `exclude_from_canonical_indexes` | E1–E3; the page types `LIPP` and practises matching letters, words, and pictures. | Second-language content; excluded pending truthful provenance support. |
| 500 | https://www.opiq.ee/kit/537/chapter/29771 | 1.12 | TÄHT T | et / et / ru | `exclude_from_canonical_indexes` | E1–E3; the page types `POTT` and drills letters and words through beginner exercises. | Second-language content; excluded pending truthful provenance support. |
| 501 | https://www.opiq.ee/kit/537/chapter/29772 | 1.13 | TÄHT D | et / et / ru | `exclude_from_canonical_indexes` | E1–E3; the page types `AED` and builds words from letters. | Second-language content; excluded pending truthful provenance support. |
| 502 | https://www.opiq.ee/kit/537/chapter/29773 | 1.14 | TÄHT B | et / en / ru | `exclude_from_canonical_indexes` | E1–E3; the page types `TIBU`; the isolated `en` lookup label conflicts with Estonian headings and raw-book `ru`. | Second-language content; excluded pending truthful provenance support. |
| 503 | https://www.opiq.ee/kit/537/chapter/29774 | 1.15 | TÄHT R | et / et / ru | `exclude_from_canonical_indexes` | E1–E3; the page types `RUUT` and practises letter/word recognition. | Second-language content; excluded pending truthful provenance support. |
| 504 | https://www.opiq.ee/kit/537/chapter/29775 | 1.16 | TÄHT V | et / en / ru | `exclude_from_canonical_indexes` | E1–E3; the page types `VAAL` and explicitly practises reading words; `en` is inconsistent detector metadata. | Second-language content; excluded pending truthful provenance support. |
| 505 | https://www.opiq.ee/kit/537/chapter/29776 | 1.17 | TÄHT H | et / en / ru | `exclude_from_canonical_indexes` | E1–E3; the page types `HIIR` and drills letters and words; the headings are Estonian despite lookup `en`. | Second-language content; excluded pending truthful provenance support. |
| 506 | https://www.opiq.ee/kit/537/chapter/29777 | 1.18 | TÄHT J | et / en / ru | `exclude_from_canonical_indexes` | E1–E3; the page types `JUUNI, JUULI` and practises word reading; lookup `en` conflicts with the content. | Second-language content; excluded pending truthful provenance support. |
| 507 | https://www.opiq.ee/kit/537/chapter/29778 | 1.19 | TÄHT Õ | et / et / ru | `exclude_from_canonical_indexes` | E1–E3; the page types `ÕUN` and asks learners to identify who or what is pictured. | Second-language content; excluded pending truthful provenance support. |
| 508 | https://www.opiq.ee/kit/537/chapter/29761 | 1.2 | TÄHT O | et / et / ru | `exclude_from_canonical_indexes` | E1–E3; headings cover writing, typing O, sound segmentation, and finding O in words. | Second-language content; excluded pending truthful provenance support. |
| 509 | https://www.opiq.ee/kit/537/chapter/29779 | 1.20 | TÄHT Ä | et / et / ru | `exclude_from_canonical_indexes` | E1–E3; the page combines singing with typing `JÄÄTIS` and beginner word work. | Second-language content; excluded pending truthful provenance support. |
| 510 | https://www.opiq.ee/kit/537/chapter/29780 | 1.21 | TÄHT Ö | et / en / ru | `exclude_from_canonical_indexes` | E1–E3; the page types `VÖÖ` and constructs words; lookup `en` conflicts with Estonian content. | Second-language content; excluded pending truthful provenance support. |
| 511 | https://www.opiq.ee/kit/537/chapter/29781 | 1.22 | TÄHT Ü | et / en / ru | `exclude_from_canonical_indexes` | E1–E3; the page types `ÜKS` and relates words to letters; lookup `en` is not supported by the headings. | Second-language content; excluded pending truthful provenance support. |
| 512 | https://www.opiq.ee/kit/537/chapter/29782 | 1.23 | TÄHT G | et / et / ru | `exclude_from_canonical_indexes` | E1–E3; the page types `TIGU` and constructs words. | Second-language content; excluded pending truthful provenance support. |
| 513 | https://www.opiq.ee/kit/537/chapter/29783 | 1.24 | TÄHT F | et / en / ru | `exclude_from_canonical_indexes` | E1–E3; the page uses `FOOR` and practises reading words and sentences; lookup `en` conflicts with the content. | Second-language content; excluded pending truthful provenance support. |
| 514 | https://www.opiq.ee/kit/537/chapter/29784 | 1.25 | TÄHESTIK | et / et / ru | `exclude_from_canonical_indexes` | E1–E3; repeated tasks ask for the first letter of pictured words and consolidate the alphabet sequence. | Second-language content; excluded pending truthful provenance support. |
| 515 | https://www.opiq.ee/kit/537/chapter/29762 | 1.3 | TÄHT I | et / et / ru | `exclude_from_canonical_indexes` | E1–E3; the page introduces `AI! OI!`, writing, typing, and short-word reading. | Second-language content; excluded pending truthful provenance support. |
| 516 | https://www.opiq.ee/kit/537/chapter/29763 | 1.4 | TÄHT E | et / et / ru | `exclude_from_canonical_indexes` | E1–E3; the page introduces `EI!`, writing, and typing the word `EI`. | Second-language content; excluded pending truthful provenance support. |
| 517 | https://www.opiq.ee/kit/537/chapter/29764 | 1.5 | TÄHT S | et / et / ru | `exclude_from_canonical_indexes` | E1–E3; learners type `ISA, SASS` and segment sounds. | Second-language content; excluded pending truthful provenance support. |
| 518 | https://www.opiq.ee/kit/537/chapter/29765 | 1.6 | TÄHT U | et / et / ru | `exclude_from_canonical_indexes` | E1–E3; learners type `SUU, UUS` and segment sounds. | Second-language content; excluded pending truthful provenance support. |
| 519 | https://www.opiq.ee/kit/537/chapter/29766 | 1.7 | TÄHT L | et / et / ru | `exclude_from_canonical_indexes` | E1–E3; learners type `ALL, LILL` and find L in words. | Second-language content; excluded pending truthful provenance support. |
| 520 | https://www.opiq.ee/kit/537/chapter/29767 | 1.8 | TÄHT M | et / en / ru | `exclude_from_canonical_indexes` | E1–E3; learners type `EMA, SAMM` and segment sounds; lookup `en` conflicts with Estonian headings. | Second-language content; excluded pending truthful provenance support. |
| 521 | https://www.opiq.ee/kit/537/chapter/29768 | 1.9 | TÄHT N | et / et / ru | `exclude_from_canonical_indexes` | E1–E3; learners type `NINA`, construct words, and read them. | Second-language content; excluded pending truthful provenance support. |
| 522 | https://www.opiq.ee/kit/537/chapter/29785 | 2.1 | Impressum | et / et / ru | `exclude_from_canonical_indexes` | E1 and E4; the raw chapter has no tasks and no instructional heading beyond `Impressum`. | Administrative page; excluded independently of the subject-provenance limitation. |

## Archive provenance findings

- `opiq_1klass_eesti_keel.zip` contains 532 compact records across ten books. The disputed book contributes 27 records: one kit detail page excluded by the existing canonicalization, 25 instructional chapters, and one Impressum chapter. The archive also contains nine other books, so it is not a dedicated kit 537 archive.
- All 26 canonical URLs and chapter IDs map exactly to records in that archive. Before this change they occurred only in the first-language index, were unique within the block, and had zero exact-URL matches in the second-language index.
- `opiq_eesti_teise_keelena.zip` contains 152 compact records across two books. Its visible kits are 554 and 538. It contains zero kit 537 records, zero records with the disputed book ID, and zero exact matches for the 26 URLs.
- Archive metadata is internally inconsistent for the disputed book: the compact and raw archive indexes say language `et`, the raw per-book file says `ru`, individual compact records say `et` or `en`, and the raw subject is empty. The existing first-language QA snapshot had normalized all 26 pages to `et` and first-language subject aliases. The content and source identity, taken together, support second-language classification, but the registered second-language archive cannot support their provenance.
- The two existing second-language archive books, their 152 source records, and their two cover/detail exclusions agree with the registered second-language QA snapshot. Kit 537 is not one of those books.

## Outcome

| Outcome | Count |
| --- | ---: |
| Retained in first-language | 0 |
| Moved to second-language | 0 |
| Excluded from canonical indexes | 26 |

Of the 26 exclusions, 25 are instructional second-language pages withheld because the current manifest and QA schema register only the separate second-language archive; one is the administrative Impressum page. No target URL remains in either canonical index, and no URL is duplicated across the two routes.

The first-language route is protected by a machine-readable forbidden-book declaration checked in CI. The second-language route documents kit 537 as an audited provenance gap rather than claiming those pages came from its archive.

## Limitations

- The audit uses only evidence committed in the repository; it does not rely on a live Opiq page or external curriculum documents.
- Conflicting language and empty subject metadata limit what any single metadata field can prove.
- Exclusion avoids false provenance but leaves 25 relevant second-language pages unavailable through the canonical indexes until multi-archive provenance is supported or kit 537 is supplied as a separately registered source.
- This subject-separation decision does not prove complete curriculum coverage, teaching quality, or suitability for a particular lesson.
