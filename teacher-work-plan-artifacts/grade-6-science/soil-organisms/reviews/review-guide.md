# Human review guide: Grade 6 soil-organisms pilot

## 1. Purpose and boundaries

This packet supports real human review of the internal-draft reusable artifact
`grade-6-science-soil-organisms`. A template is not human evidence. Merging the
workflow does not approve the pilot, make it classroom-ready, or change either
canonical Opiq gap from `missing`.

Teacher review, local safety review, and classroom trial are separate evidence
steps. None creates an official curriculum map, annual architecture,
default-course decision, live-catalogue verification, or source-gap resolution.

## 2. Exact artifact and fingerprint

- Artifact index: `teacher-work-plan-artifacts/grade-6-science/soil-organisms/artifact-index.yaml`
- Artifact ID: `grade-6-science-soil-organisms`
- Route: `grade-6-science`
- Reviewed material fingerprint: `894cc83f54c158485f6d6ba699d8a1298c3e57056e315281b79d69e84f366613`

The fingerprint covers the seven material files in index order. It does not
include the index or this review packet.

## 3. Files under review

Review all seven materials: `teacher-guide.md`, `practical-protocol.md`,
`observation-table.md`, `student-worksheet.md`, `answer-key.md`,
`assessment-rubric.md`, and `oral-support.md`. Review the artifact index only to
verify provenance, route, readiness, and content-boundary claims.

## 4. Teacher-review procedure

1. Copy `teacher-review-template.yaml` to a new YAML record path under this
   review root; never overwrite the template.
2. Set `template: false` and enter the real review ID, reviewer ID or stable
   identifier, reviewer name, role, organization when applicable, and review
   date.
3. Confirm the artifact identity and current fingerprint before reading.
4. Review every scope item and record concrete notes and finding references.
5. Record findings with affected pilot paths and required changes.
6. Choose a decision only after reconciling open blocking and major findings.
7. Register the completed record path in `review-registry.yaml` and rerun the
   review and reusable-artifact checks.

## 5. Local-safety-review procedure

1. Copy `local-safety-review-template.yaml`; do not modify the template.
2. Record a real reviewer identity and date.
3. Name the school or organization, exact observation site, planned activity
   date, group size, supervision, delivery-site category, whether indoor
   fallback is permitted, weather limits, accessibility adjustments,
   permissions, and emergency contact process.
4. Review every safety scope item for that named context.
5. Record explicit conditions for `approved_with_conditions`.
6. Register the completed record only after the decision matches the findings.

Local safety approval is limited to the named context. It never establishes
universal safety, permission at another site, suitability in every weather
condition, protected-area permission, or classroom readiness by itself.

## 6. Finding severity definitions

- `note`: useful observation with no required change.
- `minor`: bounded improvement that does not block the stated decision.
- `major`: material defect that must be resolved before approval.
- `blocking`: safety, scientific, ethical, or readiness defect that prevents
  approval and further use in the affected scope.

## 7. Approval rules

An approved teacher review requires a real identity and date, the current
fingerprint, every required scope item reviewed, no open blocking or major
finding, and completed required changes. A template can never be approved.

An approved local safety review additionally requires a complete named local
context. Conditional approval requires explicit conditions. Teacher approval or
pull-request approval is not local safety approval, classroom-trial evidence, or
publication approval.

## 8. Fingerprint invalidation

Any byte change to one of the seven material files changes a material hash and
the aggregate fingerprint. A completed review for an older fingerprint becomes
stale and cannot support readiness. Review templates and registry metadata do
not change the material fingerprint.

## 9. Required-change workflow

Keep each finding ID stable. Implement the required material change separately,
recompute the material hashes and aggregate fingerprint, and obtain review of
the new fingerprint. Mark a finding resolved only with concrete resolution
notes. Approval cannot coexist with an unresolved required change or an open
major or blocking finding.

## 10. Classroom-trial boundary

The classroom-trial workflow and template are documented in
`classroom-trial-guide.md`. They do not create a classroom-trial record and are
not evidence. Classroom trial remains `not_tested`; classroom readiness remains
false. A future trial must meet the separate trial contract and must not be
inferred from review, pull-request approval, or merge state.

## 11. Prohibited claims

Do not claim that the pilot is approved, universally safe, legally permitted,
classroom-ready, publication-ready, effective, officially curriculum-complete,
or eligible as a default course. Do not promote lessons 8–9 to `partial` or
`matched`; the reusable artifact is independently authored support.

## 12. How to create a completed record

Create an immutable copy of the appropriate template under the review root,
fill it with actual human evidence, set `template: false`, and register its path.
The record must match the exact current fingerprint and pass schema, identity,
scope, finding, decision, path, and readiness checks. Never use PR authorship,
approval, or merge metadata as reviewer evidence.
