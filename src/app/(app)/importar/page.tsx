"use client";

/** Tela de importacao: le arquivos CSV/XLSX com registros antigos e salva no banco. */
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  FileUp,
  Loader2,
  Sparkles,
  XCircle,
} from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { DAY_TYPE_LABELS_PT } from "@/lib/constants";
import { formatDateBR } from "@/lib/dates";
import { formatTimeOrPlaceholder } from "@/lib/formatting";
import {
  downloadImportTemplateCsv,
  downloadImportTemplateXlsx,
  parseImportFile,
  type ParsedImportRow,
} from "@/lib/import-service";
import { WorkRepository, type WorkRecord } from "@/lib/repositories/work-repository";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScreenIntro } from "@/components/shared/screen-intro";

type RowStatus = "novo" | "conflito" | "erro";

interface ReviewRow {
  parsed: ParsedImportRow;
  status: RowStatus;
  existing: WorkRecord | null;
  overwrite: boolean;
}

function statusOf(row: ParsedImportRow, existingByDate: Map<string, WorkRecord>): ReviewRow {
  if (row.errors.length > 0 || !row.workDate) {
    return { parsed: row, status: "erro", existing: null, overwrite: false };
  }
  const existing = existingByDate.get(row.workDate) ?? null;
  return {
    parsed: row,
    status: existing ? "conflito" : "novo",
    existing,
    overwrite: false,
  };
}

export default function ImportPage() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<{ created: number; updated: number; skipped: number } | null>(null);

  const counts = useMemo(() => {
    return {
      novo: rows.filter((r) => r.status === "novo").length,
      conflito: rows.filter((r) => r.status === "conflito").length,
      erro: rows.filter((r) => r.status === "erro").length,
    };
  }, [rows]);

  async function handleFileSelected(file: File) {
    if (!user) return;
    setLoading(true);
    setSummary(null);
    try {
      const parsed = await parseImportFile(file);
      if (parsed.length === 0) {
        toast.error("Nenhuma linha encontrada no arquivo.");
        setRows([]);
        return;
      }

      const validDates = parsed.map((r) => r.workDate).filter((d): d is string => Boolean(d));
      const supabase = createClient();
      const workRepository = new WorkRepository(supabase);
      let existingByDate = new Map<string, WorkRecord>();
      if (validDates.length > 0) {
        const min = validDates.reduce((a, b) => (a < b ? a : b));
        const max = validDates.reduce((a, b) => (a > b ? a : b));
        const existing = await workRepository.listByRange(user.id, min, max, true);
        existingByDate = new Map(existing.map((r) => [r.work_date, r]));
      }

      setFileName(file.name);
      setRows(parsed.map((row) => statusOf(row, existingByDate)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao ler o arquivo.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function toggleOverwrite(index: number, value: boolean) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, overwrite: value } : r)));
  }

  function toggleAllConflicts(value: boolean) {
    setRows((prev) => prev.map((r) => (r.status === "conflito" ? { ...r, overwrite: value } : r)));
  }

  async function handleConfirm() {
    if (!user) return;
    setSaving(true);
    let created = 0;
    let updated = 0;
    let skipped = 0;
    try {
      const supabase = createClient();
      const workRepository = new WorkRepository(supabase);

      for (const row of rows) {
        if (row.status === "erro" || !row.parsed.workDate) {
          skipped++;
          continue;
        }
        const payload = {
          entry_time: row.parsed.entryTime,
          lunch_start: row.parsed.lunchStart,
          lunch_end: row.parsed.lunchEnd,
          exit_time: row.parsed.exitTime,
          day_type: row.parsed.dayType,
          notes: row.parsed.notes,
        };
        if (row.status === "novo") {
          await workRepository.create(user.id, row.parsed.workDate, payload);
          created++;
        } else if (row.status === "conflito" && row.overwrite && row.existing) {
          await workRepository.update(row.existing.id, user.id, row.existing.version, payload);
          updated++;
        } else {
          skipped++;
        }
      }

      setSummary({ created, updated, skipped });
      setRows([]);
      setFileName(null);
      toast.success("Importacao concluida.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro durante a importacao.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <ScreenIntro
        screenKey="importar"
        title="Importar registros antigos"
        description="Traga anotacoes de jornada que voce ja tinha, sem redigitar tudo."
        tips={[
          { icon: FileSpreadsheet, text: "Baixe o modelo (CSV ou Excel) e preencha com seus dados." },
          { icon: Bot, text: "Anotacoes bagunçadas? Peca para uma IA reescrever no formato do modelo." },
          { icon: CheckCircle2, text: "Antes de salvar, voce revisa uma previa e decide o que importar." },
        ]}
      />
      <h1 className="text-2xl font-semibold">Importar registros</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Formato esperado</CardTitle>
          <CardDescription>
            O arquivo deve ter uma linha de cabecalho e uma linha por dia, com estas colunas:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {["Data", "Entrada", "Saida almoco", "Retorno", "Saida", "Tipo de dia", "Observacoes"].map((h) => (
              <Badge key={h} variant="secondary">
                {h}
              </Badge>
            ))}
          </div>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            <li>Data no formato DD/MM/AAAA. Horarios no formato HH:MM.</li>
            <li>
              Tipo de dia (opcional): {Object.values(DAY_TYPE_LABELS_PT).join(", ")}. Deixe em branco para
              &quot;Dia normal&quot;.
            </li>
            <li>Entrada/Almoco/Saida podem ficar em branco em dias de folga, ferias, etc.</li>
          </ul>
          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-muted-foreground">
              Se suas anotacoes antigas estao num formato diferente (texto livre, outra planilha, PDF), copie o
              conteudo e peca para uma IA (Claude, ChatGPT, etc.) reescrever exatamente nas colunas acima antes de
              enviar aqui.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => downloadImportTemplateCsv()}>
              Baixar modelo (.csv)
            </Button>
            <Button variant="outline" onClick={() => downloadImportTemplateXlsx()}>
              Baixar modelo (.xlsx)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Enviar arquivo</CardTitle>
          <CardDescription>Aceita .csv, .txt (mesmo formato) ou .xlsx.</CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,.xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelected(file);
            }}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Lendo arquivo...
              </>
            ) : (
              <>
                <FileUp className="size-4" /> Escolher arquivo
              </>
            )}
          </Button>
          {fileName && <p className="mt-2 text-sm text-muted-foreground">Arquivo: {fileName}</p>}
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Revisar e confirmar</CardTitle>
            <CardDescription>
              {counts.novo} novo(s), {counts.conflito} data(s) ja existente(s), {counts.erro} com erro (serao
              ignoradas).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {counts.conflito > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="overwrite-all"
                  onCheckedChange={(checked) => toggleAllConflicts(Boolean(checked))}
                />
                <label htmlFor="overwrite-all" className="text-sm">
                  Sobrescrever todas as datas ja existentes
                </label>
              </div>
            )}

            <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Almoco</TableHead>
                    <TableHead>Saida</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Situacao</TableHead>
                    <TableHead className="w-32">Sobrescrever?</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {row.parsed.workDate ? formatDateBR(row.parsed.workDate) : `Linha ${row.parsed.rowNumber}`}
                      </TableCell>
                      <TableCell>{formatTimeOrPlaceholder(row.parsed.entryTime)}</TableCell>
                      <TableCell>
                        {formatTimeOrPlaceholder(row.parsed.lunchStart)} - {formatTimeOrPlaceholder(row.parsed.lunchEnd)}
                      </TableCell>
                      <TableCell>{formatTimeOrPlaceholder(row.parsed.exitTime)}</TableCell>
                      <TableCell>{DAY_TYPE_LABELS_PT[row.parsed.dayType]}</TableCell>
                      <TableCell>
                        {row.status === "novo" && (
                          <Badge variant="outline" className="gap-1 text-success">
                            <Check className="size-3" /> Novo
                          </Badge>
                        )}
                        {row.status === "conflito" && (
                          <Badge variant="outline" className="gap-1 text-warning">
                            <AlertTriangle className="size-3" /> Ja existe
                          </Badge>
                        )}
                        {row.status === "erro" && (
                          <Badge variant="outline" className="gap-1 text-destructive">
                            <XCircle className="size-3" /> {row.parsed.errors[0]}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.status === "conflito" && (
                          <Checkbox
                            checked={row.overwrite}
                            onCheckedChange={(checked) => toggleOverwrite(index, Boolean(checked))}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button onClick={handleConfirm} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Importando...
                </>
              ) : (
                "Confirmar importacao"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {summary && (
        <Card className="animate-in fade-in slide-in-from-bottom-1">
          <CardContent className="flex items-center gap-3 pt-6">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="size-5" />
            </span>
            <p className="text-sm">
              Importacao concluida: <strong>{summary.created}</strong> registro(s) criado(s),{" "}
              <strong>{summary.updated}</strong> atualizado(s), <strong>{summary.skipped}</strong> ignorado(s).
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
