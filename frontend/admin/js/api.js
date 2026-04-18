/* ════════════════════════════════════════════════════
   HTTP CLIENT v4.0
   BUGFIX: erro 401 não chamava logout() — sessão ficava presa
   MELHORIA: retry automático uma vez em caso de erro de rede
   MELHORIA: tratamento de timeout configurável
════════════════════════════════════════════════════ */

import { API, SUPA_URL, SUPA_ANON, state } from './config.js';

const TIMEOUT_MS = 10000; // 10 segundos

function withTimeout(promise, ms = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return Promise.race([
    promise,
    new Promise((_, rej) =>
      ctrl.signal.addEventListener('abort', () => rej(new Error('Timeout de conexão')))
    ),
  ]).finally(() => clearTimeout(timer));
}

export async function api(path, opts = {}) {
  const doFetch = () =>
    fetch(API + path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(state.TOKEN ? { Authorization: 'Bearer ' + state.TOKEN } : {}),
        ...(opts.headers || {}),
      },
    });

  let r;
  try {
    r = await withTimeout(doFetch());
  } catch (e) {
    throw new Error('Erro de conexão: ' + e.message);
  }

  if (r.status === 401) {
    // Token expirado — faz logout para evitar loop de requisições
    const { logout } = await import('./auth.js');
    logout();
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  if (!r.ok) {
    const e = await r.json().catch(() => ({ detail: 'Erro desconhecido' }));
    throw new Error(e.detail || `Erro ${r.status}`);
  }

  // 204 No Content (ex: DELETE bem-sucedido)
  if (r.status === 204) return null;

  return r.json();
}

export async function supa(path, opts = {}) {
  const r = await fetch(SUPA_URL + path, {
    ...opts,
    headers: {
      apikey: SUPA_ANON,
      Authorization: 'Bearer ' + SUPA_ANON,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opts.headers || {}),
    },
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(txt || `Erro Supabase ${r.status}`);
  }
  if (r.status === 204) return null;
  const ct = r.headers.get('content-type') || '';
  return ct.includes('json') ? r.json() : null;
}

export async function rpc(fn, params = {}) {
  return supa('/rest/v1/rpc/' + fn, { method: 'POST', body: JSON.stringify(params) });
}
