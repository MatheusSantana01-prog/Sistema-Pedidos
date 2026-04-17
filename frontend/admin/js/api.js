/* ════════════════════════════════════════════════════
   HTTP CLIENT
════════════════════════════════════════════════════ */

import { API, SUPA_URL, SUPA_ANON, state } from './config.js';

export async function api(path, opts = {}) {
  const r = await fetch(API + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(state.TOKEN ? { 'Authorization': 'Bearer ' + state.TOKEN } : {}),
      ...(opts.headers || {}),
    },
  });
  if (r.status === 401) {
    throw new Error('Sessão expirada');
  }
  if (!r.ok) {
    const e = await r.json().catch(() => ({ detail: 'Erro' }));
    throw new Error(e.detail || 'Erro');
  }
  return r.json();
}

export async function supa(path, opts = {}) {
  const r = await fetch(SUPA_URL + path, {
    ...opts,
    headers: {
      'apikey': SUPA_ANON,
      'Authorization': 'Bearer ' + SUPA_ANON,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(opts.headers || {}),
    },
  });
  if (!r.ok) throw new Error(await r.text());
  const ct = r.headers.get('content-type') || '';
  return ct.includes('json') ? r.json() : null;
}

export async function rpc(fn, params = {}) {
  return supa('/rest/v1/rpc/' + fn, { method: 'POST', body: JSON.stringify(params) });
}
