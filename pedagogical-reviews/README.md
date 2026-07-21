# Pedagogical review evidence

This directory defines the evidence workflow for independently reviewing and trialling teacher packs. A template is an empty instrument, not proof that a review or trial happened. Completed records belong in a pack-specific `records/` directory and become effective only after their paths are registered in the teacher-pack index.

The sequence is:

1. merge the authored teacher pack;
2. freeze the reviewed pack-content commit SHA;
3. complete an independent teacher review;
4. record and resolve required changes;
5. run a limited classroom trial;
6. analyse only anonymised, aggregated observations;
7. register the evidence records;
8. update readiness in a separate pull request.

## Privacy boundary

Never commit children's names, dates of birth, personal identifiers, addresses, parent contacts, photographs, medical or diagnostic information, identifiable individual grades, or free text that can identify a pupil. Store reviewer identity outside the repository; the record contains only a role and, if needed, a non-identifying external reference.

Allowed: “7 из 12 учеников выполнили инструкцию без повторного объяснения.”

Forbidden: “Иван Иванов не смог выполнить инструкцию.”

The validator checks mandatory privacy declarations and rejects unexpected personal-data fields. It cannot guarantee that names or indirect identifiers are absent from unrestricted prose. A human must check every free-text field before commit.
