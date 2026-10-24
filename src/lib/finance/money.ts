/**
 * Decimal-safe money primitives. All amounts are held as bigint minor units
 * (cents, 2 decimal places). Rounding rule: half away from zero.
 * Amounts in different currencies are NEVER added together implicitly.
 */

export type CurrencyCode = string; // ISO 4217, upper-case

export interface Money {
  cents: bigint;
  currency: CurrencyCode;
}

const SCALE = 100n;

/** Parse a decimal value (number or string from the database) to cents. */
export function toCents(value: number | string | null | undefined): bigint {
  if (value === null || value === undefined || value === "") return 0n;
  const str = typeof value === "number" ? value.toFixed(6) : String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(str)) throw new Error(`Invalid monetary value: ${value}`);
  const negative = str.startsWith("-");
  const [intPart, fracRaw = ""] = str.replace("-", "").split(".");
  const frac = (fracRaw + "000").slice(0, 3); // keep one extra digit for rounding
  let cents = BigInt(intPart ?? "0") * SCALE + BigInt(frac.slice(0, 2));
  if (Number(frac[2]) >= 5) cents += 1n;
  return negative ? -cents : cents;
}

export function centsToString(cents: bigint): string {
  const neg = cents < 0n;
  const abs = neg ? -cents : cents;
  const s = `${abs / SCALE}.${(abs % SCALE).toString().padStart(2, "0")}`;
  return neg ? `-${s}` : s;
}

export function centsToNumber(cents: bigint): number {
  return Number(centsToString(cents));
}

export function money(value: number | string, currency: CurrencyCode): Money {
  return { cents: toCents(value), currency: currency.toUpperCase() };
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot add ${a.currency} and ${b.currency} without an explicit conversion`);
  }
  return { cents: a.cents + b.cents, currency: a.currency };
}

/** Multiply cents by a decimal rate string/number, rounding half away from zero. */
export function multiplyCents(cents: bigint, rate: number | string): bigint {
  const str = typeof rate === "number" ? rate.toFixed(10) : String(rate);
  if (!/^\d+(\.\d+)?$/.test(str)) throw new Error(`Invalid rate: ${rate}`);
  const [i, f = ""] = str.split(".");
  const frac = (f + "0000000000").slice(0, 10);
  const scaled = BigInt(i + frac); // rate * 1e10
  const product = cents * scaled;
  const divisor = 10_000_000_000n;
  const q = product / divisor;
  const r = product % divisor;
  const absR = r < 0n ? -r : r;
  if (absR * 2n >= divisor) return product < 0n ? q - 1n : q + 1n;
  return q;
}

/** Percentage (0-100) with 1 decimal, or null if base is zero. */
export function percent(part: bigint, whole: bigint): number | null {
  if (whole === 0n) return null;
  return Number((part * 1000n) / whole) / 10;
}

/** A bag of per-currency totals; used whenever no conversion is available. */
export type CurrencyTotals = Record<CurrencyCode, bigint>;

export function addToTotals(totals: CurrencyTotals, m: Money): CurrencyTotals {
  totals[m.currency] = (totals[m.currency] ?? 0n) + m.cents;
  return totals;
}

export function serializeTotals(t: CurrencyTotals): Record<string, string> {
  return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, centsToString(v)]));
}
