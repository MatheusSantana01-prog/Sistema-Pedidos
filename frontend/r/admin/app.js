/* ══════════════════════════════════════════════════
   ADMIN MULTI-TENANT
   URL: /r/{slug}/admin/index.html
   Token JWT contém restaurant_id — backend valida tudo
══════════════════════════════════════════════════ */

let RESTAURANT     = null;
let mesaAberta     = null;
let pgtoSelecionado = null;
let pagamentosConta = [];
let produtosMap    = {};
let categoriasLista = [];
let produtosLista  = [];
let pollingHandle  = null;
let supportPollingHandle = null;

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
  setupRememberedLogin('admin');

  // 2. Se já tem sessão válida, entrar direto
  if (isLoggedIn() && sessaoDoRestaurante(RESTAURANT)) {
    iniciarApp();
  } else if (isLoggedIn()) logout();
}

/* ── LOGIN ────────────────────────────────────────── */
async function fazerLogin() {
  const email = document.getElementById('l-email').value.trim();
  const senha = document.getElementById('l-senha').value.trim();
  const btn   = document.querySelector('.btn-primary');
  const erro  = document.getElementById('login-erro');

  if (!email || !senha) {
    erro.textContent = 'Preencha login e senha';
    erro.classList.add('show');
    return;
  }

  btn.disabled = true;
  document.getElementById('login-txt').textContent = 'Entrando...';

  try {
    const slug = getCurrentRestaurantSlug();
    const remember = document.getElementById('l-remember')?.checked === true;
    await login(email, senha, slug, { remember });
    persistRememberedLogin('admin', email, remember);
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
  clearTimeout(supportPollingHandle);
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

function iniciarApp() {
  const u = getUsuario();
  if (u.role === 'waiter' && window.location.pathname.includes('/admin')) {
    window.location.href = `/r/${getCurrentRestaurantSlug()}/garcom`;
    return;
  }
  try {
    exigirSessaoRestaurante(RESTAURANT);
    exigirPerfil(['manager', 'owner'], 'Use um login de gerente ou dono para abrir o painel admin');
  } catch (e) {
    document.getElementById('login-erro').textContent = e.message;
    document.getElementById('login-erro').classList.add('show');
    document.getElementById('app-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    return;
  }
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display   = 'flex';
  document.getElementById('user-nome').textContent = u.nome;
  document.getElementById('user-role').textContent = u.role;
  renderAtalhosRapidos();

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
  carregarContadorSuporteAdmin();
  iniciarPolling();
}

async function renderAtalhosRapidos() {
  const el = document.getElementById('quick-access');
  if (!el) return;
  const slug = getCurrentRestaurantSlug();
  el.innerHTML = '<div class="quick-access-label">Acessos rápidos</div><div class="quick-access-links"><span class="quick-link muted">Carregando...</span></div>';
  try {
    const { usuarios } = await apiCall('GET', '/api/admin/users');
    const rolesAtivos = new Set((usuarios || [])
      .filter(m => m?.is_active !== false && m?.usuarios?.ativo !== false)
      .map(m => m.role));
    const links = [
      ['Admin', `/r/${slug}/admin`, 'Painel administrativo', true],
      ['Caixa', `/r/${slug}/caixa`, 'Fechamento de contas', rolesAtivos.has('cashier')],
      ['Cozinha', `/r/${slug}/cozinha`, 'Fila de preparo', rolesAtivos.has('kitchen')],
      ['Garçom', `/r/${slug}/garcom`, 'Atendimento', rolesAtivos.has('waiter')],
    ].filter(item => item[3]);
    el.innerHTML = `
      <div class="quick-access-label">Acessos rápidos</div>
      <div class="quick-access-links">
        ${links.map(([label, href, title]) => `
          <a class="quick-link" href="${escapeAttr(href)}" target="_blank" rel="noopener" title="${escapeAttr(title)}">
            <span>${escapeHtml(label)}</span>
          </a>`).join('')}
      </div>`;
  } catch (e) {
    el.innerHTML = '<div class="quick-access-label">Acessos rápidos</div><div class="quick-access-links"><span class="quick-link muted">Indisponível</span></div>';
  }
}

function iniciarPolling() {
  clearTimeout(supportPollingHandle);
  function agendar() {
    pollingHandle = setTimeout(() => {
      const pg = document.querySelector('.page.active')?.id;
      if (pg === 'page-mesas')   carregarMesas();
      if (pg === 'page-pedidos') carregarPedidos();
      agendar();
    }, 12000);
  }
  function agendarSuporte() {
    supportPollingHandle = setTimeout(() => {
      carregarContadorSuporteAdmin(false);
      agendarSuporte();
    }, 60000);
  }
  agendar();
  agendarSuporte();
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
    fiscal:        carregarFiscal,
    usuarios:      carregarUsuarios,
    suporte:       carregarSuporteCliente,
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
    const semPedido = mesas.filter(m => m.estado_operacional === 'ocupada_sem_pedido').length;
    const fat  = mesas.reduce((a, m) => a + Number(m.sessao_ativa?.total_consumido || 0), 0);
    document.getElementById('s-ocup').textContent = semPedido ? `${ocup} (${semPedido} sem pedido)` : ocup;
    document.getElementById('s-liv').textContent  = liv;
    document.getElementById('s-fat').textContent  = 'R$ ' + fmt(fat);
    carregarChamadosAdmin(false);

    document.getElementById('mesas-grid').innerHTML = mesas.map(m => {
      const sess = m.sessao_ativa;
      const total = Number(sess?.total_consumido || 0);
      const dur   = sess ? Math.floor((Date.now() - new Date(sess.aberta_em)) / 60000) : 0;
      const durStr = dur < 60 ? dur + 'min' : Math.floor(dur/60) + 'h' + (dur%60 > 0 ? dur%60 + 'm' : '');
      const alerta = alertaMesa(sess);
      const estado = m.estado_operacional || m.status;
      return `<div class="mesa-card ${m.status} ${estado} ${alerta.classe}" onclick="${sess ? `abrirConta('${m.id}','${sess.id}',${m.numero},${total})` : ''}">
        <div class="mesa-num">${m.numero}</div>
        <div class="mesa-status-badge ${estado}">${labelEstadoMesa(m)}</div>
        <div class="mesa-info">${sess ? `${mesaOrigem(sess)} · ${durStr}<br>R$ ${fmt(total)}` : 'Mesa livre'}</div>
        ${alerta.texto ? `<div class="mesa-alerta">${alerta.texto}</div>` : ''}
        <div class="mesa-actions" onclick="event.stopPropagation()">
          ${m.qr_code_token ? `<a class="btn btn-sm" href="/r/${getCurrentRestaurantSlug()}/mesa/${escapeAttr(m.qr_code_token)}" target="_blank" rel="noopener">Abrir mesa</a>` : ''}
          ${sess ? `<button class="btn btn-sm btn-success" onclick="abrirConta('${m.id}','${sess.id}',${m.numero},${total})">Ver conta →</button>` : ''}
          ${!sess ? `<button class="btn btn-sm btn-success" onclick="ocuparMesa('${m.id}',${m.numero},this)">Ocupar</button>` : ''}
          ${sess && (sess.pedidos_count || 0) === 0 ? `<button class="btn btn-sm btn-danger" onclick="liberarSemConsumo('${m.id}',${m.numero},this)">Liberar sem consumo</button>` : ''}
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function labelEstadoMesa(m) {
  if (m.estado_operacional === 'ocupada_sem_pedido') return '● Ocupada sem pedido';
  if (m.estado_operacional === 'com_pedido') return '● Com pedido';
  if (m.status === 'livre') return '● Livre';
  if (m.status === 'reservada') return '● Reservada';
  return '● Ocupada';
}

function mesaOrigem(sess) {
  const obs = String(sess?.observacao || '');
  if (obs.includes('cardapio_fisico')) return 'Cardápio físico';
  if (obs.includes('reserva_chegou')) return 'Reserva chegou';
  if (obs.includes('aguardando')) return 'Cliente aguardando';
  if (obs.includes('ocupacao_manual')) return 'Ocupação manual';
  return (sess?.pedidos_count || 0) === 0 ? 'Sem pedido' : `${sess.pedidos_count} pedido(s)`;
}

async function ocuparMesa(mesaId, numero, btn) {
  const motivo = await appPrompt(`Motivo para ocupar a mesa ${numero}. Use: cliente_sentou, aguardando, cardapio_fisico, reserva_chegou ou outro.`, 'cliente_sentou', { title: 'Ocupar mesa' });
  if (!motivo) return;
  btn.disabled = true;
  try {
    await apiCall('POST', `/api/admin/tables/${mesaId}/occupy`, { motivo: motivo.trim() || 'cliente_sentou' });
    showToast(`Mesa ${numero} ocupada`, 'success');
    carregarMesas();
  } catch (e) {
    showToast(e.message, 'error');
    btn.disabled = false;
  }
}

async function liberarSemConsumo(mesaId, numero, btn) {
  const motivo = await appPrompt(`Por que liberar a mesa ${numero} sem consumo? Use: nao_consumiu, desistiu, aguardou_e_saiu, erro_operacional ou outro.`, 'nao_consumiu', { title: 'Liberar sem consumo' });
  if (!motivo) return;
  if (!await appConfirm(`Confirmar liberação da mesa ${numero} sem consumo?`, { title: 'Confirmar liberação', danger: true })) return;
  btn.disabled = true;
  try {
    await apiCall('POST', `/api/admin/tables/${mesaId}/release`, { motivo: motivo.trim() || 'nao_consumiu' });
    showToast(`Mesa ${numero} liberada sem consumo`, 'success');
    carregarMesas();
  } catch (e) {
    showToast(e.message, 'error');
    btn.disabled = false;
  }
}

async function carregarChamadosAdmin(showErrors = true) {
  const wrap = document.getElementById('chamados-lista');
  if (!wrap) return;
  try {
    const { chamados } = await apiCall('GET', '/api/admin/service-requests?limite=20');
    const abertos = (chamados || []).filter(c => c.status !== 'atendido');
    wrap.innerHTML = abertos.length ? `
      <div class="calls-admin-box">
        <div class="calls-admin-title">Chamados pendentes</div>
        ${abertos.map(c => `
          <div class="call-admin-item ${c.tipo}">
            <span>Mesa ${c.mesa_numero || '—'} · ${labelChamado(c.tipo)}</span>
            <button onclick="atenderChamadoAdmin('${c.id}',this)">Atender</button>
          </div>`).join('')}
      </div>` : '';
  } catch (e) {
    if (showErrors) showToast(e.message, 'error');
  }
}

async function atenderChamadoAdmin(id, btn) {
  btn.disabled = true;
  try {
    await apiCall('PATCH', `/api/admin/service-requests/${id}`, { status: 'atendido' });
    carregarChamadosAdmin(false);
  } catch (e) {
    showToast(e.message, 'error');
    btn.disabled = false;
  }
}

function labelChamado(tipo) {
  return { garcom:'Chamou garçom', conta:'Pediu conta', problema:'Problema' }[tipo] || 'Chamado';
}

function alertaMesa(sess) {
  if (!sess?.ultima_atividade_em) return { classe: '', texto: '' };
  const min = Math.floor((Date.now() - new Date(sess.ultima_atividade_em)) / 60000);
  if (min >= 60) return { classe: 'mesa-alerta-critico', texto: `Sem novo pedido há ${min}min` };
  if (min >= 30) return { classe: 'mesa-alerta-atencao', texto: `Sem novo pedido há ${min}min` };
  return { classe: '', texto: '' };
}

async function abrirConta(mesaId, sessaoId, numero, total) {
  mesaAberta = { mesa_id: mesaId, sessao_id: sessaoId, numero, total };
  pgtoSelecionado = null;
  pagamentosConta = [];
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
            <span style="font-family:var(--mono);font-size:12px;font-weight:600">#${escapeHtml(p.numero)}</span>
            <span class="status-pill ${escapeAttr(p.status)}">${escapeHtml(statusLabel(p.status))}</span>
          </div>
          ${(p.itens||[]).map(it => `
            <div style="display:flex;justify-content:space-between;padding:8px 14px;border-bottom:1px solid var(--border);font-size:13px;">
              <span>${escapeHtml(it.quantidade)}× ${escapeHtml(it.nome_produto)}</span>
              <span style="font-family:var(--mono);color:var(--muted)">R$ ${fmt(it.subtotal)}</span>
            </div>`).join('')}
        </div>`).join('')}
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-top:1px solid var(--border);">
        <span style="color:var(--muted)">Total</span>
        <span class="conta-total-val">R$ ${fmt(tot)}</span>
      </div>
      <div class="split-pay-box">
        <div style="font-size:12px;color:var(--muted);margin:16px 0 8px;">Pagamentos da mesa:</div>
        <div class="split-pay-row">
          <select class="form-input" id="split-forma">
            ${formasPagamentoOptions()}
          </select>
          <input class="form-input" id="split-valor" type="number" step="0.01" min="0" placeholder="Valor">
          <button class="btn btn-sm" onclick="adicionarPagamentoConta()">Adicionar</button>
        </div>
        <div class="split-pay-actions">
          <button class="btn btn-sm" onclick="preencherRestantePagamento()">Usar restante</button>
          <span id="split-resumo">Restante: R$ ${fmt(tot)}</span>
        </div>
        <div id="split-lista" class="split-pay-list"></div>
      </div>`;

    document.getElementById('modal-conta-footer').style.display = 'flex';
    renderPagamentosConta();
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

function formasPagamentoOptions() {
  return [
    ['dinheiro', 'Dinheiro'],
    ['pix', 'Pix'],
    ['cartao_credito', 'Cartão crédito'],
    ['cartao_debito', 'Cartão débito'],
    ['vale_refeicao', 'Vale refeição'],
    ['vale_alimentacao', 'Vale alimentação'],
    ['transferencia', 'Transferência'],
    ['outro', 'Outro'],
  ].map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
}

function labelPagamento(forma) {
  return {
    dinheiro:'Dinheiro', pix:'Pix', cartao_credito:'Cartão crédito', cartao_debito:'Cartão débito',
    vale_refeicao:'Vale refeição', vale_alimentacao:'Vale alimentação', transferencia:'Transferência', outro:'Outro',
  }[forma] || forma;
}

function totalPagamentosConta() {
  return pagamentosConta.reduce((a, p) => a + Number(p.valor || 0), 0);
}

function restantePagamentoConta() {
  return Math.max(0, Number((Number(mesaAberta?.total || 0) - totalPagamentosConta()).toFixed(2)));
}

function adicionarPagamentoConta() {
  const forma = document.getElementById('split-forma').value;
  const valor = Number(document.getElementById('split-valor').value || 0);
  if (!valor || valor <= 0) return showToast('Informe um valor válido', 'error');
  if (valor - restantePagamentoConta() > 0.02) return showToast('Valor maior que o restante da conta', 'error');
  pagamentosConta.push({ forma_pagamento: forma, valor: Number(valor.toFixed(2)) });
  document.getElementById('split-valor').value = '';
  renderPagamentosConta();
}

function preencherRestantePagamento() {
  const restante = restantePagamentoConta();
  if (restante <= 0) return;
  document.getElementById('split-valor').value = restante.toFixed(2);
}

function removerPagamentoConta(idx) {
  pagamentosConta.splice(idx, 1);
  renderPagamentosConta();
}

function renderPagamentosConta() {
  const restante = restantePagamentoConta();
  const lista = document.getElementById('split-lista');
  const resumo = document.getElementById('split-resumo');
  if (!lista || !resumo) return;
  resumo.textContent = `Pago: R$ ${fmt(totalPagamentosConta())} · Restante: R$ ${fmt(restante)}`;
  lista.innerHTML = pagamentosConta.length ? pagamentosConta.map((p, idx) => `
    <div class="split-pay-item">
      <span>${labelPagamento(p.forma_pagamento)}</span>
      <strong>R$ ${fmt(p.valor)}</strong>
      <button onclick="removerPagamentoConta(${idx})">✕</button>
    </div>`).join('') : '<div class="split-empty">Nenhum pagamento adicionado.</div>';
  document.getElementById('btn-fechar-conta').disabled = restante > 0.02 || !pagamentosConta.length;
}

async function confirmarFecharConta() {
  if (!mesaAberta || !pagamentosConta.length || restantePagamentoConta() > 0.02) return;
  const btn = document.getElementById('btn-fechar-conta');
  btn.disabled = true;
  try {
    await apiCall('POST', `/api/admin/tables/${mesaAberta.mesa_id}/close`,
      { pagamentos: pagamentosConta });
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
          const next  = {pendente:'em_preparo',confirmado:'em_preparo',em_preparo:'pronto',pronto:'entregue'};
          const lbls  = {em_preparo:'Confirmar e preparar',pronto:'Pronto',entregue:'Entregue'};
          const acoes = next[p.status]
            ? `<div style="display:flex;gap:6px;">
                <button class="btn btn-sm" onclick="avancarPedido('${escapeAttr(p.id)}','${escapeAttr(next[p.status])}',this)">${escapeHtml(lbls[next[p.status]])}</button>
                <button class="btn btn-sm btn-danger" onclick="cancelarPedido('${escapeAttr(p.id)}',this)">✕</button>
               </div>` : '—';
          return `<tr>
            <td class="tabela-num">#${escapeHtml(p.numero)}</td>
            <td>Mesa ${escapeHtml(p.mesas?.numero || '—')}</td>
            <td>${itens} item(s)</td>
            <td class="tabela-num">R$ ${fmt(p.total)}</td>
            <td><span class="status-pill ${escapeAttr(p.status)}">${escapeHtml(statusLabel(p.status))}</span></td>
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
  if (!await appConfirm('Cancelar este pedido?', { title: 'Cancelar pedido', danger: true })) return;
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
          <img class="admin-produto-img" src="${safeUrl(imageForAdminProduct(p), ADMIN_FOOD_IMAGES.default)}" alt="${escapeAttr(p.nome)}" loading="lazy" onerror="this.src='${ADMIN_FOOD_IMAGES.default}'">
          <div class="admin-produto-body">
            <div class="admin-produto-top">
              <div>
                <div class="admin-produto-cat">${escapeHtml(p.categorias?.icone || '')} ${escapeHtml(p.categorias?.nome || 'Sem categoria')}</div>
                <div class="admin-produto-nome">${escapeHtml(p.nome)}</div>
              </div>
              <span class="admin-produto-badge ${p.disponivel ? 'ok' : 'off'}">${p.disponivel ? 'Disponível' : 'Pausado'}</span>
            </div>
            ${p.descricao ? `<div class="admin-produto-desc">${escapeHtml(p.descricao)}</div>` : ''}
            <div class="admin-produto-footer">
              <div>
                <div class="admin-produto-preco">R$ ${fmt(p.preco)}</div>
                ${p.destaque ? '<div class="admin-produto-destaque">Destaque na mesa</div>' : ''}
              </div>
              <div class="admin-produto-actions">
                <button class="btn btn-sm" onclick="abrirModalProdutoById('${escapeAttr(p.id)}')">Editar</button>
                <button class="btn btn-sm ${p.disponivel?'btn-danger':'btn-success'}" onclick="toggleProduto('${escapeAttr(p.id)}',${p.disponivel},this)">${p.disponivel?'Pausar':'Ativar'}</button>
              </div>
            </div>
          </div>
        </div>`).join('')}
      </div>`;
  renderCategoriasAdmin();
}

function renderCategoriasAdmin() {
  const el = document.getElementById('categorias-lista');
  if (!el) return;
  el.innerHTML = !categoriasLista.length ? '<div class="tabela-empty">Crie categorias para organizar o cardápio</div>' :
    categoriasLista.map(c => `
      <div class="categoria-pill">
        <span>${escapeHtml(c.icone || '')} ${escapeHtml(c.nome)}</span>
        <small>#${escapeHtml(c.ordem ?? 99)}</small>
        <button class="btn btn-sm" onclick="abrirModalCategoria('${escapeAttr(c.id)}')">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="removerCategoria('${escapeAttr(c.id)}',this)">Remover</button>
      </div>`).join('');
}

function abrirModalCategoria(id = '') {
  const c = categoriasLista.find(item => item.id === id) || {};
  document.getElementById('cat-id').value = c.id || '';
  document.getElementById('cat-nome').value = c.nome || '';
  document.getElementById('cat-icone').value = c.icone || '';
  document.getElementById('cat-ordem').value = c.ordem ?? 99;
  document.getElementById('modal-categoria').classList.add('show');
}

async function salvarCategoria() {
  const id = document.getElementById('cat-id').value;
  const payload = {
    nome: document.getElementById('cat-nome').value.trim(),
    icone: document.getElementById('cat-icone').value.trim() || '•',
    ordem: Number(document.getElementById('cat-ordem').value || 99),
  };
  if (!payload.nome) return showToast('Informe o nome da categoria', 'error');
  try {
    if (id) await apiCall('PATCH', `/api/admin/categories/${id}`, payload);
    else await apiCall('POST', '/api/admin/categories', payload);
    fecharModal('modal-categoria');
    showToast(id ? 'Categoria atualizada' : 'Categoria criada', 'success');
    carregarCardapio();
  } catch (e) { showToast(e.message, 'error'); }
}

async function removerCategoria(id, btn) {
  if (!await appConfirm('Remover esta categoria? Produtos vinculados precisam ser movidos antes.', { title: 'Remover categoria', danger: true })) return;
  btn.disabled = true;
  try {
    await apiCall('DELETE', `/api/admin/categories/${id}`);
    showToast('Categoria removida', 'success');
    carregarCardapio();
  } catch (e) { showToast(e.message, 'error'); btn.disabled = false; }
}

function abrirModalProdutoById(id) { abrirModalProduto(produtosMap[id]); }

function abrirModalProduto(p = null) {
  document.getElementById('prod-id').value    = p?.id || '';
  document.getElementById('prod-nome').value  = p?.nome || '';
  document.getElementById('prod-desc').value  = p?.descricao || '';
  document.getElementById('prod-preco').value = p?.preco || '';
  document.getElementById('prod-custo').value = p?.custo || 0;
  document.getElementById('prod-foto').value  = p?.foto_url || '';
  const file = document.getElementById('prod-foto-file');
  if (file) file.value = '';
  atualizarPreviewProduto();
  document.getElementById('prod-disp').checked = p ? p.disponivel : true;
  document.getElementById('prod-dest').checked = p?.destaque || false;
  document.getElementById('prod-cat').innerHTML =
    categoriasLista.map(c => `<option value="${escapeAttr(c.id)}" ${p?.categoria_id===c.id?'selected':''}>${escapeHtml(c.icone||'')} ${escapeHtml(c.nome)}</option>`).join('');
  document.getElementById('modal-produto').classList.add('show');
}

function carregarImagemProduto(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (!['image/png','image/jpeg','image/webp'].includes(file.type)) {
    input.value = '';
    return showToast('Use PNG, JPG ou WebP', 'error');
  }
  if (file.size > 700 * 1024) {
    input.value = '';
    return showToast('Imagem muito grande. Use até 700 KB.', 'error');
  }
  const reader = new FileReader();
  reader.onload = () => {
    document.getElementById('prod-foto').value = reader.result;
    atualizarPreviewProduto();
  };
  reader.readAsDataURL(file);
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
        <div class="stat-card"><div class="stat-label">Avaliação média</div><div class="stat-val">${d.feedback_media ? d.feedback_media + ' ★' : '—'}</div></div>
      </div>
      <div class="finance-grid">
        <div style="background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:20px;margin-top:16px;">
          <div style="font-family:var(--mono);font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:16px;">Por forma de pagamento</div>
          ${Object.entries(d.por_pagamento||{}).map(([k,v]) =>
            `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
              <span>${labelPagamento(k)}</span>
              <span style="font-family:var(--mono);font-weight:600">R$ ${fmt(v)}</span>
            </div>`).join('') || '<div class="tabela-empty">Sem pagamentos no período</div>'}
        </div>
        <div style="background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:20px;margin-top:16px;">
          <div style="font-family:var(--mono);font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:16px;">Produtos mais vendidos</div>
          ${(d.top_produtos||[]).map(p =>
            `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
              <span>${escapeHtml(p.nome)}</span>
              <span style="font-family:var(--mono);font-weight:600">${p.quantidade} un · R$ ${fmt(p.total)}</span>
            </div>`).join('') || '<div class="tabela-empty">Sem vendas no período</div>'}
        </div>
      </div>`;
  } catch (e) {
    document.getElementById('financeiro-content').innerHTML = '<div class="tabela-empty">Erro: ' + e.message + '</div>';
  }
}

/* ── FISCAL ────────────────────────────────────────── */
async function carregarFiscal() {
  const el = document.getElementById('fiscal-content');
  el.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const data = await apiCall('GET', '/api/admin/fiscal');
    const c = data.config || {};
    const docs = (data.documents || []).slice().reverse();
    el.innerHTML = `
      <div class="config-grid">
        <div class="config-card">
          <div class="config-title">Configuração fiscal</div>
          <label class="toggle-row"><input type="checkbox" id="fiscal-enabled" ${c.enabled ? 'checked' : ''}> Controlar nota fiscal no sistema</label>
          <label class="toggle-row"><input type="checkbox" id="fiscal-auto" ${c.auto_after_close ? 'checked' : ''}> Criar pendência fiscal ao fechar conta</label>
          <div class="form-row-2">
            <div class="form-row" style="margin:0"><label class="form-label">Tipo</label>
              <select class="form-input" id="fiscal-doc-type">
                ${optionFiscal('nfce','NFC-e consumidor',c.document_type)}
                ${optionFiscal('nfe','NF-e',c.document_type)}
                ${optionFiscal('nfse','NFS-e serviço',c.document_type)}
              </select>
            </div>
            <div class="form-row" style="margin:0"><label class="form-label">Ambiente</label>
              <select class="form-input" id="fiscal-env">
                ${optionFiscal('homologacao','Homologação',c.environment)}
                ${optionFiscal('producao','Produção',c.environment)}
              </select>
            </div>
          </div>
          <div class="form-row-2">
            <div class="form-row" style="margin:0"><label class="form-label">Modo</label>
              <select class="form-input" id="fiscal-mode">
                ${optionFiscal('manual','Manual por enquanto',c.mode)}
                ${optionFiscal('api','API fiscal futura',c.mode)}
              </select>
            </div>
            <div class="form-row" style="margin:0"><label class="form-label">Provedor</label><input class="form-input" id="fiscal-provider" value="${escapeAttr(c.provider || '')}" placeholder="Ex: NFE.io, Focus, PlugNotas"></div>
          </div>
          <div class="form-row"><label class="form-label">CNPJ</label><input class="form-input" id="fiscal-cnpj" value="${escapeAttr(c.cnpj || '')}"></div>
          <div class="form-row-2">
            <div class="form-row" style="margin:0"><label class="form-label">Inscrição estadual</label><input class="form-input" id="fiscal-ie" value="${escapeAttr(c.state_registration || '')}"></div>
            <div class="form-row" style="margin:0"><label class="form-label">Inscrição municipal</label><input class="form-input" id="fiscal-im" value="${escapeAttr(c.municipal_registration || '')}"></div>
          </div>
          <div class="form-row-2">
            <div class="form-row" style="margin:0"><label class="form-label">Regime</label><input class="form-input" id="fiscal-regime" value="${escapeAttr(c.tax_regime || '')}"></div>
            <div class="form-row" style="margin:0"><label class="form-label">Série</label><input class="form-input" id="fiscal-series" value="${escapeAttr(c.series || '1')}"></div>
          </div>
          <div class="form-row"><label class="form-label">Notas internas</label><textarea class="form-input" id="fiscal-notes" rows="3">${escapeHtml(c.notes || '')}</textarea></div>
          <button class="btn btn-primary btn-sm" onclick="salvarFiscal()">Salvar fiscal</button>
        </div>
        <div class="config-card">
          <div class="config-title">Registro manual de nota</div>
          <div class="form-row-2">
            <div class="form-row" style="margin:0"><label class="form-label">Status</label>
              <select class="form-input" id="fiscal-doc-status">
                <option value="emitida">Emitida</option>
                <option value="pendente">Pendente</option>
                <option value="rejeitada">Rejeitada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
            <div class="form-row" style="margin:0"><label class="form-label">Total</label><input class="form-input" id="fiscal-doc-total" type="number" step="0.01"></div>
          </div>
          <div class="form-row-2">
            <div class="form-row" style="margin:0"><label class="form-label">Número</label><input class="form-input" id="fiscal-doc-number"></div>
            <div class="form-row" style="margin:0"><label class="form-label">Série</label><input class="form-input" id="fiscal-doc-series"></div>
          </div>
          <div class="form-row"><label class="form-label">Chave de acesso</label><input class="form-input" id="fiscal-doc-key"></div>
          <div class="form-row"><label class="form-label">Link XML</label><input class="form-input" id="fiscal-doc-xml"></div>
          <div class="form-row"><label class="form-label">Link DANFE/PDF</label><input class="form-input" id="fiscal-doc-danfe"></div>
          <button class="btn btn-primary btn-sm" onclick="registrarDocumentoFiscal()">Registrar documento</button>
        </div>
      </div>
      <div class="tabela-wrap" style="margin-top:16px">
        <table class="tabela">
          <thead><tr><th>Data</th><th>Tipo</th><th>Status</th><th>Total</th><th>Número</th><th>Origem</th></tr></thead>
          <tbody>${docs.length ? docs.map(d => `
            <tr>
              <td class="mono" style="font-size:11px">${escapeHtml(fmtDate(d.created_at))}</td>
              <td>${escapeHtml((d.document_type || '').toUpperCase())}</td>
              <td>${escapeHtml(d.status || '-')}</td>
              <td>R$ ${fmt(d.total || 0)}</td>
              <td>${escapeHtml(d.numero || d.chave_acesso || '-')}</td>
              <td>${escapeHtml(d.origem || '-')}</td>
            </tr>`).join('') : '<tr><td colspan="6" class="tabela-empty">Nenhum documento fiscal registrado.</td></tr>'}</tbody>
        </table>
      </div>`;
  } catch (e) {
    el.innerHTML = `<div class="tabela-empty">Erro fiscal: ${escapeHtml(e.message)}</div>`;
  }
}

function optionFiscal(value, label, current) {
  return `<option value="${value}" ${String(current || '') === value ? 'selected' : ''}>${label}</option>`;
}

async function salvarFiscal() {
  try {
    await apiCall('PUT', '/api/admin/fiscal', {
      enabled: document.getElementById('fiscal-enabled').checked,
      auto_after_close: document.getElementById('fiscal-auto').checked,
      document_type: document.getElementById('fiscal-doc-type').value,
      environment: document.getElementById('fiscal-env').value,
      mode: document.getElementById('fiscal-mode').value,
      provider: document.getElementById('fiscal-provider').value.trim(),
      cnpj: document.getElementById('fiscal-cnpj').value.trim(),
      state_registration: document.getElementById('fiscal-ie').value.trim(),
      municipal_registration: document.getElementById('fiscal-im').value.trim(),
      tax_regime: document.getElementById('fiscal-regime').value.trim(),
      series: document.getElementById('fiscal-series').value.trim(),
      notes: document.getElementById('fiscal-notes').value.trim(),
    });
    showToast('Fiscal salvo', 'success');
    carregarFiscal();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function registrarDocumentoFiscal() {
  try {
    await apiCall('POST', '/api/admin/fiscal/documents', {
      status: document.getElementById('fiscal-doc-status').value,
      total: Number(document.getElementById('fiscal-doc-total').value || 0),
      chave_acesso: document.getElementById('fiscal-doc-key').value.trim() || null,
      numero: document.getElementById('fiscal-doc-number').value.trim() || null,
      serie: document.getElementById('fiscal-doc-series').value.trim() || null,
      xml_url: document.getElementById('fiscal-doc-xml').value.trim() || null,
      danfe_url: document.getElementById('fiscal-doc-danfe').value.trim() || null,
    });
    showToast('Documento fiscal registrado', 'success');
    carregarFiscal();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

/* ── USUÁRIOS ─────────────────────────────────────── */
async function carregarUsuarios() {
  document.getElementById('usuarios-lista').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const { usuarios } = await apiCall('GET', '/api/admin/users');
    const atual = getUsuario();
    const usuariosAtivos = (usuarios || []).filter(m => m?.is_active !== false && m?.usuarios?.ativo !== false && m?.usuarios?.id);
    document.getElementById('usuarios-lista').innerHTML = !usuariosAtivos.length
      ? '<div class="tabela-empty">Nenhum usuário</div>'
      : usuariosAtivos.map(m => {
          const u = m.usuarios || {};
          const podeRemover = temRole('owner') && u.id !== atual?.id;
          const acesso = linkAcessoPerfil(m.role);
          return `<div class="usuario-row">
            <div class="usuario-avatar">
              ${escapeHtml((u.nome||'?').slice(0,2).toUpperCase())}
            </div>
            <div class="usuario-info">
              <div class="usuario-nome">${escapeHtml(u.nome||'—')}</div>
              <div class="usuario-email">${escapeHtml(u.login || u.email || '—')}</div>
            </div>
            <span class="role-badge">${escapeHtml(m.role)}</span>
            ${acesso ? `<a class="btn btn-sm" href="${escapeAttr(acesso.href)}" target="_blank" rel="noopener">${escapeHtml(acesso.label)}</a>` : ''}
            ${temRole('owner') ? `<button class="btn btn-sm" onclick="redefinirSenhaUsuario('${escapeAttr(u.id)}')">Senha</button>` : ''}
            ${podeRemover ? `<button class="btn btn-sm btn-danger" onclick="removerUsuario('${escapeAttr(u.id)}',this)">Remover</button>` : ''}
          </div>`;
        }).join('');
  } catch (e) {
    document.getElementById('usuarios-lista').innerHTML = '<div class="tabela-empty">Erro.</div>';
  }
}

function linkAcessoPerfil(role) {
  const slug = getCurrentRestaurantSlug();
  const links = {
    cashier: { label: 'Abrir caixa', href: `/r/${slug}/caixa` },
    kitchen: { label: 'Abrir cozinha', href: `/r/${slug}/cozinha` },
    waiter: { label: 'Abrir garçom', href: `/r/${slug}/garcom` },
  };
  return links[role] || null;
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
  if (senha.length < 6) return showToast('Senha precisa ter no mínimo 6 caracteres', 'error');
  try {
    await apiCall('POST', '/api/admin/users', { nome, username: email, email, senha, role });
    showToast('Usuário criado', 'success');
    fecharModal('modal-usuario');
    carregarUsuarios();
  } catch (e) { showToast(e.message, 'error'); }
}

async function redefinirSenhaUsuario(usuarioId) {
  const senha = await appPrompt('Nova senha para este usuário.', '', { title: 'Redefinir senha', type: 'password', confirmText: 'Atualizar senha' });
  if (senha === null) return;
  if (senha.length < 6) return showToast('Senha precisa ter no mínimo 6 caracteres', 'error');
  try {
    await apiCall('PATCH', `/api/admin/users/${usuarioId}/password`, { senha });
    showToast('Senha atualizada', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

async function removerUsuario(usuarioId, btn) {
  if (!await appConfirm('Remover este usuário deste restaurante?', { title: 'Remover usuário', danger: true })) return;
  btn.disabled = true;
  btn.textContent = 'Removendo...';
  try {
    await apiCall('DELETE', `/api/admin/users/${usuarioId}`);
    showToast('Usuário removido', 'success');
    carregarUsuarios();
  } catch (e) {
    showToast(e.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Remover';
  }
}

/* ── CONFIGURAÇÕES ────────────────────────────────── */
async function carregarConfiguracoes() {
  document.getElementById('config-content').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const { restaurant } = await apiCall('GET', '/api/admin/restaurant');
    const rawSettings = restaurant.restaurant_settings;
    const s = Array.isArray(rawSettings) ? (rawSettings[0] || {}) : (rawSettings || {});
    document.getElementById('config-content').innerHTML = `
      <div class="config-grid">
        <div class="config-card">
          <div class="config-title">Identidade visual</div>
          <div class="form-row"><label class="form-label">Nome do restaurante</label>
            <input class="form-input" id="cfg-nome" value="${escapeAttr(restaurant.name || '')}"></div>
          <div class="form-row"><label class="form-label">Logo (URL)</label>
            <input class="form-input" id="cfg-logo" value="${escapeAttr(restaurant.logo_url||'')}" placeholder="https://..."></div>
          <div class="form-row"><label class="form-label">Enviar logo</label>
            <input class="form-input" id="cfg-logo-file" type="file" accept="image/png,image/jpeg,image/webp" onchange="carregarLogoRestaurante(this)"></div>
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
            <label class="form-label" style="min-width:140px">Cor secundária</label>
            <input type="color" class="color-swatch" id="cfg-secondary" value="${restaurant.secondary_color||'#1a1a1a'}"
                   oninput="document.documentElement.style.setProperty('--color-secondary',this.value)">
            <input class="form-input" id="cfg-secondary-txt" value="${restaurant.secondary_color||'#1a1a1a'}" style="width:110px">
          </div>
          <div class="color-picker-row">
            <label class="form-label" style="min-width:140px">Cor de fundo</label>
            <input type="color" class="color-swatch" id="cfg-bg" value="${restaurant.background_color||'#0a0a0a'}"
                   oninput="document.documentElement.style.setProperty('--color-bg',this.value)">
            <input class="form-input" id="cfg-bg-txt" value="${restaurant.background_color||'#0a0a0a'}" style="width:110px">
          </div>
          <div class="color-picker-row">
            <label class="form-label" style="min-width:140px">Cor do texto</label>
            <input type="color" class="color-swatch" id="cfg-text" value="${restaurant.text_color||'#f2f0eb'}"
                   oninput="document.documentElement.style.setProperty('--color-text',this.value)">
            <input class="form-input" id="cfg-text-txt" value="${restaurant.text_color||'#f2f0eb'}" style="width:110px">
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
            <input class="form-input" id="cfg-pix-key" value="${escapeAttr(s.pix_key||'')}" placeholder="CPF, CNPJ, e-mail ou chave aleatória">
          </div>
          <button class="btn btn-primary btn-sm" onclick="salvarSettings()">Salvar configurações</button>
        </div>
        <div class="config-card">
          <div class="config-title">Experiência da mesa</div>
          <label class="toggle-row"><input type="checkbox" id="cfg-notes" ${s.allow_customer_notes!==false?'checked':''}> Cliente pode enviar observações</label>
          <label class="toggle-row"><input type="checkbox" id="cfg-waiter" ${s.allow_waiter_call?'checked':''}> Permitir chamar garçom</label>
          <label class="toggle-row"><input type="checkbox" id="cfg-close-request" ${s.allow_table_close_request?'checked':''}> Permitir solicitar fechamento da conta</label>
          <label class="toggle-row"><input type="checkbox" id="cfg-waiter-delivery" ${s.allow_waiter_delivery?'checked':''}> Permitir garçom marcar pedido como entregue</label>
          <label class="toggle-row"><input type="checkbox" id="cfg-waiter-payment" ${s.allow_waiter_payment?'checked':''}> Permitir garçom fechar pagamento na mesa</label>
          <button class="btn btn-primary btn-sm" onclick="salvarSettings()">Salvar experiência</button>
        </div>
        <div class="config-card">
          <div class="config-title">Contato e funcionamento</div>
          <div class="form-row"><label class="form-label">WhatsApp</label>
            <input class="form-input" id="cfg-whatsapp" value="${escapeAttr(s.whatsapp||'')}" placeholder="(11) 99999-9999"></div>
          <div class="form-row"><label class="form-label">Endereço</label>
            <input class="form-input" id="cfg-address" value="${escapeAttr(s.address||'')}" placeholder="Rua, número, bairro"></div>
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
    document.getElementById('cfg-secondary').addEventListener('input', e => {
      document.getElementById('cfg-secondary-txt').value = e.target.value;
    });
    document.getElementById('cfg-text').addEventListener('input', e => {
      document.getElementById('cfg-text-txt').value = e.target.value;
    });
  } catch (e) {
    document.getElementById('config-content').innerHTML = '<div class="tabela-empty">Erro ao carregar.</div>';
  }
}

function carregarLogoRestaurante(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (!['image/png','image/jpeg','image/webp'].includes(file.type)) {
    input.value = '';
    return showToast('Use PNG, JPG ou WebP', 'error');
  }
  if (file.size > 700 * 1024) {
    input.value = '';
    return showToast('Logo muito grande. Use até 700 KB.', 'error');
  }
  const reader = new FileReader();
  reader.onload = () => { document.getElementById('cfg-logo').value = reader.result; };
  reader.readAsDataURL(file);
}

async function salvarConfiguracoes() {
  try {
    await apiCall('PUT', '/api/admin/restaurant', {
      name:             document.getElementById('cfg-nome').value.trim(),
      logo_url:         document.getElementById('cfg-logo').value.trim() || null,
      primary_color:    document.getElementById('cfg-primary-txt').value,
      secondary_color:  document.getElementById('cfg-secondary-txt').value,
      accent_color:     document.getElementById('cfg-accent-txt').value,
      background_color: document.getElementById('cfg-bg-txt').value,
      text_color:       document.getElementById('cfg-text-txt').value,
    });
    showToast('Visual atualizado', 'success');
    applyRestaurantTheme({ ...window.__RESTAURANT__,
      primary_color: document.getElementById('cfg-primary-txt').value,
      secondary_color: document.getElementById('cfg-secondary-txt').value,
      accent_color: document.getElementById('cfg-accent-txt').value,
      background_color: document.getElementById('cfg-bg-txt').value,
      text_color: document.getElementById('cfg-text-txt').value,
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
      allow_waiter_delivery: document.getElementById('cfg-waiter-delivery').checked,
      allow_waiter_payment: document.getElementById('cfg-waiter-payment').checked,
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

async function solicitarSuporte() {
  const mensagem = document.getElementById('support-message')?.value.trim();
  if (!mensagem) return showToast('Descreva o suporte solicitado', 'error');
  try {
    const resp = await apiCall('POST', '/api/admin/support-request', {
      categoria: document.getElementById('support-category')?.value || 'suporte',
      prioridade: document.getElementById('support-priority').value,
      assunto: document.getElementById('support-subject')?.value.trim() || '',
      mensagem,
    });
    document.getElementById('support-message').value = '';
    const subject = document.getElementById('support-subject');
    if (subject) subject.value = '';
    showToast(`Chamado ${resp.ticket?.ticket_number || ''} enviado`, 'success');
    carregarSuporteCliente();
    carregarContadorSuporteAdmin(false);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function carregarSuporteCliente() {
  const el = document.getElementById('suporte-content');
  if (!el) return;
  el.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const { tickets } = await apiCall('GET', '/api/admin/support');
    const lista = tickets || [];
    const whatsappUrl = supportWhatsAppUrl();
    atualizarBadgeSuporteAdmin(lista);
    el.innerHTML = `
      <div class="support-workspace">
        <div class="support-open-panel">
          <div class="config-title">Abrir chamado</div>
          <div class="support-contact-box">
            <div>
              <b>Atendimento pelo WhatsApp</b>
              <span>Abra o chamado aqui e continue a conversa pelo WhatsApp de suporte.</span>
            </div>
            ${whatsappUrl
              ? `<a class="btn btn-sm btn-success" href="${escapeAttr(whatsappUrl)}" target="_blank" rel="noopener">WhatsApp</a>`
              : '<span class="support-contact-muted">WhatsApp não configurado</span>'}
          </div>
          <div class="form-row"><label class="form-label">Categoria</label>
            <select class="form-input" id="support-category">
              <option value="suporte">Suporte geral</option>
              <option value="operacao">Operação</option>
              <option value="acesso">Acesso e usuários</option>
              <option value="financeiro">Financeiro</option>
              <option value="bug">Erro no sistema</option>
              <option value="melhoria">Melhoria</option>
            </select>
          </div>
          <div class="form-row"><label class="form-label">Prioridade</label>
            <select class="form-input" id="support-priority">
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
          <div class="form-row"><label class="form-label">Assunto</label>
            <input class="form-input" id="support-subject" maxlength="140" placeholder="Ex: cozinha não atualiza">
          </div>
          <div class="form-row"><label class="form-label">Descreva o problema</label>
            <textarea class="form-input" id="support-message" rows="5" placeholder="Inclua o que aconteceu, onde aconteceu e desde quando."></textarea>
          </div>
          <button class="btn btn-primary btn-sm" onclick="solicitarSuporte()">Enviar chamado</button>
        </div>
        <div class="support-list-panel">
          <div class="support-summary">
            ${supportMetric('Abertos', lista.filter(t => t.status !== 'resolvido').length)}
            ${supportMetric('Em andamento', lista.filter(t => t.status === 'em_andamento').length)}
            ${supportMetric('Resolvidos', lista.filter(t => t.status === 'resolvido').length)}
          </div>
          <div class="support-history">
            ${lista.length ? lista.map(renderSupportCliente).join('') : '<div class="tabela-empty">Nenhum chamado aberto ainda.</div>'}
          </div>
        </div>
      </div>`;
  } catch (e) {
    el.innerHTML = `<div class="tabela-empty">Histórico indisponível: ${escapeHtml(e.message)}</div>`;
  }
}

function supportWhatsAppUrl() {
  const raw = window.SAAS_CONFIG?.SUPPORT_WHATSAPP_URL || '';
  return safeUrl(raw, '');
}

async function carregarContadorSuporteAdmin(showErrors = false) {
  try {
    const { tickets } = await apiCall('GET', '/api/admin/support');
    atualizarBadgeSuporteAdmin(tickets || []);
  } catch (e) {
    if (showErrors) showToast(e.message, 'error');
  }
}

function atualizarBadgeSuporteAdmin(tickets) {
  const total = (tickets || []).filter(t => t.status !== 'resolvido').length;
  ['support-open-count', 'support-nav-count'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = total;
    el.style.display = total ? 'inline-flex' : 'none';
  });
}

function supportMetric(label, value) {
  return `<div class="support-metric"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`;
}

function renderSupportCliente(t) {
  const action = suporteAcaoCliente(t.status);
  return `
    <div class="support-ticket ${escapeAttr(t.status || 'aberto')}">
      <div class="support-ticket-head">
        <strong>${escapeHtml(t.ticket_number || 'Chamado')}</strong>
        <span>${escapeHtml(statusSuporteLabel(t.status))}</span>
      </div>
      <div class="support-ticket-sub">${escapeHtml(t.subject || t.message || 'Sem assunto')}</div>
      <div class="support-ticket-meta">${escapeHtml(prioridadeSuporteLabel(t.priority))} · ${escapeHtml(categoriaSuporteLabel(t.category))} · ${fmtDate(t.created_at)}</div>
      <div class="support-next-step ${escapeAttr(t.status || 'aberto')}">${escapeHtml(action)}</div>
      ${t.last_response ? `<div class="support-response">${escapeHtml(t.last_response)}</div>` : ''}
    </div>`;
}

function statusSuporteLabel(status) {
  return ({ aberto: 'Aberto', em_andamento: 'Em andamento', liberado_teste: 'Liberado para teste', aguardando_cliente: 'Aguardando cliente', resolvido: 'Resolvido' })[status] || 'Aberto';
}

function suporteAcaoCliente(status) {
  return ({
    aberto: 'Recebemos sua solicitação. A conversa pode continuar pelo WhatsApp.',
    em_andamento: 'Estamos trabalhando nesse chamado. Aguarde nosso retorno pelo WhatsApp.',
    liberado_teste: 'Pode testar agora. Depois confirme pelo WhatsApp se ficou correto.',
    aguardando_cliente: 'Estamos aguardando sua confirmação ou mais informações pelo WhatsApp.',
    resolvido: 'Chamado finalizado. Se o problema voltar, abra um novo chamado.',
  })[status] || 'Recebemos sua solicitação.';
}

function prioridadeSuporteLabel(priority) {
  return ({ normal: 'Normal', alta: 'Alta', urgente: 'Urgente' })[priority] || 'Normal';
}

function categoriaSuporteLabel(category) {
  return ({ suporte: 'Suporte', financeiro: 'Financeiro', operacao: 'Operação', acesso: 'Acesso', bug: 'Erro', melhoria: 'Melhoria' })[category] || 'Suporte';
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
            <div class="audit-user">${escapeHtml(l.usuario_nome || '—')}</div>
            <div class="audit-perfil"><span class="role-badge">${escapeHtml(l.perfil || '—')}</span></div>
            <div class="audit-acao"><strong>${escapeHtml(LABELS[l.acao] || l.acao)}</strong>${l.tabela ? ` · ${escapeHtml(l.tabela)}` : ''}</div>
          </div>`).join('');
  } catch (e) {
    document.getElementById('auditoria-lista').innerHTML = '<div class="tabela-empty">Erro: ' + escapeHtml(e.message) + '</div>';
  }
}

/* ── UTILITÁRIOS ──────────────────────────────────── */
function fmt(n)       { return Number(n).toFixed(2).replace('.',','); }
function fmtDate(value) { return value ? new Date(value).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' }) : '-'; }
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

