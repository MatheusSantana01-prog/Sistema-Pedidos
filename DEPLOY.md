# Deploy

## Render

Configuração atual:

- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2`

Variáveis obrigatórias:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `JWT_EXP_HOURS`
- `APP_ENV=production`
- `CORS_ORIGINS`
- `PUBLIC_FRONTEND_URL`
- `KITCHEN_READY_VISIBLE_MINUTES`

Após deploy, validar:

```bash
curl https://sistema-pedidos-zk2w.onrender.com/health
```

## Vercel

Configuração atual:

- Root directory: `frontend`
- Rotas estáticas via `frontend/vercel.json`
- Proxy `/api/:path*` para o Render

Rotas que precisam responder:

- `/r/:slug/mesa/:token`
- `/r/:slug/admin`
- `/r/:slug/garcom`
- `/r/:slug/cozinha`
- `/r/:slug/caixa`
- `/r/:slug/tv`
- `/super-admin`

## Supabase

O backend usa service role. Essa chave nunca deve aparecer no frontend. A anon key, se usada no futuro, só pode ser usada para operações públicas controladas por RLS.

Para a branch `produto-comercial-restaurantes`, aplicar os schemas nesta ordem:

1. `backend/supabase_inventory_schema.sql`
2. `backend/supabase_business_type_schema.sql`
3. `backend/supabase_payment_methods_schema.sql`
4. `backend/supabase_security_hardening.sql`

O hardening deve ser o ultimo passo porque remove acesso direto de `anon/authenticated` ao Data API e preserva apenas o backend com `service_role`. O arquivo `SUPABASE_SCHEMA_COMERCIAL.sql` fica como referencia complementar para delivery/fiscal e nao deve ser aplicado em producao sem revisao.

Antes de piloto:

- Confirmar tabelas e RPCs esperadas pelo backend.
- Confirmar backups.
- Confirmar usuários reais com senhas alteradas.
- Confirmar restaurante demo separado de clientes reais.
- Confirmar tabelas `inventory_items`, `inventory_movements`, `suppliers`, `product_recipes`, `product_recipe_items`, `inventory_counts` e `inventory_count_items`.
- Confirmar colunas fiscais em `produtos` apenas quando a etapa fiscal for habilitada.
- Confirmar que `anon` nao possui `SELECT` em `usuarios/pedidos`.
- Confirmar que funcoes `SECURITY DEFINER` nao podem ser executadas por `anon/authenticated`.

## Critério para deploy comercial

Não publicar em produção sem:

- schema aplicado;
- `python -m pytest -q` passando em venv compatível;
- `node --check` em todos os JS;
- smoke real de caixa e estoque.
