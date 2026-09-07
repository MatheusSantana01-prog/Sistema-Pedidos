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
  if (/^data:image\/(png|jpeg|jpg|webp);base64,[a-z0-9+/=]+$/i.test(raw)) {
    return raw;
  }
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

function rememberLoginKey(scope = 'default') {
  const slug = typeof getCurrentRestaurantSlug === 'function' ? getCurrentRestaurantSlug() : 'plataforma';
  return `saas_saved_login:${slug}:${scope}`;
}

function setupRememberedLogin(scope = 'default') {
  const email = document.getElementById('l-email');
  const remember = document.getElementById('l-remember');
  if (!email || !remember) return;
  const saved = localStorage.getItem(rememberLoginKey(scope)) || '';
  if (saved) {
    email.value = saved;
    remember.checked = true;
  }
}

function persistRememberedLogin(scope = 'default', identifier = '', remember = false) {
  const key = rememberLoginKey(scope);
  if (remember) localStorage.setItem(key, identifier);
  else localStorage.removeItem(key);
}

// ── Login ───────────────────────────────────────────────────────
async function login(email, senha, restaurantSlug = null, options = {}) {
  const identifier = email.trim();
  const resp = await fetch(`${AUTH_API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: identifier.toLowerCase(),
      username: identifier,
      login: identifier,
      senha: senha.trim(),
      restaurant_slug: restaurantSlug,
      remember_me: options.remember === true,
    }),
  });

  if (resp.status === 401) throw new Error('Login ou senha incorretos');
  if (resp.status === 403) throw new Error('Sem acesso a este restaurante');
  if (resp.status === 429) {
    const retryAfter = Number(resp.headers.get('Retry-After') || 0);
    const waitText = retryAfter > 0 ? ` Aguarde ${retryAfter}s e tente novamente.` : '';
    throw new Error(`Muitas tentativas de login.${waitText}`);
  }
  if (!resp.ok) {
    throw new Error(await readApiError(resp, 'Erro ao fazer login'));
  }

  const data = await resp.json();
  _token   = data.token;
  _usuario = data.usuario;
  localStorage.setItem('saas_token', _token);
  localStorage.setItem('saas_user',  JSON.stringify(_usuario));
  if (_usuario.password_change_required) setTimeout(abrirModalAlterarSenha, 0);
  return data;
}

// ── Trocar restaurante ──────────────────────────────────────────
async function switchRestaurant(slug) {
  const resp = await apiCall('POST', '/api/auth/switch-restaurant', { restaurant_slug: slug });
  _token   = resp.token;
  _usuario = { ..._usuario, restaurant: resp.restaurant, restaurant_id: resp.restaurant.id, role: resp.role };
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
  if (_usuario?.password_change_required && !path.startsWith('/api/auth/me')) {
    if (!document.getElementById('auth-password-modal')) abrirModalAlterarSenha();
    throw new Error('Altere sua senha para continuar');
  }

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

async function alterarMinhaSenha() {
  abrirModalAlterarSenha();
}

function notifyAuth(msg, tipo = 'success') {
  if (typeof window.showToast === 'function') {
    window.showToast(msg, tipo);
  } else {
    showAuthToast(msg, tipo);
  }
}

function showAuthToast(msg, tipo = 'success') {
  let toast = document.getElementById('auth-fallback-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'auth-fallback-toast';
    toast.className = 'auth-fallback-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `auth-fallback-toast show ${tipo || ''}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 3200);
}

function abrirModalAlterarSenha() {
  document.getElementById('auth-password-modal')?.remove();

  const wrap = document.createElement('div');
  wrap.className = 'auth-password-overlay show';
  wrap.id = 'auth-password-modal';
  wrap.innerHTML = `
    <div class="auth-password-card" role="dialog" aria-modal="true" aria-labelledby="auth-password-title">
      <div class="auth-password-head">
        <div>
          <div class="auth-password-eyebrow">Segurança da conta</div>
          <div class="auth-password-title" id="auth-password-title">Alterar senha</div>
        </div>
        <button class="auth-password-close" type="button" aria-label="Fechar" onclick="fecharModalAlterarSenha()">×</button>
      </div>
      <form class="auth-password-form" onsubmit="return enviarAlteracaoSenha(event)">
        <label class="auth-password-label" for="auth-senha-atual">Senha atual</label>
        <input class="auth-password-input" id="auth-senha-atual" type="password" autocomplete="current-password" required>

        <label class="auth-password-label" for="auth-nova-senha">Nova senha</label>
        <input class="auth-password-input" id="auth-nova-senha" type="password" autocomplete="new-password" minlength="12" required>

        <label class="auth-password-label" for="auth-confirmar-senha">Confirmar nova senha</label>
        <input class="auth-password-input" id="auth-confirmar-senha" type="password" autocomplete="new-password" minlength="12" required>

        <div class="auth-password-error" id="auth-password-error"></div>
        <div class="auth-password-actions">
          <button class="btn auth-password-cancel" type="button" onclick="fecharModalAlterarSenha()">${_usuario?.password_change_required ? 'Sair' : 'Cancelar'}</button>
          <button class="btn btn-primary auth-password-submit" id="auth-password-submit" type="submit">Salvar senha</button>
        </div>
      </form>
    </div>
  `;
  wrap.addEventListener('click', event => {
    if (event.target === wrap) fecharModalAlterarSenha();
  });
  document.body.appendChild(wrap);
  document.addEventListener('keydown', fecharSenhaComEscape);
  setTimeout(() => document.getElementById('auth-senha-atual')?.focus(), 0);
}

function fecharSenhaComEscape(event) {
  if (event.key === 'Escape') fecharModalAlterarSenha();
}

function fecharModalAlterarSenha() {
  if (_usuario?.password_change_required) {
    logout();
    window.location.reload();
    return;
  }
  const modal = document.getElementById('auth-password-modal');
  if (modal) modal.remove();
  document.removeEventListener('keydown', fecharSenhaComEscape);
}

function setSenhaErro(msg) {
  const erro = document.getElementById('auth-password-error');
  if (!erro) return;
  erro.textContent = msg || '';
  erro.classList.toggle('show', !!msg);
}

async function enviarAlteracaoSenha(event) {
  event.preventDefault();
  const senhaAtual = document.getElementById('auth-senha-atual')?.value || '';
  const novaSenha = document.getElementById('auth-nova-senha')?.value || '';
  const confirmarSenha = document.getElementById('auth-confirmar-senha')?.value || '';
  const btn = document.getElementById('auth-password-submit');

  setSenhaErro('');
  if (novaSenha.trim().length < 12) {
    setSenhaErro('A nova senha precisa ter no mínimo 12 caracteres.');
    return false;
  }
  if (novaSenha !== confirmarSenha) {
    setSenhaErro('A confirmação não confere com a nova senha.');
    return false;
  }
  if (senhaAtual === novaSenha) {
    setSenhaErro('A nova senha precisa ser diferente da senha atual.');
    return false;
  }

  const label = btn?.textContent || 'Salvar senha';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Salvando...';
  }
  try {
    await apiCall('PATCH', '/api/auth/me/password', {
      senha_atual: senhaAtual,
      nova_senha: novaSenha,
    });
    _usuario.password_change_required = false;
    fecharModalAlterarSenha();
    logout();
    window.location.reload();
  } catch (e) {
    setSenhaErro(e.message || 'Não foi possível alterar a senha.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = label;
    }
  }
  return false;
}

function fecharAppDialog(valor = null) {
  const modal = document.getElementById('app-dialog-modal');
  if (!modal) return;
  const resolver = modal._resolver;
  modal.remove();
  document.removeEventListener('keydown', fecharAppDialogComEscape);
  if (resolver) resolver(valor);
}

function fecharAppDialogComEscape(event) {
  if (event.key === 'Escape') fecharAppDialog(null);
}

function appDialogBase({ title, message, bodyHtml, confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false }) {
  fecharAppDialog(null);
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'auth-password-overlay show';
    wrap.id = 'app-dialog-modal';
    wrap._resolver = resolve;
    wrap.innerHTML = `
      <div class="auth-password-card app-dialog-card" role="dialog" aria-modal="true" aria-labelledby="app-dialog-title">
        <div class="auth-password-head">
          <div>
            <div class="auth-password-eyebrow">Confirmação</div>
            <div class="auth-password-title" id="app-dialog-title">${escapeHtml(title || 'Confirmar ação')}</div>
          </div>
          <button class="auth-password-close" type="button" aria-label="Fechar" onclick="fecharAppDialog(null)">×</button>
        </div>
        <form class="auth-password-form" id="app-dialog-form">
          ${message ? `<div class="app-dialog-message">${escapeHtml(message)}</div>` : ''}
          ${bodyHtml || ''}
          <div class="auth-password-error" id="app-dialog-error"></div>
          <div class="auth-password-actions">
            <button class="btn auth-password-cancel" type="button" onclick="fecharAppDialog(null)">${escapeHtml(cancelText)}</button>
            <button class="btn btn-primary app-dialog-confirm ${danger ? 'app-dialog-danger' : ''}" id="app-dialog-confirm" type="submit">${escapeHtml(confirmText)}</button>
          </div>
        </form>
      </div>
    `;
    wrap.addEventListener('click', event => {
      if (event.target === wrap) fecharAppDialog(null);
    });
    document.body.appendChild(wrap);
    document.addEventListener('keydown', fecharAppDialogComEscape);
  });
}

async function appConfirm(message, options = {}) {
  const result = appDialogBase({
    title: options.title || 'Confirmar ação',
    message,
    confirmText: options.confirmText || 'Confirmar',
    cancelText: options.cancelText || 'Cancelar',
    danger: !!options.danger,
  });
  document.getElementById('app-dialog-form')?.addEventListener('submit', event => {
    event.preventDefault();
    fecharAppDialog(true);
  });
  return !!(await result);
}

async function appPrompt(message, defaultValue = '', options = {}) {
  const inputId = 'app-dialog-input';
  const result = appDialogBase({
    title: options.title || 'Informar valor',
    message,
    confirmText: options.confirmText || 'Continuar',
    cancelText: options.cancelText || 'Cancelar',
    bodyHtml: `
      <input class="auth-password-input" id="${inputId}" type="${escapeAttr(options.type || 'text')}" value="${escapeAttr(defaultValue)}" autocomplete="off">
    `,
  });
  const input = document.getElementById(inputId);
  document.getElementById('app-dialog-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const value = input?.value ?? '';
    if (options.required !== false && !value.trim()) {
      const erro = document.getElementById('app-dialog-error');
      if (erro) {
        erro.textContent = options.requiredMessage || 'Preencha este campo.';
        erro.classList.add('show');
      }
      return;
    }
    fecharAppDialog(value);
  });
  setTimeout(() => input?.focus(), 0);
  return await result;
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
  login, logout, switchRestaurant, apiCall, apiPublic, alterarMinhaSenha, ROLE_LEVEL,
  fecharModalAlterarSenha, enviarAlteracaoSenha, appConfirm, appPrompt, fecharAppDialog,
  escapeHtml, escapeAttr, safeUrl, readApiError,
});
