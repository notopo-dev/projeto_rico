-- ============================================================
-- 32 · URGENTE · Devolver a loja pública ao ar
--
-- Sintoma: toda loja pública mostra "Loja não encontrada" para quem
-- não está logado. O painel continua funcionando.
--
-- Causa: minha. A migração 27 acrescentou duas colunas em `stores`
--
--   retirada_aceita_dinheiro
--   retirada_aceita_maquininha
--
-- e a loja pública passou a pedi-las. Mas `stores` dá permissão ao
-- visitante POR COLUNA — só as que a vitrine precisa, que é o certo —
-- e no Postgres uma coluna nova NÃO herda a permissão da tabela.
--
-- O visitante então não podia ler essas duas, e o Postgres recusa a
-- consulta INTEIRA quando uma coluna pedida é proibida:
--
--   permission denied for table stores   (42501)
--
-- O código lê esse erro como "loja não existe" e mostra a tela de
-- endereço errado. Por isso o sintoma não tem nada a ver com o slug.
--
-- Confirmado no site em 01/10/2026: das 25 colunas que a vitrine
-- pede, o visitante conseguia ler 23. As duas negadas eram
-- exatamente estas.
--
-- Rodar no SQL Editor. Pode rodar mais de uma vez.
-- ============================================================

-- ------------------------------------------------------------
-- 1. A correção
--
-- Concede SÓ estas duas colunas, e só a leitura. Não uso
-- `grant select on public.stores` sem lista: isso abriria a tabela
-- inteira para o visitante, incluindo colunas que ninguém de fora
-- tem por que ver. A permissão por coluna existe por um motivo, e
-- consertar um descuido meu não é razão para desfazê-la.
--
-- São dois valores booleanos que a vitrine precisa mesmo mostrar:
-- é com eles que o checkout decide exibir "pagar na retirada".
-- ------------------------------------------------------------
grant select (retirada_aceita_dinheiro, retirada_aceita_maquininha)
  on public.stores to anon;

grant select (retirada_aceita_dinheiro, retirada_aceita_maquininha)
  on public.stores to authenticated;

-- ------------------------------------------------------------
-- 2. Conferência — e um alerta para a próxima vez
--
-- A primeira consulta lista TODA coluna de `stores` que o visitante
-- ainda não pode ler. Ela é o que eu deveria ter rodado depois da 27.
--
-- Nem toda coluna da lista é problema: senha, token e dados internos
-- devem mesmo ficar de fora. O que importa é comparar essa lista com
-- o que a vitrine pede em getStoreBySlug (store/lib/storeApi.ts).
-- Qualquer coluna que apareça nos dois lugares derruba a loja.
-- ------------------------------------------------------------
select 'colunas de stores que o VISITANTE nao le' as conferencia,
       c.column_name
  from information_schema.columns c
 where c.table_schema = 'public'
   and c.table_name = 'stores'
   and not has_column_privilege('anon', 'public.stores', c.column_name, 'SELECT')
 order by c.column_name;

-- Esta precisa voltar VAZIA. Se vier alguma linha, a loja continua
-- fora do ar por causa dela.
--
-- O cruzamento é com information_schema de propósito: assim a
-- consulta não quebra se eu listar aqui uma coluna que não existe
-- mais. Conferência que falha por causa de si mesma não confere nada.
select 'AINDA BLOQUEADA · a vitrine pede e o visitante nao le' as problema,
       v.coluna
  from unnest(array[
    'id','nome','slug','descricao','logo_url','banner_url',
    'cor_primaria','cor_secundaria','whatsapp','email',
    'politica_troca','politica_frete','modo_compra','ativo',
    'aceita_cartao','aceita_pix','frete_modo','frete_fixo',
    'frete_fixo_prazo_dias','frete_fixo_nome','frete_gratis_acima',
    'retirada_na_loja','retirada_instrucoes',
    'retirada_aceita_dinheiro','retirada_aceita_maquininha'
  ]) as v(coluna)
  join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = 'stores'
   and c.column_name = v.coluna
 where not has_column_privilege('anon', 'public.stores', v.coluna, 'SELECT');
