/** Cria uma preferencia de pagamento (Checkout Pro) para o plano escolhido. */
import { NextRequest, NextResponse } from "next/server";

import { getPreferenceClient, MercadoPagoNotConfiguredError } from "@/lib/mercadopago";
import { isPaidPlanId, PAID_PLANS } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const plan = body?.plan;
  if (typeof plan !== "string" || !isPaidPlanId(plan)) {
    return NextResponse.json({ error: "Plano invalido." }, { status: 400 });
  }

  const definition = PAID_PLANS[plan];
  const origin = request.nextUrl.origin;

  try {
    const preference = await getPreferenceClient().create({
      body: {
        items: [
          {
            id: plan,
            title: `Hubi Time - Plano ${definition.label}`,
            quantity: 1,
            currency_id: "BRL",
            unit_price: definition.price.toNumber(),
          },
        ],
        payer: { email: user.email },
        external_reference: `${user.id}:${plan}`,
        notification_url: `${origin}/api/webhooks/mercadopago`,
        back_urls: {
          success: `${origin}/configuracoes?assinatura=sucesso`,
          pending: `${origin}/configuracoes?assinatura=pendente`,
          failure: `${origin}/configuracoes?assinatura=falha`,
        },
        auto_return: "approved",
      },
    });
    return NextResponse.json({ initPoint: preference.init_point });
  } catch (error) {
    if (error instanceof MercadoPagoNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Erro ao criar preferencia de pagamento:", error);
    return NextResponse.json({ error: "Erro ao iniciar pagamento. Tente novamente." }, { status: 500 });
  }
}
