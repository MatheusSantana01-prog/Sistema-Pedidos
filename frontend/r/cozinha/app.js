let estadoAnt  = {};
let tentativas = 0;
let polling    = null;
let RESTAURANT = null;
const TEMPO_VISIVEL_POS_CONCLUSAO_MS = 15 * 60 * 1000;

async function init() {
  RESTAURANT = await initTenant();
  if (!RESTAURANT) return;
  setupRememberedLogin('cozinha');
  if (isLoggedIn() && sessaoDoRestaurante(RESTAURANT)) iniciarKDS();
  else if (isLoggedIn()) logout();
}

async function fazerLogin() {
  const email = document.getElementById('l-email').value.trim();
  const senha = document.getElementById('l-senha').value.trim();
  const erro  = document.getElementById('login-erro');
  erro.classList.remove('show');
  try {
    const slug = getCurrentRestaurantSlug();
    const remember = document.getElementById('l-remember')?.checked === true;
    await login(email, senha, slug, { remember });
    persistRememberedLogin('cozinha', email, remember);
    iniciarKDS();
  } catch (e) {
    erro.textContent = e.message;
    erro.classList.add('show');
  }
}

function iniciarKDS() {
  try {
    exigirSessaoRestaurante(RESTAURANT);
    exigirPerfil(['kitchen'], 'Use um login de cozinha para ver os pedidos');
  } catch (e) {
    document.getElementById('login-erro').textContent = e.message;
    document.getElementById('login-erro').classList.add('show');
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('kds-screen').style.display = 'none';
    return;
  }
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
    const pedidosVisiveis = (data.pedidos || []).filter(pedidoVisivelNaCozinha);
    setOnline();
    detectarNovos(pedidosVisiveis);
    renderBoard(pedidosVisiveis);
    estadoAnt = Object.fromEntries(pedidosVisiveis.map(p => [p.id, p.status]));
  } catch (e) {
    tentativas++;
    console.warn('[cozinha]', e.message);
    if (tentativas >= 2) setOffline();
  }
}

function pedidoVisivelNaCozinha(p) {
  if (!['pronto', 'entregue'].includes(p.status)) return true;
  const referencia = p.status === 'entregue'
    ? (p.tempo_entrega || p.updated_at || p.created_at)
    : (p.tempo_pronto || p.updated_at || p.created_at);
  if (!referencia) return true;
  const prontoEm = new Date(referencia).getTime();
  if (Number.isNaN(prontoEm)) return true;
  return Date.now() - prontoEm < TEMPO_VISIVEL_POS_CONCLUSAO_MS;
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
  const cols = {pendente:[],em_preparo:[],pronto:[],entregue:[]};
  pedidos.forEach(p => {
    if (p.status === 'confirmado') cols.em_preparo.push(p);
    else if (cols[p.status]) cols[p.status].push(p);
  });
  cols.entregue.sort((a, b) => new Date(b.tempo_entrega || b.updated_at || b.created_at) - new Date(a.tempo_entrega || a.updated_at || a.created_at));
  const fila = cols.pendente.length + cols.em_preparo.length;
  document.getElementById('stat-fila').textContent    = fila;
  document.getElementById('stat-prontos').textContent = cols.pronto.length;
  document.getElementById('stat-entregues').textContent = cols.entregue.length;
  Object.entries(cols).forEach(([status, lista]) => {
    const count = document.getElementById('cnt-' + status);
    if (count) count.textContent = lista.length;
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
  const actionStatus = p.status || status;
  const ACOES = {
    pendente:   {label:'Confirmar e preparar', cls:'btn-confirmar',next:'em_preparo'},
    confirmado: {label:'Iniciar preparo',      cls:'btn-preparo',  next:'em_preparo'},
    em_preparo: {label:'✓ Pronto',        cls:'btn-pronto',   next:'pronto'},
    pronto:     {label:'✓ Entregue',      cls:'btn-entregar', next:'entregue'},
  };
  const a = ACOES[actionStatus];
  const btn = a ? `<button class="btn-acao ${a.cls}" onclick="avancar('${p.id}','${a.next}',this)">${a.label}</button>` : '';
  const entregueInfo = status === 'entregue' ? `<div class="card-delivered">Entregue ${tempoDesde(p.tempo_entrega || p.updated_at || p.created_at)}</div>` : '';
  return `<div class="card ${status === 'entregue' ? 'is-delivered' : ''}" id="card-${p.id}">
    <div class="card-head">
      <div class="card-mesa">${mesaLabel(p)}</div>
      <div class="card-meta">
        <span class="card-num">#${p.numero}</span>
        <span class="card-tempo ${tempoCls}">${tempoTxt}</span>
      </div>
    </div>
    ${btn ? `<div class="card-actions card-actions-top">${btn}</div>` : entregueInfo}
    <div class="card-itens">${itensHtml}</div>
    ${p.observacao_geral?`<div class="card-obs">⚠️ ${p.observacao_geral}</div>`:''}
  </div>`;
}

function vazioHtml(status) {
  const M = {pendente:{icon:'✓',txt:'Tudo em dia'},em_preparo:{icon:'🔥',txt:'Nada em preparo'},pronto:{icon:'🛎',txt:'Nenhum aguardando entrega'},entregue:{icon:'✓',txt:'Nenhum entregue recente'}}[status]||{icon:'✓',txt:''};
  return `<div class="col-empty"><div class="col-empty-icon">${M.icon}</div><div class="col-empty-txt">${M.txt}</div></div>`;
}

function tempoDesde(data) {
  const min = Math.max(0, Math.floor((Date.now() - new Date(data).getTime()) / 60000));
  return min <= 0 ? 'agora' : `há ${min}min`;
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

