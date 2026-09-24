-- Diagnostico: mostra o que o Postgres realmente tem configurado hoje para
-- as 3 tabelas, para eu confirmar exatamente o que falta em vez de chutar.
-- Rode isso no SQL Editor do Supabase e me mande o resultado das 2 tabelas.

-- 1) Permissoes de GRANT por tabela/role
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('work_schedule_history', 'salary_history', 'overtime_rules')
  and grantee in ('authenticated', 'anon')
order by table_name, grantee, privilege_type;

-- 2) Politicas de RLS existentes por tabela
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('work_schedule_history', 'salary_history', 'overtime_rules')
order by tablename, cmd;
