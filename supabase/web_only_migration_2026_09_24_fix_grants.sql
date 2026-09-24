-- Correcao do erro "permission denied for table X" ao editar/excluir
-- vigencias. As politicas de RLS criadas antes nao bastam sozinhas - o
-- Postgres tambem exige a permissao basica (GRANT) de UPDATE/DELETE para o
-- role "authenticated" antes mesmo de avaliar o RLS. Provavelmente essas
-- tabelas so tinham GRANT de SELECT/INSERT (por causa do design original de
-- "historico nunca editado").
--
-- Como rodar: Painel do Supabase > SQL Editor > colar tudo > Run.
-- Seguro rodar mais de uma vez.

grant update, delete on work_schedule_history to authenticated;
grant update, delete on salary_history to authenticated;
grant update, delete on overtime_rules to authenticated;
