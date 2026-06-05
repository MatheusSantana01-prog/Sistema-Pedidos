# Seguranca Operacional

Data: 2026-06-05
Branch: `produto-comercial-restaurantes`

Este documento registra o estado atual de seguranca e os proximos passos para evoluir o Sistema-Pedidos de piloto controlado para operacao profissional.

## Controles implementados

- JWT com `restaurant_id`, `role` e expiracao.
- Backend usa `restaurant_id` do token em rotas autenticadas.
- Service role do Supabase fica no backend.
- Rotas administrativas protegidas por perfil.
- Super-admin separado por `require_super_admin`.
- Headers de seguranca no backend:
  - `x-content-type-options: nosniff`
  - `referrer-policy: strict-origin-when-cross-origin`
  - `x-frame-options: DENY`
  - `cache-control: no-store` em `/api/*`
- Rate limit em memoria:
  - login: 10 tentativas por minuto por IP;
  - escritas publicas: 60 por minuto por IP;
  - API geral: 600 por minuto por IP.
- CORS com default restrito ao dominio publicado:
  - `https://frontend-teal-nine-80.vercel.app`
  - localhost continua liberado para desenvolvimento.
- Vercel com CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy` e `Permissions-Policy`.
- Auditoria para acoes criticas ja existente em `audit_log`.
- Backup/exportacao via rotas de super-admin ja existente.

## Variaveis recomendadas no Render

```text
APP_ENV=production
PUBLIC_FRONTEND_URL=https://frontend-teal-nine-80.vercel.app
CORS_ORIGINS=https://frontend-teal-nine-80.vercel.app
JWT_EXP_HOURS=12
JWT_REMEMBER_DAYS=30
KITCHEN_READY_VISIBLE_MINUTES=15
```

Se houver dominio proprio, adicionar em `CORS_ORIGINS` separado por virgula:

```text
CORS_ORIGINS=https://frontend-teal-nine-80.vercel.app,https://app.seudominio.com.br
```

## Limites conhecidos

- O rate limit atual e em memoria. Em Render com multiplas instancias, o ideal e Redis/Upstash.
- O frontend ainda usa `localStorage` para JWT.
- A CSP ainda usa `unsafe-inline` para manter compatibilidade com HTML/JS atual.
- Imagens de produto ainda podem usar `data:image`; para escala, migrar para Supabase Storage.
- MFA para super-admin ainda nao foi implementado.
- Smoke real Supabase depende de credenciais QA/staging.

## Checklist antes de cliente real

- Confirmar `CORS_ORIGINS` sem `*` no Render.
- Confirmar `APP_ENV=production`.
- Confirmar `JWT_SECRET` forte.
- Confirmar `SUPABASE_SERVICE_ROLE_KEY` apenas no backend/Render.
- Rodar:

```powershell
python backend/scripts/check_inventory_schema.py
python backend/scripts/smoke_inventory_real.py
```

- Testar login por perfil:
  - owner;
  - manager;
  - cashier;
  - waiter;
  - kitchen;
  - tv;
  - super_admin.
- Testar multi-tenant com dois restaurantes QA.
- Validar backup/exportacao pelo super-admin.
- Validar rollback do Render e Vercel.

## Proximos passos enterprise

1. Migrar rate limit para Redis/Upstash.
2. Remover `unsafe-inline` gradualmente.
3. Migrar JWT para cookie HttpOnly ou estrategia hibrida.
4. Implementar MFA para super-admin.
5. Criar job automatico de backup.
6. Adicionar monitoramento externo de uptime.
7. Adicionar testes E2E autenticados obrigatorios no CI.
8. Validar RLS Supabase em ambiente QA/staging.
