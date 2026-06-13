# Analise - Formas de Pagamento

## Onde esta hardcoded hoje

- `backend/main.py`
  - `FORMAS_PAGAMENTO` aceita apenas `dinheiro`, `pix`, `cartao_credito`, `cartao_debito`.
  - `_normalizar_pagamentos` rejeita qualquer forma fora dessa lista.
  - `_somar_pagamento_dashboard` agrupa relatorio lendo a string `forma_pagamento`.
  - `_forma_pagamento_pedido` reduz pagamento misto para uma forma simples porque o banco atual salva `pedidos.forma_pagamento` como string.
  - Turnos de caixa guardam `payments_by_method` em configuracao JSON.

- `frontend/r/caixa/app.js`
  - `formasPagamentoOptions` fixa Dinheiro, Pix, Cartao credito e Cartao debito.
  - Troco aparece apenas quando `forma_pagamento === dinheiro`.
  - Pagamento misto usa a mesma lista fixa.
  - Resumo do turno calcula dinheiro esperado lendo `payments_by_method.dinheiro`.

- `frontend/r/admin/app.js`
  - Fechamento de conta pelo admin usa lista fixa.
  - Dashboard usa `labelPagamento` com lista fixa.
  - Configuracoes ainda tem toggles legados `accept_pix`, `accept_card`, `accept_cash`.

- `frontend/super-admin/app.js`
  - Nao participa diretamente do fechamento operacional do caixa.

- `tests/`
  - `tests/test_core.py` valida explicitamente as quatro formas fixas e espera erro para `vale_refeicao`.
  - Testes de turno esperam `payments_by_method` com chaves fixas.

- `backend/scripts/seed_demo_comercial.py`
  - Cria configuracoes de restaurante com flags de pagamento, mas ainda nao popula uma tabela dedicada de formas.

## Impacto no banco

O banco atual preserva compatibilidade guardando a string em `pedidos.forma_pagamento`. Para formas customizadas, a transicao mais segura e:

- manter `forma_pagamento` como codigo/snapshot textual;
- enviar nos detalhes de pagamento `payment_method_id`, `payment_method_name_snapshot` e `payment_method_type_snapshot`;
- agrupar relatorios por nome snapshot quando existir;
- nao apagar metodos usados, apenas desativar.

## Impacto no frontend

O caixa e o fechamento pelo admin precisam carregar `/api/admin/payment-methods`. Se a API falhar ou o schema ainda nao existir, o frontend deve usar fallback seguro:

- Dinheiro
- Pix
- Cartao credito
- Cartao debito

## Impacto nos relatorios

Relatorios devem continuar lendo pagamentos antigos por codigo. Pagamentos novos podem trazer snapshot de nome/tipo dentro do JSON de pagamentos do turno e no audit log. Como `pedidos.forma_pagamento` continua string, dashboards antigos nao quebram.

## Risco de quebrar caixa

Risco alto se a validacao backend passar a depender exclusivamente da tabela nova antes do schema estar aplicado. A implementacao deve manter fallback com as quatro formas antigas quando a tabela nao existir ou estiver vazia.
