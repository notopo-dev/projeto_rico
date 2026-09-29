import { Info } from "lucide-react";

/**
 * O que é descontado de cada venda.
 *
 * ----------------------------------------------------------------
 * Por que esta caixa existe
 * ----------------------------------------------------------------
 * O lojista vê "venda de R$ 100" no painel e R$ 95,62 caindo no
 * banco. Sem esta explicação, a conclusão natural dele é que a
 * plataforma ficou com a diferença — e não ficou: o modelo é
 * mensalidade, nunca percentual sobre venda.
 *
 * ----------------------------------------------------------------
 * Três decisões de conteúdo
 * ----------------------------------------------------------------
 * 1. Não cita o nome do provedor. O painel inteiro fala "provedor
 *    de pagamento", e esta caixa segue a mesma regra.
 *
 * 2. Os valores são fixos no código, com a DATA DA CONSULTA visível.
 *    Preço de provedor muda. Sem a data, um número velho parece
 *    atual; com ela, o lojista sabe o que está olhando. Ao atualizar
 *    os valores, atualize CONSULTADO_EM na mesma edição.
 *
 * 3. Boleto e parcelamento não aparecem porque o checkout não os
 *    oferece: a cobrança é criada com payment_method_types de um
 *    item só, cartão ou Pix, e sem installments. Listar taxa de
 *    coisa que a loja não usa é ruído, não transparência.
 * ----------------------------------------------------------------
 */

const CONSULTADO_EM = "29/09/2026";

interface Linha {
  nome: string;
  valor: string;
  detalhe?: string;
}

const COBRANCAS: Linha[] = [
  {
    nome: "Cartão nacional",
    valor: "3,99% + R$ 0,39",
    detalhe: "por transação aprovada",
  },
  {
    nome: "Cartão internacional",
    valor: "+ 2%",
    detalhe: "somado à taxa acima, quando o cartão é de fora do país",
  },
  {
    nome: "Conversão de moeda",
    valor: "a partir de 2%",
    detalhe: "quando a compra é feita em outra moeda",
  },
  {
    nome: "Pix",
    valor: "1,19%",
    detalhe: "por Pix pago, quando o Pix estiver liberado na sua conta",
  },
  {
    nome: "Contestação",
    valor: "R$ 55,00",
    detalhe:
      "por contestação recebida, e mais R$ 55,00 se você responder a ela",
  },
];

export default function AvisoTaxas() {
  return (
    <section
      className="rounded-lg bg-[#0f1117] px-4 py-4 sm:px-5 sm:py-5"
      aria-labelledby="aviso-taxas-titulo"
    >
      <div className="flex items-start gap-2.5">
        <Info
          size={18}
          strokeWidth={1.8}
          className="shrink-0 mt-0.5 text-[#4ade80]"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h2
            id="aviso-taxas-titulo"
            className="t-secao text-white"
          >
            O que é descontado de cada venda
          </h2>
          <p className="t-apoio text-[#a1a1aa] mt-1 leading-snug">
            O valor que chega na sua conta é o da venda menos as taxas do
            provedor de pagamento. Elas são cobradas por ele, não por nós.
          </p>
        </div>
      </div>

      <dl className="mt-4 divide-y divide-[#27272a] border-y border-[#27272a]">
        {COBRANCAS.map(({ nome, valor, detalhe }) => (
          <div
            key={nome}
            className="py-2.5 flex items-baseline justify-between gap-4"
          >
            <div className="min-w-0">
              <dt className="t-corpo text-white">{nome}</dt>
              {detalhe && (
                <p className="t-micro text-[#8b8b94] leading-snug mt-0.5">
                  {detalhe}
                </p>
              )}
            </div>
            <dd className="t-corpo numeros font-semibold text-white whitespace-nowrap shrink-0">
              {valor}
            </dd>
          </div>
        ))}
      </dl>

      {/* O ponto que quase ninguém conta ao lojista, e que mais gera
          reclamação depois: a taxa da venda original não volta no
          reembolso. Fica em destaque próprio por isso. */}
      <div className="mt-4 rounded-lg bg-[#1c1c20] px-3.5 py-3">
        <p className="t-corpo text-white">Reembolso não devolve a taxa</p>
        <p className="t-apoio text-[#a1a1aa] leading-snug mt-1">
          Emitir um reembolso é gratuito, mas a taxa cobrada na venda
          original não volta. Ao devolver R$ 100 de uma venda de R$ 100,
          você fica no prejuízo do valor da taxa daquela venda.
        </p>
      </div>

      <div className="mt-4 rounded-lg border border-[#16a34a]/35 bg-[#16a34a]/10 px-3.5 py-3">
        <p className="t-corpo text-[#4ade80]">
          A plataforma não cobra percentual sobre as suas vendas
        </p>
        <p className="t-apoio text-[#a1a1aa] leading-snug mt-1">
          Nossa cobrança é a mensalidade, e só. Nenhuma parte das taxas
          acima fica conosco — todas vão para o provedor de pagamento.
        </p>
      </div>

      <p className="t-micro text-[#8b8b94] leading-snug mt-3.5">
        Valores do provedor de pagamento consultados em {CONSULTADO_EM}. Eles
        podem mudar sem aviso nosso — em caso de dúvida, o valor que vale é o
        que aparece em cada transação na aba Pagamentos.
      </p>
    </section>
  );
}
