# Relatorio Comercial Final

Data: 2026-05-31
Branch: `produto-comercial-restaurantes`

## Status

O Sistema-Pedidos saiu da etapa de validacao do caixa e recebeu o primeiro modulo comercial voltado a restaurantes maiores: estoque basico com ficha tecnica, baixa automatica por venda, alertas e relatorio resumido.

## Entregue nesta etapa

- Schema SQL de estoque para Supabase.
- Rotas admin de insumos, movimentacoes, fornecedores, alertas, resumo e ficha tecnica.
- Aba `Estoque` no painel admin.
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

## Evidencia do smoke de estoque

- Arquivo: `tests/test_inventory_smoke.py`.
- Dados usados: fornecedor QA, insumo QA, produto QA, ficha tecnica QA, pedido QA e dois restaurantes temporarios em memoria.
- Fluxo validado: entrada de estoque, entrega do pedido, baixa automatica por ficha tecnica, protecao contra baixa duplicada, cancelamento/estorno e protecao contra estorno duplicado.
- Multi-tenant validado: insumo do restaurante A nao e encontrado pelo restaurante B.
- Permissoes validadas: `owner` e `manager` passam; `cashier`, `waiter`, `kitchen` e `tv` recebem 403.
- Schema validado por teste: tabelas obrigatorias, RLS habilitado, grants para `service_role`, pre-checagem de `restaurants`/`produtos` e indice unico para uma ficha ativa por produto.
- Frontend validado por teste: aba Estoque possui mensagem clara quando o schema ainda nao foi aplicado.

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

## Recomendacao

Pronto para demonstracao comercial controlada e piloto com restaurante pequeno/medio que aceite acompanhamento. Para restaurante grande, concluir antes: inventario completo, relatorios gerenciais de margem/CMV, delivery/logistica e auditoria expandida.
