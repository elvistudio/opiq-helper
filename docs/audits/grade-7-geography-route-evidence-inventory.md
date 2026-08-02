# Grade 7 geography route evidence inventory audit

Status: exact-route book and topic evidence inventoried; curriculum completeness, programme eligibility, and teacher-work-plan mapping remain unverified.

## Exact route and source accounting

This audit covers only the manifest route `grade-7-geography`:

- grade: 7;
- subject: `geography` / `geograafia`;
- canonical Markdown: `project-files/outputs/opiq_7klass_geograafia.md`;
- source archive: `project-files/inputs/final-zips/opiq_7klass_sissejuhatus_geograafiasse_v2.zip`;
- QA snapshot: `project-files/outputs/opiq_7klass_geograafia_qa.json`;
- archive SHA-256: `21d7d516cae1bf756827c6feb1a64a71b0ca85f0deabb6aac6a4732c363acd03`;
- Markdown SHA-256: `f25b994c32493388ef1f9179e798e0173e9326f13669db9d5a4aa45d3d0d868d`;
- manifest coverage status: `available_not_curriculum_verified`.

All 186 source records were reconciled. The canonical route contains 178 unique instructional chapter URLs. Seven captured Kit Details records are excluded: five unique kit URLs plus duplicate detail captures for kits 96 and 301. One additional administrative record, the Russian `Импрессум` page at `https://www.opiq.ee/kit/19/chapter/903`, is excluded. Thus `186 = 178 + 7 + 1`.

The canonical language accounting is 102 Estonian pages and 76 Russian pages. Every canonical record has class 7, subject geography / geograafia, an exact route-owned URL, and matching book, title, and language metadata. No Grade 7 science, Grade 6 science, adjacent-grade, external-textbook, or live-catalogue page is used.

## Five-book inventory

| Book ID | Kit | Captured title | Publisher | Language | Source | Canonical |
| --- | ---: | --- | --- | --- | ---: | ---: |
| `7k__geograafia_avita_est` | 543 | Geograafia 7. klassile | Avita | ET | 29 | 28 |
| `7k__geograafia_koolibri_est` | 96 | Geograafia 7. klassile | `unknown` | ET | 38 | 36 |
| `7k__geograafia_loodus_avita_est` | 2 | Loodusgeograafia 7. klassile | Avita | ET | 39 | 38 |
| `7k__geograafia_koolibri_rus` | 301 | География 7 класс | Koolibri | RU | 39 | 37 |
| `7k__geograafia_avita_rus` | 19 | География для 7 класса | Avita | RU | 41 | 39 |
| **Total** |  |  |  |  | **186** | **178** |

The committed archive and canonical Markdown leave the publisher empty for `7k__geograafia_koolibri_est`. The inventory therefore records `publisher: unknown`; it does not infer Koolibri from the book ID or title style. Publisher metadata for the other four books is explicit in committed evidence.

All five books have `programme_type: unknown`, `programme_type_evidence.status: ambiguous`, verification date `2026-08-02`, and `eligible_for_ordinary_course: false`. A Grade 7 title is publisher-sequence evidence only. It does not establish ordinary-programme status, simplified-programme status, official exact-grade allocation, or default-course eligibility. The explicit simplified-material policy remains a prohibition on silent default use and does not claim that any of these five books is simplified.

## Deduplicated topic registry

The inventory contains exactly 15 stable topic groups in curated evidence-registry order:

1. `geography-introduction-and-research-methods`;
2. `earth-shape-size-continents-and-oceans`;
3. `map-types-atlases-legends-and-generalization`;
4. `scale-distance-directions-and-orientation`;
5. `geographic-coordinates`;
6. `digital-maps-gis-and-satellite-imagery`;
7. `time-zones-and-date-line`;
8. `earth-interior-and-plate-tectonics`;
9. `earthquakes-volcanoes-and-tsunamis`;
10. `rocks-sediments-and-rock-cycle`;
11. `relief-landforms-and-elevation-mapping`;
12. `mountains-plains-and-ocean-floor-relief`;
13. `landform-change-weathering-erosion-and-human-impact`;
14. `countries-peoples-and-cultural-diversity`;
15. `population-distribution-change-migration-and-urbanization`.

Every group has direct Russian explanation evidence and direct Estonian subject-support evidence. Across the registry there are 64 selected, 15 alternative, and 15 rejected records: 94 globally unique record IDs and 94 globally unique canonical URLs. Selected records divide Russian explanation, Estonian terminology or visual support, map/data practice, and distinct revision or assessment roles. Overlapping editions are alternatives or explicit rejections rather than duplicate mandatory core explanations.

Role coverage by topic group is:

- Russian core explanation: 15 of 15;
- Estonian core or terminology support: 15 of 15;
- map skill: 11 of 15;
- digital-map evidence: 2 of 15;
- data interpretation: 12 of 15;
- explicit fieldwork: 1 of 15;
- revision evidence: 7 of 15;
- assessment evidence: 7 of 15.

The main gaps are bounded rather than filled with another route. Only the scale/direction/orientation group has page-level fieldwork evidence. Several conceptual groups lack standalone practical protocols. Eight groups lack a separately identified revision or assessment page. GIS pages do not provide a separately assessable learner-created GIS product. Tsunami evidence is embedded within broader hazard pages rather than supplied as a standalone practical. Local landform-impact and population field studies remain future teacher-review needs.

Representative direct canonical URLs include:

- geography and research methods: `https://www.opiq.ee/kit/301/chapter/16602`;
- digital maps and GIS: `https://www.opiq.ee/kit/543/chapter/30188`;
- geographic coordinates: `https://www.opiq.ee/kit/301/chapter/16609`;
- plate tectonics: `https://www.opiq.ee/kit/301/chapter/16622`;
- earthquakes: `https://www.opiq.ee/kit/543/chapter/30262`;
- rock formation: `https://www.opiq.ee/kit/301/chapter/16625`;
- elevation mapping: `https://www.opiq.ee/kit/301/chapter/16629`;
- human impact on relief: `https://www.opiq.ee/kit/543/chapter/30448`;
- migration within population change: `https://www.opiq.ee/kit/301/chapter/16614`.

## Teacher-plan and completeness boundaries

The supplementary extraction at `evaluations/teacher-work-plans/grade-7-geography-extraction.json` remains `route_context.mapping_status: deferred`. Its 35 separate records and four blocks (`kaardiopetus`, `geoloogia`, `pinnamood`, and `rahvastik`) were used only to check that the topic registry will be useful for a future mapping phase. They do not create canonical coverage, topic URLs, or an official sequence.

This PR creates no teacher-work-plan crosswalk, official curriculum map, annual architecture, annual sequence, lesson plan, teacher pack, or independently authored bridge. It makes no official-curriculum completeness claim, no official exact-grade allocation claim, no ordinary-course eligibility claim, and no live Opiq catalogue completeness claim.
