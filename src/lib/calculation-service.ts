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
  /** Horario de entrada padrao ("HH:MM"). Usado para decidir chegada antecipada. */
  standard_entry_time?: string | null;
}

export interface DayOvertimeOptions {
  /** Se true, chegar antes do standard_entry_time conta como hora extra (sem "clipping"). */
  countEarlyArrivalAsOvertime?: boolean;
}

/** Resolve a opcao efetiva do dia: excecao do proprio registro, se marcada,
 * senao a configuracao geral do usuario. */
export function resolveOvertimeOptions(
  recordFlag: boolean | null | undefined,
  globalSetting: boolean | null | undefined
): DayOvertimeOptions {
  return { countEarlyArrivalAsOvertime: recordFlag ?? globalSetting ?? false };
}

/** Recorta o horario de entrada para o padrao configurado quando a chegada
 * antecipada nao deve contar como hora extra - so afeta os minutos
 * calculados, nunca o horario exibido/guardado. */
function clipEarlyArrival(
  record: WorkRecordFields,
  schedule: ScheduleFields | null,
  options?: DayOvertimeOptions
): WorkRecordFields {
  if (options?.countEarlyArrivalAsOvertime) return record;
  const standardEntry = schedule?.standard_entry_time;
  if (!standardEntry || !record.entry_time) return record;
  if (timeToMinutes(record.entry_time) >= timeToMinutes(standardEntry)) return record;
  return { ...record, entry_time: standardEntry };
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
  now?: Date,
  options?: DayOvertimeOptions
): DayCalculation {
  const effective = clipEarlyArrival(record, schedule, options);
  let worked = computeWorkedMinutes(effective);
  const expected = expectedMinutesForDay(record.work_date, record.day_type, schedule);
  const morning =
    effective.entry_time && effective.lunch_start
      ? Math.max(timeToMinutes(effective.lunch_start) - timeToMinutes(effective.entry_time), 0)
      : 0;
  const afternoon =
    effective.lunch_end && effective.exit_time
      ? Math.max(timeToMinutes(effective.exit_time) - timeToMinutes(effective.lunch_end), 0)
      : 0;

  const isComplete = isRecordComplete(record);
  const isInProgress = Boolean(record.entry_time) && !isComplete;

  if (now && record.work_date === toIso(now) && isInProgress) {
    worked = computeElapsedMinutesUntilNow(effective, now);
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

/** Acrescimo legal minimo de hora extra no Brasil (CLT): 50% em dias uteis,
 * 100% aos domingos e feriados - se aplica mesmo sem nenhuma regra cadastrada. */
const LEGAL_MINIMUM_OVERTIME_PERCENTAGE_WEEKDAY = 50;
const LEGAL_MINIMUM_OVERTIME_PERCENTAGE_SUNDAY_OR_HOLIDAY = 100;

/** Regra de hora extra efetiva para um dia: nunca abaixo do piso legal (50%
 * em dia normal, 100% aos domingos/feriados), mesmo sem regra cadastrada ou
 * com uma regra cadastrada abaixo do minimo. Uma regra cadastrada so se
 * aplica quando e mais vantajosa que o piso legal daquele dia. */
export function effectiveOvertimeRule(
  day: Pick<DayCalculation, "workDate" | "dayType">,
  customRule: OvertimeRuleFields | null
): OvertimeRuleFields {
  const isSundayOrHoliday =
    day.dayType === DayType.FERIADO || JS_WEEKDAY_TO_KEY[toLocalDate(day.workDate).getDay()] === "domingo";
  const legalMinimum = new Decimal(
    isSundayOrHoliday ? LEGAL_MINIMUM_OVERTIME_PERCENTAGE_SUNDAY_OR_HOLIDAY : LEGAL_MINIMUM_OVERTIME_PERCENTAGE_WEEKDAY
  );
  if (!customRule) return { percentage: legalMinimum };
  return { percentage: Decimal.max(customRule.percentage, legalMinimum) };
}

/** Estimativa de valor de horas extras, para um percentual ja resolvido
 * (veja `effectiveOvertimeRule` para aplicar o piso legal por dia). */
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

/** Soma o valor de hora extra de varios dias, aplicando o piso legal
 * (50%/100%) de cada dia individualmente - use esta funcao para um periodo,
 * em vez de somar os minutos primeiro e aplicar um unico percentual. */
export function overtimeValueForPeriod(
  days: DayCalculation[],
  hourlyRate: Decimal,
  customRule: OvertimeRuleFields | null
): Decimal {
  return days
    .reduce((total, day) => {
      const minutes = overtimeMinutesOf(day);
      if (minutes <= 0) return total;
      const rule = effectiveOvertimeRule(day, customRule);
      return total.plus(overtimeValue(minutes, hourlyRate, rule));
    }, new Decimal(0))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
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
