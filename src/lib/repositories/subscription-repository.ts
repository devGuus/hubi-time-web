/** Acesso a dados de subscriptions e payment_transactions. */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { DateISO } from "@/lib/dates";
import type { PlanId } from "@/lib/plans";
import type { Database } from "@/types/database";
import { translatePostgrestError } from "./errors";

type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"];

export interface Subscription {
  id: string;
  userId: string;
  plan: PlanId;
  currentPeriodEnd: DateISO | null;
  mercadopagoPayerId: string | null;
  mercadopagoPreferenceId: string | null;
}

function toSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    userId: row.user_id,
    plan: row.plan as PlanId,
    currentPeriodEnd: row.current_period_end,
    mercadopagoPayerId: row.mercadopago_payer_id,
    mercadopagoPreferenceId: row.mercadopago_preference_id,
  };
}

/** true quando a assinatura ainda esta dentro do periodo pago (hoje <= fim do periodo). */
export function isPremium(subscription: Subscription | null, today: DateISO): boolean {
  return Boolean(subscription?.currentPeriodEnd && subscription.currentPeriodEnd >= today);
}

export class SubscriptionRepository {
  constructor(private client: SupabaseClient<Database>) {}

  /** Le a assinatura do usuario. Retorna null se ele nunca assinou (estado normal do plano Free). */
  async getCurrent(userId: string): Promise<Subscription | null> {
    const { data, error } = await this.client
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw translatePostgrestError(error, "buscar assinatura");
    return data ? toSubscription(data) : null;
  }

  /** Usado apenas pelo webhook (client com service role) para confirmar um pagamento aprovado. */
  async upsertPaidPeriod(
    userId: string,
    plan: PlanId,
    currentPeriodEnd: DateISO,
    mercadopagoPreferenceId: string | null
  ): Promise<void> {
    const { error } = await this.client
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          plan,
          current_period_end: currentPeriodEnd,
          mercadopago_preference_id: mercadopagoPreferenceId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    if (error) throw translatePostgrestError(error, "atualizar assinatura");
  }
}

export interface PaymentTransactionInput {
  userId: string;
  plan: PlanId;
  amount: number;
  paymentMethod: string | null;
  status: "pending" | "approved" | "rejected" | "refunded";
  mercadopagoPaymentId: string;
  rawPayload: unknown;
}

export class PaymentTransactionRepository {
  constructor(private client: SupabaseClient<Database>) {}

  /** Idempotente: reprocessar a mesma notificacao do Mercado Pago so atualiza o status. */
  async upsertFromWebhook(input: PaymentTransactionInput): Promise<void> {
    const { error } = await this.client.from("payment_transactions").upsert(
      {
        user_id: input.userId,
        plan: input.plan,
        amount: input.amount,
        payment_method: input.paymentMethod,
        status: input.status,
        mercadopago_payment_id: input.mercadopagoPaymentId,
        raw_payload: input.rawPayload as never,
      },
      { onConflict: "mercadopago_payment_id" }
    );
    if (error) throw translatePostgrestError(error, "registrar transacao de pagamento");
  }
}
