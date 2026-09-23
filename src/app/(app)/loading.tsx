import { Screen } from "@/components/ui/Screen";

/*
 * Esqueleto de reserva do shell, para toda tela que não tem o seu (Inbox,
 * Clientes, Configurações, Usuários, a descrição da tarefa…).
 *
 * Existe por causa do roteador: tela dinâmica sem `loading.tsx` não é
 * pré-carregada, então o clique na lateral ficava parado — sem nada mudar —
 * até o servidor responder a tela inteira. Com a borda de carregamento, o
 * painel troca na hora do clique e o conteúdo chega por streaming. As telas
 * com esqueleto próprio (Tarefas, Social media) continuam com o delas.
 */
export default function LoadingApp() {
  return (
    <Screen>
      <div className="skeleton h-4 w-48 rounded-pill" />
      <div className="flex items-center justify-between gap-3">
        <div className="skeleton h-10 w-[240px] rounded-pill" />
        <div className="skeleton h-10 w-[120px] rounded-mark" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="h-12 w-full shrink-0 border-b border-rule" />
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            style={{ ["--d" as string]: i }}
            className="stagger-item flex h-11 shrink-0 items-center gap-4 border-b border-rule-soft px-4"
          >
            <div className="skeleton h-[26px] w-[26px] rounded-pill" />
            <div className="skeleton h-3 w-[38%] rounded-pill" />
            <div className="skeleton ml-auto h-3 w-[72px] rounded-pill" />
          </div>
        ))}
      </div>
    </Screen>
  );
}
