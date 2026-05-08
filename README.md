# SaaS Restaurante — Sistema Multi-Tenant

## Estrutura
```
saas/
├── backend/          FastAPI — API única para todos os restaurantes
│   ├── main.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── Dockerfile
│   ├── Procfile
│   └── render.yaml
└── frontend/         HTML/CSS/JS — hospedado em Vercel/Netlify
    ├── shared/       config.js, auth.js, tenant.js
    ├── r/
    │   ├── admin/    Painel admin por restaurante
    │   ├── cozinha/  KDS por restaurante
    │   ├── caixa/    Tela de caixa por restaurante
    │   ├── tv/       TV de status por restaurante
    │   └── mesa/     Cardápio do cliente via QR Code
    ├── super-admin/  Painel da plataforma (dono do SaaS)
    ├── vercel.json
    └── netlify.toml
```

## URLs por restaurante
```
/r/{slug}/admin      → Painel administrativo
/r/{slug}/cozinha    → KDS da cozinha
/r/{slug}/caixa      → Tela do caixa
/r/{slug}/tv         → TV de status
/r/{slug}/mesa/{token} → Cardápio do cliente
/super-admin         → Painel da plataforma
```

## Roles
| Role        | Acesso                                      |
|-------------|---------------------------------------------|
| super_admin | Toda a plataforma                           |
| owner       | Restaurante completo + configurações        |
| manager     | Pedidos, cardápio, estoque, caixa           |
| cashier     | Mesas e fechamento de contas                |
| waiter      | Ver mesas e pedidos                         |
| kitchen     | Fila KDS + avançar status                   |
| tv          | Somente leitura — status dos pedidos        |

## Deploy rápido

### Backend (Render)
1. Fork/push o código
2. Render → New Web Service → selecionar repo
3. Build: `pip install -r requirements.txt`
4. Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Adicionar variáveis de ambiente do `.env.example`

### Frontend (Netlify)
1. Arrastar a pasta `frontend/` para netlify.com/drop
2. Pronto — as rotas já estão configuradas no `netlify.toml`

### Configurar API_URL
Em `frontend/shared/config.js` trocar:
```js
API_URL: 'http://localhost:8000'
// → para:
API_URL: 'https://sua-api.onrender.com'
```

## Criar novo restaurante
```bash
# Via API (autenticado como super_admin)
POST /api/super-admin/restaurants
{
  "name": "Pizzaria Bella Massa",
  "slug": "pizzaria-bella-massa",
  "email": "contato@bellamassa.com.br",
  "plan": "pro",
  "primary_color": "#e63946"
}
```

## Credenciais demo (senha: admin123)
| E-mail                        | Role    | Restaurante         |
|-------------------------------|---------|---------------------|
| admin@restaurante.com         | owner   | Sabor & Fogo        |
| owner@bellamassa.com.br       | owner   | Pizzaria Bella Massa|
| cozinha@bellamassa.com.br     | kitchen | Pizzaria Bella Massa|
| owner@hamburgueriatop.com.br  | owner   | Hamburgueria Top    |
| caixa@hamburgueriatop.com.br  | cashier | Hamburgueria Top    |
