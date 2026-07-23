# Grade 3 Estonian source import audit

## Result

Two original Opiq captures produce two strictly separated canonical subjects: **405** first-language Estonian pages and **54** Estonian-as-a-second-language pages. Their **459** direct chapter URLs are disjoint. This is a source-catalogue boundary, not proof of official curriculum completeness or of the complete current live Opiq catalogue.

## Immutable archive identities

| Role | Archive | SHA-256 | Bytes | Members | Uncompressed bytes | Capture |
| --- | --- | --- | ---: | ---: | ---: | --- |
| shared four-book capture | `project-files/inputs/final-zips/opiq_3klass_ilus_emakeel_opiq_v2.zip` | `76745111aa9ac75736418d6a3cb2958c0541182192522d71100a2140716972c7` | 2272881 | 435 | 2191071 | 2026-07-22T22:19:43.868Z |
| complete kit 590 capture | `project-files/inputs/final-zips/opiq_3klass_mina_loen_ja_kirjutan_3_opiq_v2.zip` | `53a62c9adf43af838132fa6cf7ec8901ea0a1e263f8df6c05dedc70307ca9fbc` | 213541 | 50 | 204791 | 2026-07-23T07:29:00.718Z |

Both archives pass central-directory, safe-path, unique-member, compression-method, stored/uncompressed-size, CRC-32, JSON/JSONL, compact/raw, and topic-map validation. Neither archive is rewritten or recompressed.

## Source accounting

| Category | Count |
| --- | ---: |
| Shared archive rows | 426 |
| Complete kit 590 archive rows | 44 |
| **Combined source rows** | **470** |
| First-language instructional pages | 405 |
| Second-language instructional pages | 54 |
| Unique Kit Details excluded | 4 |
| Duplicate/alias Kit Details rows excluded | 6 |
| Administrative Impressum excluded | 1 |
| **Canonical instructional pages** | **459** |

Every source row is classified. The four detail URLs belong to kits 135, 140, 179, and 590. Kit 590 has four detail rows across the two captures: one unique non-instructional URL and three content-equivalent aliases. No conflicting instructional duplicate exists, and no Kit Details or Impressum URL is canonical.

## Canonical route and book inventory

| Kit | Source Book ID | Canonical Book ID | Title | Canonical route | Combined rows | Pages |
| ---: | --- | --- | --- | --- | ---: | ---: | --- |
| 135 | `3._klassi_eesti_keel` | `3._klassi_eesti_keel__kit135` | ILUS EMAKEEL | `grade-3-estonian` | 187 | 185 |
| 140 | `eesti_keel_teise_keelena_3._klassile` | `eesti_keel_teise_keelena_3._klassile__kit140` | KOOS ON VAHVA. Sõprade seiklused | `grade-3-estonian-second-language` | 56 | 54 |
| 179 | `eesti_keele_õpik_3._klassile` | `eesti_keele_õpik_3._klassile__kit179` | Eesti keele õpik 3. klassile | `grade-3-estonian` | 181 | 178 |
| 590 | `mina_loen_ja_kirjutan_3` | `mina_loen_ja_kirjutan_3__kit590` | Mina loen ja kirjutan 3 | `grade-3-estonian` | 46 | 42 |

The first-language route allows only kits 135, 179, and 590 and forbids kit 140. The second-language route allows only kit 140 and forbids kits 135, 179, and 590. All four books use Estonian page text, so subject routing follows Source Book ID, kit identity, Kit Details title, complete book identity, chapter context, and captured source-filter evidence rather than language alone.

Publisher metadata is absent and is not invented.

## Kit 590 completion

The shared capture supplies two cover/detail rows and no kit 590 chapters. The dedicated capture supplies two more detail rows and **42 unique instructional chapters**, distributed by section as **2 / 12 / 12 / 15 / 1**. The dedicated capture is the sole canonical page-level source; shared cover evidence remains in QA without duplicating the detail URL.

Kit 590 is no longer cover-only. A full recapture is not required. A future task-body-only capture is optional if exact image-based exercises are needed.

## Grade and subject normalization

Kits 135 and 179 are exported as grade 2. Their Kit Details titles, Source Book IDs, kit identities, visible book titles, and chapter context identify grade 3, so their **363** instructional pages are normalized to grade 3. Kits 140 and 590 already report grade 3. Raw and canonical distributions and every decision remain in QA.

All **470** source rows carry the automatic subject `mathematics / matemaatika / математика`. First-language pages are normalized to `Estonian language / eesti keel / эстонский язык`; kit 140 is normalized to `Estonian as a second language / eesti keel teise keelena / эстонский язык как второй`. Generated mathematics aliases are removed from topic arrays while genuine instructional terms are retained.

## Language decisions

The shared compact distribution is et 424, en 1, ru 1; all 44 dedicated kit 590 compact rows are et. The two isolated shared anomalies are normalized from page evidence:

- https://www.opiq.ee/kit/135/chapter/7352 — raw `en`; title and every captured heading are Estonian, with no English instructional text.
- https://www.opiq.ee/kit/140/chapter/7788 — raw `ru`; the page is Estonian-language instruction with one retained Russian vocabulary gloss, `tigu – улитка`.

Raw per-book JSON says `ru` for all books, including kit 590, while both compact indexes and all 42 kit 590 instructional rows say `et`. The conflict is retained as a source anomaly; canonical page language follows the compact and page-level Estonian evidence.

## Technical content repairs

23 pages receive deterministic text-only normalization supported by the same archive record. Repair categories: discretionary_soft_hyphen_removed=9, invisible_spacing_control_removed=14, same_record_heading_alignment=1. The generator removes discretionary soft hyphens, replaces zero-width spacing controls with spaces, applies NFC, and collapses whitespace. It does not rewrite educational prose or invent headings or tasks. Exact URLs, fields, source values, and canonical values are stored in the QA snapshots.

Every canonical page has a title and at least one heading. **927** raw kit 590 platform-boilerplate occurrences (`Õpetaja lisatud materjal`, `Minu lisatud materjal`, `Seotud sisu`) are filtered deterministically; numbered instructional headings are retained even when short.

All **459** pages lack structured task examples in the supplied compact and raw representations. Kit 590 is image-heavy and preserves numbered instructional headings; empty task arrays are therefore a capture limitation, not proof that no exercises exist. No task body is invented.

The title `KORDAMINE` occurs on three distinct kit 590 URLs and is retained because chapter IDs and section contexts differ:

- https://www.opiq.ee/kit/590/chapter/33265
- https://www.opiq.ee/kit/590/chapter/33277
- https://www.opiq.ee/kit/590/chapter/33293

## Limitations

- The captures prove the supplied book/page inventory, not live Opiq catalogue completeness.
- They do not establish official curriculum completeness or teaching readiness.
- Publisher metadata is absent.
- Structured task examples are absent; a targeted capture is optional only when exact task bodies are required.
