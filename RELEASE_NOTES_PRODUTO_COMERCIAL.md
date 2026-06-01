# Release Notes - Produto Comercial de Estoque

Branch: `produto-comercial-restaurantes`

## O que entrou

- Aba `Estoque` no admin.
- Cadastro de fornecedores.
- Cadastro, edicao e desativacao de insumos.
- Movimentacoes: entrada, saida, ajuste, perda, inventario, venda e estorno.
- Alertas de estoque baixo e zerado.
- Relatorio resumido de valor em estoque.
- Ficha tecnica por produto.
- Baixa automatica quando pedido e marcado como entregue.
- Estorno quando pedido cancelado ja tinha baixa.
- Schema Supabase versionado.
- Scripts de verificacao e smoke real.
- Playwright E2E versionado.

## O que foi testado

- Pytest com smoke de estoque em memoria.
- Validacao estatica do schema.
- Multi-tenant de estoque.
- Permissoes de owner/manager versus perfis operacionais.
- Sintaxe Python.
- Sintaxe JavaScript.
- Playwright smoke desktop/mobile.
- Deploy preview Vercel da branch comercial.
- Render health da producao atual.
- Consulta somente leitura no Supabase para confirmar ausencia do schema comercial antes de qualquer DDL.

## O que ainda nao esta pronto

- Inventario fisico completo na UI.
- Conversao automatica de unidades.
- Compras/cotacoes de fornecedor.
- Relatorios de CMV/DRE completos.
- Delivery/logistica propria.
- Emissao fiscal real.

## Como aplicar schema

1. Fazer backup do Supabase.
2. Aplicar `backend/supabase_inventory_schema.sql` no SQL Editor.
3. Rodar:

```bash
python backend/scripts/check_inventory_schema.py
```

4. Fazer deploy backend/frontend.
5. Rodar smoke QA:

```bash
python backend/scripts/smoke_inventory_real.py
```

## Como testar

- Login admin owner/manager.
- Abrir aba `Estoque`.
- Criar fornecedor.
- Criar insumo.
- Registrar entrada.
- Criar ficha tecnica.
- Fazer pedido QA.
- Marcar entregue.
- Conferir baixa.
- Cancelar pedido QA.
- Conferir estorno.

## Rollback

- Codigo: voltar deploy anterior no Render e Vercel.
- Banco: nao apagar tabelas se houver dados reais; apenas desabilitar uso do modulo ou manter tabelas sem uso.
- Frontend: voltar Vercel para deploy anterior se a aba Estoque precisar sair do ar rapidamente.

## Recomendacao final

Pronto para demo e venda controlada apos aplicar schema em QA/staging e rodar smoke real. Ainda nao pronto para restaurante grande sem inventario completo, relatorios gerenciais avancados e fiscal/delivery finalizados.

## Status de publicacao em 2026-06-01

- Vercel preview publicado: `https://frontend-esbw4jz36-kcchb26-4366s-projects.vercel.app`
- Landing preview validada: `https://frontend-esbw4jz36-kcchb26-4366s-projects.vercel.app/comercial`
- Render usado para health: `https://sistema-pedidos-zk2w.onrender.com`
- Render ainda retornou versao `018a5b3eff19`; backend comercial nao foi trocado sem confirmacao.
- Supabase usado: projeto `Restaurante`, tratado como producao.
- Schema aplicado no Supabase conectado: nao.
- Seed demo comercial no Supabase conectado: nao executado.
- Smoke real de estoque no Supabase conectado: nao executado.
- Script `smoke_inventory_real.py`: ajustado para falhar com erro claro quando variaveis obrigatorias nao estiverem configuradas.
