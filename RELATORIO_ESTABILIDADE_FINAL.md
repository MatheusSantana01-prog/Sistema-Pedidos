# Relatorio de Estabilidade Final - Sistema-Pedidos

Data: 2026-06-06  
Branch: `produto-comercial-restaurantes`  
Escopo: QA pesado, estabilidade, regras de cancelamento, permissoes, multi-tenant e regressao automatizada.

## Resultado executivo

Eu colocaria este sistema em um restaurante real amanha?

**Sim, para piloto controlado e acompanhado.**

Nao colocaria ainda como operacao enterprise sem supervisao, porque o smoke real com Supabase/ambiente QA completo depende de credenciais e variaveis QA, e parte dos testes Playwright ficou pulada por falta desses dados. Para um primeiro restaurante piloto, com backup, restaurante demo/QA, deploy validado e acompanhamento no primeiro turno, o sistema esta em condicao melhor e mais segura apos este ciclo.

## Bugs reais encontrados e corrigidos

### Alto - cancelamento pelo cliente nao existia

Fluxo implementado:

- Pedido `pendente`/recebido: cliente cancela diretamente.
- Pedido `confirmado`: cliente registra solicitacao de cancelamento, sem cancelar automaticamente.
- Pedido `em_preparo`: bloqueado para cliente; somente admin/gerente pode cancelar.
- Pedido `pronto`: bloqueado para cliente; somente admin/gerente pode cancelar.
- Pedido `entregue`: cancelamento bloqueado.
- Pedido `cancelado`: segunda tentativa bloqueada.
- Estorno de estoque chamado de forma segura quando o pedido e cancelado.

Arquivos:

- `main.py`
- `backend/main.py`
- `frontend/r/mesa/app.js`
- `tests/test_order_cancellation.py`

### Alto - clique duplo podia iniciar dois envios de pedido

Problema: `enviarPedido()` aguardava `atualizarCardapio(true)` antes de desabilitar/travar o envio. Em clique rapido, duas chamadas poderiam entrar antes do bloqueio visual.

Correcao: criada trava `enviandoPedido` no inicio da funcao, antes de qualquer `await`.

Observacao: isso reduz fortemente o risco no frontend. Para tolerancia maxima contra retry de rede/concorrencia extrema, o proximo passo e idempotencia backend por chave de pedido.

### Medio - bug de variavel inexistente no cancelamento da mesa

Problema encontrado durante implementacao: a tela usaria `MESA_ID`, que nao existe.  
Correcao: trocado para `MESA?.id`.

## Testes executados

### Backend/unitarios

Comando:

```bash
python -m pytest -q
```

Resultado:

- `69 passed`
- Avisos apenas de `datetime.utcnow()` e cache do pytest no OneDrive.

Cobertura nova adicionada:

- regra por status do cancelamento do cliente;
- cancelamento direto de pedido recebido;
- solicitacao de cancelamento em pedido confirmado;
- bloqueio para em preparo/pronto/entregue/cancelado;
- sessao fechada;
- mesa errada;
- outro tenant;
- tentativa duplicada de cancelamento;
- transicao interna `pronto -> cancelado` permitida para fluxo autorizado.

### Sintaxe Python

Comando:

```bash
python -m py_compile main.py backend/main.py backend/app/core/config.py backend/app/core/database.py backend/app/core/security.py
```

Resultado: passou.

### Sintaxe JavaScript

Comando:

```bash
node --check em todos os arquivos JS de frontend e e2e
```

Resultado:

- `node --check OK em 12 arquivos JS`

### Playwright

Comando:

```bash
npx playwright test
```

Resultado:

- `12 passed`
- `4 skipped`

Pulados:

- teste de estoque autenticado por falta de credenciais QA;
- teste de mesa QR com token QA por falta de variavel/token QA.

## Matriz de risco por area

### Pedido

Status: melhorado.

Testado:

- criacao coberta por smoke existente;
- cancelamento por status;
- clique duplo no frontend;
- tentativa duplicada de cancelamento;
- outro tenant;
- sessao fechada.

Risco restante:

- ainda falta idempotencia backend para submissao duplicada em nivel API.

Classificacao: medio.

### Mesa

Status: sem regressao detectada nos testes automatizados.

Testado:

- rotas principais carregam no Playwright;
- cancelamento valida sessao e mesa;
- outro tenant nao acessa pedido.

Risco restante:

- teste real com multiplas mesas simultaneas depende de ambiente QA com dados e credenciais.

Classificacao: medio.

### Cozinha

Status: regra de cancelamento mais segura.

Testado:

- transicoes de status existentes;
- cancelamento `pronto -> cancelado` agora permitido no mapa;
- cozinha continua bloqueada para cancelar pedido.

Risco restante:

- concorrencia real de dois usuarios avancando o mesmo pedido ainda precisa de teste em ambiente publicado com usuarios QA.

Classificacao: medio.

### Garcom

Status: sem regressao detectada.

Testado:

- telas carregam desktop/mobile;
- permissao de entrega pelo garcom continua condicionada a configuracao.

Risco restante:

- chamados simultaneos precisam de smoke real com banco QA.

Classificacao: medio.

### Caixa

Status: sem regressao neste ciclo.

Testado indiretamente:

- testes existentes de caixa/denominacoes/pagamento continuam passando;
- telas carregam no Playwright.

Risco restante:

- pagamento misto e divergencia precisam de E2E autenticado com dados QA.

Classificacao: medio.

### Estoque

Status: protegido pela suite automatizada existente.

Testado:

- baixa e estorno por venda nos testes existentes;
- cancelamento novo chama estorno de forma segura.

Risco restante:

- smoke real de Supabase depende de `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` em ambiente QA.

Classificacao: medio.

### Super-admin

Status: sem regressao detectada no carregamento.

Testado:

- tela carrega via Playwright desktop/mobile.

Risco restante:

- bloquear/desbloquear/alterar plano precisa de E2E autenticado com usuario QA.

Classificacao: medio.

### Seguranca

Status: melhorado para cancelamento publico.

Validado:

- cancelamento publico valida restaurante ativo;
- valida plataforma/modulos;
- valida sessao do restaurante;
- valida mesa da sessao;
- valida pedido do mesmo `restaurant_id`;
- outro tenant nao cancela pedido.

Risco restante:

- ainda e recomendado adicionar rate limit especifico para cancelamento publico e idempotency key para criacao de pedido.

Classificacao: medio.

## Pendencias antes de vender sem acompanhamento

1. Rodar smoke real com credenciais QA:

```bash
python backend/scripts/check_inventory_schema.py
python backend/scripts/smoke_inventory_real.py
```

2. Configurar variaveis QA para Playwright e rodar novamente sem skips:

- usuario admin/owner QA;
- slug QA;
- token de mesa QA;
- URL publicada.

3. Adicionar idempotencia backend para criacao de pedido:

- `client_request_id` por envio;
- constraint por `restaurant_id`, `sessao_mesa_id`, `client_request_id`;
- retorno do pedido existente em retry.

4. Fazer teste humano de primeiro turno:

- 30 a 50 pedidos;
- 10 mesas;
- dois usuarios na cozinha;
- dois caixas;
- chamadas simultaneas de garcom;
- cancelamento antes/depois de confirmacao.

## Recomendacao final

**Pronto para piloto controlado: sim.**

**Pronto para venda controlada com acompanhamento: sim, desde que o deploy publicado esteja na branch `produto-comercial-restaurantes` e o smoke real com Supabase passe.**

**Pronto para grande empresa sem acompanhamento: nao.**

Motivo: faltam idempotencia backend de pedido, teste E2E autenticado completo sem skips e validacao operacional de carga em ambiente QA/staging.
