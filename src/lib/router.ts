/* A small hash router.
 *
 * Hash routing because the site is served as static files from GitHub Pages:
 * a path-based route would 404 on refresh, and a reader who bookmarks a
 * country page and comes back to a Not Found is a reader who does not come
 * back again. Every view is therefore reachable from a link somebody can send
 * to a colleague, with no account and no state hidden in the session. */

import { useEffect, useState } from "react";

export interface Route {
  page: string;
  id?: string;
  query: URLSearchParams;
}

export function parse(hash: string): Route {
  const raw = hash.replace(/^#\/?/, "");
  const [path, search] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  return {
    page: parts[0] || "home",
    id: parts[1],
    query: new URLSearchParams(search || ""),
  };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  useEffect(() => {
    const update = () => {
      setRoute(parse(window.location.hash));
      // A new page starts at the top. Without this, following a link from
      // halfway down a long page lands the reader halfway down the next one.
      window.scrollTo(0, 0);
    };
    const context = () => setRoute(parse(window.location.hash));
    window.addEventListener("hashchange", update);
    window.addEventListener("gfso-context", context);
    return () => { window.removeEventListener("hashchange", update); window.removeEventListener("gfso-context",context); };
  }, []);
  return route;
}

export function href(page: string, id?: string, query?: Record<string, string>): string {
  const search = query ? `?${new URLSearchParams(query).toString()}` : "";
  return `#/${page}${id ? `/${id}` : ""}${search}`;
}

export function go(page: string, id?: string, query?: Record<string, string>): void {
  window.location.hash = href(page, id, query);
}
