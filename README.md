# 🍔 Sistema de Pedidos — Restaurante

Sistema completo de pedidos via QR Code para restaurantes, com painel administrativo, KDS para cozinha e cardápio digital para clientes.

## 📁 Estrutura

```
restaurante/
├── backend/
│   ├── main.py              ← API FastAPI (RBAC completo)
│   ├── requirements.txt
│   └── .env.example         ← Copiar para .env e preencher
├── frontend/
│   ├── admin/               ← Painel administrativo (PC)
│   │   ├── index.html
│   │   ├── css/
│   │   └── js/
│   ├── cliente/             ← Cardápio QR Code (celular)
│   │   ├── index.html
│   │   ├── css/
│   │   └── js/
│   └── cozinha/             ← KDS para TV da cozinha
│       ├── index.html
│       ├── css/
│       └── js/
└── docs/
    └── README.md
```

## 🚀 Como rodar

### 1. Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Editar .env com sua SUPABASE_SERVICE_KEY
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend

Abrir os arquivos diretamente no navegador ou servir com qualquer servidor estático:

```bash
# Opção simples com Python
cd frontend
python -m http.server 3000
```

- `frontend/cliente/index.html?mesa=TOKEN` → Cardápio do cliente (celular)
- `frontend/cozinha/index.html` → KDS (TV da cozinha, F11 tela cheia)
- `frontend/admin/index.html` → Painel admin (PC)

## 🔐 Perfis de acesso

| Perfil | Pode fazer |
|--------|-----------|
| `dono` | Tudo + dashboard financeiro, auditoria, gestão de usuários |
| `gerente` | Mesas, pedidos, cardápio, estoque, fechamento de caixa |
| `funcionario` | Ver mesas, fechar conta |
| `cozinha` | Fila KDS, avançar status de pedidos |

**Credenciais padrão** (trocar após primeiro acesso):
- `admin@restaurante.com` / `admin123`
- `gerente@restaurante.com` / `admin123`
- `cozinha@restaurante.com` / `admin123`

## 🛠️ Tecnologias

- **Backend:** Python + FastAPI + Supabase
- **Banco:** PostgreSQL (Supabase) com RLS, RBAC e triggers de auditoria
- **Frontend:** HTML, CSS e JavaScript puro (sem framework)
- **Auth:** JWT com bcrypt

## 📋 Banco de dados

Projeto Supabase: `lhrfemeunswviwzdpppp` (região: sa-east-1)

Principais tabelas: `usuarios`, `mesas`, `sessao_mesa`, `pedidos`, `pedido_itens`, `produtos`, `categorias`, `audit_log`, `insumos`, `fechamento_caixa`
