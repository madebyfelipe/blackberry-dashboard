# black berry

SaaS de gestão e **aprovação de conteúdo** para agências de social media. Cobrança por cliente atendido (teto R$100/cliente/mês). Público inicial: agências pequenas (3–12 pessoas, 8–30 clientes).

Três áreas: **aprovação de conteúdo** (diferencial), **gestão operacional de tarefas** e **CRM pós-venda + saúde da carteira**.

## Stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript**
- **Tailwind CSS v4** (tokens do design em `src/app/globals.css` via `@theme`)
- Persistência atual: **arquivo JSON** com fallback em memória (`src/lib/store/json-file.ts`) — troque por um banco antes de escalar na Vercel (ver `ROADMAP.md` e a memória `ragick-persistence-deploy`).
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
ordenações das tarefas, normalização no repositório, leitura de dimensões de
imagem, régua de formatos das peças e a revalidação do store de arquivo. O que
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

## Rotas principais

| Rota | O que é |
| --- | --- |
| `/login` · `/criar-conta` · `/recuperar-senha` | Entrada (black berry) — login e cadastro reais; a recuperação registra o pedido, o disparo de e-mail ainda não existe |
| `/tarefas` | Tarefas — Lista + Quadro (Kanban), CRUD, drag-and-drop, busca, menu de filtros (`F`) e menu de visualização |
| `/social` | **Clientes** — passo 1 do fluxo: de quem são os lotes (lotes, peças e pendentes de cada um) |
| `/social/[cliente]` | **Lotes do cliente** — passo 2: progresso de cada lote e o modal "Novo lote" |
| `/social/[cliente]/[lote]` | Detalhe do lote — grade de peças + painel de decisão + link público |
| `/social/[cliente]/[lote]/editor` | **Editor de lote** — peças, detalhes da peça (data, formato, canal, legenda, hashtags), preview do post e as ações do link (enviar, gerar, desativar) |
| `/a/[token]` | **Aprovação pública** (cliente, sem login): tela de início + swipe para aprovar/pedir ajuste |
| `/configuracoes` | Conta: perfil, troca de senha e sessão |
| `/inbox`, `/clientes`, `/equipe` | Placeholders prontos para desenhar |

## Design

Tudo segue os exports do pen.dev na raiz do repo (`*-export.html`) — a fonte de verdade do visual **black berry** (monocromático). Ao divergir do design, confirmar antes. Tokens e componentes-base ficam em `src/components/ui`.

O vocabulário inteiro — cor, raio e o alvo de toque dos botões redondos — mora
no `@theme` de `src/app/globals.css`, e o Tailwind v4 o transforma em classe
(`--color-danger` → `text-danger`, `--radius-menu` → `rounded-menu`,
`--spacing-control` → `h-control`). Fora dali não entra hex nem `rounded-[Npx]`
de cor/forma de interface: quem precisa de um cinza novo cria o token. Duas
regras que valem a pena saber de cor:

- **`faint` é decorativo** (marcadores, divisórias, pontos). Em texto que a
  pessoa lê ele dá ~2,5:1 — use `muted`, que passa dos 4,5:1 em qualquer uma das
  superfícies do produto.
- **`--color-danger` é o único matiz** do sistema (a ação destrutiva do menu).
  Se ele fica ou vira cinza + peso é decisão de design, e por isso está num
  token só, comentado em `globals.css`.

A única exceção é `AuroraBackdrop`: o espectro do fundo do login é arte, não cor
de interface, e está marcado assim no arquivo.

Os testes de `tests/design-tokens.test.ts` seguram a ponta: as cores das réguas
de status têm de ser `var(--token)` de um token que exista no `@theme`.

## Arquitetura de dados

O app só conversa com `repository.ts`, que só conversa com `store.ts`. Trocar o armazenamento é um drop-in em `store.ts` sem tocar no resto.

- Agência (tenant): `src/lib/agency/{types,id}.ts` — ver "Multi-tenant" abaixo.
- Tarefas: `src/lib/tasks/{types,constants,priority,seed,store,repository}.ts` — o pipeline de status vive **só** em `constants.ts`; a régua de prioridade, **só** em `priority.ts`.
- Aprovação: `src/lib/approval/{types,constants,seed,store,repository}.ts`.
- Contas: `src/lib/auth/{types,password,token,session,seed,store,repository}.ts`. `token.ts` não importa nada do Node nem do Next — é o único pedaço compartilhado com o `proxy.ts`.
- Mídia: `src/lib/media/*` — bytes em `data/uploads/`, metadados em `data/media.json`.
- Base comum: `src/lib/store/json-file.ts` (arquivo JSON + memória). Ele revalida pelo **mtime** a cada leitura, porque `next start` roda vários workers: sem isso, quem grava e quem renderiza a tela veem estados diferentes.

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
