-- ============================================================
-- 34 · URGENTE · Produtos voltam a aparecer na loja
--      + fecha dois buracos encontrados no caminho
--
-- ------------------------------------------------------------
-- O problema
-- ------------------------------------------------------------
-- A loja abre, mas "Erro ao carregar produtos". Toda consulta de
-- produto responde:
--
--   permission denied for table stores   (42501)
--
-- Causa: três políticas de DONO foram criadas para o papel `public`,
-- que inclui o visitante anônimo:
--
--   owner_full_access_products
--   owner_full_access_categories
--   owner_full_access_product_images
--
-- O Postgres avalia TODAS as políticas aplicáveis numa leitura. Para
-- um visitante, ele tenta avaliar
--
--   store_id IN (SELECT stores.id FROM stores WHERE owner_id = auth.uid())
--
-- e isso toca `stores.owner_id`, que o visitante não pode ler. A
-- leitura inteira morre antes de chegar nas políticas públicas, que
-- estão corretas e liberariam o produto.
--
-- Repare que essas políticas nunca liberariam nada para um visitante:
-- `auth.uid()` é nulo para quem não está logado, então a condição é
-- sempre falsa. Elas não davam acesso — só quebravam a leitura.
--
-- A correção é restringi-las a `authenticated`, que é para quem elas
-- foram feitas. NÃO concedo `stores.owner_id` ao público: isso
-- consertaria o sintoma entregando de graça qual usuário é dono de
-- qual loja.
--
-- A leitura pública continua coberta pelas políticas próprias, que
-- só consultam `stores.ativo` — coluna que o visitante lê:
--   public_read_active_products
--   public_read_categories_of_active_stores
--   public_read_product_images
--   publico_le_product_colors
--   publico_le_product_sizes
--
-- ------------------------------------------------------------
-- O buraco, que é mais grave que a falha
-- ------------------------------------------------------------
-- Duas políticas antigas estão assim:
--
--   allow all product colors  · para: public · cmd: ALL · using: true
--   allow all product sizes   · para: public · cmd: ALL · using: true
--
-- "ALL" com "true" para o papel público significa que QUALQUER pessoa
-- com o endereço da loja aberto podia INSERIR, ALTERAR e APAGAR cores
-- e tamanhos de produto de QUALQUER loja. Sem login. Bastava uma
-- requisição à mão.
--
-- Elas são removidas aqui. O acesso legítimo já está coberto:
-- leitura pública por `publico_le_product_*`, e gestão pelo dono em
-- `dono_gerencia_product_*` (que já são de `authenticated`).
--
-- Rodar no SQL Editor. Pode rodar mais de uma vez.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Antes: o que existe hoje (para constar)
-- ------------------------------------------------------------
select 'ANTES' as momento, tablename, policyname,
       array_to_string(roles, ',') as papeis, cmd
  from pg_policies
 where schemaname = 'public'
   and tablename in ('products', 'categories', 'product_images',
                     'product_colors', 'product_sizes')
 order by tablename, policyname;

-- ------------------------------------------------------------
-- 2. As políticas de dono passam a valer só para quem está logado
--
-- Mesma condição de antes, sem uma vírgula alterada: muda só PARA
-- QUEM ela é avaliada. O dono continua gerenciando exatamente o que
-- gerenciava.
-- ------------------------------------------------------------
drop policy if exists owner_full_access_products on public.products;
create policy owner_full_access_products on public.products
  for all to authenticated
  using      (store_id in (select s.id from public.stores s where s.owner_id = auth.uid()))
  with check (store_id in (select s.id from public.stores s where s.owner_id = auth.uid()));

drop policy if exists owner_full_access_categories on public.categories;
create policy owner_full_access_categories on public.categories
  for all to authenticated
  using      (store_id in (select s.id from public.stores s where s.owner_id = auth.uid()))
  with check (store_id in (select s.id from public.stores s where s.owner_id = auth.uid()));

drop policy if exists owner_full_access_product_images on public.product_images;
create policy owner_full_access_product_images on public.product_images
  for all to authenticated
  using (product_id in (
    select p.id from public.products p
      join public.stores s on s.id = p.store_id
     where s.owner_id = auth.uid()
  ))
  with check (product_id in (
    select p.id from public.products p
      join public.stores s on s.id = p.store_id
     where s.owner_id = auth.uid()
  ));

-- ------------------------------------------------------------
-- 3. Fecha o escrever-para-todos em cores e tamanhos
-- ------------------------------------------------------------
drop policy if exists "allow all product colors" on public.product_colors;
drop policy if exists "allow all product sizes"  on public.product_sizes;

-- ------------------------------------------------------------
-- 4. Conferência
--
-- Esperado:
--   · nenhuma linha em "AINDA QUEBRA" — política de papel público
--     que consulta owner_id é o que derruba a loja
--   · nenhuma linha em "ESCANCARADA"
--   · as políticas de leitura pública continuam de pé
-- ------------------------------------------------------------
select 'AINDA QUEBRA · politica publica que consulta owner_id' as problema,
       tablename, policyname, array_to_string(roles, ',') as papeis
  from pg_policies
 where schemaname = 'public'
   and tablename in ('products', 'categories', 'product_images',
                     'product_colors', 'product_sizes')
   and 'public' = any(roles)
   and coalesce(qual, '') like '%owner_id%';

select 'ESCANCARADA · escrita liberada para qualquer um' as problema,
       tablename, policyname, cmd
  from pg_policies
 where schemaname = 'public'
   and tablename in ('products', 'categories', 'product_images',
                     'product_colors', 'product_sizes')
   and ('public' = any(roles) or 'anon' = any(roles))
   and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE');

select 'DEPOIS · leitura publica que precisa continuar de pe' as conferencia,
       tablename, policyname, cmd
  from pg_policies
 where schemaname = 'public'
   and tablename in ('products', 'categories', 'product_images',
                     'product_colors', 'product_sizes')
   and cmd = 'SELECT'
 order by tablename, policyname;
