# Fluxo de trabalho — black berry

Como o Felipe e o Claude constroem este produto juntos. Documento vivo: se o fluxo mudar, este arquivo muda junto.

## Papéis

**Felipe — head de produto.** Decide o que o produto faz, desenha toda tela nova (exports do pen.dev, `*-export.html` na raiz do repo) e é quem aprova o que vai para a `main`.

**Claude — desenvolvedor.** Constrói o que o Felipe desenha, mantém a arquitetura, cuida de segurança/dados/performance, e decide sozinho tudo que **não** for uma tela nova.

## Regra de ouro: tela nova é sempre do Felipe

**Claude nunca inventa uma tela final.** Se um pedaço do produto ainda não tem desenho, ele fica como placeholder fácil de trocar (ver `ROADMAP.md`, itens marcados 🎨) — nunca um chute de como a tela "deveria" ficar. Quando o Felipe desenha, ele abre uma issue com a etiqueta `tela` (modelo em `.github/ISSUE_TEMPLATE/tela.md`) e o export na raiz do repo; a partir daí o Claude constrói fiel ao desenho.

O resto — dados, API, correção de bug, performance, segurança, testes, infraestrutura — é etiquetado `funcionamento` e o Claude decide e constrói sozinho, sem esperar aprovação prévia de design.

## O ciclo

1. **Felipe desenha** uma tela (ou decide uma regra de negócio) e abre uma issue no GitHub — `tela` ou `funcionamento`, conforme o modelo em `.github/ISSUE_TEMPLATE/`.
2. **Claude constrói** em branch própria (`claude/<assunto>`), valida (`npm run typecheck`, `npm test`, `npm run build`, e o app rodando de verdade — desktop e celular) e abre um **pull request** para a `main`.
3. **Felipe revisa e decide o merge.** Numa sessão em que o Felipe está junto, o Claude pode mergear direto quando o Felipe pedir explicitamente. Fora disso — e sempre nas rotinas automatizadas abaixo — quem decide o merge é o Felipe.
4. Issue fechada com o link do PR que resolveu.

## As rotinas automatizadas

Três sessões do Claude rodam sozinhas, fora do horário em que o Felipe usa o Claude para desenhar (evita disputar o mesmo teto de uso):

| Rotina | Quando | O que faz |
| --- | --- | --- |
| **turno da madrugada** | seg–sex, 01h (Brasília) | Pega a issue `funcionamento` mais valiosa da fila, constrói, valida e abre PR. Nunca mexe em issue `tela`. Nunca faz merge. |
| **revisão semanal e fila de issues** | domingo, 01h (Brasília) | Confere se `ROADMAP.md` ainda bate com o código, roda tipos/testes/build, arruma a fila de issues (cria, fecha, reordena) e escreve pro Felipe o que precisa da mão dele naquela semana. Não implementa nada. |

As duas só commitam em branch própria com PR — nunca direto na `main`.

## Onde cada coisa mora

- **Convenções técnicas e arquitetura** → `README.md`.
- **O que já existe, o que falta desenhar, o que falta construir** → `ROADMAP.md`.
- **Pedido de tela nova ou de trabalho de construção** → issue no GitHub, pelos modelos em `.github/ISSUE_TEMPLATE/`.
- **Este arquivo** → só o fluxo: quem decide o quê e como o trabalho passa de um para o outro.
