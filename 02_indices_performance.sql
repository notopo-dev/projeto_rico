-- =====================================================================
-- Índices de performance — LojaPro / Money NoTopo
--
-- Rode este arquivo INTEIRO no SQL Editor do Supabase.
-- É idempotente: pode rodar quantas vezes quiser.
--
-- POR QUE ISTO IMPORTA
-- O Postgres NÃO cria índice automaticamente para chave estrangeira.
-- Sem índice, toda consulta do tipo "produtos desta loja" varre a
-- tabela inteira e filtra linha a linha. Com 3 produtos ninguém nota;
-- com 3.000 a tela trava. Criar agora custa segundos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- O mais importante de todos.
-- getCurrentStoreId() roda antes de QUALQUER consulta do painel.
-- Sem este índice, toda tela paga uma varredura em `stores`.
-- ---------------------------------------------------------------------
create index if not exists idx_stores_owner
  on public.stores (owner_id);

-- ---------------------------------------------------------------------
-- Produtos: a listagem filtra por loja e ordena por data
-- ---------------------------------------------------------------------
create index if not exists idx_products_store
  on public.products (store_id);

create index if not exists idx_products_store_criado
  on public.products (store_id, created_at desc);

create index if not exists idx_products_categoria
  on public.products (category_id);

-- Relações carregadas junto com o produto (imagens, cores, tamanhos).
-- São as que mais pesam: uma varredura para cada produto da lista.
create index if not exists idx_product_images_produto
  on public.product_images (product_id);

create index if not exists idx_product_colors_produto
  on public.product_colors (product_id);

create index if not exists idx_product_sizes_produto
  on public.product_sizes (product_id);

-- ---------------------------------------------------------------------
-- Categorias
-- ---------------------------------------------------------------------
create index if not exists idx_categories_store
  on public.categories (store_id);

-- ---------------------------------------------------------------------
-- Pedidos e itens
-- ---------------------------------------------------------------------
create index if not exists idx_orders_store_criado
  on public.orders (store_id, created_at desc);

create index if not exists idx_orders_cliente
  on public.orders (customer_id);

create index if not exists idx_order_items_pedido
  on public.order_items (order_id);

-- ---------------------------------------------------------------------
-- Clientes e pagamentos
-- ---------------------------------------------------------------------
create index if not exists idx_customers_store
  on public.customers (store_id);

create index if not exists idx_payments_store
  on public.payments (store_id);

create index if not exists idx_payments_pedido
  on public.payments (order_id);

-- ---------------------------------------------------------------------
-- Loja pública: o cliente entra por /loja/<slug>
-- ---------------------------------------------------------------------
create index if not exists idx_stores_slug
  on public.stores (slug);

-- ---------------------------------------------------------------------
-- Atualiza as estatísticas para o planejador usar os índices novos
-- ---------------------------------------------------------------------
analyze public.stores;
analyze public.products;
analyze public.product_images;
analyze public.product_colors;
analyze public.product_sizes;
analyze public.categories;
analyze public.orders;
analyze public.order_items;
analyze public.customers;
analyze public.payments;

-- ---------------------------------------------------------------------
-- Conferência: lista o que existe agora
-- ---------------------------------------------------------------------
select tablename, indexname
from pg_indexes
where schemaname = 'public'
  and indexname like 'idx_%'
order by tablename, indexname;
