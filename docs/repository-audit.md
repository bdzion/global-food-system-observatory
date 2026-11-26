# Repository audit and rights review

Done before any code was written, 26 November 2026, as the plan required.

## What was examined

| Project | Size | Owner |
| --- | --- | --- |
| `bdzion/canada-food-system-observatory` | 4,578 lines Python, 3,138 TypeScript, 19 connectors, 25 commits | Md Bodrud-Doza |
| `bdzion/canada-food-stress-test` | one 236 kB page plus a 58 kB guide, 15 commits | Md Bodrud-Doza |
| `feeding9billion-cmyk/Granary_Risk_Dashboard` | one 77 kB page, 3 commits | **not Md Bodrud-Doza** |

## Rights

**None of the three repositories contains a licence file.** Checked for
`LICENSE` and `LICENCE` in all three: absent. Under default copyright that
means all rights reserved, so nothing in any of them is automatically reusable
— including the author's own work, if it is ever to be reused by anybody else.

What was done about it:

1. **No code was copied from any of the three.** This repository was written
   from scratch. What carried across is design thinking, not source: the idea
   of a chain whose stages report evidence rather than severity, the practice
   of recording a source's licence and expected freshness in a registry, and
   the pattern of keeping data releases off the main branch. Those are
   approaches, and this implementation is independent.
2. **Nothing was taken from the Granary dashboard**, which belongs to another
   account. The only thing in common is the general idea of concise structured
   risk communication, which is not anybody's property.
3. **The originals were not modified.** Both Canadian repositories were cloned
   read-only and left untouched.
4. **This repository carries its own licence** from its first commit: MIT for
   code, CC BY 4.0 for content and published releases.

**Recommendation that is still outstanding.** Add a licence to
`canada-food-system-observatory` and `canada-food-stress-test`. Both are public
and neither grants anyone — including their author's future collaborators — any
right to use them. It costs one file each.

## What the Canadian observatory does well, for the record

Worth writing down, because these are the things that were worth learning from
even though no code moved:

- Missing values are `None` and never `0`, consistently, with percentage change
  against a zero base returning "not calculable" rather than infinity.
- Credentials are scrubbed from every error message before it can be logged.
- The source registry records licence, licence URL, expected publication
  frequency, a staleness threshold set from the provider's rhythm rather than
  the polling interval, and a status lifecycle from candidate to retired.
- Releases are committed to a separate branch, which keeps the main branch
  small and preserves every past release.
- Contract tests check a published release against what the pages render, which
  catches the failure mode where the build goes green and a panel goes blank.
- The transmission file classifies by how far along a chain the evidence has
  reached rather than by a severity score, and marks a stage with no watchable
  indicator as unwatched rather than clear.

All six of those principles are implemented here, independently.

## What the Canadian stress test does well

Its page already contains "The cost of waiting", "Make the call yourself" and a
decision game with a role, an objective, a statement of what is uncertain, new
information arriving over turns, and a verdict. The cost-of-waiting idea is the
one carried into this project's what-if test, as the "months before anyone
acts" control: it teaches the lesson the research makes by charging the reader
for delay. The implementation here is new.

## What this repository does not inherit

- No Canadian domestic content. This is a global wheat site; the Canadian
  observatory covers Canada in far more depth and should be linked to, not
  duplicated.
- No composite risk score, which none of the three has either, correctly.
