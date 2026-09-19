/**
 * Utilidades monetarias com Decimal (decimal.js) - nunca `number` puro para
 * valores financeiros sensiveis, pelo mesmo motivo do `Decimal` no Python.
 */
import { Decimal } from "decimal.js";

export function formatBRL(value: Decimal | null | undefined): string {
  if (value == null) return "R$ 0,00";
  const rounded = value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const negative = rounded.isNegative();
  const [integerPart, decimalPart] = rounded.abs().toFixed(2).split(".");

  let grouped = "";
  let remaining = integerPart;
  while (remaining.length > 3) {
    grouped = "." + remaining.slice(-3) + grouped;
    remaining = remaining.slice(0, -3);
  }
  grouped = remaining + grouped;

  return `${negative ? "-" : ""}R$ ${grouped},${decimalPart}`;
}

export function parseBRL(text: string): Decimal {
  const cleaned = text.trim().replace("R$", "").trim();
  if (!cleaned) return new Decimal(0);
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  try {
    return new Decimal(normalized);
  } catch {
    throw new Error(`Valor monetario invalido: ${text}`);
  }
}

export function roundCurrency(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
