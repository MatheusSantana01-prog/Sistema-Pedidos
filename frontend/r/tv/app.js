let RESTAURANT = null;
let polling    = null;
let carregando = false;

async function init() {
  RESTAURANT = await initTenant();
  if (!RESTAURANT) return;

  // Ticker com nome do restaurante
  document.querySelectorAll('.ticker-item').forEach(el => {
    el.textContent = el.textContent.replace('SaaS Restaurante', RESTAURANT.name || 'Restaurante');
  });

  if (isLoggedIn() && sessaoDoRestaurante(RESTAURANT)) iniciarTV();
  else if (isLoggedIn()) logout();
}

async function fazerLogin() {
  const email = document.getElementById('l-email').value.trim();
  const senha = document.getElementById('l-senha').value.trim();
  const erro  = document.getElementById('login-erro');
  erro.classList.remove('show');
  try {
    await login(email, senha, getCurrentRestaurantSlug());
    iniciarTV();
  } catch(e) {
    erro.textContent = e.message;
    erro.classList.add('show');
  }
}

function iniciarTV() {
  try {
    exigirSessaoRestaurante(RESTAURANT);
    exigirPerfil(['tv', 'kitchen', 'manager', 'owner'], 'Use um login de TV, cozinha, gerente ou dono para abrir esta tela');
  } catch (e) {
    document.getElementById('login-erro').textContent = e.message;
    document.getElementById('login-erro').classList.add('show');
    document.getElementById('login-overlay').style.display = 'flex';
    return;
  }
  document.getElementById('login-overlay').style.display = 'none';
  const usuario = getUsuario();
  document.getElementById('tv-user').textContent = usuario?.role ? usuario.role : 'online';
  tickRelogio();
  carregar();
  function agendar() {
    polling = setTimeout(() => { carregar().finally(agendar); }, 8000);
  }
  agendar();
}

function fazerLogout() {
  logout();
  clearTimeout(polling);
  document.getElementById('login-overlay').style.display = 'flex';
  document.getElementById('tv-user').textContent = 'offline';
}

function tickRelogio() {
  const el = document.getElementById('relogio');
  const t  = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  if (el && el.textContent !== t) el.textContent = t;
  setTimeout(tickRelogio, 1000 - (Date.now() % 1000));
}

async function carregar() {
  if (carregando) return;
  carregando = true;
  try {
    const { pedidos } = await apiCall('GET', '/api/kitchen/queue?limite=50');
    const lista = pedidos || [];

    // Preparando deve incluir pedidos novos ainda pendentes.
    const preparando = lista.filter(p => ['pendente','confirmado','em_preparo'].includes(p.status));
    const pronto     = lista.filter(p => p.status === 'pronto');

    // Entregues exige permissão de admin. TV/cozinha não devem gerar 403 no console.
    let entregues = [];
    const role = getUsuario()?.role;
    if (['manager', 'owner'].includes(role)) {
      const entreguesResp = await apiCall('GET', '/api/admin/orders?status_filtro=entregue&limite=10');
      entregues = entreguesResp.pedidos || [];
    }

    document.getElementById('cnt-preparando').textContent = preparando.length;
    document.getElementById('cnt-pronto').textContent     = pronto.length;
    document.getElementById('cnt-entregue').textContent   = entregues.length;

    renderCol('col-preparando', preparando, 'preparando');
    renderCol('col-pronto',     pronto,     'pronto');
    renderEntregues('col-entregue', entregues);
  } catch(e) {
    console.error('[tv]', e.message);
    showStatus('Falha ao atualizar a TV', 'error');
  } finally {
    carregando = false;
  }
}

function renderCol(colId, pedidos, tipo) {
  const col = document.getElementById(colId);
  if (!pedidos.length) {
    const msgs = {preparando:{icon:'🔥',txt:'Nada no fogo'}, pronto:{icon:'🛎',txt:'Nenhum aguardando'}};
    const m = msgs[tipo] || {icon:'✓',txt:''};
    col.innerHTML = `<div class="col-vazio"><div class="col-vazio-icon">${m.icon}</div><div class="col-vazio-txt">${m.txt}</div></div>`;
    return;
  }
  col.innerHTML = pedidos.map(p => {
    const mins = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 60000);
    const tcls = mins < 10 ? 'ok' : mins < 20 ? 'warn' : 'late';
    const ttxt = mins < 60 ? mins + 'min' : Math.floor(mins/60) + 'h' + (mins%60>0?(mins%60)+'m':'');
    const mesa = p.mesas?.numero ? `Mesa ${p.mesas.numero}` : `#${p.numero}`;
    const action = actionForPedido(p);
    return `<div class="card-tv ${tipo}">
      <div class="card-tv-head">
        <div class="card-mesa ${tipo}">${escapeHtml(mesa)}</div>
        <div>
          <div class="card-num">#${escapeHtml(p.numero)}</div>
          <div class="card-tempo ${tcls}">${ttxt}</div>
        </div>
      </div>
      ${action ? `<div class="card-tv-actions card-tv-actions-top"><button class="btn-tv-action ${escapeAttr(action.cls)}" onclick="avancarTV('${escapeAttr(p.id)}','${escapeAttr(action.next)}',this)">${escapeHtml(action.label)}</button></div>` : ''}
      <div class="card-itens">
        ${(p.pedido_itens||[]).map(it =>
          `<div class="item-tv"><span class="item-tv-qty">${escapeHtml(it.quantidade)}×</span>${escapeHtml(it.nome_produto)}</div>`
        ).join('')}
      </div>
    </div>`;
  }).join('');
}

function renderEntregues(colId, pedidos) {
  const col = document.getElementById(colId);
  if (!pedidos.length) {
    col.innerHTML = `<div class="col-vazio"><div class="col-vazio-icon">✓</div><div class="col-vazio-txt">Nenhum ainda</div></div>`;
    return;
  }
  col.innerHTML = pedidos.map(p => {
    const mesa = p.mesas?.numero ? `Mesa ${p.mesas.numero}` : `#${p.numero}`;
    const hora = new Date(p.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    return `<div class="card-tv entregue">
      <div class="card-tv-head">
        <div class="card-mesa entregue">${escapeHtml(mesa)}</div>
        <div><div class="card-num">#${escapeHtml(p.numero)}</div><div class="card-num">${hora}</div></div>
      </div>
      <div class="card-itens">
        ${(p.pedido_itens||[]).map(it =>
          `<div class="item-tv"><span class="item-tv-qty">${escapeHtml(it.quantidade)}×</span>${escapeHtml(it.nome_produto)}</div>`
        ).join('')}
      </div>
    </div>`;
  }).join('');
}

function actionForPedido(p) {
  const role = getUsuario()?.role;
  if (role === 'tv') {
    return p.status === 'pronto'
      ? { label: 'Dar baixa', cls: 'entregar', next: 'entregue' }
      : null;
  }
  return {
    pendente:   { label: 'Confirmar', cls: 'confirmar', next: 'confirmado' },
    confirmado: { label: 'Iniciar', cls: 'preparo', next: 'em_preparo' },
    em_preparo: { label: 'Marcar pronto', cls: 'pronto', next: 'pronto' },
    pronto:     { label: 'Dar baixa', cls: 'entregar', next: 'entregue' },
  }[p.status] || null;
}

async function avancarTV(pedidoId, novoStatus, btn) {
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = 'Atualizando...';
  try {
    await apiCall('PATCH', `/api/kitchen/orders/${pedidoId}/status`, { status: novoStatus });
    const card = btn.closest('.card-tv');
    if (card) {
      card.style.opacity = '.45';
      card.style.transform = 'scale(.98)';
    }
    showStatus(novoStatus === 'entregue' ? 'Pedido entregue' : 'Status atualizado', 'success');
    await carregar();
  } catch (e) {
    showStatus(e.message, 'error');
    btn.disabled = false;
    btn.textContent = label;
  }
}

function showStatus(msg, tipo) {
  const el = document.getElementById('tv-status-msg');
  el.textContent = msg;
  el.className = 'tv-status-msg show ' + (tipo || '');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3000);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}

init();

