import type { BillingCurrency } from "@__NAME__/auth/config";

// Euro area members (ISO 3166-1 alpha-2). Everyone else outside the UK sees USD.
const EURO_AREA = new Set([
  "AT",
  "BE",
  "BG",
  "CY",
  "DE",
  "EE",
  "ES",
  "FI",
  "FR",
  "GR",
  "HR",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "PT",
  "SI",
  "SK",
]);

// The currency a visitor most likely pays in, from Vercel's IP country header. Only for showing
// prices: Stripe Checkout picks the charged currency itself from the customer's location.
export function visitorCurrency(
  country: string | null | undefined,
): BillingCurrency {
  const code = country?.toUpperCase();
  if (code === "GB") return "gbp";
  if (code && EURO_AREA.has(code)) return "eur";
  return "usd";
}

// Header Vercel sets on every request; absent locally, which falls back to USD.
export const COUNTRY_HEADER = "x-vercel-ip-country";

export function formatPrice(
  minorUnits: number,
  currency: BillingCurrency,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: minorUnits % 100 === 0 ? 0 : 2,
  }).format(minorUnits / 100);
}
