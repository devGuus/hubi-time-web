/** Traducao de erros do Supabase Auth para mensagens amigaveis em PT-BR.
 * Porte 1:1 de services/exceptions.py (desktop). */

const MESSAGE_TRANSLATIONS: [string, string][] = [
  ["invalid login credentials", "E-mail ou senha incorretos."],
  ["email not confirmed", "Seu e-mail ainda nao foi confirmado. Verifique sua caixa de entrada."],
  ["user already registered", "Ja existe uma conta cadastrada com este e-mail."],
  ["token has expired or is invalid", "Codigo invalido ou expirado. Solicite um novo codigo."],
  ["invalid token", "Codigo invalido. Verifique os numeros digitados."],
  ["email rate limit exceeded", "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente."],
  ["over_email_send_rate_limit", "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente."],
  ["user not found", "Nao encontramos uma conta com este e-mail."],
  ["password should be at least", "A senha nao atende aos requisitos minimos de seguranca."],
  ["same_password", "A nova senha deve ser diferente da senha atual."],
  ["new password should be different from the old password", "A nova senha deve ser diferente da senha atual."],
];

export function translateAuthError(message: string): string {
  const lowered = message.toLowerCase();
  for (const [fragment, friendly] of MESSAGE_TRANSLATIONS) {
    if (lowered.includes(fragment)) return friendly;
  }
  return "Nao foi possivel concluir a operacao. Verifique os dados e tente novamente.";
}

export class AuthenticationError extends Error {
  friendlyMessage: string;

  constructor(friendlyMessage: string, technicalDetail?: string) {
    super(technicalDetail ?? friendlyMessage);
    this.friendlyMessage = friendlyMessage;
  }
}
