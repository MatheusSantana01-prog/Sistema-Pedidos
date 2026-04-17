# Projeto COZINHA - Kitchen Display System (KDS)

## 📱 Estrutura

```
cozinha/
├── index.html                           # HTML principal
├── css/
│   ├── variables.css      # Variáveis de tema
│   ├── base.css          # Estilos base
│   ├── kanban-board.css  # Layout kanban
│   ├── order-cards.css   # Cards de pedidos
│   ├── modals.css        # Modais (detalhes, observações)
│   ├── actions.css       # Botões e ações
│   ├── notifications.css # Alertas e notificações
│   └── utilities.css     # Loading, estados, etc
│
├── js/
│   ├── config.js         # Configuração API
│   ├── api.js            # Cliente HTTP
│   ├── state.js          # Estado global dos pedidos
│   ├── kanban.js         # Lógica do kanban
│   ├── orders.js         # Renderização de pedidos
│   ├── actions.js        # Marcar pronto, cancelar, etc
│   ├── realtime.js       # WebSocket/polling real-time
│   ├── notifications.js  # Alertas sonoros e visuais
│   └── utils.js          # Utilitários
│
└── README.md (este arquivo)
```

## 🎯 O que é

Sistema de exibição para cozinha que mostra pedidos em tempo real em um Kanban interativo.

**Recursos:**
- ✅ Kanban board com colunas (Novos, Em Preparo, Prontos)
- ✅ Cards de pedidos com itens, quantidade e observações
- ✅ Atualização em tempo real via WebSocket/polling
- ✅ Diff rendering (apenas o que mudou atualiza)
- ✅ Marcação de pedidos (em preparo, pronto, entregue)
- ✅ Observações e notas especiais destacadas
- ✅ Offloading offline com sincronização
- ✅ Alertas sonoros quando novo pedido chega
- ✅ Impressão de etiquetas de pedidos

## 🚀 Como desenvolver

### Adicionar novo status de pedido (ex: Cancelados)

1. Editar `js/state.js` para adicionar nova coluna
2. Atualizar `js/kanban.js` para renderizar coluna
3. Criar `css/kanban-board.css` com estilo da nova coluna
4. Atualizar lógica de transição em `js/actions.js`
5. Testar movimentação entre colunas

### Estrutura básica de módulo

```javascript
// js/orders.js
export async function carregarPedidos() {
  try {
    const dados = await api('/pedidos?status=novo');
    renderPedidos(dados);
  } catch(e) {
    showNotification('Erro ao carregar pedidos', 'error');
  }
}

export function renderPedidos(pedidos) {
  // Atualizar kanban com novos pedidos
}

export const ordersModule = {
  carregarPedidos,
  renderPedidos,
};
```

### Estrutura de pedido

```javascript
{
  id: 123,
  mesa: 5,
  status: 'novo', // novo, preparando, pronto, entregue
  items: [
    { 
      id: 1,
      nome: 'Pasta Carbonara',
      quantidade: 2,
      observacao: 'Sem alho'
    }
  ],
  observacoesMesa: 'Alérgico a amendoim',
  horaRecebida: '2026-04-15T12:30:00Z',
  tempoPreparo: 15, // minutos estimados
}
```

## 📋 Próximos passos

- [ ] Separar CSS (8 arquivos)
- [ ] Modularizar JavaScript
- [ ] Criar HTML limpo
- [ ] WebSocket real-time
- [ ] Alertas sonoros
- [ ] Impressão de etiquetas
- [ ] Testes de performance

## 🔧 Testing

```bash
# Em desenvolvimento
python -m http.server 8080

# Acessar na cozinha
http://localhost:8080
```

## 📦 Deploy

Deploy automático para `cozinha/index.html` quando commitado em main.
