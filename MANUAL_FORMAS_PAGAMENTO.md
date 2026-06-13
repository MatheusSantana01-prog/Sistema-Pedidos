# Manual - Formas de Pagamento

## Objetivo

Cada restaurante pode cadastrar as formas que aparecem no caixa, no fechamento de conta e no pagamento misto.

Exemplos:

- Dinheiro
- Pix
- Cartao de credito
- Cartao de debito
- VR
- Sodexo
- Ticket
- Alelo
- PicPay
- Mercado Pago
- Cortesia
- Fiado
- Transferencia
- Outro

## Como cadastrar

No admin do restaurante:

1. Acesse `Configuracoes`.
2. Abra o card `Formas de pagamento`.
3. Informe nome, tipo e ordem.
4. Marque `Exige referencia` quando precisar de NSU, codigo Pix, autorizacao ou observacao.
5. Marque `Permite troco` apenas para formas que funcionam como dinheiro.
6. Salve.

## Tipos

- `cash`: dinheiro ou forma equivalente com troco.
- `pix`: Pix.
- `credit_card`: cartao de credito.
- `debit_card`: cartao de debito.
- `meal_voucher`: vale refeicao.
- `food_voucher`: vale alimentacao.
- `bank_transfer`: transferencia bancaria.
- `digital_wallet`: carteiras digitais como PicPay/Mercado Pago.
- `courtesy`: cortesia.
- `credit_account`: fiado/conta interna.
- `other`: outro.

## Cuidados

- Este modulo registra o pagamento operacionalmente no caixa.
- Nao faz conciliacao bancaria automatica.
- Nao integra TEF/maquininha automaticamente.
- Nao emite documento fiscal automaticamente.
- Se uma forma ja foi usada, desative em vez de apagar.
- Pagamentos antigos continuam aparecendo nos relatorios pelo nome/codigo salvo no momento do fechamento.

## Schema

Aplicar primeiro em QA/staging:

```bash
backend/supabase_payment_methods_schema.sql
```

Validar:

```bash
python backend/scripts/check_payment_methods_schema.py
```

Popular restaurantes antigos:

```bash
python backend/scripts/backfill_payment_methods.py
```
