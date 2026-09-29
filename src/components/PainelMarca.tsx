import { ShoppingBag, TrendingUp, ShieldCheck } from "lucide-react";

/**
 * Painel de marca ao lado do formulário.
 *
 * Duas variantes do mesmo conteúdo:
 *
 * - PainelMarca: coluna inteira, só em tela grande (lg pra cima).
 * - DestaquesMobile: as mesmas três ideias em faixa de três colunas,
 *   só no celular, DEPOIS do formulário — e só quando a tela tem
 *   pelo menos 700px de altura. Em aparelho baixinho (iPhone SE) ela
 *   some: é melhor a tela caber inteira do que exibir a faixa e
 *   obrigar a rolar.
 *
 * A ordem importa. A ilustração e o título nunca vão pra cima do
 * formulário no celular: empurrariam o campo de e-mail pra baixo da
 * dobra, e quem abre o login no telefone quer entrar, não ler
 * propaganda. Mas deixar a tela do celular só com texto solto,
 * como estava, também é errado — daí a faixa no rodapé.
 *
 * A ilustração é desenhada aqui em SVG, sem imagem externa: carrega
 * junto com a página, não depende de rede, e não abre exceção na
 * política de conteúdo do site.
 */

const DESTAQUES = [
  {
    icone: ShoppingBag,
    texto: "Produtos, pedidos e estoque num lugar só",
    curto: ["Pedidos e", "estoque"],
  },
  {
    icone: TrendingUp,
    texto: "Receba por cartão direto na sua conta",
    curto: ["Cartão na", "sua conta"],
  },
  {
    icone: ShieldCheck,
    texto: "Frete calculado e etiqueta impressa",
    curto: ["Frete e", "etiqueta"],
  },
];

export default function PainelMarca() {
  return (
    <div
      className="hidden lg:flex flex-col justify-between overflow-hidden rounded-[32px] p-8 xl:p-10"
      style={{
        background:
          "linear-gradient(160deg, #f0fdf4 0%, #eafaf0 55%, #e6f7ec 100%)",
      }}
    >
      <div>
        <p className="text-[13px] font-bold tracking-[0.18em] text-[#15803d] uppercase">
          LojaPro
        </p>
        <h2 className="mt-5 text-[30px] xl:text-[34px] font-extrabold text-[#0f1117] leading-[1.15] max-w-[16ch]">
          Sua loja online, pronta para vender hoje.
        </h2>
      </div>

      {/* Ilustração original: uma vitrine com um cartão de pedido
          na frente e o gráfico de vendas atrás. */}
      <div className="flex-1 min-h-0 my-6 flex items-center justify-center">
        <svg
          viewBox="0 0 420 300"
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-auto max-h-[300px] max-w-full"
          role="img"
          aria-label="Ilustração de uma loja com vendas em alta"
        >
        {/* halo */}
        <circle cx="210" cy="150" r="118" fill="#ffffff" opacity="0.6" />

        {/* toldo da loja */}
        <path
          d="M108 96h204l-16 34H124z"
          fill="#16a34a"
          opacity="0.18"
        />
        <path
          d="M124 130h172v96a10 10 0 0 1-10 10H134a10 10 0 0 1-10-10z"
          fill="#ffffff"
          stroke="#16a34a"
          strokeWidth="2.5"
          strokeOpacity="0.35"
        />
        {/* porta */}
        <rect
          x="190" y="176" width="40" height="60" rx="5"
          fill="#16a34a" opacity="0.14"
        />
        {/* vitrine esquerda */}
        <rect
          x="142" y="152" width="38" height="30" rx="6"
          fill="#16a34a" opacity="0.1"
        />
        {/* vitrine direita */}
        <rect
          x="240" y="152" width="38" height="30" rx="6"
          fill="#16a34a" opacity="0.1"
        />

        {/* cartão de venda flutuando */}
        <g transform="translate(56 168)">
          <rect
            width="132" height="62" rx="14"
            fill="#ffffff"
            stroke="#16a34a" strokeOpacity="0.2" strokeWidth="1.5"
          />
          <rect x="16" y="16" width="66" height="8" rx="4" fill="#0f1117" opacity="0.75" />
          <rect x="16" y="32" width="40" height="7" rx="3.5" fill="#9ca3af" opacity="0.6" />
          <circle cx="104" cy="31" r="15" fill="#16a34a" opacity="0.12" />
          <path
            d="M97 31l5 5 10-11"
            fill="none" stroke="#16a34a" strokeWidth="3"
            strokeLinecap="round" strokeLinejoin="round"
          />
        </g>

        {/* gráfico subindo */}
        <g transform="translate(262 72)">
          <rect
            width="112" height="78" rx="14"
            fill="#ffffff"
            stroke="#16a34a" strokeOpacity="0.2" strokeWidth="1.5"
          />
          <path
            d="M18 56l20-18 18 12 22-30"
            fill="none" stroke="#16a34a" strokeWidth="3.5"
            strokeLinecap="round" strokeLinejoin="round"
          />
          <circle cx="78" cy="20" r="4.5" fill="#16a34a" />
        </g>
        </svg>
      </div>

      <ul className="space-y-3.5">
        {DESTAQUES.map(({ icone: Icone, texto }) => (
          <li key={texto} className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
              <Icone size={17} className="text-[#15803d]" />
            </span>
            <span className="text-[14px] text-[#166534] font-medium">
              {texto}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Faixa de destaques do celular.
 *
 * Fica abaixo do formulário, depois do link de trocar login/cadastro.
 * Some em tela grande, onde o PainelMarca já diz o mesmo.
 */
export function DestaquesMobile() {
  return (
    <div
      className="hidden max-lg:[@media(min-height:700px)]:block mt-6 rounded-[20px] px-4 py-4"
      style={{
        background: "linear-gradient(160deg, #f4fcf7 0%, #edfaf2 100%)",
      }}
    >
      <ul className="grid grid-cols-3 gap-2">
        {DESTAQUES.map(({ icone: Icone, texto, curto }) => (
          <li
            key={texto}
            className="flex flex-col items-center text-center gap-1.5"
          >
            <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
              <Icone size={16} className="text-[#15803d]" />
            </span>
            <span className="text-[11.5px] leading-tight text-[#166534] font-medium">
              {curto[0]}
              <br />
              {curto[1]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
