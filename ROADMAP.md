# Roadmap — black berry

Documento vivo. Marca o que já existe, o que falta **desenhar** (você) e o que falta **construir** (Claude), até o fim do projeto. Última atualização: **20 set 2026** (contorno arredondado que não fecha e card do swipe voltando ao centro — issues #24 e #17).

Legenda: ✅ pronto · 🟡 parcial/placeholder · ⬜ não começado · 🎨 precisa de tela sua antes de eu construir

---

## Fundação
- ✅ Projeto Next.js 16 + React 19 + Tailwind v4 + TS do zero
- ✅ Tokens do design **black berry** (`globals.css @theme`) + primitivos (`Button`, `Input`, `StatusPill`, `Avatar`, `Breadcrumb`, `Toast`)
- ✅ **Design system v2 (gradiente)**: tokens anotados com os nomes `bb-*` do export, `--color-dim` (#616161), `--radius-panel`/`--radius-menu`, sidebar com `bg-sidebar-gradient` e corpo da lista transparente
- ✅ **Polimento do design system** (issue #14): hex e raios crus saíram do JSX para o `@theme` (`--color-danger`, `--color-badge`/`--color-badge-strong`, `--radius-thumb`, `--spacing-control`, cinzas de status), o "⋯" ganhou o alvo de toque de 40px sem mexer na altura das linhas, os menus de ação voltaram à forma do export (10px/6px) com `aria-haspopup`/`aria-expanded` e navegação por setas, e o texto de apoio em conteúdo real subiu de `faint` (2,5:1) para `muted` (5,3:1)
- ✅ **Contorno que fecha em todo canto arredondado** (issue #24): o par `outline` + `-outline-offset-[0.5px]` quebrava o traço num trecho da curva (meio pixel de tela). Pílulas, chips e botões passaram a `inset-ring-1` (box-shadow, mesmo recorte da caixa, sem mexer no layout), o ponto de status do quadro virou `inset` e o item ativo da lateral voltou ao export — o marcador de 3px em `left-0` era comido pela pílula de raio 24px e aparecia como lasca
- ✅ Shell autenticado (sidebar completa) + rotas placeholder
- ✅ Camada de dados com `repository`/`store` (JSON + fallback memória) e API REST
- ✅ Sistema de toasts + animações (fade/drawer/pop) + `prefers-reduced-motion`
- ✅ **Camada de movimento** (`globals.css`): curva única de entrada, cascata de listas por `--d`, troca de tela (`template.tsx`), esqueletos (`loading.tsx`) e feedback de toque (`.tap`) — só `transform`/`opacity`
- ✅ **Shell que cabe no celular**: a lateral fixa de 256px virava 86px de conteúdo em 390px — agora é barra de topo + gaveta abaixo de `md` (provisório até existir desenho de mobile)
- ✅ **Store de arquivo compartilhado** (`lib/store/json-file.ts`) com revalidação por mtime — `next start` roda vários workers, e sem isso a tela renderizada por um worker não via o que o outro acabou de gravar

## Fase 1 — Aprovação de conteúdo (prioridade absoluta)
- ✅ Lote (visão agência) **redesenhado** conforme o export "Clínica Aurora · Lote": título + ações redondas (filtro por formato, busca, menu do link, "Copiar link"), chips `Todas · 12`, grade de peças 190px e painel de detalhe encostado na borda direita (meta, histórico, "Aprovar peça" / "Marcar como refeita" / "Abrir no editor") (`/social/[id]`)
- ✅ **Aprovação pela agência** (`POST /api/batches/[id]/pieces/[pieceId]/approve`) — registra "Aprovada pela agência" no histórico, separada da decisão do cliente pelo link público
- ✅ Lista de lotes (`/social`) com progresso
- ✅ **Link público por swipe** (`/a/[token]`): arrastar p/ aprovar, reprovar com motivo, progresso, tela final
- ✅ **Swipe sem card voltando ao centro** (issue #17): cada peça é um nó novo (`key`), então a seguinte entra já no lugar em vez de deslizar da borda; o retorno ao centro quando o arrasto não passa do limite continua igual
- ✅ Peças mostram a **arte real** quando existe (`PieceThumb` serve os dois estados: com e sem mídia)
- ✅ **Upload real de mídia** (PNG/JPG/WebP/GIF/MP4/MOV, até 50 MB): "Subir artes" cria uma peça por arquivo, com nome, tamanho lido do cabeçalho e formato deduzido; trocar/remover pelo preview; `/api/media/<id>` serve a arte para o link público
- ⬜ Derivadas leves da mídia (WebP/poster de vídeo) — hoje o arquivo é servido como veio
- ⬜ Comentário por **áudio** + transcrição (Whisper) — spec
- ✅ Registro de decisão com **IP + versão exata** apresentada (`snapshot` no `DecisionEvent`, captura IP via `x-forwarded-for`)
- ✅ Token expirável/revogável + geração de link por lote (menu de ações no `/social/[id]`, expira em 30 dias ao regenerar, tela pública mostra estado "link inativo")
- 🟡 **Envio do link**: WhatsApp, e-mail e "copiar mensagem" saem do menu do lote com o texto pronto e a URL do ambiente atual — falta o disparo automático pelo servidor e os lembretes
- ✅ **Editor de lote** (`/social/[id]/editor`): peças + detalhes (data, formato, canal, legenda com contador, hashtags) + preview do post, autosave de rascunho, "Adicionar peça" e "Enviar para aprovação"
- ✅ **Abertura do link público** (`/a/[token]`): hero com carrossel das peças, resumo do lote e CTA para o swipe
- 🎨 Tela pública: estados de **carrossel/vídeo** e visual de "mockup de feed Instagram" — falta desenho (o preview do editor já é uma primeira versão)

## Fase 2 — Operação / Tarefas
- ✅ Lista + Quadro (Kanban) sobre os mesmos dados, CRUD, busca, tabs de status, drag-and-drop, updates otimistas
- ✅ **Quadro fiel ao export "2. Board · Kanban"**: colunas de largura igual, cards sem fundo (só borda), contador da coluna e alternador Lista/Quadro no header do quadro
- ✅ Botão de busca das Tarefas: redondo e fixo — o campo abre em overlay ancorado à direita em vez de empurrar a linha
- ✅ **Menu de filtros** (`FilterMenu`, atalho `F`) e **menu de visualização** (`DisplayMenu`) nos dois botões do header — o seletor Lista/Grade agora vive dentro do menu de visualização, junto com agrupamento, sub-agrupamento, ordenação, arquivadas, tarefas por grupo, grupos vazios e propriedades visíveis (`src/lib/tasks/view.ts`)
- ✅ **Quadro: "Adicionar tarefa" só no hover da coluna** (ou no foco pelo teclado), como no comportamento original
- ✅ **Campos ricos da tarefa**: descrição, prioridade, etiquetas, criador (vem da sessão) e prazo interno — com colunas, agrupamento e ordenação por prioridade/prazo
- ✅ **Filtros de Prioridade, Etiquetas e Criador filtram de verdade**; o menu de Datas ganhou a seção de prazo (atrasadas, vencem hoje, próximos 7 dias, sem prazo)
- 🟡 Filtros que dependem de recursos inexistentes (Agente, Sessão do agente, Relações…) seguem no desenho, avisando em vez de filtrar
- ⬜ Campos da peça que faltam: tipo, objetivo, pilar, resp. arte/texto, data de publicação, arquivo, versão
- ⬜ **Calendário editorial** (lê `publishDate` do mesmo `repository`)
- ⬜ **Carga do time**
- ⬜ Briefings por tipo de peça (chegam preenchidos ao designer)
- ⬜ Biblioteca de marca · Banco de ideias · Pauta recorrente a partir do contrato
- 🎨 Telas de Calendário, Carga do time, Briefing — falta desenho

## Fase 3 — Retenção / CRM
- ⬜ Ficha do cliente (contatos, acessos, drive, identidade, contrato, valor, vencimento, renovação)
- ⬜ Controle **Contratado × Entregue × Saldo** (alertas de saldo negativo)
- ⬜ **Health Score** 0–100 (velocidade de aprovação, taxa de reprovação, aderência, adimplência; pesos configuráveis)
- ⬜ Timeline completa da conta
- ⬜ Relatório mensal em PDF
- 🎨 Telas de CRM (`/clientes`), Health Score, Timeline — falta desenho

## Transversal / Plataforma
- ✅ **Auth real** (e-mail/senha p/ agência + token p/ cliente): scrypt, cookie httpOnly assinado por HMAC, `proxy.ts` protegendo o shell, login/cadastro/recuperação, sair e troca de senha
- 🟡 Recuperação de senha registra o pedido, mas **não envia e-mail** (falta provedor)
- ✅ **Trocar a senha derruba as sessões dos outros aparelhos** (versão da senha dentro do token, sem precisar de lista de sessões)
- ✅ **Multi-tenant**: agência virou entidade com id (`lib/agency`), tarefa e lote carregam `agencyId`, e todo `repository` exige o escopo da sessão como primeiro argumento — não dá para listar nem alterar sem dizer de qual agência, e dado de outra agência responde 404. Link público do cliente segue sem sessão, restrito ao lote do token. Falta o reforço no banco (**RLS**), que entra junto com o Postgres
- 🟡 Cliente ainda é texto livre na tarefa e no lote (vira entidade com id quando a tela de Clientes for desenhada — 🎨)
- ⬜ Trocar `store.ts` por banco (Neon Postgres via `vercel:marketplace`) antes de produção
- ⬜ Papéis/permissões (Coordenação, Social media, Designer, Cliente) — o papel é gravado, mas ainda não muda o que a pessoa pode fazer
- ✅ **Configurações**: perfil, troca de senha e sessão
- ⬜ Inbox, Equipe (hoje placeholders)
- ✅ **Testes automatizados** (`tests/`, runner do próprio Node, 153 casos das funções puras, incluindo o isolamento entre agências) **+ CI** (`.github/workflows/ci.yml`: tipos, testes e build a cada push e pull request)

## Fora do MVP (não construir sem pedido)
Agendamento/publicação automática · métricas de redes · financeiro · NF/boleto · timesheet · CRM de prospecção.

---

## Rotina do Claude (como trabalhar a cada sessão)

Quem decide o quê e como o trabalho passa entre Felipe e Claude está em `FLUXO.md` — leia antes de começar. Resumo do que vale para toda sessão:

1. **Contexto primeiro.** Ler `FLUXO.md`, este `ROADMAP.md` e as memórias do projeto (começar por `ragick-black-berry-redesign`).
2. **Design é lei, e é sempre do Felipe.** A fonte de verdade são os `*-export.html` (pen.dev) na raiz. Construir fiel ao design. Tela sem desenho fica como **placeholder fácil de trocar** — nunca inventar tela final por conta própria; marcar 🎨 aqui.
3. **Arquitetura estável.** Novas views são *leitoras* de `repository`/`constants`. Nunca duplicar dados por tela. Pipeline de status só em `constants.ts`.
4. **Interações + feedback.** Toda ação relevante dá feedback (toast, estado otimista, animação sutil). Respeitar `prefers-reduced-motion`.
5. **Validar sempre.** `npm run typecheck` + `npm test` + `npm run build` verdes; app rodando de verdade (não só compilando) nas rotas tocadas, desktop e celular.
6. **Deploy + versionamento.** Commits pequenos e descritivos; branch própria + PR (ver `FLUXO.md` para quando o merge é do Felipe).
7. **Fechar o loop.** Atualizar este roadmap; relatar o que foi feito, o que ficou pendente e o que precisa de decisão/desenho.

### Próximos passos sugeridos (ordem)
1. **Banco no lugar do JSON** (Neon Postgres) + bucket para as artes — o `json-file.ts` foi feito para sair inteiro; o filtro por agência, que hoje vive no `repository`, vira `WHERE agency_id` e ganha **RLS** por cima.
2. **Calendário editorial** lendo a data de publicação que o editor já grava, e a carga do time a partir do responsável.
3. **Envio automático do link** (WhatsApp/e-mail pelo servidor) + lembretes.
4. Começar CRM/Health Score (Fase 3).

### Dívidas conhecidas
- `AUTH_SECRET` não está definido na Vercel. O código já não aceita mais rodar assim: em produção sem o segredo o servidor recusa subir (`src/instrumentation.ts`) e assinar/conferir cookie lança (`src/lib/auth/token.ts`) — não existe mais o silêncio de cair no segredo de desenvolvimento. Falta o Felipe definir a variável no painel (`openssl rand -base64 32` → Settings → Environment Variables); até lá, a instância em produção não sobe.
- As telas de lote e editor ainda não foram adaptadas ao celular (o shell já foi).
- O `json-file.ts` relê pelo mtime, mas dois processos ainda podem se sobrepor num leitura-altera-grava simultâneo: é o preço de arquivo como banco, e some com o Postgres.
- As artes são servidas como foram enviadas, sem derivadas leves.
- Com o isolamento por agência, uma agência recém-cadastrada abre o `/social` vazio — e não tem como sair de lá: **criar lote** ainda não existe (os dois lotes vêm da semente, e são da agência semeada). Falta a tela 🎨.
- Não existe **convite de equipe**: cada cadastro abre uma agência nova, então duas pessoas da mesma agência ainda não compartilham o mesmo tenant.
