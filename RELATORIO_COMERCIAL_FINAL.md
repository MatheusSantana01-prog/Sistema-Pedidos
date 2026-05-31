# Relatorio Comercial Final

Data: 2026-05-31
Branch: `produto-comercial-restaurantes`
Ultimo commit revisado: `47bbf82 Corrige smoke real de estoque`

## Status

O Sistema-Pedidos saiu da etapa de validacao do caixa e recebeu o primeiro modulo comercial voltado a restaurantes maiores: estoque basico com ficha tecnica, baixa automatica por venda, alertas e relatorio resumido.

Nesta rodada, o sistema ganhou modularizacao por tipo de negocio com `business_type`, `modules_config` e ocultacao de abas no admin conforme o perfil do restaurante.

## Entregue nesta etapa

- Schema SQL de estoque para Supabase.
- Rotas admin de insumos, movimentacoes, fornecedores, alertas, resumo e ficha tecnica.
- Aba `Estoque` no painel admin.
- Modularizacao por tipo de negocio no super-admin e no admin.
- Baixa automatica de estoque quando pedido e entregue.
- Estorno quando pedido cancelado ja tinha baixado estoque.
- Testes backend para regras de estoque.
- Playwright E2E versionado com smoke e fluxo autenticado opcional.
- Documentacao comercial, manual de estoque e checklist de implantacao.

## Validacoes executadas

- `python -m py_compile main.py backend/main.py backend/app/core/config.py backend/app/core/database.py backend/app/core/security.py`: passou.
- `python -m pytest -q`: 37 testes passaram apos a revisao de estoque.
- `node --check` em todos os JavaScript do frontend: passou.
- `node --check` em `playwright.config.js` e testes E2E: passou.
- `npx playwright test`: 12 testes passaram e 4 foram pulados por falta de variaveis `E2E_*`, sem uso de dados reais.
- `npm install` foi necessario localmente para carregar `@playwright/test` antes do runner.
- `python backend/scripts/check_inventory_schema.py`: bloqueado localmente por falta de `SUPABASE_URL`/credencial QA configurada.
- `python backend/scripts/smoke_inventory_real.py`: nao executado porque nao havia ambiente Supabase QA/staging configurado; nao foi usado dado real.

## Evidencia do smoke de estoque

- Arquivo: `tests/test_inventory_smoke.py`.
- Scripts operacionais adicionados:
  - `backend/scripts/check_inventory_schema.py`
  - `backend/scripts/smoke_inventory_real.py`
- Dados usados: fornecedor QA, insumo QA, produto QA, ficha tecnica QA, pedido QA e dois restaurantes temporarios em memoria.
- Fluxo validado: entrada de estoque, entrega do pedido, baixa automatica por ficha tecnica, protecao contra baixa duplicada, cancelamento/estorno e protecao contra estorno duplicado.
- Multi-tenant validado: insumo do restaurante A nao e encontrado pelo restaurante B.
- Permissoes validadas: `owner` e `manager` passam; `cashier`, `waiter`, `kitchen` e `tv` recebem 403.
- Schema validado por teste: tabelas obrigatorias, RLS habilitado, grants para `service_role`, pre-checagem de `restaurants`/`produtos` e indice unico para uma ficha ativa por produto.
- Frontend validado por teste: aba Estoque possui mensagem clara quando o schema ainda nao foi aplicado.
- Schema complementar de modularizacao adicionado em `backend/supabase_business_type_schema.sql`.
- Testes novos validam `business_type`, visibilidade de tabs e contrato modular.

## Pendencias humanas

- Abrir PR manualmente se a integracao GitHub nao tiver permissao: `https://github.com/MatheusSantana01-prog/Sistema-Pedidos/pull/new/produto-comercial-restaurantes`.
- Aplicar `backend/supabase_inventory_schema.sql` no Supabase QA/staging antes de producao.
- Configurar `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` localmente ou no ambiente CI seguro.
- Rodar `python backend/scripts/check_inventory_schema.py` com variaveis de ambiente QA/staging.
- Rodar `python backend/scripts/smoke_inventory_real.py` somente em QA/staging ou em producao autorizada com restaurante temporario `qa-inventory-*`.
- Autorizar qualquer aplicacao de schema em producao.

## Regras de seguranca preservadas

- `restaurant_id` vem do JWT nas rotas autenticadas.
- `owner` e `manager` podem gerenciar estoque.
- Perfis operacionais nao alteram estoque.
- Nenhum segredo foi adicionado ao frontend.
- O schema fica separado para aplicacao controlada no Supabase.

## Riscos antes de vender para restaurante grande

- O schema novo precisa ser aplicado no Supabase antes do deploy das rotas de estoque.
- Ainda nao ha conversao automatica entre unidades.
- Inventario fisico completo ainda precisa de tela dedicada.
- Relatorios de dono ainda sao iniciais.
- Fiscal segue apenas preparado, sem emissao real.
- Pizzaria, padaria e delivery estao em base modular, mas ainda faltam regras operacionais completas.

## Recomendacao

Pronto para demonstracao comercial controlada e piloto com restaurante pequeno/medio que aceite acompanhamento. Para restaurante grande, concluir antes: inventario completo, relatorios gerenciais de margem/CMV, delivery/logistica e auditoria expandida.

## Marcadores de prontidao

- Pronto para demo: sim, com schema aplicado e business type configurado.
- Pronto para venda controlada: sim, se `check_inventory_schema.py` e `smoke_inventory_real.py` passarem no ambiente do cliente/QA.
- Pronto para grande empresa: nao. Ainda faltam inventario completo, conversao de unidades, relatorios gerenciais avancados, delivery operacional e fiscal real.
