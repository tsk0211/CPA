// Fixed unit-of-measure list — deliberately closed rather than free text, so
// reports/filters stay reliable ("kg" vs "Kg" vs "kilograms" never
// fragments the data). Extend this list, not the validation logic, if a new
// unit is genuinely needed — the client mirrors this exact list.
export const UNITS = [
  "kg",
  "g",
  "ton",
  "liter",
  "ml",
  "gallon",
  "m",
  "cm",
  "ft",
  "inch",
  "sq.m",
  "sq.ft",
  "piece",
  "box",
  "bag",
  "roll",
  "sheet",
  "bundle",
  "set",
  "hour",
  "day",
  "lot",
] as const;

export type Unit = (typeof UNITS)[number];

export function isValidUnit(value: unknown): value is Unit {
  return typeof value === "string" && (UNITS as readonly string[]).includes(value);
}
