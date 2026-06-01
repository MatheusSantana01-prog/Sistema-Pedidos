# Relatorio Pre-Demo

Data: 2026-06-01
Branch: `produto-comercial-restaurantes`

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

- Vercel preview: publicado com sucesso a partir da branch `produto-comercial-restaurantes`.
- Deploy Vercel: `https://frontend-esbw4jz36-kcchb26-4366s-projects.vercel.app`
- Validacao Vercel: `/comercial`, `/super-admin` e `/r/demo-restaurante/admin` responderam via `vercel curl`.
- Render: `https://sistema-pedidos-zk2w.onrender.com/health` respondeu `200`, mas a versao retornada foi `018a5b3eff19`; portanto o backend comercial da branch ainda nao foi publicado no Render.
- Render staging: nao foi encontrado conector/API token de Render neste ambiente para criar ou trocar staging automaticamente.
- Supabase usado: projeto `Restaurante` (`lhrfemeunswviwzdpppp`), tratado como producao por falta de branch/staging confirmada.
- Schemas aplicados: nao. Consulta somente leitura mostrou que `suppliers`, `inventory_items`, `inventory_movements`, `product_recipes`, `product_recipe_items`, `inventory_counts`, `inventory_count_items`, `business_type` e `modules_config` ainda nao existem.
- Seed demo comercial: nao executado no Supabase publicado porque depende do schema e de `SUPABASE_SERVICE_ROLE_KEY` em ambiente autorizado.
- Smoke real de estoque: nao executado porque o schema de estoque ainda nao existe no Supabase conectado.

## Usuarios demo

Ver `DEMO_CREDENCIAIS.md`.

## Resultado dos testes

- `python -m py_compile main.py backend/main.py backend/app/core/config.py backend/app/core/database.py backend/app/core/security.py backend/scripts/seed_demo_comercial.py`: passou.
- `python -m pytest -q`: 42 testes passaram.
- `node --check` em todos os JS do frontend: passou.
- `npx playwright test`: 12 testes passaram e 4 foram pulados por falta de variaveis `E2E_*`.
- `python backend/scripts/seed_demo_comercial.py`: nao executou localmente porque `SUPABASE_URL` nao esta configurado neste PC.
- Deploy preview Vercel: passou.
- Render health: passou em producao atual, mas sem a branch comercial.
- Supabase schema check somente leitura: falhou para schema comercial porque as tabelas/colunas ainda nao existem.
- `python backend/scripts/check_inventory_schema.py`: bloqueado localmente por falta de `SUPABASE_URL`.
- `python backend/scripts/smoke_inventory_real.py`: bloqueado localmente por falta de `SUPABASE_URL`; o script agora falha com mensagem clara antes de carregar o backend.

Para criar os dados demo no ambiente autorizado:

```bash
python backend/scripts/check_inventory_schema.py
python backend/scripts/seed_demo_comercial.py
```

## Recomendacao final

Apresentar amanha somente se for usado um ambiente com backend atualizado e schema aplicado, ou se a apresentacao ficar limitada ao frontend/roteiro e ao ambiente de producao ja validado anteriormente. A branch comercial esta publicada na Vercel em preview, mas Render e Supabase ainda precisam de confirmacao operacional antes do teste real completo.

Pronto para piloto controlado: sim, apos publicar backend comercial no Render e aplicar schema em ambiente autorizado.
Pronto para venda ampla: nao.
