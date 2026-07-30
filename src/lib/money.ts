// Shared money math for PKR amounts stored as Decimal(14,2).

// Half a paisa — tolerance for comparing 2-decimal amounts held as floats.
export const EPSILON = 0.005;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
