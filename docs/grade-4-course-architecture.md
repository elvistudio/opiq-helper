# Grade 4 course architecture

This deterministic architecture covers the 11 canonical Grade 4 routes and
2212 route-bounded source records. It is a planning and evidence layer, not
publication-ready teaching content.

## Learner profile

Russian is the primary explanation language. The default Estonian route is
`grade-4-estonian-second-language` at approximately A1–A2. First-language Estonian is an explicit alternative;
the two simplified routes require learner-specific opt-in.

## Evidence inventory

* 31 reconciled canonical student kits;
* 31 route-bounded book/edition entries;
* 1768 route-local topic clusters preserving all source records and direct URLs;
* 19 Grade 4-relevant official outcome rows;
* 6 cross-subject project modules with separate individual evidence.

The authored policy at `grade-programmes/grade-4/topic-alignment-policy.yaml` selects source topics by stable record identity rather than
array position. Outcome mappings are 2 verified, 10 partial,
0 ambiguous and 0 missing. Project-role mappings are
0 verified, 11 partial, 0 ambiguous and
7 missing; each missing role is an explicit clean-room bridge requirement.

Ordinary outcomes retain school-stage-II scope and are only recommended Grade 4 allocations. Only the two
simplified-curriculum outcomes retain verified exact Grade 4 scope. Russian and Russian reading, first-language
and second-language Estonian, ordinary and simplified routes remain separate.

## Delivery and companion boundary

The planned commercial core must work without Opiq. Companion candidates are internal-only, access-unverified
references with a mandatory standalone fallback. Teacher-only resources are excluded.

24 book/edition records have an unknown programme type. They remain usable for internal
source analysis and as curated companion candidates, but `ordinary_default_use` is false until programme
membership is verified. The machine-readable release blocker is
`default_core_programme_type_unverified`.

## Gaps and release status

Art, technology/craft/home economics and physical education have no exclusive Grade 4 manifest route. Complete
page prose and task bodies were not captured, so authored lessons and assessment materials remain future clean-room
work. Completeness is **partial** and the commercial release gate is **blocked**. This architecture does not claim
official exact-grade ordinary outcomes, curriculum completeness, publication/classroom readiness, or pedagogical
effectiveness.
