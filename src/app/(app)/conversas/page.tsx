import { redirect } from "next/navigation";

/**
 * "Conversas" saiu da lateral: a conversa do time mora no Inbox. O endereço
 * fica apontando para lá, para link antigo não cair numa tela vazia.
 */
export default function ConversasPage() {
  redirect("/inbox");
}
