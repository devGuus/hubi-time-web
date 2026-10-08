-- Migracao aditiva para codigos de resgate (presentes/promocoes): ativam um
-- plano pago (mensal, semestral ou anual) sem passar pelo Mercado Pago. Um
-- mesmo codigo pode ser usado por varias pessoas diferentes, mas cada usuario
-- só pode resgatar um dado codigo uma unica vez (unique em redemption_code_uses).
--
-- Seguranca: o texto do codigo (ex. "HUBI-7K2M-9QXT") NUNCA e gravado em texto
-- puro - so o hash SHA-256 normalizado fica em "code_hash". Mesmo com acesso
-- total ao painel do Supabase nao e possivel ver o codigo original. RLS fica
-- habilitado em ambas as tabelas e nenhuma policy e criada para elas - sem
-- nenhuma policy, o Postgres nega por padrao qualquer select/insert/update/
-- delete vindo de "anon"/"authenticated" (so a service role, que ignora RLS,
-- consegue ler/escrever), mesmo que essas roles tenham GRANT de tabela. Ou
-- seja, o navegador do usuario nunca consegue ler ou escrever aqui, so o
-- backend com a service role. Os codigos em si sao gerados pelo script
-- scripts/generate-redemption-codes.mjs, nunca comitados no repositorio.
--
-- Como rodar: Painel do Supabase > SQL Editor > colar tudo > Run.
-- Seguro rodar mais de uma vez (idempotente).

create table if not exists redemption_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  plan text not null check (plan in ('monthly', 'semestral', 'annual')),
  label text null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table redemption_codes enable row level security;
-- Sem nenhuma policy de proposito - esta tabela só é acessada pelo backend
-- com a service role.

create table if not exists redemption_code_uses (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references redemption_codes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (code_id, user_id)
);

alter table redemption_code_uses enable row level security;
-- Idem acima - sem nenhuma policy. So a service role grava/le aqui.
