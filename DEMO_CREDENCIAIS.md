# Credenciais Demo Comercial

Data: 2026-06-02
Branch: `produto-comercial-restaurantes`
Commit publicado validado: `99ebd0483c0b19b9543aeb4e390420a6bddba24c`

## Senha padrao

Senha demo padrao:

```text
Demo@2026
```

Pode ser alterada ao rodar o seed:

```bash
$env:DEMO_COMERCIAL_PASSWORD="OutraSenhaDemo"
python backend/scripts/seed_demo_comercial.py
```

## Restaurantes

### Restaurante

- Slug: `demo-restaurante`
- Admin: `owner@demo-restaurante.com`
- Garcom: `waiter@demo-restaurante.com`
- Cozinha: `kitchen@demo-restaurante.com`
- Caixa: `cashier@demo-restaurante.com`
- Mesa 1: `/r/demo-restaurante/mesa/demo-restaurante-mesa-1`

### Pizzaria

- Slug: `demo-pizzaria`
- Admin: `owner@demo-pizzaria.com`
- Garcom: `waiter@demo-pizzaria.com`
- Cozinha: `kitchen@demo-pizzaria.com`
- Caixa: `cashier@demo-pizzaria.com`
- Mesa 1: `/r/demo-pizzaria/mesa/demo-pizzaria-mesa-1`

### Padaria

- Slug: `demo-padaria`
- Admin: `owner@demo-padaria.com`
- Garcom: `waiter@demo-padaria.com`
- Cozinha: `kitchen@demo-padaria.com`
- Caixa: `cashier@demo-padaria.com`
- Mesa 1: `/r/demo-padaria/mesa/demo-padaria-mesa-1`

## Links base

- Frontend Vercel: `https://frontend-teal-nine-80.vercel.app`
- Preview Vercel da branch comercial: `https://frontend-esbw4jz36-kcchb26-4366s-projects.vercel.app`
- Backend Render: `https://sistema-pedidos-zk2w.onrender.com`
- Super-admin: `https://frontend-teal-nine-80.vercel.app/super-admin`
- Super-admin preview: `https://frontend-esbw4jz36-kcchb26-4366s-projects.vercel.app/super-admin`

## Links diretos publicados

- Landing comercial: `https://frontend-teal-nine-80.vercel.app/comercial`
- Admin restaurante: `https://frontend-teal-nine-80.vercel.app/r/demo-restaurante/admin`
- Mesa restaurante: `https://frontend-teal-nine-80.vercel.app/r/demo-restaurante/mesa/demo-restaurante-mesa-1`
- Cozinha restaurante: `https://frontend-teal-nine-80.vercel.app/r/demo-restaurante/cozinha`
- Garcom restaurante: `https://frontend-teal-nine-80.vercel.app/r/demo-restaurante/garcom`
- Caixa restaurante: `https://frontend-teal-nine-80.vercel.app/r/demo-restaurante/caixa`
- TV restaurante: `https://frontend-teal-nine-80.vercel.app/r/demo-restaurante/tv`
- Admin pizzaria: `https://frontend-teal-nine-80.vercel.app/r/demo-pizzaria/admin`
- Mesa pizzaria: `https://frontend-teal-nine-80.vercel.app/r/demo-pizzaria/mesa/demo-pizzaria-mesa-1`
- Admin padaria: `https://frontend-teal-nine-80.vercel.app/r/demo-padaria/admin`
- Mesa padaria: `https://frontend-teal-nine-80.vercel.app/r/demo-padaria/mesa/demo-padaria-mesa-1`

## Status do ambiente publicado

- Vercel production da branch `produto-comercial-restaurantes`: publicado e validado.
- Render: URL de producao respondeu `/health` com versao `99ebd0483c0b`.
- Supabase: projeto `Restaurante` validado com schema comercial de estoque/tipo de negocio aplicado e RLS ativo nas tabelas de estoque.
- Seed demo comercial: dados demo presentes para restaurante, pizzaria e padaria.
- Smoke publicado: pedido, cozinha, caixa, baixa de estoque e bloqueio/desbloqueio foram validados.

## Aviso

Essas credenciais sao exclusivamente para demo. Nao use em cliente real.

## Verificacao publicada - 2026-06-05

- Vercel production: `READY`.
- Vercel commit: `e3b5a189f2417e4875ebbde6061a5ad7083c8047`.
- Vercel branch: `produto-comercial-restaurantes`.
- Render `/health`: `ok`.
- Render version: `9b0bb5d9a199`.

Rotas demo verificadas com HTTP 200:

- `https://frontend-teal-nine-80.vercel.app/comercial`
- `https://frontend-teal-nine-80.vercel.app/super-admin`
- `https://frontend-teal-nine-80.vercel.app/r/demo-restaurante/admin`
- `https://frontend-teal-nine-80.vercel.app/r/demo-restaurante/mesa/demo-restaurante-mesa-1`
- `https://frontend-teal-nine-80.vercel.app/r/demo-restaurante/cozinha`
- `https://frontend-teal-nine-80.vercel.app/r/demo-restaurante/garcom`
- `https://frontend-teal-nine-80.vercel.app/r/demo-restaurante/caixa`
- `https://frontend-teal-nine-80.vercel.app/r/demo-restaurante/tv`

Observacao operacional:

- O seed demo e o smoke real nao foram executados nesta maquina em 2026-06-05 porque `SUPABASE_URL` nao esta configurado no ambiente local.
- Antes de uma apresentacao importante, entrar no admin com as credenciais demo e confirmar manualmente que os dados demo ainda existem no Supabase publicado.
