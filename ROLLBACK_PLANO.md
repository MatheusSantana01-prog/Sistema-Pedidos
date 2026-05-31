# Plano de Rollback

## Rollback de codigo

- Nao fazer merge automatico na `main`.
- Se a branch for publicada e precisar voltar, reverter deploy para o commit anterior validado.
- Commit de referencia do caixa validado: `018a5b3`.
- Tag de referencia: `v1-caixa-validado`.

## Rollback Render

1. Abrir o servico backend no Render.
2. Ir em `Deploys`.
3. Selecionar o ultimo deploy estavel antes do modulo de estoque.
4. Clicar em `Rollback`.
5. Validar `/health`.

## Rollback Vercel

1. Abrir o projeto frontend na Vercel.
2. Ir em `Deployments`.
3. Selecionar o deploy estavel anterior.
4. Promover/rollback para producao.
5. Validar rotas admin, mesa, cozinha, caixa e super-admin.

## Cuidado com rollback de schema

Nao apagar tabelas de estoque se houver dados reais.

Tabelas que nao devem ser apagadas sem backup e autorizacao:

- `suppliers`
- `inventory_items`
- `inventory_movements`
- `product_recipes`
- `product_recipe_items`
- `inventory_counts`
- `inventory_count_items`

## O que nao deve ser apagado

- Movimentacoes reais de estoque.
- Fichas tecnicas configuradas por cliente.
- Dados financeiros.
- Pedidos, sessoes de mesa e fechamento de caixa.
- Usuarios e memberships.

## Como desativar a aba Estoque se necessario

Opcao preferida:

- Fazer rollback do frontend na Vercel para deploy anterior.

Opcao de codigo:

- Remover/ocultar a nav tab `Estoque` em `frontend/r/admin/index.html`.
- Manter backend/schema intactos para nao perder dados.
- Fazer novo deploy frontend.

## Recuperacao

- Depois de rollback, rodar smoke principal de pedido/cozinha/caixa.
- Validar que a aba Estoque nao aparece ou mostra mensagem segura.
- Registrar o incidente em `RELATORIO_COMERCIAL_FINAL.md`.

