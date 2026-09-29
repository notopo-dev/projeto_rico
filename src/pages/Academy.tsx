import { useState } from "react";
import {
  ChevronDown,
  Store,
  Package,
  Tag,
  ShoppingBag,
  Users,
  Boxes,
  Truck,
  BarChart2,
  Wallet,
  Landmark,
  MessageCircle,
  Settings,
  LayoutDashboard,
  AlertTriangle,
} from "lucide-react";

/**
 * Academy — como usar cada parte do sistema.
 *
 * ----------------------------------------------------------------
 * Regra deste arquivo
 * ----------------------------------------------------------------
 * Aqui só entra o que o sistema FAZ hoje. Nada de "em breve"
 * escrito como se já funcionasse.
 *
 * Onde alguma coisa ainda não está pronta, o texto diz isso na cara
 * (campo `aviso`), em vez de ficar calado. Documentação que promete
 * o que a tela não entrega gera mais suporte do que documentação
 * nenhuma — o lojista tenta, não consegue, e acha que errou.
 *
 * Quem mexer numa tela e mudar o passo a passo dela: o texto
 * correspondente está logo abaixo, nesta mesma lista.
 * ----------------------------------------------------------------
 */

interface Secao {
  id: string;
  titulo: string;
  icone: React.ElementType;
  /** Uma frase: para que serve. */
  resumo: string;
  configurar?: string[];
  usar?: string[];
  /** Armadilha real, não conselho genérico. */
  atencao?: string;
  /** O que ainda não funciona nesta tela. */
  aviso?: string;
}

const PRIMEIROS_PASSOS: string[] = [
  "Em Loja, preencha o nome, o endereço da loja (o /loja/seu-nome) e o WhatsApp. Sem o nome e o endereço você não consegue salvar.",
  "Em Recebimentos, faça a verificação da conta que vai receber o dinheiro. Enquanto ela não for aprovada, o checkout não aceita cartão.",
  "Em Frete, escolha como vai cobrar: tabela dos Correios e transportadoras, valor fixo, ou combinar com o cliente.",
  "Em Categorias, crie pelo menos uma categoria.",
  "Em Produtos, cadastre o primeiro produto com foto, preço e estoque.",
  "Abra a sua loja em /loja/seu-endereco e faça uma compra de teste do começo ao fim.",
];

const SECOES: Secao[] = [
  {
    id: "dashboard",
    titulo: "Visão geral",
    icone: LayoutDashboard,
    resumo:
      "A primeira tela: quanto você vendeu hoje, o que saiu mais e os últimos pedidos.",
    usar: [
      "Os quatro números do topo comparam com ontem — a seta verde ou vermelha é essa comparação, não uma meta.",
      "O gráfico mostra os últimos 7 dias de vendas.",
      "Pedidos recentes lista os cinco últimos. Para ver todos, vá em Pedidos.",
    ],
  },
  {
    id: "loja",
    titulo: "Loja",
    icone: Store,
    resumo:
      "O cadastro público: nome, endereço na internet, contato e as suas políticas.",
    configurar: [
      "Nome da loja: é o que aparece no topo do painel e para o cliente.",
      "Endereço (slug): forma o link /loja/seu-endereco. Trocar depois quebra os links que você já divulgou.",
      "WhatsApp e e-mail: é por onde o cliente fala com você.",
      "Políticas de troca e frete: aparecem na página Sobre a loja, que o cliente lê antes de comprar.",
      "Endereço de origem e CEP: é de onde suas encomendas saem. O cálculo de frete usa esse CEP.",
    ],
    atencao:
      "Tudo nesta tela é informação pública — o cliente vê. Não escreva aqui nada que seja só seu.",
  },
  {
    id: "produtos",
    titulo: "Produtos",
    icone: Package,
    resumo: "O catálogo: o que você vende, por quanto e com quais variações.",
    configurar: [
      "Clique em Novo produto e preencha nome, preço e categoria.",
      "Adicione as fotos. A primeira é a que aparece na vitrine.",
      "Se o produto tem cor ou tamanho, cadastre as variações — cada uma vira uma opção para o cliente escolher.",
      "Preencha peso e dimensões. Sem eles o frete dos Correios não calcula.",
      "Defina o estoque e o estoque mínimo, que é o que dispara o alerta na tela Estoque.",
    ],
    usar: [
      "Produto com status inativo some da loja, mas continua no seu cadastro.",
      "Preço promocional aparece riscado ao lado do preço cheio.",
    ],
    atencao:
      "Peso e dimensões em branco fazem o frete falhar só na hora da compra — o cliente é quem descobre. Preencha ao cadastrar.",
  },
  {
    id: "categorias",
    titulo: "Categorias",
    icone: Tag,
    resumo: "Como o cliente navega na sua loja.",
    configurar: [
      "Crie a categoria com um nome curto — ele vira um botão na vitrine.",
      "Ligue ou desligue a categoria sem apagá-la, quando for algo sazonal.",
    ],
    atencao:
      "Apagar uma categoria não apaga os produtos dela, mas eles ficam sem categoria e somem dos filtros da loja.",
  },
  {
    id: "pedidos",
    titulo: "Pedidos",
    icone: ShoppingBag,
    resumo: "Tudo que foi comprado e em que pé está cada compra.",
    usar: [
      "As abas de cima filtram por situação: pendente, pago, enviado, entregue, cancelado.",
      "Abra um pedido para ver os itens, o endereço de entrega e a forma de pagamento.",
      "Quando despachar, gere a etiqueta pelo próprio pedido e marque como enviado.",
      "O código de rastreio fica no pedido e o cliente consegue consultar sozinho em Meus pedidos.",
    ],
    atencao:
      "Pedido pendente é compra que ainda não foi paga — inclusive quem desistiu no meio do caminho. Só conte como venda o que está pago.",
  },
  {
    id: "clientes",
    titulo: "Clientes",
    icone: Users,
    resumo: "Quem já comprou, com histórico e contato.",
    usar: [
      "O cliente é criado sozinho na primeira compra — você não precisa cadastrar ninguém à mão.",
      "Abra um cliente para ver tudo que ele já comprou.",
      "Dá para corrigir nome, telefone e e-mail se vieram errados do checkout.",
    ],
  },
  {
    id: "estoque",
    titulo: "Estoque",
    icone: Boxes,
    resumo: "Quanto você tem de cada produto, num lugar só.",
    usar: [
      "Busque por nome, SKU ou categoria.",
      "Os filtros separam o que está em estoque, sem estoque e abaixo do mínimo.",
      "Dá para corrigir a quantidade direto na lista, sem abrir o produto.",
    ],
    aviso:
      "O estoque NÃO baixa sozinho quando uma venda acontece. Hoje o número só muda quando você altera aqui ou no cadastro do produto. Ajuste depois de despachar, senão a loja vende o que você não tem.",
  },
  {
    id: "frete",
    titulo: "Frete",
    icone: Truck,
    resumo: "Quanto o cliente paga para receber, e como a etiqueta sai.",
    configurar: [
      "Escolha o modo: tabela das transportadoras, valor fixo, ou combinar com o cliente.",
      "No modo tabela, conecte a sua conta de envio pelo botão de conectar — a conexão se renova sozinha depois.",
      "No modo fixo, defina o valor e o prazo em dias.",
      "Se quiser frete grátis, informe o valor de compra a partir do qual ele vale.",
      "Ligue a retirada na loja se o cliente puder buscar, e escreva as instruções.",
    ],
    atencao:
      "O cálculo usa o CEP de origem cadastrado em Loja e o peso e as dimensões de cada produto. Faltando qualquer um dos dois, o frete não sai.",
  },
  {
    id: "vendas",
    titulo: "Vendas",
    icone: BarChart2,
    resumo: "Os relatórios: quanto entrou, de quê, de quem e para onde.",
    usar: [
      "Escolha o período no topo — 7 dias, 30 dias, 90 dias ou 12 meses.",
      "Os números de cima já vêm comparados com o período anterior de mesmo tamanho.",
      "Mais abaixo: produtos que mais venderam, formas de pagamento, clientes que mais compraram, vendas por estado, clientes novos e recorrentes, e o frete cobrado.",
    ],
    atencao:
      "Pedido cancelado e devolvido não entra em nenhum relatório. Reembolso parcial conta só o que ficou com você — por isso o total daqui pode não bater com a soma crua dos pedidos.",
  },
  {
    id: "pagamentos",
    titulo: "Pagamentos",
    icone: Wallet,
    resumo: "O dinheiro: o que entrou, o que já foi para o banco e quanto falta.",
    usar: [
      "Pagamentos: cada venda recebida, com reembolsos e contestações.",
      "Repasses: as transferências para a sua conta bancária.",
      "Saldo: o que está disponível, o que está a caminho e quando cai.",
      "Documentos: faturas e informes para baixar.",
      "No rodapé fica a explicação de cada taxa descontada da venda. Vale ler uma vez.",
    ],
    atencao:
      "O valor da venda não é o valor que cai na conta. A diferença são as taxas do provedor de pagamento, explicadas no rodapé desta tela.",
  },
  {
    id: "recebimentos",
    titulo: "Recebimentos",
    icone: Landmark,
    resumo: "O cadastro da conta que recebe o dinheiro das vendas.",
    configurar: [
      "Preencha seus dados e os da conta bancária.",
      "Envie o documento de identidade quando for pedido.",
      "Aguarde a verificação. Ela pode levar algumas horas.",
      "Enquanto não for aprovada, o checkout não aceita cartão — a loja fica no ar mas não vende.",
    ],
    atencao:
      "O dinheiro vai direto para a sua conta, sem passar pela plataforma. Nossa cobrança é a mensalidade, nunca percentual sobre a venda.",
  },
  {
    id: "whatsapp",
    titulo: "WhatsApp",
    icone: MessageCircle,
    resumo: "Mensagens automáticas para o cliente em cada etapa do pedido.",
    aviso:
      "Esta tela ainda está em construção. Dá para escrever as regras, mas elas NÃO são salvas — somem ao recarregar a página — e nenhuma mensagem é enviada. Por enquanto, fale com o cliente pelo WhatsApp que está cadastrado em Loja.",
  },
  {
    id: "configuracoes",
    titulo: "Configurações",
    icone: Settings,
    resumo: "Aparência da loja, sua senha e suas preferências.",
    configurar: [
      "Aparência: cores, logo e banner da sua loja.",
      "Como o cliente compra: pelo WhatsApp, pagando no site, ou os dois.",
      "Conta: trocar nome, e-mail e senha.",
    ],
    aviso:
      "As chaves de aviso (novo pedido, estoque mínimo e as outras) já ficam salvas, mas ainda não disparam nada — nem e-mail nem aviso no painel. Estão prontas para quando o envio entrar.",
  },
];

function Bloco({ titulo, passos }: { titulo: string; passos: string[] }) {
  return (
    <div className="mt-3.5">
      <p className="t-micro font-semibold uppercase tracking-wider text-[#9ca3af]">
        {titulo}
      </p>
      <ol className="mt-1.5 space-y-1.5">
        {passos.map((p, i) => (
          <li key={p} className="flex gap-2.5">
            <span className="t-micro numeros shrink-0 mt-[3px] w-4 h-4 rounded bg-[#f4f4f5] text-[#6b7280] font-semibold flex items-center justify-center">
              {i + 1}
            </span>
            <span className="t-corpo text-[#374151] leading-snug">{p}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function Academy() {
  const [aberta, setAberta] = useState<string | null>(null);

  return (
    <div className="p-4 sm:p-6 max-w-[860px] mx-auto space-y-4">
      <div className="px-1">
        <h1 className="t-titulo text-[#0f1117]">Academy</h1>
        <p className="t-corpo text-[#6b7280] mt-1 leading-snug">
          Como usar cada parte do sistema, em passos curtos. Abra a seção da
          tela que você está usando.
        </p>
      </div>

      {/* Primeiros passos fica aberto, sem sanfona: é o que alguém
          que acabou de criar a loja precisa ver sem procurar. */}
      <section className="painel-app px-4 py-4">
        <h2 className="t-secao text-[#0f1117]">Primeiros passos</h2>
        <p className="t-apoio text-[#6b7280] mt-1 leading-snug">
          Nesta ordem. Cada um depende do anterior.
        </p>
        <ol className="mt-3 space-y-2.5">
          {PRIMEIROS_PASSOS.map((p, i) => (
            <li key={p} className="flex gap-3">
              <span className="t-apoio numeros shrink-0 w-6 h-6 rounded-full bg-[#0f1117] text-white font-semibold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="t-corpo text-[#374151] leading-snug pt-0.5">
                {p}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="painel-app overflow-hidden lista-linhas">
        {SECOES.map((s) => {
          const Icone = s.icone;
          const abertaAgora = aberta === s.id;

          return (
            <div key={s.id}>
              <button
                type="button"
                onClick={() => setAberta(abertaAgora ? null : s.id)}
                aria-expanded={abertaAgora}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#fafafa] transition-colors"
              >
                <Icone
                  size={18}
                  strokeWidth={1.8}
                  className="shrink-0 text-[#6b7280]"
                />
                <span className="flex-1 min-w-0">
                  <span className="t-corpo font-medium text-[#0f1117] block">
                    {s.titulo}
                  </span>
                  <span className="t-apoio text-[#6b7280] block leading-snug mt-0.5">
                    {s.resumo}
                  </span>
                </span>
                <ChevronDown
                  size={16}
                  strokeWidth={2}
                  className={`shrink-0 text-[#9ca3af] transition-transform ${
                    abertaAgora ? "rotate-180" : ""
                  }`}
                />
              </button>

              {abertaAgora && (
                <div className="px-4 pb-4 pt-0.5 sm:pl-[52px]">
                  {s.configurar && (
                    <Bloco titulo="Como configurar" passos={s.configurar} />
                  )}
                  {s.usar && (
                    <Bloco titulo="Como usar no dia a dia" passos={s.usar} />
                  )}

                  {s.atencao && (
                    <p className="t-apoio text-[#92400e] leading-snug mt-3.5 rounded-lg bg-[#fffbeb] border border-[#fde68a] px-3 py-2.5">
                      {s.atencao}
                    </p>
                  )}

                  {s.aviso && (
                    <div className="mt-3.5 rounded-lg bg-[#0f1117] px-3.5 py-3 flex items-start gap-2.5">
                      <AlertTriangle
                        size={16}
                        strokeWidth={1.8}
                        className="shrink-0 mt-0.5 text-[#fbbf24]"
                      />
                      <p className="t-apoio text-[#e4e4e7] leading-snug">
                        {s.aviso}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
