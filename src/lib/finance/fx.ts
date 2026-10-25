import { multiplyCents, type Money } from "./money";

export interface ExchangeRateRow {
  from_currency: string;
  to_currency: string;
  rate: number | string;
  rate_date: string; // yyyy-mm-dd
}

export interface ConversionResult {
  converted: Money | null;
  rateUsed: { rate: string; rateDate: string; inverse: boolean } | null;
  reason?: string;
}

/**
 * Convert using the most recent explicit rate on or before `onDate`.
 * Falls back to the inverse pair. Never guesses a rate.
 */
export function convert(
  m: Money,
  toCurrency: string,
  onDate: string,
  rates: ExchangeRateRow[],
): ConversionResult {
  const target = toCurrency.toUpperCase();
  if (m.currency === target) return { converted: m, rateUsed: null };
  const eligible = rates
    .filter((r) => r.rate_date <= onDate)
    .filter(
      (r) =>
        (r.from_currency === m.currency && r.to_currency === target) ||
        (r.from_currency === target && r.to_currency === m.currency),
    )
    .sort((a, b) => (a.rate_date < b.rate_date ? 1 : a.rate_date > b.rate_date ? -1 : 0));
  const newest = eligible[0];
  const best = eligible.find((r) => r.rate_date === newest?.rate_date && r.from_currency === m.currency) ?? newest;
  if (!best) {
    return {
      converted: null,
      rateUsed: null,
      reason: `No ${m.currency}→${target} exchange rate recorded on or before ${onDate}`,
    };
  }
  if (best.from_currency === m.currency) {
    return {
      converted: { cents: multiplyCents(m.cents, best.rate), currency: target },
      rateUsed: { rate: String(best.rate), rateDate: best.rate_date, inverse: false },
    };
  }
  // inverse: divide. Use 1/rate with 10 decimals.
  const inv = (1 / Number(best.rate)).toFixed(10);
  return {
    converted: { cents: multiplyCents(m.cents, inv), currency: target },
    rateUsed: { rate: inv, rateDate: best.rate_date, inverse: true },
  };
}
