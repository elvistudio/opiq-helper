# Pedagogical knowledge

This directory stores normalized, machine-validated pedagogical knowledge. It is
independent from Opiq source routing and from production lesson artifacts.

The initial catalog contains:

- two privately supplied Estonian methodological references;
- 15 pedagogical principles;
- 30 classroom and homeschool-adaptable activities;
- four flexible pedagogical patterns.

## Structure

- `references/references.yaml` records source identity, access, copyright
  boundaries, and allowed use.
- `principles/*.yaml` describes reusable principles and distinguishes sourced
  guidance from project interpretation.
- `activities/activity-catalog.yaml` describes applicability, language demand,
  duration, safety, misuse risks, homeschool roles, and provenance.
- `patterns/*.yaml` combines principles and activity options into flexible
  recommendations. Patterns are not lesson templates or production `lesson_dna`.
- `schemas/*.schema.json` contains strict JSON Schemas shared by the validator.

Every source-supported claim names a registered reference. Project-authored
adaptation uses `claim_origin: project_authored_design` and must not be
attributed to a reference. Confidence records express confidence in the stated
provenance and applicability, not a guaranteed learning effect.

## Copyright boundary

The supplied source documents are not committed. Their redistribution rights
have not been verified, so their reference records require:

```yaml
original_file_committed: false
redistribution_status: not_verified
quotation_policy: summaries_only
```

The repository contains original concise summaries, common method names, and
project-authored guidance. It does not reproduce source tables, images,
examples, or long passages.

## Validation

```sh
npm run test:pedagogy
npm run check:pedagogy
```

The check validates schemas, strict YAML, IDs, links, age and duration ranges,
language and homeschool metadata, safety roles, copyright rules, provenance,
confidence, and deterministic ordering. Structural validity does not prove
pedagogical effectiveness; application still requires teacher review.

See [`docs/pedagogical-knowledge-base.md`](../../docs/pedagogical-knowledge-base.md)
for the data model, contribution workflow, homeschool boundaries, and examples.
