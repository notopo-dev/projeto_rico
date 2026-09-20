import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Package,
  ChevronUp,
  ChevronDown,
  X,
  Loader2,
  ImagePlus,
  ImageOff,
} from "lucide-react";
import Badge from "../components/Badge";
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductById,
  listCategoriesForSelect,
  type ProductWithCategoria,
  type ProductInput,
} from "../lib/productsApi";
import { supabase } from "../lib/supabase";
import {
  uploadProductImages,
  deleteProductImage,
  type ProductImage,
} from "../lib/productImagesApi";

interface Product {
  id: string;
  nome: string;
  sku: string;
  descricao: string;
  categoria: string;
  categoriaId: string | null;
  preco: number;
  precoFormatado: string;
  precoPromocional: number | null;
  estoque: number;
  estoqueMinimo: number;
  permiteVendaSemEstoque: boolean;
  itemPromocao: boolean;
  cores: {
    id?: string;
    nome: string;
    codigo_hex?: string | null;
    imagem_url?: string | null;
  }[];
  tamanhos: string[];
  status: "Ativo" | "Inativo" | "Sem estoque";
  imagens: ProductImage[];
}

function toViewProduct(p: ProductWithCategoria): Product {
  const statusMap: Record<string, Product["status"]> = {
    ativo: "Ativo",
    inativo: "Inativo",
    sem_estoque: "Sem estoque",
  };
  return {
    id: p.id,
    nome: p.nome,
    sku: p.sku,
    descricao: p.descricao ?? "",
    categoria: p.categoria_nome ?? "Sem categoria",
    categoriaId: p.category_id,
    preco: p.preco,
    precoFormatado: p.preco.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    }),
    precoPromocional: p.preco_promocional,
    estoque: p.estoque,
    estoqueMinimo: p.estoque_minimo,
    permiteVendaSemEstoque: p.permite_venda_sem_estoque,
    itemPromocao: p.item_promocao ?? false,
    cores: p.cores ?? [],
    tamanhos: p.tamanhos ?? [],
    status: statusMap[p.status] ?? "Ativo",
    imagens: p.imagens,
  };
}

const statusVariant: Record<
  string,
  "success" | "warning" | "error" | "neutral"
> = {
  Ativo: "success",
  Inativo: "neutral",
  "Sem estoque": "error",
};

type SortKey = "nome" | "estoque" | "preco";

const MAX_IMAGE_MB = 15;
const MAX_IMAGES = 8;

export default function Products() {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("nome");
  const [sortAsc, setSortAsc] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [loadingEditData, setLoadingEditData] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [categorias, setCategorias] = useState<{ id: string; nome: string }[]>(
    []
  );

  // Campos do formulário
  const [formNome, setFormNome] = useState("");
  const [formSku, setFormSku] = useState("");
  const [formDescricao, setFormDescricao] = useState("");
  const [formPreco, setFormPreco] = useState("");
  const [formPrecoPromocional, setFormPrecoPromocional] = useState("");
  const [formEstoque, setFormEstoque] = useState("");
  const [formEstoqueMinimo, setFormEstoqueMinimo] = useState("");
  const [formCategoriaId, setFormCategoriaId] = useState("");
  const [formVendaSemEstoque, setFormVendaSemEstoque] = useState(false);
  const [formItemPromocao, setFormItemPromocao] = useState(false);
  const [formCores, setFormCores] = useState<any[]>([]);
  const [formTamanhos, setFormTamanhos] = useState<string[]>([]);
  const [novaCorNome, setNovaCorNome] = useState("");
  const [novaCorHex, setNovaCorHex] = useState("#000000");
  const [novaCorImagem, setNovaCorImagem] = useState("");
  const [novaCorArquivo, setNovaCorArquivo] = useState<File | null>(null);


  // Imagens: já salvas (ao editar) + novas selecionadas (arquivo local)
  const [imagensExistentes, setImagensExistentes] = useState<ProductImage[]>([]);
  const [imagensParaRemover, setImagensParaRemover] = useState<string[]>([]);
  const [novasImagens, setNovasImagens] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function loadProducts() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listProducts();
      setProducts(data.map(toViewProduct));
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Erro ao carregar produtos."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
    listCategoriesForSelect()
      .then(setCategorias)
      .catch(() => {
        // Falha ao carregar categorias não deve travar a tela de produtos.
      });
  }, []);

  function resetForm() {
    setFormNome("");
    setFormSku("");
    setFormDescricao("");
    setFormPreco("");
    setFormPrecoPromocional("");
    setFormEstoque("");
    setFormEstoqueMinimo("");
    setFormCategoriaId("");
    setFormVendaSemEstoque(false);
    setFormItemPromocao(false);
    setFormCores([]);
    setFormTamanhos([]);
    setNovaCorNome("");
    setNovaCorHex("#000000");
    setNovaCorImagem("");
    setNovaCorArquivo(null);
    setImagensExistentes([]);
    setImagensParaRemover([]);
    setNovasImagens([]);
    setSaveError(null);
  }

  function openNewProduct() {
    setEditTarget(null);
    resetForm();
    setShowModal(true);
  }

  /**
   * Ao editar, busca o produto DE NOVO no banco (não usa os dados
   * já carregados na lista) — evita preencher o formulário com um
   * estoque desatualizado e sobrescrever com um valor velho ao
   * salvar (causa do bug de estoque ficar "preso" ou negativo).
   */
  async function openEditProduct(pReferencia: Product) {
    setEditTarget(pReferencia);
    setSaveError(null);
    setShowModal(true);
    setLoadingEditData(true);
    try {
      const fresh = await getProductById(pReferencia.id);
      const p = toViewProduct(fresh);

      setEditTarget(p);
      setFormNome(p.nome);
      setFormSku(p.sku);
      setFormDescricao(p.descricao);
      setFormPreco(
        p.preco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
      );
      setFormPrecoPromocional(
        p.precoPromocional != null
          ? p.precoPromocional.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            })
          : ""
      );
      setFormEstoque(String(p.estoque));
      setFormEstoqueMinimo(String(p.estoqueMinimo));
      setFormCategoriaId(p.categoriaId ?? "");
      setFormVendaSemEstoque(p.permiteVendaSemEstoque);
      setFormItemPromocao(p.itemPromocao ?? false);
      setFormCores(p.cores ?? []);
      setFormTamanhos((p.tamanhos ?? []).map((t:any)=> typeof t === "string" ? t : t.tamanho).filter(Boolean));
      setImagensExistentes(p.imagens);
      setImagensParaRemover([]);
      setNovasImagens([]);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Erro ao carregar produto."
      );
    } finally {
      setLoadingEditData(false);
    }
  }

  function closeModal() {
    setShowModal(false);
    setEditTarget(null);
    resetForm();
  }

  function handleFilesSelected(files: FileList | null) {
    if (!files) return;
    setSaveError(null);
    const totalAtual =
      imagensExistentes.length -
      imagensParaRemover.length +
      novasImagens.length;
    const restante = MAX_IMAGES - totalAtual;
    if (restante <= 0) {
      setSaveError(`Máximo de ${MAX_IMAGES} imagens por produto.`);
      return;
    }

    const escolhidos = Array.from(files).slice(0, restante);
    const validos: File[] = [];
    for (const f of escolhidos) {
      if (!f.type.startsWith("image/")) continue;
      if (f.size > MAX_IMAGE_MB * 1024 * 1024) {
        setSaveError(`"${f.name}" excede ${MAX_IMAGE_MB}MB e foi ignorado.`);
        continue;
      }
      validos.push(f);
    }
    setNovasImagens((prev) => [...prev, ...validos]);
  }

  function removerImagemExistente(id: string) {
    setImagensParaRemover((prev) => [...prev, id]);
  }

  function removerNovaImagem(index: number) {
    setNovasImagens((prev) => prev.filter((_, i) => i !== index));
  }


  function selecionarImagemCor(file: File | null) {
    if (!file) return;

    const preview = URL.createObjectURL(file);
    setNovaCorImagem(preview);
    setNovaCorArquivo(file);
  }

  async function adicionarCor() {
    if (!novaCorNome.trim()) return;

    let imagemUrl = novaCorImagem || null;

    if (novaCorArquivo) {
      const arquivo = `cores/${Date.now()}-${novaCorArquivo.name}`;

      const { error } = await supabase.storage
        .from("product-images")
        .upload(arquivo, novaCorArquivo);

      if (error) {
        setSaveError("Erro ao enviar imagem da cor.");
        return;
      }

      const { data } = supabase.storage
        .from("product-images")
        .getPublicUrl(arquivo);

      imagemUrl = data.publicUrl;
    }

    setFormCores((prev) => [
      ...prev,
      {
        nome: novaCorNome.trim(),
        codigo_hex: novaCorHex,
        imagem_url: imagemUrl,
      },
    ]);

    setNovaCorNome("");
    setNovaCorHex("#000000");
    setNovaCorImagem("");
    setNovaCorArquivo(null);
  }

  function removerCor(index:number) {
    setFormCores((prev)=>prev.filter((_,i)=>i!==index));
  }

  async function handleSaveProduct() {
    setSaveError(null);

    if (!formNome.trim() || !formSku.trim()) {
      setSaveError("Nome e SKU são obrigatórios.");
      return;
    }

    const precoNumerico = parseFloat(
      formPreco.replace(/[^0-9,]/g, "").replace(",", ".")
    );
    if (isNaN(precoNumerico) || precoNumerico < 0) {
      setSaveError("Informe um preço válido.");
      return;
    }

    let precoPromocionalNumerico: number | null = null;
    if (formPrecoPromocional.trim()) {
      precoPromocionalNumerico = parseFloat(
        formPrecoPromocional.replace(/[^0-9,]/g, "").replace(",", ".")
      );
      if (isNaN(precoPromocionalNumerico) || precoPromocionalNumerico < 0) {
        setSaveError("Informe um preço promocional válido.");
        return;
      }
    }

    const estoqueNumerico = parseInt(formEstoque || "0", 10);
    const estoqueMinimoNumerico = parseInt(formEstoqueMinimo || "0", 10);

    if (isNaN(estoqueNumerico) || estoqueNumerico < 0) {
      setSaveError("Informe um estoque válido (0 ou mais).");
      return;
    }

    const input: ProductInput = {
      nome: formNome.trim(),
      sku: formSku.trim(),
      descricao: formDescricao.trim(),
      preco: precoNumerico,
      preco_promocional: precoPromocionalNumerico,
      estoque: estoqueNumerico,
      estoque_minimo: isNaN(estoqueMinimoNumerico) ? 0 : estoqueMinimoNumerico,
      category_id: formCategoriaId || null,
      permite_venda_sem_estoque: formVendaSemEstoque,
      item_promocao: formItemPromocao,
      cores: formCores,
      tamanhos: formTamanhos,
    };

    setSaving(true);
    try {
      let productId: string;
      if (editTarget) {
        const updated = await updateProduct(editTarget.id, input);
        productId = updated.id;
      } else {
        const created = await createProduct(input);
        productId = created.id;
      }

      // Remove imagens marcadas para exclusão
      for (const imgId of imagensParaRemover) {
        const img = imagensExistentes.find((i) => i.id === imgId);
        if (img) {
          await deleteProductImage(img);
        }
      }

      // Envia as novas imagens
      if (novasImagens.length > 0) {
        const posicaoInicial =
          imagensExistentes.length - imagensParaRemover.length;
        await uploadProductImages(productId, novasImagens, posicaoInicial);
      }

      closeModal();
      await loadProducts();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Erro ao salvar produto."
      );
    } finally {
      setSaving(false);
    }
  }

  const filtered = products
    .filter(
      (p) =>
        p.nome.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) {
      return <ChevronUp size={13} className="text-[#d1d5db]" />;
    }
    return sortAsc ? (
      <ChevronUp size={13} className="text-[#16a34a]" />
    ) : (
      <ChevronDown size={13} className="text-[#16a34a]" />
    );
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteProduct(deleteTarget.id);
      setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Erro ao excluir produto."
      );
    } finally {
      setDeleteTarget(null);
    }
  }

  const imagensVisiveis = imagensExistentes.filter(
    (img) => !imagensParaRemover.includes(img.id)
  );
  const totalImagens = imagensVisiveis.length + novasImagens.length;

  return (
    <div className="w-full min-h-full px-3 py-3 sm:px-4 lg:max-w-[1200px] lg:px-6 lg:py-6">
      {/* CABEÇALHO */}
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[17px] sm:text-[18px] font-semibold text-[#0f1117]">
              Produtos
            </h1>
            <p className="mt-0.5 text-[12px] text-[#6b7280]">
              Gerencie os produtos da sua loja
            </p>
          </div>

          <button
            onClick={openNewProduct}
            className="flex shrink-0 items-center justify-center gap-1.5 h-10 px-3.5 rounded-xl bg-[#16a34a] text-white text-[13px] font-semibold shadow-sm active:scale-[0.98] transition-transform lg:h-9 lg:px-3 lg:rounded-[6px]"
          >
            <Plus size={17} strokeWidth={2.2} />
            <span className="hidden xs:inline sm:inline">Novo produto</span>
          </button>
        </div>
      </div>

      {/* BUSCA */}
      <div className="mb-3">
        <div className="relative">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]"
            strokeWidth={2}
          />
          <input
            type="text"
            placeholder="Buscar produto ou SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#e4e4e7] bg-white text-base text-[#111827] placeholder:text-[#9ca3af] outline-none focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/10 transition lg:h-9 lg:rounded-[6px] lg:text-[13px]"
          />
        </div>
      </div>

      {loadError && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3.5 py-2.5 text-[12px] text-[#b91c1c]">
          <span>{loadError}</span>
          <button onClick={loadProducts} className="shrink-0 font-semibold underline">
            Tentar novamente
          </button>
        </div>
      )}

      {loading && (
        <div className="mb-3 flex items-center gap-2 text-[12px] text-[#6b7280]">
          <Loader2 size={14} className="animate-spin" />
          Carregando produtos...
        </div>
      )}

      {/* BARRA DE RESULTADOS */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] text-[#6b7280]">
          {filtered.length} produto{filtered.length !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-1.5 lg:hidden">
          <span className="text-[11px] text-[#9ca3af]">Ordenar:</span>
          <button
            onClick={() => toggleSort("nome")}
            className={`flex items-center gap-0.5 text-[11px] font-medium ${
              sortKey === "nome" ? "text-[#16a34a]" : "text-[#6b7280]"
            }`}
          >
            Nome
            <SortIcon k="nome" />
          </button>
        </div>
      </div>

      {/* LISTA MOBILE */}
      <div className="space-y-2.5 lg:hidden">
        {filtered.length === 0 ? (
          <div className="bg-white border border-[#e4e4e7] rounded-2xl px-5 py-12 text-center">
            <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-[#f4f4f5] flex items-center justify-center">
              <Package size={23} strokeWidth={1.7} className="text-[#a1a1aa]" />
            </div>
            <p className="text-[13px] font-medium text-[#374151]">
              Nenhum produto encontrado
            </p>
            <p className="mt-1 text-[11px] text-[#9ca3af]">
              {search
                ? "Tente buscar por outro nome ou SKU."
                : "Sua loja ainda não possui produtos cadastrados."}
            </p>
          </div>
        ) : (
          filtered.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-[#e4e4e7] rounded-2xl p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-11 h-11 rounded-xl bg-[#f0fdf4] border border-[#dcfce7] flex items-center justify-center overflow-hidden">
                  {p.imagens[0] ? (
                    <img
                      src={p.imagens[0].url}
                      alt={p.nome}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package size={20} className="text-[#16a34a]" strokeWidth={1.8} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[13px] font-semibold text-[#111827] leading-5 truncate">
                          {p.nome}
                        </h3>
                        {p.itemPromocao && (
                          <span className="shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#fef2f2] text-[#dc2626]">
                            OFERTA
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-[#9ca3af] font-mono">
                          {p.sku}
                        </span>
                        <span className="text-[#d4d4d8]">•</span>
                        <span className="text-[10px] text-[#9ca3af] truncate">
                          {p.categoria}
                        </span>
                      </div>
                    </div>
                    <Badge variant={statusVariant[p.status]} label={p.status} />
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 divide-x divide-[#f0f0f1] rounded-xl bg-[#fafafa] border border-[#f4f4f5]">
                <div className="px-3 py-2.5">
                  <p className="text-[9px] uppercase tracking-wide text-[#9ca3af] font-semibold">
                    Preço
                  </p>
                  <p className="mt-0.5 text-[14px] font-semibold text-[#111827]">
                    {p.precoFormatado}
                  </p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-[9px] uppercase tracking-wide text-[#9ca3af] font-semibold">
                    Estoque
                  </p>
                  <p
                    className={`mt-0.5 text-[14px] font-semibold ${
                      p.estoque === 0
                        ? "text-[#b91c1c]"
                        : p.estoque < 10
                        ? "text-[#b45309]"
                        : "text-[#111827]"
                    }`}
                  >
                    {p.estoque} un.
                  </p>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => openEditProduct(p)}
                  className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-white text-[12px] font-medium text-[#374151] active:bg-[#f4f4f5] transition"
                >
                  <Pencil size={14} strokeWidth={1.8} />
                  Editar
                </button>
                <button
                  onClick={() => setDeleteTarget(p)}
                  className="w-10 h-9 flex items-center justify-center rounded-xl border border-[#fee2e2] bg-[#fffafa] text-[#b91c1c] active:bg-[#fef2f2] transition"
                  aria-label={`Excluir ${p.nome}`}
                >
                  <Trash2 size={15} strokeWidth={1.8} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* TABELA DESKTOP */}
      <div className="hidden lg:block bg-white border border-[#e4e4e7] rounded-[8px] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#e4e4e7] flex items-center justify-between">
          <span className="text-[12px] text-[#6b7280]">
            {filtered.length} produto{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e4e4e7] bg-[#fafafa]">
                <th className="px-4 py-2 text-left">
                  <button
                    className="flex items-center gap-1 text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider hover:text-[#0f1117]"
                    onClick={() => toggleSort("nome")}
                  >
                    Produto
                    <SortIcon k="nome" />
                  </button>
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">
                  Categoria
                </th>
                <th className="px-4 py-2 text-left">
                  <button
                    className="flex items-center gap-1 text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider hover:text-[#0f1117]"
                    onClick={() => toggleSort("preco")}
                  >
                    Preço
                    <SortIcon k="preco" />
                  </button>
                </th>
                <th className="px-4 py-2 text-left">
                  <button
                    className="flex items-center gap-1 text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider hover:text-[#0f1117]"
                    onClick={() => toggleSort("estoque")}
                  >
                    Estoque
                    <SortIcon k="estoque" />
                  </button>
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Package size={32} strokeWidth={1.5} className="mx-auto text-[#d1d5db] mb-2" />
                    <p className="text-[13px] text-[#6b7280]">Nenhum produto encontrado</p>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="border-b border-[#f4f4f5] hover:bg-[#fafafa] transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-md bg-[#f4f4f5] border border-[#e4e4e7] flex items-center justify-center overflow-hidden shrink-0">
                          {p.imagens[0] ? (
                            <img
                              src={p.imagens[0].url}
                              alt={p.nome}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageOff size={13} className="text-[#c4c4c8]" strokeWidth={1.6} />
                          )}
                        </div>
                        <span className="text-[13px] font-medium text-[#0f1117]">
                          {p.nome}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[12px] text-[#6b7280] font-mono">{p.sku}</span>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-[#374151]">{p.categoria}</td>
                    <td className="px-4 py-2.5 text-[13px] font-medium text-[#0f1117]">
                      {p.precoFormatado}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-[12px] font-medium ${
                          p.estoque === 0
                            ? "text-[#b91c1c]"
                            : p.estoque < 10
                            ? "text-[#b45309]"
                            : "text-[#0f1117]"
                        }`}
                      >
                        {p.estoque}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Badge variant={statusVariant[p.status]} label={p.status} />
                        {p.permiteVendaSemEstoque && (
                          <span
                            className="text-[10px] font-medium text-[#6b7280]"
                            title="Vende mesmo sem estoque"
                          >
                            (venda liberada)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          className="p-1 text-[#6b7280] hover:text-[#0f1117] rounded hover:bg-[#f4f4f5]"
                          onClick={() => openEditProduct(p)}
                        >
                          <Pencil size={14} strokeWidth={1.8} />
                        </button>
                        <button
                          className="p-1 text-[#6b7280] hover:text-[#b91c1c] rounded hover:bg-[#fef2f2]"
                          onClick={() => setDeleteTarget(p)}
                        >
                          <Trash2 size={14} strokeWidth={1.8} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL NOVO/EDITAR PRODUTO */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-end lg:items-center justify-center">
          <div className="w-full bg-white rounded-t-[24px] lg:rounded-[12px] lg:max-w-lg border border-[#e4e4e7] overflow-hidden max-h-[92dvh] flex flex-col shadow-2xl">
            {/* Cabeçalho */}
            <div className="px-4 pt-4 pb-3 border-b border-[#f0f0f1]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[16px] font-semibold text-[#111827]">
                    {editTarget ? "Editar produto" : "Novo produto"}
                  </h2>
                  <p className="mt-0.5 text-[11px] text-[#9ca3af]">
                    {editTarget
                      ? "Atualize os dados do produto"
                      : "Cadastre um produto na sua loja"}
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="w-9 h-9 rounded-xl bg-[#f4f4f5] flex items-center justify-center text-[#6b7280] active:bg-[#e4e4e7]"
                  aria-label="Fechar"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Formulário */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {loadingEditData ? (
                <div className="flex items-center justify-center py-16 gap-2 text-[13px] text-[#6b7280]">
                  <Loader2 size={16} className="animate-spin" />
                  Carregando dados do produto...
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Imagens */}
                  <div>
                    <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
                      Fotos do produto
                    </label>
                    <p className="text-[11px] text-[#9ca3af] mb-2">
                      A primeira foto é a que aparece na vitrine da loja.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {imagensVisiveis.map((img, i) => (
                        <div
                          key={img.id}
                          className="relative w-16 h-16 rounded-lg overflow-hidden border border-[#e4e4e7] group"
                        >
                          <img
                            src={img.url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          {i === 0 && (
                            <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] font-medium text-center py-0.5">
                              Capa
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => removerImagemExistente(img.id)}
                            className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                            aria-label="Remover imagem"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ))}

                      {novasImagens.map((file, i) => (
                        <div
                          key={i}
                          className="relative w-16 h-16 rounded-lg overflow-hidden border border-[#e4e4e7]"
                        >
                          <img
                            src={URL.createObjectURL(file)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          {imagensVisiveis.length === 0 && i === 0 && (
                            <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] font-medium text-center py-0.5">
                              Capa
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => removerNovaImagem(i)}
                            className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                            aria-label="Remover imagem"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ))}

                      {totalImagens < MAX_IMAGES && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-16 h-16 rounded-lg border-2 border-dashed border-[#d4d4d8] flex flex-col items-center justify-center text-[#9ca3af] hover:border-[#16a34a] hover:text-[#16a34a] transition-colors"
                        >
                          <ImagePlus size={18} strokeWidth={1.8} />
                          <span className="text-[9px] mt-0.5">Adicionar</span>
                        </button>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        handleFilesSelected(e.target.files);
                        e.target.value = "";
                      }}
                    />
                    <p className="mt-1.5 text-[10px] text-[#9ca3af]">
                      Até {MAX_IMAGES} fotos, {MAX_IMAGE_MB}MB cada.
                    </p>
                  </div>

                  {/* Nome */}
                  <div>
                    <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
                      Nome do produto
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Camiseta Masculina Básica"
                      value={formNome}
                      onChange={(e) => setFormNome(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-[#e4e4e7] bg-white text-base outline-none placeholder:text-[#a1a1aa] focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/10 lg:text-[13px]"
                    />
                  </div>

                  {/* Descrição */}
                  <div>
                    <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
                      Descrição
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Descreva o produto: material, medidas, cuidados..."
                      value={formDescricao}
                      onChange={(e) => setFormDescricao(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-[#e4e4e7] bg-white text-base outline-none placeholder:text-[#a1a1aa] focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/10 resize-none lg:text-[13px]"
                    />
                  </div>

                  {/* SKU */}
                  <div>
                    <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
                      SKU
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: CAM001"
                      value={formSku}
                      onChange={(e) => setFormSku(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-[#e4e4e7] bg-white text-base outline-none placeholder:text-[#a1a1aa] focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/10 lg:text-[13px]"
                    />
                  </div>

                  {/* Preço + Preço promocional */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
                        Preço
                      </label>
                      <input
                        type="text"
                        placeholder="R$ 0,00"
                        value={formPreco}
                        onChange={(e) => setFormPreco(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl border border-[#e4e4e7] bg-white text-base outline-none placeholder:text-[#a1a1aa] focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/10 lg:text-[13px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
                        Preço promocional
                      </label>
                      <input
                        type="text"
                        placeholder="Opcional"
                        value={formPrecoPromocional}
                        onChange={(e) => setFormPrecoPromocional(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl border border-[#e4e4e7] bg-white text-base outline-none placeholder:text-[#a1a1aa] focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/10 lg:text-[13px]"
                      />
                    </div>
                  </div>

                  {/* Estoque + Estoque mínimo */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
                        Estoque
                      </label>
                      <input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={formEstoque}
                        onChange={(e) => setFormEstoque(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl border border-[#e4e4e7] bg-white text-base outline-none placeholder:text-[#a1a1aa] focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/10 lg:text-[13px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
                        Estoque mínimo
                      </label>
                      <input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={formEstoqueMinimo}
                        onChange={(e) => setFormEstoqueMinimo(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl border border-[#e4e4e7] bg-white text-base outline-none placeholder:text-[#a1a1aa] focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/10 lg:text-[13px]"
                      />
                    </div>
                  </div>

                  {/* Categoria */}
                  <div>
                    <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
                      Categoria
                    </label>
                    <select
                      value={formCategoriaId}
                      onChange={(e) => setFormCategoriaId(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-[#e4e4e7] bg-white text-base text-[#374151] outline-none focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/10 lg:text-[13px]"
                    >
                      <option value="">Sem categoria</option>
                      {categorias.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </div>


                  {/* Promoção */}
                  <div className="flex items-center justify-between rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-3.5 py-3">
                    <div>
                      <p className="text-[13px] font-medium text-[#111827]">
                        Item em promoção
                      </p>
                      <p className="text-[11px] text-[#6b7280]">
                        Exibir destaque de oferta na loja
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormItemPromocao((v) => !v)}
                      className={`relative w-11 h-6 rounded-full ${
                        formItemPromocao ? "bg-[#16a34a]" : "bg-[#d1d5db]"
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition ${
                        formItemPromocao ? "translate-x-5" : ""
                      }`} />
                    </button>
                  </div>

                  {/* Cores */}
                  <div>
                    <label className="block text-[12px] font-semibold text-[#374151] mb-2">
                      Cores do produto
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        placeholder="Nome da cor"
                        value={novaCorNome}
                        onChange={(e)=>setNovaCorNome(e.target.value)}
                        className="h-10 px-3 rounded-xl border border-[#e4e4e7]"
                      />

                      <input
                        type="color"
                        value={novaCorHex}
                        onChange={(e)=>setNovaCorHex(e.target.value)}
                        className="h-10 rounded-xl"
                      />
                    </div>

                    <label className="mt-2 w-full h-10 px-3 rounded-xl border border-[#e4e4e7] flex items-center gap-2 cursor-pointer text-sm text-[#6b7280]">
                      <ImagePlus size={16}/>
                      Anexar imagem da cor
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e)=>selecionarImagemCor(e.target.files?.[0] ?? null)}
                      />
                    </label>

                    {novaCorImagem && (
                      <div className="mt-2 flex items-center gap-2">
                        <img
                          src={novaCorImagem}
                          className="w-16 h-16 rounded-lg object-cover border"
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-black/10"
                          style={{ backgroundColor: novaCorHex }}
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={adicionarCor}
                      className="mt-2 w-full h-10 rounded-xl bg-[#16a34a] text-white text-sm font-semibold"
                    >
                      Adicionar cor
                    </button>

                    <div className="mt-2 space-y-2">
                      {formCores.map((cor,index)=>(
                        <div key={index} className="flex items-center justify-between border rounded-xl p-2">
                          <div className="flex items-center gap-2.5">
                            {cor.imagem_url ? (
                              <img
                                src={cor.imagem_url}
                                alt={cor.nome}
                                className="w-9 h-9 rounded-lg object-cover border border-[#e4e4e7] shrink-0"
                              />
                            ) : (
                              <span
                                className="w-9 h-9 rounded-lg border border-[#e4e4e7] shrink-0"
                                style={{backgroundColor:cor.codigo_hex || "#fff"}}
                              />
                            )}
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="w-3 h-3 rounded-full border border-black/10 shrink-0"
                                style={{backgroundColor:cor.codigo_hex || "#fff"}}
                              />
                              <span className="text-sm truncate">{cor.nome}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={()=>removerCor(index)}
                            className="text-red-600 text-xs shrink-0 ml-2"
                          >
                            remover
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tamanhos */}
                  <div>
                    <label className="block text-[12px] font-semibold text-[#374151] mb-2">
                      Tamanhos
                    </label>

                    <div className="flex flex-wrap gap-2">
                      {["P","M","G","GG","XG"].map((t)=>(
                        <button
                          type="button"
                          key={t}
                          onClick={()=>setFormTamanhos((v) =>
                            v.includes(t)
                              ? v.filter((x)=>x !== t)
                              : [...v, t]
                          )}
                          className={`px-4 py-2 rounded-xl border text-sm ${
                            formTamanhos.includes(t)
                            ? "bg-[#16a34a] text-white"
                            : "bg-white"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Vender sem estoque */}
                  <div className="flex items-center justify-between rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-3.5 py-3">
                    <div className="pr-3">
                      <p className="text-[13px] font-medium text-[#111827]">
                        Vender mesmo sem estoque
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#6b7280]">
                        O produto continua disponível na loja mesmo com estoque zerado
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormVendaSemEstoque((v) => !v)}
                      aria-pressed={formVendaSemEstoque}
                      className={`relative w-11 h-6 shrink-0 rounded-full transition-colors duration-200 focus:outline-none ${
                        formVendaSemEstoque ? "bg-[#16a34a]" : "bg-[#d1d5db]"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
                          formVendaSemEstoque ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {saveError && (
                    <p className="text-[12px] text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-lg px-3 py-2">
                      {saveError}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Rodapé */}
            <div className="px-4 py-3 border-t border-[#f0f0f1] bg-white flex gap-2">
              <button
                onClick={closeModal}
                disabled={saving}
                className="flex-1 h-11 rounded-xl border border-[#e4e4e7] bg-white text-[13px] font-medium text-[#374151] active:bg-[#f4f4f5] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveProduct}
                disabled={saving || loadingEditData}
                className="flex-[1.3] h-11 rounded-xl bg-[#16a34a] text-white text-[13px] font-semibold active:bg-[#15803d] disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                {saving
                  ? "Salvando..."
                  : editTarget
                  ? "Salvar alterações"
                  : "Salvar produto"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMAR EXCLUSÃO */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/45 z-50 flex items-end lg:items-center justify-center">
          <div className="bg-white w-full rounded-t-[24px] lg:rounded-[12px] lg:max-w-sm overflow-hidden shadow-2xl">
            <div className="px-4 pt-5 pb-4">
              <div className="mx-auto mb-4 w-11 h-11 rounded-full bg-[#fef2f2] flex items-center justify-center">
                <Trash2 size={20} className="text-[#b91c1c]" strokeWidth={1.8} />
              </div>
              <h2 className="text-[16px] font-semibold text-[#111827] text-center">
                Excluir produto?
              </h2>
              <p className="mt-2 text-[12px] leading-5 text-[#6b7280] text-center">
                O produto{" "}
                <strong className="text-[#374151]">{deleteTarget.nome}</strong>{" "}
                será removido permanentemente.
              </p>
            </div>
            <div className="px-4 py-3 border-t border-[#f0f0f1] flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 h-11 rounded-xl border border-[#e4e4e7] bg-white text-[13px] font-medium text-[#374151]"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 h-11 rounded-xl bg-[#b91c1c] text-white text-[13px] font-semibold"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}