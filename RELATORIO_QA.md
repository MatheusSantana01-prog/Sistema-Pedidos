# Relatório de QA

Data: 2026-05-30
Branch: `melhorias-saas-piloto`

## O que foi testado

### QA visual/manual assistido

- Executado em 2026-05-30 com Chromium via Playwright headless.
- Ambiente publicado: Vercel + Render.
- Restaurante temporário `qa-visual-*` criado e removido.
- Telas validadas: super-admin, admin, mesa/mobile, cozinha, garçom/mobile, caixa e TV.
- Evidências detalhadas em `QA_VISUAL.md`.

### Automatizado local

- Importação do backend pela raiz e pela pasta `backend`.
- Health check.
- JWT com `restaurant_id`.
- Rejeição de token sem `restaurant_id`.
- Normalização de plano.
- Limites de caixas por plano.
- Resumo de dinheiro por cédulas/moedas.
- Pagamento único/misto e rejeição de soma divergente.
- Transições da cozinha.
- Limite de plano excedido.
- Limite alto enterprise.
- Bloqueio por financeiro e `block_mode`.
- Status financeiro: teste grátis, vencido e bloqueado.
- Módulo garçom exigido para perfil waiter.
- Limite de usuário caixa no starter.
- Rejeição de usuário comum no super-admin.
- Sintaxe de todos os arquivos JavaScript do frontend com `node --check`.
- JSON de `frontend/vercel.json`.

### Smoke E2E real no ambiente publicado

Foram criados dois restaurantes temporários (`qa-a-*` e `qa-b-*`) e removidos ao final.

Fluxo validado:

- Login super-admin.
- Criação de restaurante Pro e Starter.
- Criação de usuários owner, manager, cashier, waiter, kitchen e tv.
- Login por perfil no restaurante correto.
- Criação de categoria.
- Criação de produto.
- Listagem de mesas.
- Abertura pública da mesa por QR/token.
- Abertura de sessão de mesa.
- Criação de pedido pelo cliente.
- Pedido apareceu na fila da cozinha.
- Cozinha avançou pedido para `em_preparo`, `pronto` e `entregue`.
- Cliente chamou garçom.
- Garçom viu chamado.
- Caixa listou caixas.
- Caixa abriu turno.
- Caixa fechou conta da mesa.
- Restaurante B não viu produto do restaurante A.
- Login do owner do restaurante A no slug B foi bloqueado.
- Super-admin alterou controle financeiro para vencido/bloqueado.
- Restaurante bloqueado perdeu acesso administrativo conforme regra.

### Rotas estáticas Vercel

Rotas verificadas com status `200`:

- `/r/demo/admin`
- `/r/demo/garcom`
- `/r/demo/cozinha`
- `/r/demo/caixa`
- `/r/demo/tv`
- `/r/demo/mesa/demo-token`
- `/super-admin`

## O que passou

- Fluxo operacional principal passou no ambiente real.
- Isolamento multi-tenant passou nos testes executados.
- Bloqueio por financeiro passou para acesso administrativo.
- Limites e permissões críticas têm cobertura automatizada.
- Frontend não apresentou erro de sintaxe JavaScript.
- Render respondeu `/health` com `status: ok`.
- QA visual confirmou navegação e botões críticos em super-admin, mesa, cozinha, garçom, admin e TV.
- Caixa abriu turno e bloqueou soma divergente visualmente.

## Bugs encontrados

- Durante o primeiro smoke, `/api/admin/dashboard` retornou erro de validação porque a chamada não informou `data_inicio` e `data_fim`.
- No QA visual headless, o fechamento de conta do caixa não foi concluído pela UI porque o botão permaneceu desabilitado após o preenchimento programático do pagamento.

## Bugs corrigidos

- Em 2026-05-31, na branch `produto-comercial-restaurantes`, o caixa foi corrigido para habilitar o fechamento quando o pagamento é preenchido pela UI, por teclado ou programaticamente. O botão agora considera o valor digitado no campo de pagamento e o fechamento consolida esse valor antes de enviar para `/api/admin/tables/{mesa_id}/close`.
- Foram adicionados testes unitários para normalização de dinheiro, Pix, cartão de crédito, cartão de débito, pagamento misto, rejeição de soma divergente e atualização do turno de caixa.
- O dashboard exige período por contrato; o teste anterior foi ajustado para chamar com datas.

## Bugs pendentes

- Reexecutar o fechamento de conta no caixa em Playwright/navegador real usando dinheiro, Pix, cartão de crédito, cartão de débito e pagamento misto após preparar o ambiente local.
- Teste E2E automatizado com Playwright ainda não está versionado no repositório.
- CSP ainda depende de `unsafe-inline`, então a redução de risco XSS continua pendente.
- O uso de `localStorage` para JWT continua aceito por enquanto, mas deve ser revisado antes de escala maior.

## Riscos antes do piloto

- O sistema está funcional para piloto controlado, mas ainda precisa de acompanhamento no primeiro restaurante real.
- A duplicação operacional `main.py` e `backend/main.py` foi removida: `backend/main.py` é a fonte real e `main.py` é apenas entrypoint de compatibilidade.
- Nesta máquina, `python -m pytest -q` não concluiu porque FastAPI/Pydantic não estão instalados e a instalação no Python 3.14 local falhou. Reexecutar em venv/Python suportado antes de declarar pronto para venda.
- Impressão e rotina fiscal dependem de validação no ambiente físico do restaurante.

## Recomendação final

Pronto para piloto controlado, com acompanhamento técnico no primeiro uso real, execução do `CHECKLIST_PILOTO.md` e revalidação presencial obrigatória do fechamento de conta no caixa antes de iniciar atendimento real.
