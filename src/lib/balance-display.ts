import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

import { formatMinutesAsHours } from "./formatting";

/** Apresenta um saldo (minutos) sem sinal de menos - a direcao vira icone + cor. */
export function balanceDisplay(minutes: number): {
  text: string;
  icon: LucideIcon;
  accentClassName: string;
} {
  const positive = minutes >= 0;
  return {
    text: formatMinutesAsHours(Math.abs(minutes)),
    icon: positive ? ArrowUpRight : ArrowDownRight,
    accentClassName: positive ? "text-success" : "text-destructive",
  };
}
