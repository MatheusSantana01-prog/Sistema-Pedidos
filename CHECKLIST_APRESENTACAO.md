# Checklist de Apresentacao

## Antes de sair

- Confirmar internet.
- Abrir Vercel: `https://frontend-teal-nine-80.vercel.app`
- Abrir Render health: `https://sistema-pedidos-zk2w.onrender.com/health`
- Rodar seed demo em QA/producao autorizada, se ainda nao rodou:

```bash
python backend/scripts/seed_demo_comercial.py
```

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
- Landing comercial: `/comercial`

## O que testar antes de apresentar

- Login admin.
- Abrir QR da mesa.
- Enviar pedido.
- Pedido aparecer na cozinha.
- Avancar status ate entregue.
- Caixa fechar conta.
- Admin carregar estoque.
- Super-admin abrir detalhes do restaurante.

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

