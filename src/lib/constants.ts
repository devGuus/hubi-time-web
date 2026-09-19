/**
 * Constantes e enumeracoes compartilhadas. Espelha config/constants.py do
 * projeto desktop (Hubi-Time) - mesmos valores, mesmo comportamento.
 */

export const DayType = {
  NORMAL: "normal",
  FOLGA: "folga",
  FERIAS: "ferias",
  FERIADO: "feriado",
  ATESTADO: "atestado",
  AUSENCIA: "ausencia",
  OUTRO: "outro",
} as const;

export type DayType = (typeof DayType)[keyof typeof DayType];

export const DAY_TYPE_LABELS_PT: Record<DayType, string> = {
  normal: "Dia normal",
  folga: "Folga",
  ferias: "Ferias",
  feriado: "Feriado",
  atestado: "Atestado",
  ausencia: "Ausencia",
  outro: "Outro",
};

export function dayTypeCountsAsExpectedWorkday(dayType: DayType): boolean {
  return dayType === DayType.NORMAL;
}

export const RecordStatus = {
  ACTIVE: "active",
  ARCHIVED: "archived",
} as const;

export type RecordStatus = (typeof RecordStatus)[keyof typeof RecordStatus];

export const HistoryAction = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  ARCHIVE: "ARCHIVE",
  RESTORE: "RESTORE",
} as const;

export type HistoryAction = (typeof HistoryAction)[keyof typeof HistoryAction];

export const Theme = {
  LIGHT: "light",
  DARK: "dark",
} as const;

export type Theme = (typeof Theme)[keyof typeof Theme];

export const WEEKDAY_KEYS = [
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
  "domingo",
] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export const WEEKDAY_LABELS_PT: Record<WeekdayKey, string> = {
  segunda: "Segunda-feira",
  terca: "Terca-feira",
  quarta: "Quarta-feira",
  quinta: "Quinta-feira",
  sexta: "Sexta-feira",
  sabado: "Sabado",
  domingo: "Domingo",
};

export const MONTH_LABELS_PT: Record<number, string> = {
  1: "Janeiro",
  2: "Fevereiro",
  3: "Marco",
  4: "Abril",
  5: "Maio",
  6: "Junho",
  7: "Julho",
  8: "Agosto",
  9: "Setembro",
  10: "Outubro",
  11: "Novembro",
  12: "Dezembro",
};

/** JS Date.getDay(): 0=domingo..6=sabado. Mapeia para as chaves acima. */
export const JS_WEEKDAY_TO_KEY: Record<number, WeekdayKey> = {
  0: "domingo",
  1: "segunda",
  2: "terca",
  3: "quarta",
  4: "quinta",
  5: "sexta",
  6: "sabado",
};

export const DEFAULT_WEEKLY_HOURS: Record<WeekdayKey, number> = {
  segunda: 8,
  terca: 8,
  quarta: 8,
  quinta: 8,
  sexta: 8,
  sabado: 0,
  domingo: 0,
};

export const DEFAULT_MONTHLY_HOURS = 220;

export const MIN_PASSWORD_LENGTH = 8;

// Nao e um padrao fixo do GoTrue - confirme o valor real recebido no e-mail
// do seu projeto Supabase (Authentication > Email Templates > {{ .Token }}).
export const OTP_CODE_LENGTH = 8;

export const DATE_FORMAT_DISPLAY = "dd/MM/yyyy";
export const TIME_FORMAT_DISPLAY = "HH:mm";
