-- ============================================================
-- 25_login_google.sql
--
-- Prepara o cadastro para quem entra pelo Google.
--
-- Quem entra pelo Google não preenche formulário, então não manda
-- "nome" nem "loja" no metadata. O Google manda os campos dele:
-- full_name, name, given_name, avatar_url.
--
-- Sem isto, a loja nasceria com o nome tirado do e-mail — uma loja
-- chamada "rafa143rafa123". Com isto, nasce com o nome da pessoa, que
-- é um ponto de partida decente, e o lojista renomeia em Loja.
--
-- Também resolve uma ambiguidade apontada na auditoria (item V19 /
-- A3): existiam DUAS versões de handle_new_user no projeto, uma delas
-- sem search_path fixo, e não dava para saber qual estava viva. Esta
-- substitui as duas por uma só, correta.
--
-- Rodar no SQL Editor. Pode rodar mais de uma vez.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nome       text;
  v_loja       text;
  v_slug       text;
  v_slug_final text;
  v_sufixo     integer := 0;
begin
  -- Nome da pessoa. A ordem importa: o que ela digitou no nosso
  -- formulário vale mais que o que veio do Google.
  v_nome := coalesce(
    nullif(new.raw_user_meta_data->>'nome', ''),
    nullif(new.raw_user_meta_data->>'full_name', ''),   -- Google
    nullif(new.raw_user_meta_data->>'name', ''),        -- Google
    nullif(
      trim(concat_ws(' ',
        new.raw_user_meta_data->>'given_name',
        new.raw_user_meta_data->>'family_name')), ''),
    split_part(new.email, '@', 1)
  );

  -- Nome da loja. Quem veio pelo Google não escolheu um: usa o nome
  -- da pessoa e renomeia depois no painel.
  v_loja := coalesce(
    nullif(new.raw_user_meta_data->>'loja', ''),
    v_nome
  );

  insert into public.profiles (id, nome)
  values (new.id, v_nome)
  on conflict (id) do nothing;

  -- Slug: sem acento, minúsculo, com hífen
  v_slug := lower(regexp_replace(
    translate(v_loja,
      'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'),
    '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug is null or v_slug = '' then
    v_slug := 'loja';
  end if;

  v_slug_final := v_slug;
  while exists (select 1 from public.stores where slug = v_slug_final) loop
    v_sufixo := v_sufixo + 1;
    v_slug_final := v_slug || '-' || v_sufixo;
  end loop;

  insert into public.stores (owner_id, nome, slug, email, ativo)
  values (new.id, v_loja, v_slug_final, new.email, true)
  on conflict (owner_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Conferência: uma função só, com search_path fixo
-- ------------------------------------------------------------
select
  p.proname as funcao,
  p.prosecdef as security_definer,
  coalesce(array_to_string(p.proconfig, ', '), '(SEM search_path)') as config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname = 'handle_new_user';

select trigger_name, event_object_schema, event_object_table
from information_schema.triggers
where trigger_name = 'on_auth_user_created';
