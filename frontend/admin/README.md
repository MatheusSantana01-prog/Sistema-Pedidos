# Estrutura do Projeto Admin - Sabor & Fogo

## Organização de Pastas

```
frontend/
├── admin/
│   ├── index.html                 # HTML principal
│   ├── css/
│   │   ├── variables.css          # Variáveis de cor e tema
│   │   ├── base.css               # Reset e estilos base
│   │   ├── login.css              # Estilos da tela de login
│   │   ├── navbar.css             # Barra de navegação e topbar
│   │   ├── buttons.css            # Estilos de botões e roles
│   │   ├── cards.css              # Cards (stats, mesas, etc)
│   │   ├── forms.css              # Formulários, tabelas e modais
│   │   ├── components.css         # Componentes (produtos, contas, etc)
│   │   └── utilities.css          # Loading, toast, auditoria, etc
│   └── js/
│       ├── config.js              # Configuração e estado global
│       ├── utils.js               # Funções utilitárias (fmt, toast, etc)
│       ├── api.js                 # Cliente HTTP (api, supa, rpc)
│       ├── auth.js                # Autenticação e permissões
│       ├── main.js                # Navegação e inicialização
│       ├── mesas.js               # Módulo de mesas
│       ├── pedidos.js             # Módulo de pedidos (a criar)
│       ├── produtos.js            # Módulo de produtos (a criar)
│       ├── estoque.js             # Módulo de estoque (a criar)
│       ├── caixa.js               # Módulo de caixa (a criar)
│       ├── financeiro.js          # Módulo financeiro (a criar)
│       ├── usuarios.js            # Módulo de usuários (a criar)
│       └── auditoria.js           # Módulo de auditoria (a criar)
├── cliente.html                   # (será reorganizado)
├── cozinha.html                   # (será reorganizado)
└── qrcodes-mesas.html             # (será reorganizado)
```

## Benefícios dessa Estrutura

✅ **Escalabilidade** - Adicionar novos módulos é simples e não quebra o existente
✅ **Manutenção** - CSS e JS organizados por funcionalidade
✅ **Reusabilidade** - Componentes podem ser compartilhados
✅ **Performance** - CSS minificado e carregamento otimizado
✅ **Git-friendly** - Branching e PRs mais limpas

## Como Desenvolver

### Adicionar novo módulo (ex: Pedidos)

1. Criar `js/pedidos.js` com as funções
2. Importar em `index.html`
3. Adicionar CSS necessário em `css/` conforme precisar
4. Registrar funções globais em `window.app.pedidos`

### Exemplo de novo módulo

```javascript
// js/pedidos.js
import { supa } from './api.js';
import { showToast } from './utils.js';

export async function carregarPedidos() {
  // Implementar
}

export const pedidosModule = {
  carregarPedidos,
};
```

```html
<!-- Em index.html -->
<script type="module">
  import { carregarPedidos } from './js/pedidos.js';
  window.app.pedidos = { carregarPedidos };
</script>
```

## Migração de admin.html

O arquivo original `admin.html` foi dividido em:

- **HTML Structure** → `index.html`
- **CSS** → 8 arquivos organizados em `css/`
- **JS** → Múltiplos módulos em `js/`

Backup do original em: `frontend/admin.html.backup`

## Para abrir o projeto no navegador

```bash
cd frontend/admin
# Use um servidor web local (não abra file://)
python -m http.server 8080
# Ou use Live Server no VS Code
```

Acesse: `http://localhost:8080`

## Próximas etapas

- [ ] Completar módulo de pedidos
- [ ] Completar módulo de produtos
- [ ] Completar módulo de estoque
- [ ] Adicionar módulo de caixa
- [ ] Adicionar módulo financeiro
- [ ] Adicionar módulo de usuários
- [ ] Adicionar módulo de auditoria
- [ ] Minificar CSS/JS para produção
