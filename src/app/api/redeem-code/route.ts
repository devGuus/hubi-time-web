/**
 * Resgata um codigo de presente/promocao e ativa (ou estende) o plano pago
 * do usuario autenticado, sem passar pelo Mercado Pago. Mesma regra de
 * extensao de periodo do webhook (soma ao periodo atual se ainda vigente).
 * O codigo nunca e comparado em texto puro - so pelo hash (ver
 * src/lib/redemption-codes.ts). Roda com service role porque a tabela de
 * codigos nao tem GRANT para "authenticated" (de proposito - ver a migracao).
 */
import { NextRequest, NextResponse } from "next/server";

import { addMonthsIso, todayIso } from "@/lib/dates";
import { PAID_PLANS } from "@/lib/plans";
import { hashRedemptionCode } from "@/lib/redemption-codes";
import { RedemptionCodeRepository } from "@/lib/repositories/redemption-repository";
import { SubscriptionRepository } from "@/lib/repositories/subscription-repository";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const rawCode = body?.code;
  if (typeof rawCode !== "string" || !rawCode.trim()) {
    return NextResponse.json({ error: "Informe o codigo." }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("Erro ao resgatar codigo:", error);
    return NextResponse.json(
      { error: "Resgate de codigos ainda nao configurado. Tente novamente mais tarde." },
      { status: 503 }
    );
  }

  const redemptionRepository = new RedemptionCodeRepository(admin);

  try {
    const redemptionCode = await redemptionRepository.findByHash(hashRedemptionCode(rawCode));
    if (!redemptionCode || !redemptionCode.active) {
      return NextResponse.json({ error: "Codigo invalido." }, { status: 404 });
    }

    const recorded = await redemptionRepository.recordUse(redemptionCode.id, user.id);
    if (!recorded) {
      return NextResponse.json({ error: "Voce ja usou este codigo." }, { status: 409 });
    }

    try {
      const subscriptionRepository = new SubscriptionRepository(admin);
      const existing = await subscriptionRepository.getCurrent(user.id);
      const today = todayIso();
      const base = existing?.currentPeriodEnd && existing.currentPeriodEnd >= today ? existing.currentPeriodEnd : today;
      const plan = redemptionCode.plan;
      const newPeriodEnd = addMonthsIso(base, PAID_PLANS[plan].periodMonths);
      await subscriptionRepository.upsertPaidPeriod(user.id, plan, newPeriodEnd, null);
    } catch (error) {
      // O uso ja foi registrado (o codigo nao pode mais ser usado por este
      // usuario) mas o plano nao foi ativado - precisa de intervencao manual.
      console.error(`Codigo ${redemptionCode.id} resgatado por ${user.id} mas falhou ao ativar o plano:`, error);
      return NextResponse.json(
        { error: "Codigo resgatado, mas houve um erro ao ativar seu plano. Entre em contato com o suporte." },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Codigo resgatado com sucesso! Seu plano foi atualizado." });
  } catch (error) {
    console.error("Erro ao resgatar codigo:", error);
    return NextResponse.json({ error: "Erro ao resgatar codigo. Tente novamente." }, { status: 500 });
  }
}
