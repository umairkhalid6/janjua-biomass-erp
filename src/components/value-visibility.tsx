"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Privacy mask for the dashboard: figures render as "****" until the viewer
 * clicks Show. Deliberately not persisted — every page load starts hidden.
 */
const VisibilityContext = createContext<{
  visible: boolean;
  toggle: () => void;
}>({ visible: false, toggle: () => {} });

export function ValueVisibilityProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <VisibilityContext.Provider value={{ visible, toggle: () => setVisible((v) => !v) }}>
      {children}
    </VisibilityContext.Provider>
  );
}

export const MASK = "****";

/** Renders `value` when visible, otherwise the mask. */
export function MaskedValue({ value }: { value: ReactNode }) {
  const { visible } = useContext(VisibilityContext);
  return <>{visible ? value : MASK}</>;
}

/** Blurs and disables interaction (tooltips) on its children while hidden. */
export function MaskedBlock({ children }: { children: ReactNode }) {
  const { visible } = useContext(VisibilityContext);
  return (
    <div className="relative">
      <div
        className={visible ? "" : "pointer-events-none select-none blur-md"}
        aria-hidden={!visible}
      >
        {children}
      </div>
      {!visible && (
        <div className="absolute inset-0 flex items-center justify-center text-sm font-medium text-neutral-500">
          Values hidden
        </div>
      )}
    </div>
  );
}

export function ValueVisibilityToggle() {
  const { visible, toggle } = useContext(VisibilityContext);
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={visible}
      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:border-green-600 hover:text-green-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-green-600 dark:hover:text-green-400"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
        {!visible && <path d="M3 3l18 18" />}
      </svg>
      {visible ? "Hide values" : "Show values"}
    </button>
  );
}
