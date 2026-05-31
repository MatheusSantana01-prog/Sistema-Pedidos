# Aplicacao do Schema de Estoque no Supabase

## Arquivo

Aplicar:

```text
backend/supabase_inventory_schema.sql
```

## Onde aplicar

No Supabase Dashboard do projeto QA/staging ou producao autorizada:

1. Abrir o projeto Supabase correto.
2. Ir em `SQL Editor`.
3. Criar uma nova query.
4. Colar o conteudo completo de `backend/supabase_inventory_schema.sql`.
5. Executar.
6. Rodar o script de verificacao:

```bash
python backend/scripts/check_inventory_schema.py
```

## Ordem correta antes do deploy

1. Fazer backup/exportacao do banco.
2. Confirmar que esta no ambiente correto.
3. Aplicar `backend/supabase_inventory_schema.sql`.
4. Rodar `python backend/scripts/check_inventory_schema.py`.
5. Fazer deploy do backend.
6. Fazer deploy do frontend.
7. Rodar `python backend/scripts/smoke_inventory_real.py` somente em QA/staging ou em producao autorizada com restaurante temporario.
8. Testar a aba `Estoque` no admin.

## Queries de verificacao

```sql
select to_regclass('public.suppliers') as suppliers;
select to_regclass('public.inventory_items') as inventory_items;
select to_regclass('public.inventory_movements') as inventory_movements;
select to_regclass('public.product_recipes') as product_recipes;
select to_regclass('public.product_recipe_items') as product_recipe_items;
select to_regclass('public.inventory_counts') as inventory_counts;
select to_regclass('public.inventory_count_items') as inventory_count_items;
```

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'suppliers',
    'inventory_items',
    'inventory_movements',
    'product_recipes',
    'product_recipe_items',
    'inventory_counts',
    'inventory_count_items'
  );
```

```sql
select indexname
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'idx_inventory_items_restaurant',
    'idx_inventory_movements_restaurant',
    'idx_inventory_movements_reference',
    'idx_product_recipes_restaurant_product',
    'idx_product_recipes_one_active',
    'idx_product_recipe_items_recipe',
    'idx_inventory_counts_restaurant'
  );
```

## Como validar se aplicou

```bash
python backend/scripts/check_inventory_schema.py
```

Resultado esperado:

```text
OK schema de estoque validado sem alterar dados.
```

## Rollback possivel

Rollback de codigo e seguro: voltar deploy Render/Vercel para versao anterior.

Rollback de schema exige cuidado:

- Nao apagar tabelas se ja houver movimentacao real.
- Preferir desativar a aba Estoque no frontend ou voltar o deploy.
- Se for ambiente QA descartavel, pode remover tabelas novas apos confirmar que nao ha dados reais.

## Riscos

- Aplicar no projeto Supabase errado.
- Rodar smoke real em ambiente de cliente sem autorizacao.
- Apagar tabelas de estoque com dados reais durante rollback.
- Data API do Supabase pode exigir exposicao/grants dependendo da configuracao do projeto; o backend usa service role, mas o check ajuda a detectar falta de acesso.

