"use client";

/** Tela "Registrar Horas": edicao completa de qualquer dia, com seletor de data. */
import { useState } from "react";

import { todayIso } from "@/lib/dates";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DayEditor } from "@/components/shared/day-editor";

export default function RegisterHoursPage() {
  const [workDate, setWorkDate] = useState(todayIso());

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Registrar Horas</h1>

      <div className="max-w-xs space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Data</Label>
        <Input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <DayEditor key={workDate} workDate={workDate} />
        </CardContent>
      </Card>
    </div>
  );
}
