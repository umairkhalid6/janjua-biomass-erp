// Page slicing for the list pages. Rows are filtered (and totalled) before
// this runs, so `total`/`pageCount` describe the filtered set; a stale page
// number left behind by a filter or month change clamps to the last page.

export const PAGE_SIZE = 10;

export type Paginated<T> = {
  page: number;
  pageCount: number;
  total: number;
  pageRows: T[];
};

export function paginate<T>(rows: T[], pageParam: string | undefined): Paginated<T> {
  const requested = Math.floor(Number(pageParam ?? "1"));
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(
    Math.max(1, Number.isFinite(requested) ? requested : 1),
    pageCount
  );
  return {
    page,
    pageCount,
    total: rows.length,
    pageRows: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
  };
}

/** Numeric query param → number, or null when absent/garbage. */
export function parseNumberParam(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
