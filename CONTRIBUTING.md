# Contributing

## Corrections come first

If a number on the site is wrong, that matters more than any feature. Email
[mbodrudd@uoguelph.ca](mailto:mbodrudd@uoguelph.ca) or open an issue with the
page, the figure and what you think it should be. Corrections are recorded with
their date, and the release that carried the error stays in the `data` branch
rather than being rewritten — a project that quietly edits its own past cannot
later claim it got anything right.

## Ground rules for code

These are not style preferences. Each one exists because of a specific way this
kind of site misleads people.

1. **A missing value is `None`, never `0`.** Zero is an observation. Absence is
   not. Blurring them is how a site reports an empty silo that is really an
   empty cell.
2. **Every published figure carries its unit, its period and its source.** If a
   number cannot carry those three, it does not get published. The release gate
   enforces this.
3. **A successful fetch is not fresh data.** Record what the provider says it
   last changed, never when you downloaded it. The World Bank connector exists
   in its current form because a hard-coded address returned a perfectly good
   file full of two-year-old prices.
4. **Nothing is watching is not the same as nothing is happening.** Any stage,
   indicator or panel with no data says so in those words. A test enforces it.
5. **No licence, no connector.** A source gets an entry in
   `pipeline/config/sources.yml` with its redistribution right recorded before
   a line is written against it, and the release build refuses to publish from
   a source that has not been cleared.
6. **Judgement is labelled as judgement.** Thresholds, windows and weightings
   are ours, and the site says so on the page where they are used.
7. **Plain language is a requirement, not a polish step.** The reader is
   assumed to be a capable person with no background in food-system modelling.
   Define a term in the same breath as using it, or do not use it.

## Running the tests

```bash
cd pipeline && python -m pytest    # 57 tests, offline, fixtures only
npm test                           # checks a published release against the pages
```

Pipeline tests must not need a network. If a test needs source data, add a
fixture under `pipeline/tests/fixtures/`.

## Adding a source

1. Fetch it by hand. Record the status code, the size and what the provider
   says about when it last changed.
2. Read its licence. Record the redistribution right: `may_republish`,
   `attribution_only`, `link_only` or `unknown`. The release build will refuse
   anything that is not one of the first two.
3. Write both into `docs/source-inventory.md`, **including if it failed**. A
   recorded failure saves the next person the same afternoon.
4. Add the entry to `pipeline/config/sources.yml`, with a `plain_name` a
   non-specialist would understand and a `caveat` saying what it does not tell
   us.
5. Only then write the connector.

## Adding an assumption to the ledger

An assumption is only worth adding if it can be contradicted. It needs a
published figure, a numeric condition, plain words for what it assumes, why it
matters, and what it would mean if it broke. If you cannot write the condition,
the assumption belongs in prose, not in the ledger.
