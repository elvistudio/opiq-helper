# Grade 2 Minu väike kallis planeet audit

## Source evidence

The committed original archive is:

`project-files/inputs/final-zips/opiq_2klass_minu_vaike_kallis_planeet_v2.zip`

Its SHA-256 is `6c281da5cbcee9c8f1905d52debf860fd17c1bdb46776cab26b8a3b3449c96f8`. Both compact and raw indexes identify one Avita book, kit 330, as `Minu väike kallis planeet 2 klass`, grade 2, language `et`. The canonical source Book ID is `avita_minu_väike_2_et`.

The archive contains 30 records:

| Record type | Count | Canonical decision |
| --- | ---: | --- |
| Instructional chapter pages | 27 | Include in `grade-2-science` |
| Kit-detail cover records | 2 | Exclude; both use the same URL |
| Impressum | 1 | Exclude as administrative metadata |

The two cover records are the archive's only duplicate URL group. The 27 instructional URLs are unique inside the archive.

## Corrected routing

All 27 instructional URLs were already present in both `grade-1-estonian` and `grade-1-science`. Those legacy indexes labelled the same kit as grade 1 and used the incomplete Book ID `1k_minu_vaike_kallis_planeet_est`. The dedicated capture is stronger evidence because its raw book metadata, compact index, file name, and canonical records all agree on grade 2.

The records are therefore relocated rather than copied:

| Route | Before | After | Decision |
| --- | ---: | ---: | --- |
| `grade-1-estonian` | 28 kit 330 records | 0 | Remove 27 instructional pages and one Impressum |
| `grade-1-science` | 29 kit 330 records | 0 | Remove 27 instructional pages, one Impressum, and one kit detail |
| `grade-2-science` | 0 kit 330 pages | 27 | Add only instructional pages from the dedicated archive |

The grade 2 generator checks that no kit 330 canonical URL remains in any other manifest route. Old non-canonical aggregate files may still contain historical copies and must not be used for routing.

## Subject and use limitations

The book is cross-curricular: chapters include language, music, mathematics, environmental, health, and science activities. The dedicated export assigns canonical `science / loodusõpetus / природоведение` metadata, so the book is registered as a supplementary grade 2 science source. It is not evidence of complete science curriculum coverage and must not be treated as a first-language Estonian textbook solely because it contains reading activities.

Page titles, direct Opiq URLs, headings, and tasks remain source-derived. No full Opiq recapture was required beyond the supplied dedicated archive.
