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

- Não houve bug de código corrigido nesta etapa. O dashboard exige período por contrato; o teste foi ajustado para chamar com datas.

## Bugs pendentes

- Revalidar presencialmente o fechamento de conta no caixa usando navegador físico, com pagamento dinheiro, pix, cartão e misto.
- Teste E2E automatizado com Playwright ainda não está versionado no repositório.
- CSP ainda depende de `unsafe-inline`, então a redução de risco XSS continua pendente.
- O uso de `localStorage` para JWT continua aceito por enquanto, mas deve ser revisado antes de escala maior.

## Riscos antes do piloto

- O sistema está funcional para piloto controlado, mas ainda precisa de acompanhamento no primeiro restaurante real.
- A duplicação `main.py` e `backend/main.py` exige cuidado em mudanças futuras.
- Testes automatizados ainda cobrem regras principais, não todos os endpoints com mock de Supabase.
- Impressão e rotina fiscal dependem de validação no ambiente físico do restaurante.

## Recomendação final

Pronto para piloto controlado, com acompanhamento técnico no primeiro uso real, execução do `CHECKLIST_PILOTO.md` e revalidação presencial obrigatória do fechamento de conta no caixa antes de iniciar atendimento real.
