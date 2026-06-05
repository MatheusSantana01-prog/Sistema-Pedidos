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

## Verificacao final publicada - 2026-06-05

Branch local: `produto-comercial-restaurantes`.

Commits recentes:

- `e3b5a18` - Corrige helper da movimentacao de estoque.
- `9b0bb5d` - Melhora logica de movimentacao de estoque.
- `d703b6a` - Corrige salvamento de foto do produto.
- `a2661a6` - Corrige estoque e movimentacao rapida.
- `969d37a` - Consolida limites e modulos comerciais.

Ambiente publicado:

- Vercel production: `READY`.
- Vercel branch: `produto-comercial-restaurantes`.
- Vercel commit: `e3b5a189f2417e4875ebbde6061a5ad7083c8047`.
- Vercel URL: `https://frontend-teal-nine-80.vercel.app`.
- Render URL: `https://sistema-pedidos-zk2w.onrender.com`.
- Render `/health`: `ok`.
- Render version: `9b0bb5d9a199`.
- Observacao: Render esta em `9b0bb5d`, que e mais novo que `99ebd048` e contem as mudancas de backend comerciais. O commit `e3b5a18` foi apenas frontend.

Rotas publicadas verificadas com HTTP 200:

- `/comercial`
- `/super-admin`
- `/r/demo-restaurante/admin`
- `/r/demo-restaurante/mesa/demo-restaurante-mesa-1`
- `/r/demo-restaurante/cozinha`
- `/r/demo-restaurante/garcom`
- `/r/demo-restaurante/caixa`
- `/r/demo-restaurante/tv`

Validadacoes executadas:

- `python -m py_compile main.py backend/main.py backend/app/core/config.py backend/app/core/database.py backend/app/core/security.py backend/scripts/seed_demo_comercial.py`: passou.
- `python -m pytest -q`: 53 testes passaram.
- `node --check` em todos os JS do frontend/e2e: passou.
- `npx playwright test`: 12 testes passaram, 4 foram pulados por falta de variaveis QA autenticadas.

Supabase, seed e smoke real:

- `python backend/scripts/check_inventory_schema.py`: bloqueado localmente por falta de `SUPABASE_URL`.
- `python backend/scripts/seed_demo_comercial.py`: bloqueado localmente por falta de `SUPABASE_URL`.
- `python backend/scripts/smoke_inventory_real.py`: bloqueado localmente por falta de `SUPABASE_URL`.
- Nenhum dado real foi apagado ou alterado nesta verificacao.

Pendencia para fechar 100% do ambiente com banco real:

```powershell
$env:SUPABASE_URL="https://SEU-PROJETO.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="SUA_SERVICE_ROLE_KEY"
python backend/scripts/check_inventory_schema.py
python backend/scripts/seed_demo_comercial.py
python backend/scripts/smoke_inventory_real.py
```

Recomendacao atualizada:

- Apresentacao/demo: sim.
- Piloto controlado: sim, com validacao manual das credenciais demo no navegador antes da reuniao.
- Venda ampla: ainda nao, enquanto o smoke real Supabase nao for rodado com credenciais QA/staging.

## Correcao operacional da demo - 2026-06-05

Bug real encontrado:

- Os slugs `demo-restaurante`, `demo-pizzaria` e `demo-padaria` estavam documentados, mas nao existiam no Supabase publicado.
- Resultado: Playwright carregava tela de "Restaurante nao encontrado" e login `owner@demo-restaurante.com` falhava com `401`.

Correcao executada:

- Criados `demo-restaurante`, `demo-pizzaria` e `demo-padaria` pelo super-admin publicado.
- Rodado repair-seed via API publicada para categorias, produtos e mesas.
- Criados usuarios demo:
  - restaurante: owner, garcom, cozinha e caixa;
  - pizzaria: owner, garcom, cozinha e caixa;
  - padaria: owner, cozinha e caixa.
- Padaria nao recebeu garcom porque o tipo `padaria` desativa esse modulo por regra comercial.
- Tokens de mesa 1 ajustados no Supabase publicado:
  - `demo-restaurante-mesa-1`;
  - `demo-pizzaria-mesa-1`;
  - `demo-padaria-mesa-1`.

Validacao:

- Login owner dos tres demos: passou.
- Mesa 1 dos tres demos: HTTP 200.
- Playwright publicado apos correcao: 16/16 passou.
- Ajustado E2E para tratar HTTP 429 de login com retry e mensagem clara.
- Ajustado frontend para exibir "Muitas tentativas de login" quando o backend retornar 429.

Recomendacao:

- Antes de apresentar, abrir admin `demo-restaurante` e aguardar 60 segundos se houver muitas tentativas recentes de login.
- Para venda, usar `demo-restaurante` como fluxo principal.
