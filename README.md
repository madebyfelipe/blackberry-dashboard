# Blackberry Dashboard

MVP frontend estático do Blackberry, com linguagem visual inspirada no Halo Mono/Blackberry.

## Rodar localmente

Não há dependências de runtime. Sirva a pasta com qualquer servidor HTTP estático:

```bash
python -m http.server 4173
```

Abra `http://localhost:4173`. O login demonstrativo aceita qualquer e-mail e senha com pelo menos quatro caracteres.

Para abrir diretamente o fluxo público, use `http://localhost:4173/#/approve/i1` (o conteúdo `i1` é um mock pendente). Na área interna, o botão **Link público** copia o link do primeiro conteúdo de cada lote.

## Escopo do MVP

- Login interno demonstrativo.
- Dashboard com clientes, lotes e conteúdos.
- Criação de lote e upload de conteúdo (metadados mockados).
- Link público mobile-first para aprovação/reprovação.
- Motivo obrigatório na reprovação, progresso e registro da decisão.

Os dados ficam claramente isolados no módulo `mock-store` de `app.js` e persistem no `localStorage` do navegador.