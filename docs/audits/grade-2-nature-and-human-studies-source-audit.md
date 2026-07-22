# Grade 2 Russian nature-and-human-studies source audit

## Evidence and routing decision

The already committed archive `project-files/inputs/final-zips/opiq_2klass_loodus_ja_inimeseopetus_2_klassile_v2.zip` contains kit 86, Source Book ID `avita_природа_и__2_ru`, with the explicit cover title `Природа и человек для 2 класса`, language `ru`, and publisher `Avita`.

Its 63 source records account for two repeated kit-detail records, one Impressum record, and 60 unique instructional chapter URLs. The archive does not provide reliable page-level evidence for assigning individual chapters exclusively to science or human studies. The canonical solution is therefore the dedicated mixed route `grade-2-nature-and-human-studies`, not duplication across subject-pure routes.

| Field | Canonical value |
| --- | --- |
| Route | `grade-2-nature-and-human-studies` |
| Subject | `science_and_human_studies` |
| Subject ET | `loodus- ja inimeseõpetus` |
| Canonical Book ID | `avita_природа_и__2_ru__kit86` |
| Source Book ID | `avita_природа_и__2_ru` |
| Kit | 86 |
| Programme type | `mixed_subject` |
| Instructional pages | 60 |

The generator reads the same shared archive as grade-2 science but restricts this route to kit 86. CI rejects any other kit in the output and checks that no canonical URL overlaps another grade-2 route. No new Opiq capture was required.

## Limitations

This route is a searchable mixed-subject source index. It is not a subject-pure curriculum map and does not prove complete official grade-2 curriculum coverage. The source page URLs, titles, headings, and tasks are retained; only route metadata, canonical book identity, and the mixed-subject label are added.
