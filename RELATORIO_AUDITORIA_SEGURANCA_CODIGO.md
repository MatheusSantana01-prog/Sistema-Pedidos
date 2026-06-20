# Relatorio de auditoria de seguranca e codigo

Data: 2026-06-14
Branch analisada: `produto-comercial-restaurantes`

## Escopo verificado

- Estrutura geral do backend, frontend, scripts, schemas, testes e configuracoes de deploy.
- Exposicao acidental de secrets no frontend e em arquivos versionados.
- Uso de JWT, service role Supabase, CORS e CSP.
- Duplicidade de arquivos relevantes.
- Sintaxe Python e JavaScript.
- Pontos simples de XSS em mensagens renderizadas via `innerHTML`.
- URLs e configuracoes hardcoded.

## Validacoes executadas

- `git status --short`
- `git log --oneline -5`
- Varredura com `rg` para `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `service_role`, tokens, URLs e usos de `innerHTML`.
- `python -m py_compile main.py backend/main.py backend/app/core/config.py backend/app/core/database.py backend/app/core/security.py`
- `node --check` em todos os arquivos JavaScript do frontend.

Resultado:

- Sintaxe Python validada nos arquivos principais.
- Sintaxe JavaScript validada em 13 arquivos.
- Nenhum `.env` versionado encontrado.
- Nenhuma chave real de service role/JWT encontrada no frontend.

## Correcoes aplicadas nesta auditoria

1. Mensagens de erro renderizadas em HTML agora passam por `escapeHtml`:
   - `frontend/super-admin/app.js`
   - `frontend/r/admin/app.js`
   - `frontend/r/garcom/app.js`

2. WhatsApp global corrigido:
   - `frontend/shared/config.js`
   - valor correto: `https://wa.me/5511987629303`

## Achados positivos

- `SUPABASE_SERVICE_ROLE_KEY` e `JWT_SECRET` sao lidos apenas no backend/scripts por variaveis de ambiente.
- O frontend possui comentario explicito para nunca incluir `service_role_key`.
- O backend exige `JWT_SECRET` e `SUPABASE_SERVICE_ROLE_KEY` no startup.
- Senhas usam hash com bcrypt.
- Tokens JWT incluem contexto de restaurante e perfil.
- Muitas rotas administrativas usam `restaurant_id` vindo do token.
- Arquivos `.env` estao ignorados pelo Git.
- CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy` e `Permissions-Policy` existem no `frontend/vercel.json`.

## Duplicidades encontradas

Duplicidade real byte-a-byte:

- `render.yaml`
- `backend/render.yaml`

Duplicidades intencionais/compatibilidade:

- `main.py` na raiz e `backend/main.py` nao sao a mesma aplicacao duplicada. O `main.py` da raiz e apenas entrypoint de compatibilidade apontando para o backend.
- `Dockerfile` e `backend/Dockerfile` existem por historico/compatibilidade de deploy.
- `requirements.txt` e `backend/requirements.txt` existem por historico/compatibilidade de deploy.

Recomendacao: nao remover agora sem estabilizar definitivamente a configuracao do Render, porque isso pode quebrar deploy.

## Riscos ainda existentes

### Medio

- Backend muito concentrado em `backend/main.py`, com muitas rotas no mesmo arquivo. Isso aumenta risco de regressao em manutencoes futuras.
- Autenticacao no frontend usa `localStorage` para JWT. Funciona para piloto, mas para maior seguranca o ideal futuro e migrar para cookies `HttpOnly`, `Secure` e `SameSite`.
- CSP ainda usa `'unsafe-inline'` em `script-src` e `style-src`, necessario pelo frontend atual, mas menos seguro.
- Existem muitos usos de `innerHTML`; os pontos revisados foram tratados, mas novas telas devem continuar usando `escapeHtml`/`escapeAttr`.

### Baixo

- URLs de producao do Vercel/Render estao hardcoded em `frontend/vercel.json` e documentacao. Isso e aceitavel para o ambiente atual, mas deve ser parametrizado se houver multiplos ambientes.
- `.env.example` esta fora do Git no momento. Se for versionar, deve conter apenas placeholders, nunca chaves reais.

## Supabase/RLS

Esta auditoria local nao comprova o estado real do Supabase publicado. Para validar banco de producao/staging, executar no ambiente com variaveis corretas:

```bash
python backend/scripts/check_inventory_schema.py
python backend/scripts/check_payment_methods_schema.py
```

Tambem validar no Supabase:

- Tabelas novas existem.
- RLS esta ativo onde aplicavel.
- Policies permitem service role e bloqueiam acesso indevido.
- Dados de um restaurante nao aparecem em outro.

## Conclusao

O codigo esta em condicao adequada para piloto controlado, com correcoes pontuais de seguranca aplicadas. Para venda controlada, recomenda-se validar o Supabase publicado e manter fluxo de QA antes de cada deploy. Para nivel enterprise, ainda faltam endurecimento de autenticacao, reducao de `unsafe-inline`, modularizacao do backend e monitoramento operacional mais completo.

## Verificacao publicada de 2026-06-20

- Render `/health`: `status=ok`, versao `bc1a47b282a4`.
- Backend: 76 testes passaram.
- Frontend: 13 arquivos JavaScript passaram em `node --check`.
- Playwright publicado: 14 testes passaram em desktop/mobile, incluindo mesa via QR.
- Supabase `Restaurante`: ativo e com RLS habilitado nas tabelas verificadas.
- O advisor do Supabase encontrou funcoes `SECURITY DEFINER` executaveis pelo Data API.
- Foi criada e aplicada a protecao `backend/supabase_security_hardening.sql`, restringindo tabelas, sequencias e funcoes a `service_role`.
- Validacao posterior confirmou `anon_users_select=false`, `authenticated_orders_select=false`, `anon_create_restaurant=false` e `service_role_create_restaurant=true`.
- Depois do hardening, o advisor de seguranca ficou sem avisos `WARN`; restaram apenas informacoes de tabelas com RLS sem policy, que permanecem bloqueadas por padrao.
- Pendencia nao critica: o advisor de performance ainda lista indices duplicados e chaves estrangeiras sem indice. Revisar com dados de uso antes de remover ou criar indices em producao.
