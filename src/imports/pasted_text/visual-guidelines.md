# DIRETRIZES VISUAIS — SISTEMA PROFISSIONAL, NÃO "DESIGN DE IA"

Esta regra é extremamente importante.

A interface NÃO deve parecer um template genérico criado por inteligência artificial.

Não quero um visual semelhante aos atuais sites SaaS que utilizam:

* excesso de cards flutuantes
* gradientes
* sombras exageradas
* bordas excessivamente arredondadas
* botões gigantes e muito arredondados
* excesso de espaços vazios
* dashboards cheios de gráficos desnecessários
* efeitos glassmorphism
* elementos decorativos sem função
* aparência de landing page de startup
* visual excessivamente "Apple"
* visual excessivamente "AI"
* textos promocionais dentro do sistema
* excesso de animações

Quero que o produto pareça um **software real, profissional e desenvolvido especificamente para gerenciamento de lojas**.

A sensação deve ser:

"Estou dentro de um sistema administrativo profissional."

e não:

"Estou dentro de um template de IA."

---

# 1. IDENTIDADE VISUAL

A identidade principal deve utilizar:

* branco
* verde
* cinza
* preto em textos importantes

O verde será utilizado principalmente para:

* ações primárias
* estados positivos
* indicadores importantes
* elementos selecionados
* confirmação

Não utilizar verde em absolutamente todos os elementos.

A interface precisa respirar, mas sem exagerar no espaço vazio.

---

# 2. ÍCONES

NÃO UTILIZAR EMOJIS NA INTERFACE.

Não utilizar:

* emojis
* símbolos Unicode como substitutos de ícones
* caracteres decorativos

Utilizar exclusivamente uma biblioteca profissional de ícones.

Preferência:

Lucide React.

Os ícones devem parecer parte natural do sistema.

Exemplos:

Produtos → Package

Pedidos → ShoppingBag

Clientes → Users

Configurações → Settings

Dashboard → LayoutDashboard

Pagamentos → CreditCard

Loja → Store

Adicionar → Plus

Editar → Pencil

Excluir → Trash2

Buscar → Search

Menu → Menu

Fechar → X

Voltar → ArrowLeft

Salvar → Save

Os ícones devem possuir peso visual consistente.

Preferência:

stroke-width entre 1.8 e 2.

---

# 3. NÃO USAR ÍCONES GIGANTES

Ícones devem ser discretos.

Tamanhos:

16px
18px
20px

Ícones de destaque podem utilizar 24px.

Não criar cards com ícones gigantes apenas para preencher espaço.

---

# 4. BOTÕES

Os botões devem parecer componentes de um sistema profissional.

Não utilizar botões excessivamente arredondados.

Evitar:

border-radius: 9999px

na maioria dos botões.

Preferir bordas discretamente arredondadas:

4px
6px
8px

dependendo do contexto.

Os botões devem possuir aparência objetiva.

Exemplo:

[ + Novo produto ]

em vez de um botão enorme e arredondado ocupando espaço desnecessário.

---

# 5. BOTÃO PRIMÁRIO

Utilizar verde apenas na ação principal.

Exemplo:

Novo produto

Salvar

Publicar loja

Finalizar pedido

O botão deve ser visualmente claro, mas não exagerado.

---

# 6. BOTÕES SECUNDÁRIOS

Utilizar:

* outline
* ghost
* fundo branco
* cinza claro

Exemplo:

[ Cancelar ] [ Salvar ]

O botão primário deve possuir maior destaque.

---

# 7. ESTADOS DOS BOTÕES

Todos os botões devem possuir:

hover

active

focus-visible

disabled

loading

O feedback deve ser discreto e profissional.

Não utilizar animações exageradas.

---

# 8. CAMPOS DE FORMULÁRIO

Os inputs devem parecer campos de um sistema administrativo.

Evitar campos excessivamente arredondados.

Preferir:

* borda fina
* fundo branco
* altura consistente
* labels claros
* foco verde discreto

Exemplo:

Nome do produto

[ Camiseta Masculina                  ]

Preço

[ R$ 129,90                           ]

Não colocar textos enormes dentro dos inputs.

---

# 9. CARDS

Cards devem existir quando realmente ajudarem na organização.

Não colocar tudo dentro de cards.

Evitar o padrão:

┌────────────────────┐
│       ÍCONE        │
│                    │
│     R$ 10.000      │
│     +20%           │
└────────────────────┘

repetido dezenas de vezes.

Quero uma interface mais parecida com um sistema administrativo.

Utilizar:

* divisórias
* tabelas
* linhas
* seções
* cabeçalhos
* menus
* filtros
* pequenos painéis informativos

---

# 10. DASHBOARD

O Dashboard deve ser funcional.

Não quero um dashboard feito apenas para parecer bonito.

Mostrar informações que realmente ajudam o lojista:

Vendas

Pedidos

Produtos

Clientes

Pedidos recentes

Produtos mais vendidos

Utilizar gráficos somente quando forem úteis.

---

# 11. SIDEBAR

A sidebar deve parecer uma ferramenta profissional.

Estrutura:

LOGO DA PLATAFORMA

Nome da loja

---

Visão geral

Loja

Produtos

Categorias

Pedidos

Clientes

Estoque

---

Vendas

Pagamentos

WhatsApp

---

Configurações

O item selecionado deve possuir indicação visual clara.

Pode utilizar:

* fundo verde muito suave
* barra lateral
* mudança de peso do texto
* ícone destacado

Não usar efeitos exagerados.

---

# 12. HEADER

O header deve ser simples.

Exemplo:

[Menu]   Minha Loja                    [Notificações] [Perfil]

Não colocar dezenas de elementos.

---

# 13. TABELAS

As tabelas devem ser um dos componentes principais do sistema.

Quero aparência de software administrativo.

Exemplo:

Produto | SKU | Preço | Estoque | Status | Ações

---

Camiseta | CAM001 | R$ 89,90 | 12 | Ativo | Editar

Tênis | TEN002 | R$ 199,90 | 4 | Ativo | Editar

Utilizar:

* linhas bem definidas
* cabeçalho discreto
* espaçamento consistente
* ações rápidas
* estados visuais

No mobile, permitir rolagem horizontal somente dentro da tabela.

---

# 14. BADGES

Utilizar badges discretos para estados.

Exemplo:

Ativo

Em estoque

Pago

Pendente

Cancelado

Não criar badges excessivamente coloridos.

---

# 15. MODAIS

Os modais devem parecer parte de um sistema.

Evitar modais gigantes.

Utilizar:

* título
* descrição curta
* formulário
* ações

Exemplo:

Excluir produto?

Esta ação não poderá ser desfeita.

[Cancelar] [Excluir]

---

# 16. MENUS

Menus devem ser objetivos.

Evitar menus com excesso de animação.

Utilizar pequenas transições quando necessário.

---

# 17. ANIMAÇÕES

Utilizar animações somente quando melhorarem a experiência.

Exemplos:

* abertura de menu
* modal
* feedback de carregamento
* mudança de página
* atualização de dados

Não utilizar:

* elementos flutuando
* efeitos parallax
* gradientes animados
* partículas
* animações decorativas
* textos aparecendo sem necessidade

---

# 18. TIPOGRAFIA

Utilizar uma fonte moderna e altamente legível.

Preferência:

Inter

ou outra fonte semelhante.

A tipografia deve possuir hierarquia clara.

Evitar títulos gigantes.

O sistema deve priorizar informação e produtividade.

---

# 19. ESPAÇAMENTO

Utilizar um sistema consistente:

4px
8px
12px
16px
24px
32px

Evitar espaços gigantes apenas para deixar a interface "bonita".

---

# 20. DESIGN DE SISTEMA

A interface deve parecer construída a partir de um verdadeiro Design System.

Criar componentes reutilizáveis:

Button

Input

Select

Modal

Dropdown

Badge

Table

Pagination

Tabs

Sidebar

Header

Card

EmptyState

Loading

Toast

ConfirmDialog

Cada componente deve possuir estados consistentes.

---

# 21. PERSONALIDADE DO PRODUTO

O sistema deve transmitir:

* confiança
* organização
* velocidade
* profissionalismo
* simplicidade
* controle

Não quero que pareça uma ferramenta experimental.

Quero que pareça um produto comercial que poderia ser vendido para milhares de lojistas.

---

# 22. LOJA DO CONSUMIDOR

A loja pública também deve evitar aparência genérica de template de IA.

Ela deve parecer uma loja real.

Priorizar:

* produtos
* imagens
* preço
* informações
* navegação
* carrinho
* checkout

O design pode ser moderno, mas deve ser funcional.

---

# 23. CHECKOUT

O checkout deve ser extremamente limpo.

Não utilizar elementos decorativos desnecessários.

Priorizar:

1. identificação do cliente
2. endereço
3. resumo do pedido
4. pagamento
5. confirmação

O cliente precisa saber exatamente:

* o que está comprando
* quanto está pagando
* como vai pagar
* o que acontecerá depois

---

# 24. RESPONSIVIDADE

Manter todas as regras anteriores:

Mobile:

320px–767px

Tablet:

768px–1023px

Desktop:

1024px+

Referência:

1440px.

---

# 25. MOBILE

No mobile, a interface deve parecer um aplicativo/sistema adaptado para celular.

Não simplesmente diminuir o desktop.

Utilizar:

* menu drawer
* navegação simplificada
* tabelas com scroll interno
* botões fáceis de tocar
* formulários em uma coluna
* ações principais acessíveis

Nunca criar scroll horizontal na página inteira.

---

# 26. FILOSOFIA DE DESIGN

Antes de criar qualquer tela, faça esta pergunta:

"Isso melhora a experiência do usuário ou está aqui apenas para parecer bonito?"

Se estiver apenas para parecer bonito, remova.

A prioridade é:

FUNCIONALIDADE

↓

CLAREZA

↓

USABILIDADE

↓

CONSISTÊNCIA

↓

ESTÉTICA

O resultado deve ser bonito justamente porque é organizado e funcional.

---

# 27. REGRA FINAL

NUNCA utilizar emojis na interface.

NUNCA criar um visual genérico de dashboard produzido por IA.

NUNCA exagerar em cards, sombras, gradientes ou bordas arredondadas.

NUNCA transformar o sistema em uma landing page.

Quero um **software de verdade**.

A interface deve parecer que foi criada por uma equipe profissional de produto, UX/UI e engenharia para atender lojistas.

O sistema deve ser:

limpo

rápido

objetivo

profissional

funcional

e visualmente distinto dos templates modernos genéricos.
