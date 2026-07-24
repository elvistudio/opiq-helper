# Lesson pedagogy selection engine

The provisional lesson pedagogy selection engine selects classroom activity patterns and emits lesson DNA for review before any production lesson integration. Selection rules and taxonomy ratings remain provisional until teacher validation is complete.

## Estonian support language model

Version 1.0 has exactly two valid Estonian-support states. The `estonian_support` object is required in requests in both states.

### Estonian support enabled

`enabled: true` means bounded Estonian A1–A2 support. It requires `language: et`, `learner_level: A1-A2`, and `subject_explanation_language: ru`. Allowed Estonian roles are terminology, labels, familiar instructions, sentence frames, short oral responses, and short written responses. Sentence frames, word banks, and Estonian language assessment may be requested independently.

Subject assessment and Estonian language assessment are separate: Russian can carry complex grade-5 science explanation and subject evidence, while Estonian assessment targets only the requested language-support roles.

### Estonian support disabled

`enabled: false` fully disables the Estonian pedagogical layer. The disabled object must use `learner_level: not_applicable`, `allowed_roles: []`, `sentence_frames_required: false`, `word_bank_required: false`, and `assessment_requested: false`, while preserving `language: et` and `subject_explanation_language: ru` for a stable schema shape.

When support is disabled, lesson DNA is Russian-primary: each phase has `primary_language: ru` and `estonian_roles: []`. The engine suppresses Estonian sentence-frame scaffolds, Estonian word-bank scaffolds, Estonian language-assessment phases, and `estonian_language_assessment.enabled` is false with empty targets. Subject explanation can remain fully Russian.

Activity-level `estonian_a1_a2_compatibility` does not affect filtering or score when support is disabled. It is active only when Estonian support is enabled. The total productive-language demand limit remains a general constraint in both language modes.

## Known limits

`per_language_productive_demand_not_modelled` is emitted only when Estonian support is active, because the practical limitation is relevant when two language layers are being balanced. Weights and thresholds are provisional, and teacher validation is pending.
