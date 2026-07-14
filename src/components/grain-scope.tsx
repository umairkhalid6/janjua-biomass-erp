"use client";

// Client-side grain (daily/weekly/monthly) state shared between a page's
// GrainPicker and its chart sections. Flipping the grain updates ?grain= via
// history.replaceState — the URL stays shareable and the server still renders
// the right initial state on deep links / reloads — but no navigation happens,
// so only the affected charts refetch (via useGrainData) instead of the whole
// page re-rendering server-side.

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { GrainPicker } from "@/components/grain-picker";
import type { Grain } from "@/lib/granularity";

interface GrainContextValue {
  grain: Grain;
  setGrain: (grain: Grain) => void;
}

const GrainContext = createContext<GrainContextValue | null>(null);

export function GrainScope({
  initialGrain,
  children,
}: {
  initialGrain: Grain;
  children: React.ReactNode;
}) {
  const [grain, setGrain] = useState<Grain>(initialGrain);
  return (
    <GrainContext.Provider value={{ grain, setGrain }}>
      {children}
    </GrainContext.Provider>
  );
}

function useGrainContext(): GrainContextValue {
  const ctx = useContext(GrainContext);
  if (!ctx) throw new Error("Must be rendered inside <GrainScope>");
  return ctx;
}

/** Current grain of the surrounding GrainScope. */
export function useGrain(): Grain {
  return useGrainContext().grain;
}

/** GrainPicker bound to the surrounding GrainScope; keeps ?grain= in the URL. */
export function ScopedGrainPicker({ paramName = "grain" }: { paramName?: string }) {
  const { grain, setGrain } = useGrainContext();

  const handleChange = (next: Grain) => {
    setGrain(next);
    // window.location is fine here: this only runs in a click handler.
    const url = new URL(window.location.href);
    url.searchParams.set(paramName, next);
    window.history.replaceState(null, "", url);
  };

  return <GrainPicker value={grain} onChange={handleChange} />;
}

/**
 * Chart data that follows the scoped grain. Renders `initialData` (computed
 * server-side for the initial grain) until the user flips the picker, then
 * calls `fetcher` — a server action — for just this chart's new series.
 */
export function useGrainData<T>(
  initialData: T,
  fetcher: (grain: Grain) => Promise<T>
): { grain: Grain; data: T; pending: boolean } {
  const grain = useGrain();
  const [data, setData] = useState(initialData);
  const [pending, startTransition] = useTransition();
  // The grain we last fetched (or mounted with); guards against applying a
  // stale response after a rapid second flip.
  const requested = useRef(grain);

  useEffect(() => {
    if (grain === requested.current) return;
    requested.current = grain;
    startTransition(async () => {
      const next = await fetcher(grain);
      if (requested.current === grain) setData(next);
    });
  }, [grain, fetcher]);

  return { grain, data, pending };
}
