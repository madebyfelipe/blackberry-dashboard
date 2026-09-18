# black berry

SaaS de gestão e **aprovação de conteúdo** para agências de social media. Cobrança por cliente atendido (teto R$100/cliente/mês). Público inicial: agências pequenas (3–12 pessoas, 8–30 clientes).

Três áreas: **aprovação de conteúdo** (diferencial), **gestão operacional de tarefas** e **CRM pós-venda + saúde da carteira**.

## Stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript**
- **Tailwind CSS v4** (tokens do design em `src/app/globals.css` via `@theme`)
- Persistência atual: **arquivo JSON** com fallback em memória (`src/lib/**/store.ts`) — troque por um banco antes de escalar na Vercel (ver `ROADMAP.md` e a memória `ragick-persistence-deploy`).
- Ícones: lucide, reproduzidos como stroke/`currentColor` em `src/components/icons.tsx`.

## Rodando localmente

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de produção
npm run typecheck
```

## Rotas principais

| Rota | O que é |
| --- | --- |
| `/login` | Tela de login (black berry) |
| `/tarefas` | Tarefas — Lista + Grade (Kanban), CRUD, drag-and-drop, busca, menu de filtros (`F`) e menu de visualização |
| `/social` | Lotes de aprovação (visão agência) |
| `/social/[id]` | Detalhe do lote — grade de peças + painel de decisão + link público |
| `/social/[id]/editor` | **Editor de lote** — peças, detalhes da peça (data, formato, canal, legenda, hashtags) e preview do post |
| `/a/[token]` | **Aprovação pública** (cliente, sem login): tela de início + swipe para aprovar/pedir ajuste |
| `/inbox`, `/clientes`, `/equipe`, `/configuracoes` | Placeholders prontos para desenhar |

## Design

Tudo segue os exports do pen.dev na raiz do repo (`*-export.html`) — a fonte de verdade do visual **black berry** (monocromático). Ao divergir do design, confirmar antes. Tokens e componentes-base ficam em `src/components/ui`.

## Arquitetura de dados

O app só conversa com `repository.ts`, que só conversa com `store.ts`. Trocar o armazenamento é um drop-in em `store.ts` sem tocar no resto.

- Tarefas: `src/lib/tasks/{types,constants,seed,store,repository}.ts` — o pipeline de status vive **só** em `constants.ts`.
- Aprovação: `src/lib/approval/{types,constants,seed,store,repository}.ts`.
