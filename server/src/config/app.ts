import { optionalEnv } from "./env.js";

// App-wide display config that both clients (mobile + web) need but
// shouldn't hardcode or guess from device/browser locale — currency being
// the concrete case that prompted this: NumberFormat.simpleCurrency() /
// Intl.NumberFormat(undefined, ...) infer from whatever locale the device
// happens to report, which silently rendered USD ($) instead of INR for
// users in India. Served once via GET /config and cached client-side so it
// still displays correctly offline (see LocalCache on mobile).
export const appConfig = {
  // ISO 4217 currency code (e.g. "INR", "USD") — not a symbol, so each
  // client's own Intl/NumberFormat can render it correctly for its locale.
  currencyCode: optionalEnv("CURRENCY_CODE", "INR"),
};
