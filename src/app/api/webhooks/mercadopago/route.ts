/**
 * Recebe as notificacoes de pagamento do Mercado Pago. Nunca confia no corpo
 * da notificacao: valida a assinatura e busca o pagamento real na API deles
 * antes de atualizar qualquer coisa. Roda com a service role (sem sessao de
 * usuario - a chamada vem do servidor do Mercado Pago).
 */
import { NextRequest, NextResponse } from "next/server";

import { addMonthsIso, todayIso } from "@/lib/dates";
import { getPaymentClient, MercadoPagoNotConfiguredError, validateWebhookSignature } from "@/lib/mercadopago";
import { isPaidPlanId, PAID_PLANS, type PaidPlanId } from "@/lib/plans";
import { PaymentTransactionRepository, SubscriptionRepository } from "@/lib/repositories/subscription-repository";
import { createAdminClient } from "@/lib/supabase/admin";

function mapStatus(mpStatus: string | undefined): "pending" | "approved" | "rejected" | "refunded" {
  if (mpStatus === "approved") return "approved";
  if (mpStatus === "refunded" || mpStatus === "charged_back") return "refunded";
  if (mpStatus === "rejected" || mpStatus === "cancelled") return "rejected";
  return "pending";
}

export async function POST(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") ?? request.nextUrl.searchParams.get("topic");
  const dataId = request.nextUrl.searchParams.get("data.id") ?? request.nextUrl.searchParams.get("id");

  // So processamos notificacoes de pagamento - outros topicos (merchant_order,
  // etc.) sao confirmados sem acao para o Mercado Pago parar de reenviar.
  if (type !== "payment" || !dataId) {
    return NextResponse.json({ received: true });
  }

  try {
    validateWebhookSignature({
      xSignature: request.headers.get("x-signature"),
      xRequestId: request.headers.get("x-request-id"),
      dataId,
    });

    const payment = await getPaymentClient().get({ id: dataId });
    const [userId, planRaw] = (payment.external_reference ?? "").split(":");
    if (!userId || !isPaidPlanId(planRaw)) {
      console.error("Webhook Mercado Pago: external_reference invalido:", payment.external_reference);
      return NextResponse.json({ received: true });
    }
    const plan: PaidPlanId = planRaw;
    const status = mapStatus(payment.status);

    const admin = createAdminClient();
    const paymentTransactionRepository = new PaymentTransactionRepository(admin);
    await paymentTransactionRepository.upsertFromWebhook({
      userId,
      plan,
      amount: payment.transaction_amount ?? PAID_PLANS[plan].price.toNumber(),
      paymentMethod: payment.payment_type_id ?? null,
      status,
      mercadopagoPaymentId: String(payment.id),
      rawPayload: payment,
    });

    if (status === "approved") {
      const subscriptionRepository = new SubscriptionRepository(admin);
      const existing = await subscriptionRepository.getCurrent(userId);
      const today = todayIso();
      const base = existing?.currentPeriodEnd && existing.currentPeriodEnd >= today ? existing.currentPeriodEnd : today;
      const newPeriodEnd = addMonthsIso(base, PAID_PLANS[plan].periodMonths);
      await subscriptionRepository.upsertPaidPeriod(userId, plan, newPeriodEnd, null);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof MercadoPagoNotConfiguredError) {
      console.error(error.message);
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Erro no webhook do Mercado Pago:", error);
    // 401 para assinatura invalida (nao deve ser reenviada); demais erros
    // retornam 500 para o Mercado Pago tentar de novo mais tarde.
    const isSignatureError = error instanceof Error && error.name === "InvalidWebhookSignatureError";
    return NextResponse.json({ error: "Erro ao processar notificacao." }, { status: isSignatureError ? 401 : 500 });
  }
}
