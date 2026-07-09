"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-emerald-900 hover:shadow-md active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 sm:w-auto sm:py-2"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
      </svg>
      Print / Save PDF
    </button>
  );
}
