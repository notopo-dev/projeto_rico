import { supabase } from "./supabaseClient";

/**
 * Pede para a fila de e-mails ser esvaziada.
 *
 * ----------------------------------------------------------------
 * Por que isto existe, e por que é tão pouco código
 * ----------------------------------------------------------------
 * Quem decide QUAIS mensagens existem é o banco: a função do pedido
 * e o gatilho de status enfileiram sozinhos. Esta chamada só avisa
 * "tem coisa na fila, pode mandar".
 *
 * Isso é de propósito. O navegador não escolhe destinatário nem
 * texto — se escolhesse, qualquer pessoa com o site aberto poderia
 * disparar e-mail em nome do domínio da loja.
 *
 * ----------------------------------------------------------------
 * Por que nunca lança erro
 * ----------------------------------------------------------------
 * Chamar isto é sempre o ÚLTIMO passo de alguma coisa que já deu
 * certo: o pedido já foi criado, o status já mudou. Deixar um erro
 * de e-mail subir daqui faria o lojista ver "erro ao salvar" depois
 * de uma operação que funcionou — e, no checkout, faria o cliente
 * achar que a compra falhou.
 *
 * Se a chamada falhar, a mensagem continua pendente na fila e sai na
 * próxima vez que alguém mexer em qualquer pedido. É exatamente para
 * isso que existe a fila em vez de envio direto.
 */
export function dispararEmails(): void {
  /*
   * Com limite de tempo: no checkout, a tela navega logo depois
   * desta chamada, e uma requisição pendurada seria cancelada pelo
   * navegador no meio. Três segundos é mais que suficiente para a
   * função responder, e se estourar não se perde nada — a fila
   * garante a próxima tentativa.
   */
  const limite = new Promise<void>((resolve) => setTimeout(resolve, 3000));

  Promise.race([
    supabase.functions.invoke("emails-processar", { body: {} }).then(() => undefined),
    limite,
  ]).catch(() => {
    /* silêncio proposital: ver o comentário acima */
  });
}
