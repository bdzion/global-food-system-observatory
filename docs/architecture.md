# Architecture decisions

Each entry says what was decided, what it rules out, and what would make it
wrong. Written so that the next person can overturn a decision on purpose
rather than by accident.

---

## 1. Static-first: no server, no database, no API

**Decided.** The pipeline runs on a schedule outside the browser and writes a
set of small JSON files. The browser reads those files and runs the what-if
test locally. There is no backend.

**Why.** Nothing to keep alive, no credential reachable from a page, and an
archived copy of a release still reads correctly a year later. It also keeps
the running cost near zero, which matters for a project with no operating
budget and no guarantee of one.

**Rules out.** Server-side queries over the full trade matrix, user accounts,
anything that needs to write.

**Would be wrong if.** The release files stop fitting in a page load. The
current release is about 730 kB across seven files, with the country file the
only large one. Splitting per country is the obvious next step before anything
heavier.

---

## 2. Releases live on a `data` branch, never on `main`

**Decided.** The refresh job commits each release to a separate branch. The
deploy job clones that branch and copies the release into the build.

**Why.** Four releases a day on `main` would make the repository unpleasant to
clone within a year, and git keeps every version for ever. On a side branch the
history is the point: it is what makes it possible to ask later what the site
said on a given day, which is the whole basis of the evaluation this project
eventually needs.

**Would be wrong if.** The data branch itself grows past what GitHub is happy
to serve. At roughly 730 kB a release and four releases a day, that is a few
years away; the first mitigation is to publish only on change, which the
workflow already does.

---

## 3. The chain reports evidence, not severity

**Decided.** Each of the seven links reports how far along the chain the
evidence has reached, not how bad things are. A link can be `quiet`,
`watching`, `not_watched` or `no_data`, and those four are kept distinct in the
data, not only in the words on the page.

**Why.** It follows the European Drought Observatory's approach of classifying
a place by which link of the cascade its evidence has reached rather than by a
composite score. It also makes the honest answer expressible: `not_watched`
means we have no data, `quiet` means we looked and found nothing, and running
those together is the commonest way a monitoring site misleads people.

**Rules out.** A single severity score per country, and any ranking built on
one.

**Would be wrong if.** Someone demonstrates that readers consistently read
`watching` as an alarm. The label wording, not the structure, would be the fix.

---

## 4. Forward-looking claims are wired to the readings that would break them

**Decided.** Every assumption behind the what-if test names a published figure
and a numeric condition. Each release evaluates them. A crossed condition marks
the assumption contradicted, with the date and the reading, and flags the test
as needing another look.

**Why.** This is the gap the project exists to fill. Of the platforms reviewed,
some publish numeric thresholds and no scenarios, and others publish rigorous
scenario method with no numeric triggers at all, leaving the watching to a
monthly analyst cycle. Nobody wires the two together.

**Important.** A broken assumption never changes a conclusion automatically.
It flags it. Deciding what the new figure means needs a person, and quietly
recalculating would be the same failure as never revisiting.

**Would be wrong if.** The thresholds fire so often that the flag stops meaning
anything. Nobody has validated them against a real disruption, because the site
has not lived through one. The breach record is the evidence that will settle
it.

---

## 5. Figures we do not believe are not published

**Decided.** Two checks suppress a stock figure: one for a newest-year value
that is a rounding error beside a substantial recent history, and one for a
large importer recorded as holding under a week of use. Both publish the reason
on the page instead of the number.

**Why.** FAO's accounts close by using the change in stocks as the balancing
residual. Publishing "no wheat in store" for Algeria would be a serious error
and exactly the kind a monitoring site makes when it treats every published
number as an observation.

**Would be wrong if.** A country genuinely does run its stocks to nothing and
we suppress the one figure that mattered. The thresholds are deliberately
conservative — under 5% of the recent median, or under a quarter of a month of
use — and the suppressed value stays in the release's input data.

---

## 6. Ranking is done on the strongest available measure, not the most intuitive

**Decided.** The front page ranks countries by how much of their wheat comes
from one supplier, not by what they hold in store.

**Why.** Stock cover is the more intuitive measure and the weaker one. Trade
figures are reported by governments and cross-checked; FAO's stock estimates
are, for several large buyers, placeholders. Ranking on the weaker measure
would manufacture a finding, which is worse than not having one.

---

## 7. Every chart has the table it was drawn from

**Decided.** Each chart carries a Chart / Numbers switch.

**Why.** It is an accessibility requirement and the site would fail its own
standard without it. It is also how a reader checks a claim: a line that looks
steep is an argument, and the numbers under it are evidence.

---

## 8. Plain SVG, no charting library

**Decided.** Charts are hand-written SVG.

**Why.** The whole site is 63 kB gzipped. A charting library would be several
times that for a line and a bar chart, and the audience includes people on slow
connections in the countries the site is about.

**Would be wrong if.** The chart needs grow to the point where hand-rolling
them costs more than the bytes save.

---

## 9. Hash routing

**Decided.** Routes are `#/countries/EGY` rather than `/countries/EGY`.

**Why.** GitHub Pages serves static files, so a path route 404s on refresh. A
reader who bookmarks a country page and comes back to a Not Found does not come
back again.

---

## 10. The situation text is written by the pipeline and labelled unreviewed

**Decided.** The short description on the front page is assembled from the
figures, carries `reviewed: false`, and the release gate refuses to publish if
that flag or its explanatory note is missing. A test refuses any situation text
containing "at risk", "crisis", "shortage", "will face" or "danger".

**Why.** Describing what the figures say can be automated. Calling a country at
risk is a judgement, and nobody has made it for these releases. The label alone
is not enough — labels are stripped the moment anyone quotes a page — so the
machine is constrained to statements it can actually support.

**Would be wrong if.** A reviewer joins the project, at which point the rule
becomes a workflow rather than a constraint.
