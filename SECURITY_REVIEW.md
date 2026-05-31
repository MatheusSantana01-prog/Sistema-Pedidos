# Security Review

Data: 2026-05-31

## Resultado

Pronto para piloto/comercial controlado: parcialmente.  
Pronto para escala nacional: não.

## Revisado

- Multi-tenant: rotas novas de estoque e delivery usam `restaurant_id` extraído do token, não do frontend.
- Permissões: estoque e delivery exigem `manager` ou `owner`; caixa/garçom/cozinha/TV não gerenciam estoque.
- Caixa: fechamento exige turno para cashier e registra `fechar_conta_mesa` em `audit_log`.
- Estoque: criação, edição, movimentação, ficha técnica e baixa automática registram auditoria quando aplicável.
- Fiscal: preparado para controle manual/abstrato, sem emissão real de NFC-e/SAT.
- Secrets: frontend não deve receber service role key; backend lê via ambiente.

## Riscos

- JWT em `localStorage`: aceitável temporariamente, mas exposto a XSS.
- CSP ainda depende de inline scripts/event handlers no frontend estático.
- Muitas telas ainda montam HTML via `innerHTML`; há uso recorrente de `escapeHtml`, mas a superfície XSS segue relevante.
- Novas tabelas exigem aplicação de `SUPABASE_SCHEMA_COMERCIAL.sql` e políticas RLS antes de produção.
- `pytest` não rodou neste computador por dependências Python ausentes.

## Ações obrigatórias antes de venda ampla

- Aplicar schema Supabase e revisar RLS por `restaurant_id`.
- Rodar `python -m pytest -q` em venv suportado.
- Rodar Playwright real do fluxo caixa/estoque/delivery.
- Remover gradualmente handlers inline e fortalecer CSP.
- Avaliar migração do JWT para cookie `HttpOnly` com refresh token.
