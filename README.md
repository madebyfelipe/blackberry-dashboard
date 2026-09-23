# black berry

SaaS de gestão e **aprovação de conteúdo** para agências de social media. Cobrança por cliente atendido (teto R$100/cliente/mês). Público inicial: agências pequenas (3–12 pessoas, 8–30 clientes).

Três áreas: **aprovação de conteúdo** (diferencial), **gestão operacional de tarefas** e **CRM pós-venda + saúde da carteira**.

## Stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript**
- **Tailwind CSS v4** (tokens do design em `src/app/globals.css` via `@theme`)
- Persistência: **Postgres** (Neon, via marketplace da Vercel) quando `DATABASE_URL` está definida; sem a variável — dev local e todo teste — cai no **arquivo JSON** com fallback em memória (`src/lib/store/{index,json-file,postgres}.ts`). Artes seguem a mesma lógica com `BLOB_READ_WRITE_TOKEN` (Vercel Blob) — ver "Arquitetura de dados".
- Auth própria: senha com **scrypt** (`node:crypto`) e sessão em cookie httpOnly assinada com **HMAC-SHA256** (Web Crypto). Sem dependência externa.
- Ícones: lucide, reproduzidos como stroke/`currentColor` em `src/components/icons.tsx`.

## Rodando localmente

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # build de produção
npm run typecheck
npm test           # testes das funções puras (node --test, sem build)
npm run test:watch # o mesmo, refazendo a cada salvamento
```

### Testes

Os testes ficam em `tests/` e rodam no runner do próprio Node — nada de
framework, transpilador ou build: o Node 22 lê TypeScript direto. O que ele não
faz sozinho é entender o atalho `@/…` do tsconfig e os imports sem extensão do
código-fonte; `tests/helpers/ts-resolve.mjs` cuida disso, então os testes
importam os módulos exatamente como o app os importa.

Cobrem as funções puras que sustentam o produto: sessão e senha, filtros e
ordenações das tarefas e dos clientes, normalização e validação nos
repositórios (incluindo a conversa da tarefa), leitura de dimensões de imagem,
régua de formatos das peças, a revalidação do store de arquivo e a régua do
Inbox (título, prévia, não lidas, agrupamento por dia, carimbos de hora e o
registro da chamada, mais o isolamento por agência *e* por participante). O que
depende de requisição (route handlers, `next/headers`) fica de fora — esse
caminho é conferido subindo o app.

O mesmo trio roda no CI (`.github/workflows/ci.yml`) a cada push e pull
request: `npm run typecheck`, `npm test` e `npm run build`.

### Entrar

O seed cria uma conta de demonstração na primeira execução:

| E-mail | Senha |
| --- | --- |
| `felipe@blackberry.app` | `blackberry` (ou `DEMO_PASSWORD`) |

Dá para criar outra conta em `/criar-conta` — o cadastro já entra logado.

### Variáveis de ambiente

| Variável | Para quê |
| --- | --- |
| `AUTH_SECRET` | Chave que assina o cookie de sessão. **Obrigatória em produção** (mín. 16 caracteres): sem ela o servidor recusa subir e qualquer assinatura/conferência de cookie lança. Gere com `openssl rand -base64 32` e defina em Vercel → Settings → Environment Variables. Fora de produção o app cai num segredo de desenvolvimento, que não protege nada e invalida as sessões a cada deploy. |
| `DEMO_PASSWORD` | Senha da conta semeada, para instalações compartilhadas. |
| `DATABASE_URL` | String de conexão do Postgres (Neon, criado pelo marketplace da Vercel — Storage → Marketplace Database Providers → Neon). Presente, os cinco stores (tarefas, clientes, lotes, contas, índice de mídia — e o Inbox) passam a gravar lá. Ausente, o app usa arquivo JSON local (dev) — nunca em produção sem disco gravável. |
| `BLOB_READ_WRITE_TOKEN` | Token do Vercel Blob (Storage → Create Database → Blob), injetado automaticamente ao conectar o projeto. Presente, a arte vai do navegador **direto** para o Blob (sem passar pela função, ver "O teto de 4,5 MB") e sobrevive a redeploy. Ausente, o editor volta ao upload multipart e os bytes ficam em `data/uploads/`, com fallback em memória em disco somente-leitura. **O store precisa ser criado com acesso "Private"** — ver "Store privado" abaixo; a Vercel não deixa trocar o modo de acesso depois de criado. |

## Rotas principais

| Rota | O que é |
| --- | --- |
| `/login` · `/criar-conta` · `/recuperar-senha` | Entrada (black berry) — login e cadastro reais; a recuperação registra o pedido, o disparo de e-mail ainda não existe |
| `/tarefas` | Tarefas — Lista + Quadro (Kanban), CRUD, seleção em massa, drag-and-drop, busca, menu de filtros (`F`) e menu "Personalizar" |
| `/tarefas/[id]` | **Descrição da tarefa** — visualizador e editor na mesma tela: título, descrição, propriedades (coluna fixa à direita) e a conversa da tarefa |
| `/clientes` | **Clientes** — a carteira da agência: Lista + Grade, abas por saúde do cliente, filtros, busca, seleção em massa, criação/edição pelo modal, menu de visualização (agrupamento, ordenação, colunas) e o cartão de hover do nome |
| `/social` | **Social media › clientes** — passo 1 do fluxo de aprovação: de quem são os lotes (lotes, peças e pendentes de cada um). Lê o nome do cliente gravado no lote, não a ficha de `/clientes` — ver "Cliente ainda é texto livre" no roadmap |
| `/social/[cliente]` | **Lotes do cliente** — passo 2: progresso de cada lote e o modal "Novo lote" |
| `/social/[cliente]/[lote]` | Detalhe do lote — grade de peças + painel de decisão + link público |
| `/social/[cliente]/[lote]/editor` | **Editor de lote** — peças, detalhes da peça (data, formato, canal, legenda, hashtags), preview do post e as ações do link (enviar, gerar, desativar) |
| `/a/[token]` | **Aprovação pública** (cliente, sem login): tela de início + swipe para aprovar/pedir ajuste |
| `/configuracoes` | Conta: perfil (com o seu @), troca de senha e sessão |
| `/configuracoes/fluxos` | **Fluxos e Processos** — a esteira de trabalho: etapas, quem toca cada uma, prazo, próxima etapa, aprovadores e automações |
| `/inbox` | **Inbox** — a conversa do time: grupos e diretas, histórico salvo e pesquisável, presença (disponível · ocupado · ausente · offline) e a chamada com registro no histórico |
| `/equipe` | **Usuários** (export "Usuários · Painel (Lista)") — o time: função, status, último acesso; "Adicionar usuário" cria convite com link de cadastro que entra **nesta** agência |
| `/notificacoes`, `/conversas`, `/relatorios` | Placeholders prontos para desenhar (Relatórios saiu da lateral — o lugar é de Fluxos e Processos) |

## Design

Tudo segue os exports do pen.dev na raiz do repo (`*-export.html`) — a fonte de
verdade do visual **black berry**. Ao divergir do design, confirmar antes.
Tokens e componentes-base ficam em `src/components/ui`.

### Duas camadas de design system

O vocabulário está empilhado, e **a camada de cima manda** onde as duas
discordarem:

| Camada | Exports | Onde está aplicada |
| --- | --- | --- |
| **v3** (atual) | `Tarefas · Painel (Lista)`, `Tarefas · Painel (Quadro)`, `Tarefas · Descrição da tarefa`, `Clientes · Painel (Lista)`, `Clientes · Painel (Grade)`, `Inbox` | Shell (lateral), Tarefas, Descrição da tarefa, Clientes, Inbox |
| **v2** (gradiente) | `2. Gradiente`, `Clínica Aurora - *`, `Lotes de Aprovação*`, `Filtros · Menu` | Só o link público do cliente (`/a/<token>`). Social media, Lote, Editor, Planejamento e Configurações passaram para o painel v3 (2026-09-23) — o conteúdo dos exports v2 continua, dentro do vocabulário v3 |

Os exports `List View` e `2. Board · Kanban` são a versão v2 das Tarefas, hoje
substituída pelos dois `Tarefas · Painel (…)`; ficam no repo como histórico.
As telas de aprovação da agência usam o painel, as abas, a barra e o card do
v3 desde 2026-09-23; o link público do cliente segue o desenho mobile próprio.

**O que o v3 traz.** Painel de conteúdo de 28px de raio sobre o fundo preto
(`ui/Screen`), abas em pílula (`ui/Tabs`), barra de ferramentas com
Filtros/busca/Personalizar (`ui/Toolbar`), lista de 44px por linha com caixa de
seleção e barra flutuante de ações (`ui/DataTable`, `ui/SelectionBar`), card de
14px comum ao Quadro e à Grade (`ui/EntityCard`), selo de status (`ui/Badge`) e
as duas marcas redondas (`ui/Mark`). Tela nova se monta com esses componentes —
não se cria um segundo conjunto ao lado.

O vocabulário inteiro — cor, raio e o alvo de toque dos botões redondos — mora
no `@theme` de `src/app/globals.css`, e o Tailwind v4 o transforma em classe
(`--color-danger` → `text-danger`, `--radius-menu` → `rounded-menu`,
`--spacing-control` → `h-control`). Fora dali não entra hex nem `rounded-[Npx]`
de cor/forma de interface: quem precisa de um cinza novo cria o token. Duas
regras que valem a pena saber de cor:

- **`faint` é decorativo** (marcadores, divisórias, pontos). Em texto que a
  pessoa lê ele dá ~2,5:1 — use `muted`, que passa dos 4,5:1 em qualquer uma das
  superfícies do produto.
- **Cor com significado existe em dois lugares, e só neles.**
  `--color-danger` (a ação destrutiva do menu) e a escala de saúde do cliente
  (`--color-client-*`: Ativo verde, Renovação âmbar, Em risco vermelho,
  Pausado cinza, Novo azul, VIP roxo), que veio com os exports de Clientes. O
  resto do produto continua monocromático — o status da tarefa, por exemplo,
  é fundo neutro com o texto num degrau de cinza. Matiz novo só entra com
  desenho.

### Listas: a largura da coluna é da pessoa

Toda lista do produto (Tarefas e Clientes hoje; qualquer outra que nasça de
`ui/DataTable`) **redimensiona coluna**: a divisória do cabeçalho arrasta, o
duplo clique devolve a medida do export e as setas ← → fazem o mesmo pelo
teclado (a divisória recebe foco). A largura fica guardada no `localStorage`
de quem está olhando (`bb.colunas.<lista>`), não no servidor: é preferência de
quem usa a tela, não dado da agência.

A régua mora em `src/lib/ui/columns.ts` (pura, testada em
`tests/ui-columns.test.ts`) — mínimo de 72px por coluna, máximo de 560px,
valor guardado sempre validado na leitura. Quem monta uma lista declara um
`ColumnSpec` por coluna, abre um `ColumnsProvider` com o `useColumnWidths` e
usa `HeadCell`/`Cell`: cabeçalho e linha leem a mesma largura, sem prop
viajando célula a célula. A coluna que cresce (CLIENTE, TAREFA) continua
crescendo até alguém arrastá-la.

### O texto do briefing é markdown

A descrição da tarefa tem os três menus dos exports (`menu_comando_tarefas`,
`menu_formatacao`, `formatacao_hover`), em `src/components/editor`:

- linha vazia mostra o hint **"/ para formatação"**;
- **`/`** abre os comandos (títulos, anexos, bloco de código, listas) e **`@`**,
  as pessoas que já aparecem na tarefa — o cursor não sai do texto: o que se
  digita depois do gatilho filtra o menu;
- **texto selecionado** abre o menu de formatação, e o controle de título abre
  a lista de níveis no hover;
- atalhos: `Ctrl Alt 1/2/3` (títulos), `Ctrl ⇧ 8/9` (listas), `Ctrl ⇧ C`
  (bloco de código), `Ctrl B/I/U`.

**O dado continua sendo uma `string`.** As marcas são markdown
(`**negrito**`, `## Título`, `- item`, `> citação`, `` `código` ``, e `__` para
sublinhado, que o markdown não tem) — decisão técnica registrada em
`src/lib/editor/markdown.ts`: um editor de HTML mudaria o formato do campo que
a busca varre e a lista mostra, pediria sanitização e migração, e entregaria a
mesma coisa. Fora da edição o campo **mostra o markdown formatado**
(`MarkdownText`); clicar volta ao texto cru. As duas pontas — escrever e ler —
são funções puras, testadas em `tests/editor-markdown.test.ts`.

A única exceção é `AuroraBackdrop`: o espectro do fundo do login é arte, não cor
de interface, e está marcado assim no arquivo.

Os testes de `tests/design-tokens.test.ts` seguram a ponta: as cores das réguas
de status — tarefa (ponto e selo), peça e **cliente** (fundo e texto do selo) —
têm de ser `var(--token)` de um token que exista no `@theme`.

## Arquitetura de dados

O app só conversa com `repository.ts`, que só conversa com `store.ts`. Trocar o armazenamento é um drop-in em `store.ts` sem tocar no resto.

- Agência (tenant): `src/lib/agency/{types,id}.ts` — ver "Multi-tenant" abaixo.
- Tarefas: `src/lib/tasks/{types,constants,priority,seed,store,repository}.ts` — o pipeline de status vive **só** em `constants.ts`; a régua de prioridade, **só** em `priority.ts`. A conversa da tarefa (`Task.comments`) entra por `POST /api/tasks/<id>/comments`, com o autor vindo da sessão — nunca do corpo.
- Clientes: `src/lib/clients/{types,constants,seed,store,repository,view}.ts` — mesma forma das tarefas; a régua de saúde do cliente (e os pares fundo/texto do selo) vive **só** em `constants.ts`, e o que a tela filtra/ordena, **só** em `view.ts`.
- Aprovação: `src/lib/approval/{types,constants,seed,store,repository}.ts`.
- Inbox: `src/lib/inbox/{types,constants,view,seed,store,repository,viewer}.ts` — a equipe e as conversas dela no mesmo arquivo (`inbox.json`), porque conversa sem saber quem é quem não existe. A régua de presença vive **só** em `constants.ts`; título, prévia, não lidas, ordem e carimbos de hora, **só** em `view.ts`. `viewer.ts` é a única porta que liga a sessão ao membro da equipe — ver "Inbox" abaixo.
- Contas: `src/lib/auth/{types,password,token,session,seed,store,repository}.ts`. `token.ts` não importa nada do Node nem do Next — é o único pedaço compartilhado com o `proxy.ts`.
- Mídia: `src/lib/media/*` — metadados pelo store comum; bytes em `data/uploads/` (ou fallback em memória) sem `BLOB_READ_WRITE_TOKEN`, no Vercel Blob com ela. Como os bytes entram e saem está em "O teto de 4,5 MB" abaixo — leia antes de mexer em upload de arte.
- Base comum: `src/lib/store/index.ts` decide entre os dois backends por `DATABASE_URL`, com a mesma interface (`read`/`transaction`) para quem consome:
  - `json-file.ts` — arquivo JSON + memória, revalida pelo **mtime** a cada leitura, porque `next start` roda vários workers: sem isso, quem grava e quem renderiza a tela veem estados diferentes.
  - `postgres.ts` — cada área é uma linha `jsonb` em `kv_store` (mesmo formato que ia para o arquivo); `transaction` tranca a linha (`SELECT ... FOR UPDATE`) para ler e gravar na mesma conexão, o equivalente ao problema do mtime resolvido por lock de banco em vez de detecção depois do fato.

### O teto de 4,5 MB, e por que a arte não passa pela função

Na Vercel, **o corpo de uma requisição e o de uma resposta são cortados em
4,5 MB** — em qualquer plano, e *antes* de a função rodar. O upload multipart
de sempre (`POST .../media` com o arquivo dentro) morria com `413` em produção
para qualquer arte acima disso, com `source: "static"` no log, o que é o jeito
da plataforma dizer que a função nem foi chamada. Passava batido em dev porque
`next dev` não tem esse teto. A dropzone promete 50 MB.

Então, com Blob configurado, os bytes não passam pela função **em nenhuma das
duas direções**:

- **Subida** — o navegador manda o arquivo direto para o Blob. A função só
  emite a permissão (`POST .../media/token`, `handleUpload` do
  `@vercel/blob/client`) e depois registra o que chegou (`POST .../media` com
  `{ pathname }`). Quem valida sessão, dono do lote, tipo e tamanho é a rota do
  token — o Blob passa a impor `allowedContentTypes` e `maximumSizeInBytes` por
  conta própria, então o token não serve para gravar outra coisa.
- **Descida** — `GET /api/media/<id>` responde **307** para uma URL assinada
  de 5 minutos (`presignMediaUrl`, issue #39), não para a `blobUrl` direto.
  Devolver uma arte de 9 MB pelo corpo da resposta bateria no mesmo teto: a
  imagem subiria e não apareceria. De quebra, o navegador pega os bytes do
  CDN, não da função — só que agora com uma URL que expira sozinha, porque o
  store é privado.

Duas regras ao mexer nisso:

1. **Nada que o navegador manda entra no registro.** Do cliente vem só o
   `pathname` (validado por `isMediaBlobPathname`) e o nome do arquivo; tamanho,
   tipo e URL vêm do `head()` do Blob. Aceitar URL do cliente seria um SSRF,
   porque `readMedia` busca os bytes pelo `pathname` guardado no registro.
2. **Sem `onUploadCompleted`.** A Vercel não consegue chamar de volta um
   `localhost`, então registrar a arte por ali faria o dev local se comportar
   diferente da produção — exatamente a diferença que escondeu o `413`. Quem
   registra é o navegador, depois que o upload termina.

Sem `BLOB_READ_WRITE_TOKEN` nada disso liga: o editor volta ao multipart e os
bytes vão para o disco, como sempre foi em dev.

### Store privado, e por que a arte não é mais pública por URL (issue #39)

`putBlob` grava com `access: "private"`: o store não serve mais nenhum objeto
só por quem tiver a `blobUrl` — toda leitura passa por `get()`/`presignUrl()`
com o `BLOB_READ_WRITE_TOKEN` do servidor. Isso fecha o buraco que a issue #39
descreveu (arte de cliente acessível para sempre a quem vazasse a URL, sem
sessão nem revogação).

**Mas a Vercel não deixa trocar o modo de acesso (`public`/`private`) de um
store depois de criado.** O store atual (`ragick-artes`, criado pela issue
#11 como público) continua público enquanto for esse store — `put(...,
{ access: "private" })` nele responde com o erro "Cannot use private access
on a public store", que `putBlob` transforma num `MediaError` claro em vez de
um 500 cru. Até então **novos uploads ficam bloqueados**, não inseguros: o
código não volta sozinho a gravar público.

Para ligar de verdade, alguém com acesso ao dashboard da Vercel precisa:

1. Criar um **novo** Blob store com acesso **Private** (Storage → Create
   Database → Blob → Private) — não dá para converter o existente.
2. Conectar o novo store ao projeto e migrar (copiar) os objetos do store
   público antigo para o novo, ou aceitar que artes já enviadas param de
   abrir (`blobPathname` delas aponta para o store velho).
3. Atualizar `BLOB_READ_WRITE_TOKEN` para o token do novo store, nos
   ambientes de produção e preview.

Esse é um passo manual, fora do que este PR consegue fazer sozinho — ver a
issue #39 para o estado disso.

## Inbox: a conversa do time, e o que ainda não é tempo real

A tela do Inbox (issue #30, export "Inbox") é comunicação interna: **só o time
da agência** — cliente não entra em sala nenhuma; ele continua decidindo pelo
link público. Grupos e diretas, como o Discord separa servidor de DM, com o
histórico **salvo** (e pesquisável, dentro da conversa e pela lista).

Três decisões que vale saber antes de mexer:

- **Quem é você aqui.** A conversa é entre membros (`InboxMember`), não entre
  contas. O vínculo é o e-mail: `ensureMember` (em `viewer.ts`) encontra o
  membro da sessão ou cria um na primeira visita — é o que povoa a agência
  enquanto não existir convite de equipe. Uma conversa exige **duas**
  condições, não uma: ser da agência *e* ter você dentro. Conversa da sua
  agência em que você não está responde como inexistente, igual a conversa de
  outra agência.
- **Presença é forma primeiro, cor depois.** Disponível, ocupado, ausente e
  offline se distinguem pelo desenho do símbolo (disco cheio, disco com corte,
  meia-lua, anel vazado) — quem não distingue matiz continua lendo o estado. A
  cor entra por cima, e é a **mesma escala da saúde do cliente** (verde de
  Ativo, vermelho de Em risco, âmbar de Renovação, cinza de Pausado): o
  produto tem uma paleta com significado só, não duas. O seu status se troca
  no menu da sua conta, no rodapé da lateral.
- **A chamada ainda não transmite.** Não existe camada de tempo real no
  projeto (WebSocket/WebRTC), e a issue registra que essa decisão técnica vem
  *depois* do desenho. Então a chamada abre no popup desenhado, conta o tempo
  e **deixa o registro no histórico** ("Fulano iniciou uma chamada que durou 12
  minutos", a linha de sistema do export); microfone e tela aparecem
  desligados, dizendo por quê, em vez de acenderem fingindo que alguém ouve do
  outro lado. Pela mesma razão, mensagem nova chega por releitura periódica da
  tela (12s, só com a aba à vista), não por push. Quando a camada entrar, ela
  substitui essas duas coisas — o resto da tela não muda.

## Fluxos: o criativo vira tarefa e a tarefa anda sozinha

Três peças, cada uma num lugar:

- **O fluxo** (`lib/flows`, tela `/configuracoes/fluxos`): etapas em ordem, e
  em cada uma quem toca — uma pessoa fixa, o **squad do cliente** ou o
  próprio cliente (a aprovação pelo link) —, o prazo em dias úteis e a
  próxima etapa. As regras ("qual vem depois", "quem recebe") são funções
  puras em `view.ts`, testadas em `tests/flows-view.test.ts`.
- **O squad** mora na ficha do cliente (`Client.squad`, ids do time). Etapa
  marcada "squad do cliente" vai para o primeiro do squad que ainda está no
  time — é assim que o mesmo fluxo serve todos os clientes.
- **O motor** (`lib/flows/automation.ts`) costura lote, cliente, time e
  tarefa: todo criativo novo no lote vira tarefa na primeira etapa do fluxo
  do cliente; concluir a tarefa a entrega ao responsável da próxima etapa
  (prazo novo, registro na conversa assinado "black berry"); a aprovação do
  cliente pelo link avança a etapa do cliente, e o ajuste volta uma etapa com
  o motivo. A etapa da tarefa só muda por aqui (`moveTaskToStep`), nunca por
  PATCH.

### Usuários, convite e quem administra

O time é o mesmo registro do Inbox (`InboxMember`), agora com função
(Admin, Gerente, Editor, Visualizador, Financeiro), status (ativo, convite
pendente, inativo, arquivado), último acesso e data de entrada. A régua mora
em `lib/inbox/users.ts` (testada em `tests/inbox-users.test.ts`).

- **Só Admin e Gerente mexem no time** — a trava é do repositório
  (`ForbiddenError`), não da tela. Ninguém arquiva a si mesmo nem tira de si
  a administração. Na migração, agência sem Admin promove quem tem conta.
- **Convite**: "Adicionar usuário" grava a pessoa como convite pendente com um
  token; o link `/criar-conta?convite=…` cria a conta **dentro** da agência
  (o cadastro normal sempre abre agência nova) e exige o e-mail convidado. A
  primeira entrada vira o convite em ativo. Não há disparo de e-mail — o link
  é copiado por quem convidou.
- **Só quem está ativo trabalha**: convidado, inativo e arquivado saem do menu
  de @, das conversas novas e não recebem tarefa de fluxo. Excluir só vale
  para convite; quem já trabalhou é arquivado, para o histórico não perder o
  nome.

### Domínio da agência e quem pode entrar

- **Convite automático pelo domínio** (Usuários → "⋯"): quem cria conta com
  um e-mail `@dominio-da-agencia` entra na agência como **pedido de entrada**
  e vê `/acesso` ("Quase lá") até um Admin ou Gerente aprovar. Não é entrada
  direta porque o produto não confirma e-mail — com entrada direta, qualquer
  um que digitasse `algo@dominio` leria os clientes. O domínio precisa ser o
  do e-mail de quem configura, e e-mail pessoal (Gmail etc.) não vale
  (`lib/inbox/domain.ts`, testado em `tests/inbox-domain.test.ts`).
- **A trava mora em `requireAgency`/`currentAgencyScope`** (`memberAccess`):
  arquivado perde o acesso na hora, e pedido esperando aprovação não recebe
  escopo. As telas do shell usam `redirectWithoutScope()`, que manda quem tem
  conta mas não pode entrar para `/acesso` em vez de apagar a sessão no login.

### O @ de cada pessoa

Cada membro do time tem um `handle` único na agência (`lib/inbox/handle.ts`),
sugerido pelo nome e editável em Configurações. O menu de @ do briefing, do
comentário e do Inbox oferece o time inteiro e insere o @ — não o nome, que
pode repetir. O responsável da tarefa aceita `@handle` e o repositório troca
pelo nome de quem atende por ele (@ de ninguém é recusado).

## Atalhos e pequenas conveniências

- **Ações rápidas**: `/` abre o menu; com ele aberto, `C` cria tarefa e `F`
  cria cliente. (Fora de campo de texto — digitando, a barra é só barra.)
- **Tarefas**: "Minhas" na barra filtra pelo seu nome; na tarefa de fluxo,
  "Mover para <próxima etapa>" / "Concluir" no topo.
- **Planejamento**: `+` no hover do dia cria o criativo; arrastar o criativo
  para outro dia remarca (e o prazo da tarefa acompanha).
- **Lateral**: não lidas do Inbox ao lado do item (sem as silenciadas).
- **Abas do navegador** com o nome de cada tela.

## App de desktop

A pasta `desktop/` é o black berry para Windows, macOS e Linux: uma janela
Electron que abre o site publicado, com bandeja, atalho global de mudo na
chamada e permissões de microfone/câmera/tela só para a origem do app. Tem
`package.json` próprio (fora do `tsconfig`, do ESLint e do build do Next) —
como rodar, gerar o instalador e assinar está em `desktop/README.md`.

## Multi-tenant: isolamento por agência

Toda tarefa e todo lote carrega um `agencyId`, e **nenhuma leitura ou escrita
acontece sem dizer de qual agência**: as funções de `repository.ts` exigem um
`AgencyScope` como primeiro argumento, e o TypeScript recusa a chamada sem ele.
O escopo nasce num lugar só — `requireAgency()` / `currentAgencyScope()` em
`src/lib/auth/session.ts`, a partir da sessão do servidor. Nunca de query
string, corpo ou header.

Vale para escrita como vale para leitura: `getTask`, `updateTask`, `deleteTask`
e toda operação de lote/peça procuram por id **e** agência. Registro de outra
agência responde **404**, nunca 403 — 403 confirmaria que o id existe.

**O id da agência.** `user.agency` continua sendo o nome que a pessoa escreve;
quem identifica o tenant é `user.agencyId`, gravado no cadastro e imutável
depois disso (renomear a agência troca o rótulo, não o tenant). O id é o slug
do nome — "Estúdio Norte" → `estudio-norte` — mais um sufixo aleatório nos
cadastros novos, porque ainda não existe convite de equipe: sem o sufixo,
bastaria digitar o nome de uma agência para cair dentro dela.

**Migração.** Roda sozinha na primeira leitura de cada store (`revive`), no
mesmo espírito dos `seed.ts`. Conta antiga recebe o slug do nome que já tinha;
tarefa e lote antigos, sem dono, caem na agência semeada (`estudio-norte`) — a
única que existia antes do multi-tenant. Nada some e nada vaza para quem acabou
de se cadastrar.

**A exceção é o link público.** `/a/<token>` e `POST /api/approve/<token>`
rodam sem sessão, e portanto sem agência: quem autoriza é o token, e ele
resolve exatamente um lote (`getBatchByToken` recusa token ambíguo). As duas
funções ficam isoladas no fim de `approval/repository.ts`, sem `AgencyScope`
por desenho — um escopo ali seria escopo escolhido por quem chama. `GET
/api/media/<id>` segue igualmente público, protegido pelo id de 16 bytes, para
o cliente conseguir carregar as artes.

Quando o Postgres entrar (banco no lugar do JSON), este filtro vira o `WHERE
agency_id` de cada consulta e ganha **RLS** por cima.

## Sessão e rotas protegidas

`src/proxy.ts` (Next 16 — o antigo `middleware.ts`) barra as telas do shell autenticado e devolve a pessoa ao destino original depois do login (`?next=`). Ficam de fora, de propósito: `/a/<token>` (aprovação do cliente, sem login) e `/api/media/<id>`, que precisa carregar as artes no navegador do cliente — o que protege a arte é o id de 16 bytes aleatórios.

O matcher do proxy também deixa `/api` de fora, então cada rota da agência checa a sessão por conta própria (`requireUser()` de `src/lib/auth/session.ts`, que responde 401). As duas públicas continuam públicas: `POST /api/approve/<token>` e `GET /api/media/<id>`.

**Trocar a senha derruba as sessões dos outros aparelhos.** O usuário tem uma `passwordVersion` que sobe a cada troca, e o token carrega a versão que valia quando foi emitido; `session.ts` compara as duas e recusa o que for anterior. Quem trocou continua logado, porque a rota reemite o cookie com a versão nova. O `proxy.ts` não participa dessa checagem (ele só confere a assinatura, porque não pode ler o store): quem foi recusado lá dentro chega ao login com `?sessao=encerrada`, e é aí que o proxy apaga o cookie morto.

## Movimento

A biblioteca de animação vive em `globals.css`: uma curva de entrada (`--ease-out-soft`), cascata de listas por `--d` (`.stagger-item`), troca de tela em `app/(app)/template.tsx`, esqueletos (`.skeleton` + `loading.tsx`) e feedback de toque (`.tap`). Só `transform` e `opacity` são animados, e tudo respeita `prefers-reduced-motion`.
