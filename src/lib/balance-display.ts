import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

import { formatMinutesAsHours } from "./formatting";

/** Apresenta o sinal do saldo junto ao ícone e à cor que indicam sua direção. */
export function balanceDisplay(minutes: number): {
  text: string;
  icon: LucideIcon;
  accentClassName: string;
} {
  const positive = minutes >= 0;
  return {
    text: formatMinutesAsHours(minutes, true),
    icon: positive ? ArrowUpRight : ArrowDownRight,
    accentClassName: positive ? "text-success" : "text-destructive",
  };
}
