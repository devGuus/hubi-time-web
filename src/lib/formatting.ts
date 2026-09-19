/** Formatacao de duracoes de tempo para exibicao ("08h34"). */

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
  return `${sign}${hours.toString().padStart(2, "0")}h${mins.toString().padStart(2, "0")}`;
}

/** "HH:MM:SS" ou "HH:MM" (retorno do Postgres para colunas TIME) -> "HH:MM". */
export function formatTimeOrPlaceholder(value: string | null | undefined): string {
  if (!value) return "--:--";
  return value.slice(0, 5);
}

export function minutesToDecimalHours(totalMinutes: number): number {
  return Math.round((totalMinutes / 60) * 100) / 100;
}
