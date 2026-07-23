# Complete captured grade 2 catalogue audit

## Scope and claim

This is the complete canonical catalogue of the supplied and audited grade-2 captures currently available in the repository. It contains 41 canonical book/kit variants across eleven routes. Kit 568 is no longer counted here because the dedicated grade-3 archive proves grade-3 ownership; its 52 pages are now canonical only in `grade-3-russian`. This is not an independently verified snapshot of every book currently visible on the live Opiq website and it is not a curriculum-completeness claim.

All page totals below come from the canonical Markdown and QA snapshots. `ordinary`, `simplified`, `supplementary`, `mixed`, and `youth` are retrieval/use classifications; simplified and supplementary sources are never ordinary defaults.

Archive keys:

- `E`: `opiq_2klass_eesti_keele_opik_2_klassile_v2.zip`
- `M`: `opiq_2klass_matemaatika_2_klassile_v2.zip`
- `S`: `opiq_2klass_loodus_ja_inimeseopetus_2_klassile_v2.zip`
- `P`: `opiq_2klass_minu_vaike_kallis_planeet_v2.zip`
- `H`: `opiq_2klass_inimeseopetus_algklassidele_i_osa_2023_ok_v2.zip`
- `R`: `opiq_2klass_vene_keel_v2.zip`
- `A`: `opiq_2klass_kasitootuba_opiq_v2.zip`
- `U`: `opiq_2klass_muusikamaa_opiq_v2.zip`
- `Y`: `opiq_2klass_kodututarde_i_jark_2026_v2.zip`

Immutable archive SHA-256 values:

| Key | SHA-256 |
| --- | --- |
| E | `44a048b881e36c4f28e46968f8fa1c04df1121edf8381aa45235d3173d694016` |
| M | `fa7bfc685bcb8190a215417f1e9a3977124cb1c9160d1654a75245647c085446` |
| S | `138b7836b71521c5a7ba00deab14542cb301b780836321ee3239f2991080c3f6` |
| P | `6c281da5cbcee9c8f1905d52debf860fd17c1bdb46776cab26b8a3b3449c96f8` |
| H | `6468ad67870177c8a7428380e07cb9f4f6cc86c3c8d5ac35fe2aaab28c6cb705` |
| R | `13e362d66437025722498e2389fe1fee41f6298133d8022b6ddd51cad055e088` |
| A | `5de5260ab8b1973a4d5132dd248ec8198cf3062f9084f369442d9cf61ed110eb` |
| U | `f165c57ec815a9f2b526d63557ee9c3c6f33bb66ab61bc5d2fc161d533408597` |
| Y | `c74f484260d9e3a5504367cb89d42c456598015f3a4b40f2162b1888d8c5de5d` |

Every listed route has `qa_snapshot_available`; the `quality/limitation` column records the material exception that matters for routing.

| Route / subject | Canonical Book ID | Source Book ID | Kit | Canonical title | Publisher | Lang | Type | Pages | Archive | Quality / limitation |
| --- | --- | --- | ---: | --- | --- | --- | --- | ---: | --- | --- |
| `grade-2-estonian` / Estonian | `avita_eesti_keel_2_et` | same | 232 | Eesti keele õpik 2. klassile | Avita | et | ordinary | 149 | E | first-language only |
| `grade-2-estonian` / Estonian | `koolibri_ilus_emake_2_et` | same | 118 | ILUS EMAKEEL | Koolibri | et | ordinary | 182 | E | first-language only |
| `grade-2-estonian` / Estonian | `koolibri_mina_loen__2_et` | same | 458 | Mina loen ja kirjutan 2 | Koolibri | et | ordinary | 41 | E | first-language only |
| `grade-2-estonian-second-language` / Estonian L2 | `koolibri_koos_on_lõ_2_et` | same | 129 | Koos on lõbus. Janno jutud | Koolibri | et | ordinary | 72 | E | second-language only |
| `grade-2-mathematics` / mathematics | `avita_matemaatik_2_et__kit95` | `avita_matemaatik_2_et` | 95 | Matemaatika 2. klassile | Avita | et | ordinary | 108 | M | audited cover |
| `grade-2-mathematics` / mathematics | `avita_математика_2_et__kit578` | `avita_математика_2_et` | 578 | Matemaatika 2. klassile | Avita | ru | ordinary | 85 | M | source language `ru`; Estonian cover/bilingual-heading anomaly |
| `grade-2-mathematics` / mathematics | `avita_математика_2_ru__kit165` | `avita_математика_2_ru` | 165 | Математика для 2 класса | Avita | ru | ordinary | 108 | M | audited Russian cover |
| `grade-2-mathematics` / mathematics | `harno_matemaatik_2_et__kit272` | `harno_matemaatik_2_et` | 272 | Matemaatika 2. klassile, I osa. Lihtsustatud õppekava | Harno | et | simplified | 8 | M | explicit opt-in only |
| `grade-2-mathematics` / mathematics | `harno_matemaatik_2_et__kit273` | `harno_matemaatik_2_et` | 273 | Matemaatika 2. klassile, II osa. Lihtsustatud õppekava | Harno | et | simplified | 10 | M | explicit opt-in only |
| `grade-2-mathematics` / mathematics | `harno_matemaatik_2_et__kit274` | `harno_matemaatik_2_et` | 274 | Matemaatika 2. klassile, III osa. Lihtsustatud õppekava | Harno | et | simplified | 33 | M | explicit opt-in only |
| `grade-2-mathematics` / mathematics | `koolibri_matemaatik_2_et__kit107` | `koolibri_matemaatik_2_et` | 107 | MATEMAATIKA 2. klassile | Koolibri | et | ordinary | 56 | M | audited cover |
| `grade-2-mathematics` / mathematics | `koolibri_математика_2_et__kit361` | `koolibri_математика_2_et` | 361 | МАТЕМАТИКА 2 класс | Koolibri | ru | ordinary | 56 | M | source-ID suffix anomaly retained |
| `grade-2-science` / science | `avita_loodusõpet_2_et` | same | 379 | Loodusõpetus 2. klassile (2022) | Avita | et | ordinary | 27 | S | subject-pure |
| `grade-2-science` / science | `avita_minu_väike_2_et` | same | 330 | Minu väike kallis planeet 2 klass | Avita | et | supplementary | 27 | P | cross-curricular; relocated from grade 1 |
| `grade-2-science` / science | `avita_природовед_2_ru` | same | 570 | Природоведение для 2 класса | Avita | ru | ordinary | 23 | S | Estonian cover; index title retained |
| `grade-2-science` / science | `koolibri_loodusõpet_2_et` | same | 121 | Loodusõpetus 2. klassile | Koolibri | et | ordinary | 64 | S | subject-pure |
| `grade-2-science` / science | `koolibri_природове_2_ru` | same | 132 | Природоведение 2 класс | Koolibri | ru | ordinary | 67 | S | confirmed soft-hyphen/Latin-`cc` correction |
| `grade-2-science` / science | `ministeerium_loodusõpet_2_et` | same | 501 | Loodusõpetus 2. klassile. Lihtsustatud õppekava | Ministeerium | et | simplified | 36 | S | publisher casing only; opt-in |
| `grade-2-science` / science | `skriibus_loodusõpet_2_et` | same | 387 | Loodusõpetuse tööraamat 2. klassile | Skriibus | et | ordinary | 28 | S | workbook source |
| `grade-2-science` / science | `star cloud_loodusõpet_2_et` | same | 384 | Loodusõpetuse õppevideod 1. kooliastmele | Star Cloud | et | ordinary | 41 | S | multi-grade title; captured grade 2 route |
| `grade-2-human-studies` / human studies | `avita_inimeseõpe_2_et__kit449` | `avita_inimeseõpe_2_et` | 449 | Inimeseõpetus algklassidele, I osa. 2023 ÕK | Avita | et | ordinary | 13 | H | distinct I osa cover |
| `grade-2-human-studies` / human studies | `avita_inimeseõpe_2_et__kit494` | `avita_inimeseõpe_2_et` | 494 | Inimeseõpetus algklassidele, II osa. 2023 ÕK | Avita | et | ordinary | 35 | H | distinct II osa cover |
| `grade-2-human-studies` / human studies | `avita_inimeseõpe_2_ru__kit579` | `avita_inimeseõpe_2_ru` | 579 | Inimeseõpetus algklassidele. II osa | Avita | ru | ordinary | 23 | H | source has four `et`-labelled records; canonical page language follows kit evidence |
| `grade-2-human-studies` / human studies | `avita_loodus-_ja_2_et__kit56` | `avita_loodus-_ja_2_et` | 56 | Loodus- ja inimeseõpetus 2. klassile | Avita | et | ordinary | 59 | H | Estonian combined source retained in audited human route |
| `grade-2-human-studies` / human studies | `harno_inimeseõpe_2_et__kit286` | `harno_inimeseõpe_2_et` | 286 | Inimeseõpetus 2. klassile. Lihtsustatud õppekava | Harno | et | simplified | 37 | H | explicit opt-in only |
| `grade-2-human-studies` / human studies | `koolibri_in2_2._kla_2_et__kit142` | `koolibri_in2_2._kla_2_et` | 142 | IN2. 2. klassi inimeseõpetus | Koolibri | et | ordinary | 38 | H | index plus cover evidence |
| `grade-2-human-studies` / human studies | `koolibri_мой_мир._ч_2_ru__kit229` | `koolibri_мой_мир._ч_2_ru` | 229 | Мой мир. Человековедение 2 класс | Koolibri | ru | ordinary | 38 | H | discretionary soft hyphen removed from identity |
| `grade-2-russian` / Russian | `avita_русский_язык_2_класс_kit292` | same | 292 | Русский язык для 2 класса | Avita | ru | ordinary | 192 | R | canonical kit identity |
| `grade-2-russian` / Russian | `koolibri_русский_яз_2_ru` | same | 186 | РУССКИЙ ЯЗЫК 2 класс | Koolibri | ru | ordinary | 30 | R | audited legacy route |
| `grade-2-russian` / Russian | `koolibri_светлячок._2_ru` | same | 454 | СВЕТЛЯЧОК. Чтение для 2 класса | Koolibri | ru | ordinary | 99 | R | audited legacy route |
| `grade-2-arts-and-crafts` / arts and crafts | `kunsti-_ja_tööõpetus._2._osa` | same | 192 | Kunsti- ja tööõpetus. 2. osa | not recorded | et | ordinary | 89 | A | publisher not supplied |
| `grade-2-arts-and-crafts` / arts and crafts | `kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid` | same | 200 | Kunsti- ja tööõpetus. 4. osa. Tähtpäevakaardid | not recorded | et | supplementary | 85 | A | publisher not supplied |
| `grade-2-arts-and-crafts` / arts and crafts | `трудовое_обучение_и_искусство._2_часть` | same | 371 | Трудовое обучение и искусство. 2 часть | not recorded | ru | ordinary | 89 | A | publisher not supplied |
| `grade-2-music` / music | `2._klassi_muusikaõpetus` | same | 188 | Muusikamaa | not recorded | et | ordinary | 116 | U | publisher not supplied |
| `grade-2-music` / music | `eesti_pärimusmuusika_keskuse_õppevideod` | same | 465 | Eesti Pärimusmuusika Keskuse õppevideod | not recorded | et | supplementary | 33 | U | publisher not supplied |
| `grade-2-music` / music | `muusikaõpik_2._klassile` | same | 193 | Muusikaõpik 2. klassile | not recorded | et | ordinary | 29 | U | publisher not supplied |
| `grade-2-music` / music | `muusikaõpik_2._klassile_2024` | same | 556 | Muusikaõpik 2. klassile 2024 | not recorded | et | ordinary | 28 | U | publisher not supplied |
| `grade-2-music` / music | `музыка_–_волшебная_страна._2_класс` | same | 238 | Музыка – волшебная страна. 2 класс | not recorded | ru | ordinary | 111 | U | publisher not supplied |
| `grade-2-kodututarde-training` / Kodututred | `kodutütarde_i_järk_(2026)` | `kaitseliit_kodutütard_2_et` and duplicate alias | 593 | Kodutütarde I järk (2026) | Kaitseliit | et | youth | 31 | Y | identical duplicate URLs collapsed |
| `grade-2-noorte-kotkaste-training` / Noorte Kotkad | `kaitseliit_noorte_kot_2_et` | same | 594 | Noorte Kotkaste I järk (2026) | Kaitseliit | et | youth | 27 | Y | supplementary youth training |
| `grade-2-nature-and-human-studies` / combined | `avita_природа_и__2_ru__kit86` | `avita_природа_и__2_ru` | 86 | Природа и человек для 2 класса | Avita | ru | mixed | 60 | S | no unsupported page-level subject split |

## Route and source totals

| Route | Books | Pages |
| --- | ---: | ---: |
| grade-2-estonian | 3 | 372 |
| grade-2-estonian-second-language | 1 | 72 |
| grade-2-mathematics | 8 | 464 |
| grade-2-science | 8 | 313 |
| grade-2-human-studies | 7 | 243 |
| grade-2-russian | 3 | 321 |
| grade-2-arts-and-crafts | 3 | 263 |
| grade-2-music | 5 | 317 |
| grade-2-kodututarde-training | 1 | 31 |
| grade-2-noorte-kotkaste-training | 1 | 27 |
| grade-2-nature-and-human-studies | 1 | 60 |
| **Total** | **41** | **2,483** |

`Koduõpe` and `Kodutütarde VI järk` are intentionally not counted as grade-2 books. Kit 568 remains present in the immutable historical grade-2 source ZIP but is deliberately filtered from the grade-2 canonical route. Exact source accounting, excluded cover/administrative records, duplicate decisions, and SHA-256 values are recorded in the route QA snapshots and generator checks.
