import { LEGACY_AGENCY_ID } from "@/lib/agency/id";
import { callSummary } from "./view";
import { normalizeNotifyPrefs } from "./notifyPrefs";
import type { Conversation, InboxData, InboxMember, Message } from "./types";

/*
 * A conversa da equipe do export "Inbox" — os mesmos grupos, as mesmas
 * diretas e o mesmo fio de mensagens do desenho, para a tela abrir viva na
 * primeira execução. Vale a regra dos outros `seed.ts`: nada aqui foi
 * inventado por fora do desenho, e tudo pertence à agência semeada — quem
 * acaba de se cadastrar abre o Inbox vazio, não com a conversa dos outros.
 *
 * Duas diferenças em relação aos seeds de tarefa e cliente:
 *
 * 1. **As datas são relativas ao primeiro uso.** Conversa é a área do produto
 *    em que "hoje" e "ontem" estão na tela o tempo todo; datas cravadas em
 *    setembro de 2026 fariam a tela nascer com um histórico morto.
 * 2. **Felipe não tem direta consigo mesmo.** O export desenha uma (é uma
 *    tela estática); no produto quem abre a tela é ele.
 */

type TeamRow = Pick<InboxMember, "id" | "name" | "email" | "handle" | "presence" | "role" | "title">;

const TEAM_ROWS: TeamRow[] = [
  // O e-mail é o que liga este membro à conta de demonstração (ver README).
  { id: "felipe", name: "Felipe", email: "felipe@blackberry.app", handle: "felipe", presence: "disponivel", role: "admin", title: "Coordenação" },
  { id: "marina", name: "Marina", email: "", handle: "marina", presence: "disponivel", role: "editor", title: "Social media" },
  { id: "ana", name: "Ana", email: "", handle: "ana", presence: "ocupado", role: "editor", title: "Atendimento" },
  { id: "rodrigo", name: "Rodrigo Q.", email: "", handle: "rodrigo", presence: "ausente", role: "editor", title: "Designer" },
  { id: "camila", name: "Camila", email: "", handle: "camila", presence: "offline", role: "gerente", title: "Redação" },
  { id: "pedro", name: "Pedro E.", email: "", handle: "pedro", presence: "disponivel", role: "editor", title: "Tráfego" },
];

const TEAM: Omit<InboxMember, "agencyId">[] = TEAM_ROWS.map((row) => ({
  ...row,
  status: "ativo",
  lastSeenAt: null,
  createdAt: "2026-09-01T09:00:00.000Z",
  invite: null,
  joinRequest: false,
  photoUrl: null,
  notify: normalizeNotifyPrefs(null),
}));

/** Minutos atrás — para o que aconteceu "hoje", sem cair no futuro. */
function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

/** Dias atrás, num horário do dia — para o histórico com divisória de data. */
function daysAgo(days: number, time: string): string {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

let seq = 0;
function msg(
  authorId: string,
  text: string,
  createdAt: string,
  kind: Message["kind"] = "texto",
): Message {
  return {
    id: `m${++seq}`,
    authorId,
    text,
    createdAt,
    kind,
    attachments: [],
    replyToId: null,
    editedAt: null,
    deletedAt: null,
  };
}

function conversation(
  row: Omit<Conversation, "agencyId" | "createdAt" | "call"> & {
    createdAt?: string;
  },
): Conversation {
  return {
    call: null,
    ...row,
    agencyId: LEGACY_AGENCY_ID,
    createdAt: row.createdAt ?? row.messages[0]?.createdAt ?? new Date().toISOString(),
  };
}

export function seedInbox(): InboxData {
  seq = 0;
  const now = new Date().toISOString();
  /** Leu tudo: a conversa abre sem badge. */
  const lido = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, now]));

  const conversations: Conversation[] = [
    conversation({
      id: "g-bb",
      kind: "grupo",
      name: "BlackBerry Design",
      memberIds: ["felipe", "marina", "ana", "rodrigo", "camila", "pedro"],
      mutedBy: [],
      messages: [
        msg("marina", "Subi a nova versão do painel de lotes, quem puder olhar hoje ajuda", daysAgo(2, "15:10")),
        msg("felipe", "Olho ainda hoje", daysAgo(2, "15:22")),
        msg("ana", "Passei o olho no fluxo de aprovação, ficou bem mais direto", minutesAgo(260)),
        msg("rodrigo", "Só faltou o estado vazio da lista", minutesAgo(180)),
        msg("marina", "fechei o export ok", minutesAgo(2)),
      ],
      // Três mensagens depois da última leitura — o badge "3" do desenho.
      readAt: { ...lido("marina", "ana", "rodrigo"), felipe: daysAgo(1, "09:00") },
    }),
    conversation({
      id: "g-aurora",
      kind: "grupo",
      name: "Clínica Aurora",
      memberIds: ["felipe", "ana", "marina"],
      mutedBy: [],
      messages: [
        msg("felipe", "Lote de outubro entra semana que vem, alinhamos o roteiro antes?", daysAgo(1, "16:40")),
        msg("marina", "Por mim sim", daysAgo(1, "16:52")),
        msg("ana", "mandei o roteiro", minutesAgo(95)),
      ],
      readAt: { ...lido("ana", "marina"), felipe: minutesAgo(200) },
    }),
    conversation({
      id: "g-monte",
      kind: "grupo",
      name: "Montê bar",
      memberIds: ["felipe", "marina", "ana", "rodrigo"],
      mutedBy: [],
      messages: [
        msg("marina", "Bom dia gente! Subi os artes revisados na pasta de aprovação, deem uma olhada quando puderem", daysAgo(3, "09:14")),
        msg("ana", "Boaaa, já vou revisar", daysAgo(3, "09:18")),
        msg("ana", "Cliente pediu ajuste no tom da laranja, tô ajustando aqui", daysAgo(3, "09:21")),
        msg("marina", callSummary("Marina", 12 * 60), daysAgo(3, "09:40"), "chamada"),
        msg("felipe", "Tudo certo com o export, mandei pro cliente", daysAgo(3, "10:47")),
        msg("rodrigo", "Fala pessoal, terminei a revisão do briefing do Aurora. Segue meu apontamento:", minutesAgo(200)),
        msg("rodrigo", "1. Voltar com o roxo original no header", minutesAgo(199)),
        msg("rodrigo", "2. Ajustar espaçamento das seções", minutesAgo(198)),
        msg("rodrigo", "3. Trocar a foto do time", minutesAgo(197)),
        // O aviso é a segunda linha de sistema do export. Fixar mensagem ainda
        // não tem desenho — ver a nota do botão de fixar em `ChatPane`.
        msg("marina", "Marina fixou uma mensagem.", minutesAgo(190), "aviso"),
        msg("felipe", "Combinado, começo os ajustes ainda hoje. Amanhã cedo mando a nova versão", minutesAgo(120)),
        msg("marina", "🚀 valeu Felipe, essencial fecharmos essa entrega antes de sexta", minutesAgo(118)),
      ],
      readAt: lido("felipe", "marina", "ana", "rodrigo"),
    }),
    conversation({
      id: "g-pilares",
      kind: "grupo",
      name: "Studio Pilares",
      memberIds: ["felipe", "camila", "pedro"],
      // O sininho cortado da lista: silenciada por quem abre a tela.
      mutedBy: ["felipe"],
      messages: [
        msg("camila", "Subiu o pack de setembro?", daysAgo(4, "11:05")),
        msg("felipe", "revisão aprovada", daysAgo(4, "11:31")),
      ],
      readAt: lido("felipe", "camila", "pedro"),
    }),
    conversation({
      id: "g-vetor",
      kind: "grupo",
      name: "Casa Vetor",
      memberIds: ["felipe", "rodrigo", "camila"],
      mutedBy: [],
      messages: [msg("rodrigo", "chegou o pack", daysAgo(6, "14:12"))],
      readAt: lido("felipe", "rodrigo", "camila"),
    }),
    conversation({
      id: "d-marina",
      kind: "direta",
      name: "",
      memberIds: ["felipe", "marina"],
      mutedBy: [],
      messages: [
        msg("felipe", "consegue olhar o lote do Montê hoje?", minutesAgo(70)),
        msg("marina", "olho sim, depois do almoço", minutesAgo(65)),
        msg("marina", "boa, deixa comigo", minutesAgo(60)),
      ],
      readAt: { marina: now, felipe: minutesAgo(66) },
    }),
    conversation({
      id: "d-ana",
      kind: "direta",
      name: "",
      memberIds: ["felipe", "ana"],
      mutedBy: [],
      messages: [
        msg("felipe", "consegue fechar o roteiro do Aurora?", minutesAgo(140)),
        msg("ana", "amanhã cedo então", minutesAgo(135)),
      ],
      readAt: lido("felipe", "ana"),
    }),
    conversation({
      id: "d-rodrigo",
      kind: "direta",
      name: "",
      memberIds: ["felipe", "rodrigo"],
      mutedBy: [],
      messages: [msg("rodrigo", "vou dar um retorno", daysAgo(1, "17:20"))],
      readAt: lido("felipe", "rodrigo"),
    }),
    conversation({
      id: "d-camila",
      kind: "direta",
      name: "",
      memberIds: ["felipe", "camila"],
      mutedBy: ["felipe"],
      messages: [msg("camila", "mandei o gif animado pra você", daysAgo(5, "10:02"))],
      readAt: lido("felipe", "camila"),
    }),
    conversation({
      id: "d-pedro",
      kind: "direta",
      name: "",
      memberIds: ["felipe", "pedro"],
      mutedBy: [],
      messages: [msg("pedro", "recebido, obg", daysAgo(6, "09:45"))],
      readAt: lido("felipe", "pedro"),
    }),
  ];

  return {
    members: TEAM.map((m) => ({ ...m, agencyId: LEGACY_AGENCY_ID })),
    conversations,
    settings: {},
  };
}
