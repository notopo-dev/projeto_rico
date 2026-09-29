import { useNavigate, Link } from "react-router-dom";
import {
  ChevronLeft,
  MessageCircle,
  Mail,
  Store as StoreIcon,
  RefreshCcw,
  Truck,
  Receipt,
  Package,
} from "lucide-react";
import { useStore } from "../context/StoreContext";

/**
 * Sobre a loja.
 *
 * Reúne o que o lojista escreveu para ser lido por quem compra:
 * descrição, contato, política de troca e de frete, e como retirar no
 * balcão quando a loja oferece.
 *
 * Antes isso não tinha onde aparecer. O lojista preenchia política de
 * troca e política de frete no painel e aquilo não ia para lugar
 * nenhum — o cliente comprava sem saber se podia trocar.
 *
 * Só aparece aqui o que foi escrito PARA o cliente. O endereço de
 * origem das encomendas, por exemplo, fica de fora: ele serve para
 * calcular frete, não é um convite para aparecerem na casa de quem
 * vende de casa. O único endereço que aparece é o que o lojista
 * escreveu nas instruções de retirada, ciente de que é público.
 */

function Secao({
  icone,
  titulo,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: "var(--store-primary)" }}>{icone}</span>
        <h2 className="text-[13.5px] font-bold text-[#111827]">{titulo}</h2>
      </div>
      {children}
    </div>
  );
}

export default function StoreAbout() {
  const { store } = useStore();
  const navigate = useNavigate();

  if (!store) return null;

  const zap = (store.whatsapp ?? "").replace(/\D/g, "");
  const temContato = Boolean(zap || store.email);

  return (
    <div
      className="min-h-dvh pb-16"
      style={{
        background:
          "linear-gradient(to bottom, color-mix(in srgb, var(--store-primary) 10%, #f6f6f8 90%) 0px, #f6f6f8 300px)",
      }}
    >
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md px-4 py-3 flex items-center gap-3 border-b border-black/5">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-[#f4f4f5] flex items-center justify-center shrink-0 active:bg-[#e7e7ea]"
          aria-label="Voltar"
        >
          <ChevronLeft size={20} className="text-[#374151]" />
        </button>
        <h1 className="flex-1 text-center text-[16px] font-bold text-[#111827]">
          Sobre a loja
        </h1>
        <span className="w-10 shrink-0" />
      </div>

      {/* Identidade */}
      <div className="px-4 pt-5 flex flex-col items-center text-center">
        {store.logo_url ? (
          <img
            src={store.logo_url}
            alt=""
            className="w-20 h-20 rounded-3xl object-cover shadow-sm ring-1 ring-black/5"
          />
        ) : (
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-sm"
            style={{ backgroundColor: "var(--store-primary)" }}
          >
            <StoreIcon size={30} className="text-white" strokeWidth={1.8} />
          </div>
        )}

        <h2 className="mt-3 text-[20px] font-extrabold text-[#111827]">
          {store.nome}
        </h2>

        {store.descricao && (
          <p className="mt-1.5 text-[13.5px] text-[#4b5563] leading-relaxed max-w-[38ch] whitespace-pre-line">
            {store.descricao}
          </p>
        )}
      </div>

      <div className="px-4 pt-5 space-y-3">
        {temContato && (
          <Secao icone={<MessageCircle size={16} />} titulo="Falar com a loja">
            <div className="space-y-2">
              {zap && (
                <a
                  href={`https://wa.me/55${zap}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 h-12 px-3.5 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] text-[13.5px] font-semibold text-[#15803d]"
                >
                  <MessageCircle size={17} />
                  WhatsApp
                </a>
              )}
              {store.email && (
                <a
                  href={`mailto:${store.email}`}
                  className="flex items-center gap-2.5 h-12 px-3.5 rounded-xl border border-[#e4e4e7] bg-white text-[13.5px] font-semibold text-[#374151]"
                >
                  <Mail size={17} className="text-[#6b7280]" />
                  <span className="truncate">{store.email}</span>
                </a>
              )}
            </div>
          </Secao>
        )}

        {store.retirada_na_loja && (
          <Secao icone={<Package size={16} />} titulo="Retirar na loja">
            <p className="text-[13px] text-[#4b5563] leading-relaxed whitespace-pre-line">
              {store.retirada_instrucoes?.trim() ||
                "Você pode escolher retirar no fechamento do pedido. A loja entra em contato com o endereço e o horário."}
            </p>
          </Secao>
        )}

        {store.politica_troca && (
          <Secao icone={<RefreshCcw size={16} />} titulo="Trocas e devoluções">
            <p className="text-[13px] text-[#4b5563] leading-relaxed whitespace-pre-line">
              {store.politica_troca}
            </p>
          </Secao>
        )}

        {store.politica_frete && (
          <Secao icone={<Truck size={16} />} titulo="Entrega e frete">
            <p className="text-[13px] text-[#4b5563] leading-relaxed whitespace-pre-line">
              {store.politica_frete}
            </p>
          </Secao>
        )}

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <Link
            to={`/loja/${store.slug}`}
            className="h-12 rounded-2xl flex items-center justify-center gap-2 text-white text-[13.5px] font-bold shadow-lg"
            style={{ backgroundColor: "var(--store-primary)" }}
          >
            <StoreIcon size={16} />
            Ver produtos
          </Link>
          <Link
            to={`/loja/${store.slug}/meus-pedidos`}
            className="h-12 rounded-2xl flex items-center justify-center gap-2 border-2 text-[13.5px] font-bold bg-white"
            style={{
              borderColor: "var(--store-primary)",
              color: "var(--store-primary)",
            }}
          >
            <Receipt size={16} />
            Meus pedidos
          </Link>
        </div>
      </div>
    </div>
  );
}
