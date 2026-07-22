# Grade 3 Estonian source and subject-separation audit

## Result

The original shared Opiq capture `project-files/inputs/final-zips/opiq_3klass_ilus_emakeel_opiq_v2.zip` is split into two canonical subjects: **363** first-language Estonian pages and **54** Estonian-as-a-second-language pages. Their 417 direct chapter URLs are disjoint. This is a source-catalogue boundary, not proof of complete official-curriculum coverage.

Archive identity:

- SHA-256: `76745111aa9ac75736418d6a3cb2958c0541182192522d71100a2140716972c7`
- size: 2272881 bytes
- ZIP members: 435, all CRC-verified
- format: 2.0
- capture: 2026-07-22T22:19:43.868Z

## Source accounting

| Category | Count |
| --- | ---: |
| First-language instructional pages | 363 |
| Second-language instructional pages | 54 |
| Unique Kit Details excluded | 4 |
| Duplicate Kit Details aliases excluded | 4 |
| Administrative Impressum excluded | 1 |
| Total source rows | 426 |

Each duplicate pair is the same non-instructional Kit Details URL and differs only by its synthetic chapter ID. No conflicting instructional duplicate exists, and no Kit Details or Impressum URL is canonical.

## Complete kit inventory

| Kit | Source Book ID | Canonical Book ID | Title | Canonical route | Source rows | Pages | Status |
| ---: | --- | --- | --- | --- | ---: | ---: | --- |
| 135 | `3._klassi_eesti_keel` | `3._klassi_eesti_keel__kit135` | ILUS EMAKEEL | `grade-3-estonian` | 187 | 185 | ordinary curriculum |
| 140 | `eesti_keel_teise_keelena_3._klassile` | `eesti_keel_teise_keelena_3._klassile__kit140` | KOOS ON VAHVA. Sõprade seiklused | `grade-3-estonian-second-language` | 56 | 54 | ordinary curriculum |
| 179 | `eesti_keele_õpik_3._klassile` | `eesti_keele_õpik_3._klassile__kit179` | Eesti keele õpik 3. klassile | `grade-3-estonian` | 181 | 178 | ordinary curriculum |
| 590 | `mina_loen_ja_kirjutan_3` | `mina_loen_ja_kirjutan_3__kit590` | Mina loen ja kirjutan 3 | none | 2 | 0 | captured cover-only |

Publisher metadata is absent from the capture and is not invented.

## Grade and subject normalization

Kits 135 and 179 are exported as grade 2. Their Kit Details titles, Source Book IDs, kit identities, raw book titles, and chapter context all identify grade 3, so their 363 instructional pages are normalized to grade 3. Kit 140 already has grade 3. Raw and canonical grade counts and every decision remain in both QA snapshots.

All 426 source rows carry the automatic subject `mathematics / matemaatika / математика`. First-language pages are normalized to `Estonian language / eesti keel / эстонский язык`; kit 140 is normalized to `Estonian as a second language / eesti keel teise keelena / эстонский язык как второй`. Generated mathematics aliases are removed from topic arrays while genuine page-specific terms are retained.

## Language decisions

The compact source distribution is et 424, en 1, ru 1. Both anomalous instructional records are normalized to et from page-level evidence:

- https://www.opiq.ee/kit/135/chapter/7352 — raw `en`; title and every captured heading are Estonian, with no English instructional text.
- https://www.opiq.ee/kit/140/chapter/7788 — raw `ru`; the page is Estonian-language instruction with one retained Russian vocabulary gloss, `tigu – улитка`.

The archive's per-book raw JSON says `ru` for all books while the compact index says `et`. This conflict is recorded as source metadata, not silently erased; canonical page language follows the page-level evidence.

## Technical content repairs

23 pages receive deterministic text-only normalization supported by the same archive record. Repair categories: discretionary_soft_hyphen_removed=9, invisible_spacing_control_removed=14, same_record_heading_alignment=1. The generator removes discretionary soft hyphens, replaces zero-width spacing controls with spaces, applies NFC, and collapses whitespace. It does not rewrite educational prose or invent headings or tasks. Exact URLs, fields, source values, and canonical values are stored in the QA snapshots.

Every canonical page has a title and at least one heading. The capture contains no task examples in either compact or raw chapter representation, so all 417 pages carry an explicit classified warning rather than synthesized exercises.

## Cover-only limitation and targeted recapture

Kit 590, `Mina loen ja kirjutan 3`, contains only two duplicate Kit Details records and zero instructional chapters. It is recorded as captured cover-only and is not eligible for page-level evidence.

The exact remaining recapture is **only the instructional chapter pages for kit 590** (plus their normal export metadata). The other three books do not require recapture for canonical routing. A full repeat capture of the whole four-book archive is unnecessary.

## Limitations

- The source capture proves the supplied book/page inventory, not live Opiq catalogue completeness.
- It does not establish official curriculum completeness or teaching readiness.
- Publisher metadata is absent.
- Task examples are absent throughout the capture.
- Kit 590 cannot be used as an instructional source until its chapters are captured.
