# Benchmark Comercial de Concorrentes

Data: 2026-05-31

## Objetivo

Comparar o Sistema-Pedidos com funcionalidades comuns em softwares comerciais de restaurante e transformar o resultado em prioridades de produto.

## Referencias consultadas

- Saipos: controle de estoque, ficha tecnica, alertas de insumo minimo, vendas, estoque, relatorios e fiscal. Fonte: https://saipos.com/ e https://saipos.com/sistema/restaurante/controle-de-estoque-para-restaurante
- TotalChef: CMV, estoque, financeiro, ficha tecnica, custo e margem. Fonte: https://www.totalchef.com.br/
- RestaurantePro: reservas, delivery, cardapio digital, estoque, WhatsApp, fichas tecnicas e fornecedores. Fonte: https://www.restaurantepro.com.br/
- Alkanas ERP: estoque, baixa automatica por ficha tecnica, financeiro e fiscal. Fonte: https://alkanas.com/
- PDV Lipe: mesas, comandas, delivery, estoque de insumos e ficha tecnica. Fonte: https://www.pdvlipe.com.br/sistema/sistema-para-restaurante

## Padrao de mercado observado

Produtos maduros de restaurante normalmente nao vendem apenas pedido por QR Code. Eles combinam operacao, caixa, estoque, custo, financeiro, relatorios e fiscal. Para restaurantes maiores, o ponto decisivo e controle: saber o que vendeu, quanto custou, quanto sobrou, quem fez a acao e se a loja esta lucrando.

## Comparativo

| Area | Mercado | Sistema-Pedidos apos esta etapa | Gap |
| --- | --- | --- | --- |
| Pedido QR | Presente em varios players | Presente | Refinar UX e disponibilidade por estoque |
| Cozinha | Kanban/status em tempo real | Presente | Futuro realtime/WebSocket |
| Caixa | Fechamento, metodos mistos, turno | Presente e validado em producao | Relatorio imprimivel mais completo |
| Estoque | Insumos, movimentos, alertas | Implementado basico | Compras, cotacao e inventario completo |
| Ficha tecnica | Custo, consumo e margem | Implementado basico | Conversao de unidades e historico de custo |
| Financeiro SaaS | Mensalidades, bloqueios, planos | Presente | Nota/cobranca automatica futura |
| Relatorios dono | Vendas, margem, CMV | Resumo inicial de estoque | DRE, ticket medio, curva ABC |
| Fiscal | Emissao fiscal/NFC-e | Preparacao documental | Integracao fiscal real futura |
| Delivery | Entrega, taxa, rota | Pendente | Prioridade pos-estoque |
| Auditoria | Historico de acoes | Parcial | Expandir para estoque e financeiro em detalhe |

## Direcao recomendada

1. Consolidar estoque, ficha tecnica e baixa automatica antes de vender para restaurante grande.
2. Criar relatorios simples de dono: venda por periodo, custo estimado, margem, produtos mais vendidos e alertas.
3. Manter fiscal como preparado para integracao, sem prometer emissao real ate integrar provedor fiscal.
4. Usar Playwright e testes backend como argumento comercial de confiabilidade.
5. Vender implantacao guiada, nao apenas acesso ao sistema.

