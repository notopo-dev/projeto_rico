import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { lerAssinatura } from "../lib/assinaturaApi";

/**
 * Faixa de contagem regressiva do teste.
 *
 * Aparece no topo do painel enquanto o teste corre, e some no
 * instante em que a assinatura entra. Só isso — quem impede de
 * usar é o bloqueio no App, e quem impede de vender é o banco.
 *
 * Não aparece para loja de cortesia nem para quem já assinou: faixa
 * que fica na tela sem ter o que dizer vira ruído e a pessoa para
 * de ler as que importam.
 */
export default function AvisoDeTeste({
  onAssinar,
}: {
  onAssinar: () => void;
}) {
  const [horas, setHoras] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;

    lerAssinatura()
      .then((e) => {
        if (!vivo) return;
        if (e.isenta || e.situacao !== "teste") return;
        setHoras(e.horasDeTeste);
      })
      .catch(() => {
        // Faixa decorativa: se a leitura falhar, ela simplesmente
        // não aparece. Não é lugar de mostrar erro de rede.
      });

    return () => {
      vivo = false;
    };
  }, []);

  if (horas === null || horas <= 0) return null;

  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#fffbeb] border-b border-[#fde68a]">
      <Clock size={15} className="text-[#92400e] shrink-0" />
      <p className="t-apoio text-[#92400e] min-w-0 flex-1">
        {horas === 1 ? "Falta 1 hora" : `Faltam ${horas} horas`} de teste.
      </p>
      <button
        type="button"
        onClick={onAssinar}
        className="btn-app-pequeno bg-[#92400e] text-white shrink-0"
      >
        Assinar
      </button>
    </div>
  );
}
