import { supabase } from "../lib/supabaseClient";

/**
 * Descobre se a página foi aberta por um domínio próprio de lojista.
 *
 * ----------------------------------------------------------------
 * Por que existe
 * ----------------------------------------------------------------
 * Todos os domínios de um projeto na Vercel servem o MESMO código.
 * Sem esta checagem, lojadofulano.com.br/produtos abriria o painel
 * administrativo da plataforma — a tela de login do sistema, na
 * porta do cliente do lojista.
 *
 * ----------------------------------------------------------------
 * Por que a lista de hosts da plataforma vem primeiro
 * ----------------------------------------------------------------
 * Consultar o banco em toda abertura de página custaria uma ida à
 * rede antes de qualquer pixel, INCLUSIVE no painel, onde domínio
 * próprio nunca se aplica. Conferir a lista primeiro é instantâneo
 * e resolve o caso comum sem consulta nenhuma.
 * ----------------------------------------------------------------
 */

/**
 * Hosts que são a própria plataforma.
 *
 * Vem de VITE_PLATFORM_HOSTS quando existir (lista separada por
 * vírgula). O padrão abaixo cobre o caso normal, para um deploy sem
 * a variável não passar a tratar o site inteiro como domínio de
 * lojista — que seria o pior erro possível aqui.
 */
const PADRAO = ["moneynotopo.com.br", "localhost", "127.0.0.1"];

function hostsDaPlataforma(): string[] {
  const bruto = import.meta.env.VITE_PLATFORM_HOSTS as string | undefined;
  const lista = bruto
    ? bruto.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean)
    : PADRAO;
  return lista;
}

/** Tira "www." e a porta, e põe em minúsculas. */
export function normalizarHost(host: string): string {
  return host.toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
}

export function ehHostDaPlataforma(host: string): boolean {
  const limpo = normalizarHost(host);
  if (hostsDaPlataforma().includes(limpo)) return true;

  // Pré-visualizações da Vercel (algo.vercel.app) são a plataforma,
  // não loja de ninguém.
  if (limpo.endsWith(".vercel.app")) return true;

  return false;
}

export type ResultadoDominio =
  | { modo: "plataforma" }
  | { modo: "carregando" }
  | { modo: "loja"; slug: string }
  | { modo: "desconhecido"; host: string };

/**
 * Resolve o host atual.
 *
 * Devolve "desconhecido" quando o domínio aponta para cá mas não
 * está ligado a nenhuma loja ativa — acontece entre o DNS propagar
 * e alguém marcar o domínio como ativo no banco. Mostrar uma
 * mensagem clara aí é melhor do que uma tela branca.
 */
export async function resolverDominio(host: string): Promise<ResultadoDominio> {
  if (ehHostDaPlataforma(host)) return { modo: "plataforma" };

  const { data, error } = await supabase.rpc("loja_por_dominio", {
    p_host: normalizarHost(host),
  });

  if (error) throw error;

  const slug = Array.isArray(data) ? data[0]?.slug : undefined;
  if (!slug) return { modo: "desconhecido", host: normalizarHost(host) };

  return { modo: "loja", slug };
}
