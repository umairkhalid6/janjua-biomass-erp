import type { Formatter } from "recharts/types/component/DefaultTooltipContent";

// Recharts Tooltip `formatter` prop type. Value/name may be undefined or an
// array; coerce with Number()/String() inside the formatter body.
export type TooltipFormatter = Formatter;

// Small consistent chart palette that reads well in light mode.
// Referenced by every chart in src/components/charts/.
export const CHART = {
  green: "#16a34a", // profit / positive
  red: "#dc2626", // loss / negative
  blue: "#2563eb", // sales / revenue
  amber: "#d97706", // cost / owed
  slate: "#64748b", // neutral / total
  indigo: "#4f46e5",
  teal: "#0d9488",
} as const;

// Rotating series colors for stacked/multi-series charts (e.g. materials).
export const SERIES = [
  CHART.amber,
  CHART.teal,
  CHART.indigo,
  CHART.blue,
  CHART.slate,
] as const;

export const AXIS_TICK = { fontSize: 11, fill: "#64748b" };
export const GRID_STROKE = "#e5e7eb";
