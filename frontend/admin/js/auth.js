/* ════════════════════════════════════════════════════
   AUTENTICAÇÃO v4.0
   BUGFIX: removido fallback direto ao Supabase com SHA-256 e senha 'admin123' hardcoded
   BUGFIX: logout agora limpa o localStorage corretamente
   MELHORIA: erro de rede diferenciado de credencial inválida
════════════════════════════════════════════════════ */

import { API, state, updateState } from './config.js';
import { showToast } from './utils.js';

export function temPermissao(perfil) {
  const meu = state.ROLE_LEVEL[state.USUARIO?.perfil] || 0;
  const req  = state.ROLE_LEVEL[perfil] || 0;
  return meu >= req;
}

export async function fazerLogin() {
  const email = document.getElementById('l-email').value.trim().toLowerCase();
  const senha = document.getElementById('l-senha').value;
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

  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000); // timeout 8s
    const r = await fetch(API + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (r.status === 429) {
      erro.textContent = 'Muitas tentativas. Aguarde 1 minuto.';
      erro.classList.add('show');
      return;
    }

    if (r.status === 401) {
      erro.textContent = 'E-mail ou senha incorretos';
      erro.classList.add('show');
      return;
    }

    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      erro.textContent = e.detail || 'Erro no servidor';
      erro.classList.add('show');
      return;
    }

    const d = await r.json();
    updateState({ TOKEN: d.token, USUARIO: d.usuario });
    iniciarApp();

  } catch (e) {
    if (e.name === 'AbortError') {
      erro.textContent = 'Servidor não respondeu. Verifique se o backend está rodando.';
    } else {
      erro.textContent = 'Erro de conexão com o servidor.';
      console.error('[login]', e);
    }
    erro.classList.add('show');
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
  // Limpa campos de login por segurança
  const emailEl = document.getElementById('l-email');
  const senhaEl = document.getElementById('l-senha');
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
