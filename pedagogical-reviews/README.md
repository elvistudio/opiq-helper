# Pedagogical review evidence

This directory defines the evidence workflow for independently reviewing and trialling teacher packs. A template is an empty instrument, not proof that a review or trial happened. Completed records belong in a pack-specific `records/` directory and become effective only after their paths are registered in the teacher-pack index.

The sequence is:

1. merge the authored teacher pack;
2. compute the reviewed pack's deterministic content fingerprint and retain the commit SHA as provenance;
3. complete an independent teacher review;
4. record and resolve required changes;
5. run a limited classroom trial;
6. analyse only anonymised, aggregated observations;
7. register the evidence records;
8. update readiness in a separate pull request.

`reviewed_version.commit_sha` shows where the reviewed content existed in Git but is not a readiness gate. `reviewed_version.content_fingerprint` must match the current reviewable bytes and file count. Rebase, squash, or unrelated commits therefore leave unchanged evidence effective. Any scoped YAML or teacher-pack artifact change makes it stale. Evidence records and `materials-index.yaml` are excluded so evidence registration cannot invalidate itself. The exact scope and framing are documented in [`docs/teacher-pack-content-fingerprint.md`](../docs/teacher-pack-content-fingerprint.md).

## Privacy boundary

Never commit children's names, dates of birth, personal identifiers, addresses, parent contacts, photographs, medical or diagnostic information, identifiable individual grades, or free text that can identify a pupil. Store reviewer identity outside the repository; the record contains only a role and, if needed, a non-identifying external reference.

Allowed: “7 из 12 учеников выполнили инструкцию без повторного объяснения.”

Forbidden: “Иван Иванов не смог выполнить инструкцию.”

The validator checks mandatory privacy declarations and rejects unexpected personal-data fields. It cannot guarantee that names or indirect identifiers are absent from unrestricted prose. A human must check every free-text field before commit.
