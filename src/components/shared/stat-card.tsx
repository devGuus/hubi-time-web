"use client";

import { Lock, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePremiumGate } from "@/lib/hooks/use-premium-gate";
import { useCountUp } from "@/lib/hooks/use-count-up";
import { cn } from "@/lib/utils";
import { InfoTip } from "./info-tip";

interface Trend {
  label: string;
  direction: "up" | "down";
  positive?: boolean;
}

interface StatCardProps {
  label: string;
  value: string;
  caption?: string;
  accentClassName?: string;
  icon?: LucideIcon;
  trend?: Trend;
  numericValue?: number;
  formatValue?: (n: number) => string;
  info?: string;
  /** Quando true, mostra o valor mascarado e explica que e recurso pago ao tocar/clicar. */
  locked?: boolean;
}

export function StatCard({
  label,
  value,
  caption,
  accentClassName,
  icon: Icon,
  trend,
  numericValue,
  formatValue,
  info,
  locked,
}: StatCardProps) {
  const animated = useCountUp(numericValue ?? 0);
  const computedValue = numericValue !== undefined && formatValue ? formatValue(animated) : value;
  const displayValue = locked ? "••••••" : computedValue;
  const { requirePremium } = usePremiumGate();

  return (
    <Card interactive onClick={locked ? () => requirePremium(label, () => {}) : undefined}>
      <CardHeader className="flex-row items-start justify-between pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          {label}
          {locked ? <Lock className="size-3.5 text-muted-foreground/60" /> : info && <InfoTip label={label} text={info} />}
        </CardTitle>
        {Icon && (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className={cn("text-2xl font-semibold tabular-nums", locked ? "text-muted-foreground/60" : accentClassName)}>
            {displayValue}
          </div>
          {trend && !locked && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-xs font-medium",
                trend.positive === false ? "text-destructive" : "text-success"
              )}
            >
              {trend.direction === "up" ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {trend.label}
            </span>
          )}
        </div>
        {caption && <p className="mt-1 text-xs text-muted-foreground">{caption}</p>}
      </CardContent>
    </Card>
  );
}
