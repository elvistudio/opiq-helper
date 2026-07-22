# Grade 2 youth-training source audit

## Decision

The archive `opiq_2klass_kodututarde_i_jark_2026_v2.zip` has SHA-256 `c74f484260d9e3a5504367cb89d42c456598015f3a4b40f2162b1888d8c5de5d`. It contains 155 records from four Opiq kits represented through five source Book IDs. The export is not a single grade-2 school textbook, so it is not registered as one broad route.

Two exact supplementary routes are created:

| Route | Canonical Book ID | Title | Kit | Pages | Language |
| --- | --- | --- | ---: | ---: | --- |
| `grade-2-kodututarde-training` | `kodutütarde_i_järk_(2026)` | Kodutütarde I järk (2026) | 593 | 31 | et |
| `grade-2-noorte-kotkaste-training` | `kaitseliit_noorte_kot_2_et` | Noorte Kotkaste I järk (2026) | 594 | 27 | et |

Both are labelled supplementary youth-organisation training. They must not be presented as the ordinary school curriculum, and their presence does not prove curriculum coverage.

## Source-scope exclusions

Kit 231 (`Koduõpe`) contains teaching examples explicitly titled for grades 1 through 9 and several unrelated school subjects. It cannot truthfully be routed as one grade-2 subject. Its 27 instructional pages remain available in the committed archive for a future multi-grade source design.

Kit 357 is `Kodutütarde VI järk`, a different progression level from the requested I järk. Its 24 unique instructional URLs were also exported under two Book IDs, producing 48 source records. It remains in the archive but outside both grade-2 I-järk routes.

No source was deleted or recaptured. The exclusions restrict canonical retrieval; they do not alter the original ZIP.

## Duplicate audit

The source contains 38 duplicate URL groups and 42 extra records beyond the unique URL set:

- four kit-detail URL groups account for 12 cover/detail records;
- 24 kit-357 instructional URLs were repeated under two Book IDs;
- ten kit-593 instructional URLs were repeated under two Book IDs.

For kit 593, the generator verifies that duplicate records have the same title, chapter ID, language, headings, and tasks before retaining one canonical record per URL. Kit 357 is out of scope in this import. The final Kodututred and Noorte Kotkad outputs contain 31 and 27 unique chapter URLs respectively, with no overlap between the two routes or with existing manifest routes at the time of this audit.

## Metadata corrections

The exporter labelled 146 source records as mathematics and nine as science. Canonical records are normalized to the exact organisation-specific training subject without changing titles, headings, tasks, publishers, chapter IDs, or URLs.

Three unique pages in each canonical kit contain Estonian text but were automatically labelled `en`. The committed raw book metadata identifies both books as Estonian, and the titles and headings are Estonian; canonical `Language` is therefore normalized to `et`. Kit 593 has four affected source records because one affected URL was duplicated under two source Book IDs.

Publisher `Kaitseliit` is retained directly from the archive. No Russian instructional route is claimed: Russian pages occur only inside the excluded mixed-grade `Koduõpe` kit.
