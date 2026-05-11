let estadoAnt  = {};
let tentativas = 0;
let polling    = null;
let RESTAURANT = null;

async function init() {
  RESTAURANT = await initTenant();
  if (!RESTAURANT) return;
  if (isLoggedIn()) iniciarKDS();
}

async function fazerLogin() {
  const email = document.getElementById('l-email').value.trim();
  const senha = document.getElementById('l-senha').value.trim();
  const erro  = document.getElementById('login-erro');
  erro.classList.remove('show');
  try {
    const slug = getCurrentRestaurantSlug();
    await login(email, senha, slug);
    iniciarKDS();
  } catch (e) {
    erro.textContent = e.message;
    erro.classList.add('show');
  }
}

function iniciarKDS() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('kds-screen').style.display   = 'flex';
  tickRelogio();
  carregar();
  function agendar() {
    polling = setTimeout(() => {
      if (document.visibilityState !== 'hidden') carregar().finally(agendar);
      else agendar();
    }, window.SAAS_CONFIG.POLL_COZINHA);
  }
  agendar();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { clearTimeout(polling); carregar().finally(agendar); }
  });
}

function tickRelogio() {
  const el = document.getElementById('relogio');
  const t  = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  if (el && el.textContent !== t) el.textContent = t;
  setTimeout(tickRelogio, 1000 - (Date.now() % 1000));
}

async function carregar() {
  try {
    const data = await apiCall('GET', '/api/kitchen/queue');
    setOnline();
    detectarNovos(data.pedidos || []);
    renderBoard(data.pedidos || []);
    estadoAnt = Object.fromEntries((data.pedidos||[]).map(p => [p.id, p.status]));
  } catch (e) {
    tentativas++;
    if (tentativas >= 2) setOffline();
  }
}

function detectarNovos(pedidos) {
  pedidos.forEach(p => {
    const ant = estadoAnt[p.id];
    if (!ant || (ant !== p.status && ['pendente','confirmado'].includes(p.status))) {
      const notif = document.getElementById('notif');
      notif.textContent = `🔔 ${mesaLabel(p)} — Pedido #${p.numero}`;
      notif.classList.add('show');
      clearTimeout(notif._t);
      notif._t = setTimeout(() => notif.classList.remove('show'), 4000);
      if (navigator.vibrate) navigator.vibrate([200,100,200]);
    }
  });
}

function renderBoard(pedidos) {
  const cols = {pendente:[],confirmado:[],em_preparo:[],pronto:[]};
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

function diffColuna(col, lista, status) {
  const esperados = new Set(lista.map(p => 'card-' + p.id));
  Array.from(col.querySelectorAll('.card')).forEach(el => {
    if (!esperados.has(el.id)) {
      el.style.transition = 'opacity .2s, transform .2s';
      el.style.opacity = '0'; el.style.transform = 'scale(.95)';
      setTimeout(() => el.remove(), 200);
    }
  });
  if (!lista.length) {
    setTimeout(() => { if (!col.querySelector('.card')) col.innerHTML = vazioHtml(status); }, 220);
    return;
  }
  const vazio = col.querySelector('.col-empty');
  if (vazio) vazio.remove();
  lista.forEach(p => {
    if (!document.getElementById('card-' + p.id)) {
      const tmp = document.createElement('div');
      tmp.innerHTML = cardHtml(p, status);
      const card = tmp.firstElementChild;
      card.style.opacity = '0'; card.style.transform = 'translateY(10px)';
      col.appendChild(card);
      requestAnimationFrame(() => {
        card.style.transition = 'opacity .25s, transform .25s';
        card.style.opacity = '1'; card.style.transform = 'none';
      });
    }
  });
}

function atualizarTimers(pedidos) {
  pedidos.forEach(p => {
    const card = document.getElementById('card-' + p.id);
    if (!card) return;
    const el = card.querySelector('.card-tempo');
    if (!el) return;
    const mins = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 60000);
    const cls  = mins < 10 ? 'ok' : mins < 20 ? 'warn' : 'urgent';
    const txt  = mins < 60 ? mins + 'min' : Math.floor(mins/60)+'h'+(mins%60>0?(mins%60)+'m':'');
    el.textContent = txt;
    if (!el.classList.contains(cls)) el.className = 'card-tempo ' + cls;
  });
}

function mesaLabel(p) {
  if (p.mesas?.numero) return 'Mesa ' + p.mesas.numero;
  if (p.sessao_cliente) return p.sessao_cliente.replace('mesa_','Mesa ');
  return 'Mesa ?';
}

function cardHtml(p, status) {
  const mins = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 60000);
  const tempoCls = mins < 10 ? 'ok' : mins < 20 ? 'warn' : 'urgent';
  const tempoTxt = mins < 60 ? mins+'min' : Math.floor(mins/60)+'h'+(mins%60>0?(mins%60)+'m':'');
  const itensHtml = (p.pedido_itens||[]).map(it => {
    const rem = (it.pedido_item_ingredientes||[]).filter(i=>i.acao==='remover').map(i=>i.nome_ingrediente);
    return `<div class="item-row">
      <div class="item-qty">${it.quantidade}×</div>
      <div class="item-info">
        <div class="item-nome">${it.nome_produto}</div>
        ${rem.length?`<div class="item-mods">✕ Sem: ${rem.join(', ')}</div>`:''}
        ${it.observacao?`<div class="item-obs">📝 ${it.observacao}</div>`:''}
      </div></div>`;
  }).join('');
  const ACOES = {
    pendente:   {label:'Confirmar →',    cls:'btn-confirmar',next:'confirmado'},
    confirmado: {label:'▶ Iniciar',       cls:'btn-preparo',  next:'em_preparo'},
    em_preparo: {label:'✓ Pronto',        cls:'btn-pronto',   next:'pronto'},
    pronto:     {label:'✓ Entregue',      cls:'btn-entregar', next:'entregue'},
  };
  const a = ACOES[status];
  const btn = a ? `<button class="btn-acao ${a.cls}" onclick="avancar('${p.id}','${a.next}',this)">${a.label}</button>` : '';
  return `<div class="card" id="card-${p.id}">
    <div class="card-head">
      <div class="card-mesa">${mesaLabel(p)}</div>
      <div class="card-meta">
        <span class="card-num">#${p.numero}</span>
        <span class="card-tempo ${tempoCls}">${tempoTxt}</span>
      </div>
    </div>
    <div class="card-itens">${itensHtml}</div>
    ${p.observacao_geral?`<div class="card-obs">⚠️ ${p.observacao_geral}</div>`:''}
    <div class="card-actions">${btn}</div>
  </div>`;
}

function vazioHtml(status) {
  const M = {pendente:{icon:'✓',txt:'Tudo em dia'},confirmado:{icon:'✓',txt:'Nenhum esperando'},em_preparo:{icon:'🔥',txt:'Nada no fogo'},pronto:{icon:'🛎',txt:'Nenhum aguardando'}}[status]||{icon:'✓',txt:''};
  return `<div class="col-empty"><div class="col-empty-icon">${M.icon}</div><div class="col-empty-txt">${M.txt}</div></div>`;
}

async function avancar(pedidoId, novoStatus, btn) {
  btn.disabled = true; btn.textContent = '...';
  try {
    await apiCall('PATCH', `/api/kitchen/orders/${pedidoId}/status`, { status: novoStatus });
    const card = document.getElementById('card-' + pedidoId);
    if (card) { card.style.transition='opacity .2s,transform .2s'; card.style.opacity='0'; card.style.transform='scale(.95)'; delete estadoAnt[pedidoId]; }
    await new Promise(r => setTimeout(r, 220));
    await carregar();
  } catch(e) {
    btn.style.background = '#ef4444';
    btn.textContent = '⚠ Erro';
    setTimeout(() => { btn.disabled=false; btn.style.background=''; btn.textContent='Tentar novamente'; }, 3000);
  }
}

function setOnline() {
  tentativas = 0;
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

