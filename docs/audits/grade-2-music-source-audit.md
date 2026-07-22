# Grade 2 music source audit

## Decision

The archive `opiq_2klass_muusikamaa_opiq_v2.zip` is registered as the canonical `grade-2-music` route. Its SHA-256 is `f165c57ec815a9f2b526d63557ee9c3c6f33bb66ab61bc5d2fc161d533408597`. The archive contains 329 records. Ten repeated kit-detail records and two `Impressum` pages are excluded, leaving 317 chapter-level instructional records. Every canonical Opiq URL is unique, and none occurs in another manifest route at the time of this audit.

| Canonical Book ID | Canonical title | Kit | Language | Pages | Programme decision |
| --- | --- | ---: | --- | ---: | --- |
| `2._klassi_muusikaõpetus` | Muusikamaa | 188 | et | 116 | ordinary curriculum |
| `eesti_pärimusmuusika_keskuse_õppevideod` | Eesti Pärimusmuusika Keskuse õppevideod | 465 | et | 33 | supplementary; label explicitly |
| `muusikaõpik_2._klassile` | Muusikaõpik 2. klassile | 193 | et | 29 | ordinary curriculum |
| `muusikaõpik_2._klassile_2024` | Muusikaõpik 2. klassile 2024 | 556 | et | 28 | ordinary curriculum |
| `музыка_–_волшебная_страна._2_класс` | Музыка – волшебная страна. 2 класс | 238 | ru | 111 | ordinary curriculum |

The canonical titles are the source display titles with only the `– Opiq` service suffix removed. The archive supplies no publisher names, so none is inferred.

## Metadata corrections

The exporter assigned all 329 source records to mathematics. The explicit book identities, kits, titles, headings, and tasks identify this collection as music. The generator therefore normalizes the canonical subject to `music / muusika / музыка`, while preserving every instructional page title, chapter ID, heading, task, language, and URL.

Two source Book IDs contain U+00AD discretionary soft hyphens. Canonical IDs remove only those invisible formatting characters. The original identifiers remain visible in the QA normalization audit.

## Duplicate and edition-overlap audit

The five duplicate source URL groups are repeated `/Kit/Details/{kit}` records. Both records in each group are excluded because they are cover/detail pages, not instructional chapters. No canonical chapter URL is duplicated.

After service-record exclusions, 31 title groups occur more than once across 65 instructional records. Thirty groups cross books or editions; one title (`Päkapikk`) occurs in two distinct chapters of kit 238. These records are not collapsed: equal titles do not prove equal content, and the URLs, chapter identities, headings, tasks, language, or edition context differ. The two `Muusikaõpik 2. klassile` editions remain separately identifiable through kits 193 and 556.

All 317 included pages have headings and direct canonical Opiq URLs; 192 source records include structured task examples before service-record exclusions. Generation asserts source and canonical counts, exact kit membership, per-book language and page counts, unique URLs, subject normalization, programme type, and stable titles.

## Scope and limitations

The Eesti Pärimusmuusika Keskuse video collection is marked `supplementary`; it must not be presented as the ordinary core without explicit labelling. The route provides searchable source evidence for grade 2 music requests, but it is not a curriculum map and does not prove complete official-programme coverage. No adjacent-grade or neighbouring-subject source was added.
