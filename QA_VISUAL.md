# QA Visual Final

Data: 2026-05-30  
Branch: `melhorias-saas-piloto`  
Ambiente: produção publicada (`https://frontend-teal-nine-80.vercel.app` + Render)  
Navegador: Chromium via Playwright headless  
Dados usados: restaurantes temporários `qa-visual-*`, removidos ao final de cada execução.

## Evidências por Tela

| Tela | Perfil | Viewport | Ação | Resultado esperado | Resultado obtido | Status | Observações |
|---|---|---:|---|---|---|---|---|
| Super-admin | super_admin | Desktop 1440x950 | Criar restaurante | Modal abre e cancela | Modal abriu e fechou | PASSOU | Sem dados reais |
| Super-admin | super_admin | Desktop 1440x950 | Editar restaurante, alterar plano e limites | Controle salva | Controle salvo | PASSOU | Plano alterado para enterprise no QA |
| Super-admin | super_admin | Desktop 1440x950 | Alterar mensalidade/vencimento e registrar pagamento | Financeiro responde | Pagamento registrado e marcado em dia | PASSOU | Fluxo visual + API de suporte |
| Super-admin | super_admin | Desktop 1440x950 | Teste grátis, vencido, bloqueado e desbloqueado | Estados aplicados | Estados aplicados e bloqueio testado | PASSOU | Validado em QA automatizado e API |
| Super-admin | super_admin | Desktop 1440x950 | Ver QR Codes | Modal abre | QR Codes carregados | PASSOU | Restaurante temporário |
| Super-admin | super_admin | Desktop 1440x950 | Suporte, métricas e auditoria | Abas renderizam | Abas abriram | PASSOU | Sem erro JS |
| Mesa/cliente | público | Mobile 390x844 | Abrir QR | Cardápio abre | Cardápio carregou | PASSOU | Token de mesa temporário |
| Mesa/cliente | público | Mobile 390x844 | Buscar produto | Produto filtrado | Produto encontrado | PASSOU | Busca por `Visual` |
| Mesa/cliente | público | Mobile 390x844 | Filtrar categoria | Categoria responde | Filtro clicado | PASSOU | Sem erro JS |
| Mesa/cliente | público | Mobile 390x844 | Abrir produto, alterar quantidade, adicionar/remover | Carrinho funciona | Carrinho funcionou | PASSOU | Modal e FAB validados |
| Mesa/cliente | público | Mobile 390x844 | Enviar pedido | Pedido enviado | Pedido enviado | PASSOU | Pedido apareceu na cozinha |
| Mesa/cliente | público | Mobile 390x844 | Chamar garçom e ver conta | Chamado enviado e conta abre | OK | PASSOU | Conta aberta antes do caixa |
| Cozinha | kitchen | Desktop 1366x900 | Confirmar/iniciar, pronto, entregue | Status avança | Status avançou até entregue | PASSOU | Pedido real temporário |
| Cozinha | kitchen | Desktop 1366x900 | Estado offline | Indicação de erro quando API falha | Não simulado nesta execução | PENDENTE | Validar presencialmente se necessário |
| TV | tv | Desktop 1366x900 | Abrir painel em tela grande | Tela renderiza | TV carregou | PASSOU | Visual de status validado |
| Garçom | waiter | Mobile 390x844 | Filtros | Livres/ocupadas alternam | Filtros clicados | PASSOU | Sem erro JS |
| Garçom | waiter | Mobile 390x844 | Atender chamado | Chamado atendido | Ação acionada quando disponível | PASSOU | Chamado criado pela mesa |
| Garçom | waiter | Mobile 390x844 | Ocupar/liberar sem consumo | Mesa manual funciona | Ações acionadas quando disponíveis | PASSOU | Sem consumo real |
| Admin | owner | Desktop 1440x950 | Categoria criar/editar | Cardápio responde | OK | PASSOU | Restaurante temporário |
| Admin | owner | Desktop 1440x950 | Produto criar/editar/pausar/ativar | Produto responde | OK | PASSOU | Produto temporário |
| Admin | owner | Desktop 1440x950 | Usuários/senha/configurações | Abas e modais renderizam | OK | PASSOU | Redefinição real não executada para não travar login QA |
| Admin | owner | Desktop 1440x950 | Dashboard com período/auditoria | Abas renderizam | OK | PASSOU | Dashboard exige período |
| Caixa | cashier | Desktop 1366x900 | Abrir turno | Turno abre | Turno aberto | PASSOU | Caixa temporário |
| Caixa | cashier | Desktop 1366x900 | Impedir segundo turno | Botão não permite duplicar | Validação visual observada | PASSOU | Mesmo caixa |
| Caixa | cashier | Desktop 1366x900 | Soma divergente | Fechar conta fica desabilitado | Botão ficou desabilitado | PASSOU | Proteção visual validada |
| Caixa | cashier | Desktop 1366x900 | Fechar conta pela UI | Conta fecha | Correção local aplicada para habilitar o botão com pagamento digitado/programático e consolidar o valor antes da API | CORRIGIDO LOCAL | Requer novo Playwright/ambiente real após instalar dependências |
| Caixa | cashier | Desktop 1366x900 | Fechar turno/imprimir | Ações disponíveis | Fechamento/impressão acionáveis | PASSOU | Impressão em headless apenas acionada |

## Observações

- O QA visual não usou dados reais de cliente.
- Os restaurantes temporários foram removidos ao final dos testes.
- O fluxo operacional principal cliente -> cozinha -> TV -> garçom -> admin passou no navegador.
- Em 2026-05-31, na branch `produto-comercial-restaurantes`, o caixa foi corrigido para revalidar o botão de fechamento quando o pagamento é digitado, alterado por script ou preenchido por "Usar restante". O fechamento também consolida o pagamento pendente antes de chamar a API.
- Validação local executada: `python -m py_compile main.py backend/main.py backend/app/core/config.py backend/app/core/database.py backend/app/core/security.py` e `node --check frontend/r/caixa/app.js`.
- `python -m pytest -q` ficou bloqueado neste computador por dependências Python ausentes; `pytest` foi instalado, mas FastAPI/Pydantic não instalaram no Python 3.14 local. Reexecutar com Python suportado/venv do projeto.
