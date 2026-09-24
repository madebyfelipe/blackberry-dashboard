/**
 * Uma releitura por vez, e nenhuma perdida.
 *
 * Várias telas releem o servidor quando "alguma coisa mudou": um evento do
 * tempo real, a janela voltando ao foco, a aba ficando visível, o relógio.
 * Numa rajada (cinco mensagens seguidas, foco e visibilidade juntos) isso
 * disparava uma leitura por aviso, todas ao mesmo tempo — rede gasta à toa e,
 * pior, respostas voltando fora de ordem: a leitura mais velha chegando por
 * último e pintando na tela um estado que já tinha passado.
 *
 * `coalesce(tarefa)` devolve uma função que:
 * - parada, roda a tarefa na hora;
 * - com a tarefa rodando, só anota "tem mais" — e, ao terminar, roda **uma**
 *   vez de novo (o aviso pode descrever algo mais novo que a leitura em voo);
 * - devolve uma promessa que resolve quando o estado já inclui o seu pedido,
 *   para quem espera (`await refresh()` depois de enviar) ver o resultado.
 *
 * N avisos durante uma leitura viram no máximo mais uma, nunca N em paralelo.
 * A falha de uma rodada não impede a seguinte: a tarefa trata o próprio erro
 * (as releituras do produto já engolem falha de rede e tentam na próxima).
 */
export function coalesce(tarefa: () => Promise<void>): () => Promise<void> {
  let rodando: Promise<void> | null = null;
  let deNovo = false;

  return function pedir() {
    if (rodando) {
      deNovo = true;
      return rodando;
    }
    rodando = (async () => {
      try {
        do {
          deNovo = false;
          try {
            await tarefa();
          } catch {
            // Ver acima: quem pediu a releitura cuida do erro dela.
          }
        } while (deNovo);
      } finally {
        rodando = null;
      }
    })();
    return rodando;
  };
}
