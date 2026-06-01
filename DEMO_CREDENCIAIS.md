# Credenciais Demo Comercial

Data: 2026-06-01
Branch: `produto-comercial-restaurantes`

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

## Links diretos no preview

- Landing comercial: `https://frontend-esbw4jz36-kcchb26-4366s-projects.vercel.app/comercial`
- Admin restaurante: `https://frontend-esbw4jz36-kcchb26-4366s-projects.vercel.app/r/demo-restaurante/admin`
- Mesa restaurante: `https://frontend-esbw4jz36-kcchb26-4366s-projects.vercel.app/r/demo-restaurante/mesa/demo-restaurante-mesa-1`
- Cozinha restaurante: `https://frontend-esbw4jz36-kcchb26-4366s-projects.vercel.app/r/demo-restaurante/cozinha`
- Garcom restaurante: `https://frontend-esbw4jz36-kcchb26-4366s-projects.vercel.app/r/demo-restaurante/garcom`
- Caixa restaurante: `https://frontend-esbw4jz36-kcchb26-4366s-projects.vercel.app/r/demo-restaurante/caixa`
- TV restaurante: `https://frontend-esbw4jz36-kcchb26-4366s-projects.vercel.app/r/demo-restaurante/tv`
- Admin pizzaria: `https://frontend-esbw4jz36-kcchb26-4366s-projects.vercel.app/r/demo-pizzaria/admin`
- Mesa pizzaria: `https://frontend-esbw4jz36-kcchb26-4366s-projects.vercel.app/r/demo-pizzaria/mesa/demo-pizzaria-mesa-1`
- Admin padaria: `https://frontend-esbw4jz36-kcchb26-4366s-projects.vercel.app/r/demo-padaria/admin`
- Mesa padaria: `https://frontend-esbw4jz36-kcchb26-4366s-projects.vercel.app/r/demo-padaria/mesa/demo-padaria-mesa-1`

## Status do ambiente publicado

- Vercel preview da branch `produto-comercial-restaurantes`: publicado e validado via `vercel curl`.
- Render: URL de producao respondeu `/health`, mas ainda esta na versao `018a5b3eff19`; nao foi alterado para nao quebrar producao sem confirmacao.
- Supabase: projeto `Restaurante` foi consultado em modo somente leitura. O schema comercial de estoque/tipo de negocio ainda nao esta aplicado.
- Seed demo comercial: pendente ate aplicar schema e configurar `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` em ambiente autorizado.

## Aviso

Essas credenciais sao exclusivamente para demo. Nao use em cliente real.
