/** Validacoes de formulario e deteccao de inconsistencias de horario. */
import { MIN_PASSWORD_LENGTH } from "./constants";
import { timeToMinutes } from "./time";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`A senha deve ter no minimo ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("A senha deve conter ao menos uma letra maiuscula.");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("A senha deve conter ao menos um numero.");
  }
  return { isValid: errors.length === 0, errors };
}

export function passwordsMatch(password: string, confirmation: string): boolean {
  return password === confirmation && password.length > 0;
}

export interface TimeInconsistencyWarning {
  field: string;
  message: string;
}

const toMinutes = timeToMinutes;

/**
 * Detecta situacoes suspeitas nos horarios informados. Nao bloqueia o
 * salvamento - apenas sinaliza para o usuario decidir se corrige.
 */
export function detectTimeInconsistencies(
  entryTime: string | null,
  lunchStart: string | null,
  lunchEnd: string | null,
  exitTime: string | null
): TimeInconsistencyWarning[] {
  const warnings: TimeInconsistencyWarning[] = [];

  if (entryTime && lunchStart && toMinutes(lunchStart) < toMinutes(entryTime)) {
    warnings.push({
      field: "lunchStart",
      message: "A saida para o almoco e anterior ao horario de entrada.",
    });
  }
  if (lunchStart && lunchEnd && toMinutes(lunchEnd) < toMinutes(lunchStart)) {
    warnings.push({
      field: "lunchEnd",
      message: "O retorno do almoco e anterior a saida para o almoco.",
    });
  }
  if (lunchEnd && exitTime && toMinutes(exitTime) < toMinutes(lunchEnd)) {
    warnings.push({ field: "exitTime", message: "A saida e anterior ao retorno do almoco." });
  }
  if (entryTime && exitTime && !lunchStart && !lunchEnd && toMinutes(exitTime) < toMinutes(entryTime)) {
    warnings.push({ field: "exitTime", message: "A saida e anterior ao horario de entrada." });
  }
  if (entryTime && lunchStart && lunchEnd && exitTime) {
    const totalMinutes =
      toMinutes(exitTime) - toMinutes(entryTime) - (toMinutes(lunchEnd) - toMinutes(lunchStart));
    if (totalMinutes > 16 * 60) {
      warnings.push({
        field: "exitTime",
        message: "O total de horas trabalhadas no dia parece incomum (acima de 16h).",
      });
    }
  }
  return warnings;
}
