# Grade 2 science subject-boundary audit

## Decision

The canonical `grade-2-science` route uses only books whose declared subject is `loodusõpetus`. Two mixed nature-and-human-studies books from the supplied archive are excluded:

| Source Book ID | Language | Source records | Instructional pages excluded | Decision |
| --- | --- | ---: | ---: | --- |
| `avita_loodus-_ja_2_et` | et | 62 | 59 | Keep outside the science route; the same 59 URLs already exist in `grade-2-human-studies` |
| `avita_природа_и__2_ru` | ru | 63 | 60 | Route through `grade-2-nature-and-human-studies`; keep outside both subject-pure routes |

The primary archive contributes seven science books: six ordinary Estonian/Russian sources (including the workbook and video collections) and one clearly labelled simplified-curriculum source. The separately registered kit 330 capture contributes one supplementary cross-curricular book. The science route does not use simplified or supplementary sources as an ordinary default.

## Source inconsistencies corrected

The archive contains 156 records automatically labelled `mathematics / matemaatika / математика`, all in Russian-language nature/science books. After cover, administrative, and mixed-book exclusions, 90 affected instructional pages remain. Their canonical `Subject` and subject-topic aliases are corrected to `science / loodusõpetus / природоведение`; titles, headings, task examples, URLs, and science theme keywords are retained.

The source also contains nine duplicate URL groups. Every group is a repeated `/Kit/Details/` cover record; no chapter-level instructional URL is duplicated after the standard cover and administrative exclusions.

One Russian Koolibri Book ID contains the invisible discretionary soft-hyphen character U+00AD. The canonical ID is `koolibri_природове_2_ru`; only that formatting character is removed. The generator also collapses repeated whitespace, removes redundant trailing `2 klass` text from book titles, and normalizes lowercase `avita`/`harno` publisher spellings without changing page titles, headings, tasks, or URLs.

## Boundary and limitations

The manifest forbids both mixed Book IDs in `grade-2-science`. The Russian kit 86 source is available only through `grade-2-nature-and-human-studies`, while the Estonian kit 56 source remains part of the audited human-studies route. This separation is a retrieval decision, not an assertion that the repository covers the complete official grade-2 curriculum.
