# Classroom-trial guide: Grade 6 soil organisms

## 1. Purpose and non-evidence boundary

This packet defines how a future classroom trial of `grade-6-science-soil-organisms` must be planned, recorded and analysed. This pull request does not conduct a trial. The template is a workflow aid, not human evidence, and a pull-request review or merge does not become trial evidence.

## 2. Prerequisite teacher and safety reviews

A trial must not begin until the registry contains a current completed teacher review with a decision of `approved` or `approved_with_nonblocking_changes` and a current completed local-safety review with a decision of `approved_for_named_context` or `approved_with_conditions`. Both records must bind to the current material fingerprint. Safety approval applies only to its named site, participants, supervision and conditions; it does not authorize another context.

## 3. Exact artifact and fingerprint

- Artifact: `grade-6-science-soil-organisms`
- Route: `grade-6-science`
- Artifact index: `teacher-work-plan-artifacts/grade-6-science/soil-organisms/artifact-index.yaml`
- Material fingerprint: `894cc83f54c158485f6d6ba699d8a1298c3e57056e315281b79d69e84f366613`

The trial covers the two 45-minute parts linked to lessons 8 and 9. Any byte change to a material changes the fingerprint and invalidates trial evidence bound to the previous fingerprint.

## 4. Privacy and aggregate evidence

Record only aggregate classroom observations. Do not commit learner or facilitator names, email addresses, phone numbers, birth dates, addresses, personal identifiers, medical or diagnostic information, identifiable grades or profiles, recordings, photographs, video, audio, or references to private media. Use opaque slug references for the facilitator and group. Complete both manual and free-text privacy reviews before registering an analysed record.

## 5. Preparing the trial

Copy the template to a new record path inside this review directory only after prerequisites exist. Replace template nulls with aggregate context, opaque references and dates. Confirm that the named safety context matches the planned location, supervision, access needs, weather or indoor fallback, and local stop conditions. Do not set `template: false` merely to reserve an identifier.

## 6. Part 1 observation procedure

Observe the fieldwork part without collecting learner-level data. Record actual duration and the required dimensions in their fixed order: timing, setup and transitions, instruction comprehension, practical safety, equal-area and equal-time adherence, observation and data recording, material usability, accessibility and participation, ethical return and restoration, and method naturalness. Link every problem to a finding rather than hiding it in a positive summary.

## 7. Part 2 observation procedure

Record actual duration and the fixed dimensions for group synthesis, Russian subject explanation, independently authored Estonian support, assessment and feedback, usability, access, immediate recall and transfer, and method naturalness, together with timing, transitions and comprehension. Estonian-language support evidence must remain separate from the subject result in Russian.

## 8. Timing and transition evidence

Compare the planned 45 minutes with actual aggregate timing for each part. Note whether preparation, movement, material distribution, group formation, clean-up or the transition between parts affected completion. A deviation is an observation to analyse; it is not automatically a failure or a reason to alter the recorded duration.

## 9. Safety, stop conditions and incidents

Apply the named local-safety record throughout the trial. Count incidents and record whether a stop condition was triggered without describing identifiable people. Stop when local conditions require it. Teacher approval does not replace local safety approval, and local safety approval does not complete a classroom trial.

## 10. Findings and required changes

Use `observation`, `minor`, `major` or `blocking` severity. Every `partly_met` dimension needs an exact linked minor finding and a concrete change plan. Resolved findings require resolution notes. A required change that remains open prevents a positive decision, and no positive decision may coexist with an open major or blocking finding.

## 11. Trial decisions

Only an `analysed` record may have a decision other than `pending`. `successful` requires every dimension to be `met`. `successful_with_notes` permits only linked minor `partly_met` observations and no `not_observed` or `not_met` dimension. `repeat_trial_required` and `unsuccessful` require a rationale and do not support readiness. A successful trial is evidence about this implementation in its named context; it does not prove comparative effectiveness.

## 12. Fingerprint invalidation

Before analysis and registration, recompute the current artifact fingerprint and verify it against the record, teacher review and safety review. If a material changes, preserve the old record as historical evidence and conduct a new current-fingerprint review and trial. Never rewrite a registered completed record to follow a new fingerprint.

## 13. Registration of an analysed record

Create a completed record under this review root, set `template: false`, finish all required observations and privacy attestations, and validate it locally. Register only an immutable `analysed` record in `review-registry.yaml`; a `draft` or `conducted` record cannot be registered as completed. Supersession references must point to known records and must not form cycles.

## 14. Readiness truth table

| Teacher review | Named-context safety review | Analysed positive trial | Classroom ready |
| --- | --- | --- | --- |
| pending or absent | any | any | false |
| current positive | pending, absent or wrong context | any | false |
| current positive | current positive and matching | absent, draft, conducted, repeat required or unsuccessful | false |
| current positive | current positive and matching | current `successful` or `successful_with_notes` | may be derived only by the validator and a separate readiness change |

This workflow does not promote readiness automatically. Publication and release remain separate decisions.

## 15. Prohibited claims

Do not claim that this workflow conducted a trial, that the material is classroom ready, publication ready or effective, or that safety is universal. Do not infer trial evidence from a PR author, reviewer, approval or merge. A successful trial does not make either canonical Opiq gap `matched` or `partial`, does not resolve a source gap, and does not establish an official curriculum map, annual architecture, default-course selection or live-catalogue completeness.
