# Hubi Time (Web)

Versao web do [Hubi Time](https://github.com/devGuus/Hubi-Time) - controle de jornada, banco de horas e financeiro pessoal. Mesma funcionalidade do app desktop (PySide6), mesmo backend Supabase (mesmo banco, mesmos usuarios), construida com **Next.js 16 + shadcn/ui + Supabase**.

> Estado atual: **completo** - todas as 14 telas (Hoje, Registrar, Calendario, Historico, Controle de Horas, Banco de Horas, Financeiro, Relatorios, Configuracoes, Perfil + fluxo de autenticacao) construidas, com paridade de funcionalidades com o desktop. Build de producao, lint e os 35 testes passam sem erros.

## Por que reaproveitar o mesmo Supabase

Este projeto **nao** cria um banco novo. Ele aponta para o mesmo projeto Supabase do app desktop (`supabase/migrations/` no repositorio `Hubi-Time`), reaproveitando tabelas, RLS, triggers de auditoria e usuarios ja existentes. Quem faz login no desktop tambem pode logar aqui - e vice-versa.

## Stack e decisoes tecnicas

| Decisao | Motivo |
|---|---|
| Next.js 16 (App Router) + TypeScript | Ecossistema com melhor suporte a deploy gratuito (Vercel) |
| shadcn/ui (Base UI, nao Radix) | Versao atual da CLI shadcn ja usa Base UI como base por padrao |
| `@supabase/ssr` | Sessao sincronizada entre navegador e `proxy.ts` (middleware) via cookies |
| `decimal.js` | Mesma precisao monetaria do `Decimal` usado no desktop (nunca `number` puro para dinheiro) |
| Sem checkbox "manter-me conectado" | Na web a sessao ja persiste via cookies por padrao - diferente do desktop, que precisa de escolha explicita para gravar no keyring do SO |
| Vitest | Porte 1:1 dos testes do `CalculationService` (35 testes, mesmos casos do `pytest` do desktop) |
| `exceljs` em vez de `xlsx` (SheetJS) | `xlsx` tem vulnerabilidade alta (prototype pollution + ReDoS) sem correcao no npm |

## Estrutura

```
src/
|-- app/
|   |-- (auth)/          # login, cadastro, verificar-email, recuperar-senha
|   |-- (app)/           # area logada: layout com sidebar + topbar
|   |   |-- hoje/ registrar/ calendario/ historico/
|   |   |-- controle-horas/ banco-horas/ financeiro/ relatorios/
|   |   `-- configuracoes/ perfil/
|   `-- page.tsx         # redireciona "/" conforme sessao (via proxy)
|-- components/
|   |-- ui/               # shadcn/ui
|   |-- layout/           # sidebar, topbar
|   `-- shared/           # time-field, day-editor, stat-card, period-filter
|-- lib/
|   |-- auth/             # AuthProvider (contexto de sessao), traducao de erros
|   |-- repositories/     # unico ponto de acesso ao Supabase (porte de repositories/*.py)
|   |-- calculation-service.ts  # porte 1:1 de services/calculation_service.py
|   |-- report-service.ts # exportacao Excel/CSV/PDF (exceljs, jspdf)
|   |-- constants.ts, dates.ts, money.ts, formatting.ts, validators.ts, time.ts
|   `-- supabase/         # clientes browser/server
|-- proxy.ts               # Next.js 16 (era middleware.ts): renova sessao + protege rotas
`-- types/database.ts      # gerado via `supabase gen types typescript`
```

## Configuracao

```powershell
npm install
copy .env.local.example .env.local
# preencha com a MESMA SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY do desktop
npm run dev
```

As migrations SQL ja devem estar aplicadas no Supabase (feito pelo projeto desktop via `supabase db push`). Nao ha nada a rodar aqui.

## Testes

```powershell
npm test
```

## Build e deploy

```powershell
npm run build
```

Recomendado: deploy na [Vercel](https://vercel.com) (gratuito para este volume de uso) - conecte o repositorio e configure as mesmas variaveis de `.env.local` em Project Settings > Environment Variables.

## Notas de implementacao

- O Next.js 16 vem com o **React Compiler** habilitado por padrao. Em paginas de busca de dados simples, preferimos deixar o compilador memoizar sozinho (sem `useMemo`/`useCallback` manual) quando o calculo e barato - evita conflitos de "preserve-manual-memoization" entre a memoizacao manual e a automatica.
- `react-hooks/set-state-in-effect` (regra nova, rigorosa) e suprimida pontualmente nos efeitos de busca de dados ao montar - um padrao legitimo e comum, nao um bug.
