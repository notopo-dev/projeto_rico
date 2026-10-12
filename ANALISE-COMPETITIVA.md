# Money NoTopo — onde estamos contra o mercado

Pesquisa de 12/10/2026. Fontes no fim de cada bloco.
Marcado **[verificado]** o que eu confirmei na fonte primária e
**[do agente]** o que vem da pesquisa sem eu ter reconferido.

---

## Veredito

**Não está pronto para lançar como "plataforma de e-commerce" a
R$ 78/mês.** Faltam três coisas que no Brasil são pré-requisito de
compra — parcelamento, nota fiscal e cupom de desconto — e o preço
fixo só começa a economizar dinheiro do lojista num faturamento em
que ele já exige justamente essas três.

Isso não quer dizer que o trabalho foi perdido. Quer dizer que o
**posicionamento** está errado, não o produto. Ver a última seção.

---

## 1. O parcelamento não é "falta implementar"

**[verificado]** A documentação de parcelamento da Stripe lista
exatamente três caminhos: Mastercard Installments, México e Japão.
**O Brasil não aparece.**
https://docs.stripe.com/payments/installments

**[verificado]** Existe reclamação pública de lojista perguntando à
Stripe quando Pix e parcelamento estarão disponíveis.
https://www.reclameaqui.com.br/stripe/pix-e-parcelamento-quando-estarao-disponiveis_xfAwt61Xg7GqFuUR/

Consequência: oferecer 12x exige somar ou trocar o gateway
(Mercado Pago, PagBank ou Pagar.me). Não é uma tela, é a arquitetura
de pagamento. **Isto precisa ser decidido antes de qualquer anúncio.**

Por que importa em moda: o cartão é ~40% do valor no e-commerce
brasileiro *por causa* do parcelamento, e a média de parcelas sem
juros chegou a 6,5x. Com ticket na casa das centenas de reais,
vender sem parcelar é perder a venda. **[do agente]**

---

## 2. A conta do "sem porcentagem"

O argumento é meia-verdade: o lojista continua pagando percentual,
só que para a Stripe (3,99% + R$ 0,39 no cartão) em vez de para nós.

**[verificado]** Planos da Nuvemshop, da própria página de preços:

| Plano | Mensalidade | Tarifa por venda | MDR Nuvem Pago | Domínio próprio |
|---|---|---|---|---|
| Começo | R$ 0 | 2% | 4,69% | **não** |
| Essencial | R$ 69 | 2% | 4,19% | sim |
| Impulso | R$ 164 | 1% | 3,69% | sim |

A página não explica como a "tarifa por venda" e o MDR se somam —
na prática a tarifa costuma ser dispensada para quem usa o Nuvem
Pago, mas **isso não está escrito**. Então o ponto de empate fica
numa faixa, não num número:

- se a tarifa de 2% é dispensada: empatamos perto de **R$ 11 mil/mês**
- se ela se soma ao MDR: empatamos perto de **R$ 2,9 mil/mês**

**O que não depende dessa dúvida:** o plano grátis da Nuvemshop
**não dá domínio próprio**. Quem quer endereço próprio — que é o que
a nossa página vende — precisa do Essencial, a **R$ 69**. Nove reais
abaixo do nosso, com muito mais função.

Fonte: https://www.nuvemshop.com.br/planos-e-precos

---

## 3. A grade de cor e tamanho NÃO é diferencial

Esta é a correção mais incômoda, porque a nossa página inteira está
construída em cima dela.

**[do agente, com fonte oficial]** A Nuvemshop controla estoque,
preço, SKU, código de barras, peso e dimensões **por variação**.
Loja Integrada, Tray, Bagy e Shopify também fazem grade.
https://atendimento.nuvemshop.com.br/pt_BR/organizar-produtos/como-cadastrar-variacoes-em-meus-produtos

Vender "estoque por cor e tamanho" como diferencial não sobrevive à
primeira comparação que o lead fizer.

O que sobra de nosso naquele recurso: a vitrine distinguir "não
existe nessa cor" de "esgotou nessa cor". É honesto e ninguém
confirmou que os outros façam — mas é detalhe de tela, não motivo
para trocar de plataforma.

---

## 4. O que falta, por ordem de impacto

### Impede a venda do plano

| # | O que falta | Esforço | Por quê |
|---|---|---|---|
| 1 | **Parcelamento** | alto — decisão de gateway | Ver seção 1 |
| 2 | **Cupom de desconto** | baixo, 1–2 semanas | A Loja Integrada entrega **no plano R$ 0**. Sem cupom não existe campanha de Instagram, primeira compra nem Black Friday |
| 3 | **Nota fiscal** | médio (integrar emissor) | Venda de produto exige NF-e. Cobrar R$ 78 e o lojista ainda ter que pagar R$ 60 de Bling só para emitir nota põe o custo real em R$ 138 |
| 4 | **WhatsApp de verdade** | médio | 75% dos pequenos lojistas online vendem por WhatsApp; em moda, 44% usam grupos fechados. Tela que não funciona queima a demo |

### Melhoria depois

Carrinho abandonado · boleto (a Stripe **tem** boleto no Brasil, então
é só implementar) · múltiplos usuários com permissão · kit/combo e
código de barras · marketplace (é o teto de crescimento: quando o
cliente quiser vender na Shopee, ele sai).

**Não entrar:** ficha técnica, consumo de tecido, PCP, planejamento de
coleção. Isso é ERP de confecção (CIGAM, Millennium), outro produto e
outro preço — Omie começa em R$ 309/mês. Competir ali é perder.

---

## 5. Onde a gente realmente ganha

Sem enfeite: **não ganhamos em função de nenhum concorrente
relevante.** Ganhamos em modelo e em ausência de limite.

1. **O dinheiro cai na conta do lojista, sem passar por nós.** Isto é
   genuinamente diferente. E é o medo número um dos lojistas: o
   segundo problema mais reclamado da Loja Integrada no Reclame Aqui
   é "estorno do valor pago", com 196 ocorrências. **[do agente]**
2. **Preço fixo de verdade, sem tarifa da plataforma sobre a venda.**
   Todos os outros cobram percentual quando o lojista não usa o meio
   de pagamento da casa.
3. **Sem limite de produto nem de visita.** A Loja Integrada grátis
   trava em 50 produtos e 5.000 visitas/mês; a Tray de R$ 39–59 trava
   em 100 produtos e 100 pedidos/mês. Lojista de moda tem muita
   referência — isso machuca. **Este argumento é melhor que a grade.**
4. **Domínio próprio no plano de entrada**, que a Nuvemshop só dá a
   partir do Essencial. **[verificado]**
5. **Custo por produto nativo** (margem por peça), que normalmente
   mora no ERP.
6. **Multi-loja pelo mesmo dono, no mesmo preço.**

---

## 6. Um risco que ninguém tinha olhado: o Pix

**[do agente]** O Pix na Stripe é **"somente por convite"**, e o Pix
foi **42% do valor transacionado no e-commerce brasileiro em 2025**.
Depender de uma habilitação sob convite para 42% do volume é risco de
produto, não detalhe. E a 1,19%, o Pix da Stripe é mais caro que o da
Tray (0,95%).

**A conferir com urgência:** se os lojistas que se cadastrarem
conseguem habilitar Pix nas contas Connect deles, ou se só a nossa
conta tem. A função `stripe-pix-ativar` existe no sistema, então pode
já estar resolvido — mas precisa ser testado com uma conta nova, não
com a sua.

---

## 7. A saída: trocar o posicionamento, não o produto

Como "plataforma de e-commerce" a comparação é perdedora. Mas existe
um enquadramento em que ela não acontece:

**Vender para quem já vende no Instagram e no WhatsApp e não tem loja
nenhuma.** Aí o concorrente não é a Nuvemshop — é o bloco de notas e
a planilha. Nesse terreno, "a grade dá baixa sozinha", "não vende o
que já acabou" e "o dinheiro cai direto na sua conta" voltam a ser
argumentos vivos, porque a alternativa real do cliente é controlar
estoque de cabeça.

Mesmo aí, cupom e WhatsApp funcionando continuam obrigatórios.

**E o teste de 1 dia é curto demais.** Ninguém cadastra um catálogo de
moda em 24 horas. 7 a 14 dias. Isso é uma linha no banco
(`teste_termina_em`) e uma linha na página — barato de mudar, e muda a
taxa de conversão do teste.

---

## 8. Termos de busca

**Não existe fonte pública com volume medido em português para estes
termos, e eu não vou inventar número.** O que o agente conseguiu
verificar foi quais termos os concorrentes atacam com página própria
de SEO:

- "melhor site para vender roupas online" — Loja Integrada tem hub dedicado
- "como montar uma loja virtual de roupas" — Nuvemshop
- "nuvemshop ou loja integrada" — Nuvemshop tem página comparativa oficial
- "sistema para loja de roupas" — disputado por sistemas de PDV

**Brecha com intenção alta e pouca disputa** (inferência, não medido):
"loja virtual sem taxa por venda" e "plataforma e-commerce sem
comissão". Nenhum incumbente quer rankear nisso porque todos cobram.
Mas só funciona se a mensagem for honesta sobre o MDR da Stripe —
prometer "sem taxa" e o lojista descobrir os 3,99% gera cancelamento
e reclamação.

**Evitar:** qualquer termo com "ERP para confecção" ou "ficha técnica".

---

## Ordem sugerida

1. Decidir o gateway do parcelamento (ou decidir assumir que não tem)
2. Testar Pix numa conta Connect nova
3. Cupom de desconto
4. Teste de 7–14 dias em vez de 1
5. WhatsApp de verdade
6. Nota fiscal por integração
7. Reescrever a página em cima de "sem limite" e "dinheiro direto",
   não em cima da grade
