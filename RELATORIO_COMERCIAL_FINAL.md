# Relatório Comercial Final

Data: 2026-05-31  
Branch: `produto-comercial-restaurantes`

## Pronto para venda?

Não para venda ampla. Sim apenas para demonstração e piloto comercial controlado.

## Pronto para escala?

Não.

## Entregue nesta branch

- Correção do fechamento de conta no caixa.
- Benchmark de concorrentes.
- Estoque básico com insumos, movimentações, ficha técnica, alertas, relatório e baixa por venda.
- Delivery/logística própria básica.
- Exportação CSV/JSON/impressão simples no financeiro.
- Preparação fiscal sem emissão real.
- Documentação comercial, segurança, implantação e schema Supabase.

## Bugs e pendências críticas

- `python -m pytest -q` não rodou neste computador por falta de FastAPI/Pydantic no Python 3.14 local.
- Playwright E2E ainda precisa rodar em ambiente com backend e Supabase configurados.
- Novas tabelas precisam ser aplicadas no Supabase via `SUPABASE_SCHEMA_COMERCIAL.sql`.
- Deploy não foi executado nesta etapa para não quebrar produção sem schema/testes.

## Riscos

- CSP/localStorage/XSS ainda exigem hardening.
- Fiscal real depende de provedor e homologação.
- Estoque e delivery foram implementados como base comercial e precisam de QA real.

## Falta para escala nacional

- Migrações versionadas e RLS auditado.
- Observabilidade, backups, rate limit e MFA.
- Testes E2E automatizados por perfil.
- Integração fiscal real homologada.
- Integrações iFood/WhatsApp/TEF conforme mercado.
