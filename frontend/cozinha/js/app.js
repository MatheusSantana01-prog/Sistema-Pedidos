/**
 * cozinha/js/app.js
 * KDS — Tela da cozinha (TV)
 * - Atualização por diff: não recria cards existentes, não pisca
 * - Scroll independente por coluna (muitos pedidos não travam o layout)
 * - Botão com auto-reset em caso de erro
 * - Detecção de pedidos novos com notificação
 */

const SUPABASE_URL  = 'https://lhrfemeunswviwzdpppp.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxocmZlbWV1bnN3dml3emRwcHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMDUzMjYsImV4cCI6MjA4ODY4MTMyNn0.JsHPjGJCCAePfCicpvP4Fk-UWTwW8ve-SXjjLQN2mb4';
const POLL_MS = 8000;

/* ── HTTP ──────────────────────────────────────────── */
async function supa(path, opts = {}) {
  const headers = {
    'apikey':        SUPABASE_ANON,
    'Authorization': 'Bearer ' + SUPABASE_ANON,
    'Content-Type':  'application/json',
  };
  if (opts.headers) Object.assign(headers, opts.headers);
  const { headers: _, ...rest } = opts;
  const r = await fetch(SUPABASE_URL + path, { ...rest, headers });
  if (!r.ok) throw new Error((await r.text()) || 'Erro ' + r.status);
  if (r.status === 204) return null;
  return r.json();
}

/* ── ESTADO ────────────────────────────────────────── */
let estadoAnterior = {};
let tentativaErro  = 0;
let pollingHandle  = null;

/* ── INIT ──────────────────────────────────────────── */
function init() {
  tickRelogio();
  carregar();

  function agendar() {
    pollingHandle = setTimeout(() => {
      if (document.visibilityState !== 'hidden') {
        carregar().finally(agendar);
      } else {
        agendar();
      }
    }, POLL_MS);
  }
  agendar();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      clearTimeout(pollingHandle);
      carregar().finally(agendar);
    }
  });
}

function tickRelogio() {
  const el  = document.getElementById('relogio');
  const txt = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (el && el.textContent !== txt) el.textContent = txt;
  setTimeout(tickRelogio, 1000 - (Date.now() % 1000));
}

/* ── CARREGAR FILA ─────────────────────────────────── */
async function carregar() {
  try {
    const pedidos = await supa(
      '/rest/v1/pedidos' +
      '?select=id,numero,status,created_at,mesa_id,sessao_cliente,observacao_geral,' +
      'mesas(numero),' +
      'pedido_itens(id,nome_produto,quantidade,observacao,' +
      'pedido_item_ingredientes(acao,nome_ingrediente))' +
      '&status=in.(pendente,confirmado,em_preparo,pronto)' +
      '&order=created_at.asc'
    );
    setOnline();
    detectarNovos(pedidos || []);
    renderBoard(pedidos || []);
    estadoAnterior = Object.fromEntries((pedidos || []).map(p => [p.id, p.status]));
  } catch (e) {
    tentativaErro++;
    if (tentativaErro >= 2) setOffline();
  }
}

function detectarNovos(pedidos) {
  pedidos.forEach(p => {
    const ant = estadoAnterior[p.id];
    const ehNovo    = !ant;
    const mudouPara = ant && ant !== p.status && (p.status === 'pendente' || p.status === 'confirmado');
    if (ehNovo || mudouPara) {
      dispararNotif(`${mesaLabel(p)} — Pedido #${p.numero}`);
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
  });
}

/* ── RENDER BOARD ──────────────────────────────────── */
function renderBoard(pedidos) {
  const cols = { pendente: [], confirmado: [], em_preparo: [], pronto: [] };
  pedidos.forEach(p => { if (cols[p.status]) cols[p.status].push(p); });

  const fila = cols.pendente.length + cols.confirmado.length + cols.em_preparo.length;
  document.getElementById('stat-fila').textContent    = fila;
  document.getElementById('stat-prontos').textContent = cols.pronto.length;

  Object.entries(cols).forEach(([status, lista]) => {
    document.getElementById('cnt-' + status).textContent = lista.length;
    diffColuna(document.getElementById('col-' + status), lista, status);
  });

  atualizarTimers(pedidos);
}

/* diffColuna: só mexe no que mudou — não recria cards existentes */
function diffColuna(col, lista, status) {
  const esperados = new Set(lista.map(p => 'card-' + p.id));

  // 1. Remover cards que saíram desta coluna
  Array.from(col.querySelectorAll('.card')).forEach(el => {
    if (!esperados.has(el.id)) {
      el.style.transition = 'opacity .2s, transform .2s';
      el.style.opacity    = '0';
      el.style.transform  = 'scale(.95)';
      setTimeout(() => el.remove(), 200);
    }
  });

  // 2. Se vazia, mostrar placeholder após a animação de saída
  if (!lista.length) {
    setTimeout(() => {
      if (!col.querySelector('.card')) col.innerHTML = vazioHtml(status);
    }, 220);
    return;
  }

  // 3. Remover placeholder se existir
  const vazio = col.querySelector('.col-empty');
  if (vazio) vazio.remove();

  // 4. Adicionar cards novos (os existentes não são tocados)
  lista.forEach(p => {
    if (!document.getElementById('card-' + p.id)) {
      const tmp  = document.createElement('div');
      tmp.innerHTML = cardHtml(p, status);
      const card = tmp.firstElementChild;
      card.style.opacity   = '0';
      card.style.transform = 'translateY(10px)';
      col.appendChild(card);
      requestAnimationFrame(() => {
        card.style.transition = 'opacity .25s, transform .25s';
        card.style.opacity    = '1';
        card.style.transform  = 'none';
      });
    }
  });
}

/* Atualiza apenas o texto do timer — sem recriar o card */
function atualizarTimers(pedidos) {
  pedidos.forEach(p => {
    const card = document.getElementById('card-' + p.id);
    if (!card) return;
    const el  = card.querySelector('.card-tempo');
    if (!el)  return;
    const mins = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 60000);
    const cls  = mins < 10 ? 'ok' : mins < 20 ? 'warn' : 'urgent';
    const txt  = mins < 60 ? mins + 'min' : Math.floor(mins / 60) + 'h' + (mins % 60 > 0 ? (mins % 60) + 'm' : '');
    el.textContent = txt;
    if (!el.classList.contains(cls)) el.className = 'card-tempo ' + cls;
  });
}

/* ── HTML DOS CARDS ────────────────────────────────── */
function mesaLabel(p) {
  if (p.mesas?.numero) return 'Mesa ' + p.mesas.numero;
  if (p.sessao_cliente) return p.sessao_cliente.replace('mesa_', 'Mesa ');
  return 'Mesa ?';
}

function cardHtml(p, status) {
  const mins     = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 60000);
  const tempoCls = mins < 10 ? 'ok' : mins < 20 ? 'warn' : 'urgent';
  const tempoTxt = mins < 60 ? mins + 'min' : Math.floor(mins / 60) + 'h' + (mins % 60 > 0 ? (mins % 60) + 'm' : '');

  const itensHtml = (p.pedido_itens || []).map(it => {
    const rem = (it.pedido_item_ingredientes || [])
      .filter(i => i.acao === 'remover').map(i => i.nome_ingrediente);
    return `<div class="item-row">
      <div class="item-qty">${it.quantidade}×</div>
      <div class="item-info">
        <div class="item-nome">${it.nome_produto}</div>
        ${rem.length ? `<div class="item-mods">✕ Sem: ${rem.join(', ')}</div>` : ''}
        ${it.observacao ? `<div class="item-obs">📝 ${it.observacao}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  const ACOES = {
    pendente:   { label: 'Confirmar →',       cls: 'btn-confirmar', next: 'confirmado'  },
    confirmado: { label: '▶ Iniciar preparo',  cls: 'btn-preparo',   next: 'em_preparo' },
    em_preparo: { label: '✓ Marcar pronto',    cls: 'btn-pronto',    next: 'pronto'     },
    pronto:     { label: '✓ Entregue',         cls: 'btn-entregar',  next: 'entregue'   },
  };
  const a = ACOES[status];
  const btn = a
    ? `<button class="btn-acao ${a.cls}" onclick="avancar('${p.id}','${a.next}',this)">${a.label}</button>`
    : '';

  return `<div class="card" id="card-${p.id}">
    <div class="card-head">
      <div class="card-mesa">${mesaLabel(p)}</div>
      <div class="card-meta">
        <span class="card-num">#${p.numero}</span>
        <span class="card-tempo ${tempoCls}">${tempoTxt}</span>
      </div>
    </div>
    <div class="card-itens">${itensHtml}</div>
    ${p.observacao_geral ? `<div class="card-obs">⚠️ ${p.observacao_geral}</div>` : ''}
    <div class="card-actions">${btn}</div>
  </div>`;
}

function vazioHtml(status) {
  const M = {
    pendente:   { icon: '✓',  txt: 'Tudo em dia'      },
    confirmado: { icon: '✓',  txt: 'Nenhum esperando' },
    em_preparo: { icon: '🔥', txt: 'Nada no fogo'      },
    pronto:     { icon: '🛎', txt: 'Nenhum aguardando' },
  }[status] || { icon: '✓', txt: '' };
  return `<div class="col-empty"><div class="col-empty-icon">${M.icon}</div><div class="col-empty-txt">${M.txt}</div></div>`;
}

/* ── AÇÃO: AVANÇAR STATUS ──────────────────────────── */
async function avancar(pedidoId, novoStatus, btn) {
  btn.disabled    = true;
  btn.textContent = '...';

  const extra = { updated_at: new Date().toISOString() };
  if (novoStatus === 'em_preparo') extra.tempo_inicio_preparo = extra.updated_at;
  if (novoStatus === 'pronto')     extra.tempo_pronto         = extra.updated_at;
  if (novoStatus === 'entregue')   extra.tempo_entrega        = extra.updated_at;

  try {
    await supa(`/rest/v1/pedidos?id=eq.${pedidoId}`, {
      method:  'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body:    JSON.stringify({ status: novoStatus, ...extra }),
    });

    const card = document.getElementById('card-' + pedidoId);
    if (card) {
      card.style.transition = 'opacity .2s, transform .2s';
      card.style.opacity    = '0';
      card.style.transform  = 'scale(.95)';
      delete estadoAnterior[pedidoId];
    }
    await new Promise(r => setTimeout(r, 220));
    await carregar();
  } catch (e) {
    btn.style.background = '#ef4444';
    btn.textContent      = '⚠ Erro — toque para tentar';
    setTimeout(() => {
      btn.disabled         = false;
      btn.style.background = '';
      btn.textContent      = 'Tentar novamente';
    }, 3000);
  }
}

/* ── FEEDBACK ──────────────────────────────────────── */
function dispararNotif(msg) {
  const el = document.getElementById('notif');
  el.textContent = '🔔 ' + msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 4000);
}

function setOnline() {
  tentativaErro = 0;
  document.getElementById('offline-bar').classList.remove('show');
  const dot = document.querySelector('.live-dot');
  if (dot) dot.style.background = '#2dbe6c';
}

function setOffline() {
  document.getElementById('offline-bar').classList.add('show');
  const dot = document.querySelector('.live-dot');
  if (dot) dot.style.background = '#ef4444';
}

init();
