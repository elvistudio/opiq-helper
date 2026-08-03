# Grade 7 science route evidence inventory audit

Status: exact-route book and topic evidence inventoried; curriculum completeness, programme eligibility, and teacher-work-plan mapping remain unverified.

## Exact route and source accounting

This audit covers only the manifest route `grade-7-science`:

- grade: 7;
- subject: `science` / `loodusõpetus`;
- canonical Markdown: `project-files/outputs/opiq_7klass_loodusopetus.md`;
- source archive: `project-files/inputs/final-zips/opiq_7klass_loodusteadused_v2.zip`;
- QA snapshot: `project-files/outputs/opiq_7klass_loodusopetus_qa.json`;
- archive SHA-256: `693b231023bdf9fe4ff083f09b363798476c76619151f65cedf3ae5067f2fc8e`;
- Markdown SHA-256: `4f9be8d91fe5a44711d991c2ac8ac4a3e3910d14a5b75d52c4526cc7d8687373`;
- manifest coverage status: `available_not_curriculum_verified`.

All 325 archive records were reconciled as `325 = 314 + 7 + 4`: 314 unique instructional page URLs are canonical, seven captured Kit Details records are excluded, and four administrative records are excluded. The seven detail captures represent five unique kit URLs. Kit 44 repeats its detail URL in captured records with chapter IDs 1 and 62; kit 336 repeats its detail URL with chapter IDs 99 and 176. Kits 546, 100, and 64 each have one detail capture (chapter IDs 98, 325, and 238 respectively). The four administrative URLs are:

- `https://www.opiq.ee/kit/546/chapter/32440` (`Impressum`);
- `https://www.opiq.ee/kit/44/chapter/2118` (`Impressum`);
- `https://www.opiq.ee/kit/64/chapter/3110` (`Импрессум`);
- `https://www.opiq.ee/kit/64/chapter/3111` (`Авторы использованных рисунков, фотографий, иллюстраций и видео`).

The canonical language accounting is 179 Estonian pages and 135 Russian pages. Every canonical URL occurs exactly once in the Markdown and has a matching instructional archive record with class 7, subject science / loodusõpetus, book, title, and language metadata. No Grade 7 geography, adjacent-grade, external-textbook, Kit Details, administrative, or live-catalogue record is used as topic evidence.

## Five-book inventory

| Book ID | Kit | Captured Kit Details URL | Captured title | Publisher | Language | Source | Canonical | Detail | Administrative |
| --- | ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| `7k_loodusõpetus_avita_2024_est` | 546 | `https://www.opiq.ee/Kit/Details/546` | Loodusõpetus 7. klassile (2024) | Avita | ET | 36 | 34 | 1 | 1 |
| `7k_loodusõpetus_avita_est` | 44 | `https://www.opiq.ee/Kit/Details/44` | Loodusõpetus 7. klassile | `unknown` | ET | 62 | 59 | 2 | 1 |
| `7k_loodusõpetus_koolibri_est` | 100 | `https://www.opiq.ee/Kit/Details/100` | Loodusõpetus 7. klassile | Koolibri | ET | 87 | 86 | 1 | 0 |
| `7k_loodusõpetus_koolibri_rus` | 336 | `https://www.opiq.ee/Kit/Details/336` | Естествознание 7 класс | `unknown` | RU | 78 | 76 | 2 | 0 |
| `7k_loodusõpetus_avita_rus` | 64 | `https://www.opiq.ee/Kit/Details/64` | Природоведение для 7 класса | Avita | RU | 62 | 59 | 1 | 2 |
| **Total** |  |  |  |  |  | **325** | **314** | **7** | **4** |

The committed archive and canonical Markdown leave publisher empty for kits 44 and 336. The inventory therefore records `publisher: unknown`; it does not infer a publisher from a book ID or title style. Publisher metadata for kits 546, 100, and 64 is explicit in committed evidence.

All five books have `programme_type: unknown`, `programme_type_evidence.status: ambiguous`, verification date `2026-08-03`, and `eligible_for_ordinary_course: false`. Neither a Grade 7 title, publisher sequence, page count, nor the absence of a simplified label proves ordinary-programme status. The simplified-material policy prohibits silent default use and requires explicit opt-in; it does not claim that one of these five books is simplified. The ordinary-eligible book count is therefore zero.

## Deduplicated topic registry

The inventory contains 19 stable evidence-backed topic groups in this curated registry order:

1. `natural-sciences-technology-and-information`;
2. `scientific-method-observation-and-experiment`;
3. `measurement-instruments-units-and-reliability`;
4. `length-area-volume-mass-and-plan`;
5. `data-tables-graphs-and-variables`;
6. `models-bodies-and-natural-phenomena`;
7. `atoms-elements-and-periodic-table`;
8. `molecules-cells-ions-and-chemical-bonds`;
9. `states-of-matter-and-phase-changes`;
10. `density-material-properties-and-earth-materials`;
11. `pure-substances-mixtures-solutions-and-separation`;
12. `motion-speed-and-force`;
13. `work-energy-and-transformations`;
14. `temperature-and-heat-transfer`;
15. `chemical-reactions-combustion-and-experiments`;
16. `photosynthesis-respiration-and-carbon-cycle`;
17. `ecosystems-adaptation-growth-and-natural-balance`;
18. `greenhouse-effect-and-climate-change`;
19. `sustainable-consumption-footprint-and-recycling`.

The groups come from exact page titles, headings, tasks, recurring concepts across the five books, and distinct instructional roles. The supplementary teacher-plan backbone was used only as a recall checklist; it did not create a topic or URL. The result deliberately separates measurement, data, models, particle chemistry, mechanics, heat, chemical change, ecosystems, climate, and sustainability where the route supplies independent page-level evidence, while editions and languages do not create duplicate topic IDs.

Across the registry there are 74 selected, 19 alternative, and 19 rejected records: 112 globally unique record IDs and 112 globally unique canonical URLs. Every one of the 19 groups has Russian and Estonian evidence. Russian core explanations are explicit in 18 groups; the remaining group has Russian supporting practice. Estonian core or terminology evidence is explicit in all 19 groups. Page-level experiment evidence is registered for 8 groups, data interpretation for 14, revision for 10, assessment for 12, and explicit oral Estonian support for 0. Measurement and model evidence is present through exact page content, but the common role vocabulary does not label those as independent instructional roles.

The main gaps are preserved rather than filled from another route. Eleven groups lack a registered practical or experiment page, nine lack separate revision evidence, and seven lack separate assessment evidence. Several experiment pages do not supply a shared protocol, reliability rubric, or independently assessable product. Visual particle, atom, molecule, carbon-cycle, and greenhouse models do not by themselves establish a complete learner modeling protocol. No registered page supplies explicit oral-answer, discussion, or presentation evidence in Estonian, so oral Estonian support remains a gap. These constraints remain future teacher-review or bridge needs and do not justify inventing evidence.

Representative direct canonical URLs include:

- natural sciences: `https://www.opiq.ee/kit/64/chapter/3052`;
- scientific method: `https://www.opiq.ee/kit/546/chapter/30109`;
- measurement instruments: `https://www.opiq.ee/kit/64/chapter/3058`;
- graph construction: `https://www.opiq.ee/kit/336/chapter/18954`;
- bodies, substances, phenomena, and models: `https://www.opiq.ee/kit/336/chapter/18903`;
- particles and states of matter: `https://www.opiq.ee/kit/336/chapter/18913`;
- mixture separation: `https://www.opiq.ee/kit/336/chapter/18907`;
- movement: `https://www.opiq.ee/kit/64/chapter/3064`;
- combustion: `https://www.opiq.ee/kit/64/chapter/3082`;
- photosynthesis and respiration: `https://www.opiq.ee/kit/336/chapter/18934`;
- living/nonliving relationships: `https://www.opiq.ee/kit/336/chapter/18945`;
- environmental footprint: `https://www.opiq.ee/kit/336/chapter/18942`.

## Teacher-plan and completeness boundaries

The supplementary extraction at `evaluations/teacher-work-plans/grade-7-science-extraction.json` remains byte-identical with `route_context.mapping_status: deferred`. Its 58 numbered ranges covering lessons 1–70 and one unnumbered row remain unmapped. The source PDF remains supplementary and noncanonical; it was used only to check terminology and future mapping needs.

This PR creates no teacher-work-plan crosswalk, official curriculum map, annual architecture, annual sequence, lesson plan, teacher pack, or independently authored bridge. It makes no official-curriculum completeness claim, no official exact-grade allocation claim, no ordinary-course or default-course eligibility claim, and no live Opiq catalogue completeness claim.
