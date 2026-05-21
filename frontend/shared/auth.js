/**
 * shared/auth.js
 * Autenticação multi-tenant.
 * O JWT retornado contém restaurant_id e role — nunca confia só no frontend.
 */

const AUTH_API_URL = window.SAAS_CONFIG.API_URL || "";

const ROLE_LEVEL = {
  super_admin: 99, owner: 5, manager: 4,
  cashier: 3, waiter: 2, kitchen: 1, tv: 0,
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function safeUrl(value, fallback = '') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  try {
    const url = new URL(raw, window.location.origin);
    if (['http:', 'https:'].includes(url.protocol)) return url.href;
  } catch (_) {}
  return fallback;
}

async function readApiError(resp, fallback) {
  let data = {};
  try { data = await resp.json(); } catch (_) {}
  const detail = data.detail || data.message || data.erro;
  if (Array.isArray(detail)) {
    const msg = detail.map(item => item.msg || item.message || JSON.stringify(item)).join('; ');
    return msg || fallback;
  }
  if (typeof detail === 'object' && detail) return detail.message || JSON.stringify(detail);
  return detail || fallback;
}

// ── Estado da sessão ────────────────────────────────────────────
let _token   = localStorage.getItem('saas_token')   || null;
let _usuario = JSON.parse(localStorage.getItem('saas_user') || 'null');

function getToken()   { return _token; }
function getUsuario() { return _usuario; }
function isLoggedIn() { return !!_token && !!_usuario; }

function temRole(role) {
  const meu = ROLE_LEVEL[_usuario?.role] || 0;
  const req  = ROLE_LEVEL[role] || 0;
  return meu >= req;
}

function isSuperAdmin() { return _usuario?.is_super_admin === true; }

function sessaoDoRestaurante(restaurante) {
  if (!_usuario || !restaurante?.id) return false;
  return _usuario.restaurant_id === restaurante.id;
}

function exigirSessaoRestaurante(restaurante) {
  if (!sessaoDoRestaurante(restaurante)) {
    logout();
    throw new Error('Entre novamente neste restaurante');
  }
}

function rolePermitida(roles) {
  if (!_usuario) return false;
  if (_usuario.is_super_admin && _usuario.restaurant_id) return true;
  return roles.includes(_usuario.role);
}

function exigirPerfil(roles, mensagem = 'Entre com um usuário autorizado para este painel') {
  if (!rolePermitida(roles)) {
    logout();
    throw new Error(mensagem);
  }
}

// ── Login ───────────────────────────────────────────────────────
async function login(email, senha, restaurantSlug = null) {
  const identifier = email.trim();
  const resp = await fetch(`${AUTH_API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: identifier.toLowerCase(), username: identifier, login: identifier, senha: senha.trim(), restaurant_slug: restaurantSlug }),
  });

  if (resp.status === 401) throw new Error('Login ou senha incorretos');
  if (resp.status === 403) throw new Error('Sem acesso a este restaurante');
  if (!resp.ok) {
    throw new Error(await readApiError(resp, 'Erro ao fazer login'));
  }

  const data = await resp.json();
  _token   = data.token;
  _usuario = data.usuario;
  localStorage.setItem('saas_token', _token);
  localStorage.setItem('saas_user',  JSON.stringify(_usuario));
  return data;
}

// ── Trocar restaurante ──────────────────────────────────────────
async function switchRestaurant(slug) {
  const resp = await apiCall('POST', '/api/auth/switch-restaurant', { restaurant_slug: slug });
  _token   = resp.token;
  _usuario = { ..._usuario, ...resp };
  localStorage.setItem('saas_token', _token);
  localStorage.setItem('saas_user',  JSON.stringify(_usuario));
  return resp;
}

// ── Logout ──────────────────────────────────────────────────────
function logout() {
  _token = null; _usuario = null;
  localStorage.removeItem('saas_token');
  localStorage.removeItem('saas_user');
}

// ── Chamada autenticada à API ────────────────────────────────────
async function apiCall(method, path, body = null, opts = {}) {
  if (!_token) throw new Error('Não autenticado');

  const resp = await fetch(`${AUTH_API_URL}${path}`, {
    method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${_token}`,
      ...(opts.headers || {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (resp.status === 401) {
    logout();
    window.location.reload();
    throw new Error('Sessão expirada');
  }
  if (!resp.ok) {
    throw new Error(await readApiError(resp, `Erro ${resp.status}`));
  }
  if (resp.status === 204) return null;
  return resp.json();
}

// ── Chamada pública (sem auth) ──────────────────────────────────
async function apiPublic(method, path, body = null) {
  const resp = await fetch(`${AUTH_API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!resp.ok) {
    throw new Error(await readApiError(resp, `Erro ${resp.status}`));
  }
  return resp.json();
}

// Expor globalmente
Object.assign(window, {
  getToken, getUsuario, isLoggedIn, temRole, isSuperAdmin,
  sessaoDoRestaurante, exigirSessaoRestaurante, rolePermitida, exigirPerfil,
  login, logout, switchRestaurant, apiCall, apiPublic, ROLE_LEVEL,
  escapeHtml, escapeAttr, safeUrl, readApiError,
});
