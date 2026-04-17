# Projeto CLIENTE - Cardápio Digital

## 📱 Estrutura

```
cliente/
├── index.html                           # HTML principal
├── css/
│   ├── variables.css      # Variáveis de tema
│   ├── base.css          # Estilos base
│   ├── hero.css          # Hero section
│   ├── search-categories.css    # Busca e categorias
│   ├── products.css      # Cards de produtos
│   ├── modals.css        # Modais (produto, carrinho, conta)
│   ├── fab-notifications.css    # FABs e notificações
│   └── utilities.css     # Toast, loading, etc
│
├── js/
│   ├── config.js         # Configuração API
│   ├── api.js            # Cliente HTTP
│   ├── state.js          # Estado global
│   ├── cardapio.js       # Cardápio e renderização
│   ├── carrinho.js       # Lógica do carrinho
│   ├── pedidos.js        # Confirmação e tracking
│   ├── conta-mesa.js     # Conta da mesa
│   ├── notifications.js  # Notificações e toasts
│   └── utils.js          # Utilitários
│
└── README.md (este arquivo)
```

## 🎯 O que é

Cardápio digital interativo para o cliente fazer pedidos pelo seu celular via QR code.

**Recursos:**
- ✅ Busca e filtro por categorias
- ✅ Customização de produtos (ingredientes, observações)
- ✅ Carrinho persistente (sessionStorage)
- ✅ Acompanhamento de pedidos em tempo real
- ✅ Notificações quando pedido fica pronto
- ✅ Visualização da conta (total consumido)
- ✅ Fallback offline funcional

## 🚀 Como desenvolver

### Adicionar novo componente (ex: cupons)

1. Criar `js/cupons.js` com funções de lógica
2. Criar `css/cupons.css` com estilos isolados
3. Importar em `index.html`
4. Testar via browser

### Estrutura básica de módulo

```javascript
// js/cupons.js
export async function carregarCupons() {
  try {
    const dados = await api('/cupons');
    renderCupons(dados);
  } catch(e) {
    showToast('Erro ao carregar cupons', 'error');
  }
}

export function renderCupons(cupons) {
  // Renderizar UI
}

export const cuponsModule = {
  carregarCupons,
  renderCupons,
};
```

## 📋 Próximos passos

- [ ] Separar CSS (9 arquivos)
- [ ] Modularizar JavaScript  
- [ ] Criar HTML limpo
- [ ] Testes de performance
- [ ] PWA (offline-first)

## 🔧 Testing

```bash
# Em desenvolvimento
python -m http.server 8080

# Acessar com QR code
http://localhost:8080?mesa=1
```

## 📦 Deploy

Deploy automático para `cliente/index.html` quando commitado em main.
