# Checklist de Apresentacao

## Antes de sair

- Confirmar internet.
- Abrir Vercel: `https://frontend-teal-nine-80.vercel.app`
- Abrir landing comercial: `https://frontend-teal-nine-80.vercel.app/comercial`
- Abrir Render health: `https://sistema-pedidos-zk2w.onrender.com/health`
- Confirmar se o Render retorna versao `99ebd0483c0b` ou mais nova.
- Confirmar que `demo-restaurante`, `demo-pizzaria` e `demo-padaria` abrem.
- Confirmar que o admin demo entra com senha `Demo@2026`.

- Testar login admin de `demo-restaurante`.
- Testar mesa 1 no celular.
- Testar cozinha.
- Testar caixa.
- Testar super-admin.

## Links essenciais

- Super-admin: `https://frontend-teal-nine-80.vercel.app/super-admin`
- Admin restaurante: `https://frontend-teal-nine-80.vercel.app/r/demo-restaurante/admin`
- Mesa restaurante: `https://frontend-teal-nine-80.vercel.app/r/demo-restaurante/mesa/demo-restaurante-mesa-1`
- Cozinha: `https://frontend-teal-nine-80.vercel.app/r/demo-restaurante/cozinha`
- Garcom: `https://frontend-teal-nine-80.vercel.app/r/demo-restaurante/garcom`
- Caixa: `https://frontend-teal-nine-80.vercel.app/r/demo-restaurante/caixa`
- TV: `https://frontend-teal-nine-80.vercel.app/r/demo-restaurante/tv`
- Landing comercial: `https://frontend-teal-nine-80.vercel.app/comercial`

## O que testar antes de apresentar

- Login admin.
- Abrir QR da mesa.
- Enviar pedido.
- Pedido aparecer na cozinha.
- Avancar status ate entregue.
- Caixa fechar conta.
- Admin carregar estoque.
- Super-admin abrir detalhes do restaurante.

## Status validado em 2026-06-02

- Vercel production: branch `produto-comercial-restaurantes`, commit `99ebd0483c0b19b9543aeb4e390420a6bddba24c`, READY.
- Render: `/health` retornou versao `99ebd0483c0b`.
- Supabase: schema de estoque e tipo de negocio aplicado; RLS ativo nas tabelas de estoque.
- Demo comercial: dados presentes para restaurante, pizzaria e padaria.
- Playwright no ambiente publicado: 16 testes passaram.
- Smoke publicado: pedido, cozinha, caixa, baixa de estoque e bloqueio/desbloqueio passaram.

## O que nao prometer

- Emissao fiscal real pronta.
- iFood integrado.
- WhatsApp automatizado completo.
- App mobile nativo.
- Meio a meio avancado de pizza 100% pronto.
- Venda por balanca 100% pronta.
- Producao de padaria completa.

## Respostas para objecoes

- "Funciona no celular?" Sim, as telas principais sao responsivas e foram testadas em mobile via Playwright.
- "E se o restaurante atrasar mensalidade?" O super-admin controla status, aviso e bloqueio.
- "Cada restaurante ve so os proprios dados?" Sim, as rotas autenticadas usam `restaurant_id` do JWT.
- "Da para usar em pizzaria/padaria?" Sim para operacao basica; recursos avancados estao em implantacao controlada.
- "Tem estoque?" Sim, com insumos, ficha tecnica, baixa por venda e alertas.

## Plano B se internet falhar

- Abrir prints ou a landing local `frontend/comercial/index.html`.
- Mostrar roteiro e telas ja carregadas no navegador.
- Explicar fluxo com os documentos `ROTEIRO_DEMO_COMERCIAL.md` e `RELATORIO_PRE_DEMO.md`.
- Agendar validacao tecnica online depois da reuniao.

## Telas essenciais

- Mesa/QR.
- Cozinha.
- Caixa.
- Admin estoque.
- Super-admin financeiro/bloqueio.

## Verificacao final publicada - 2026-06-05

- Branch local confirmada: `produto-comercial-restaurantes`.
- Vercel production: `READY`, commit `e3b5a189f2417e4875ebbde6061a5ad7083c8047`.
- Render `/health`: `ok`, version `9b0bb5d9a199`.
- Rotas principais publicadas retornaram HTTP 200:
  - `/comercial`
  - `/super-admin`
  - `/r/demo-restaurante/admin`
  - `/r/demo-restaurante/mesa/demo-restaurante-mesa-1`
  - `/r/demo-restaurante/cozinha`
  - `/r/demo-restaurante/garcom`
  - `/r/demo-restaurante/caixa`
  - `/r/demo-restaurante/tv`
- Testes locais:
  - `py_compile`: passou.
  - `pytest`: 53 passed.
  - `node --check`: passou.
  - `npx playwright test`: 12 passed, 4 skipped por falta de variaveis QA.

Pendencia antes de afirmar demo 100% com banco real:

- Configurar `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` em ambiente QA/staging.
- Rodar:

```powershell
python backend/scripts/check_inventory_schema.py
python backend/scripts/seed_demo_comercial.py
python backend/scripts/smoke_inventory_real.py
```

Checklist rapido no dia da apresentacao:

- Entrar no admin `demo-restaurante`.
- Confirmar que a aba Estoque carrega sem erro.
- Criar ou visualizar um produto no cardapio.
- Abrir mesa 1 pelo celular.
- Enviar um pedido simples.
- Avancar na cozinha ate entregue.
- Fechar no caixa.
- Mostrar super-admin e explicar bloqueio financeiro sem bloquear cliente real.
