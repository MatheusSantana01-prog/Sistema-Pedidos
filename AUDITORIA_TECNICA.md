# Auditoria Técnica

## Arquitetura atual

O projeto é um SaaS multi-tenant para restaurantes. O backend é FastAPI com Supabase e JWT; o frontend é estático, em HTML, CSS e JavaScript puro, publicado na Vercel. O backend de produção está no Render e usa `backend/main.py`.

Arquivos principais:

- `backend/main.py`: API usada no Render.
- `main.py`: cópia legada/local da API. Deve continuar sincronizada enquanto existir.
- `backend/app/core/config.py`: leitura e validação de variáveis de ambiente.
- `backend/app/core/database.py`: cliente Supabase com service role somente no backend.
- `backend/app/core/security.py`: hash de senha, JWT, RBAC e extração de `restaurant_id`.
- `frontend/vercel.json`: CSP, headers e rewrites para rotas estáticas e proxy `/api`.
- `frontend/shared/auth.js`: autenticação, token JWT e login salvo.
- `frontend/shared/config.js`: URL da API e WhatsApp de suporte.

## Observações de segurança

- Não foi encontrado `SUPABASE_SERVICE_ROLE_KEY` no frontend. A chave service role deve permanecer somente no backend/Render.
- As rotas autenticadas usam `restaurant_id` do JWT via `get_restaurant_id_from_token`. Esse padrão deve ser mantido em qualquer rota nova.
- Rotas públicas de mesa validam `slug` e `table_token` contra Supabase antes de operar.
- O frontend ainda usa `localStorage` para JWT e login salvo. Isso é funcional, mas aumenta impacto em caso de XSS. Migração para cookie `HttpOnly` deve ser planejada com cuidado.
- Há muitos usos de `innerHTML`. Vários usam `escapeHtml`/`escapeAttr`, mas a superfície é grande. Toda renderização nova deve escapar dados vindos do banco.
- A CSP ainda precisa de `unsafe-inline` em `script-src` e `style-src` porque existem handlers inline e estilos inline no frontend atual. Remover isso exige migração gradual para listeners JS e classes CSS.
- Em produção, `CORS_ORIGINS` não deve ser `*`. Use o domínio real da Vercel e domínio customizado quando existir.

## Riscos principais

- `main.py` e `backend/main.py` duplicados podem divergir. O ideal é manter apenas um entrypoint quando o deploy estiver estabilizado.
- Backend ainda concentra muitas rotas e regras em um arquivo grande. A extração completa por domínio deve ser feita em etapas e com testes.
- Testes atuais são mínimos e não substituem E2E com Supabase real.
- CSP permissiva por necessidade de legado.
- Polling nas telas é funcional, mas ainda pode evoluir para Supabase Realtime/WebSocket.

## Próximos passos

1. Aumentar cobertura de testes com mocks de Supabase por rota.
2. Separar rotas por domínio somente depois de congelar testes.
3. Reduzir `innerHTML` inseguro e remover handlers inline.
4. Trocar `localStorage` por sessão mais protegida quando o fluxo estiver estável.
5. Criar ambiente de staging com dados demo e checklist operacional.
