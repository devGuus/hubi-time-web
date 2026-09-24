/**
 * Testes do CalculationService: jornada, intervalos, banco de horas e horas
 * extras. Porte 1:1 de tests/test_calculation_service.py (desktop).
 */
import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  averageTime,
  computeBreakMinutes,
  computeDay,
  computeElapsedMinutesUntilNow,
  computeWorkedMinutes,
  effectiveOvertimeRule,
  expectedMinutesForDay,
  overtimeValue,
  overtimeValueForPeriod,
  regularHoursValue,
  runningBalance,
  summarizePeriod,
  type DayCalculation,
  type ScheduleFields,
  type WorkRecordFields,
} from "./calculation-service";
import { DayType, DEFAULT_WEEKLY_HOURS } from "./constants";

function makeRecord(overrides: Partial<WorkRecordFields> = {}): WorkRecordFields {
  return {
    work_date: "2026-09-14", // segunda-feira
    entry_time: null,
    lunch_start: null,
    lunch_end: null,
    exit_time: null,
    day_type: DayType.NORMAL,
    ...overrides,
  };
}

function makeSchedule(overrides: Partial<ScheduleFields["weekly_hours"]> = {}): ScheduleFields {
  return { weekly_hours: { ...DEFAULT_WEEKLY_HOURS, ...overrides } };
}

function isComplete(record: WorkRecordFields): boolean {
  if (record.day_type !== DayType.NORMAL) return true;
  return Boolean(record.entry_time && record.lunch_start && record.lunch_end && record.exit_time);
}

describe("computeWorkedMinutes", () => {
  it("computa o total correto para um dia completo", () => {
    const record = makeRecord({
      entry_time: "08:00",
      lunch_start: "12:00",
      lunch_end: "13:00",
      exit_time: "18:00",
    });
    expect(computeWorkedMinutes(record)).toBe(9 * 60);
  });

  it("dia sem almoco usa entrada->saida diretamente", () => {
    const record = makeRecord({ entry_time: "09:00", exit_time: "13:00" });
    expect(computeWorkedMinutes(record)).toBe(4 * 60);
  });

  it("somente entrada preenchida conta zero minutos trabalhados", () => {
    const record = makeRecord({ entry_time: "08:00" });
    expect(computeWorkedMinutes(record)).toBe(0);
  });

  it("registro vazio conta zero", () => {
    expect(computeWorkedMinutes(makeRecord())).toBe(0);
  });
});

describe("computeBreakMinutes", () => {
  it("calcula o intervalo quando os dois horarios de almoco existem", () => {
    const record = makeRecord({ lunch_start: "12:00", lunch_end: "13:15" });
    expect(computeBreakMinutes(record)).toBe(75);
  });

  it("intervalo e zero quando incompleto", () => {
    expect(computeBreakMinutes(makeRecord({ lunch_start: "12:00" }))).toBe(0);
  });
});

describe("computeElapsedMinutesUntilNow", () => {
  it("dia em andamento antes do almoco", () => {
    const record = makeRecord({ entry_time: "08:00" });
    const now = new Date(2026, 8, 14, 10, 30);
    expect(computeElapsedMinutesUntilNow(record, now)).toBe(150);
  });

  it("dia em andamento depois do retorno do almoco", () => {
    const record = makeRecord({ entry_time: "08:00", lunch_start: "12:00", lunch_end: "13:00" });
    const now = new Date(2026, 8, 14, 15, 0);
    expect(computeElapsedMinutesUntilNow(record, now)).toBe(4 * 60 + 2 * 60);
  });
});

describe("expectedMinutesForDay", () => {
  it("dia normal usa a carga configurada", () => {
    const schedule = makeSchedule({ segunda: 8 });
    expect(expectedMinutesForDay("2026-09-14", DayType.NORMAL, schedule)).toBe(480);
  });

  it("folga nunca gera minutos previstos", () => {
    const schedule = makeSchedule({ segunda: 8 });
    expect(expectedMinutesForDay("2026-09-14", DayType.FOLGA, schedule)).toBe(0);
  });

  it("sem carga configurada retorna zero", () => {
    expect(expectedMinutesForDay("2026-09-14", DayType.NORMAL, null)).toBe(0);
  });
});

describe("registros incompletos", () => {
  it("dia normal e incompleto sem os 4 horarios", () => {
    expect(isComplete(makeRecord({ entry_time: "08:00" }))).toBe(false);
  });

  it("folga e sempre considerada completa", () => {
    expect(isComplete(makeRecord({ day_type: DayType.FOLGA }))).toBe(true);
  });

  it("dia completo com os 4 horarios", () => {
    expect(
      isComplete(
        makeRecord({ entry_time: "08:00", lunch_start: "12:00", lunch_end: "13:00", exit_time: "17:00" })
      )
    ).toBe(true);
  });
});

describe("banco de horas", () => {
  it("saldo acumulado soma dia a dia", () => {
    const schedule = makeSchedule({ segunda: 8, terca: 8, quarta: 8 });
    const records = [
      makeRecord({
        work_date: "2026-09-14",
        entry_time: "08:00",
        lunch_start: "12:00",
        lunch_end: "13:00",
        exit_time: "17:14",
      }), // +14min
      makeRecord({
        work_date: "2026-09-15",
        entry_time: "08:00",
        lunch_start: "12:00",
        lunch_end: "13:00",
        exit_time: "16:53",
      }), // -7min
      makeRecord({
        work_date: "2026-09-16",
        entry_time: "08:00",
        lunch_start: "12:00",
        lunch_end: "13:00",
        exit_time: "17:41",
      }), // +41min
    ];
    const days = records.map((r) => computeDay(r, schedule));
    const running = runningBalance(days);
    expect(running.map((r) => r.balance)).toEqual([14, 7, 48]);
  });

  it("totais do periodo", () => {
    const schedule = makeSchedule({ segunda: 8, terca: 8 });
    const records = [
      makeRecord({
        work_date: "2026-09-14",
        entry_time: "08:00",
        lunch_start: "12:00",
        lunch_end: "13:00",
        exit_time: "17:00",
      }),
      makeRecord({ work_date: "2026-09-15" }),
    ];
    const days = records.map((r) => computeDay(r, schedule));
    const summary = summarizePeriod(days, "2026-09-14", "2026-09-15");

    expect(summary.workedMinutes).toBe(8 * 60);
    expect(summary.expectedMinutes).toBe(16 * 60);
    expect(summary.workedMinutes - summary.expectedMinutes).toBe(-8 * 60);
    expect(summary.workedDaysCount).toBe(1);
    expect(summary.incompleteDaysCount).toBe(1);
  });
});

describe("horas extras e salario", () => {
  it("valor da hora extra aplica o multiplicador da regra", () => {
    const value = overtimeValue(60, new Decimal("20.00"), { percentage: new Decimal("50") });
    expect(value.toString()).toBe("30");
  });

  it("sem regra, usa o valor normal da hora", () => {
    const value = overtimeValue(60, new Decimal("20.00"), null);
    expect(value.toString()).toBe("20");
  });

  it("zero minutos extras gera valor zero", () => {
    const value = overtimeValue(0, new Decimal("20.00"), null);
    expect(value.toString()).toBe("0");
  });

  it("valor das horas normais exclui os minutos extras", () => {
    const value = regularHoursValue(540, 60, new Decimal("10.00"));
    expect(value.toString()).toBe("80");
  });

  it("media de horario", () => {
    expect(averageTime(["08:00", "08:30", "09:00"])).toBe("08:30");
  });

  it("media sem valores retorna null", () => {
    expect(averageTime([])).toBeNull();
  });
});

// Funcionalidade exclusiva da versao web (sem equivalente no desktop ainda):
// chegada antes do horario de entrada padrao nao conta como hora extra, a
// nao ser que o usuario marque explicitamente que aquele dia foi excecao.
describe("computeDay - chegada antecipada", () => {
  const scheduleWithEntry: ScheduleFields = {
    weekly_hours: DEFAULT_WEEKLY_HOURS,
    standard_entry_time: "08:00",
  };

  const fullDay = {
    entry_time: "07:40",
    lunch_start: "12:00",
    lunch_end: "13:00",
    exit_time: "17:00",
  };

  it("por padrao, chegar antes do horario nao conta como hora extra", () => {
    const record = makeRecord(fullDay);
    const day = computeDay(record, scheduleWithEntry);
    // 08:00-12:00 + 13:00-17:00 = 8h, igual ao esperado - sem hora extra.
    expect(day.workedMinutes).toBe(8 * 60);
    expect(day.balanceMinutes).toBe(0);
  });

  it("chegar depois do horario padrao nao e afetado pelo recorte", () => {
    const record = makeRecord({ ...fullDay, entry_time: "08:10" });
    const day = computeDay(record, scheduleWithEntry);
    expect(day.workedMinutes).toBe(8 * 60 - 10);
  });

  it("com a excecao do dia marcada, a chegada antecipada conta como hora extra", () => {
    const record = makeRecord(fullDay);
    const day = computeDay(record, scheduleWithEntry, undefined, { countEarlyArrivalAsOvertime: true });
    expect(day.workedMinutes).toBe(8 * 60 + 20);
    expect(day.balanceMinutes).toBe(20);
  });

  it("sem horario de entrada configurado, comportamento antigo se mantem (chegada antecipada conta)", () => {
    const record = makeRecord(fullDay);
    const day = computeDay(record, { weekly_hours: DEFAULT_WEEKLY_HOURS });
    expect(day.workedMinutes).toBe(8 * 60 + 20);
  });
});

// Funcionalidade exclusiva da versao web: piso legal de hora extra (CLT) -
// minimo 50% em dia normal, 100% aos domingos/feriados, mesmo sem nenhuma
// regra cadastrada pelo usuario.
describe("effectiveOvertimeRule - piso legal de hora extra", () => {
  const monday = { workDate: "2026-09-14", dayType: DayType.NORMAL }; // segunda-feira
  const sunday = { workDate: "2026-09-13", dayType: DayType.NORMAL }; // domingo
  const holiday = { workDate: "2026-09-14", dayType: DayType.FERIADO }; // feriado numa segunda

  it("sem regra cadastrada, dia normal usa o piso legal de 50%", () => {
    expect(effectiveOvertimeRule(monday, null).percentage.toString()).toBe("50");
  });

  it("sem regra cadastrada, domingo usa o piso legal de 100%", () => {
    expect(effectiveOvertimeRule(sunday, null).percentage.toString()).toBe("100");
  });

  it("sem regra cadastrada, feriado usa o piso legal de 100% mesmo em dia de semana", () => {
    expect(effectiveOvertimeRule(holiday, null).percentage.toString()).toBe("100");
  });

  it("regra cadastrada abaixo do piso legal e ignorada em favor do piso", () => {
    const rule = { percentage: new Decimal(30) };
    expect(effectiveOvertimeRule(monday, rule).percentage.toString()).toBe("50");
  });

  it("regra cadastrada acima do piso legal prevalece", () => {
    const rule = { percentage: new Decimal(70) };
    expect(effectiveOvertimeRule(monday, rule).percentage.toString()).toBe("70");
  });

  it("regra de 50% cadastrada nao reduz o piso de domingo para 50%", () => {
    const rule = { percentage: new Decimal(50) };
    expect(effectiveOvertimeRule(sunday, rule).percentage.toString()).toBe("100");
  });
});

describe("overtimeValueForPeriod", () => {
  function makeDay(overrides: Partial<DayCalculation>): DayCalculation {
    return {
      workDate: "2026-09-14",
      dayType: DayType.NORMAL,
      workedMinutes: 0,
      expectedMinutes: 0,
      balanceMinutes: 0,
      morningMinutes: 0,
      afternoonMinutes: 0,
      breakMinutes: 0,
      isComplete: true,
      isInProgress: false,
      ...overrides,
    };
  }

  it("aplica 50% em hora extra de dia normal e 100% em hora extra de domingo, sem regra cadastrada", () => {
    const weekdayOvertime = makeDay({ workDate: "2026-09-14", balanceMinutes: 60 }); // 1h extra, segunda
    const sundayOvertime = makeDay({ workDate: "2026-09-13", balanceMinutes: 60 }); // 1h extra, domingo
    const value = overtimeValueForPeriod([weekdayOvertime, sundayOvertime], new Decimal("10.00"), null);
    // 1h x 10 x 1.5 (segunda) + 1h x 10 x 2.0 (domingo) = 15 + 20 = 35
    expect(value.toString()).toBe("35");
  });

  it("dias sem saldo positivo nao entram na soma", () => {
    const noOvertime = makeDay({ balanceMinutes: -30 });
    const value = overtimeValueForPeriod([noOvertime], new Decimal("10.00"), null);
    expect(value.toString()).toBe("0");
  });
});
