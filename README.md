# Sistema-Pedidos

Sistema SaaS de pedidos para restaurantes.

## Estrutura do repositorio

- `backend/`: API FastAPI usada no Render.
- `frontend/`: telas do sistema usadas no Vercel.
- `frontend/r/admin/`: painel do restaurante.
- `frontend/r/mesa/`: tela do cliente por mesa.
- `frontend/r/cozinha/`: fila da cozinha.
- `frontend/r/tv/`: painel de TV.
- `frontend/r/caixa/`: caixa.
- `frontend/r/garcom/`: tela do garcom.
- `frontend/super-admin/`: painel SaaS.
- `frontend/shared/`: configuracoes e utilitarios compartilhados.

## Padrao do frontend

O frontend deve manter HTML, CSS e JavaScript separados.

Cada tela segue o padrao:

- `index.html`: estrutura da pagina.
- `styles.css`: estilos da tela.
- `app.js`: logica da tela.

Arquivos HTML soltos na raiz, como `admin.html` e `cliente.html`, sao paginas legadas locais e nao representam a estrutura ativa do projeto.

## Deploy

- Backend: Render, usando a pasta `backend/`.
- Frontend: Vercel, usando a pasta `frontend/`.

## Variaveis sensiveis

Arquivos `.env` nao devem ser enviados ao GitHub. Chaves privadas, como service role do Supabase, devem ficar apenas no backend ou nas variaveis de ambiente dos provedores.
