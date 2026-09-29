-- ============================================================
-- 18_corrigir_cores.sql
--
-- Conserta as cores já cadastradas que ficaram pretas sem serem pretas.
--
-- Causa: no cadastro do produto, o seletor de cor nascia em #000000 e
-- voltava para #000000 depois de cada cor adicionada. Quem digitava
-- "Branco" e não mexia no quadradinho gravava branco com o código do
-- preto. Nada avisava — o lojista só descobria olhando a vitrine.
--
-- Isto só mexe onde o NOME contradiz o código: cor chamada "Branco"
-- gravada como #000000 vira branco. Cor chamada "Preto" fica como
-- está, e qualquer cor com tom escolhido de propósito também.
--
-- Rodar no SQL Editor. Pode rodar mais de uma vez.
-- ============================================================

-- ------------------------------------------------------------
-- Auxiliar: tira acento sem depender da extensão unaccent, que nem
-- todo projeto Supabase tem instalada.
-- ------------------------------------------------------------
create or replace function public.unaccent_simples(t text)
returns text
language sql
immutable
as $$
  select translate(
    coalesce(t, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
  );
$$;

-- ------------------------------------------------------------
-- 1. Veja o que vai mudar ANTES de mudar.
-- ------------------------------------------------------------
with nomes as (
  select * from (values
    ('branco',        '#ffffff'),
    ('cinza',         '#9ca3af'),
    ('cinza claro',   '#d4d4d8'),
    ('cinza escuro',  '#4b5563'),
    ('vermelho',      '#dc2626'),
    ('vinho',         '#7f1d1d'),
    ('rosa',          '#ec4899'),
    ('pink',          '#ec4899'),
    ('laranja',       '#f97316'),
    ('amarelo',       '#eab308'),
    ('dourado',       '#d4af37'),
    ('prata',         '#c0c0c0'),
    ('verde',         '#16a34a'),
    ('verde claro',   '#4ade80'),
    ('verde escuro',  '#166534'),
    ('verde militar', '#4b5320'),
    ('azul',          '#2563eb'),
    ('azul claro',    '#60a5fa'),
    ('azul escuro',   '#1e3a8a'),
    ('azul marinho',  '#1e3a5f'),
    ('marinho',       '#1e3a5f'),
    ('turquesa',      '#14b8a6'),
    ('roxo',          '#7c3aed'),
    ('lilas',         '#c4b5fd'),
    ('marrom',        '#78350f'),
    ('bege',          '#e7d7c1'),
    ('caramelo',      '#b45309'),
    ('nude',          '#e3bc9a'),
    ('creme',         '#fdf6e3'),
    ('off white',     '#faf9f6'),
    ('jeans',         '#4a6fa5'),
    ('mescla',        '#b8b8b8')
  ) as t(nome, hex)
)
select
  p.nome            as produto,
  pc.nome           as cor,
  pc.codigo_hex     as hex_atual,
  n.hex             as hex_corrigido
from public.product_colors pc
join public.products p on p.id = pc.product_id
join nomes n
  on lower(public.unaccent_simples(pc.nome)) = n.nome
where coalesce(pc.codigo_hex, '') in ('', '#000000')
order by p.nome, pc.nome;

-- ------------------------------------------------------------
-- 2. Só depois de conferir a lista acima, rode o update.
-- ------------------------------------------------------------
with nomes as (
  select * from (values
    ('branco',        '#ffffff'),
    ('cinza',         '#9ca3af'),
    ('cinza claro',   '#d4d4d8'),
    ('cinza escuro',  '#4b5563'),
    ('vermelho',      '#dc2626'),
    ('vinho',         '#7f1d1d'),
    ('rosa',          '#ec4899'),
    ('pink',          '#ec4899'),
    ('laranja',       '#f97316'),
    ('amarelo',       '#eab308'),
    ('dourado',       '#d4af37'),
    ('prata',         '#c0c0c0'),
    ('verde',         '#16a34a'),
    ('verde claro',   '#4ade80'),
    ('verde escuro',  '#166534'),
    ('verde militar', '#4b5320'),
    ('azul',          '#2563eb'),
    ('azul claro',    '#60a5fa'),
    ('azul escuro',   '#1e3a8a'),
    ('azul marinho',  '#1e3a5f'),
    ('marinho',       '#1e3a5f'),
    ('turquesa',      '#14b8a6'),
    ('roxo',          '#7c3aed'),
    ('lilas',         '#c4b5fd'),
    ('marrom',        '#78350f'),
    ('bege',          '#e7d7c1'),
    ('caramelo',      '#b45309'),
    ('nude',          '#e3bc9a'),
    ('creme',         '#fdf6e3'),
    ('off white',     '#faf9f6'),
    ('jeans',         '#4a6fa5'),
    ('mescla',        '#b8b8b8')
  ) as t(nome, hex)
)
update public.product_colors pc
   set codigo_hex = n.hex
  from nomes n
 where lower(public.unaccent_simples(pc.nome)) = n.nome
   and coalesce(pc.codigo_hex, '') in ('', '#000000');

-- ------------------------------------------------------------
-- 3. Conferência
-- ------------------------------------------------------------
select p.nome as produto, pc.nome as cor, pc.codigo_hex
from public.product_colors pc
join public.products p on p.id = pc.product_id
order by p.nome, pc.nome;
