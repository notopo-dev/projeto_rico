import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Tag,
  X,
  Check,
  Loader2,
  RefreshCw,
} from "lucide-react";

import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategory,
  type Category,
} from "../lib/categoriesApi";
import Folha from "../components/Folha";
import Interruptor from "../components/Interruptor";

export default function Categorias() {
  const [categorias, setCategorias] = useState<Category[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  /**
   * Qual categoria está tendo o status gravado agora.
   *
   * O interruptor salva no servidor. Sem sinal nenhum o lojista acha
   * que não pegou e clica de novo, o que manda duas escritas opostas.
   */
  const [alternando, setAlternando] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const [formNome, setFormNome] = useState("");
  const [formSlug, setFormSlug] = useState("");

  /**
   * Carrega as categorias da loja atual.
   */
  async function carregarCategorias() {
    setLoading(true);
    setError(null);

    try {
      const data = await listCategories();
      setCategorias(data);
    } catch (err) {
      const mensagem =
        err instanceof Error
          ? err.message
          : "Não foi possível carregar as categorias.";

      setError(mensagem);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Carrega as categorias ao abrir a página.
   */
  useEffect(() => {
    carregarCategorias();
  }, []);

  /**
   * Abre modal para criar.
   */
  function openAdd() {
    setEditTarget(null);
    setFormNome("");
    setFormSlug("");
    setError(null);
    setShowModal(true);
  }

  /**
   * Abre modal para editar.
   */
  function openEdit(categoria: Category) {
    setEditTarget(categoria);
    setFormNome(categoria.nome);
    setFormSlug(categoria.slug);
    setError(null);
    setShowModal(true);
  }

  /**
   * Fecha modal de criação/edição.
   */
  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditTarget(null);
    setFormNome("");
    setFormSlug("");
  }

  /**
   * Gera automaticamente o slug.
   */
  function gerarSlug(nome: string) {
    return nome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  /**
   * Alteração do nome.
   *
   * Quando estiver criando uma categoria,
   * o slug é preenchido automaticamente.
   */
  function handleNomeChange(valor: string) {
    setFormNome(valor);

    if (!editTarget) {
      setFormSlug(gerarSlug(valor));
    }
  }

  /**
   * Cria ou atualiza a categoria no banco.
   */
  async function handleSave() {
    const nome = formNome.trim();

    if (!nome) {
      setError("Digite o nome da categoria.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (editTarget) {
        await updateCategory(editTarget.id, {
          nome,
          slug: formSlug.trim() || gerarSlug(nome),
        });
      } else {
        await createCategory({
          nome,
          slug: formSlug.trim() || gerarSlug(nome),
        });
      }

      closeModal();

      await carregarCategorias();
    } catch (err) {
      const mensagem =
        err instanceof Error
          ? err.message
          : "Não foi possível salvar a categoria.";

      setError(mensagem);
    } finally {
      setSaving(false);
    }
  }

  /**
   * Ativa ou inativa uma categoria.
   *
   * Categoria inativa continua existindo e continua ligada aos
   * produtos que já a usam — ela só para de aparecer na loja. É o
   * `listPublicCategories`, que filtra `ativa = true`, que faz isso.
   * Por isso desativar é a saída para a categoria que não pode ser
   * excluída: nada se perde.
   *
   * Recebe o valor NOVO em vez de inverter aqui dentro. Invertendo
   * aqui, dois cliques rápidos mandam a mesma inversão duas vezes e o
   * resultado depende de qual resposta chega primeiro.
   */
  async function toggleAtiva(categoria: Category, novoValor: boolean) {
    setError(null);
    setAlternando(categoria.id);

    // Mexe na tela primeiro: o interruptor tem que responder ao dedo
    // na hora, não depois da ida ao servidor.
    setCategorias((prev) =>
      prev.map((item) =>
        item.id === categoria.id ? { ...item, ativa: novoValor } : item
      )
    );

    try {
      await toggleCategory(categoria.id, novoValor);
    } catch (err) {
      // Falhou: devolve o interruptor para onde estava. Deixar ligado
      // na tela e desligado no banco é pior que o erro.
      setCategorias((prev) =>
        prev.map((item) =>
          item.id === categoria.id ? { ...item, ativa: categoria.ativa } : item
        )
      );

      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível alterar o status da categoria."
      );
    } finally {
      setAlternando(null);
    }
  }

  /**
   * Abre confirmação de exclusão.
   */
  function openDelete(categoria: Category) {
    setDeleteTarget(categoria);
    setError(null);
  }

  /**
   * Cancela exclusão.
   */
  function cancelDelete() {
    setDeleteTarget(null);
  }

  /**
   * Exclui a categoria do banco.
   */
  async function confirmDelete() {
    if (!deleteTarget) return;

    setSaving(true);
    setError(null);

    try {
      await deleteCategory(deleteTarget.id);

      setCategorias((prev) =>
        prev.filter((categoria) => categoria.id !== deleteTarget.id)
      );

      setDeleteTarget(null);
    } catch (err) {
      const mensagem =
        err instanceof Error
          ? err.message
          : "Não foi possível excluir a categoria.";

      setError(mensagem);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-[860px] px-4 py-4 lg:p-6">
      {/* Cabeçalho */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="t-corpo text-[#6b7280]">
          {categorias.length}{" "}
          {categorias.length === 1 ? "categoria" : "categorias"}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={carregarCategorias}
            disabled={loading}
            aria-label="Atualizar categorias"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] border border-[#e4e4e7] bg-white text-[#6b7280] transition-colors hover:bg-[#f4f4f5] hover:text-[#0f1117] disabled:cursor-not-allowed disabled:opacity-50 lg:h-9 lg:w-9"
          >
            <RefreshCw
              size={15}
              strokeWidth={1.8}
              className={loading ? "animate-spin" : ""}
            />
          </button>

          <button
            type="button"
            onClick={openAdd}
            className="t-corpo flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-[6px] bg-[#16a34a] px-3 py-2 font-medium text-white transition-colors hover:bg-[#15803d] lg:min-h-0 lg:py-1.5"
          >
            <Plus size={15} strokeWidth={2} />
            Nova categoria
          </button>
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-[6px] border border-[#fecaca] bg-[#fef2f2] px-3 py-2.5">
          <p className="t-corpo leading-5 text-[#b91c1c]">{error}</p>

          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0 text-[#b91c1c] hover:text-[#991b1b]"
            aria-label="Fechar mensagem"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Carregando */}
      {loading ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[8px] border border-[#e4e4e7] bg-white px-5 py-10 text-center">
          <Loader2
            size={24}
            strokeWidth={1.8}
            className="mb-3 animate-spin text-[#16a34a]"
          />

          <p className="t-corpo font-medium text-[#0f1117]">
            Carregando categorias...
          </p>

          <p className="t-corpo mt-1 text-[#6b7280]">
            Buscando as categorias cadastradas na sua loja.
          </p>
        </div>
      ) : categorias.length === 0 ? (
        /* Estado vazio */
        <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[8px] border border-dashed border-[#d4d4d8] bg-white px-5 py-10 text-center lg:min-h-[220px]">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#f0fdf4] text-[#16a34a]">
            <Tag size={20} strokeWidth={1.8} />
          </div>

          <p className="t-corpo font-medium text-[#0f1117]">
            Nenhuma categoria cadastrada
          </p>

          <p className="t-corpo mt-1 max-w-[280px] leading-5 text-[#6b7280]">
            Crie sua primeira categoria para organizar os produtos.
          </p>

          <button
            type="button"
            onClick={openAdd}
            className="t-corpo mt-4 flex min-h-10 items-center justify-center gap-1.5 rounded-[6px] bg-[#16a34a] px-4 py-2 font-medium text-white transition-colors hover:bg-[#15803d]"
          >
            <Plus size={15} />
            Criar categoria
          </button>
        </div>
      ) : (
        <>
          {/* MOBILE */}
          <div className="space-y-3 lg:hidden">
            {categorias.map((categoria) => (
              <article
                key={categoria.id}
                className="rounded-[8px] border border-[#e4e4e7] bg-white p-4"
              >
                {/* Uma linha só.
                    Antes o cartão tinha uma segunda faixa, com traço
                    separador, só para segurar os dois ícones: 314px de
                    largura com 79px usados, e 71px de altura. Medido no
                    aparelho, o cartão caía de 147px para 76px juntando
                    tudo numa linha — de 4 para 9 categorias por tela. */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Tag
                      size={16}
                      strokeWidth={1.8}
                      className="shrink-0 text-[#9ca3af]"
                    />

                    <div className="min-w-0">
                      <h2 className="t-corpo truncate font-semibold text-[#0f1117]">
                        {categoria.nome}
                      </h2>

                      {/* Status na SEGUNDA linha, não ao lado do nome.
                          Ao lado, a etiqueta custava uns 95px e num
                          celular de 360px sobrava "Roup…" para o nome.
                          Embaixo ela não concorre por largura nenhuma
                          e a palavra continua lá — que é o que serve
                          para quem não distingue o verde do cinza do
                          interruptor. */}
                      <p className="t-apoio mt-0.5 flex items-center gap-1.5 truncate text-[#6b7280]">
                        <span
                          className={`shrink-0 font-semibold ${
                            categoria.ativa ? "text-[#15803d]" : "text-[#52525b]"
                          }`}
                        >
                          {categoria.ativa ? "Ativa" : "Inativa"}
                        </span>
                        <span aria-hidden="true" className="shrink-0 text-[#d4d4d8]">
                          ·
                        </span>
                        <span className="truncate font-mono">{categoria.slug}</span>
                      </p>
                    </div>
                  </div>

                  {/* shrink-0 aqui e min-w-0 ali em cima são o par que
                      faz o nome longo truncar em vez de empurrar os
                      botões para fora da tela. */}
                  <div className="flex shrink-0 items-center gap-1">
                    {/* Antes a própria etiqueta de status era o
                        botão: ninguém adivinha que a palavra "Ativa" é
                        clicável, e o lojista ficava sem como
                        desativar. Agora quem controla é o interruptor,
                        e quem informa é o texto da segunda linha. */}
                    <Interruptor
                      ligado={categoria.ativa}
                      onAlternar={(v) => toggleAtiva(categoria, v)}
                      rotulo={`Categoria ${categoria.nome} ativa na loja`}
                      carregando={alternando === categoria.id}
                    />

                    <button
                      type="button"
                      onClick={() => openEdit(categoria)}
                      aria-label={`Editar ${categoria.nome}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] text-[#6b7280] hover:bg-[#f4f4f5] hover:text-[#0f1117]"
                    >
                      <Pencil size={16} strokeWidth={1.8} />
                    </button>

                    <button
                      type="button"
                      onClick={() => openDelete(categoria)}
                      aria-label={`Excluir ${categoria.nome}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] text-[#6b7280] hover:bg-[#fef2f2] hover:text-[#b91c1c]"
                    >
                      <Trash2 size={16} strokeWidth={1.8} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* DESKTOP */}
          <div className="hidden overflow-hidden rounded-[6px] border border-[#e4e4e7] bg-white lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e4e4e7] bg-[#fafafa]">
                  {["Nome", "Slug", "Status", "Ações"].map((h) => (
                    <th
                      key={h}
                      className="t-apoio px-4 py-2 text-left font-semibold uppercase tracking-wider text-[#6b7280]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {categorias.map((categoria) => (
                  <tr
                    key={categoria.id}
                    className="border-b border-[#f4f4f5] transition-colors last:border-b-0 hover:bg-[#fafafa]"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Tag
                          size={14}
                          strokeWidth={1.8}
                          className="text-[#9ca3af]"
                        />

                        <span className="t-corpo font-medium text-[#0f1117]">
                          {categoria.nome}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-2.5">
                      <span className="t-corpo font-mono text-[#6b7280]">
                        {categoria.slug}
                      </span>
                    </td>

                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Interruptor
                          ligado={categoria.ativa}
                          onAlternar={(v) => toggleAtiva(categoria, v)}
                          rotulo={`Categoria ${categoria.nome} ativa na loja`}
                          carregando={alternando === categoria.id}
                        />

                        <span
                          className={`t-apoio inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-0.5 font-medium ${
                            categoria.ativa
                              ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]"
                              : "border-[#e4e4e7] bg-[#f4f4f5] text-[#52525b]"
                          }`}
                        >
                          {categoria.ativa && (
                            <Check size={10} strokeWidth={2.5} />
                          )}

                          {categoria.ativa ? "Ativa" : "Inativa"}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(categoria)}
                          aria-label={`Editar ${categoria.nome}`}
                          className="rounded p-1 text-[#6b7280] hover:bg-[#f4f4f5] hover:text-[#0f1117]"
                        >
                          <Pencil size={14} strokeWidth={1.8} />
                        </button>

                        <button
                          type="button"
                          onClick={() => openDelete(categoria)}
                          aria-label={`Excluir ${categoria.nome}`}
                          className="rounded p-1 text-[#6b7280] hover:bg-[#fef2f2] hover:text-[#b91c1c]"
                        >
                          <Trash2 size={14} strokeWidth={1.8} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* MODAL CRIAR / EDITAR */}
      <Folha
        aberta={showModal}
        onFechar={closeModal}
        titulo={editTarget ? "Editar categoria" : "Nova categoria"}
        rodape={
          <>
            <button
              type="button"
              onClick={closeModal}
              disabled={saving}
              className="t-corpo flex-1 min-h-11 rounded-[6px] border border-[#e4e4e7] bg-white px-3 py-2 text-[#374151] hover:bg-[#f4f4f5] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !formNome.trim()}
              className="t-corpo flex flex-[1.3] min-h-11 items-center justify-center gap-2 rounded-[6px] bg-[#16a34a] px-3 py-2 font-medium text-white hover:bg-[#15803d] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {editTarget ? "Salvar" : "Criar categoria"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="t-corpo mb-1 block font-medium text-[#374151]">
              Nome
            </label>
            <input
              type="text"
              value={formNome}
              onChange={(e) => handleNomeChange(e.target.value)}
              placeholder="Ex: Camisetas"
              disabled={saving}
              className="t-corpo w-full min-h-11 rounded-[6px] border border-[#e4e4e7] bg-white px-3 py-2 placeholder:text-[#9ca3af] focus:border-[#16a34a] focus:outline-none focus:ring-1 focus:ring-[#16a34a] disabled:bg-[#f4f4f5]"
              autoFocus
            />
          </div>
          <div>
            <label className="t-corpo mb-1 block font-medium text-[#374151]">
              Slug
            </label>
            <input
              type="text"
              value={formSlug}
              onChange={(e) => setFormSlug(e.target.value)}
              placeholder="camisetas"
              disabled={saving}
              className="t-corpo w-full min-h-11 rounded-[6px] border border-[#e4e4e7] bg-white px-3 py-2 placeholder:text-[#9ca3af] focus:border-[#16a34a] focus:outline-none focus:ring-1 focus:ring-[#16a34a] disabled:bg-[#f4f4f5]"
            />
            <p className="t-apoio mt-1 text-[#9ca3af]">
              O slug é usado internamente para identificar a categoria.
            </p>
          </div>
        </div>
      </Folha>

      {/* MODAL EXCLUSÃO */}
      <Folha
        aberta={Boolean(deleteTarget)}
        onFechar={cancelDelete}
        titulo="Excluir categoria?"
        rodape={
          <>
            <button
              type="button"
              onClick={cancelDelete}
              disabled={saving}
              className="t-corpo flex-1 min-h-11 rounded-[6px] border border-[#e4e4e7] bg-white px-3 py-2 text-[#374151] hover:bg-[#f4f4f5] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={saving}
              className="t-corpo flex flex-1 min-h-11 items-center justify-center gap-2 rounded-[6px] bg-[#b91c1c] px-3 py-2 font-medium text-white hover:bg-[#991b1b] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Excluir
            </button>
          </>
        }
      >
        <p className="t-corpo leading-5 text-[#374151]">
          A categoria{" "}
          <strong className="font-semibold text-[#0f1117]">
            {deleteTarget?.nome}
          </strong>{" "}
          será removida do banco de dados.
        </p>
        <p className="t-corpo mt-2 leading-5 text-[#6b7280]">
          Se houver produtos vinculados a essa categoria, a exclusão poderá ser
          impedida pelo banco de dados.
        </p>
      </Folha>
    </div>
  );
}