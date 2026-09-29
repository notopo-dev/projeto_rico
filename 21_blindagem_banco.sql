-- ============================================================
-- 21_blindagem_banco.sql
--
-- Correções de segurança no banco, escritas para rodar sem depender
-- do que já foi ou não executado antes. Tudo é idempotente: pode
-- rodar mais de uma vez.
--
-- NÃO apaga tabela, NÃO apaga dado, NÃO remove funcionalidade.
-- Só fecha porta.
--
-- O que corrige, em ordem de gravidade:
--
--  1. Tabelas com RLS DESLIGADO. Tabela sem RLS está 100% aberta pela
--     API do Supabase — a chave anônima está publicada no site, então
--     qualquer pessoa lê e escreve. `profiles`, `product_colors` e
--     `product_sizes` nunca tiveram RLS ligado em arquivo nenhum.
--
--  2. A view `v_estoque` devolvia o estoque de TODAS as lojas.
--     View no Postgres roda com os poderes de quem a criou e ignora
--     RLS, a menos que security_invoker esteja ligado.
--
--  3. `stores` entregava a linha INTEIRA para visitantes anônimos:
--     stripe_account_id, stripe_customer_id, status da assinatura,
--     plano, endereço de origem e owner_id de todas as lojas ativas.
--     RLS não filtra coluna — quem filtra é permissão de coluna.
--
--  4. Funções security definer sem search_path fixo.
--
--  5. Resíduos de escrita pública em orders/order_items/customers.
-- ============================================================

-- ------------------------------------------------------------
-- 1. RLS ligado em TODA tabela do schema public
--
-- Faz em laço porque o conjunto de tabelas mudou ao longo do projeto
-- e listar na mão é como isso se perdeu da primeira vez.
-- ------------------------------------------------------------
do $$
declare t record;
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and not c.relrowsecurity
  loop
    execute format('alter table public.%I enable row level security', t.relname);
    raise notice 'RLS ligado em %', t.relname;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 2. profiles — cada um enxerga apenas a própria linha
-- ------------------------------------------------------------
drop policy if exists "perfil_proprio" on public.profiles;
create policy "perfil_proprio"
  on public.profiles for all
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ------------------------------------------------------------
-- 3. product_colors e product_sizes
--
-- Estavam sem RLS e sem policy: dava para trocar cor e tamanho do
-- produto de qualquer loja. O dono gerencia as suas; o visitante só
-- lê as de produtos ativos de lojas ativas.
-- ------------------------------------------------------------
do $$
declare tbl text;
begin
  foreach tbl in array array['product_colors', 'product_sizes']
  loop
    if to_regclass('public.' || tbl) is null then continue; end if;

    execute format('drop policy if exists "dono_gerencia_%1$s" on public.%1$I', tbl);
    execute format($f$
      create policy "dono_gerencia_%1$s"
        on public.%1$I for all
        to authenticated
        using (exists (
          select 1 from public.products p
            join public.stores s on s.id = p.store_id
           where p.id = %1$I.product_id and s.owner_id = auth.uid()))
        with check (exists (
          select 1 from public.products p
            join public.stores s on s.id = p.store_id
           where p.id = %1$I.product_id and s.owner_id = auth.uid()))
    $f$, tbl);

    execute format('drop policy if exists "publico_le_%1$s" on public.%1$I', tbl);
    execute format($f$
      create policy "publico_le_%1$s"
        on public.%1$I for select
        using (exists (
          select 1 from public.products p
            join public.stores s on s.id = p.store_id
           where p.id = %1$I.product_id
             and p.status = 'ativo' and s.ativo = true))
    $f$, tbl);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 4. v_estoque deixa de furar o RLS
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.v_estoque') is not null then
    execute 'alter view public.v_estoque set (security_invoker = true)';
  end if;
exception when others then
  raise notice 'v_estoque: nao foi possivel ligar security_invoker (%). Considere apagar a view se nada usa.', sqlerrm;
end $$;

-- ------------------------------------------------------------
-- 5. stores: visitante anônimo só enxerga as colunas da vitrine
--
-- A policy public_read_active_stores continua valendo — ela decide
-- QUAIS LINHAS. O que muda aqui é QUAIS COLUNAS, que é coisa de
-- permissão, não de RLS. Sem isto, um GET em /rest/v1/stores devolve
-- o stripe_account_id e a situação da assinatura de todos os
-- lojistas da plataforma.
--
-- Só concede as colunas que de fato existem, para não quebrar se o
-- esquema estiver diferente.
-- ------------------------------------------------------------
do $$
declare
  publicas text[] := array[
    'id','nome','slug','descricao','logo_url','banner_url',
    'cor_primaria','cor_secundaria','whatsapp','email',
    'politica_troca','politica_frete','modo_compra','ativo',
    'aceita_cartao','aceita_pix',
    'frete_modo','frete_fixo','frete_fixo_prazo_dias','frete_fixo_nome',
    'frete_gratis_acima','retirada_na_loja','retirada_instrucoes',
    'exibir_sem_estoque'
  ];
  existentes text;
begin
  select string_agg(quote_ident(column_name), ', ')
    into existentes
    from information_schema.columns
   where table_schema = 'public' and table_name = 'stores'
     and column_name = any(publicas);

  if existentes is null then
    raise notice 'stores: nenhuma coluna publica encontrada, nada alterado';
    return;
  end if;

  revoke select on public.stores from anon;
  execute format('grant select (%s) on public.stores to anon', existentes);
  raise notice 'stores: anon agora le apenas -> %', existentes;
end $$;

-- ------------------------------------------------------------
-- 6. Escrita pública em pedidos e clientes: fechada
--
-- Quem grava pedido é a função criar_pedido_publico
-- (19_checkout_seguro.sql), que roda no servidor e lê o preço da
-- tabela de produtos. O navegador não precisa de nada disto.
-- ------------------------------------------------------------
drop policy if exists "public_select_customers_for_checkout" on public.customers;
drop policy if exists "public_insert_customers"              on public.customers;
drop policy if exists "public_insert_orders"                 on public.orders;
drop policy if exists "public_insert_order_items"            on public.order_items;

revoke insert, update, delete on public.orders      from anon;
revoke insert, update, delete on public.order_items from anon;
revoke insert, update, delete on public.customers   from anon;
revoke select                 on public.customers   from anon;

-- ------------------------------------------------------------
-- 7. search_path fixo nas funções
--
-- Função security definer sem search_path fixo pode ser enganada a
-- chamar uma tabela falsa de outro schema. Usa ALTER para não
-- reescrever corpo nenhum — funciona em qualquer versão que esteja
-- viva no banco.
-- ------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and (p.proconfig is null
            or not exists (
              select 1 from unnest(p.proconfig) c where c like 'search_path=%'))
  loop
    begin
      execute format('alter function %s set search_path = public, pg_temp', f.assinatura);
      raise notice 'search_path fixado em %', f.assinatura;
    exception when others then
      raise notice 'nao deu para fixar search_path em %: %', f.assinatura, sqlerrm;
    end;
  end loop;
end $$;

-- handle_new_user vive em public mas é disparada por auth.users
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as a
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where p.proname = 'handle_new_user'
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.a);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 8. Estoque não fica negativo
--
-- A baixa de estoque subtraía sem piso. Pedido com quantidade maior
-- que o disponível deixava o produto em número negativo, e a vitrine
-- passava a mostrar coisa que não existe.
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'products_estoque_nao_negativo'
  ) and to_regclass('public.products') is not null then
    -- Conserta o que já ficou negativo antes de criar a trava.
    update public.products set estoque = 0 where estoque < 0;
    alter table public.products
      add constraint products_estoque_nao_negativo check (estoque >= 0);
  end if;
end $$;

-- ------------------------------------------------------------
-- 8b. Saber se o Melhor Envio está conectado, SEM ler o token
--
-- O painel precisava mostrar "conectado", e para isso fazia
-- `select melhor_envio_token` — trazendo o token inteiro para dentro
-- do navegador do lojista, onde qualquer extensão ou XSS o alcança.
-- Esse token compra etiqueta com o saldo dele.
--
-- Esta função responde só sim ou não, e só sobre a própria loja.
-- ------------------------------------------------------------
create or replace function public.melhor_envio_conectado()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.store_settings ss
      join public.stores s on s.id = ss.store_id
     where s.owner_id = auth.uid()
       and ss.melhor_envio_token is not null
  );
$$;

revoke all on function public.melhor_envio_conectado() from public, anon;
grant execute on function public.melhor_envio_conectado() to authenticated;

-- ------------------------------------------------------------
-- 9. Conferência
-- ------------------------------------------------------------
select c.relname as tabela, c.relrowsecurity as rls_ligado,
       (select count(*) from pg_policies p
         where p.schemaname='public' and p.tablename=c.relname) as policies
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname='public' and c.relkind='r'
 order by c.relrowsecurity, c.relname;
