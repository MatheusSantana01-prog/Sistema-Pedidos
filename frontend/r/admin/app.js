/* ══════════════════════════════════════════════════
   ADMIN MULTI-TENANT
   URL: /r/{slug}/admin/index.html
   Token JWT contém restaurant_id — backend valida tudo
══════════════════════════════════════════════════ */

let RESTAURANT     = null;
let mesaAberta     = null;
let pgtoSelecionado = null;
let produtosMap    = {};
let categoriasLista = [];
let produtosLista  = [];
let pollingHandle  = null;

const ADMIN_FOOD_IMAGES = {
  pizza: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=700&q=80',
  burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=80',
  drink: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=700&q=80',
  dessert: 'https://images.unsplash.com/photo-1564355808539-22fda35bed7e?auto=format&fit=crop&w=700&q=80',
  default: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=700&q=80',
};

/* ── INIT ─────────────────────────────────────────── */
async function init() {
  // 1. Resolver restaurante pelo slug da URL
  RESTAURANT = await initTenant();
  if (!RESTAURANT) return;

  // 2. Se já tem sessão válida, entrar direto
  if (isLoggedIn()) {
    iniciarApp();
  }
}

/* ── LOGIN ────────────────────────────────────────── */
async function fazerLogin() {
  const email = document.getElementById('l-email').value.trim();
  const senha = document.getElementById('l-senha').value.trim();
  const btn   = document.querySelector('.btn-primary');
  const erro  = document.getElementById('login-erro');

  if (!email || !senha) {
    erro.textContent = 'Preencha e-mail e senha';
    erro.classList.add('show');
    return;
  }

  btn.disabled = true;
  document.getElementById('login-txt').textContent = 'Entrando...';

  try {
    const slug = getCurrentRestaurantSlug();
    await login(email, senha, slug);
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
  const u = getUsuario();
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display   = 'flex';
  document.getElementById('user-nome').textContent = u.nome;
  document.getElementById('user-role').textContent = u.role;

  // Esconder abas sem permissão
  const roleLevels = { 'role-manager': 'manager', 'role-owner': 'owner' };
  document.querySelectorAll('.nav-tab').forEach(t => {
    for (const [cls, role] of Object.entries(roleLevels)) {
      if (t.classList.contains(cls) && !temRole(role)) {
        t.classList.add('hidden');
        break;
      }
    }
  });

  // Datas financeiro
  const hoje = new Date().toISOString().slice(0,10);
  const ini  = new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  document.getElementById('fin-inicio').value = ini;
  document.getElementById('fin-fim').value    = hoje;

  carregarMesas();
  iniciarPolling();
}

function iniciarPolling() {
  function agendar() {
    pollingHandle = setTimeout(() => {
      const pg = document.querySelector('.page.active')?.id;
      if (pg === 'page-mesas')   carregarMesas();
      if (pg === 'page-pedidos') carregarPedidos();
      agendar();
    }, 12000);
  }
  agendar();
}

/* ── NAV ──────────────────────────────────────────── */
function irPara(pagina, tabEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + pagina).classList.add('active');
  tabEl.classList.add('active');
  const loaders = {
    mesas:         carregarMesas,
    pedidos:       carregarPedidos,
    cardapio:      carregarCardapio,
    financeiro:    carregarFinanceiro,
    usuarios:      carregarUsuarios,
    configuracoes: carregarConfiguracoes,
    auditoria:     carregarAuditoria,
  };
  if (loaders[pagina]) loaders[pagina]();
}

/* ── MESAS ────────────────────────────────────────── */
async function carregarMesas() {
  try {
    const { mesas } = await apiCall('GET', '/api/admin/tables');
    const ocup = mesas.filter(m => m.status === 'ocupada').length;
    const liv  = mesas.filter(m => m.status === 'livre').length;
    const fat  = mesas.reduce((a, m) => a + Number(m.sessao_ativa?.total_consumido || 0), 0);
    document.getElementById('s-ocup').textContent = ocup;
    document.getElementById('s-liv').textContent  = liv;
    document.getElementById('s-fat').textContent  = 'R$ ' + fmt(fat);

    document.getElementById('mesas-grid').innerHTML = mesas.map(m => {
      const sess = m.sessao_ativa;
      const total = Number(sess?.total_consumido || 0);
      const dur   = sess ? Math.floor((Date.now() - new Date(sess.aberta_em)) / 60000) : 0;
      const durStr = dur < 60 ? dur + 'min' : Math.floor(dur/60) + 'h' + (dur%60 > 0 ? dur%60 + 'm' : '');
      return `<div class="mesa-card ${m.status}" onclick="${sess ? `abrirConta('${m.id}','${sess.id}',${m.numero},${total})` : ''}">
        <div class="mesa-num">${m.numero}</div>
        <div class="mesa-status-badge ${m.status}">${m.status === 'livre' ? '● Livre' : m.status === 'ocupada' ? '● Ocupada' : '● Reservada'}</div>
        <div class="mesa-info">${sess ? `R$ ${fmt(total)} · ${durStr}` : 'Mesa livre'}</div>
        <div class="mesa-actions" onclick="event.stopPropagation()">
          ${sess ? `<button class="btn btn-sm btn-success" onclick="abrirConta('${m.id}','${sess.id}',${m.numero},${total})">Ver conta →</button>` : ''}
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function abrirConta(mesaId, sessaoId, numero, total) {
  mesaAberta = { mesa_id: mesaId, sessao_id: sessaoId, numero, total };
  pgtoSelecionado = null;
  document.getElementById('modal-conta-title').textContent = `Conta — Mesa ${numero}`;
  document.getElementById('modal-conta-footer').style.display = 'none';
  document.getElementById('modal-conta-body').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  document.getElementById('modal-conta').classList.add('show');

  try {
    const slug = getCurrentRestaurantSlug();
    const data = await apiPublic('GET', `/api/public/restaurants/${slug}/sessions/${sessaoId}/bill`);
    const pedidos = data.pedidos || [];
    const tot = pedidos.reduce((a, p) => a + Number(p.total), 0);
    mesaAberta.total = tot;

    document.getElementById('modal-conta-body').innerHTML = `
      <div style="font-family:var(--mono);font-size:32px;font-weight:600;color:var(--color-primary)">Mesa ${numero}</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:16px">${pedidos.length} pedido(s)</div>
      ${pedidos.map(p => `
        <div style="background:var(--color-bg);border:1px solid var(--border);border-radius:8px;margin-bottom:8px;overflow:hidden;">
          <div style="display:flex;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--border);">
            <span style="font-family:var(--mono);font-size:12px;font-weight:600">#${p.numero}</span>
            <span class="status-pill ${p.status}">${statusLabel(p.status)}</span>
          </div>
          ${(p.itens||[]).map(it => `
            <div style="display:flex;justify-content:space-between;padding:8px 14px;border-bottom:1px solid var(--border);font-size:13px;">
              <span>${it.quantidade}× ${it.nome_produto}</span>
              <span style="font-family:var(--mono);color:var(--muted)">R$ ${fmt(it.subtotal)}</span>
            </div>`).join('')}
        </div>`).join('')}
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-top:1px solid var(--border);">
        <span style="color:var(--muted)">Total</span>
        <span class="conta-total-val">R$ ${fmt(tot)}</span>
      </div>
      <div style="font-size:12px;color:var(--muted);margin:16px 0 8px;">Forma de pagamento:</div>
      <div class="pgto-grid">
        <button class="pgto-btn" onclick="selecionarPgto(this,'dinheiro')">💵 Dinheiro</button>
        <button class="pgto-btn" onclick="selecionarPgto(this,'pix')">📲 Pix</button>
        <button class="pgto-btn" onclick="selecionarPgto(this,'cartao_credito')">💳 Crédito</button>
        <button class="pgto-btn" onclick="selecionarPgto(this,'cartao_debito')">💳 Débito</button>
      </div>`;

    document.getElementById('modal-conta-footer').style.display = 'flex';
  } catch (e) {
    document.getElementById('modal-conta-body').innerHTML = '<div class="tabela-empty">Erro ao carregar conta.</div>';
  }
}

function selecionarPgto(btn, pgto) {
  document.querySelectorAll('.pgto-btn').forEach(b => b.classList.remove('selecionado'));
  btn.classList.add('selecionado');
  pgtoSelecionado = pgto;
  document.getElementById('btn-fechar-conta').disabled = false;
}

async function confirmarFecharConta() {
  if (!pgtoSelecionado || !mesaAberta) return;
  const btn = document.getElementById('btn-fechar-conta');
  btn.disabled = true;
  try {
    await apiCall('POST', `/api/admin/tables/${mesaAberta.mesa_id}/close`,
      { forma_pagamento: pgtoSelecionado });
    fecharModal('modal-conta');
    showToast(`Mesa ${mesaAberta.numero} fechada · R$ ${fmt(mesaAberta.total)}`, 'success');
    carregarMesas();
  } catch (e) {
    showToast(e.message, 'error');
    btn.disabled = false;
  }
}

/* ── PEDIDOS ──────────────────────────────────────── */
async function carregarPedidos() {
  document.getElementById('pedidos-tbody').innerHTML = '<tr><td colspan="7"><div class="loading"><div class="spinner"></div></div></td></tr>';
  try {
    const { pedidos } = await apiCall('GET', '/api/admin/orders?limite=100');
    document.getElementById('pedidos-tbody').innerHTML = !pedidos.length
      ? '<tr><td colspan="7" class="tabela-empty">Nenhum pedido</td></tr>'
      : pedidos.map(p => {
          const hora  = new Date(p.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
          const itens = (p.pedido_itens||[]).length;
          const next  = {pendente:'confirmado',confirmado:'em_preparo',em_preparo:'pronto',pronto:'entregue'};
          const lbls  = {confirmado:'Confirmar',em_preparo:'Em preparo',pronto:'Pronto',entregue:'Entregue'};
          const acoes = next[p.status]
            ? `<div style="display:flex;gap:6px;">
                <button class="btn btn-sm" onclick="avancarPedido('${p.id}','${next[p.status]}',this)">${lbls[next[p.status]]}</button>
                <button class="btn btn-sm btn-danger" onclick="cancelarPedido('${p.id}',this)">✕</button>
               </div>` : '—';
          return `<tr>
            <td class="tabela-num">#${p.numero}</td>
            <td>Mesa ${p.mesas?.numero||'—'}</td>
            <td>${itens} item(s)</td>
            <td class="tabela-num">R$ ${fmt(p.total)}</td>
            <td><span class="status-pill ${p.status}">${statusLabel(p.status)}</span></td>
            <td style="color:var(--muted);font-size:12px">${hora}</td>
            <td>${acoes}</td>
          </tr>`;
        }).join('');
  } catch (e) {
    document.getElementById('pedidos-tbody').innerHTML = '<tr><td colspan="7" class="tabela-empty">Erro.</td></tr>';
  }
}

async function avancarPedido(id, novoStatus, btn) {
  btn.disabled = true;
  try {
    await apiCall('PATCH', `/api/kitchen/orders/${id}/status`, { status: novoStatus });
    showToast('→ ' + statusLabel(novoStatus), 'success');
    carregarPedidos();
  } catch (e) { showToast(e.message, 'error'); btn.disabled = false; }
}

async function cancelarPedido(id, btn) {
  if (!confirm('Cancelar este pedido?')) return;
  btn.disabled = true;
  try {
    await apiCall('PATCH', `/api/admin/orders/${id}/cancel`, { status: 'cancelado' });
    showToast('Pedido cancelado', 'success');
    carregarPedidos();
  } catch (e) { showToast(e.message, 'error'); btn.disabled = false; }
}

/* ── CARDÁPIO ─────────────────────────────────────── */
async function carregarCardapio() {
  document.getElementById('produtos-lista').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const [prodsResp, catsResp] = await Promise.all([
      apiCall('GET', '/api/admin/products'),
      apiCall('GET', '/api/admin/categories'),
    ]);
    categoriasLista = catsResp.categorias || [];
    produtosLista = prodsResp.produtos || [];
    produtosMap = {};
    produtosLista.forEach(p => produtosMap[p.id] = p);
    renderAdminProdutos();
  } catch (e) {
    document.getElementById('produtos-lista').innerHTML = '<div class="tabela-empty">Erro ao carregar.</div>';
  }
}

function renderAdminProdutos() {
  const q = (document.getElementById('cardapio-busca')?.value || '').toLowerCase();
  const status = document.getElementById('cardapio-status')?.value || 'todos';
  const prods = produtosLista.filter(p => {
    const texto = `${p.nome || ''} ${p.descricao || ''} ${p.categorias?.nome || ''}`.toLowerCase();
    const statusOk = status === 'todos' || (status === 'disponiveis' && p.disponivel) || (status === 'pausados' && !p.disponivel);
    return statusOk && (!q || texto.includes(q));
  });

  document.getElementById('produtos-lista').innerHTML = !prods.length
    ? '<div class="tabela-empty">Nenhum produto encontrado</div>'
    : `<div class="admin-produtos-grid">
        ${prods.map(p => `
        <div class="admin-produto-card ${p.disponivel ? '' : 'is-paused'}">
          <img class="admin-produto-img" src="${imageForAdminProduct(p)}" alt="${p.nome}" loading="lazy" onerror="this.src='${ADMIN_FOOD_IMAGES.default}'">
          <div class="admin-produto-body">
            <div class="admin-produto-top">
              <div>
                <div class="admin-produto-cat">${p.categorias?.icone || ''} ${p.categorias?.nome || 'Sem categoria'}</div>
                <div class="admin-produto-nome">${p.nome}</div>
              </div>
              <span class="admin-produto-badge ${p.disponivel ? 'ok' : 'off'}">${p.disponivel ? 'Disponível' : 'Pausado'}</span>
            </div>
            ${p.descricao ? `<div class="admin-produto-desc">${p.descricao}</div>` : ''}
            <div class="admin-produto-footer">
              <div>
                <div class="admin-produto-preco">R$ ${fmt(p.preco)}</div>
                ${p.destaque ? '<div class="admin-produto-destaque">Destaque na mesa</div>' : ''}
              </div>
              <div class="admin-produto-actions">
                <button class="btn btn-sm" onclick="abrirModalProdutoById('${p.id}')">Editar</button>
                <button class="btn btn-sm ${p.disponivel?'btn-danger':'btn-success'}" onclick="toggleProduto('${p.id}',${p.disponivel},this)">${p.disponivel?'Pausar':'Ativar'}</button>
              </div>
            </div>
          </div>
        </div>`).join('')}
      </div>`;
}

function abrirModalProdutoById(id) { abrirModalProduto(produtosMap[id]); }

function abrirModalProduto(p = null) {
  document.getElementById('prod-id').value    = p?.id || '';
  document.getElementById('prod-nome').value  = p?.nome || '';
  document.getElementById('prod-desc').value  = p?.descricao || '';
  document.getElementById('prod-preco').value = p?.preco || '';
  document.getElementById('prod-custo').value = p?.custo || 0;
  document.getElementById('prod-foto').value  = p?.foto_url || '';
  atualizarPreviewProduto();
  document.getElementById('prod-disp').checked = p ? p.disponivel : true;
  document.getElementById('prod-dest').checked = p?.destaque || false;
  document.getElementById('prod-cat').innerHTML =
    categoriasLista.map(c => `<option value="${c.id}" ${p?.categoria_id===c.id?'selected':''}>${c.icone||''} ${c.nome}</option>`).join('');
  document.getElementById('modal-produto').classList.add('show');
}

async function salvarProduto() {
  const id   = document.getElementById('prod-id').value;
  const nome = document.getElementById('prod-nome').value.trim();
  const preco = parseFloat(document.getElementById('prod-preco').value);
  const catId = document.getElementById('prod-cat').value;
  if (!nome || !preco || !catId) return showToast('Preencha nome, preço e categoria','error');

  const payload = {
    nome, descricao: document.getElementById('prod-desc').value || null,
    preco, custo: parseFloat(document.getElementById('prod-custo').value)||0,
    categoria_id: catId,
    foto_url: document.getElementById('prod-foto').value || null,
    disponivel: document.getElementById('prod-disp').checked,
    destaque:   document.getElementById('prod-dest').checked,
  };

  try {
    if (id) await apiCall('PATCH', `/api/admin/products/${id}`, payload);
    else    await apiCall('POST',  '/api/admin/products', payload);
    showToast(id ? 'Produto atualizado' : 'Produto criado', 'success');
    fecharModal('modal-produto');
    carregarCardapio();
  } catch (e) { showToast(e.message, 'error'); }
}

async function toggleProduto(id, atual, btn) {
  btn.disabled = true;
  try {
    await apiCall('PATCH', `/api/admin/products/${id}`, { disponivel: !atual });
    showToast(!atual ? 'Produto ativado' : 'Produto pausado', 'success');
    carregarCardapio();
  } catch (e) { showToast(e.message, 'error'); btn.disabled = false; }
}

/* ── FINANCEIRO ───────────────────────────────────── */
async function carregarFinanceiro() {
  const ini = document.getElementById('fin-inicio').value;
  const fim = document.getElementById('fin-fim').value;
  if (!ini || !fim) return showToast('Selecione o período', 'error');
  document.getElementById('financeiro-content').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const d = await apiCall('GET', `/api/admin/dashboard?data_inicio=${ini}&data_fim=${fim}`);
    document.getElementById('financeiro-content').innerHTML = `
      <div class="stats-row">
        <div class="stat-card"><div class="stat-label">Faturamento bruto</div><div class="stat-val green">R$ ${fmt(d.total_bruto)}</div></div>
        <div class="stat-card"><div class="stat-label">Descontos</div><div class="stat-val accent">R$ ${fmt(d.total_descontos)}</div></div>
        <div class="stat-card"><div class="stat-label">Faturamento líquido</div><div class="stat-val blue">R$ ${fmt(d.total_liquido)}</div></div>
        <div class="stat-card"><div class="stat-label">Pedidos</div><div class="stat-val">${d.total_pedidos}</div></div>
        <div class="stat-card"><div class="stat-label">Ticket médio</div><div class="stat-val amber">R$ ${fmt(d.ticket_medio)}</div></div>
      </div>
      <div style="background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:20px;margin-top:16px;">
        <div style="font-family:var(--mono);font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:16px;">Por forma de pagamento</div>
        ${Object.entries(d.por_pagamento||{}).map(([k,v]) =>
          `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
            <span>${{dinheiro:'💵 Dinheiro',pix:'📲 Pix',cartao_credito:'💳 Crédito',cartao_debito:'💳 Débito'}[k]||k}</span>
            <span style="font-family:var(--mono);font-weight:600">R$ ${fmt(v)}</span>
          </div>`).join('')}
      </div>`;
  } catch (e) {
    document.getElementById('financeiro-content').innerHTML = '<div class="tabela-empty">Erro: ' + e.message + '</div>';
  }
}

/* ── USUÁRIOS ─────────────────────────────────────── */
async function carregarUsuarios() {
  document.getElementById('usuarios-lista').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const { usuarios } = await apiCall('GET', '/api/admin/users');
    const atual = getUsuario();
    document.getElementById('usuarios-lista').innerHTML = !usuarios.length
      ? '<div class="tabela-empty">Nenhum usuário</div>'
      : usuarios.map(m => {
          const u = m.usuarios || {};
          const podeRemover = temRole('owner') && u.id !== atual?.id;
          return `<div class="usuario-row">
            <div class="usuario-avatar">
              ${(u.nome||'?').slice(0,2).toUpperCase()}
            </div>
            <div class="usuario-info">
              <div class="usuario-nome">${u.nome||'—'}</div>
              <div class="usuario-email">${u.email||'—'}</div>
            </div>
            <span class="role-badge">${m.role}</span>
            ${podeRemover ? `<button class="btn btn-sm btn-danger" onclick="removerUsuario('${u.id}',this)">Remover</button>` : ''}
          </div>`;
        }).join('');
  } catch (e) {
    document.getElementById('usuarios-lista').innerHTML = '<div class="tabela-empty">Erro.</div>';
  }
}

function abrirModalUsuario() {
  ['u-nome','u-email','u-senha'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('modal-usuario').classList.add('show');
}

async function salvarUsuario() {
  const nome  = document.getElementById('u-nome').value.trim();
  const email = document.getElementById('u-email').value.trim();
  const senha = document.getElementById('u-senha').value;
  const role  = document.getElementById('u-role').value;
  if (!nome || !email || !senha) return showToast('Preencha todos os campos', 'error');
  try {
    await apiCall('POST', '/api/admin/users', { nome, email, senha, role });
    showToast('Usuário criado', 'success');
    fecharModal('modal-usuario');
    carregarUsuarios();
  } catch (e) { showToast(e.message, 'error'); }
}

async function removerUsuario(usuarioId, btn) {
  if (!confirm('Remover este usuário deste restaurante?')) return;
  btn.disabled = true;
  try {
    await apiCall('DELETE', `/api/admin/users/${usuarioId}`);
    showToast('Usuário removido', 'success');
    carregarUsuarios();
  } catch (e) {
    showToast(e.message, 'error');
    btn.disabled = false;
  }
}

/* ── CONFIGURAÇÕES ────────────────────────────────── */
async function carregarConfiguracoes() {
  document.getElementById('config-content').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const { restaurant } = await apiCall('GET', '/api/admin/restaurant');
    const s = restaurant.restaurant_settings?.[0] || {};
    document.getElementById('config-content').innerHTML = `
      <div class="config-grid">
        <div class="config-card">
          <div class="config-title">Identidade visual</div>
          <div class="form-row"><label class="form-label">Nome do restaurante</label>
            <input class="form-input" id="cfg-nome" value="${restaurant.name||''}"></div>
          <div class="form-row"><label class="form-label">Logo (URL)</label>
            <input class="form-input" id="cfg-logo" value="${restaurant.logo_url||''}" placeholder="https://..."></div>
          <div class="color-picker-row">
            <label class="form-label" style="min-width:140px">Cor primária</label>
            <input type="color" class="color-swatch" id="cfg-primary" value="${restaurant.primary_color||'#ff4d1c'}"
                   oninput="document.documentElement.style.setProperty('--color-primary',this.value)">
            <input class="form-input" id="cfg-primary-txt" value="${restaurant.primary_color||'#ff4d1c'}" style="width:110px">
          </div>
          <div class="color-picker-row">
            <label class="form-label" style="min-width:140px">Cor de destaque</label>
            <input type="color" class="color-swatch" id="cfg-accent" value="${restaurant.accent_color||'#ff6b3d'}"
                   oninput="document.documentElement.style.setProperty('--color-accent',this.value)">
            <input class="form-input" id="cfg-accent-txt" value="${restaurant.accent_color||'#ff6b3d'}" style="width:110px">
          </div>
          <div class="color-picker-row">
            <label class="form-label" style="min-width:140px">Cor de fundo</label>
            <input type="color" class="color-swatch" id="cfg-bg" value="${restaurant.background_color||'#0a0a0a'}"
                   oninput="document.documentElement.style.setProperty('--color-bg',this.value)">
            <input class="form-input" id="cfg-bg-txt" value="${restaurant.background_color||'#0a0a0a'}" style="width:110px">
          </div>
          <button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="salvarConfiguracoes()">Salvar visual</button>
        </div>
        <div class="config-card">
          <div class="config-title">Taxas e pagamentos</div>
          <label class="toggle-row"><input type="checkbox" id="cfg-taxa" ${s.service_fee_enabled?'checked':''}> Cobrar taxa de serviço</label>
          <div class="form-row"><label class="form-label">Taxa de serviço (%)</label>
            <input class="form-input" id="cfg-taxa-percent" type="number" min="0" max="30" step="0.5" value="${s.service_fee_percent ?? 10}">
          </div>
          <label class="toggle-row"><input type="checkbox" id="cfg-pix" ${s.accept_pix!==false?'checked':''}> Aceitar Pix</label>
          <label class="toggle-row"><input type="checkbox" id="cfg-card" ${s.accept_card!==false?'checked':''}> Aceitar cartão</label>
          <label class="toggle-row"><input type="checkbox" id="cfg-cash" ${s.accept_cash!==false?'checked':''}> Aceitar dinheiro</label>
          <div class="form-row"><label class="form-label">Chave Pix</label>
            <input class="form-input" id="cfg-pix-key" value="${s.pix_key||''}" placeholder="CPF, CNPJ, e-mail ou chave aleatória">
          </div>
          <button class="btn btn-primary btn-sm" onclick="salvarSettings()">Salvar configurações</button>
        </div>
        <div class="config-card">
          <div class="config-title">Experiência da mesa</div>
          <label class="toggle-row"><input type="checkbox" id="cfg-notes" ${s.allow_customer_notes!==false?'checked':''}> Cliente pode enviar observações</label>
          <label class="toggle-row"><input type="checkbox" id="cfg-waiter" ${s.allow_waiter_call?'checked':''}> Permitir chamar garçom</label>
          <label class="toggle-row"><input type="checkbox" id="cfg-close-request" ${s.allow_table_close_request?'checked':''}> Permitir solicitar fechamento da conta</label>
          <button class="btn btn-primary btn-sm" onclick="salvarSettings()">Salvar experiência</button>
        </div>
        <div class="config-card">
          <div class="config-title">Contato e funcionamento</div>
          <div class="form-row"><label class="form-label">WhatsApp</label>
            <input class="form-input" id="cfg-whatsapp" value="${s.whatsapp||''}" placeholder="(11) 99999-9999"></div>
          <div class="form-row"><label class="form-label">Endereço</label>
            <input class="form-input" id="cfg-address" value="${s.address||''}" placeholder="Rua, número, bairro"></div>
          <div class="form-row-2">
            <div class="form-row" style="margin:0"><label class="form-label">Abre</label><input class="form-input" id="cfg-open" type="time" value="${s.opening_time||''}"></div>
            <div class="form-row" style="margin:0"><label class="form-label">Fecha</label><input class="form-input" id="cfg-close" type="time" value="${s.closing_time||''}"></div>
          </div>
          <button class="btn btn-primary btn-sm" style="margin-top:16px" onclick="salvarSettings()">Salvar contato</button>
        </div>
      </div>`;

    // Sincronizar color pickers com inputs de texto
    document.getElementById('cfg-primary').addEventListener('input', e => {
      document.getElementById('cfg-primary-txt').value = e.target.value;
    });
    document.getElementById('cfg-bg').addEventListener('input', e => {
      document.getElementById('cfg-bg-txt').value = e.target.value;
    });
    document.getElementById('cfg-accent').addEventListener('input', e => {
      document.getElementById('cfg-accent-txt').value = e.target.value;
    });
  } catch (e) {
    document.getElementById('config-content').innerHTML = '<div class="tabela-empty">Erro ao carregar.</div>';
  }
}

async function salvarConfiguracoes() {
  try {
    await apiCall('PUT', '/api/admin/restaurant', {
      name:             document.getElementById('cfg-nome').value.trim(),
      logo_url:         document.getElementById('cfg-logo').value.trim() || null,
      primary_color:    document.getElementById('cfg-primary-txt').value,
      accent_color:     document.getElementById('cfg-accent-txt').value,
      background_color: document.getElementById('cfg-bg-txt').value,
    });
    showToast('Visual atualizado', 'success');
    applyRestaurantTheme({ ...window.__RESTAURANT__,
      primary_color: document.getElementById('cfg-primary-txt').value,
      accent_color: document.getElementById('cfg-accent-txt').value,
      background_color: document.getElementById('cfg-bg-txt').value,
    });
  } catch (e) { showToast(e.message, 'error'); }
}

async function salvarSettings() {
  try {
    await apiCall('PUT', '/api/admin/restaurant/settings', {
      service_fee_enabled: document.getElementById('cfg-taxa').checked,
      service_fee_percent: Number(document.getElementById('cfg-taxa-percent').value || 0),
      allow_customer_notes: document.getElementById('cfg-notes').checked,
      allow_waiter_call: document.getElementById('cfg-waiter').checked,
      allow_table_close_request: document.getElementById('cfg-close-request').checked,
      accept_pix:          document.getElementById('cfg-pix').checked,
      accept_card:         document.getElementById('cfg-card').checked,
      accept_cash:         document.getElementById('cfg-cash').checked,
      pix_key:             document.getElementById('cfg-pix-key').value || null,
      whatsapp:            document.getElementById('cfg-whatsapp').value || null,
      address:             document.getElementById('cfg-address').value || null,
      opening_time:        document.getElementById('cfg-open').value || null,
      closing_time:        document.getElementById('cfg-close').value || null,
    });
    showToast('Configurações salvas', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

/* ── AUDITORIA ────────────────────────────────────── */
async function carregarAuditoria() {
  document.getElementById('auditoria-lista').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const { logs } = await apiCall('GET', '/api/admin/audit');
    const LABELS = {
      fechar_conta_mesa: '🧾 Fechou conta',
      fechar_caixa: '💰 Fechou caixa',
      cancelar_pedido: '❌ Cancelou pedido',
      criar_produto: '➕ Criou produto',
      atualizar_produto: '✏️ Editou produto',
      criar_usuario: '👤 Criou usuário',
      alterar_restaurante: '🎨 Atualizou restaurante',
    };
    document.getElementById('auditoria-lista').innerHTML = !logs.length
      ? '<div class="tabela-empty">Nenhum log</div>'
      : logs.map(l => `
          <div class="audit-row">
            <div class="audit-time">${new Date(l.created_at).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</div>
            <div class="audit-user">${l.usuario_nome||'—'}</div>
            <div class="audit-perfil"><span class="role-badge">${l.perfil||'—'}</span></div>
            <div class="audit-acao"><strong>${LABELS[l.acao]||l.acao}</strong>${l.tabela?` · ${l.tabela}`:''}</div>
          </div>`).join('');
  } catch (e) {
    document.getElementById('auditoria-lista').innerHTML = '<div class="tabela-empty">Erro: ' + e.message + '</div>';
  }
}

/* ── UTILITÁRIOS ──────────────────────────────────── */
function fmt(n)       { return Number(n).toFixed(2).replace('.',','); }
function statusLabel(s) { return {pendente:'Aguardando',confirmado:'Confirmado',em_preparo:'Em preparo',pronto:'Pronto',entregue:'Entregue',cancelado:'Cancelado'}[s]||s; }

function imageForAdminProduct(produto) {
  if (produto?.foto_url) return produto.foto_url;
  const text = `${produto?.nome || ''} ${produto?.descricao || ''}`.toLowerCase();
  if (text.includes('pizza') || text.includes('calabresa') || text.includes('margherita')) return ADMIN_FOOD_IMAGES.pizza;
  if (text.includes('burger') || text.includes('burguer') || text.includes('hambur') || text.includes('smash')) return ADMIN_FOOD_IMAGES.burger;
  if (text.includes('bebida') || text.includes('refri') || text.includes('suco') || text.includes('coca')) return ADMIN_FOOD_IMAGES.drink;
  if (text.includes('sobr') || text.includes('doce') || text.includes('brownie') || text.includes('tiramisu')) return ADMIN_FOOD_IMAGES.dessert;
  return ADMIN_FOOD_IMAGES.default;
}

function atualizarPreviewProduto() {
  const preview = document.getElementById('prod-preview-img');
  if (!preview) return;
  const foto = document.getElementById('prod-foto').value.trim();
  const nome = document.getElementById('prod-nome').value.trim();
  const desc = document.getElementById('prod-desc').value.trim();
  preview.src = foto || imageForAdminProduct({ nome, descricao: desc });
}

function showToast(msg, tipo = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (tipo ? ' ' + tipo : '') + ' show';
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3500);
}

function fecharModal(id) { document.getElementById(id).classList.remove('show'); }
document.querySelectorAll('.modal-bg').forEach(b =>
  b.addEventListener('click', e => { if (e.target === b) b.classList.remove('show'); }));

init();

