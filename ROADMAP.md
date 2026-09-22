# Roadmap — black berry

Documento vivo. Marca o que já existe, o que falta **desenhar** (você) e o que falta **construir** (Claude), até o fim do projeto. Última atualização: **22 set 2026** (`npm run lint` de volta; duas dívidas desatualizadas removidas — o lote já cabe no celular e a lista de Tarefas não mostra mais prévia de descrição).

Legenda: ✅ pronto · 🟡 parcial/placeholder · ⬜ não começado · 🎨 precisa de tela sua antes de eu construir

---

## Fundação
- ✅ Projeto Next.js 16 + React 19 + Tailwind v4 + TS do zero
- ✅ Tokens do design **black berry** (`globals.css @theme`) + primitivos (`Button`, `Input`, `StatusPill`, `Avatar`, `Breadcrumb`, `Toast`)
- ✅ **Design system v2 (gradiente)**: tokens anotados com os nomes `bb-*` do export, `--color-dim` (#616161), `--radius-panel`/`--radius-menu`, sidebar com `bg-sidebar-gradient` e corpo da lista transparente
- ✅ **Polimento do design system** (issue #14): hex e raios crus saíram do JSX para o `@theme` (`--color-danger`, `--color-badge`/`--color-badge-strong`, `--radius-thumb`, `--spacing-control`, cinzas de status), o "⋯" ganhou o alvo de toque de 40px sem mexer na altura das linhas, os menus de ação voltaram à forma do export (10px/6px) com `aria-haspopup`/`aria-expanded` e navegação por setas, e o texto de apoio em conteúdo real subiu de `faint` (2,5:1) para `muted` (5,3:1)
- ✅ **Contorno que fecha em todo canto arredondado** (issue #24): o par `outline` + `-outline-offset-[0.5px]` quebrava o traço num trecho da curva (meio pixel de tela). Pílulas, chips e botões passaram a `inset-ring-1` (box-shadow, mesmo recorte da caixa, sem mexer no layout), o ponto de status do quadro virou `inset` e o item ativo da lateral voltou ao export — o marcador de 3px em `left-0` era comido pela pílula de raio 24px e aparecia como lasca
- ✅ **Design system v3** (telas redesenhadas): painel de conteúdo de 28px sobre o preto, abas em pílula, barra de ferramentas (Filtros · busca · Personalizar), lista de 44px por linha com caixa de seleção e barra flutuante de ações, card de 14px comum ao Quadro e à Grade, selo de status e as duas marcas redondas. Mora em `src/components/ui/{Screen,Tabs,Toolbar,DataTable,SelectionBar,EntityCard,Badge,Mark,Popover}.tsx`; os tokens novos (incluindo a escala de cor da saúde do cliente) estão no `@theme` de `globals.css`. Aplicado em Tarefas (Lista e Quadro), Descrição da tarefa, Clientes (Lista e Grade) e no shell
- ✅ Shell autenticado (sidebar completa) + rotas placeholder
- ✅ **Lateral no v3**: fundo preto, "Ações rápidas" com o atalho `/`, caixas de entrada (Notificações, Inbox, Conversas) e as seções Trabalho (Tarefas, Social media, Clientes, Relatórios) e Equipe (Membros, Configurações). Os destinos ainda sem tela entraram como placeholder — nunca como tela inventada
- ✅ Camada de dados com `repository`/`store` (JSON + fallback memória) e API REST
- ✅ Sistema de toasts + animações (fade/drawer/pop) + `prefers-reduced-motion`
- ✅ **Camada de movimento** (`globals.css`): curva única de entrada, cascata de listas por `--d`, troca de tela (`template.tsx`), esqueletos (`loading.tsx`) e feedback de toque (`.tap`) — só `transform`/`opacity`
- ✅ **Shell que cabe no celular**: a lateral fixa de 256px virava 86px de conteúdo em 390px — agora é barra de topo + gaveta abaixo de `md` (provisório até existir desenho de mobile)
- ✅ **Store de arquivo compartilhado** (`lib/store/json-file.ts`) com revalidação por mtime — `next start` roda vários workers, e sem isso a tela renderizada por um worker não via o que o outro acabou de gravar

## Fase 1 — Aprovação de conteúdo (prioridade absoluta)
- ✅ **Fluxo cliente › lote › peças** (issues #26 e #27): `/social` virou a escolha do cliente (export "Clínica Aurora - Clientes"), `/social/[cliente]` traz os lotes daquele cliente (export "Lotes de Aprovação") e a tela de peças desceu para `/social/[cliente]/[lote]`. Endereço antigo (`/social/<id>` e `/social/<id>/editor`) redireciona para o novo
- ✅ **Criar lote** (issue #27, export "ADD7"): modal com título, período e descrição — o cliente vem da tela anterior, o lote nasce rascunho com link próprio e cai direto no editor. Era a dívida que deixava uma agência recém-cadastrada sem saída no `/social`
- ✅ Lote (visão agência) **no desenho minimalista** (issue #25, export "Clínica Aurora - Lote"): topo só com a trilha e o link público (URL + copiar), chips `Todas 8 · Ajuste 2 · Aprovado 3 · Pendente 3`, grade de peças de 130px com selo de status na arte e painel de detalhe na borda direita (meta, histórico, "Aprovar peça" / "Marcar como refeita" / "Abrir no editor"). As ações do link (WhatsApp, e-mail, copiar mensagem, gerar/desativar) passaram para o menu do editor, e filtro por formato e busca de peça saíram da tela
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
- ✅ **Editor de lote reconstruído** (issue #2, export "Clínica Aurora - Montagem de lote Criativos"): substituiu o editor anterior (peças/legenda/hashtags/preview lado a lado) por um composer de um criativo por vez — nome, formato, carrossel de artes e legenda (atalhos de #/@) — com a lista "Criativos do lote" ao lado. Mora em `/social/[cliente]/[lote]/editor`, no fim da jornada Social media › cliente › "+" (`NewBatchModal`: título/período/descrição) › editor. `Piece.media` virou `MediaAsset[]`: uma peça pode ter várias artes (carrossel de verdade), reaproveitado por toda a aprovação (badge "1/N" no `PieceThumb`) — falta só o visualizador de carrossel no link público do cliente (issue #8)
- ✅ **Abertura do link público** (`/a/[token]`): hero com carrossel das peças, resumo do lote e CTA para o swipe
- 🎨 Tela pública: estados de **carrossel/vídeo** e visual de "mockup de feed Instagram" — falta desenho (o preview do editor já é uma primeira versão)

## Fase 2 — Operação / Tarefas
- ✅ Lista + Quadro (Kanban) sobre os mesmos dados, CRUD, busca, tabs de status, drag-and-drop, updates otimistas
- ✅ **Lista e Quadro no design system v3** (exports "Tarefas · Painel (Lista)" e "(Quadro)"): a lista virou tabela de 44px por linha com marca, cliente na segunda linha, selo de status, responsável com avatar e prazo; o quadro ganhou o card de 14px com selo, régua e rodapé. O contador da coluna, as colunas de largura igual e o alternador Lista/Quadro do v2 continuam
- ✅ Busca das Tarefas: no v3 ela mora na barra de ferramentas do corpo, ao lado de "Filtros" (o botão redondo em overlay era a forma do v2)
- ✅ **Menu de filtros** (`FilterMenu`, atalho `F`) e **menu "Personalizar"** (`DisplayMenu`), agora nos dois gatilhos da barra de ferramentas — o seletor Lista/Quadro vive dentro do "Personalizar", junto com agrupamento, sub-agrupamento, ordenação, arquivadas, tarefas por grupo, grupos vazios e propriedades visíveis (`src/lib/tasks/view.ts`)
- ✅ **Quadro: "Adicionar tarefa" só no hover da coluna** (ou no foco pelo teclado), como no comportamento original
- ✅ **Campos ricos da tarefa**: descrição, prioridade, etiquetas, criador (vem da sessão) e prazo interno — com colunas, agrupamento e ordenação por prioridade/prazo
- ✅ **Filtros de Prioridade, Etiquetas e Criador filtram de verdade**; o menu de Datas ganhou a seção de prazo (atrasadas, vencem hoje, próximos 7 dias, sem prazo)
- ✅ **Descrição da tarefa** (`/tarefas/[id]`, export "Tarefas · Descrição da tarefa"): a tela que o clique numa tarefa e a criação de uma tarefa nova abrem. Editor e visualizador ao mesmo tempo — título, cliente, descrição e todas as propriedades se alteram no lugar, com salvamento otimista e sem botão "Salvar". A coluna direita (PROPRIEDADES, 340px) tem rolagem própria e fica parada enquanto o conteúdo rola; no celular as duas viram uma coluna
- ✅ **Conversa da tarefa**: `Task.comments` + `POST /api/tasks/<id>/comments`, autor vindo da sessão. É a seção ATIVIDADE do export, junto com o registro de criação
- ✅ **Seleção em massa na Lista**: caixa por linha, "marcar todas" no cabeçalho e a barra flutuante do export (contagem, Exportar, Arquivar, Excluir, Mais). Excluir funciona com desfazer; Exportar e Arquivar avisam que ainda não existem, em vez de fingir
- ✅ **Escrita do briefing** (exports "menu_comando_tarefas", "menu_formatacao", "formatacao_hover"): hint "/ para formatação" na linha vazia, menu de comandos no `/`, menções no `@`, menu de formatação na seleção com a lista de níveis no hover, atalhos de teclado, e a descrição mostrada formatada fora da edição. O texto segue sendo `string` com marcas markdown (ver README, "O texto do briefing é markdown")
- ✅ **Colunas redimensionáveis em todas as listas** (`lib/ui/columns.ts` + `ui/DataTable`): arrastar a divisória, duplo clique para voltar à medida do export, setas pelo teclado, largura guardada no navegador
- 🟡 Filtros que dependem de recursos inexistentes (Agente, Sessão do agente, Relações…) seguem no desenho, avisando em vez de filtrar
- ⬜ Campos da peça que faltam: tipo, objetivo, pilar, resp. arte/texto, data de publicação, arquivo, versão
- ⬜ **Calendário editorial** (visão de mês/semana das publicações): o export da issue #2 virou o novo Editor de lote (ver Fase 1) — as decisões da issue sobre mês/semana, arrastar para reagendar etc. seguem sem resposta
- ⬜ **Carga do time**
- ⬜ Briefings por tipo de peça (chegam preenchidos ao designer)
- ⬜ Biblioteca de marca · Banco de ideias · Pauta recorrente a partir do contrato
- 🎨 Telas de Calendário (mês/semana), Carga do time e Briefing — falta desenho

## Fase 3 — Retenção / CRM
- ✅ **Tela de Clientes** (`/clientes`, exports "Clientes · Painel (Lista)" e "(Grade)"): a carteira da agência como entidade de verdade (`src/lib/clients/*`) — nome, segmento, serviços, responsável, dia do faturamento e a régua de saúde (Ativo · Renovação · Em risco · Pausado · Novo · VIP). Lista e Grade sobre os mesmos dados, abas por saúde, filtros (status, segmento, responsável, serviço), busca, seleção em massa e criação/edição pelo modal — o mesmo padrão de criação da tarefa
- 🟡 Ficha do cliente (contatos, acessos, drive, identidade, contrato, valor, vencimento, renovação): a entidade existe e a lista é a porta de entrada; a **ficha completa** (`/clientes/[id]`) ainda não tem desenho
- ✅ **Cartão de hover do cliente** (export "hover clientes"): passar o ponteiro sobre o nome na lista mostra status, empresa, cidade, e-mail e telefone. Cidade, e-mail e telefone entraram no modelo (e no modal de cliente) porque é o que o desenho mostra — são contato, não briefing
- ✅ **Menu de visualização de Clientes** (export "Menu de Visualização"): agrupamento (status, segmento, responsável), ordenação, Lista/Grade, mostrar arquivados, mostrar grupos vazios e os chips de colunas
- 🎨 **Briefing do cliente** — tela própria, ainda por desenhar. A arquitetura está pronta para recebê-la (o cliente já é entidade com id, e a rota cabe em `/clientes/[id]/briefing`); de propósito **não** existe nenhum campo de briefing no modelo, para não haver campo fictício a migrar depois
- ⬜ Controle **Contratado × Entregue × Saldo** (alertas de saldo negativo)
- ⬜ **Health Score** 0–100 (velocidade de aprovação, taxa de reprovação, aderência, adimplência; pesos configuráveis)
- ⬜ Timeline completa da conta
- ⬜ Relatório mensal em PDF
- 🎨 Telas de ficha do cliente (`/clientes/[id]`), briefing, Health Score e Timeline — falta desenho

## Transversal / Plataforma
- ✅ **Auth real** (e-mail/senha p/ agência + token p/ cliente): scrypt, cookie httpOnly assinado por HMAC, `proxy.ts` protegendo o shell, login/cadastro/recuperação, sair e troca de senha
- 🟡 Recuperação de senha registra o pedido, mas **não envia e-mail** (falta provedor)
- ✅ **Trocar a senha derruba as sessões dos outros aparelhos** (versão da senha dentro do token, sem precisar de lista de sessões)
- ✅ **Multi-tenant**: agência virou entidade com id (`lib/agency`), tarefa e lote carregam `agencyId`, e todo `repository` exige o escopo da sessão como primeiro argumento — não dá para listar nem alterar sem dizer de qual agência, e dado de outra agência responde 404. Link público do cliente segue sem sessão, restrito ao lote do token. Falta o reforço no banco (**RLS**), que entra junto com o Postgres
- 🟡 Cliente ainda é texto livre na tarefa e no lote — **e agora existe em paralelo a entidade `lib/clients`**. O fluxo de aprovação já o trata como coisa (`lib/approval/clients.ts` agrupa os lotes por slug do nome e é o que alimenta `/social`), e `/clientes` já guarda id, segmento, serviços, responsável e faturamento. O que falta é **ligar as duas pontas**: tarefa e lote passarem a apontar para `Client.id` em vez do nome digitado. Até lá, renomear o cliente num lote o separa dos outros, e a carteira de `/clientes` não sabe dos lotes
- ✅ **Persistência em banco** (issue #11): `src/lib/store/index.ts` escolhe Postgres (Neon, `vercel:marketplace`) quando `DATABASE_URL` existe, arquivo JSON senão — os quatro stores (tarefas, lotes, contas, mídia) e o `transaction` (agora com `SELECT ... FOR UPDATE`, sem depender de mtime) ganharam o backend sem mexer em `repository.ts`, view ou rota. Artes: Vercel Blob com `BLOB_READ_WRITE_TOKEN`, disco/memória sem. Falta Felipe criar o banco e o Blob store na Vercel e definir as duas variáveis — sem elas a instância de produção segue em modo memória (dado some no próximo boot, mesmo risco de antes)
- 🟡 Filtro por agência ainda é feito em JS sobre o blob inteiro (`repository.ts`), não `WHERE agency_id`; **RLS de verdade só entra com tabela por área**, que é um passo à parte (schema relacional, não o `jsonb` de transição de agora)
- ⬜ Papéis/permissões (Coordenação, Social media, Designer, Cliente) — o papel é gravado, mas ainda não muda o que a pessoa pode fazer
- ✅ **Configurações**: perfil, troca de senha e sessão
- ⬜ Inbox, Notificações, Conversas, Relatórios, Membros (hoje placeholders — todos aparecem na lateral do v3)
- ✅ **Testes automatizados** (`tests/`, runner do próprio Node, 280 casos das funções puras, incluindo o isolamento entre agências e a régua de clientes) **+ CI** (`.github/workflows/ci.yml`: tipos, testes e build a cada push e pull request)
- ✅ **`npm run lint` volta a funcionar**: o Next 16 removeu o `next lint`; entrou ESLint direto (`eslint.config.mjs`, flat config) com `eslint-config-next/core-web-vitals` + `/typescript`. Duas regras novas do plugin de React Compiler (`react-hooks/set-state-in-effect`, `react-hooks/refs`) ficaram desligadas — pegam padrões usados de propósito em várias telas (sincronizar estado com uma prop que muda, ler `ref.current` para medir menu/toolbar); satisfazê-las seria reescrever esses componentes, não corrigir lint. Ainda fora do CI, que continua só com tipos/testes/build.

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
1. **Felipe cria o Neon Postgres e o Vercel Blob store** (Vercel → Storage) e define `DATABASE_URL`/`BLOB_READ_WRITE_TOKEN` — o código dos dois já está pronto (issue #11); sem as variáveis a produção continua em modo memória.
2. **Schema relacional + RLS**: hoje cada área é um `jsonb` inteiro por linha (drop-in seguro, zero mudança de view/rota); virar tabela de verdade por área (`WHERE agency_id`, política de RLS) é o passo que fecha a dívida de multi-tenant no banco.
3. **Ligar tarefa e lote ao `Client.id`** — hoje os três guardam o cliente de formas diferentes (texto livre na tarefa e no lote, entidade em `/clientes`). É o que destrava Health Score, timeline da conta e o filtro por cliente de verdade.
4. **Calendário editorial** lendo a data de publicação que o editor já grava, e a carga do time a partir do responsável.
5. **Envio automático do link** (WhatsApp/e-mail pelo servidor) + lembretes — depende da decisão de provedor (issue #13) e da ficha do cliente (#3, 🎨) para ter contato de verdade.
6. Continuar o CRM/Health Score (Fase 3) sobre a entidade de cliente que acabou de nascer.

### Dívidas conhecidas
- `AUTH_SECRET` não está definido na Vercel. O código já não aceita mais rodar assim: em produção sem o segredo o servidor recusa subir (`src/instrumentation.ts`) e assinar/conferir cookie lança (`src/lib/auth/token.ts`) — não existe mais o silêncio de cair no segredo de desenvolvimento. Falta o Felipe definir a variável no painel (`openssl rand -base64 32` → Settings → Environment Variables); até lá, a instância em produção não sobe.
- O `json-file.ts` relê pelo mtime, mas dois processos ainda podem se sobrepor num leitura-altera-grava simultâneo: é o preço de arquivo como banco. **Some com o Postgres** (`postgres.ts`, lock de linha) assim que `DATABASE_URL` estiver definida — até lá, produção sem a variável segue no arquivo/memória de sempre.
- As artes são servidas como foram enviadas, sem derivadas leves.
- **As telas de aprovação seguem no design system v2.** O redesenho chegou só para Tarefas, Descrição da tarefa e Clientes; Social media, Lote, Editor de lote e o link público continuam com a linguagem antiga até virem os exports v3 delas.
- **Contraste dos selos de status da tarefa.** O export v3 desenha "Concluído" (#565656), "Pausado" (#5a5a5a) e "Cancelado" (#404040) sobre o fundo #1f1f1f do selo — entre 1,3:1 e 1,7:1, bem abaixo dos 4,5:1. Está implementado exatamente como desenhado; se a leitura incomodar, é uma decisão de design do Felipe (clarear o texto ou escurecer o fundo), não minha.
- **O menu de visualização de Clientes tem três leituras minhas, e o Felipe decide se ficam.** (1) A seção "Filtros" do desenho tem o rótulo "Agrupamento" com uma pílula escrita "Status", e "Agrupamento" já existe na seção Organização logo abaixo — implementei como atalho de filtro por status (rótulo "Status", pílula "Todos"), porque é a leitura que não deixa duas linhas iguais fazendo coisas diferentes. (2) "Mostrar arquivados" esconde os **pausados**: cliente não tem estado de arquivo, e Pausado é o degrau que faz esse papel — a chave nasce ligada, para a lista não começar escondendo cliente. (3) Dos chips de coluna apagados do desenho (Vencimento, Renovação, Risco, Tags, Criado em, Atualizado em) só "Criado em" existe: os outros não têm campo no modelo, e chip que não liga nada é pior que chip que não existe
- Não existe **convite de equipe**: cada cadastro abre uma agência nova, então duas pessoas da mesma agência ainda não compartilham o mesmo tenant.
