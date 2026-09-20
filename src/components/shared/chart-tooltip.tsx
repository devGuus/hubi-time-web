import type { TooltipContentProps, TooltipValueType } from "recharts";

/** Tooltip customizado para os graficos recharts - o `<Tooltip />` padrao usa
 * estilo inline fixo (caixa branca) e nao respeita o tema escuro. */
export function ChartTooltipContent({
  active,
  payload,
  label,
}: TooltipContentProps<TooltipValueType, string | number>) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
      {label !== undefined && <p className="mb-1 font-medium text-foreground">{label}</p>}
      <div className="space-y-0.5">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium tabular-nums text-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
