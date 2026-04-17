/* ════════════════════════════════════════════════════
   CONFIG E ESTADO GLOBAL
════════════════════════════════════════════════════ */

// API Endpoints
export const API = 'http://localhost:8000'; // FastAPI local
export const SUPA_URL  = 'https://lhrfemeunswviwzdpppp.supabase.co';
export const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxocmZlbWV1bnN3dml3emRwcHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMDUzMjYsImV4cCI6MjA4ODY4MTMyNn0.JsHPjGJCCAePfCicpvP4Fk-UWTwW8ve-SXjjLQN2mb4';

// Estado Global
export const state = {
  TOKEN: localStorage.getItem('admin_token') || null,
  USUARIO: JSON.parse(localStorage.getItem('admin_user') || 'null'),
  ROLE_LEVEL: { dono: 4, gerente: 3, funcionario: 2, cozinha: 1 },
  todosOsPedidos: [],
  produtosMap: {},
  insumosMap: {},
  usuariosMap: {},
  filtroAtual: 'todos',
  mesaAberta: null,
  pgtoSelecionado: null,
  categorias: [],
  fornecedores: [],
  pollingHandle: null,
};

// Atualizar estado dinamicamente
export function updateState(updates) {
  Object.assign(state, updates);
  localStorage.setItem('admin_token', state.TOKEN || '');
  localStorage.setItem('admin_user', JSON.stringify(state.USUARIO || null));
}
