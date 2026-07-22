# Multilingual topic-synthesis policy

## Purpose

Opiq Helper prepares one coherent school topic from the strongest eligible evidence in one exact grade-and-subject route. The unit of work is the topic, not a textbook. A source page may be Russian or Estonian while the final pupil-facing subject explanation is Russian.

The machine-readable contract is `schemas/topic-synthesis.schema.json`. Annual units use it through `topic_synthesis`; `scripts/lib/topic-synthesis.mjs` performs cross-file checks against the existing manifest, canonical route, topic inventory, book inventory, and source-selection matrix. It does not create a second source loader.

## Exact-route-first workflow

Every synthesis follows this order:

1. determine the exact grade;
2. determine the exact subject, keeping `eesti keel` separate from `eesti keel teise keelena`;
3. determine which source languages must be inspected;
4. determine the requested output language;
5. read `source-manifest.json`;
6. resolve one canonical route;
7. restrict Opiq search to that route's Markdown, archive, QA, and audited curriculum artifacts;
8. inspect every eligible ordinary book represented in the route;
9. select the strongest non-duplicate sources by instructional role;
10. assemble one topic-level result with explicit transformations and limitations.

Neighbouring grades or subjects, unregistered exports, arbitrary Opiq URLs, and cover-only books are not page evidence. Supplementary and teacher-support sources retain those labels. Simplified-curriculum material is never an ordinary default and requires the existing explicit learner-specific opt-in.

## Source language and output language

`source_language` describes the selected evidence. `output_language` describes the resulting teaching contribution. They are independent.

The default pupil-facing explanation is Russian. Russian carries concept formation, causal reasoning, full expected answers, and misconception correction. Estonian remains a planned support layer through terms, short definitions, labels, diagrams, familiar instructions, sentence frames, short tasks, and short oral answers. This is not immersion and does not reduce subject content.

`core_explanation_ru` names the language and role of the final explanation. It does not require the source page to be Russian. An Estonian page may hold that role only when an ET→RU translation or pedagogical adaptation is declared.

## Topic-synthesis structure

The synthesis separates five facts that must not be collapsed:

1. source evidence (`source_kind`, `source_id`, and canonical or registry identity);
2. transformation (`direct`, `translation`, `pedagogical_adaptation`, `synthesis_input`, `supplement`, or `original`);
3. final output language and layer;
4. production readiness (`ready`, `planned`, `needs_review`, or `blocked`);
5. review requirement and status.

A representative planned adaptation is:

```yaml
topic_synthesis:
  output_language: ru
  readiness: needs_review
  strategies: [adapted_from_opiq_et]
  source_contributions:
    - contribution_id: landforms-koolibri-adaptation
      source_kind: opiq_record
      source_id: landforms-map-et-koolibri
      source_language: et
      provenance:
        source_family: opiq
        source_type: ordinary_textbook
        source_reference: landforms-map-et-koolibri
        notes: Canonical source in the exact route.
      selection_rationale: Strongest verified relief and map source.
      transformations:
        - transformation: pedagogical_adaptation
          output_language: ru
          output_layer: main_explanation
          instructional_roles: [core_explanation_ru]
          concepts_supported: [формы рельефа, высота, чтение карты]
          notes: A concise Russian explanation will be adapted and reviewed.
  missing_concepts: []
  review_required: true
  review_status: pending
  notes: Source evidence exists; the authored adaptation still needs review.
```

Every Opiq contribution must be selected for that same unit in the source-selection matrix. Its language, programme type, instructional roles, canonical URL, book, title, grade, and subject remain validated by the existing route infrastructure.

## Explanation strategies

- `direct_opiq_ru` requires a selected Russian Opiq record contributing directly to the Russian main explanation.
- `translated_from_opiq_et` requires a selected Estonian record, an ET→RU translation contribution, the original canonical identity, and translation notes.
- `adapted_from_opiq_et` requires a selected Estonian record and an ET→RU pedagogical adaptation. It need not be a literal translation.
- `synthesized_from_multiple_opiq_sources` requires at least two distinct Opiq contributors to the main explanation. Every contributor remains listed.
- `supplemented_by_external_source` requires a valid entry in the shared external registry and an explicit supplement contribution.
- `author_created_explanation` requires a reason plus named uncovered concepts or an instructional need. It cannot pretend to be Opiq text.

A topic may combine strategies. The absence of `direct_opiq_ru` is not a warning or blocker when a valid adaptation or translation plan exists.

## Orthogonal provenance

Provenance separates source family, source subtype, and transformation instead of creating a combined enum for every permutation.

| Source family | Source types | Transformation examples |
| --- | --- | --- |
| `opiq` | `ordinary_textbook`, `supplementary`, `teacher_support`, `simplified_curriculum` | direct, translation, adaptation, synthesis input |
| `external` | official public, scientific/university, museum/recognized education, reputable educational/environmental | supplement or synthesis input |
| `author_created` | explanation, language bridge, task, assessment | original |

Together, these fields express direct, translated, adapted, multi-source, supplementary, simplified, external, and author-created origins without confusing source ownership with transformation.

## External sources

`external-sources/registry.yaml` is shared project-wide and validated by `schemas/external-source-registry.schema.json`. The production registry is intentionally empty in this change.

A real entry needs a stable ID, title, organization, HTTPS URL, category, language, verification date, instructional purpose, related topic or unit, notes, and provenance. It cannot masquerade as an Opiq record or official curriculum evidence. Official curriculum evidence continues to use the curriculum-map model and primary official sources.

External evidence is optional. It supplements a route audit; it never replaces inspection of every eligible book in the exact route.

## Copyright and storage

Do not store complete textbook chapters, long verbatim passages, full chapter translations, or large reconstructed copyrighted sections. Teaching artifacts normally contain concise Russian explanations, pedagogical summaries, adapted definitions, author-created examples and tasks, direct canonical URLs, and short attributed excerpts only where necessary. Translation and adaptation metadata always points back to the original source.

## Completed-topic contract

A completed topic normally provides:

- Russian and Estonian titles;
- one coherent Russian main explanation;
- key Estonian terms, short definitions, model sentences, and familiar instructions;
- direct canonical Opiq URLs;
- examples and a typical task;
- practical, visual, map, experiment, or data work where relevant;
- teacher questions;
- full expected pupil answers in Russian and short ready oral answers in Estonian;
- explicit supplementary or external material;
- provenance for translation, adaptation, synthesis, and author-created elements;
- curriculum references and known limitations.

External evidence is not mandatory. `readiness: ready` is rejected while required review is pending, required contributions are absent, concepts remain missing, or the unit is not a validated production unit.

## Grade-5 production pilot

All ten annual units use the reusable model:

| Unit | Strategies | Readiness |
| --- | --- | --- |
| Landforms and map | Estonian pedagogical adaptation | needs review |
| Rivers and lakes | direct Russian + multi-Opiq synthesis | planned |
| Water properties and states | direct Russian + multi-Opiq synthesis | ready |
| Water use, protection, and cycle | direct Russian + Estonian adaptation + multi-Opiq synthesis + bounded author safety bridge | needs review |
| Freshwater ecosystems | direct Russian + multi-Opiq synthesis | planned |
| Air | direct Russian + multi-Opiq synthesis | planned |
| Weather and climate | direct Russian + multi-Opiq synthesis | planned |
| Baltic Sea | direct Russian + multi-Opiq synthesis | planned |
| Settlements | Estonian adaptation + bounded author local-environment bridge | needs review |
| Bogs | Estonian adaptation + bounded author use/protection bridge | needs review |

Only the existing four-lesson water unit is `ready`. The other units remain planned or pending review; no placeholder lessons are created. No production external source is required.

## Validation

Run:

```sh
npm run test:synthesis
npm run test:plans
npm run check:plans
```

Production currently reports 15 deterministic plan warnings: five honest within-unit water vocabulary gaps, one insufficient lesson-budget scenario, four pending synthesis reviews, and five planned syntheses not yet authored. Missing a direct Russian Opiq page is not itself a warning.
