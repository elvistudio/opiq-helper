# Grade 4 immutable ZIP intake and routing audit

Verification date: `2026-07-27`

Base commit: `658b1995e9a77d223e2821ccec108a8fb39dda22`

## Executive summary

The ten supplied ZIP archives are byte-identified, structurally readable, CRC-valid, and fully accounted. They contain 2425 source records: 2342 instructional chapter/page candidates, 34 retained kit details, and 32 duplicate detail aliases. No canonical Grade 4 route or manifest entry is created here.

Captured exporter metadata is not sufficient by itself: subject labels are frequently incorrect, generic titles do not establish exact grade, and complete page prose is absent. Evidence-based candidate routes therefore retain raw labels, explicit normalizations, blockers, and recapture requirements.

## Audited archives

- `project-files/inputs/final-zips/opiq_4klass_4_opiq_v2.zip` — `70a784a69b4df6f9081b753d5c5c2f8b89d220f76efb575c3ef6c3f90571bd0f`, 2893608 bytes, 215 members
- `project-files/inputs/final-zips/opiq_4klass_eesti_keel_4_klassile_opiq_v2.zip` — `a8a2c589252fc15c73175d009754136664c56858241742cd7d1d6c97203460db`, 2942291 bytes, 535 members
- `project-files/inputs/final-zips/opiq_4klass_english_step_by_step_2_opiq_v2.zip` — `6a33af61d7668f36f26d6c87d56441945a916e1fc21770ded237dd1a388d85ca`, 1557061 bytes, 175 members
- `project-files/inputs/final-zips/opiq_4klass_inimene_ja_uhiskond_opik_ii_kooliastmele_i_osa_o_v2.zip` — `74493d494f48be6991b7ae49d4dbea2886feff850d542ff6bf359114bb83a40b`, 1279029 bytes, 134 members
- `project-files/inputs/final-zips/opiq_4klass_kasitootuba_opiq_v2.zip` — `0bcaba6a0b152eabd5908355e3f614496f135bee8e75295caf0edc25fb6755bd`, 292424 bytes, 93 members
- `project-files/inputs/final-zips/opiq_4klass_kehalise_kasvatuse_tooraamat_teisele_kooliastmel_v2.zip` — `5c3a324855e791eb07091e8f050a5519f22169d72930f9f7d958652d9c1ce155`, 192176 bytes, 30 members
- `project-files/inputs/final-zips/opiq_4klass_loodusopetus_4_klassile_opiq_v2.zip` — `ad1d3e78e97da9dc4d55220398bef64952320576b85142e71b2653e6b07c24a8`, 3858808 bytes, 364 members
- `project-files/inputs/final-zips/opiq_4klass_matemaatika_4_klassile_opiq_v2.zip` — `b5441563b40d35e74b66b53bba72767ae4829da31d380a4079effd9054d15225`, 7363275 bytes, 744 members
- `project-files/inputs/final-zips/opiq_4klass_muusika_v2.zip` — `56b6182b8ec7413c165df9976dc6d960bfe246ac0c5e6118b089c0f74519cbba`, 1208950 bytes, 188 members
- `project-files/inputs/final-zips/opiq_4klass_tehnologia_v2.zip` — `5522e2bf27ea137943761eaa0bc5dc78ee2e3914f084303860affcf9d56625ae`, 207227 bytes, 31 members

## Source accounting

| Archive | Total | Instructional | Kit details | Duplicate aliases | Malformed/ambiguous | Balanced |
| --- | --- | --- | --- | --- | --- | --- |
| opiq_4klass_4_opiq_v2.zip | 207 | 201 | 3 | 3 | 0 | true |
| opiq_4klass_eesti_keel_4_klassile_opiq_v2.zip | 526 | 515 | 4 | 4 | 0 | true |
| opiq_4klass_english_step_by_step_2_opiq_v2.zip | 168 | 163 | 2 | 2 | 0 | true |
| opiq_4klass_inimene_ja_uhiskond_opik_ii_kooliastmele_i_osa_o_v2.zip | 126 | 118 | 3 | 3 | 0 | true |
| opiq_4klass_kasitootuba_opiq_v2.zip | 87 | 85 | 1 | 1 | 0 | true |
| opiq_4klass_kehalise_kasvatuse_tooraamat_teisele_kooliastmel_v2.zip | 24 | 22 | 1 | 1 | 0 | true |
| opiq_4klass_loodusopetus_4_klassile_opiq_v2.zip | 353 | 338 | 6 | 6 | 0 | true |
| opiq_4klass_matemaatika_4_klassile_opiq_v2.zip | 729 | 705 | 10 | 8 | 0 | true |
| opiq_4klass_muusika_v2.zip | 180 | 172 | 3 | 3 | 0 | true |
| opiq_4klass_tehnologia_v2.zip | 25 | 23 | 1 | 1 | 0 | true |

## Book and kit inventory

| Kit | Captured title | Grade evidence | Candidate subject | Page languages | Programme | Instructional rows | Rows with tasks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 11 | Loodusõpetus 4. klassile – Opiq | verified_grade_4 | science | et | unknown | 53 | 47 |
| 27 | Природо­ведение для 4 класса – Opiq | verified_grade_4 | science | ru | unknown | 55 | 0 |
| 55 | Inimene ja ühiskond. Õpik II kooliastmele, I osa – Opiq | school_stage_ii_not_exact_grade | human_studies_and_society | et | mixed_subject | 31 | 1 |
| 70 | Matemaatika 4. klassile – Opiq | verified_grade_4 | mathematics | en, et | unknown | 131 | 69 |
| 71 | Eesti keel 4. klassile – Opiq | verified_grade_4 | estonian | et | unknown | 134 | 3 |
| 82 | Человек и общество. Учебник для II ступени обучения, Часть I – Opiq | school_stage_ii_not_exact_grade | human_studies_and_society | ru | mixed_subject | 32 | 1 |
| 108 | Loodusõpetus 4. klassile – Opiq | verified_grade_4 | science | et | unknown | 66 | 0 |
| 147 | MATEMAATIKA 4. klassile – Opiq | verified_grade_4 | mathematics | et | unknown | 62 | 0 |
| 150 | TEELE. Eesti keel teise keelena 4. klassile – Opiq | verified_grade_4 | estonian_second_language | et | unknown | 117 | 0 |
| 154 | SINASÕPRUS KEELEGA – Opiq | probable_grade_4 | estonian | et | unknown | 137 | 0 |
| 157 | Математика для 4 класса – Opiq | verified_grade_4 | mathematics | ru | unknown | 123 | 77 |
| 161 | Kehalise kasvatuse tööraamat teisele kooliastmele – Opiq | school_stage_ii_not_exact_grade | physical_education | en, et | physical_education_support | 22 | 0 |
| 174 | Muusikaõpik 4. klassile – Opiq | verified_grade_4 | music | et | unknown | 38 | 24 |
| 200 | Käsitöötuba – Opiq | probable_grade_4 | arts_and_crafts | et | supplementary | 85 | 0 |
| 206 | Muusikamaa lood – Opiq | probable_grade_4 | music | et | unknown | 96 | 69 |
| 228 | Природо­ведение 4 класс – Opiq | verified_grade_4 | science | ru | unknown | 66 | 0 |
| 243 | РУССКИЙ ЯЗЫК 4 класс – Opiq | verified_grade_4 | russian | ru | unknown | 91 | 86 |
| 282 | Matemaatika 4. klassile. I osa. Lihtsustatud õppekava – Opiq | verified_grade_4 | mathematics | en, et | simplified_curriculum | 40 | 0 |
| 287 | Inimeseõpetus 4. klassile. Lihtsustatud õppekava – Opiq | verified_grade_4 | human_studies | et | simplified_curriculum | 55 | 0 |
| 293 | МАТЕМАТИКА 4 класс – Opiq | verified_grade_4 | mathematics | ru | unknown | 63 | 0 |
| 295 | Русский язык для 4 класса – Opiq | verified_grade_4 | russian | ru | unknown | 76 | 54 |
| 304 | Matemaatika 4. klassile. II osa. Lihtsustatud õppekava – Opiq | verified_grade_4 | mathematics | en, et | simplified_curriculum | 31 | 0 |
| 318 | Matemaatika 4. klassile. III osa. Lihtsustatud õppekava – Opiq | verified_grade_4 | mathematics | et | simplified_curriculum | 39 | 0 |
| 328 | Matemaatika 4. klassile. IV osa. Lihtsustatud õppekava – Opiq | verified_grade_4 | mathematics | et | simplified_curriculum | 28 | 0 |
| 332 | English step by step 2 – Opiq | probable_grade_4 | english | en, et | unknown | 69 | 0 |
| 415 | РУССКОЕ СЛОВО. Чтение для 4 клacca – Opiq | verified_grade_4 | russian_reading | ru | unknown | 34 | 0 |
| 451 | High Five! 4 – Opiq | verified_grade_4 | english | en, et, ru | unknown | 94 | 0 |
| 460 | Matemaatika 4. klassile 2023 ÕK – Opiq | verified_grade_4 | mathematics | en, et | unknown | 128 | 77 |
| 476 | Arvjuhitavad seadmed (CNC) – Opiq | probable_grade_4 | technology | et | technology_or_vocational_support | 23 | 0 |
| 480 | Loodusõpetus 4. klassile (2023) – Opiq | verified_grade_4 | science | et | unknown | 49 | 48 |
| 533 | Eesti keel 4. klassile 2024 – Opiq | verified_grade_4 | estonian | et | unknown | 127 | 0 |
| 536 | Природо­ведение для 4 класса (2023) – Opiq | verified_grade_4 | science | ru | unknown | 49 | 48 |
| 552 | Muusikaõpik 4. klassile 2024 – Opiq | verified_grade_4 | music | et | unknown | 38 | 24 |
| 588 | MATEMAATIKA 4. klassile (2025) – Opiq | verified_grade_4 | mathematics | en, et | unknown | 60 | 0 |

## Candidate routes

| Proposed route | Included kits | Records | Decision | Blockers | Excluded-kit notes |
| --- | --- | --- | --- | --- | --- |
| grade-4-arts-and-crafts-support | 200 | 85 | non_core_supplementary_or_support |  | All instructional URLs already belong to grade-2-arts-and-crafts. |
| grade-4-english | 451 | 94 | ready_with_documented_metadata_normalization |  | Kit 332 remains outside this exact-grade route. |
| grade-4-english-probable-level-2 | 332 | 69 | blocked_grade_ambiguous | “Step by step 2” is a level/title, not exact Grade 4 evidence. |  |
| grade-4-estonian | 71, 533 | 261 | ready_with_documented_metadata_normalization |  | Kit 154 needs exact-grade evidence before inclusion. |
| grade-4-estonian-probable-supplement | 154 | 137 | blocked_grade_ambiguous | The captured title does not identify an exact grade. |  |
| grade-4-estonian-second-language | 150 | 117 | ready_with_documented_metadata_normalization |  |  |
| grade-4-human-studies-simplified | 287 | 55 | ready_with_documented_metadata_normalization |  |  |
| grade-4-mathematics | 70, 147, 157, 293, 460, 588 | 567 | ready_with_documented_metadata_normalization |  |  |
| grade-4-mathematics-simplified | 282, 304, 318, 328 | 138 | ready_with_documented_metadata_normalization |  |  |
| grade-4-music | 174, 552 | 76 | ready_with_documented_metadata_normalization |  | Kit 206 remains outside this exact-grade route. |
| grade-4-music-probable | 206 | 96 | blocked_grade_ambiguous | The cover/detail title does not identify an exact grade. |  |
| grade-4-russian | 243, 295 | 167 | ready_with_documented_metadata_normalization |  |  |
| grade-4-russian-reading | 415 | 34 | ready_with_documented_metadata_normalization |  |  |
| grade-4-science | 11, 27, 108, 228, 480, 536 | 338 | ready_with_documented_metadata_normalization |  |  |
| grade-4-technology-support | 476 | 23 | blocked_grade_ambiguous | The CNC title does not identify an exact grade or curriculum allocation. |  |
| school-stage-ii-human-studies-and-society | 55, 82 | 63 | blocked_grade_ambiguous | School stage II does not establish exact Grade 4 ownership. |  |
| school-stage-ii-physical-education-support | 161 | 22 | blocked_grade_ambiguous | School stage II does not establish exact Grade 4 ownership. |  |

## Blocked or ambiguous sources

- **grade-4-english-probable-level-2:** “Step by step 2” is a level/title, not exact Grade 4 evidence.
- **grade-4-estonian-probable-supplement:** The captured title does not identify an exact grade.
- **grade-4-music-probable:** The cover/detail title does not identify an exact grade.
- **grade-4-technology-support:** The CNC title does not identify an exact grade or curriculum allocation.
- **school-stage-ii-human-studies-and-society:** School stage II does not establish exact Grade 4 ownership.
- **school-stage-ii-physical-education-support:** School stage II does not establish exact Grade 4 ownership.

## Cross-grade and cross-subject overlap

- 85 direct instructional URLs overlap existing manifest routes.
- All current overlaps are with `grade-2-arts-and-crafts` and remain owned there.
- Grade 3 overlap count: 0.
- Grade 5 overlap count: 0.
- Cross-archive overlap among the ten supplied ZIPs: 0.
- `eesti keel` and `eesti keel teise keelena` remain separate candidate routes.

## Targeted recapture plan

- **no_recapture_needed:** kits 108, 11, 147, 150, 157, 174, 228, 243, 27, 282, 287, 293, 295, 304, 318, 328, 415, 451, 460, 480, 533, 536, 552, 588, 70, 71. No recapture is required for route ownership at intake stage; documented metadata normalization may still be required.
- **targeted_kit_details_or_cover_metadata:** kits 154, 161, 200, 206, 332, 476, 55, 82. Resolve exact-grade allocation without inferring it from archive filenames or exporter filters.
- **targeted_task_body_recapture:** kits 108, 147, 150, 154, 161, 200, 228, 27, 282, 287, 293, 304, 318, 328, 332, 415, 451, 476, 533, 588. Required only before task-level use; current records do not contain captured task examples.
- **live_catalogue_snapshot_needed:** kits 200. Determine whether the shared Käsitöötuba kit is intentionally supplementary across grades while retaining the existing Grade 2 canonical owner.

## Explicit limitations

- This audit does not create or modify canonical Grade 4 routes.
- This audit does not establish complete current Opiq Grade 4 catalogue coverage.
- This audit does not establish official Grade 4 curriculum completeness.
- School-stage-II or exporter Grade 4 labels are not treated as official exact-grade allocation.
- This audit does not establish pedagogical, legal, commercial, or release readiness.

## Recommended next PR scope

Create canonical Grade 4 indexes only for routes whose blockers are resolved, preserve separate programme and language routes, apply documented metadata normalization, and update `source-manifest.json` in that separate import PR. Targeted recaptures should precede import for ambiguous exact-grade allocations and any task-level use.
