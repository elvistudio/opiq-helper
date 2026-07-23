# Grade 3 English source import audit

## Result

The supplied archive contains **197** source rows for two grade-3 English books. Four repeated Kit Details rows are excluded, leaving **193 unique direct instructional URLs**: 89 pages from kit 452 and 104 pages from kit 369.

This is a complete audit of the supplied capture, not proof of official-curriculum completeness or current live Opiq catalogue completeness.

## Immutable archive

| SHA-256 | Bytes | Uncompressed bytes | ZIP members | Capture |
| --- | ---: | ---: | ---: | --- |
| `502bd7a8d03e0af2be85ae80f7da0b9d46a1d63c9d05bf2d772f66fd57d6f57b` | 1935103 | 1898081 | 204 | 2026-07-23T06:48:16.949Z |

All members pass central-directory, local/central filename, declared-size, CRC-32, safe-relative-path, unique-name, and stored-compression validation. All 204 stored filenames are ASCII, omit the UTF-8 flag, and require no recovery. The archive is committed byte-for-byte unchanged.

## Source accounting and books

| Kit | Source Book ID | Canonical Book ID | Canonical title | Source rows | Pages |
| ---: | --- | --- | --- | ---: | ---: |
| 452 | `english_step_by_step_1` | `english_step_by_step_1__kit452` | English step by step 1 | 91 | 89 |
| 369 | `inglise_keel_3._klassile` | `inglise_keel_3._klassile__kit369` | High Five! 3 | 106 | 104 |
| **Total** |  |  |  | **197** | **193** |

The captured ` – Opiq` UI suffix is removed only from canonical book titles. Source Book IDs, page titles, headings, URLs, and source order remain unchanged. Publishers are empty in index, raw-book, and compact records, so none are invented. Programme type cannot be proven from the supplied archive and remains explicitly `unknown`.

## Excluded duplicate details

| Kit | URL | Synthetic chapter IDs | Decision |
| ---: | --- | --- | --- |
| 369 | [https://www.opiq.ee/Kit/Details/369](https://www.opiq.ee/Kit/Details/369) | 1, 106 | Exclude both cover/detail records |
| 452 | [https://www.opiq.ee/Kit/Details/452](https://www.opiq.ee/Kit/Details/452) | 107, 197 | Exclude both cover/detail records |

Both duplicate groups are restricted to Kit Details and differ only in synthetic chapter ID. No instructional page is title-deduplicated.

## Metadata normalization

All 197 compact rows carry the generated subject `mathematics / matemaatika / математика`. Source identities, English book titles, kits 369/452, chapter headings, and page contents prove that this is an English capture. The canonical subject is normalized to `english / inglise keel / английский язык`; generated mathematics topic aliases are removed.

Both raw book objects say `ru`, while index and page-level evidence identify a multilingual English-learning source. The route preserves every page-level language value: **122 en, 67 et, and 4 ru**. It does not guess a single language from the raw book object.

## Raw-evidence audit

All 197 compact rows reconcile with raw chapter title, URL, and headings. Raw evidence contains 197 chapters, 1780 + 4066 heading records, and 289 + 3731 image references. All compact and raw structured task arrays are empty.

Empty task arrays are a capture limitation, not proof that the books contain no exercises. A targeted task-body recapture may improve later lesson authoring; a full recapture is not required for canonical routing. The original raw and canonical text is not reconstructed from images or rewritten.

## Repeated titles

Equal titles identify distinct chapters and remain separate:

- `Definitions`: [https://www.opiq.ee/kit/369/chapter/23950](https://www.opiq.ee/kit/369/chapter/23950), [https://www.opiq.ee/kit/452/chapter/24657](https://www.opiq.ee/kit/452/chapter/24657).
- `Let’s Practise!`: [https://www.opiq.ee/kit/369/chapter/21386](https://www.opiq.ee/kit/369/chapter/21386), [https://www.opiq.ee/kit/369/chapter/21387](https://www.opiq.ee/kit/369/chapter/21387), [https://www.opiq.ee/kit/369/chapter/21388](https://www.opiq.ee/kit/369/chapter/21388), [https://www.opiq.ee/kit/369/chapter/21389](https://www.opiq.ee/kit/369/chapter/21389), [https://www.opiq.ee/kit/369/chapter/21634](https://www.opiq.ee/kit/369/chapter/21634), [https://www.opiq.ee/kit/369/chapter/21635](https://www.opiq.ee/kit/369/chapter/21635), [https://www.opiq.ee/kit/369/chapter/21636](https://www.opiq.ee/kit/369/chapter/21636), [https://www.opiq.ee/kit/369/chapter/21637](https://www.opiq.ee/kit/369/chapter/21637), [https://www.opiq.ee/kit/369/chapter/21862](https://www.opiq.ee/kit/369/chapter/21862), [https://www.opiq.ee/kit/369/chapter/21863](https://www.opiq.ee/kit/369/chapter/21863), [https://www.opiq.ee/kit/369/chapter/21864](https://www.opiq.ee/kit/369/chapter/21864), [https://www.opiq.ee/kit/369/chapter/21865](https://www.opiq.ee/kit/369/chapter/21865), [https://www.opiq.ee/kit/369/chapter/21923](https://www.opiq.ee/kit/369/chapter/21923), [https://www.opiq.ee/kit/369/chapter/21924](https://www.opiq.ee/kit/369/chapter/21924), [https://www.opiq.ee/kit/369/chapter/21925](https://www.opiq.ee/kit/369/chapter/21925), [https://www.opiq.ee/kit/369/chapter/21926](https://www.opiq.ee/kit/369/chapter/21926).

## Quality and boundaries

There are zero replacement characters, forbidden controls, invisible soft hyphens, unprocessed HTML/JSON payloads, malformed chapter URLs, empty instructional titles, or instructional pages without headings. All 193 URLs are unique and occur in no other manifest route.

The route is separated from grade-3 mathematics, Estonian, Russian, arts-and-crafts, and adjacent grades. It is a source index, not a curriculum map. No ordinary/simplified programme classification, publisher, task text, or curriculum completeness is inferred beyond the capture.
