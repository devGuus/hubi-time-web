"use client";

import { Lock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePremiumGate } from "@/lib/hooks/use-premium-gate";

/** Substitui um Card de grafico/analise inteiro quando o recurso e pago - mesmo titulo, sem os dados. */
export function LockedCard({ title }: { title: string }) {
  const { requirePremium } = usePremiumGate();
  return (
    <Card interactive onClick={() => requirePremium(title, () => {})}>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-base">
          {title}
          <Lock className="size-3.5 text-muted-foreground/60" />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex h-72 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <Lock className="size-6" />
        Disponivel nos planos pagos. Toque para ver os planos.
      </CardContent>
    </Card>
  );
}
