#!/usr/bin/env node
/**
 * Gera codigos de resgate (presentes/promocoes) e grava so o hash no banco -
 * o texto do codigo e mostrado UMA UNICA VEZ aqui no terminal, nunca gravado
 * em arquivo nem no banco. Uso exclusivo do administrador (voce), fora do
 * site - nao existe (e nao deve existir) nenhuma rota ou tela publica que
 * gere codigos.
 *
 * Requer SUPABASE_SERVICE_ROLE_KEY e NEXT_PUBLIC_SUPABASE_URL no .env.local
 * (mesmas credenciais usadas pelo webhook do Mercado Pago).
 *
 * Uso:
 *   node scripts/generate-redemption-codes.mjs --plan=monthly --count=5 --label="Equipe outubro 2026"
 *   node scripts/generate-redemption-codes.mjs --plan=annual --label="Presente Natal"
 *
 * --plan   obrigatorio: monthly | semestral | annual
 * --count  opcional, padrao 1 (maximo 100 por execucao)
 * --label  opcional, nota interna sua para lembrar o motivo/campanha
 */
import { createHash } from "node:crypto";
import { randomInt } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function parseArgs() {
  const options = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([a-z]+)=(.*)$/i);
    if (match) options[match[1]] = match[2];
  }
  return options;
}

// Sem 0/O, 1/I/L - evita confusao ao digitar o codigo a mao.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomChar() {
  return ALPHABET[randomInt(ALPHABET.length)];
}

function generateCode() {
  const part = () => Array.from({ length: 4 }, randomChar).join("");
  return `HUBI-${part()}-${part()}`;
}

function normalizeCode(raw) {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function hashCode(raw) {
  return createHash("sha256").update(normalizeCode(raw)).digest("hex");
}

/** Erros desta classe so imprimem a mensagem (sem o prefixo "Erro ao gerar codigos"). */
class UsageError extends Error {}

const USAGE = [
  "",
  "Uso: node scripts/generate-redemption-codes.mjs --plan=<monthly|semestral|annual> [--count=N] [--label=\"texto\"]",
  "",
  "Exemplos:",
  '  node scripts/generate-redemption-codes.mjs --plan=monthly --count=5 --label="Equipe outubro 2026"',
  '  node scripts/generate-redemption-codes.mjs --plan=annual --label="Presente Natal"',
  "",
].join("\n");

async function main() {
  loadEnvLocal();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new UsageError(
      "Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local. Copie a service_role key em Supabase > Settings > API."
    );
  }

  const options = parseArgs();
  const plan = options.plan;
  const count = Number(options.count ?? 1);
  const label = options.label ?? null;

  if (!["monthly", "semestral", "annual"].includes(plan)) throw new UsageError(USAGE);
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new UsageError("O numero de codigos (--count) deve ser um inteiro entre 1 e 100.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  async function insertUniqueCode() {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const { error } = await supabase.from("redemption_codes").insert({
        code_hash: hashCode(code),
        plan,
        label,
      });
      if (!error) return code;
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        throw new Error(
          "A tabela 'redemption_codes' ainda nao existe no banco. Rode a migracao " +
            "supabase/redemption_codes_migration_2026_10_07.sql no SQL Editor do Supabase e tente de novo."
        );
      }
      if (error.code !== "23505") throw new Error(error.message);
      // colisao de hash (extremamente improvavel) - tenta outro codigo
    }
    throw new Error("Nao foi possivel gerar um codigo unico apos 5 tentativas.");
  }

  const generated = [];
  for (let i = 0; i < count; i++) {
    generated.push(await insertUniqueCode());
  }

  console.log(`\n${count} codigo(s) gerado(s) para o plano "${plan}"${label ? ` (${label})` : ""}:\n`);
  for (const code of generated) console.log(`  ${code}`);
  console.log("\nEstes codigos so aparecem aqui - nao ficam salvos em nenhum arquivo. Copie agora.\n");
}

// process.exitCode (nao process.exit()) de proposito: encerrar a forca aqui
// pode derrubar o processo no meio do fechamento de um handle de rede do
// cliente Supabase no Windows ("Assertion failed ... uv_handle_t").
main().catch((error) => {
  if (!(error instanceof UsageError)) console.error("Erro ao gerar codigos:");
  console.error(error.message ?? error);
  process.exitCode = 1;
});
