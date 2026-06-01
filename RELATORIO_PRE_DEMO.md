# Relatorio Pre-Demo

Data: 2026-06-01
Branch: `produto-comercial-restaurantes`

## Pronto para apresentar

- Fluxo QR Code da mesa.
- Cozinha com status do pedido.
- Garcom para acompanhamento.
- Caixa com fechamento.
- Admin com cardapio, mesas, usuarios, configuracoes e estoque.
- Super-admin com restaurantes, planos, financeiro, suporte e bloqueios.
- Estoque basico com ficha tecnica e baixa automatica.
- Modularizacao por tipo de negocio.

## Pronto para vender de forma controlada

- Restaurante comum.
- Hamburgueria/bar/cafeteria com fluxo parecido com restaurante comum.
- Pizzaria como operacao basica, usando pizzas como produtos normais.
- Padaria como operacao basica, usando produtos de balcão como produtos normais.

## Em implantacao

- Pizza meio a meio avancada.
- Borda/tamanho de pizza como motor dedicado.
- Venda por peso com balanca.
- Producao padaria completa.
- Delivery com painel de entregador.
- Fiscal real.
- Integracao iFood.
- WhatsApp automatizado completo.

## Riscos

- Seed comercial depende de `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
- Estoque depende do schema `backend/supabase_inventory_schema.sql`.
- `business_type` em coluna fisica depende de `backend/supabase_business_type_schema.sql`; sem isso, o controle ainda fica salvo em `configuracoes`.
- Playwright autenticado pula testes quando `E2E_*` nao esta configurado.

## Links

- Frontend: `https://frontend-teal-nine-80.vercel.app`
- Backend: `https://sistema-pedidos-zk2w.onrender.com`
- Super-admin: `https://frontend-teal-nine-80.vercel.app/super-admin`
- Landing: `https://frontend-teal-nine-80.vercel.app/comercial`

## Usuarios demo

Ver `DEMO_CREDENCIAIS.md`.

## Resultado dos testes

- `python -m py_compile main.py backend/main.py backend/app/core/config.py backend/app/core/database.py backend/app/core/security.py backend/scripts/seed_demo_comercial.py`: passou.
- `python -m pytest -q`: 42 testes passaram.
- `node --check` em todos os JS do frontend: passou.
- `npx playwright test`: 12 testes passaram e 4 foram pulados por falta de variaveis `E2E_*`.
- `python backend/scripts/seed_demo_comercial.py`: nao executou localmente porque `SUPABASE_URL` nao esta configurado neste PC.

Para criar os dados demo no ambiente autorizado:

```bash
python backend/scripts/seed_demo_comercial.py
```

## Recomendacao final

Apresentar como produto pronto para piloto controlado em restaurante comum e venda assistida para pizzaria/padaria. Nao vender ainda como solucao fiscal, balanca, iFood ou delivery logistico completo.
