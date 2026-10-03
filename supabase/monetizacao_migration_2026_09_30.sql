-- Migracao aditiva para o plano de monetizacao (Free vs. planos pagos via
-- Mercado Pago: mensal, semestral, anual). So cria tabelas novas - nao
-- altera nada que ja existe.
--
-- Como rodar: Painel do Supabase > SQL Editor > colar tudo > Run.
-- Seguro rodar mais de uma vez (idempotente).

-- 1) Assinatura atual de cada usuario. "current_period_end" e a fonte da
--    verdade de premium: null ou data passada = Free; data futura = pago.
--    So o backend (service role, via webhook do Mercado Pago) escreve aqui -
--    por isso nao ha policy de insert/update/delete para "authenticated".
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'monthly', 'semestral', 'annual')),
  current_period_end date null,
  mercadopago_payer_id text null,
  mercadopago_preference_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table subscriptions enable row level security;

drop policy if exists "subscriptions_select_own" on subscriptions;
create policy "subscriptions_select_own" on subscriptions
  for select using (auth.uid() = user_id);

grant select on subscriptions to authenticated;

-- 2) Historico de cobrancas - auditoria e chave de idempotencia do webhook
--    (mercadopago_payment_id unico: reprocessar a mesma notificacao nao
--    duplica linha). Tambem so o backend escreve aqui.
create table if not exists payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('monthly', 'semestral', 'annual')),
  amount numeric(10, 2) not null,
  payment_method text null,
  status text not null check (status in ('pending', 'approved', 'rejected', 'refunded')),
  mercadopago_payment_id text not null unique,
  raw_payload jsonb null,
  created_at timestamptz not null default now()
);

alter table payment_transactions enable row level security;

drop policy if exists "payment_transactions_select_own" on payment_transactions;
create policy "payment_transactions_select_own" on payment_transactions
  for select using (auth.uid() = user_id);

grant select on payment_transactions to authenticated;
