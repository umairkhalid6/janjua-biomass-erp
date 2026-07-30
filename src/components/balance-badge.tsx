import { EPSILON } from "@/lib/money";
import { formatPKR } from "@/lib/format";

// Three-state supplier balance pill: positive = we owe them (amber),
// negative = they hold our advance (green), otherwise settled (neutral).
export function BalanceBadge({ balance }: { balance: number }) {
  const base =
    "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium";
  if (balance > EPSILON) {
    return (
      <span
        className={`${base} bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300`}
      >
        Owed {formatPKR(balance)}
      </span>
    );
  }
  if (balance < -EPSILON) {
    return (
      <span
        className={`${base} bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400`}
      >
        Advance {formatPKR(-balance)}
      </span>
    );
  }
  return (
    <span
      className={`${base} bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400`}
    >
      Clear
    </span>
  );
}
