# Sistema de Pedidos — Sabor & Fogo

## Estrutura do projeto

```
restaurante/
├── backend/
│   ├── main.py          ← FastAPI com RBAC completo
│   ├── requirements.txt
│   └── .env             ← Preencher SERVICE_KEY
├── frontend/
│   ├── cliente.html     ← Cardápio via QR Code (celular do cliente)
│   ├── cozinha.html     ← KDS para a TV da cozinha
│   ├── admin.html       ← Painel admin/gerente/caixa
│   └── qrcodes-mesas.html ← Gerador de QR Codes
└── docs/
    └── README.md
```

---

## Perfis de acesso (RBAC)

| Perfil       | Pode                                                                 |
|-------------|----------------------------------------------------------------------|
| `dono`      | Tudo + dashboard financeiro, auditoria, gestão de usuários           |
| `gerente`   | Mesas, pedidos, produtos, estoque, fechamento de caixa               |
| `funcionario` | Ver mesas, ver pedidos, fechar conta de mesa                       |
| `cozinha`   | Ver fila KDS, avançar status de pedidos                              |

**Credenciais padrão (trocar no primeiro acesso):**
- Dono: `admin@restaurante.com` / `admin123`
- Gerente: `gerente@restaurante.com` / `admin123`
- Cozinha: `cozinha@restaurante.com` / `admin123`

---

## Como rodar

### 1. Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
# Editar .env com a SERVICE_ROLE_KEY do Supabase
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend
Abrir os arquivos diretamente no navegador:
- `frontend/cliente.html?mesa=TOKEN` — para testes locais
- `frontend/cozinha.html` — TV da cozinha (F11 para tela cheia)
- `frontend/admin.html` — painel admin no PC

### 3. QR Codes
- Abrir `qrcodes-mesas.html`
- Hospedar `cliente.html` (Netlify/Vercel)
- Substituir `SEU_DOMINIO` pela URL hospedada
- Imprimir e colar nas mesas

---

## Supabase

- **URL:** `https://lhrfemeunswviwzdpppp.supabase.co`
- **Projeto:** Restaurante (sa-east-1)
- **Dashboard:** https://app.supabase.com/project/lhrfemeunswviwzdpppp

### Tokens das mesas (QR Code)
| Mesa | Token |
|------|-------|
| 1 | `01cc287c-f9b0-4e6b-a864-2036092216c9` |
| 2 | `49af3c6e-a9de-4e99-b8b3-f48d93d4d10b` |
| 3 | `b03dffdd-bba9-4f51-a03c-177820dbdf6c` |
| 4 | `d03be929-e4dd-4849-9ea6-ab319fe2ff42` |
| 5 | `1bf3377b-a86a-46d2-b52b-8ad24067d36c` |
| 6 | `e885964d-02b1-415c-8737-84933d50382e` |
| 7 | `c9431bbf-e957-4dda-a7c7-bc7f5604cb66` |
| 8 | `69fecdf6-f3ae-4084-801c-052613ae66b7` |
| 9 | `57358b4b-d41c-477b-9aff-668acea0c8a8` |
| 10 | `022aa8a3-4188-4898-9f61-ac85eba468a2` |

---

## Fase de testes → produção

### Testes (agora)
1. Abrir `cliente.html` localmente com token da Mesa 1
2. Fazer pedido → ver aparecer em `cozinha.html`
3. Avançar status na cozinha → ver notificação no cliente
4. Entrar no `admin.html` e fechar a conta da mesa
5. Conferir auditoria no painel do dono

### Produção
1. Hospedar `cliente.html` na Vercel/Netlify
2. Configurar `.env` com `SUPABASE_SERVICE_KEY` real
3. Rodar FastAPI no computador do restaurante (`uvicorn main:app`)
4. Imprimir QR Codes com URL definitiva
5. Trocar as senhas padrão no painel de usuários

---

## Banco de dados — tabelas principais

| Tabela | Descrição |
|--------|-----------|
| `usuarios` | Funcionários com perfil RBAC |
| `mesas` | 10 mesas com token QR |
| `sessao_mesa` | Conta aberta por visita |
| `pedidos` | Pedidos com status e pagamento |
| `pedido_itens` | Itens de cada pedido |
| `audit_log` | Log de toda ação administrativa |
| `insumos` | Estoque de ingredientes |
| `fornecedores` | Cadastro de fornecedores |
| `movimentacao_estoque` | Entradas/saídas de estoque |
| `fechamento_caixa` | Relatórios de caixa por dia |
