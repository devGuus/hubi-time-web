/** Importacao de registros de jornada a partir de arquivos CSV/XLSX. */
import ExcelJS from "exceljs";

import { DayType, DAY_TYPE_LABELS_PT } from "./constants";
import { parseDateBR, toIso, type DateISO } from "./dates";
import { detectTimeInconsistencies } from "./validators";

export const IMPORT_HEADERS = [
  "Data",
  "Entrada",
  "Saida almoco",
  "Retorno",
  "Saida",
  "Tipo de dia",
  "Observacoes",
] as const;

const LABEL_TO_DAY_TYPE: Record<string, DayType> = Object.fromEntries(
  Object.entries(DAY_TYPE_LABELS_PT).map(([key, label]) => [normalize(label), key as DayType])
);
for (const key of Object.values(DayType)) {
  LABEL_TO_DAY_TYPE[normalize(key)] = key;
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

export interface ParsedImportRow {
  rowNumber: number;
  workDate: DateISO | null;
  entryTime: string | null;
  lunchStart: string | null;
  lunchEnd: string | null;
  exitTime: string | null;
  dayType: DayType;
  notes: string | null;
  errors: string[];
  warnings: string[];
}

function parseTime(raw: string | null | undefined, field: string, errors: string[]): string | null {
  const text = (raw ?? "").toString().trim();
  if (!text) return null;
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(text);
  if (!match) {
    errors.push(`${field}: horario invalido ("${text}"), use o formato HH:MM.`);
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    errors.push(`${field}: horario invalido ("${text}").`);
    return null;
  }
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function parseDate(raw: string | Date | null | undefined, errors: string[]): DateISO | null {
  if (raw instanceof Date) return toIso(raw);
  const text = (raw ?? "").toString().trim();
  if (!text) {
    errors.push("Data: campo obrigatorio.");
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
    const [d, m, y] = text.split("/");
    return parseDateBR(`${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`);
  }
  errors.push(`Data: formato invalido ("${text}"), use DD/MM/AAAA.`);
  return null;
}

function parseDayType(raw: string | null | undefined, errors: string[]): DayType {
  const text = (raw ?? "").toString().trim();
  if (!text) return DayType.NORMAL;
  const found = LABEL_TO_DAY_TYPE[normalize(text)];
  if (!found) {
    errors.push(`Tipo de dia: valor desconhecido ("${text}"), usando "Dia normal".`);
    return DayType.NORMAL;
  }
  return found;
}

function toRow(rowNumber: number, cells: Record<string, string | Date | null | undefined>): ParsedImportRow {
  const errors: string[] = [];
  const workDate = parseDate(cells["Data"], errors);
  const entryTime = parseTime(cells["Entrada"] as string, "Entrada", errors);
  const lunchStart = parseTime(cells["Saida almoco"] as string, "Saida almoco", errors);
  const lunchEnd = parseTime(cells["Retorno"] as string, "Retorno", errors);
  const exitTime = parseTime(cells["Saida"] as string, "Saida", errors);
  const dayType = parseDayType(cells["Tipo de dia"] as string, errors);
  const notes = (cells["Observacoes"] ?? "").toString().trim() || null;

  const warnings = detectTimeInconsistencies(entryTime, lunchStart, lunchEnd, exitTime).map((w) => w.message);

  return { rowNumber, workDate, entryTime, lunchStart, lunchEnd, exitTime, dayType, notes, errors, warnings };
}

/** Parser de CSV simples com suporte a campos entre aspas (para observacoes com virgula/ponto-e-virgula). */
function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === "," || char === ";") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      // ignorado - tratado junto com \n
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

async function parseCsvFile(file: File): Promise<ParsedImportRow[]> {
  const text = await file.text();
  const rows = parseCsvText(text.replace(/^﻿/, ""));
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cells, index) => {
    const record: Record<string, string> = {};
    headers.forEach((header, col) => {
      record[header] = cells[col] ?? "";
    });
    return toRow(index + 2, record);
  });
}

async function parseXlsxFile(file: File): Promise<ParsedImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = (cell.value ?? "").toString().trim();
  });

  const result: ParsedImportRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, string | Date | null> = {};
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const header = headers[col];
      if (!header) return;
      const value = cell.value;
      record[header] = value instanceof Date ? value : value == null ? "" : value.toString();
    });
    result.push(toRow(rowNumber, record));
  });
  return result;
}

export async function parseImportFile(file: File): Promise<ParsedImportRow[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) return parseCsvFile(file);
  if (name.endsWith(".xlsx")) return parseXlsxFile(file);
  throw new Error("Formato de arquivo nao suportado. Envie um arquivo .csv, .txt ou .xlsx.");
}

const TEMPLATE_ROWS: Record<string, string>[] = [
  {
    Data: "01/03/2026",
    Entrada: "08:00",
    "Saida almoco": "12:00",
    Retorno: "13:00",
    Saida: "17:00",
    "Tipo de dia": "Dia normal",
    Observacoes: "",
  },
  {
    Data: "02/03/2026",
    Entrada: "",
    "Saida almoco": "",
    Retorno: "",
    Saida: "",
    "Tipo de dia": "Folga",
    Observacoes: "Exemplo de dia sem expediente",
  },
];

export async function downloadImportTemplateCsv(): Promise<void> {
  const lines = [IMPORT_HEADERS.join(";")];
  for (const row of TEMPLATE_ROWS) {
    lines.push(IMPORT_HEADERS.map((h) => row[h] ?? "").join(";"));
  }
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, "modelo_importacao_hubi_time.csv");
}

export async function downloadImportTemplateXlsx(): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Modelo");
  sheet.addRow([...IMPORT_HEADERS]);
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  for (const row of TEMPLATE_ROWS) {
    sheet.addRow(IMPORT_HEADERS.map((h) => row[h] ?? ""));
  }
  sheet.columns.forEach((column, index) => {
    const header = IMPORT_HEADERS[index] ?? "";
    column.width = Math.max(header.length + 4, 14);
  });
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    "modelo_importacao_hubi_time.xlsx"
  );
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
