-- =====================================================================
-- Débito e crédito como escolhas separadas no checkout
-- LojaPro / Money NoTopo
--
-- Rode este arquivo INTEIRO no SQL Editor do Supabase. Idempotente.
--
-- A coluna orders.metodo_pagamento só aceitava 'pix', 'cartao' e
-- 'boleto'. Agora o cliente escolhe entre crédito, débito e Pix, e a
-- escolha dele precisa caber aqui — senão o pedido é recusado pelo
-- banco na hora de gravar.
--
-- IMPORTANTE, para não confundir depois:
-- esta coluna guarda o que o cliente ESCOLHEU na tela.
-- payments.cartao_tipo guarda o que a Stripe viu no cartão.
-- Os dois podem divergir (cartão múltiplo, por exemplo), e é de
-- propósito que sejam campos diferentes: um é intenção, o outro é
-- fato. O relatório usa o fato.
-- =====================================================================

alter table public.orders drop constraint if exists orders_metodo_pagamento_check;
alter table public.orders add constraint orders_metodo_pagamento_check
  check (
    metodo_pagamento is null
    or metodo_pagamento in (
      'pix',
      'cartao',           -- pedidos antigos, antes da separação
      'cartao_credito',
      'cartao_debito',
      'boleto',
      'dinheiro'
    )
  );

comment on column public.orders.metodo_pagamento is
  'Forma que o CLIENTE escolheu no checkout. O que foi de fato cobrado está em payments.cartao_tipo.';

-- ---------------------------------------------------------------------
-- Conferência: deve listar a constraint com os valores acima
-- ---------------------------------------------------------------------
select
  conname as constraint_name,
  pg_get_constraintdef(oid) as definicao
from pg_constraint
where conrelid = 'public.orders'::regclass
  and conname = 'orders_metodo_pagamento_check';
