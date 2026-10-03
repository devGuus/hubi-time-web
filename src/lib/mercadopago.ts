/**
 * Integracao com o Mercado Pago (Checkout Pro): cria a preferencia de
 * pagamento e valida a assinatura dos webhooks recebidos. Chave de acesso
 * ainda nao configurada? As funcoes daqui lancam um erro claro em vez de
 * quebrar com um erro criptico do SDK - a rota que chama trata isso.
 */
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import { WebhookSignatureValidator } from "mercadopago";

export class MercadoPagoNotConfiguredError extends Error {
  constructor() {
    super(
      "Pagamento ainda nao configurado. Defina MERCADOPAGO_ACCESS_TOKEN no .env.local (Mercado Pago > Suas integracoes > Credenciais)."
    );
  }
}

function getConfig(): MercadoPagoConfig {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) throw new MercadoPagoNotConfiguredError();
  return new MercadoPagoConfig({ accessToken });
}

export function getPreferenceClient(): Preference {
  return new Preference(getConfig());
}

export function getPaymentClient(): Payment {
  return new Payment(getConfig());
}

/** Lanca se a assinatura do webhook nao bater - use antes de confiar em qualquer notificacao. */
export function validateWebhookSignature(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}): void {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) throw new MercadoPagoNotConfiguredError();
  WebhookSignatureValidator.validate({
    xSignature: params.xSignature,
    xRequestId: params.xRequestId,
    dataId: params.dataId,
    secret,
  });
}
