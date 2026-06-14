let RESTAURANT = null;
let mesaSelecionada = null;
let sessaoSelecionada = null;
let pgtoSelecionado = null;
let pagamentos = [];
let totalContaAtual = 0;
let polling = null;
let caixas = [];
let turnosAbertos = [];
let turnoAtivo = null;
let caixaSelecionadoId = null;
let historicoTurnos = [];
let cashFormMode = null;
let modoCaixa = 'mesas';
let balcaoProdutos = [];
let balcaoCarrinho = [];
let balcaoPagamentos = [];
let totalBalcaoAtual = 0;
let formasPagamento = [
  { code: 'dinheiro', name: 'Dinheiro', type: 'cash', allow_change: true, is_active: true },
  { code: 'pix', name: 'Pix', type: 'pix', is_active: true },
  { code: 'cartao_credito', name: 'Cartão crédito', type: 'credit_card', is_active: true },
  { code: 'cartao_debito', name: 'Cartão débito', type: 'debit_card', is_active: true },
];

async function init() {
  RESTAURANT = await initTenant();
  if (!RESTAURANT) return;
  setupRememberedLogin('caixa');
  if (isLoggedIn() && sessaoDoRestaurante(RESTAURANT)) iniciarApp();
  else if (isLoggedIn()) logout();
}

async function fazerLogin() {
  const email = document.getElementById('l-email').value.trim();
  const senha = document.getElementById('l-senha').value.trim();
  const erro  = document.getElementById('login-erro');
  erro.classList.remove('show');
  try {
    const remember = document.getElementById('l-remember')?.checked === true;
    await login(email, senha, getCurrentRestaurantSlug(), { remember });
    persistRememberedLogin('caixa', email, remember);
    iniciarApp();
  } catch(e) {
    erro.textContent = e.message;
    erro.classList.add('show');
  }
}

function fazerLogout() {
  logout();
  clearTimeout(polling);
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

function iniciarApp() {
  try {
    exigirSessaoRestaurante(RESTAURANT);
    exigirPerfil(['cashier'], 'Use um login de caixa para fechar contas');
  } catch (e) {
    document.getElementById('login-erro').textContent = e.message;
    document.getElementById('login-erro').classList.add('show');
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display = 'none';
    return;
  }
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'flex';
  configurarModosCaixa();
  carregarFormasPagamento();
  carregarCaixas();
  carregarMesas();
  function agendar() { polling = setTimeout(() => { carregarCaixas(false); if (modoCaixa === 'mesas') carregarMesas(); agendar(); }, 10000); }
  agendar();
}

async function carregarFormasPagamento() {
  try {
    const data = await apiCall('GET', '/api/admin/payment-methods?active_only=true');
    const methods = (data.methods || []).filter(m => m.is_active !== false);
    if (methods.length) formasPagamento = methods;
    if (data.fallback) showToast('Usando formas de pagamento padrão. Aplique o schema para personalizar.', 'error');
  } catch (e) {
    showToast('Formas de pagamento em modo padrão', 'error');
  }
  const select = document.getElementById('split-forma');
  if (select) {
    select.innerHTML = formasPagamentoOptions();
    renderReferenciaPagamento();
  }
}

function balcaoRapidoAtivo() {
  const modules = RESTAURANT?.modules || RESTAURANT?.modules_config || {};
  return modules.balcao_rapido === true;
}

function configurarModosCaixa() {
  const btn = document.getElementById('mode-balcao');
  if (btn) btn.hidden = !balcaoRapidoAtivo();
}

function setModoCaixa(modo) {
  if (modo === 'balcao' && !balcaoRapidoAtivo()) {
    showToast('Venda de balcão rápido não está ativa neste restaurante', 'error');
    return;
  }
  modoCaixa = modo;
  document.getElementById('mode-mesas')?.classList.toggle('active', modo === 'mesas');
  document.getElementById('mode-balcao')?.classList.toggle('active', modo === 'balcao');
  if (modo === 'balcao') {
    mesaSelecionada = null;
    sessaoSelecionada = null;
    carregarProdutosBalcao();
    renderBalcaoConta();
  } else {
    balcaoCarrinho = [];
    balcaoPagamentos = [];
    carregarMesas();
    resetContaMesa();
  }
}

async function carregarCaixas(showErrors = true) {
  const panel = document.getElementById('cash-shift-panel');
  try {
    const data = await apiCall('GET', `/api/admin/cash-registers?date=${encodeURIComponent(todayInputValue())}`);
    caixas = data.registers || [];
    turnosAbertos = data.open_shifts || [];
    historicoTurnos = data.history || [];
    if (!caixaSelecionadoId && caixas.length) caixaSelecionadoId = caixas[0].id;
    turnoAtivo = turnosAbertos.find(t => t.opened_by === getUsuario()?.id) || null;
    if (turnoAtivo) caixaSelecionadoId = turnoAtivo.register_id;
    renderCaixaOperacao(data.limits || {});
  } catch (e) {
    if (showErrors) panel.innerHTML = `<div class="cash-alert error">Erro ao carregar caixa: ${escapeHtml(e.message)}</div>`;
  }
}

function renderCaixaOperacao(limits = {}) {
  const panel = document.getElementById('cash-shift-panel');
  const formSnapshot = snapshotCashForm();
  const selected = caixas.find(c => c.id === caixaSelecionadoId) || caixas[0];
  const abertoNesteCaixa = selected ? turnosAbertos.find(t => t.register_id === selected.id) : null;
  const resumo = turnoAtivo
    ? `<div class="cash-summary">
        <div><span>Turno</span><strong>${escapeHtml(turnoAtivo.register_name)}</strong></div>
        <div><span>Abertura</span><strong>R$ ${fmt(turnoAtivo.opening_amount || 0)}</strong></div>
        <div><span>Vendas</span><strong>R$ ${fmt(turnoAtivo.sales_total || 0)}</strong></div>
        <div><span>Dinheiro esperado</span><strong>R$ ${fmt((Number(turnoAtivo.opening_amount || 0) + Number(turnoAtivo.payments_by_method?.dinheiro || 0)))}</strong></div>
      </div>`
    : `<div class="cash-alert">Abra um turno para registrar fechamentos neste caixa.</div>`;

  panel.innerHTML = `
    <div class="cash-head">
      <div>
        <div class="cash-title">Controle do caixa</div>
        <div class="cash-sub">${escapeHtml(caixas.length || 0)}/${escapeHtml(limits.registers || '-')} caixa(s) configurado(s)</div>
      </div>
      <button class="btn btn-sm" onclick="imprimirTurnoAtual()" ${turnoAtivo ? '' : 'disabled'}>Imprimir</button>
    </div>
    <div class="cash-row">
      <select class="form-input cash-select" id="cash-register-select" onchange="selecionarCaixa(this.value)" ${turnoAtivo ? 'disabled' : ''}>
        ${caixas.map(c => `<option value="${escapeAttr(c.id)}" ${selected?.id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
      </select>
      ${turnoAtivo
        ? '<button class="btn btn-success btn-sm" onclick="mostrarFechamentoTurno()">Fechar turno</button>'
        : `<button class="btn btn-primary btn-sm" onclick="mostrarAberturaTurno()" ${abertoNesteCaixa ? 'disabled' : ''}>Abrir turno</button>`}
    </div>
    ${abertoNesteCaixa && !turnoAtivo ? `<div class="cash-alert error">Este caixa já foi aberto por ${escapeHtml(abertoNesteCaixa.opened_by_name || 'outro usuário')}.</div>` : ''}
    ${resumo}
    <div id="cash-form-area"></div>
    ${renderTurnosHoje()}`;
  restoreCashForm(formSnapshot);
}

function selecionarCaixa(id) {
  caixaSelecionadoId = id;
  turnoAtivo = null;
  cashFormMode = null;
  renderCaixaOperacao({ registers: caixas.length });
}

function snapshotCashForm() {
  if (!cashFormMode) return null;
  const values = {};
  document.querySelectorAll('#cash-form-area input, #cash-form-area textarea').forEach(el => {
    if (el.id) values[el.id] = el.value;
  });
  return { mode: cashFormMode, values };
}

function restoreCashForm(snapshot) {
  if (!snapshot?.mode) return;
  if (snapshot.mode === 'open' && turnoAtivo) {
    cashFormMode = null;
    return;
  }
  if (snapshot.mode === 'close' && !turnoAtivo) {
    cashFormMode = null;
    return;
  }
  if (snapshot.mode === 'open') renderAberturaTurnoForm();
  if (snapshot.mode === 'close') renderFechamentoTurnoForm();
  Object.entries(snapshot.values || {}).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });
}

function todayInputValue() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function renderTurnosHoje() {
  const rows = (historicoTurnos || []).slice(0, 12).map(t => {
    const esperado = t.expected_cash_amount ?? (Number(t.opening_amount || 0) + Number(t.payments_by_method?.dinheiro || 0));
    return `<tr>
      <td>${escapeHtml(t.register_name || '-')}</td>
      <td>${escapeHtml(t.opened_by_name || '-')}</td>
      <td>${escapeHtml(fmtDate(t.opened_at))}</td>
      <td>${escapeHtml(t.closed_by_name || (t.status === 'open' ? '-' : 'Não informado'))}</td>
      <td>${escapeHtml(fmtDate(t.closed_at))}</td>
      <td>R$ ${fmt(t.sales_total || 0)}</td>
      <td>R$ ${fmt(esperado)}</td>
      <td>${t.status === 'closed' ? `R$ ${fmt(t.closing_amount || 0)}` : '-'}</td>
      <td>${escapeHtml(statusTurno(t.status))}</td>
    </tr>`;
  }).join('');
  return `
    <div class="cash-history-box">
      <div class="cash-history-head">
        <div>
          <div class="cash-form-title">Aberturas e fechamentos de hoje</div>
          <div class="cash-sub">${escapeHtml(todayInputValue())}</div>
        </div>
        <button class="btn btn-sm" onclick="carregarCaixas(false)">Atualizar</button>
      </div>
      <div class="cash-history-table-wrap">
        <table class="cash-history-table">
          <thead><tr><th>Caixa</th><th>Abriu</th><th>Abertura</th><th>Fechou</th><th>Fechamento</th><th>Vendas</th><th>Esperado</th><th>Contado</th><th>Status</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="9">Nenhum turno registrado hoje.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

function denomInputs(prefix) {
  return ['200','100','50','20','10','5','2','1','0.50','0.25','0.10','0.05'].map(v => `
    <label class="denom-field"><span>R$ ${v.replace('.', ',')}</span><input id="${prefix}-${v}" type="number" min="0" step="1" value="0"></label>
  `).join('');
}

function lerDenominacoes(prefix) {
  const out = {};
  ['200','100','50','20','10','5','2','1','0.50','0.25','0.10','0.05'].forEach(v => {
    out[v] = Number(document.getElementById(`${prefix}-${v}`)?.value || 0);
  });
  return out;
}

function mostrarAberturaTurno() {
  cashFormMode = 'open';
  renderAberturaTurnoForm();
}

function renderAberturaTurnoForm() {
  document.getElementById('cash-form-area').innerHTML = `
    <div class="cash-form">
      <div class="cash-form-title">Abertura do turno</div>
      <div class="denom-grid">${denomInputs('open-denom')}</div>
      <div class="cash-row">
        <input class="form-input" id="open-amount" type="number" step="0.01" placeholder="Valor inicial total">
        <button class="btn btn-primary btn-sm" onclick="abrirTurno()">Confirmar abertura</button>
      </div>
      <textarea class="form-input" id="open-notes" rows="2" placeholder="Observação opcional"></textarea>
    </div>`;
}

async function abrirTurno() {
  if (!caixaSelecionadoId) return showToast('Selecione um caixa', 'error');
  try {
    await apiCall('POST', `/api/admin/cash-registers/${caixaSelecionadoId}/open`, {
      opening_amount: Number(document.getElementById('open-amount').value || 0),
      denominations: lerDenominacoes('open-denom'),
      notes: document.getElementById('open-notes').value.trim(),
    });
    showToast('Turno aberto', 'success');
    cashFormMode = null;
    carregarCaixas();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function mostrarFechamentoTurno() {
  cashFormMode = 'close';
  renderFechamentoTurnoForm();
}

function renderFechamentoTurnoForm() {
  const esperado = Number(turnoAtivo?.opening_amount || 0) + Number(turnoAtivo?.payments_by_method?.dinheiro || 0);
  document.getElementById('cash-form-area').innerHTML = `
    <div class="cash-form">
      <div class="cash-form-title">Fechamento do turno</div>
      <div class="cash-alert">Dinheiro esperado: R$ ${fmt(esperado)}. Informe as notas/moedas contadas e o valor deixado para o próximo turno.</div>
      <div class="denom-grid">${denomInputs('close-denom')}</div>
      <div class="cash-row">
        <input class="form-input" id="left-next" type="number" step="0.01" placeholder="Deixado para próxima abertura">
        <button class="btn btn-success btn-sm" onclick="fecharTurno()">Confirmar fechamento</button>
      </div>
      <textarea class="form-input" id="close-notes" rows="2" placeholder="Ex: Maria deixou R$ 100 para João abrir amanhã"></textarea>
    </div>`;
}

async function fecharTurno() {
  if (!turnoAtivo) return;
  if (!await appConfirm('Fechar este turno de caixa?', { title: 'Fechar turno' })) return;
  try {
    await apiCall('POST', `/api/admin/cash-shifts/${turnoAtivo.id}/close`, {
      denominations: lerDenominacoes('close-denom'),
      left_for_next_shift: Number(document.getElementById('left-next').value || 0),
      notes: document.getElementById('close-notes').value.trim(),
    });
    showToast('Turno fechado', 'success');
    turnoAtivo = null;
    cashFormMode = null;
    carregarCaixas();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function imprimirTurnoAtual() {
  const t = turnoAtivo || historicoTurnos[0];
  if (!t) return showToast('Nenhum turno para imprimir', 'error');
  const linhas = [
    RESTAURANT?.name || 'Restaurante',
    t.register_name,
    `Aberto por: ${t.opened_by_name || '-'}`,
    `Abertura: ${fmtDate(t.opened_at)}`,
    `Valor inicial: R$ ${fmt(t.opening_amount || 0)}`,
    `Vendas: R$ ${fmt(t.sales_total || 0)}`,
    `Dinheiro: R$ ${fmt(t.payments_by_method?.dinheiro || 0)}`,
    `Pix: R$ ${fmt(t.payments_by_method?.pix || 0)}`,
    `Cartões/outros: R$ ${fmt(totalNaoDinheiro(t.payments_by_method || {}))}`,
    `Transações: ${t.transactions_count || 0}`,
  ];
  const w = window.open('', '_blank', 'width=420,height=640');
  w.document.write(`<pre style="font-family:monospace;white-space:pre-wrap;font-size:13px">${escapeHtml(linhas.join('\n'))}</pre>`);
  w.document.close();
  w.print();
}

function statusTurno(status) {
  return status === 'open' ? 'Aberto' : 'Fechado';
}

function totalNaoDinheiro(map) {
  return Object.entries(map).filter(([k]) => k !== 'dinheiro').reduce((a, [, v]) => a + Number(v || 0), 0);
}

async function carregarProdutosBalcao() {
  const grid = document.getElementById('mesas-grid');
  grid.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const data = await apiCall('GET', '/api/admin/quick-sale/products');
    balcaoProdutos = data.produtos || [];
    renderProdutosBalcao();
  } catch (e) {
    grid.innerHTML = `<div class="cash-alert error">Erro no balcão rápido: ${escapeHtml(e.message)}</div>`;
  }
}

function renderProdutosBalcao() {
  const grid = document.getElementById('mesas-grid');
  const termo = (document.getElementById('quick-search')?.value || '').trim().toLowerCase();
  const prods = balcaoProdutos.filter(p => `${p.nome || ''} ${p.categorias?.nome || ''}`.toLowerCase().includes(termo));
  grid.innerHTML = `
    <div class="quick-sale-toolbar" style="grid-column:1/-1">
      <input class="form-input" id="quick-search" placeholder="Buscar produto de balcão" value="${escapeAttr(document.getElementById('quick-search')?.value || '')}" oninput="renderProdutosBalcao()">
      <button class="btn btn-sm" onclick="carregarProdutosBalcao()">Atualizar</button>
    </div>
    ${prods.map(p => `
      <button class="quick-product-btn" onclick="adicionarProdutoBalcao('${escapeAttr(p.id)}')">
        <div class="quick-product-name">${escapeHtml(p.nome)}</div>
        <div class="quick-product-meta">${escapeHtml(p.categorias?.icone || '')} ${escapeHtml(p.categorias?.nome || 'Sem categoria')}</div>
        <div class="quick-product-price">R$ ${fmt(p.preco || 0)}</div>
      </button>`).join('') || '<div class="split-empty">Nenhum produto disponível para venda rápida.</div>'}`;
}

function adicionarProdutoBalcao(produtoId) {
  const produto = balcaoProdutos.find(p => String(p.id) === String(produtoId));
  if (!produto) return;
  const item = balcaoCarrinho.find(i => String(i.produto_id) === String(produtoId));
  if (item) item.quantidade += 1;
  else balcaoCarrinho.push({ produto_id: String(produtoId), nome: produto.nome, preco: Number(produto.preco || 0), quantidade: 1 });
  renderBalcaoConta();
}

function alterarQtdBalcao(produtoId, delta) {
  const item = balcaoCarrinho.find(i => String(i.produto_id) === String(produtoId));
  if (!item) return;
  item.quantidade += delta;
  if (item.quantidade <= 0) balcaoCarrinho = balcaoCarrinho.filter(i => String(i.produto_id) !== String(produtoId));
  renderBalcaoConta();
}

function totalBalcao() {
  return Number(balcaoCarrinho.reduce((acc, item) => acc + Number(item.preco || 0) * Number(item.quantidade || 0), 0).toFixed(2));
}

function renderBalcaoConta() {
  totalBalcaoAtual = totalBalcao();
  document.getElementById('conta-mesa-num').textContent = 'Balcão';
  document.getElementById('conta-mesa-info').textContent = balcaoCarrinho.length ? `${balcaoCarrinho.length} produto(s) na venda rápida` : 'Venda direta sem mesa';
  document.getElementById('conta-total').textContent = 'R$ ' + fmt(totalBalcaoAtual);
  document.getElementById('conta-body').innerHTML = `
    <div class="quick-cart-list">
      ${balcaoCarrinho.map(item => `
        <div class="quick-cart-item">
          <div>
            <div>${escapeHtml(item.nome)}</div>
            <div class="split-empty">R$ ${fmt(item.preco)} un.</div>
          </div>
          <strong>R$ ${fmt(Number(item.preco || 0) * Number(item.quantidade || 0))}</strong>
          <div class="quick-cart-actions">
            <button onclick="alterarQtdBalcao('${escapeAttr(item.produto_id)}', -1)">-</button>
            <span>${escapeHtml(item.quantidade)}</span>
            <button onclick="alterarQtdBalcao('${escapeAttr(item.produto_id)}', 1)">+</button>
          </div>
        </div>`).join('') || '<div class="conta-vazia"><span>Selecione produtos para vender no balcão.</span></div>'}
    </div>`;
  document.getElementById('conta-footer').style.display = 'block';
  document.getElementById('split-forma').innerHTML = formasPagamentoOptions();
  configurarEventosPagamento();
  renderReferenciaPagamento();
  renderPagamentos();
  document.getElementById('btn-fechar').textContent = '✓ Finalizar venda balcão';
}

async function carregarMesas() {
  if (modoCaixa !== 'mesas') return;
  try {
    const { mesas } = await apiCall('GET', '/api/admin/tables');
    document.getElementById('mesas-grid').innerHTML = mesas.map(m => {
      const sess  = m.sessao_ativa;
      const total = Number(sess?.total_consumido || 0);
      const isSel = mesaSelecionada?.id === m.id;
      return `<button class="mesa-btn ${escapeAttr(m.status)} ${isSel?'selecionada':''}"
        onclick="selecionarMesa(this,'${escapeAttr(m.id)}','${escapeAttr(sess?.id||'')}',${Number(m.numero || 0)},${total},'${escapeAttr(m.status)}')">
        <div class="mesa-num">${escapeHtml(m.numero)}</div>
        <div class="mesa-status ${escapeAttr(m.status)}">${m.status === 'ocupada' ? '● Ocupada' : '● Livre'}</div>
        ${sess ? `<div class="mesa-total">R$ ${fmt(total)}</div>` : ''}
      </button>`;
    }).join('');

    // Se tinha mesa selecionada, recarregar a conta dela
    if (mesaSelecionada && sessaoSelecionada) {
      carregarConta(mesaSelecionada.numero, sessaoSelecionada);
    }
  } catch(e) {
    document.getElementById('mesas-grid').innerHTML = '<div style="padding:20px;color:var(--muted);font-size:13px">Erro ao carregar mesas.</div>';
  }
}

function resetContaMesa() {
  mesaSelecionada = null;
  sessaoSelecionada = null;
  pgtoSelecionado = null;
  pagamentos = [];
  totalContaAtual = 0;
  document.getElementById('conta-mesa-num').textContent = '—';
  document.getElementById('conta-mesa-info').textContent = 'Selecione uma mesa';
  document.getElementById('conta-total').textContent = 'R$ 0,00';
  document.getElementById('conta-footer').style.display = 'none';
  document.getElementById('conta-body').innerHTML = '<div class="conta-vazia"><div style="font-size:32px">🧾</div><span>Selecione uma mesa ocupada</span></div>';
}

function selecionarMesa(el, mesaId, sessaoId, numero, total, status) {
  if (status !== 'ocupada' || !sessaoId) {
    showToast('Mesa livre — nenhuma conta aberta', '');
    return;
  }
  mesaSelecionada   = { id: mesaId, numero };
  sessaoSelecionada = sessaoId;
  pgtoSelecionado   = null;
  pagamentos = [];
  totalContaAtual = Number(total || 0);
  document.getElementById('split-forma').innerHTML = formasPagamentoOptions();
  configurarEventosPagamento();
  renderReferenciaPagamento();
  document.getElementById('btn-fechar').disabled = true;
  document.getElementById('btn-fechar').textContent = '✓ Fechar conta';
  document.getElementById('conta-mesa-num').textContent = `Mesa ${numero}`;
  document.getElementById('conta-mesa-info').textContent = `R$ ${fmt(total)} em aberto`;
  document.getElementById('conta-footer').style.display = 'block';
  carregarConta(numero, sessaoId);
  // Atualizar visual das mesas
  document.querySelectorAll('.mesa-btn').forEach(b => b.classList.remove('selecionada'));
  if (el) el.classList.add('selecionada');
}

async function carregarConta(numero, sessaoId) {
  if (modoCaixa !== 'mesas') return;
  document.getElementById('conta-body').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const slug = getCurrentRestaurantSlug();
    const data = await apiPublic('GET', `/api/public/restaurants/${slug}/sessions/${sessaoId}/bill`);
    const pedidos = data.pedidos || [];
    const total   = Number(data.total_consumido ?? pedidos.filter(p => p.status !== 'cancelado').reduce((a, p) => a + Number(p.total || 0), 0));
    totalContaAtual = total;
    if (modoCaixa !== 'mesas') return;

    document.getElementById('conta-total').textContent = 'R$ ' + fmt(total);
    const cancelados = pedidos.filter(p => p.status === 'cancelado').length;
    document.getElementById('conta-mesa-info').textContent = `${pedidos.length} pedido(s)${cancelados ? ` · ${cancelados} cancelado(s)` : ''} · R$ ${fmt(total)}`;

    if (!pedidos.length) {
      document.getElementById('conta-body').innerHTML = '<div class="conta-vazia"><span>Nenhum pedido ainda</span></div>';
      return;
    }

    document.getElementById('conta-body').innerHTML = pedidos.map(p => `
      <div class="pedido-bloco">
        <div class="pedido-head">
          <span class="pedido-num">#${escapeHtml(p.numero)}</span>
          <span class="pedido-status ${escapeAttr(p.status)}">${escapeHtml({pendente:'Aguardando',confirmado:'Confirmado',em_preparo:'Em preparo',pronto:'Pronto',entregue:'Entregue',cancelado:'Cancelado'}[p.status]||p.status)}</span>
        </div>
        ${(p.itens||[]).map(it => `
          <div class="pedido-item">
            <span>${escapeHtml(it.quantidade)}× ${escapeHtml(it.nome_produto)}</span>
            <span class="pedido-item-preco">R$ ${fmt(it.subtotal)}</span>
          </div>`).join('')}
      </div>`).join('');
    renderPagamentos();
  } catch(e) {
    document.getElementById('conta-body').innerHTML = '<div class="conta-vazia"><span>Erro ao carregar conta</span></div>';
  }
}

function selPgto(btn, pgto) {
  document.querySelectorAll('.pgto-opt').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  pgtoSelecionado = pgto;
  document.getElementById('btn-fechar').disabled = false;
}

function formasPagamentoOptions() {
  return formasPagamento
    .filter(m => m.is_active !== false)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name).localeCompare(String(b.name)))
    .map(m => `<option value="${escapeAttr(m.code)}">${escapeHtml(m.name)}</option>`)
    .join('');
}

function labelPagamento(forma) {
  return formasPagamento.find(m => m.code === forma)?.name || {
    dinheiro:'Dinheiro', pix:'Pix', cartao_credito:'Cartão crédito', cartao_debito:'Cartão débito',
  }[forma] || forma;
}

function formaPagamentoMeta(code = formaPagamentoDigitada()) {
  return formasPagamento.find(m => m.code === code) || { code, name: labelPagamento(code), type: code === 'dinheiro' ? 'cash' : 'other', allow_change: code === 'dinheiro' };
}

function formaPermiteTroco(code = formaPagamentoDigitada()) {
  const meta = formaPagamentoMeta(code);
  return meta.allow_change === true || meta.type === 'cash' || meta.code === 'dinheiro';
}

function renderReferenciaPagamento() {
  const ref = document.getElementById('split-referencia');
  if (!ref) return;
  const meta = formaPagamentoMeta();
  ref.style.display = meta.requires_reference ? '' : 'none';
  ref.placeholder = meta.requires_reference ? `Referência obrigatória para ${meta.name}` : 'Referência / NSU / autorização';
}

function totalPagamentos() {
  const lista = modoCaixa === 'balcao' ? balcaoPagamentos : pagamentos;
  return lista.reduce((a, p) => a + Number(p.valor || 0), 0);
}

function totalAtualOperacao() {
  return modoCaixa === 'balcao' ? totalBalcaoAtual : totalContaAtual;
}

function valorPagamentoDigitado() {
  const valor = Number(document.getElementById('split-valor')?.value || 0);
  return Number.isFinite(valor) ? Number(valor.toFixed(2)) : 0;
}

function formaPagamentoDigitada() {
  return document.getElementById('split-forma')?.value || 'dinheiro';
}

function restantePagamento() {
  return Math.max(0, Number((totalAtualOperacao() - totalPagamentos()).toFixed(2)));
}

function restanteComPagamentoDigitado() {
  const restante = restantePagamento();
  const valor = valorPagamentoDigitado();
  if (formaPermiteTroco() && valor >= restante) return 0;
  return Math.max(0, Number((restante - valor).toFixed(2)));
}

function pagamentoDigitadoValido() {
  const valor = valorPagamentoDigitado();
  const restante = restantePagamento();
  if (formaPermiteTroco()) return valor > 0;
  return valor > 0 && valor - restante <= 0.02;
}

function trocoPagamentoDigitado() {
  if (!formaPermiteTroco()) return 0;
  return Math.max(0, Number((valorPagamentoDigitado() - restantePagamento()).toFixed(2)));
}

function criarPagamentoDigitado() {
  const forma = formaPagamentoDigitada();
  const valorDigitado = valorPagamentoDigitado();
  const restante = restantePagamento();
  if (!valorDigitado || valorDigitado <= 0) return null;
  if (restante <= 0.02) return null;
  const meta = formaPagamentoMeta(forma);
  if (!formaPermiteTroco(forma) && valorDigitado - restante > 0.02) {
    showToast('Valor maior que o restante', 'error');
    return null;
  }
  const ref = document.getElementById('split-referencia')?.value.trim() || '';
  if (meta.requires_reference && !ref) {
    showToast(`Informe a referência de ${meta.name}`, 'error');
    return null;
  }
  const valorAplicado = formaPermiteTroco(forma) ? Math.min(valorDigitado, restante) : valorDigitado;
  const pagamento = {
    forma_pagamento: forma,
    valor: Number(valorAplicado.toFixed(2)),
    payment_method_id: meta.id || null,
    payment_method_name_snapshot: meta.name,
    payment_method_type_snapshot: meta.type || 'other',
  };
  if (ref) pagamento.referencia = ref;
  if (formaPermiteTroco(forma) && valorDigitado > valorAplicado) {
    pagamento.valor_recebido = Number(valorDigitado.toFixed(2));
    pagamento.troco = Number((valorDigitado - valorAplicado).toFixed(2));
  }
  return pagamento;
}

function configurarEventosPagamento() {
  const input = document.getElementById('split-valor');
  const forma = document.getElementById('split-forma');
  const referencia = document.getElementById('split-referencia');
  if (input && !input.dataset.bound) {
    input.dataset.bound = '1';
    input.addEventListener('input', renderPagamentos);
    input.addEventListener('change', renderPagamentos);
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (pagamentoDigitadoValido() && restanteComPagamentoDigitado() <= 0.02) fecharConta();
      else adicionarPagamento();
    });
  }
  if (forma && !forma.dataset.bound) {
    forma.dataset.bound = '1';
    forma.addEventListener('change', () => { renderReferenciaPagamento(); renderPagamentos(); });
  }
  if (referencia && !referencia.dataset.bound) {
    referencia.dataset.bound = '1';
    referencia.addEventListener('input', renderPagamentos);
  }
}

function adicionarPagamento() {
  const pagamento = criarPagamentoDigitado();
  if (!pagamento) return;
  const destino = modoCaixa === 'balcao' ? balcaoPagamentos : pagamentos;
  destino.push(pagamento);
  document.getElementById('split-valor').value = '';
  const ref = document.getElementById('split-referencia');
  if (ref) ref.value = '';
  renderPagamentos();
}

function preencherRestante() {
  const restante = restantePagamento();
  if (restante > 0) {
    document.getElementById('split-valor').value = restante.toFixed(2);
    renderPagamentos();
  }
}

function removerPagamento(idx) {
  if (modoCaixa === 'balcao') balcaoPagamentos.splice(idx, 1);
  else pagamentos.splice(idx, 1);
  renderPagamentos();
}

function renderPagamentos() {
  const lista = document.getElementById('split-lista');
  const resumo = document.getElementById('split-resumo');
  if (!lista || !resumo) return;
  const restante = restantePagamento();
  const digitado = valorPagamentoDigitado();
  const restanteFinal = pagamentoDigitadoValido() ? restanteComPagamentoDigitado() : restante;
  const listaPagamentos = modoCaixa === 'balcao' ? balcaoPagamentos : pagamentos;
  const trocoDigitado = trocoPagamentoDigitado();
  resumo.textContent = `Pago: R$ ${fmt(totalPagamentos())} · Digitado: R$ ${fmt(digitado)} · Restante: R$ ${fmt(restanteFinal)}${trocoDigitado > 0 ? ` · Troco: R$ ${fmt(trocoDigitado)}` : ''}`;
  lista.innerHTML = listaPagamentos.length ? listaPagamentos.map((p, idx) => `
    <div class="split-pay-item">
      <span>${labelPagamento(p.forma_pagamento)}</span>
      <strong>R$ ${fmt(p.valor)}${p.troco ? ` · Troco R$ ${fmt(p.troco)}` : ''}${p.referencia ? ` · ${escapeHtml(p.referencia)}` : ''}</strong>
      <button onclick="removerPagamento(${idx})">✕</button>
    </div>`).join('') : '<div class="split-empty">Nenhum pagamento adicionado.</div>';
  const semItensBalcao = modoCaixa === 'balcao' && !balcaoCarrinho.length;
  document.getElementById('btn-fechar').disabled = restanteFinal > 0.02 || (!listaPagamentos.length && !pagamentoDigitadoValido()) || !turnoAtivo || semItensBalcao;
}

function consolidarPagamentoDigitado() {
  if (!pagamentoDigitadoValido()) return;
  const pagamento = criarPagamentoDigitado();
  if (!pagamento) return;
  const destino = modoCaixa === 'balcao' ? balcaoPagamentos : pagamentos;
  destino.push(pagamento);
  document.getElementById('split-valor').value = '';
  const ref = document.getElementById('split-referencia');
  if (ref) ref.value = '';
  renderPagamentos();
}

async function fecharConta() {
  if (modoCaixa === 'balcao') return finalizarVendaBalcao();
  consolidarPagamentoDigitado();
  if (!mesaSelecionada || !pagamentos.length || restantePagamento() > 0.02) return;
  if (!turnoAtivo) {
    showToast('Abra um turno de caixa antes de fechar contas', 'error');
    return;
  }
  const btn = document.getElementById('btn-fechar');
  btn.disabled = true;
  btn.textContent = 'Fechando...';
  try {
    await apiCall('POST', `/api/admin/tables/${mesaSelecionada.id}/close`,
      { pagamentos, cash_shift_id: turnoAtivo.id });
    showToast(`Mesa ${mesaSelecionada.numero} fechada!`, 'success');
    // Resetar
    resetContaMesa();
    carregarCaixas(false);
    carregarMesas();
  } catch(e) {
    showToast(e.message, 'error');
    btn.disabled = false;
    btn.textContent = '✓ Fechar conta';
  }
}

async function finalizarVendaBalcao() {
  consolidarPagamentoDigitado();
  if (!balcaoCarrinho.length || !balcaoPagamentos.length || restantePagamento() > 0.02) return;
  if (!turnoAtivo) {
    showToast('Abra um turno de caixa antes de vender no balcão', 'error');
    return;
  }
  const btn = document.getElementById('btn-fechar');
  btn.disabled = true;
  btn.textContent = 'Finalizando...';
  try {
    const resp = await apiCall('POST', '/api/admin/quick-sale', {
      cash_shift_id: turnoAtivo.id,
      items: balcaoCarrinho.map(i => ({ produto_id: i.produto_id, quantidade: i.quantidade })),
      pagamentos: balcaoPagamentos,
      observacao: 'Venda direta no caixa',
    });
    showToast(`Venda balcão #${resp.pedido?.numero || ''} finalizada`, 'success');
    balcaoCarrinho = [];
    balcaoPagamentos = [];
    renderBalcaoConta();
    carregarCaixas(false);
  } catch (e) {
    showToast(e.message, 'error');
    btn.disabled = false;
    btn.textContent = '✓ Finalizar venda balcão';
  }
}

function fmt(n) { return Number(n).toFixed(2).replace('.', ','); }

function fmtDate(value) {
  return value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function showToast(msg, tipo='') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (tipo?' '+tipo:'') + ' show';
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3000);
}

init();

