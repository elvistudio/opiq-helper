# Repository Guidance

This repository contains Opiq page indexes for multiple school grades and subjects.

## Source routing

1. Determine the requested grade, subject, and preferred page language before searching.
2. Read `source-manifest.json` and select the matching source entry.
3. Restrict content searches to the `md_path` files selected from the manifest.
4. Do not use material from an adjacent grade unless the user explicitly requests it. Clearly label any adjacent-grade material that is used.
5. Treat `eesti keel` and `eesti keel teise keelena` as different subjects.
6. Clearly label supplementary material and simplified-curriculum material when those distinctions are present in the source.
7. Do not claim that the repository fully covers the official curriculum unless a suitable curriculum map and completeness check exist for the requested scope.

## Data safety

- Do not modify existing Opiq Markdown indexes, ZIP files, JSONL files, source archives, or existing record metadata without a separate explicit task.
- Put bulk or mass data changes in a separate pull request so they can be reviewed independently.
- Run `node scripts/check-source-manifest.mjs` after changing routing metadata.
- Do not merge pull requests yourself.
