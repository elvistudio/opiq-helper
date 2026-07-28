# 2026/27 Estonian curriculum and home-learning compliance baseline

## Purpose

This baseline pins the official legal and curriculum versions that apply continuously from
**2026-09-01 through 2027-08-31**. It supports downstream Grade 2, Grade 4, Foundation, family and
commercial-course work without treating Opiq or publisher sequence as national law.

It is an information and repository-validation layer, not individual legal advice, a school
decision or proof of curriculum, pedagogical or commercial effectiveness.

## Architecture

The repository keeps two validation paths:

1. `official_curriculum_map` remains route-linked. Every existing map still needs exactly one
   matching `source-manifest.json` route.
2. General national law, school-stage frameworks and parent-requested home-learning requirements
   use separate strict artifacts under `external-sources/official/` and `compliance/`. They do not
   receive a synthetic Grade/Subject route.

The authoritative inputs are:

- `external-sources/official/estonia/2026-27/source-registry.yaml`;
- `compliance/estonia/2026-27/curriculum-framework.yaml`;
- `compliance/estonia/2026-27/home-learning-baseline.yaml`;
- `compliance/estonia/2026-27/commercial-release-checklist.yaml`;
- `compliance/estonia/2026-27/change-note.yaml`.

The generator reads those inputs and writes only the outcome index, requirement index, Russian
family brief and Markdown change note. `--check` compares exact bytes.

## Official version matrix

| Source | 2025/26 boundary | 2026/27 version | Result |
|---|---|---|---|
| PGS | — | [RT I, 20.06.2026, 32](https://www.riigiteataja.ee/akt/120062026032), 2026-09-01–2026-12-31; [RT I, 18.03.2026, 16](https://www.riigiteataja.ee/akt/118032026016), from 2027-01-01 | § 23 is substantively unchanged; the two records cover the full school year |
| PRÕK, regulation 1 | [RT I, 23.12.2025, 6](https://www.riigiteataja.ee/akt/123122025006), ends 2026-08-31 | [RT I, 23.12.2025, 7](https://www.riigiteataja.ee/akt/123122025007), effective 2026-09-01 | future version selected |
| PLRÕK, regulation 182 | [RT I, 23.12.2025, 4](https://www.riigiteataja.ee/akt/123122025004), ends 2026-08-31 | [RT I, 23.12.2025, 5](https://www.riigiteataja.ee/akt/123122025005), effective 2026-09-01 | future version selected |
| Home/hospital learning, regulation 6 | — | [RT I, 16.09.2025, 13](https://www.riigiteataja.ee/akt/116092025013), effective 2025-09-19 | applicable throughout target year |
| Mandatory school records, regulation 52 | — | [RT I, 11.07.2025, 11](https://www.riigiteataja.ee/akt/111072025011), effective 2025-09-01 | applicable throughout target year |

The registry records consolidated IDs, timelines, public XML endpoints, effective intervals,
retrieval dates and SHA-256 identities. Compact repository excerpts contain only the clauses
needed for the declared baseline; all 14 PRÕK and all three PLRÕK official appendix attachments
have separate full-byte identities in the registry. The 2027 PGS XML identity is
`79bd1acf54c3a652dbad2618be4c98c5f52690a688ec394e5511d785978e8060`.

The [original amendment regulation 44](https://www.riigiteataja.ee/akt/125062025001) proves that
the PRÕK/PLRÕK class-by-class and career-service clauses specifically enter into force on
2026-09-01. The later [regulation 104](https://www.riigiteataja.ee/akt/123122025001) explains the
December consolidated versions used for the final target-date text.

## Effective-date rules

Adoption, publication, entry into force, consolidated-version validity, school-year applicability
and verification date are separate fields. A verified claim marked applicable for all of 2026/27
must resolve to one source or a consecutive source-evidence chain whose union covers every day
from 2026-09-01 through 2027-08-31.

The validator rejects:

- the PRÕK or PLRÕK wording ending on 2026-08-31;
- a future source used before it enters into force;
- a one-day gap, source interval overclaim or contradictory multi-version wording;
- an `applicable` source record whose own interval covers only part of the school year;
- an appendix that does not match its parent consolidated act;
- an official claim linked to an unknown, unverified or interval-incompatible source.

Source records distinguish four evidence statements:

- `schema_validated_hash` means the committed identity has a schema-valid SHA-256 value;
- `locally_archived_hash_verified` means the committed excerpt bytes match their recorded hash;
- `manual_live_xml_hash_verified` means a human-triggered live XML download was compared with the
  committed identity;
- `ci_live_xml_hash_verified` is empty because ordinary CI is offline and does not download legal
  XML.

`npm run verify-live:2026-27-official-sources` performs the explicit networked comparison for the
records listed in `manual_live_xml_hash_verified`. It is not run by ordinary CI and does not turn
the empty CI classification into a positive claim.

## Curriculum scope

National school-stage outcomes remain national school-stage outcomes:

- stage I terminates at Grade 3;
- stage II terminates at Grade 6;
- `exact_grade_claimed` is `false`.

Current ordinary Grade 2 and Grade 4 routes may reference the relevant stage outcomes as downstream
or school-allocation evidence. That does not create a national exact Grade 2 or Grade 4 mandate.
Only PLRÕK appendix 1 outcomes explicitly written for Grade 4 use `exact_grade`.

The framework also keeps:

- Estonian and Estonian as a second language separate;
- Russian language and the repository's Russian-reading instructional route separate;
- ordinary and simplified curricula separate;
- the mixed Grade 4 human/society route mapped to `inimeseõpetus` and `ühiskonnaõpetus`, not to an
  invented official subject.

Russian translations are Opiq Helper adaptations unless a record explicitly says
`official_translation`; Estonian wording and official references remain authoritative.

## Home-learning model

The machine baseline distinguishes the obligation holder and legal level for every requirement.
It verifies, among other points:

- a parent may request home learning, but the director decides from the child's best interests and
  the possibility of reaching national outcomes;
- the parent organizes and finances the out-of-school part and is responsible for organizing
  learning toward the outcomes;
- the school supplies necessary learning literature and needs-based support services;
- the teaching person and school jointly prepare an individual curriculum based on the school
  curriculum;
- the plan identifies responsible teachers, control frequency and assessment arrangements;
- the school checks outcome attainment **at least once a month**;
- summary grades are entered in official school records;
- substantial unmet outcomes, inability to verify outcomes, best-interest concerns or another
  barrier trigger interruption, followed by return no later than the next school day.

Portfolio, daily log, weekly report, timesheet and a specific digital platform are not silently
promoted to national requirements. They are classified as individual-plan, school-specific,
recommended, commercial or not verified.

See the generated [Russian family brief](compliance/2026-27-home-learning-family-brief-ru.md).

## Changes from 2025/26

The [generated change note](compliance/2026-27-curriculum-change-note.md) records the version
boundaries, class-by-class school-curriculum presentation and career-support changes. A normalized
§ 23 comparison records identical semantic SHA-256 values for the two PGS versions, so the stable
home-learning requirement IDs remain valid with two source-evidence intervals. The note also
records that all 14 PRÕK appendix identities and all three PLRÕK appendix identities are
byte-identical across the checked expiring and future consolidated XML versions. The
home-learning monthly-control rule already entered into force in September 2025.

## Completeness and release boundary

The current baseline is `partial` and `declared_complete: false`.

It has version-pinned acts, complete appendix inventories, stable downstream IDs and classified
home-learning requirements. It does not enumerate every outcome in every appendix, replace a
product-specific curriculum map, or cover amendments published after 2026-07-28. A final legal
refresh is due by 2026-08-28, so the commercial release checklist remains `blocked`.

Green tests prove the declared structural invariants only. They do not prove regulatory
completeness outside the checked scope or identical implementation by every school.

## Commands

```sh
npm run test:official-source-registry
npm run check:official-source-registry
npm run test:2026-27-compliance
npm run generate:2026-27-compliance
npm run check:2026-27-compliance
npm run verify-live:2026-27-official-sources
npm run test:curriculum
npm run check:curriculum
```

The live verification command is optional and networked; the other commands are deterministic and
offline. Source snapshots are dated evidence. A later legal refresh must create a new dated record
or documented supersession rather than silently rewriting the old observation.
