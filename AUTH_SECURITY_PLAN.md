# Auth Security Plan

## Estado atual

- Login emite JWT com `restaurant_id`, `role` e dados do usuário.
- Backend valida autorização por endpoint.
- Frontend guarda sessão em `localStorage`.

## Plano

P0:
- Manter `restaurant_id` somente no token/backend.
- Testar bloqueio de usuário de outro restaurante em todos os módulos.
- Garantir expiração curta e segredo forte em produção.

P1:
- Migrar sessão para cookie `HttpOnly`, `Secure`, `SameSite=Lax/Strict`.
- Criar refresh token rotativo.
- Adicionar logout global por usuário inativado.

P2:
- MFA para super-admin e owner.
- Trilha de auditoria para login, logout, senha, bloqueio e troca de perfil.
- Rate limit em login e endpoints críticos.

## Não fazer

- Não enviar service role key para frontend.
- Não aceitar `restaurant_id` em payload para rotas administrativas.
- Não emitir fiscal real sem provedor certificado e homologação.
