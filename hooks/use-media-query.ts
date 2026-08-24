"use client";

import * as React from "react";

/** Devuelve true si la media query coincide. SSR-safe (empieza en false). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** ≥ 768px = escritorio/tablet. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 768px)");
}
