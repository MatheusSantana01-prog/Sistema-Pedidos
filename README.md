# Sistema-Pedidos

SaaS de pedidos para restaurantes com operação multi-tenant por slug. O sistema atende cliente por QR Code, garçom, cozinha, caixa, painel administrativo do restaurante e super-admin da plataforma.

## Stack

- Backend: FastAPI, Supabase, JWT, bcrypt.
- Banco: Supabase/PostgreSQL.
- Frontend: HTML, CSS e JavaScript puro.
- Backend deploy: Render.
- Frontend deploy: Vercel.

## Estrutura

- `main.py`: entrada legada/local do backend.
- `backend/main.py`: entrada usada pelo Render.
- `backend/app/core/`: configuração, Supabase e segurança extraídos do backend.
- `backend/scripts/seed_demo.py`: seed seguro para dados de demonstração.
- `frontend/`: telas publicadas na Vercel.
- `frontend/shared/`: configuração, autenticação e utilitários compartilhados.
- `tests/`: testes básicos com mocks/env de teste.
- `e2e/`: testes Playwright de smoke e fluxos QA opcionais.

As telas ativas do frontend mantêm o padrão `index.html`, `styles.css` e `app.js`. Evite voltar a juntar HTML, CSS e JS em um único arquivo.

## Variáveis de ambiente

Configure no Render ou `.env` local:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `JWT_EXP_HOURS`
- `JWT_REMEMBER_DAYS`
- `APP_ENV`
- `CORS_ORIGINS`
- `PUBLIC_FRONTEND_URL`
- `KITCHEN_READY_VISIBLE_MINUTES`

Nunca coloque `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET` ou senhas reais no frontend ou no GitHub.

## Estoque

O modulo de estoque comercial fica no painel admin do restaurante, aba `Estoque`, e cobre insumos, fornecedores, movimentacoes, alertas, relatorios e ficha tecnica por produto.

Antes de usar em ambiente publicado, aplique o schema em [backend/supabase_inventory_schema.sql](backend/supabase_inventory_schema.sql) no Supabase. As rotas usam sempre o `restaurant_id` do JWT; o frontend nao envia nem controla esse escopo.

Rotas principais:

- `GET/POST/PATCH /api/admin/inventory/items`
- `POST /api/admin/inventory/items/{id}/deactivate`
- `GET/POST /api/admin/inventory/movements`
- `GET /api/admin/inventory/alerts`
- `GET /api/admin/inventory/reports/summary`
- `GET/PUT /api/admin/products/{id}/recipe`

## Rodar local

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Frontend local:

```bash
cd frontend
python local_server.py
```

## Testes

Os testes de CI usam variáveis falsas e cobrem importação do backend, health check, JWT, isolamento básico por `restaurant_id`, regras de cozinha e fechamento de conta em nível de lógica.

```bash
pytest -q
python -m py_compile main.py backend/main.py
```

Fluxos completos com Supabase real devem ser testados em ambiente de staging ou produção controlada.

Playwright:

```bash
npm install
npx playwright install chromium
npx playwright test
```

Os testes autenticados só rodam quando as variáveis `E2E_RESTAURANT_SLUG`, `E2E_OWNER_EMAIL`, `E2E_OWNER_PASSWORD` e, para mesa, `E2E_TABLE_TOKEN` forem informadas. Use apenas restaurantes QA.

## Deploy

Render usa a pasta `backend/` com:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2
```

Vercel usa a pasta `frontend/` e o proxy `/api/*` para o backend do Render.

Veja [DEPLOY.md](DEPLOY.md) para o passo a passo.

## Seed demo

O script cria restaurante, categorias, produtos, mesas e usuários demo.

```bash
python backend/scripts/seed_demo.py
```

Por padrão a senha demo é `demo123`. Para piloto real, defina `DEMO_PASSWORD` e altere as senhas logo após criar os usuários.

## Fluxo principal

1. Cliente acessa `/r/{slug}/mesa/{token}`, vê cardápio, envia pedido e consulta conta.
2. Cozinha acessa `/r/{slug}/cozinha`, recebe pedidos e avança status até entregue.
3. Garçom acessa `/r/{slug}/garcom`, acompanha mesas e chamados, se o plano permitir.
4. Caixa acessa `/r/{slug}/caixa`, abre turno, fecha contas e registra pagamentos.
5. Admin acessa `/r/{slug}/admin`, gerencia cardápio, mesas, usuários, caixas e configurações.
6. Super-admin acessa `/super-admin`, gerencia restaurantes, planos, financeiro, suporte e bloqueios.

## Documentos

- [AUDITORIA_TECNICA.md](AUDITORIA_TECNICA.md)
- [CHECKLIST_PILOTO.md](CHECKLIST_PILOTO.md)
- [ROADMAP.md](ROADMAP.md)
- [MANUAL_ESTOQUE.md](MANUAL_ESTOQUE.md)
- [CHECKLIST_VENDA.md](CHECKLIST_VENDA.md)
- [CHECKLIST_IMPLANTACAO_CLIENTE.md](CHECKLIST_IMPLANTACAO_CLIENTE.md)
