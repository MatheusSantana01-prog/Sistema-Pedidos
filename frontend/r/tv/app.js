let RESTAURANT = null;
let polling    = null;

async function init() {
  RESTAURANT = await initTenant();
  if (!RESTAURANT) return;

  // Ticker com nome do restaurante
  document.querySelectorAll('.ticker-item').forEach(el => {
    el.innerHTML = el.innerHTML.replace('SaaS Restaurante', RESTAURANT.name);
  });

  if (isLoggedIn()) iniciarTV();
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
  document.getElementById('login-overlay').style.display = 'none';
  tickRelogio();
  carregar();
  function agendar() {
    polling = setTimeout(() => { carregar().finally(agendar); }, 8000);
  }
  agendar();
}

function tickRelogio() {
  const el = document.getElementById('relogio');
  const t  = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  if (el && el.textContent !== t) el.textContent = t;
  setTimeout(tickRelogio, 1000 - (Date.now() % 1000));
}

async function carregar() {
  try {
    const { pedidos } = await apiCall('GET', '/api/kitchen/queue?limite=50');
    const lista = pedidos || [];

    // Preparando deve incluir pedidos novos ainda pendentes.
    const preparando = lista.filter(p => ['pendente','confirmado','em_preparo'].includes(p.status));
    const pronto     = lista.filter(p => p.status === 'pronto');

    // Entregues é opcional: usuário cozinha pode não ter permissão para /api/admin/orders.
    let entregues = [];
    try {
      const entreguesResp = await apiCall('GET', '/api/admin/orders?status_filtro=entregue&limite=10');
      entregues = entreguesResp.pedidos || [];
    } catch (e) {
      console.warn('[tv] entregues indisponível para este usuário:', e.message);
    }

    document.getElementById('cnt-preparando').textContent = preparando.length;
    document.getElementById('cnt-pronto').textContent     = pronto.length;
    document.getElementById('cnt-entregue').textContent   = entregues.length;

    renderCol('col-preparando', preparando, 'preparando');
    renderCol('col-pronto',     pronto,     'pronto');
    renderEntregues('col-entregue', entregues);
  } catch(e) {
    console.error('[tv]', e.message);
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
    return `<div class="card-tv ${tipo}">
      <div class="card-tv-head">
        <div class="card-mesa ${tipo}">${mesa}</div>
        <div>
          <div class="card-num">#${p.numero}</div>
          <div class="card-tempo ${tcls}">${ttxt}</div>
        </div>
      </div>
      <div class="card-itens">
        ${(p.pedido_itens||[]).map(it =>
          `<div class="item-tv"><span class="item-tv-qty">${it.quantidade}×</span>${it.nome_produto}</div>`
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
        <div class="card-mesa entregue">${mesa}</div>
        <div><div class="card-num">#${p.numero}</div><div class="card-num">${hora}</div></div>
      </div>
      <div class="card-itens">
        ${(p.pedido_itens||[]).map(it =>
          `<div class="item-tv"><span class="item-tv-qty">${it.quantidade}×</span>${it.nome_produto}</div>`
        ).join('')}
      </div>
    </div>`;
  }).join('');
}

init();

