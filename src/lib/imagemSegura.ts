/**
 * Validação de imagem antes de subir para o Storage.
 *
 * O que estava acontecendo:
 *
 *  - A extensão saía do NOME que o usuário mandou
 *    (`file.name.split(".").pop()`), e o Content-Type do objeto sai do
 *    `file.type`, que o navegador também deixa escolher. Ou seja: o
 *    arquivo era publicado com o tipo que o remetente quisesse.
 *  - `accept="image/*"` no input é dica de interface, não validação —
 *    some se a requisição não passar pela tela.
 *  - SVG passava. SVG é XML: aceita <script> dentro. Servido de um
 *    bucket público, vira página executável no domínio do Storage.
 *    Não rouba a sessão do painel (origem diferente), mas serve para
 *    golpe hospedado no endereço da própria plataforma.
 *  - O logo e o banner da loja não tinham limite de tamanho nenhum.
 *
 * A checagem forte é a dos PRIMEIROS BYTES do arquivo. Extensão e
 * MIME são o que o remetente afirma; a assinatura é o que o arquivo é.
 */

const TIPOS_PERMITIDOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Assinaturas de arquivo (magic numbers). */
const ASSINATURAS: { ext: string; confere: (b: Uint8Array) => boolean }[] = [
  { ext: "jpg", confere: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    ext: "png",
    confere: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    ext: "gif",
    confere: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46,
  },
  {
    ext: "webp",
    confere: (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
];

export interface ImagemValidada {
  /** Extensão derivada do CONTEÚDO, nunca do nome enviado. */
  ext: string;
  /** Content-Type a gravar no Storage, também do conteúdo. */
  contentType: string;
}

export async function validarImagem(
  file: File,
  maxMB: number,
): Promise<ImagemValidada> {
  if (file.size === 0) {
    throw new Error("Arquivo vazio.");
  }
  if (file.size > maxMB * 1024 * 1024) {
    throw new Error(`A imagem excede o limite de ${maxMB}MB.`);
  }

  if (!TIPOS_PERMITIDOS[file.type]) {
    throw new Error(
      "Formato não aceito. Envie uma imagem JPG, PNG, WEBP ou GIF.",
    );
  }

  const cabecalho = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const real = ASSINATURAS.find((a) => a.confere(cabecalho));

  if (!real) {
    // Chega aqui quem renomeou um arquivo para .jpg, ou mandou SVG
    // com Content-Type de imagem.
    throw new Error(
      "Este arquivo não é uma imagem válida. Envie um JPG, PNG, WEBP ou GIF.",
    );
  }

  const esperado = TIPOS_PERMITIDOS[file.type];
  if (real.ext !== esperado && !(esperado === "jpg" && real.ext === "jpg")) {
    throw new Error(
      "O conteúdo do arquivo não corresponde ao formato informado.",
    );
  }

  return {
    ext: real.ext,
    contentType: real.ext === "jpg" ? "image/jpeg" : `image/${real.ext}`,
  };
}
