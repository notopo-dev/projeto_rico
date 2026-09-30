import { type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Desenha o conteúdo em document.body, fora da árvore da página.
 *
 * Existe por causa de um defeito real: o rodapé do cadastro de
 * produto não aparecia no celular. A folha nascia dentro de
 * `main > div > div.anim-aparecer > página`, e um ancestral com
 * animação, transform ou filtro cria contexto de empilhamento — o
 * z-index da folha para de competir com a barra inferior e passa a
 * valer só dentro daquele ancestral. A barra, irmã lá em cima, ganha
 * e cobre exatamente a faixa do rodapé.
 *
 * Fora da árvore, nenhum ancestral pode prender. Vale para qualquer
 * navegador e sobrevive a mudanças futuras de layout.
 */
export default function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
