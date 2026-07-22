# Grade 2 Estonian subject-separation audit

## Source and decision

Both canonical routes are generated from the same committed original export:

`project-files/inputs/final-zips/opiq_2klass_eesti_keele_opik_2_klassile_v2.zip`

The archive contains 454 source records: 9 cover/detail records, 1 Impressum record, and 444 instructional pages. Reusing this archive is truthful provenance; the repository does not claim that a dedicated second-language archive exists.

| Canonical route | Included Source Book IDs | Books | Instructional pages |
| --- | --- | ---: | ---: |
| `grade-2-estonian` | `avita_eesti_keel_2_et`, `koolibri_ilus_emake_2_et`, `koolibri_mina_loen__2_et` | 3 | 372 |
| `grade-2-estonian-second-language` | `koolibri_koos_on_lõ_2_et` | 1 | 72 |

The two URL sets are disjoint and their union contains all 444 instructional pages. The generator rejects any overlap, missing partition record, changed count, or forbidden Book ID.

## Metadata normalization

The export automatically labels every record as mathematics. The first route normalizes the subject to `Estonian language / eesti keel / эстонский язык`; the second route normalizes it to `Estonian as a second language / eesti keel teise keelena / эстонский как второй язык`.

The `Koos on lõbus. Janno jutud` title is supported by the captured kit 129 cover. Its 72 pages are removed from first-language Estonian rather than duplicated. Automatic `emakeel` / `mother tongue` topic aliases are removed from the second-language route; page titles, URLs, headings, and tasks remain source-derived.

This routing audit establishes a catalogue boundary, not complete official-curriculum coverage.
