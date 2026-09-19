/**
 * Excecoes da camada de acesso a dados. A UI nunca deve capturar erros
 * brutos do supabase-js; tudo passa por aqui, que traduz para uma mensagem
 * amigavel (a tecnica vai so para o console/log).
 */
import type { PostgrestError } from "@supabase/supabase-js";

export class RepositoryError extends Error {
  friendlyMessage: string;
  technicalDetail: string;

  constructor(friendlyMessage: string, technicalDetail?: string) {
    super(technicalDetail ?? friendlyMessage);
    this.friendlyMessage = friendlyMessage;
    this.technicalDetail = technicalDetail ?? friendlyMessage;
  }
}

export class NotFoundError extends RepositoryError {}
export class ConflictError extends RepositoryError {}

export function translatePostgrestError(error: PostgrestError, operation: string): RepositoryError {
  console.error(`Erro do Supabase durante '${operation}':`, error);
  if (error.code === "PGRST116") {
    return new NotFoundError("Registro nao encontrado.", error.message);
  }
  return new RepositoryError(
    "Ocorreu um erro ao acessar seus dados. Tente novamente em instantes.",
    error.message
  );
}
