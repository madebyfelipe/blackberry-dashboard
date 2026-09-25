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
| Compartilhar tela | modal do site + seletor do navegador | **uma janela só**, o modal "Compartilhar tela" do desenho: **Telas** e **Janelas** com miniatura, resolução, quadros e "Compartilhar áudio do sistema" (Windows); no macOS 15+ o do sistema |
| Barra de título | a do navegador | **preta**, a cor do fundo do app |
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

1. `blackberry.url` no `package.json` desta pasta é o endereço de produção (hoje `https://ragick-xi.vercel.app`).
2. Em cada sistema, rode o comando dele — o instalador sai em `desktop/dist/`:
   - macOS: `npm run dist:mac` → `.dmg`
   - Windows: `npm run dist:win` → instalador `.exe`
   - Linux: `npm run dist:linux` → `.AppImage`

O instalador do Mac só se gera num Mac; o do Windows, de preferência num Windows.

**Release do Windows pelo GitHub** (`.github/workflows/desktop-release.yml`):
para sair versão nova, suba `version` neste `package.json` e escreva as notas
em `RELEASE_NOTES.md` num PR. No PR, a execução "Desktop — instalador" gera o
`.exe` numa máquina Windows e deixa ele nos artefatos, para testar antes. No
merge para a `main`, ela publica o release `v<versão>` com o `.exe` e as notas.
Um release que já existe não é refeito.

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
Electron:

- `setInCall(bool)` e `onToggleMute(cb)` — a chamada (`CallOverlay`) avisa quando entra e sai; enquanto dura, o atalho de mudo é global.
- `show()` e `setUnread(n)` (0.0.5+) — trazer a janela pelo clique na notificação; não lidas na bandeja.
- `sharePicker`, `setShareQuality(q)` e `takeShareQuality()` (0.0.7+) — a página conta a qualidade de tela que usa, o seletor abre com ela marcada, e depois a página busca o que foi escolhido lá (validado em `src/share-quality.js`). Com isso o desktop mostra só o modal do seletor, sem o do site antes.

No navegador comum a ponte não existe e a página segue igual. O site sempre
checa se a função existe antes de usar: um app antigo continua funcionando
com o site novo.

## Arquivos

- `src/main.js` — janela, bandeja, permissões, tela compartilhada, atalho.
- `src/titlebar.html` — a barra de título preta (o site fica numa `WebContentsView` abaixo dela).
- `src/screen-picker.js` e `src/picker/` — o seletor de tela compartilhada (o modal "Compartilhar tela" do export "Chamada · Call View"); `src/share-quality.js` valida a qualidade que vem dele e da página.
- `src/policy.js` — as regras (qual endereço é do app, o que abre fora, quais permissões) — testadas em `tests/`.
- `src/preload.js` — a ponte com a página.
- `src/tray.png` / `tray@2x.png` e `build/icon.png` — o símbolo do logo oficial (`public/brand/`), na bandeja e no ícone do app. Gerados do `src/app/icon.svg` da raiz; se o logo mudar, gere de novo.

## O que ainda falta

- ⬜ **Atualização automática do instalador** (electron-updater) — só faz falta quando esta pasta mudar, já que as telas vêm do site.
- ⬜ **Aviso de chamada recebida com o app escondido** — depende da notificação de chamada do app web (ROADMAP); o desktop já mantém a página viva na bandeja para ela funcionar.
