import { describe, expect, it } from "vitest";

import { hashRedemptionCode, normalizeRedemptionCode } from "./redemption-codes";

describe("normalizeRedemptionCode", () => {
  it("remove espacos nas pontas e converte para maiusculas", () => {
    expect(normalizeRedemptionCode("  hubi-7k2m-9qxt  ")).toBe("HUBI-7K2M-9QXT");
  });

  it("remove espacos internos", () => {
    expect(normalizeRedemptionCode("hubi 7k2m 9qxt")).toBe("HUBI7K2M9QXT");
  });
});

describe("hashRedemptionCode", () => {
  it("e deterministico para o mesmo codigo", () => {
    expect(hashRedemptionCode("HUBI-7K2M-9QXT")).toBe(hashRedemptionCode("HUBI-7K2M-9QXT"));
  });

  it("ignora diferenca de caixa e espacos (mesmo hash)", () => {
    expect(hashRedemptionCode("hubi-7k2m-9qxt")).toBe(hashRedemptionCode("  HUBI-7K2M-9QXT  "));
  });

  it("codigos diferentes geram hashes diferentes", () => {
    expect(hashRedemptionCode("HUBI-7K2M-9QXT")).not.toBe(hashRedemptionCode("HUBI-0000-0000"));
  });

  it("produz um hex de 64 caracteres (sha256)", () => {
    expect(hashRedemptionCode("HUBI-7K2M-9QXT")).toMatch(/^[0-9a-f]{64}$/);
  });
});
