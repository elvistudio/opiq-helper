# Grade 2 arts-and-crafts source audit

## Decision

The archive `opiq_2klass_kasitootuba_opiq_v2.zip` is registered as the canonical `grade-2-arts-and-crafts` route. Its SHA-256 is `5de5260ab8b1973a4d5132dd248ec8198cf3062f9084f369442d9cf61ed110eb`. The archive contains 269 records: six repeated kit-detail records and 263 chapter-level instructional records. All 263 canonical Opiq URLs are unique, and none occurs in another manifest route at the time of this audit.

| Canonical Book ID | Canonical title | Kit | Language | Pages | Programme decision |
| --- | --- | ---: | --- | ---: | --- |
| `kunsti-_ja_tööõpetus._2._osa` | Kunsti- ja tööõpetus. 2. osa | 192 | et | 89 | ordinary curriculum |
| `kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid` | Kunsti- ja tööõpetus. 4. osa. Tähtpäevakaardid | 200 | et | 85 | supplementary; label explicitly |
| `трудовое_обучение_и_искусство._2_часть` | Трудовое обучение и искусство. 2 часть | 371 | ru | 89 | ordinary curriculum |

The specific canonical titles are derived from the explicit source Book IDs and kit identities. The generic source display titles (`Käsitöötuba – Opiq` and `Творческая мастерская – Opiq`) remain recorded in the QA normalization audit. The source archive does not provide publisher names, so none is inferred.

## Metadata corrections

The exporter assigned 268 source records to mathematics and one to science. The instructional content, explicit Book IDs, and kits identify this collection as arts and crafts. The generator therefore normalizes the canonical subject to `arts and crafts / kunst ja tööõpetus / трудовое обучение и искусство` while retaining page titles, chapter IDs, headings, tasks, languages, and URLs.

The second Estonian Book ID contains U+00AD, an invisible discretionary soft hyphen. The canonical ID removes only that character. In addition, the raw per-book JSON files incorrectly identify both Estonian books as Russian. The archive's compact index and every corresponding page record consistently identify those books as Estonian, so the record-level `Language` field is authoritative. This disagreement remains documented in the QA snapshot rather than being hidden.

## Duplicate and consistency audit

The archive has three duplicate URL groups, one for each `/Kit/Details/{kit}` page. Each occurs twice and is excluded because it is a cover/detail page, not a chapter-level instructional page. No chapter URL is duplicated. Repeated human-readable page titles are retained when their chapter URLs or instructional contexts differ; title equality alone is not sufficient evidence that two learning pages are duplicates.

All 263 included pages have at least one heading and a direct canonical Opiq URL. The archive provides no structured task examples, so the empty task fields are preserved rather than fabricated. Generation asserts the source and canonical counts, exact kit membership, per-book language, per-book page count, unique canonical URLs, canonical subject, and stable book titles.

## Scope and limitations

Kit 200 is a holiday-card collection and is marked `supplementary`; it must not be presented as the ordinary core without explicit labelling. The route provides searchable source evidence for grade 2 arts-and-crafts requests, but it is not a curriculum map and does not prove complete official-programme coverage. No adjacent grade or subject source was added.
