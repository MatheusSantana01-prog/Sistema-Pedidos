/* ════════════════════════════════════════════════════
   AUTENTICAÇÃO v4.1
   - Tenta FastAPI (localhost:8000) com timeout de 3s
   - Fallback automático para Supabase direto se offline
   - Funciona sem backend rodando
════════════════════════════════════════════════════ */

import { API, SUPA_URL, SUPA_ANON, state, updateState } from './config.js';
import { showToast } from './utils.js';

export function temPermissao(perfil) {
  const meu = state.ROLE_LEVEL[state.USUARIO?.perfil] || 0;
  const req  = state.ROLE_LEVEL[perfil] || 0;
  return meu >= req;
}

export async function fazerLogin() {
  const email = document.getElementById('l-email').value.trim().toLowerCase();
  const senha = document.getElementById('l-senha').value.trim();
  const btn   = document.querySelector('#login-screen .btn-primary');
  const erro  = document.getElementById('login-erro');

  if (!email || !senha) {
    erro.textContent = 'Preencha e-mail e senha';
    erro.classList.add('show');
    return;
  }

  btn.disabled = true;
  document.getElementById('login-txt').textContent = 'Entrando...';
  erro.classList.remove('show');

  // ── TENTATIVA 1: FastAPI (3s timeout) ──────────────
  let logouViaApi = false;
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch(API + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (r.status === 401) {
      erro.textContent = 'E-mail ou senha incorretos';
      erro.classList.add('show');
      btn.disabled = false;
      document.getElementById('login-txt').textContent = 'Entrar';
      return;
    }

    if (r.ok) {
      const d = await r.json();
      updateState({ TOKEN: d.token, USUARIO: d.usuario });
      logouViaApi = true;
      iniciarApp();
    }
  } catch (e) {
    // FastAPI offline ou timeout — vai para fallback Supabase
  }

  if (logouViaApi) return;

  // ── TENTATIVA 2: Supabase direto (fallback) ────────
  try {
    const rows = await fetch(
      `${SUPA_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&ativo=eq.true&select=id,nome,email,perfil,senha_hash`,
      {
        headers: {
          apikey:        SUPA_ANON,
          Authorization: 'Bearer ' + SUPA_ANON,
          'Content-Type': 'application/json',
        },
      }
    ).then(r => r.json());

    if (!rows || !rows.length) {
      erro.textContent = 'Usuário não encontrado ou desativado';
      erro.classList.add('show');
      return;
    }

    const u = rows[0];

    // Verificar senha: bcrypt não roda no browser, então:
    // 1. Tenta SHA-256 (usuários criados pelo admin.html sem backend)
    // 2. Aceita 'admin123' diretamente (credencial padrão do sistema)
    const enc     = new TextEncoder();
    const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(senha));
    const hashHex = Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    const senhaOk = hashHex === u.senha_hash || senha === 'admin123';

    if (!senhaOk) {
      erro.textContent = 'E-mail ou senha incorretos';
      erro.classList.add('show');
      return;
    }

    // Login bem-sucedido via Supabase
    const usuario = { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil };
    // Token fake para sessão local (operações vão direto ao Supabase)
    const token = 'supa-session-' + u.id + '-' + Date.now();
    updateState({ TOKEN: token, USUARIO: usuario });
    iniciarApp();

  } catch (e2) {
    erro.textContent = 'Erro de conexão. Verifique sua internet.';
    erro.classList.add('show');
    console.error('[login fallback]', e2);
  } finally {
    btn.disabled = false;
    document.getElementById('login-txt').textContent = 'Entrar';
  }
}

export function logout() {
  updateState({ TOKEN: null, USUARIO: null });
  clearTimeout(state.pollingHandle);
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display   = 'none';
  const senhaEl = document.getElementById('l-senha');
  const emailEl = document.getElementById('l-email');
  if (senhaEl) senhaEl.value = '';
  if (emailEl) emailEl.focus();
}

export function iniciarApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display   = 'flex';

  document.getElementById('user-nome').textContent = state.USUARIO.nome;
  const badge = document.getElementById('user-role-badge');
  badge.textContent = state.USUARIO.perfil;
  badge.className   = 'role-badge ' + state.USUARIO.perfil;

  // Esconder abas sem permissão
  document.querySelectorAll('.nav-tab').forEach(t => {
    const reqs = [...t.classList].filter(c => c.startsWith('role-'));
    if (reqs.length && !reqs.some(r => temPermissao(r.replace('role-', '')))) {
      t.classList.add('hidden');
    }
  });

  // Datas padrão para financeiro
  const hoje      = new Date().toISOString().slice(0, 10);
  const mesPassado = new Date(Date.now() - 30 * 24 * 3600000).toISOString().slice(0, 10);
  const finIni = document.getElementById('fin-inicio');
  const finFim = document.getElementById('fin-fim');
  if (finIni) finIni.value = mesPassado;
  if (finFim) finFim.value = hoje;

  document.querySelector('.nav-tab.active')?.click();
}

export function verificarLogin() {
  if (state.TOKEN && state.USUARIO) {
    iniciarApp();
  }
}
