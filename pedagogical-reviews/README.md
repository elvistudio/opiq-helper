# Pedagogical review evidence

This directory defines the evidence workflow for independently reviewing and trialling teacher packs. A template is an empty instrument, not proof that a review or trial happened. Completed records belong in a pack-specific `records/` directory and become effective only after their paths are registered in the teacher-pack index.

The sequence is:

1. merge the authored teacher pack;
2. prepare an offline JSON intake containing the current fingerprint and
   pedagogical snapshot;
3. complete an independent classroom and/or homeschool teacher review;
4. record and resolve required changes;
5. run the relevant classroom trial and/or separate home trial;
6. analyse only privacy-safe aggregated or bounded categorical observations;
7. normalize JSON to canonical YAML;
8. explicitly register evidence and derive readiness.

`evidence_identity.commit_sha` shows where the reviewed content existed in Git
but is not a readiness gate. The complete content fingerprint and pedagogical
snapshot must match current authoritative artifacts. Rebase, squash, or
unrelated commits therefore leave unchanged evidence effective. Changes to
reviewable content, selected pedagogy, lesson DNA, delivery instructions,
safety, or relevant catalogues/rules make evidence stale. Evidence records,
their links in `materials-index.yaml`, and derived readiness reports are
excluded so evidence registration cannot invalidate itself.

The complete workflow and commands are documented in
[`docs/pedagogical-review-and-trial-workflow.md`](../docs/pedagogical-review-and-trial-workflow.md).

## Privacy boundary

Never commit children's names, dates of birth, personal identifiers, addresses, parent contacts, photographs, medical or diagnostic information, identifiable individual grades, or free text that can identify a pupil. Store reviewer identity outside the repository; the record contains only a role and, if needed, a non-identifying external reference.

Allowed: “7 из 12 учеников выполнили инструкцию без повторного объяснения.”

Forbidden: “Иван Иванов не смог выполнить инструкцию.”

The validator checks mandatory privacy declarations and conservatively detects
common email, phone, identity-code, address, private-media, and recording
references. It cannot guarantee that names or indirect identifiers are absent
from unrestricted prose. A human must check every free-text field before
registration.
