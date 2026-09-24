-- Migracao aditiva para os itens "chegada antecipada nao conta como hora
-- extra" (item 1) e "editar/excluir vigencias" (item 4). So cria colunas e
-- permissoes novas - nao apaga nem altera nada que ja existe.
--
-- Como rodar: Painel do Supabase > SQL Editor > colar tudo > Run.
-- Seguro rodar mais de uma vez (todos os comandos sao "IF NOT EXISTS"/idempotentes).

-- 1) Horario de entrada padrao, guardado junto com a vigencia de carga
--    horaria (mesma logica de "vigente desde" que ja existe para as horas).
alter table work_schedule_history
  add column if not exists standard_entry_time time null;

-- 2) Configuracao geral do usuario: chegada antes do horario conta como
--    hora extra? Padrao "false" = NAO conta (comportamento protegido).
alter table user_settings
  add column if not exists count_early_arrival_as_overtime boolean not null default false;

-- 3) Excecao por dia especifico: null = segue a configuracao geral acima;
--    true = force contar como hora extra neste dia; false = force NAO
--    contar neste dia mesmo que a configuracao geral esteja ligada.
alter table work_records
  add column if not exists count_early_arrival_as_overtime boolean null;

-- 4) Permissoes para editar/excluir vigencias (item 4). Assume o padrao
--    usual do Supabase: cada linha pertence a auth.uid() = user_id (mesmo
--    padrao ja usado nas consultas do app). Se o RLS do seu projeto usa
--    outro nome/coluna, me avise o erro exato que eu ajusto.
drop policy if exists "work_schedule_history_update_own" on work_schedule_history;
create policy "work_schedule_history_update_own" on work_schedule_history
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "work_schedule_history_delete_own" on work_schedule_history;
create policy "work_schedule_history_delete_own" on work_schedule_history
  for delete using (auth.uid() = user_id);

drop policy if exists "salary_history_update_own" on salary_history;
create policy "salary_history_update_own" on salary_history
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "salary_history_delete_own" on salary_history;
create policy "salary_history_delete_own" on salary_history
  for delete using (auth.uid() = user_id);

drop policy if exists "overtime_rules_update_own" on overtime_rules;
create policy "overtime_rules_update_own" on overtime_rules
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "overtime_rules_delete_own" on overtime_rules;
create policy "overtime_rules_delete_own" on overtime_rules
  for delete using (auth.uid() = user_id);
