"""Global Food System Observatory data pipeline.

The pipeline turns published statistics into one compact, versioned release
that the website reads. Three rules hold everywhere in this package:

1. A missing value is None. It is never zero, and never silently filled.
2. Every published number carries its source, its unit and the period it
   covers. A number that cannot carry those does not get published.
3. Anything the research team judged, rather than observed, says so in the
   data itself, not only in the prose around it.
"""

__version__ = "0.1.0"

# Bumped whenever the shape of a published release changes. The website checks
# this before it reads anything, so an old page cannot render a new release and
# quietly show the wrong thing.
SCHEMA_VERSION = 1

USER_AGENT = (
    "GlobalFoodSystemObservatory/0.1 "
    "(research project, University of Guelph; mbodrudd@uoguelph.ca)"
)
