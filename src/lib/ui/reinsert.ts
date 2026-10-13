/**
 * Devolve à lista os itens que tinham saído dela, cada um no lugar onde
 * estava.
 *
 * O "Desfazer" da exclusão adiada restaurava o **retrato** da lista tirado no
 * momento da exclusão. Nos 4 s do toast a lista continua viva — outra
 * exclusão, uma edição, uma tarefa nova —, e voltar ao retrato desfazia tudo
 * isso junto: ressuscitava na tela um item já excluído no servidor e apagava
 * o que tinha acabado de chegar.
 *
 * Aqui só os itens de `back` voltam, sobre a lista **atual**. A posição vem de
 * `before`: cada um entra logo depois do vizinho que o precedia e ainda está
 * na lista (ou no topo, se nenhum ficou). Item que já está na lista não
 * duplica.
 */
export function reinsert<T extends { id: string }>(
  current: T[],
  before: T[],
  back: T[],
): T[] {
  const order = new Map(before.map((item, i) => [item.id, i]));
  const out = [...current];
  const sorted = [...back].sort(
    (a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity),
  );

  for (const item of sorted) {
    if (out.some((x) => x.id === item.id)) continue;
    const i = order.get(item.id) ?? before.length;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const k = out.findIndex((x) => x.id === before[j].id);
      if (k >= 0) {
        at = k + 1;
        break;
      }
    }
    out.splice(at, 0, item);
  }
  return out;
}
