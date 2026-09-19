/** Porte 1:1 de tests/test_validators.py (desktop). */
import { describe, expect, it } from "vitest";

import {
  detectTimeInconsistencies,
  isValidEmail,
  passwordsMatch,
  validatePassword,
} from "./validators";

describe("isValidEmail", () => {
  it("aceita e-mail valido", () => expect(isValidEmail("usuario@empresa.com")).toBe(true));
  it("rejeita sem arroba", () => expect(isValidEmail("usuario.empresa.com")).toBe(false));
  it("rejeita sem dominio", () => expect(isValidEmail("usuario@")).toBe(false));
});

describe("validatePassword", () => {
  it("senha forte e valida", () => {
    const result = validatePassword("Senha1234");
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("senha curta e invalida", () => {
    expect(validatePassword("Ab1").isValid).toBe(false);
  });

  it("senha sem maiuscula e invalida", () => {
    const result = validatePassword("senha1234");
    expect(result.errors.some((e) => e.includes("maiuscula"))).toBe(true);
  });

  it("senha sem numero e invalida", () => {
    const result = validatePassword("SenhaSegura");
    expect(result.errors.some((e) => e.includes("numero"))).toBe(true);
  });

  it("passwordsMatch compara corretamente", () => {
    expect(passwordsMatch("Senha1234", "Senha1234")).toBe(true);
    expect(passwordsMatch("Senha1234", "Outra1234")).toBe(false);
    expect(passwordsMatch("", "")).toBe(false);
  });
});

describe("detectTimeInconsistencies", () => {
  it("entrada depois do inicio do almoco e sinalizada", () => {
    const warnings = detectTimeInconsistencies("18:00", "12:00", null, null);
    expect(warnings.some((w) => w.field === "lunchStart")).toBe(true);
  });

  it("retorno antes da saida para o almoco e sinalizado", () => {
    const warnings = detectTimeInconsistencies("08:00", "12:30", "11:50", null);
    expect(warnings.some((w) => w.field === "lunchEnd")).toBe(true);
  });

  it("saida antes do retorno do almoco e sinalizada", () => {
    const warnings = detectTimeInconsistencies("08:00", "12:00", "13:00", "12:30");
    expect(warnings.some((w) => w.field === "exitTime")).toBe(true);
  });

  it("dia completo e consistente nao gera avisos", () => {
    expect(detectTimeInconsistencies("08:00", "12:00", "13:00", "18:00")).toEqual([]);
  });

  it("dia parcial com apenas entrada nao gera avisos", () => {
    expect(detectTimeInconsistencies("08:00", null, null, null)).toEqual([]);
  });
});
