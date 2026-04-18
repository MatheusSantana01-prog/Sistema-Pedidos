/* ════════════════════════════════════════════════════
   CONFIG E ESTADO GLOBAL v4.0
   BUGFIX: config.js e admin.js tinham CONFIG duplicada — agora única fonte
   MELHORIA: API_URL configurável via variável de ambiente (meta tag)
════════════════════════════════════════════════════ */

// Lê URL da API de uma meta tag para facilitar deploy sem rebuild
// Ex: <meta name="api-url" content="https://meubackend.com">
const apiMeta = document.querySelector('meta[name="api-url"]');
export const API      = apiMeta?.content || 'http://localhost:8000';
export const SUPA_URL  = 'https://lhrfemeunswviwzdpppp.supabase.co';
export const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxocmZlbWV1bnN3dml3emRwcHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMDUzMjYsImV4cCI6MjA4ODY4MTMyNn0.JsHPjGJCCAePfCicpvP4Fk-UWTwW8ve-SXjjLQN2mb4';

// Estado global — única fonte de verdade
export const state = {
  TOKEN:    localStorage.getItem('admin_token') || null,
  USUARIO:  JSON.parse(localStorage.getItem('admin_user') || 'null'),
  ROLE_LEVEL: { dono: 4, gerente: 3, funcionario: 2, cozinha: 1 },
  todosOsPedidos: [],
  produtosMap:    {},
  insumosMap:     {},
  usuariosMap:    {},
  filtroAtual:    'todos',
  mesaAberta:     null,
  pgtoSelecionado: null,
  categorias:     [],
  fornecedores:   [],
  pollingHandle:  null,
};

export function updateState(updates) {
  Object.assign(state, updates);
  // Persiste token e usuário
  if ('TOKEN' in updates)  localStorage.setItem('admin_token', updates.TOKEN || '');
  if ('USUARIO' in updates) localStorage.setItem('admin_user', JSON.stringify(updates.USUARIO || null));
  // Limpa storage ao fazer logout
  if (updates.TOKEN === null) {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
  }
}
