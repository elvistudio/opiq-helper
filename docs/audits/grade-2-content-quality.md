# Grade 2 canonical content-quality audit

## Scope and readiness conclusion

Complete canonical content-quality audit of the supplied and registered grade-2 captures currently available in the repository. It is not an independently verified live Opiq catalogue or an official-curriculum completeness audit.

The audit checked **11 routes**, **42 canonical book/kit variants**, and **2,535 canonical instructional pages**. It found **0 unexplained hard errors** and 384 classified warning groups. The captured sources are structurally suitable for beginning home-course architecture, subject to the non-blocking targeted checks below. This is not proof of live Opiq catalogue completeness or official curriculum completeness.

Programme boundaries remain explicit: ordinary, simplified, supplementary, mixed-subject, and youth-training records are not interchangeable defaults.

## Hard errors

- None.

## Warning summary

| Code | Groups | URLs | Classifications |
| --- | ---: | ---: | --- |
| `anomalous_punctuation` | 1 | 1 | targeted_recapture_recommended |
| `duplicate_compact_content` | 45 | 103 | distinct_canonical_context |
| `duplicate_title` | 253 | 594 | distinct_canonical_context |
| `missing_publisher` | 8 | 580 | source_supported_metadata_limitation |
| `missing_task_examples` | 37 | 1538 | acceptable_source_structure |
| `mixed_script_word` | 7 | 29 | known_bilingual_extraction_boundary, targeted_recapture_recommended |
| `single_symbol_title` | 3 | 4 | acceptable_book_structure, targeted_recapture_recommended |
| `source_book_id_language_suffix_mismatch` | 2 | 141 | source_identifier_anomaly |
| `source_canonical_language_mismatch` | 4 | 8 | proven_canonical_normalization |
| `text_language_mismatch` | 5 | 99 | acceptable_bilingual_source_content, known_source_metadata_anomaly, source_language_requires_targeted_review |
| `unusually_short_record` | 7 | 24 | source_supported_short_summary |
| `very_short_title` | 12 | 20 | source_supported_short_title, targeted_recapture_recommended |

## Route and book coverage

| Route | Books | Pages | Warnings |
| --- | ---: | ---: | ---: |
| `grade-2-arts-and-crafts` | 3 | 263 | 35 |
| `grade-2-estonian` | 3 | 372 | 18 |
| `grade-2-estonian-second-language` | 1 | 72 | 6 |
| `grade-2-human-studies` | 7 | 243 | 56 |
| `grade-2-kodututarde-training` | 1 | 31 | 39 |
| `grade-2-mathematics` | 8 | 464 | 117 |
| `grade-2-music` | 5 | 317 | 56 |
| `grade-2-nature-and-human-studies` | 1 | 60 | 12 |
| `grade-2-noorte-kotkaste-training` | 1 | 27 | 39 |
| `grade-2-russian` | 4 | 373 | 37 |
| `grade-2-science` | 8 | 313 | 58 |

## Archive-proven repairs

- 16 pages had raw JSON/HTML task payloads removed. The human-readable instruction already present in the same archived task record was retained; titles, URLs, headings, and author wording were not rewritten.
  - [grade-2-human-studies / Eesti Vabariik](https://www.opiq.ee/kit/142/chapter/8009)
  - [grade-2-human-studies / Minu kodukoht](https://www.opiq.ee/kit/142/chapter/8010)
  - [grade-2-human-studies / Eestimaa rikkus](https://www.opiq.ee/kit/142/chapter/8012)
  - [grade-2-human-studies / Мой родной край](https://www.opiq.ee/kit/229/chapter/13096)
  - [grade-2-human-studies / Богатство Эстонии](https://www.opiq.ee/kit/229/chapter/13098)
  - [grade-2-russian / Повторение (1)](https://www.opiq.ee/kit/292/chapter/16141)
  - [grade-2-russian / Безударные гласные в корне слова (1)](https://www.opiq.ee/kit/292/chapter/17770)
  - [grade-2-russian / Безударные гласные в корне слова (2)](https://www.opiq.ee/kit/292/chapter/17771)
  - [grade-2-russian / Обобщение по теме «Части речи»](https://www.opiq.ee/kit/292/chapter/17808)
  - [grade-2-russian / Что я знаю о предложении?](https://www.opiq.ee/kit/292/chapter/17829)
  - [grade-2-russian / Жёлтая сказка](https://www.opiq.ee/kit/292/chapter/17845)
  - [grade-2-science / Loomad kevadel](https://www.opiq.ee/kit/501/chapter/27402)
  - [grade-2-science / Suvi ja suvekuud](https://www.opiq.ee/kit/501/chapter/27404)
  - [grade-2-science / Aasta](https://www.opiq.ee/kit/501/chapter/27405)
  - [grade-2-mathematics / Kordamine. Tasandilised kujundid](https://www.opiq.ee/kit/578/chapter/32209)
  - [grade-2-mathematics / Kordamine. Tasapinnalised kujundid](https://www.opiq.ee/kit/95/chapter/4649)
- 39 pages had invisible zero-width spacing controls removed from extracted task summaries.
  - [grade-2-human-studies / Mina](https://www.opiq.ee/kit/142/chapter/7988)
  - [grade-2-human-studies / Mina looduses](https://www.opiq.ee/kit/142/chapter/8021)
  - [grade-2-mathematics / Дециметр](https://www.opiq.ee/kit/165/chapter/9258)
  - [grade-2-mathematics / Деление на число 4](https://www.opiq.ee/kit/165/chapter/9302)
  - [grade-2-mathematics / Умножение как действие, заменяющее сложение одинаковых слагаемых](https://www.opiq.ee/kit/165/chapter/9318)
  - [grade-2-mathematics / Урок на открытом воздухе. Разбивка цветочной клумбы](https://www.opiq.ee/kit/165/chapter/9331)
  - [grade-2-human-studies / Ценность и стоимость вещи](https://www.opiq.ee/kit/229/chapter/13093)
  - [grade-2-russian / Речь устная и письменная. Общение (2)](https://www.opiq.ee/kit/292/chapter/16087)
  - [grade-2-russian / Предложения, разные по цели высказывания (2)](https://www.opiq.ee/kit/292/chapter/16100)
  - [grade-2-russian / Имена собственные](https://www.opiq.ee/kit/292/chapter/16132)
  - [grade-2-russian / Кашу кушай, а сказку слушай: умом-разумом](https://www.opiq.ee/kit/292/chapter/16144)
  - [grade-2-russian / Одушевлённые и неодушевлённые имена существительные](https://www.opiq.ee/kit/292/chapter/17793)
  - [grade-2-russian / Обобщение по теме «Имя существительное»](https://www.opiq.ee/kit/292/chapter/17797)
  - [grade-2-russian / Обобщение по теме «Части речи»](https://www.opiq.ee/kit/292/chapter/17808)
  - [grade-2-russian / Что я знаю о предложении?](https://www.opiq.ee/kit/292/chapter/17829)
  - [grade-2-science / Kevad ja kevadkuud](https://www.opiq.ee/kit/501/chapter/27398)
  - [grade-2-russian / Главные члены предложения – подлежащее и сказуемое](https://www.opiq.ee/kit/568/chapter/31770)
  - [grade-2-russian / Как подбирать проверочные слова? (2)](https://www.opiq.ee/kit/568/chapter/31804)
  - [grade-2-mathematics / Arvude võrdlemine](https://www.opiq.ee/kit/578/chapter/32032)
  - [grade-2-mathematics / Sirglõik. Millimeeter](https://www.opiq.ee/kit/578/chapter/32039)
  - [grade-2-mathematics / Pikkuse mõõtmine millimeetrites](https://www.opiq.ee/kit/578/chapter/32040)
  - [grade-2-mathematics / Kujundid](https://www.opiq.ee/kit/578/chapter/32198)
  - [grade-2-mathematics / Romb](https://www.opiq.ee/kit/578/chapter/32208)
  - [grade-2-mathematics / Kahekohaline arv kümneliste ja üheliste summana](https://www.opiq.ee/kit/578/chapter/32212)
  - [grade-2-mathematics / Kordamine. Arvutamine 100 piires](https://www.opiq.ee/kit/578/chapter/32217)
  - [grade-2-mathematics / Meeter, sentimeeter](https://www.opiq.ee/kit/578/chapter/32219)
  - [grade-2-mathematics / Kordamine. Ajaühikud, kestus](https://www.opiq.ee/kit/578/chapter/32229)
  - [grade-2-mathematics / Kilogramm, gramm (1)](https://www.opiq.ee/kit/578/chapter/33015)
  - [grade-2-mathematics / Kilogramm, gramm (2)](https://www.opiq.ee/kit/578/chapter/33016)
  - [grade-2-mathematics / Silinder, koonus, kera](https://www.opiq.ee/kit/578/chapter/33021)
  - [grade-2-mathematics / Kordamine. Ruumilised kujundid](https://www.opiq.ee/kit/578/chapter/33022)
  - [grade-2-mathematics / Kordamine. Ristkülik, ruut, kolmnurk, ring](https://www.opiq.ee/kit/578/chapter/33025)
  - [grade-2-mathematics / Korrutamise seadus](https://www.opiq.ee/kit/578/chapter/33027)
  - [grade-2-mathematics / Korrutamine arvuga 2 (2)](https://www.opiq.ee/kit/578/chapter/33029)
  - [grade-2-mathematics / Pool](https://www.opiq.ee/kit/578/chapter/33032)
  - [grade-2-mathematics / Kordamine. Ruumilised kujundid](https://www.opiq.ee/kit/95/chapter/20830)
  - [grade-2-mathematics / Meeter, sentimeeter](https://www.opiq.ee/kit/95/chapter/4635)
  - [grade-2-mathematics / Kujundid](https://www.opiq.ee/kit/95/chapter/4647)
  - [grade-2-mathematics / Täiskümnete ja ‑sadade liitmine 1000 piires](https://www.opiq.ee/kit/95/chapter/6405)
- Existing source-supported catalogue corrections remain in force: the kit 132 Cyrillic title correction, Ministry publisher casing, soft-hyphen removal from canonical identifiers, and exact URL deduplication.

## Known metadata anomalies

| Kit | Status | Finding | Disposition |
| --- | --- | --- | --- |
| 578 | `unresolved_metadata` | Source language is ru; cover is Estonian; headings are Estonian-primary or bilingual. | Retain ru and request only current Kit Details language evidence. |
| 570 | `unresolved_metadata` | Russian indexed record is associated with an Estonian cover. | Retain the Russian route; request only current Kit Details/cover evidence. |
| 192, 200, 371 | `acceptable_missing_metadata` | Arts-and-crafts archive has no publisher values. | Publishers remain blank. |
| 188, 193, 238, 465, 556 | `acceptable_missing_metadata` | Music archive has no publisher values. | Publishers remain blank. |
| 579 | `source_language_anomaly` | Four raw source records are marked et: two repeated Kit Details records, one instructional page, and one excluded Impressum. | Canonical instructional route remains Russian; retain raw evidence and target only the one instructional page plus Kit Details. |
| 86 | `acceptable_mixed_subject_source` | The archive does not support a reliable page-level science/human-studies split. | Keep all 60 pages in the dedicated mixed-subject route. |
| 578, 361 | `source_identifier_anomaly` | Source Book IDs end in _et while canonical Language is ru. | Preserve immutable Source Book IDs; do not infer language from the suffix. |

## Minimal targeted recapture plan

### Kit Details or cover only

- **Kit 578 — Matemaatika 2. klassile:** Current Kit Details with cover and visible language metadata. Resolves: Source Language is ru while cover and most headings are Estonian or bilingual. Programme architecture can continue without it: **yes**.
- **Kit 570 — Природоведение для 2 класса:** Current Kit Details and cover. Resolves: Russian indexed book is paired with an Estonian cover title. Programme architecture can continue without it: **yes**.
- **Kit 579 — Inimeseõpetus algklassidele. II osa:** Current Kit Details and cover with language metadata. Resolves: Four source records are marked et inside the otherwise Russian-routed source. Programme architecture can continue without it: **yes**.
- **Kit 192 — Kunsti- ja tööõpetus. 2. osa:** Current Kit Details or cover showing publisher metadata. Resolves: The supplied capture contains no publisher value. Programme architecture can continue without it: **yes**.
- **Kit 200 — Kunsti- ja tööõpetus. 4. osa. Tähtpäevakaardid:** Current Kit Details or cover showing publisher metadata. Resolves: The supplied capture contains no publisher value. Programme architecture can continue without it: **yes**.
- **Kit 371 — Трудовое обучение и искусство. 2 часть:** Current Kit Details or cover showing publisher metadata. Resolves: The supplied capture contains no publisher value. Programme architecture can continue without it: **yes**.
- **Kit 188 — Muusikamaa:** Current Kit Details or cover showing publisher metadata. Resolves: The supplied capture contains no publisher value. Programme architecture can continue without it: **yes**.
- **Kit 193 — Muusikaõpik 2. klassile:** Current Kit Details or cover showing publisher metadata. Resolves: The supplied capture contains no publisher value. Programme architecture can continue without it: **yes**.
- **Kit 238 — Музыка – волшебная страна. 2 класс:** Current Kit Details or cover showing publisher metadata. Resolves: The supplied capture contains no publisher value. Programme architecture can continue without it: **yes**.
- **Kit 465 — Eesti Pärimusmuusika Keskuse õppevideod:** Current Kit Details or cover showing publisher metadata. Resolves: The supplied capture contains no publisher value. Programme architecture can continue without it: **yes**.
- **Kit 556 — Muusikaõpik 2. klassile 2024:** Current Kit Details or cover showing publisher metadata. Resolves: The supplied capture contains no publisher value. Programme architecture can continue without it: **yes**.

### Individual pages

- **Kit 118 — [ILUS EMAKEEL — punctuation-only page](https://www.opiq.ee/kit/118/chapter/5990):** Page title and first visible instructional heading. Resolves: Canonical title and heading are only “...”. Programme architecture can continue without it: **yes**.
- **Kit 579 — [RAHVAKOMBED SÜGISEL II. MARDIPÄEV JA KADRIPÄEV](https://www.opiq.ee/kit/579/chapter/32445):** Page language indicator and visible content. Resolves: The instructional source record is marked et inside a Russian-routed kit. Programme architecture can continue without it: **yes**.
- **Kit 570 — [Ilm](https://www.opiq.ee/kit/570/chapter/32084):** Heading containing the word currently extracted as Cпутники. Resolves: Latin C and Cyrillic letters are mixed in one word. Programme architecture can continue without it: **yes**.
- **Kit 132 — [Деревья](https://www.opiq.ee/kit/132/chapter/7072):** Heading containing the word currently extracted as Pабочая. Resolves: Latin P and Cyrillic letters are mixed in one word. Programme architecture can continue without it: **yes**.
- **Kit 229 — [Мои увлечения](https://www.opiq.ee/kit/229/chapter/13076):** Task label currently extracted as Заданиe. Resolves: Latin e and Cyrillic letters are mixed in one word. Programme architecture can continue without it: **yes**.
- **Kit 292 — [Звуки и буквы](https://www.opiq.ee/kit/292/chapter/16123):** Words with the currently mixed-script stressed vowels. Resolves: Precomposed Latin accented letters occur inside Cyrillic words. Programme architecture can continue without it: **yes**.
- **Kit 292 — [Повторение (1)](https://www.opiq.ee/kit/292/chapter/17761):** Word currently extracted as словá. Resolves: A precomposed Latin accented letter occurs inside a Cyrillic word. Programme architecture can continue without it: **yes**.
- **Kit 568 — [Татьяна Александрова. Домовёнок ______](https://www.opiq.ee/kit/568/chapter/31778):** Word currently extracted as свóриться. Resolves: A precomposed Latin accented letter occurs inside a Cyrillic word. Programme architecture can continue without it: **yes**.
- **Kit 568 — [Где поставить ударение?](https://www.opiq.ee/kit/568/chapter/31793):** Stressed words and the рекиPausEsita extraction boundary. Resolves: Mixed-script stressed vowels and a media-control label are concatenated with lesson text. Programme architecture can continue without it: **yes**.
- **Kit 454 — [СУМАCШЕДШАЯ ПТИЦА](https://www.opiq.ee/kit/454/chapter/24744):** Page title and first heading. Resolves: Latin C occurs inside a Cyrillic word. Programme architecture can continue without it: **yes**.

### Full kits

- None. No supplied archive shows systematic corruption that justifies a full recapture.

## Detailed classified warning inventory

<details><summary><code>g2q-0001</code> — <code>anomalous_punctuation</code> — 1 page titles contain punctuation only.</summary>

- Classification: `targeted_recapture_recommended`
- Routes: `grade-2-estonian`
- Books: `koolibri_ilus_emake_2_et`
- Kits: 118
- Action: Retain the captured value but do not rely on it for routing until the individual page is checked.
- Exact URLs:
  - https://www.opiq.ee/kit/118/chapter/5990

</details>

<details><summary><code>g2q-0002</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-arts-and-crafts`, `grade-2-estonian`
- Books: `avita_eesti_keel_2_et`, `kunsti-_ja_tööõpetus._2._osa`
- Kits: 192, 232
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/192/chapter/10934
  - https://www.opiq.ee/kit/232/chapter/14137

</details>

<details><summary><code>g2q-0003</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-arts-and-crafts`, `grade-2-science`
- Books: `koolibri_природове_2_ru`, `трудовое_обучение_и_искусство._2_часть`
- Kits: 132, 371
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/132/chapter/7077
  - https://www.opiq.ee/kit/371/chapter/20273

</details>

<details><summary><code>g2q-0004</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-arts-and-crafts`
- Books: `kunsti-_ja_tööõpetus._2._osa`, `kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid`
- Kits: 192, 200
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/192/chapter/10891
  - https://www.opiq.ee/kit/200/chapter/11414

</details>

<details><summary><code>g2q-0005</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-arts-and-crafts`
- Books: `kunsti-_ja_tööõpetus._2._osa`, `kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid`
- Kits: 192, 200
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/192/chapter/10898
  - https://www.opiq.ee/kit/200/chapter/11444

</details>

<details><summary><code>g2q-0006</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-arts-and-crafts`
- Books: `kunsti-_ja_tööõpetus._2._osa`, `kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid`
- Kits: 192, 200
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/192/chapter/10948
  - https://www.opiq.ee/kit/200/chapter/11439

</details>

<details><summary><code>g2q-0007</code> — <code>duplicate_compact_content</code> — 5 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-arts-and-crafts`
- Books: `kunsti-_ja_tööõpetus._2._osa`
- Kits: 192
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/192/chapter/10897
  - https://www.opiq.ee/kit/192/chapter/10917
  - https://www.opiq.ee/kit/192/chapter/10955
  - https://www.opiq.ee/kit/192/chapter/10966
  - https://www.opiq.ee/kit/192/chapter/10968

</details>

<details><summary><code>g2q-0008</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-arts-and-crafts`
- Books: `kunsti-_ja_tööõpetus._2._osa`
- Kits: 192
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/192/chapter/10916
  - https://www.opiq.ee/kit/192/chapter/10957

</details>

<details><summary><code>g2q-0009</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-arts-and-crafts`
- Books: `kunsti-_ja_tööõpetus._2._osa`
- Kits: 192
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/192/chapter/10960
  - https://www.opiq.ee/kit/192/chapter/10969

</details>

<details><summary><code>g2q-0010</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-arts-and-crafts`
- Books: `kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid`
- Kits: 200
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/200/chapter/11399
  - https://www.opiq.ee/kit/200/chapter/11429

</details>

<details><summary><code>g2q-0011</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-arts-and-crafts`
- Books: `kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid`
- Kits: 200
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/200/chapter/11445
  - https://www.opiq.ee/kit/200/chapter/11446

</details>

<details><summary><code>g2q-0012</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-arts-and-crafts`
- Books: `трудовое_обучение_и_искусство._2_часть`
- Kits: 371
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/371/chapter/20292
  - https://www.opiq.ee/kit/371/chapter/20333

</details>

<details><summary><code>g2q-0013</code> — <code>duplicate_compact_content</code> — 4 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-arts-and-crafts`
- Books: `трудовое_обучение_и_искусство._2_часть`
- Kits: 371
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/371/chapter/20293
  - https://www.opiq.ee/kit/371/chapter/20331
  - https://www.opiq.ee/kit/371/chapter/20342
  - https://www.opiq.ee/kit/371/chapter/20344

</details>

<details><summary><code>g2q-0014</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-arts-and-crafts`
- Books: `трудовое_обучение_и_искусство._2_часть`
- Kits: 371
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/371/chapter/20336
  - https://www.opiq.ee/kit/371/chapter/20345

</details>

<details><summary><code>g2q-0015</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-estonian-second-language`, `grade-2-science`
- Books: `koolibri_koos_on_lõ_2_et`, `star cloud_loodusõpet_2_et`
- Kits: 129, 384
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/129/chapter/6944
  - https://www.opiq.ee/kit/384/chapter/20741

</details>

<details><summary><code>g2q-0016</code> — <code>duplicate_compact_content</code> — 5 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-estonian`, `grade-2-human-studies`, `grade-2-music`, `grade-2-russian`
- Books: `avita_eesti_keel_2_et`, `avita_inimeseõpe_2_et__kit494`, `avita_русский_язык_2_класс_kit292`, `eesti_pärimusmuusika_keskuse_õppevideod`, `koolibri_ilus_emake_2_et`
- Kits: 118, 232, 292, 465, 494
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/118/chapter/6032
  - https://www.opiq.ee/kit/232/chapter/13202
  - https://www.opiq.ee/kit/292/chapter/16173
  - https://www.opiq.ee/kit/465/chapter/25308
  - https://www.opiq.ee/kit/494/chapter/27195

</details>

<details><summary><code>g2q-0017</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-estonian`
- Books: `koolibri_ilus_emake_2_et`, `koolibri_mina_loen__2_et`
- Kits: 118, 458
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/118/chapter/5869
  - https://www.opiq.ee/kit/458/chapter/24985

</details>

<details><summary><code>g2q-0018</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-estonian`
- Books: `koolibri_ilus_emake_2_et`
- Kits: 118
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/118/chapter/5928
  - https://www.opiq.ee/kit/118/chapter/6028

</details>

<details><summary><code>g2q-0019</code> — <code>duplicate_compact_content</code> — 5 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`, `grade-2-music`, `grade-2-russian`
- Books: `avita_loodus-_ja_2_et__kit56`, `avita_русский_язык_2_класс_kit292`, `koolibri_русский_яз_2_ru`, `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 186, 193, 292, 556, 56
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/186/chapter/10462
  - https://www.opiq.ee/kit/193/chapter/10997
  - https://www.opiq.ee/kit/292/chapter/16172
  - https://www.opiq.ee/kit/556/chapter/31306
  - https://www.opiq.ee/kit/56/chapter/2773

</details>

<details><summary><code>g2q-0020</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33590
  - https://www.opiq.ee/kit/594/chapter/33623

</details>

<details><summary><code>g2q-0021</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33595
  - https://www.opiq.ee/kit/594/chapter/33628

</details>

<details><summary><code>g2q-0022</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33596
  - https://www.opiq.ee/kit/594/chapter/33629

</details>

<details><summary><code>g2q-0023</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33597
  - https://www.opiq.ee/kit/594/chapter/33630

</details>

<details><summary><code>g2q-0024</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33599
  - https://www.opiq.ee/kit/594/chapter/33633

</details>

<details><summary><code>g2q-0025</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33600
  - https://www.opiq.ee/kit/594/chapter/33634

</details>

<details><summary><code>g2q-0026</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33601
  - https://www.opiq.ee/kit/594/chapter/33635

</details>

<details><summary><code>g2q-0027</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33602
  - https://www.opiq.ee/kit/594/chapter/33636

</details>

<details><summary><code>g2q-0028</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33603
  - https://www.opiq.ee/kit/594/chapter/33637

</details>

<details><summary><code>g2q-0029</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33604
  - https://www.opiq.ee/kit/594/chapter/33638

</details>

<details><summary><code>g2q-0030</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33606
  - https://www.opiq.ee/kit/594/chapter/33640

</details>

<details><summary><code>g2q-0031</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33607
  - https://www.opiq.ee/kit/594/chapter/33641

</details>

<details><summary><code>g2q-0032</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33608
  - https://www.opiq.ee/kit/594/chapter/33642

</details>

<details><summary><code>g2q-0033</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33609
  - https://www.opiq.ee/kit/594/chapter/33643

</details>

<details><summary><code>g2q-0034</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33610
  - https://www.opiq.ee/kit/594/chapter/33644

</details>

<details><summary><code>g2q-0035</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33611
  - https://www.opiq.ee/kit/594/chapter/33645

</details>

<details><summary><code>g2q-0036</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33612
  - https://www.opiq.ee/kit/594/chapter/33632

</details>

<details><summary><code>g2q-0037</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `harno_matemaatik_2_et__kit273`, `harno_matemaatik_2_et__kit274`
- Kits: 273, 274
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/273/chapter/15475
  - https://www.opiq.ee/kit/274/chapter/15509

</details>

<details><summary><code>g2q-0038</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10971
  - https://www.opiq.ee/kit/556/chapter/31280

</details>

<details><summary><code>g2q-0039</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10978
  - https://www.opiq.ee/kit/556/chapter/31287

</details>

<details><summary><code>g2q-0040</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10979
  - https://www.opiq.ee/kit/556/chapter/31288

</details>

<details><summary><code>g2q-0041</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10989
  - https://www.opiq.ee/kit/556/chapter/31298

</details>

<details><summary><code>g2q-0042</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10996
  - https://www.opiq.ee/kit/556/chapter/31305

</details>

<details><summary><code>g2q-0043</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/19530
  - https://www.opiq.ee/kit/556/chapter/31304

</details>

<details><summary><code>g2q-0044</code> — <code>duplicate_compact_content</code> — 2 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `музыка_–_волшебная_страна._2_класс`
- Kits: 238
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/238/chapter/13512
  - https://www.opiq.ee/kit/238/chapter/13513

</details>

<details><summary><code>g2q-0045</code> — <code>duplicate_compact_content</code> — 3 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-nature-and-human-studies`, `grade-2-russian`
- Books: `avita_природа_и__2_ru__kit86`, `avita_русский_язык_i_ступень_часть_3_kit568`, `koolibri_светлячок._2_ru`
- Kits: 454, 568, 86
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/454/chapter/24790
  - https://www.opiq.ee/kit/568/chapter/31807
  - https://www.opiq.ee/kit/86/chapter/12121

</details>

<details><summary><code>g2q-0046</code> — <code>duplicate_compact_content</code> — 3 distinct URLs have equal compact title, headings, and task examples.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-nature-and-human-studies`, `grade-2-russian`
- Books: `avita_природа_и__2_ru__kit86`, `avita_русский_язык_i_ступень_часть_3_kit568`, `koolibri_светлячок._2_ru`
- Kits: 454, 568, 86
- Action: Retain unless the underlying archived records also share a URL. The compact fields can legitimately match for glossaries, parallel youth programmes, editions, or repeated craft/music activities.
- Exact URLs:
  - https://www.opiq.ee/kit/454/chapter/24791
  - https://www.opiq.ee/kit/568/chapter/31808
  - https://www.opiq.ee/kit/86/chapter/4233

</details>

<details><summary><code>g2q-0047</code> — <code>duplicate_title</code> — Title “Nublu” occurs at 3 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-arts-and-crafts`, `grade-2-estonian`
- Books: `avita_eesti_keel_2_et`, `kunsti-_ja_tööõpetus._2._osa`
- Kits: 192, 232
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/192/chapter/10934
  - https://www.opiq.ee/kit/232/chapter/14137
  - https://www.opiq.ee/kit/232/chapter/19108

</details>

<details><summary><code>g2q-0048</code> — <code>duplicate_title</code> — Title “Talv” occurs at 3 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-arts-and-crafts`, `grade-2-music`
- Books: `kunsti-_ja_tööõpetus._2._osa`, `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 192, 193, 556
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/192/chapter/10913
  - https://www.opiq.ee/kit/193/chapter/10983
  - https://www.opiq.ee/kit/556/chapter/31292

</details>

<details><summary><code>g2q-0049</code> — <code>duplicate_title</code> — Title “Цветы” occurs at 3 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-arts-and-crafts`, `grade-2-science`
- Books: `koolibri_природове_2_ru`, `трудовое_обучение_и_искусство._2_часть`
- Kits: 132, 371
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/132/chapter/7077
  - https://www.opiq.ee/kit/371/chapter/20273
  - https://www.opiq.ee/kit/371/chapter/20338

</details>

<details><summary><code>g2q-0050</code> — <code>duplicate_title</code> — Title “Ruumiline kuusk” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-arts-and-crafts`
- Books: `kunsti-_ja_tööõpetus._2._osa`, `kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid`
- Kits: 192, 200
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/192/chapter/10891
  - https://www.opiq.ee/kit/200/chapter/11414

</details>

<details><summary><code>g2q-0051</code> — <code>duplicate_title</code> — Title “Lumikellukesed” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-arts-and-crafts`
- Books: `kunsti-_ja_tööõpetus._2._osa`, `kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid`
- Kits: 192, 200
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/192/chapter/10898
  - https://www.opiq.ee/kit/200/chapter/11444

</details>

<details><summary><code>g2q-0052</code> — <code>duplicate_title</code> — Title “Muffinivormidest kaart” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-arts-and-crafts`
- Books: `kunsti-_ja_tööõpetus._2._osa`, `kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid`
- Kits: 192, 200
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/192/chapter/10948
  - https://www.opiq.ee/kit/200/chapter/11439

</details>

<details><summary><code>g2q-0053</code> — <code>duplicate_title</code> — Title “Lill” occurs at 5 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-arts-and-crafts`
- Books: `kunsti-_ja_tööõpetus._2._osa`
- Kits: 192
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/192/chapter/10897
  - https://www.opiq.ee/kit/192/chapter/10917
  - https://www.opiq.ee/kit/192/chapter/10955
  - https://www.opiq.ee/kit/192/chapter/10966
  - https://www.opiq.ee/kit/192/chapter/10968

</details>

<details><summary><code>g2q-0054</code> — <code>duplicate_title</code> — Title “Tulp” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-arts-and-crafts`
- Books: `kunsti-_ja_tööõpetus._2._osa`
- Kits: 192
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/192/chapter/10916
  - https://www.opiq.ee/kit/192/chapter/10957

</details>

<details><summary><code>g2q-0055</code> — <code>duplicate_title</code> — Title “Liblikas” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-arts-and-crafts`
- Books: `kunsti-_ja_tööõpetus._2._osa`
- Kits: 192
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/192/chapter/10960
  - https://www.opiq.ee/kit/192/chapter/10969

</details>

<details><summary><code>g2q-0056</code> — <code>duplicate_title</code> — Title “Pop-up-tehnikas kaart” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-arts-and-crafts`
- Books: `kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid`
- Kits: 200
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/200/chapter/11399
  - https://www.opiq.ee/kit/200/chapter/11429

</details>

<details><summary><code>g2q-0057</code> — <code>duplicate_title</code> — Title “Volditud lill” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-arts-and-crafts`
- Books: `kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid`
- Kits: 200
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/200/chapter/11445
  - https://www.opiq.ee/kit/200/chapter/11446

</details>

<details><summary><code>g2q-0058</code> — <code>duplicate_title</code> — Title “Тюльпан” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-arts-and-crafts`
- Books: `трудовое_обучение_и_искусство._2_часть`
- Kits: 371
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/371/chapter/20292
  - https://www.opiq.ee/kit/371/chapter/20333

</details>

<details><summary><code>g2q-0059</code> — <code>duplicate_title</code> — Title “Цветок” occurs at 4 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-arts-and-crafts`
- Books: `трудовое_обучение_и_искусство._2_часть`
- Kits: 371
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/371/chapter/20293
  - https://www.opiq.ee/kit/371/chapter/20331
  - https://www.opiq.ee/kit/371/chapter/20342
  - https://www.opiq.ee/kit/371/chapter/20344

</details>

<details><summary><code>g2q-0060</code> — <code>duplicate_title</code> — Title “Бабочка” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-arts-and-crafts`
- Books: `трудовое_обучение_и_искусство._2_часть`
- Kits: 371
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/371/chapter/20336
  - https://www.opiq.ee/kit/371/chapter/20345

</details>

<details><summary><code>g2q-0061</code> — <code>duplicate_title</code> — Title “Jõulud” occurs at 6 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-estonian-second-language`, `grade-2-human-studies`, `grade-2-music`
- Books: `avita_loodus-_ja_2_et__kit56`, `eesti_pärimusmuusika_keskuse_õppevideod`, `koolibri_in2_2._kla_2_et__kit142`, `koolibri_koos_on_lõ_2_et`, `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 129, 142, 193, 465, 556, 56
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/129/chapter/6966
  - https://www.opiq.ee/kit/142/chapter/8003
  - https://www.opiq.ee/kit/193/chapter/10982
  - https://www.opiq.ee/kit/465/chapter/25305
  - https://www.opiq.ee/kit/556/chapter/31291
  - https://www.opiq.ee/kit/56/chapter/2771

</details>

<details><summary><code>g2q-0062</code> — <code>duplicate_title</code> — Title “Minu pere” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-estonian-second-language`, `grade-2-human-studies`
- Books: `harno_inimeseõpe_2_et__kit286`, `koolibri_koos_on_lõ_2_et`
- Kits: 129, 286
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/129/chapter/6952
  - https://www.opiq.ee/kit/286/chapter/16913

</details>

<details><summary><code>g2q-0063</code> — <code>duplicate_title</code> — Title “Sissejuhatus” occurs at 3 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-estonian-second-language`, `grade-2-science`
- Books: `avita_minu_väike_2_et`, `koolibri_koos_on_lõ_2_et`, `star cloud_loodusõpet_2_et`
- Kits: 129, 330, 384
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/129/chapter/6944
  - https://www.opiq.ee/kit/330/chapter/18522
  - https://www.opiq.ee/kit/384/chapter/20741

</details>

<details><summary><code>g2q-0064</code> — <code>duplicate_title</code> — Title “Nüüd ma oskan” occurs at 8 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-estonian-second-language`
- Books: `koolibri_koos_on_lõ_2_et`
- Kits: 129
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/129/chapter/6943
  - https://www.opiq.ee/kit/129/chapter/6951
  - https://www.opiq.ee/kit/129/chapter/6959
  - https://www.opiq.ee/kit/129/chapter/6967
  - https://www.opiq.ee/kit/129/chapter/6977
  - https://www.opiq.ee/kit/129/chapter/6987
  - https://www.opiq.ee/kit/129/chapter/6997
  - https://www.opiq.ee/kit/129/chapter/7007

</details>

<details><summary><code>g2q-0065</code> — <code>duplicate_title</code> — Title “Sõnaseletused” occurs at 5 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-estonian`, `grade-2-human-studies`, `grade-2-music`, `grade-2-russian`
- Books: `avita_eesti_keel_2_et`, `avita_inimeseõpe_2_et__kit494`, `avita_русский_язык_2_класс_kit292`, `eesti_pärimusmuusika_keskuse_õppevideod`, `koolibri_ilus_emake_2_et`
- Kits: 118, 232, 292, 465, 494
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/118/chapter/6032
  - https://www.opiq.ee/kit/232/chapter/13202
  - https://www.opiq.ee/kit/292/chapter/16173
  - https://www.opiq.ee/kit/465/chapter/25308
  - https://www.opiq.ee/kit/494/chapter/27195

</details>

<details><summary><code>g2q-0066</code> — <code>duplicate_title</code> — Title “HÄÄLIKUD JA TÄHED” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-estonian`
- Books: `koolibri_ilus_emake_2_et`, `koolibri_mina_loen__2_et`
- Kits: 118, 458
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/118/chapter/5869
  - https://www.opiq.ee/kit/458/chapter/24985

</details>

<details><summary><code>g2q-0067</code> — <code>duplicate_title</code> — Title “Kordamis- ja lisaharjutusi” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-estonian`
- Books: `koolibri_ilus_emake_2_et`
- Kits: 118
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/118/chapter/5928
  - https://www.opiq.ee/kit/118/chapter/6028

</details>

<details><summary><code>g2q-0068</code> — <code>duplicate_title</code> — Title “KORDAMINE” occurs at 3 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-estonian`
- Books: `koolibri_mina_loen__2_et`
- Kits: 458
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/458/chapter/24997
  - https://www.opiq.ee/kit/458/chapter/25008
  - https://www.opiq.ee/kit/458/chapter/25024

</details>

<details><summary><code>g2q-0069</code> — <code>duplicate_title</code> — Title “Kell” occurs at 3 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`, `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`, `harno_inimeseõpe_2_et__kit286`
- Kits: 286, 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/286/chapter/17082
  - https://www.opiq.ee/kit/578/chapter/33033
  - https://www.opiq.ee/kit/95/chapter/6419

</details>

<details><summary><code>g2q-0070</code> — <code>duplicate_title</code> — Title “Mõisted” occurs at 5 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`, `grade-2-music`, `grade-2-russian`
- Books: `avita_loodus-_ja_2_et__kit56`, `avita_русский_язык_2_класс_kit292`, `koolibri_русский_яз_2_ru`, `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 186, 193, 292, 556, 56
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/186/chapter/10462
  - https://www.opiq.ee/kit/193/chapter/10997
  - https://www.opiq.ee/kit/292/chapter/16172
  - https://www.opiq.ee/kit/556/chapter/31306
  - https://www.opiq.ee/kit/56/chapter/2773

</details>

<details><summary><code>g2q-0071</code> — <code>duplicate_title</code> — Title “Рождество” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`, `grade-2-nature-and-human-studies`
- Books: `avita_природа_и__2_ru__kit86`, `koolibri_мой_мир._ч_2_ru__kit229`
- Kits: 229, 86
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/229/chapter/13089
  - https://www.opiq.ee/kit/86/chapter/4212

</details>

<details><summary><code>g2q-0072</code> — <code>duplicate_title</code> — Title “Первая помощь” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`, `grade-2-nature-and-human-studies`
- Books: `avita_природа_и__2_ru__kit86`, `koolibri_мой_мир._ч_2_ru__kit229`
- Kits: 229, 86
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/229/chapter/13105
  - https://www.opiq.ee/kit/86/chapter/4203

</details>

<details><summary><code>g2q-0073</code> — <code>duplicate_title</code> — Title “Koduloomad” occurs at 5 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`, `grade-2-science`
- Books: `avita_loodus-_ja_2_et__kit56`, `avita_loodusõpet_2_et`, `avita_природовед_2_ru`, `koolibri_loodusõpet_2_et`, `skriibus_loodusõpet_2_et`
- Kits: 121, 379, 387, 56, 570
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/121/chapter/6228
  - https://www.opiq.ee/kit/379/chapter/20590
  - https://www.opiq.ee/kit/387/chapter/20902
  - https://www.opiq.ee/kit/56/chapter/7702
  - https://www.opiq.ee/kit/570/chapter/33143

</details>

<details><summary><code>g2q-0074</code> — <code>duplicate_title</code> — Title “Põõsad” occurs at 4 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`, `grade-2-science`
- Books: `avita_loodus-_ja_2_et__kit56`, `avita_loodusõpet_2_et`, `avita_природовед_2_ru`, `koolibri_loodusõpet_2_et`
- Kits: 121, 379, 56, 570
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/121/chapter/6203
  - https://www.opiq.ee/kit/379/chapter/20580
  - https://www.opiq.ee/kit/56/chapter/2755
  - https://www.opiq.ee/kit/570/chapter/31847

</details>

<details><summary><code>g2q-0075</code> — <code>duplicate_title</code> — Title “Inimene” occurs at 4 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`, `grade-2-science`
- Books: `avita_loodus-_ja_2_et__kit56`, `avita_loodusõpet_2_et`, `avita_природовед_2_ru`, `koolibri_loodusõpet_2_et`
- Kits: 121, 379, 56, 570
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/121/chapter/6242
  - https://www.opiq.ee/kit/379/chapter/20588
  - https://www.opiq.ee/kit/56/chapter/3350
  - https://www.opiq.ee/kit/570/chapter/33144

</details>

<details><summary><code>g2q-0076</code> — <code>duplicate_title</code> — Title “Eesti kaart” occurs at 3 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`, `grade-2-science`
- Books: `avita_loodus-_ja_2_et__kit56`, `avita_loodusõpet_2_et`, `avita_природовед_2_ru`
- Kits: 379, 56, 570
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/379/chapter/20576
  - https://www.opiq.ee/kit/56/chapter/7710
  - https://www.opiq.ee/kit/570/chapter/31843

</details>

<details><summary><code>g2q-0077</code> — <code>duplicate_title</code> — Title “Ilm” occurs at 3 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`, `grade-2-science`
- Books: `avita_loodus-_ja_2_et__kit56`, `avita_loodusõpet_2_et`, `avita_природовед_2_ru`
- Kits: 379, 56, 570
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/379/chapter/20582
  - https://www.opiq.ee/kit/56/chapter/2760
  - https://www.opiq.ee/kit/570/chapter/32084

</details>

<details><summary><code>g2q-0078</code> — <code>duplicate_title</code> — Title “Veekogud” occurs at 3 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`, `grade-2-science`
- Books: `avita_loodus-_ja_2_et__kit56`, `avita_loodusõpet_2_et`, `avita_природовед_2_ru`
- Kits: 379, 56, 570
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/379/chapter/20592
  - https://www.opiq.ee/kit/56/chapter/7705
  - https://www.opiq.ee/kit/570/chapter/33147

</details>

<details><summary><code>g2q-0079</code> — <code>duplicate_title</code> — Title “Põld” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`, `grade-2-science`
- Books: `avita_loodus-_ja_2_et__kit56`, `avita_loodusõpet_2_et`
- Kits: 379, 56
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/379/chapter/20595
  - https://www.opiq.ee/kit/56/chapter/7701

</details>

<details><summary><code>g2q-0080</code> — <code>duplicate_title</code> — Title “Rohttaimed” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`, `grade-2-science`
- Books: `avita_loodus-_ja_2_et__kit56`, `koolibri_loodusõpet_2_et`
- Kits: 121, 56
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/121/chapter/6205
  - https://www.opiq.ee/kit/56/chapter/7626

</details>

<details><summary><code>g2q-0081</code> — <code>duplicate_title</code> — Title “Lehtpuud” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`, `grade-2-science`
- Books: `avita_loodus-_ja_2_et__kit56`, `ministeerium_loodusõpet_2_et`
- Kits: 501, 56
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/501/chapter/27375
  - https://www.opiq.ee/kit/56/chapter/2753

</details>

<details><summary><code>g2q-0082</code> — <code>duplicate_title</code> — Title “Okaspuud” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`, `grade-2-science`
- Books: `avita_loodus-_ja_2_et__kit56`, `ministeerium_loodusõpet_2_et`
- Kits: 501, 56
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/501/chapter/27376
  - https://www.opiq.ee/kit/56/chapter/2754

</details>

<details><summary><code>g2q-0083</code> — <code>duplicate_title</code> — Title “Aasta” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`, `grade-2-science`
- Books: `harno_inimeseõpe_2_et__kit286`, `ministeerium_loodusõpet_2_et`
- Kits: 286, 501
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/286/chapter/17080
  - https://www.opiq.ee/kit/501/chapter/27405

</details>

<details><summary><code>g2q-0084</code> — <code>duplicate_title</code> — Title “Liikumine” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`, `grade-2-science`
- Books: `harno_inimeseõpe_2_et__kit286`, `ministeerium_loodusõpet_2_et`
- Kits: 286, 501
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/286/chapter/17527
  - https://www.opiq.ee/kit/501/chapter/27396

</details>

<details><summary><code>g2q-0085</code> — <code>duplicate_title</code> — Title “Здоровое питание” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`, `grade-2-science`
- Books: `koolibri_мой_мир._ч_2_ru__kit229`, `koolibri_природове_2_ru`
- Kits: 132, 229
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/132/chapter/7123
  - https://www.opiq.ee/kit/229/chapter/13102

</details>

<details><summary><code>g2q-0086</code> — <code>duplicate_title</code> — Title “LIIKLUS. LIIKLEMISE REEGLID” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`
- Books: `avita_inimeseõpe_2_et__kit494`, `avita_inimeseõpe_2_ru__kit579`
- Kits: 494, 579
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/494/chapter/27186
  - https://www.opiq.ee/kit/579/chapter/32046

</details>

<details><summary><code>g2q-0087</code> — <code>duplicate_title</code> — Title “LIIKLUS. ERILISED SÕIDUKID” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`
- Books: `avita_inimeseõpe_2_et__kit494`, `avita_inimeseõpe_2_ru__kit579`
- Kits: 494, 579
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/494/chapter/27187
  - https://www.opiq.ee/kit/579/chapter/32047

</details>

<details><summary><code>g2q-0088</code> — <code>duplicate_title</code> — Title “AJA PLANEERIMINE” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`
- Books: `avita_inimeseõpe_2_et__kit494`, `avita_inimeseõpe_2_ru__kit579`
- Kits: 494, 579
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/494/chapter/27190
  - https://www.opiq.ee/kit/579/chapter/32441

</details>

<details><summary><code>g2q-0089</code> — <code>duplicate_title</code> — Title “PERE JA SUGULASED” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`
- Books: `avita_inimeseõpe_2_et__kit494`, `avita_inimeseõpe_2_ru__kit579`
- Kits: 494, 579
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/494/chapter/27191
  - https://www.opiq.ee/kit/579/chapter/32442

</details>

<details><summary><code>g2q-0090</code> — <code>duplicate_title</code> — Title “NAABRID JA KOGUKOND” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`
- Books: `avita_inimeseõpe_2_et__kit494`, `avita_inimeseõpe_2_ru__kit579`
- Kits: 494, 579
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/494/chapter/27192
  - https://www.opiq.ee/kit/579/chapter/32443

</details>

<details><summary><code>g2q-0091</code> — <code>duplicate_title</code> — Title “INIMESE PÕHIVAJADUSED” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`
- Books: `avita_inimeseõpe_2_et__kit494`, `avita_inimeseõpe_2_ru__kit579`
- Kits: 494, 579
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/494/chapter/27833
  - https://www.opiq.ee/kit/579/chapter/32446

</details>

<details><summary><code>g2q-0092</code> — <code>duplicate_title</code> — Title “TERVISLIK PUHKUS JA UNI” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`
- Books: `avita_inimeseõpe_2_et__kit494`, `avita_inimeseõpe_2_ru__kit579`
- Kits: 494, 579
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/494/chapter/27834
  - https://www.opiq.ee/kit/579/chapter/32447

</details>

<details><summary><code>g2q-0093</code> — <code>duplicate_title</code> — Title “TERVISLIK TOITUMINE JA LIIKUMINE” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`
- Books: `avita_inimeseõpe_2_et__kit494`, `avita_inimeseõpe_2_ru__kit579`
- Kits: 494, 579
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/494/chapter/27835
  - https://www.opiq.ee/kit/579/chapter/32448

</details>

<details><summary><code>g2q-0094</code> — <code>duplicate_title</code> — Title “OHUD VABAL AJAL. ESMAABI I” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`
- Books: `avita_inimeseõpe_2_et__kit494`, `avita_inimeseõpe_2_ru__kit579`
- Kits: 494, 579
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/494/chapter/27836
  - https://www.opiq.ee/kit/579/chapter/32449

</details>

<details><summary><code>g2q-0095</code> — <code>duplicate_title</code> — Title “OHUD VABAL AJAL. ESMAABI II” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`
- Books: `avita_inimeseõpe_2_et__kit494`, `avita_inimeseõpe_2_ru__kit579`
- Kits: 494, 579
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/494/chapter/27837
  - https://www.opiq.ee/kit/579/chapter/32450

</details>

<details><summary><code>g2q-0096</code> — <code>duplicate_title</code> — Title “MIKS ME JÄÄME HAIGEKS?” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`
- Books: `avita_inimeseõpe_2_et__kit494`, `avita_inimeseõpe_2_ru__kit579`
- Kits: 494, 579
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/494/chapter/27838
  - https://www.opiq.ee/kit/579/chapter/32451

</details>

<details><summary><code>g2q-0097</code> — <code>duplicate_title</code> — Title “KUIDAS ME PARANEME?” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`
- Books: `avita_inimeseõpe_2_et__kit494`, `avita_inimeseõpe_2_ru__kit579`
- Kits: 494, 579
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/494/chapter/27839
  - https://www.opiq.ee/kit/579/chapter/32452

</details>

<details><summary><code>g2q-0098</code> — <code>duplicate_title</code> — Title “HAMMASTE TERVIS” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`
- Books: `avita_inimeseõpe_2_et__kit494`, `avita_inimeseõpe_2_ru__kit579`
- Kits: 494, 579
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/494/chapter/27840
  - https://www.opiq.ee/kit/579/chapter/32453

</details>

<details><summary><code>g2q-0099</code> — <code>duplicate_title</code> — Title “JÕULUKOMBED” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`
- Books: `avita_inimeseõpe_2_et__kit494`, `avita_inimeseõpe_2_ru__kit579`
- Kits: 494, 579
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/494/chapter/28143
  - https://www.opiq.ee/kit/579/chapter/32454

</details>

<details><summary><code>g2q-0100</code> — <code>duplicate_title</code> — Title “TALU” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`
- Books: `avita_inimeseõpe_2_et__kit494`, `avita_inimeseõpe_2_ru__kit579`
- Kits: 494, 579
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/494/chapter/28144
  - https://www.opiq.ee/kit/579/chapter/33048

</details>

<details><summary><code>g2q-0101</code> — <code>duplicate_title</code> — Title “TALUHOONED” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`
- Books: `avita_inimeseõpe_2_et__kit494`, `avita_inimeseõpe_2_ru__kit579`
- Kits: 494, 579
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/494/chapter/28145
  - https://www.opiq.ee/kit/579/chapter/33049

</details>

<details><summary><code>g2q-0102</code> — <code>duplicate_title</code> — Title “TALUPERE” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`
- Books: `avita_inimeseõpe_2_et__kit494`, `avita_inimeseõpe_2_ru__kit579`
- Kits: 494, 579
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/494/chapter/28146
  - https://www.opiq.ee/kit/579/chapter/33050

</details>

<details><summary><code>g2q-0103</code> — <code>duplicate_title</code> — Title “MÕIS” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`
- Books: `avita_inimeseõpe_2_et__kit494`, `avita_inimeseõpe_2_ru__kit579`
- Kits: 494, 579
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/494/chapter/28147
  - https://www.opiq.ee/kit/579/chapter/33388

</details>

<details><summary><code>g2q-0104</code> — <code>duplicate_title</code> — Title “LINNAELU” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`
- Books: `avita_inimeseõpe_2_et__kit494`, `avita_inimeseõpe_2_ru__kit579`
- Kits: 494, 579
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/494/chapter/28148
  - https://www.opiq.ee/kit/579/chapter/33389

</details>

<details><summary><code>g2q-0105</code> — <code>duplicate_title</code> — Title “Esmaabi” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`
- Books: `avita_loodus-_ja_2_et__kit56`, `koolibri_in2_2._kla_2_et__kit142`
- Kits: 142, 56
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/142/chapter/8019
  - https://www.opiq.ee/kit/56/chapter/2762

</details>

<details><summary><code>g2q-0106</code> — <code>duplicate_title</code> — Title “Mina” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`
- Books: `harno_inimeseõpe_2_et__kit286`, `koolibri_in2_2._kla_2_et__kit142`
- Kits: 142, 286
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/142/chapter/7988
  - https://www.opiq.ee/kit/286/chapter/15951

</details>

<details><summary><code>g2q-0107</code> — <code>duplicate_title</code> — Title “Tean ja oskan” occurs at 8 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`
- Books: `koolibri_in2_2._kla_2_et__kit142`
- Kits: 142
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/142/chapter/7993
  - https://www.opiq.ee/kit/142/chapter/7998
  - https://www.opiq.ee/kit/142/chapter/8002
  - https://www.opiq.ee/kit/142/chapter/8006
  - https://www.opiq.ee/kit/142/chapter/8008
  - https://www.opiq.ee/kit/142/chapter/8013
  - https://www.opiq.ee/kit/142/chapter/8020
  - https://www.opiq.ee/kit/142/chapter/8023

</details>

<details><summary><code>g2q-0108</code> — <code>duplicate_title</code> — Title “Знаю и умею” occurs at 8 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-human-studies`
- Books: `koolibri_мой_мир._ч_2_ru__kit229`
- Kits: 229
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/229/chapter/13079
  - https://www.opiq.ee/kit/229/chapter/13084
  - https://www.opiq.ee/kit/229/chapter/13088
  - https://www.opiq.ee/kit/229/chapter/13092
  - https://www.opiq.ee/kit/229/chapter/13094
  - https://www.opiq.ee/kit/229/chapter/13099
  - https://www.opiq.ee/kit/229/chapter/13106
  - https://www.opiq.ee/kit/229/chapter/13109

</details>

<details><summary><code>g2q-0109</code> — <code>duplicate_title</code> — Title “Selgitab eakohaselt, mis on Kaitseliit ning teab, kes kuuluvad Kaitseliitu” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33590
  - https://www.opiq.ee/kit/594/chapter/33623

</details>

<details><summary><code>g2q-0110</code> — <code>duplicate_title</code> — Title “Teab rivikäsklusi ning oskab nende järgi liikuda” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33595
  - https://www.opiq.ee/kit/594/chapter/33628

</details>

<details><summary><code>g2q-0111</code> — <code>duplicate_title</code> — Title “Teab, mis on matkamine” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33596
  - https://www.opiq.ee/kit/594/chapter/33629

</details>

<details><summary><code>g2q-0112</code> — <code>duplicate_title</code> — Title “Osaleb koos juhendajaga rahulikus tempos matkal” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33597
  - https://www.opiq.ee/kit/594/chapter/33630

</details>

<details><summary><code>g2q-0113</code> — <code>duplicate_title</code> — Title “On osalenud laagris” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33598
  - https://www.opiq.ee/kit/594/chapter/33631

</details>

<details><summary><code>g2q-0114</code> — <code>duplicate_title</code> — Title “Oskab teha kingapaelasõlme” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33599
  - https://www.opiq.ee/kit/594/chapter/33633

</details>

<details><summary><code>g2q-0115</code> — <code>duplicate_title</code> — Title “Teab häirekeskuse numbrit ja oskab edastada hädaabikutset” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33600
  - https://www.opiq.ee/kit/594/chapter/33634

</details>

<details><summary><code>g2q-0116</code> — <code>duplicate_title</code> — Title “Oskab anda esmaabi pisihaavade ja ninaverejooksu korral” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33601
  - https://www.opiq.ee/kit/594/chapter/33635

</details>

<details><summary><code>g2q-0117</code> — <code>duplicate_title</code> — Title “Oskab käituda linnaruumis ja avalikes kohtades” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33602
  - https://www.opiq.ee/kit/594/chapter/33636

</details>

<details><summary><code>g2q-0118</code> — <code>duplicate_title</code> — Title “Järgib looduses viibides turvalise käitumise põhimõtteid” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33603
  - https://www.opiq.ee/kit/594/chapter/33637

</details>

<details><summary><code>g2q-0119</code> — <code>duplicate_title</code> — Title “Teab, kuidas käituda tulekahju korral” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33604
  - https://www.opiq.ee/kit/594/chapter/33638

</details>

<details><summary><code>g2q-0120</code> — <code>duplicate_title</code> — Title “Teab oma koduaadressi ja vanema kontaktandmeid” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33605
  - https://www.opiq.ee/kit/594/chapter/33639

</details>

<details><summary><code>g2q-0121</code> — <code>duplicate_title</code> — Title “Tunneb Eesti Vabariigi sümboleid (vapp ja rahvussümbolid)” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33606
  - https://www.opiq.ee/kit/594/chapter/33640

</details>

<details><summary><code>g2q-0122</code> — <code>duplicate_title</code> — Title “Teab, millal on Eesti iseseisvuspäev” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33607
  - https://www.opiq.ee/kit/594/chapter/33641

</details>

<details><summary><code>g2q-0123</code> — <code>duplicate_title</code> — Title “Tunneb Eesti lippu” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33608
  - https://www.opiq.ee/kit/594/chapter/33642

</details>

<details><summary><code>g2q-0124</code> — <code>duplicate_title</code> — Title “Laulab koos kaaslastega Eesti Vabariigi hümni” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33609
  - https://www.opiq.ee/kit/594/chapter/33643

</details>

<details><summary><code>g2q-0125</code> — <code>duplicate_title</code> — Title “Nimetab Eesti Vabariigi presidendi” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33610
  - https://www.opiq.ee/kit/594/chapter/33644

</details>

<details><summary><code>g2q-0126</code> — <code>duplicate_title</code> — Title “On osalenud riiklike tähtpäevade tähistamisel” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33611
  - https://www.opiq.ee/kit/594/chapter/33645

</details>

<details><summary><code>g2q-0127</code> — <code>duplicate_title</code> — Title “Tunneb ära ja nimetab kolm erinevat puud, põõsast, rohttaime, looma ning seent” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33612
  - https://www.opiq.ee/kit/594/chapter/33632

</details>

<details><summary><code>g2q-0128</code> — <code>duplicate_title</code> — Title “Tuleb vähemalt kolmele väljaõppeüritusele jala või osaleb rühmas kolmel kehalist aktiivsust nõudval tegevusel” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-kodututarde-training`, `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`, `kodutütarde_i_järk_(2026)`
- Kits: 593, 594
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33616
  - https://www.opiq.ee/kit/594/chapter/33646

</details>

<details><summary><code>g2q-0129</code> — <code>duplicate_title</code> — Title “Повторение” occurs at 7 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`, `grade-2-russian`
- Books: `avita_математика_2_ru__kit165`, `avita_русский_язык_i_ступень_часть_3_kit568`, `koolibri_математика_2_et__kit361`
- Kits: 165, 361, 568
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/165/chapter/9267
  - https://www.opiq.ee/kit/165/chapter/9297
  - https://www.opiq.ee/kit/165/chapter/9323
  - https://www.opiq.ee/kit/165/chapter/9330
  - https://www.opiq.ee/kit/361/chapter/19883
  - https://www.opiq.ee/kit/568/chapter/31776
  - https://www.opiq.ee/kit/568/chapter/31796

</details>

<details><summary><code>g2q-0130</code> — <code>duplicate_title</code> — Title “Повторение (1)” occurs at 6 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`, `grade-2-russian`
- Books: `avita_русский_язык_2_класс_kit292`, `koolibri_математика_2_et__kit361`
- Kits: 292, 361
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/292/chapter/16111
  - https://www.opiq.ee/kit/292/chapter/16141
  - https://www.opiq.ee/kit/292/chapter/17761
  - https://www.opiq.ee/kit/292/chapter/17811
  - https://www.opiq.ee/kit/361/chapter/19849
  - https://www.opiq.ee/kit/361/chapter/19877

</details>

<details><summary><code>g2q-0131</code> — <code>duplicate_title</code> — Title “Повторение (2)” occurs at 6 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`, `grade-2-russian`
- Books: `avita_русский_язык_2_класс_kit292`, `koolibri_математика_2_et__kit361`
- Kits: 292, 361
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/292/chapter/16112
  - https://www.opiq.ee/kit/292/chapter/16142
  - https://www.opiq.ee/kit/292/chapter/17762
  - https://www.opiq.ee/kit/292/chapter/17812
  - https://www.opiq.ee/kit/361/chapter/19850
  - https://www.opiq.ee/kit/361/chapter/19878

</details>

<details><summary><code>g2q-0132</code> — <code>duplicate_title</code> — Title “Проверь себя!” occurs at 7 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`, `grade-2-russian`
- Books: `avita_русский_язык_2_класс_kit292`, `koolibri_математика_2_et__kit361`
- Kits: 292, 361
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/292/chapter/16122
  - https://www.opiq.ee/kit/292/chapter/16151
  - https://www.opiq.ee/kit/292/chapter/17763
  - https://www.opiq.ee/kit/292/chapter/17781
  - https://www.opiq.ee/kit/292/chapter/17813
  - https://www.opiq.ee/kit/292/chapter/17834
  - https://www.opiq.ee/kit/361/chapter/19884

</details>

<details><summary><code>g2q-0133</code> — <code>duplicate_title</code> — Title “Eesti-vene sõnastik” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`, `grade-2-science`
- Books: `avita_математика_2_et__kit578`, `avita_природовед_2_ru`
- Kits: 570, 578
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/570/chapter/31849
  - https://www.opiq.ee/kit/578/chapter/32233

</details>

<details><summary><code>g2q-0134</code> — <code>duplicate_title</code> — Title “Vene-eesti sõnastik” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`, `grade-2-science`
- Books: `avita_математика_2_et__kit578`, `avita_природовед_2_ru`
- Kits: 570, 578
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/570/chapter/31850
  - https://www.opiq.ee/kit/578/chapter/32234

</details>

<details><summary><code>g2q-0135</code> — <code>duplicate_title</code> — Title “Aeg” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`, `grade-2-science`
- Books: `harno_matemaatik_2_et__kit272`, `ministeerium_loodusõpet_2_et`
- Kits: 272, 501
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/272/chapter/15427
  - https://www.opiq.ee/kit/501/chapter/27371

</details>

<details><summary><code>g2q-0136</code> — <code>duplicate_title</code> — Title “Взвешивание” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`, `grade-2-science`
- Books: `koolibri_математика_2_et__kit361`, `koolibri_природове_2_ru`
- Kits: 132, 361
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/132/chapter/7121
  - https://www.opiq.ee/kit/361/chapter/19854

</details>

<details><summary><code>g2q-0137</code> — <code>duplicate_title</code> — Title “Kordamine” occurs at 7 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`, `harno_matemaatik_2_et__kit274`, `koolibri_matemaatik_2_et__kit107`
- Kits: 107, 274, 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/107/chapter/10763
  - https://www.opiq.ee/kit/274/chapter/15507
  - https://www.opiq.ee/kit/578/chapter/32028
  - https://www.opiq.ee/kit/578/chapter/33035
  - https://www.opiq.ee/kit/95/chapter/4645
  - https://www.opiq.ee/kit/95/chapter/6421
  - https://www.opiq.ee/kit/95/chapter/6447

</details>

<details><summary><code>g2q-0138</code> — <code>duplicate_title</code> — Title “Liitmine ja lahutamine 20 piires” occurs at 3 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`, `harno_matemaatik_2_et__kit274`
- Kits: 274, 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/274/chapter/15491
  - https://www.opiq.ee/kit/578/chapter/32033
  - https://www.opiq.ee/kit/95/chapter/4618

</details>

<details><summary><code>g2q-0139</code> — <code>duplicate_title</code> — Title “Korrutamine arvuga 4” occurs at 3 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`, `koolibri_matemaatik_2_et__kit107`
- Kits: 107, 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/107/chapter/10750
  - https://www.opiq.ee/kit/578/chapter/33034
  - https://www.opiq.ee/kit/95/chapter/6420

</details>

<details><summary><code>g2q-0140</code> — <code>duplicate_title</code> — Title “Arvud tuhandeni” occurs at 3 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`, `koolibri_matemaatik_2_et__kit107`
- Kits: 107, 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/107/chapter/10759
  - https://www.opiq.ee/kit/578/chapter/33004
  - https://www.opiq.ee/kit/95/chapter/6403

</details>

<details><summary><code>g2q-0141</code> — <code>duplicate_title</code> — Title “Arvude järjestamine” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32029
  - https://www.opiq.ee/kit/95/chapter/4614

</details>

<details><summary><code>g2q-0142</code> — <code>duplicate_title</code> — Title “Kümnelised ja ühelised (1)” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32030
  - https://www.opiq.ee/kit/95/chapter/4615

</details>

<details><summary><code>g2q-0143</code> — <code>duplicate_title</code> — Title “Kümnelised ja ühelised (2)” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32031
  - https://www.opiq.ee/kit/95/chapter/4616

</details>

<details><summary><code>g2q-0144</code> — <code>duplicate_title</code> — Title “Arvude võrdlemine” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32032
  - https://www.opiq.ee/kit/95/chapter/4617

</details>

<details><summary><code>g2q-0145</code> — <code>duplicate_title</code> — Title “Liitmine 20 piires” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32034
  - https://www.opiq.ee/kit/95/chapter/4619

</details>

<details><summary><code>g2q-0146</code> — <code>duplicate_title</code> — Title “Lahutamine 20 piires” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32035
  - https://www.opiq.ee/kit/95/chapter/4620

</details>

<details><summary><code>g2q-0147</code> — <code>duplicate_title</code> — Title “Liitmise ja lahutamise seos” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32036
  - https://www.opiq.ee/kit/95/chapter/4621

</details>

<details><summary><code>g2q-0148</code> — <code>duplicate_title</code> — Title “Kordamine. Arvude võrdlemine, liitmine ja lahutamine 20 piires” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32037
  - https://www.opiq.ee/kit/95/chapter/4622

</details>

<details><summary><code>g2q-0149</code> — <code>duplicate_title</code> — Title “Sirglõik” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32038
  - https://www.opiq.ee/kit/95/chapter/4623

</details>

<details><summary><code>g2q-0150</code> — <code>duplicate_title</code> — Title “Sirglõik. Millimeeter” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32039
  - https://www.opiq.ee/kit/95/chapter/4624

</details>

<details><summary><code>g2q-0151</code> — <code>duplicate_title</code> — Title “Pikkuse mõõtmine millimeetrites” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32040
  - https://www.opiq.ee/kit/95/chapter/4625

</details>

<details><summary><code>g2q-0152</code> — <code>duplicate_title</code> — Title “Kordamine. Sirglõigu pikkus, arvutamine 20 piires” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32197
  - https://www.opiq.ee/kit/95/chapter/4646

</details>

<details><summary><code>g2q-0153</code> — <code>duplicate_title</code> — Title “Kujundid” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32198
  - https://www.opiq.ee/kit/95/chapter/4647

</details>

<details><summary><code>g2q-0154</code> — <code>duplicate_title</code> — Title “Täisnurk” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32199
  - https://www.opiq.ee/kit/95/chapter/6401

</details>

<details><summary><code>g2q-0155</code> — <code>duplicate_title</code> — Title “Nelinurgad” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32200
  - https://www.opiq.ee/kit/95/chapter/6402

</details>

<details><summary><code>g2q-0156</code> — <code>duplicate_title</code> — Title “Ristkülik” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32201
  - https://www.opiq.ee/kit/95/chapter/20831

</details>

<details><summary><code>g2q-0157</code> — <code>duplicate_title</code> — Title “Ruut” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32202
  - https://www.opiq.ee/kit/95/chapter/20832

</details>

<details><summary><code>g2q-0158</code> — <code>duplicate_title</code> — Title “Ringjoon, ring, ringjoone keskpunkt” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32203
  - https://www.opiq.ee/kit/95/chapter/6408

</details>

<details><summary><code>g2q-0159</code> — <code>duplicate_title</code> — Title “Kolmnurk” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32204
  - https://www.opiq.ee/kit/95/chapter/20833

</details>

<details><summary><code>g2q-0160</code> — <code>duplicate_title</code> — Title “Täisnurkne kolmnurk” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32205
  - https://www.opiq.ee/kit/95/chapter/20834

</details>

<details><summary><code>g2q-0161</code> — <code>duplicate_title</code> — Title “Võrdhaarne kolmnurk” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32206
  - https://www.opiq.ee/kit/95/chapter/20835

</details>

<details><summary><code>g2q-0162</code> — <code>duplicate_title</code> — Title “Võrdkülgne kolmnurk” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32207
  - https://www.opiq.ee/kit/95/chapter/20836

</details>

<details><summary><code>g2q-0163</code> — <code>duplicate_title</code> — Title “Romb” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32208
  - https://www.opiq.ee/kit/95/chapter/20837

</details>

<details><summary><code>g2q-0164</code> — <code>duplicate_title</code> — Title “Täht arvu tähisena” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32210
  - https://www.opiq.ee/kit/95/chapter/4650

</details>

<details><summary><code>g2q-0165</code> — <code>duplicate_title</code> — Title “Ühelised, kümnelised, sajalised” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32211
  - https://www.opiq.ee/kit/95/chapter/4629

</details>

<details><summary><code>g2q-0166</code> — <code>duplicate_title</code> — Title “Kahekohaline arv kümneliste ja üheliste summana” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32212
  - https://www.opiq.ee/kit/95/chapter/4651

</details>

<details><summary><code>g2q-0167</code> — <code>duplicate_title</code> — Title “Täiskümnetest üheliste lahutamine” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32213
  - https://www.opiq.ee/kit/95/chapter/4630

</details>

<details><summary><code>g2q-0168</code> — <code>duplicate_title</code> — Title “Liitmine 100 piires üleminekuta” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32214
  - https://www.opiq.ee/kit/95/chapter/4632

</details>

<details><summary><code>g2q-0169</code> — <code>duplicate_title</code> — Title “Lahutamine 100 piires üleminekuta” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32215
  - https://www.opiq.ee/kit/95/chapter/4633

</details>

<details><summary><code>g2q-0170</code> — <code>duplicate_title</code> — Title “Järgmine kümme täis” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32216
  - https://www.opiq.ee/kit/95/chapter/4634

</details>

<details><summary><code>g2q-0171</code> — <code>duplicate_title</code> — Title “Meeter, sentimeeter” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32219
  - https://www.opiq.ee/kit/95/chapter/4635

</details>

<details><summary><code>g2q-0172</code> — <code>duplicate_title</code> — Title “Detsimeeter” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32220
  - https://www.opiq.ee/kit/95/chapter/4636

</details>

<details><summary><code>g2q-0173</code> — <code>duplicate_title</code> — Title “Pikkusühikud: m, dm, cm, mm” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32221
  - https://www.opiq.ee/kit/95/chapter/4637

</details>

<details><summary><code>g2q-0174</code> — <code>duplicate_title</code> — Title “Liitmine 100 piires üleminekuga (1)” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32223
  - https://www.opiq.ee/kit/95/chapter/4639

</details>

<details><summary><code>g2q-0175</code> — <code>duplicate_title</code> — Title “Liitmine 100 piires üleminekuga (2)” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32224
  - https://www.opiq.ee/kit/95/chapter/4652

</details>

<details><summary><code>g2q-0176</code> — <code>duplicate_title</code> — Title “Kalender (1)” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32225
  - https://www.opiq.ee/kit/95/chapter/4640

</details>

<details><summary><code>g2q-0177</code> — <code>duplicate_title</code> — Title “Kalender (2)” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32226
  - https://www.opiq.ee/kit/95/chapter/4641

</details>

<details><summary><code>g2q-0178</code> — <code>duplicate_title</code> — Title “Tund, minut” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32227
  - https://www.opiq.ee/kit/95/chapter/4642

</details>

<details><summary><code>g2q-0179</code> — <code>duplicate_title</code> — Title “Sekund” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32228
  - https://www.opiq.ee/kit/95/chapter/4643

</details>

<details><summary><code>g2q-0180</code> — <code>duplicate_title</code> — Title “Kordamine. Ajaühikud, kestus” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32229
  - https://www.opiq.ee/kit/95/chapter/21054

</details>

<details><summary><code>g2q-0181</code> — <code>duplicate_title</code> — Title “Kordamine. Jõulud (1)” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32230
  - https://www.opiq.ee/kit/95/chapter/4644

</details>

<details><summary><code>g2q-0182</code> — <code>duplicate_title</code> — Title “Kordamine. Jõulud (2)” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32231
  - https://www.opiq.ee/kit/95/chapter/4653

</details>

<details><summary><code>g2q-0183</code> — <code>duplicate_title</code> — Title “Matemaatilised pähklid” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32232
  - https://www.opiq.ee/kit/95/chapter/4654

</details>

<details><summary><code>g2q-0184</code> — <code>duplicate_title</code> — Title “Arvude 0–1000 võrdlemine” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33005
  - https://www.opiq.ee/kit/95/chapter/6404

</details>

<details><summary><code>g2q-0185</code> — <code>duplicate_title</code> — Title “Täiskümnete ja ‑sadade liitmine 1000 piires” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33006
  - https://www.opiq.ee/kit/95/chapter/6405

</details>

<details><summary><code>g2q-0186</code> — <code>duplicate_title</code> — Title “Täiskümnete ja ‑sadade lahutamine 1000 piires” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33007
  - https://www.opiq.ee/kit/95/chapter/6406

</details>

<details><summary><code>g2q-0187</code> — <code>duplicate_title</code> — Title “Kilomeeter” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33008
  - https://www.opiq.ee/kit/95/chapter/6407

</details>

<details><summary><code>g2q-0188</code> — <code>duplicate_title</code> — Title “Kordamine. Arvud tuhandeni, kilomeeter” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33009
  - https://www.opiq.ee/kit/95/chapter/6409

</details>

<details><summary><code>g2q-0189</code> — <code>duplicate_title</code> — Title “Liitmine 100 piires (3)” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33010
  - https://www.opiq.ee/kit/95/chapter/6411

</details>

<details><summary><code>g2q-0190</code> — <code>duplicate_title</code> — Title “Liitmine 100 piires (4)” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33011
  - https://www.opiq.ee/kit/95/chapter/6412

</details>

<details><summary><code>g2q-0191</code> — <code>duplicate_title</code> — Title “Lahutamine 100 piires” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33012
  - https://www.opiq.ee/kit/95/chapter/6439

</details>

<details><summary><code>g2q-0192</code> — <code>duplicate_title</code> — Title “Lahutamine 100 piires üleminekuga (1)” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33013
  - https://www.opiq.ee/kit/95/chapter/6413

</details>

<details><summary><code>g2q-0193</code> — <code>duplicate_title</code> — Title “Lahutamine 100 piires üleminekuga (2)” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33014
  - https://www.opiq.ee/kit/95/chapter/6414

</details>

<details><summary><code>g2q-0194</code> — <code>duplicate_title</code> — Title “Kilogramm, gramm (1)” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33015
  - https://www.opiq.ee/kit/95/chapter/6440

</details>

<details><summary><code>g2q-0195</code> — <code>duplicate_title</code> — Title “Kilogramm, gramm (2)” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33016
  - https://www.opiq.ee/kit/95/chapter/6441

</details>

<details><summary><code>g2q-0196</code> — <code>duplicate_title</code> — Title “Kordamine. Liitmine ja lahutamine 100 piires, kilogramm, gramm” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33017
  - https://www.opiq.ee/kit/95/chapter/6415

</details>

<details><summary><code>g2q-0197</code> — <code>duplicate_title</code> — Title “Risttahukas ja kuup” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33018
  - https://www.opiq.ee/kit/95/chapter/4627

</details>

<details><summary><code>g2q-0198</code> — <code>duplicate_title</code> — Title “Mis on pinnalaotus?” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33019
  - https://www.opiq.ee/kit/95/chapter/21353

</details>

<details><summary><code>g2q-0199</code> — <code>duplicate_title</code> — Title “Püramiid” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33020
  - https://www.opiq.ee/kit/95/chapter/4628

</details>

<details><summary><code>g2q-0200</code> — <code>duplicate_title</code> — Title “Silinder, koonus, kera” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33021
  - https://www.opiq.ee/kit/95/chapter/4626

</details>

<details><summary><code>g2q-0201</code> — <code>duplicate_title</code> — Title “Kordamine. Ruumilised kujundid” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33022
  - https://www.opiq.ee/kit/95/chapter/20830

</details>

<details><summary><code>g2q-0202</code> — <code>duplicate_title</code> — Title “Kordamine. Liitmine ja lahutamine 100 piires” occurs at 3 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33023
  - https://www.opiq.ee/kit/95/chapter/6438
  - https://www.opiq.ee/kit/95/chapter/6452

</details>

<details><summary><code>g2q-0203</code> — <code>duplicate_title</code> — Title “Kordamine. Nelinurgad, arvutamine täiskümnete ja ‑sadadega, pikkusühikud” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33024
  - https://www.opiq.ee/kit/95/chapter/6410

</details>

<details><summary><code>g2q-0204</code> — <code>duplicate_title</code> — Title “Kordamine. Ristkülik, ruut, kolmnurk, ring” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33025
  - https://www.opiq.ee/kit/95/chapter/21352

</details>

<details><summary><code>g2q-0205</code> — <code>duplicate_title</code> — Title “Korrutamise seos liitmisega” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33026
  - https://www.opiq.ee/kit/95/chapter/6442

</details>

<details><summary><code>g2q-0206</code> — <code>duplicate_title</code> — Title “Korrutamise seadus” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33027
  - https://www.opiq.ee/kit/95/chapter/6416

</details>

<details><summary><code>g2q-0207</code> — <code>duplicate_title</code> — Title “Korrutamine arvuga 2 (1)” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33028
  - https://www.opiq.ee/kit/95/chapter/6417

</details>

<details><summary><code>g2q-0208</code> — <code>duplicate_title</code> — Title “Korrutamine arvuga 2 (2)” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33029
  - https://www.opiq.ee/kit/95/chapter/6443

</details>

<details><summary><code>g2q-0209</code> — <code>duplicate_title</code> — Title “Korrutamine arvuga 3 (1)” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33030
  - https://www.opiq.ee/kit/95/chapter/6418

</details>

<details><summary><code>g2q-0210</code> — <code>duplicate_title</code> — Title “Korrutamine arvuga 3 (2)” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33031
  - https://www.opiq.ee/kit/95/chapter/6444

</details>

<details><summary><code>g2q-0211</code> — <code>duplicate_title</code> — Title “Pool” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `avita_математика_2_et__kit578`
- Kits: 578, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/33032
  - https://www.opiq.ee/kit/95/chapter/6445

</details>

<details><summary><code>g2q-0212</code> — <code>duplicate_title</code> — Title “Korrutamine arvuga 5” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `koolibri_matemaatik_2_et__kit107`
- Kits: 107, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/107/chapter/10751
  - https://www.opiq.ee/kit/95/chapter/6429

</details>

<details><summary><code>g2q-0213</code> — <code>duplicate_title</code> — Title “Jagamine arvuga 2” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `koolibri_matemaatik_2_et__kit107`
- Kits: 107, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/107/chapter/10753
  - https://www.opiq.ee/kit/95/chapter/6423

</details>

<details><summary><code>g2q-0214</code> — <code>duplicate_title</code> — Title “Jagamine arvuga 3” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `koolibri_matemaatik_2_et__kit107`
- Kits: 107, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/107/chapter/10754
  - https://www.opiq.ee/kit/95/chapter/6424

</details>

<details><summary><code>g2q-0215</code> — <code>duplicate_title</code> — Title “Jagamine arvuga 4” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `koolibri_matemaatik_2_et__kit107`
- Kits: 107, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/107/chapter/10755
  - https://www.opiq.ee/kit/95/chapter/6426

</details>

<details><summary><code>g2q-0216</code> — <code>duplicate_title</code> — Title “Jagamine arvuga 5” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_matemaatik_2_et__kit95`, `koolibri_matemaatik_2_et__kit107`
- Kits: 107, 95
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/107/chapter/10756
  - https://www.opiq.ee/kit/95/chapter/6430

</details>

<details><summary><code>g2q-0217</code> — <code>duplicate_title</code> — Title “Деление на число 2” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_математика_2_ru__kit165`, `koolibri_математика_2_et__kit361`
- Kits: 165, 361
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/165/chapter/9299
  - https://www.opiq.ee/kit/361/chapter/19873

</details>

<details><summary><code>g2q-0218</code> — <code>duplicate_title</code> — Title “Деление на число 3” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_математика_2_ru__kit165`, `koolibri_математика_2_et__kit361`
- Kits: 165, 361
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/165/chapter/9300
  - https://www.opiq.ee/kit/361/chapter/19874

</details>

<details><summary><code>g2q-0219</code> — <code>duplicate_title</code> — Title “Деление на число 4” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_математика_2_ru__kit165`, `koolibri_математика_2_et__kit361`
- Kits: 165, 361
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/165/chapter/9302
  - https://www.opiq.ee/kit/361/chapter/19875

</details>

<details><summary><code>g2q-0220</code> — <code>duplicate_title</code> — Title “Деление на число 5” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_математика_2_ru__kit165`, `koolibri_математика_2_et__kit361`
- Kits: 165, 361
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/165/chapter/9306
  - https://www.opiq.ee/kit/361/chapter/19876

</details>

<details><summary><code>g2q-0221</code> — <code>duplicate_title</code> — Title “Повторение. Сложение и вычитание в пределах 100” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `avita_математика_2_ru__kit165`
- Kits: 165
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/165/chapter/9314
  - https://www.opiq.ee/kit/165/chapter/9328

</details>

<details><summary><code>g2q-0222</code> — <code>duplicate_title</code> — Title “Metoodilised juhised õpetajale õppevara kasutamiseks” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `harno_matemaatik_2_et__kit273`, `harno_matemaatik_2_et__kit274`
- Kits: 273, 274
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/273/chapter/15475
  - https://www.opiq.ee/kit/274/chapter/15509

</details>

<details><summary><code>g2q-0223</code> — <code>duplicate_title</code> — Title “Ülesanded 1–5” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `koolibri_matemaatik_2_et__kit107`
- Kits: 107
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/107/chapter/10740
  - https://www.opiq.ee/kit/107/chapter/10765

</details>

<details><summary><code>g2q-0224</code> — <code>duplicate_title</code> — Title “Ülesanded 6–10” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `koolibri_matemaatik_2_et__kit107`
- Kits: 107
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/107/chapter/10741
  - https://www.opiq.ee/kit/107/chapter/10766

</details>

<details><summary><code>g2q-0225</code> — <code>duplicate_title</code> — Title “Ülesanded 11–15” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `koolibri_matemaatik_2_et__kit107`
- Kits: 107
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/107/chapter/10742
  - https://www.opiq.ee/kit/107/chapter/10767

</details>

<details><summary><code>g2q-0226</code> — <code>duplicate_title</code> — Title “Mängud” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `koolibri_matemaatik_2_et__kit107`
- Kits: 107
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/107/chapter/10744
  - https://www.opiq.ee/kit/107/chapter/10774

</details>

<details><summary><code>g2q-0227</code> — <code>duplicate_title</code> — Title “Kordamine (1)” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `koolibri_matemaatik_2_et__kit107`
- Kits: 107
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/107/chapter/10757
  - https://www.opiq.ee/kit/107/chapter/5192

</details>

<details><summary><code>g2q-0228</code> — <code>duplicate_title</code> — Title “Kordamine (2)” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `koolibri_matemaatik_2_et__kit107`
- Kits: 107
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/107/chapter/10758
  - https://www.opiq.ee/kit/107/chapter/5193

</details>

<details><summary><code>g2q-0229</code> — <code>duplicate_title</code> — Title “Задания 1–5” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `koolibri_математика_2_et__kit361`
- Kits: 361
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/361/chapter/19860
  - https://www.opiq.ee/kit/361/chapter/19885

</details>

<details><summary><code>g2q-0230</code> — <code>duplicate_title</code> — Title “Задания 6–10” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `koolibri_математика_2_et__kit361`
- Kits: 361
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/361/chapter/19861
  - https://www.opiq.ee/kit/361/chapter/19886

</details>

<details><summary><code>g2q-0231</code> — <code>duplicate_title</code> — Title “Задания 11–15” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `koolibri_математика_2_et__kit361`
- Kits: 361
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/361/chapter/19862
  - https://www.opiq.ee/kit/361/chapter/19887

</details>

<details><summary><code>g2q-0232</code> — <code>duplicate_title</code> — Title “Игры” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-mathematics`
- Books: `koolibri_математика_2_et__kit361`
- Kits: 361
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/361/chapter/19864
  - https://www.opiq.ee/kit/361/chapter/19894

</details>

<details><summary><code>g2q-0233</code> — <code>duplicate_title</code> — Title “Vastlad” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `2._klassi_muusikaõpetus`, `eesti_pärimusmuusika_keskuse_õppevideod`
- Kits: 188, 465
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/188/chapter/10649
  - https://www.opiq.ee/kit/465/chapter/25306

</details>

<details><summary><code>g2q-0234</code> — <code>duplicate_title</code> — Title “Plaatpillid” occurs at 3 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `2._klassi_muusikaõpetus`, `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 188, 193, 556
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/188/chapter/10661
  - https://www.opiq.ee/kit/193/chapter/10975
  - https://www.opiq.ee/kit/556/chapter/31284

</details>

<details><summary><code>g2q-0235</code> — <code>duplicate_title</code> — Title “Suvi” occurs at 3 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `2._klassi_muusikaõpetus`, `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 188, 193, 556
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/188/chapter/10690
  - https://www.opiq.ee/kit/193/chapter/10994
  - https://www.opiq.ee/kit/556/chapter/31303

</details>

<details><summary><code>g2q-0236</code> — <code>duplicate_title</code> — Title “Rongisõit” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `2._klassi_muusikaõpetus`, `музыка_–_волшебная_страна._2_класс`
- Kits: 188, 238
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/188/chapter/10613
  - https://www.opiq.ee/kit/238/chapter/13500

</details>

<details><summary><code>g2q-0237</code> — <code>duplicate_title</code> — Title “Laula, laula, suukene” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `2._klassi_muusikaõpetus`, `музыка_–_волшебная_страна._2_класс`
- Kits: 188, 238
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/188/chapter/10684
  - https://www.opiq.ee/kit/238/chapter/13457

</details>

<details><summary><code>g2q-0238</code> — <code>duplicate_title</code> — Title “Rütm” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10970
  - https://www.opiq.ee/kit/556/chapter/31279

</details>

<details><summary><code>g2q-0239</code> — <code>duplicate_title</code> — Title “Noodipikkused” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10971
  - https://www.opiq.ee/kit/556/chapter/31280

</details>

<details><summary><code>g2q-0240</code> — <code>duplicate_title</code> — Title “Takt ja taktimõõt” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10972
  - https://www.opiq.ee/kit/556/chapter/31281

</details>

<details><summary><code>g2q-0241</code> — <code>duplicate_title</code> — Title “SO- ja MI-aste” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10973
  - https://www.opiq.ee/kit/556/chapter/31282

</details>

<details><summary><code>g2q-0242</code> — <code>duplicate_title</code> — Title “RA-aste” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10974
  - https://www.opiq.ee/kit/556/chapter/31283

</details>

<details><summary><code>g2q-0243</code> — <code>duplicate_title</code> — Title “Aastaajad muusikas” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10976
  - https://www.opiq.ee/kit/556/chapter/31285

</details>

<details><summary><code>g2q-0244</code> — <code>duplicate_title</code> — Title “Sügis” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10977
  - https://www.opiq.ee/kit/556/chapter/31286

</details>

<details><summary><code>g2q-0245</code> — <code>duplicate_title</code> — Title “Mardi- ja kadripäev” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10978
  - https://www.opiq.ee/kit/556/chapter/31287

</details>

<details><summary><code>g2q-0246</code> — <code>duplicate_title</code> — Title “Eesti rahvapillid” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10979
  - https://www.opiq.ee/kit/556/chapter/31288

</details>

<details><summary><code>g2q-0247</code> — <code>duplicate_title</code> — Title “LE-aste” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10980
  - https://www.opiq.ee/kit/556/chapter/31289

</details>

<details><summary><code>g2q-0248</code> — <code>duplicate_title</code> — Title “Koosseisud” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10981
  - https://www.opiq.ee/kit/556/chapter/31290

</details>

<details><summary><code>g2q-0249</code> — <code>duplicate_title</code> — Title “JO-aste” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10984
  - https://www.opiq.ee/kit/556/chapter/31293

</details>

<details><summary><code>g2q-0250</code> — <code>duplicate_title</code> — Title “Riho Päts” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10985
  - https://www.opiq.ee/kit/556/chapter/31294

</details>

<details><summary><code>g2q-0251</code> — <code>duplicate_title</code> — Title “Vastlapäev ehk lihaheitepäev” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10986
  - https://www.opiq.ee/kit/556/chapter/31295

</details>

<details><summary><code>g2q-0252</code> — <code>duplicate_title</code> — Title “Eesti” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10987
  - https://www.opiq.ee/kit/556/chapter/31296

</details>

<details><summary><code>g2q-0253</code> — <code>duplicate_title</code> — Title “Rahvalaul” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10988
  - https://www.opiq.ee/kit/556/chapter/31297

</details>

<details><summary><code>g2q-0254</code> — <code>duplicate_title</code> — Title “René Eespere” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10989
  - https://www.opiq.ee/kit/556/chapter/31298

</details>

<details><summary><code>g2q-0255</code> — <code>duplicate_title</code> — Title “Kevad” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10990
  - https://www.opiq.ee/kit/556/chapter/31299

</details>

<details><summary><code>g2q-0256</code> — <code>duplicate_title</code> — Title “Rahvatants” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10992
  - https://www.opiq.ee/kit/556/chapter/31301

</details>

<details><summary><code>g2q-0257</code> — <code>duplicate_title</code> — Title “Rütmiorkester” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10993
  - https://www.opiq.ee/kit/556/chapter/31302

</details>

<details><summary><code>g2q-0258</code> — <code>duplicate_title</code> — Title “Kuuekeelne väikekannel” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10996
  - https://www.opiq.ee/kit/556/chapter/31305

</details>

<details><summary><code>g2q-0259</code> — <code>duplicate_title</code> — Title “Laulude tähestikuline loetelu” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`, `muusikaõpik_2._klassile_2024`
- Kits: 193, 556
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/19530
  - https://www.opiq.ee/kit/556/chapter/31304

</details>

<details><summary><code>g2q-0260</code> — <code>duplicate_title</code> — Title “Päkapikk” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-music`
- Books: `музыка_–_волшебная_страна._2_класс`
- Kits: 238
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/238/chapter/13512
  - https://www.opiq.ee/kit/238/chapter/13513

</details>

<details><summary><code>g2q-0261</code> — <code>duplicate_title</code> — Title “Понятия” occurs at 3 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-nature-and-human-studies`, `grade-2-russian`
- Books: `avita_природа_и__2_ru__kit86`, `avita_русский_язык_i_ступень_часть_3_kit568`, `koolibri_светлячок._2_ru`
- Kits: 454, 568, 86
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/454/chapter/24790
  - https://www.opiq.ee/kit/568/chapter/31807
  - https://www.opiq.ee/kit/86/chapter/12121

</details>

<details><summary><code>g2q-0262</code> — <code>duplicate_title</code> — Title “Толкование слов” occurs at 3 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-nature-and-human-studies`, `grade-2-russian`
- Books: `avita_природа_и__2_ru__kit86`, `avita_русский_язык_i_ступень_часть_3_kit568`, `koolibri_светлячок._2_ru`
- Kits: 454, 568, 86
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/454/chapter/24791
  - https://www.opiq.ee/kit/568/chapter/31808
  - https://www.opiq.ee/kit/86/chapter/4233

</details>

<details><summary><code>g2q-0263</code> — <code>duplicate_title</code> — Title “Кустарники” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-nature-and-human-studies`, `grade-2-science`
- Books: `avita_природа_и__2_ru__kit86`, `koolibri_природове_2_ru`
- Kits: 132, 86
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/132/chapter/7073
  - https://www.opiq.ee/kit/86/chapter/4196

</details>

<details><summary><code>g2q-0264</code> — <code>duplicate_title</code> — Title “Травянистые растения” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-nature-and-human-studies`, `grade-2-science`
- Books: `avita_природа_и__2_ru__kit86`, `koolibri_природове_2_ru`
- Kits: 132, 86
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/132/chapter/7075
  - https://www.opiq.ee/kit/86/chapter/12106

</details>

<details><summary><code>g2q-0265</code> — <code>duplicate_title</code> — Title “Домашние животные” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-nature-and-human-studies`, `grade-2-science`
- Books: `avita_природа_и__2_ru__kit86`, `koolibri_природове_2_ru`
- Kits: 132, 86
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/132/chapter/7098
  - https://www.opiq.ee/kit/86/chapter/12111

</details>

<details><summary><code>g2q-0266</code> — <code>duplicate_title</code> — Title “Человек” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-nature-and-human-studies`, `grade-2-science`
- Books: `avita_природа_и__2_ru__kit86`, `koolibri_природове_2_ru`
- Kits: 132, 86
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/132/chapter/7112
  - https://www.opiq.ee/kit/86/chapter/4218

</details>

<details><summary><code>g2q-0267</code> — <code>duplicate_title</code> — Title “Язык и речь. Вступление” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-russian`
- Books: `avita_русский_язык_2_класс_kit292`, `avita_русский_язык_i_ступень_часть_3_kit568`
- Kits: 292, 568
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/292/chapter/16114
  - https://www.opiq.ee/kit/568/chapter/31760

</details>

<details><summary><code>g2q-0268</code> — <code>duplicate_title</code> — Title “Алфавит” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-russian`
- Books: `avita_русский_язык_2_класс_kit292`, `avita_русский_язык_i_ступень_часть_3_kit568`
- Kits: 292, 568
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/292/chapter/16127
  - https://www.opiq.ee/kit/568/chapter/31800

</details>

<details><summary><code>g2q-0269</code> — <code>duplicate_title</code> — Title “Имена собственные” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-russian`
- Books: `avita_русский_язык_2_класс_kit292`, `avita_русский_язык_i_ступень_часть_3_kit568`
- Kits: 292, 568
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/292/chapter/16132
  - https://www.opiq.ee/kit/568/chapter/31769

</details>

<details><summary><code>g2q-0270</code> — <code>duplicate_title</code> — Title “Звуки и буквы. Вступление” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-russian`
- Books: `avita_русский_язык_2_класс_kit292`, `avita_русский_язык_i_ступень_часть_3_kit568`
- Kits: 292, 568
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/292/chapter/16143
  - https://www.opiq.ee/kit/568/chapter/31797

</details>

<details><summary><code>g2q-0271</code> — <code>duplicate_title</code> — Title “Работа с текстом” occurs at 3 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-russian`
- Books: `avita_русский_язык_2_класс_kit292`, `avita_русский_язык_i_ступень_часть_3_kit568`
- Kits: 292, 568
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/292/chapter/16169
  - https://www.opiq.ee/kit/292/chapter/17802
  - https://www.opiq.ee/kit/568/chapter/31773

</details>

<details><summary><code>g2q-0272</code> — <code>duplicate_title</code> — Title “Как подбирать проверочные слова? (1)” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-russian`
- Books: `avita_русский_язык_2_класс_kit292`, `avita_русский_язык_i_ступень_часть_3_kit568`
- Kits: 292, 568
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/292/chapter/17772
  - https://www.opiq.ee/kit/568/chapter/31803

</details>

<details><summary><code>g2q-0273</code> — <code>duplicate_title</code> — Title “Как подбирать проверочные слова? (2)” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-russian`
- Books: `avita_русский_язык_2_класс_kit292`, `avita_русский_язык_i_ступень_часть_3_kit568`
- Kits: 292, 568
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/292/chapter/17773
  - https://www.opiq.ee/kit/568/chapter/31804

</details>

<details><summary><code>g2q-0274</code> — <code>duplicate_title</code> — Title “Главные члены предложения – подлежащее и сказуемое” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-russian`
- Books: `avita_русский_язык_2_класс_kit292`, `avita_русский_язык_i_ступень_часть_3_kit568`
- Kits: 292, 568
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/292/chapter/17826
  - https://www.opiq.ee/kit/568/chapter/31770

</details>

<details><summary><code>g2q-0275</code> — <code>duplicate_title</code> — Title “Распространённые и нераспространённые предложения” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-russian`
- Books: `avita_русский_язык_2_класс_kit292`, `avita_русский_язык_i_ступень_часть_3_kit568`
- Kits: 292, 568
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/292/chapter/17827
  - https://www.opiq.ee/kit/568/chapter/31771

</details>

<details><summary><code>g2q-0276</code> — <code>duplicate_title</code> — Title “Типы текстов” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-russian`
- Books: `avita_русский_язык_2_класс_kit292`
- Kits: 292
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/292/chapter/16108
  - https://www.opiq.ee/kit/292/chapter/17832

</details>

<details><summary><code>g2q-0277</code> — <code>duplicate_title</code> — Title “Советуем почитать” occurs at 6 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-russian`
- Books: `avita_русский_язык_2_класс_kit292`
- Kits: 292
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/292/chapter/16120
  - https://www.opiq.ee/kit/292/chapter/16150
  - https://www.opiq.ee/kit/292/chapter/16168
  - https://www.opiq.ee/kit/292/chapter/17766
  - https://www.opiq.ee/kit/292/chapter/17787
  - https://www.opiq.ee/kit/292/chapter/17841

</details>

<details><summary><code>g2q-0278</code> — <code>duplicate_title</code> — Title “По следам прочитанных произведений” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-russian`
- Books: `avita_русский_язык_2_класс_kit292`
- Kits: 292
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/292/chapter/16170
  - https://www.opiq.ee/kit/292/chapter/17843

</details>

<details><summary><code>g2q-0279</code> — <code>duplicate_title</code> — Title “Предложение и текст” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-russian`
- Books: `avita_русский_язык_2_класс_kit292`
- Kits: 292
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/292/chapter/17831
  - https://www.opiq.ee/kit/292/chapter/17835

</details>

<details><summary><code>g2q-0280</code> — <code>duplicate_title</code> — Title “Я знаю и умею” occurs at 3 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-russian`
- Books: `avita_русский_язык_i_ступень_часть_3_kit568`
- Kits: 568
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/568/chapter/31772
  - https://www.opiq.ee/kit/568/chapter/31789
  - https://www.opiq.ee/kit/568/chapter/31794

</details>

<details><summary><code>g2q-0281</code> — <code>duplicate_title</code> — Title “Я работаю самостоятельно” occurs at 3 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-russian`
- Books: `avita_русский_язык_i_ступень_часть_3_kit568`
- Kits: 568
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/568/chapter/31775
  - https://www.opiq.ee/kit/568/chapter/31795
  - https://www.opiq.ee/kit/568/chapter/31805

</details>

<details><summary><code>g2q-0282</code> — <code>duplicate_title</code> — Title “ОСЕННЕЕ УТРО” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-russian`
- Books: `koolibri_светлячок._2_ru`
- Kits: 454
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/454/chapter/24704
  - https://www.opiq.ee/kit/454/chapter/24705

</details>

<details><summary><code>g2q-0283</code> — <code>duplicate_title</code> — Title “Puud” occurs at 3 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-science`
- Books: `avita_loodusõpet_2_et`, `avita_природовед_2_ru`, `koolibri_loodusõpet_2_et`
- Kits: 121, 379, 570
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/121/chapter/6202
  - https://www.opiq.ee/kit/379/chapter/20579
  - https://www.opiq.ee/kit/570/chapter/31846

</details>

<details><summary><code>g2q-0284</code> — <code>duplicate_title</code> — Title “Tere jälle!” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-science`
- Books: `avita_loodusõpet_2_et`, `avita_природовед_2_ru`
- Kits: 379, 570
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/379/chapter/20574
  - https://www.opiq.ee/kit/570/chapter/31841

</details>

<details><summary><code>g2q-0285</code> — <code>duplicate_title</code> — Title “Aardejaht” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-science`
- Books: `avita_loodusõpet_2_et`, `avita_природовед_2_ru`
- Kits: 379, 570
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/379/chapter/20575
  - https://www.opiq.ee/kit/570/chapter/31842

</details>

<details><summary><code>g2q-0286</code> — <code>duplicate_title</code> — Title “Soomaal” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-science`
- Books: `avita_loodusõpet_2_et`, `avita_природовед_2_ru`
- Kits: 379, 570
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/379/chapter/20577
  - https://www.opiq.ee/kit/570/chapter/31844

</details>

<details><summary><code>g2q-0287</code> — <code>duplicate_title</code> — Title “Sootaimed” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-science`
- Books: `avita_loodusõpet_2_et`, `avita_природовед_2_ru`
- Kits: 379, 570
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/379/chapter/20578
  - https://www.opiq.ee/kit/570/chapter/31845

</details>

<details><summary><code>g2q-0288</code> — <code>duplicate_title</code> — Title “Puhmad ja rohttaimed” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-science`
- Books: `avita_loodusõpet_2_et`, `avita_природовед_2_ru`
- Kits: 379, 570
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/379/chapter/20581
  - https://www.opiq.ee/kit/570/chapter/31848

</details>

<details><summary><code>g2q-0289</code> — <code>duplicate_title</code> — Title “Veeringlus” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-science`
- Books: `avita_loodusõpet_2_et`, `avita_природовед_2_ru`
- Kits: 379, 570
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/379/chapter/20583
  - https://www.opiq.ee/kit/570/chapter/32085

</details>

<details><summary><code>g2q-0290</code> — <code>duplicate_title</code> — Title “Vooremaal” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-science`
- Books: `avita_loodusõpet_2_et`, `avita_природовед_2_ru`
- Kits: 379, 570
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/379/chapter/20584
  - https://www.opiq.ee/kit/570/chapter/32086

</details>

<details><summary><code>g2q-0291</code> — <code>duplicate_title</code> — Title “Loomade kehaosad” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-science`
- Books: `avita_loodusõpet_2_et`, `avita_природовед_2_ru`
- Kits: 379, 570
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/379/chapter/20585
  - https://www.opiq.ee/kit/570/chapter/32087

</details>

<details><summary><code>g2q-0292</code> — <code>duplicate_title</code> — Title “Kes näris õunapuud?” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-science`
- Books: `avita_loodusõpet_2_et`, `avita_природовед_2_ru`
- Kits: 379, 570
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/379/chapter/20586
  - https://www.opiq.ee/kit/570/chapter/32088

</details>

<details><summary><code>g2q-0293</code> — <code>duplicate_title</code> — Title “Kes sõi kana ära?” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-science`
- Books: `avita_loodusõpet_2_et`, `avita_природовед_2_ru`
- Kits: 379, 570
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/379/chapter/20587
  - https://www.opiq.ee/kit/570/chapter/32089

</details>

<details><summary><code>g2q-0294</code> — <code>duplicate_title</code> — Title “Kuidas olla terve?” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-science`
- Books: `avita_loodusõpet_2_et`, `avita_природовед_2_ru`
- Kits: 379, 570
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/379/chapter/20589
  - https://www.opiq.ee/kit/570/chapter/33145

</details>

<details><summary><code>g2q-0295</code> — <code>duplicate_title</code> — Title “Tallinnas” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-science`
- Books: `avita_loodusõpet_2_et`, `avita_природовед_2_ru`
- Kits: 379, 570
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/379/chapter/20591
  - https://www.opiq.ee/kit/570/chapter/33146

</details>

<details><summary><code>g2q-0296</code> — <code>duplicate_title</code> — Title “Rõuges” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-science`
- Books: `avita_loodusõpet_2_et`, `avita_природовед_2_ru`
- Kits: 379, 570
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/379/chapter/20593
  - https://www.opiq.ee/kit/570/chapter/33148

</details>

<details><summary><code>g2q-0297</code> — <code>duplicate_title</code> — Title “Veeloomad ja -taimed” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-science`
- Books: `avita_loodusõpet_2_et`, `avita_природовед_2_ru`
- Kits: 379, 570
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/379/chapter/20594
  - https://www.opiq.ee/kit/570/chapter/33149

</details>

<details><summary><code>g2q-0298</code> — <code>duplicate_title</code> — Title “Köögiviljad” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-science`
- Books: `ministeerium_loodusõpet_2_et`, `skriibus_loodusõpet_2_et`
- Kits: 387, 501
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/387/chapter/20886
  - https://www.opiq.ee/kit/501/chapter/27381

</details>

<details><summary><code>g2q-0299</code> — <code>duplicate_title</code> — Title “Lemmikloomad” occurs at 2 distinct canonical URLs.</summary>

- Classification: `distinct_canonical_context`
- Routes: `grade-2-science`
- Books: `ministeerium_loodusõpet_2_et`, `skriibus_loodusõpet_2_et`
- Kits: 387, 501
- Action: Retain all URLs. Equal page titles across chapters, editions, books, or youth programmes are not sufficient evidence of duplicate content.
- Exact URLs:
  - https://www.opiq.ee/kit/387/chapter/20903
  - https://www.opiq.ee/kit/501/chapter/27384

</details>

<details><summary><code>g2q-0300</code> — <code>missing_publisher</code> — Publisher is absent for kunsti-_ja_tööõpetus._2._osa (kit 192).</summary>

- Classification: `source_supported_metadata_limitation`
- Routes: `grade-2-arts-and-crafts`
- Books: `kunsti-_ja_tööõpetus._2._osa`
- Kits: 192
- Action: Do not invent a publisher. A current Kit Details or cover-only capture may fill this optional metadata later.
- Exact URLs:
  - https://www.opiq.ee/kit/192/chapter/10881
  - https://www.opiq.ee/kit/192/chapter/10882
  - https://www.opiq.ee/kit/192/chapter/10883
  - https://www.opiq.ee/kit/192/chapter/10884
  - https://www.opiq.ee/kit/192/chapter/10885
  - https://www.opiq.ee/kit/192/chapter/10886
  - https://www.opiq.ee/kit/192/chapter/10887
  - https://www.opiq.ee/kit/192/chapter/10888
  - https://www.opiq.ee/kit/192/chapter/10889
  - https://www.opiq.ee/kit/192/chapter/10890
  - https://www.opiq.ee/kit/192/chapter/10891
  - https://www.opiq.ee/kit/192/chapter/10892
  - https://www.opiq.ee/kit/192/chapter/10893
  - https://www.opiq.ee/kit/192/chapter/10894
  - https://www.opiq.ee/kit/192/chapter/10895
  - https://www.opiq.ee/kit/192/chapter/10896
  - https://www.opiq.ee/kit/192/chapter/10897
  - https://www.opiq.ee/kit/192/chapter/10898
  - https://www.opiq.ee/kit/192/chapter/10899
  - https://www.opiq.ee/kit/192/chapter/10900
  - https://www.opiq.ee/kit/192/chapter/10901
  - https://www.opiq.ee/kit/192/chapter/10902
  - https://www.opiq.ee/kit/192/chapter/10903
  - https://www.opiq.ee/kit/192/chapter/10904
  - https://www.opiq.ee/kit/192/chapter/10905
  - https://www.opiq.ee/kit/192/chapter/10906
  - https://www.opiq.ee/kit/192/chapter/10907
  - https://www.opiq.ee/kit/192/chapter/10908
  - https://www.opiq.ee/kit/192/chapter/10909
  - https://www.opiq.ee/kit/192/chapter/10910
  - https://www.opiq.ee/kit/192/chapter/10911
  - https://www.opiq.ee/kit/192/chapter/10912
  - https://www.opiq.ee/kit/192/chapter/10913
  - https://www.opiq.ee/kit/192/chapter/10914
  - https://www.opiq.ee/kit/192/chapter/10915
  - https://www.opiq.ee/kit/192/chapter/10916
  - https://www.opiq.ee/kit/192/chapter/10917
  - https://www.opiq.ee/kit/192/chapter/10918
  - https://www.opiq.ee/kit/192/chapter/10919
  - https://www.opiq.ee/kit/192/chapter/10920
  - https://www.opiq.ee/kit/192/chapter/10921
  - https://www.opiq.ee/kit/192/chapter/10922
  - https://www.opiq.ee/kit/192/chapter/10923
  - https://www.opiq.ee/kit/192/chapter/10924
  - https://www.opiq.ee/kit/192/chapter/10925
  - https://www.opiq.ee/kit/192/chapter/10926
  - https://www.opiq.ee/kit/192/chapter/10927
  - https://www.opiq.ee/kit/192/chapter/10928
  - https://www.opiq.ee/kit/192/chapter/10929
  - https://www.opiq.ee/kit/192/chapter/10930
  - https://www.opiq.ee/kit/192/chapter/10931
  - https://www.opiq.ee/kit/192/chapter/10932
  - https://www.opiq.ee/kit/192/chapter/10933
  - https://www.opiq.ee/kit/192/chapter/10934
  - https://www.opiq.ee/kit/192/chapter/10935
  - https://www.opiq.ee/kit/192/chapter/10936
  - https://www.opiq.ee/kit/192/chapter/10937
  - https://www.opiq.ee/kit/192/chapter/10938
  - https://www.opiq.ee/kit/192/chapter/10939
  - https://www.opiq.ee/kit/192/chapter/10940
  - https://www.opiq.ee/kit/192/chapter/10941
  - https://www.opiq.ee/kit/192/chapter/10942
  - https://www.opiq.ee/kit/192/chapter/10943
  - https://www.opiq.ee/kit/192/chapter/10944
  - https://www.opiq.ee/kit/192/chapter/10945
  - https://www.opiq.ee/kit/192/chapter/10946
  - https://www.opiq.ee/kit/192/chapter/10947
  - https://www.opiq.ee/kit/192/chapter/10948
  - https://www.opiq.ee/kit/192/chapter/10949
  - https://www.opiq.ee/kit/192/chapter/10950
  - https://www.opiq.ee/kit/192/chapter/10951
  - https://www.opiq.ee/kit/192/chapter/10952
  - https://www.opiq.ee/kit/192/chapter/10953
  - https://www.opiq.ee/kit/192/chapter/10954
  - https://www.opiq.ee/kit/192/chapter/10955
  - https://www.opiq.ee/kit/192/chapter/10956
  - https://www.opiq.ee/kit/192/chapter/10957
  - https://www.opiq.ee/kit/192/chapter/10958
  - https://www.opiq.ee/kit/192/chapter/10959
  - https://www.opiq.ee/kit/192/chapter/10960
  - https://www.opiq.ee/kit/192/chapter/10961
  - https://www.opiq.ee/kit/192/chapter/10962
  - https://www.opiq.ee/kit/192/chapter/10963
  - https://www.opiq.ee/kit/192/chapter/10964
  - https://www.opiq.ee/kit/192/chapter/10965
  - https://www.opiq.ee/kit/192/chapter/10966
  - https://www.opiq.ee/kit/192/chapter/10967
  - https://www.opiq.ee/kit/192/chapter/10968
  - https://www.opiq.ee/kit/192/chapter/10969

</details>

<details><summary><code>g2q-0301</code> — <code>missing_publisher</code> — Publisher is absent for kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid (kit 200).</summary>

- Classification: `source_supported_metadata_limitation`
- Routes: `grade-2-arts-and-crafts`
- Books: `kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid`
- Kits: 200
- Action: Do not invent a publisher. A current Kit Details or cover-only capture may fill this optional metadata later.
- Exact URLs:
  - https://www.opiq.ee/kit/200/chapter/11374
  - https://www.opiq.ee/kit/200/chapter/11375
  - https://www.opiq.ee/kit/200/chapter/11376
  - https://www.opiq.ee/kit/200/chapter/11377
  - https://www.opiq.ee/kit/200/chapter/11378
  - https://www.opiq.ee/kit/200/chapter/11379
  - https://www.opiq.ee/kit/200/chapter/11380
  - https://www.opiq.ee/kit/200/chapter/11381
  - https://www.opiq.ee/kit/200/chapter/11382
  - https://www.opiq.ee/kit/200/chapter/11383
  - https://www.opiq.ee/kit/200/chapter/11384
  - https://www.opiq.ee/kit/200/chapter/11385
  - https://www.opiq.ee/kit/200/chapter/11386
  - https://www.opiq.ee/kit/200/chapter/11387
  - https://www.opiq.ee/kit/200/chapter/11388
  - https://www.opiq.ee/kit/200/chapter/11389
  - https://www.opiq.ee/kit/200/chapter/11390
  - https://www.opiq.ee/kit/200/chapter/11391
  - https://www.opiq.ee/kit/200/chapter/11392
  - https://www.opiq.ee/kit/200/chapter/11393
  - https://www.opiq.ee/kit/200/chapter/11394
  - https://www.opiq.ee/kit/200/chapter/11395
  - https://www.opiq.ee/kit/200/chapter/11396
  - https://www.opiq.ee/kit/200/chapter/11397
  - https://www.opiq.ee/kit/200/chapter/11398
  - https://www.opiq.ee/kit/200/chapter/11399
  - https://www.opiq.ee/kit/200/chapter/11400
  - https://www.opiq.ee/kit/200/chapter/11401
  - https://www.opiq.ee/kit/200/chapter/11402
  - https://www.opiq.ee/kit/200/chapter/11403
  - https://www.opiq.ee/kit/200/chapter/11404
  - https://www.opiq.ee/kit/200/chapter/11405
  - https://www.opiq.ee/kit/200/chapter/11406
  - https://www.opiq.ee/kit/200/chapter/11407
  - https://www.opiq.ee/kit/200/chapter/11408
  - https://www.opiq.ee/kit/200/chapter/11409
  - https://www.opiq.ee/kit/200/chapter/11410
  - https://www.opiq.ee/kit/200/chapter/11411
  - https://www.opiq.ee/kit/200/chapter/11412
  - https://www.opiq.ee/kit/200/chapter/11413
  - https://www.opiq.ee/kit/200/chapter/11414
  - https://www.opiq.ee/kit/200/chapter/11415
  - https://www.opiq.ee/kit/200/chapter/11416
  - https://www.opiq.ee/kit/200/chapter/11417
  - https://www.opiq.ee/kit/200/chapter/11418
  - https://www.opiq.ee/kit/200/chapter/11419
  - https://www.opiq.ee/kit/200/chapter/11420
  - https://www.opiq.ee/kit/200/chapter/11421
  - https://www.opiq.ee/kit/200/chapter/11422
  - https://www.opiq.ee/kit/200/chapter/11423
  - https://www.opiq.ee/kit/200/chapter/11424
  - https://www.opiq.ee/kit/200/chapter/11425
  - https://www.opiq.ee/kit/200/chapter/11426
  - https://www.opiq.ee/kit/200/chapter/11427
  - https://www.opiq.ee/kit/200/chapter/11428
  - https://www.opiq.ee/kit/200/chapter/11429
  - https://www.opiq.ee/kit/200/chapter/11430
  - https://www.opiq.ee/kit/200/chapter/11431
  - https://www.opiq.ee/kit/200/chapter/11432
  - https://www.opiq.ee/kit/200/chapter/11433
  - https://www.opiq.ee/kit/200/chapter/11434
  - https://www.opiq.ee/kit/200/chapter/11435
  - https://www.opiq.ee/kit/200/chapter/11436
  - https://www.opiq.ee/kit/200/chapter/11437
  - https://www.opiq.ee/kit/200/chapter/11438
  - https://www.opiq.ee/kit/200/chapter/11439
  - https://www.opiq.ee/kit/200/chapter/11440
  - https://www.opiq.ee/kit/200/chapter/11441
  - https://www.opiq.ee/kit/200/chapter/11442
  - https://www.opiq.ee/kit/200/chapter/11443
  - https://www.opiq.ee/kit/200/chapter/11444
  - https://www.opiq.ee/kit/200/chapter/11445
  - https://www.opiq.ee/kit/200/chapter/11446
  - https://www.opiq.ee/kit/200/chapter/11447
  - https://www.opiq.ee/kit/200/chapter/11448
  - https://www.opiq.ee/kit/200/chapter/11449
  - https://www.opiq.ee/kit/200/chapter/11450
  - https://www.opiq.ee/kit/200/chapter/11451
  - https://www.opiq.ee/kit/200/chapter/11452
  - https://www.opiq.ee/kit/200/chapter/11453
  - https://www.opiq.ee/kit/200/chapter/11454
  - https://www.opiq.ee/kit/200/chapter/11455
  - https://www.opiq.ee/kit/200/chapter/11456
  - https://www.opiq.ee/kit/200/chapter/11457
  - https://www.opiq.ee/kit/200/chapter/11458

</details>

<details><summary><code>g2q-0302</code> — <code>missing_publisher</code> — Publisher is absent for трудовое_обучение_и_искусство._2_часть (kit 371).</summary>

- Classification: `source_supported_metadata_limitation`
- Routes: `grade-2-arts-and-crafts`
- Books: `трудовое_обучение_и_искусство._2_часть`
- Kits: 371
- Action: Do not invent a publisher. A current Kit Details or cover-only capture may fill this optional metadata later.
- Exact URLs:
  - https://www.opiq.ee/kit/371/chapter/20257
  - https://www.opiq.ee/kit/371/chapter/20258
  - https://www.opiq.ee/kit/371/chapter/20259
  - https://www.opiq.ee/kit/371/chapter/20260
  - https://www.opiq.ee/kit/371/chapter/20261
  - https://www.opiq.ee/kit/371/chapter/20262
  - https://www.opiq.ee/kit/371/chapter/20263
  - https://www.opiq.ee/kit/371/chapter/20264
  - https://www.opiq.ee/kit/371/chapter/20265
  - https://www.opiq.ee/kit/371/chapter/20266
  - https://www.opiq.ee/kit/371/chapter/20267
  - https://www.opiq.ee/kit/371/chapter/20268
  - https://www.opiq.ee/kit/371/chapter/20269
  - https://www.opiq.ee/kit/371/chapter/20270
  - https://www.opiq.ee/kit/371/chapter/20271
  - https://www.opiq.ee/kit/371/chapter/20272
  - https://www.opiq.ee/kit/371/chapter/20273
  - https://www.opiq.ee/kit/371/chapter/20274
  - https://www.opiq.ee/kit/371/chapter/20275
  - https://www.opiq.ee/kit/371/chapter/20276
  - https://www.opiq.ee/kit/371/chapter/20277
  - https://www.opiq.ee/kit/371/chapter/20278
  - https://www.opiq.ee/kit/371/chapter/20279
  - https://www.opiq.ee/kit/371/chapter/20280
  - https://www.opiq.ee/kit/371/chapter/20281
  - https://www.opiq.ee/kit/371/chapter/20282
  - https://www.opiq.ee/kit/371/chapter/20283
  - https://www.opiq.ee/kit/371/chapter/20284
  - https://www.opiq.ee/kit/371/chapter/20285
  - https://www.opiq.ee/kit/371/chapter/20286
  - https://www.opiq.ee/kit/371/chapter/20287
  - https://www.opiq.ee/kit/371/chapter/20288
  - https://www.opiq.ee/kit/371/chapter/20289
  - https://www.opiq.ee/kit/371/chapter/20290
  - https://www.opiq.ee/kit/371/chapter/20291
  - https://www.opiq.ee/kit/371/chapter/20292
  - https://www.opiq.ee/kit/371/chapter/20293
  - https://www.opiq.ee/kit/371/chapter/20294
  - https://www.opiq.ee/kit/371/chapter/20295
  - https://www.opiq.ee/kit/371/chapter/20296
  - https://www.opiq.ee/kit/371/chapter/20297
  - https://www.opiq.ee/kit/371/chapter/20298
  - https://www.opiq.ee/kit/371/chapter/20299
  - https://www.opiq.ee/kit/371/chapter/20300
  - https://www.opiq.ee/kit/371/chapter/20301
  - https://www.opiq.ee/kit/371/chapter/20302
  - https://www.opiq.ee/kit/371/chapter/20303
  - https://www.opiq.ee/kit/371/chapter/20304
  - https://www.opiq.ee/kit/371/chapter/20305
  - https://www.opiq.ee/kit/371/chapter/20306
  - https://www.opiq.ee/kit/371/chapter/20307
  - https://www.opiq.ee/kit/371/chapter/20308
  - https://www.opiq.ee/kit/371/chapter/20309
  - https://www.opiq.ee/kit/371/chapter/20310
  - https://www.opiq.ee/kit/371/chapter/20311
  - https://www.opiq.ee/kit/371/chapter/20312
  - https://www.opiq.ee/kit/371/chapter/20313
  - https://www.opiq.ee/kit/371/chapter/20314
  - https://www.opiq.ee/kit/371/chapter/20315
  - https://www.opiq.ee/kit/371/chapter/20316
  - https://www.opiq.ee/kit/371/chapter/20317
  - https://www.opiq.ee/kit/371/chapter/20318
  - https://www.opiq.ee/kit/371/chapter/20319
  - https://www.opiq.ee/kit/371/chapter/20320
  - https://www.opiq.ee/kit/371/chapter/20321
  - https://www.opiq.ee/kit/371/chapter/20322
  - https://www.opiq.ee/kit/371/chapter/20323
  - https://www.opiq.ee/kit/371/chapter/20324
  - https://www.opiq.ee/kit/371/chapter/20325
  - https://www.opiq.ee/kit/371/chapter/20326
  - https://www.opiq.ee/kit/371/chapter/20327
  - https://www.opiq.ee/kit/371/chapter/20328
  - https://www.opiq.ee/kit/371/chapter/20329
  - https://www.opiq.ee/kit/371/chapter/20330
  - https://www.opiq.ee/kit/371/chapter/20331
  - https://www.opiq.ee/kit/371/chapter/20332
  - https://www.opiq.ee/kit/371/chapter/20333
  - https://www.opiq.ee/kit/371/chapter/20334
  - https://www.opiq.ee/kit/371/chapter/20335
  - https://www.opiq.ee/kit/371/chapter/20336
  - https://www.opiq.ee/kit/371/chapter/20337
  - https://www.opiq.ee/kit/371/chapter/20338
  - https://www.opiq.ee/kit/371/chapter/20339
  - https://www.opiq.ee/kit/371/chapter/20340
  - https://www.opiq.ee/kit/371/chapter/20341
  - https://www.opiq.ee/kit/371/chapter/20342
  - https://www.opiq.ee/kit/371/chapter/20343
  - https://www.opiq.ee/kit/371/chapter/20344
  - https://www.opiq.ee/kit/371/chapter/20345

</details>

<details><summary><code>g2q-0303</code> — <code>missing_publisher</code> — Publisher is absent for 2._klassi_muusikaõpetus (kit 188).</summary>

- Classification: `source_supported_metadata_limitation`
- Routes: `grade-2-music`
- Books: `2._klassi_muusikaõpetus`
- Kits: 188
- Action: Do not invent a publisher. A current Kit Details or cover-only capture may fill this optional metadata later.
- Exact URLs:
  - https://www.opiq.ee/kit/188/chapter/10576
  - https://www.opiq.ee/kit/188/chapter/10577
  - https://www.opiq.ee/kit/188/chapter/10578
  - https://www.opiq.ee/kit/188/chapter/10579
  - https://www.opiq.ee/kit/188/chapter/10580
  - https://www.opiq.ee/kit/188/chapter/10581
  - https://www.opiq.ee/kit/188/chapter/10582
  - https://www.opiq.ee/kit/188/chapter/10583
  - https://www.opiq.ee/kit/188/chapter/10584
  - https://www.opiq.ee/kit/188/chapter/10585
  - https://www.opiq.ee/kit/188/chapter/10586
  - https://www.opiq.ee/kit/188/chapter/10587
  - https://www.opiq.ee/kit/188/chapter/10588
  - https://www.opiq.ee/kit/188/chapter/10589
  - https://www.opiq.ee/kit/188/chapter/10590
  - https://www.opiq.ee/kit/188/chapter/10591
  - https://www.opiq.ee/kit/188/chapter/10592
  - https://www.opiq.ee/kit/188/chapter/10593
  - https://www.opiq.ee/kit/188/chapter/10594
  - https://www.opiq.ee/kit/188/chapter/10595
  - https://www.opiq.ee/kit/188/chapter/10596
  - https://www.opiq.ee/kit/188/chapter/10597
  - https://www.opiq.ee/kit/188/chapter/10598
  - https://www.opiq.ee/kit/188/chapter/10599
  - https://www.opiq.ee/kit/188/chapter/10600
  - https://www.opiq.ee/kit/188/chapter/10601
  - https://www.opiq.ee/kit/188/chapter/10602
  - https://www.opiq.ee/kit/188/chapter/10603
  - https://www.opiq.ee/kit/188/chapter/10604
  - https://www.opiq.ee/kit/188/chapter/10605
  - https://www.opiq.ee/kit/188/chapter/10606
  - https://www.opiq.ee/kit/188/chapter/10607
  - https://www.opiq.ee/kit/188/chapter/10608
  - https://www.opiq.ee/kit/188/chapter/10609
  - https://www.opiq.ee/kit/188/chapter/10610
  - https://www.opiq.ee/kit/188/chapter/10611
  - https://www.opiq.ee/kit/188/chapter/10612
  - https://www.opiq.ee/kit/188/chapter/10613
  - https://www.opiq.ee/kit/188/chapter/10614
  - https://www.opiq.ee/kit/188/chapter/10615
  - https://www.opiq.ee/kit/188/chapter/10616
  - https://www.opiq.ee/kit/188/chapter/10617
  - https://www.opiq.ee/kit/188/chapter/10618
  - https://www.opiq.ee/kit/188/chapter/10619
  - https://www.opiq.ee/kit/188/chapter/10620
  - https://www.opiq.ee/kit/188/chapter/10621
  - https://www.opiq.ee/kit/188/chapter/10622
  - https://www.opiq.ee/kit/188/chapter/10623
  - https://www.opiq.ee/kit/188/chapter/10624
  - https://www.opiq.ee/kit/188/chapter/10625
  - https://www.opiq.ee/kit/188/chapter/10626
  - https://www.opiq.ee/kit/188/chapter/10627
  - https://www.opiq.ee/kit/188/chapter/10628
  - https://www.opiq.ee/kit/188/chapter/10629
  - https://www.opiq.ee/kit/188/chapter/10630
  - https://www.opiq.ee/kit/188/chapter/10631
  - https://www.opiq.ee/kit/188/chapter/10632
  - https://www.opiq.ee/kit/188/chapter/10633
  - https://www.opiq.ee/kit/188/chapter/10634
  - https://www.opiq.ee/kit/188/chapter/10635
  - https://www.opiq.ee/kit/188/chapter/10636
  - https://www.opiq.ee/kit/188/chapter/10637
  - https://www.opiq.ee/kit/188/chapter/10638
  - https://www.opiq.ee/kit/188/chapter/10639
  - https://www.opiq.ee/kit/188/chapter/10640
  - https://www.opiq.ee/kit/188/chapter/10641
  - https://www.opiq.ee/kit/188/chapter/10642
  - https://www.opiq.ee/kit/188/chapter/10643
  - https://www.opiq.ee/kit/188/chapter/10644
  - https://www.opiq.ee/kit/188/chapter/10645
  - https://www.opiq.ee/kit/188/chapter/10646
  - https://www.opiq.ee/kit/188/chapter/10647
  - https://www.opiq.ee/kit/188/chapter/10648
  - https://www.opiq.ee/kit/188/chapter/10649
  - https://www.opiq.ee/kit/188/chapter/10650
  - https://www.opiq.ee/kit/188/chapter/10651
  - https://www.opiq.ee/kit/188/chapter/10652
  - https://www.opiq.ee/kit/188/chapter/10653
  - https://www.opiq.ee/kit/188/chapter/10654
  - https://www.opiq.ee/kit/188/chapter/10655
  - https://www.opiq.ee/kit/188/chapter/10656
  - https://www.opiq.ee/kit/188/chapter/10657
  - https://www.opiq.ee/kit/188/chapter/10658
  - https://www.opiq.ee/kit/188/chapter/10659
  - https://www.opiq.ee/kit/188/chapter/10660
  - https://www.opiq.ee/kit/188/chapter/10661
  - https://www.opiq.ee/kit/188/chapter/10662
  - https://www.opiq.ee/kit/188/chapter/10663
  - https://www.opiq.ee/kit/188/chapter/10664
  - https://www.opiq.ee/kit/188/chapter/10665
  - https://www.opiq.ee/kit/188/chapter/10666
  - https://www.opiq.ee/kit/188/chapter/10667
  - https://www.opiq.ee/kit/188/chapter/10668
  - https://www.opiq.ee/kit/188/chapter/10669
  - https://www.opiq.ee/kit/188/chapter/10670
  - https://www.opiq.ee/kit/188/chapter/10671
  - https://www.opiq.ee/kit/188/chapter/10672
  - https://www.opiq.ee/kit/188/chapter/10673
  - https://www.opiq.ee/kit/188/chapter/10674
  - https://www.opiq.ee/kit/188/chapter/10675
  - https://www.opiq.ee/kit/188/chapter/10676
  - https://www.opiq.ee/kit/188/chapter/10677
  - https://www.opiq.ee/kit/188/chapter/10678
  - https://www.opiq.ee/kit/188/chapter/10679
  - https://www.opiq.ee/kit/188/chapter/10680
  - https://www.opiq.ee/kit/188/chapter/10681
  - https://www.opiq.ee/kit/188/chapter/10682
  - https://www.opiq.ee/kit/188/chapter/10683
  - https://www.opiq.ee/kit/188/chapter/10684
  - https://www.opiq.ee/kit/188/chapter/10685
  - https://www.opiq.ee/kit/188/chapter/10686
  - https://www.opiq.ee/kit/188/chapter/10687
  - https://www.opiq.ee/kit/188/chapter/10688
  - https://www.opiq.ee/kit/188/chapter/10689
  - https://www.opiq.ee/kit/188/chapter/10690
  - https://www.opiq.ee/kit/188/chapter/10691

</details>

<details><summary><code>g2q-0304</code> — <code>missing_publisher</code> — Publisher is absent for eesti_pärimusmuusika_keskuse_õppevideod (kit 465).</summary>

- Classification: `source_supported_metadata_limitation`
- Routes: `grade-2-music`
- Books: `eesti_pärimusmuusika_keskuse_õppevideod`
- Kits: 465
- Action: Do not invent a publisher. A current Kit Details or cover-only capture may fill this optional metadata later.
- Exact URLs:
  - https://www.opiq.ee/kit/465/chapter/25281
  - https://www.opiq.ee/kit/465/chapter/25282
  - https://www.opiq.ee/kit/465/chapter/25283
  - https://www.opiq.ee/kit/465/chapter/25284
  - https://www.opiq.ee/kit/465/chapter/25285
  - https://www.opiq.ee/kit/465/chapter/25286
  - https://www.opiq.ee/kit/465/chapter/25287
  - https://www.opiq.ee/kit/465/chapter/25288
  - https://www.opiq.ee/kit/465/chapter/25289
  - https://www.opiq.ee/kit/465/chapter/25290
  - https://www.opiq.ee/kit/465/chapter/25291
  - https://www.opiq.ee/kit/465/chapter/25292
  - https://www.opiq.ee/kit/465/chapter/25293
  - https://www.opiq.ee/kit/465/chapter/25294
  - https://www.opiq.ee/kit/465/chapter/25295
  - https://www.opiq.ee/kit/465/chapter/25296
  - https://www.opiq.ee/kit/465/chapter/25297
  - https://www.opiq.ee/kit/465/chapter/25298
  - https://www.opiq.ee/kit/465/chapter/25299
  - https://www.opiq.ee/kit/465/chapter/25300
  - https://www.opiq.ee/kit/465/chapter/25301
  - https://www.opiq.ee/kit/465/chapter/25302
  - https://www.opiq.ee/kit/465/chapter/25303
  - https://www.opiq.ee/kit/465/chapter/25304
  - https://www.opiq.ee/kit/465/chapter/25305
  - https://www.opiq.ee/kit/465/chapter/25306
  - https://www.opiq.ee/kit/465/chapter/25308
  - https://www.opiq.ee/kit/465/chapter/25311
  - https://www.opiq.ee/kit/465/chapter/25312
  - https://www.opiq.ee/kit/465/chapter/25921
  - https://www.opiq.ee/kit/465/chapter/25922
  - https://www.opiq.ee/kit/465/chapter/25923
  - https://www.opiq.ee/kit/465/chapter/25924

</details>

<details><summary><code>g2q-0305</code> — <code>missing_publisher</code> — Publisher is absent for muusikaõpik_2._klassile_2024 (kit 556).</summary>

- Classification: `source_supported_metadata_limitation`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile_2024`
- Kits: 556
- Action: Do not invent a publisher. A current Kit Details or cover-only capture may fill this optional metadata later.
- Exact URLs:
  - https://www.opiq.ee/kit/556/chapter/31279
  - https://www.opiq.ee/kit/556/chapter/31280
  - https://www.opiq.ee/kit/556/chapter/31281
  - https://www.opiq.ee/kit/556/chapter/31282
  - https://www.opiq.ee/kit/556/chapter/31283
  - https://www.opiq.ee/kit/556/chapter/31284
  - https://www.opiq.ee/kit/556/chapter/31285
  - https://www.opiq.ee/kit/556/chapter/31286
  - https://www.opiq.ee/kit/556/chapter/31287
  - https://www.opiq.ee/kit/556/chapter/31288
  - https://www.opiq.ee/kit/556/chapter/31289
  - https://www.opiq.ee/kit/556/chapter/31290
  - https://www.opiq.ee/kit/556/chapter/31291
  - https://www.opiq.ee/kit/556/chapter/31292
  - https://www.opiq.ee/kit/556/chapter/31293
  - https://www.opiq.ee/kit/556/chapter/31294
  - https://www.opiq.ee/kit/556/chapter/31295
  - https://www.opiq.ee/kit/556/chapter/31296
  - https://www.opiq.ee/kit/556/chapter/31297
  - https://www.opiq.ee/kit/556/chapter/31298
  - https://www.opiq.ee/kit/556/chapter/31299
  - https://www.opiq.ee/kit/556/chapter/31300
  - https://www.opiq.ee/kit/556/chapter/31301
  - https://www.opiq.ee/kit/556/chapter/31302
  - https://www.opiq.ee/kit/556/chapter/31303
  - https://www.opiq.ee/kit/556/chapter/31304
  - https://www.opiq.ee/kit/556/chapter/31305
  - https://www.opiq.ee/kit/556/chapter/31306

</details>

<details><summary><code>g2q-0306</code> — <code>missing_publisher</code> — Publisher is absent for muusikaõpik_2._klassile (kit 193).</summary>

- Classification: `source_supported_metadata_limitation`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`
- Kits: 193
- Action: Do not invent a publisher. A current Kit Details or cover-only capture may fill this optional metadata later.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10970
  - https://www.opiq.ee/kit/193/chapter/10971
  - https://www.opiq.ee/kit/193/chapter/10972
  - https://www.opiq.ee/kit/193/chapter/10973
  - https://www.opiq.ee/kit/193/chapter/10974
  - https://www.opiq.ee/kit/193/chapter/10975
  - https://www.opiq.ee/kit/193/chapter/10976
  - https://www.opiq.ee/kit/193/chapter/10977
  - https://www.opiq.ee/kit/193/chapter/10978
  - https://www.opiq.ee/kit/193/chapter/10979
  - https://www.opiq.ee/kit/193/chapter/10980
  - https://www.opiq.ee/kit/193/chapter/10981
  - https://www.opiq.ee/kit/193/chapter/10982
  - https://www.opiq.ee/kit/193/chapter/10983
  - https://www.opiq.ee/kit/193/chapter/10984
  - https://www.opiq.ee/kit/193/chapter/10985
  - https://www.opiq.ee/kit/193/chapter/10986
  - https://www.opiq.ee/kit/193/chapter/10987
  - https://www.opiq.ee/kit/193/chapter/10988
  - https://www.opiq.ee/kit/193/chapter/10989
  - https://www.opiq.ee/kit/193/chapter/10990
  - https://www.opiq.ee/kit/193/chapter/10991
  - https://www.opiq.ee/kit/193/chapter/10992
  - https://www.opiq.ee/kit/193/chapter/10993
  - https://www.opiq.ee/kit/193/chapter/10994
  - https://www.opiq.ee/kit/193/chapter/10995
  - https://www.opiq.ee/kit/193/chapter/10996
  - https://www.opiq.ee/kit/193/chapter/10997
  - https://www.opiq.ee/kit/193/chapter/19530

</details>

<details><summary><code>g2q-0307</code> — <code>missing_publisher</code> — Publisher is absent for музыка_–_волшебная_страна._2_класс (kit 238).</summary>

- Classification: `source_supported_metadata_limitation`
- Routes: `grade-2-music`
- Books: `музыка_–_волшебная_страна._2_класс`
- Kits: 238
- Action: Do not invent a publisher. A current Kit Details or cover-only capture may fill this optional metadata later.
- Exact URLs:
  - https://www.opiq.ee/kit/238/chapter/13449
  - https://www.opiq.ee/kit/238/chapter/13450
  - https://www.opiq.ee/kit/238/chapter/13451
  - https://www.opiq.ee/kit/238/chapter/13452
  - https://www.opiq.ee/kit/238/chapter/13453
  - https://www.opiq.ee/kit/238/chapter/13454
  - https://www.opiq.ee/kit/238/chapter/13455
  - https://www.opiq.ee/kit/238/chapter/13456
  - https://www.opiq.ee/kit/238/chapter/13457
  - https://www.opiq.ee/kit/238/chapter/13458
  - https://www.opiq.ee/kit/238/chapter/13459
  - https://www.opiq.ee/kit/238/chapter/13460
  - https://www.opiq.ee/kit/238/chapter/13461
  - https://www.opiq.ee/kit/238/chapter/13462
  - https://www.opiq.ee/kit/238/chapter/13463
  - https://www.opiq.ee/kit/238/chapter/13464
  - https://www.opiq.ee/kit/238/chapter/13465
  - https://www.opiq.ee/kit/238/chapter/13466
  - https://www.opiq.ee/kit/238/chapter/13467
  - https://www.opiq.ee/kit/238/chapter/13468
  - https://www.opiq.ee/kit/238/chapter/13469
  - https://www.opiq.ee/kit/238/chapter/13470
  - https://www.opiq.ee/kit/238/chapter/13471
  - https://www.opiq.ee/kit/238/chapter/13472
  - https://www.opiq.ee/kit/238/chapter/13473
  - https://www.opiq.ee/kit/238/chapter/13474
  - https://www.opiq.ee/kit/238/chapter/13475
  - https://www.opiq.ee/kit/238/chapter/13476
  - https://www.opiq.ee/kit/238/chapter/13477
  - https://www.opiq.ee/kit/238/chapter/13478
  - https://www.opiq.ee/kit/238/chapter/13479
  - https://www.opiq.ee/kit/238/chapter/13480
  - https://www.opiq.ee/kit/238/chapter/13481
  - https://www.opiq.ee/kit/238/chapter/13482
  - https://www.opiq.ee/kit/238/chapter/13483
  - https://www.opiq.ee/kit/238/chapter/13484
  - https://www.opiq.ee/kit/238/chapter/13485
  - https://www.opiq.ee/kit/238/chapter/13486
  - https://www.opiq.ee/kit/238/chapter/13487
  - https://www.opiq.ee/kit/238/chapter/13488
  - https://www.opiq.ee/kit/238/chapter/13489
  - https://www.opiq.ee/kit/238/chapter/13490
  - https://www.opiq.ee/kit/238/chapter/13491
  - https://www.opiq.ee/kit/238/chapter/13492
  - https://www.opiq.ee/kit/238/chapter/13493
  - https://www.opiq.ee/kit/238/chapter/13494
  - https://www.opiq.ee/kit/238/chapter/13495
  - https://www.opiq.ee/kit/238/chapter/13496
  - https://www.opiq.ee/kit/238/chapter/13497
  - https://www.opiq.ee/kit/238/chapter/13498
  - https://www.opiq.ee/kit/238/chapter/13499
  - https://www.opiq.ee/kit/238/chapter/13500
  - https://www.opiq.ee/kit/238/chapter/13501
  - https://www.opiq.ee/kit/238/chapter/13502
  - https://www.opiq.ee/kit/238/chapter/13503
  - https://www.opiq.ee/kit/238/chapter/13504
  - https://www.opiq.ee/kit/238/chapter/13505
  - https://www.opiq.ee/kit/238/chapter/13506
  - https://www.opiq.ee/kit/238/chapter/13507
  - https://www.opiq.ee/kit/238/chapter/13508
  - https://www.opiq.ee/kit/238/chapter/13509
  - https://www.opiq.ee/kit/238/chapter/13510
  - https://www.opiq.ee/kit/238/chapter/13511
  - https://www.opiq.ee/kit/238/chapter/13512
  - https://www.opiq.ee/kit/238/chapter/13513
  - https://www.opiq.ee/kit/238/chapter/13514
  - https://www.opiq.ee/kit/238/chapter/13515
  - https://www.opiq.ee/kit/238/chapter/13516
  - https://www.opiq.ee/kit/238/chapter/13517
  - https://www.opiq.ee/kit/238/chapter/13518
  - https://www.opiq.ee/kit/238/chapter/13519
  - https://www.opiq.ee/kit/238/chapter/13520
  - https://www.opiq.ee/kit/238/chapter/13521
  - https://www.opiq.ee/kit/238/chapter/13522
  - https://www.opiq.ee/kit/238/chapter/13523
  - https://www.opiq.ee/kit/238/chapter/13524
  - https://www.opiq.ee/kit/238/chapter/13525
  - https://www.opiq.ee/kit/238/chapter/13526
  - https://www.opiq.ee/kit/238/chapter/13527
  - https://www.opiq.ee/kit/238/chapter/13528
  - https://www.opiq.ee/kit/238/chapter/13529
  - https://www.opiq.ee/kit/238/chapter/13530
  - https://www.opiq.ee/kit/238/chapter/13531
  - https://www.opiq.ee/kit/238/chapter/13532
  - https://www.opiq.ee/kit/238/chapter/13533
  - https://www.opiq.ee/kit/238/chapter/13534
  - https://www.opiq.ee/kit/238/chapter/13535
  - https://www.opiq.ee/kit/238/chapter/13536
  - https://www.opiq.ee/kit/238/chapter/13537
  - https://www.opiq.ee/kit/238/chapter/13538
  - https://www.opiq.ee/kit/238/chapter/13539
  - https://www.opiq.ee/kit/238/chapter/13540
  - https://www.opiq.ee/kit/238/chapter/13541
  - https://www.opiq.ee/kit/238/chapter/13542
  - https://www.opiq.ee/kit/238/chapter/13543
  - https://www.opiq.ee/kit/238/chapter/13544
  - https://www.opiq.ee/kit/238/chapter/13545
  - https://www.opiq.ee/kit/238/chapter/13546
  - https://www.opiq.ee/kit/238/chapter/13547
  - https://www.opiq.ee/kit/238/chapter/13548
  - https://www.opiq.ee/kit/238/chapter/13549
  - https://www.opiq.ee/kit/238/chapter/13550
  - https://www.opiq.ee/kit/238/chapter/13551
  - https://www.opiq.ee/kit/238/chapter/13552
  - https://www.opiq.ee/kit/238/chapter/13553
  - https://www.opiq.ee/kit/238/chapter/13554
  - https://www.opiq.ee/kit/238/chapter/13555
  - https://www.opiq.ee/kit/238/chapter/13556
  - https://www.opiq.ee/kit/238/chapter/13557
  - https://www.opiq.ee/kit/238/chapter/13558
  - https://www.opiq.ee/kit/238/chapter/13559

</details>

<details><summary><code>g2q-0308</code> — <code>missing_task_examples</code> — 89 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-arts-and-crafts`
- Books: `kunsti-_ja_tööõpetus._2._osa`
- Kits: 192
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/192/chapter/10881
  - https://www.opiq.ee/kit/192/chapter/10882
  - https://www.opiq.ee/kit/192/chapter/10883
  - https://www.opiq.ee/kit/192/chapter/10884
  - https://www.opiq.ee/kit/192/chapter/10885
  - https://www.opiq.ee/kit/192/chapter/10886
  - https://www.opiq.ee/kit/192/chapter/10887
  - https://www.opiq.ee/kit/192/chapter/10888
  - https://www.opiq.ee/kit/192/chapter/10889
  - https://www.opiq.ee/kit/192/chapter/10890
  - https://www.opiq.ee/kit/192/chapter/10891
  - https://www.opiq.ee/kit/192/chapter/10892
  - https://www.opiq.ee/kit/192/chapter/10893
  - https://www.opiq.ee/kit/192/chapter/10894
  - https://www.opiq.ee/kit/192/chapter/10895
  - https://www.opiq.ee/kit/192/chapter/10896
  - https://www.opiq.ee/kit/192/chapter/10897
  - https://www.opiq.ee/kit/192/chapter/10898
  - https://www.opiq.ee/kit/192/chapter/10899
  - https://www.opiq.ee/kit/192/chapter/10900
  - https://www.opiq.ee/kit/192/chapter/10901
  - https://www.opiq.ee/kit/192/chapter/10902
  - https://www.opiq.ee/kit/192/chapter/10903
  - https://www.opiq.ee/kit/192/chapter/10904
  - https://www.opiq.ee/kit/192/chapter/10905
  - https://www.opiq.ee/kit/192/chapter/10906
  - https://www.opiq.ee/kit/192/chapter/10907
  - https://www.opiq.ee/kit/192/chapter/10908
  - https://www.opiq.ee/kit/192/chapter/10909
  - https://www.opiq.ee/kit/192/chapter/10910
  - https://www.opiq.ee/kit/192/chapter/10911
  - https://www.opiq.ee/kit/192/chapter/10912
  - https://www.opiq.ee/kit/192/chapter/10913
  - https://www.opiq.ee/kit/192/chapter/10914
  - https://www.opiq.ee/kit/192/chapter/10915
  - https://www.opiq.ee/kit/192/chapter/10916
  - https://www.opiq.ee/kit/192/chapter/10917
  - https://www.opiq.ee/kit/192/chapter/10918
  - https://www.opiq.ee/kit/192/chapter/10919
  - https://www.opiq.ee/kit/192/chapter/10920
  - https://www.opiq.ee/kit/192/chapter/10921
  - https://www.opiq.ee/kit/192/chapter/10922
  - https://www.opiq.ee/kit/192/chapter/10923
  - https://www.opiq.ee/kit/192/chapter/10924
  - https://www.opiq.ee/kit/192/chapter/10925
  - https://www.opiq.ee/kit/192/chapter/10926
  - https://www.opiq.ee/kit/192/chapter/10927
  - https://www.opiq.ee/kit/192/chapter/10928
  - https://www.opiq.ee/kit/192/chapter/10929
  - https://www.opiq.ee/kit/192/chapter/10930
  - https://www.opiq.ee/kit/192/chapter/10931
  - https://www.opiq.ee/kit/192/chapter/10932
  - https://www.opiq.ee/kit/192/chapter/10933
  - https://www.opiq.ee/kit/192/chapter/10934
  - https://www.opiq.ee/kit/192/chapter/10935
  - https://www.opiq.ee/kit/192/chapter/10936
  - https://www.opiq.ee/kit/192/chapter/10937
  - https://www.opiq.ee/kit/192/chapter/10938
  - https://www.opiq.ee/kit/192/chapter/10939
  - https://www.opiq.ee/kit/192/chapter/10940
  - https://www.opiq.ee/kit/192/chapter/10941
  - https://www.opiq.ee/kit/192/chapter/10942
  - https://www.opiq.ee/kit/192/chapter/10943
  - https://www.opiq.ee/kit/192/chapter/10944
  - https://www.opiq.ee/kit/192/chapter/10945
  - https://www.opiq.ee/kit/192/chapter/10946
  - https://www.opiq.ee/kit/192/chapter/10947
  - https://www.opiq.ee/kit/192/chapter/10948
  - https://www.opiq.ee/kit/192/chapter/10949
  - https://www.opiq.ee/kit/192/chapter/10950
  - https://www.opiq.ee/kit/192/chapter/10951
  - https://www.opiq.ee/kit/192/chapter/10952
  - https://www.opiq.ee/kit/192/chapter/10953
  - https://www.opiq.ee/kit/192/chapter/10954
  - https://www.opiq.ee/kit/192/chapter/10955
  - https://www.opiq.ee/kit/192/chapter/10956
  - https://www.opiq.ee/kit/192/chapter/10957
  - https://www.opiq.ee/kit/192/chapter/10958
  - https://www.opiq.ee/kit/192/chapter/10959
  - https://www.opiq.ee/kit/192/chapter/10960
  - https://www.opiq.ee/kit/192/chapter/10961
  - https://www.opiq.ee/kit/192/chapter/10962
  - https://www.opiq.ee/kit/192/chapter/10963
  - https://www.opiq.ee/kit/192/chapter/10964
  - https://www.opiq.ee/kit/192/chapter/10965
  - https://www.opiq.ee/kit/192/chapter/10966
  - https://www.opiq.ee/kit/192/chapter/10967
  - https://www.opiq.ee/kit/192/chapter/10968
  - https://www.opiq.ee/kit/192/chapter/10969

</details>

<details><summary><code>g2q-0309</code> — <code>missing_task_examples</code> — 85 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-arts-and-crafts`
- Books: `kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid`
- Kits: 200
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/200/chapter/11374
  - https://www.opiq.ee/kit/200/chapter/11375
  - https://www.opiq.ee/kit/200/chapter/11376
  - https://www.opiq.ee/kit/200/chapter/11377
  - https://www.opiq.ee/kit/200/chapter/11378
  - https://www.opiq.ee/kit/200/chapter/11379
  - https://www.opiq.ee/kit/200/chapter/11380
  - https://www.opiq.ee/kit/200/chapter/11381
  - https://www.opiq.ee/kit/200/chapter/11382
  - https://www.opiq.ee/kit/200/chapter/11383
  - https://www.opiq.ee/kit/200/chapter/11384
  - https://www.opiq.ee/kit/200/chapter/11385
  - https://www.opiq.ee/kit/200/chapter/11386
  - https://www.opiq.ee/kit/200/chapter/11387
  - https://www.opiq.ee/kit/200/chapter/11388
  - https://www.opiq.ee/kit/200/chapter/11389
  - https://www.opiq.ee/kit/200/chapter/11390
  - https://www.opiq.ee/kit/200/chapter/11391
  - https://www.opiq.ee/kit/200/chapter/11392
  - https://www.opiq.ee/kit/200/chapter/11393
  - https://www.opiq.ee/kit/200/chapter/11394
  - https://www.opiq.ee/kit/200/chapter/11395
  - https://www.opiq.ee/kit/200/chapter/11396
  - https://www.opiq.ee/kit/200/chapter/11397
  - https://www.opiq.ee/kit/200/chapter/11398
  - https://www.opiq.ee/kit/200/chapter/11399
  - https://www.opiq.ee/kit/200/chapter/11400
  - https://www.opiq.ee/kit/200/chapter/11401
  - https://www.opiq.ee/kit/200/chapter/11402
  - https://www.opiq.ee/kit/200/chapter/11403
  - https://www.opiq.ee/kit/200/chapter/11404
  - https://www.opiq.ee/kit/200/chapter/11405
  - https://www.opiq.ee/kit/200/chapter/11406
  - https://www.opiq.ee/kit/200/chapter/11407
  - https://www.opiq.ee/kit/200/chapter/11408
  - https://www.opiq.ee/kit/200/chapter/11409
  - https://www.opiq.ee/kit/200/chapter/11410
  - https://www.opiq.ee/kit/200/chapter/11411
  - https://www.opiq.ee/kit/200/chapter/11412
  - https://www.opiq.ee/kit/200/chapter/11413
  - https://www.opiq.ee/kit/200/chapter/11414
  - https://www.opiq.ee/kit/200/chapter/11415
  - https://www.opiq.ee/kit/200/chapter/11416
  - https://www.opiq.ee/kit/200/chapter/11417
  - https://www.opiq.ee/kit/200/chapter/11418
  - https://www.opiq.ee/kit/200/chapter/11419
  - https://www.opiq.ee/kit/200/chapter/11420
  - https://www.opiq.ee/kit/200/chapter/11421
  - https://www.opiq.ee/kit/200/chapter/11422
  - https://www.opiq.ee/kit/200/chapter/11423
  - https://www.opiq.ee/kit/200/chapter/11424
  - https://www.opiq.ee/kit/200/chapter/11425
  - https://www.opiq.ee/kit/200/chapter/11426
  - https://www.opiq.ee/kit/200/chapter/11427
  - https://www.opiq.ee/kit/200/chapter/11428
  - https://www.opiq.ee/kit/200/chapter/11429
  - https://www.opiq.ee/kit/200/chapter/11430
  - https://www.opiq.ee/kit/200/chapter/11431
  - https://www.opiq.ee/kit/200/chapter/11432
  - https://www.opiq.ee/kit/200/chapter/11433
  - https://www.opiq.ee/kit/200/chapter/11434
  - https://www.opiq.ee/kit/200/chapter/11435
  - https://www.opiq.ee/kit/200/chapter/11436
  - https://www.opiq.ee/kit/200/chapter/11437
  - https://www.opiq.ee/kit/200/chapter/11438
  - https://www.opiq.ee/kit/200/chapter/11439
  - https://www.opiq.ee/kit/200/chapter/11440
  - https://www.opiq.ee/kit/200/chapter/11441
  - https://www.opiq.ee/kit/200/chapter/11442
  - https://www.opiq.ee/kit/200/chapter/11443
  - https://www.opiq.ee/kit/200/chapter/11444
  - https://www.opiq.ee/kit/200/chapter/11445
  - https://www.opiq.ee/kit/200/chapter/11446
  - https://www.opiq.ee/kit/200/chapter/11447
  - https://www.opiq.ee/kit/200/chapter/11448
  - https://www.opiq.ee/kit/200/chapter/11449
  - https://www.opiq.ee/kit/200/chapter/11450
  - https://www.opiq.ee/kit/200/chapter/11451
  - https://www.opiq.ee/kit/200/chapter/11452
  - https://www.opiq.ee/kit/200/chapter/11453
  - https://www.opiq.ee/kit/200/chapter/11454
  - https://www.opiq.ee/kit/200/chapter/11455
  - https://www.opiq.ee/kit/200/chapter/11456
  - https://www.opiq.ee/kit/200/chapter/11457
  - https://www.opiq.ee/kit/200/chapter/11458

</details>

<details><summary><code>g2q-0310</code> — <code>missing_task_examples</code> — 89 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-arts-and-crafts`
- Books: `трудовое_обучение_и_искусство._2_часть`
- Kits: 371
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/371/chapter/20257
  - https://www.opiq.ee/kit/371/chapter/20258
  - https://www.opiq.ee/kit/371/chapter/20259
  - https://www.opiq.ee/kit/371/chapter/20260
  - https://www.opiq.ee/kit/371/chapter/20261
  - https://www.opiq.ee/kit/371/chapter/20262
  - https://www.opiq.ee/kit/371/chapter/20263
  - https://www.opiq.ee/kit/371/chapter/20264
  - https://www.opiq.ee/kit/371/chapter/20265
  - https://www.opiq.ee/kit/371/chapter/20266
  - https://www.opiq.ee/kit/371/chapter/20267
  - https://www.opiq.ee/kit/371/chapter/20268
  - https://www.opiq.ee/kit/371/chapter/20269
  - https://www.opiq.ee/kit/371/chapter/20270
  - https://www.opiq.ee/kit/371/chapter/20271
  - https://www.opiq.ee/kit/371/chapter/20272
  - https://www.opiq.ee/kit/371/chapter/20273
  - https://www.opiq.ee/kit/371/chapter/20274
  - https://www.opiq.ee/kit/371/chapter/20275
  - https://www.opiq.ee/kit/371/chapter/20276
  - https://www.opiq.ee/kit/371/chapter/20277
  - https://www.opiq.ee/kit/371/chapter/20278
  - https://www.opiq.ee/kit/371/chapter/20279
  - https://www.opiq.ee/kit/371/chapter/20280
  - https://www.opiq.ee/kit/371/chapter/20281
  - https://www.opiq.ee/kit/371/chapter/20282
  - https://www.opiq.ee/kit/371/chapter/20283
  - https://www.opiq.ee/kit/371/chapter/20284
  - https://www.opiq.ee/kit/371/chapter/20285
  - https://www.opiq.ee/kit/371/chapter/20286
  - https://www.opiq.ee/kit/371/chapter/20287
  - https://www.opiq.ee/kit/371/chapter/20288
  - https://www.opiq.ee/kit/371/chapter/20289
  - https://www.opiq.ee/kit/371/chapter/20290
  - https://www.opiq.ee/kit/371/chapter/20291
  - https://www.opiq.ee/kit/371/chapter/20292
  - https://www.opiq.ee/kit/371/chapter/20293
  - https://www.opiq.ee/kit/371/chapter/20294
  - https://www.opiq.ee/kit/371/chapter/20295
  - https://www.opiq.ee/kit/371/chapter/20296
  - https://www.opiq.ee/kit/371/chapter/20297
  - https://www.opiq.ee/kit/371/chapter/20298
  - https://www.opiq.ee/kit/371/chapter/20299
  - https://www.opiq.ee/kit/371/chapter/20300
  - https://www.opiq.ee/kit/371/chapter/20301
  - https://www.opiq.ee/kit/371/chapter/20302
  - https://www.opiq.ee/kit/371/chapter/20303
  - https://www.opiq.ee/kit/371/chapter/20304
  - https://www.opiq.ee/kit/371/chapter/20305
  - https://www.opiq.ee/kit/371/chapter/20306
  - https://www.opiq.ee/kit/371/chapter/20307
  - https://www.opiq.ee/kit/371/chapter/20308
  - https://www.opiq.ee/kit/371/chapter/20309
  - https://www.opiq.ee/kit/371/chapter/20310
  - https://www.opiq.ee/kit/371/chapter/20311
  - https://www.opiq.ee/kit/371/chapter/20312
  - https://www.opiq.ee/kit/371/chapter/20313
  - https://www.opiq.ee/kit/371/chapter/20314
  - https://www.opiq.ee/kit/371/chapter/20315
  - https://www.opiq.ee/kit/371/chapter/20316
  - https://www.opiq.ee/kit/371/chapter/20317
  - https://www.opiq.ee/kit/371/chapter/20318
  - https://www.opiq.ee/kit/371/chapter/20319
  - https://www.opiq.ee/kit/371/chapter/20320
  - https://www.opiq.ee/kit/371/chapter/20321
  - https://www.opiq.ee/kit/371/chapter/20322
  - https://www.opiq.ee/kit/371/chapter/20323
  - https://www.opiq.ee/kit/371/chapter/20324
  - https://www.opiq.ee/kit/371/chapter/20325
  - https://www.opiq.ee/kit/371/chapter/20326
  - https://www.opiq.ee/kit/371/chapter/20327
  - https://www.opiq.ee/kit/371/chapter/20328
  - https://www.opiq.ee/kit/371/chapter/20329
  - https://www.opiq.ee/kit/371/chapter/20330
  - https://www.opiq.ee/kit/371/chapter/20331
  - https://www.opiq.ee/kit/371/chapter/20332
  - https://www.opiq.ee/kit/371/chapter/20333
  - https://www.opiq.ee/kit/371/chapter/20334
  - https://www.opiq.ee/kit/371/chapter/20335
  - https://www.opiq.ee/kit/371/chapter/20336
  - https://www.opiq.ee/kit/371/chapter/20337
  - https://www.opiq.ee/kit/371/chapter/20338
  - https://www.opiq.ee/kit/371/chapter/20339
  - https://www.opiq.ee/kit/371/chapter/20340
  - https://www.opiq.ee/kit/371/chapter/20341
  - https://www.opiq.ee/kit/371/chapter/20342
  - https://www.opiq.ee/kit/371/chapter/20343
  - https://www.opiq.ee/kit/371/chapter/20344
  - https://www.opiq.ee/kit/371/chapter/20345

</details>

<details><summary><code>g2q-0311</code> — <code>missing_task_examples</code> — 72 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-estonian-second-language`
- Books: `koolibri_koos_on_lõ_2_et`
- Kits: 129
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/129/chapter/6937
  - https://www.opiq.ee/kit/129/chapter/6938
  - https://www.opiq.ee/kit/129/chapter/6939
  - https://www.opiq.ee/kit/129/chapter/6940
  - https://www.opiq.ee/kit/129/chapter/6941
  - https://www.opiq.ee/kit/129/chapter/6942
  - https://www.opiq.ee/kit/129/chapter/6943
  - https://www.opiq.ee/kit/129/chapter/6944
  - https://www.opiq.ee/kit/129/chapter/6945
  - https://www.opiq.ee/kit/129/chapter/6946
  - https://www.opiq.ee/kit/129/chapter/6947
  - https://www.opiq.ee/kit/129/chapter/6948
  - https://www.opiq.ee/kit/129/chapter/6949
  - https://www.opiq.ee/kit/129/chapter/6950
  - https://www.opiq.ee/kit/129/chapter/6951
  - https://www.opiq.ee/kit/129/chapter/6952
  - https://www.opiq.ee/kit/129/chapter/6953
  - https://www.opiq.ee/kit/129/chapter/6954
  - https://www.opiq.ee/kit/129/chapter/6955
  - https://www.opiq.ee/kit/129/chapter/6956
  - https://www.opiq.ee/kit/129/chapter/6957
  - https://www.opiq.ee/kit/129/chapter/6958
  - https://www.opiq.ee/kit/129/chapter/6959
  - https://www.opiq.ee/kit/129/chapter/6960
  - https://www.opiq.ee/kit/129/chapter/6961
  - https://www.opiq.ee/kit/129/chapter/6962
  - https://www.opiq.ee/kit/129/chapter/6963
  - https://www.opiq.ee/kit/129/chapter/6964
  - https://www.opiq.ee/kit/129/chapter/6965
  - https://www.opiq.ee/kit/129/chapter/6966
  - https://www.opiq.ee/kit/129/chapter/6967
  - https://www.opiq.ee/kit/129/chapter/6968
  - https://www.opiq.ee/kit/129/chapter/6969
  - https://www.opiq.ee/kit/129/chapter/6970
  - https://www.opiq.ee/kit/129/chapter/6971
  - https://www.opiq.ee/kit/129/chapter/6972
  - https://www.opiq.ee/kit/129/chapter/6973
  - https://www.opiq.ee/kit/129/chapter/6974
  - https://www.opiq.ee/kit/129/chapter/6975
  - https://www.opiq.ee/kit/129/chapter/6976
  - https://www.opiq.ee/kit/129/chapter/6977
  - https://www.opiq.ee/kit/129/chapter/6978
  - https://www.opiq.ee/kit/129/chapter/6979
  - https://www.opiq.ee/kit/129/chapter/6980
  - https://www.opiq.ee/kit/129/chapter/6981
  - https://www.opiq.ee/kit/129/chapter/6982
  - https://www.opiq.ee/kit/129/chapter/6983
  - https://www.opiq.ee/kit/129/chapter/6984
  - https://www.opiq.ee/kit/129/chapter/6985
  - https://www.opiq.ee/kit/129/chapter/6986
  - https://www.opiq.ee/kit/129/chapter/6987
  - https://www.opiq.ee/kit/129/chapter/6988
  - https://www.opiq.ee/kit/129/chapter/6989
  - https://www.opiq.ee/kit/129/chapter/6990
  - https://www.opiq.ee/kit/129/chapter/6991
  - https://www.opiq.ee/kit/129/chapter/6992
  - https://www.opiq.ee/kit/129/chapter/6993
  - https://www.opiq.ee/kit/129/chapter/6994
  - https://www.opiq.ee/kit/129/chapter/6995
  - https://www.opiq.ee/kit/129/chapter/6996
  - https://www.opiq.ee/kit/129/chapter/6997
  - https://www.opiq.ee/kit/129/chapter/6998
  - https://www.opiq.ee/kit/129/chapter/6999
  - https://www.opiq.ee/kit/129/chapter/7000
  - https://www.opiq.ee/kit/129/chapter/7001
  - https://www.opiq.ee/kit/129/chapter/7002
  - https://www.opiq.ee/kit/129/chapter/7003
  - https://www.opiq.ee/kit/129/chapter/7004
  - https://www.opiq.ee/kit/129/chapter/7005
  - https://www.opiq.ee/kit/129/chapter/7006
  - https://www.opiq.ee/kit/129/chapter/7007
  - https://www.opiq.ee/kit/129/chapter/7008

</details>

<details><summary><code>g2q-0312</code> — <code>missing_task_examples</code> — 149 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-estonian`
- Books: `avita_eesti_keel_2_et`
- Kits: 232
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/232/chapter/13198
  - https://www.opiq.ee/kit/232/chapter/13199
  - https://www.opiq.ee/kit/232/chapter/13200
  - https://www.opiq.ee/kit/232/chapter/13201
  - https://www.opiq.ee/kit/232/chapter/13202
  - https://www.opiq.ee/kit/232/chapter/13221
  - https://www.opiq.ee/kit/232/chapter/13222
  - https://www.opiq.ee/kit/232/chapter/13223
  - https://www.opiq.ee/kit/232/chapter/13224
  - https://www.opiq.ee/kit/232/chapter/13730
  - https://www.opiq.ee/kit/232/chapter/13749
  - https://www.opiq.ee/kit/232/chapter/13750
  - https://www.opiq.ee/kit/232/chapter/13751
  - https://www.opiq.ee/kit/232/chapter/13752
  - https://www.opiq.ee/kit/232/chapter/13940
  - https://www.opiq.ee/kit/232/chapter/13941
  - https://www.opiq.ee/kit/232/chapter/13942
  - https://www.opiq.ee/kit/232/chapter/13943
  - https://www.opiq.ee/kit/232/chapter/13944
  - https://www.opiq.ee/kit/232/chapter/13945
  - https://www.opiq.ee/kit/232/chapter/14032
  - https://www.opiq.ee/kit/232/chapter/14033
  - https://www.opiq.ee/kit/232/chapter/14128
  - https://www.opiq.ee/kit/232/chapter/14129
  - https://www.opiq.ee/kit/232/chapter/14130
  - https://www.opiq.ee/kit/232/chapter/14131
  - https://www.opiq.ee/kit/232/chapter/14132
  - https://www.opiq.ee/kit/232/chapter/14133
  - https://www.opiq.ee/kit/232/chapter/14134
  - https://www.opiq.ee/kit/232/chapter/14135
  - https://www.opiq.ee/kit/232/chapter/14136
  - https://www.opiq.ee/kit/232/chapter/14137
  - https://www.opiq.ee/kit/232/chapter/14138
  - https://www.opiq.ee/kit/232/chapter/14139
  - https://www.opiq.ee/kit/232/chapter/14140
  - https://www.opiq.ee/kit/232/chapter/14141
  - https://www.opiq.ee/kit/232/chapter/14142
  - https://www.opiq.ee/kit/232/chapter/14143
  - https://www.opiq.ee/kit/232/chapter/14144
  - https://www.opiq.ee/kit/232/chapter/14145
  - https://www.opiq.ee/kit/232/chapter/14146
  - https://www.opiq.ee/kit/232/chapter/14147
  - https://www.opiq.ee/kit/232/chapter/14218
  - https://www.opiq.ee/kit/232/chapter/14219
  - https://www.opiq.ee/kit/232/chapter/14220
  - https://www.opiq.ee/kit/232/chapter/14221
  - https://www.opiq.ee/kit/232/chapter/14222
  - https://www.opiq.ee/kit/232/chapter/14223
  - https://www.opiq.ee/kit/232/chapter/14224
  - https://www.opiq.ee/kit/232/chapter/14225
  - https://www.opiq.ee/kit/232/chapter/14226
  - https://www.opiq.ee/kit/232/chapter/14227
  - https://www.opiq.ee/kit/232/chapter/14228
  - https://www.opiq.ee/kit/232/chapter/15698
  - https://www.opiq.ee/kit/232/chapter/15699
  - https://www.opiq.ee/kit/232/chapter/15700
  - https://www.opiq.ee/kit/232/chapter/15701
  - https://www.opiq.ee/kit/232/chapter/15702
  - https://www.opiq.ee/kit/232/chapter/15703
  - https://www.opiq.ee/kit/232/chapter/15704
  - https://www.opiq.ee/kit/232/chapter/15705
  - https://www.opiq.ee/kit/232/chapter/15706
  - https://www.opiq.ee/kit/232/chapter/15707
  - https://www.opiq.ee/kit/232/chapter/15708
  - https://www.opiq.ee/kit/232/chapter/15709
  - https://www.opiq.ee/kit/232/chapter/15710
  - https://www.opiq.ee/kit/232/chapter/15711
  - https://www.opiq.ee/kit/232/chapter/15712
  - https://www.opiq.ee/kit/232/chapter/15713
  - https://www.opiq.ee/kit/232/chapter/15714
  - https://www.opiq.ee/kit/232/chapter/15715
  - https://www.opiq.ee/kit/232/chapter/15716
  - https://www.opiq.ee/kit/232/chapter/15717
  - https://www.opiq.ee/kit/232/chapter/15718
  - https://www.opiq.ee/kit/232/chapter/15719
  - https://www.opiq.ee/kit/232/chapter/15720
  - https://www.opiq.ee/kit/232/chapter/15721
  - https://www.opiq.ee/kit/232/chapter/15722
  - https://www.opiq.ee/kit/232/chapter/15723
  - https://www.opiq.ee/kit/232/chapter/15724
  - https://www.opiq.ee/kit/232/chapter/15725
  - https://www.opiq.ee/kit/232/chapter/15726
  - https://www.opiq.ee/kit/232/chapter/15727
  - https://www.opiq.ee/kit/232/chapter/15728
  - https://www.opiq.ee/kit/232/chapter/15729
  - https://www.opiq.ee/kit/232/chapter/16881
  - https://www.opiq.ee/kit/232/chapter/16882
  - https://www.opiq.ee/kit/232/chapter/16883
  - https://www.opiq.ee/kit/232/chapter/16884
  - https://www.opiq.ee/kit/232/chapter/16885
  - https://www.opiq.ee/kit/232/chapter/16886
  - https://www.opiq.ee/kit/232/chapter/16887
  - https://www.opiq.ee/kit/232/chapter/16888
  - https://www.opiq.ee/kit/232/chapter/17225
  - https://www.opiq.ee/kit/232/chapter/17226
  - https://www.opiq.ee/kit/232/chapter/17227
  - https://www.opiq.ee/kit/232/chapter/17228
  - https://www.opiq.ee/kit/232/chapter/17229
  - https://www.opiq.ee/kit/232/chapter/17230
  - https://www.opiq.ee/kit/232/chapter/17231
  - https://www.opiq.ee/kit/232/chapter/17232
  - https://www.opiq.ee/kit/232/chapter/17400
  - https://www.opiq.ee/kit/232/chapter/17401
  - https://www.opiq.ee/kit/232/chapter/17402
  - https://www.opiq.ee/kit/232/chapter/17403
  - https://www.opiq.ee/kit/232/chapter/17404
  - https://www.opiq.ee/kit/232/chapter/17405
  - https://www.opiq.ee/kit/232/chapter/17406
  - https://www.opiq.ee/kit/232/chapter/17407
  - https://www.opiq.ee/kit/232/chapter/17408
  - https://www.opiq.ee/kit/232/chapter/17409
  - https://www.opiq.ee/kit/232/chapter/17410
  - https://www.opiq.ee/kit/232/chapter/17411
  - https://www.opiq.ee/kit/232/chapter/18198
  - https://www.opiq.ee/kit/232/chapter/18199
  - https://www.opiq.ee/kit/232/chapter/18200
  - https://www.opiq.ee/kit/232/chapter/18201
  - https://www.opiq.ee/kit/232/chapter/18202
  - https://www.opiq.ee/kit/232/chapter/18203
  - https://www.opiq.ee/kit/232/chapter/18204
  - https://www.opiq.ee/kit/232/chapter/18205
  - https://www.opiq.ee/kit/232/chapter/18461
  - https://www.opiq.ee/kit/232/chapter/18462
  - https://www.opiq.ee/kit/232/chapter/18463
  - https://www.opiq.ee/kit/232/chapter/18464
  - https://www.opiq.ee/kit/232/chapter/18465
  - https://www.opiq.ee/kit/232/chapter/18466
  - https://www.opiq.ee/kit/232/chapter/18467
  - https://www.opiq.ee/kit/232/chapter/18468
  - https://www.opiq.ee/kit/232/chapter/18859
  - https://www.opiq.ee/kit/232/chapter/18860
  - https://www.opiq.ee/kit/232/chapter/18861
  - https://www.opiq.ee/kit/232/chapter/18862
  - https://www.opiq.ee/kit/232/chapter/18863
  - https://www.opiq.ee/kit/232/chapter/18864
  - https://www.opiq.ee/kit/232/chapter/18865
  - https://www.opiq.ee/kit/232/chapter/18866
  - https://www.opiq.ee/kit/232/chapter/18969
  - https://www.opiq.ee/kit/232/chapter/18970
  - https://www.opiq.ee/kit/232/chapter/18971
  - https://www.opiq.ee/kit/232/chapter/18972
  - https://www.opiq.ee/kit/232/chapter/18973
  - https://www.opiq.ee/kit/232/chapter/18974
  - https://www.opiq.ee/kit/232/chapter/18975
  - https://www.opiq.ee/kit/232/chapter/18976
  - https://www.opiq.ee/kit/232/chapter/19106
  - https://www.opiq.ee/kit/232/chapter/19107
  - https://www.opiq.ee/kit/232/chapter/19108
  - https://www.opiq.ee/kit/232/chapter/19109

</details>

<details><summary><code>g2q-0313</code> — <code>missing_task_examples</code> — 182 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-estonian`
- Books: `koolibri_ilus_emake_2_et`
- Kits: 118
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/118/chapter/20794
  - https://www.opiq.ee/kit/118/chapter/20795
  - https://www.opiq.ee/kit/118/chapter/20796
  - https://www.opiq.ee/kit/118/chapter/20797
  - https://www.opiq.ee/kit/118/chapter/20798
  - https://www.opiq.ee/kit/118/chapter/20799
  - https://www.opiq.ee/kit/118/chapter/20800
  - https://www.opiq.ee/kit/118/chapter/20801
  - https://www.opiq.ee/kit/118/chapter/20802
  - https://www.opiq.ee/kit/118/chapter/20803
  - https://www.opiq.ee/kit/118/chapter/20804
  - https://www.opiq.ee/kit/118/chapter/20805
  - https://www.opiq.ee/kit/118/chapter/5863
  - https://www.opiq.ee/kit/118/chapter/5864
  - https://www.opiq.ee/kit/118/chapter/5865
  - https://www.opiq.ee/kit/118/chapter/5866
  - https://www.opiq.ee/kit/118/chapter/5867
  - https://www.opiq.ee/kit/118/chapter/5868
  - https://www.opiq.ee/kit/118/chapter/5869
  - https://www.opiq.ee/kit/118/chapter/5870
  - https://www.opiq.ee/kit/118/chapter/5871
  - https://www.opiq.ee/kit/118/chapter/5872
  - https://www.opiq.ee/kit/118/chapter/5873
  - https://www.opiq.ee/kit/118/chapter/5874
  - https://www.opiq.ee/kit/118/chapter/5875
  - https://www.opiq.ee/kit/118/chapter/5876
  - https://www.opiq.ee/kit/118/chapter/5877
  - https://www.opiq.ee/kit/118/chapter/5878
  - https://www.opiq.ee/kit/118/chapter/5879
  - https://www.opiq.ee/kit/118/chapter/5880
  - https://www.opiq.ee/kit/118/chapter/5881
  - https://www.opiq.ee/kit/118/chapter/5882
  - https://www.opiq.ee/kit/118/chapter/5883
  - https://www.opiq.ee/kit/118/chapter/5884
  - https://www.opiq.ee/kit/118/chapter/5885
  - https://www.opiq.ee/kit/118/chapter/5886
  - https://www.opiq.ee/kit/118/chapter/5887
  - https://www.opiq.ee/kit/118/chapter/5888
  - https://www.opiq.ee/kit/118/chapter/5889
  - https://www.opiq.ee/kit/118/chapter/5890
  - https://www.opiq.ee/kit/118/chapter/5891
  - https://www.opiq.ee/kit/118/chapter/5892
  - https://www.opiq.ee/kit/118/chapter/5893
  - https://www.opiq.ee/kit/118/chapter/5894
  - https://www.opiq.ee/kit/118/chapter/5895
  - https://www.opiq.ee/kit/118/chapter/5896
  - https://www.opiq.ee/kit/118/chapter/5897
  - https://www.opiq.ee/kit/118/chapter/5898
  - https://www.opiq.ee/kit/118/chapter/5899
  - https://www.opiq.ee/kit/118/chapter/5900
  - https://www.opiq.ee/kit/118/chapter/5901
  - https://www.opiq.ee/kit/118/chapter/5902
  - https://www.opiq.ee/kit/118/chapter/5903
  - https://www.opiq.ee/kit/118/chapter/5904
  - https://www.opiq.ee/kit/118/chapter/5905
  - https://www.opiq.ee/kit/118/chapter/5906
  - https://www.opiq.ee/kit/118/chapter/5907
  - https://www.opiq.ee/kit/118/chapter/5908
  - https://www.opiq.ee/kit/118/chapter/5909
  - https://www.opiq.ee/kit/118/chapter/5910
  - https://www.opiq.ee/kit/118/chapter/5911
  - https://www.opiq.ee/kit/118/chapter/5912
  - https://www.opiq.ee/kit/118/chapter/5913
  - https://www.opiq.ee/kit/118/chapter/5914
  - https://www.opiq.ee/kit/118/chapter/5915
  - https://www.opiq.ee/kit/118/chapter/5916
  - https://www.opiq.ee/kit/118/chapter/5917
  - https://www.opiq.ee/kit/118/chapter/5918
  - https://www.opiq.ee/kit/118/chapter/5919
  - https://www.opiq.ee/kit/118/chapter/5920
  - https://www.opiq.ee/kit/118/chapter/5921
  - https://www.opiq.ee/kit/118/chapter/5922
  - https://www.opiq.ee/kit/118/chapter/5923
  - https://www.opiq.ee/kit/118/chapter/5924
  - https://www.opiq.ee/kit/118/chapter/5925
  - https://www.opiq.ee/kit/118/chapter/5926
  - https://www.opiq.ee/kit/118/chapter/5927
  - https://www.opiq.ee/kit/118/chapter/5928
  - https://www.opiq.ee/kit/118/chapter/5929
  - https://www.opiq.ee/kit/118/chapter/5930
  - https://www.opiq.ee/kit/118/chapter/5931
  - https://www.opiq.ee/kit/118/chapter/5932
  - https://www.opiq.ee/kit/118/chapter/5933
  - https://www.opiq.ee/kit/118/chapter/5934
  - https://www.opiq.ee/kit/118/chapter/5935
  - https://www.opiq.ee/kit/118/chapter/5936
  - https://www.opiq.ee/kit/118/chapter/5937
  - https://www.opiq.ee/kit/118/chapter/5938
  - https://www.opiq.ee/kit/118/chapter/5939
  - https://www.opiq.ee/kit/118/chapter/5940
  - https://www.opiq.ee/kit/118/chapter/5941
  - https://www.opiq.ee/kit/118/chapter/5942
  - https://www.opiq.ee/kit/118/chapter/5943
  - https://www.opiq.ee/kit/118/chapter/5944
  - https://www.opiq.ee/kit/118/chapter/5945
  - https://www.opiq.ee/kit/118/chapter/5946
  - https://www.opiq.ee/kit/118/chapter/5947
  - https://www.opiq.ee/kit/118/chapter/5948
  - https://www.opiq.ee/kit/118/chapter/5949
  - https://www.opiq.ee/kit/118/chapter/5950
  - https://www.opiq.ee/kit/118/chapter/5951
  - https://www.opiq.ee/kit/118/chapter/5952
  - https://www.opiq.ee/kit/118/chapter/5953
  - https://www.opiq.ee/kit/118/chapter/5954
  - https://www.opiq.ee/kit/118/chapter/5955
  - https://www.opiq.ee/kit/118/chapter/5956
  - https://www.opiq.ee/kit/118/chapter/5957
  - https://www.opiq.ee/kit/118/chapter/5958
  - https://www.opiq.ee/kit/118/chapter/5959
  - https://www.opiq.ee/kit/118/chapter/5960
  - https://www.opiq.ee/kit/118/chapter/5961
  - https://www.opiq.ee/kit/118/chapter/5962
  - https://www.opiq.ee/kit/118/chapter/5963
  - https://www.opiq.ee/kit/118/chapter/5964
  - https://www.opiq.ee/kit/118/chapter/5965
  - https://www.opiq.ee/kit/118/chapter/5966
  - https://www.opiq.ee/kit/118/chapter/5967
  - https://www.opiq.ee/kit/118/chapter/5968
  - https://www.opiq.ee/kit/118/chapter/5969
  - https://www.opiq.ee/kit/118/chapter/5970
  - https://www.opiq.ee/kit/118/chapter/5971
  - https://www.opiq.ee/kit/118/chapter/5972
  - https://www.opiq.ee/kit/118/chapter/5973
  - https://www.opiq.ee/kit/118/chapter/5974
  - https://www.opiq.ee/kit/118/chapter/5975
  - https://www.opiq.ee/kit/118/chapter/5976
  - https://www.opiq.ee/kit/118/chapter/5977
  - https://www.opiq.ee/kit/118/chapter/5978
  - https://www.opiq.ee/kit/118/chapter/5979
  - https://www.opiq.ee/kit/118/chapter/5980
  - https://www.opiq.ee/kit/118/chapter/5981
  - https://www.opiq.ee/kit/118/chapter/5982
  - https://www.opiq.ee/kit/118/chapter/5983
  - https://www.opiq.ee/kit/118/chapter/5984
  - https://www.opiq.ee/kit/118/chapter/5985
  - https://www.opiq.ee/kit/118/chapter/5986
  - https://www.opiq.ee/kit/118/chapter/5987
  - https://www.opiq.ee/kit/118/chapter/5988
  - https://www.opiq.ee/kit/118/chapter/5989
  - https://www.opiq.ee/kit/118/chapter/5990
  - https://www.opiq.ee/kit/118/chapter/5991
  - https://www.opiq.ee/kit/118/chapter/5992
  - https://www.opiq.ee/kit/118/chapter/5993
  - https://www.opiq.ee/kit/118/chapter/5994
  - https://www.opiq.ee/kit/118/chapter/5995
  - https://www.opiq.ee/kit/118/chapter/5996
  - https://www.opiq.ee/kit/118/chapter/5997
  - https://www.opiq.ee/kit/118/chapter/5998
  - https://www.opiq.ee/kit/118/chapter/5999
  - https://www.opiq.ee/kit/118/chapter/6000
  - https://www.opiq.ee/kit/118/chapter/6001
  - https://www.opiq.ee/kit/118/chapter/6002
  - https://www.opiq.ee/kit/118/chapter/6003
  - https://www.opiq.ee/kit/118/chapter/6004
  - https://www.opiq.ee/kit/118/chapter/6005
  - https://www.opiq.ee/kit/118/chapter/6006
  - https://www.opiq.ee/kit/118/chapter/6007
  - https://www.opiq.ee/kit/118/chapter/6008
  - https://www.opiq.ee/kit/118/chapter/6009
  - https://www.opiq.ee/kit/118/chapter/6010
  - https://www.opiq.ee/kit/118/chapter/6011
  - https://www.opiq.ee/kit/118/chapter/6012
  - https://www.opiq.ee/kit/118/chapter/6013
  - https://www.opiq.ee/kit/118/chapter/6014
  - https://www.opiq.ee/kit/118/chapter/6015
  - https://www.opiq.ee/kit/118/chapter/6016
  - https://www.opiq.ee/kit/118/chapter/6017
  - https://www.opiq.ee/kit/118/chapter/6018
  - https://www.opiq.ee/kit/118/chapter/6019
  - https://www.opiq.ee/kit/118/chapter/6020
  - https://www.opiq.ee/kit/118/chapter/6021
  - https://www.opiq.ee/kit/118/chapter/6022
  - https://www.opiq.ee/kit/118/chapter/6023
  - https://www.opiq.ee/kit/118/chapter/6024
  - https://www.opiq.ee/kit/118/chapter/6025
  - https://www.opiq.ee/kit/118/chapter/6026
  - https://www.opiq.ee/kit/118/chapter/6027
  - https://www.opiq.ee/kit/118/chapter/6028
  - https://www.opiq.ee/kit/118/chapter/6029
  - https://www.opiq.ee/kit/118/chapter/6030
  - https://www.opiq.ee/kit/118/chapter/6031
  - https://www.opiq.ee/kit/118/chapter/6032

</details>

<details><summary><code>g2q-0314</code> — <code>missing_task_examples</code> — 41 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-estonian`
- Books: `koolibri_mina_loen__2_et`
- Kits: 458
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/458/chapter/24984
  - https://www.opiq.ee/kit/458/chapter/24985
  - https://www.opiq.ee/kit/458/chapter/24986
  - https://www.opiq.ee/kit/458/chapter/24987
  - https://www.opiq.ee/kit/458/chapter/24988
  - https://www.opiq.ee/kit/458/chapter/24989
  - https://www.opiq.ee/kit/458/chapter/24990
  - https://www.opiq.ee/kit/458/chapter/24991
  - https://www.opiq.ee/kit/458/chapter/24992
  - https://www.opiq.ee/kit/458/chapter/24993
  - https://www.opiq.ee/kit/458/chapter/24994
  - https://www.opiq.ee/kit/458/chapter/24995
  - https://www.opiq.ee/kit/458/chapter/24996
  - https://www.opiq.ee/kit/458/chapter/24997
  - https://www.opiq.ee/kit/458/chapter/24998
  - https://www.opiq.ee/kit/458/chapter/24999
  - https://www.opiq.ee/kit/458/chapter/25000
  - https://www.opiq.ee/kit/458/chapter/25001
  - https://www.opiq.ee/kit/458/chapter/25002
  - https://www.opiq.ee/kit/458/chapter/25003
  - https://www.opiq.ee/kit/458/chapter/25004
  - https://www.opiq.ee/kit/458/chapter/25005
  - https://www.opiq.ee/kit/458/chapter/25006
  - https://www.opiq.ee/kit/458/chapter/25007
  - https://www.opiq.ee/kit/458/chapter/25008
  - https://www.opiq.ee/kit/458/chapter/25009
  - https://www.opiq.ee/kit/458/chapter/25010
  - https://www.opiq.ee/kit/458/chapter/25011
  - https://www.opiq.ee/kit/458/chapter/25012
  - https://www.opiq.ee/kit/458/chapter/25013
  - https://www.opiq.ee/kit/458/chapter/25014
  - https://www.opiq.ee/kit/458/chapter/25015
  - https://www.opiq.ee/kit/458/chapter/25016
  - https://www.opiq.ee/kit/458/chapter/25017
  - https://www.opiq.ee/kit/458/chapter/25018
  - https://www.opiq.ee/kit/458/chapter/25019
  - https://www.opiq.ee/kit/458/chapter/25020
  - https://www.opiq.ee/kit/458/chapter/25021
  - https://www.opiq.ee/kit/458/chapter/25022
  - https://www.opiq.ee/kit/458/chapter/25023
  - https://www.opiq.ee/kit/458/chapter/25024

</details>

<details><summary><code>g2q-0315</code> — <code>missing_task_examples</code> — 2 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-human-studies`
- Books: `avita_inimeseõpe_2_et__kit449`
- Kits: 449
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/449/chapter/24921
  - https://www.opiq.ee/kit/449/chapter/26259

</details>

<details><summary><code>g2q-0316</code> — <code>missing_task_examples</code> — 1 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-human-studies`
- Books: `avita_inimeseõpe_2_et__kit494`
- Kits: 494
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/494/chapter/27195

</details>

<details><summary><code>g2q-0317</code> — <code>missing_task_examples</code> — 59 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-human-studies`
- Books: `avita_loodus-_ja_2_et__kit56`
- Kits: 56
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/56/chapter/2749
  - https://www.opiq.ee/kit/56/chapter/2750
  - https://www.opiq.ee/kit/56/chapter/2751
  - https://www.opiq.ee/kit/56/chapter/2752
  - https://www.opiq.ee/kit/56/chapter/2753
  - https://www.opiq.ee/kit/56/chapter/2754
  - https://www.opiq.ee/kit/56/chapter/2755
  - https://www.opiq.ee/kit/56/chapter/2756
  - https://www.opiq.ee/kit/56/chapter/2757
  - https://www.opiq.ee/kit/56/chapter/2758
  - https://www.opiq.ee/kit/56/chapter/2759
  - https://www.opiq.ee/kit/56/chapter/2760
  - https://www.opiq.ee/kit/56/chapter/2761
  - https://www.opiq.ee/kit/56/chapter/2762
  - https://www.opiq.ee/kit/56/chapter/2763
  - https://www.opiq.ee/kit/56/chapter/2764
  - https://www.opiq.ee/kit/56/chapter/2765
  - https://www.opiq.ee/kit/56/chapter/2766
  - https://www.opiq.ee/kit/56/chapter/2767
  - https://www.opiq.ee/kit/56/chapter/2768
  - https://www.opiq.ee/kit/56/chapter/2769
  - https://www.opiq.ee/kit/56/chapter/2770
  - https://www.opiq.ee/kit/56/chapter/2771
  - https://www.opiq.ee/kit/56/chapter/2773
  - https://www.opiq.ee/kit/56/chapter/3345
  - https://www.opiq.ee/kit/56/chapter/3346
  - https://www.opiq.ee/kit/56/chapter/3347
  - https://www.opiq.ee/kit/56/chapter/3348
  - https://www.opiq.ee/kit/56/chapter/3349
  - https://www.opiq.ee/kit/56/chapter/3350
  - https://www.opiq.ee/kit/56/chapter/3351
  - https://www.opiq.ee/kit/56/chapter/3352
  - https://www.opiq.ee/kit/56/chapter/3353
  - https://www.opiq.ee/kit/56/chapter/3477
  - https://www.opiq.ee/kit/56/chapter/3478
  - https://www.opiq.ee/kit/56/chapter/3479
  - https://www.opiq.ee/kit/56/chapter/3502
  - https://www.opiq.ee/kit/56/chapter/3503
  - https://www.opiq.ee/kit/56/chapter/3504
  - https://www.opiq.ee/kit/56/chapter/3505
  - https://www.opiq.ee/kit/56/chapter/3611
  - https://www.opiq.ee/kit/56/chapter/3612
  - https://www.opiq.ee/kit/56/chapter/3613
  - https://www.opiq.ee/kit/56/chapter/3614
  - https://www.opiq.ee/kit/56/chapter/7625
  - https://www.opiq.ee/kit/56/chapter/7626
  - https://www.opiq.ee/kit/56/chapter/7627
  - https://www.opiq.ee/kit/56/chapter/7628
  - https://www.opiq.ee/kit/56/chapter/7629
  - https://www.opiq.ee/kit/56/chapter/7701
  - https://www.opiq.ee/kit/56/chapter/7702
  - https://www.opiq.ee/kit/56/chapter/7703
  - https://www.opiq.ee/kit/56/chapter/7704
  - https://www.opiq.ee/kit/56/chapter/7705
  - https://www.opiq.ee/kit/56/chapter/7706
  - https://www.opiq.ee/kit/56/chapter/7707
  - https://www.opiq.ee/kit/56/chapter/7708
  - https://www.opiq.ee/kit/56/chapter/7709
  - https://www.opiq.ee/kit/56/chapter/7710

</details>

<details><summary><code>g2q-0318</code> — <code>missing_task_examples</code> — 36 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-human-studies`
- Books: `harno_inimeseõpe_2_et__kit286`
- Kits: 286
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/286/chapter/15950
  - https://www.opiq.ee/kit/286/chapter/15951
  - https://www.opiq.ee/kit/286/chapter/15952
  - https://www.opiq.ee/kit/286/chapter/15953
  - https://www.opiq.ee/kit/286/chapter/15954
  - https://www.opiq.ee/kit/286/chapter/16084
  - https://www.opiq.ee/kit/286/chapter/16085
  - https://www.opiq.ee/kit/286/chapter/16577
  - https://www.opiq.ee/kit/286/chapter/16578
  - https://www.opiq.ee/kit/286/chapter/16790
  - https://www.opiq.ee/kit/286/chapter/16791
  - https://www.opiq.ee/kit/286/chapter/16792
  - https://www.opiq.ee/kit/286/chapter/16912
  - https://www.opiq.ee/kit/286/chapter/16913
  - https://www.opiq.ee/kit/286/chapter/16914
  - https://www.opiq.ee/kit/286/chapter/16915
  - https://www.opiq.ee/kit/286/chapter/16916
  - https://www.opiq.ee/kit/286/chapter/16917
  - https://www.opiq.ee/kit/286/chapter/17079
  - https://www.opiq.ee/kit/286/chapter/17080
  - https://www.opiq.ee/kit/286/chapter/17082
  - https://www.opiq.ee/kit/286/chapter/17083
  - https://www.opiq.ee/kit/286/chapter/17084
  - https://www.opiq.ee/kit/286/chapter/17085
  - https://www.opiq.ee/kit/286/chapter/17527
  - https://www.opiq.ee/kit/286/chapter/17528
  - https://www.opiq.ee/kit/286/chapter/17529
  - https://www.opiq.ee/kit/286/chapter/17530
  - https://www.opiq.ee/kit/286/chapter/17531
  - https://www.opiq.ee/kit/286/chapter/17532
  - https://www.opiq.ee/kit/286/chapter/17533
  - https://www.opiq.ee/kit/286/chapter/17534
  - https://www.opiq.ee/kit/286/chapter/17535
  - https://www.opiq.ee/kit/286/chapter/17536
  - https://www.opiq.ee/kit/286/chapter/17537
  - https://www.opiq.ee/kit/286/chapter/17538

</details>

<details><summary><code>g2q-0319</code> — <code>missing_task_examples</code> — 31 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-kodututarde-training`
- Books: `kodutütarde_i_järk_(2026)`
- Kits: 593
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33587
  - https://www.opiq.ee/kit/593/chapter/33588
  - https://www.opiq.ee/kit/593/chapter/33589
  - https://www.opiq.ee/kit/593/chapter/33590
  - https://www.opiq.ee/kit/593/chapter/33591
  - https://www.opiq.ee/kit/593/chapter/33592
  - https://www.opiq.ee/kit/593/chapter/33593
  - https://www.opiq.ee/kit/593/chapter/33594
  - https://www.opiq.ee/kit/593/chapter/33595
  - https://www.opiq.ee/kit/593/chapter/33596
  - https://www.opiq.ee/kit/593/chapter/33597
  - https://www.opiq.ee/kit/593/chapter/33598
  - https://www.opiq.ee/kit/593/chapter/33599
  - https://www.opiq.ee/kit/593/chapter/33600
  - https://www.opiq.ee/kit/593/chapter/33601
  - https://www.opiq.ee/kit/593/chapter/33602
  - https://www.opiq.ee/kit/593/chapter/33603
  - https://www.opiq.ee/kit/593/chapter/33604
  - https://www.opiq.ee/kit/593/chapter/33605
  - https://www.opiq.ee/kit/593/chapter/33606
  - https://www.opiq.ee/kit/593/chapter/33607
  - https://www.opiq.ee/kit/593/chapter/33608
  - https://www.opiq.ee/kit/593/chapter/33609
  - https://www.opiq.ee/kit/593/chapter/33610
  - https://www.opiq.ee/kit/593/chapter/33611
  - https://www.opiq.ee/kit/593/chapter/33612
  - https://www.opiq.ee/kit/593/chapter/33613
  - https://www.opiq.ee/kit/593/chapter/33614
  - https://www.opiq.ee/kit/593/chapter/33615
  - https://www.opiq.ee/kit/593/chapter/33616
  - https://www.opiq.ee/kit/593/chapter/33617

</details>

<details><summary><code>g2q-0320</code> — <code>missing_task_examples</code> — 4 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-mathematics`
- Books: `avita_математика_2_et__kit578`
- Kits: 578
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32233
  - https://www.opiq.ee/kit/578/chapter/32234
  - https://www.opiq.ee/kit/578/chapter/32235
  - https://www.opiq.ee/kit/578/chapter/32236

</details>

<details><summary><code>g2q-0321</code> — <code>missing_task_examples</code> — 8 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-mathematics`
- Books: `harno_matemaatik_2_et__kit272`
- Kits: 272
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/272/chapter/15425
  - https://www.opiq.ee/kit/272/chapter/15426
  - https://www.opiq.ee/kit/272/chapter/15427
  - https://www.opiq.ee/kit/272/chapter/15428
  - https://www.opiq.ee/kit/272/chapter/15429
  - https://www.opiq.ee/kit/272/chapter/15439
  - https://www.opiq.ee/kit/272/chapter/15440
  - https://www.opiq.ee/kit/272/chapter/15441

</details>

<details><summary><code>g2q-0322</code> — <code>missing_task_examples</code> — 10 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-mathematics`
- Books: `harno_matemaatik_2_et__kit273`
- Kits: 273
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/273/chapter/15458
  - https://www.opiq.ee/kit/273/chapter/15467
  - https://www.opiq.ee/kit/273/chapter/15468
  - https://www.opiq.ee/kit/273/chapter/15469
  - https://www.opiq.ee/kit/273/chapter/15470
  - https://www.opiq.ee/kit/273/chapter/15471
  - https://www.opiq.ee/kit/273/chapter/15472
  - https://www.opiq.ee/kit/273/chapter/15473
  - https://www.opiq.ee/kit/273/chapter/15475
  - https://www.opiq.ee/kit/273/chapter/15476

</details>

<details><summary><code>g2q-0323</code> — <code>missing_task_examples</code> — 33 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-mathematics`
- Books: `harno_matemaatik_2_et__kit274`
- Kits: 274
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/274/chapter/15477
  - https://www.opiq.ee/kit/274/chapter/15478
  - https://www.opiq.ee/kit/274/chapter/15479
  - https://www.opiq.ee/kit/274/chapter/15480
  - https://www.opiq.ee/kit/274/chapter/15481
  - https://www.opiq.ee/kit/274/chapter/15482
  - https://www.opiq.ee/kit/274/chapter/15483
  - https://www.opiq.ee/kit/274/chapter/15484
  - https://www.opiq.ee/kit/274/chapter/15485
  - https://www.opiq.ee/kit/274/chapter/15486
  - https://www.opiq.ee/kit/274/chapter/15487
  - https://www.opiq.ee/kit/274/chapter/15488
  - https://www.opiq.ee/kit/274/chapter/15489
  - https://www.opiq.ee/kit/274/chapter/15490
  - https://www.opiq.ee/kit/274/chapter/15491
  - https://www.opiq.ee/kit/274/chapter/15492
  - https://www.opiq.ee/kit/274/chapter/15493
  - https://www.opiq.ee/kit/274/chapter/15494
  - https://www.opiq.ee/kit/274/chapter/15495
  - https://www.opiq.ee/kit/274/chapter/15496
  - https://www.opiq.ee/kit/274/chapter/15497
  - https://www.opiq.ee/kit/274/chapter/15498
  - https://www.opiq.ee/kit/274/chapter/15499
  - https://www.opiq.ee/kit/274/chapter/15500
  - https://www.opiq.ee/kit/274/chapter/15501
  - https://www.opiq.ee/kit/274/chapter/15502
  - https://www.opiq.ee/kit/274/chapter/15503
  - https://www.opiq.ee/kit/274/chapter/15504
  - https://www.opiq.ee/kit/274/chapter/15505
  - https://www.opiq.ee/kit/274/chapter/15506
  - https://www.opiq.ee/kit/274/chapter/15507
  - https://www.opiq.ee/kit/274/chapter/15509
  - https://www.opiq.ee/kit/274/chapter/15510

</details>

<details><summary><code>g2q-0324</code> — <code>missing_task_examples</code> — 5 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-mathematics`
- Books: `koolibri_matemaatik_2_et__kit107`
- Kits: 107
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/107/chapter/10744
  - https://www.opiq.ee/kit/107/chapter/10774
  - https://www.opiq.ee/kit/107/chapter/10775
  - https://www.opiq.ee/kit/107/chapter/10776
  - https://www.opiq.ee/kit/107/chapter/5184

</details>

<details><summary><code>g2q-0325</code> — <code>missing_task_examples</code> — 5 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-mathematics`
- Books: `koolibri_математика_2_et__kit361`
- Kits: 361
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/361/chapter/19848
  - https://www.opiq.ee/kit/361/chapter/19864
  - https://www.opiq.ee/kit/361/chapter/19894
  - https://www.opiq.ee/kit/361/chapter/19895
  - https://www.opiq.ee/kit/361/chapter/19896

</details>

<details><summary><code>g2q-0326</code> — <code>missing_task_examples</code> — 50 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-music`
- Books: `2._klassi_muusikaõpetus`
- Kits: 188
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/188/chapter/10577
  - https://www.opiq.ee/kit/188/chapter/10579
  - https://www.opiq.ee/kit/188/chapter/10581
  - https://www.opiq.ee/kit/188/chapter/10582
  - https://www.opiq.ee/kit/188/chapter/10588
  - https://www.opiq.ee/kit/188/chapter/10590
  - https://www.opiq.ee/kit/188/chapter/10592
  - https://www.opiq.ee/kit/188/chapter/10595
  - https://www.opiq.ee/kit/188/chapter/10596
  - https://www.opiq.ee/kit/188/chapter/10600
  - https://www.opiq.ee/kit/188/chapter/10601
  - https://www.opiq.ee/kit/188/chapter/10604
  - https://www.opiq.ee/kit/188/chapter/10605
  - https://www.opiq.ee/kit/188/chapter/10606
  - https://www.opiq.ee/kit/188/chapter/10607
  - https://www.opiq.ee/kit/188/chapter/10608
  - https://www.opiq.ee/kit/188/chapter/10609
  - https://www.opiq.ee/kit/188/chapter/10610
  - https://www.opiq.ee/kit/188/chapter/10611
  - https://www.opiq.ee/kit/188/chapter/10612
  - https://www.opiq.ee/kit/188/chapter/10615
  - https://www.opiq.ee/kit/188/chapter/10618
  - https://www.opiq.ee/kit/188/chapter/10621
  - https://www.opiq.ee/kit/188/chapter/10630
  - https://www.opiq.ee/kit/188/chapter/10634
  - https://www.opiq.ee/kit/188/chapter/10636
  - https://www.opiq.ee/kit/188/chapter/10638
  - https://www.opiq.ee/kit/188/chapter/10640
  - https://www.opiq.ee/kit/188/chapter/10644
  - https://www.opiq.ee/kit/188/chapter/10646
  - https://www.opiq.ee/kit/188/chapter/10648
  - https://www.opiq.ee/kit/188/chapter/10649
  - https://www.opiq.ee/kit/188/chapter/10654
  - https://www.opiq.ee/kit/188/chapter/10657
  - https://www.opiq.ee/kit/188/chapter/10658
  - https://www.opiq.ee/kit/188/chapter/10659
  - https://www.opiq.ee/kit/188/chapter/10660
  - https://www.opiq.ee/kit/188/chapter/10661
  - https://www.opiq.ee/kit/188/chapter/10662
  - https://www.opiq.ee/kit/188/chapter/10664
  - https://www.opiq.ee/kit/188/chapter/10665
  - https://www.opiq.ee/kit/188/chapter/10667
  - https://www.opiq.ee/kit/188/chapter/10669
  - https://www.opiq.ee/kit/188/chapter/10673
  - https://www.opiq.ee/kit/188/chapter/10676
  - https://www.opiq.ee/kit/188/chapter/10678
  - https://www.opiq.ee/kit/188/chapter/10681
  - https://www.opiq.ee/kit/188/chapter/10687
  - https://www.opiq.ee/kit/188/chapter/10690
  - https://www.opiq.ee/kit/188/chapter/10691

</details>

<details><summary><code>g2q-0327</code> — <code>missing_task_examples</code> — 33 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-music`
- Books: `eesti_pärimusmuusika_keskuse_õppevideod`
- Kits: 465
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/465/chapter/25281
  - https://www.opiq.ee/kit/465/chapter/25282
  - https://www.opiq.ee/kit/465/chapter/25283
  - https://www.opiq.ee/kit/465/chapter/25284
  - https://www.opiq.ee/kit/465/chapter/25285
  - https://www.opiq.ee/kit/465/chapter/25286
  - https://www.opiq.ee/kit/465/chapter/25287
  - https://www.opiq.ee/kit/465/chapter/25288
  - https://www.opiq.ee/kit/465/chapter/25289
  - https://www.opiq.ee/kit/465/chapter/25290
  - https://www.opiq.ee/kit/465/chapter/25291
  - https://www.opiq.ee/kit/465/chapter/25292
  - https://www.opiq.ee/kit/465/chapter/25293
  - https://www.opiq.ee/kit/465/chapter/25294
  - https://www.opiq.ee/kit/465/chapter/25295
  - https://www.opiq.ee/kit/465/chapter/25296
  - https://www.opiq.ee/kit/465/chapter/25297
  - https://www.opiq.ee/kit/465/chapter/25298
  - https://www.opiq.ee/kit/465/chapter/25299
  - https://www.opiq.ee/kit/465/chapter/25300
  - https://www.opiq.ee/kit/465/chapter/25301
  - https://www.opiq.ee/kit/465/chapter/25302
  - https://www.opiq.ee/kit/465/chapter/25303
  - https://www.opiq.ee/kit/465/chapter/25304
  - https://www.opiq.ee/kit/465/chapter/25305
  - https://www.opiq.ee/kit/465/chapter/25306
  - https://www.opiq.ee/kit/465/chapter/25308
  - https://www.opiq.ee/kit/465/chapter/25311
  - https://www.opiq.ee/kit/465/chapter/25312
  - https://www.opiq.ee/kit/465/chapter/25921
  - https://www.opiq.ee/kit/465/chapter/25922
  - https://www.opiq.ee/kit/465/chapter/25923
  - https://www.opiq.ee/kit/465/chapter/25924

</details>

<details><summary><code>g2q-0328</code> — <code>missing_task_examples</code> — 6 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile_2024`
- Kits: 556
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/556/chapter/31279
  - https://www.opiq.ee/kit/556/chapter/31284
  - https://www.opiq.ee/kit/556/chapter/31302
  - https://www.opiq.ee/kit/556/chapter/31304
  - https://www.opiq.ee/kit/556/chapter/31305
  - https://www.opiq.ee/kit/556/chapter/31306

</details>

<details><summary><code>g2q-0329</code> — <code>missing_task_examples</code> — 6 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-music`
- Books: `muusikaõpik_2._klassile`
- Kits: 193
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/193/chapter/10975
  - https://www.opiq.ee/kit/193/chapter/10993
  - https://www.opiq.ee/kit/193/chapter/10995
  - https://www.opiq.ee/kit/193/chapter/10996
  - https://www.opiq.ee/kit/193/chapter/10997
  - https://www.opiq.ee/kit/193/chapter/19530

</details>

<details><summary><code>g2q-0330</code> — <code>missing_task_examples</code> — 30 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-music`
- Books: `музыка_–_волшебная_страна._2_класс`
- Kits: 238
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/238/chapter/13449
  - https://www.opiq.ee/kit/238/chapter/13457
  - https://www.opiq.ee/kit/238/chapter/13458
  - https://www.opiq.ee/kit/238/chapter/13459
  - https://www.opiq.ee/kit/238/chapter/13462
  - https://www.opiq.ee/kit/238/chapter/13476
  - https://www.opiq.ee/kit/238/chapter/13505
  - https://www.opiq.ee/kit/238/chapter/13506
  - https://www.opiq.ee/kit/238/chapter/13507
  - https://www.opiq.ee/kit/238/chapter/13508
  - https://www.opiq.ee/kit/238/chapter/13509
  - https://www.opiq.ee/kit/238/chapter/13512
  - https://www.opiq.ee/kit/238/chapter/13513
  - https://www.opiq.ee/kit/238/chapter/13518
  - https://www.opiq.ee/kit/238/chapter/13520
  - https://www.opiq.ee/kit/238/chapter/13522
  - https://www.opiq.ee/kit/238/chapter/13538
  - https://www.opiq.ee/kit/238/chapter/13539
  - https://www.opiq.ee/kit/238/chapter/13540
  - https://www.opiq.ee/kit/238/chapter/13541
  - https://www.opiq.ee/kit/238/chapter/13542
  - https://www.opiq.ee/kit/238/chapter/13547
  - https://www.opiq.ee/kit/238/chapter/13548
  - https://www.opiq.ee/kit/238/chapter/13549
  - https://www.opiq.ee/kit/238/chapter/13550
  - https://www.opiq.ee/kit/238/chapter/13551
  - https://www.opiq.ee/kit/238/chapter/13552
  - https://www.opiq.ee/kit/238/chapter/13553
  - https://www.opiq.ee/kit/238/chapter/13554
  - https://www.opiq.ee/kit/238/chapter/13555

</details>

<details><summary><code>g2q-0331</code> — <code>missing_task_examples</code> — 60 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-nature-and-human-studies`
- Books: `avita_природа_и__2_ru__kit86`
- Kits: 86
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/86/chapter/12105
  - https://www.opiq.ee/kit/86/chapter/12106
  - https://www.opiq.ee/kit/86/chapter/12107
  - https://www.opiq.ee/kit/86/chapter/12108
  - https://www.opiq.ee/kit/86/chapter/12109
  - https://www.opiq.ee/kit/86/chapter/12110
  - https://www.opiq.ee/kit/86/chapter/12111
  - https://www.opiq.ee/kit/86/chapter/12112
  - https://www.opiq.ee/kit/86/chapter/12113
  - https://www.opiq.ee/kit/86/chapter/12114
  - https://www.opiq.ee/kit/86/chapter/12115
  - https://www.opiq.ee/kit/86/chapter/12116
  - https://www.opiq.ee/kit/86/chapter/12117
  - https://www.opiq.ee/kit/86/chapter/12118
  - https://www.opiq.ee/kit/86/chapter/12119
  - https://www.opiq.ee/kit/86/chapter/12121
  - https://www.opiq.ee/kit/86/chapter/4190
  - https://www.opiq.ee/kit/86/chapter/4191
  - https://www.opiq.ee/kit/86/chapter/4192
  - https://www.opiq.ee/kit/86/chapter/4193
  - https://www.opiq.ee/kit/86/chapter/4194
  - https://www.opiq.ee/kit/86/chapter/4195
  - https://www.opiq.ee/kit/86/chapter/4196
  - https://www.opiq.ee/kit/86/chapter/4197
  - https://www.opiq.ee/kit/86/chapter/4198
  - https://www.opiq.ee/kit/86/chapter/4199
  - https://www.opiq.ee/kit/86/chapter/4200
  - https://www.opiq.ee/kit/86/chapter/4201
  - https://www.opiq.ee/kit/86/chapter/4202
  - https://www.opiq.ee/kit/86/chapter/4203
  - https://www.opiq.ee/kit/86/chapter/4204
  - https://www.opiq.ee/kit/86/chapter/4205
  - https://www.opiq.ee/kit/86/chapter/4206
  - https://www.opiq.ee/kit/86/chapter/4207
  - https://www.opiq.ee/kit/86/chapter/4208
  - https://www.opiq.ee/kit/86/chapter/4209
  - https://www.opiq.ee/kit/86/chapter/4210
  - https://www.opiq.ee/kit/86/chapter/4211
  - https://www.opiq.ee/kit/86/chapter/4212
  - https://www.opiq.ee/kit/86/chapter/4213
  - https://www.opiq.ee/kit/86/chapter/4214
  - https://www.opiq.ee/kit/86/chapter/4215
  - https://www.opiq.ee/kit/86/chapter/4216
  - https://www.opiq.ee/kit/86/chapter/4217
  - https://www.opiq.ee/kit/86/chapter/4218
  - https://www.opiq.ee/kit/86/chapter/4219
  - https://www.opiq.ee/kit/86/chapter/4220
  - https://www.opiq.ee/kit/86/chapter/4221
  - https://www.opiq.ee/kit/86/chapter/4222
  - https://www.opiq.ee/kit/86/chapter/4223
  - https://www.opiq.ee/kit/86/chapter/4224
  - https://www.opiq.ee/kit/86/chapter/4225
  - https://www.opiq.ee/kit/86/chapter/4226
  - https://www.opiq.ee/kit/86/chapter/4227
  - https://www.opiq.ee/kit/86/chapter/4228
  - https://www.opiq.ee/kit/86/chapter/4229
  - https://www.opiq.ee/kit/86/chapter/4230
  - https://www.opiq.ee/kit/86/chapter/4231
  - https://www.opiq.ee/kit/86/chapter/4232
  - https://www.opiq.ee/kit/86/chapter/4233

</details>

<details><summary><code>g2q-0332</code> — <code>missing_task_examples</code> — 27 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`
- Kits: 594
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/594/chapter/33620
  - https://www.opiq.ee/kit/594/chapter/33621
  - https://www.opiq.ee/kit/594/chapter/33622
  - https://www.opiq.ee/kit/594/chapter/33623
  - https://www.opiq.ee/kit/594/chapter/33624
  - https://www.opiq.ee/kit/594/chapter/33625
  - https://www.opiq.ee/kit/594/chapter/33626
  - https://www.opiq.ee/kit/594/chapter/33627
  - https://www.opiq.ee/kit/594/chapter/33628
  - https://www.opiq.ee/kit/594/chapter/33629
  - https://www.opiq.ee/kit/594/chapter/33630
  - https://www.opiq.ee/kit/594/chapter/33631
  - https://www.opiq.ee/kit/594/chapter/33632
  - https://www.opiq.ee/kit/594/chapter/33633
  - https://www.opiq.ee/kit/594/chapter/33634
  - https://www.opiq.ee/kit/594/chapter/33635
  - https://www.opiq.ee/kit/594/chapter/33636
  - https://www.opiq.ee/kit/594/chapter/33637
  - https://www.opiq.ee/kit/594/chapter/33638
  - https://www.opiq.ee/kit/594/chapter/33639
  - https://www.opiq.ee/kit/594/chapter/33640
  - https://www.opiq.ee/kit/594/chapter/33641
  - https://www.opiq.ee/kit/594/chapter/33642
  - https://www.opiq.ee/kit/594/chapter/33643
  - https://www.opiq.ee/kit/594/chapter/33644
  - https://www.opiq.ee/kit/594/chapter/33645
  - https://www.opiq.ee/kit/594/chapter/33646

</details>

<details><summary><code>g2q-0333</code> — <code>missing_task_examples</code> — 57 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-russian`
- Books: `avita_русский_язык_2_класс_kit292`
- Kits: 292
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/292/chapter/16094
  - https://www.opiq.ee/kit/292/chapter/16101
  - https://www.opiq.ee/kit/292/chapter/16113
  - https://www.opiq.ee/kit/292/chapter/16115
  - https://www.opiq.ee/kit/292/chapter/16116
  - https://www.opiq.ee/kit/292/chapter/16118
  - https://www.opiq.ee/kit/292/chapter/16120
  - https://www.opiq.ee/kit/292/chapter/16121
  - https://www.opiq.ee/kit/292/chapter/16131
  - https://www.opiq.ee/kit/292/chapter/16139
  - https://www.opiq.ee/kit/292/chapter/16145
  - https://www.opiq.ee/kit/292/chapter/16146
  - https://www.opiq.ee/kit/292/chapter/16147
  - https://www.opiq.ee/kit/292/chapter/16152
  - https://www.opiq.ee/kit/292/chapter/16155
  - https://www.opiq.ee/kit/292/chapter/16158
  - https://www.opiq.ee/kit/292/chapter/16166
  - https://www.opiq.ee/kit/292/chapter/16167
  - https://www.opiq.ee/kit/292/chapter/16168
  - https://www.opiq.ee/kit/292/chapter/16170
  - https://www.opiq.ee/kit/292/chapter/16171
  - https://www.opiq.ee/kit/292/chapter/16172
  - https://www.opiq.ee/kit/292/chapter/16173
  - https://www.opiq.ee/kit/292/chapter/17743
  - https://www.opiq.ee/kit/292/chapter/17744
  - https://www.opiq.ee/kit/292/chapter/17753
  - https://www.opiq.ee/kit/292/chapter/17764
  - https://www.opiq.ee/kit/292/chapter/17765
  - https://www.opiq.ee/kit/292/chapter/17766
  - https://www.opiq.ee/kit/292/chapter/17768
  - https://www.opiq.ee/kit/292/chapter/17782
  - https://www.opiq.ee/kit/292/chapter/17783
  - https://www.opiq.ee/kit/292/chapter/17784
  - https://www.opiq.ee/kit/292/chapter/17785
  - https://www.opiq.ee/kit/292/chapter/17786
  - https://www.opiq.ee/kit/292/chapter/17787
  - https://www.opiq.ee/kit/292/chapter/17802
  - https://www.opiq.ee/kit/292/chapter/17814
  - https://www.opiq.ee/kit/292/chapter/17815
  - https://www.opiq.ee/kit/292/chapter/17816
  - https://www.opiq.ee/kit/292/chapter/17817
  - https://www.opiq.ee/kit/292/chapter/17818
  - https://www.opiq.ee/kit/292/chapter/17819
  - https://www.opiq.ee/kit/292/chapter/17820
  - https://www.opiq.ee/kit/292/chapter/17821
  - https://www.opiq.ee/kit/292/chapter/17822
  - https://www.opiq.ee/kit/292/chapter/17830
  - https://www.opiq.ee/kit/292/chapter/17835
  - https://www.opiq.ee/kit/292/chapter/17836
  - https://www.opiq.ee/kit/292/chapter/17837
  - https://www.opiq.ee/kit/292/chapter/17838
  - https://www.opiq.ee/kit/292/chapter/17839
  - https://www.opiq.ee/kit/292/chapter/17840
  - https://www.opiq.ee/kit/292/chapter/17841
  - https://www.opiq.ee/kit/292/chapter/17842
  - https://www.opiq.ee/kit/292/chapter/17843
  - https://www.opiq.ee/kit/292/chapter/17846

</details>

<details><summary><code>g2q-0334</code> — <code>missing_task_examples</code> — 8 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-russian`
- Books: `avita_русский_язык_i_ступень_часть_3_kit568`
- Kits: 568
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/568/chapter/31758
  - https://www.opiq.ee/kit/568/chapter/31759
  - https://www.opiq.ee/kit/568/chapter/31766
  - https://www.opiq.ee/kit/568/chapter/31776
  - https://www.opiq.ee/kit/568/chapter/31806
  - https://www.opiq.ee/kit/568/chapter/31807
  - https://www.opiq.ee/kit/568/chapter/31808
  - https://www.opiq.ee/kit/568/chapter/31809

</details>

<details><summary><code>g2q-0335</code> — <code>missing_task_examples</code> — 30 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-russian`
- Books: `koolibri_русский_яз_2_ru`
- Kits: 186
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/186/chapter/10433
  - https://www.opiq.ee/kit/186/chapter/10434
  - https://www.opiq.ee/kit/186/chapter/10435
  - https://www.opiq.ee/kit/186/chapter/10436
  - https://www.opiq.ee/kit/186/chapter/10437
  - https://www.opiq.ee/kit/186/chapter/10438
  - https://www.opiq.ee/kit/186/chapter/10439
  - https://www.opiq.ee/kit/186/chapter/10440
  - https://www.opiq.ee/kit/186/chapter/10441
  - https://www.opiq.ee/kit/186/chapter/10442
  - https://www.opiq.ee/kit/186/chapter/10443
  - https://www.opiq.ee/kit/186/chapter/10444
  - https://www.opiq.ee/kit/186/chapter/10445
  - https://www.opiq.ee/kit/186/chapter/10446
  - https://www.opiq.ee/kit/186/chapter/10447
  - https://www.opiq.ee/kit/186/chapter/10448
  - https://www.opiq.ee/kit/186/chapter/10449
  - https://www.opiq.ee/kit/186/chapter/10450
  - https://www.opiq.ee/kit/186/chapter/10451
  - https://www.opiq.ee/kit/186/chapter/10452
  - https://www.opiq.ee/kit/186/chapter/10453
  - https://www.opiq.ee/kit/186/chapter/10454
  - https://www.opiq.ee/kit/186/chapter/10455
  - https://www.opiq.ee/kit/186/chapter/10456
  - https://www.opiq.ee/kit/186/chapter/10457
  - https://www.opiq.ee/kit/186/chapter/10458
  - https://www.opiq.ee/kit/186/chapter/10459
  - https://www.opiq.ee/kit/186/chapter/10460
  - https://www.opiq.ee/kit/186/chapter/10461
  - https://www.opiq.ee/kit/186/chapter/10462

</details>

<details><summary><code>g2q-0336</code> — <code>missing_task_examples</code> — 99 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-russian`
- Books: `koolibri_светлячок._2_ru`
- Kits: 454
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/454/chapter/24693
  - https://www.opiq.ee/kit/454/chapter/24694
  - https://www.opiq.ee/kit/454/chapter/24695
  - https://www.opiq.ee/kit/454/chapter/24696
  - https://www.opiq.ee/kit/454/chapter/24697
  - https://www.opiq.ee/kit/454/chapter/24698
  - https://www.opiq.ee/kit/454/chapter/24699
  - https://www.opiq.ee/kit/454/chapter/24700
  - https://www.opiq.ee/kit/454/chapter/24701
  - https://www.opiq.ee/kit/454/chapter/24702
  - https://www.opiq.ee/kit/454/chapter/24703
  - https://www.opiq.ee/kit/454/chapter/24704
  - https://www.opiq.ee/kit/454/chapter/24705
  - https://www.opiq.ee/kit/454/chapter/24706
  - https://www.opiq.ee/kit/454/chapter/24707
  - https://www.opiq.ee/kit/454/chapter/24708
  - https://www.opiq.ee/kit/454/chapter/24709
  - https://www.opiq.ee/kit/454/chapter/24710
  - https://www.opiq.ee/kit/454/chapter/24711
  - https://www.opiq.ee/kit/454/chapter/24712
  - https://www.opiq.ee/kit/454/chapter/24713
  - https://www.opiq.ee/kit/454/chapter/24714
  - https://www.opiq.ee/kit/454/chapter/24715
  - https://www.opiq.ee/kit/454/chapter/24716
  - https://www.opiq.ee/kit/454/chapter/24717
  - https://www.opiq.ee/kit/454/chapter/24718
  - https://www.opiq.ee/kit/454/chapter/24719
  - https://www.opiq.ee/kit/454/chapter/24720
  - https://www.opiq.ee/kit/454/chapter/24721
  - https://www.opiq.ee/kit/454/chapter/24722
  - https://www.opiq.ee/kit/454/chapter/24723
  - https://www.opiq.ee/kit/454/chapter/24724
  - https://www.opiq.ee/kit/454/chapter/24725
  - https://www.opiq.ee/kit/454/chapter/24726
  - https://www.opiq.ee/kit/454/chapter/24727
  - https://www.opiq.ee/kit/454/chapter/24728
  - https://www.opiq.ee/kit/454/chapter/24729
  - https://www.opiq.ee/kit/454/chapter/24730
  - https://www.opiq.ee/kit/454/chapter/24731
  - https://www.opiq.ee/kit/454/chapter/24732
  - https://www.opiq.ee/kit/454/chapter/24733
  - https://www.opiq.ee/kit/454/chapter/24734
  - https://www.opiq.ee/kit/454/chapter/24735
  - https://www.opiq.ee/kit/454/chapter/24736
  - https://www.opiq.ee/kit/454/chapter/24737
  - https://www.opiq.ee/kit/454/chapter/24738
  - https://www.opiq.ee/kit/454/chapter/24739
  - https://www.opiq.ee/kit/454/chapter/24740
  - https://www.opiq.ee/kit/454/chapter/24741
  - https://www.opiq.ee/kit/454/chapter/24742
  - https://www.opiq.ee/kit/454/chapter/24743
  - https://www.opiq.ee/kit/454/chapter/24744
  - https://www.opiq.ee/kit/454/chapter/24745
  - https://www.opiq.ee/kit/454/chapter/24746
  - https://www.opiq.ee/kit/454/chapter/24747
  - https://www.opiq.ee/kit/454/chapter/24748
  - https://www.opiq.ee/kit/454/chapter/24749
  - https://www.opiq.ee/kit/454/chapter/24750
  - https://www.opiq.ee/kit/454/chapter/24751
  - https://www.opiq.ee/kit/454/chapter/24752
  - https://www.opiq.ee/kit/454/chapter/24753
  - https://www.opiq.ee/kit/454/chapter/24754
  - https://www.opiq.ee/kit/454/chapter/24755
  - https://www.opiq.ee/kit/454/chapter/24756
  - https://www.opiq.ee/kit/454/chapter/24757
  - https://www.opiq.ee/kit/454/chapter/24758
  - https://www.opiq.ee/kit/454/chapter/24759
  - https://www.opiq.ee/kit/454/chapter/24760
  - https://www.opiq.ee/kit/454/chapter/24761
  - https://www.opiq.ee/kit/454/chapter/24762
  - https://www.opiq.ee/kit/454/chapter/24763
  - https://www.opiq.ee/kit/454/chapter/24764
  - https://www.opiq.ee/kit/454/chapter/24765
  - https://www.opiq.ee/kit/454/chapter/24766
  - https://www.opiq.ee/kit/454/chapter/24767
  - https://www.opiq.ee/kit/454/chapter/24768
  - https://www.opiq.ee/kit/454/chapter/24769
  - https://www.opiq.ee/kit/454/chapter/24770
  - https://www.opiq.ee/kit/454/chapter/24771
  - https://www.opiq.ee/kit/454/chapter/24772
  - https://www.opiq.ee/kit/454/chapter/24773
  - https://www.opiq.ee/kit/454/chapter/24774
  - https://www.opiq.ee/kit/454/chapter/24775
  - https://www.opiq.ee/kit/454/chapter/24776
  - https://www.opiq.ee/kit/454/chapter/24777
  - https://www.opiq.ee/kit/454/chapter/24778
  - https://www.opiq.ee/kit/454/chapter/24779
  - https://www.opiq.ee/kit/454/chapter/24780
  - https://www.opiq.ee/kit/454/chapter/24781
  - https://www.opiq.ee/kit/454/chapter/24782
  - https://www.opiq.ee/kit/454/chapter/24783
  - https://www.opiq.ee/kit/454/chapter/24784
  - https://www.opiq.ee/kit/454/chapter/24785
  - https://www.opiq.ee/kit/454/chapter/24786
  - https://www.opiq.ee/kit/454/chapter/24787
  - https://www.opiq.ee/kit/454/chapter/24788
  - https://www.opiq.ee/kit/454/chapter/24789
  - https://www.opiq.ee/kit/454/chapter/24790
  - https://www.opiq.ee/kit/454/chapter/24791

</details>

<details><summary><code>g2q-0337</code> — <code>missing_task_examples</code> — 1 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-science`
- Books: `avita_loodusõpet_2_et`
- Kits: 379
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/379/chapter/20584

</details>

<details><summary><code>g2q-0338</code> — <code>missing_task_examples</code> — 27 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-science`
- Books: `avita_minu_väike_2_et`
- Kits: 330
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/330/chapter/18522
  - https://www.opiq.ee/kit/330/chapter/18523
  - https://www.opiq.ee/kit/330/chapter/18524
  - https://www.opiq.ee/kit/330/chapter/18525
  - https://www.opiq.ee/kit/330/chapter/18526
  - https://www.opiq.ee/kit/330/chapter/18527
  - https://www.opiq.ee/kit/330/chapter/18528
  - https://www.opiq.ee/kit/330/chapter/18529
  - https://www.opiq.ee/kit/330/chapter/18530
  - https://www.opiq.ee/kit/330/chapter/18531
  - https://www.opiq.ee/kit/330/chapter/18532
  - https://www.opiq.ee/kit/330/chapter/18533
  - https://www.opiq.ee/kit/330/chapter/18534
  - https://www.opiq.ee/kit/330/chapter/18535
  - https://www.opiq.ee/kit/330/chapter/18536
  - https://www.opiq.ee/kit/330/chapter/18537
  - https://www.opiq.ee/kit/330/chapter/18538
  - https://www.opiq.ee/kit/330/chapter/18539
  - https://www.opiq.ee/kit/330/chapter/18540
  - https://www.opiq.ee/kit/330/chapter/18541
  - https://www.opiq.ee/kit/330/chapter/18542
  - https://www.opiq.ee/kit/330/chapter/18543
  - https://www.opiq.ee/kit/330/chapter/18544
  - https://www.opiq.ee/kit/330/chapter/18545
  - https://www.opiq.ee/kit/330/chapter/18546
  - https://www.opiq.ee/kit/330/chapter/18547
  - https://www.opiq.ee/kit/330/chapter/18548

</details>

<details><summary><code>g2q-0339</code> — <code>missing_task_examples</code> — 3 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-science`
- Books: `avita_природовед_2_ru`
- Kits: 570
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/570/chapter/31849
  - https://www.opiq.ee/kit/570/chapter/31850
  - https://www.opiq.ee/kit/570/chapter/32086

</details>

<details><summary><code>g2q-0340</code> — <code>missing_task_examples</code> — 61 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-science`
- Books: `koolibri_loodusõpet_2_et`
- Kits: 121
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/121/chapter/6199
  - https://www.opiq.ee/kit/121/chapter/6200
  - https://www.opiq.ee/kit/121/chapter/6201
  - https://www.opiq.ee/kit/121/chapter/6202
  - https://www.opiq.ee/kit/121/chapter/6203
  - https://www.opiq.ee/kit/121/chapter/6204
  - https://www.opiq.ee/kit/121/chapter/6205
  - https://www.opiq.ee/kit/121/chapter/6206
  - https://www.opiq.ee/kit/121/chapter/6207
  - https://www.opiq.ee/kit/121/chapter/6208
  - https://www.opiq.ee/kit/121/chapter/6209
  - https://www.opiq.ee/kit/121/chapter/6210
  - https://www.opiq.ee/kit/121/chapter/6214
  - https://www.opiq.ee/kit/121/chapter/6216
  - https://www.opiq.ee/kit/121/chapter/6217
  - https://www.opiq.ee/kit/121/chapter/6218
  - https://www.opiq.ee/kit/121/chapter/6219
  - https://www.opiq.ee/kit/121/chapter/6220
  - https://www.opiq.ee/kit/121/chapter/6221
  - https://www.opiq.ee/kit/121/chapter/6222
  - https://www.opiq.ee/kit/121/chapter/6223
  - https://www.opiq.ee/kit/121/chapter/6224
  - https://www.opiq.ee/kit/121/chapter/6225
  - https://www.opiq.ee/kit/121/chapter/6226
  - https://www.opiq.ee/kit/121/chapter/6227
  - https://www.opiq.ee/kit/121/chapter/6228
  - https://www.opiq.ee/kit/121/chapter/6229
  - https://www.opiq.ee/kit/121/chapter/6230
  - https://www.opiq.ee/kit/121/chapter/6232
  - https://www.opiq.ee/kit/121/chapter/6233
  - https://www.opiq.ee/kit/121/chapter/6234
  - https://www.opiq.ee/kit/121/chapter/6235
  - https://www.opiq.ee/kit/121/chapter/6236
  - https://www.opiq.ee/kit/121/chapter/6237
  - https://www.opiq.ee/kit/121/chapter/6238
  - https://www.opiq.ee/kit/121/chapter/6239
  - https://www.opiq.ee/kit/121/chapter/6241
  - https://www.opiq.ee/kit/121/chapter/6242
  - https://www.opiq.ee/kit/121/chapter/6243
  - https://www.opiq.ee/kit/121/chapter/6244
  - https://www.opiq.ee/kit/121/chapter/6245
  - https://www.opiq.ee/kit/121/chapter/6246
  - https://www.opiq.ee/kit/121/chapter/6247
  - https://www.opiq.ee/kit/121/chapter/6248
  - https://www.opiq.ee/kit/121/chapter/6249
  - https://www.opiq.ee/kit/121/chapter/6250
  - https://www.opiq.ee/kit/121/chapter/6251
  - https://www.opiq.ee/kit/121/chapter/6252
  - https://www.opiq.ee/kit/121/chapter/6253
  - https://www.opiq.ee/kit/121/chapter/6254
  - https://www.opiq.ee/kit/121/chapter/6255
  - https://www.opiq.ee/kit/121/chapter/6256
  - https://www.opiq.ee/kit/121/chapter/6257
  - https://www.opiq.ee/kit/121/chapter/6258
  - https://www.opiq.ee/kit/121/chapter/6259
  - https://www.opiq.ee/kit/121/chapter/6260
  - https://www.opiq.ee/kit/121/chapter/6261
  - https://www.opiq.ee/kit/121/chapter/6262
  - https://www.opiq.ee/kit/121/chapter/6263
  - https://www.opiq.ee/kit/121/chapter/6264
  - https://www.opiq.ee/kit/121/chapter/6265

</details>

<details><summary><code>g2q-0341</code> — <code>missing_task_examples</code> — 67 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-science`
- Books: `koolibri_природове_2_ru`
- Kits: 132
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/132/chapter/7069
  - https://www.opiq.ee/kit/132/chapter/7070
  - https://www.opiq.ee/kit/132/chapter/7071
  - https://www.opiq.ee/kit/132/chapter/7072
  - https://www.opiq.ee/kit/132/chapter/7073
  - https://www.opiq.ee/kit/132/chapter/7074
  - https://www.opiq.ee/kit/132/chapter/7075
  - https://www.opiq.ee/kit/132/chapter/7076
  - https://www.opiq.ee/kit/132/chapter/7077
  - https://www.opiq.ee/kit/132/chapter/7078
  - https://www.opiq.ee/kit/132/chapter/7079
  - https://www.opiq.ee/kit/132/chapter/7080
  - https://www.opiq.ee/kit/132/chapter/7081
  - https://www.opiq.ee/kit/132/chapter/7082
  - https://www.opiq.ee/kit/132/chapter/7083
  - https://www.opiq.ee/kit/132/chapter/7084
  - https://www.opiq.ee/kit/132/chapter/7085
  - https://www.opiq.ee/kit/132/chapter/7086
  - https://www.opiq.ee/kit/132/chapter/7087
  - https://www.opiq.ee/kit/132/chapter/7088
  - https://www.opiq.ee/kit/132/chapter/7089
  - https://www.opiq.ee/kit/132/chapter/7090
  - https://www.opiq.ee/kit/132/chapter/7091
  - https://www.opiq.ee/kit/132/chapter/7092
  - https://www.opiq.ee/kit/132/chapter/7093
  - https://www.opiq.ee/kit/132/chapter/7094
  - https://www.opiq.ee/kit/132/chapter/7095
  - https://www.opiq.ee/kit/132/chapter/7096
  - https://www.opiq.ee/kit/132/chapter/7097
  - https://www.opiq.ee/kit/132/chapter/7098
  - https://www.opiq.ee/kit/132/chapter/7099
  - https://www.opiq.ee/kit/132/chapter/7100
  - https://www.opiq.ee/kit/132/chapter/7101
  - https://www.opiq.ee/kit/132/chapter/7102
  - https://www.opiq.ee/kit/132/chapter/7103
  - https://www.opiq.ee/kit/132/chapter/7104
  - https://www.opiq.ee/kit/132/chapter/7105
  - https://www.opiq.ee/kit/132/chapter/7106
  - https://www.opiq.ee/kit/132/chapter/7107
  - https://www.opiq.ee/kit/132/chapter/7108
  - https://www.opiq.ee/kit/132/chapter/7109
  - https://www.opiq.ee/kit/132/chapter/7110
  - https://www.opiq.ee/kit/132/chapter/7111
  - https://www.opiq.ee/kit/132/chapter/7112
  - https://www.opiq.ee/kit/132/chapter/7113
  - https://www.opiq.ee/kit/132/chapter/7114
  - https://www.opiq.ee/kit/132/chapter/7115
  - https://www.opiq.ee/kit/132/chapter/7116
  - https://www.opiq.ee/kit/132/chapter/7117
  - https://www.opiq.ee/kit/132/chapter/7118
  - https://www.opiq.ee/kit/132/chapter/7119
  - https://www.opiq.ee/kit/132/chapter/7120
  - https://www.opiq.ee/kit/132/chapter/7121
  - https://www.opiq.ee/kit/132/chapter/7122
  - https://www.opiq.ee/kit/132/chapter/7123
  - https://www.opiq.ee/kit/132/chapter/7124
  - https://www.opiq.ee/kit/132/chapter/7125
  - https://www.opiq.ee/kit/132/chapter/7126
  - https://www.opiq.ee/kit/132/chapter/7127
  - https://www.opiq.ee/kit/132/chapter/7128
  - https://www.opiq.ee/kit/132/chapter/7129
  - https://www.opiq.ee/kit/132/chapter/7130
  - https://www.opiq.ee/kit/132/chapter/7131
  - https://www.opiq.ee/kit/132/chapter/7132
  - https://www.opiq.ee/kit/132/chapter/7133
  - https://www.opiq.ee/kit/132/chapter/7134
  - https://www.opiq.ee/kit/132/chapter/7135

</details>

<details><summary><code>g2q-0342</code> — <code>missing_task_examples</code> — 3 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-science`
- Books: `ministeerium_loodusõpet_2_et`
- Kits: 501
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/501/chapter/27388
  - https://www.opiq.ee/kit/501/chapter/27390
  - https://www.opiq.ee/kit/501/chapter/27406

</details>

<details><summary><code>g2q-0343</code> — <code>missing_task_examples</code> — 28 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-science`
- Books: `skriibus_loodusõpet_2_et`
- Kits: 387
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/387/chapter/20880
  - https://www.opiq.ee/kit/387/chapter/20881
  - https://www.opiq.ee/kit/387/chapter/20882
  - https://www.opiq.ee/kit/387/chapter/20883
  - https://www.opiq.ee/kit/387/chapter/20884
  - https://www.opiq.ee/kit/387/chapter/20885
  - https://www.opiq.ee/kit/387/chapter/20886
  - https://www.opiq.ee/kit/387/chapter/20887
  - https://www.opiq.ee/kit/387/chapter/20888
  - https://www.opiq.ee/kit/387/chapter/20889
  - https://www.opiq.ee/kit/387/chapter/20890
  - https://www.opiq.ee/kit/387/chapter/20891
  - https://www.opiq.ee/kit/387/chapter/20892
  - https://www.opiq.ee/kit/387/chapter/20893
  - https://www.opiq.ee/kit/387/chapter/20894
  - https://www.opiq.ee/kit/387/chapter/20895
  - https://www.opiq.ee/kit/387/chapter/20896
  - https://www.opiq.ee/kit/387/chapter/20897
  - https://www.opiq.ee/kit/387/chapter/20898
  - https://www.opiq.ee/kit/387/chapter/20899
  - https://www.opiq.ee/kit/387/chapter/20900
  - https://www.opiq.ee/kit/387/chapter/20901
  - https://www.opiq.ee/kit/387/chapter/20902
  - https://www.opiq.ee/kit/387/chapter/20903
  - https://www.opiq.ee/kit/387/chapter/20904
  - https://www.opiq.ee/kit/387/chapter/20905
  - https://www.opiq.ee/kit/387/chapter/20906
  - https://www.opiq.ee/kit/387/chapter/20907

</details>

<details><summary><code>g2q-0344</code> — <code>missing_task_examples</code> — 41 canonical records have no extracted task examples.</summary>

- Classification: `acceptable_source_structure`
- Routes: `grade-2-science`
- Books: `star cloud_loodusõpet_2_et`
- Kits: 384
- Action: Treat these as informational, section, glossary, media, or teacher-support records unless page inspection proves otherwise; absence in the compact capture is not proof that the Opiq page has no activity.
- Exact URLs:
  - https://www.opiq.ee/kit/384/chapter/20737
  - https://www.opiq.ee/kit/384/chapter/20738
  - https://www.opiq.ee/kit/384/chapter/20739
  - https://www.opiq.ee/kit/384/chapter/20740
  - https://www.opiq.ee/kit/384/chapter/20741
  - https://www.opiq.ee/kit/384/chapter/20742
  - https://www.opiq.ee/kit/384/chapter/20743
  - https://www.opiq.ee/kit/384/chapter/20744
  - https://www.opiq.ee/kit/384/chapter/20745
  - https://www.opiq.ee/kit/384/chapter/20746
  - https://www.opiq.ee/kit/384/chapter/20747
  - https://www.opiq.ee/kit/384/chapter/20748
  - https://www.opiq.ee/kit/384/chapter/20749
  - https://www.opiq.ee/kit/384/chapter/20750
  - https://www.opiq.ee/kit/384/chapter/20751
  - https://www.opiq.ee/kit/384/chapter/20752
  - https://www.opiq.ee/kit/384/chapter/20753
  - https://www.opiq.ee/kit/384/chapter/20754
  - https://www.opiq.ee/kit/384/chapter/20755
  - https://www.opiq.ee/kit/384/chapter/20756
  - https://www.opiq.ee/kit/384/chapter/20757
  - https://www.opiq.ee/kit/384/chapter/20758
  - https://www.opiq.ee/kit/384/chapter/20759
  - https://www.opiq.ee/kit/384/chapter/20760
  - https://www.opiq.ee/kit/384/chapter/20761
  - https://www.opiq.ee/kit/384/chapter/20762
  - https://www.opiq.ee/kit/384/chapter/20763
  - https://www.opiq.ee/kit/384/chapter/20764
  - https://www.opiq.ee/kit/384/chapter/20765
  - https://www.opiq.ee/kit/384/chapter/20766
  - https://www.opiq.ee/kit/384/chapter/20767
  - https://www.opiq.ee/kit/384/chapter/20768
  - https://www.opiq.ee/kit/384/chapter/20769
  - https://www.opiq.ee/kit/384/chapter/20770
  - https://www.opiq.ee/kit/384/chapter/20771
  - https://www.opiq.ee/kit/384/chapter/20772
  - https://www.opiq.ee/kit/384/chapter/20773
  - https://www.opiq.ee/kit/384/chapter/20774
  - https://www.opiq.ee/kit/384/chapter/20775
  - https://www.opiq.ee/kit/384/chapter/20776
  - https://www.opiq.ee/kit/384/chapter/20777

</details>

<details><summary><code>g2q-0345</code> — <code>mixed_script_word</code> — 1 records contain a word token combining Cyrillic and Latin characters.</summary>

- Classification: `targeted_recapture_recommended`
- Routes: `grade-2-human-studies`
- Books: `koolibri_мой_мир._ч_2_ru__kit229`
- Kits: 229
- Action: Do not auto-correct look-alike letters. Recapture only the listed page when exact task wording is required.
- Exact URLs:
  - https://www.opiq.ee/kit/229/chapter/13076

</details>

<details><summary><code>g2q-0346</code> — <code>mixed_script_word</code> — 21 records contain a word token combining Cyrillic and Latin characters.</summary>

- Classification: `known_bilingual_extraction_boundary`
- Routes: `grade-2-mathematics`
- Books: `avita_математика_2_et__kit578`
- Kits: 578
- Action: Keep the bilingual language-support content; missing spaces between the Estonian Keeleabi label and Russian text are an extraction limitation, not a language reassignment.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32029
  - https://www.opiq.ee/kit/578/chapter/32032
  - https://www.opiq.ee/kit/578/chapter/32036
  - https://www.opiq.ee/kit/578/chapter/32199
  - https://www.opiq.ee/kit/578/chapter/32200
  - https://www.opiq.ee/kit/578/chapter/32201
  - https://www.opiq.ee/kit/578/chapter/32202
  - https://www.opiq.ee/kit/578/chapter/32220
  - https://www.opiq.ee/kit/578/chapter/32223
  - https://www.opiq.ee/kit/578/chapter/32226
  - https://www.opiq.ee/kit/578/chapter/33006
  - https://www.opiq.ee/kit/578/chapter/33019
  - https://www.opiq.ee/kit/578/chapter/33021
  - https://www.opiq.ee/kit/578/chapter/33023
  - https://www.opiq.ee/kit/578/chapter/33025
  - https://www.opiq.ee/kit/578/chapter/33026
  - https://www.opiq.ee/kit/578/chapter/33027
  - https://www.opiq.ee/kit/578/chapter/33028
  - https://www.opiq.ee/kit/578/chapter/33032
  - https://www.opiq.ee/kit/578/chapter/33034
  - https://www.opiq.ee/kit/578/chapter/33035

</details>

<details><summary><code>g2q-0347</code> — <code>mixed_script_word</code> — 2 records contain a word token combining Cyrillic and Latin characters.</summary>

- Classification: `targeted_recapture_recommended`
- Routes: `grade-2-russian`
- Books: `avita_русский_язык_2_класс_kit292`
- Kits: 292
- Action: Do not auto-correct look-alike letters. Recapture only the listed page when exact task wording is required.
- Exact URLs:
  - https://www.opiq.ee/kit/292/chapter/16123
  - https://www.opiq.ee/kit/292/chapter/17761

</details>

<details><summary><code>g2q-0348</code> — <code>mixed_script_word</code> — 2 records contain a word token combining Cyrillic and Latin characters.</summary>

- Classification: `targeted_recapture_recommended`
- Routes: `grade-2-russian`
- Books: `avita_русский_язык_i_ступень_часть_3_kit568`
- Kits: 568
- Action: Do not auto-correct look-alike letters. Recapture only the listed page when exact task wording is required.
- Exact URLs:
  - https://www.opiq.ee/kit/568/chapter/31778
  - https://www.opiq.ee/kit/568/chapter/31793

</details>

<details><summary><code>g2q-0349</code> — <code>mixed_script_word</code> — 1 records contain a word token combining Cyrillic and Latin characters.</summary>

- Classification: `targeted_recapture_recommended`
- Routes: `grade-2-russian`
- Books: `koolibri_светлячок._2_ru`
- Kits: 454
- Action: Do not auto-correct look-alike letters. Recapture only the listed page when exact task wording is required.
- Exact URLs:
  - https://www.opiq.ee/kit/454/chapter/24744

</details>

<details><summary><code>g2q-0350</code> — <code>mixed_script_word</code> — 1 records contain a word token combining Cyrillic and Latin characters.</summary>

- Classification: `targeted_recapture_recommended`
- Routes: `grade-2-science`
- Books: `avita_природовед_2_ru`
- Kits: 570
- Action: Do not auto-correct look-alike letters. Recapture only the listed page when exact task wording is required.
- Exact URLs:
  - https://www.opiq.ee/kit/570/chapter/32084

</details>

<details><summary><code>g2q-0351</code> — <code>mixed_script_word</code> — 1 records contain a word token combining Cyrillic and Latin characters.</summary>

- Classification: `targeted_recapture_recommended`
- Routes: `grade-2-science`
- Books: `koolibri_природове_2_ru`
- Kits: 132
- Action: Do not auto-correct look-alike letters. Recapture only the listed page when exact task wording is required.
- Exact URLs:
  - https://www.opiq.ee/kit/132/chapter/7072

</details>

<details><summary><code>g2q-0352</code> — <code>single_symbol_title</code> — 1 records use one letter or punctuation-only text as the page title.</summary>

- Classification: `targeted_recapture_recommended`
- Routes: `grade-2-estonian`
- Books: `koolibri_ilus_emake_2_et`
- Kits: 118
- Action: Retain source-supported phonics, pronoun, or concept titles. Verify the punctuation-only page with one targeted page capture before relying on it.
- Exact URLs:
  - https://www.opiq.ee/kit/118/chapter/5990

</details>

<details><summary><code>g2q-0353</code> — <code>single_symbol_title</code> — 2 records use one letter or punctuation-only text as the page title.</summary>

- Classification: `acceptable_book_structure`
- Routes: `grade-2-estonian`
- Books: `koolibri_mina_loen__2_et`
- Kits: 458
- Action: Retain source-supported phonics, pronoun, or concept titles. Verify the punctuation-only page with one targeted page capture before relying on it.
- Exact URLs:
  - https://www.opiq.ee/kit/458/chapter/25004
  - https://www.opiq.ee/kit/458/chapter/25005

</details>

<details><summary><code>g2q-0354</code> — <code>single_symbol_title</code> — 1 records use one letter or punctuation-only text as the page title.</summary>

- Classification: `acceptable_book_structure`
- Routes: `grade-2-human-studies`
- Books: `koolibri_мой_мир._ч_2_ru__kit229`
- Kits: 229
- Action: Retain source-supported phonics, pronoun, or concept titles. Verify the punctuation-only page with one targeted page capture before relying on it.
- Exact URLs:
  - https://www.opiq.ee/kit/229/chapter/13074

</details>

<details><summary><code>g2q-0355</code> — <code>source_book_id_language_suffix_mismatch</code> — Source Book ID language suffix conflicts with canonical Language for avita_математика_2_et__kit578.</summary>

- Classification: `source_identifier_anomaly`
- Routes: `grade-2-mathematics`
- Books: `avita_математика_2_et__kit578`
- Kits: 578
- Action: Preserve the immutable source identifier. Do not infer a language correction from the suffix alone.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32028
  - https://www.opiq.ee/kit/578/chapter/32029
  - https://www.opiq.ee/kit/578/chapter/32030
  - https://www.opiq.ee/kit/578/chapter/32031
  - https://www.opiq.ee/kit/578/chapter/32032
  - https://www.opiq.ee/kit/578/chapter/32033
  - https://www.opiq.ee/kit/578/chapter/32034
  - https://www.opiq.ee/kit/578/chapter/32035
  - https://www.opiq.ee/kit/578/chapter/32036
  - https://www.opiq.ee/kit/578/chapter/32037
  - https://www.opiq.ee/kit/578/chapter/32038
  - https://www.opiq.ee/kit/578/chapter/32039
  - https://www.opiq.ee/kit/578/chapter/32040
  - https://www.opiq.ee/kit/578/chapter/32197
  - https://www.opiq.ee/kit/578/chapter/32198
  - https://www.opiq.ee/kit/578/chapter/32199
  - https://www.opiq.ee/kit/578/chapter/32200
  - https://www.opiq.ee/kit/578/chapter/32201
  - https://www.opiq.ee/kit/578/chapter/32202
  - https://www.opiq.ee/kit/578/chapter/32203
  - https://www.opiq.ee/kit/578/chapter/32204
  - https://www.opiq.ee/kit/578/chapter/32205
  - https://www.opiq.ee/kit/578/chapter/32206
  - https://www.opiq.ee/kit/578/chapter/32207
  - https://www.opiq.ee/kit/578/chapter/32208
  - https://www.opiq.ee/kit/578/chapter/32209
  - https://www.opiq.ee/kit/578/chapter/32210
  - https://www.opiq.ee/kit/578/chapter/32211
  - https://www.opiq.ee/kit/578/chapter/32212
  - https://www.opiq.ee/kit/578/chapter/32213
  - https://www.opiq.ee/kit/578/chapter/32214
  - https://www.opiq.ee/kit/578/chapter/32215
  - https://www.opiq.ee/kit/578/chapter/32216
  - https://www.opiq.ee/kit/578/chapter/32217
  - https://www.opiq.ee/kit/578/chapter/32218
  - https://www.opiq.ee/kit/578/chapter/32219
  - https://www.opiq.ee/kit/578/chapter/32220
  - https://www.opiq.ee/kit/578/chapter/32221
  - https://www.opiq.ee/kit/578/chapter/32222
  - https://www.opiq.ee/kit/578/chapter/32223
  - https://www.opiq.ee/kit/578/chapter/32224
  - https://www.opiq.ee/kit/578/chapter/32225
  - https://www.opiq.ee/kit/578/chapter/32226
  - https://www.opiq.ee/kit/578/chapter/32227
  - https://www.opiq.ee/kit/578/chapter/32228
  - https://www.opiq.ee/kit/578/chapter/32229
  - https://www.opiq.ee/kit/578/chapter/32230
  - https://www.opiq.ee/kit/578/chapter/32231
  - https://www.opiq.ee/kit/578/chapter/32232
  - https://www.opiq.ee/kit/578/chapter/32233
  - https://www.opiq.ee/kit/578/chapter/32234
  - https://www.opiq.ee/kit/578/chapter/32235
  - https://www.opiq.ee/kit/578/chapter/32236
  - https://www.opiq.ee/kit/578/chapter/33004
  - https://www.opiq.ee/kit/578/chapter/33005
  - https://www.opiq.ee/kit/578/chapter/33006
  - https://www.opiq.ee/kit/578/chapter/33007
  - https://www.opiq.ee/kit/578/chapter/33008
  - https://www.opiq.ee/kit/578/chapter/33009
  - https://www.opiq.ee/kit/578/chapter/33010
  - https://www.opiq.ee/kit/578/chapter/33011
  - https://www.opiq.ee/kit/578/chapter/33012
  - https://www.opiq.ee/kit/578/chapter/33013
  - https://www.opiq.ee/kit/578/chapter/33014
  - https://www.opiq.ee/kit/578/chapter/33015
  - https://www.opiq.ee/kit/578/chapter/33016
  - https://www.opiq.ee/kit/578/chapter/33017
  - https://www.opiq.ee/kit/578/chapter/33018
  - https://www.opiq.ee/kit/578/chapter/33019
  - https://www.opiq.ee/kit/578/chapter/33020
  - https://www.opiq.ee/kit/578/chapter/33021
  - https://www.opiq.ee/kit/578/chapter/33022
  - https://www.opiq.ee/kit/578/chapter/33023
  - https://www.opiq.ee/kit/578/chapter/33024
  - https://www.opiq.ee/kit/578/chapter/33025
  - https://www.opiq.ee/kit/578/chapter/33026
  - https://www.opiq.ee/kit/578/chapter/33027
  - https://www.opiq.ee/kit/578/chapter/33028
  - https://www.opiq.ee/kit/578/chapter/33029
  - https://www.opiq.ee/kit/578/chapter/33030
  - https://www.opiq.ee/kit/578/chapter/33031
  - https://www.opiq.ee/kit/578/chapter/33032
  - https://www.opiq.ee/kit/578/chapter/33033
  - https://www.opiq.ee/kit/578/chapter/33034
  - https://www.opiq.ee/kit/578/chapter/33035

</details>

<details><summary><code>g2q-0356</code> — <code>source_book_id_language_suffix_mismatch</code> — Source Book ID language suffix conflicts with canonical Language for koolibri_математика_2_et__kit361.</summary>

- Classification: `source_identifier_anomaly`
- Routes: `grade-2-mathematics`
- Books: `koolibri_математика_2_et__kit361`
- Kits: 361
- Action: Preserve the immutable source identifier. Do not infer a language correction from the suffix alone.
- Exact URLs:
  - https://www.opiq.ee/kit/361/chapter/19841
  - https://www.opiq.ee/kit/361/chapter/19842
  - https://www.opiq.ee/kit/361/chapter/19843
  - https://www.opiq.ee/kit/361/chapter/19844
  - https://www.opiq.ee/kit/361/chapter/19845
  - https://www.opiq.ee/kit/361/chapter/19846
  - https://www.opiq.ee/kit/361/chapter/19847
  - https://www.opiq.ee/kit/361/chapter/19848
  - https://www.opiq.ee/kit/361/chapter/19849
  - https://www.opiq.ee/kit/361/chapter/19850
  - https://www.opiq.ee/kit/361/chapter/19851
  - https://www.opiq.ee/kit/361/chapter/19852
  - https://www.opiq.ee/kit/361/chapter/19853
  - https://www.opiq.ee/kit/361/chapter/19854
  - https://www.opiq.ee/kit/361/chapter/19855
  - https://www.opiq.ee/kit/361/chapter/19856
  - https://www.opiq.ee/kit/361/chapter/19857
  - https://www.opiq.ee/kit/361/chapter/19858
  - https://www.opiq.ee/kit/361/chapter/19859
  - https://www.opiq.ee/kit/361/chapter/19860
  - https://www.opiq.ee/kit/361/chapter/19861
  - https://www.opiq.ee/kit/361/chapter/19862
  - https://www.opiq.ee/kit/361/chapter/19863
  - https://www.opiq.ee/kit/361/chapter/19864
  - https://www.opiq.ee/kit/361/chapter/19865
  - https://www.opiq.ee/kit/361/chapter/19866
  - https://www.opiq.ee/kit/361/chapter/19867
  - https://www.opiq.ee/kit/361/chapter/19868
  - https://www.opiq.ee/kit/361/chapter/19869
  - https://www.opiq.ee/kit/361/chapter/19870
  - https://www.opiq.ee/kit/361/chapter/19871
  - https://www.opiq.ee/kit/361/chapter/19872
  - https://www.opiq.ee/kit/361/chapter/19873
  - https://www.opiq.ee/kit/361/chapter/19874
  - https://www.opiq.ee/kit/361/chapter/19875
  - https://www.opiq.ee/kit/361/chapter/19876
  - https://www.opiq.ee/kit/361/chapter/19877
  - https://www.opiq.ee/kit/361/chapter/19878
  - https://www.opiq.ee/kit/361/chapter/19879
  - https://www.opiq.ee/kit/361/chapter/19880
  - https://www.opiq.ee/kit/361/chapter/19881
  - https://www.opiq.ee/kit/361/chapter/19882
  - https://www.opiq.ee/kit/361/chapter/19883
  - https://www.opiq.ee/kit/361/chapter/19884
  - https://www.opiq.ee/kit/361/chapter/19885
  - https://www.opiq.ee/kit/361/chapter/19886
  - https://www.opiq.ee/kit/361/chapter/19887
  - https://www.opiq.ee/kit/361/chapter/19888
  - https://www.opiq.ee/kit/361/chapter/19889
  - https://www.opiq.ee/kit/361/chapter/19890
  - https://www.opiq.ee/kit/361/chapter/19891
  - https://www.opiq.ee/kit/361/chapter/19892
  - https://www.opiq.ee/kit/361/chapter/19893
  - https://www.opiq.ee/kit/361/chapter/19894
  - https://www.opiq.ee/kit/361/chapter/19895
  - https://www.opiq.ee/kit/361/chapter/19896

</details>

<details><summary><code>g2q-0357</code> — <code>source_canonical_language_mismatch</code> — 1 records have canonical Language different from every raw compact-record language value.</summary>

- Classification: `proven_canonical_normalization`
- Routes: `grade-2-human-studies`
- Books: `avita_inimeseõpe_2_ru__kit579`
- Kits: 579
- Action: Keep the canonical language only where book identity and page text prove the automatic source label wrong; preserve the raw values in this audit.
- Exact URLs:
  - https://www.opiq.ee/kit/579/chapter/32445

</details>

<details><summary><code>g2q-0358</code> — <code>source_canonical_language_mismatch</code> — 1 records have canonical Language different from every raw compact-record language value.</summary>

- Classification: `proven_canonical_normalization`
- Routes: `grade-2-human-studies`
- Books: `harno_inimeseõpe_2_et__kit286`
- Kits: 286
- Action: Keep the canonical language only where book identity and page text prove the automatic source label wrong; preserve the raw values in this audit.
- Exact URLs:
  - https://www.opiq.ee/kit/286/chapter/17536

</details>

<details><summary><code>g2q-0359</code> — <code>source_canonical_language_mismatch</code> — 3 records have canonical Language different from every raw compact-record language value.</summary>

- Classification: `proven_canonical_normalization`
- Routes: `grade-2-kodututarde-training`
- Books: `kodutütarde_i_järk_(2026)`
- Kits: 593
- Action: Keep the canonical language only where book identity and page text prove the automatic source label wrong; preserve the raw values in this audit.
- Exact URLs:
  - https://www.opiq.ee/kit/593/chapter/33600
  - https://www.opiq.ee/kit/593/chapter/33604
  - https://www.opiq.ee/kit/593/chapter/33605

</details>

<details><summary><code>g2q-0360</code> — <code>source_canonical_language_mismatch</code> — 3 records have canonical Language different from every raw compact-record language value.</summary>

- Classification: `proven_canonical_normalization`
- Routes: `grade-2-noorte-kotkaste-training`
- Books: `kaitseliit_noorte_kot_2_et`
- Kits: 594
- Action: Keep the canonical language only where book identity and page text prove the automatic source label wrong; preserve the raw values in this audit.
- Exact URLs:
  - https://www.opiq.ee/kit/594/chapter/33634
  - https://www.opiq.ee/kit/594/chapter/33638
  - https://www.opiq.ee/kit/594/chapter/33639

</details>

<details><summary><code>g2q-0361</code> — <code>text_language_mismatch</code> — 1 records are dominated by a script that differs from canonical Language.</summary>

- Classification: `source_language_requires_targeted_review`
- Routes: `grade-2-human-studies`
- Books: `avita_inimeseõpe_2_ru__kit579`
- Kits: 579
- Action: Do not change language automatically. Review the listed page and current Kit Details before any metadata repair.
- Exact URLs:
  - https://www.opiq.ee/kit/579/chapter/32445

</details>

<details><summary><code>g2q-0362</code> — <code>text_language_mismatch</code> — 69 records are dominated by a script that differs from canonical Language.</summary>

- Classification: `known_source_metadata_anomaly`
- Routes: `grade-2-mathematics`
- Books: `avita_математика_2_et__kit578`
- Kits: 578
- Action: Retain source Language ru pending a fresh Kit Details language check; the capture is Estonian-primary or bilingual despite the Russian source identity.
- Exact URLs:
  - https://www.opiq.ee/kit/578/chapter/32028
  - https://www.opiq.ee/kit/578/chapter/32029
  - https://www.opiq.ee/kit/578/chapter/32030
  - https://www.opiq.ee/kit/578/chapter/32031
  - https://www.opiq.ee/kit/578/chapter/32032
  - https://www.opiq.ee/kit/578/chapter/32033
  - https://www.opiq.ee/kit/578/chapter/32034
  - https://www.opiq.ee/kit/578/chapter/32035
  - https://www.opiq.ee/kit/578/chapter/32036
  - https://www.opiq.ee/kit/578/chapter/32037
  - https://www.opiq.ee/kit/578/chapter/32038
  - https://www.opiq.ee/kit/578/chapter/32039
  - https://www.opiq.ee/kit/578/chapter/32040
  - https://www.opiq.ee/kit/578/chapter/32197
  - https://www.opiq.ee/kit/578/chapter/32198
  - https://www.opiq.ee/kit/578/chapter/32200
  - https://www.opiq.ee/kit/578/chapter/32203
  - https://www.opiq.ee/kit/578/chapter/32204
  - https://www.opiq.ee/kit/578/chapter/32205
  - https://www.opiq.ee/kit/578/chapter/32206
  - https://www.opiq.ee/kit/578/chapter/32207
  - https://www.opiq.ee/kit/578/chapter/32208
  - https://www.opiq.ee/kit/578/chapter/32209
  - https://www.opiq.ee/kit/578/chapter/32210
  - https://www.opiq.ee/kit/578/chapter/32211
  - https://www.opiq.ee/kit/578/chapter/32212
  - https://www.opiq.ee/kit/578/chapter/32213
  - https://www.opiq.ee/kit/578/chapter/32214
  - https://www.opiq.ee/kit/578/chapter/32215
  - https://www.opiq.ee/kit/578/chapter/32216
  - https://www.opiq.ee/kit/578/chapter/32217
  - https://www.opiq.ee/kit/578/chapter/32218
  - https://www.opiq.ee/kit/578/chapter/32219
  - https://www.opiq.ee/kit/578/chapter/32220
  - https://www.opiq.ee/kit/578/chapter/32222
  - https://www.opiq.ee/kit/578/chapter/32224
  - https://www.opiq.ee/kit/578/chapter/32225
  - https://www.opiq.ee/kit/578/chapter/32227
  - https://www.opiq.ee/kit/578/chapter/32228
  - https://www.opiq.ee/kit/578/chapter/32229
  - https://www.opiq.ee/kit/578/chapter/32230
  - https://www.opiq.ee/kit/578/chapter/32231
  - https://www.opiq.ee/kit/578/chapter/32232
  - https://www.opiq.ee/kit/578/chapter/33004
  - https://www.opiq.ee/kit/578/chapter/33005
  - https://www.opiq.ee/kit/578/chapter/33007
  - https://www.opiq.ee/kit/578/chapter/33008
  - https://www.opiq.ee/kit/578/chapter/33009
  - https://www.opiq.ee/kit/578/chapter/33010
  - https://www.opiq.ee/kit/578/chapter/33011
  - https://www.opiq.ee/kit/578/chapter/33012
  - https://www.opiq.ee/kit/578/chapter/33013
  - https://www.opiq.ee/kit/578/chapter/33014
  - https://www.opiq.ee/kit/578/chapter/33015
  - https://www.opiq.ee/kit/578/chapter/33016
  - https://www.opiq.ee/kit/578/chapter/33017
  - https://www.opiq.ee/kit/578/chapter/33018
  - https://www.opiq.ee/kit/578/chapter/33019
  - https://www.opiq.ee/kit/578/chapter/33020
  - https://www.opiq.ee/kit/578/chapter/33021
  - https://www.opiq.ee/kit/578/chapter/33022
  - https://www.opiq.ee/kit/578/chapter/33023
  - https://www.opiq.ee/kit/578/chapter/33026
  - https://www.opiq.ee/kit/578/chapter/33027
  - https://www.opiq.ee/kit/578/chapter/33029
  - https://www.opiq.ee/kit/578/chapter/33030
  - https://www.opiq.ee/kit/578/chapter/33031
  - https://www.opiq.ee/kit/578/chapter/33033
  - https://www.opiq.ee/kit/578/chapter/33035

</details>

<details><summary><code>g2q-0363</code> — <code>text_language_mismatch</code> — 6 records are dominated by a script that differs from canonical Language.</summary>

- Classification: `acceptable_bilingual_source_content`
- Routes: `grade-2-music`
- Books: `музыка_–_волшебная_страна._2_класс`
- Kits: 238
- Action: Retain as a source-supported Estonian song title or bilingual glossary inside a Russian-language book; this does not reclassify the whole book.
- Exact URLs:
  - https://www.opiq.ee/kit/238/chapter/13457
  - https://www.opiq.ee/kit/238/chapter/13509
  - https://www.opiq.ee/kit/238/chapter/13540
  - https://www.opiq.ee/kit/238/chapter/13542
  - https://www.opiq.ee/kit/238/chapter/13549
  - https://www.opiq.ee/kit/238/chapter/13554

</details>

<details><summary><code>g2q-0364</code> — <code>text_language_mismatch</code> — 1 records are dominated by a script that differs from canonical Language.</summary>

- Classification: `acceptable_bilingual_source_content`
- Routes: `grade-2-russian`
- Books: `avita_русский_язык_2_класс_kit292`
- Kits: 292
- Action: Retain as a source-supported Estonian song title or bilingual glossary inside a Russian-language book; this does not reclassify the whole book.
- Exact URLs:
  - https://www.opiq.ee/kit/292/chapter/16173

</details>

<details><summary><code>g2q-0365</code> — <code>text_language_mismatch</code> — 22 records are dominated by a script that differs from canonical Language.</summary>

- Classification: `known_source_metadata_anomaly`
- Routes: `grade-2-science`
- Books: `avita_природовед_2_ru`
- Kits: 570
- Action: Retain source Language ru pending a fresh Kit Details language check; the capture is Estonian-primary or bilingual despite the Russian source identity.
- Exact URLs:
  - https://www.opiq.ee/kit/570/chapter/31841
  - https://www.opiq.ee/kit/570/chapter/31842
  - https://www.opiq.ee/kit/570/chapter/31843
  - https://www.opiq.ee/kit/570/chapter/31844
  - https://www.opiq.ee/kit/570/chapter/31845
  - https://www.opiq.ee/kit/570/chapter/31846
  - https://www.opiq.ee/kit/570/chapter/31847
  - https://www.opiq.ee/kit/570/chapter/31848
  - https://www.opiq.ee/kit/570/chapter/31849
  - https://www.opiq.ee/kit/570/chapter/31850
  - https://www.opiq.ee/kit/570/chapter/32084
  - https://www.opiq.ee/kit/570/chapter/32085
  - https://www.opiq.ee/kit/570/chapter/32087
  - https://www.opiq.ee/kit/570/chapter/32088
  - https://www.opiq.ee/kit/570/chapter/32089
  - https://www.opiq.ee/kit/570/chapter/33143
  - https://www.opiq.ee/kit/570/chapter/33144
  - https://www.opiq.ee/kit/570/chapter/33145
  - https://www.opiq.ee/kit/570/chapter/33146
  - https://www.opiq.ee/kit/570/chapter/33147
  - https://www.opiq.ee/kit/570/chapter/33148
  - https://www.opiq.ee/kit/570/chapter/33149

</details>

<details><summary><code>g2q-0366</code> — <code>unusually_short_record</code> — 12 compact records contain fewer than 10 visible title/heading/task characters.</summary>

- Classification: `source_supported_short_summary`
- Routes: `grade-2-arts-and-crafts`
- Books: `kunsti-_ja_tööõpetus._2._osa`
- Kits: 192
- Action: The compact record is a lookup summary, not a full page copy. Retain when title and heading agree; inspect the direct Opiq page when selecting it for a lesson.
- Exact URLs:
  - https://www.opiq.ee/kit/192/chapter/10897
  - https://www.opiq.ee/kit/192/chapter/10913
  - https://www.opiq.ee/kit/192/chapter/10916
  - https://www.opiq.ee/kit/192/chapter/10917
  - https://www.opiq.ee/kit/192/chapter/10929
  - https://www.opiq.ee/kit/192/chapter/10936
  - https://www.opiq.ee/kit/192/chapter/10937
  - https://www.opiq.ee/kit/192/chapter/10955
  - https://www.opiq.ee/kit/192/chapter/10956
  - https://www.opiq.ee/kit/192/chapter/10957
  - https://www.opiq.ee/kit/192/chapter/10966
  - https://www.opiq.ee/kit/192/chapter/10968

</details>

<details><summary><code>g2q-0367</code> — <code>unusually_short_record</code> — 3 compact records contain fewer than 10 visible title/heading/task characters.</summary>

- Classification: `source_supported_short_summary`
- Routes: `grade-2-arts-and-crafts`
- Books: `трудовое_обучение_и_искусство._2_часть`
- Kits: 371
- Action: The compact record is a lookup summary, not a full page copy. Retain when title and heading agree; inspect the direct Opiq page when selecting it for a lesson.
- Exact URLs:
  - https://www.opiq.ee/kit/371/chapter/20289
  - https://www.opiq.ee/kit/371/chapter/20305
  - https://www.opiq.ee/kit/371/chapter/20312

</details>

<details><summary><code>g2q-0368</code> — <code>unusually_short_record</code> — 4 compact records contain fewer than 10 visible title/heading/task characters.</summary>

- Classification: `source_supported_short_summary`
- Routes: `grade-2-estonian`
- Books: `koolibri_ilus_emake_2_et`
- Kits: 118
- Action: The compact record is a lookup summary, not a full page copy. Retain when title and heading agree; inspect the direct Opiq page when selecting it for a lesson.
- Exact URLs:
  - https://www.opiq.ee/kit/118/chapter/5873
  - https://www.opiq.ee/kit/118/chapter/5888
  - https://www.opiq.ee/kit/118/chapter/5951
  - https://www.opiq.ee/kit/118/chapter/6031

</details>

<details><summary><code>g2q-0369</code> — <code>unusually_short_record</code> — 1 compact records contain fewer than 10 visible title/heading/task characters.</summary>

- Classification: `source_supported_short_summary`
- Routes: `grade-2-music`
- Books: `2._klassi_muusikaõpetus`
- Kits: 188
- Action: The compact record is a lookup summary, not a full page copy. Retain when title and heading agree; inspect the direct Opiq page when selecting it for a lesson.
- Exact URLs:
  - https://www.opiq.ee/kit/188/chapter/10690

</details>

<details><summary><code>g2q-0370</code> — <code>unusually_short_record</code> — 1 compact records contain fewer than 10 visible title/heading/task characters.</summary>

- Classification: `source_supported_short_summary`
- Routes: `grade-2-music`
- Books: `eesti_pärimusmuusika_keskuse_õppevideod`
- Kits: 465
- Action: The compact record is a lookup summary, not a full page copy. Retain when title and heading agree; inspect the direct Opiq page when selecting it for a lesson.
- Exact URLs:
  - https://www.opiq.ee/kit/465/chapter/25298

</details>

<details><summary><code>g2q-0371</code> — <code>unusually_short_record</code> — 2 compact records contain fewer than 10 visible title/heading/task characters.</summary>

- Classification: `source_supported_short_summary`
- Routes: `grade-2-music`
- Books: `музыка_–_волшебная_страна._2_класс`
- Kits: 238
- Action: The compact record is a lookup summary, not a full page copy. Retain when title and heading agree; inspect the direct Opiq page when selecting it for a lesson.
- Exact URLs:
  - https://www.opiq.ee/kit/238/chapter/13507
  - https://www.opiq.ee/kit/238/chapter/13548

</details>

<details><summary><code>g2q-0372</code> — <code>unusually_short_record</code> — 1 compact records contain fewer than 10 visible title/heading/task characters.</summary>

- Classification: `source_supported_short_summary`
- Routes: `grade-2-science`
- Books: `koolibri_природове_2_ru`
- Kits: 132
- Action: The compact record is a lookup summary, not a full page copy. Retain when title and heading agree; inspect the direct Opiq page when selecting it for a lesson.
- Exact URLs:
  - https://www.opiq.ee/kit/132/chapter/7116

</details>

<details><summary><code>g2q-0373</code> — <code>very_short_title</code> — 3 records have titles of three characters or fewer.</summary>

- Classification: `targeted_recapture_recommended`
- Routes: `grade-2-estonian`
- Books: `koolibri_ilus_emake_2_et`
- Kits: 118
- Action: Recapture only the punctuation-only page if it will be selected for teaching; letter, phonics, and one-word concept titles are valid book structure.
- Exact URLs:
  - https://www.opiq.ee/kit/118/chapter/5888
  - https://www.opiq.ee/kit/118/chapter/5942
  - https://www.opiq.ee/kit/118/chapter/5990

</details>

<details><summary><code>g2q-0374</code> — <code>very_short_title</code> — 2 records have titles of three characters or fewer.</summary>

- Classification: `source_supported_short_title`
- Routes: `grade-2-estonian`
- Books: `koolibri_mina_loen__2_et`
- Kits: 458
- Action: No repair: archive title and first heading agree, and the short title is meaningful in the source structure.
- Exact URLs:
  - https://www.opiq.ee/kit/458/chapter/25004
  - https://www.opiq.ee/kit/458/chapter/25005

</details>

<details><summary><code>g2q-0375</code> — <code>very_short_title</code> — 3 records have titles of three characters or fewer.</summary>

- Classification: `source_supported_short_title`
- Routes: `grade-2-human-studies`
- Books: `avita_loodus-_ja_2_et__kit56`
- Kits: 56
- Action: No repair: archive title and first heading agree, and the short title is meaningful in the source structure.
- Exact URLs:
  - https://www.opiq.ee/kit/56/chapter/2760
  - https://www.opiq.ee/kit/56/chapter/7625
  - https://www.opiq.ee/kit/56/chapter/7703

</details>

<details><summary><code>g2q-0376</code> — <code>very_short_title</code> — 1 records have titles of three characters or fewer.</summary>

- Classification: `source_supported_short_title`
- Routes: `grade-2-human-studies`
- Books: `koolibri_мой_мир._ч_2_ru__kit229`
- Kits: 229
- Action: No repair: archive title and first heading agree, and the short title is meaningful in the source structure.
- Exact URLs:
  - https://www.opiq.ee/kit/229/chapter/13074

</details>

<details><summary><code>g2q-0377</code> — <code>very_short_title</code> — 1 records have titles of three characters or fewer.</summary>

- Classification: `source_supported_short_title`
- Routes: `grade-2-mathematics`
- Books: `harno_matemaatik_2_et__kit272`
- Kits: 272
- Action: No repair: archive title and first heading agree, and the short title is meaningful in the source structure.
- Exact URLs:
  - https://www.opiq.ee/kit/272/chapter/15427

</details>

<details><summary><code>g2q-0378</code> — <code>very_short_title</code> — 1 records have titles of three characters or fewer.</summary>

- Classification: `source_supported_short_title`
- Routes: `grade-2-music`
- Books: `музыка_–_волшебная_страна._2_класс`
- Kits: 238
- Action: No repair: archive title and first heading agree, and the short title is meaningful in the source structure.
- Exact URLs:
  - https://www.opiq.ee/kit/238/chapter/13548

</details>

<details><summary><code>g2q-0379</code> — <code>very_short_title</code> — 2 records have titles of three characters or fewer.</summary>

- Classification: `source_supported_short_title`
- Routes: `grade-2-nature-and-human-studies`
- Books: `avita_природа_и__2_ru__kit86`
- Kits: 86
- Action: No repair: archive title and first heading agree, and the short title is meaningful in the source structure.
- Exact URLs:
  - https://www.opiq.ee/kit/86/chapter/12105
  - https://www.opiq.ee/kit/86/chapter/4193

</details>

<details><summary><code>g2q-0380</code> — <code>very_short_title</code> — 3 records have titles of three characters or fewer.</summary>

- Classification: `source_supported_short_title`
- Routes: `grade-2-russian`
- Books: `koolibri_светлячок._2_ru`
- Kits: 454
- Action: No repair: archive title and first heading agree, and the short title is meaningful in the source structure.
- Exact URLs:
  - https://www.opiq.ee/kit/454/chapter/24709
  - https://www.opiq.ee/kit/454/chapter/24715
  - https://www.opiq.ee/kit/454/chapter/24729

</details>

<details><summary><code>g2q-0381</code> — <code>very_short_title</code> — 1 records have titles of three characters or fewer.</summary>

- Classification: `source_supported_short_title`
- Routes: `grade-2-science`
- Books: `avita_loodusõpet_2_et`
- Kits: 379
- Action: No repair: archive title and first heading agree, and the short title is meaningful in the source structure.
- Exact URLs:
  - https://www.opiq.ee/kit/379/chapter/20582

</details>

<details><summary><code>g2q-0382</code> — <code>very_short_title</code> — 1 records have titles of three characters or fewer.</summary>

- Classification: `source_supported_short_title`
- Routes: `grade-2-science`
- Books: `avita_природовед_2_ru`
- Kits: 570
- Action: No repair: archive title and first heading agree, and the short title is meaningful in the source structure.
- Exact URLs:
  - https://www.opiq.ee/kit/570/chapter/32084

</details>

<details><summary><code>g2q-0383</code> — <code>very_short_title</code> — 1 records have titles of three characters or fewer.</summary>

- Classification: `source_supported_short_title`
- Routes: `grade-2-science`
- Books: `koolibri_loodusõpet_2_et`
- Kits: 121
- Action: No repair: archive title and first heading agree, and the short title is meaningful in the source structure.
- Exact URLs:
  - https://www.opiq.ee/kit/121/chapter/6245

</details>

<details><summary><code>g2q-0384</code> — <code>very_short_title</code> — 1 records have titles of three characters or fewer.</summary>

- Classification: `source_supported_short_title`
- Routes: `grade-2-science`
- Books: `ministeerium_loodusõpet_2_et`
- Kits: 501
- Action: No repair: archive title and first heading agree, and the short title is meaningful in the source structure.
- Exact URLs:
  - https://www.opiq.ee/kit/501/chapter/27371

</details>

## Known limits of this automated audit

- Script ratios can identify likely language anomalies but cannot establish a pedagogical language policy or reliably classify every bilingual passage.
- Empty `task_examples` means only that the compact capture has no extracted example; it does not prove that the Opiq page contains no exercises.
- Equal compact fields do not prove page duplication because the full copyrighted page body is intentionally not stored.
- The audit validates supplied registered captures only. It does not compare them with the current live Opiq catalogue.
- It does not prove official-curriculum completeness; a separate curriculum map is required.

The machine-readable report with complete warning observations and archive fingerprints is `project-files/outputs/grade-2-content-quality-report.json`.
