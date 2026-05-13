/**
 * Centralized number / currency formatters.
 * Use across the app so prices, counts, and stats look consistent.
 */

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrFormatterWithPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const numberFormatter = new Intl.NumberFormat("en-IN");

/** ₹1,299  (no paise). Pass `withPaise: true` for ₹1,299.00 */
export function formatINR(amount: number | null | undefined, withPaise = false): string {
  if (amount == null || isNaN(Number(amount))) return "₹0";
  return withPaise ? inrFormatterWithPaise.format(Number(amount)) : inrFormatter.format(Number(amount));
}

/** 1.2K, 12K, 1.2L, 1.2Cr — short form for views/counts */
export function formatCompact(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return "0";
  return compactFormatter.format(Number(n));
}

/** 1,23,456 — Indian grouping */
export function formatNumber(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return "0";
  return numberFormatter.format(Number(n));
}
