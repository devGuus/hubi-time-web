/** Formata durações como horas e minutos para não confundi-las com horas do relógio. */

export function formatMinutesAsHours(totalMinutes: number, showSign = false): string {
  let sign = "";
  let minutes = totalMinutes;
  if (minutes < 0) {
    sign = "-";
    minutes = Math.abs(minutes);
  } else if (showSign && minutes > 0) {
    sign = "+";
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${sign}${hours}h ${mins.toString().padStart(2, "0")}min`;
}

/** "HH:MM:SS" ou "HH:MM" (retorno do Postgres para colunas TIME) -> "HH:MM". */
export function formatTimeOrPlaceholder(value: string | null | undefined): string {
  if (!value) return "--:--";
  return value.slice(0, 5);
}

export function minutesToDecimalHours(totalMinutes: number): number {
  return Math.round((totalMinutes / 60) * 100) / 100;
}
