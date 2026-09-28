-- =====================================================================
-- Por que "Meus pedidos" não encontra — diagnóstico
-- LojaPro / Money NoTopo
--
-- Só LÊ. Rode no SQL Editor e me mande o resultado de cada bloco.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. A função existe? Com qual assinatura?
--
-- Se vier VAZIO, o 11_consulta_pedidos_publica.sql não foi rodado —
-- e é essa a causa do erro.
-- ---------------------------------------------------------------------
select
  p.proname                         as funcao,
  pg_get_function_identity_arguments(p.oid) as argumentos,
  pg_get_function_result(p.oid)     as retorno
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'consultar_pedidos_publico';

-- ---------------------------------------------------------------------
-- 2. O visitante anônimo pode executá-la?
--
-- Precisa aparecer 'anon' na lista. Sem isso, a chamada da loja é
-- recusada por permissão.
-- ---------------------------------------------------------------------
select
  r.rolname as papel,
  has_function_privilege(
    r.rolname,
    'public.consultar_pedidos_publico(uuid, text, text)',
    'EXECUTE'
  ) as pode_executar
from pg_roles r
where r.rolname in ('anon', 'authenticated', 'service_role');

-- ---------------------------------------------------------------------
-- 3. As colunas que a função nova usa existem?
--
-- valor_reembolsado vem do 04_pedidos_gestao.sql.
-- codigo_rastreio e frete_transportadora vêm do 01_frete_schema.sql.
-- Faltando qualquer uma, a criação da função falha.
-- ---------------------------------------------------------------------
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'orders'
  and column_name in (
    'valor_reembolsado', 'codigo_rastreio',
    'frete_transportadora', 'frete_prazo_dias'
  )
order by column_name;

-- ---------------------------------------------------------------------
-- 4. Este CPF e telefone batem com algum cadastro?
--
-- Mostra como os dados estão gravados. Se vier vazio, o problema é o
-- cadastro, não a função.
-- ---------------------------------------------------------------------
select
  c.id,
  c.nome,
  c.cpf                                        as cpf_gravado,
  regexp_replace(c.cpf, '\D', '', 'g')         as cpf_so_digitos,
  c.telefone                                   as telefone_gravado,
  regexp_replace(c.telefone, '\D', '', 'g')    as telefone_so_digitos,
  (select count(*) from orders o where o.customer_id = c.id) as pedidos
from customers c
where regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g') = '08167142582'
   or regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g') = '77998195450'
order by c.created_at;

-- ---------------------------------------------------------------------
-- 5. A função, chamada com esses dados
--
-- Se os blocos acima estiverem certos e este vier vazio, o problema
-- está dentro da função.
-- ---------------------------------------------------------------------
select numero, status, codigo_rastreio
from consultar_pedidos_publico(
  (select id from stores order by created_at limit 1),
  '08167142582',
  '77998195450'
);
