# Relatorio Pre-Demo

Data: 2026-06-02
Branch: `produto-comercial-restaurantes`
Commit publicado validado: `99ebd0483c0b19b9543aeb4e390420a6bddba24c`

## Pronto para apresentar

- Fluxo QR Code da mesa.
- Cozinha com status do pedido.
- Garcom para acompanhamento.
- Caixa com fechamento.
- Admin com cardapio, mesas, usuarios, configuracoes e estoque.
- Super-admin com restaurantes, planos, financeiro, suporte e bloqueios.
- Estoque basico com ficha tecnica e baixa automatica.
- Modularizacao por tipo de negocio.

## Pronto para vender de forma controlada

- Restaurante comum.
- Hamburgueria/bar/cafeteria com fluxo parecido com restaurante comum.
- Pizzaria como operacao basica, usando pizzas como produtos normais.
- Padaria como operacao basica, usando produtos de balcão como produtos normais.

## Em implantacao

- Pizza meio a meio avancada.
- Borda/tamanho de pizza como motor dedicado.
- Venda por peso com balanca.
- Producao padaria completa.
- Delivery com painel de entregador.
- Fiscal real.
- Integracao iFood.
- WhatsApp automatizado completo.

## Riscos

- Seed comercial depende de `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
- Estoque depende do schema `backend/supabase_inventory_schema.sql`.
- `business_type` em coluna fisica depende de `backend/supabase_business_type_schema.sql`; sem isso, o controle ainda fica salvo em `configuracoes`.
- Playwright autenticado pula testes quando `E2E_*` nao esta configurado.

## Links

- Frontend: `https://frontend-teal-nine-80.vercel.app`
- Preview Vercel branch comercial: `https://frontend-esbw4jz36-kcchb26-4366s-projects.vercel.app`
- Backend: `https://sistema-pedidos-zk2w.onrender.com`
- Super-admin: `https://frontend-teal-nine-80.vercel.app/super-admin`
- Landing: `https://frontend-teal-nine-80.vercel.app/comercial`
- Landing preview: `https://frontend-esbw4jz36-kcchb26-4366s-projects.vercel.app/comercial`

## Publicacao em ambiente testavel

- Vercel production: `READY` na branch `produto-comercial-restaurantes`.
- Deploy Vercel: `https://frontend-teal-nine-80.vercel.app`.
- Commit Vercel: `99ebd0483c0b19b9543aeb4e390420a6bddba24c`.
- Render: `https://sistema-pedidos-zk2w.onrender.com/health` respondeu `200`.
- Versao Render: `99ebd0483c0b`.
- Supabase usado: projeto `Restaurante` (`lhrfemeunswviwzdpppp`), sem secrets documentados.
- Schemas aplicados: sim. Existem `suppliers`, `inventory_items`, `inventory_movements`, `product_recipes`, `product_recipe_items`, `inventory_counts`, `inventory_count_items`, `business_type` e `modules_config`.
- RLS: ligado nas tabelas de estoque verificadas.
- Seed demo comercial: dados demo presentes para `demo-restaurante`, `demo-pizzaria` e `demo-padaria`.
- Smoke real publicado: executado via API publicada com dados demo/QA.

## Usuarios demo

Ver `DEMO_CREDENCIAIS.md`.

## Resultado dos testes

- `python -m py_compile main.py backend/main.py backend/app/core/config.py backend/app/core/database.py backend/app/core/security.py backend/scripts/seed_demo_comercial.py`: passou.
- `python -m pytest -q`: 42 testes passaram.
- `node --check` em todos os JS do frontend: passou.
- `npx playwright test` com ambiente publicado e variaveis `E2E_*`: 16 testes passaram.
- `python backend/scripts/seed_demo_comercial.py`: nao executou localmente porque `SUPABASE_URL` nao esta configurado neste PC.
- Seed equivalente no Supabase publicado: validado.
- Deploy preview Vercel: passou.
- Render health: passou com versao `99ebd0483c0b`.
- Supabase schema check por consulta: passou.
- `python backend/scripts/check_inventory_schema.py`: bloqueado localmente por falta de `SUPABASE_URL`.
- `python backend/scripts/smoke_inventory_real.py`: bloqueado localmente por falta de `SUPABASE_URL`; smoke equivalente foi executado no ambiente publicado via API.

## Smoke publicado

- Login admin demo: passou.
- Cardapio/produto demo: `Parmegiana executivo` encontrado.
- Pedido criado: numero `188`.
- Cozinha avancou status ate `entregue`.
- Estoque baixou de `7.82` para `7.64` kg no insumo demo.
- Caixa fechou conta em turno publicado.
- Super-admin bloqueou `demo-restaurante`, pedido publico foi recusado com `403`, e depois desbloqueou o restaurante.

Para criar os dados demo no ambiente autorizado:

```bash
python backend/scripts/check_inventory_schema.py
python backend/scripts/seed_demo_comercial.py
```

## Recomendacao final

Apresentar amanha: sim.

Pronto para piloto controlado: sim, usando restaurantes demo/QA e validando o fluxo no cliente antes da instalacao.
Pronto para venda ampla: nao.
