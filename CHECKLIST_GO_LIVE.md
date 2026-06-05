# Checklist Go-Live

## Banco

- Fazer backup/exportacao do banco.
- Confirmar ambiente correto no Supabase.
- Aplicar `backend/supabase_inventory_schema.sql`.
- Rodar `python backend/scripts/check_inventory_schema.py`.
- Validar RLS nas tabelas novas.
- Validar que nao ha dados reais em restaurantes `qa-inventory-*`.

## Smoke

- Rodar `python backend/scripts/smoke_inventory_real.py` em QA/staging.
- Confirmar criacao de fornecedor temporario.
- Confirmar criacao de insumo temporario.
- Confirmar entrada de estoque.
- Confirmar produto/ficha tecnica.
- Confirmar pedido entregue.
- Confirmar baixa automatica.
- Confirmar cancelamento/estorno.
- Confirmar limpeza dos dados temporarios.

## Aplicacao

- Testar login admin owner.
- Testar login manager.
- Testar aba Estoque.
- Testar pedido pela mesa.
- Testar cozinha marcando entregue.
- Testar caixa.
- Testar bloqueio financeiro.
- Testar permissoes de cashier/waiter/kitchen/tv sem acesso de escrita ao estoque.
- Validar logs/auditoria.

## Seguranca

- Confirmar `APP_ENV=production` no Render.
- Confirmar `CORS_ORIGINS` sem `*`.
- Confirmar `PUBLIC_FRONTEND_URL` com o dominio publicado.
- Confirmar `JWT_SECRET` forte e exclusivo do ambiente.
- Confirmar `SUPABASE_SERVICE_ROLE_KEY` apenas no backend/Render.
- Confirmar rate limit ativo:
  - login;
  - rotas publicas de pedido/chamado;
  - API geral.
- Confirmar headers de seguranca no `/health` e `/api/health`.
- Revisar [SEGURANCA_OPERACIONAL.md](SEGURANCA_OPERACIONAL.md).

## Deploy

- Validar deploy Render.
- Validar `/health` do backend.
- Validar deploy Vercel.
- Validar rotas:
  - `/super-admin`
  - `/r/{slug}/admin`
  - `/r/{slug}/mesa/{token}`
  - `/r/{slug}/cozinha`
  - `/r/{slug}/caixa`
  - `/r/{slug}/garcom`
  - `/r/{slug}/tv`

## Decisao

- Go-live aprovado somente se todos os itens acima passarem.
- Se falhar schema ou smoke, nao liberar para cliente.
