let RESTAURANT = null;
let mesasLista = [];
let categorias = [];
let filtroMesa = 'todas';
let pollingHandle = null;

const FOOD_IMAGES = {
  pizza: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=500&q=80',
  burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=500&q=80',
  drink: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=500&q=80',
  dessert: 'https://images.unsplash.com/photo-1564355808539-22fda35bed7e?auto=format&fit=crop&w=500&q=80',
  default: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=500&q=80',
};

async function init() {
  RESTAURANT = await initTenant();
  if (!RESTAURANT) return;
  if (isLoggedIn() && sessaoDoRestaurante(RESTAURANT)) iniciarApp();
  else if (isLoggedIn()) logout();
}

async function fazerLogin() {
  const email = document.getElementById('l-email').value.trim();
  const senha = document.getElementById('l-senha').value.trim();
  const erro = document.getElementById('login-erro');
  const btn = document.querySelector('.btn-primary');
  if (!email || !senha) {
    erro.textContent = 'Preencha e-mail e senha';
    erro.classList.add('show');
    return;
  }
  btn.disabled = true;
  document.getElementById('login-txt').textContent = 'Entrando...';
  try {
    await login(email, senha, getCurrentRestaurantSlug());
    iniciarApp();
  } catch (e) {
    erro.textContent = e.message;
    erro.classList.add('show');
  } finally {
    btn.disabled = false;
    document.getElementById('login-txt').textContent = 'Entrar';
  }
}

function fazerLogout() {
  logout();
  clearTimeout(pollingHandle);
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

function iniciarApp() {
  try {
    exigirSessaoRestaurante(RESTAURANT);
    exigirPerfil(['waiter', 'manager', 'owner'], 'Use um login de garçom, gerente ou dono para atendimento');
  } catch (e) {
    showLoginError(e.message);
    return;
  }
  const u = getUsuario();
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';
  document.getElementById('user-nome').textContent = u.nome || 'Usuário';
  document.getElementById('user-role').textContent = u.role || '';
  carregarMesas();
  carregarCardapio();
  iniciarPolling();
}

function showLoginError(msg) {
  const erro = document.getElementById('login-erro');
  erro.textContent = msg;
  erro.classList.add('show');
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display = 'none';
}

function iniciarPolling() {
  clearTimeout(pollingHandle);
  function tick() {
    pollingHandle = setTimeout(async () => {
      await carregarMesas(false);
      tick();
    }, 12000);
  }
  tick();
}

async function carregarMesas(showErrors = true) {
  try {
    const { mesas } = await apiCall('GET', '/api/admin/tables');
    mesasLista = mesas || [];
    renderMesas();
  } catch (e) {
    if (showErrors) showToast(e.message, 'error');
  }
}

function renderMesas() {
  const ocupadas = mesasLista.filter(m => m.status === 'ocupada').length;
  const livres = mesasLista.filter(m => m.status === 'livre').length;
  const aberto = mesasLista.reduce((a, m) => a + Number(m.sessao_ativa?.total_consumido || 0), 0);
  document.getElementById('s-ocup').textContent = ocupadas;
  document.getElementById('s-liv').textContent = livres;
  document.getElementById('s-fat').textContent = 'R$ ' + fmt(aberto);

  const mesas = mesasLista.filter(m => filtroMesa === 'todas' || m.status === filtroMesa);
  document.getElementById('mesas-grid').innerHTML = mesas.length ? mesas.map(m => {
    const sess = m.sessao_ativa;
    const total = Number(sess?.total_consumido || 0);
    const aberta = sess?.aberta_em ? tempoAberta(sess.aberta_em) : '';
    return `<div class="mesa-card ${m.status}" onclick="${sess ? `abrirMesa('${m.id}','${sess.id}',${m.numero})` : ''}">
      <div>
        <div class="mesa-num">${m.numero}</div>
        <div class="mesa-status">${m.status === 'ocupada' ? 'Mesa com atendimento' : 'Mesa livre'}</div>
      </div>
      <div>
        ${sess ? `<div class="mesa-total">R$ ${fmt(total)}</div><div class="mesa-note">${aberta}</div>` : '<div class="mesa-note">Sem conta aberta</div>'}
      </div>
    </div>`;
  }).join('') : '<div class="empty">Nenhuma mesa neste filtro.</div>';
}

function filtrarMesas(btn, filtro) {
  filtroMesa = filtro;
  document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderMesas();
}

async function abrirMesa(mesaId, sessaoId, numero) {
  document.getElementById('modal-title').textContent = `Mesa ${numero}`;
  document.getElementById('modal-body').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  document.getElementById('modal-mesa').classList.add('show');
  try {
    const slug = getCurrentRestaurantSlug();
    const data = await apiPublic('GET', `/api/public/restaurants/${slug}/sessions/${sessaoId}/bill`);
    const pedidos = data.pedidos || [];
    const total = Number(data.total_consumido ?? pedidos.reduce((a, p) => a + Number(p.total || 0), 0));
    document.getElementById('modal-body').innerHTML = pedidos.length ? `
      ${pedidos.map(p => `
        <div class="pedido-card">
          <div class="pedido-head">
            <span>#${p.numero || '—'} · ${statusLabel(p.status)}</span>
            <span>R$ ${fmt(p.total || 0)}</span>
          </div>
          ${(p.pedido_itens || []).map(it => `
            <div class="pedido-item">
              <span>${it.quantidade}x ${it.nome_produto}</span>
              <span>R$ ${fmt(it.subtotal || 0)}</span>
            </div>`).join('')}
        </div>`).join('')}
      <div class="bill-total"><span>Total consumido</span><strong>R$ ${fmt(total)}</strong></div>
    ` : '<div class="empty">Esta mesa ainda não tem pedidos.</div>';
  } catch (e) {
    document.getElementById('modal-body').innerHTML = `<div class="empty">${e.message}</div>`;
  }
}

async function carregarCardapio() {
  try {
    const slug = getCurrentRestaurantSlug();
    const { cardapio } = await apiPublic('GET', `/api/public/restaurants/${slug}/menu`);
    categorias = (cardapio || []).map(c => ({ ...c, produtos: c.produtos || [] }));
    renderCardapio();
  } catch (e) {
    document.getElementById('cardapio-lista').innerHTML = '<div class="empty">Erro ao carregar cardápio.</div>';
  }
}

function renderCardapio() {
  const q = (document.getElementById('menu-search')?.value || '').trim().toLowerCase();
  const cats = categorias.map(c => ({
    ...c,
    produtos: (c.produtos || []).filter(p => {
      const txt = `${p.nome || ''} ${p.descricao || ''} ${c.nome || ''}`.toLowerCase();
      return !q || txt.includes(q);
    }),
  })).filter(c => c.produtos.length);

  document.getElementById('cardapio-lista').innerHTML = cats.length ? cats.map(c => `
    <div class="cat-title">${c.icone || ''} ${c.nome || 'Categoria'}</div>
    ${c.produtos.map(p => `
      <div class="product-row ${p.disponivel === false ? 'off' : ''}">
        <img src="${imageForProduct(p)}" alt="${p.nome || 'Produto'}" loading="lazy" onerror="this.src='${FOOD_IMAGES.default}'">
        <div>
          <div class="product-name">${p.nome || 'Produto'}</div>
          ${p.descricao ? `<div class="product-desc">${p.descricao}</div>` : ''}
        </div>
        <div class="product-price">${p.disponivel === false ? 'Indisponível' : 'R$ ' + fmt(p.preco || 0)}</div>
      </div>`).join('')}
  `).join('') : '<div class="empty">Nenhum produto encontrado.</div>';
}

function imageForProduct(p) {
  if (p?.foto_url) return p.foto_url;
  const text = `${p?.nome || ''} ${p?.descricao || ''}`.toLowerCase();
  if (text.includes('pizza')) return FOOD_IMAGES.pizza;
  if (text.includes('burger') || text.includes('hamb')) return FOOD_IMAGES.burger;
  if (text.includes('suco') || text.includes('drink') || text.includes('bebida') || text.includes('refri')) return FOOD_IMAGES.drink;
  if (text.includes('sobremesa') || text.includes('doce')) return FOOD_IMAGES.dessert;
  return FOOD_IMAGES.default;
}

function tempoAberta(data) {
  const min = Math.max(0, Math.floor((Date.now() - new Date(data)) / 60000));
  return min < 60 ? `${min}min aberta` : `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''} aberta`;
}

function statusLabel(s) {
  return { pendente:'Aguardando', confirmado:'Confirmado', em_preparo:'Em preparo', pronto:'Pronto', entregue:'Entregue', cancelado:'Cancelado' }[s] || s || '—';
}

function fecharModal(id) {
  document.getElementById(id).classList.remove('show');
}

document.querySelectorAll('.modal-bg').forEach(bg => {
  bg.addEventListener('click', e => {
    if (e.target === bg) bg.classList.remove('show');
  });
});

function showToast(msg, tipo = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (tipo ? ' ' + tipo : '') + ' show';
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3500);
}

function fmt(v) {
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

init();
