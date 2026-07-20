# Grade 5 bilingual science annual architecture

## Status and boundaries

The production artifact `annual-courses/grade-5-science/annual-architecture.yaml` is the complete planning skeleton for a curated grade-5 `loodusõpetus` course. It sequences every one of the ten verified topic-inventory groups, selects sources by instructional role, reconciles lesson-budget scenarios, and plans language, practical work, revision, assessment, and later-unit vocabulary reuse.

“Architecture complete” does not mean “annual course fully authored.” Only `grade-5-water-four-lesson-plan` has a validated thematic plan and four detailed 45-minute lessons. The other nine units remain architecture until later issue #18 pull requests add and validate their thematic and lesson artifacts. The course therefore keeps `declared_complete: false`.

The model is `russian_primary_estonian_supported`: Russian carries concept formation, scientific reasoning, misconception repair, and full subject answers. Estonian at the A1–A2 planning level supports terminology, diagrams and labels, familiar instructions, short frames, and one- or two-sentence oral output. The architecture does not prescribe immersion and does not reduce science objectives because language output is shorter.

## Recommended annual sequence

The ten existing topic groups are preserved once. Overlapping publisher pages are selected or rejected by distinct instructional role; no textbook is traversed in full.

| Order | Unit | Lessons | Placement logic | Implementation |
| ---: | --- | ---: | --- | --- |
| 1 | Формы рельефа и карта / Pinnavormid ja kaart | 5 | Establish map and relief language used by later spatial units | Russian bridge and teacher review needed |
| 2 | Реки и озёра Эстонии / Eesti jõed ja järved | 6 | Apply map literacy before treating water as a substance | Architecture only |
| 3 | Вода как вещество и состояния воды / Vesi kui aine ja vee olekud | 4 | Establish properties and state changes before cycles and ecosystems | Validated production unit |
| 4 | Использование, охрана и круговорот воды / Vee kasutamine, kaitse ja veeringe | 6 | Extend water concepts to systems and human action | Architecture only; Russian bridge needed |
| 5 | Пресноводные сообщества / Magevee elukooslused | 6 | Build ecosystem relations on known water bodies and conditions | Architecture only |
| 6 | Воздух, его свойства и охрана / Õhu omadused ja kaitse | 5 | Establish atmosphere concepts before weather | Architecture only |
| 7 | Погода и климат / Ilm ja kliima | 6 | Use air properties in repeated measurement and comparison | Architecture only |
| 8 | Балтийское море / Läänemeri | 6 | Combine map, water, ecosystem, weather, and protection concepts | Architecture only |
| 9 | Поселения и среда жизни / Asulad ja elukeskkond | 5 | Apply water, air, map, noise, and waste criteria locally | Full Russian explanation and review needed |
| 10 | Болото как экосистема / Soo kui elukooslus | 5 | Conclude with water regime, food webs, maps, and protection | Full Russian explanation and review needed |

The unit estimates total 54 lessons: 30 core, 10 practical, 4 revision, 6 subject-assessment, and 4 separate Estonian-language-assessment lessons. They are architectural estimates until each thematic plan validates its detailed duration.

No exact grade-5 timetable is inferred. The artifact records two assumptions:

- 35 teaching weeks at one lesson per week: 35 available lessons and an explicit 19-lesson shortfall;
- 35 teaching weeks at two lessons per week: 70 available lessons, 54 planned lessons, 8 reserve lessons, and 8 lessons for school-specific events or losses.

The second is the recommended planning baseline, not an official or school-specific allocation.

## Source selection and deduplication

`source-selection-matrix.yaml` resolves 32 unique selected pages through the canonical `grade-5-science` route. Four audited ordinary books with page records are eligible. The HARNO simplified-curriculum book is explicitly excluded as an ordinary default, and the Russian Koolibri book is excluded because the route contains only cover metadata and no page-level evidence.

Each unit records best available choices for Russian explanation, Estonian core support, visual or diagram, practical work, Russian and Estonian practice, revision, assessment, and optional extension. A selected page may fill several real roles. Eleven rejected candidates remain auditable with canonical URLs and reasons such as duplicate explanation or simplified curriculum. Repeated pages are not retained merely to make every publisher appear in a unit.

All selected and rejected URLs are short references to canonical Opiq pages. The repository does not reproduce long textbook procedures or passages.

## Official evidence and Russian coverage

The official map registers 14 relevant outcomes from the current Riigi Teataja Appendix 4. Their original Estonian wording and Russian translations are preserved. Every outcome is end-of-school-stage-II evidence, not an official exact-grade-5 allocation, and every annual mapping remains `partial`. The architecture does not claim all 36 stage outcomes or complete official coverage.

Russian explanation status is explicit per unit:

- direct ordinary Russian Opiq evidence: rivers and lakes, water properties and states, freshwater ecosystems, air, weather and climate, Baltic Sea;
- partial Russian Opiq evidence plus an author bridge: water use, protection, and cycle;
- author bridge required: landforms and map reading;
- full author-created Russian explanation required: settlements and bogs.

The three units without a direct Russian page produce actionable warnings and pending teacher-review decisions. Estonian-only pages are never counted as Russian explanation.

## Estonian progression and recycling

Every mandatory unit specifies new and recycled terminology, instruction verbs, sentence frames, language functions, receptive output, supported output, independent output, a short oral-answer target, scaffold level, and a cognitive-load note. The annual progression moves from recognition and naming to labelling and classifying, describing properties, sequencing, comparing, simple cause/result, and short evidence-based conclusions. Russian continues to carry complex explanations throughout.

Vocabulary reuse has three distinct scales:

1. `reuse_stage_refs` means later reuse inside the same lesson;
2. `recycled_in_lessons` means reuse in a strictly later lesson of the same thematic unit;
3. `planned_vocabulary_recycling_intervals` means reuse in a strictly later annual unit.

The linked language-progression artifact contains 12 deterministic later-unit intervals. The water-unit terms `lahus`, `jäätumine`, `aurustumine`, and `olekumuutus` return in the water-use-and-cycle unit; `termomeeter` returns in the weather unit. Each interval records distance, context, expected pupil output, and rationale. These annual intervals do not erase the water thematic plan’s honest warnings that the terms are not recycled in a later lesson inside its four-lesson boundary.

## Practical work, revision, and assessment

The architecture plans one concise, safe practical activity per unit: 10 activities across observation, measurement, classification, models, experiments, fieldwork, and data use. Equipment, safety, teacher-controlled steps, time, skill, Estonian language function, assessment role, provenance, and implementation status are explicit. Outside the water unit these entries are designs, not ready-to-print procedures.

Four cumulative revision points cover all ten units. Ten subject-assessment points and six Estonian-language-assessment points use separate calendars and domains. A weak Estonian answer does not automatically lower the subject result; correctly repeating a term without demonstrating the concept does not establish subject mastery. Full papers and rubrics remain deferred.

## Validation and intentional warnings

`npm run check:plans` validates the annual schema, all four linked components, all cross-file references, source ownership, programme type, page metadata, role and provenance, order, prerequisites, estimates, scenarios, Russian and Estonian coverage, later-unit recycling, calendars, school-stage semantics, and completeness declarations.

The production repository intentionally emits 12 warnings:

- 5 water thematic terms without a later-lesson reuse inside that short unit;
- 1 budget scenario that cannot fit the architecture;
- 3 units without direct Russian Opiq explanation;
- 3 corresponding pending teacher-review decisions.

These are visible planning facts, not validation failures. Detailed tests mutate the valid production data to prove that unknown topics or pages, wrong routes or books, cover-only or simplified defaults, broken order, forward prerequisites, backward recycling, missing roles or provenance, unreconciled budgets, cross-domain assessment, and false completeness fail deterministically.

## Implementation roadmap

`implementation-roadmap.yaml` keeps the existing water unit first, then recommends:

1. neighbouring water units: water use and cycle, rivers and lakes, freshwater ecosystems;
2. units with strong bilingual page evidence: air, weather and climate, Baltic Sea;
3. teacher-reviewed Russian gaps: landforms and map, settlements, bogs.

Every future unit PR should create its declared thematic-plan path, preserve the annual unit ID and lesson estimate unless evidence justifies a reviewed change, use only the matrix’s canonical candidates, keep subject and language assessment separate, and update readiness and implementation status. Placeholder lesson files are not part of the architecture phase.
