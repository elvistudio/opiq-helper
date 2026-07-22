# Grade 2 catalogue metadata audit

## Mathematics book identities

The mathematics route still contains 464 instructional pages. Its inventory changes from six source-ID groups to eight canonical source-book-plus-kit variants. Every page keeps a `Source Book ID` field.

| Source Book ID | Kit | Canonical Book ID | Canonical title | Pages | Evidence |
| --- | ---: | --- | --- | ---: | --- |
| `avita_matemaatik_2_et` | 95 | `avita_matemaatik_2_et__kit95` | Matemaatika 2. klassile | 108 | kit cover |
| `avita_математика_2_et` | 578 | `avita_математика_2_et__kit578` | Matemaatika 2. klassile | 85 | Estonian kit cover; bilingual Estonian/Russian headings |
| `avita_математика_2_ru` | 165 | `avita_математика_2_ru__kit165` | Математика для 2 класса | 108 | Russian kit cover |
| `harno_matemaatik_2_et` | 272 | `harno_matemaatik_2_et__kit272` | Matemaatika 2. klassile, I osa. Lihtsustatud õppekava | 8 | kit cover |
| `harno_matemaatik_2_et` | 273 | `harno_matemaatik_2_et__kit273` | Matemaatika 2. klassile, II osa. Lihtsustatud õppekava | 10 | kit cover |
| `harno_matemaatik_2_et` | 274 | `harno_matemaatik_2_et__kit274` | Matemaatika 2. klassile, III osa. Lihtsustatud õppekava | 33 | kit cover |
| `koolibri_matemaatik_2_et` | 107 | `koolibri_matemaatik_2_et__kit107` | MATEMAATIKA 2. klassile | 56 | kit cover |
| `koolibri_математика_2_et` | 361 | `koolibri_математика_2_et__kit361` | МАТЕМАТИКА 2 класс | 56 | kit cover |

Kit 578 is distinguishable without a new capture: the committed cover says `Matemaatika 2. klassile`, while kit 165 says `Математика для 2 класса`. Kit 578 retains the archive language value `ru`; the QA audit records the source-ID/language anomaly instead of guessing a different language.

## Human-studies parts

The human-studies route still contains 243 instructional pages. The previous six-book inventory becomes seven kit-specific variants because source Book ID `avita_inimeseõpe_2_et` spans two distinguishable kits.

| Source Book ID | Kit | Canonical title | Pages | Evidence |
| --- | ---: | --- | ---: | --- |
| `avita_inimeseõpe_2_et` | 449 | Inimeseõpetus algklassidele, I osa. 2023 ÕK | 13 | explicit cover title |
| `avita_inimeseõpe_2_et` | 494 | Inimeseõpetus algklassidele, II osa. 2023 ÕK | 35 | explicit cover title |
| `avita_inimeseõpe_2_ru` | 579 | Inimeseõpetus algklassidele. II osa | 23 | explicit cover title |
| `avita_loodus-_ja_2_et` | 56 | Loodus- ja inimeseõpetus 2. klassile | 59 | explicit cover title |
| `harno_inimeseõpe_2_et` | 286 | Inimeseõpetus 2. klassile. Lihtsustatud õppekava | 37 | explicit cover title |
| `koolibri_in2_2._kla_2_et` | 142 | IN2. 2. klassi inimeseõpetus | 38 | cover plus `index.json` |
| `koolibri_мой_мир._ч_2_ru` | 229 | Мой мир. Человековедение 2 класс | 38 | explicit cover title |

No human-studies title is blocked: the committed evidence is sufficient to distinguish I and II osa, so no cover recapture is required.

## Confirmed science metadata

- Kit 132 is normalized from `Природо­ведение 2 клacc` to `Природоведение 2 класс`: the discretionary soft hyphen is removed and the Latin `cc` typo is corrected to Cyrillic `сс`.
- The source publisher value `ministeerium` is normalized only to title case, `Ministeerium`. The archive does not prove a fuller organization name, so none is invented.
- Other confirmed publisher names remain `Avita`, `Koolibri`, `Skriibus`, and `Star Cloud`.

Page titles, URLs, headings, and tasks are not rewritten for these book-inventory corrections.

## Dedicated Russian combined-book route

The committed combined science/human-studies archive contains 60 instructional pages for kit 86, Source Book ID `avita_природа_и__2_ru` (`Природа и человек для 2 класса`). They remain excluded from both subject-pure routes and are now exposed through `grade-2-nature-and-human-studies` with the canonical identity `avita_природа_и__2_ru__kit86`.

The dedicated route preserves the mixed nature-and-human-studies identity instead of inventing page-level subject assignments not supported by the archive. Its URL set is disjoint from every other grade-2 route. The 60 pages were already present in the committed source archive, so no new capture was required.
