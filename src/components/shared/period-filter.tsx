"use client";

/** Filtro de periodo reutilizavel: Hoje / Semana / Mes / Ano / Intervalo personalizado. */
import { useState } from "react";

import { monthRange, todayIso, weekRange, yearRange, type DateISO } from "@/lib/dates";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const OPTIONS = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "year", label: "Ano" },
  { value: "custom", label: "Intervalo personalizado" },
] as const;

export type PeriodOption = (typeof OPTIONS)[number]["value"];

export function rangeForOption(option: PeriodOption, customStart: DateISO, customEnd: DateISO): [DateISO, DateISO] {
  const today = todayIso();
  switch (option) {
    case "today":
      return [today, today];
    case "week":
      return weekRange(today);
    case "month": {
      const [y, m] = today.split("-").map(Number);
      return monthRange(y, m);
    }
    case "year":
      return yearRange(Number(today.slice(0, 4)));
    case "custom":
      return customStart <= customEnd ? [customStart, customEnd] : [customEnd, customStart];
  }
}

interface PeriodFilterProps {
  value: { option: PeriodOption; customStart: DateISO; customEnd: DateISO };
  onChange: (value: { option: PeriodOption; customStart: DateISO; customEnd: DateISO }) => void;
}

export function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  const [customStart, setCustomStart] = useState(value.customStart);
  const [customEnd, setCustomEnd] = useState(value.customEnd);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={value.option}
        onValueChange={(v) => onChange({ ...value, option: v as PeriodOption })}
      >
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value.option === "custom" && (
        <>
          <Input
            type="date"
            className="w-40"
            value={customStart}
            onChange={(e) => {
              setCustomStart(e.target.value);
              onChange({ ...value, customStart: e.target.value });
            }}
          />
          <span className="text-sm text-muted-foreground">ate</span>
          <Input
            type="date"
            className="w-40"
            value={customEnd}
            onChange={(e) => {
              setCustomEnd(e.target.value);
              onChange({ ...value, customEnd: e.target.value });
            }}
          />
        </>
      )}
    </div>
  );
}
