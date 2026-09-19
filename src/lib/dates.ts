/**
 * Utilidades de data. Datas de jornada circulam como strings ISO
 * "YYYY-MM-DD" (mesmo formato que o Postgres/Supabase usa para colunas
 * `date`), nunca como `Date` construido a partir de string (isso interpreta
 * a data como UTC meia-noite, que em fusos negativos como o do Brasil
 * "volta" um dia ao formatar em hora local - um bug classico de JS).
 */
import { JS_WEEKDAY_TO_KEY, MONTH_LABELS_PT, WEEKDAY_LABELS_PT, type WeekdayKey } from "./constants";

export type DateISO = string; // "YYYY-MM-DD"

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Constroi um Date em horario LOCAL (nunca UTC) a partir de "YYYY-MM-DD". */
export function toLocalDate(iso: DateISO): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Formata um Date (horario local) de volta para "YYYY-MM-DD". */
export function toIso(date: Date): DateISO {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Data atual do computador do usuario, em horario local. */
export function todayIso(): DateISO {
  return toIso(new Date());
}

export function weekdayKeyOf(iso: DateISO): WeekdayKey {
  return JS_WEEKDAY_TO_KEY[toLocalDate(iso).getDay()];
}

export function weekdayLabel(iso: DateISO): string {
  return WEEKDAY_LABELS_PT[weekdayKeyOf(iso)];
}

export function monthLabel(month: number): string {
  return MONTH_LABELS_PT[month];
}

/** "YYYY-MM-DD" -> "DD/MM/YYYY". Puramente textual, sem risco de fuso. */
export function formatDateBR(iso: DateISO | null | undefined): string {
  if (!iso) return "--/--/----";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** "DD/MM/YYYY" -> "YYYY-MM-DD". */
export function parseDateBR(text: string): DateISO {
  const [d, m, y] = text.split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export function addDays(iso: DateISO, days: number): DateISO {
  const date = toLocalDate(iso);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

export function addMonthsIso(iso: DateISO, months: number): DateISO {
  const date = toLocalDate(iso);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDayOfTargetMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDayOfTargetMonth));
  return toIso(date);
}

export function monthRange(year: number, month: number): [DateISO, DateISO] {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  return [toIso(first), toIso(last)];
}

export function weekRange(iso: DateISO): [DateISO, DateISO] {
  const date = toLocalDate(iso);
  const jsDay = date.getDay(); // 0=domingo..6=sabado
  const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return [toIso(monday), toIso(sunday)];
}

export function yearRange(year: number): [DateISO, DateISO] {
  return [`${year}-01-01`, `${year}-12-31`];
}

export function iterDates(start: DateISO, end: DateISO): DateISO[] {
  const result: DateISO[] = [];
  let current = start;
  while (current <= end) {
    result.push(current);
    current = addDays(current, 1);
  }
  return result;
}

export function compareDates(a: DateISO, b: DateISO): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
