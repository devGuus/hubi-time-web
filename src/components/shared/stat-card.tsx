"use client";

import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCountUp } from "@/lib/hooks/use-count-up";
import { cn } from "@/lib/utils";

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
}: StatCardProps) {
  const animated = useCountUp(numericValue ?? 0);
  const displayValue = numericValue !== undefined && formatValue ? formatValue(animated) : value;

  return (
    <Card interactive>
      <CardHeader className="flex-row items-start justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {Icon && (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className={cn("text-2xl font-semibold tabular-nums", accentClassName)}>{displayValue}</div>
          {trend && (
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
