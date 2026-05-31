# Pull Request

Link direto para abrir:

https://github.com/MatheusSantana01-prog/Sistema-Pedidos/pull/new/produto-comercial-restaurantes

## Titulo

Prepara produto comercial de estoque

## Descricao

Esta branch consolida o modulo comercial de estoque para restaurantes maiores, mantendo a producao atual protegida e sem merge automatico.

## Mudancas principais

- Modulo admin de estoque com insumos, fornecedores, movimentacoes, alertas, relatorios e ficha tecnica.
- Schema Supabase em `backend/supabase_inventory_schema.sql`.
- Baixa automatica de estoque quando pedido e entregue.
- Estorno automatico quando pedido ja baixado e cancelado.
- Smoke automatizado de estoque com dados temporarios.
- Scripts operacionais:
  - `backend/scripts/check_inventory_schema.py`
  - `backend/scripts/smoke_inventory_real.py`
- Documentacao de go-live, rollback e aplicacao do schema.

## Checklist

- [ ] Revisar diff completo.
- [ ] Confirmar que nao ha secrets no frontend ou no GitHub.
- [ ] Fazer backup do Supabase antes de aplicar schema.
- [ ] Aplicar `backend/supabase_inventory_schema.sql` em QA/staging.
- [ ] Rodar `python backend/scripts/check_inventory_schema.py`.
- [ ] Rodar `python backend/scripts/smoke_inventory_real.py` apenas em QA/staging.
- [ ] Validar Render.
- [ ] Validar Vercel.
- [ ] Testar admin, estoque, pedido, cozinha, caixa e bloqueio financeiro.

## Testes

- `python -m py_compile main.py backend/main.py backend/app/core/config.py backend/app/core/database.py backend/app/core/security.py`
- `python -m pytest -q`
- `node --check` em todos os JS do frontend
- `node --check playwright.config.js` e testes E2E
- `npx playwright test`

## Riscos

- O schema adiciona tabelas novas; rollback de schema deve ser tratado com cuidado para nao apagar movimentacoes reais.
- O smoke real deve rodar somente com restaurante temporario `qa-inventory-*`.
- Delivery/fiscal seguem como proximas etapas, sem emissao fiscal real.

## Observacao

`gh` nao esta instalado neste PC e a integracao GitHub retornou 403 ao tentar criar o PR automaticamente.
