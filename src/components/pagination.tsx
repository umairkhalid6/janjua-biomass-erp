"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

const buttonClass =
  "rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800";

// Prev/Next pager driven by a query param. Renders nothing when everything
// fits on one page. `paramName` lets two tables on one page (contractor
// payments/adjustments) paginate independently.
export function Pagination({
  page,
  pageCount,
  total,
  paramName = "page",
  noun = "entries",
}: {
  page: number;
  pageCount: number;
  total: number;
  paramName?: string;
  noun?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (pageCount <= 1) return null;

  const go = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (p <= 1) params.delete(paramName);
    else params.set(paramName, String(p));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <button
        type="button"
        className={buttonClass}
        disabled={page <= 1}
        onClick={() => go(page - 1)}
      >
        ‹ Prev
      </button>
      <span className="text-xs text-neutral-500">
        Page {page} of {pageCount} · {total} {noun}
      </span>
      <button
        type="button"
        className={buttonClass}
        disabled={page >= pageCount}
        onClick={() => go(page + 1)}
      >
        Next ›
      </button>
    </div>
  );
}
