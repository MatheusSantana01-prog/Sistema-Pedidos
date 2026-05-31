# Manual do Modulo de Estoque

## Visao geral

O estoque fica no painel admin do restaurante, aba `Estoque`. Ele foi criado para controlar insumos, fornecedores, movimentacoes, alertas, relatorios e ficha tecnica de produtos.

## Permissoes

- `owner` e `manager`: podem cadastrar, editar, movimentar e consultar estoque.
- `cashier`, `waiter`, `kitchen` e `tv`: nao podem alterar estoque.
- O escopo do restaurante vem do JWT. O frontend nao envia `restaurant_id` para controlar dados.

## Preparacao no Supabase

Antes do deploy usar o modulo, aplique o script:

```bash
backend/supabase_inventory_schema.sql
```

Tabelas criadas:

- `suppliers`
- `inventory_items`
- `inventory_movements`
- `product_recipes`
- `product_recipe_items`
- `inventory_counts`
- `inventory_count_items`

## Fluxo operacional

1. Cadastre fornecedores, quando existirem.
2. Cadastre insumos com unidade, estoque minimo, custo unitario e validade.
3. Registre entradas quando comprar mercadoria.
4. Registre perdas, saidas manuais ou ajustes quando necessario.
5. Abra a ficha tecnica de um produto e informe os insumos consumidos.
6. Ao entregar um pedido, o backend baixa o estoque com base na ficha tecnica.
7. Se o pedido for cancelado depois da baixa, o backend cria estorno para evitar consumo indevido.

## Tipos de movimentacao

- `entrada`: compra ou reposicao.
- `saida`: retirada manual.
- `ajuste`: correcao direta de contagem.
- `perda`: desperdicio, vencimento ou quebra.
- `inventario`: ajuste por contagem fisica.
- `venda`: baixa automatica por pedido entregue.
- `estorno`: reversao de baixa automatica.

## Alertas

O alerta considera:

- Zerado: estoque atual menor ou igual a zero.
- Baixo: estoque atual menor ou igual ao estoque minimo.
- OK: estoque acima do minimo.

## Limitacoes atuais

- Ainda nao ha conversao automatica entre unidades diferentes.
- Inventario fisico possui tabela preparada, mas a tela de contagem completa fica para a proxima etapa.
- Compras, cotacao de fornecedores e DRE ainda nao foram implementados.

