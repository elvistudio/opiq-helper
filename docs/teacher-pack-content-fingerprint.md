# Teacher-pack content fingerprint 1.0

The content fingerprint identifies the exact reviewable bytes of a teacher
pack. It is one part of the shared evidence identity for teacher review,
classroom trial, and home trial.

Git commit SHA and content fingerprint have different purposes:

- `evidence_identity.commit_sha` is provenance: it identifies where the reviewed version could be found in Git.
- `evidence_identity.content_fingerprint` proves whether current reviewable bytes and file count match.
- `evidence_identity.pedagogical_snapshot` binds evidence to catalogue, rules,
  engines, unit identity, per-lesson DNA digests, and normalized semantic
  digests of taxonomy, selection rules, and homeschool rules.

A rebase, squash, or unrelated commit does not invalidate evidence when the fingerprint is unchanged. A change to any scoped path, file name, or file byte makes the evidence stale. Computing the fingerprint requires no Git history.

For an integrated pack, machine lesson-DNA/selection/homeschool artifacts and
rendered homeschool materials are reviewable content under declared
`directory_paths`. A pedagogy migration therefore changes the fingerprint and
requires fresh review/trial evidence. `materials-index.yaml`, evidence records,
and derived readiness reports remain excluded by fingerprint specification 1.0.

## Reviewable scope

Each `materials-index.yaml` declares `reviewable_content`:

- `explicit_paths` contains every linked lesson YAML and the linked thematic-plan YAML;
- `directory_paths` covers the pack's teacher-readable lesson guides, student files, answer keys, and parent files;
- `derived_material_paths: true` automatically adds every `material.artifact_path` and `material.answer_key_path`.

The validator also proves that the scope contains all linked lesson YAML, the thematic plan, every material path and key, all `required_for_pack` materials, and the required teacher, student, parent/homeschool, rubric, and answer-key artifacts. Declared directories are expanded recursively.

Paths must be canonical repository-relative POSIX paths. Absolute paths, traversal, backslashes, missing paths, symlinks, and duplicate manually declared paths are rejected. No manual exclusion mechanism exists. Overlap between a declared directory and a derived material path is intentionally deduplicated after both sources have been validated.

The following are deliberately outside the fingerprint:

- the pack's `materials-index.yaml`, because it contains evidence registration links;
- `pedagogical-reviews/**`, including review, trial, and resolution records;
- `evaluations/pedagogy-readiness/**`, containing derived mutable readiness;
- GitHub issue forms, workflows, validators, and CI scripts;
- QA snapshots, `source-manifest.json`, canonical Opiq Markdown, and source archives.

Adding or updating evidence therefore cannot invalidate itself. The scope boundary permits only the pack directory and its linked lesson/thematic YAML paths; forbidden repository content cannot be inserted through configuration.

Registration compares all four fingerprint fields before and after a staged
write. This applies equally to positive approval/success evidence and completed
negative evidence. The registration workflow also verifies the full resulting
review repository and readiness report; it does not treat a 64-character hash
as proof of currency. A different existing evidence target is immutable, while
an already-linked byte-identical retry is a no-op.

## Framed SHA-256 algorithm

Specification 1.0 uses raw file bytes and repository-relative POSIX path bytes. It does not normalise line endings, whitespace, YAML comments, Markdown, or Unicode. Paths are sorted by bytewise comparison of their UTF-8 representation.

The SHA-256 input is framed as follows:

1. UTF-8 magic bytes `OPIQ-HELPER-TEACHER-PACK-FINGERPRINT`;
2. unsigned 64-bit big-endian specification-version byte length;
3. UTF-8 specification version (`1.0`);
4. unsigned 64-bit big-endian file count;
5. for every sorted file:
   - unsigned 64-bit big-endian path byte length;
   - UTF-8 repository-relative POSIX path;
   - unsigned 64-bit big-endian content byte length;
   - unmodified file bytes.

The result stores `algorithm: sha256`, `specification_version: "1.0"`, a 64-character lower-case hexadecimal `value`, and the positive `file_count`. Both value and count must match the current scope for evidence to be effective.

## Commands

Compute the registered water-pack fingerprint without changing files:

```sh
node scripts/compute-teacher-pack-fingerprint.mjs \
  teacher-packs/grade-5-science/water/materials-index.yaml
```

Audit the exact scope:

```sh
node scripts/compute-teacher-pack-fingerprint.mjs \
  teacher-packs/grade-5-science/water/materials-index.yaml \
  --list-files
```

Use `--check <expected-fingerprint>` for a read-only equality check. An incomplete or unsafe scope exits non-zero.

The fingerprint proves content identity, not pedagogical quality. It does not
replace independent teacher review, privacy review, classroom trial, or home
trial. See the
[pedagogical evidence workflow](pedagogical-review-and-trial-workflow.md).
The water pack remains pending/not-tested/not-started and not ready until real
current evidence is explicitly registered.
