/** Exportacao de relatorios em Excel (.xlsx), CSV e PDF - roda no navegador. */
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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

export async function exportCsv(
  filename: string,
  rows: Record<string, string>[],
  headers: string[]
): Promise<void> {
  const lines = [headers.join(";")];
  for (const row of rows) {
    lines.push(headers.map((h) => (row[h] ?? "").replace(/;/g, ",")).join(";"));
  }
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, filename);
}

export async function exportXlsx(
  filename: string,
  rows: Record<string, string>[],
  headers: string[],
  title: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(title.slice(0, 31));

  sheet.addRow(headers);
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };

  for (const row of rows) {
    sheet.addRow(headers.map((h) => row[h] ?? ""));
  }

  sheet.columns.forEach((column, index) => {
    const header = headers[index] ?? "";
    const maxLength = Math.max(header.length, ...rows.map((r) => (r[header] ?? "").length));
    column.width = Math.min(maxLength + 4, 40);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename
  );
}

export function exportPdf(
  filename: string,
  rows: Record<string, string>[],
  headers: string[],
  title: string
): void {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 15);
  autoTable(doc, {
    head: [headers],
    body: rows.map((row) => headers.map((h) => row[h] ?? "")),
    startY: 20,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [31, 41, 55] },
    alternateRowStyles: { fillColor: [249, 250, 251] },
  });
  doc.save(filename);
}

export const WORK_REPORT_HEADERS = [
  "Data",
  "Dia da semana",
  "Entrada",
  "Saida almoco",
  "Retorno",
  "Saida",
  "Horas trabalhadas",
  "Horas previstas",
  "Saldo",
  "Horas extras",
  "Tipo de dia",
  "Observacoes",
  "Status",
];

export const FINANCE_REPORT_HEADERS = [
  "Periodo",
  "Horas normais",
  "Horas extras",
  "Valor hora",
  "Valor normal",
  "Valor extra",
  "Total estimado",
];
