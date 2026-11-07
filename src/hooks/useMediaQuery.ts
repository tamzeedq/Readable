import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** Breakpoint for the mobile layout (bottom tabs, sheets). Design frame is 390 × 844. */
export const MOBILE_QUERY = '(max-width: 720px)';

export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}

export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
