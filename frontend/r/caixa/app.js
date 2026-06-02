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
  carregarCaixas();
  carregarMesas();
  function agendar() { polling = setTimeout(() => { carregarCaixas(false); carregarMesas(); agendar(); }, 10000); }
  agendar();
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

async function carregarMesas() {
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
  document.getElementById('conta-body').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const slug = getCurrentRestaurantSlug();
    const data = await apiPublic('GET', `/api/public/restaurants/${slug}/sessions/${sessaoId}/bill`);
    const pedidos = data.pedidos || [];
    const total   = pedidos.reduce((a, p) => a + Number(p.total || 0), 0);
    totalContaAtual = total;

    document.getElementById('conta-total').textContent = 'R$ ' + fmt(total);
    document.getElementById('conta-mesa-info').textContent = `${pedidos.length} pedido(s) · R$ ${fmt(total)}`;

    if (!pedidos.length) {
      document.getElementById('conta-body').innerHTML = '<div class="conta-vazia"><span>Nenhum pedido ainda</span></div>';
      return;
    }

    document.getElementById('conta-body').innerHTML = pedidos.map(p => `
      <div class="pedido-bloco">
        <div class="pedido-head">
          <span class="pedido-num">#${escapeHtml(p.numero)}</span>
          <span class="pedido-status ${escapeAttr(p.status)}">${escapeHtml({pendente:'Aguardando',confirmado:'Confirmado',em_preparo:'Em preparo',pronto:'Pronto',entregue:'Entregue'}[p.status]||p.status)}</span>
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

function totalPagamentos() {
  return pagamentos.reduce((a, p) => a + Number(p.valor || 0), 0);
}

function valorPagamentoDigitado() {
  const valor = Number(document.getElementById('split-valor')?.value || 0);
  return Number.isFinite(valor) ? Number(valor.toFixed(2)) : 0;
}

function restantePagamento() {
  return Math.max(0, Number((totalContaAtual - totalPagamentos()).toFixed(2)));
}

function restanteComPagamentoDigitado() {
  return Math.max(0, Number((restantePagamento() - valorPagamentoDigitado()).toFixed(2)));
}

function pagamentoDigitadoValido() {
  const valor = valorPagamentoDigitado();
  return valor > 0 && valor - restantePagamento() <= 0.02;
}

function configurarEventosPagamento() {
  const input = document.getElementById('split-valor');
  const forma = document.getElementById('split-forma');
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
    forma.addEventListener('change', renderPagamentos);
  }
}

function adicionarPagamento() {
  const forma = document.getElementById('split-forma').value;
  const valor = valorPagamentoDigitado();
  if (!valor || valor <= 0) return showToast('Informe um valor válido', 'error');
  if (valor - restantePagamento() > 0.02) return showToast('Valor maior que o restante', 'error');
  pagamentos.push({ forma_pagamento: forma, valor: Number(valor.toFixed(2)) });
  document.getElementById('split-valor').value = '';
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
  pagamentos.splice(idx, 1);
  renderPagamentos();
}

function renderPagamentos() {
  const lista = document.getElementById('split-lista');
  const resumo = document.getElementById('split-resumo');
  if (!lista || !resumo) return;
  const restante = restantePagamento();
  const digitado = valorPagamentoDigitado();
  const restanteFinal = pagamentoDigitadoValido() ? restanteComPagamentoDigitado() : restante;
  resumo.textContent = `Pago: R$ ${fmt(totalPagamentos())} · Digitado: R$ ${fmt(digitado)} · Restante: R$ ${fmt(restanteFinal)}`;
  lista.innerHTML = pagamentos.length ? pagamentos.map((p, idx) => `
    <div class="split-pay-item">
      <span>${labelPagamento(p.forma_pagamento)}</span>
      <strong>R$ ${fmt(p.valor)}</strong>
      <button onclick="removerPagamento(${idx})">✕</button>
    </div>`).join('') : '<div class="split-empty">Nenhum pagamento adicionado.</div>';
  document.getElementById('btn-fechar').disabled = restanteFinal > 0.02 || (!pagamentos.length && !pagamentoDigitadoValido()) || !turnoAtivo;
}

function consolidarPagamentoDigitado() {
  if (!pagamentoDigitadoValido()) return;
  pagamentos.push({
    forma_pagamento: document.getElementById('split-forma').value,
    valor: valorPagamentoDigitado(),
  });
  document.getElementById('split-valor').value = '';
  renderPagamentos();
}

async function fecharConta() {
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
    mesaSelecionada = null; sessaoSelecionada = null; pgtoSelecionado = null; pagamentos = []; totalContaAtual = 0;
    document.getElementById('conta-mesa-num').textContent = '—';
    document.getElementById('conta-mesa-info').textContent = 'Selecione uma mesa';
    document.getElementById('conta-footer').style.display = 'none';
    document.getElementById('conta-body').innerHTML = '<div class="conta-vazia"><div style="font-size:32px">🧾</div><span>Selecione uma mesa ocupada</span></div>';
    carregarCaixas(false);
    carregarMesas();
  } catch(e) {
    showToast(e.message, 'error');
    btn.disabled = false;
    btn.textContent = '✓ Fechar conta';
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

