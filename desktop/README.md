# black berry para desktop (Electron)

Uma janela Electron que abre o black berry **publicado** — o mesmo site da
Vercel. Nenhuma tela mora aqui: toda deploy nova do app web chega no desktop
na hora, sem reinstalar. O instalador só precisa de versão nova quando algo
*desta pasta* muda.

O que o desktop acrescenta ao navegador:

| | Navegador | Desktop |
| --- | --- | --- |
| Fechar a janela | encerra o Inbox e a chamada | fica na **bandeja** (Windows e macOS) e continua recebendo mensagem e chamada |
| Mudo na chamada | só com a aba em foco | **Ctrl/Cmd+Shift+M** funciona com qualquer janela na frente, ligado só durante a chamada |
| Microfone, câmera, tela | pergunta a cada site | liberados para o black berry, e **só** para ele; o resto (localização, USB…) é recusado |
| Link externo (WhatsApp, e-mail) | abre outra aba | abre no navegador/app do sistema |
| Abrir o app duas vezes | duas abas | traz a janela que já existe |

## Rodando

```bash
cd desktop
npm install
npm run dev      # abre apontando para http://localhost:3000 (suba o `npm run dev` da raiz antes)
npm run check    # sintaxe + testes das regras de segurança (node --test)
```

Para apontar para outro endereço sem mexer em nada: `npx electron . --url=https://preview-xyz.vercel.app`
(ou a variável `BLACKBERRY_URL`). `http` só é aceito em `localhost`.

## Gerando o instalador

1. Preencha `blackberry.url` no `package.json` desta pasta com o endereço de produção (https).
2. Em cada sistema, rode o comando dele — o instalador sai em `desktop/dist/`:
   - macOS: `npm run dist:mac` → `.dmg`
   - Windows: `npm run dist:win` → instalador `.exe`
   - Linux: `npm run dist:linux` → `.AppImage`

O instalador do Mac só se gera num Mac; o do Windows, de preferência num Windows.

**Assinatura.** Sem certificado, o Windows mostra "O Windows protegeu o seu
computador" e o macOS recusa abrir o app baixado (dá para liberar em Ajustes →
Privacidade e Segurança). Para distribuir para a equipe sem esse aviso é preciso:

- macOS: conta Apple Developer (US$ 99/ano) e as variáveis `CSC_LINK`,
  `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
  (o electron-builder assina e notariza sozinho com elas).
- Windows: um certificado de assinatura de código (`CSC_LINK`/`CSC_KEY_PASSWORD`).

## Como a página fala com o desktop

`src/preload.js` expõe `window.blackberryDesktop` (tipado em
`src/lib/desktop.ts` do app web) — e mais nada: a página não enxerga Node nem
Electron. Hoje são duas funções: `setInCall(bool)`, que a chamada
(`CallOverlay`) chama ao conectar e ao sair, e `onToggleMute(cb)`, o atalho
global. No navegador comum a ponte não existe e a página segue igual.

## Arquivos

- `src/main.js` — janela, bandeja, permissões, tela compartilhada, atalho.
- `src/policy.js` — as regras (qual endereço é do app, o que abre fora, quais permissões) — testadas em `tests/`.
- `src/preload.js` — a ponte com a página.
- `src/tray-icon.js` — ícone **provisório** da bandeja (um círculo gerado em código). O ícone de verdade é 🎨.

## O que ainda falta

- 🎨 **Ícone do app e da bandeja.** Hoje o app usa o ícone padrão do Electron e a bandeja um círculo branco.
- 🎨 **Escolher o que compartilhar.** No macOS aparece o seletor do próprio sistema; no Windows e no Linux o app compartilha a tela principal inteira, porque escolher a janela pede uma tela que ainda não foi desenhada.
- ⬜ **Atualização automática do instalador** (electron-updater) — só faz falta quando esta pasta mudar, já que as telas vêm do site.
- ⬜ **Aviso de chamada recebida com o app escondido** — depende da notificação de chamada do app web (ROADMAP); o desktop já mantém a página viva na bandeja para ela funcionar.
