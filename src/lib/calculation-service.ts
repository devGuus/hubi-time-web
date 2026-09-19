/**
 * Calculos de jornada, banco de horas e horas extras.
 * Porte 1:1 de services/calculation_service.py (Hubi-Time desktop) -
 * mesmo comportamento, mesmos casos de teste. Modulo puro (sem I/O).
 */
import { Decimal } from "decimal.js";

import { DayType, dayTypeCountsAsExpectedWorkday, JS_WEEKDAY_TO_KEY, type WeekdayKey } from "./constants";
import { type DateISO, toIso, toLocalDate } from "./dates";
import { timeToMinutes } from "./time";

export interface WorkRecordFields {
  work_date: DateISO;
  entry_time: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  exit_time: string | null;
  day_type: DayType;
}

export interface ScheduleFields {
  weekly_hours: Record<WeekdayKey, number>;
}

export interface OvertimeRuleFields {
  percentage: Decimal;
}

export interface DayCalculation {
  workDate: DateISO;
  dayType: DayType;
  workedMinutes: number;
  expectedMinutes: number;
  balanceMinutes: number;
  morningMinutes: number;
  afternoonMinutes: number;
  breakMinutes: number;
  isComplete: boolean;
  isInProgress: boolean;
}

export function overtimeMinutesOf(day: DayCalculation): number {
  return Math.max(day.balanceMinutes, 0);
}

export function deficitMinutesOf(day: DayCalculation): number {
  return Math.max(-day.balanceMinutes, 0);
}

export interface PeriodSummary {
  startDate: DateISO;
  endDate: DateISO;
  expectedMinutes: number;
  workedMinutes: number;
  workedDaysCount: number;
  incompleteDaysCount: number;
  days: DayCalculation[];
}

export function balanceMinutesOf(summary: PeriodSummary): number {
  return summary.workedMinutes - summary.expectedMinutes;
}

export function overtimeMinutesOfPeriod(summary: PeriodSummary): number {
  return summary.days.reduce((total, d) => total + overtimeMinutesOf(d), 0);
}

export function averageDailyMinutesOf(summary: PeriodSummary): number {
  if (summary.workedDaysCount === 0) return 0;
  return Math.floor(summary.workedMinutes / summary.workedDaysCount);
}

function isRecordComplete(record: WorkRecordFields): boolean {
  if (!dayTypeCountsAsExpectedWorkday(record.day_type)) return true;
  return Boolean(record.entry_time && record.lunch_start && record.lunch_end && record.exit_time);
}

/** Minutos efetivamente trabalhados, a partir dos horarios preenchidos. */
export function computeWorkedMinutes(record: WorkRecordFields): number {
  let total = 0;
  const hasLunchPair = Boolean(record.lunch_start && record.lunch_end);

  if (record.entry_time && record.lunch_start) {
    total += Math.max(timeToMinutes(record.lunch_start) - timeToMinutes(record.entry_time), 0);
  }
  if (hasLunchPair && record.exit_time) {
    total += Math.max(timeToMinutes(record.exit_time!) - timeToMinutes(record.lunch_end!), 0);
  }
  if (record.entry_time && record.exit_time && !record.lunch_start && !record.lunch_end) {
    total += Math.max(timeToMinutes(record.exit_time) - timeToMinutes(record.entry_time), 0);
  }
  return total;
}

export function computeBreakMinutes(record: WorkRecordFields): number {
  if (record.lunch_start && record.lunch_end) {
    return Math.max(timeToMinutes(record.lunch_end) - timeToMinutes(record.lunch_start), 0);
  }
  return 0;
}

/** Horas trabalhadas ate o momento atual, para um dia em andamento. */
export function computeElapsedMinutesUntilNow(record: WorkRecordFields, now: Date): number {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let total = 0;

  if (record.entry_time && record.lunch_start) {
    total += Math.max(timeToMinutes(record.lunch_start) - timeToMinutes(record.entry_time), 0);
  } else if (record.entry_time && !record.lunch_start) {
    return Math.max(currentMinutes - timeToMinutes(record.entry_time), 0);
  }

  if (record.lunch_end && record.exit_time) {
    total += Math.max(timeToMinutes(record.exit_time) - timeToMinutes(record.lunch_end), 0);
  } else if (record.lunch_end && !record.exit_time) {
    total += Math.max(currentMinutes - timeToMinutes(record.lunch_end), 0);
  }

  return total;
}

/** Carga prevista para o dia. Dias que nao contam nao geram saldo negativo. */
export function expectedMinutesForDay(
  workDate: DateISO,
  dayType: DayType,
  schedule: ScheduleFields | null
): number {
  if (!dayTypeCountsAsExpectedWorkday(dayType)) return 0;
  if (!schedule) return 0;
  const weekdayKey = JS_WEEKDAY_TO_KEY[toLocalDate(workDate).getDay()];
  const hours = schedule.weekly_hours[weekdayKey] ?? 0;
  return Math.round(hours * 60);
}

export function computeDay(
  record: WorkRecordFields,
  schedule: ScheduleFields | null,
  now?: Date
): DayCalculation {
  let worked = computeWorkedMinutes(record);
  const expected = expectedMinutesForDay(record.work_date, record.day_type, schedule);
  const morning =
    record.entry_time && record.lunch_start
      ? Math.max(timeToMinutes(record.lunch_start) - timeToMinutes(record.entry_time), 0)
      : 0;
  const afternoon =
    record.lunch_end && record.exit_time
      ? Math.max(timeToMinutes(record.exit_time) - timeToMinutes(record.lunch_end), 0)
      : 0;

  const isComplete = isRecordComplete(record);
  const isInProgress = Boolean(record.entry_time) && !isComplete;

  if (now && record.work_date === toIso(now) && isInProgress) {
    worked = computeElapsedMinutesUntilNow(record, now);
  }

  return {
    workDate: record.work_date,
    dayType: record.day_type,
    workedMinutes: worked,
    expectedMinutes: expected,
    balanceMinutes: worked - expected,
    morningMinutes: morning,
    afternoonMinutes: afternoon,
    breakMinutes: computeBreakMinutes(record),
    isComplete,
    isInProgress,
  };
}

export function summarizePeriod(
  days: DayCalculation[],
  startDate: DateISO,
  endDate: DateISO
): PeriodSummary {
  const workedDays = days.filter((d) => d.workedMinutes > 0);
  const incompleteDays = days.filter(
    (d) => dayTypeCountsAsExpectedWorkday(d.dayType) && !d.isComplete
  );
  return {
    startDate,
    endDate,
    expectedMinutes: days.reduce((t, d) => t + d.expectedMinutes, 0),
    workedMinutes: days.reduce((t, d) => t + d.workedMinutes, 0),
    workedDaysCount: workedDays.length,
    incompleteDaysCount: incompleteDays.length,
    days,
  };
}

/** Saldo acumulado (banco de horas) dia a dia, a partir de um saldo inicial. */
export function runningBalance(
  days: DayCalculation[],
  startingBalance = 0
): { date: DateISO; balance: number }[] {
  let running = startingBalance;
  const sorted = [...days].sort((a, b) => (a.workDate < b.workDate ? -1 : a.workDate > b.workDate ? 1 : 0));
  return sorted.map((day) => {
    running += day.balanceMinutes;
    return { date: day.workDate, balance: running };
  });
}

export function averageTime(times: (string | null | undefined)[]): string | null {
  const valid = times.filter((t): t is string => Boolean(t));
  if (valid.length === 0) return null;
  const totalMinutes = valid.reduce((sum, t) => sum + timeToMinutes(t), 0);
  const avgMinutes = Math.round(totalMinutes / valid.length);
  const h = Math.floor(avgMinutes / 60) % 24;
  const m = avgMinutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/** Estimativa de valor de horas extras. Sem regra configurada, usa 1x. */
export function overtimeValue(
  overtimeMinutes: number,
  hourlyRate: Decimal,
  rule: OvertimeRuleFields | null
): Decimal {
  if (overtimeMinutes <= 0) return new Decimal(0).toDecimalPlaces(2);
  const multiplier = rule ? new Decimal(1).plus(rule.percentage.dividedBy(100)) : new Decimal(1);
  const hours = new Decimal(overtimeMinutes).dividedBy(60);
  return hours.times(hourlyRate).times(multiplier).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function regularHoursValue(
  workedMinutes: number,
  overtimeMinutes: number,
  hourlyRate: Decimal
): Decimal {
  const regularMinutes = Math.max(workedMinutes - overtimeMinutes, 0);
  const hours = new Decimal(regularMinutes).dividedBy(60);
  return hours.times(hourlyRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
