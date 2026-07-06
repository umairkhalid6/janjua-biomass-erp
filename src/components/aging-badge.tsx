// Small presentational aging pill for ledger pages. Server-safe (no state,
// no handlers). Pass either a number of overdue days or a last-activity date;
// the bucket/tone logic lives in src/lib/aging.ts.

import {
  agingBucket,
  agingBucketFromDays,
  type AgingTone,
} from "@/lib/aging";

const TONE_CLASSES: Record<AgingTone, string> = {
  ok: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  warn: "bg-amber-50 text-amber-700 ring-amber-600/20",
  danger: "bg-red-50 text-red-700 ring-red-600/20",
};

const DOT_CLASSES: Record<AgingTone, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  danger: "bg-red-500",
};

export type AgingBadgeProps = {
  /** Days overdue; takes precedence over `date` when both are given. */
  daysOverdue?: number;
  /** Last payment/activity date; `null` renders the danger "No activity" pill. */
  date?: Date | string | null;
  className?: string;
};

export function AgingBadge({ daysOverdue, date, className }: AgingBadgeProps) {
  const bucket =
    typeof daysOverdue === "number"
      ? agingBucketFromDays(daysOverdue)
      : agingBucket(date ?? null);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE_CLASSES[bucket.tone]} ${className ?? ""}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[bucket.tone]}`}
        aria-hidden
      />
      {bucket.label}
    </span>
  );
}
