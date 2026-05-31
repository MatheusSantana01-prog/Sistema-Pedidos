# Modulos Por Tipo de Negocio

O Sistema-Pedidos agora expõe `business_type` por restaurante e um contrato de módulos por perfil.

## Tipos aceitos

- `restaurante`
- `pizzaria`
- `padaria`
- `cafeteria`
- `hamburgueria`
- `bar`
- `delivery_only`

## Módulos base do contrato

- mesas
- comandas
- qr_code
- garcom
- cozinha
- caixa
- estoque
- ficha_tecnica
- delivery
- encomendas
- venda_peso
- codigo_barras
- pizza_meio_a_meio
- pizza_bordas
- pizza_tamanhos
- producao_padaria
- lotes_validade
- balcao_rapido
- fiscal
- relatorios_avancados

## Status atual

- O backend e o frontend já carregam `business_type`, `modules_config` e `visible_tabs`.
- O super-admin já consegue escolher o tipo de negocio.
- O admin já esconde abas que nao fazem sentido para o perfil.
- A base de pizzaria, padaria e delivery ainda e parcial. As regras especificas de cada dominio precisam da proxima etapa.

## Regra operacional

Se o modulo estiver desligado, a aba correspondente nao deve aparecer no admin e a rota nao deve ser tratada como fluxo ativo do perfil.

