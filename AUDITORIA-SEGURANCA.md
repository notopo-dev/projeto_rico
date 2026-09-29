# Auditoria de segurança — LojaPro / Money NoTopo

Data: 28/09/2026 · Escopo: frontend, Edge Functions, banco, storage, deploy.

Método: leitura de 71 arquivos em `src/`, 16 Edge Functions, 72 arquivos `.sql`
e a configuração da Vercel. Nada foi testado contra o ambiente de produção —
onde a conclusão depende do estado real do banco, isso está dito.

---

## AVISO QUE VEM ANTES DE TUDO

**Os 72 arquivos `.sql` do projeto se contradizem e não há registro de quais
foram executados.** Há três gerações de políticas sobrepostas, arquivos que
criam a mesma policy com nomes iguais (o segundo falharia), e arquivos que
criam políticas sem ligar o RLS (política sem RLS não protege nada).

Segurança escrita em arquivo não protege. O que protege é o que está vivo no
banco. Por isso a primeira coisa a rodar é `20_diagnostico_seguranca.sql`, que
só lê. Três itens deste relatório (C1, C2, C4) só se confirmam ou se descartam
com o resultado dele.

---

## VULNERABILIDADES ENCONTRADAS

Gravidade pelo dano possível, não pela dificuldade de explorar.

### CRÍTICO

**V1 — O preço da compra vinha do navegador** · `src/store/lib/storeApi.ts`
O checkout enviava `preco_unitario`, `subtotal` e `total` junto com o pedido, e
o banco aceitava. A cobrança na Stripe sai de `orders.total` — ou seja, do valor
que o comprador escreveu. Dava para comprar qualquer coisa por um centavo
editando a requisição no navegador.
**Corrigido** em `19_checkout_seguro.sql`: o pedido passa a ser criado pela
função `criar_pedido_publico`, que lê o preço da tabela de produtos. O preço e o
nome foram removidos do que o navegador envia.

**V2 — Leitura pública de toda a base de clientes** · `adicionar_select_publico_customers.sql`
A policy `public_select_customers_for_checkout` liberava SELECT em `customers`
para qualquer visitante, filtrando apenas por "loja ativa" — não pela loja
visitada. Um `GET /rest/v1/customers` com a chave anônima (publicada no site)
devolvia nome, e-mail, telefone e CPF de **todos os clientes de todas as lojas
da plataforma**.
**Corrigido**: policy removida em `19` e de novo em `21`, com `revoke select`
no papel anônimo.

**V3 — Escrita pública em pedidos e itens** · `02_rls.sql`, `criar_todas_policies.sql`
`public_insert_orders` e `public_insert_order_items` permitiam a um visitante
inserir pedido em qualquer loja ativa, com `status` à escolha — inclusive
`'pago'` — e itens com preço arbitrário.
**Corrigido**: policies removidas e `revoke insert, update, delete` para `anon`
nas três tabelas (`21`).

**V4 — `stores` entregava a linha inteira ao visitante anônimo** · `02_rls.sql:30`
RLS filtra LINHA, não COLUNA. A policy `public_read_active_stores` é correta no
que faz, mas com ela um `GET /rest/v1/stores?select=*` devolvia, de cada loja
ativa: `stripe_account_id`, `stripe_customer_id`, `stripe_subscription_id`,
`stripe_payment_method_id`, `assinatura_status`, `plano`, `owner_id` e o
endereço de origem completo — que costuma ser a casa do lojista.
**Corrigido** em `21`: permissão de coluna. O papel anônimo passa a ler apenas
as colunas da vitrine.

**V5 — Preço da mensalidade escolhido pelo lojista** · `supabase/functions/stripe-assinatura-ativar/index.ts:68`
Era `body.price_id || PRICE_PADRAO`, com a única checagem de começar com
`price_`. Price IDs aparecem no código do site. Qualquer lojista autenticado
podia assinar o plano mais barato — ou um de R$ 0 — com o painel mostrando o
plano contratado. Era a receita da plataforma aberta.
**Corrigido**: o corpo da requisição não é mais lido; o preço vem do ambiente.

**V6 — `v_estoque` furava o RLS** · `03_functions.sql:120`
View no Postgres roda com os poderes de quem a criou e ignora RLS, a menos que
`security_invoker` esteja ligado — e o padrão é desligado. A view está no
schema `public`, portanto exposta pela API. Um `GET /rest/v1/v_estoque`
devolvia nome, SKU e estoque de todos os produtos de todas as lojas, inclusive
os inativos que a policy pública esconde.
**Corrigido** em `21`: `security_invoker = true`.

**V7 — Tabelas sem RLS** · `profiles`, `product_colors`, `product_sizes`
Nenhum arquivo do projeto liga RLS nessas três. `profiles` tem uma policy órfã
(inerte sem RLS); as outras duas não têm policy nenhuma. Tabela sem RLS está
100% aberta pela API: leitura **e escrita** por qualquer pessoa com a chave
anônima. `profiles` é a identidade de todos os lojistas.
**Corrigido** em `21`: RLS ligado em laço sobre todas as tabelas do schema, mais
policies próprias para as três.
*Confirmar com o diagnóstico se estavam mesmo desligadas.*

### ALTO

**V8 — Rastreio liberava a loja inteira** · `supabase/functions/frete-rastrear/index.ts:85`
Depois de conferir CPF + telefone, a função fazia `lojaIdAutorizada = storeId` e
buscava o pedido só por `store_id`. Quem comprasse uma vez na loja passava a
rastrear o pedido de qualquer outro cliente dela.
**Corrigido**: a consulta agora exige `cpf_comprador` e `telefone_comprador` do
próprio pedido. Resposta idêntica para pedido inexistente e pedido alheio.

**V9 — Funções abertas sem limite de requisições** · `frete-calcular`, `frete-rastrear`, `stripe-create-payment-intent`
Nenhuma das 15 Edge Functions tinha rate limit. As três acima respondem sem
login: dava para queimar a cota do Melhor Envio de qualquer loja em laço, varrer
pares CPF+telefone para descobrir clientes, e encher a conta Stripe do lojista
de cobranças abandonadas.
**Corrigido**: tabela `rate_limit` + função `consumir_limite` (`22`), e
`_shared/limite.ts` aplicado nas três. Limites: frete 30/min por origem e
300/min por loja; rastreio 15/min; cobrança 20/min.

**V10 — Webhook confiava no metadata acima da conta emissora** · `stripe-webhook/index.ts:127`
Era `pi.metadata?.store_id ?? lojaDaConta()`. Metadata acompanha o objeto; a
conta que emitiu é o que a assinatura da Stripe prova. Com a ordem antiga, um
evento com metadata apontando para outra loja quitava pedido alheio.
**Corrigido**: a conta emissora manda; metadata divergente faz o evento ser
recusado e registrado.

**V11 — Etiqueta paga duas vezes** · `frete-gerar-etiqueta/index.ts:123`
A trava contra repetição olhava `melhor_envio_order_id`, gravado só **depois**
de registrar e pagar o envio. Dois cliques criavam dois envios e dois
pagamentos do saldo do lojista.
**Corrigido**: reserva atômica (`update ... is null ... returning`) antes de
qualquer gasto; a segunda chamada recebe 409.

**V12 — Upload sem validação real** · `productImagesApi.ts`, `storeCustomizationApi.ts`, `Products.tsx:387`
A extensão saía do nome enviado e o Content-Type do `file.type` — ambos
escolhidos por quem envia. `accept="image/*"` é dica de interface. SVG passava
(é XML, aceita `<script>`). Logo e banner não tinham limite de tamanho. Pior de
todos: a imagem de cor ia para `cores/<timestamp>-<nome do arquivo>`, uma pasta
**global**, fora do espaço da loja, com o nome do arquivo usado literalmente.
**Corrigido**: `src/lib/imagemSegura.ts` confere os primeiros bytes do arquivo
(assinatura real, não o que o remetente afirma), recusa SVG, limita tamanho, e
o nome passa a ser gerado. A imagem de cor foi movida para a pasta da loja.

**V13 — Escrita de coluna arbitrária** · `storeCustomizationApi.ts:30`, `settingsApi.ts:63`
`.update(input)` com o objeto do chamador repassado inteiro. `Partial<T>` só
existe na compilação: em execução, qualquer chave chegava ao update — incluindo
`owner_id`, `slug`, `plano` ou `assinatura_status`, pelo console do navegador.
**Corrigido**: as duas funções copiam campo a campo.

### MÉDIO

**V14 — Token do Melhor Envio trazido para o navegador** · `settingsApi.ts`, `freteConfigApi.ts`
O painel fazia `select melhor_envio_token` só para saber se estava conectado.
Esse token compra etiqueta com o saldo do lojista.
**Corrigido**: nova função `melhor_envio_conectado()` responde só sim ou não; o
token não sai mais do banco. (Os campos mortos de Correios, Mercado Pago e Pix
já tinham saído antes.)

**V15 — Mensagem de erro crua para o cliente final** · `stripe-create-payment-intent`, `frete-calcular`
As duas devolviam `err.message` ao comprador anônimo, expondo id de conta
conectada e detalhe de configuração.
**Corrigido**: detalhe vai para o log, comprador recebe frase genérica.

**V16 — Enumeração de contas no cadastro** · `authErrors.ts:19`
"Já existe uma conta com esse e-mail" transformava o cadastro em verificador de
quem é lojista da plataforma. Login e recuperação de senha já respondiam igual
nos dois casos.
**Corrigido**: mensagem neutra.

**V17 — CSP e headers** · `vercel.json`
`img-src` aceitava `https:` (qualquer host do mundo), e o logo/banner é uma URL
livre escolhida pelo lojista — dava para apontar para servidor próprio e
registrar IP e navegador de cada visitante da loja. Faltava `frame-ancestors`
(o `X-Frame-Options` é tratado como legado pelos navegadores atuais).
**Corrigido**: `img-src` restrito às origens reais, `frame-ancestors 'self'`,
`upgrade-insecure-requests`, `Cross-Origin-Resource-Policy`, e
`Permissions-Policy` ampliada.

**V18 — Estoque negativo** · `03_functions.sql:92`
A baixa subtraía sem piso e não havia constraint.
**Corrigido** em `21`: zera os negativos existentes e cria
`check (estoque >= 0)`.

**V19 — `search_path` livre em funções** · várias
Função `security definer` sem `search_path` fixo pode ser levada a chamar
tabela falsa de outro schema. Duas versões conflitantes de `handle_new_user`
existem no projeto e não se sabe qual está viva.
**Corrigido** em `21`: `alter function ... set search_path` em laço, sem
reescrever corpo — funciona sobre qualquer versão que esteja no banco.

### BAIXO / ACEITO

- **Frete do Melhor Envio vem do navegador.** O banco não tem como refazer a
  cotação. Mexer nisso custa o frete ao lojista, nunca o produto. Aceito e
  documentado em `19_checkout_seguro.sql`.
- **Consulta pública de pedidos por CPF + telefone.** CPF não é segredo no
  Brasil. É decisão de produto; agora com rate limit.
- **Cadastro do cliente reaproveitado por telefone ou e-mail isolado.** Quem
  informar o telefone de outra pessoa tem o pedido pendurado no cadastro dela.
  Não vaza histórico (a consulta usa a identidade do pedido), mas suja o
  cadastro. **Não corrigido.**
- **"Pagamento aprovado" vem de `?status=` na URL** (`StoreOrderConfirmed.tsx`).
  Só visual; o banco não muda. Serve para golpista mostrar tela falsa ao
  lojista. **Não corrigido.**
- **Catálogo de todas as lojas é público.** Concorrente baixa preço e estoque de
  todos os lojistas. Inerente ao modelo de loja pública num banco só.
- **Dados pessoais reais em arquivos de diagnóstico** (`12_diagnostico_consulta.sql`
  tem CPF e telefone de cliente real; `criar_minha_loja.sql` tem e-mail).
  `.gitignore` não cobre `*.sql`. **Não corrigido** — decisão sua.
- **Sem lockfile** (`package-lock.json` existe no disco mas não estava no
  pacote auditado). Com dependências em `^` e `npm install` no deploy, dois
  builds podem instalar versões diferentes.

---

## O QUE ESTAVA CORRETO

Não é tudo ruim, e vale saber o que não precisa ser mexido:

- **Nenhum segredo no navegador.** Só `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY` e `VITE_STRIPE_PUBLISHABLE_KEY` — as três públicas
  por natureza. O SDK server-side da Stripe não está nas dependências do site.
- **Nenhum XSS.** Zero ocorrências de `dangerouslySetInnerHTML`, `innerHTML`,
  `eval` ou `document.write` em todo o `src/`. Todo conteúdo de usuário é
  renderizado como filho JSX, que o React escapa.
- **Nenhum `href` com string livre do banco** — sem vetor `javascript:`.
- **Sem SQL injection.** Tudo passa pelo cliente Supabase ou por funções com
  parâmetros. A única interpolação (`stripe-reembolso:133`) usa um id lido do
  banco, não entrada do usuário.
- **Assinatura de webhook verificada** e proteção contra repetição por chave
  primária em `stripe_events`.
- **`stripe-reembolso`** tem a cadeia de propriedade completa: usuário → loja →
  pedido → pagamento, com o valor limitado ao saldo devolvível. É o exemplo de
  como as outras deveriam ser.
- **Nenhuma função Stripe aceita `accountId` do corpo.** Todas derivam a conta
  conectada da linha da loja do usuário autenticado.
- **`AuthGuard`** usa `getUser()` (valida no servidor), não `getSession()`.
- **`store_settings`, `payments` e `stripe_events`** nunca tiveram acesso
  público.

---

## ALTERAÇÕES NO BANCO

| Arquivo | O que faz |
|---|---|
| `19_checkout_seguro.sql` | Função `criar_pedido_publico` (preço do servidor); remove escrita pública |
| `20_diagnostico_seguranca.sql` | **Só lê.** Dump do estado real: RLS, policies, grants, views, funções, storage |
| `21_blindagem_banco.sql` | RLS em todas as tabelas; policies de `profiles`/`product_colors`/`product_sizes`; `v_estoque` com `security_invoker`; permissão de coluna em `stores`; `search_path` nas funções; `check (estoque >= 0)`; função `melhor_envio_conectado()` |
| `22_rate_limit.sql` | Tabela `rate_limit` + função `consumir_limite` |

Nenhum dos três apaga tabela, apaga dado ou remove funcionalidade.

## ALTERAÇÕES NAS EDGE FUNCTIONS

`stripe-assinatura-ativar` (preço do servidor) · `frete-rastrear` (dono do
pedido + limite) · `stripe-webhook` (conta emissora manda) ·
`frete-gerar-etiqueta` (reserva atômica) · `stripe-create-payment-intent`
(limite + erro genérico) · `frete-calcular` (limite + erro genérico) ·
`_shared/limite.ts` (novo).

## ALTERAÇÕES NO FRONTEND

`src/lib/imagemSegura.ts` (novo) · `productImagesApi.ts` ·
`storeCustomizationApi.ts` · `settingsApi.ts` · `freteConfigApi.ts` ·
`authErrors.ts` · `pages/Products.tsx` · `vercel.json`.

---

## ORDEM DE EXECUÇÃO

1. `20_diagnostico_seguranca.sql` — **só lê**, e me mande o resultado
2. `19_checkout_seguro.sql` — se ainda não rodou
3. `21_blindagem_banco.sql`
4. `22_rate_limit.sql`
5. Deploy das funções:
   `frete-calcular`, `frete-rastrear`, `frete-gerar-etiqueta`,
   `stripe-webhook`, `stripe-create-payment-intent`, `stripe-assinatura-ativar`
6. `npm run build` + push
7. Rodar `20_diagnostico_seguranca.sql` de novo e comparar

---

## O QUE PRECISA SER FEITO FORA DO CÓDIGO

**Supabase**
- **Backup**: verificar se o projeto tem Point-in-Time Recovery. No plano Free
  o backup é diário e some em 7 dias; PITR exige plano pago. Sem isso, apagar
  uma loja por engano não tem volta.
- **Proteção de senha vazada**: Authentication → Policies → ativar
  "Leaked password protection" (compara com a base do HaveIBeenPwned).
- **Confirmação de e-mail obrigatória** no cadastro, se ainda não estiver.
- **MFA para a sua conta de dono do projeto** — é a chave do reino.
- Conferir o rate limit nativo de Auth (tentativas de login por hora).

**Vercel**
- Conferir que as variáveis de produção não têm nenhuma chave privada.
- Proteger o ambiente de Preview (deploy de branch fica público por padrão).

**Cloudflare** — o projeto não usa hoje. Se um dia colocar, é onde ficariam WAF,
proteção de bot e rate limit de borda. Não é obrigatório: o limite que
implementamos está no servidor, que é o que importa.

**Rotação de chaves** — as chaves da Stripe apareceram em log de terminal nesta
conversa em 26/09 e o secret do Melhor Envio em 28/09. Confirme que os três
foram regenerados depois disso.

---

## RISCOS QUE PERMANECEM

1. **`'unsafe-inline'` em `script-src`.** Anula boa parte do CSP contra XSS
   injetado. Não removi porque não consigo testar o build aqui, e um CSP errado
   quebra o site inteiro. Para testar: tire `'unsafe-inline'` só do `script-src`
   (não do `style-src`), faça deploy num preview e abra o console. Se não
   aparecer erro de CSP, pode ir para produção. O React não injeta script
   inline; a chance de quebrar é pequena, mas precisa ser verificada.
2. **Sessão do lojista em `localStorage`.** Padrão do supabase-js no navegador.
   Qualquer XSS entrega a sessão. Hoje não há sink de XSS no código — é por isso
   que o item 1 importa.
3. **Rate limit por IP** contém laço automatizado, não alguém determinado com
   vários IPs. Para isso seria preciso WAF na borda.
4. **O estado real do banco ainda não foi verificado.** Enquanto o diagnóstico
   não rodar, V2, V3 e V7 são "provavelmente corrigidos", não "corrigidos".
