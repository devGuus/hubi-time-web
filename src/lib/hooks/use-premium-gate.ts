"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth/auth-provider";

/**
 * Trava de recursos pagos: o usuario navega livremente por qualquer tela -
 * so ao tentar USAR um recurso premium (clicar em exportar, salvar, etc.) e
 * avisado. Nada de banner ou popup por conta propria.
 */
export function usePremiumGate() {
  const { isPremium } = useAuth();
  const router = useRouter();

  function requirePremium(featureLabel: string, action: () => void): void {
    if (isPremium) {
      action();
      return;
    }
    toast.info(`${featureLabel} e exclusivo dos planos pagos.`, {
      action: { label: "Ver planos", onClick: () => router.push("/configuracoes?tab=assinatura") },
    });
  }

  return { isPremium, requirePremium };
}
