-- ============================================================
-- 23_storage_policies.sql
--
-- Fecha um vazamento CONFIRMADO entre lojas no Storage.
--
-- O bucket product-images tinha DUAS gerações de políticas convivendo:
--
--   owner_upload_product_images_storage   confere a pasta da loja  (certa)
--   owner_delete_product_images_storage   confere a pasta da loja  (certa)
--
--   "Permitir upload imagens produtos"    só confere o bucket      (solta)
--   "Permitir update imagens produtos"    só confere o bucket      (solta)
--   "Permitir delete imagens produtos"    só confere o bucket      (solta)
--
-- Políticas no Postgres SOMAM (basta uma permitir). As três soltas,
-- provavelmente criadas pelo painel do Supabase antes das outras,
-- anulavam as corretas: qualquer lojista autenticado da plataforma
-- podia apagar, sobrescrever ou plantar arquivo dentro da pasta de
-- qualquer outro lojista.
--
-- A mais grave era o UPDATE: dá para trocar a foto de um produto
-- alheio mantendo a mesma URL. A loja vítima continua mostrando a
-- imagem nova sem que ninguém perceba.
--
-- Este arquivo REMOVE as três soltas e garante que sobram só as que
-- conferem a pasta. Nenhum arquivo é apagado — isto mexe só em
-- permissão.
--
-- Rodar no SQL Editor. Pode rodar mais de uma vez.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Antes: o que existe hoje
-- ------------------------------------------------------------
select policyname, cmd, roles, qual, with_check
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
 order by cmd, policyname;

-- ------------------------------------------------------------
-- 2. Remove as políticas sem verificação de dono
--
-- Também remove as duplicatas de leitura: três políticas idênticas
-- liberando SELECT no mesmo bucket. Não é falha, é ruído que faz o
-- próximo leitor perder tempo.
-- ------------------------------------------------------------
do $$
declare
  soltas text[] := array[
    'Permitir upload imagens produtos',
    'Permitir update imagens produtos',
    'Permitir delete imagens produtos',
    'Permitir leitura imagens produtos',
    'public read product images'
  ];
  nome text;
begin
  foreach nome in array soltas loop
    begin
      execute format('drop policy if exists %I on storage.objects', nome);
      raise notice 'removida: %', nome;
    exception when insufficient_privilege then
      raise notice 'SEM PERMISSAO para remover "%": remova pelo painel em Storage > Policies', nome;
    end;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 3. Garante o que precisa existir
--
-- Faltava UPDATE com verificação de pasta em product-images: só havia
-- a versão solta, que acabou de sair. Sem esta, substituir uma imagem
-- passaria a falhar.
-- ------------------------------------------------------------
do $$
begin
  begin
    drop policy if exists "owner_update_product_images_storage" on storage.objects;
    create policy "owner_update_product_images_storage"
      on storage.objects for update
      to authenticated
      using (
        bucket_id = 'product-images'
        and (storage.foldername(name))[1] in (
          select id::text from public.stores where owner_id = auth.uid()
        )
      )
      with check (
        bucket_id = 'product-images'
        and (storage.foldername(name))[1] in (
          select id::text from public.stores where owner_id = auth.uid()
        )
      );
    raise notice 'criada: owner_update_product_images_storage';
  exception when insufficient_privilege then
    raise notice 'SEM PERMISSAO para criar a policy de UPDATE: crie pelo painel';
  end;
end $$;

-- ------------------------------------------------------------
-- 4. Depois: confira que sobrou só o que confere a pasta
--
-- O que você deve ver:
--   SELECT  aberto nos dois buckets (foto de produto e logo são
--           públicos por natureza — é a vitrine)
--   INSERT / UPDATE / DELETE  todos com "storage.foldername(name)[1]
--           IN (select id from stores where owner_id = auth.uid())"
--
-- Se sobrar qualquer linha de escrita SEM esse trecho, ela é uma porta
-- entre lojas.
-- ------------------------------------------------------------
select
  policyname,
  cmd,
  roles,
  case
    when cmd = 'SELECT' then 'leitura publica (ok para vitrine)'
    when coalesce(qual, '') || coalesce(with_check, '') like '%owner_id = auth.uid()%'
      then 'OK — confere a pasta da loja'
    else '>>> ATENCAO: escrita sem verificacao de dono <<<'
  end as veredito
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
 order by cmd, policyname;
