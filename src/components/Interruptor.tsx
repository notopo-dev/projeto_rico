import { Loader2 } from "lucide-react";

/**
 * Interruptor liga/desliga.
 *
 * ----------------------------------------------------------------
 * Por que existe
 * ----------------------------------------------------------------
 * Os toggles do painel eram <button> de 44x24px. No celular, a regra
 * global `button { min-height: 44px }` do index.css esticava o trilho
 * para 44px de altura — e como a largura também é 44, a pílula virava
 * um CÍRCULO. Três das cinco telas mostravam isso.
 *
 * Duas telas já tinham contornado com a classe `sem-toque-minimo`,
 * que desliga o mínimo. Isso conserta o desenho e estraga o alvo de
 * toque: 24px de altura é menos da metade do que Apple e Google
 * recomendam para o dedo.
 *
 * Aqui os dois convivem: o BOTÃO tem 44px de altura (o alvo), e a
 * pílula de 24px fica centrada dentro dele (o desenho). Ninguém
 * precisa lembrar de classe nenhuma, e não há como deformar.
 *
 * ----------------------------------------------------------------
 * role="switch", não aria-pressed
 * ----------------------------------------------------------------
 * É o papel correto para liga/desliga: o leitor de tela anuncia
 * "ativado/desativado" em vez de "pressionado". E serve de gancho no
 * CSS para a regra do mínimo nunca mais alcançar um interruptor,
 * mesmo um escrito à mão amanhã.
 */

interface Props {
  ligado: boolean;
  onAlternar: (novo: boolean) => void;
  /** Obrigatório: sem isto o leitor de tela anuncia só "ativado". */
  rotulo: string;
  desabilitado?: boolean;
  /**
   * Gira um indicador dentro do trilho enquanto a mudança está sendo
   * gravada. As formas de pagamento precisam disso: o interruptor
   * salva no servidor, e sem sinal nenhum o lojista clica de novo.
   */
  carregando?: boolean;
}

export default function Interruptor({
  ligado,
  onAlternar,
  rotulo,
  desabilitado = false,
  carregando = false,
}: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      disabled={desabilitado}
      onClick={() => onAlternar(!ligado)}
      /* Pixels, não h-11.
         As classes de espaço do Tailwind são em rem, e rem depende da
         fonte da raiz. Com a raiz em 15px, h-11 (2.75rem) dá 41px, e
         antes deste projeto mudar a raiz para 14px dava 38,5px. O
         mínimo recomendado para o dedo é 44px de verdade — então aqui
         o valor é literal e não se mexe quando a raiz mudar. */
      className="shrink-0 h-[44px] w-[44px] -my-[10px] flex items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a] focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {/* O trilho. aria-hidden porque quem carrega o estado para o
          leitor de tela é o botão, pelo aria-checked. */}
      <span
        aria-hidden="true"
        className={`relative block h-[24px] w-[44px] rounded-full transition-colors duration-200 ${
          ligado ? "bg-[#16a34a]" : "bg-[#d1d5db]"
        }`}
      >
        <span
          className={`absolute top-[2px] left-[2px] h-[20px] w-[20px] rounded-full bg-white shadow-md transition-transform duration-200 ${
            ligado ? "translate-x-[20px]" : "translate-x-0"
          }`}
        />
        {carregando && (
          <Loader2
            size={12}
            className={`absolute inset-0 m-auto animate-spin ${
              ligado ? "text-white" : "text-[#6b7280]"
            }`}
          />
        )}
      </span>
    </button>
  );
}
