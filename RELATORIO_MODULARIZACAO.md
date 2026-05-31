# Relatorio de Modularizacao

Data: 2026-05-31
Branch: `produto-comercial-restaurantes`

## O que foi feito

- `business_type` passou a ser parte do contrato do restaurante.
- O super-admin passou a escolher tipo de negocio no cadastro.
- O backend expõe `modules_config` e `visible_tabs`.
- O admin passou a ocultar abas que nao fazem sentido para o perfil.
- O schema complementar de `restaurants` foi documentado em `backend/supabase_business_type_schema.sql`.
- Testes foram adicionados para normalizacao de tipo de negocio e contrato modular.

## O que esta pronto

- Base modular para:
  - restaurante;
  - pizzaria;
  - padaria;
  - cafeteria;
  - hamburgueria;
  - bar;
  - delivery_only.
- Gating visual do admin por perfil.
- Escolha de tipo de negocio no super-admin.

## O que ainda e parcial

- Pizzaria: montagem completa da pizza e calculo avancado ainda nao estao prontos.
- Padaria: venda por peso e fluxo de producao ainda sao bases iniciais.
- Delivery: painel operacional completo e logistica por entregador ainda nao estao prontos.
- Relatorios por tipo de negocio ainda precisam da camada analitica final.

## Prontidao

- Pronto para pizzaria: nao
- Pronto para padaria: nao
- Pronto para restaurante comum: sim
- Pronto para venda controlada: sim
- Pronto para grande empresa: nao

