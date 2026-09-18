# Roadmap — black berry

Documento vivo. Marca o que já existe, o que falta **desenhar** (você) e o que falta **construir** (Claude), até o fim do projeto. Última atualização: **18 set 2026**.

Legenda: ✅ pronto · 🟡 parcial/placeholder · ⬜ não começado · 🎨 precisa de tela sua antes de eu construir

---

## Fundação
- ✅ Projeto Next.js 16 + React 19 + Tailwind v4 + TS do zero
- ✅ Tokens do design **black berry** (`globals.css @theme`) + primitivos (`Button`, `Input`, `StatusPill`, `Avatar`, `Breadcrumb`, `Toast`)
- ✅ Shell autenticado (sidebar completa) + rotas placeholder
- ✅ Camada de dados com `repository`/`store` (JSON + fallback memória) e API REST
- ✅ Sistema de toasts + animações (fade/drawer/pop) + `prefers-reduced-motion`

## Fase 1 — Aprovação de conteúdo (prioridade absoluta)
- ✅ Lote (visão agência): grade de peças, chips de filtro, painel de decisão, histórico, link público, "marcar como refeita" (`/social/[id]`)
- ✅ Lista de lotes (`/social`) com progresso
- ✅ **Link público por swipe** (`/a/[token]`): arrastar p/ aprovar, reprovar com motivo, progresso, tela final
- 🟡 Peças usam **thumb placeholder** (`PieceThumb`) — troca direta por mídia real depois
- ⬜ Upload real de mídia (imagem/carrossel/vídeo/Reels) + preview leve/WebP
- ⬜ Comentário por **áudio** + transcrição (Whisper) — spec
- ⬜ Registro de decisão com **IP + versão exata** apresentada (hoje registra autor+data)
- ⬜ Token expirável/revogável + geração de link por lote
- ⬜ Envio do link por WhatsApp/e-mail + lembretes automáticos
- 🎨 Tela de **criação de lote** (upload + legenda + 1º comentário + hashtags + data) — falta desenho
- 🎨 Tela pública: estados de **carrossel/vídeo** e visual de "mockup de feed Instagram" — falta desenho

## Fase 2 — Operação / Tarefas
- ✅ Lista + Board (Kanban) sobre os mesmos dados, CRUD, busca, tabs de status, drag-and-drop, updates otimistas
- 🟡 Drawer de tarefa cobre campos essenciais (título, cliente, responsável, status)
- ⬜ Campos ricos da peça: tipo, objetivo, pilar, resp. arte/texto, prazo interno, data de publicação, arquivo, versão
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
- ⬜ **Auth real** (e-mail/senha p/ agência + token p/ cliente) — hoje o login apenas navega
- ⬜ **Multi-tenant** com isolamento por agência (Postgres + RLS conforme spec)
- ⬜ Trocar `store.ts` por banco (Neon Postgres via `vercel:marketplace`) antes de produção
- ⬜ Papéis/permissões (Coordenação, Social media, Designer, Cliente)
- ⬜ Inbox, Equipe, Configurações (hoje placeholders)
- ⬜ Testes automatizados + CI

## Fora do MVP (não construir sem pedido)
Agendamento/publicação automática · métricas de redes · financeiro · NF/boleto · timesheet · CRM de prospecção.

---

## Rotina do Claude (como trabalhar a cada sessão)

1. **Contexto primeiro.** Ler `MEMORY.md` e as memórias do projeto (começar por `ragick-black-berry-redesign`). Ler este `ROADMAP.md`.
2. **Design é lei.** A fonte de verdade são os `*-export.html` (pen.dev) na raiz. Construir fiel ao design. **Ao precisar divergir, sugerir e confirmar antes.**
3. **Manter os espaços do Felipe.** O que ainda não tem tela desenhada fica como **placeholder fácil de trocar** (ex.: `PieceThumb`, páginas placeholder) — nunca inventar telas finais por conta própria; marcar 🎨 aqui.
4. **Arquitetura estável.** Novas views são *leitoras* de `repository`/`constants`. Nunca duplicar dados por tela. Pipeline de status só em `constants.ts`.
5. **Interações + feedback.** Toda ação relevante dá feedback (toast, estado otimista, animação sutil). Respeitar `prefers-reduced-motion`.
6. **Validar sempre.** `npm run typecheck` + `npm run build` verdes; smoke test das rotas/API tocadas antes de concluir.
7. **Deploy + versionamento.** Commits pequenos e descritivos; subir no GitHub (`madebyfelipe/blackberry-dashboard`); deploy via `/vercel:deploy` quando fizer sentido.
8. **Fechar o loop.** Atualizar este roadmap e as memórias; relatar o que foi feito, o que ficou pendente e o que precisa de decisão/desenho.

### Próximos passos sugeridos (ordem)
1. Auth real + multi-tenant (destrava tudo o resto).
2. Upload de mídia real nas peças (troca o `PieceThumb`).
3. Tela de **criação de lote** (depende de desenho 🎨).
4. Campos ricos da peça + Calendário editorial.
5. Começar CRM/Health Score (Fase 3).
