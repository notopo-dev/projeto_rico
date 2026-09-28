-- =====================================================================
-- Unificar clientes duplicados — LojaPro / Money NoTopo
--
-- Rode este arquivo INTEIRO no SQL Editor do Supabase.
-- Idempotente: rodar de novo não faz nada se não houver duplicata.
--
-- POR QUE DUPLICOU
-- O checkout procurava o cliente exigindo CPF **e** telefone iguais,
-- os dois ao mesmo tempo. Quem comprou antes de a loja passar a pedir
-- CPF — ou digitou o CPF de outro jeito — ganhava um cadastro novo.
-- O mesmo comprador aparecia duas vezes, com o histórico partido.
--
-- O checkout já foi corrigido. Este arquivo junta o que ficou para trás.
--
-- O QUE ELE FAZ
-- Dentro de CADA loja, agrupa clientes pelo telefone (só dígitos) e,
-- de cada grupo, mantém o cadastro MAIS ANTIGO — que é o que tem o
-- histórico mais longo. Os pedidos dos outros são repontados para ele,
-- e os cadastros vazios são apagados.
--
-- O telefone é o critério porque é o único campo que a loja sempre
-- pede. CPF pode estar em branco nos cadastros antigos, e e-mail pode
-- ser compartilhado entre pessoas da mesma casa.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ANTES: veja o que será unificado.
--    Se vier vazio, não há duplicata e o resto não muda nada.
-- ---------------------------------------------------------------------
select
  s.nome           as loja,
  c.telefone,
  count(*)         as cadastros,
  string_agg(c.nome, ' | ' order by c.created_at) as nomes
from public.customers c
join public.stores s on s.id = c.store_id
where c.telefone is not null
  and c.telefone <> ''
group by s.nome, c.store_id, c.telefone
having count(*) > 1
order by count(*) desc;

-- ---------------------------------------------------------------------
-- 2. Repontar os pedidos para o cadastro mais antigo de cada grupo
-- ---------------------------------------------------------------------
with grupos as (
  select
    c.id,
    first_value(c.id) over (
      partition by c.store_id, c.telefone
      order by c.created_at
    ) as manter
  from public.customers c
  where c.telefone is not null
    and c.telefone <> ''
)
update public.orders o
set customer_id = g.manter
from grupos g
where o.customer_id = g.id
  and g.id <> g.manter;

-- ---------------------------------------------------------------------
-- 3. Apagar os cadastros que sobraram sem nenhum pedido
--
-- A condição `not exists` é a trava de segurança: se por algum motivo
-- o passo 2 não moveu um pedido, o cadastro dele NÃO é apagado.
-- Melhor sobrar um duplicado do que sumir com o histórico de alguém.
-- ---------------------------------------------------------------------
with grupos as (
  select
    c.id,
    first_value(c.id) over (
      partition by c.store_id, c.telefone
      order by c.created_at
    ) as manter
  from public.customers c
  where c.telefone is not null
    and c.telefone <> ''
)
delete from public.customers c
using grupos g
where c.id = g.id
  and g.id <> g.manter
  and not exists (
    select 1 from public.orders o where o.customer_id = c.id
  );

-- ---------------------------------------------------------------------
-- 4. DEPOIS: deve vir vazio
-- ---------------------------------------------------------------------
select
  c.telefone,
  count(*) as cadastros_restantes
from public.customers c
where c.telefone is not null
  and c.telefone <> ''
group by c.store_id, c.telefone
having count(*) > 1;
