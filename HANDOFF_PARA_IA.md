# Handoff para continuidade por outra IA

Atualizado em: 2026-06-22  
Projeto: `MatheusSantana01-prog/Sistema-Pedidos`  
Branch de trabalho: `produto-comercial-restaurantes`  
Ultimo commit validado: `1684ac8 Conclui hardening e validacao comercial`

## 1. Objetivo do produto

O Sistema-Pedidos e um SaaS multi-tenant da BrickKode para operacao de restaurantes. A proposta comercial e organizar atendimento, pedidos, cozinha, garcom, caixa, estoque e administracao em um unico sistema.

O produto deve atender inicialmente:

- restaurante comum;
- pizzaria;
- padaria;
- cafeteria;
- hamburgueria;
- bar;
- operacao apenas delivery.

O foco atual nao e adicionar muitos modulos. O foco deve ser estabilidade, implantacao assistida, suporte e venda controlada para os primeiros clientes.

## 2. Stack e arquitetura

- Backend: Python, FastAPI e Pydantic.
- Banco: PostgreSQL no Supabase.
- Cliente Supabase: `supabase-py`, exclusivamente no backend.
- Autenticacao: JWT proprio e senhas com bcrypt.
- Frontend: HTML, CSS e JavaScript puro.
- Testes backend: pytest.
- Testes E2E: Playwright.
- Backend publicado: Render.
- Frontend publicado: Vercel.
- Repositorio: GitHub.

URLs atuais:

- Frontend: `https://frontend-teal-nine-80.vercel.app`
- Landing comercial: `https://frontend-teal-nine-80.vercel.app/comercial`
- Backend: `https://sistema-pedidos-zk2w.onrender.com`
- Health: `https://frontend-teal-nine-80.vercel.app/health`

Estrutura importante:

- `backend/main.py`: backend FastAPI real, ainda monolitico.
- `main.py`: entrypoint de compatibilidade para importar `backend.main`.
- `backend/app/core/config.py`: variaveis de ambiente.
- `backend/app/core/security.py`: JWT, bcrypt e autorizacao.
- `backend/app/core/database.py`: cliente Supabase.
- `frontend/r/`: telas de cada perfil.
- `frontend/shared/`: autenticacao, tenant e configuracao compartilhada.
- `frontend/super-admin/`: administracao do SaaS.
- `tests/`: testes unitarios e mocks.
- `e2e/`: Playwright.

Nao juntar novamente HTML, CSS e JavaScript no mesmo arquivo. Cada tela deve manter:

- `index.html`
- `styles.css`
- `app.js`

## 3. Multi-tenant e seguranca

Cada operacao autenticada deve usar `restaurant_id` vindo do JWT. Nunca confiar no `restaurant_id` recebido pelo frontend.

Regras obrigatorias:

- `SUPABASE_SERVICE_ROLE_KEY` somente no backend.
- `JWT_SECRET` somente no backend.
- Nunca versionar secrets, senhas reais ou dados reais.
- Toda consulta de restaurante deve filtrar por `restaurant_id`.
- Usuario de um restaurante nunca pode acessar outro tenant.
- Rotas publicas usam slug, token da mesa e sessao validada.
- Owner/manager administram o restaurante.
- Cashier, waiter, kitchen e TV devem ter apenas permissoes operacionais.
- Super-admin tem escopo global e suas acoes criticas devem gerar auditoria.

Foi aplicado no Supabase:

- RLS nas tabelas verificadas.
- Bloqueio do Data API direto para `anon` e `authenticated`.
- Funcoes `SECURITY DEFINER` restritas ao `service_role`.
- Migration versionada em `backend/supabase_security_hardening.sql`.

Validacao realizada:

- `anon` nao possui leitura de usuarios.
- `authenticated` nao possui leitura direta de pedidos.
- `anon` nao executa criacao de restaurante.
- `service_role` continua executando as funcoes do backend.

Riscos ainda conhecidos:

- JWT permanece em `localStorage`.
- CSP ainda usa `unsafe-inline`.
- Existem varios usos de `innerHTML`; dados dinamicos devem sempre usar `escapeHtml` e `escapeAttr`.
- Rate limit e apenas em memoria. Para multiplas instancias, usar Redis/Upstash.

## 4. Funcionalidades implementadas

### Cliente/mesa

- Cardapio publico por QR Code.
- Busca e filtro por categoria.
- Carrinho e observacoes.
- Envio de pedido.
- Consulta da conta.
- Chamar garcom.
- Pedir conta.
- Cancelamento controlado:
  - pendente: cancela;
  - confirmado: solicita cancelamento;
  - em preparo/pronto: somente administracao;
  - entregue: bloqueado.

### Cozinha

- Fila de pedidos.
- Confirmar pedido.
- Em preparo.
- Pronto.
- Entregue.
- Pedidos entregues permanecem temporariamente visiveis e depois somem.
- Polling com tratamento de estado.

### Garcom

- Visualizar mesas e chamados.
- Ocupar/liberar mesa.
- Atender chamado.
- Consultar conta.
- Criar pedido para mesa.
- Permissao de entrega condicionada ao plano/configuracao.

### Caixa

- Multiplos caixas por restaurante conforme plano.
- Abertura e fechamento de turno.
- Registro de operador que abriu/fechou.
- Cedulas e moedas.
- Fundo deixado para o proximo turno.
- Historico de aberturas e fechamentos.
- Dinheiro, Pix, cartao e pagamento misto.
- Calculo de troco somente para dinheiro.
- Bloqueio de soma divergente.
- Venda de balcao rapido.
- Impressao/resumo de fechamento.

### Formas de pagamento

- Formas personalizadas por restaurante.
- Tipos: dinheiro, Pix, credito, debito, vale, carteira digital, transferencia, cortesia, fiado e outros.
- Ativar, desativar e ordenar.
- Referencia/NSU quando exigido.
- Compatibilidade com pagamentos antigos.
- Snapshot do nome/tipo para preservar relatorios historicos.
- Schema: `backend/supabase_payment_methods_schema.sql`.

### Admin do restaurante

- Dashboard.
- Produtos, categorias e fotos.
- Mesas e QR Codes.
- Usuarios por perfil.
- Redefinicao de senha.
- Caixas e historico.
- Configuracoes do restaurante.
- Suporte/chamados.
- Auditoria.
- Financeiro operacional.
- Formas de pagamento.
- Estoque.

### Estoque

- Insumos.
- Fornecedores.
- Entrada, saida, ajuste, perda, venda, estorno e inventario.
- Quantidade atual, estoque minimo, custo e validade.
- Alertas de estoque baixo/zerado.
- Ficha tecnica por produto.
- Custo estimado e margem.
- Baixa automatica ao vender/entregar.
- Estorno seguro ao cancelar.
- Isolamento multi-tenant e permissoes.

Schemas e scripts:

- `backend/supabase_inventory_schema.sql`
- `backend/scripts/check_inventory_schema.py`
- `backend/scripts/smoke_inventory_real.py`

### Super-admin SaaS

- Restaurantes e planos.
- Tipo de negocio e modulos.
- Financeiro SaaS.
- Mensalidade, vencimento, teste gratis, atraso e bloqueio.
- Bloquear/desbloquear restaurante.
- Suporte centralizado.
- Contador de chamados.
- Metricas, diagnostico e auditoria.
- Redefinicao de senha.
- Branding global BrickKode.

### Branding

- Marca: BrickKode.
- Logo em `frontend/shared/LogoBrickKode.jpeg`.
- Tema administrativo escuro e tecnologico.
- Tema global da plataforma separado do tema do cardapio.
- Restaurante personaliza apenas seu cardapio publico.
- Direitos reservados em locais discretos.
- WhatsApp oficial: `11987629303`.

## 5. Planos e modulos

Tipos de negocio:

- `restaurante`
- `pizzaria`
- `padaria`
- `cafeteria`
- `hamburgueria`
- `bar`
- `delivery_only`

Configuracao modular inclui, entre outros:

- mesas;
- comandas;
- QR Code;
- garcom;
- cozinha;
- caixa;
- estoque;
- ficha tecnica;
- delivery;
- encomendas;
- venda por peso;
- codigo de barras;
- funcoes de pizza;
- producao de padaria;
- balcao rapido;
- fiscal;
- relatorios avancados.

Nem todos os modulos avancados estao 100% implementados. Nao prometer como prontos:

- pizza meio a meio avancada;
- balanca integrada;
- emissao fiscal real;
- integracao iFood;
- conciliacao bancaria;
- alta disponibilidade enterprise.

Limites comerciais definidos:

- Basico: ate 10 mesas, 5 usuarios, 100 produtos, 2 caixas e sem garcom avancado.
- Pro: operacao mais completa e limites maiores.
- Premium: base configuravel e expansao conforme necessidade/uso.

Sempre conferir `PLAN_LIMITS`, `PLAN_MODULES` e regras do backend antes de alterar valores comerciais.

## 6. Banco e ordem de schemas

Para ambiente novo:

1. Aplicar schema principal existente.
2. `backend/supabase_inventory_schema.sql`
3. `backend/supabase_business_type_schema.sql`
4. `backend/supabase_payment_methods_schema.sql`
5. `backend/supabase_security_hardening.sql`

O hardening deve ser o ultimo porque bloqueia acesso direto de `anon/authenticated`.

Nunca aplicar schema destrutivo em producao sem:

- backup;
- leitura do SQL;
- plano de rollback;
- teste em staging, quando disponivel.

## 7. Testes e estado validado

Ultima verificacao completa:

- `python -m pytest -q`: 76 testes passaram.
- `python -m py_compile`: passou.
- `node --check`: 13 arquivos passaram.
- Playwright publicado: 14 testes passaram em desktop/mobile, incluindo mesa por QR.
- Render e Vercel estavam na versao `1684ac8`.
- GitHub Actions foi atualizado para executar na branch comercial.

O travamento anterior do pytest foi resolvido em `pytest.ini`:

- plugin `anyio` desativado;
- cache provider desativado por conflito de permissao com OneDrive.

Comandos obrigatorios antes de concluir mudancas:

```bash
python -m py_compile main.py backend/main.py backend/app/core/config.py backend/app/core/database.py backend/app/core/security.py
python -m pytest -q
node --check frontend/shared/config.js
npx playwright test
```

Para todos os JS, executar `node --check` recursivamente.

## 8. Deploy

Render:

- Branch: `produto-comercial-restaurantes`
- Root directory: `backend`
- Start:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2
```

Vercel:

- Root directory: `frontend`
- Proxy `/api/*` para o Render.
- Rotas amigaveis definidas em `frontend/vercel.json`.

Antes de deploy:

- confirmar branch e commit;
- executar testes;
- nao alterar `main`;
- nao fazer merge automatico;
- validar `/health` depois.

## 9. Preferencias de desenvolvimento

- Consolidar o que existe antes de inventar funcionalidades.
- Evitar grandes refatoracoes perto de implantacao.
- Corrigir bug com teste de regressao.
- Manter UI/UX consistente com o sistema atual.
- Interface administrativa: quieta, profissional, densa e pratica.
- Evitar cards excessivos, landing dentro do sistema e decoracao sem funcao.
- Usar icones conhecidos e tooltips quando necessario.
- Garantir responsividade para celular, tablet e desktop.
- Nao remover arquivos de compatibilidade de deploy sem confirmar Render.
- Nao apagar dados ou arquivos sem certeza.
- Nao usar dados reais em QA.
- Nao expor erro tecnico bruto ao usuario comum.
- Mensagens devem explicar o que ocorreu e como resolver.
- Polling deve ter um unico timer, tratamento offline e limpeza ao sair.

## 10. O que falta

### Prioridade imediata comercial

- Implantar de 1 a 3 clientes com acompanhamento.
- Criar restaurante demo sempre funcional.
- Criar video comercial de 60 a 90 segundos.
- Definir tabela final de precos, implantacao e suporte.
- Usar contrato e checklist de implantacao.
- Coletar feedback e depoimento do primeiro cliente.
- Monitorar logs, erros e tempo de resposta.
- Criar rotina real de backup e teste de restauracao.

### Prioridade tecnica alta

- Criar ambiente staging separado de producao.
- Adicionar monitoramento de erros, uptime e alertas.
- Migrar rate limit para Redis/Upstash.
- Revisar indices duplicados e FKs sem indice apontados pelo Supabase Advisor.
- Automatizar smoke autenticado com restaurante QA.
- Melhorar politica de backup e restauracao.

### Prioridade media

- Migrar JWT de `localStorage` para cookie `HttpOnly`.
- Remover gradualmente `unsafe-inline` da CSP.
- Modularizar `backend/main.py` por dominio, em etapas pequenas.
- Reduzir `innerHTML` e preferir DOM seguro.
- Parametrizar URLs para staging/producao.

### Futuro, somente apos clientes reais

- Fiscal com emissao real.
- Integracao iFood.
- WhatsApp automatizado.
- Delivery avancado.
- Pizza avancada.
- Venda por balanca.
- PWA/app mobile.
- Multiunidade completa.
- Conciliacao bancaria/TEF.

## 11. Estrategia comercial recomendada

Nao vender apenas funcionalidades. Vender:

- menos erros de pedido;
- comunicacao melhor entre salao e cozinha;
- fechamento de caixa mais seguro;
- controle de perdas e estoque;
- economia de tempo do dono;
- rastreabilidade e organizacao.

Demonstracao de 10 minutos:

1. QR da mesa.
2. Pedido do cliente.
3. Cozinha recebe e avanca.
4. Garcom acompanha.
5. Caixa recebe pagamento e calcula troco.
6. Estoque baixa.
7. Admin ve historico/relatorios.
8. Super-admin controla plano e suporte.

Vender inicialmente como “implantacao assistida”, nao como enterprise ilimitado.

## 12. Regras para a proxima IA

Antes de qualquer alteracao:

1. Ler este arquivo, `README.md`, `DEPLOY.md` e o arquivo diretamente relacionado.
2. Executar `git status`, branch e log.
3. Nao tocar na `main`.
4. Nao fazer merge automatico.
5. Preservar mudancas existentes do usuario.
6. Fazer commits pequenos e descritivos.
7. Testar antes de push.
8. Nao afirmar que testou algo sem evidencia.
9. Se precisar de credencial/permissao, indicar exatamente qual.
10. Priorizar estabilidade e clientes reais sobre funcionalidades grandes.

Estado comercial recomendado:

- Pronto para demo: sim.
- Pronto para piloto real acompanhado: sim.
- Pronto para venda controlada: sim.
- Pronto para grande empresa/enterprise: ainda nao.
