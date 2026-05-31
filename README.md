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

## Módulos comerciais

A branch `produto-comercial-restaurantes` adiciona base de estoque, ficha técnica, baixa por venda, delivery/logística, exportações simples e preparação fiscal sem emissão real.

Antes de vender fora de piloto controlado:

- aplicar `SUPABASE_SCHEMA_COMERCIAL.sql` no Supabase;
- revisar RLS e permissões;
- rodar `python -m pytest -q` em venv compatível;
- rodar Playwright E2E do fluxo mesa -> cozinha -> caixa -> estoque;
- validar Render e Vercel depois do schema.

Documentos principais: `RELATORIO_COMERCIAL_FINAL.md`, `CHECKLIST_VENDA.md`, `CHECKLIST_IMPLANTACAO_CLIENTE.md`, `SECURITY_REVIEW.md` e `FISCAL_ROADMAP.md`.

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
