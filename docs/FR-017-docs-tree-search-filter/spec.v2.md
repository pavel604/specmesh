# FR-017: Docs Tree Search Filter

**Revision**: 2 (supersedes v1)
**Date**: 2026-09-22
**Trigger**: Change Request
**Reason**: Users expect the search box to find text that appears anywhere in a doc's body, not just its
title/filename — title/filename-only matching was too narrow to be useful for finding docs by content (e.g.
searching "builder" found nothing even though the word appears throughout several docs' bodies).
**Status**: Approved
**Full spec**: see [spec.v1.md](./spec.v1.md) — only what changed is listed below

## Revision Summary

- Matching now also checks a doc's full markdown body content, in addition to title/filename — closes the gap
  reported against v1's title/filename-only behavior.

## Functional Requirements Changed

- FR-2: ~~only doc entries whose title or filename contains the filter text (case-insensitive substring)
  remain visible~~ **Now:** doc entries whose title, filename, **or full markdown body content** contains the
  filter text (case-insensitive substring) remain visible.

## Out of Scope Changed

- ~~Searching full markdown body content — matching is against doc title/filename only.~~ (removed — this is
  now in scope, see FR-2 above)

## Assumptions Changed

- ~~Matching is case-insensitive substring against the doc's `title` and its filename ... not full file
  content.~~ **Now:** matching is case-insensitive substring against the doc's `title`, filename, and full raw
  file content (read once at crawl time, same as today's link/title parsing pass — no extra disk I/O per
  keystroke).

## Open Questions

- None.
