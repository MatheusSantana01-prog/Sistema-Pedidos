# Benchmark de Concorrentes

Data: 2026-05-31  
Branch: `produto-comercial-restaurantes`

## Fontes consultadas

- Saipos: https://saipos.com/ e https://saipos.com/sistema/sistema-para-restaurante
- Consumer: https://www.consumer.com.br/
- Linx Menew/Linx Food: https://mkt.linx.com.br/menew-sistema-para-restaurantes-linx
- Goomer: https://www.goomer.app/
- Anota AI: https://anota.ai/home/
- InstaDelivery: pesquisa pública disponível; referência complementar: https://pt.wikipedia.org/wiki/InstaDelivery
- BeeFood: https://beefood.com.br/ e https://beefood.com.br/sistema-de-gestao/

## Leitura de mercado

Os concorrentes mais fortes vendem o sistema como operação completa: PDV, salão, comandas/mesas, delivery próprio, integração com marketplaces, fiscal, estoque, financeiro e relatórios. Saipos, Consumer, Linx e BeeFood comunicam gestão ampla de restaurante; Anota AI e Goomer são mais fortes em cardápio digital, WhatsApp e delivery; InstaDelivery aparece como referência em cardápio/delivery e integração iFood.

Para vender como produto comercial, o sistema precisa preservar o que já tem de bom no salão e multi-tenant, mas fechar lacunas obrigatórias: estoque com ficha técnica e baixa automática, delivery próprio, relatórios comerciais, fiscal preparado, permissões auditadas e QA automatizado do fluxo caixa.

## Matriz de recursos

| RECURSO | NOSSO SISTEMA TEM? | CONCORRENTES TÊM? | PRIORIDADE | COMO IMPLEMENTAR |
|---|---|---|---|---|
| PDV / frente de caixa | Parcial: caixa fecha conta, turno, pagamentos simples/mistos | Sim, comum em Saipos, Consumer, Linx, BeeFood | P0 | Consolidar fluxo do caixa, comprovante, sangria/suprimento, cancelamentos e revalidação Playwright |
| Mesas / comandas | Sim: mesas, sessão, ocupação, conta, QR | Sim, comum | P0 | Manter e ampliar para comandas sem mesa e balcão |
| QR Code / cardápio digital | Sim | Sim, comum em Goomer, Anota AI e demais | P0 | Melhorar personalização, adicionais, fotos e pagamento online futuro |
| KDS / cozinha | Sim: painel cozinha e TV | Sim, comum em sistemas completos | P0 | Medir tempo médio, atrasos e filas por estação |
| Garçom | Sim, condicionado ao plano | Sim, comum | P1 | Fortalecer app mobile, permissões e pedido assistido |
| Caixa | Sim, com correção local em 2026-05-31 | Sim | P0 | E2E obrigatório para dinheiro, Pix, crédito, débito e misto |
| Fiscal | Parcial: configuração/roadmap, sem emissão real | Sim em Consumer, Linx, BeeFood e outros | P0 para venda ampla | Criar estrutura fiscal abstrata e integrar provedor certificado depois |
| Estoque | Não completo | Sim em Saipos, Consumer, Linx, BeeFood | P0 | Implementar insumos, movimentos, ficha técnica, baixa por venda, alertas e relatório |
| Ficha técnica / CMV | Não | Sim nos players mais completos | P0 | Vincular produto a insumos, calcular custo e margem |
| Delivery próprio | Não completo | Sim em Goomer, Anota AI, BeeFood, Consumer, Saipos | P0 | Criar tipo de pedido delivery, cliente/endereço/taxa/status/logística |
| Integração iFood | Não | Sim ou destaque forte em Saipos, Anota AI, Linx, BeeFood, InstaDelivery | P1 | Preparar camada de integração; não bloquear venda inicial local sem marketplace |
| WhatsApp | Parcial: suporte/link, sem automação de pedidos | Sim, forte em Anota AI, BeeFood, Goomer | P1 | Começar com link e notificações; depois bot/API oficial |
| Financeiro | Parcial: SaaS billing, caixa e pagamentos | Sim | P1 | Criar DRE simples, contas a pagar/receber e exportações |
| Relatórios | Parcial | Sim | P0 | Dashboard dono: faturamento, ticket médio, produtos, formas, mesas, delivery e estoque |
| Fidelidade / CRM | Não | Alguns têm cashback/campanhas/CRM | P2 | Cadastro de cliente, histórico, cupons e campanhas |
| Multiunidade | Parcial via multi-tenant, sem operação consolidada por rede | Sim em players maiores | P2 | Criar grupo empresarial, permissões por unidade e relatórios agregados |
| Suporte | Sim: chamados e super-admin | Sim, vendido como serviço | P1 | SLA, prioridade, histórico e WhatsApp de suporte |
| Auditoria | Sim: audit_log em ações críticas principais | Sim em ERPs mais maduros | P0 | Revisar endpoints críticos e garantir log em caixa, estoque, delivery, fiscal e permissões |
| Segurança multi-tenant | Sim, precisa revisão contínua | Esperado em SaaS | P0 | Testes de isolamento por endpoint e bloqueio de `restaurant_id` vindo do frontend |
| Exportação CSV/JSON/impressão | Parcial | Comum em relatórios | P1 | Exportadores simples por relatório |
| App entregador / logística | Não | Alguns têm app/painel entregador | P1 | Começar com painel web e relatório por entregador |
| Maquininhas / TEF | Não | Diferencial comum em PDVs maduros | P2 | Planejar integração depois do caixa estabilizado |

## Prioridades recomendadas

P0 obrigatório para vender:
- Caixa UI validado ponta a ponta.
- Estoque com ficha técnica e baixa automática.
- Delivery próprio básico.
- Relatórios comerciais essenciais.
- Fiscal preparado sem emissão real.
- Permissões, multi-tenant e auditoria revisados.

P1 importante para competir:
- WhatsApp operacional, exportações, app/painel de entregador, financeiro gerencial e suporte com SLA.

P2 diferencial:
- CRM/fidelidade, multiunidade, integrações iFood/marketplaces, TEF/maquininhas.

P3 futuro:
- IA para atendimento, roteirização avançada, BI multiunidade, campanhas automatizadas e integrações contábeis.
