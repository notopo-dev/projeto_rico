# Contexto: integração Stripe Connect (leia antes de mexer)

Este arquivo existe para dar contexto a uma sessão nova do Claude Code.
Estado em 24/09/2026, 21h.

---

## O que é este projeto

Plataforma SaaS multi-tenant de e-commerce (LojaPro / Money NoTopo).
Vários lojistas criam e administram suas próprias lojas.
React + Vite + TypeScript + Tailwind + Supabase (Postgres, Auth, Storage,
Edge Functions em Deno). Deploy na Vercel, domínio moneynotopo.com.br.

**Modelo de negócio: a plataforma NÃO cobra % da venda. Só mensalidade.**
Isso define toda a arquitetura de pagamento abaixo.

---

## Decisões de arquitetura (não reverter sem motivo)

| Decisão | Por quê |
|---|---|
| **Accounts v2** (`/v2/core/accounts`, header `Stripe-Version: 2026-08-26.preview`) | A Stripe recusa v1 para integrações novas |
| **Onboarding embutido** (`@stripe/react-connect-js`) | Selfie (`proof_of_liveness`) e aceite de termos (`tos_acceptance`) não têm endpoint de API — só a Stripe coleta. Era o que travava o cadastro |
| **Cobrança direta** (header `Stripe-Account`), sem `application_fee_amount` | Sem comissão, o lojista é o merchant of record; chargeback é dele e a plataforma não precisa ser instituição de pagamento |
| **Mensalidade via `stripe_balance`** | SetupIntent + Subscription com `customer_account=acct_...`, debitada do saldo do lojista |
| **Tudo dentro do site** | O dono do projeto não quer que o lojista seja redirecionado. O link hospedado da Stripe só existe como saída de emergência quando o formulário embutido falha |

---

## Estrutura relevante

```
supabase/functions/
  stripe-custom-create-account/   cria a conta v2 (merchant + recipient)
  stripe-custom-upload-document/  upload de documento
  stripe-custom-status/           lê o status da conta
  stripe-account-session/         NOVO — AccountSession p/ onboarding embutido
  stripe-account-link/            NOVO — link hospedado (plano B)
  stripe-assinatura-ativar/       NOVO — mensalidade
  stripe-create-payment-intent/   cobrança direta
  stripe-webhook/                 eventos v1 + v2 + assinatura

src/components/
  StripeStatusPanel.tsx           orquestra: conta nova -> formulário nosso;
                                  conta existente com pendências -> embutido
  StripeCustomOnboarding.tsx      formulário nosso, CRIA a conta
  StripeEmbeddedOnboarding.tsx    NOVO — formulário da Stripe dentro do painel

src/store/
  components/StripeCardPayment.tsx  checkout; loadStripe com { stripeAccount }
  lib/stripeApi.ts                  chama a Edge Function do PaymentIntent

src/pages/Termos.tsx, Privacidade.tsx   exigidas pela Stripe ao revisar Connect
```

---

## Nomes de coluna reais (já conferidos no banco)

- `stores.owner_id` (NÃO é `user_id`)
- `orders.status` = `'pago'` (não existe `status_pagamento`)
- `payments.status` = `'pendente' | 'recebido' | 'falhou'`
- `payments`: `transacao_id`, `valor_bruto`, `taxa`, `valor_liquido`,
  `stripe_payment_intent_id`, `stripe_charge_id`, `stripe_account_id`
- `stores`: `stripe_account_id`, `stripe_charges_enabled`,
  `stripe_payouts_enabled`, `stripe_onboarding_completo`,
  `stripe_requisitos_pendentes`, `stripe_billing_habilitado`,
  `stripe_subscription_id`, `stripe_payment_method_id`,
  `assinatura_status`, `assinatura_proxima_cobranca`, `assinatura_plano`
- Tabela `stripe_events` (idempotência do webhook), RLS fechada

O SQL já foi aplicado no Supabase. Não precisa rodar de novo.

---

## O que falta

1. `npm install` e `npm run build` — resolver os erros de tipo que aparecerem
2. Deploy das funções:
   ```
   supabase functions deploy stripe-account-session
   supabase functions deploy stripe-account-link
   supabase functions deploy stripe-assinatura-ativar
   supabase functions deploy stripe-create-payment-intent
   supabase functions deploy stripe-webhook
   ```
3. Secret faltando: `STRIPE_PUBLISHABLE_KEY` (existem apenas
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL`).
   Sem ele o formulário embutido não carrega.
4. No Dashboard da Stripe, o endpoint do webhook precisa estar marcado para
   receber eventos **de contas conectadas (Connect)** — senão os
   `payment_intent.*` das cobranças diretas nunca chegam
5. Investigar "Erro ao carregar configurações" na aba Integrações
   (vem de `src/lib/settingsApi.ts`, não é do Stripe)

---

## Erro conhecido e já corrigido

> The configurations in the request must match the applied configurations
> on the account in order to use v2/core/account_links.

Causa: `stripe-account-link` pedia `configurations: ["merchant"]`, mas a
conta foi criada com `merchant` + `recipient`.
Correção aplicada: a função lê da própria conta quais configurações existem
e pede exatamente essas.

---

## Segurança

- A chave publicável (`pk_...`) pode ficar no frontend — é pública por design.
- A chave secreta (`sk_...`) só nos secrets do Supabase. Nunca no código,
  nunca no `.env` do frontend, nunca colada em chat.
- Uma `sk_live_` foi exposta em conversa e **precisa de Roll** no Dashboard
  (Desenvolvedores → Chaves de API → modo live → Roll key).

---

## Pix: por que não funciona (29/09/2026)

**Pix não é suportado em contas Accounts v2. A capability não existe nesse
modelo — não é questão de liberar.**

Confirmado na tabela oficial de capabilities da Stripe, coluna
"Accounts v2 support", nas duas tabelas (contas com Dashboard completo e contas
Express/Custom/sem Dashboard):

| Método | Capability | Accounts v2 |
|---|---|---|
| Pix | `pix_payments` | **No** |
| Boleto | `boleto_payments` | Yes |
| Cartão | `card_payments` | Yes |

https://docs.stripe.com/connect/account-capabilities#payment-methods

O painel da Stripe diz o mesmo na linha do PIX: *"Aceito apenas na Accounts v1"*.

**Como isso nos afeta:** `stripe-custom-create-account` cria as contas
conectadas em `POST /v2/core/accounts` com `configuration.merchant`. São contas
v2. Portanto o Pix nunca apareceria, independentemente do que o suporte
liberasse — e foi por isso que o chamado ficou dias em círculos.

**São duas barreiras, não uma:**

1. Contas precisam ser **Accounts v1**.
2. Pix no Brasil é **invite only**
   (https://docs.stripe.com/payments/pix — seção Business locations, "BR ...
   (Invite only)").

**Limitações da v2, para referência.** A própria doc lista quando a v1 é
obrigatória: OAuth, recipient service agreement, capabilities `treasury` e
`card_issuing_*`, capabilities depreciadas, e "certain payment methods in
public or private preview".
https://docs.stripe.com/connect/accounts-v2 — seção "Accounts API v2
limitations".

**Estado em 29/09:** perguntado ao suporte se há caminho para Pix em contas v2,
se contas já criadas em v2 podem migrar, e se o convite cobre as contas
conectadas. **Decisão: esperar a resposta antes de reescrever qualquer coisa.**

**Se a resposta for "só v1":** o trabalho é refazer `stripe-custom-create-account`
e `stripe-custom-status` em v1 (`POST /v1/accounts` com controller properties),
mais o fluxo de onboarding. Cartão e cobrança direta funcionam igual na v1.
Nota: já existe um `stripe-connect-onboarding` criando conta **Express v1** no
projeto, sem uso — a auditoria de 28/09 marcou isso como superfície
desnecessária (item B5). Se a migração acontecer, é a hora de unificar.

**Outras pendências do Pix, quando ele existir:**

- O Pix da Stripe passa pelo **Ebanx**. O descritor na fatura do cliente é o
  Ebanx, não a loja — `statement_descriptor` é ignorado.
- **IOF de 3,5%** em transação internacional. O parâmetro
  `payment_method_options[pix][amount_includes_iof]` decide quem paga, e existe
  texto de divulgação obrigatório para integração via API.
- Limites: mínimo R$ 0,50, máximo 3.000 USD por transação.
