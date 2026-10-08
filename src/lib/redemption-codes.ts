/**
 * Normalizacao e hash de codigos de resgate (presentes/promocoes). O codigo
 * em texto puro nunca e gravado no banco - so o hash SHA-256 normalizado (ver
 * redemption_codes_migration_2026_10_07.sql). A normalizacao precisa ser
 * idêntica na geracao (scripts/generate-redemption-codes.mjs) e no resgate
 * (api/redeem-code), ou o hash nunca bate.
 */
import { createHash } from "crypto";

export function normalizeRedemptionCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function hashRedemptionCode(raw: string): string {
  return createHash("sha256").update(normalizeRedemptionCode(raw)).digest("hex");
}
