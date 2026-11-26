# Data releases

This branch holds the published data releases for the Global Food System
Observatory. It is not the project's source code — that is on `main`.

Releases are kept here rather than on `main` so the main branch stays small
however long the project runs, and so that every past release is preserved.
That second reason is the important one: it is what makes it possible to ask
later what the site said on a given day, which is the basis of any honest
account of whether this project's readings were any good.

A release is never rewritten. If a figure turns out to be wrong, the
correction appears in a later release and the release that carried the error
stays here. A project that quietly edits its own past cannot later claim it
got anything right.

Each release is a set of JSON files plus `manifest.json`, which lists every
file with its SHA-256 checksum. The site reads the manifest first, so it can
never show half of one release and half of another.
