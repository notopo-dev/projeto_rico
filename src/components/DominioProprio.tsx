import { useEffect, useState } from "react";
import { Globe, Copy, Check } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { getCurrentStoreId } from "../lib/currentStore";

/**
 * Endereço da loja na internet, e o pedido de domínio próprio.
 *
 * Esta tela NÃO configura nada. Ela mostra o endereço atual, mostra
 * o domínio próprio quando já existe, e explica como pedir.
 *
 * A configuração é feita por uma pessoa, fora do sistema: apontar o
 * DNS, adicionar o domínio na hospedagem e registrá-lo no provedor
 * de pagamento. Colocar um campo aqui que apenas gravasse o texto
 * daria a impressão de que o lojista resolveu sozinho — e a loja
 * continuaria sem abrir no endereço dele.
 */

interface Estado {
  slug: string;
  dominio: string | null;
  status: "nenhum" | "pendente" | "ativo";
}

export default function DominioProprio() {
  const [dados, setDados] = useState<Estado | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vivo = true;

    (async () => {
      try {
        const storeId = await getCurrentStoreId();
        const { data } = await supabase
          .from("stores")
          .select("slug, dominio, dominio_status")
          .eq("id", storeId)
          .single();

        if (vivo && data) {
          setDados({
            slug: data.slug,
            dominio: data.dominio,
            status: (data.dominio_status ?? "nenhum") as Estado["status"],
          });
        }
      } catch {
        // Sem dados, a seção some. Ela é informativa: falhar aqui
        // não pode atrapalhar o resto da tela.
      }
    })();

    return () => {
      vivo = false;
    };
  }, []);

  if (!dados) return null;

  const enderecoPlataforma = `${window.location.origin}/loja/${dados.slug}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enderecoPlataforma);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Navegador sem permissão de área de transferência: o endereço
      // está na tela e pode ser selecionado à mão.
    }
  }

  return (
    <section className="painel-app">
      <div className="painel-topo">
        <span className="t-secao text-[#0f1117] flex items-center gap-2">
          <Globe size={17} strokeWidth={1.8} className="text-[#6b7280]" />
          Endereço da loja
        </span>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div>
          <p className="t-apoio text-[#6b7280]">Endereço atual</p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="t-corpo flex-1 min-w-0 truncate rounded-lg border border-[#e7e7ea] bg-[#fafafa] px-3 py-2.5 text-[#0f1117]">
              {enderecoPlataforma}
            </code>
            <button
              type="button"
              onClick={copiar}
              className="btn-app-pequeno shrink-0 border border-[#e7e7ea] bg-white text-[#374151]"
              aria-label="Copiar endereço"
            >
              {copiado ? <Check size={14} /> : <Copy size={14} />}
              {copiado ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>

        {dados.dominio && (
          <div>
            <p className="t-apoio text-[#6b7280]">Domínio próprio</p>
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <code className="t-corpo rounded-lg border border-[#e7e7ea] bg-[#fafafa] px-3 py-2.5 text-[#0f1117]">
                {dados.dominio}
              </code>
              <span
                className={`selo ${
                  dados.status === "ativo" ? "selo-ok" : "selo-atencao"
                }`}
              >
                {dados.status === "ativo" ? "No ar" : "Em configuração"}
              </span>
            </div>
            {dados.status === "pendente" && (
              <p className="t-apoio text-[#6b7280] leading-snug mt-2">
                O domínio já está cadastrado, mas ainda não está respondendo.
                Isso é normal nas primeiras horas, enquanto a alteração de DNS
                se espalha pela internet.
              </p>
            )}
          </div>
        )}

        {/* Explicação de como pedir. Fica como bloco próprio para
            não ser lido como mais um campo a preencher. */}
        <div className="rounded-lg bg-[#0f1117] px-4 py-4">
          <p className="t-corpo text-white">
            {dados.dominio
              ? "Quer trocar o domínio da sua loja?"
              : "Quer usar o seu próprio domínio?"}
          </p>
          <p className="t-apoio text-[#a1a1aa] leading-snug mt-1.5">
            A sua loja pode funcionar em um endereço seu, como
            www.suamarca.com.br, no lugar do endereço acima. A troca não é
            feita por aqui: ela envolve configuração de DNS, certificado de
            segurança e cadastro do endereço no provedor de pagamento.
          </p>
          <p className="t-apoio text-[#a1a1aa] leading-snug mt-2.5">
            <span className="text-white font-semibold">
              Solicite à empresa responsável pelo sistema.
            </span>{" "}
            O serviço está sujeito a custo adicional, informado antes de
            qualquer cobrança. O domínio precisa já estar registrado no seu
            nome.
          </p>
        </div>
      </div>
    </section>
  );
}
