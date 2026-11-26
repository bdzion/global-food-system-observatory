/* Loading a release.
 *
 * The manifest is read first and its schema version checked, so an old page
 * cannot render a newer release and quietly show the wrong thing. If anything
 * is wrong the site says so on the page rather than failing silently, because
 * a blank panel reads as "nothing is happening" and that is exactly the
 * misunderstanding this project exists to avoid. */

import { SCHEMA, type Release } from "./types";

const BASE = `${import.meta.env.BASE_URL}data`;

export type LoadState =
  | { status: "loading" }
  | { status: "ready"; release: Release }
  | { status: "failed"; reason: string };

async function readJson<T>(name: string): Promise<T> {
  const response = await fetch(`${BASE}/${name}`, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`${name} could not be loaded (${response.status})`);
  }
  return (await response.json()) as T;
}

export async function loadRelease(): Promise<Release> {
  const manifest = await readJson<Release["manifest"]>("manifest.json");
  if (manifest.schema_version !== SCHEMA) {
    throw new Error(
      `This page expects release format ${SCHEMA} and the published release is ` +
        `format ${manifest.schema_version}. Reload the page to pick up the ` +
        `current version of the site.`,
    );
  }
  const [world, countries, ledger, pairs, scenario, sources] = await Promise.all([
    readJson<Release["world"]>("world.json"),
    readJson<Release["countries"]>("countries.json"),
    readJson<Release["ledger"]>("ledger.json"),
    readJson<Release["pairs"]>("pairs.json"),
    readJson<Release["scenario"]>("scenario.json"),
    readJson<Release["sources"]>("sources.json"),
  ]);
  return { manifest, world, countries, ledger, pairs, scenario, sources };
}

/* What the reader saw last time they were here, so the site can show them what
 * has changed since. Kept in their own browser and nowhere else. It is a
 * convenience, so every read and write is wrapped: a browser with storage
 * turned off should still get a working site. */
const VISIT_KEY = "gfso.last-release";

export function lastSeenRelease(): string | null {
  try {
    return window.localStorage.getItem(VISIT_KEY);
  } catch {
    return null;
  }
}

export function rememberRelease(releaseId: string): void {
  try {
    window.localStorage.setItem(VISIT_KEY, releaseId);
  } catch {
    /* Storage is unavailable or full. Nothing here is worth an error. */
  }
}
