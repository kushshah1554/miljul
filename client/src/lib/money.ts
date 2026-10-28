// Money stays in integer cents on the client so float math never touches it.

/** Decimal string with at most 2 decimals, mirroring the server's amount format. */
export const AMOUNT_RE = /^\d{1,10}(\.\d{1,2})?$/;

/** "12.5" → 1250. Input must already match the 2-decimal amount format. */
export function toCents(amount: string) {
  return Math.round(Number(amount) * 100);
}

/** 1250 → "12.50" */
export function fromCents(cents: number) {
  return (cents / 100).toFixed(2);
}

/** Split cents into n near-equal parts; leftover cents go to the first parts. */
export function splitEqually(totalCents: number, n: number) {
  const base = Math.floor(totalCents / n);
  const remainder = totalCents % n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}
