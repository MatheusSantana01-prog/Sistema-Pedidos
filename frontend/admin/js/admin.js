/* ════════════════════════════════════════════════════
   CONFIG
════════════════════════════════════════════════════ */
const API = 'http://localhost:8000'; // FastAPI local
const SUPA_URL = 'https://lhrfemeunswviwzdpppp.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxocmZlbWV1bnN3dml3emRwcHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMDUzMjYsImV4cCI6MjA4ODY4MTMyNn0.JsHPjGJCCAePfCicpvP4Fk-UWTwW8ve-SXjjLQN2mb4';

/* ════════════════════════════════════════════════════
   ESTADO
════════════════════════════════════════════════════ */
let TOKEN = localStorage.getItem('admin_token') || null;
let USUARIO = JSON.parse(localStorage.getItem('admin_user') || 'null');
const ROLE_LEVEL = { dono: 4, gerente: 3, funcionario: 2, cozinha: 1 };
let todosOsPedidos = [];
let produtosMap = {};
let insumosMap = {};
let usuariosMap = {};
let filtroAtual = 'todos';
let mesaAberta = null;
let pgtoSelecionado = null;
let categorias = [];
let fornecedores = [];
let pollingHandle = null;

/* ════════════════════════════════════════════════════
   HTTP
════════════════════════════════════════════════════ */
async function api(path, opts = {}) {
  let r;
  try {
    r = await fetch(API + path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}),
        ...(opts.headers || {}),
      },
    });
  } catch (e) {
    throw new Error('Erro de rede: ' + e.message);
  }
  if (r.status === 401) {
    logout();
    throw new Error('Sessão expirada. Faça login novamente.');
  }
  if (r.status === 429) {
    throw new Error('Muitas requisições. Aguarde um momento.');
  }
  if (!r.ok) {
    const e = await r.json().catch(() => ({ detail: 'Erro desconhecido' }));
    throw new Error(e.detail || `Erro ${r.status}`);
  }
  if (r.status === 204) return null;
  return r.json();
}

async function supa(path, opts = {}) {
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
  if (!r.ok) throw new Error(await r.text());
  const ct = r.headers.get('content-type') || '';
  return ct.includes('json') ? r.json() : null;
}

async function rpc(fn, params = {}) {
  return supa('/rest/v1/rpc/' + fn, { method: 'POST', body: JSON.stringify(params) });
}

/* ════════════════════════════════════════════════════
   AUTH
════════════════════════════════════════════════════ */
function temPermissao(perfil) {
  const meu = ROLE_LEVEL[USUARIO?.perfil] || 0;
  const req = ROLE_LEVEL[perfil] || 0;
  return meu >= req;
}

async function fazerLogin() {
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
    const timer = setTimeout(() => ctrl.abort(), 8000);
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
    TOKEN   = d.token;
    USUARIO = d.usuario;
    localStorage.setItem('admin_token', TOKEN);
    localStorage.setItem('admin_user', JSON.stringify(USUARIO));
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

function logout() {
  TOKEN = null;
  USUARIO = null;
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
  clearTimeout(pollingHandle);
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display   = 'none';
  // Limpa senha por segurança
  const senhaEl = document.getElementById('l-senha');
  if (senhaEl) senhaEl.value = '';
  document.getElementById('l-email')?.focus();
}

function iniciarApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'flex';
  document.getElementById('user-nome').textContent = USUARIO.nome;
  const badge = document.getElementById('user-role-badge');
  badge.textContent = USUARIO.perfil;
  badge.className = 'role-badge ' + USUARIO.perfil;
  document.querySelectorAll('.nav-tab').forEach(t => {
    const reqs = [...t.classList].filter(c => c.startsWith('role-'));
    if (reqs.length && !reqs.some(r => temPermissao(r.replace('role-', '')))) t.classList.add('hidden');
  });
  const hoje = new Date().toISOString().slice(0, 10);
  const mesPassado = new Date(Date.now() - 30 * 24 * 3600000).toISOString().slice(0, 10);
  document.getElementById('fin-inicio').value = mesPassado;
  document.getElementById('fin-fim').value = hoje;
  carregarMesas();
  carregarCategorias();
  carregarFornecedoresLista();
  iniciarPolling();
}

function iniciarPolling() {
  function agendar() {
    pollingHandle = setTimeout(async () => {
      if (document.visibilityState === 'hidden') { agendar(); return; }
      const pg = document.querySelector('.page.active')?.id;
      try {
        if (pg === 'page-mesas')   await carregarMesas();
        if (pg === 'page-pedidos') await carregarPedidos();
      } catch(e) { /* silencioso — erros de rede não quebram o loop */ }
      agendar();
    }, 12000);
  }
  agendar();
  // Atualiza imediatamente ao voltar para a aba
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      clearTimeout(pollingHandle);
      const pg = document.querySelector('.page.active')?.id;
      if (pg === 'page-mesas')   carregarMesas().finally(agendar);
      if (pg === 'page-pedidos') carregarPedidos().finally(agendar);
    }
  });
}

/* ════════════════════════════════════════════════════
   NAV
════════════════════════════════════════════════════ */
function irPara(pagina, tabEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + pagina).classList.add('active');
  tabEl.classList.add('active');
  const loaders = {
    mesas: carregarMesas,
    pedidos: carregarPedidos,
    produtos: carregarProdutos,
    estoque: carregarEstoque,
    caixa: carregarCaixa,
    financeiro: carregarFinanceiro,
    usuarios: carregarUsuarios,
    auditoria: carregarAuditoria,
  };
  if (loaders[pagina]) loaders[pagina]();
}

/* ════════════════════════════════════════════════════
   MESAS
════════════════════════════════════════════════════ */
async function carregarMesas() {
  try {
    const mesas = await supa(
      '/rest/v1/mesas?select=id,numero,status,capacidade,sessao_mesa!left(id,status,aberta_em,total_consumido)&ativa=eq.true&order=numero'
    );
    const peds = await supa(
      '/rest/v1/pedidos?select=id,status,sessao_mesa_id&status=in.(pendente,confirmado,em_preparo,pronto)&sessao_mesa_id=not.is.null'
    );
    const ppSessao = {};
    (peds || []).forEach(p => {
      ppSessao[p.sessao_mesa_id] = (ppSessao[p.sessao_mesa_id] || 0) + 1;
    });
    renderMesas(mesas || [], ppSessao);
    atualizarBadges(mesas || [], peds || []);
  } catch (e) {
    document.getElementById('mesas-grid').innerHTML = '<div class="tabela-empty">Erro ao carregar mesas.</div>';
  }
}

function renderMesas(mesas, ppSessao) {
  const ocup = mesas.filter(m => m.status === 'ocupada').length;
  const liv = mesas.filter(m => m.status === 'livre').length;
  const fat = mesas.reduce((a, m) => {
    const s = (m.sessao_mesa || []).find(s => s.status === 'aberta');
    return a + Number(s?.total_consumido || 0);
  }, 0);
  const pedAtivos = Object.values(ppSessao).reduce((a, b) => a + b, 0);
  document.getElementById('s-ocup').textContent = ocup;
  document.getElementById('s-liv').textContent = liv;
  document.getElementById('s-fat').textContent = 'R$ ' + fmt(fat);
  document.getElementById('s-ped').textContent = pedAtivos;
  document.getElementById('mesas-grid').innerHTML = mesas
    .map(m => {
      const sessao = (m.sessao_mesa || []).find(s => s.status === 'aberta');
      const total = Number(sessao?.total_consumido || 0);
      const npeds = sessao ? ppSessao[sessao.id] || 0 : 0;
      const dur = sessao ? Math.floor((Date.now() - new Date(sessao.aberta_em)) / 60000) : 0;
      const durStr = dur < 60 ? dur + 'min' : Math.floor(dur / 60) + 'h' + (dur % 60 > 0 ? dur % 60 + 'min' : '');
      return `<div class="mesa-card ${m.status}" ${
        sessao ? `onclick="abrirConta('${m.id}','${sessao.id}',${m.numero},${total})"` : ''
      }>
      <div class="mesa-num">${m.numero}</div>
      <div class="mesa-status-badge ${m.status}">${m.status === 'livre' ? '● Livre' : m.status === 'ocupada' ? '● Ocupada' : '● Reservada'}</div>
      <div class="mesa-info">${sessao ? `${npeds} pedido${npeds !== 1 ? 's' : ''} · ${durStr}` : `Cap. ${m.capacidade || 4} pessoas`}</div>
      ${sessao ? `<div class="mesa-total">R$ ${fmt(total)}</div>` : ''}
      <div class="mesa-actions" onclick="event.stopPropagation()">
        ${sessao
          ? `<button class="btn btn-sm btn-success" onclick="abrirConta('${m.id}','${sessao.id}',${m.numero},${total})">Ver conta →</button>`
          : `<button class="btn btn-sm" onclick="reservarMesa('${m.id}',${m.numero},'${m.status}')">${m.status === 'reservada' ? 'Liberar' : 'Reservar'}</button>`}
      </div>
    </div>`;
    })
    .join('');
}

function atualizarBadges(mesas, peds) {
  const ocup = mesas.filter(m => m.status === 'ocupada').length;
  const pend = peds.filter(p => p.status === 'pendente').length;
  const bO = document.getElementById('badge-ocupadas');
  const bP = document.getElementById('badge-pendentes');
  bO.textContent = ocup;
  bO.classList.toggle('show', ocup > 0);
  bP.textContent = pend;
  bP.classList.toggle('show', pend > 0);
}

async function reservarMesa(id, num, statusAtual) {
  const novo = statusAtual === 'reservada' ? 'livre' : 'reservada';
  await supa(`/rest/v1/mesas?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ status: novo }) });
  showToast(`Mesa ${num} ${novo === 'reservada' ? 'reservada' : 'liberada'}`, 'success');
  carregarMesas();
}

async function abrirConta(mesaId, sessaoId, numero, total) {
  mesaAberta = { mesa_id: mesaId, sessao_id: sessaoId, numero, total };
  pgtoSelecionado = null;
  document.getElementById('modal-conta-title').textContent = `Conta — Mesa ${numero}`;
  document.getElementById('modal-conta-footer').style.display = 'none';
  document.getElementById('modal-conta-body').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  document.getElementById('modal-conta').classList.add('show');
  try {
    const data = await rpc('get_pedidos_sessao', { p_sessao_id: sessaoId });
    const pedidos = Array.isArray(data) ? data : data ? JSON.parse(data) : [];
    renderContaModal(pedidos, numero);
  } catch (e) {
    document.getElementById('modal-conta-body').innerHTML = '<div class="tabela-empty">Erro ao carregar.</div>';
  }
}

function renderContaModal(pedidos, numero) {
  const total = pedidos.filter(p => p.status !== 'cancelado').reduce((a, p) => a + Number(p.total), 0);
  mesaAberta.total = total;
  const html = `
    <div class="conta-mesa-num">Mesa ${numero}</div>
    <div class="conta-aberta-em">${pedidos.length} pedido${pedidos.length !== 1 ? 's' : ''}</div>
    ${pedidos
      .map(p => {
        const hora = new Date(p.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const itens = (p.itens || []).map(it => {
          const mods = (it.ingredientes || []).filter(i => i.acao === 'remover');
          return `<div class="pedido-item">
          <div><div class="pedido-item-nome">${it.quantidade}× ${it.nome_produto}</div>
          ${mods.length ? `<div class="pedido-item-mods">✕ Sem: ${mods.map(i => i.nome_ingrediente).join(', ')}</div>` : ''}
          ${it.observacao ? `<div class="pedido-item-obs">📝 ${it.observacao}</div>` : ''}</div>
          <div class="pedido-item-price">R$ ${fmt(it.subtotal)}</div>
        </div>`;
        })
        .join('');
        return `<div class="pedido-bloco">
        <div class="pedido-bloco-head">
          <div class="pedido-bloco-num">Pedido #${p.numero} <span class="status-pill ${p.status}">${statusLabel(p.status)}</span></div>
          <div class="pedido-bloco-hora">${hora}</div>
        </div>${itens}</div>`;
      })
      .join('')}
    <div class="conta-total-linha"><span style="font-size:14px;color:var(--muted)">Total da conta</span><span class="conta-total-val">R$ ${fmt(total)}</span></div>
    <div style="font-size:12px;color:var(--muted);margin:16px 0 8px;">Forma de pagamento:</div>
    <div class="pgto-grid">
      <button class="pgto-btn" data-pgto="dinheiro" onclick="selecionarPgto(this)">💵 Dinheiro</button>
      <button class="pgto-btn" data-pgto="pix" onclick="selecionarPgto(this)">📲 Pix</button>
      <button class="pgto-btn" data-pgto="cartao_credito" onclick="selecionarPgto(this)">💳 Crédito</button>
      <button class="pgto-btn" data-pgto="cartao_debito" onclick="selecionarPgto(this)">💳 Débito</button>
    </div>`;
  document.getElementById('modal-conta-body').innerHTML = html;
  document.getElementById('modal-conta-footer').style.display = 'flex';
}

function selecionarPgto(btn) {
  document.querySelectorAll('.pgto-btn').forEach(b => b.classList.remove('selecionado'));
  btn.classList.add('selecionado');
  pgtoSelecionado = btn.dataset.pgto;
  document.getElementById('btn-fechar-conta').disabled = false;
}

async function confirmarFecharConta() {
  if (!pgtoSelecionado || !mesaAberta) return;
  const btn = document.getElementById('btn-fechar-conta');
  btn.disabled = true;
  btn.textContent = 'Fechando...';
  try {
    // 1. Fecha sessão (trigger libera a mesa automaticamente)
    await rpc('fechar_sessao_mesa', { p_sessao_id: mesaAberta.sessao_id });

    // 2. Registra pagamento nos pedidos
    await supa(`/rest/v1/pedidos?sessao_mesa_id=eq.${mesaAberta.sessao_id}&status=neq.cancelado`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        forma_pagamento:  pgtoSelecionado,
        status_pagamento: 'aprovado',
        updated_at:       new Date().toISOString(),
      }),
    });

    // 3. Audit log
    await audit('fechar_conta_mesa', 'sessao_mesa', mesaAberta.sessao_id, null, {
      mesa:      mesaAberta.numero,
      total:     mesaAberta.total,
      pagamento: pgtoSelecionado,
    });

    fecharModal('modal-conta');
    showToast(`Mesa ${mesaAberta.numero} fechada · R$ ${fmt(mesaAberta.total)} via ${pgtoLabel(pgtoSelecionado)}`, 'success');
    carregarMesas();
  } catch (e) {
    showToast('Erro ao fechar: ' + e.message, 'error');
    btn.disabled = false;
    btn.textContent = '✓ Fechar conta';
  }
}

/* ════════════════════════════════════════════════════
   PEDIDOS
════════════════════════════════════════════════════ */
async function carregarPedidos() {
  document.getElementById('pedidos-tbody').innerHTML = '<tr><td colspan="7"><div class="loading"><div class="spinner"></div></div></td></tr>';
  try {
    const d = await supa(
      '/rest/v1/pedidos?select=id,numero,status,total,created_at,mesa_id,mesas(numero),pedido_itens(nome_produto,quantidade)&order=created_at.desc&limit=100'
    );
    todosOsPedidos = d || [];
    renderPedidos();
  } catch (e) {
    document.getElementById('pedidos-tbody').innerHTML = '<tr><td colspan="7" class="tabela-empty">Erro.</td></tr>';
  }
}

function renderPedidos() {
  const lista = filtroAtual === 'todos' ? todosOsPedidos : todosOsPedidos.filter(p => p.status === filtroAtual);
  if (!lista.length) {
    document.getElementById('pedidos-tbody').innerHTML = '<tr><td colspan="7" class="tabela-empty">Nenhum pedido</td></tr>';
    return;
  }
  document.getElementById('pedidos-tbody').innerHTML = lista
    .map(p => {
      const hora = new Date(p.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const mesa = p.mesas?.numero || '—';
      const itens = (p.pedido_itens || []).length;
      const next = { pendente: 'confirmado', confirmado: 'em_preparo', em_preparo: 'pronto', pronto: 'entregue' };
      const lbls = { confirmado: 'Confirmar', em_preparo: 'Em preparo', pronto: 'Pronto', entregue: 'Entregar' };
      const acoes = next[p.status]
        ? `<div style="display:flex;gap:6px;">
          <button class="btn btn-sm" onclick="avancarPedido('${p.id}','${next[p.status]}',this)">${lbls[next[p.status]]}</button>
          ${p.status !== 'entregue' ? `<button class="btn btn-sm btn-danger" onclick="cancelarPedido('${p.id}',this)">✕</button>` : ''}
         </div>`
        : '<span style="color:var(--muted);font-size:12px;">—</span>';
      return `<tr>
      <td class="tabela-num">#${p.numero}</td>
      <td>Mesa ${mesa}</td>
      <td>${itens} item${itens !== 1 ? 's' : ''}</td>
      <td class="tabela-num">R$ ${fmt(p.total)}</td>
      <td><span class="status-pill ${p.status}">${statusLabel(p.status)}</span></td>
      <td style="color:var(--muted);font-size:12px;">${hora}</td>
      <td>${acoes}</td>
    </tr>`;
    })
    .join('');
}

function filtrarPedidos(s, btn) {
  filtroAtual = s;
  document.querySelectorAll('.filtro-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderPedidos();
}

async function avancarPedido(id, novoStatus, btn) {
  btn.disabled = true;
  const extra = { updated_at: new Date().toISOString() };
  if (novoStatus === 'em_preparo') extra.tempo_inicio_preparo = extra.updated_at;
  if (novoStatus === 'pronto')     extra.tempo_pronto         = extra.updated_at;
  if (novoStatus === 'entregue')   extra.tempo_entrega        = extra.updated_at;
  try {
    await supa(`/rest/v1/pedidos?id=eq.${id}`, {
      method:  'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status: novoStatus, ...extra }),
    });
    await audit('avancar_status_pedido', 'pedidos', id, null, { status: novoStatus });
    showToast('→ ' + statusLabel(novoStatus), 'success');
    carregarPedidos();
  } catch (e) {
    showToast(e.message, 'error');
    btn.disabled = false;
  }
}

async function cancelarPedido(id, btn) {
  if (!confirm('Cancelar este pedido?')) return;
  btn.disabled = true;
  try {
    await supa(`/rest/v1/pedidos?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status: 'cancelado', updated_at: new Date().toISOString() }),
    });
    await audit('cancelar_pedido', 'pedidos', id, null, { status: 'cancelado' });
    showToast('Pedido cancelado', 'success');
    carregarPedidos();
  } catch (e) {
    showToast(e.message, 'error');
    btn.disabled = false;
  }
}

/* ════════════════════════════════════════════════════
   PRODUTOS
════════════════════════════════════════════════════ */
async function carregarCategorias() {
  try {
    const cats = await supa('/rest/v1/categorias?select=id,nome,icone&ativa=eq.true&order=ordem');
    categorias = cats || [];
    const sel = document.getElementById('prod-categoria');
    sel.innerHTML =
      '<option value="">Selecione...</option>' +
      categorias.map(c => `<option value="${c.id}">${c.icone || ''} ${c.nome}</option>`).join('');
  } catch (e) {}
}

async function carregarProdutos() {
  document.getElementById('produtos-grid').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const p = await supa('/rest/v1/produtos?select=*,categorias(nome,icone)&order=nome');
    renderProdutos(p || []);
  } catch (e) {
    document.getElementById('produtos-grid').innerHTML = '<div class="tabela-empty">Erro.</div>';
  }
}

function renderProdutos(prods) {
  prods.forEach(p => (produtosMap[p.id] = p));
  const podeEditar = temPermissao('gerente');
  document.getElementById('produtos-grid').innerHTML = !prods.length
    ? '<div class="tabela-empty">Nenhum produto</div>'
    : prods
        .map(
          p => `
      <div class="prod-card">
        <div class="prod-thumb">${p.foto_url ? `<img src="${p.foto_url}" onerror="this.parentElement.innerHTML='🍔'">` : '🍔'}</div>
        <div class="prod-info">
          <div class="prod-nome">${p.nome}</div>
          <div class="prod-cat">${p.categorias?.icone || ''} ${p.categorias?.nome || ''}</div>
          <div class="prod-preco">R$ ${fmt(p.preco)}</div>
          <div class="prod-custo">Custo: R$ ${fmt(p.custo || 0)} · Margem: ${p.preco > 0 ? Math.round((p.preco - (p.custo || 0)) / p.preco * 100) : 0}%</div>
          <div class="prod-badges">
            <span class="prod-badge ${p.disponivel ? 'disponivel' : 'indisponivel'}">${p.disponivel ? 'Disponível' : 'Indisponível'}</span>
            ${p.destaque ? '<span class="prod-badge destaque">⭐ Destaque</span>' : ''}
          </div>
        </div>
        ${podeEditar ? `
        <div class="prod-actions">
          <button class="btn btn-sm" onclick="abrirModalProdutoById('${p.id}')">Editar</button>
          <button class="btn btn-sm ${p.disponivel ? 'btn-danger' : 'btn-success'}" onclick="toggleDisponivel('${p.id}',${p.disponivel},this)">${p.disponivel ? 'Pausar' : 'Ativar'}</button>
        </div>` : ''}
      </div>`
        )
        .join('');
}

function abrirModalProduto(p) {
  if (!temPermissao('gerente')) return showToast('Sem permissão', 'error');
  document.getElementById('modal-produto-title').textContent = p ? 'Editar produto' : 'Novo produto';
  document.getElementById('prod-id').value = p?.id || '';
  document.getElementById('prod-nome').value = p?.nome || '';
  document.getElementById('prod-desc').value = p?.descricao || '';
  document.getElementById('prod-preco').value = p?.preco || '';
  document.getElementById('prod-custo').value = p?.custo || '';
  document.getElementById('prod-tempo').value = p?.tempo_preparo_minutos || 10;
  document.getElementById('prod-foto').value = p?.foto_url || '';
  document.getElementById('prod-categoria').value = p?.categoria_id || '';
  document.getElementById('prod-disponivel').checked = p ? p.disponivel : true;
  document.getElementById('prod-destaque').checked = p?.destaque || false;
  document.getElementById('modal-produto').classList.add('show');
}

async function salvarProduto() {
  const id = document.getElementById('prod-id').value;
  const nome = document.getElementById('prod-nome').value.trim();
  const preco = parseFloat(document.getElementById('prod-preco').value);
  const custo = parseFloat(document.getElementById('prod-custo').value) || 0;
  const catId = document.getElementById('prod-categoria').value;
  if (!nome || !preco || !catId) return showToast('Preencha nome, preço e categoria', 'error');
  const payload = {
    nome,
    descricao: document.getElementById('prod-desc').value.trim() || null,
    preco,
    custo,
    categoria_id: catId,
    tempo_preparo_minutos: parseInt(document.getElementById('prod-tempo').value) || 10,
    foto_url: document.getElementById('prod-foto').value.trim() || null,
    disponivel: document.getElementById('prod-disponivel').checked,
    destaque: document.getElementById('prod-destaque').checked,
    updated_at: new Date().toISOString(),
  };
  try {
    if (id) {
      await supa(`/rest/v1/produtos?id=eq.${id}`, { method: 'PATCH', headers: { 'Prefer': 'return=minimal' }, body: JSON.stringify(payload) });
      await audit('editar_produto', 'produtos', id, null, { nome: payload.nome, preco: payload.preco });
    } else {
      const r = await supa('/rest/v1/produtos', { method: 'POST', body: JSON.stringify(payload) });
      if (r && r[0]) await audit('criar_produto', 'produtos', r[0].id, null, { nome: payload.nome });
    }
    showToast(id ? 'Produto atualizado' : 'Produto criado', 'success');
    fecharModal('modal-produto');
    carregarProdutos();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function toggleDisponivel(id, atual, btn) {
  btn.disabled = true;
  try {
    await supa(`/rest/v1/produtos?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ disponivel: !atual, updated_at: new Date().toISOString() }),
    });
    showToast(!atual ? 'Produto ativado' : 'Produto pausado', 'success');
    carregarProdutos();
  } catch (e) {
    showToast(e.message, 'error');
    btn.disabled = false;
  }
}

/* ════════════════════════════════════════════════════
   ESTOQUE
════════════════════════════════════════════ */
async function carregarFornecedoresLista() {
  try {
    const f = await supa('/rest/v1/fornecedores?select=id,nome&ativo=eq.true&order=nome');
    fornecedores = f || [];
    const sel = document.getElementById('insumo-fornecedor');
    if (sel)
      sel.innerHTML =
        '<option value="">Nenhum</option>' +
        fornecedores.map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
  } catch (e) {}
}

async function carregarEstoque() {
  document.getElementById('estoque-tbody').innerHTML = '<tr><td colspan="7"><div class="loading"><div class="spinner"></div></div></td></tr>';
  try {
    const ins = await supa('/rest/v1/insumos?select=*,fornecedores(nome)&ativo=eq.true&order=nome');
    const lista = ins || [];
    const alertas = lista.filter(i => Number(i.estoque_atual) <= Number(i.estoque_minimo));
    const alertEl = document.getElementById('alerta-estoque');
    if (alertas.length) {
      alertEl.classList.add('show');
      document.getElementById('alerta-txt').textContent = `${alertas.length} insumo(s) abaixo do estoque mínimo: ${alertas.map(a => a.nome).join(', ')}`;
    } else {
      alertEl.classList.remove('show');
    }
    lista.forEach(i => (insumosMap[i.id] = i));
    document.getElementById('estoque-tbody').innerHTML = !lista.length
      ? '<tr><td colspan="7" class="tabela-empty">Nenhum insumo</td></tr>'
      : lista
          .map(i => {
            const alerta = Number(i.estoque_atual) <= Number(i.estoque_minimo);
            return `<tr>
            <td style="font-weight:600;${alerta ? 'color:var(--red)' : ''}">${i.nome}${alerta ? ' ⚠️' : ''}</td>
            <td>${i.unidade}</td>
            <td class="tabela-num" style="${alerta ? 'color:var(--red)' : ''}">${Number(i.estoque_atual).toFixed(2)}</td>
            <td class="tabela-num" style="color:var(--muted)">${Number(i.estoque_minimo).toFixed(2)}</td>
            <td class="tabela-num">R$ ${fmt(i.custo_unitario)}</td>
            <td style="color:var(--muted);font-size:12px;">${i.fornecedores?.nome || '—'}</td>
            <td><div style="display:flex;gap:4px;">
              <button class="btn btn-sm" onclick="abrirMovimentacao('${i.id}','${i.nome}')">Movim.</button>
              <button class="btn btn-sm" onclick="abrirModalInsumoById('${i.id}')">Editar</button>
            </div></td>
          </tr>`;
          })
          .join('');
  } catch (e) {
    document.getElementById('estoque-tbody').innerHTML = '<tr><td colspan="7" class="tabela-empty">Erro.</td></tr>';
  }
}

function abrirModalInsumo(i) {
  document.getElementById('modal-insumo-title').textContent = i ? 'Editar insumo' : 'Novo insumo';
  document.getElementById('insumo-id').value = i?.id || '';
  document.getElementById('insumo-nome').value = i?.nome || '';
  document.getElementById('insumo-unidade').value = i?.unidade || 'un';
  document.getElementById('insumo-custo').value = i?.custo_unitario || '';
  document.getElementById('insumo-atual').value = i?.estoque_atual || '';
  document.getElementById('insumo-minimo').value = i?.estoque_minimo || '';
  document.getElementById('insumo-fornecedor').value = i?.fornecedor_id || '';
  document.getElementById('modal-insumo').classList.add('show');
}

async function salvarInsumo() {
  const id = document.getElementById('insumo-id').value;
  const nome = document.getElementById('insumo-nome').value.trim();
  if (!nome) return showToast('Nome obrigatório', 'error');
  const payload = {
    nome,
    unidade: document.getElementById('insumo-unidade').value,
    custo_unitario: parseFloat(document.getElementById('insumo-custo').value) || 0,
    estoque_atual: parseFloat(document.getElementById('insumo-atual').value) || 0,
    estoque_minimo: parseFloat(document.getElementById('insumo-minimo').value) || 0,
    fornecedor_id: document.getElementById('insumo-fornecedor').value || null,
    updated_at: new Date().toISOString(),
  };
  try {
    if (id) await supa(`/rest/v1/insumos?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    else await supa('/rest/v1/insumos', { method: 'POST', body: JSON.stringify(payload) });
    showToast('Salvo', 'success');
    fecharModal('modal-insumo');
    carregarEstoque();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function abrirMovimentacao(insumoId, nome) {
  document.getElementById('mov-insumo-id').value = insumoId;
  document.getElementById('mov-insumo-nome').textContent = nome;
  document.getElementById('mov-qty').value = '';
  document.getElementById('mov-custo').value = '0';
  document.getElementById('mov-motivo').value = '';
  document.getElementById('modal-moviment').classList.add('show');
}

async function salvarMovimentacao() {
  const id = document.getElementById('mov-insumo-id').value;
  const qty = parseFloat(document.getElementById('mov-qty').value);
  if (!qty || qty <= 0) return showToast('Quantidade inválida', 'error');
  const tipo = document.getElementById('mov-tipo').value;
  const custo = parseFloat(document.getElementById('mov-custo').value) || 0;
  const motivo = document.getElementById('mov-motivo').value.trim() || null;
  try {
    const ins = await supa(`/rest/v1/insumos?id=eq.${id}&select=estoque_atual`);
    const atual = Number(ins[0]?.estoque_atual || 0);
    const sinal = tipo === 'entrada' ? 1 : -1;
    const novo = atual + sinal * qty;
    await supa(`/rest/v1/insumos?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ estoque_atual: novo, updated_at: new Date().toISOString() }),
    });
    await supa('/rest/v1/movimentacao_estoque', {
      method: 'POST',
      body: JSON.stringify({ insumo_id: id, tipo, quantidade: qty, custo_total: custo, motivo }),
    });
    showToast(`Movimentação registrada. Estoque: ${novo.toFixed(2)}`, 'success');
    fecharModal('modal-moviment');
    carregarEstoque();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function abrirModalFornecedor() {
  ['forn-nome', 'forn-cnpj', 'forn-tel', 'forn-email', 'forn-contato'].forEach(id => (document.getElementById(id).value = ''));
  document.getElementById('modal-fornecedor').classList.add('show');
}

async function salvarFornecedor() {
  const nome = document.getElementById('forn-nome').value.trim();
  if (!nome) return showToast('Nome obrigatório', 'error');
  const payload = {
    nome,
    cnpj: document.getElementById('forn-cnpj').value || null,
    telefone: document.getElementById('forn-tel').value || null,
    email: document.getElementById('forn-email').value || null,
    contato: document.getElementById('forn-contato').value || null,
  };
  try {
    await supa('/rest/v1/fornecedores', { method: 'POST', body: JSON.stringify(payload) });
    showToast('Fornecedor cadastrado', 'success');
    fecharModal('modal-fornecedor');
    carregarFornecedoresLista();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

/* ════════════════════════════════════════════════════
   CAIXA
════════════════════════════════════════════ */
async function carregarCaixa() {
  const hoje = new Date().toISOString().slice(0, 10);
  try {
    const peds = await supa(
      `/rest/v1/pedidos?select=total,desconto,status,forma_pagamento&created_at=gte.${hoje}T00:00:00&status=neq.cancelado`
    );
    const lista = peds || [];
    const din = lista.filter(p => p.forma_pagamento === 'dinheiro').reduce((a, p) => a + Number(p.total), 0);
    const pix = lista.filter(p => p.forma_pagamento === 'pix').reduce((a, p) => a + Number(p.total), 0);
    const cred = lista.filter(p => p.forma_pagamento === 'cartao_credito').reduce((a, p) => a + Number(p.total), 0);
    const deb = lista.filter(p => p.forma_pagamento === 'cartao_debito').reduce((a, p) => a + Number(p.total), 0);
    const bruto = lista.reduce((a, p) => a + Number(p.total), 0);
    const desc = lista.reduce((a, p) => a + Number(p.desconto || 0), 0);
    document.getElementById('caixa-preview').innerHTML = `
      <div class="stats-row">
        <div class="stat-card"><div class="stat-label">💵 Dinheiro</div><div class="stat-val green">R$ ${fmt(din)}</div></div>
        <div class="stat-card"><div class="stat-label">📲 Pix</div><div class="stat-val blue">R$ ${fmt(pix)}</div></div>
        <div class="stat-card"><div class="stat-label">💳 Crédito</div><div class="stat-val amber">R$ ${fmt(cred)}</div></div>
        <div class="stat-card"><div class="stat-label">💳 Débito</div><div class="stat-val" style="color:var(--muted)">R$ ${fmt(deb)}</div></div>
        <div class="stat-card"><div class="stat-label">Total líquido</div><div class="stat-val accent">R$ ${fmt(bruto - desc)}</div></div>
      </div>
      <div style="font-size:12px;color:var(--muted)">Descontos aplicados hoje: R$ ${fmt(desc)} · ${lista.length} pedidos</div>`;
    const hist = await supa('/rest/v1/fechamento_caixa?select=*,usuarios(nome)&order=data_referencia.desc&limit=30');
    const h = hist || [];
    document.getElementById('caixa-tbody').innerHTML = !h.length
      ? '<tr><td colspan="7" class="tabela-empty">Nenhum fechamento registrado</td></tr>'
      : h
          .map(
            f => `<tr>
          <td>${f.data_referencia}</td>
          <td class="tabela-num">R$ ${fmt(f.total_dinheiro)}</td>
          <td class="tabela-num">R$ ${fmt(f.total_pix)}</td>
          <td class="tabela-num">R$ ${fmt(f.total_credito)}</td>
          <td class="tabela-num">R$ ${fmt(f.total_debito)}</td>
          <td class="tabela-num" style="color:var(--green)">R$ ${fmt(f.total_liquido)}</td>
          <td>${f.total_pedidos}</td>
        </tr>`
          )
          .join('');
  } catch (e) {
    document.getElementById('caixa-preview').innerHTML = '<div class="tabela-empty">Erro ao carregar.</div>';
  }
}

async function fecharCaixaHoje() {
  if (!temPermissao('gerente')) return showToast('Sem permissão', 'error');
  if (!confirm('Fechar o caixa do dia de hoje?')) return;
  const hoje = new Date().toISOString().slice(0, 10);
  try {
    const r = await rpc('gerar_fechamento_caixa', { p_data: hoje, p_usuario_id: USUARIO.id });
    // Audit: fecharCaixa é gravado via trigger no banco, mas duplicar aqui garante o usuário
    await audit('fechar_caixa', 'fechamento_caixa', r.fechamento_id, null, {
      data:          hoje,
      total_liquido: r.total_liquido,
      total_pedidos: r.total_pedidos,
    });
    showToast(`Caixa fechado! Total líquido: R$ ${fmt(r.total_liquido)}`, 'success');
    carregarCaixa();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

/* ════════════════════════════════════════════════════
   FINANCEIRO (Dono)
════════════════════════════════════════════════════ */
async function carregarFinanceiro() {
  if (!temPermissao('dono')) return;
  const ini = document.getElementById('fin-inicio').value;
  const fim = document.getElementById('fin-fim').value;
  if (!ini || !fim) return showToast('Selecione o período', 'error');
  document.getElementById('financeiro-content').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const d = await rpc('get_dashboard_financeiro', { p_data_inicio: ini, p_data_fim: fim });
    if (!d) throw new Error('Sem dados');
    const maxPgto = Math.max(...Object.values(d.por_pagamento || {}).map(Number), 1);
    document.getElementById('financeiro-content').innerHTML = `
      <div class="stats-row">
        <div class="stat-card"><div class="stat-label">Faturamento bruto</div><div class="stat-val green">R$ ${fmt(d.total_bruto)}</div></div>
        <div class="stat-card"><div class="stat-label">Descontos</div><div class="stat-val accent">R$ ${fmt(d.total_descontos)}</div></div>
        <div class="stat-card"><div class="stat-label">Faturamento líquido</div><div class="stat-val blue">R$ ${fmt(d.total_liquido)}</div></div>
        <div class="stat-card"><div class="stat-label">Pedidos</div><div class="stat-val">${d.total_pedidos}</div></div>
        <div class="stat-card"><div class="stat-label">Ticket médio</div><div class="stat-val amber">R$ ${fmt(d.ticket_medio)}</div></div>
        <div class="stat-card"><div class="stat-label">Cancelamentos</div><div class="stat-val" style="color:var(--red)">${d.cancelamentos?.total || 0}</div></div>
      </div>
      <div class="relatorio-grid">
        <div class="relatorio-card">
          <div class="relatorio-card-title">Por forma de pagamento</div>
          ${Object.entries(d.por_pagamento || {})
            .map(
              ([k, v]) => `
            <div class="bar-row">
              <div class="bar-label">${pgtoLabel(k)}</div>
              <div class="bar-track"><div class="bar-fill" style="width:${Math.round(Number(v) / maxPgto * 100)}%;background:var(--blue)"></div></div>
              <div class="bar-val">R$ ${Math.round(Number(v))}</div>
            </div>`
            )
            .join('') || '<div style="color:var(--muted);font-size:13px;">Sem dados</div>'}
        </div>
        <div class="relatorio-card">
          <div class="relatorio-card-title">Descontos acima de 10%</div>
          ${(d.descontos_altos || []).length
            ? (d.descontos_altos || [])
                .map(
                  x => `
              <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px;">
                <span>Pedido #${x.pedido}</span>
                <span style="color:var(--accent)">R$ ${fmt(x.desconto)} (${x.pct}%)</span>
              </div>`
                )
                .join('')
            : '<div style="color:var(--muted);font-size:13px;">Nenhum desconto elevado</div>'}
        </div>
        <div class="relatorio-card">
          <div class="relatorio-card-title">Cancelamentos</div>
          <div style="font-family:var(--mono);font-size:28px;font-weight:600;color:var(--red);">${d.cancelamentos?.total || 0}</div>
          <div style="font-size:13px;color:var(--muted);margin-top:4px;">Total cancelado: R$ ${fmt(d.cancelamentos?.valor || 0)}</div>
        </div>
      </div>`;
  } catch (e) {
    document.getElementById('financeiro-content').innerHTML = '<div class="tabela-empty">Erro: ' + e.message + '</div>';
  }
}

/* ════════════════════════════════════════════════════
   USUÁRIOS (Dono)
════════════════════════════════════════════════════ */
async function carregarUsuarios() {
  if (!temPermissao('dono')) return;
  document.getElementById('usuarios-lista').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const u = await supa('/rest/v1/usuarios?select=id,nome,email,perfil,ativo,ultimo_acesso,created_at&order=nome');
    (u || []).forEach(usr => (usuariosMap[usr.id] = usr));
    document.getElementById('usuarios-lista').innerHTML = (u || [])
      .map(
        usr => `
      <div class="usuario-row ${!usr.ativo ? 'usuario-inativo' : ''}">
        <div class="usuario-avatar">${usr.nome.slice(0, 2).toUpperCase()}</div>
        <div class="usuario-info">
          <div class="usuario-nome">${usr.nome} ${!usr.ativo ? '<span style="color:var(--red);font-size:11px;">(inativo)</span>' : ''}</div>
          <div class="usuario-email">${usr.email}</div>
        </div>
        <span class="role-badge ${usr.perfil}">${usr.perfil}</span>
        <div style="font-size:11px;color:var(--muted);min-width:80px;text-align:right;">
          ${usr.ultimo_acesso ? 'Último: ' + new Date(usr.ultimo_acesso).toLocaleDateString('pt-BR') : 'Nunca acessou'}
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-sm" onclick="abrirModalUsuarioById('${usr.id}')">Editar</button>
          ${usr.ativo && usr.id !== USUARIO.id ? `<button class="btn btn-sm btn-danger" onclick="desativarUsuario('${usr.id}','${usr.nome}',this)">Desativar</button>` : ''}
        </div>
      </div>`
      )
      .join('');
  } catch (e) {
    document.getElementById('usuarios-lista').innerHTML = '<div class="tabela-empty">Erro.</div>';
  }
}

function abrirModalUsuario(u) {
  document.getElementById('modal-usuario-title').textContent = u ? 'Editar usuário' : 'Novo usuário';
  document.getElementById('u-id').value = u?.id || '';
  document.getElementById('u-nome').value = u?.nome || '';
  document.getElementById('u-email').value = u?.email || '';
  document.getElementById('u-senha').value = '';
  document.getElementById('u-perfil').value = u?.perfil || 'funcionario';
  document.getElementById('u-obs').value = u?.observacao || '';
  document.getElementById('u-senha-row').style.display = u ? 'none' : 'block';
  document.getElementById('modal-usuario').classList.add('show');
}

async function salvarUsuario() {
  const id = document.getElementById('u-id').value;
  const nome = document.getElementById('u-nome').value.trim();
  const email = document.getElementById('u-email').value.trim();
  const senha = document.getElementById('u-senha').value;
  const perfil = document.getElementById('u-perfil').value;
  if (!nome || !email) return showToast('Nome e email obrigatórios', 'error');
  if (!id && !senha) return showToast('Senha obrigatória para novo usuário', 'error');
  try {
    if (id) {
      const payload = {
        nome,
        perfil,
        observacao: document.getElementById('u-obs').value || null,
        updated_at: new Date().toISOString(),
      };
      await supa(`/rest/v1/usuarios?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    } else {
      // Cria usuário via API (backend faz o hash bcrypt corretamente)
      await api('/api/dono/usuarios', {
        method: 'POST',
        body: JSON.stringify({ nome, email, senha, perfil }),
      });
    }
    await audit(id ? 'editar_usuario' : 'criar_usuario', 'usuarios', id || null, null,
      { email: document.getElementById('u-email').value, perfil: document.getElementById('u-perfil').value });
    showToast('Usuário salvo', 'success');
    fecharModal('modal-usuario');
    carregarUsuarios();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function desativarUsuario(id, nome, btn) {
  if (!confirm(`Desativar ${nome}?`)) return;
  btn.disabled = true;
  try {
    await supa(`/rest/v1/usuarios?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({ ativo: false, updated_at: new Date().toISOString() }),
    });
    await audit('desativar_usuario', 'usuarios', id, { ativo: true }, { ativo: false, nome });
    showToast('Usuário desativado', 'success');
    carregarUsuarios();
  } catch (e) {
    showToast(e.message, 'error');
    btn.disabled = false;
  }
}

/* ════════════════════════════════════════════════════
   AUDITORIA (Dono)
════════════════════════════════════════════ */
async function carregarAuditoria() {
  if (!temPermissao('dono')) return;
  document.getElementById('auditoria-lista').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const acao = document.getElementById('audit-acao').value || null;
  try {
    const d = await rpc('get_audit_report', {
      p_acao: acao,
      p_data_inicio: new Date(Date.now() - 7 * 24 * 3600000).toISOString().slice(0, 10),
      p_data_fim: new Date().toISOString().slice(0, 10),
      p_limit: 100,
    });
    const logs = Array.isArray(d) ? d : [];
    document.getElementById('auditoria-lista').innerHTML = !logs.length
      ? '<div class="tabela-empty">Nenhum log encontrado no período</div>'
      : logs.map(l => {
          const acaoLabel = {
            fechar_conta_mesa:      '🧾 Fechou conta de mesa',
            fechar_caixa:           '💰 Fechou o caixa',
            cancelar_pedido:        '❌ Cancelou pedido',
            avancar_status_pedido:  '▶ Avançou status de pedido',
            criar_produto:          '➕ Criou produto',
            editar_produto:         '✏️ Editou produto',
            alterar_produto:        '✏️ Alterou produto',
            criar_usuario:          '👤 Criou usuário',
            editar_usuario:         '👤 Editou usuário',
            desativar_usuario:      '🚫 Desativou usuário',
            ativar_usuario:         '✅ Ativou usuário',
            alterar_perfil_usuario: '🔑 Alterou perfil',
          }[l.acao] || l.acao;

          let detalhe = '';
          if (l.valor_novo) {
            try {
              const v = typeof l.valor_novo === 'string' ? JSON.parse(l.valor_novo) : l.valor_novo;
              detalhe = Object.entries(v)
                .filter(([k]) => !['updated_at'].includes(k))
                .map(([k, val]) => `<span>${k}: <strong>${val}</strong></span>`)
                .join(' · ');
            } catch(e) {}
          }

          return `<div class="audit-row">
            <div class="audit-time">${new Date(l.created_at).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</div>
            <div class="audit-user">${l.usuario || '—'}</div>
            <div class="audit-perfil"><span class="role-badge ${l.perfil}">${l.perfil || '—'}</span></div>
            <div class="audit-acao">
              <strong>${acaoLabel}</strong>
              ${l.tabela ? `<span style="color:var(--muted);font-size:11px"> · ${l.tabela}</span>` : ''}
              ${detalhe ? `<div style="font-size:11px;color:var(--muted);margin-top:3px;">${detalhe}</div>` : ''}
            </div>
          </div>`;
        }).join('');
  } catch (e) {
    document.getElementById('auditoria-lista').innerHTML = '<div class="tabela-empty">Erro: ' + e.message + '</div>';
  }
}

/* ════════════════════════════════════════════════════
   UTILITÁRIOS
════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════
   AUDIT — grava ação no audit_log via RPC
   Chamada após toda ação crítica do frontend.
════════════════════════════════════════════════════ */
async function audit(acao, tabela, registroId, valAnt, valNovo) {
  if (!USUARIO) return;
  try {
    await rpc('registrar_acao_audit', {
      p_usuario_id:   USUARIO.id,
      p_usuario_nome: USUARIO.nome,
      p_perfil:       USUARIO.perfil,
      p_acao:         acao,
      p_tabela:       tabela   || null,
      p_registro_id:  registroId ? String(registroId) : null,
      p_valor_ant:    valAnt   ? JSON.stringify(valAnt)   : null,
      p_valor_novo:   valNovo  ? JSON.stringify(valNovo)  : null,
    });
  } catch(e) { /* log nunca quebra a operação principal */ }
}

function fmt(n) {
  return Number(n).toFixed(2).replace('.', ',');
}

function statusLabel(s) {
  return {
    pendente: 'Aguardando',
    confirmado: 'Confirmado',
    em_preparo: 'Em preparo',
    pronto: 'Pronto',
    entregue: 'Entregue',
    cancelado: 'Cancelado',
  }[s] || s;
}

function pgtoLabel(p) {
  return {
    dinheiro: 'Dinheiro',
    pix: 'Pix',
    cartao_credito: 'Crédito',
    cartao_debito: 'Débito',
    nao_informado: 'Não inf.',
  }[p] || p;
}

function abrirModalProdutoById(id) {
  const p = produtosMap[id];
  if (p) abrirModalProduto(p);
}

function abrirModalInsumoById(id) {
  const i = insumosMap[id];
  if (i) abrirModalInsumo(i);
}

function abrirModalUsuarioById(id) {
  const u = usuariosMap[id];
  if (u) abrirModalUsuario(u);
}

function fecharModal(id) {
  document.getElementById(id).classList.remove('show');
}

document.querySelectorAll('.modal-bg').forEach(b => {
  b.addEventListener('click', e => {
    if (e.target === b) b.classList.remove('show');
  });
});

function showToast(msg, tipo = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (tipo ? ' ' + tipo : '') + ' show';
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3500);
}

if (TOKEN && USUARIO) iniciarApp();
